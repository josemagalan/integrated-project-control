/*
 * Módulo «Comparativa en el tiempo»: los ejemplos con historial semanal, con la evolución de los
 * índices y de las previsiones de plazo. El router le pasa el idioma y los parámetros de la URL.
 */
(function () {
  'use strict';

  const E = window.PCEngine;
  const X = window.PCExamples;
  const F = window.PCFormat;
  const I = window.PCI18n;
  const C = window.PCCharts;

  const COLORS = {
    plan: 'var(--c-plan)', evm: 'var(--c-evm)', ac: 'var(--c-ac)',
    es: 'var(--c-es)', edm: 'var(--c-edm)', jacob: 'var(--c-jacob)',
  };

  const state = { lang: 'es', project: X.examples[0], AT: 1, pf: 'index', tab: 'evm', playing: null, tableOpen: false };
  const $ = (id) => document.getElementById(id);
  const t = (key, params) => I.t(state.lang, key, params);

  // ---- URL ----------------------------------------------------------------------

  let ctx = null;

  function readParams(h) {
    if (I.languages.includes(h.get('lang'))) state.lang = h.get('lang');
    const p = X.byId(h.get('p'));
    if (p) state.project = p;
    const N = E.reportedPeriods(state.project);
    const at = parseInt(h.get('at'), 10);
    state.AT = Number.isInteger(at) && at >= 1 && at <= N ? at : Math.min(N, defaultAT(state.project));
    if (h.get('pf') === 'pf1' || h.get('pf') === 'index') state.pf = h.get('pf');
    if (['evm', 'es', 'edm', 'fc'].includes(h.get('tab'))) state.tab = h.get('tab');
  }

  function params() {
    return { p: state.project.id, at: state.AT, pf: state.pf, tab: state.tab };
  }

  function writeHash() {
    if (ctx) ctx.onChange(params());
  }

  function defaultAT(p) {
    return Math.max(1, Math.round(E.plannedDuration(p) * 0.6));
  }

  // ---- Textos estáticos ---------------------------------------------------------------

  function applyText() {
    const sel = $('projectSel');
    sel.textContent = '';
    for (const p of X.examples) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name[state.lang];
      sel.appendChild(o);
    }
    sel.value = state.project.id;
    $('playBtn').textContent = state.playing ? t('pause') : t('play');
    $('tableBtn').textContent = state.tableOpen ? t('hideTable') : t('showTable');
  }

  // ---- Indicadores ----------------------------------------------------------------

  function stateOf(v) {
    const st = C.statusOf(v);
    if (st === null) return { cls: 'even', icon: '–', text: t('undefinedValue') };
    if (st === 'good') return { cls: 'good', icon: '✓', text: Math.abs(v - 1) < 0.005 ? t('onTrack') : t('better') };
    return st === 'warn' ? { cls: 'warn', icon: '!', text: t('st_warn') } : { cls: 'bad', icon: '✕', text: t('st_crit') };
  }

  function tile(label, name, value, st) {
    const d = document.createElement('div');
    d.className = 'tile';
    const l = document.createElement('div'); l.className = 't-label'; l.textContent = label;
    const v = document.createElement('div'); v.className = 't-value'; v.textContent = value;
    const n = document.createElement('div'); n.className = 't-name'; n.textContent = name;
    d.append(l, v, n);
    if (st) {
      const s = document.createElement('div'); s.className = `t-state ${st.cls}`;
      s.textContent = `${st.icon} ${st.text}`;
      d.appendChild(s);
    }
    return d;
  }

  function renderTiles(m) {
    const box = $('tiles');
    box.textContent = '';
    const n3 = (v) => F.num(state.lang, v, 2);
    const groups = [
      { title: `${t('evm')} (${t('evmShort')})`, color: COLORS.evm, tiles: [
        tile(t('tileCPI'), 'CPI = EV/AC', n3(m.CPI), stateOf(m.CPI)),
        tile(t('tileSPI'), 'SPI = EV/PV', n3(m.SPI), stateOf(m.SPI)),
      ] },
      { title: `${t('es')} (${t('esShort')})`, color: COLORS.es, tiles: [
        tile(t('tileSPIt'), 'SPI(t) = ES/AT', n3(m.SPIt), stateOf(m.SPIt)),
        tile(t('esWeeks'), `SV(t) = ${F.num(state.lang, m.SVt, 2)}`, F.num(state.lang, m.ES, 2), null),
      ] },
      { title: `${t('edm')} (${t('edmShort')})`, color: COLORS.edm, tiles: [
        tile(t('tileDPI'), 'DPI = ED(t)/AT', n3(m.DPI), stateOf(m.DPI)),
        tile(t('tileEDI'), 'EDI = TED/TPD', n3(m.EDI), stateOf(m.EDI)),
      ] },
    ];
    for (const gdef of groups) {
      const g = document.createElement('div');
      g.className = 'tile-group';
      const h = document.createElement('h3');
      const k = document.createElement('span'); k.className = 'key'; k.style.background = gdef.color;
      h.append(k, document.createTextNode(gdef.title));
      const row = document.createElement('div'); row.className = 'tile-row';
      row.append(...gdef.tiles);
      g.append(h, row);
      box.appendChild(g);
    }
  }

  // ---- Gráficas ---------------------------------------------------------------------

  function renderCharts(s, m) {
    const p = state.project;
    const lang = state.lang;
    const AT = state.AT;
    const xMax = Math.max(s.PD, s.N);
    const money = (v) => F.money(lang, v);
    const wk = (x) => `${t('week')} ${x}`;
    const upTo = (arr, key) => arr.filter((r) => r.t <= AT).map((r) => ({ x: r.t, y: r[key] }));
    const pvAll = []; const tpdAll = [];
    for (let k = 0; k <= xMax; k++) { pvAll.push({ x: k, y: E.pv(p, k) }); tpdAll.push({ x: k, y: E.tpd(p, k) }); }

    // Gantt
    C.legend($('ganttLegend'), [
      { label: t('legPlan'), color: 'var(--c-plan-wash)', outline: 'var(--c-plan)', box: true },
      { label: t('legEarned'), color: 'var(--c-done)', box: true },
      { label: t('legActual'), color: 'var(--ink)' },
    ]);
    window.PCGantt.render($('ganttChart'), { project: p, AT, xMax, lang, t, fmt: F, ariaLabel: t('ganttAria', { n: AT }) });

    // Curvas S
    C.legend($('costLegend'), [
      { label: 'PV', color: COLORS.plan }, { label: 'EV', color: COLORS.evm }, { label: 'AC', color: COLORS.ac },
      { label: 'ES', color: COLORS.es },
    ]);
    const costMax = Math.max(s.BAC, ...s.actual.map((r) => r.AC));
    window.PCLines.render($('costChart'), {
      height: 300, xMax, yMax: costMax * 1.05, yFormat: (v) => F.num(lang, v, 0), ariaLabel: t('costAria'),
      series: [
        { key: 'PV', color: COLORS.plan, points: pvAll },
        // EV va más ancha debajo de AC: con CPI ≈ 1 las dos coinciden.
        { key: 'EV', color: COLORS.evm, width: 5, points: upTo(s.actual, 'EV'), endLabel: 'EV' },
        { key: 'AC', color: COLORS.ac, points: upTo(s.actual, 'AC'), endLabel: 'AC' },
      ],
      refY: [{ y: s.BAC, label: 'BAC' }],
      refX: s.PD < xMax ? [{ x: s.PD, label: 'PD' }] : [],
      at: { x: AT, label: `AT = ${AT}` },
      projection: { color: COLORS.es, x0: AT, y: m.EV, x1: m.ES, label: `ES = ${F.num(lang, m.ES, 2)}` },
      tooltip: {
        title: wk,
        rows: (x) => [
          { label: 'PV', color: COLORS.plan, value: money(E.pv(p, x)) },
          ...(x <= AT ? [
            { label: 'EV', color: COLORS.evm, value: money(E.ev(p, x)) },
            { label: 'AC', color: COLORS.ac, value: money(E.ac(p, x)) },
          ] : []),
        ],
      },
    });

    // Curvas de duración
    C.legend($('durLegend'), [
      { label: 'TPD', color: COLORS.plan }, { label: 'TED', color: COLORS.edm },
    ]);
    window.PCLines.render($('durChart'), {
      height: 300, xMax, yMax: s.TPDtot * 1.05, yFormat: (v) => F.num(lang, v, 0), ariaLabel: t('durAria'),
      series: [
        { key: 'TPD', color: COLORS.plan, points: tpdAll },
        { key: 'TED', color: COLORS.edm, points: upTo(s.actual, 'TED'), endLabel: 'TED' },
      ],
      refY: [{ y: s.TPDtot, label: 'Σd' }],
      refX: s.PD < xMax ? [{ x: s.PD, label: 'PD' }] : [],
      at: { x: AT, label: `AT = ${AT}` },
      projection: { color: COLORS.edm, x0: AT, y: m.TED, x1: m.EDt, label: `ED(t) = ${F.num(lang, m.EDt, 2)}` },
      tooltip: {
        title: wk,
        rows: (x) => [
          { label: 'TPD', color: COLORS.plan, value: F.num(lang, E.tpd(p, x), 0) },
          ...(x <= AT ? [{ label: 'TED', color: COLORS.edm, value: F.num(lang, E.ted(p, x), 2) }] : []),
        ],
      },
    });

    // Índices
    const ms = s.metrics;
    // Orden de dibujo: DPI (ancha) debajo de SPI(t) debajo de SPI, para que se vean si coinciden.
    const idxSeries = [
      { key: 'DPI', label: 'DPI', color: COLORS.edm, width: 7 },
      { key: 'SPIt', label: 'SPI(t)', color: COLORS.es, width: 4 },
      { key: 'SPI', label: 'SPI', color: COLORS.evm, width: 2 },
    ];
    C.legend($('idxLegend'), [idxSeries[2], idxSeries[1], idxSeries[0]].map((d) => ({ label: d.label, color: d.color })));
    const allIdx = ms.flatMap((r) => [r.SPI, r.SPIt, r.DPI]).filter((v) => v !== null && Number.isFinite(v));
    const lo = Math.min(0.6, ...allIdx) - 0.05;
    const hi = Math.max(1.2, ...allIdx) + 0.05;
    C.statusLegend($('idxStatus'), t);
    window.PCLines.render($('idxChart'), {
      height: 300, xMax, yMin: lo, yMax: hi, yFormat: (v) => F.num(lang, v, 1), ariaLabel: t('idxAria'),
      zones: C.statusZones(lo - 1, hi + 1),
      series: idxSeries.map((d) => ({
        key: d.key, color: d.color, width: d.width, endLabel: d.label,
        points: ms.filter((r) => r.AT <= AT).map((r) => ({ x: r.AT, y: r[d.key] })),
      })),
      refY: [{ y: 1, label: '1' }],
      refX: [{ x: s.PD, label: 'PD' }],
      at: { x: AT, label: `AT = ${AT}` },
      xHoverMin: 1, xHoverMax: AT,
      tooltip: {
        title: wk,
        rows: (x) => [idxSeries[2], idxSeries[1], idxSeries[0]].map((d) => ({ label: d.label, color: d.color, value: F.num(lang, ms[x - 1][d.key], 3) })),
      },
    });

    // Previsiones
    const useIdx = state.pf === 'index';
    // Jacob coincide con PV mientras AT ≤ PD y EDM coincide a menudo con ES: van debajo, más anchas.
    const fcSeries = [
      { key: 'ed', label: `${t('jacob')}`, short: 'Jacob', color: COLORS.jacob, width: 7, pick: (d) => (useIdx ? d.ed.spi : d.ed.pf1) },
      { key: 'edm', label: t('edm'), short: 'EDM', color: COLORS.edm, width: 5, pick: (d) => (useIdx ? d.edm.dpi : d.edm.pf1) },
      { key: 'pv', label: t('pvMethod'), short: 'PV', color: COLORS.evm, width: 2, pick: (d) => (useIdx ? d.pv.spi : d.pv.pf1) },
      { key: 'es', label: t('es'), short: 'ES', color: COLORS.es, width: 2, pick: (d) => (useIdx ? d.es.spi : d.es.pf1) },
    ];
    const fcOrder = [fcSeries[2], fcSeries[0], fcSeries[3], fcSeries[1]];
    C.legend($('fcLegend'), fcOrder.map((d) => ({ label: d.label, color: d.color })));
    const fcVals = ms.flatMap((r) => fcSeries.map((d) => d.pick(r.durationEAC))).filter((v) => v !== null && Number.isFinite(v));
    const fcTop = Math.min(Math.max(...fcVals, s.AD || 0, s.PD) * 1.05, 2.2 * Math.max(s.PD, s.AD || 0));
    const fcBottom = Math.max(0, Math.min(...fcVals, s.PD) * 0.9);
    const clip = (v) => (v === null || !Number.isFinite(v) || v > fcTop || v < fcBottom ? null : v);
    const refs = [{ y: s.PD, label: t('plannedDurationRef', { v: s.PD }) }];
    if (s.AD !== null && s.AD !== s.PD) refs.push({ y: s.AD, label: t('actualDurationRef', { v: s.AD }) });
    window.PCLines.render($('fcChart'), {
      height: 300, xMax, yMin: fcBottom, yMax: fcTop, yFormat: (v) => F.num(lang, v, 0), ariaLabel: t('fcAria'),
      series: fcSeries.map((d) => ({
        key: d.key, color: d.color, width: d.width, endLabel: d.short,
        points: ms.filter((r) => r.AT <= AT).map((r) => ({ x: r.AT, y: clip(d.pick(r.durationEAC)) })),
      })),
      refY: refs,
      at: { x: AT, label: `AT = ${AT}` },
      xHoverMin: 1, xHoverMax: AT,
      tooltip: {
        title: wk,
        rows: (x) => fcOrder.map((d) => ({ label: d.short, color: d.color, value: F.num(lang, d.pick(ms[x - 1].durationEAC), 2) })),
      },
    });
  }

  // ---- Paso a paso -----------------------------------------------------------------

  function renderSteps() {
    const r = window.PCNarration.build(state.project, state.AT, state.lang, F, state.pf);
    $('stepsTitle').textContent = t('stepsTitle', { n: state.AT });
    const tabs = $('stepsTabs');
    tabs.textContent = '';
    for (const key of ['evm', 'es', 'edm', 'fc']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(state.tab === key));
      b.setAttribute('aria-pressed', String(state.tab === key));
      b.textContent = r.tabs[key];
      b.addEventListener('click', () => { state.tab = key; writeHash(); renderSteps(); });
      tabs.appendChild(b);
    }
    const box = $('steps');
    box.textContent = '';
    r.groups[state.tab].forEach((st, i) => {
      const d = document.createElement('div');
      d.className = 'step';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1);
      const body = document.createElement('div');
      const p = document.createElement('p'); p.textContent = st.text;
      body.appendChild(p);
      if (st.formula) {
        const f = document.createElement('code'); f.className = 'formula'; f.textContent = st.formula;
        body.appendChild(f);
      }
      d.append(n, body);
      box.appendChild(d);
    });
  }

  // ---- Tabla -----------------------------------------------------------------------

  function renderTable(s) {
    const wrap = $('tableWrap');
    wrap.hidden = !state.tableOpen;
    if (!state.tableOpen) return;
    const lang = state.lang;
    const n = (v, d = 2) => F.num(lang, v, d);
    const cols = [
      [t('tableWeek'), (r) => String(r.AT)],
      ['PV', (r) => n(r.PV, 0)], ['EV', (r) => n(r.EV, 0)], ['AC', (r) => n(r.AC, 0)],
      ['CPI', (r) => n(r.CPI, 3)], ['SPI', (r) => n(r.SPI, 3)],
      ['ES', (r) => n(r.ES)], ['SPI(t)', (r) => n(r.SPIt, 3)],
      ['TPD', (r) => n(r.TPDt, 0)], ['TED', (r) => n(r.TED)], ['ED(t)', (r) => n(r.EDt)],
      ['EDI', (r) => n(r.EDI, 3)], ['DPI', (r) => n(r.DPI, 3)],
      ['EAC(t) ES', (r) => n(r.durationEAC.es.spi)], ['EDAC(t)', (r) => n(r.durationEAC.edm.dpi)],
    ];
    const table = document.createElement('table');
    const cap = document.createElement('caption');
    cap.className = 'sr-only';
    cap.textContent = t('tableCaption');
    table.appendChild(cap);
    const thead = table.createTHead().insertRow();
    for (const [h] of cols) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; thead.appendChild(th); }
    const tb = table.createTBody();
    for (const r of s.metrics) {
      const tr = tb.insertRow();
      if (r.AT === state.AT) tr.className = 'current';
      for (const [, f] of cols) { const td = tr.insertCell(); td.textContent = f(r); }
    }
    wrap.textContent = '';
    wrap.appendChild(table);
  }

  // ---- Todo ------------------------------------------------------------------------

  function render() {
    const p = state.project;
    const s = E.series(p);
    const m = E.metricsAt(p, state.AT);
    const range = $('atRange');
    range.max = String(s.N);
    range.value = String(state.AT);
    $('atOut').textContent = t('weekN', { n: state.AT });

    const sum = $('summary');
    sum.textContent = '';
    const a = document.createElement('span');
    a.textContent = t('planSummary', { pd: s.PD, bac: F.money(state.lang, s.BAC), n: p.activities.length });
    const b = document.createElement('span');
    b.textContent = s.AD !== null ? t('actualSummary', { ad: s.AD }) : t('actualOpen', { n: s.N });
    const c = document.createElement('span');
    c.textContent = p.description[state.lang];
    sum.append(a, b, c);
    $('lessonText').textContent = p.lesson[state.lang];

    renderTiles(m);
    renderCharts(s, m);
    renderSteps();
    renderTable(s);
    document.querySelectorAll('#pfSeg button').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.pf === state.pf)));
  }

  function setAT(v) {
    const N = E.reportedPeriods(state.project);
    state.AT = Math.max(1, Math.min(N, v));
    writeHash();
    render();
  }

  function stop() {
    if (state.playing) { clearInterval(state.playing); state.playing = null; }
    $('playBtn').textContent = t('play');
  }

  function bind() {
    $('projectSel').addEventListener('change', (ev) => {
      stop();
      state.project = X.byId(ev.target.value);
      state.AT = Math.min(E.reportedPeriods(state.project), defaultAT(state.project));
      writeHash();
      render();
    });
    $('atRange').addEventListener('input', (ev) => { stop(); setAT(parseInt(ev.target.value, 10)); });
    $('prevBtn').addEventListener('click', () => { stop(); setAT(state.AT - 1); });
    $('nextBtn').addEventListener('click', () => { stop(); setAT(state.AT + 1); });
    $('playBtn').addEventListener('click', () => {
      if (state.playing) return stop();
      const N = E.reportedPeriods(state.project);
      if (state.AT >= N) setAT(1);
      $('playBtn').textContent = t('pause');
      state.playing = setInterval(() => {
        if (state.AT >= E.reportedPeriods(state.project)) return stop();
        setAT(state.AT + 1);
      }, 900);
    });
    document.querySelectorAll('#pfSeg button').forEach((btn) => btn.addEventListener('click', () => {
      state.pf = btn.dataset.pf;
      writeHash();
      render();
    }));
    $('tableBtn').addEventListener('click', () => {
      state.tableOpen = !state.tableOpen;
      $('tableBtn').setAttribute('aria-expanded', String(state.tableOpen));
      $('tableBtn').textContent = state.tableOpen ? t('hideTable') : t('showTable');
      renderTable(E.series(state.project));
    });
    document.addEventListener('keydown', (ev) => {
      if ($('compareView').hidden) return;
      if (ev.target.closest('input, select, textarea, [tabindex]')) return;
      if (ev.key === 'ArrowRight') { stop(); setAT(state.AT + 1); }
      if (ev.key === 'ArrowLeft') { stop(); setAT(state.AT - 1); }
    });
  }

  window.PCCompare = {
    init(context) { ctx = context; bind(); },
    /** h: URLSearchParams con lang, p, at, pf y tab. */
    show(h) { readParams(h); applyText(); render(); },
    hide() { stop(); },
    render() { render(); },
    params,
  };
})();
