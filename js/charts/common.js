/*
 * Piezas comunes de las gráficas: leyenda, tooltip y medida del contenedor.
 * Los textos se insertan siempre con textContent.
 */
(function (root) {
  'use strict';

  function legend(ul, items) {
    ul.textContent = '';
    for (const it of items) {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = it.box ? 'swatch-box' : 'swatch-line';
      sw.style.background = it.color;
      if (it.outline) sw.style.border = `1px solid ${it.outline}`;
      li.appendChild(sw);
      li.appendChild(document.createTextNode(it.label));
      ul.appendChild(li);
    }
  }

  /** Tooltip absoluto dentro del contenedor de la gráfica. */
  function tooltip(container) {
    let el = container.querySelector(':scope > .tooltip');
    if (!el) {
      el = document.createElement('div');
      el.className = 'tooltip';
      el.hidden = true;
      el.setAttribute('role', 'status');
      container.appendChild(el);
    }
    return {
      show(x, y, title, rows) {
        el.textContent = '';
        const h = document.createElement('div');
        h.className = 'tt-title';
        h.textContent = title;
        el.appendChild(h);
        for (const r of rows) {
          const row = document.createElement('div');
          row.className = 'tt-row';
          const key = document.createElement('span');
          key.className = 'tt-key';
          if (r.color) {
            const i = document.createElement('i');
            i.style.background = r.color;
            key.appendChild(i);
          }
          key.appendChild(document.createTextNode(r.label));
          const v = document.createElement('strong');
          v.textContent = r.value;
          row.appendChild(key);
          row.appendChild(v);
          el.appendChild(row);
        }
        el.hidden = false;
        const cw = container.clientWidth;
        const w = el.offsetWidth;
        const left = x + 14 + w > cw ? Math.max(0, x - 14 - w) : x + 14;
        el.style.left = `${left}px`;
        el.style.top = `${Math.max(0, y - 10)}px`;
      },
      hide() { el.hidden = true; },
    };
  }

  function width(container, fallback = 560) {
    return Math.max(280, Math.floor(container.clientWidth || fallback));
  }

  /*
   * Semáforo de seguimiento para índices de rendimiento (CPI, SPI, SPI(t), DPI, EDI):
   *   satisfactorio ≥ 1 · marginal 0,90–1 · no satisfactorio < 0,90.
   * Los colores de estado son fijos y siempre van con icono y texto.
   */
  const STATUS = { warn: 0.9, good: 1 };
  function statusOf(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    if (v >= STATUS.good - 0.005) return 'good';
    return v >= STATUS.warn ? 'warn' : 'crit';
  }
  /** Bandas horizontales para una gráfica de índices. */
  function statusZones(yMin, yMax) {
    return [
      { y0: yMin, y1: STATUS.warn, cls: 'zone-crit' },
      { y0: STATUS.warn, y1: STATUS.good, cls: 'zone-warn' },
      { y0: STATUS.good, y1: yMax, cls: 'zone-good' },
    ].filter((z) => z.y1 > z.y0);
  }
  /** Leyenda del semáforo: icono + texto + regla. */
  function statusLegend(ul, t) {
    ul.textContent = '';
    ul.className = 'legend status-legend';
    for (const [k, icon] of [['good', '✓'], ['warn', '!'], ['crit', '✕']]) {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = `swatch-box zone-key-${k}`;
      li.append(sw, document.createTextNode(`${icon} ${t(`st_${k}`)} (${t(`st_${k}_rule`)})`));
      ul.append(li);
    }
  }

  const api = { legend, tooltip, width, STATUS, statusOf, statusZones, statusLegend };
  root.PCCharts = api;
})(this);
