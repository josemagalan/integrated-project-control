'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/i18n.js');
const N = require('../js/narration.js');
const F = require('../js/format.js');
const E = require('../js/core/engine.js');
const X = require('../js/core/examples.js');

test('i18n: las mismas claves en español e inglés, sin textos vacíos', () => {
  const es = Object.keys(I.dict.es).sort();
  const en = Object.keys(I.dict.en).sort();
  assert.deepEqual(en, es);
  for (const lang of I.languages) for (const k of es) assert.ok(I.dict[lang][k].length > 0, `${lang}.${k}`);
});

test('narración: las mismas claves en los dos idiomas', () => {
  assert.deepEqual(Object.keys(N.TEXT.en).sort(), Object.keys(N.TEXT.es).sort());
});

test('narración: todas las semanas de todos los ejemplos, sin NaN ni undefined, y con los números del motor', () => {
  for (const p of X.examples) {
    for (let AT = 1; AT <= E.reportedPeriods(p); AT++) {
      for (const lang of I.languages) {
        for (const pf of ['index', 'pf1']) {
          const r = N.build(p, AT, lang, F, pf);
          const all = Object.values(r.groups).flat();
          for (const s of all) {
            assert.ok(!/NaN|undefined|Infinity/.test(s.text + s.formula), `${p.id} AT ${AT} ${lang}: ${s.formula}`);
          }
          const m = E.metricsAt(p, AT);
          const esText = r.groups.es.map((s) => s.formula).join(' ');
          assert.ok(esText.includes(F.num(lang, m.ES, 2)), `${p.id} AT ${AT}: ES`);
          const edmText = r.groups.edm.map((s) => s.formula).join(' ');
          assert.ok(edmText.includes(`DPI = ED(t)/AT = ${F.num(lang, m.EDt, 2)}/${AT} = ${F.num(lang, m.DPI, 3)}`), `${p.id} AT ${AT}: DPI`);
          const evmText = r.groups.evm.map((s) => s.formula).join(' ');
          assert.ok(evmText.includes(`= ${F.money(lang, m.EV)}`), `${p.id} AT ${AT}: EV`);
        }
      }
    }
  }
});

test('formato: coma decimal en español y punto en inglés', () => {
  assert.equal(F.num('es', 0.7361, 2), '0,74');
  assert.equal(F.num('en', 0.7361, 2), '0.74');
  assert.equal(F.num('es', -0.0001, 2), '0,00');
  assert.equal(F.money('es', 4000), '4.000\u00a0€'); // espacio duro antes de €
  assert.equal(F.money('en', 30000), '€30,000');
  assert.equal(F.num('es', null), '—');
});

test('textos de los módulos: mismas claves en español e inglés', () => {
  for (const file of ['../js/modules/evm-text.js', '../js/modules/es-text.js', '../js/modules/edm-text.js', '../js/modules/practice-text.js']) {
    const { TEXT } = require(file);
    assert.deepEqual(Object.keys(TEXT.en).sort(), Object.keys(TEXT.es).sort(), file);
    for (const lang of ['es', 'en']) for (const [k, v] of Object.entries(TEXT[lang])) assert.ok(v.length > 0, `${file} ${lang}.${k}`);
  }
});

test('siglas: equivalencias castellanas solo en español', () => {
  assert.equal(I.acr('es', 'PV'), 'PV (CPTP)');
  assert.equal(I.acr('es', 'EAC'), 'EAC (CFP)');
  assert.equal(I.acr('en', 'PV'), 'PV');
  assert.equal(I.acr('es', 'TCPI'), 'TCPI');
});
