/*
 * Módulo de duración ganada (EDM, Khamooshi y Golafshani, 2014) con el proyecto del editor.
 */
(function (root) {
  'use strict';

  const E = root.PCEngine;
  const F = root.PCFormat;
  const K = root.PCKit;
  const COL = { plan: 'var(--c-plan)', ev: 'var(--c-evm)', es: 'var(--c-es)', edm: 'var(--c-edm)', jacob: 'var(--c-jacob)' };

  function render(container, { project, AT, lang, t }) {
    const L = root.PCEdmText.TEXT[lang];
    const m = E.metricsAt(project, AT);
    const n0 = (v) => F.num(lang, v, 0);
    const n2 = (v) => F.num(lang, v, 2);
    const n3 = (v) => F.num(lang, v, 3);
    const unitOne = t(`unitOne_${project.unit}`);
    const units = t(`unit_${project.unit}`);
    const fill = (s, o) => Object.entries(o).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);
    const acts = project.activities;
    const PD = m.PD;
    container.textContent = '';
    const charts = [];

    // 1. Por qué
    const c1 = K.chartBox();
    container.append(K.step(1, L.s1, [K.p(L.s1a), K.p(L.s1b), c1, K.p(L.s1c)]));
    charts.push(() => weights(c1, project, m, L, lang));

    // 2. TPD
    const c2 = K.chartBox();
    const tpdTerms = acts.map((a) => E.plannedPeriodsElapsed(a, AT)).filter((v) => v > 0);
    container.append(K.step(2, L.s2, [
      K.p(fill(L.s2a, { unit: unitOne, tot: m.TPDtot, pd: PD })),
      K.formulas(`TPD(${AT}) = Σ ${lang === 'en' ? 'min(max(AT − start, 0), d)' : 'mín(máx(AT − inicio, 0), d)'} = ${tpdTerms.length > 1 ? `${tpdTerms.join(' + ')} = ` : ''}${n0(m.TPDt)}`),
    ]));

    // 3. TED
    const tedTerms = acts.filter((a) => E.pcAt(a, AT) > 0).map((a) => `${a.duration}·${F.pctSmart(lang, E.pcAt(a, AT))}`);
    container.append(K.step(3, L.s3, [
      K.p(L.s3a),
      K.formulas(`TED(${AT}) = Σ d_i · %_i = ${tedTerms.join(' + ') || '0'} = ${n2(m.TED)}`),
    ]));

    // 4. ED(t)
    const tr = m.edTrace;
    container.append(K.step(4, L.s4, [
      K.p(L.s4a),
      tr.complete
        ? K.formulas(`TED = Σd = ${n0(m.TPDtot)}  →  ED(t) = PD = ${PD}`)
        : K.formulas(
          `TPD(${tr.C}) = ${n0(tr.low)} ≤ TED = ${n2(m.TED)} < TPD(${tr.C + 1}) = ${n0(tr.high)}  →  C = ${tr.C}`,
          `ED(t) = C + (TED − TPD(C))/(TPD(C+1) − TPD(C)) = ${tr.C} + (${n2(m.TED)} − ${n0(tr.low)})/(${n0(tr.high)} − ${n0(tr.low)}) = ${n2(m.EDt)}`,
        ),
      c2,
    ]));
    charts.push(() => {
      const xMax = Math.max(PD, AT) + 1;
      const tpd = [];
      for (let q = 0; q <= xMax; q++) tpd.push({ x: q, y: E.tpd(project, q) });
      const series = [{ key: 'TPD', color: COL.plan, points: tpd }];
      if (project.historyKnown) {
        const ted = [];
        for (let q = 0; q <= AT; q++) ted.push({ x: q, y: E.ted(project, q) });
        series.push({ key: 'TED', color: COL.edm, points: ted });
      }
      root.PCLines.render(c2, {
        height: 300, xMax, yMax: m.TPDtot * 1.1, yFormat: (v) => F.num(lang, v, 0), ariaLabel: L.s4Aria, xAxisTitle: units,
        series, refY: [{ y: m.TPDtot, label: 'Σd' }], refX: [{ x: PD, label: 'PD' }],
        at: { x: AT, label: `AT = ${AT}` },
        projection: { color: COL.edm, x0: AT, y: m.TED, x1: m.EDt, label: `ED(t) = ${n2(m.EDt)}` },
        points: [
          { x: AT, y: m.TPDt, color: COL.plan, label: `TPD = ${n0(m.TPDt)}`, anchor: 'start', dx: 8, dy: -6 },
          { x: AT, y: m.TED, color: COL.edm, label: `TED = ${n2(m.TED)}`, anchor: 'start', dx: 8, dy: 16 },
        ],
        tooltip: {
          title: (x) => `${unitOne} ${x}`,
          rows: (x) => [
            { label: 'TPD', color: COL.plan, value: n0(E.tpd(project, x)) },
            ...(project.historyKnown && x <= AT ? [{ label: 'TED', color: COL.edm, value: n2(E.ted(project, x)) }] : []),
          ],
        },
      });
    });

    // 5. Índices
    const tbl = K.el('table', 'mini-table cmp');
    const th = tbl.createTHead().insertRow();
    for (const h of ['', L.tabEvm, L.tabEdm]) th.append(K.el('th', null, h));
    const tb = tbl.createTBody();
    const r1 = tb.insertRow(); r1.insertCell().textContent = L.tabQty; r1.insertCell().textContent = `SPI = EV/PV = ${n3(m.SPI)}`; r1.insertCell().textContent = `EDI = TED/TPD = ${n3(m.EDI)}`;
    const r2 = tb.insertRow(); r2.insertCell().textContent = L.tabTime; r2.insertCell().textContent = `SPI(t) = ES/AT = ${n3(m.SPIt)}`; r2.insertCell().textContent = `DPI = ED(t)/AT = ${n3(m.DPI)}`;
    container.append(K.step(5, L.s5, [
      K.p(L.s5a),
      K.formulas(`EDI = TED/TPD = ${n2(m.TED)}/${n0(m.TPDt)} = ${n3(m.EDI)}`, `DPI = ED(t)/AT = ${n2(m.EDt)}/${AT} = ${n3(m.DPI)}`),
      K.list([L.ediTxt, L.dpiTxt]),
      tbl,
    ]));

    // 6. Previsión
    const d = m.durationEAC;
    container.append(K.step(6, L.s6, [
      K.p(L.s6a),
      d.edm.dpi === null ? K.aside(null, [K.p(t('noProgress'))]) : null,
      K.formulas('EDAC(t) = AT + (PD − ED(t))/PF'),
      K.figures([
        { label: L.pf1, value: n2(d.edm.pf1), note: `${AT} + (${PD} − ${n2(m.EDt)})`, color: COL.edm },
        { label: L.pfDpi, value: n2(d.edm.dpi), note: `PD/DPI = ${PD}/${n3(m.DPI)}`, color: COL.edm },
      ]),
      K.el('h3', 'step-sub', L.cmpTitle),
      K.figures([
        { label: t('pvMethod'), value: n2(d.pv.spi), note: 'PD/SPI', color: COL.ev },
        { label: t('jacob'), value: n2(d.ed.spi), note: `ED = AT·SPI = ${n2(m.EDj)}`, color: COL.jacob },
        { label: t('es'), value: n2(d.es.spi), note: 'PD/SPI(t)', color: COL.es },
        { label: t('edm'), value: n2(d.edm.dpi), note: 'PD/DPI', color: COL.edm },
      ]),
      K.aside(null, [K.p(L.jacobNote)]),
    ]));

    // 7. Experimento: ES con presupuestos proporcionales a la duración coincide con ED(t)
    const flat = { activities: acts.map((a) => ({ ...a, budget: a.duration * 1000 })) };
    const esFlat = E.metricsAt(flat, AT).ES;
    container.append(K.step(7, L.s7, [
      K.p(L.s7a),
      K.formulas(fill(L.now, { es: n2(m.ES), ed: n2(m.EDt) })),
      K.p(fill(L.s7b, { unit: unitOne, es: n2(esFlat), ed: n2(m.EDt) })),
    ]));

    for (const draw of charts) draw();
  }

  /** Barras pareadas: peso de cada actividad en el presupuesto y en Σd. */
  function weights(box, project, m, L, lang) {
    const d3 = root.d3;
    box.querySelectorAll(':scope > svg').forEach((n) => n.remove());
    const acts = project.activities;
    const W = root.PCCharts.width(box);
    const narrow = W < 560;
    const rowH = 34;
    const mg = { top: 26, right: 60, bottom: 8, left: narrow ? 34 : 180 };
    const iw = W - mg.left - mg.right;
    const H = mg.top + mg.bottom + rowH * acts.length;
    const data = acts.map((a) => ({ a, cost: a.budget / m.BAC, dur: a.duration / m.TPDtot }));
    const x = d3.scaleLinear().domain([0, Math.max(...data.flatMap((q) => [q.cost, q.dur]))]).range([0, iw]).nice();
    const svg = d3.select(box).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', L.s1Aria);
    const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);
    const leg = svg.append('g').attr('transform', `translate(${mg.left},12)`);
    [[L.wCost, 'var(--c-evm)'], [L.wDur, 'var(--c-edm)']].forEach(([txt, c], i) => {
      const it = leg.append('g').attr('transform', `translate(${i * 150},0)`);
      it.append('rect').attr('width', 12).attr('height', 10).attr('y', -9).attr('rx', 2).style('fill', c);
      it.append('text').attr('x', 18).text(txt);
    });
    data.forEach((q, i) => {
      const y0 = i * rowH;
      g.append('text').attr('class', 'gantt-name').attr('x', -10).attr('y', y0 + 17).attr('text-anchor', 'end')
        .text(narrow ? q.a.id : `${q.a.id} · ${q.a.name[lang] || q.a.name.es}`);
      g.append('rect').attr('x', 0).attr('y', y0 + 3).attr('height', 12).attr('rx', 2).attr('width', Math.max(1, x(q.cost))).style('fill', 'var(--c-evm)');
      g.append('rect').attr('x', 0).attr('y', y0 + 17).attr('height', 12).attr('rx', 2).attr('width', Math.max(1, x(q.dur))).style('fill', 'var(--c-edm)');
      g.append('text').attr('class', 'gantt-pct').attr('x', x(q.cost) + 6).attr('y', y0 + 13).text(F.pct(lang, q.cost));
      g.append('text').attr('class', 'gantt-pct').attr('x', x(q.dur) + 6).attr('y', y0 + 27).text(F.pct(lang, q.dur));
    });
  }

  root.PCModuleEDM = { render };
})(this);
