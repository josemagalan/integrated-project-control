'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/core/engine.js');
const X = require('../js/core/examples.js');

test('los ejemplos son válidos y tienen textos en ES y EN', () => {
  assert.equal(X.examples.length, 3);
  for (const p of X.examples) {
    assert.deepEqual(E.validateProject(p), [], p.id);
    for (const field of ['name', 'description', 'lesson']) {
      assert.ok(p[field].es && p[field].en, `${p.id}.${field}`);
    }
    for (const a of p.activities) assert.ok(a.name.es && a.name.en, `${p.id}.${a.id}`);
    assert.ok(E.actualDuration(p) !== null, `${p.id} termina`);
  }
});

test('reforma (late): el SPI vuelve a 1 al terminar con 3 semanas de retraso; SPI(t) no', () => {
  const p = X.byId('late');
  assert.equal(E.plannedDuration(p), 10);
  assert.equal(E.bac(p), 30000);
  assert.equal(E.actualDuration(p), 13);
  const end = E.metricsAt(p, 13);
  assert.ok(Math.abs(end.SPI - 1) < 1e-9);
  assert.ok(end.SPIt < 0.8);
  assert.ok(Math.abs(end.durationEAC.es.spi - 13) < 1e-9);
  assert.ok(Math.abs(end.durationEAC.pv.spi - 10) < 1e-9, 'el método PV se queda en 10');
  // Entre las semanas 10 y 13 el SPI sube aunque el retraso no mejora.
  const spi = [10, 11, 12, 13].map((t) => E.metricsAt(p, t).SPI);
  for (let i = 1; i < spi.length; i++) assert.ok(spi[i] > spi[i - 1]);
});

test('app (ahead): adelantado y por debajo del presupuesto', () => {
  const p = X.byId('ahead');
  assert.equal(E.actualDuration(p), 10);
  assert.ok(E.plannedDuration(p) > 10);
  for (let t = 3; t <= 10; t++) {
    const m = E.metricsAt(p, t);
    assert.ok(m.CPI > 1 && m.SPI > 1 && m.SPIt > 1 && m.DPI > 1, `t = ${t}`);
  }
});

test('nave (decoupled): en la semana 6 el coste oculta el retraso que EDM detecta', () => {
  const p = X.byId('decoupled');
  assert.equal(E.plannedDuration(p), 9);
  assert.equal(E.actualDuration(p), 12);
  const m = E.metricsAt(p, 6);
  assert.ok(m.SPI > 0.96 && m.SPIt > 0.96, `SPI ${m.SPI}, SPI(t) ${m.SPIt}`);
  assert.ok(m.DPI < 0.75, `DPI ${m.DPI}`);
  assert.equal(m.DPI.toFixed(2), '0.74', 'el texto de la lección dice 0,74');
  assert.equal(m.durationEAC.edm.dpi.toFixed(1), '12.2', 'el texto de la lección dice 12,2');
  assert.ok(Math.abs(m.durationEAC.es.spi - 12) > 2.5, 'ES se queda lejos del final real');
  assert.ok(Math.abs(m.durationEAC.edm.dpi - 12) < 0.5, 'EDM se acerca al final real');
});
