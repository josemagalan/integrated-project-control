'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/core/engine.js');

const close = (actual, expected, msg, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: ${actual} ≠ ${expected}`);

// Ejemplo resuelto a mano (ver comentarios con cada valor).
// A: periodos 1-2, 100 €. B: periodos 2-3, 200 €. PD = 3, BAC = 300.
// PV: 0, 50, 200, 300. TPD: 0, 1, 3, 4.
const hand = {
  activities: [
    { id: 'A', start: 0, duration: 2, budget: 100, pc: [0.25, 0.75, 1, 1], ac: [30, 50, 30, 0] },
    { id: 'B', start: 1, duration: 2, budget: 200, pc: [0, 0.25, 0.5, 1], ac: [0, 60, 50, 110] },
  ],
};

test('ejemplo a mano: curvas planificadas', () => {
  assert.deepEqual(E.validateProject(hand), []);
  assert.equal(E.plannedDuration(hand), 3);
  assert.equal(E.bac(hand), 300);
  assert.deepEqual([0, 1, 2, 3, 4].map((t) => E.pv(hand, t)), [0, 50, 200, 300, 300]);
  assert.deepEqual([0, 1, 2, 3, 4].map((t) => E.tpd(hand, t)), [0, 1, 3, 4, 4]);
  assert.equal(E.tpdTotal(hand), 4);
  assert.equal(E.actualDuration(hand), 4);
});

test('ejemplo a mano: valor ganado en AT = 2', () => {
  const m = E.metricsAt(hand, 2);
  close(m.PV, 200, 'PV = 100 + 200/2');
  close(m.EV, 125, 'EV = 100·0,75 + 200·0,25');
  close(m.AC, 140, 'AC = 30 + 50 + 60');
  close(m.SV, -75, 'SV');
  close(m.CV, -15, 'CV');
  close(m.SPI, 0.625, 'SPI');
  close(m.CPI, 125 / 140, 'CPI');
  close(m.costEAC.pf1, 315, 'EAC con PF = 1');
  close(m.costEAC.cpi, 336, 'EAC = BAC/CPI');
  close(m.costEAC.sci, 140 + 175 / ((125 / 140) * (125 / 200)), 'EAC con PF = SCI');
  close(m.VAC, -36, 'VAC');
  close(m.TCPI, 175 / 160, 'TCPI');
});

test('ejemplo a mano: programación ganada en AT = 2', () => {
  const m = E.metricsAt(hand, 2);
  // PV(1) = 50 ≤ 125 < PV(2) = 200 → C = 1; ES = 1 + 75/150.
  assert.equal(m.esTrace.C, 1);
  close(m.ES, 1.5, 'ES');
  close(m.SVt, -0.5, 'SV(t)');
  close(m.SPIt, 0.75, 'SPI(t)');
});

test('ejemplo a mano: duración ganada (EDM) en AT = 2', () => {
  const m = E.metricsAt(hand, 2);
  close(m.TED, 2, 'TED = 2·0,75 + 2·0,25');
  close(m.TPDt, 3, 'TPD(2)');
  close(m.EDI, 2 / 3, 'EDI');
  // TPD(1) = 1 ≤ 2 < TPD(2) = 3 → ED(t) = 1 + 1/2.
  close(m.EDt, 1.5, 'ED(t)');
  close(m.DPI, 0.75, 'DPI');
});

test('ejemplo a mano: previsiones de plazo en AT = 2', () => {
  const d = E.metricsAt(hand, 2).durationEAC;
  close(d.pv.pf1, 3.75, 'valor planificado, PF = 1: PD − SV/(BAC/PD)');
  close(d.pv.spi, 4.8, 'valor planificado: PD/SPI');
  close(d.ed.pf1, 3.75, 'Jacob, PF = 1: AT + PD − AT·SPI');
  close(d.ed.spi, 4.8, 'Jacob: máx(PD, AT)/SPI');
  close(d.es.pf1, 3.5, 'ES, PF = 1');
  close(d.es.spi, 4, 'ES: PD/SPI(t)');
  close(d.edm.pf1, 3.5, 'EDM, PF = 1');
  close(d.edm.dpi, 4, 'EDM: PD/DPI');
});

test('ejemplo a mano: al terminar, ES = ED(t) = PD y SPI = 1', () => {
  const m = E.metricsAt(hand, 4);
  close(m.SPI, 1, 'SPI');
  close(m.ES, 3, 'ES');
  close(m.SPIt, 0.75, 'SPI(t)');
  close(m.EDt, 3, 'ED(t)');
  close(m.DPI, 0.75, 'DPI');
  close(m.durationEAC.es.spi, 4, 'previsión ES = duración real');
  close(m.durationEAC.ed.spi, 4, 'previsión Jacob = duración real');
  close(m.durationEAC.pv.spi, 3, 'previsión PV se queda en PD: el defecto del SPI');
});

test('validación de datos', () => {
  assert.deepEqual(E.validateProject({ activities: [] }), ['noActivities']);
  const bad = { activities: [{ id: 'A', start: -1, duration: 0, budget: 0, pc: [0.5, 0.4], ac: [1, -1] }] };
  const errs = E.validateProject(bad);
  for (const code of ['badStart:A', 'badDuration:A', 'badBudget:A', 'badProgress:A:2', 'badCost:A:2']) {
    assert.ok(errs.includes(code), code);
  }
});

// ---- Proyectos aleatorios ----------------------------------------------------

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomProject(rand, onPlan = false) {
  const n = 2 + Math.floor(rand() * 7);
  const activities = [];
  for (let i = 0; i < n; i++) {
    activities.push({
      id: String.fromCharCode(65 + i),
      start: Math.floor(rand() * 8),
      duration: 1 + Math.floor(rand() * 6),
      budget: Math.round(100 + rand() * 9900),
    });
  }
  const PD = Math.max(...activities.map((a) => a.start + a.duration));
  const N = onPlan ? PD : 1 + Math.floor(rand() * (PD + 6));
  for (const a of activities) {
    a.pc = []; a.ac = [];
    let p = 0;
    for (let t = 1; t <= N; t++) {
      if (onPlan) p = E.plannedPeriodsElapsed(a, t) / a.duration;
      else if (rand() < 0.6) p = Math.min(1, p + rand() * 0.5);
      a.pc.push(p);
      a.ac.push(Math.round(rand() * 1000));
    }
  }
  return { activities };
}

// Implementación independiente de la proyección en el tiempo: bisección sobre la curva
// lineal a trozos, buscando sup{τ ∈ [0, PD] : curva(τ) ≤ valor}.
function projectionByBisection(curveAt, value, PD) {
  const interp = (tau) => {
    const k = Math.min(Math.floor(tau), PD - 1);
    return curveAt(k) + (curveAt(k + 1) - curveAt(k)) * (tau - k);
  };
  if (value >= curveAt(PD) - 1e-9) return PD;
  let lo = 0, hi = PD;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (interp(mid) <= value + 1e-12) lo = mid; else hi = mid;
  }
  return lo;
}

test('ES y ED(t) coinciden con una implementación independiente (2000 proyectos aleatorios)', () => {
  const rand = mulberry32(20261005);
  for (let k = 0; k < 2000; k++) {
    const p = randomProject(rand);
    assert.deepEqual(E.validateProject(p), []);
    const PD = E.plannedDuration(p);
    const N = E.reportedPeriods(p);
    const AT = 1 + Math.floor(rand() * N);
    const m = E.metricsAt(p, AT);
    close(m.ES, projectionByBisection((t) => E.pv(p, t), m.EV, PD), `ES proyecto ${k}`, 1e-6);
    close(m.EDt, projectionByBisection((t) => E.tpd(p, t), m.TED, PD), `ED(t) proyecto ${k}`, 1e-6);
    assert.ok(m.ES >= 0 && m.ES <= PD, 'ES dentro de [0, PD]');
    assert.ok(m.EDt >= 0 && m.EDt <= PD, 'ED(t) dentro de [0, PD]');
  }
});

test('un proyecto que sigue el plan tiene todos los índices de plazo en 1', () => {
  const rand = mulberry32(7);
  for (let k = 0; k < 300; k++) {
    const p = randomProject(rand, true);
    const PD = E.plannedDuration(p);
    for (let AT = 1; AT <= PD; AT++) {
      const m = E.metricsAt(p, AT);
      if (m.PV === 0) { assert.equal(m.SPI, null); assert.equal(m.EDI, null); continue; }
      close(m.SPI, 1, 'SPI');
      close(m.EDI, 1, 'EDI');
      // Si el plan tiene periodos sin trabajo, ES salta al último instante con ese valor.
      if (E.pv(p, AT + 1) > E.pv(p, AT) || AT === PD) close(m.ES, AT, `ES proyecto ${k} AT ${AT}`, 1e-9);
      if (E.tpd(p, AT + 1) > E.tpd(p, AT) || AT === PD) close(m.EDt, AT, `ED(t) proyecto ${k} AT ${AT}`, 1e-9);
    }
  }
});

test('la duración ganada no depende de los presupuestos; ES sí', () => {
  const rand = mulberry32(99);
  let esChanged = 0;
  for (let k = 0; k < 300; k++) {
    const p = randomProject(rand);
    const q = { activities: p.activities.map((a) => ({ ...a, budget: Math.round(100 + rand() * 9900) })) };
    const AT = E.reportedPeriods(p);
    const mp = E.metricsAt(p, AT);
    const mq = E.metricsAt(q, AT);
    close(mp.EDt, mq.EDt, 'ED(t)');
    close(mp.DPI, mq.DPI, 'DPI');
    close(mp.EDI, mq.EDI, 'EDI');
    if (Math.abs(mp.ES - mq.ES) > 1e-6) esChanged++;
  }
  assert.ok(esChanged > 100, `ES debería cambiar con los presupuestos (${esChanged})`);
});

test('escalar todos los presupuestos no cambia ningún índice', () => {
  const rand = mulberry32(5);
  for (let k = 0; k < 200; k++) {
    const p = randomProject(rand);
    const q = {
      activities: p.activities.map((a) => ({ ...a, budget: a.budget * 3, ac: a.ac.map((c) => c * 3) })),
    };
    const AT = E.reportedPeriods(p);
    const mp = E.metricsAt(p, AT);
    const mq = E.metricsAt(q, AT);
    for (const key of ['SPI', 'CPI', 'ES', 'SPIt', 'EDt', 'DPI']) {
      if (mp[key] === null) assert.equal(mq[key], null);
      else close(mp[key], mq[key], key, 1e-9);
    }
  }
});

test('series: longitudes y valores iniciales', () => {
  const s = E.series(hand);
  assert.equal(s.planned.length, 4);
  assert.equal(s.actual.length, 5);
  assert.equal(s.metrics.length, 4);
  assert.deepEqual(s.actual[0], { t: 0, EV: 0, AC: 0, TED: 0 });
  assert.equal(s.AD, 4);
});

test('ES = ED(t) cuando todas las actividades gastan lo mismo por periodo', () => {
  const rand = mulberry32(31);
  for (let k = 0; k < 500; k++) {
    const p = randomProject(rand);
    const flat = { activities: p.activities.map((a) => ({ ...a, budget: a.duration * 700 })) };
    const AT = E.reportedPeriods(p);
    const m = E.metricsAt(flat, AT);
    close(m.ES, m.EDt, `proyecto ${k}`, 1e-9);
  }
});

// ---- Regresiones (revisión del 5-10-2026) ----------------------------------------

/** Proyecto de una actividad con una foto en AT = 1: presupuesto, % completado y coste real. */
const snap = (budget, pc, ac) => ({ activities: [{ id: 'A', start: 0, duration: 2, budget, pc: [pc], ac: [ac] }] });

test('TCPI: con el presupuesto agotado no se interpreta respecto al BAC (BAC 12 000, AC 20 000, EV 1 500)', () => {
  const m = E.metricsAt(snap(12000, 0.125, 20000), 1);
  close(m.EV, 1500, 'EV');
  assert.equal(m.tcpiCase, 'exhausted');
  assert.equal(m.TCPI, null, 'el TCPI respecto al BAC no se da (su denominador es negativo)');
  // Respecto al EAC = BAC/CPI, el TCPI coincide con el CPI.
  close(m.TCPIeac, m.CPI, 'TCPI(EAC) = CPI', 1e-12);
  close(m.TCPIeac, (12000 - 1500) / (m.costEAC.cpi - 20000), 'TCPI(EAC) = (BAC − EV)/(EAC − AC)');
});

test('TCPI: gasto justo igual al BAC también cuenta como presupuesto agotado', () => {
  const m = E.metricsAt(snap(12000, 0.5, 12000), 1);
  assert.equal(m.tcpiCase, 'exhausted');
  assert.equal(m.TCPI, null);
});

test('TCPI: con el trabajo terminado no se aplica, aunque haya sobrecoste', () => {
  for (const ac of [9000, 12000, 15000]) {
    const m = E.metricsAt(snap(12000, 1, ac), 1);
    assert.equal(m.tcpiCase, 'done', `AC ${ac}`);
    assert.equal(m.TCPI, null);
    assert.equal(m.TCPIeac, null);
  }
});

test('TCPI: caso normal sin cambios (queda trabajo y presupuesto)', () => {
  const m = E.metricsAt(hand, 2);
  assert.equal(m.tcpiCase, 'normal');
  close(m.TCPI, 175 / 160, 'TCPI');
});

/** Recorre las métricas y devuelve las rutas con números no finitos (Infinity o NaN). */
function nonFinite(obj, path = '') {
  if (typeof obj === 'number') return Number.isFinite(obj) ? [] : [path];
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).flatMap(([k, v]) => nonFinite(v, path ? `${path}.${k}` : k));
}

test('avance cero con gasto: las previsiones quedan sin calcular (null), nunca infinitas', () => {
  const p = { activities: [
    { id: 'A', start: 0, duration: 2, budget: 1000, pc: [0, 0], ac: [300, 200] },
    { id: 'B', start: 1, duration: 2, budget: 1000, pc: [0, 0], ac: [0, 100] },
  ] };
  for (const AT of [1, 2]) {
    const m = E.metricsAt(p, AT);
    assert.equal(m.EV, 0);
    assert.equal(m.CPI, 0);
    assert.deepEqual(nonFinite(m), [], `AT ${AT}`);
    assert.equal(m.costEAC.cpi, null);
    assert.equal(m.costEAC.sci, null);
    assert.equal(m.VAC, null);
    assert.equal(m.durationEAC.pv.spi, null);
    assert.equal(m.durationEAC.es.spi, null);
    assert.equal(m.durationEAC.edm.dpi, null);
  }
});

test('validación: rechaza presupuestos y costes no finitos', () => {
  assert.ok(E.validateProject(snap(Infinity, 0.5, 100)).some((e) => e.startsWith('badBudget')));
  assert.ok(E.validateProject(snap(NaN, 0.5, 100)).some((e) => e.startsWith('badBudget')));
  assert.ok(E.validateProject(snap(1000, 0.5, Infinity)).some((e) => e.startsWith('badCost')));
  assert.deepEqual(E.validateProject(snap(1000, 0.5, 100)), []);
});
