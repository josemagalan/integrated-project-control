/*
 * Modelo del proyecto que se edita en la herramienta.
 *
 * Dos orígenes:
 *  - 'example': un ejemplo con historial semanal completo; la fecha de control lee el historial.
 *  - 'custom':  un proyecto propio con una sola foto en la fecha de control: % completado y coste
 *               real acumulado por actividad. Basta para calcular todos los indicadores en AT.
 * Editar cualquier dato de un ejemplo lo convierte en proyecto propio con la foto de esa fecha.
 *
 * El proyecto se guarda en formato del motor (pc/ac por periodo). En un proyecto propio los arrays
 * tienen longitud AT y solo el último valor tiene sentido; historyKnown = false lo indica.
 */
(function (root) {
  'use strict';

  const Engine = root.PCEngine || require('./engine.js');
  const Examples = root.PCExamples || require('./examples.js');

  const UNITS = ['day', 'week', 'month'];
  const MAX_ACTIVITIES = 12;
  const MAX_DURATION = 30;
  const MAX_START = 40;
  const MAX_MONEY = 1e12; // tope de presupuesto y coste por actividad: evita Infinity y cifras absurdas

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function round(x, d) { const f = 10 ** d; return Math.round(x * f) / f; }

  function fromExample(id) {
    const ex = Examples.byId(id) || Examples.examples[0];
    return {
      source: 'example', exampleId: ex.id, name: clone(ex.name), unit: ex.periodUnit || 'week',
      currency: ex.currency || 'EUR', historyKnown: true, activities: clone(ex.activities),
    };
  }

  /** Último periodo con datos (historial) o fecha de la foto (propio). */
  function lastPeriod(p) { return Engine.reportedPeriods(p); }

  /** Rango permitido de la fecha de control. */
  function atRange(p) {
    if (p.historyKnown) return { min: 1, max: lastPeriod(p) };
    const PD = Engine.plannedDuration(p);
    return { min: 1, max: Math.max(PD + Math.ceil(PD / 2), lastPeriod(p)) };
  }

  /** Foto en AT: [{ id, pc, ac }] con ac acumulado. */
  function snapshot(p, AT) {
    return p.activities.map((a) => ({
      id: a.id,
      pc: Engine.pcAt(a, AT),
      ac: a.ac.slice(0, Math.min(AT, a.ac.length)).reduce((s, c) => s + c, 0),
    }));
  }

  function arraysFor(AT, pc, acCum) {
    const pcs = new Array(AT).fill(0);
    const acs = new Array(AT).fill(0);
    pcs[AT - 1] = pc;
    acs[AT - 1] = acCum;
    return { pc: pcs, ac: acs };
  }

  /** Proyecto propio con la foto en AT (desde un ejemplo o desde otro propio). */
  function toCustom(p, AT) {
    const snap = snapshot(p, AT);
    const q = {
      source: 'custom', exampleId: p.exampleId || null, name: clone(p.name), unit: p.unit,
      currency: p.currency, historyKnown: false, activities: [],
    };
    q.activities = p.activities.map((a, i) => {
      const { pc, ac } = arraysFor(AT, snap[i].pc, round(snap[i].ac, 2));
      return { id: a.id, name: clone(a.name), start: a.start, duration: a.duration, budget: a.budget, pc, ac };
    });
    return q;
  }

  /** Cambia la fecha de control. En un proyecto propio la foto se conserva. */
  function withAT(p, AT) {
    if (p.historyKnown) return p;
    const q = toCustom(p, lastPeriod(p));
    q.activities.forEach((a) => {
      const pc = a.pc[a.pc.length - 1];
      const ac = a.ac[a.ac.length - 1];
      Object.assign(a, arraysFor(AT, pc, ac));
    });
    return q;
  }

  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  /** Número finito acotado a [lo, hi]; si no es un número finito, `dflt`. */
  const clampNum = (v, lo, hi, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
  };

  /**
   * Edita una actividad. changes: { start, duration, budget, pc, ac, name }.
   * Devuelve un proyecto propio nuevo con la foto en AT.
   */
  function edit(p, AT, id, changes) {
    const q = p.historyKnown ? toCustom(p, AT) : withAT(p, AT);
    const a = q.activities.find((x) => x.id === id);
    if (!a) return q;
    if ('start' in changes) a.start = clampInt(changes.start, 0, MAX_START);
    if ('duration' in changes) a.duration = clampInt(changes.duration, 1, MAX_DURATION);
    if ('budget' in changes) a.budget = Math.max(1, round(clampNum(changes.budget, 1, MAX_MONEY, 1), 2));
    if ('name' in changes) {
      const n = String(changes.name).slice(0, 60);
      a.name = { es: n, en: n };
    }
    if ('pc' in changes) a.pc[AT - 1] = round(clampNum(changes.pc, 0, 1, 0), 4);
    if ('ac' in changes) a.ac[AT - 1] = round(clampNum(changes.ac, 0, MAX_MONEY, 0), 2);
    return q;
  }

  function nextId(p) {
    for (let i = 0; i < 26; i++) {
      const id = String.fromCharCode(65 + i);
      if (!p.activities.some((a) => a.id === id)) return id;
    }
    return null;
  }

  function addActivity(p, AT, name) {
    if (p.activities.length >= MAX_ACTIVITIES) return p;
    const q = p.historyKnown ? toCustom(p, AT) : withAT(p, AT);
    const id = nextId(q);
    const start = Math.max(0, ...q.activities.map((a) => a.start + a.duration)) - 1;
    const n = name || id;
    q.activities.push({ id, name: { es: n, en: n }, start: Math.max(0, start), duration: 2, budget: 1000, ...arraysFor(AT, 0, 0) });
    return q;
  }

  function removeActivity(p, AT, id) {
    if (p.activities.length <= 1) return p;
    const q = p.historyKnown ? toCustom(p, AT) : withAT(p, AT);
    q.activities = q.activities.filter((a) => a.id !== id);
    return q;
  }

  function setUnit(p, AT, unit) {
    if (!UNITS.includes(unit)) return p;
    const q = p.historyKnown ? clone(p) : withAT(p, AT);
    q.unit = unit;
    return q;
  }

  function blank(AT = 1, unit = 'week') {
    const acts = [
      { id: 'A', name: 'A', start: 0, duration: 3, budget: 3000 },
      { id: 'B', name: 'B', start: 2, duration: 4, budget: 6000 },
      { id: 'C', name: 'C', start: 5, duration: 3, budget: 3000 },
    ];
    return {
      source: 'custom', exampleId: null, name: { es: 'Proyecto propio', en: 'My project' }, unit, currency: 'EUR',
      historyKnown: false,
      activities: acts.map((a) => ({ ...a, name: { es: a.name, en: a.name }, ...arraysFor(AT, 0, 0) })),
    };
  }

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Proyecto aleatorio reproducible: plan de 4 a 7 actividades encadenadas con solapes y una foto
   * plausible en AT (avance alrededor del plan, con desviaciones de plazo y coste).
   */
  function random(seed, unit = 'week') {
    const r = mulberry32(seed);
    const n = 4 + Math.floor(r() * 4);
    const acts = [];
    let cursor = 0;
    for (let i = 0; i < n; i++) {
      const duration = 1 + Math.floor(r() * 5);
      const start = Math.max(0, cursor - Math.floor(r() * 2));
      const budget = Math.round((500 + r() * 9500) / 100) * 100;
      acts.push({ id: String.fromCharCode(65 + i), start, duration, budget });
      cursor = Math.max(cursor, start + duration - Math.floor(r() * duration * 0.6));
    }
    const PD = Math.max(...acts.map((a) => a.start + a.duration));
    const AT = Math.max(1, Math.round(PD * (0.35 + r() * 0.4)));
    const speed = 0.7 + r() * 0.5; // < 1 retrasado
    const costF = 0.85 + r() * 0.35; // > 1 sobrecoste
    const p = {
      source: 'custom', exampleId: null, seed, name: { es: `Aleatorio ${seed}`, en: `Random ${seed}` }, unit, currency: 'EUR',
      historyKnown: false, activities: [],
    };
    p.activities = acts.map((a) => {
      const planned = Engine.plannedPeriodsElapsed(a, AT) / a.duration;
      const pc = planned === 0 ? (r() < 0.2 ? round(0.1 + r() * 0.2, 2) : 0) : Math.min(1, round(planned * speed * (0.85 + r() * 0.3), 2));
      const ac = Math.round(a.budget * pc * costF * (0.9 + r() * 0.2));
      return { ...a, name: { es: a.id, en: a.id }, ...arraysFor(AT, pc, ac) };
    });
    return { project: p, AT };
  }

  // ---- URL -------------------------------------------------------------------

  /** Codifica un proyecto propio: unidad|nombre|A,nombre,inicio,duración,presupuesto,%,AC;B,... */
  function encode(p, AT) {
    const q = withAT(p, AT);
    const acts = q.activities.map((a) => [
      a.id, encodeURIComponent(a.name.es), a.start, a.duration, a.budget,
      round(a.pc[AT - 1] * 100, 2), a.ac[AT - 1],
    ].join(','));
    return [q.unit, encodeURIComponent(q.name.es), acts.join(';')].join('|');
  }

  function decode(s, AT) {
    try {
      const [unit, name, actsStr] = String(s).split('|');
      if (!UNITS.includes(unit) || !actsStr) return null;
      const acts = actsStr.split(';').slice(0, MAX_ACTIVITIES).map((row) => {
        const [id, nm, start, duration, budget, pct, ac] = row.split(',');
        const n = decodeURIComponent(nm || id);
        return {
          id: String(id).slice(0, 3), name: { es: n, en: n },
          start: clampInt(start, 0, MAX_START), duration: clampInt(duration, 1, MAX_DURATION),
          budget: clampNum(budget, 1, MAX_MONEY, 1),
          ...arraysFor(AT, clampNum(Number(pct) / 100, 0, 1, 0), clampNum(ac, 0, MAX_MONEY, 0)),
        };
      });
      const nm = decodeURIComponent(name || '');
      const p = { source: 'custom', exampleId: null, name: { es: nm, en: nm }, unit, currency: 'EUR', historyKnown: false, activities: acts };
      return Engine.validateProject(p).length ? null : p;
    } catch (e) {
      return null;
    }
  }

  const api = {
    UNITS, MAX_ACTIVITIES, MAX_MONEY, fromExample, atRange, snapshot, toCustom, withAT, edit, addActivity, removeActivity,
    setUnit, blank, random, encode, decode, lastPeriod,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCProject = api;
})(this);
