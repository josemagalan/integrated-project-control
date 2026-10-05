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
   * Error porcentual (previsión − RD) / RD · 100, con signo y absoluto, en cada periodo antes de terminar
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
      const f = {}; const err = {}; const sgn = {};
      for (const meth of METHODS) {
        const v = meth.pick(m.durationEAC);
        f[meth.key] = v === null || !Number.isFinite(v) ? null : v;
        sgn[meth.key] = f[meth.key] === null ? null : ((f[meth.key] - RD) / RD) * 100;
        err[meth.key] = sgn[meth.key] === null ? null : Math.abs(sgn[meth.key]);
      }
      rows.push({ AT, pc: m.percentComplete, stage: stageOf(m.percentComplete), f, err, sgn });
    }
    // mape: error absoluto medio; bias: error medio con signo (< 0 optimista, > 0 pesimista).
    const mape = {}; const bias = {};
    const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    for (const st of STAGES.map((s) => s.key).concat('all')) {
      const sel = rows.filter((r) => st === 'all' || r.stage === st);
      mape[st] = {}; bias[st] = {};
      for (const meth of METHODS) {
        mape[st][meth.key] = mean(sel.map((r) => r.err[meth.key]).filter((x) => x !== null));
        bias[st][meth.key] = mean(sel.map((r) => r.sgn[meth.key]).filter((x) => x !== null));
      }
      mape[st].n = sel.length; bias[st].n = sel.length;
    }
    return { RD, PD, rows, mape, bias };
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

  // Coste adicional de acortar una semana cada actividad (horas extra, más recursos).
  const CRASH_COST = { A: 1500, B: 2000, C: 800, D: 2500 };

  /**
   * Ejecución real de una actividad: empieza en st y dura du periodos, con avance lineal. Si se
   * acelera en la semana xat, el pasado (t ≤ xat) no cambia y lo que falta se hace en un periodo
   * menos, con el coste extra repartido en esos periodos.
   */
  function execActivity(id, st, du, crashAt, N) {
    const plan = SCEN[id];
    const pc = []; const ac = [];
    const perPeriod = plan.budget / du;
    let finish = st + du;
    let pcAt = null;
    if (crashAt !== null) {
      if (crashAt <= st) {
        finish = st + du - 1; // aún no ha empezado: se hace en du − 1 periodos
      } else {
        pcAt = (crashAt - st) / du; // en curso: avance lineal hasta la semana de la decisión
        finish = st + du - 1;
      }
    }
    for (let t = 1; t <= N; t++) {
      let p; let c = 0;
      if (crashAt === null) {
        p = Math.min(Math.max(t - st, 0), du) / du;
        if (t > st && t <= finish) c = Math.round(perPeriod);
      } else if (pcAt === null) {
        p = Math.min(Math.max(t - st, 0), du - 1) / (du - 1);
        if (t > st && t <= finish) c = Math.round(plan.budget / (du - 1) + CRASH_COST[id] / (du - 1));
      } else if (t <= crashAt) {
        p = (t - st) / du;
        if (t > st) c = Math.round(perPeriod);
      } else {
        const rest = finish - crashAt;
        p = Math.min(pcAt + ((1 - pcAt) * (t - crashAt)) / rest, 1);
        if (t <= finish) c = Math.round((plan.budget * (1 - pcAt)) / rest + CRASH_COST[id] / rest);
      }
      pc.push(Math.max(0, p)); ac.push(c);
    }
    return { id, name: SCEN_NAMES[id], ...plan, pc, ac, finish };
  }

  /** Semana en que termina cada actividad real y si se puede acortar una semana en xat. */
  function scenarioTimes(d, s) {
    const aDur = SCEN.A.duration + d;
    const cDur = Math.max(1, SCEN.C.duration - s);
    return { A: [0, aDur], B: [aDur, SCEN.B.duration], C: [0, cDur], D: [Math.max(aDur + SCEN.B.duration, cDur), SCEN.D.duration] };
  }

  /**
   * Escenario del camino crítico. crash = { id, at } (opcional): acortar una semana la actividad id
   * con la decisión tomada al final de la semana at. Las precedencias se respetan: B empieza al
   * terminar A y D al terminar B y C.
   */
  function criticalScenario(delay, speed, crash) {
    const d = Math.max(SCEN_LIMITS.delay[0], Math.min(SCEN_LIMITS.delay[1], Math.round(delay) || 0));
    const s = Math.max(SCEN_LIMITS.speed[0], Math.min(SCEN_LIMITS.speed[1], Math.round(speed) || 0));
    const cr = crash && crash.id && crashable(d, s, crash.at)[crash.id] === true ? crash : null;
    const at = cr ? cr.at : null;
    const T = scenarioTimes(d, s);
    // Duraciones reales tras la decisión, propagando las precedencias.
    const dur = { A: T.A[1], B: T.B[1], C: T.C[1], D: T.D[1] };
    if (cr) dur[cr.id] -= 1;
    const st = { A: 0, C: 0 };
    st.B = st.A + dur.A;
    st.D = Math.max(st.B + dur.B, st.C + dur.C);
    const RD = st.D + dur.D;
    const acts = ['A', 'B', 'C', 'D'].map((id) => {
      const crashedHere = cr && cr.id === id ? at : null;
      // execActivity recibe la duración sin acortar y la acorta él mismo.
      return execActivity(id, st[id], crashedHere !== null ? dur[id] + 1 : dur[id], crashedHere, RD);
    }).map(({ finish, ...a }) => a);
    const project = {
      source: 'scenario', exampleId: null, name: { es: 'Escenario del camino crítico', en: 'Critical path scenario' },
      unit: 'week', currency: 'EUR', historyKnown: true, activities: acts,
    };
    return {
      project, delay: d, speed: s, crash: cr, RD, PD: E.plannedDuration(project),
      critical: ['A', 'B', 'D'], slack: { C: SCEN.A.duration + SCEN.B.duration - SCEN.C.duration },
      precedences: [['A', 'B'], ['B', 'D'], ['C', 'D']],
    };
  }

  /**
   * Qué actividades se pueden acortar una semana con la decisión al final de la semana at:
   * las que no han terminado y a las que les quedan al menos 2 periodos.
   * → { A: true | 'done' | 'short', … }
   */
  function crashable(d, s, at) {
    const T = scenarioTimes(d, s);
    const out = {};
    for (const id of ['A', 'B', 'C', 'D']) {
      const [st, du] = T[id];
      const fin = st + du;
      if (fin <= at) out[id] = 'done';
      else if (fin - Math.max(st, at) < 2) out[id] = 'short';
      else out[id] = true;
    }
    return out;
  }

  const api = { METHODS, STAGES, forecastErrors, pFactor, pFactorSeries, pvActivityAt, criticalScenario, crashable, CRASH_COST, SCEN_LIMITS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCAdvanced = api;
})(this);
