/*
 * Gráfica de líneas genérica con D3: varias series sobre un eje x de periodos, líneas de
 * referencia, línea de la fecha de control, proyección horizontal (ES, ED(t)) y crosshair
 * con tooltip que muestra todas las series en el periodo más cercano.
 */
(function (root) {
  'use strict';

  /**
   * opts: {
   *   height, xMax, yMin, yMax, yTicks, yFormat(v), xLabel(t), ariaLabel,
   *   series: [{ key, label, color, points: [{x, y}], width?: number, endLabel?: string }],
   *     (las series se dibujan en orden; cuando dos pueden coincidir, la primera va más ancha
   *      para que se vea debajo de la segunda)
   *   refY: [{ y, label }], refX: [{ x, label }], at: { x, label },
   *   projection: { color, x0, y, x1, label },
   *   extra: [{ points, color, width, dash }], brackets: [{ x, y0, y1, label, color, dx }],
   *   points: [{ x, y, color, label, anchor, dx, dy }], zones: [{ y0, y1, cls }],
   *   tooltip: { title(x), rows(x) -> [{ color, label, value }] }, xHoverMax
   * }
   */
  function render(container, opts) {
    const d3 = root.d3;
    container.querySelectorAll(':scope > svg').forEach((n) => n.remove());
    const W = root.PCCharts.width(container);
    const H = opts.height || 300;
    const m = { top: 14, right: 58, bottom: opts.xAxisTitle ? 42 : 30, left: 56 };
    const iw = W - m.left - m.right;
    const ih = H - m.top - m.bottom;

    const x = d3.scaleLinear().domain([0, opts.xMax]).range([0, iw]);
    const y = d3.scaleLinear().domain([opts.yMin || 0, opts.yMax]).range([ih, 0]).nice(opts.yTicks || 5);

    const svg = d3.select(container).insert('svg', ':first-child')
      .attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', opts.ariaLabel || '');
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

    // Bandas de estado (semáforo) detrás de todo
    for (const z of opts.zones || []) {
      const y0 = Math.max(z.y0, y.domain()[0]); const y1 = Math.min(z.y1, y.domain()[1]);
      if (y1 <= y0) continue;
      g.append('rect').attr('class', `zone ${z.cls}`).attr('x', 0).attr('width', iw).attr('y', y(y1)).attr('height', y(y0) - y(y1));
    }

    // Rejilla y ejes (recesivos)
    g.append('g').attr('class', 'gridline')
      .call(d3.axisLeft(y).ticks(opts.yTicks || 5).tickSize(-iw).tickFormat(''));
    const xTicks = Math.min(opts.xMax, Math.max(2, Math.floor(iw / 38)));
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(xTicks).tickFormat((v) => (Number.isInteger(v) ? v : '')).tickSizeOuter(0));
    g.append('g').attr('class', 'axis')
      .call(d3.axisLeft(y).ticks(opts.yTicks || 5).tickFormat(opts.yFormat).tickSizeOuter(0));
    if (opts.xAxisTitle) {
      g.append('text').attr('x', iw).attr('y', ih + 38).attr('text-anchor', 'end').text(opts.xAxisTitle);
    }

    // Referencias
    for (const r of opts.refY || []) {
      g.append('line').attr('class', 'ref').attr('x1', 0).attr('x2', iw).attr('y1', y(r.y)).attr('y2', y(r.y));
      g.append('text').attr('class', 'ref-label').attr('x', iw + 4).attr('y', y(r.y) + 4).text(r.label);
    }
    for (const r of opts.refX || []) {
      g.append('line').attr('class', 'ref').attr('x1', x(r.x)).attr('x2', x(r.x)).attr('y1', 0).attr('y2', ih);
      g.append('text').attr('class', 'ref-label').attr('x', x(r.x) + 4).attr('y', 10).text(r.label);
    }

    // Series
    const line = d3.line().defined((p) => p.y !== null && Number.isFinite(p.y)).x((p) => x(p.x)).y((p) => y(p.y));
    for (const s of opts.series) {
      g.append('path').attr('class', 'line').attr('d', line(s.points))
        .style('stroke', s.color).style('stroke-width', s.width || 2);
    }

    // Trazos extra (previsiones), corchetes de variación y puntos marcados
    for (const e of opts.extra || []) {
      g.append('path').attr('class', 'line').attr('d', line(e.points))
        .style('stroke', e.color).style('stroke-width', e.width || 1.5).style('stroke-dasharray', e.dash || null);
    }
    for (const b of opts.hbrackets || []) {
      const by = y(b.y) - (b.dy || 12);
      const x0 = x(b.x0); const x1 = x(b.x1);
      g.append('path').attr('class', 'bracket').attr('d', `M${x0},${by + 4} V${by} H${x1} V${by + 4}`).style('stroke', b.color || 'var(--ink)');
      g.append('text').attr('class', 'bracket-label').attr('x', (x0 + x1) / 2).attr('y', by - 5).attr('text-anchor', 'middle').text(b.label);
    }
    for (const b of opts.brackets || []) {
      const bx = x(b.x) + (b.dx || 10);
      const y0 = y(b.y0); const y1 = y(b.y1);
      g.append('path').attr('class', 'bracket').attr('d', `M${bx - 4},${y0} H${bx} V${y1} H${bx - 4}`).style('stroke', b.color || 'var(--ink)');
      g.append('text').attr('class', 'bracket-label').attr('x', bx + 5).attr('y', (y0 + y1) / 2 + 4).text(b.label);
    }

    // Fecha de control
    if (opts.at) {
      g.append('line').attr('class', 'at-line').attr('x1', x(opts.at.x)).attr('x2', x(opts.at.x)).attr('y1', 0).attr('y2', ih);
      g.append('text').attr('class', 'at-label').attr('x', x(opts.at.x)).attr('y', -3).attr('text-anchor', 'middle').text(opts.at.label);
    }

    // Proyección horizontal (EV → PV da ES; TED → TPD da ED(t))
    const p = opts.projection;
    if (p) {
      g.append('path').attr('class', 'proj')
        .attr('d', `M${x(p.x0)},${y(p.y)} H${x(p.x1)} V${ih}`)
        .style('stroke', p.color);
      g.append('circle').attr('class', 'dot').attr('r', 4.5).attr('cx', x(p.x1)).attr('cy', y(p.y)).style('fill', p.color);
      const lx = x(p.x1);
      g.append('text').attr('class', 'proj-label').attr('x', lx + 5).attr('y', ih - 6)
        .attr('text-anchor', lx > iw - 70 ? 'end' : 'start')
        .attr('dx', lx > iw - 70 ? -10 : 0).text(p.label);
    }

    // Puntos finales y etiquetas directas (solo si no chocan)
    const ends = [];
    for (const s of opts.series) {
      const pts = s.points.filter((q) => q.y !== null && Number.isFinite(q.y));
      if (!pts.length) continue;
      const last = pts[pts.length - 1];
      g.append('circle').attr('class', 'dot').attr('r', 4).attr('cx', x(last.x)).attr('cy', y(last.y)).style('fill', s.color);
      if (s.endLabel) ends.push({ x: x(last.x), y: y(last.y), text: s.endLabel });
    }
    ends.sort((a, b) => a.y - b.y);
    const placed = [];
    for (const e of ends) {
      if (placed.some((q) => Math.abs(q.y - e.y) < 14 && Math.abs(q.x - e.x) < 60)) continue;
      placed.push(e);
      g.append('text').attr('class', 'end-label').attr('x', e.x + 8).attr('y', e.y + 4).text(e.text);
    }

    const labeled = [];
    for (const pt of opts.points || []) {
      g.append('circle').attr('class', 'dot').attr('r', 5).attr('cx', x(pt.x)).attr('cy', y(pt.y)).style('fill', pt.color);
      // Etiqueta solo si no choca con otra ya puesta; el valor sigue en el texto y la tabla.
      const py = y(pt.y);
      if (pt.label && !labeled.some((q) => Math.abs(q.y - py) < 13 && Math.abs(q.x - x(pt.x)) < 50)) {
        labeled.push({ x: x(pt.x), y: py });
        g.append('text').attr('class', 'end-label').attr('x', x(pt.x) + (pt.dx === undefined ? -8 : pt.dx))
          .attr('y', y(pt.y) + (pt.dy || 4)).attr('text-anchor', pt.anchor || 'end').text(pt.label);
      }
    }

    // Crosshair y tooltip
    if (opts.tooltip) {
      const tip = root.PCCharts.tooltip(container);
      const cross = g.append('line').attr('class', 'crosshair').attr('y1', 0).attr('y2', ih).style('display', 'none');
      const maxX = opts.xHoverMax !== undefined ? opts.xHoverMax : opts.xMax;
      const minX = opts.xHoverMin !== undefined ? opts.xHoverMin : 0;
      const showAt = (xv) => {
        cross.style('display', null).attr('x1', x(xv)).attr('x2', x(xv));
        tip.show(m.left + x(xv), m.top + 10, opts.tooltip.title(xv), opts.tooltip.rows(xv));
      };
      const overlay = g.append('rect').attr('class', 'hit').attr('width', iw).attr('height', ih)
        .attr('tabindex', 0).attr('aria-label', opts.ariaLabel || '');
      let kx = null;
      overlay.on('pointermove', (ev) => {
        const [px] = d3.pointer(ev);
        const xv = Math.max(minX, Math.min(maxX, Math.round(x.invert(px))));
        kx = xv;
        showAt(xv);
      }).on('pointerleave blur', () => { cross.style('display', 'none'); tip.hide(); })
        .on('focus', () => { kx = opts.at ? opts.at.x : minX; showAt(kx); })
        .on('keydown', (ev) => {
          if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
          ev.preventDefault();
          kx = Math.max(minX, Math.min(maxX, (kx === null ? minX : kx) + (ev.key === 'ArrowRight' ? 1 : -1)));
          showAt(kx);
        });
    }
  }

  root.PCLines = { render };
})(this);
