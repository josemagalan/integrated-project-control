/*
 * Formato de números según el idioma: coma decimal en español, punto en inglés.
 */
(function (root) {
  'use strict';

  const locales = { es: 'es-ES', en: 'en-GB' };
  const cache = new Map();

  function nf(lang, opts) {
    const key = lang + JSON.stringify(opts);
    if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(locales[lang] || 'es-ES', { useGrouping: 'always', ...opts }));
    return cache.get(key);
  }

  function num(lang, x, digits = 2) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    const v = Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x; // evita «−0,00»
    return nf(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  }

  function money(lang, x, currency = 'EUR') {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    const v = Math.abs(x) < 0.5 ? 0 : x;
    return nf(lang, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  }

  function pct(lang, x, digits = 0) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    return nf(lang, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
  }

  /** Porcentaje sin decimales si es entero y con uno si no (57,1 %). */
  function pctSmart(lang, x) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    return pct(lang, x, Math.abs(x * 100 - Math.round(x * 100)) < 1e-6 ? 0 : 1);
  }

  /** Valor compacto para ejes: 30 000 → «30 k». */
  function compact(lang, x) {
    return nf(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(x);
  }

  const api = { num, money, pct, pctSmart, compact };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCFormat = api;
})(this);
