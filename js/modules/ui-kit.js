/*
 * Piezas de interfaz comunes a los módulos: tarjeta de paso, párrafos, fórmulas, cifras y avisos.
 * Todo el texto entra con textContent.
 */
(function (root) {
  'use strict';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  /** Tarjeta numerada de un paso. */
  function step(n, title, children) {
    const card = el('section', 'card step-card');
    const h = el('h2', 'step-title');
    h.append(el('span', 'n', String(n)), document.createTextNode(title));
    card.append(h);
    for (const c of children) if (c) card.append(c);
    return card;
  }

  const p = (text, cls) => el('p', cls || 'step-p', text);
  const formula = (text) => el('code', 'formula', text);
  const formulas = (...lines) => {
    const d = el('div', 'formulas');
    for (const l of lines) if (l) d.append(formula(l));
    return d;
  };

  /** Fila de cifras: [{ label, value, note }]. */
  function figures(items) {
    const d = el('div', 'figures');
    for (const it of items) {
      const f = el('div', 'figure');
      f.append(el('div', 'f-label', it.label), el('div', 'f-value', it.value));
      if (it.note) f.append(el('div', 'f-note', it.note));
      if (it.color) f.style.borderTopColor = it.color;
      d.append(f);
    }
    return d;
  }

  /** Lista de puntos. */
  function list(items) {
    const u = el('ul', 'step-list');
    for (const it of items) if (it) u.append(el('li', null, it));
    return u;
  }

  /** Caja lateral destacada. */
  function aside(title, children) {
    const d = el('div', 'aside');
    if (title) d.append(el('h3', null, title));
    for (const c of children) if (c) d.append(c);
    return d;
  }

  /** Semáforo de estado: icono + texto, nunca solo color. levels: [{ key, label, rule }]. */
  function trafficLight(levels, activeKey) {
    const d = el('div', 'traffic');
    const icons = { ok: '✓', check: '!', alert: '✕' };
    for (const lv of levels) {
      const s = el('span', `tl tl-${lv.key}${lv.key === activeKey ? ' active' : ''}`);
      s.append(el('b', null, `${icons[lv.key]} ${lv.label}`), el('small', null, lv.rule));
      if (lv.key === activeKey) s.setAttribute('aria-current', 'true');
      d.append(s);
    }
    return d;
  }

  function chartBox(cls) {
    const d = el('div', `chart ${cls || ''}`);
    return d;
  }

  root.PCKit = { el, step, p, formula, formulas, figures, list, aside, trafficLight, chartBox };
})(this);
