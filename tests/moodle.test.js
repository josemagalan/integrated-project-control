'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/moodle.js');
const E = require('../js/core/engine.js');
const P = require('../js/core/project.js');
const PR = require('../js/core/practice.js');

const ALL = M.KINDS.map((k) => k.id);
const bank = {};
for (const lang of ['es', 'en']) {
  bank[lang] = M.generate({ lang, kinds: ALL, levels: M.LEVELS, count: 8, seed: 4242 });
  bank[lang].xml = M.toXml(bank[lang]);
}
const allQ = () => bank.es.questions.concat(bank.en.questions);

// ---------- Lectura de lo que ve el alumno (independiente de los campos internos) ----------

const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
const num = (lang, s) => PR.parseNum(lang, strip(s).replace('−', '-'));

/** Filas de la tabla de datos del enunciado: actividad, empieza, duración, presupuesto, %, AC. */
function dataRows(html) {
  const t = html.match(/<table[^>]*><thead>.*?<\/thead><tbody>(.*?)<\/tbody><\/table>/s);
  return [...t[1].matchAll(/<tr>(.*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => c[1]));
}

/** Reconstruye el proyecto con lo que muestra el enunciado. */
function readProject(q, lang) {
  const AT = Number(q.text.match(/AT = (\d+)/)[1]);
  const activities = dataRows(q.text).map((c) => {
    const pc = num(lang, c[4]) / 100;
    const at = (v) => Array.from({ length: AT }, (_, i) => (i === AT - 1 ? v : 0));
    return { id: c[0], start: Number(c[1]) - 1, duration: Number(c[2]), budget: num(lang, c[3]), pc: at(pc), ac: at(num(lang, c[5])) };
  });
  return { AT, project: { activities } };
}

const clozes = (text) => [...text.matchAll(/\{1:NUMERICAL:=(-?[\d.]+):([\d.]+)\}/g)].map((m) => ({ value: Number(m[1]), tol: Number(m[2]) }));
const hashOf = (link) => new URLSearchParams(link.split('#')[1]);

// ---------- Pruebas ----------

test('se generan todos los tipos y niveles, en los dos idiomas, sin huecos', () => {
  for (const lang of ['es', 'en']) {
    assert.equal(bank[lang].missing.length, 0, JSON.stringify(bank[lang].missing));
    assert.equal(bank[lang].questions.length, ALL.length * M.LEVELS.length * 8);
  }
});

test('la misma semilla da el mismo banco', () => {
  const again = M.generate({ lang: 'es', kinds: ALL, levels: M.LEVELS, count: 8, seed: 4242 });
  assert.equal(M.toXml(again), bank.es.xml);
});

test('«calcular»: las casillas son las del motor aplicado a lo que muestra el enunciado', () => {
  for (const lang of ['es', 'en']) {
    for (const q of bank[lang].questions.filter((x) => x.qtype === 'cloze')) {
      const { project, AT } = readProject(q, lang);
      assert.deepEqual(E.validateProject(project), [], q.name);
      const m = E.metricsAt(project, AT);
      const ctx = { p: project, AT, m };
      const items = PR.ITEMS.filter((it) => it.block === M.KINDS.find((k) => k.id === q.kind).block);
      const boxes = clozes(q.text);
      assert.equal(boxes.length, items.length, q.name);
      items.forEach((it, i) => {
        const truth = it.truth(m, ctx);
        assert.ok(Math.abs(boxes[i].value - truth) <= 1e-5 * Math.max(1, Math.abs(truth)), `${q.name} ${it.key}: ${boxes[i].value} ≠ ${truth}`);
        assert.ok(Math.abs(boxes[i].tol - PR.tolerance(truth, it.kind)) < 1e-5, `${q.name} ${it.key}: margen`);
        // Lo que acepta Moodle es lo mismo que acepta el modo Práctica.
        assert.ok(PR.within(truth + boxes[i].tol * 0.99, truth, it.kind));
      });
    }
  }
});

test('«calcular»: los enlaces abren el mismo ejercicio en el módulo y en la Práctica', () => {
  for (const q of allQ().filter((x) => x.qtype === 'cloze')) {
    const h = hashOf(q.links.module);
    const at = Number(h.get('at'));
    const p = P.decode(h.get('c'), at);
    assert.ok(p, q.name);
    const pr = hashOf(q.links.practice);
    const seed = PR.normalizeSeed(pr.get('seed'));
    assert.ok(seed !== null, `${q.name}: semilla ${pr.get('seed')}`);
    const ex = PR.generate(seed, pr.get('lvl'));
    assert.equal(ex.AT, at);
    const a = E.metricsAt(p, at); const b = E.metricsAt(ex.project, ex.AT);
    for (const k of ['PV', 'EV', 'AC', 'ES', 'TED', 'EDt']) assert.ok(Math.abs(a[k] - b[k]) < 1e-6, `${q.name} ${k}`);
  }
});

test('opción múltiple: una sola opción correcta y cuatro opciones', () => {
  for (const q of allQ().filter((x) => x.qtype === 'multichoice')) {
    assert.equal(q.options.length, 4, q.name);
    assert.equal(q.options.filter((o) => o.correct).length, 1, q.name);
    assert.equal(new Set(q.options.map((o) => o.text)).size, 4, q.name);
  }
});

test('«estado»: la opción correcta sale de los signos de SV y CV con los datos del enunciado', () => {
  for (const lang of ['es', 'en']) {
    for (const q of bank[lang].questions.filter((x) => x.kind === 'status')) {
      let PV; let EV; let AC;
      if (q.level === 'hard') {
        const { project, AT } = readProject(q, lang);
        ({ PV, EV, AC } = E.metricsAt(project, AT));
      } else {
        const v = (k) => num(lang, q.text.match(new RegExp(`\\b${k} = ([^<]+)<`))[1]);
        PV = v('PV'); EV = v('EV'); AC = v('AC');
      }
      const L = M.texts[lang].quad;
      const want = `${EV > PV ? (lang === 'es' ? 'Adelantado' : 'Ahead') : (lang === 'es' ? 'Retrasado' : 'Behind')}`;
      const right = q.options.find((o) => o.correct).text;
      assert.ok(strip(right).startsWith(want), `${q.name}: ${right}`);
      const cheaper = EV > AC;
      const key = `${EV > PV ? 'ahead' : 'behind'}${cheaper ? 'Under' : 'Over'}`;
      assert.equal(strip(right), L[key], q.name);
    }
  }
});

test('«TCPI»: la conclusión correcta es la del caso que resulta de los datos del enunciado', () => {
  const seen = new Set();
  for (const lang of ['es', 'en']) {
    const T = M.texts[lang];
    for (const q of bank[lang].questions.filter((x) => x.kind === 'tcpi')) {
      const v = (k) => num(lang, q.text.match(new RegExp(`\\b${k} = ([^<]+)<`))[1]);
      const BAC = v('BAC');
      let EV; let AC;
      if (q.level === 'hard') {
        const pct = num(lang, q.text.match(/<strong>([\d.,]+\s?%)<\/strong>/)[1]) / 100;
        EV = BAC * pct; AC = EV / v('CPI');
      } else { EV = v('EV'); AC = v('AC'); }
      const kase = AC >= BAC ? 'exhausted' : (BAC - EV) / (BAC - AC) > 1 ? 'hard' : 'easy';
      seen.add(kase);
      assert.equal(strip(q.options.find((o) => o.correct).text), T.tcpiOpt[kase], q.name);
      // El enlace abre en la herramienta un proyecto con esos BAC, EV y AC.
      const h = hashOf(q.links.module);
      const m = E.metricsAt(P.decode(h.get('c'), Number(h.get('at'))), Number(h.get('at')));
      assert.ok(Math.abs(m.BAC - BAC) < 1 && Math.abs(m.EV - EV) < 1 && Math.abs(m.AC - AC) < 1, q.name);
      assert.equal(m.tcpiCase === 'exhausted' ? 'exhausted' : m.TCPI > 1 ? 'hard' : 'easy', kase, q.name);
    }
  }
  assert.deepEqual([...seen].sort(), ['easy', 'exhausted', 'hard']);
});

test('«SPI al final»: AT ≥ PD sin terminar, SPI cerca de 1 y SPI(t) claramente menor', () => {
  for (const q of allQ().filter((x) => x.kind === 'spi-end')) {
    const h = hashOf(q.links.module);
    const at = Number(h.get('at'));
    const m = E.metricsAt(P.decode(h.get('c'), at), at);
    assert.ok(at >= m.PD && m.EV < m.BAC, q.name);
    assert.ok(m.SPI >= 0.85 && m.SPIt <= m.SPI - 0.1, `${q.name}: SPI ${m.SPI}, SPI(t) ${m.SPIt}`);
  }
});

test('Moodle XML: categorías, tipos, fracciones y CDATA bien formados', () => {
  for (const lang of ['es', 'en']) {
    const { xml, questions } = bank[lang];
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.equal((xml.match(/<question type="(cloze|multichoice)">/g) || []).length, questions.length);
    const cats = [...xml.matchAll(/<category><text>\$course\$\/top\/([^<]+)<\/text><\/category>/g)].map((x) => x[1]);
    assert.equal(cats.length, ALL.length * M.LEVELS.length, 'una categoría por tipo y nivel');
    assert.equal(new Set(cats).size, cats.length);
    for (const c of cats) assert.equal(c.split('/').length, 4, c);
    // Cada pregunta de opción múltiple: 100 en la buena y −33,3 en las otras.
    for (const block of xml.split('<question type="multichoice">').slice(1)) {
      const fr = [...block.split('</question>')[0].matchAll(/<answer fraction="([-\d.]+)"/g)].map((x) => Number(x[1]));
      assert.deepEqual(fr.slice().sort((a, b) => a - b), [-33.33333, -33.33333, -33.33333, 100]);
    }
    // Etiquetas equilibradas fuera de los CDATA.
    const outside = xml.replace(/<!\[CDATA\[.*?\]\]>/gs, '');
    for (const tag of ['quiz', 'question', 'text', 'answer', 'feedback', 'name', 'questiontext', 'generalfeedback']) {
      const open = (outside.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
      const close = (outside.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      assert.equal(open, close, `${lang}: <${tag}>`);
    }
    assert.ok(!/NaN|undefined|Infinity/.test(xml), 'sin NaN ni undefined');
  }
});

test('las semillas de las preguntas sirven para la Práctica (1..99 999) y van en el nombre', () => {
  for (const q of allQ()) {
    assert.ok(PR.normalizeSeed(q.seed) === q.seed, q.name);
    assert.ok(q.name.endsWith(`s=${q.seed}`), q.name);
  }
});

test('la nota máxima de cada pregunta coincide con la que calculará Moodle', () => {
  // En una cloze, Moodle toma como nota la suma de los pesos de las casillas ({1:NUMERICAL…}).
  const qs = bank.es.questions;
  const grades = [...bank.es.xml.matchAll(/<defaultgrade>(\d+)<\/defaultgrade>/g)].map((m) => Number(m[1]));
  assert.equal(grades.length, qs.length);
  qs.forEach((q, i) => {
    const expected = q.qtype === 'cloze' ? (q.text.match(/\{1:NUMERICAL:/g) || []).length : 1;
    assert.equal(grades[i], expected, q.name);
  });
});

test('versión del generador: en los enlaces a la Práctica, en las etiquetas y en la cabecera para regenerar', () => {
  const calc = bank.es.questions.find((q) => q.qtype === 'cloze');
  assert.equal(new URLSearchParams(calc.links.practice.split('#')[1]).get('g'), String(PR.GENERATOR));
  assert.ok(calc.tags.includes(`gen-${PR.GENERATOR}`));
  assert.match(bank.es.xml, new RegExp(`seed 4242 · generator v${PR.GENERATOR} · kinds ${ALL.join(',')} · levels easy,medium,hard · count 8`));
  assert.ok(!/<!--[\s\S]*--[\s\S]*-->/.test(bank.es.xml.split('\n')[1].replace(/^<!--|-->$/g, 'x')));
  // Con la cabecera se regenera exactamente el mismo archivo.
  const again = M.toXml(M.generate({ lang: 'es', kinds: ALL, levels: M.LEVELS, count: 8, seed: 4242 }));
  assert.equal(again, bank.es.xml);
});

test('decisiones: la opción correcta es la de la regla de la Práctica y salen los tres casos', () => {
  for (const kid of ['dec-cost', 'dec-time']) {
    const qs = bank.es.questions.filter((q) => q.kind === kid);
    assert.ok(qs.length >= 24, kid);
    const key = kid === 'dec-cost' ? 'decCost' : 'decTime';
    const cases = new Set();
    for (const q of qs) {
      const sol = PR.solution(PR.generate(q.seed, q.level));
      assert.equal(q.case, sol[key], q.name);
      assert.equal(q.options.filter((o) => o.correct).length, 1);
      cases.add(q.case);
    }
    assert.equal(cases.size, 3, kid);
  }
});
