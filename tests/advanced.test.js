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
  assert.deepEqual(keys(T.es.s1Lesson.critical), keys(T.en.s1Lesson.critical));
  assert.equal(T.es.s4list.length, T.en.s4list.length);
  assert.equal(AT.REFS.length, 12);
  // Cada cita del texto del apartado 5 está en la lista de referencias, y cada referencia se cita.
  const surname = (r) => r.text.split(',')[0];
  for (const lang of ['es', 'en']) {
    const txt = T[lang].s4list.join(' ');
    for (const r of AT.REFS) assert.ok(txt.includes(surname(r)), `${lang}: ${surname(r)}`);
  }
  const ours = AT.REFS.filter((r) => /Galán/.test(r.text)).length;
  assert.ok(ours <= AT.REFS.length / 3, 'la lista no debe estar dominada por trabajos propios');
});

test('laboratorio: acortar una actividad crítica adelanta el final una semana; la no crítica, no', () => {
  for (let d = 0; d <= 3; d++) {
    for (let s = 0; s <= 3; s++) {
      const base = A.criticalScenario(d, s);
      for (let at = 1; at < base.RD; at++) {
        const can = A.crashable(d, s, at);
        for (const id of ['A', 'B', 'C', 'D']) {
          if (can[id] !== true) {
            // Una intervención imposible se ignora.
            assert.equal(A.criticalScenario(d, s, { id, at }).crash, null);
            continue;
          }
          const sc = A.criticalScenario(d, s, { id, at });
          assert.deepEqual(E.validateProject(sc.project), [], `${d} ${s} ${at} ${id}`);
          assert.equal(sc.RD, base.RD - (id === 'C' ? 0 : 1), `${d} ${s} ${at} ${id}`);
          assert.equal(E.actualDuration(sc.project), sc.RD);
          // El pasado no cambia y el coste extra es el de la tabla (± redondeo).
          for (let t = 1; t <= at; t++) {
            close(E.ev(sc.project, t), E.ev(base.project, t));
            close(E.ac(sc.project, t), E.ac(base.project, t));
          }
          close(E.ac(sc.project, sc.RD) - E.ac(base.project, base.RD), A.CRASH_COST[id], 3);
        }
      }
    }
  }
});

test('laboratorio, caso por defecto: la fabricación es la más barata y la que más sube el SPI(t), pero no gana plazo', () => {
  const base = A.criticalScenario(2, 1);
  const can = A.crashable(2, 1, 2);
  assert.deepEqual(can, { A: true, B: true, C: true, D: true });
  const spit = (p) => E.metricsAt(p, 3).SPIt;
  const res = Object.fromEntries(['A', 'B', 'C', 'D'].map((id) => [id, A.criticalScenario(2, 1, { id, at: 2 })]));
  assert.equal(res.C.RD, base.RD);
  for (const id of ['A', 'B', 'D']) assert.ok(spit(res.C.project) > spit(res[id].project), id);
  assert.ok(A.CRASH_COST.C < Math.min(A.CRASH_COST.A, A.CRASH_COST.B, A.CRASH_COST.D));
});

test('error con signo: |sgn| = err y el sesgo es negativo en la trampa (previsiones optimistas)', () => {
  const r = A.forecastErrors(A.criticalScenario(2, 1).project);
  for (const row of r.rows) for (const k of ['pv', 'ed', 'es', 'edm']) close(Math.abs(row.sgn[k]), row.err[k]);
  for (const k of ['pv', 'ed', 'es', 'edm']) assert.ok(r.bias.early[k] < 0, k);
  const none = A.forecastErrors(A.criticalScenario(0, 0).project);
  for (const k of ['pv', 'ed', 'es', 'edm']) close(none.mape.all[k], 0);
});
