'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/core/engine.js');
const X = require('../js/core/examples.js');
const P = require('../js/core/project.js');

const KEYS = ['PV', 'EV', 'AC', 'SPI', 'CPI', 'ES', 'SPIt', 'TPDt', 'TED', 'EDt', 'DPI', 'EDI'];
const same = (a, b, msg) => {
  for (const k of KEYS) {
    if (a[k] === null) assert.equal(b[k], null, `${msg} ${k}`);
    else assert.ok(Math.abs(a[k] - b[k]) < 1e-6, `${msg} ${k}: ${a[k]} ≠ ${b[k]}`);
  }
};

test('la foto en AT da los mismos indicadores que el historial (todos los ejemplos y fechas)', () => {
  for (const ex of X.examples) {
    for (let AT = 1; AT <= E.reportedPeriods(ex); AT++) {
      const custom = P.toCustom(P.fromExample(ex.id), AT);
      assert.equal(custom.historyKnown, false);
      assert.deepEqual(E.validateProject(custom), []);
      same(E.metricsAt(ex, AT), E.metricsAt(custom, AT), `${ex.id} AT ${AT}`);
    }
  }
});

test('mover la fecha de control en un proyecto propio conserva la foto', () => {
  const c = P.toCustom(P.fromExample('late'), 6);
  const moved = P.withAT(c, 9);
  assert.deepEqual(P.snapshot(moved, 9), P.snapshot(c, 6));
  assert.equal(E.reportedPeriods(moved), 9);
});

test('editar un ejemplo lo convierte en propio con la foto de esa fecha', () => {
  const ex = P.fromExample('decoupled');
  const q = P.edit(ex, 6, 'A', { budget: 24000 });
  assert.equal(q.source, 'custom');
  assert.equal(q.activities[0].budget, 24000);
  assert.deepEqual(P.snapshot(q, 6).map((s) => s.pc), P.snapshot(ex, 6).map((s) => s.pc));
  // EDM no cambia con el presupuesto; ES sí.
  const m0 = E.metricsAt(ex, 6);
  const m1 = E.metricsAt(q, 6);
  assert.ok(Math.abs(m0.DPI - m1.DPI) < 1e-9);
  assert.ok(Math.abs(m0.ES - m1.ES) > 0.05);
});

test('editar: límites y valores', () => {
  let q = P.edit(P.blank(4), 4, 'B', { pc: 1.7, ac: -5, duration: 0, start: -3 });
  const b = q.activities.find((a) => a.id === 'B');
  assert.equal(b.pc[3], 1);
  assert.equal(b.ac[3], 0);
  assert.equal(b.duration, 1);
  assert.equal(b.start, 0);
  q = P.edit(q, 4, 'B', { pc: 0.5, ac: 2500, name: 'Cimentación' });
  assert.deepEqual(P.snapshot(q, 4).find((s) => s.id === 'B'), { id: 'B', pc: 0.5, ac: 2500 });
  assert.equal(q.activities[1].name.es, 'Cimentación');
});

test('añadir y quitar actividades', () => {
  let q = P.blank(2);
  q = P.addActivity(q, 2);
  assert.equal(q.activities.length, 4);
  assert.equal(q.activities[3].id, 'D');
  q = P.removeActivity(q, 2, 'B');
  assert.deepEqual(q.activities.map((a) => a.id), ['A', 'C', 'D']);
  assert.deepEqual(E.validateProject(q), []);
});

test('URL: codificar y decodificar reproduce el proyecto y sus indicadores', () => {
  const c = P.edit(P.fromExample('late'), 7, 'C', { name: 'Instalaciones, fase 1; "eléctrica"|x' });
  const s = P.encode(c, 7);
  const d = P.decode(s, 7);
  assert.ok(d);
  assert.equal(d.activities[2].name.es, 'Instalaciones, fase 1; "eléctrica"|x');
  same(E.metricsAt(c, 7), E.metricsAt(d, 7), 'URL');
  assert.equal(P.decode('basura', 3), null);
  assert.equal(P.decode('week|x|A,a,0,0', 3).activities[0].duration, 1);
});

test('aleatorio: reproducible por semilla y válido', () => {
  const a = P.random(123);
  const b = P.random(123);
  assert.deepEqual(a, b);
  for (let s = 1; s <= 300; s++) {
    const { project, AT } = P.random(s);
    assert.deepEqual(E.validateProject(project), [], `semilla ${s}`);
    assert.ok(AT >= 1 && AT <= E.plannedDuration(project));
    assert.ok(project.activities.length >= 4 && project.activities.length <= 7);
    assert.ok(E.metricsAt(project, AT).EV >= 0);
  }
});

test('unidad de tiempo', () => {
  const q = P.setUnit(P.blank(1), 1, 'month');
  assert.equal(q.unit, 'month');
  assert.equal(P.setUnit(q, 1, 'year').unit, 'month');
});

test('regresión: el editor y la URL no admiten presupuestos ni costes infinitos', () => {
  const p = P.blank(2);
  for (const bad of [Infinity, 'Infinity', '1e400', -Infinity, NaN]) {
    const q = P.edit(p, 2, 'A', { budget: bad, ac: bad, pc: bad });
    const a = q.activities.find((x) => x.id === 'A');
    assert.ok(Number.isFinite(a.budget) && a.budget >= 1 && a.budget <= P.MAX_MONEY, `presupuesto ${bad}: ${a.budget}`);
    assert.ok(Number.isFinite(a.ac[1]) && a.ac[1] >= 0 && a.ac[1] <= P.MAX_MONEY, `coste ${bad}: ${a.ac[1]}`);
    assert.ok(a.pc[1] >= 0 && a.pc[1] <= 1, `% ${bad}`);
    assert.deepEqual(E.validateProject(q), []);
  }
  const d = P.decode('week|x|A,A,0,2,Infinity,50,1e400;B,B,1,2,1000,0,0', 2);
  assert.ok(d, 'se decodifica acotando los valores');
  assert.ok(d.activities.every((a) => Number.isFinite(a.budget) && Number.isFinite(a.ac[1])));
  assert.deepEqual(E.validateProject(d), []);
});
