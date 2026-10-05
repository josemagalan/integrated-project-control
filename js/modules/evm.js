/*
 * Módulo de valor ganado. Sigue la secuencia del Tema 7 con el proyecto del editor.
 */
(function (root) {
  'use strict';

  const E = root.PCEngine;
  const F = root.PCFormat;
  const I = root.PCI18n;
  const K = root.PCKit;
  const COL = { plan: 'var(--c-plan)', ev: 'var(--c-evm)', ac: 'var(--c-ac)' };

  function render(container, { project, AT, lang, t, go }) {
    const L = root.PCEvmText.TEXT[lang];
    const A = (k) => I.acr(lang, k);
    const m = E.metricsAt(project, AT);
    const money = (v) => F.money(lang, v);
    const n2 = (v) => F.num(lang, v, 2);
    const n3 = (v) => F.num(lang, v, 3);
    const pct = (v) => F.pct(lang, v, 1);
    const unitOne = t(`unitOne_${project.unit}`);
    const units = t(`unit_${project.unit}`);
    const fill = (s, o) => Object.entries(o).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), s);
    const acts = project.activities;
    const PD = m.PD;
    const hist = project.historyKnown;

    container.textContent = '';
    const charts = [];

    // 1. Tres cantidades
    const diff = m.AC - m.PV;
    const trap = Math.abs(diff) < 0.5 ? L.trapEq : fill(diff < 0 ? L.trapLess : L.trapMore, { d: money(Math.abs(diff)) });
    container.append(K.step(1, L.s1, [
      K.p(L.s1a),
      K.figures([
        { label: A('PV'), value: money(m.PV), note: L.qPV, color: COL.plan },
        { label: A('EV'), value: money(m.EV), note: L.qEV, color: COL.ev },
        { label: A('AC'), value: money(m.AC), note: L.qAC, color: COL.ac },
        { label: L.pctDone, value: pct(m.percentComplete), note: `${A('BAC')} = ${money(m.BAC)}` },
      ]),
      K.aside(L.trap, [K.p(trap)]),
    ]));

    // 2. Línea base
    const c2 = K.chartBox();
    const terms = acts.map((a) => E.pvActivity(a, AT)).filter((v) => v > 1e-9);
    container.append(K.step(2, L.s2, [
      K.p(fill(L.s2a, { units, unit: unitOne })),
      K.formulas(`PV(${AT}) = ${terms.length > 1 ? `${terms.map(money).join(' + ')} = ` : ''}${money(m.PV)}`),
      c2,
    ]));
    charts.push(() => {
      const xMax = Math.max(PD, AT) + 1;
      const pts = [];
      for (let k = 0; k <= xMax; k++) pts.push({ x: k, y: E.pv(project, k) });
      root.PCLines.render(c2, {
        height: 260, xMax, yMax: m.BAC * 1.08, yFormat: (v) => F.num(lang, v, 0), ariaLabel: L.s2, xAxisTitle: units,
        series: [{ key: 'PV', color: COL.plan, points: pts }],
        refY: [{ y: m.BAC, label: 'BAC' }], refX: [{ x: PD, label: 'PD' }],
        at: { x: AT, label: `AT = ${AT}` },
        points: [{ x: AT, y: m.PV, color: COL.plan, label: `PV = ${money(m.PV)}`, anchor: 'start', dx: 10, dy: -8 }],
        tooltip: { title: (x) => `${unitOne} ${x}`, rows: (x) => [{ label: 'PV', color: COL.plan, value: money(E.pv(project, x)) }] },
      });
    });

    // 3. El corte
    const c3 = K.chartBox();
    const evTerms = acts.filter((a) => E.pcAt(a, AT) > 0).map((a) => `${money(a.budget)}·${F.pctSmart(lang, E.pcAt(a, AT))}`);
    container.append(K.step(3, L.s3, [
      K.p(L.s3a),
      K.formulas(`EV(${AT}) = Σ BAC_i · %_i = ${evTerms.join(' + ') || '0'} = ${money(m.EV)}`, `AC(${AT}) = ${money(m.AC)}`),
      K.p(L.s3b),
      c3,
    ]));
    charts.push(() => {
      const xMax = Math.max(PD, AT) + 1;
      const pv = [];
      for (let k = 0; k <= xMax; k++) pv.push({ x: k, y: E.pv(project, k) });
      const series = [{ key: 'PV', color: COL.plan, points: pv }];
      if (hist) {
        const evH = []; const acH = [];
        for (let k = 0; k <= AT; k++) { evH.push({ x: k, y: E.ev(project, k) }); acH.push({ x: k, y: E.ac(project, k) }); }
        series.push({ key: 'EV', color: COL.ev, points: evH, width: 4 }, { key: 'AC', color: COL.ac, points: acH });
      }
      const yMax = Math.max(m.BAC, m.AC) * 1.08;
      root.PCLines.render(c3, {
        height: 300, xMax, yMax, yFormat: (v) => F.num(lang, v, 0), ariaLabel: L.s3, xAxisTitle: units,
        series, refY: [{ y: m.BAC, label: 'BAC' }], refX: [{ x: PD, label: 'PD' }],
        at: { x: AT, label: `AT = ${AT}` },
        brackets: [
          { x: AT, y0: m.PV, y1: m.EV, label: `SV = ${money(m.SV)}`, dx: 12 },
          { x: AT, y0: m.EV, y1: m.AC, label: `CV = ${money(m.CV)}`, dx: 12 + 118 },
        ],
        points: [
          { x: AT, y: m.PV, color: COL.plan, label: 'PV' },
          { x: AT, y: m.EV, color: COL.ev, label: 'EV' },
          { x: AT, y: m.AC, color: COL.ac, label: 'AC' },
        ],
        tooltip: hist ? {
          title: (x) => `${unitOne} ${x}`,
          rows: (x) => [
            { label: 'PV', color: COL.plan, value: money(E.pv(project, x)) },
            ...(x <= AT ? [{ label: 'EV', color: COL.ev, value: money(E.ev(project, x)) }, { label: 'AC', color: COL.ac, value: money(E.ac(project, x)) }] : []),
          ],
        } : null,
      });
    });

    // 4. Variaciones
    const sgn = (v, pos, neg, zero) => (Math.abs(v) < 0.5 ? zero : v > 0 ? pos : neg);
    container.append(K.step(4, L.s4, [
      K.formulas(
        `${A('SV')} = EV − PV = ${money(m.EV)} − ${money(m.PV)} = ${money(m.SV)}   ·   %SV = SV/PV = ${m.PV > 0 ? pct(m.SV / m.PV) : '—'}`,
        `${A('CV')} = EV − AC = ${money(m.EV)} − ${money(m.AC)} = ${money(m.CV)}   ·   %CV = CV/EV = ${m.EV > 0 ? pct(m.CV / m.EV) : '—'}`,
      ),
      K.list([sgn(m.SV, L.svPos, L.svNeg, L.svZero), sgn(m.CV, L.cvPos, L.cvNeg, L.cvZero)]),
    ]));

    // 5. Índices
    const csi = m.SCI;
    const level = csi === null ? null : csi > 0.9 ? 'ok' : csi >= 0.8 ? 'check' : 'alert';
    const c5 = K.chartBox('quad');
    const quadLegend = K.el('ul');
    root.PCCharts.statusLegend(quadLegend, t);
    container.append(K.step(5, L.s5, [
      K.formulas(
        `${A('CPI')} = EV/AC = ${money(m.EV)}/${money(m.AC)} = ${n3(m.CPI)}`,
        `${A('SPI')} = EV/PV = ${money(m.EV)}/${money(m.PV)} = ${n3(m.SPI)}`,
        `CSI = CPI·SPI = ${n3(m.CPI)}·${n3(m.SPI)} = ${n3(csi)}`,
      ),
      K.list([L.cpiTxt, L.spiTxt, L.csiTxt]),
      K.trafficLight([
        { key: 'ok', label: L.ok, rule: L.csiOk },
        { key: 'check', label: L.check, rule: L.csiCheck },
        { key: 'alert', label: L.alert, rule: L.csiAlert },
      ], level),
      K.el('h3', 'step-sub', L.quadTitle),
      c5,
      quadLegend,
    ]));
    charts.push(() => quadrant(c5, project, AT, m, L, lang, hist, t));

    // 6. Proyecciones
    const d = m.costEAC;
    const ETC = d.cpi === null ? null : d.cpi - m.AC;
    const EACt = m.durationEAC.pv.spi;
    const c6 = K.chartBox();
    // TCPI: tres casos (terminado, presupuesto agotado, normal); ver el motor.
    const tcpiFormula = m.tcpiCase === 'normal'
      ? `TCPI = (BAC − EV)/(BAC − AC) = ${money(m.BAC - m.EV)}/${money(m.BAC - m.AC)} = ${n3(m.TCPI)}`
      : m.tcpiCase === 'exhausted' && m.TCPIeac !== null
        ? `TCPI = (BAC − EV)/(EAC − AC) = ${money(m.BAC - m.EV)}/${money(d.cpi - m.AC)} = ${n3(m.TCPIeac)}`
        : null;
    let tcpiNote;
    if (m.tcpiCase === 'done') tcpiNote = L.tcpiDone;
    else if (m.tcpiCase === 'exhausted') tcpiNote = m.TCPIeac === null ? L.tcpiExhausted : `${L.tcpiExhausted} ${L.tcpiEac}`;
    else if (m.TCPI === null) tcpiNote = '';
    else tcpiNote = m.TCPI > 1 + 1e-9 ? L.tcpiHard : m.TCPI < 1 - 1e-9 ? L.tcpiEasy : L.tcpiEven;
    // Sin CPI puede faltar trabajo ganado (EV = 0) o solo coste real (AC = 0): el aviso distingue ambos.
    const noCpiKey = d.cpi !== null ? null : Math.abs(m.EV) < 1e-9 ? 'noProgress' : Math.abs(m.AC) < 1e-9 ? 'noCostYet' : 'noProgress';
    const noProgress = noCpiKey ? K.aside(null, [K.p(t(noCpiKey))]) : null;
    container.append(K.step(6, L.s6, [
      K.p(L.eacIntro),
      noProgress,
      K.list([
        `${L.eac1}  EAC = AC + (BAC − EV) = ${money(d.pf1)}`,
        `${L.eac2}  EAC = BAC/CPI = ${money(m.BAC)}/${n3(m.CPI)} = ${money(d.cpi)}`,
        `${L.eac3}  EAC = AC + (BAC − EV)/(CPI·SPI) = ${money(d.sci)}`,
      ]),
      K.formulas(
        `ETC = EAC − AC = ${money(d.cpi)} − ${money(m.AC)} = ${money(ETC)}`,
        `VAC = BAC − EAC = ${money(m.BAC)} − ${money(d.cpi)} = ${money(m.VAC)}`,
        tcpiFormula,
        `EACt = (BAC/SPI)/(BAC/PD) = PD/SPI = ${PD}/${n3(m.SPI)} = ${n2(EACt)} ${units}`,
      ),
      K.list([L.etc, L.vac, `${L.tcpi} ${tcpiNote}`.trim(), L.eact]),
      c6,
    ]));
    charts.push(() => {
      if (d.cpi === null || EACt === null) return;
      const tEnd = Math.min(Math.max(PD, AT, EACt), 3 * PD);
      const xMax = Math.ceil(tEnd) + 1;
      const pv = [];
      for (let k = 0; k <= xMax; k++) pv.push({ x: k, y: E.pv(project, k) });
      const series = [{ key: 'PV', color: COL.plan, points: pv }];
      if (hist) {
        const evH = []; const acH = [];
        for (let k = 0; k <= AT; k++) { evH.push({ x: k, y: E.ev(project, k) }); acH.push({ x: k, y: E.ac(project, k) }); }
        series.push({ key: 'EV', color: COL.ev, points: evH, width: 4 }, { key: 'AC', color: COL.ac, points: acH });
      }
      const yMax = Math.max(m.BAC, d.cpi) * 1.1;
      root.PCLines.render(c6, {
        height: 320, xMax, yMax, yFormat: (v) => F.num(lang, v, 0), ariaLabel: L.fcAria, xAxisTitle: units,
        series,
        extra: [
          { points: [{ x: AT, y: m.AC }, { x: tEnd, y: d.cpi }], color: COL.ac, dash: '5 4' },
          { points: [{ x: AT, y: m.EV }, { x: tEnd, y: m.BAC }], color: COL.ev, dash: '5 4' },
        ],
        refY: [{ y: m.BAC, label: 'BAC' }, ...(Math.abs(d.cpi - m.BAC) > yMax * 0.04 ? [{ y: d.cpi, label: 'EAC' }] : [])],
        refX: [{ x: PD, label: 'PD' }, ...(Math.abs(EACt - PD) > 0.3 ? [{ x: tEnd, label: EACt > tEnd ? `EACt > ${n2(tEnd)}` : 'EACt' }] : [])],
        at: { x: AT, label: `AT = ${AT}` },
        brackets: [{ x: tEnd, y0: m.BAC, y1: d.cpi, label: `VAC = ${money(m.VAC)}`, dx: -110 }],
        points: [
          { x: AT, y: m.EV, color: COL.ev, label: 'EV' },
          { x: AT, y: m.AC, color: COL.ac, label: 'AC' },
          { x: tEnd, y: d.cpi, color: COL.ac, label: 'EAC', anchor: 'start', dx: 8, dy: Math.abs(d.cpi - m.BAC) > yMax * 0.04 ? 4 : -10 },
        ],
      });
    });

    // 7. Límites
    const s7 = [K.p(L.cpiStable), K.p(L.spiLimit)];
    if (AT > PD) s7.push(K.aside(null, [K.p(fill(L.spiNow, { at: AT, pd: PD, spi: n3(m.SPI) }))]));
    const goBtn = K.el('button', 'btn primary', `${L.goES} →`);
    goBtn.type = 'button';
    goBtn.addEventListener('click', () => go('es'));
    s7.push(goBtn);
    container.append(K.step(7, L.s7, s7));

    for (const draw of charts) draw();
  }

  /** Cuadrante CPI (vertical) frente a SPI (horizontal). */
  function quadrant(box, project, AT, m, L, lang, hist, t) {
    const d3 = root.d3;
    box.querySelectorAll(':scope > svg').forEach((n) => n.remove());
    const W = Math.min(root.PCCharts.width(box), 560);
    const H = Math.min(W, 380);
    const mg = { top: 12, right: 16, bottom: 36, left: 48 };
    const iw = W - mg.left - mg.right;
    const ih = H - mg.top - mg.bottom;
    const pts = [];
    const last = hist ? AT : AT;
    for (let k = hist ? 1 : AT; k <= last; k++) {
      const q = E.metricsAt(project, k);
      if (q.CPI !== null && q.SPI !== null) pts.push({ x: q.SPI, y: q.CPI, k });
    }
    const vals = pts.flatMap((p) => [p.x, p.y]);
    const lo = Math.min(0.6, ...vals) - 0.05;
    const hi = Math.max(1.4, ...vals) + 0.05;
    const x = d3.scaleLinear().domain([lo, hi]).range([0, iw]);
    const y = d3.scaleLinear().domain([lo, hi]).range([ih, 0]);
    const svg = d3.select(box).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', L.quadAria)
      .style('max-width', `${W}px`);
    const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);
    const q = [
      { x0: 1, x1: hi, y0: 1, y1: hi, t: L.q11, ax: 'end', px: iw - 6, py: 14 },
      { x0: 1, x1: hi, y0: lo, y1: 1, t: L.q01, ax: 'end', px: iw - 6, py: ih - 8 },
      { x0: lo, x1: 1, y0: 1, y1: hi, t: L.q10, ax: 'start', px: 6, py: 14 },
      { x0: lo, x1: 1, y0: lo, y1: 1, t: L.q00, ax: 'start', px: 6, py: ih - 8 },
    ];
    // Semáforo según el peor de los dos índices: < 0,90 rojo, 0,90–1 ámbar, ≥ 1 verde.
    const S = root.PCCharts.STATUS;
    // Rectángulos sin solapes (los lavados se suman si se superponen).
    const zone = (cls, x0, x1, y0, y1) => g.append('rect').attr('class', `zone ${cls}`)
      .attr('x', x(x0)).attr('y', y(y1)).attr('width', x(x1) - x(x0)).attr('height', y(y0) - y(y1));
    zone('zone-crit', lo, S.warn, lo, hi);
    zone('zone-crit', S.warn, hi, lo, S.warn);
    zone('zone-warn', S.warn, S.good, S.warn, hi);
    zone('zone-warn', S.good, hi, S.warn, S.good);
    zone('zone-good', S.good, hi, S.good, hi);
    // Área objetivo: CPI y SPI entre 0,95 y 1,08
    g.append('rect').attr('class', 'target-area').attr('x', x(0.95)).attr('y', y(1.08))
      .attr('width', x(1.08) - x(0.95)).attr('height', y(0.95) - y(1.08));
    g.append('text').attr('class', 'target-label').attr('x', x(0.95) + 4).attr('y', y(1.08) - 4).text(t('targetArea'));
    for (const r of q) {
      g.append('text').attr('class', 'quad-label').attr('x', r.px).attr('y', r.py).attr('text-anchor', r.ax).text(r.t);
    }
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => F.num(lang, v, 1)));
    g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5).tickFormat((v) => F.num(lang, v, 1)));
    g.append('line').attr('class', 'ref').attr('x1', x(1)).attr('x2', x(1)).attr('y1', 0).attr('y2', ih);
    g.append('line').attr('class', 'ref').attr('x1', 0).attr('x2', iw).attr('y1', y(1)).attr('y2', y(1));
    g.append('text').attr('x', iw).attr('y', ih + 30).attr('text-anchor', 'end').text('SPI');
    g.append('text').attr('x', -mg.left + 4).attr('y', -2).text('CPI');
    if (pts.length > 1) {
      g.append('path').attr('class', 'line').attr('d', d3.line().x((p) => x(p.x)).y((p) => y(p.y))(pts))
        .style('stroke', 'var(--muted)').style('stroke-width', 1.5);
      for (const p of pts.slice(0, -1)) g.append('circle').attr('r', 2.5).attr('cx', x(p.x)).attr('cy', y(p.y)).style('fill', 'var(--muted)');
    }
    const cur = pts[pts.length - 1];
    if (cur) {
      g.append('circle').attr('class', 'dot').attr('r', 6).attr('cx', x(cur.x)).attr('cy', y(cur.y)).style('fill', 'var(--ink)');
      g.append('text').attr('class', 'end-label').attr('x', x(cur.x) + 10).attr('y', y(cur.y) + 4)
        .text(`AT = ${AT}`);
    }
  }

  root.PCModuleEVM = { render };
})(this);
