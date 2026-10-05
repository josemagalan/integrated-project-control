'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/core/engine.js');
const PR = require('../js/core/practice.js');

test('el generador da ejercicios válidos y reproducibles en los tres niveles', () => {
  for (const level of Object.keys(PR.LEVELS)) {
    const L = PR.LEVELS[level];
    for (let seed = 1; seed <= 1000; seed++) {
      const ex = PR.generate(seed, level);
      assert.deepEqual(E.validateProject(ex.project), [], `${level} ${seed}`);
      const n = ex.project.activities.length;
      assert.ok(n >= L.n[0] && n <= L.n[1], `${level} ${seed}: ${n} actividades`);
      assert.ok(L.units.includes(ex.project.unit));
      const m = E.metricsAt(ex.project, ex.AT);
      assert.ok(m.EV > 0 && m.EV < m.BAC && m.AC > 0 && m.PV > 0, `${level} ${seed}`);
      for (const a of ex.project.activities) {
        const pc = a.pc[ex.AT - 1];
        assert.ok(Math.abs(pc / L.pcStep - Math.round(pc / L.pcStep)) < 1e-6, `${level} ${seed}: paso de % ${pc}`);
        assert.equal(a.budget % L.budStep, 0);
      }
    }
    assert.deepEqual(PR.generate(42, level), PR.generate(42, level));
  }
});

test('la solución se corrige como buena', () => {
  for (const level of Object.keys(PR.LEVELS)) {
    for (let seed = 1; seed <= 200; seed++) {
      const ex = PR.generate(seed, level);
      const r = PR.check(ex, PR.solution(ex));
      assert.equal(r.score.ok, r.score.total, `${level} ${seed}: ${JSON.stringify(r.items)}`);
    }
  }
});

test('redondear las respuestas a 2 decimales sigue siendo correcto (±1 %)', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const ex = PR.generate(seed, 'hard');
    const sol = PR.solution(ex);
    const rounded = Object.fromEntries(Object.entries(sol).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v]));
    const r = PR.check(ex, rounded);
    assert.equal(r.score.ok, r.score.total, `semilla ${seed}`);
  }
});

test('casillas vacías y respuestas erróneas', () => {
  const ex = PR.generate(7, 'medium');
  const sol = PR.solution(ex);
  const r = PR.check(ex, { PV: sol.PV * 1.2 });
  assert.equal(r.items.PV.status, 'wrong');
  assert.equal(r.items.EV.status, 'empty');
  assert.equal(r.score.ok, 0);
});

test('error arrastrado: un PV mal hace que SV y SPI sean coherentes pero no correctos', () => {
  const ex = PR.generate(11, 'medium');
  const sol = PR.solution(ex);
  const a = { ...sol, PV: sol.PV + 1000 };
  a.SV = a.EV - a.PV;
  a.SPI = a.EV / a.PV;
  const r = PR.check(ex, a);
  assert.equal(r.items.PV.status, 'wrong');
  assert.equal(r.items.SV.status, 'carried');
  assert.equal(r.items.SPI.status, 'carried');
  assert.equal(r.items.CPI.status, 'ok');
  // Un SV que no sale ni de la solución ni del PV del alumno es un error propio.
  const r2 = PR.check(ex, { ...a, SV: 12345 });
  assert.equal(r2.items.SV.status, 'wrong');
});

test('error arrastrado en ES: un EV mal se propaga a C, ES, SV(t), SPI(t) e IEAC(t)', () => {
  const ex = PR.generate(23, 'medium');
  const sol = PR.solution(ex);
  const a = { ...sol, EV: sol.EV * 0.8 };
  const pr = E.timeProjection((t) => E.pv(ex.project, t), a.EV, E.plannedDuration(ex.project));
  a.C = pr.C; a.ES = pr.time; a.SVt = a.ES - ex.AT; a.SPIt = a.ES / ex.AT; a.IEAC = E.plannedDuration(ex.project) / a.SPIt;
  const r = PR.check(ex, a, ['es', 'evm']);
  assert.equal(r.items.EV.status, 'wrong');
  for (const k of ['ES', 'SVt', 'SPIt', 'IEAC']) assert.equal(r.items[k].status, 'carried', k);
});

test('solo cuentan los bloques elegidos', () => {
  const ex = PR.generate(3, 'easy');
  const r = PR.check(ex, PR.solution(ex), ['edm']);
  assert.equal(r.score.total, 6);
  assert.ok(!('PV' in r.items));
});

test('interpretación: plazo y coste', () => {
  const ex = PR.generate(5, 'easy');
  const sol = PR.solution(ex);
  const m = E.metricsAt(ex.project, ex.AT);
  assert.equal(sol.schedule, m.SV > 0 ? 'ahead' : 'behind');
  const r = PR.check(ex, { schedule: sol.schedule === 'ahead' ? 'behind' : 'ahead' });
  assert.equal(r.items.schedule.status, 'wrong');
});

test('lectura de números en español e inglés', () => {
  const cases = [
    ['es', '12.900', 12900], ['es', '12.900 €', 12900], ['es', '0,915', 0.915], ['es', '1.234,5', 1234.5],
    ['es', '-4.000 €', -4000], ['es', '−0,25', -0.25], ['es', '0.915', 0.915], ['es', '91,5 %', 91.5],
    ['es', '12 900', 12900], ['en', '12,900', 12900], ['en', '0.915', 0.915], ['en', '1,234.5', 1234.5],
    ['en', '€30,000', 30000], ['es', '', null], ['es', 'abc', null], ['es', '5,85', 5.85], ['en', '0,5', 0.5],
  ];
  for (const [lang, s, v] of cases) assert.equal(PR.parseNum(lang, s), v, `${lang} «${s}»`);
});

// ---- Regresiones (revisión del 5-10-2026) ----------------------------------------

test('semilla: la misma validación para el campo y la URL (entero de 1 a 99 999)', () => {
  for (const ok of [1, '1', ' 42 ', '99999', 99999]) assert.equal(PR.normalizeSeed(ok), Number(String(ok).trim()), `válida: ${ok}`);
  for (const bad of [0, '0', '100000', 100000, '-5', '1.5', '12abc', '', ' ', null, undefined, 'Infinity', '1e3']) {
    assert.equal(PR.normalizeSeed(bad), null, `no válida: ${JSON.stringify(bad)}`);
  }
  // El botón «Nuevo ejercicio» nunca sale del rango.
  assert.equal(PR.normalizeSeed(1 + Math.floor(0.999999999 * PR.SEED_MAX)), PR.SEED_MAX);
});

test('cambio de idioma: la respuesta conserva su valor numérico', () => {
  // «12.333» en español son doce mil trescientos treinta y tres; en inglés se reescribe sin ambigüedad.
  const v = PR.parseNum('es', '12.333');
  assert.equal(v, 12333);
  assert.equal(PR.parseNum('en', PR.formatAnswer('en', v)), 12333);
  // Sin reescribir, el mismo texto en inglés cambiaría de valor: es el fallo que se corrige.
  assert.equal(PR.parseNum('en', '12.333'), 12.333);
  const cases = [['es', '0,915'], ['en', '0.915'], ['es', '−1.250'], ['en', '-1,250'], ['es', '12 900 €'], ['en', '1,234.5'], ['es', '3,25']];
  for (const [from, s] of cases) {
    const x = PR.parseNum(from, s);
    for (const to of ['es', 'en']) {
      assert.equal(PR.parseNum(to, PR.formatAnswer(to, x)), x, `${from} «${s}» → ${to}`);
      // Y de vuelta.
      assert.equal(PR.parseNum(from, PR.formatAnswer(from, PR.parseNum(to, PR.formatAnswer(to, x)))), x);
    }
  }
  for (const x of [1e21, 1e-7, -0.005]) for (const to of ['es', 'en']) assert.equal(PR.parseNum(to, PR.formatAnswer(to, x)), x, `${x} ${to}`);
  assert.equal(PR.formatAnswer('es', null), '');
});

test('los ejercicios dejan presupuesto por gastar: el TCPI es el del caso normal', () => {
  for (const level of Object.keys(PR.LEVELS)) {
    for (let seed = 1; seed <= 2000; seed++) {
      const ex = PR.generate(seed, level);
      const m = E.metricsAt(ex.project, ex.AT);
      assert.ok(m.AC < m.BAC, `${level} ${seed}: AC ${m.AC} ≥ BAC ${m.BAC}`);
      assert.equal(m.tcpiCase, 'normal');
      assert.ok(m.TCPI > 0);
    }
  }
});

test('errores típicos: el corrector reconoce el cociente invertido, el signo y la fórmula equivocada', () => {
  const ex = PR.generate(11, 'medium');
  const sol = PR.solution(ex);
  const m = E.metricsAt(ex.project, ex.AT);
  // Cada error por separado (con el resto bien), para que no cuente como error arrastrado.
  const one = (k, v) => PR.check(ex, { ...sol, [k]: v }).items[k];
  assert.equal(one('CPI', m.AC / m.EV).mistake, 'inverted');
  assert.equal(one('SV', m.PV - m.EV).mistake, 'sign');
  if (Math.abs(m.CPI - 1) > 0.02) assert.equal(one('EAC', m.BAC * m.CPI).mistake, 'times');
  if (Math.abs(m.SPI - m.SPIt) > 0.02) assert.equal(one('IEAC', m.durationEAC.pv.spi).mistake, 'ieacSpi');
  // Si el error viene de una casilla anterior, manda el aviso de error arrastrado.
  assert.equal(PR.check(ex, { ...sol, CPI: m.AC / m.EV, EAC: m.BAC * m.CPI }).items.EAC.status, 'carried');
  // Una respuesta arbitraria no recibe diagnóstico.
  assert.equal(PR.check(ex, { ...sol, CPI: 123.4 }).items.CPI.mistake, undefined);
  // Las correctas nunca llevan diagnóstico.
  for (const v of Object.values(PR.check(ex, sol).items)) assert.equal(v.mistake, undefined);
});

test('decisiones: siempre definidas y las tres opciones aparecen en los ejercicios generados', () => {
  const seen = { decCost: new Set(), decTime: new Set() };
  for (const level of ['easy', 'medium', 'hard']) {
    for (let seed = 1; seed <= 150; seed++) {
      const sol = PR.solution(PR.generate(seed, level));
      for (const k of Object.keys(seen)) { assert.ok(sol[k], `${level} ${seed} ${k}`); seen[k].add(sol[k]); }
    }
  }
  assert.deepEqual([...seen.decCost].sort(), ['improve', 'keepBudget', 'rebaseline']);
  assert.deepEqual([...seen.decTime].sort(), ['keepPlan', 'recover', 'replan']);
});
