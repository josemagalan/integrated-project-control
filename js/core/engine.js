/*
 * Motor de cálculo del control integrado de proyectos.
 *
 * Valor ganado (EVM), programación ganada (ES, Lipke 2003) y duración ganada (EDM,
 * Khamooshi y Golafshani 2014), con los métodos de previsión de plazo comparados por
 * Vandevoorde y Vanhoucke (2006): valor planificado (Anbari), duración ganada (Jacob) y ES.
 *
 * Convenciones:
 *  - Periodos t = 1..PD. Los valores son acumulados al final del periodo t; en t = 0 valen 0.
 *  - Actividad: { id, start, duration, budget, pc: [...], ac: [...] }
 *      start    periodos completos antes de empezar (0 = empieza en el periodo 1)
 *      duration periodos planificados (entero >= 1)
 *      budget   presupuesto de la actividad; el PV se reparte linealmente
 *      pc[k]    fracción completada acumulada (0..1) al final del periodo k+1
 *      ac[k]    coste real incurrido durante el periodo k+1
 *  - Todas las actividades informan el mismo número de periodos (reportedPeriods).
 */
(function (root) {
  'use strict';

  const EPS = 1e-9;

  function validateProject(project) {
    const errors = [];
    const acts = project && project.activities;
    if (!Array.isArray(acts) || acts.length === 0) return ['noActivities'];
    const n = acts[0].pc ? acts[0].pc.length : 0;
    const ids = new Set();
    acts.forEach((a, i) => {
      const where = a.id || `#${i + 1}`;
      if (!a.id || ids.has(a.id)) errors.push(`badId:${where}`);
      ids.add(a.id);
      if (!Number.isInteger(a.start) || a.start < 0) errors.push(`badStart:${where}`);
      if (!Number.isInteger(a.duration) || a.duration < 1) errors.push(`badDuration:${where}`);
      if (!(a.budget > 0) || !Number.isFinite(a.budget)) errors.push(`badBudget:${where}`);
      if (!Array.isArray(a.pc) || !Array.isArray(a.ac) || a.pc.length !== n || a.ac.length !== n) {
        errors.push(`badLength:${where}`);
        return;
      }
      let prev = 0;
      a.pc.forEach((p, k) => {
        if (!(p >= 0 && p <= 1) || p < prev - EPS) errors.push(`badProgress:${where}:${k + 1}`);
        prev = p;
      });
      a.ac.forEach((c, k) => { if (!(c >= 0) || !Number.isFinite(c)) errors.push(`badCost:${where}:${k + 1}`); });
    });
    return errors;
  }

  // ---- Curvas planificadas -------------------------------------------------

  function plannedDuration(project) {
    return Math.max(...project.activities.map((a) => a.start + a.duration));
  }

  function bac(project) {
    return project.activities.reduce((s, a) => s + a.budget, 0);
  }

  /** Periodos de la actividad planificados hasta el final de t (0..duration). */
  function plannedPeriodsElapsed(a, t) {
    return Math.min(Math.max(t - a.start, 0), a.duration);
  }

  function pvActivity(a, t) {
    return (a.budget * plannedPeriodsElapsed(a, t)) / a.duration;
  }

  function pv(project, t) {
    return project.activities.reduce((s, a) => s + pvActivity(a, t), 0);
  }

  /** PV en un instante no entero: interpolación lineal (el PV es lineal dentro de cada periodo). */
  function pvAtTime(project, tau) {
    const k = Math.floor(tau);
    const lo = pv(project, k);
    return lo + (pv(project, k + 1) - lo) * (tau - k);
  }

  /** EDM: unidades de duración planificadas acumuladas, TPD(t). */
  function tpd(project, t) {
    return project.activities.reduce((s, a) => s + plannedPeriodsElapsed(a, t), 0);
  }

  function tpdTotal(project) {
    return project.activities.reduce((s, a) => s + a.duration, 0);
  }

  // ---- Valores reales --------------------------------------------------------

  function reportedPeriods(project) {
    return project.activities[0].pc.length;
  }

  function pcAt(a, t) {
    return t <= 0 ? 0 : a.pc[Math.min(t, a.pc.length) - 1];
  }

  function ev(project, t) {
    return project.activities.reduce((s, a) => s + a.budget * pcAt(a, t), 0);
  }

  function ac(project, t) {
    return project.activities.reduce((s, a) => {
      let sum = 0;
      for (let k = 0; k < Math.min(t, a.ac.length); k++) sum += a.ac[k];
      return s + sum;
    }, 0);
  }

  /** EDM: duración ganada total, TED(t) = Σ d_i · pc_i(t). */
  function ted(project, t) {
    return project.activities.reduce((s, a) => s + a.duration * pcAt(a, t), 0);
  }

  /** Primer periodo al final del cual todas las actividades están terminadas (o null). */
  function actualDuration(project) {
    const n = reportedPeriods(project);
    for (let t = 1; t <= n; t++) {
      if (project.activities.every((a) => pcAt(a, t) >= 1 - EPS)) return t;
    }
    return null;
  }

  // ---- Proyección en el tiempo (ES y ED(t)) ----------------------------------

  /**
   * Tiempo en el que la curva planificada alcanza `value` (Lipke, 2003).
   * C = máx{c ∈ 0..PD−1 : curve(c) ≤ value}; resultado = C + (value − curve(C)) / (curve(C+1) − curve(C)).
   * Si value alcanza el total planificado, el resultado es PD.
   */
  function timeProjection(curveAt, value, PD) {
    const total = curveAt(PD);
    if (value >= total - EPS) {
      return { time: PD, C: PD, low: total, high: total, complete: true };
    }
    let C = 0;
    for (let c = 0; c < PD; c++) if (curveAt(c) <= value + EPS) C = c;
    const low = curveAt(C);
    const high = curveAt(C + 1);
    const frac = high - low > EPS ? (value - low) / (high - low) : 0;
    return { time: C + Math.max(0, frac), C, low, high, complete: false };
  }

  function ratio(a, b) {
    return Math.abs(b) > EPS ? a / b : null;
  }

  function product(a, b) {
    return a === null || b === null ? null : a * b;
  }

  /** AT + (rest)/pf, o null si pf no está definido o es 0. */
  function forecast(AT, rest, pf) {
    return pf === null || Math.abs(pf) < EPS ? null : AT + rest / pf;
  }

  // ---- Métricas en la fecha de control AT -------------------------------------

  function metricsAt(project, AT) {
    const PD = plannedDuration(project);
    const BAC = bac(project);
    const PV = pv(project, AT);
    const EV = ev(project, AT);
    const AC = ac(project, AT);

    // Valor ganado
    const CV = EV - AC;
    const SV = EV - PV;
    const CPI = ratio(EV, AC);
    const SPI = ratio(EV, PV);
    const SCI = product(CPI, SPI);
    // Sin trabajo ganado (EV = 0) el CPI vale 0 o no existe: no hay rendimiento con el que proyectar.
    const costEAC = {
      pf1: AC + (BAC - EV),
      cpi: CPI === null || CPI < EPS ? null : AC + (BAC - EV) / CPI,
      sci: SCI === null || SCI < EPS ? null : AC + (BAC - EV) / SCI,
    };
    const VAC = costEAC.cpi === null ? null : BAC - costEAC.cpi;
    // TCPI (PMI): eficiencia necesaria en el trabajo pendiente. Respecto al BAC solo tiene sentido si
    // queda trabajo y queda presupuesto. Si el gasto ya alcanza el BAC, terminar en BAC es imposible y
    // se calcula respecto al EAC: (BAC − EV)/(EAC − AC), que con EAC = BAC/CPI coincide con el CPI.
    const tcpiCase = EV >= BAC - EPS ? 'done' : AC >= BAC - EPS ? 'exhausted' : 'normal';
    const TCPI = tcpiCase === 'normal' ? ratio(BAC - EV, BAC - AC) : null;
    const TCPIeac = tcpiCase === 'done' || costEAC.cpi === null ? null : ratio(BAC - EV, costEAC.cpi - AC);

    // Programación ganada
    const esProj = timeProjection((t) => pv(project, t), EV, PD);
    const ES = esProj.time;
    const SVt = ES - AT;
    const SPIt = ratio(ES, AT);
    const SCIt = product(SPIt, CPI);

    // Duración ganada (EDM)
    const TPDt = tpd(project, AT);
    const TPDtot = tpdTotal(project);
    const TED = ted(project, AT);
    const edProj = timeProjection((t) => tpd(project, t), TED, PD);
    const EDt = edProj.time;
    const DPI = ratio(EDt, AT);
    const EDI = ratio(TED, TPDt);

    // Previsión de plazo
    const PVrate = BAC / PD;
    const TV = SV / PVrate;
    const EDj = SPI === null ? null : AT * SPI; // duración ganada de Jacob
    const horizon = Math.max(PD, AT);
    const durationEAC = {
      pv: {
        pf1: PD - TV,
        spi: SPI === null ? null : forecast(0, PD, SPI),
        sci: SCI === null ? null : forecast(0, PD, SCI),
      },
      ed: {
        pf1: EDj === null ? null : AT + (horizon - EDj),
        spi: EDj === null ? null : forecast(AT, horizon - EDj, SPI),
        sci: EDj === null ? null : forecast(AT, horizon - EDj, SCI),
      },
      es: {
        pf1: AT + (PD - ES),
        spi: forecast(AT, PD - ES, SPIt),
        sci: forecast(AT, PD - ES, SCIt),
      },
      edm: {
        pf1: AT + (PD - EDt),
        dpi: forecast(AT, PD - EDt, DPI),
      },
    };

    return {
      AT, PD, BAC, PV, EV, AC,
      CV, SV, CPI, SPI, SCI, costEAC, VAC, TCPI, TCPIeac, tcpiCase,
      ES, SVt, SPIt, SCIt, esTrace: esProj,
      TPDt, TPDtot, TED, EDt, DPI, EDI, edTrace: edProj,
      PVrate, TV, EDj, durationEAC,
      percentComplete: EV / BAC,
    };
  }

  /** Series para las gráficas: planificado en 0..PD y real en 0..reportedPeriods. */
  function series(project) {
    const PD = plannedDuration(project);
    const N = reportedPeriods(project);
    const planned = [];
    for (let t = 0; t <= PD; t++) planned.push({ t, PV: pv(project, t), TPD: tpd(project, t) });
    const actual = [{ t: 0, EV: 0, AC: 0, TED: 0 }];
    for (let t = 1; t <= N; t++) actual.push({ t, EV: ev(project, t), AC: ac(project, t), TED: ted(project, t) });
    const metrics = [];
    for (let t = 1; t <= N; t++) metrics.push(metricsAt(project, t));
    return { PD, N, BAC: bac(project), TPDtot: tpdTotal(project), planned, actual, metrics, AD: actualDuration(project) };
  }

  const api = {
    EPS, validateProject, plannedDuration, bac, plannedPeriodsElapsed, pvActivity, pv, pvAtTime, tpd, tpdTotal,
    reportedPeriods, pcAt, ev, ac, ted, actualDuration, timeProjection, metricsAt, series,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCEngine = api;
})(this);
