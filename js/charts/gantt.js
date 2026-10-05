/*
 * Diagrama de Gantt: barra del plan, avance ganado en duración (d_i · %completado) dentro
 * de la barra y ejecución real hasta la fecha de control debajo.
 */
(function (root) {
  'use strict';

  function actualSpan(a, AT) {
    let first = null;
    let last = null;
    for (let t = 1; t <= Math.min(AT, a.pc.length); t++) {
      const prev = t === 1 ? 0 : a.pc[t - 2];
      if (a.pc[t - 1] > prev + 1e-9 || a.ac[t - 1] > 0) {
        if (first === null) first = t - 1;
        last = t;
      }
    }
    return first === null ? null : { from: first, to: last };
  }

  /**
   * opts: { project, AT, xMax, lang, t(key, params), fmt, ariaLabel }
   */
  function render(container, opts) {
    const d3 = root.d3;
    const { project, AT, lang, fmt, t } = opts;
    container.querySelectorAll(':scope > svg').forEach((n) => n.remove());
    const W = root.PCCharts.width(container, 1100);
    const rowH = 34;
    const acts = project.activities;
    const nameW = W < 560 ? 34 : Math.min(210, Math.max(120, W * 0.22));
    const m = { top: 18, right: 50, bottom: 28, left: nameW };
    const iw = W - m.left - m.right;
    const H = m.top + m.bottom + rowH * acts.length;
    const x = d3.scaleLinear().domain([0, opts.xMax]).range([0, iw]);

    const svg = d3.select(container).insert('svg', ':first-child')
      .attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', opts.ariaLabel);
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const ih = rowH * acts.length;

    g.append('g').attr('class', 'gridline')
      .call(d3.axisBottom(x).ticks(opts.xMax).tickSize(ih).tickFormat(''));
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(Math.min(opts.xMax, Math.floor(iw / 30))).tickFormat((v) => (Number.isInteger(v) ? v : '')).tickSizeOuter(0));

    const tip = root.PCCharts.tooltip(container);
    acts.forEach((a, i) => {
      const y0 = i * rowH;
      const row = g.append('g').attr('transform', `translate(0,${y0})`);
      row.append('text').attr('class', 'gantt-name').attr('x', -10).attr('y', 15).attr('text-anchor', 'end')
        .text(W < 560 || a.name[lang] === a.id ? a.id : `${a.id} · ${a.name[lang]}`);
      const pc = root.PCEngine.pcAt(a, AT);
      row.append('rect').attr('class', 'gantt-plan').attr('x', x(a.start)).attr('y', 5)
        .attr('width', x(a.start + a.duration) - x(a.start)).attr('height', 14).attr('rx', 3);
      if (pc > 0 && !opts.planOnly) {
        row.append('rect').attr('class', 'gantt-done').attr('x', x(a.start)).attr('y', 5)
          .attr('width', Math.max(2, x(a.start + a.duration * pc) - x(a.start))).attr('height', 14).attr('rx', 3);
      }
      const span = opts.planOnly ? null : actualSpan(a, AT);
      if (span) {
        row.append('rect').attr('x', x(span.from)).attr('y', 23).attr('width', Math.max(2, x(span.to) - x(span.from)))
          .attr('height', 4).attr('rx', 2).style('fill', 'var(--ink)').style('opacity', 0.7);
      }
      row.append('text').attr('class', 'gantt-pct').attr('x', x(a.start + a.duration) + 6).attr('y', 16)
        .text(fmt.pct(lang, pc));
      // En la práctica el tooltip no da EV ni ED: son respuestas del ejercicio.
      const rows = () => [
        { label: t('plannedWeeks', { a: a.start + 1, b: a.start + a.duration }), value: '' },
        { label: t('budget'), value: fmt.money(lang, a.budget) },
        { label: t('complete'), value: fmt.pctSmart(lang, pc) },
        ...(opts.planOnly ? [] : [
          { label: 'EV', value: fmt.money(lang, a.budget * pc), color: 'var(--c-evm)' },
          { label: 'ED', value: fmt.num(lang, a.duration * pc, 2), color: 'var(--c-edm)' },
        ]),
      ];
      row.append('rect').attr('class', 'hit').attr('x', -m.left).attr('y', 0).attr('width', W).attr('height', rowH)
        .attr('tabindex', 0)
        .attr('aria-label', `${a.id} ${a.name[lang]}: ${fmt.pct(lang, pc)}`)
        .on('pointermove focus', () => tip.show(Math.min(m.left + x(a.start + a.duration) + 40, W - 170), m.top + y0, `${a.id} · ${a.name[lang]}`, rows()))
        .on('pointerleave blur', () => tip.hide());
    });

    g.append('line').attr('class', 'at-line').attr('x1', x(AT)).attr('x2', x(AT)).attr('y1', -6).attr('y2', ih);
    g.append('text').attr('class', 'at-label').attr('x', x(AT)).attr('y', -8).attr('text-anchor', 'middle').text(`AT = ${AT}`);
    const PD = root.PCEngine.plannedDuration(project);
    if (PD !== AT) {
      g.append('line').attr('class', 'ref').attr('x1', x(PD)).attr('x2', x(PD)).attr('y1', 0).attr('y2', ih);
      g.append('text').attr('class', 'ref-label').attr('x', x(PD) + 3).attr('y', ih - 4).text('PD');
    }
  }

  root.PCGantt = { render, actualSpan };
})(this);
