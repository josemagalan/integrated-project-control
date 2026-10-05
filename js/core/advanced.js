/*
 * Cálculos del módulo «Para profundizar».
 *
 *  - forecastErrors: error de las previsiones de duración de cada método, periodo a periodo,
 *    frente a la duración real (RD) de un proyecto con historial (Vandevoorde y Vanhoucke, 2006).
 *  - pFactor: adherencia al plan de Lipke (2004), P = Σ mín(PV_i(ES), EV_i) / Σ PV_i(ES).
 *  - criticalScenario: proyecto pequeño con precedencias en el que un retraso en el camino
 *    crítico queda oculto por trabajo no crítico adelantado.
 */
(function (root) {
  'use strict';

  const E = root.PCEngine || require('./engine.js');
  const X = root.PCExamples || require('./examples.js');

  // Métodos de previsión de la duración (PF = índice de plazo de cada método).
  const METHODS = [
    { key: 'pv', pick: (d) => d.pv.spi },
    { key: 'ed', pick: (d) => d.ed.spi },
    { key: 'es', pick: (d) => d.es.spi },
    { key: 'edm', pick: (d) => d.edm.dpi },
  ];
  // Fases por porcentaje completado (EV/BAC).
  const STAGES = [
    { key: 'early', lo: 0, hi: 0.3 },
    { key: 'middle', lo: 0.3, hi: 0.7 },
    { key: 'late', lo: 0.7, hi: 1 + 1e-9 },
  ];
  const stageOf = (pc) => (STAGES.find((s) => pc >= s.lo - 1e-9 && pc < s.hi) || STAGES[2]).key;

  /**
   * Error porcentual absoluto |previsión − RD| / RD · 100 en cada periodo antes de terminar
   * (AT = 1..RD−1) y su media por fase y total. Requiere historial hasta el final (RD conocido).
   * → { RD, PD, rows: [{ AT, pc, stage, f: {pv,…}, err: {pv,…} }], mape: { early|middle|late|all: {pv,…} } }
   */
  function forecastErrors(project) {
    const RD = E.actualDuration(project);
    if (!project.historyKnown || RD === null || RD < 2) return null;
    const PD = E.plannedDuration(project);
    const rows = [];
    for (let AT = 1; AT < RD; AT++) {
      const m = E.metricsAt(project, AT);
      const f = {}; const err = {};
      for (const meth of METHODS) {
        const v = meth.pick(m.durationEAC);
        f[meth.key] = v === null || !Number.isFinite(v) ? null : v;
        err[meth.key] = f[meth.key] === null ? null : (Math.abs(f[meth.key] - RD) / RD) * 100;
      }
      rows.push({ AT, pc: m.percentComplete, stage: stageOf(m.percentComplete), f, err });
    }
    const mape = {};
    for (const st of STAGES.map((s) => s.key).concat('all')) {
      const sel = rows.filter((r) => st === 'all' || r.stage === st);
      mape[st] = {};
      for (const meth of METHODS) {
        const v = sel.map((r) => r.err[meth.key]).filter((x) => x !== null);
        mape[st][meth.key] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }
      mape[st].n = sel.length;
    }
    return { RD, PD, rows, mape };
  }

  /** PV de una actividad en un instante no entero (lineal dentro de la actividad). */
  function pvActivityAt(a, tau) {
    return (a.budget * Math.min(Math.max(tau - a.start, 0), a.duration)) / a.duration;
  }

  /**
   * Factor P de Lipke en AT. Para cada actividad compara lo que el plan preveía tener hecho en
   * ES (PV_i(ES)) con lo ganado (EV_i): lo que coincide es trabajo hecho «en secuencia»; el
   * exceso es trabajo adelantado fuera de secuencia y el defecto, trabajo que tocaba y falta.
   * → { ES, P, rows: [{ id, pvEs, ev, matched, ahead, behind }] }  (P = null si PV(ES) = 0)
   */
  function pFactor(project, AT) {
    const m = E.metricsAt(project, AT);
    const ES = m.ES;
    const rows = project.activities.map((a) => {
      const pvEs = pvActivityAt(a, ES);
      const ev = a.budget * E.pcAt(a, AT);
      const matched = Math.min(pvEs, ev);
      return { id: a.id, name: a.name, pvEs, ev, matched, ahead: Math.max(0, ev - pvEs), behind: Math.max(0, pvEs - ev) };
    });
    const tot = rows.reduce((s, r) => s + r.pvEs, 0);
    const P = tot > 1e-9 ? rows.reduce((s, r) => s + r.matched, 0) / tot : null;
    return { ES, P, rows };
  }

  /** Serie del factor P en AT = 1..último periodo informado. */
  function pFactorSeries(project) {
    const N = E.reportedPeriods(project);
    const out = [];
    for (let AT = 1; AT <= N; AT++) out.push({ AT, P: pFactor(project, AT).P });
    return out;
  }

  /*
   * Escenario del camino crítico (semanas):
   *   A Cimentación (3) → B Estructura (4) → D Montaje y acabados (2)   camino crítico, PD = 9
   *   C Fabricación en taller (5), en paralelo, precede a D             holgura de 2 semanas
   * delay: semanas de más en A (crítica). speed: semanas de menos en C (no crítica, la más cara).
   * Las precedencias se respetan en la ejecución real: B empieza al terminar A y D al terminar B y C.
   */
  const SCEN = {
    A: { start: 0, duration: 3, budget: 3000 },
    B: { start: 3, duration: 4, budget: 6000 },
    C: { start: 0, duration: 5, budget: 15000 },
    D: { start: 7, duration: 2, budget: 4000 },
  };
  const SCEN_NAMES = {
    A: { es: 'Cimentación', en: 'Foundations' },
    B: { es: 'Estructura', en: 'Structure' },
    C: { es: 'Fabricación en taller', en: 'Off-site fabrication' },
    D: { es: 'Montaje y acabados', en: 'Assembly and finishes' },
  };
  const SCEN_LIMITS = { delay: [0, 3], speed: [0, 3] };

  function criticalScenario(delay, speed) {
    const d = Math.max(SCEN_LIMITS.delay[0], Math.min(SCEN_LIMITS.delay[1], Math.round(delay) || 0));
    const s = Math.max(SCEN_LIMITS.speed[0], Math.min(SCEN_LIMITS.speed[1], Math.round(speed) || 0));
    const aDur = SCEN.A.duration + d;
    const bStart = aDur;
    const cDur = Math.max(1, SCEN.C.duration - s);
    const dStart = Math.max(bStart + SCEN.B.duration, cDur);
    const actual = { A: [0, aDur], B: [bStart, SCEN.B.duration], C: [0, cDur], D: [dStart, SCEN.D.duration] };
    const def = {
      id: 'critical', name: { es: 'Escenario del camino crítico', en: 'Critical path scenario' },
      activities: Object.keys(SCEN).map((id) => ({
        id, name: SCEN_NAMES[id], ...SCEN[id], actual: { start: actual[id][0], duration: actual[id][1], costFactor: 1 },
      })),
    };
    const ex = X.buildExample(def);
    const project = {
      source: 'scenario', exampleId: null, name: def.name, unit: 'week', currency: 'EUR', historyKnown: true,
      activities: ex.activities,
    };
    return {
      project, delay: d, speed: s, RD: E.actualDuration(project), PD: E.plannedDuration(project),
      critical: ['A', 'B', 'D'], slack: { C: SCEN.A.duration + SCEN.B.duration - SCEN.C.duration },
      precedences: [['A', 'B'], ['B', 'D'], ['C', 'D']],
    };
  }

  const api = { METHODS, STAGES, forecastErrors, pFactor, pFactorSeries, pvActivityAt, criticalScenario, SCEN_LIMITS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCAdvanced = api;
})(this);
