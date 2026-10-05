'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/core/engine.js');
const P = require('../js/core/project.js');
const A = require('../js/core/advanced.js');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('errores de previsión: RD del historial, periodos 1..RD−1 y error = |f − RD|/RD', () => {
  const p = P.fromExample('late');
  const r = A.forecastErrors(p);
  assert.equal(r.RD, 13);
  assert.equal(r.rows.length, 12);
  for (const row of r.rows) {
    const m = E.metricsAt(p, row.AT);
    close(row.f.es, m.durationEAC.es.spi);
    close(row.err.es, (Math.abs(m.durationEAC.es.spi - 13) / 13) * 100);
  }
  assert.equal(r.mape.all.n, 12);
  assert.equal(r.mape.early.n + r.mape.middle.n + r.mape.late.n, 12);
});

test('lo que dicen los textos de cada ejemplo se cumple', () => {
  const late = A.forecastErrors(P.fromExample('late')).mape;
  for (const st of ['early', 'middle', 'late']) assert.ok(late[st].es < late[st].pv, st);
  const ahead = A.forecastErrors(P.fromExample('ahead')).mape;
  for (const st of ['early', 'middle', 'late']) assert.ok(ahead[st].es <= Math.min(ahead[st].pv, ahead[st].ed, ahead[st].edm) + 0.05, st);
  const dec = A.forecastErrors(P.fromExample('decoupled')).mape;
  for (const st of ['early', 'middle', 'late']) assert.ok(dec[st].edm < Math.min(dec[st].pv, dec[st].es, dec[st].ed), st);
  // El error de PD/SPI vuelve a crecer en las últimas semanas del proyecto retrasado.
  const rows = A.forecastErrors(P.fromExample('late')).rows;
  assert.ok(rows[11].err.pv > rows[9].err.pv);
});

test('ejemplo sin historial completo: no hay errores de previsión', () => {
  const custom = P.withAT(P.toCustom(P.fromExample('late'), 5), 5);
  assert.equal(A.forecastErrors(custom), null);
});

test('escenario del camino crítico: precedencias, holgura y duración real', () => {
  const base = A.criticalScenario(0, 0);
  assert.equal(base.PD, 9); assert.equal(base.RD, 9);
  for (let t = 1; t <= 9; t++) close(E.metricsAt(base.project, t).SPIt, 1, 1e-9);
  // El adelanto de la actividad no crítica no cambia la duración (holgura de 2 semanas).
  assert.equal(A.criticalScenario(0, 2).RD, 9);
  for (let d = 0; d <= 3; d++) for (let s = 0; s <= 3; s++) assert.equal(A.criticalScenario(d, s).RD, 9 + d);
  // La trampa: con retraso 2 y adelanto 1, SPI(t) > 1 hasta la semana 4 aunque RD = 11.
  const sc = A.criticalScenario(2, 1);
  for (let t = 1; t <= 4; t++) assert.ok(E.metricsAt(sc.project, t).SPIt > 1, `t=${t}`);
  assert.ok(E.metricsAt(sc.project, 5).SPIt < 1);
  // Respuesta de la pregunta 2: sin adelanto se ve desde la semana 1; con 2, hasta la 4 no.
  assert.ok(E.metricsAt(A.criticalScenario(2, 0).project, 1).SPIt < 1);
  const s2 = A.criticalScenario(2, 2).project;
  for (let t = 1; t <= 4; t++) assert.ok(E.metricsAt(s2, t).SPIt > 1);
  // Valores fuera de rango se acotan.
  assert.equal(A.criticalScenario(9, -4).delay, 3);
  assert.equal(A.criticalScenario(9, -4).speed, 0);
});

test('factor P: Σ PV_i(ES) = EV, P ∈ [0, 1], P < 1 en la trampa y P = 1 al terminar', () => {
  for (const p of [P.fromExample('late'), P.fromExample('ahead'), P.fromExample('decoupled'), A.criticalScenario(2, 1).project]) {
    const N = E.reportedPeriods(p);
    for (let t = 1; t <= N; t++) {
      const r = A.pFactor(p, t);
      close(r.rows.reduce((s, x) => s + x.pvEs, 0), E.ev(p, t), 1e-6);
      assert.ok(r.P >= 0 && r.P <= 1 + 1e-12);
      for (const x of r.rows) close(x.matched + x.ahead, x.ev, 1e-6);
    }
    close(A.pFactor(p, E.actualDuration(p)).P, 1, 1e-9);
  }
  const sc = A.criticalScenario(2, 1).project;
  for (let t = 1; t <= 4; t++) assert.ok(A.pFactor(sc, t).P < 0.95, `t=${t}`);
});

test('textos del módulo avanzado: mismas claves en los dos idiomas', () => {
  const AT = require('../js/modules/advanced-text.js').PCAdvancedText;
  const T = AT.TEXT;
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(T.es), keys(T.en));
  for (const k of ['stage', 's1Lesson']) assert.deepEqual(keys(T.es[k]), keys(T.en[k]));
  assert.equal(T.es.s4list.length, T.en.s4list.length);
  assert.equal(AT.REFS.length, 5);
});
