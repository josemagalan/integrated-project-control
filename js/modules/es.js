/*
 * Módulo de programación ganada (Lipke, 2003) con el proyecto del editor.
 */
(function (root) {
  'use strict';

  const E = root.PCEngine;
  const F = root.PCFormat;
  const I = root.PCI18n;
  const K = root.PCKit;
  const COL = { plan: 'var(--c-plan)', ev: 'var(--c-evm)', es: 'var(--c-es)' };

  function render(container, { project, AT, lang, t, go }) {
    const L = root.PCEsText.TEXT[lang];
    const A = (k) => I.acr(lang, k);
    const m = E.metricsAt(project, AT);
    const money = (v) => F.money(lang, v);
    const n2 = (v) => F.num(lang, v, 2);
    const n3 = (v) => F.num(lang, v, 3);
    const unitOne = t(`unitOne_${project.unit}`);
    const units = t(`unit_${project.unit}`);
    const fill = (s, o) => Object.entries(o).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);
    const PD = m.PD;
    container.textContent = '';
    const charts = [];

    // 1. El problema
    const k = m.SPIt;
    const c1 = K.chartBox();
    const s1Legend = K.el('ul');
    root.PCCharts.statusLegend(s1Legend, t);
    const onPlan = k === null || Math.abs(k - 1) < 0.01;
    const end = k ? Math.min(PD / k, 3 * PD) : PD;
    container.append(K.step(1, L.s1, [
      K.p(L.s1a),
      K.p(onPlan ? L.s1c : fill(L.s1b, { k: n2(k), unit: unitOne, end: n2(PD / k) })),
      K.formulas(`${A('SV')} = EV − PV = ${money(m.SV)}   ·   ${A('SPI')} = EV/PV = ${n3(m.SPI)}`),
      c1,
      s1Legend,
    ]));
    charts.push(() => {
      if (!k) return;
      const spi = []; const spit = [];
      const last = Math.ceil(end);
      // Se simula hasta el final supuesto (end); después el proyecto ya ha terminado.
      const taus = [];
      for (let tau = 1; tau <= Math.floor(end + 1e-9); tau++) taus.push(tau);
      if (end - Math.floor(end) > 1e-6) taus.push(end);
      for (const tau of taus) {
        const ev = E.pvAtTime(project, Math.min(tau * k, PD));
        const pv = E.pv(project, tau);
        spi.push({ x: tau, y: pv > 0 ? ev / pv : null });
        spit.push({ x: tau, y: Math.min(tau * k, PD) / tau });
      }
      const vals = [...spi, ...spit].map((q) => q.y).filter((v) => v !== null);
      const yMin = Math.min(0.5, ...vals) - 0.05;
      const yMax = Math.max(1.3, ...vals) + 0.05;
      root.PCLines.render(c1, {
        height: 260, xMax: Math.max(last, AT) + 1, yMin, yMax, zones: root.PCCharts.statusZones(yMin - 1, yMax + 1),
        yFormat: (v) => F.num(lang, v, 1), ariaLabel: L.s1Aria, xAxisTitle: units,
        series: [
          { key: 'SPIt', color: COL.es, points: spit, width: 4, endLabel: 'SPI(t)' },
          { key: 'SPI', color: COL.ev, points: spi, endLabel: 'SPI' },
        ],
        refY: [{ y: 1, label: '1' }], refX: [{ x: PD, label: 'PD' }],
        at: { x: AT, label: `AT = ${AT}` },
        xHoverMin: 1, xHoverMax: Math.floor(end + 1e-9),
        tooltip: {
          title: (x) => `${unitOne} ${x}`,
          rows: (x) => [
            { label: 'SPI', color: COL.ev, value: n3(spi[x - 1] && spi[x - 1].y) },
            { label: 'SPI(t)', color: COL.es, value: n3(spit[x - 1] && spit[x - 1].y) },
          ],
        },
      });
    });

    // 2. La idea
    const c2 = K.chartBox();
    container.append(K.step(2, L.s2, [K.p(L.s2a), K.p(L.s2b), c2]));
    charts.push(() => {
      const xMax = Math.max(PD, AT) + 1;
      const pv = [];
      for (let q = 0; q <= xMax; q++) pv.push({ x: q, y: E.pv(project, q) });
      const series = [{ key: 'PV', color: COL.plan, points: pv }];
      if (project.historyKnown) {
        const ev = [];
        for (let q = 0; q <= AT; q++) ev.push({ x: q, y: E.ev(project, q) });
        series.push({ key: 'EV', color: COL.ev, points: ev });
      }
      root.PCLines.render(c2, {
        height: 300, xMax, yMax: m.BAC * 1.1, yFormat: (v) => F.num(lang, v, 0), ariaLabel: L.s2Aria, xAxisTitle: units,
        series, refY: [{ y: m.BAC, label: 'BAC' }], refX: [{ x: PD, label: 'PD' }],
        at: { x: AT, label: `AT = ${AT}` },
        projection: { color: COL.es, x0: AT, y: m.EV, x1: m.ES, label: `ES = ${n2(m.ES)}` },
        hbrackets: Math.abs(m.SVt) > 0.05 ? [{ y: m.EV, x0: Math.min(m.ES, AT), x1: Math.max(m.ES, AT), label: `SV(t) = ${n2(m.SVt)}`, dy: 16 }] : [],
        points: [{ x: AT, y: m.EV, color: COL.ev, label: 'EV', anchor: 'start', dx: 8, dy: 16 }],
      });
    });

    // 3. El cálculo
    const tr = m.esTrace;
    const rows = [];
    for (let q = 0; q <= PD; q++) rows.push(q);
    const table = K.el('table', 'mini-table');
    const head = table.createTHead().insertRow();
    for (const h of [unitOne, 'PV']) head.append(K.el('th', null, h));
    const tb = table.createTBody();
    for (const q of rows) {
      const r = tb.insertRow();
      if (!tr.complete && (q === tr.C || q === tr.C + 1)) r.className = q === tr.C ? 'current' : 'next';
      r.insertCell().textContent = String(q);
      r.insertCell().textContent = money(E.pv(project, q));
    }
    const s3 = tr.complete
      ? [K.p(L.s3done), K.formulas(`EV = ${money(m.EV)} = BAC  →  ES = PD = ${PD}`)]
      : [
        K.p(fill(L.s3a, { unit: unitOne })),
        K.formulas(
          `PV(${tr.C}) = ${money(tr.low)} ≤ EV = ${money(m.EV)} < PV(${tr.C + 1}) = ${money(tr.high)}  →  C = ${tr.C}`,
          `ES = C + (EV − PV(C))/(PV(C+1) − PV(C)) = ${tr.C} + (${money(m.EV)} − ${money(tr.low)})/(${money(tr.high)} − ${money(tr.low)}) = ${n2(m.ES)}`,
        ),
      ];
    const tableBox = K.el('div', 'mini-wrap');
    tableBox.append(K.el('p', 'f-note', L.s3table), table);
    s3.push(tableBox);
    container.append(K.step(3, L.s3, s3));

    // 4. Indicadores
    const svt = Math.abs(m.SVt) < 0.005 ? L.svtZero : fill(m.SVt > 0 ? L.svtPos : L.svtNeg, { v: n2(Math.abs(m.SVt)), units });
    const cmp = K.el('table', 'mini-table cmp');
    const ch = cmp.createTHead().insertRow();
    for (const h of ['', L.colMoney, L.colTime]) ch.append(K.el('th', null, h));
    const cb = cmp.createTBody();
    const r1 = cb.insertRow(); r1.insertCell().textContent = L.rowVar; r1.insertCell().textContent = `SV = ${money(m.SV)}`; r1.insertCell().textContent = `SV(t) = ${n2(m.SVt)} ${units}`;
    const r2 = cb.insertRow(); r2.insertCell().textContent = L.rowIdx; r2.insertCell().textContent = `SPI = ${n3(m.SPI)}`; r2.insertCell().textContent = `SPI(t) = ${n3(m.SPIt)}`;
    container.append(K.step(4, L.s4, [
      K.p(L.s4a),
      K.formulas(`SV(t) = ES − AT = ${n2(m.ES)} − ${AT} = ${n2(m.SVt)}`, `SPI(t) = ES/AT = ${n2(m.ES)}/${AT} = ${n3(m.SPIt)}`),
      K.list([svt]),
      K.el('h3', 'step-sub', L.compareTitle), cmp,
    ]));

    // 5. Previsión
    const d = m.durationEAC.es;
    container.append(K.step(5, L.s5, [
      K.p(L.s5a),
      d.spi === null ? K.aside(null, [K.p(t('noProgress'))]) : null,
      K.formulas('IEAC(t) = AT + (PD − ES)/PF'),
      K.figures([
        { label: L.pf1, value: `${n2(d.pf1)}`, note: `${AT} + (${PD} − ${n2(m.ES)})`, color: COL.es },
        { label: L.pfSpi, value: `${n2(d.spi)}`, note: `PD/SPI(t) = ${PD}/${n3(m.SPIt)}`, color: COL.es },
        { label: L.pfSci, value: `${n2(d.sci)}`, note: `SPI(t)·CPI = ${n3(m.SCIt)}`, color: COL.es },
      ]),
      K.p(fill(L.s5b, { v: n2(m.durationEAC.pv.spi), units })),
    ]));

    // 6. Límites
    const goBtn = K.el('button', 'btn primary', `${L.goEDM} →`);
    goBtn.type = 'button';
    goBtn.addEventListener('click', () => go('edm'));
    container.append(K.step(6, L.s6, [K.p(L.s6a), K.p(L.s6b), goBtn]));

    for (const draw of charts) draw();
    const cur = tableBox.querySelector('tr.current');
    if (cur) tableBox.scrollTop = Math.max(0, cur.offsetTop - 60);
  }

  root.PCModuleES = { render };
})(this);
