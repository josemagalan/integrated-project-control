/*
 * Modo práctica: generador de ejercicios por niveles, casillas que calcula el alumno y corrector
 * con tolerancia (±1 %, con mínimos por tipo) y detección de errores arrastrados.
 */
(function (root) {
  'use strict';

  const E = root.PCEngine || require('./engine.js');

  const LEVELS = {
    easy: { n: [3, 4], dur: [2, 4], budStep: 1000, bud: [1000, 6000], pcStep: 0.25, acStep: 100, units: ['week'], overlap: 0.3, atExtra: -1, speed: [0.7, 1.2], early: 0 },
    medium: { n: [4, 6], dur: [1, 5], budStep: 500, bud: [500, 8000], pcStep: 0.1, acStep: 50, units: ['week', 'month'], overlap: 0.6, atExtra: 0, speed: [0.65, 1.25], early: 0.15 },
    hard: { n: [5, 7], dur: [1, 6], budStep: 100, bud: [300, 9900], pcStep: 0.05, acStep: 10, units: ['day', 'week', 'month'], overlap: 0.8, atExtra: 3, speed: [0.6, 1.25], early: 0.2 },
  };
  const BLOCKS = ['evm', 'es', 'edm'];

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const roundTo = (x, step) => Math.round(x / step) * step;
  const fix = (x) => Math.round(x * 1e6) / 1e6;

  function tryGenerate(r, L) {
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const between = (a, b) => a + r() * (b - a);
    const n = int(L.n[0], L.n[1]);
    const acts = [];
    let cursor = 0;
    for (let i = 0; i < n; i++) {
      const duration = int(L.dur[0], L.dur[1]);
      let start = cursor;
      if (i > 0 && r() < L.overlap) start = Math.max(0, cursor - int(1, Math.max(1, Math.min(3, acts[i - 1].duration))));
      const budget = roundTo(between(L.bud[0], L.bud[1]), L.budStep) || L.budStep;
      acts.push({ id: String.fromCharCode(65 + i), start, duration, budget });
      cursor = Math.max(cursor, start + duration);
    }
    const PD = Math.max(...acts.map((a) => a.start + a.duration));
    const AT = int(2, Math.max(2, PD + L.atExtra));
    const speed = between(L.speed[0], L.speed[1]);
    const costF = between(0.85, 1.25);
    const activities = acts.map((a) => {
      const f = E.plannedPeriodsElapsed(a, AT) / a.duration;
      let pc;
      if (f === 0) pc = r() < L.early ? roundTo(between(L.pcStep, 0.3), L.pcStep) : 0;
      else if (f === 1 && speed >= 0.95) pc = 1;
      else pc = roundTo(Math.min(1, f * speed * between(0.85, 1.15)), L.pcStep);
      pc = fix(Math.max(0, Math.min(1, pc)));
      const ac = pc === 0 ? 0 : Math.max(L.acStep, roundTo(a.budget * pc * costF * between(0.92, 1.08), L.acStep));
      const pcs = new Array(AT).fill(0); const acs = new Array(AT).fill(0);
      pcs[AT - 1] = pc; acs[AT - 1] = fix(ac);
      return { ...a, name: { es: a.id, en: a.id }, pc: pcs, ac: acs };
    });
    return { activities, AT, unit: L.units[int(0, L.units.length - 1)] };
  }

  function valid(p, AT) {
    if (E.validateProject(p).length) return false;
    const m = E.metricsAt(p, AT);
    // AC < BAC: con el presupuesto agotado el TCPI respecto al BAC no tiene sentido (ver motor).
    return m.PV > 0 && m.EV > 0 && m.AC > 0 && m.AC < m.BAC - 1e-9 && m.EV < m.BAC - 1e-9 && m.TPDt > 0 && m.TED > 0
      && m.TED < m.TPDtot - 1e-9 && m.ES > 0 && m.EDt > 0 && Math.abs(m.SV) > 0.5;
  }

  const SEED_MAX = 99999;
  /**
   * Versión del generador de ejercicios. Súbela cada vez que un cambio en tryGenerate, valid o
   * LEVELS haga que una semilla dé otro ejercicio: los enlaces y los bancos de Moodle la llevan
   * (g=…) y la Práctica avisa si no coincide.
   */
  const GENERATOR = 1;

  /** Semilla válida (entero de 1 a SEED_MAX) o null. La usan el campo de la práctica y la URL. */
  function normalizeSeed(v) {
    if (v === null || v === undefined) return null;
    const t = String(v).trim();
    if (!/^\d+$/.test(t)) return null;
    const n = Number(t);
    return n >= 1 && n <= SEED_MAX ? n : null;
  }

  /** Ejercicio reproducible: { seed, level, project, AT }. */
  function generate(seed, level = 'medium') {
    const L = LEVELS[level] || LEVELS.medium;
    for (let k = 0; k < 200; k++) {
      const r = mulberry32((seed * 2654435761 + k * 97 + level.length) >>> 0);
      const g = tryGenerate(r, L);
      const project = {
        source: 'custom', exampleId: null, name: { es: `Ejercicio ${seed}`, en: `Exercise ${seed}` },
        unit: g.unit, currency: 'EUR', historyKnown: false, activities: g.activities,
      };
      if (valid(project, g.AT)) return { seed, level, project, AT: g.AT };
    }
    throw new Error(`no exercise for seed ${seed}`);
  }

  // ---- Casillas ----------------------------------------------------------------

  /**
   * Cada casilla: clave, bloque, tipo y cómo se calcula a partir de las respuestas previas del
   * alumno (from), para detectar errores arrastrados. truth(m, c) es la solución.
   */
  const ITEMS = [
    { key: 'PV', block: 'evm', kind: 'money', truth: (m) => m.PV },
    { key: 'EV', block: 'evm', kind: 'money', truth: (m) => m.EV },
    { key: 'AC', block: 'evm', kind: 'money', truth: (m) => m.AC },
    { key: 'SV', block: 'evm', kind: 'money', truth: (m) => m.SV, deps: ['EV', 'PV'], from: (a) => a.EV - a.PV },
    { key: 'CV', block: 'evm', kind: 'money', truth: (m) => m.CV, deps: ['EV', 'AC'], from: (a) => a.EV - a.AC },
    { key: 'CPI', block: 'evm', kind: 'ratio', truth: (m) => m.CPI, deps: ['EV', 'AC'], from: (a) => a.EV / a.AC },
    { key: 'SPI', block: 'evm', kind: 'ratio', truth: (m) => m.SPI, deps: ['EV', 'PV'], from: (a) => a.EV / a.PV },
    { key: 'EAC', block: 'evm', kind: 'money', truth: (m) => m.costEAC.cpi, deps: ['CPI'], from: (a, c) => c.m.BAC / a.CPI },
    { key: 'ETC', block: 'evm', kind: 'money', truth: (m) => m.costEAC.cpi - m.AC, deps: ['EAC', 'AC'], from: (a) => a.EAC - a.AC },
    { key: 'VAC', block: 'evm', kind: 'money', truth: (m) => m.VAC, deps: ['EAC'], from: (a, c) => c.m.BAC - a.EAC },
    { key: 'TCPI', block: 'evm', kind: 'ratio', truth: (m) => m.TCPI, deps: ['EV', 'AC'], from: (a, c) => (c.m.BAC - a.EV) / (c.m.BAC - a.AC) },
    { key: 'C', block: 'es', kind: 'int', truth: (m) => m.esTrace.C, deps: ['EV'], from: (a, c) => E.timeProjection((t) => E.pv(c.p, t), a.EV, c.m.PD).C },
    { key: 'ES', block: 'es', kind: 'time', truth: (m) => m.ES, deps: ['EV'], from: (a, c) => E.timeProjection((t) => E.pv(c.p, t), a.EV, c.m.PD).time },
    { key: 'SVt', block: 'es', kind: 'time', truth: (m) => m.SVt, deps: ['ES'], from: (a, c) => a.ES - c.AT },
    { key: 'SPIt', block: 'es', kind: 'ratio', truth: (m) => m.SPIt, deps: ['ES'], from: (a, c) => a.ES / c.AT },
    { key: 'IEAC', block: 'es', kind: 'time', truth: (m) => m.durationEAC.es.spi, deps: ['SPIt'], from: (a, c) => c.m.PD / a.SPIt },
    { key: 'TPD', block: 'edm', kind: 'units', truth: (m) => m.TPDt },
    { key: 'TED', block: 'edm', kind: 'units', truth: (m) => m.TED },
    { key: 'EDt', block: 'edm', kind: 'time', truth: (m) => m.EDt, deps: ['TED'], from: (a, c) => E.timeProjection((t) => E.tpd(c.p, t), a.TED, c.m.PD).time },
    { key: 'EDI', block: 'edm', kind: 'ratio', truth: (m) => m.EDI, deps: ['TED', 'TPD'], from: (a) => a.TED / a.TPD },
    { key: 'DPI', block: 'edm', kind: 'ratio', truth: (m) => m.DPI, deps: ['EDt'], from: (a, c) => a.EDt / c.AT },
    { key: 'EDAC', block: 'edm', kind: 'time', truth: (m) => m.durationEAC.edm.dpi, deps: ['DPI'], from: (a, c) => c.m.PD / a.DPI },
  ];

  /*
   * Decisiones. Coste: el TCPI dice qué eficiencia hace falta en el trabajo pendiente para
   * terminar en el BAC; si supera al CPI en más de DECISION_GAP, se considera poco realista.
   * Plazo: las mismas zonas que el semáforo del SPI(t) (≥ 1, 0,90–1, < 0,90).
   */
  const DECISION_GAP = 0.1;
  function costDecision(m) {
    if (m.TCPI === null) return null;
    if (m.TCPI <= 1 + 1e-9) return 'keepBudget';
    return m.TCPI - m.CPI <= DECISION_GAP + 1e-9 ? 'improve' : 'rebaseline';
  }
  function scheduleDecision(m) {
    if (m.SPIt === null) return null;
    if (m.SPIt >= 1 - 0.005) return 'keepPlan';
    return m.SPIt >= 0.9 ? 'recover' : 'replan';
  }

  /** Preguntas de interpretación y de decisión. */
  const CHOICES = [
    { key: 'schedule', block: 'evm', options: ['ahead', 'behind', 'onplan'], truth: (m) => (Math.abs(m.SV) < 0.5 ? 'onplan' : m.SV > 0 ? 'ahead' : 'behind') },
    { key: 'cost', block: 'evm', options: ['under', 'over', 'onbudget'], truth: (m) => (Math.abs(m.CV) < 0.5 ? 'onbudget' : m.CV > 0 ? 'under' : 'over') },
    { key: 'decCost', block: 'evm', decision: true, options: ['keepBudget', 'improve', 'rebaseline'], truth: costDecision },
    { key: 'decTime', block: 'es', decision: true, options: ['keepPlan', 'recover', 'replan'], truth: scheduleDecision },
  ];

  /*
   * Errores típicos: si una respuesta incorrecta coincide (con el mismo margen) con uno de estos
   * valores, el corrector dice qué ha pasado. Se calculan con los valores correctos.
   */
  const MISTAKES = {
    SV: [['sign', (m) => m.PV - m.EV], ['svUsesAC', (m) => m.EV - m.AC]],
    CV: [['sign', (m) => m.AC - m.EV], ['cvUsesPV', (m) => m.EV - m.PV]],
    CPI: [['inverted', (m) => m.AC / m.EV], ['cpiUsesPV', (m) => m.EV / m.PV]],
    SPI: [['inverted', (m) => m.PV / m.EV], ['spiUsesAC', (m) => m.EV / m.AC]],
    EAC: [['times', (m) => m.BAC * m.CPI], ['eacPf1', (m) => m.costEAC.pf1]],
    ETC: [['etcBac', (m) => m.BAC - m.AC]],
    VAC: [['sign', (m) => m.costEAC.cpi - m.BAC]],
    TCPI: [['inverted', (m) => (m.BAC - m.AC) / (m.BAC - m.EV)]],
    C: [['cNext', (m) => m.esTrace.C + 1]],
    ES: [['noInterp', (m) => m.esTrace.C]],
    SVt: [['sign', (m) => m.AT - m.ES]],
    SPIt: [['inverted', (m) => m.AT / m.ES]],
    IEAC: [['ieacSpi', (m) => m.durationEAC.pv.spi], ['times', (m) => m.PD * m.SPIt]],
    EDt: [['noInterp', (m) => m.edTrace.C]],
    EDI: [['inverted', (m) => m.TPDt / m.TED]],
    DPI: [['inverted', (m) => m.AT / m.EDt]],
    EDAC: [['times', (m) => m.PD * m.DPI]],
  };

  function mistakeFor(key, x, truth, kind, m) {
    for (const [id, f] of MISTAKES[key] || []) {
      let v;
      try { v = f(m); } catch (e) { v = null; }
      if (v === null || !Number.isFinite(v) || within(v, truth, kind)) continue;
      if (within(x, v, kind)) return id;
    }
    return null;
  }

  // Mínimos: ±1 € en importes y medio centésimo en índices, para que redondear a 2 decimales valga.
  const MIN_TOL = { money: 1, ratio: 0.005, time: 0.01, units: 0.01, int: 0 };

  /** Margen aceptado alrededor de la solución (lo usan el corrector y las preguntas de Moodle). */
  function tolerance(ref, kind) {
    return kind === 'int' ? 0 : Math.max(0.01 * Math.abs(ref), MIN_TOL[kind]);
  }

  function within(x, ref, kind) {
    if (ref === null || !Number.isFinite(ref) || x === null || !Number.isFinite(x)) return false;
    if (kind === 'int') return Math.round(x) === x && x === ref;
    return Math.abs(x - ref) <= tolerance(ref, kind) + 1e-9;
  }

  /**
   * Corrige. answers: { clave: número | null, schedule: opción, cost: opción }.
   * Devuelve { items: { clave: { status, truth, expected } }, score: { ok, total } }.
   * status: 'empty' | 'ok' | 'carried' (coherente con tus respuestas previas, que tienen un error) | 'wrong'.
   */
  function check(ex, answers, blocks = BLOCKS) {
    const m = E.metricsAt(ex.project, ex.AT);
    const ctx = { p: ex.project, AT: ex.AT, m };
    const out = {};
    let ok = 0; let total = 0;
    for (const it of ITEMS) {
      if (!blocks.includes(it.block)) continue;
      total++;
      const truth = it.truth(m, ctx);
      const x = answers[it.key];
      if (x === null || x === undefined || x === '') { out[it.key] = { status: 'empty', truth }; continue; }
      if (within(x, truth, it.kind)) { out[it.key] = { status: 'ok', truth }; ok++; continue; }
      let expected = null;
      if (it.deps && it.deps.every((d) => Number.isFinite(answers[d]))) {
        const depWrong = it.deps.some((d) => out[d] && out[d].status !== 'ok');
        try { expected = it.from(answers, ctx); } catch (e) { expected = null; }
        if (depWrong && within(x, expected, it.kind)) { out[it.key] = { status: 'carried', truth, expected }; continue; }
      }
      const mistake = mistakeFor(it.key, x, truth, it.kind, m);
      out[it.key] = mistake ? { status: 'wrong', truth, mistake } : { status: 'wrong', truth };
    }
    for (const ch of CHOICES) {
      if (!blocks.includes(ch.block)) continue;
      total++;
      const truth = ch.truth(m);
      const x = answers[ch.key];
      const status = !x ? 'empty' : x === truth ? 'ok' : 'wrong';
      if (status === 'ok') ok++;
      out[ch.key] = { status, truth };
    }
    return { items: out, score: { ok, total } };
  }

  /** Respuestas correctas (para tests y para «ver solución»). */
  function solution(ex) {
    const m = E.metricsAt(ex.project, ex.AT);
    const ctx = { p: ex.project, AT: ex.AT, m };
    const a = {};
    for (const it of ITEMS) a[it.key] = it.truth(m, ctx);
    for (const ch of CHOICES) a[ch.key] = ch.truth(m);
    return a;
  }

  /**
   * Lee un número escrito por el alumno: admite «12.900», «12 900 €», «0,915», «1.234,5», «91,5 %».
   * En español un punto seguido de grupos de 3 cifras es separador de miles.
   */
  function parseNum(lang, s) {
    if (s === null || s === undefined) return null;
    let t = String(s).trim().replace(/[€\s %]/g, '').replace(/−/g, '-');
    if (!t) return null;
    const hasDot = t.includes('.'); const hasComma = t.includes(',');
    if (hasDot && hasComma) {
      const dec = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
      t = t.split(dec === ',' ? '.' : ',').join('');
      if (dec === ',') t = t.replace(',', '.');
    } else if (hasComma) {
      t = lang === 'en' && /^-?[1-9]\d{0,2}(,\d{3})+$/.test(t) ? t.split(',').join('') : t.replace(',', '.');
    } else if (hasDot && lang !== 'en' && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
      t = t.split('.').join('');
    }
    if (!/^-?\d*\.?\d+$/.test(t)) return null;
    return Number(t);
  }

  /**
   * Escribe un número ya leído para volver a mostrarlo en otro idioma, sin separador de miles para
   * que parseNum lo lea igual: 12333 → «12333»; 0,915 → «0,915» (es) o «0.915» (en).
   */
  function formatAnswer(lang, x) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '';
    let s = String(x);
    // Muy grande o muy pequeño: String da notación científica, que parseNum no lee.
    if (/e/i.test(s)) s = new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: 20 }).format(x);
    s = s.replace('-', '−');
    return lang === 'en' ? s : s.replace('.', ',');
  }

  const api = { LEVELS, BLOCKS, ITEMS, CHOICES, MISTAKES, DECISION_GAP, SEED_MAX, GENERATOR, generate, check, solution, parseNum, formatAnswer, normalizeSeed, within, tolerance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCPractice = api;
})(this);
