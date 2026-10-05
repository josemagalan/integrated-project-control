/*
 * Editor del proyecto compartido por los módulos: barra de herramientas, Gantt editable con
 * arrastre (inicio, duración, % completado, fecha de control) y tabla de corte editable.
 *
 * ctx: {
 *   t(key, params), lang(), get() -> { project, AT }, set({ project?, AT? }), link() -> string
 * }
 */
(function (root) {
  'use strict';

  const E = root.PCEngine;
  const P = root.PCProject;
  const X = root.PCExamples;
  const F = root.PCFormat;
  const I = root.PCI18n;

  function el(tag, attrs, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return n;
  }

  function create(rootEl, ctx) {
    const t = ctx.t;
    let tableKey = null;

    rootEl.textContent = '';
    const head = el('div', { class: 'ed-head' },
      el('h2', { 'data-k': 'edTitle' }),
      el('p', { class: 'sub', 'data-k': 'edSub' }));
    const sel = el('select', { id: 'edProject' });
    const unitSel = el('select', { id: 'edUnit' });
    const blankBtn = el('button', { type: 'button', class: 'btn', 'data-k': 'edBlank' });
    const randBtn = el('button', { type: 'button', class: 'btn', 'data-k': 'edRandom' });
    const copyBtn = el('button', { type: 'button', class: 'btn', 'data-k': 'edCopy' });
    const range = el('input', { type: 'range', id: 'edAT', min: 1, max: 10, step: 1 });
    const prev = el('button', { type: 'button', class: 'btn', text: '←' });
    const next = el('button', { type: 'button', class: 'btn', text: '→' });
    const atOut = el('output', { for: 'edAT' });
    const toolbar = el('div', { class: 'controls ed-toolbar' },
      el('div', { class: 'field' }, el('label', { for: 'edProject', 'data-k': 'edProject' }), sel),
      el('div', { class: 'field' }, el('label', { for: 'edUnit', 'data-k': 'edUnit' }), unitSel),
      el('div', { class: 'field ed-buttons' }, el('span', { class: 'label', text: ' ' }), el('div', { class: 'btn-row' }, blankBtn, randBtn, copyBtn)),
      el('div', { class: 'field at-field' }, el('label', { for: 'edAT', 'data-k': 'statusDate' }),
        el('div', { class: 'at-row' }, prev, range, next, atOut)));
    const note = el('p', { class: 'ed-note' });
    const legend = el('ul', { class: 'legend' });
    const chart = el('div', { class: 'chart ed-gantt' });
    const tableWrap = el('div', { class: 'table-wrap ed-table' });
    rootEl.append(head, toolbar, note, legend, chart, tableWrap);

    // ---- Eventos de la barra ----------------------------------------------------
    sel.addEventListener('change', () => {
      if (sel.value === '__custom') return;
      const p = P.fromExample(sel.value);
      ctx.set({ project: p, AT: Math.max(1, Math.round(E.plannedDuration(p) * 0.6)) });
    });
    unitSel.addEventListener('change', () => {
      const { project, AT } = ctx.get();
      ctx.set({ project: P.setUnit(project, AT, unitSel.value) });
    });
    blankBtn.addEventListener('click', () => {
      const { project } = ctx.get();
      ctx.set({ project: P.blank(1, project.unit), AT: 1 });
    });
    randBtn.addEventListener('click', () => {
      const seed = 1 + Math.floor(Math.random() * 9999);
      const { project } = ctx.get();
      const r = P.random(seed, project.unit);
      ctx.set({ project: r.project, AT: r.AT });
    });
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(ctx.link()); } catch (e) { /* sin portapapeles */ }
      copyBtn.textContent = t('edCopied');
      setTimeout(() => { copyBtn.textContent = t('edCopy'); }, 1500);
    });
    const setAT = (v) => {
      const { project } = ctx.get();
      const r = P.atRange(project);
      ctx.set({ AT: Math.max(r.min, Math.min(r.max, v)) });
    };
    range.addEventListener('input', () => setAT(parseInt(range.value, 10)));
    prev.addEventListener('click', () => setAT(ctx.get().AT - 1));
    next.addEventListener('click', () => setAT(ctx.get().AT + 1));

    // ---- Gantt editable -------------------------------------------------------
    function renderGantt(project, AT, lang) {
      const d3 = root.d3;
      chart.querySelectorAll(':scope > svg').forEach((n) => n.remove());
      const W = root.PCCharts.width(chart, 1100);
      const acts = project.activities;
      const rowH = 40;
      const narrow = W < 560;
      const nameW = narrow ? 34 : Math.min(200, Math.max(120, W * 0.2));
      const m = { top: 34, right: 56, bottom: 28, left: nameW };
      const iw = W - m.left - m.right;
      const ih = rowH * acts.length;
      const H = m.top + m.bottom + ih;
      const PD = E.plannedDuration(project);
      const xMax = Math.max(PD, AT, P.atRange(project).max) + 1;
      const x = d3.scaleLinear().domain([0, xMax]).range([0, iw]);
      const unitW = x(1) - x(0);
      const snapX = (px) => Math.round(x.invert(px));

      const svg = d3.select(chart).insert('svg', ':first-child')
        .attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'group').attr('aria-label', t('ganttTitle'));
      const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
      g.append('g').attr('class', 'gridline').call(d3.axisBottom(x).ticks(xMax).tickSize(ih).tickFormat(''));
      g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
        .call(d3.axisBottom(x).ticks(Math.min(xMax, Math.floor(iw / 28))).tickFormat((v) => (Number.isInteger(v) ? v : '')).tickSizeOuter(0));

      const commit = (id, changes) => {
        const cur = ctx.get();
        ctx.set({ project: P.edit(cur.project, cur.AT, id, changes) });
      };
      const arrows = (fn) => (ev) => {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        ev.preventDefault();
        fn(ev.key === 'ArrowRight' ? 1 : -1);
      };

      acts.forEach((a, i) => {
        const y0 = i * rowH;
        const row = g.append('g').attr('class', 'ed-row').attr('transform', `translate(0,${y0})`);
        row.append('text').attr('class', 'gantt-name').attr('x', -10).attr('y', 18).attr('text-anchor', 'end')
          .text(narrow || (a.name[lang] || a.name.es) === a.id ? a.id : `${a.id} · ${a.name[lang] || a.name.es}`);
        const pc = E.pcAt(a, AT);
        const plan = row.append('rect').attr('class', 'gantt-plan ed-drag').attr('y', 7).attr('height', 16).attr('rx', 3);
        const done = row.append('rect').attr('class', 'gantt-done').attr('y', 7).attr('height', 16).attr('rx', 3).style('pointer-events', 'none');
        const grip = row.append('rect').attr('class', 'ed-grip').attr('y', 4).attr('height', 22).attr('width', 12).attr('rx', 3);
        const knob = row.append('circle').attr('class', 'ed-knob').attr('r', 7).attr('cy', 30);
        const label = row.append('text').attr('class', 'gantt-pct').attr('y', 19);

        let s = a.start; let d = a.duration; let p = pc;
        const draw = () => {
          const x0 = x(s); const x1 = x(s + d);
          plan.attr('x', x0).attr('width', Math.max(2, x1 - x0));
          done.attr('x', x0).attr('width', p > 0 ? Math.max(2, (x1 - x0) * p) : 0);
          grip.attr('x', x1 - 7);
          knob.attr('cx', x0 + (x1 - x0) * p);
          label.attr('x', x1 + 8).text(F.pct(lang, p));
        };
        draw();

        if (project.historyKnown) {
          const span = root.PCGantt.actualSpan(a, AT);
          if (span) {
            row.append('rect').attr('x', x(span.from)).attr('y', 36).attr('width', Math.max(2, x(span.to) - x(span.from)))
              .attr('height', 3).attr('rx', 1.5).style('fill', 'var(--ink)').style('opacity', 0.55).style('pointer-events', 'none');
          }
        }

        // Arrastrar la barra: inicio
        plan.attr('tabindex', 0).attr('aria-label', t('dragStart', { id: a.id }))
          .call(d3.drag().on('start', (ev) => { plan.node().__x0 = ev.x; })
            .on('drag', (ev) => { s = Math.max(0, a.start + Math.round((ev.x - plan.node().__x0) / unitW)); draw(); })
            .on('end', () => { if (s !== a.start) commit(a.id, { start: s }); }))
          .on('keydown', arrows((k) => commit(a.id, { start: Math.max(0, a.start + k) })));
        // Arrastrar el extremo: duración
        grip.attr('tabindex', 0).attr('aria-label', t('dragDuration', { id: a.id }))
          .call(d3.drag().on('drag', (ev) => { d = Math.max(1, snapX(ev.x) - s); draw(); })
            .on('end', () => { if (d !== a.duration) commit(a.id, { duration: d }); }))
          .on('keydown', arrows((k) => commit(a.id, { duration: Math.max(1, a.duration + k) })));
        // Arrastrar el punto: % completado (pasos de 5 %)
        knob.attr('tabindex', 0).attr('role', 'slider').attr('aria-valuemin', 0).attr('aria-valuemax', 100)
          .attr('aria-valuenow', Math.round(pc * 100)).attr('aria-label', t('dragPct', { id: a.id }))
          .call(d3.drag().on('drag', (ev) => {
            const x0 = x(s); const x1 = x(s + d);
            p = Math.max(0, Math.min(1, Math.round(((ev.x - x0) / (x1 - x0)) * 20) / 20));
            draw();
          }).on('end', () => { if (Math.abs(p - pc) > 1e-9) commit(a.id, { pc: p }); }))
          .on('keydown', arrows((k) => commit(a.id, { pc: Math.max(0, Math.min(1, (Math.round(pc * 20) + k) / 20)) })));
      });

      // Fecha de control arrastrable
      const r = P.atRange(project);
      const atLine = g.append('line').attr('class', 'at-line').attr('y1', -12).attr('y2', ih);
      const atKnob = g.append('g').attr('class', 'ed-at-knob').attr('tabindex', 0).attr('role', 'slider')
        .attr('aria-label', t('dragAT')).attr('aria-valuenow', AT).attr('aria-valuemin', r.min).attr('aria-valuemax', r.max);
      atKnob.append('rect').attr('x', -27).attr('y', -32).attr('width', 54).attr('height', 20).attr('rx', 10);
      const atText = atKnob.append('text').attr('y', -18).attr('text-anchor', 'middle');
      let at = AT;
      const drawAT = () => {
        atLine.attr('x1', x(at)).attr('x2', x(at));
        atKnob.attr('transform', `translate(${x(at)},0)`);
        atText.text(`AT = ${at}`);
      };
      drawAT();
      atKnob.call(d3.drag().on('drag', (ev) => { at = Math.max(r.min, Math.min(r.max, snapX(ev.x))); drawAT(); })
        .on('end', () => { if (at !== AT) ctx.set({ AT: at }); }))
        .on('keydown', arrows((k) => setAT(AT + k)));
      if (PD !== AT) {
        g.append('line').attr('class', 'ref').attr('x1', x(PD)).attr('x2', x(PD)).attr('y1', 0).attr('y2', ih);
        g.append('text').attr('class', 'ref-label').attr('x', x(PD) + 3).attr('y', ih - 4).text('PD');
      }
    }

    // ---- Tabla de corte ---------------------------------------------------------
    function buildTable(project, lang) {
      const unit = t(`unitOne_${project.unit}`);
      const table = el('table', { class: 'cut-table' });
      const head = table.createTHead().insertRow();
      const cols = [t('activity'), t('colStart', { unit }), t('colDuration'), `${t('colBudget')}`, I.acr(lang, 'PV'), t('colPct'), I.acr(lang, 'EV'), I.acr(lang, 'AC'), ''];
      for (const c of cols) head.appendChild(el('th', { scope: 'col', text: c }));
      const body = table.createTBody();
      for (const a of project.activities) {
        const tr = body.insertRow();
        tr.dataset.id = a.id;
        const inp = (field, attrs) => el('input', { class: 'cell-in', 'data-f': field, ...attrs });
        tr.insertCell().append(el('span', { class: 'act-id', text: a.id }), inp('name', { type: 'text', maxlength: 60, 'aria-label': t('activityName', { id: a.id }) }));
        tr.insertCell().append(inp('start', { type: 'number', min: 1, max: 41, step: 1, inputmode: 'numeric', 'aria-label': `${t('colStart', { unit })} ${a.id}` }));
        tr.insertCell().append(inp('duration', { type: 'number', min: 1, max: 30, step: 1, inputmode: 'numeric', 'aria-label': `${t('colDuration')} ${a.id}` }));
        tr.insertCell().append(inp('budget', { type: 'number', min: 1, step: 100, inputmode: 'decimal', 'aria-label': `${t('colBudget')} ${a.id}` }));
        tr.insertCell().className = 'out-pv';
        tr.insertCell().append(inp('pct', { type: 'number', min: 0, max: 100, step: 5, inputmode: 'decimal', 'aria-label': `${t('colPct')} ${a.id}` }));
        tr.insertCell().className = 'out-ev';
        tr.insertCell().append(inp('ac', { type: 'number', min: 0, step: 100, inputmode: 'decimal', 'aria-label': `AC ${a.id}` }));
        const rm = el('button', { type: 'button', class: 'btn icon', 'aria-label': t('removeActivity', { id: a.id }), title: t('removeActivity', { id: a.id }), text: '×' });
        rm.disabled = project.activities.length <= 1;
        rm.addEventListener('click', () => { const c = ctx.get(); ctx.set({ project: P.removeActivity(c.project, c.AT, a.id) }); });
        tr.insertCell().append(rm);
      }
      const foot = table.createTFoot().insertRow();
      foot.append(el('th', { scope: 'row', colspan: 3, text: t('colTotal') }));
      for (const k of ['bac', 'pv', 'pct', 'ev', 'ac']) foot.append(el('td', { class: `tot-${k}` }));
      const addCell = el('td');
      const add = el('button', { type: 'button', class: 'btn icon', 'aria-label': t('addActivity'), title: t('addActivity'), text: '+' });
      add.disabled = project.activities.length >= P.MAX_ACTIVITIES;
      add.addEventListener('click', () => { const c = ctx.get(); ctx.set({ project: P.addActivity(c.project, c.AT) }); });
      addCell.append(add);
      foot.append(addCell);

      table.addEventListener('change', (ev) => {
        const f = ev.target.dataset.f;
        const tr = ev.target.closest('tr');
        const id = tr && tr.dataset.id;
        if (!f || !id) return;
        const v = ev.target.value;
        const changes = f === 'start' ? { start: Number(v) - 1 }
          : f === 'pct' ? { pc: Number(v) / 100 }
            : { [f]: f === 'name' ? v : Number(v) };
        const c = ctx.get();
        ctx.set({ project: P.edit(c.project, c.AT, id, changes) });
      });
      tableWrap.textContent = '';
      tableWrap.append(table);
    }

    function patchTable(project, AT, lang) {
      const money = (v) => F.money(lang, v);
      const setIn = (input, v) => { if (document.activeElement !== input) input.value = v; };
      for (const a of project.activities) {
        const tr = tableWrap.querySelector(`tr[data-id="${a.id}"]`);
        if (!tr) continue;
        const pc = E.pcAt(a, AT);
        const acCum = a.ac.slice(0, AT).reduce((s, c) => s + c, 0);
        setIn(tr.querySelector('[data-f=name]'), a.name[lang] || a.name.es);
        setIn(tr.querySelector('[data-f=start]'), a.start + 1);
        setIn(tr.querySelector('[data-f=duration]'), a.duration);
        setIn(tr.querySelector('[data-f=budget]'), a.budget);
        setIn(tr.querySelector('[data-f=pct]'), Math.round(pc * 1000) / 10);
        setIn(tr.querySelector('[data-f=ac]'), Math.round(acCum * 100) / 100);
        tr.querySelector('.out-pv').textContent = money(E.pvActivity(a, AT));
        tr.querySelector('.out-ev').textContent = money(a.budget * pc);
      }
      const m = E.metricsAt(project, AT);
      tableWrap.querySelector('.tot-bac').textContent = money(m.BAC);
      tableWrap.querySelector('.tot-pv').textContent = money(m.PV);
      tableWrap.querySelector('.tot-pct').textContent = F.pct(lang, m.percentComplete, 1);
      tableWrap.querySelector('.tot-ev').textContent = money(m.EV);
      tableWrap.querySelector('.tot-ac').textContent = money(m.AC);
    }

    function render() {
      const { project, AT } = ctx.get();
      const lang = ctx.lang();
      // Si el foco estaba en un control del Gantt, se recupera después de redibujar.
      const focused = chart.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
      rootEl.querySelectorAll('[data-k]').forEach((n) => { n.textContent = t(n.dataset.k); });
      sel.textContent = '';
      if (project.source === 'custom') sel.append(el('option', { value: '__custom', text: `${t('edCustomOption')}: ${project.name[lang] || project.name.es}` }));
      for (const ex of X.examples) sel.append(el('option', { value: ex.id, text: ex.name[lang] }));
      sel.value = project.source === 'custom' ? '__custom' : project.exampleId;
      unitSel.textContent = '';
      for (const u of P.UNITS) unitSel.append(el('option', { value: u, text: t(`unit_${u}`) }));
      unitSel.value = project.unit;
      const r = P.atRange(project);
      range.min = r.min; range.max = r.max; range.value = AT;
      const unitOne = t(`unitOne_${project.unit}`);
      atOut.textContent = `${unitOne} ${AT}`;
      prev.setAttribute('aria-label', t('prev'));
      next.setAttribute('aria-label', t('next'));
      note.textContent = project.historyKnown ? t('edExampleNote', { unit: unitOne, n: AT }) : t('edCustomNote');
      root.PCCharts.legend(legend, [
        { label: t('legPlan'), color: 'var(--c-plan-wash)', outline: 'var(--c-plan)', box: true },
        { label: t('legEarned'), color: 'var(--c-done)', box: true },
        ...(project.historyKnown ? [{ label: t('legActual'), color: 'var(--ink)' }] : []),
      ]);
      renderGantt(project, AT, lang);
      if (focused) {
        const again = [...chart.querySelectorAll('[aria-label]')].find((n) => n.getAttribute('aria-label') === focused);
        if (again) again.focus();
      }
      const key = [lang, project.unit, project.source, project.activities.map((a) => a.id).join('')].join('|');
      if (key !== tableKey) { buildTable(project, lang); tableKey = key; }
      patchTable(project, AT, lang);
    }

    return { render };
  }

  root.PCEditor = { create };
})(this);
