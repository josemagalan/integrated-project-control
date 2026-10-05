/*
 * Módulo de práctica: el alumno calcula los indicadores de un ejercicio aleatorio y la
 * herramienta corrige cada casilla, avisa de errores arrastrados y enseña la solución.
 */
(function (root) {
  'use strict';

  const E = root.PCEngine;
  const F = root.PCFormat;
  const I = root.PCI18n;
  const K = root.PCKit;
  const PR = root.PCPractice;
  const P = root.PCProject;

  const LABELS = { SVt: 'SV(t)', SPIt: 'SPI(t)', IEAC: 'IEAC(t)', EDt: 'ED(t)', EDAC: 'EDAC(t)', C: 'C' };
  const BLOCK_COLOR = { evm: 'var(--c-evm)', es: 'var(--c-es)', edm: 'var(--c-edm)' };

  // Estado de la sesión de práctica (respuestas en memoria; el ejercicio va en la URL).
  // answers guarda, por casilla, el número leído (clave) y el texto escrito (raw_clave); lang es el
  // idioma en que se escribió ese texto.
  const S = { key: null, answers: {}, result: null, hints: false, solution: false, lang: null };

  /**
   * Al cambiar de idioma, vuelve a escribir cada respuesta a partir del número ya leído, para que
   * «12.333» (doce mil, en español) no pase a leerse como 12,333 en inglés.
   */
  function relocalize(lang) {
    if (S.lang && S.lang !== lang) {
      for (const k of Object.keys(S.answers)) {
        if (!k.startsWith('raw_')) continue;
        const v = S.answers[k.slice(4)];
        if (Number.isFinite(v)) S.answers[k] = PR.formatAnswer(lang, v);
      }
    }
    S.lang = lang;
  }

  function create(container, ctx) {
    // Región viva fuera del contenedor (que se rehace en cada render) para anunciar la puntuación.
    const announcer = document.createElement('p');
    announcer.className = 'sr-only';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    container.after(announcer);
    const announce = (msg) => { announcer.textContent = ''; setTimeout(() => { announcer.textContent = msg; }, 60); };
    // ctx: { t, lang(), get() -> { seed, level, blocks }, set(changes), link(), hashFor(view, project, AT) }
    function render() {
      const lang = ctx.lang();
      const L = root.PCPracticeText.TEXT[lang];
      const st = ctx.get();
      const ex = PR.generate(st.seed, st.level);
      const exKey = `${st.seed}|${st.level}`;
      if (S.key !== exKey) { S.key = exKey; S.answers = {}; S.result = null; S.solution = false; }
      relocalize(lang);
      const { project, AT } = ex;
      const m = E.metricsAt(project, AT);
      const unitOne = ctx.t(`unitOne_${project.unit}`);
      const units = ctx.t(`unit_${project.unit}`);
      const fill = (s, o) => Object.entries(o).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);
      const fmtTruth = (it, v) => (it.kind === 'money' ? F.money(lang, v) : it.kind === 'int' ? String(v) : F.num(lang, v, it.kind === 'ratio' ? 3 : 2));
      container.textContent = '';

      // ---- Controles
      const ctrl = K.el('section', 'card controls practice-controls');
      const lvl = K.el('select'); lvl.id = 'prLevel';
      for (const k of Object.keys(PR.LEVELS)) { const o = K.el('option', null, L[k]); o.value = k; lvl.append(o); }
      lvl.value = st.level;
      lvl.addEventListener('change', () => ctx.set({ level: lvl.value }));
      const seed = K.el('input'); seed.id = 'prSeed'; seed.type = 'number'; seed.min = 1; seed.max = PR.SEED_MAX; seed.step = 1; seed.value = st.seed;
      const seedMsg = K.el('span', 'f-note'); seedMsg.id = 'prSeedMsg'; seedMsg.setAttribute('role', 'status');
      seed.setAttribute('aria-describedby', 'prSeedMsg');
      // La misma validación que al leer la URL: fuera de rango se rechaza y se conserva el ejercicio.
      seed.addEventListener('change', () => {
        const v = PR.normalizeSeed(seed.value);
        if (v === null) {
          seed.value = st.seed;
          seed.setAttribute('aria-invalid', 'true');
          seedMsg.textContent = L.seedRange;
        } else if (v !== st.seed) ctx.set({ seed: v });
      });
      const nb = K.el('button', 'btn primary', L.newEx); nb.type = 'button';
      nb.addEventListener('click', () => ctx.set({ seed: 1 + Math.floor(Math.random() * PR.SEED_MAX) }));
      const cp = K.el('button', 'btn', L.copy); cp.type = 'button';
      cp.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(ctx.link()); } catch (e) { /* sin portapapeles */ }
        cp.textContent = L.copied; setTimeout(() => { cp.textContent = L.copy; }, 1500);
      });
      const blocksBox = K.el('div', 'btn-row checks');
      for (const b of PR.BLOCKS) {
        const lab = K.el('label', 'check');
        const cb = K.el('input'); cb.type = 'checkbox'; cb.checked = st.blocks.includes(b);
        cb.addEventListener('change', () => {
          const next = PR.BLOCKS.filter((x) => (x === b ? cb.checked : st.blocks.includes(x)));
          ctx.set({ blocks: next });
        });
        lab.append(cb, document.createTextNode(` ${L[`block${b[0].toUpperCase()}${b.slice(1)}`]}`));
        blocksBox.append(lab);
      }
      const field = (labelText, el, forId) => {
        const f = K.el('div', 'field');
        const l = K.el('label', null, labelText); if (forId) l.htmlFor = forId;
        f.append(l, el); return f;
      };
      const btns = K.el('div', 'btn-row'); btns.append(nb, cp);
      const bf = K.el('div', 'field'); bf.append(K.el('span', 'label', L.blocks), blocksBox);
      const seedField = field(L.seed, seed, 'prSeed'); seedField.append(seedMsg);
      ctrl.append(field(L.level, lvl, 'prLevel'), seedField, bf, field(' ', btns));
      container.append(ctrl);

      // ---- Enunciado
      const stmt = K.el('section', 'card');
      stmt.append(K.el('h2', null, `${L.stmtTitle} · ${L.seed} ${st.seed} (${L[st.level]})`));
      stmt.append(K.p(fill(L.stmt, { n: project.activities.length, units, at: AT })));
      stmt.append(K.p(fill(L.stmtPD, { pd: m.PD, units })));
      if (st.gen !== null && st.gen !== undefined && String(st.gen) !== String(PR.GENERATOR)) {
        stmt.append(K.aside(null, [K.p(fill(L.genMismatch, { g: st.gen, cur: PR.GENERATOR }))]));
      }
      const gantt = K.chartBox();
      stmt.append(gantt);
      const tw = K.el('div', 'table-wrap');
      const table = K.el('table', 'data-table');
      const hr = table.createTHead().insertRow();
      for (const h of [L.colAct, fill(L.colStart, { unit: unitOne }), L.colDur, L.colBud, L.colPct, L.colAC]) hr.append(K.el('th', null, h));
      const tb = table.createTBody();
      for (const a of project.activities) {
        const r = tb.insertRow();
        r.insertCell().textContent = a.id;
        r.insertCell().textContent = String(a.start + 1);
        r.insertCell().textContent = String(a.duration);
        r.insertCell().textContent = F.money(lang, a.budget);
        r.insertCell().textContent = F.pctSmart(lang, a.pc[AT - 1]);
        r.insertCell().textContent = F.money(lang, a.ac[AT - 1]);
      }
      tw.append(table);
      stmt.append(tw);
      container.append(stmt);

      if (!st.blocks.length) {
        const c = K.el('section', 'card'); c.append(K.p(L.noBlocks)); container.append(c);
        root.PCGantt.render(gantt, { project, AT, xMax: Math.max(m.PD, AT) + 1, lang, t: ctx.t, fmt: F, planOnly: true, ariaLabel: L.stmtTitle });
        return;
      }

      // ---- Casillas
      const statusFor = (key) => (S.result && S.result.items[key]) || null;
      const statusEl = (key, it) => {
        const r = statusFor(key);
        const s = K.el('div', 'pr-status');
        s.id = `pr-${key}-st`;
        if (!r) return s;
        if (r.status !== 'empty') {
          s.classList.add(`pr-${r.status}`);
          s.textContent = L[`st_${r.status}`];
        }
        if (r.mistake && r.status === 'wrong') s.append(K.el('span', 'pr-mistake', ` ${L[`mk_${r.mistake}`]}`));
        if (S.solution && r.status !== 'ok') {
          const v = it ? fmtTruth(it, r.truth) : L[r.truth];
          s.append(K.el('span', 'pr-truth', ` ${fill(L.truthIs, { v })}`));
        }
        return s;
      };
      for (const b of st.blocks) {
        const card = K.el('section', 'card pr-block');
        const h = K.el('h2', 'step-title');
        const key = K.el('span', 'key'); key.style.background = BLOCK_COLOR[b];
        h.append(key, document.createTextNode(L[`block${b[0].toUpperCase()}${b.slice(1)}`]));
        card.append(h);
        const grid = K.el('div', 'pr-grid');
        for (const it of PR.ITEMS.filter((x) => x.block === b)) {
          const cell = K.el('div', 'pr-item');
          const id = `pr-${it.key}`;
          const lab = K.el('label', 'pr-label', LABELS[it.key] || I.acr(lang, it.key)); lab.htmlFor = id;
          const inp = K.el('input', 'cell-in pr-in'); inp.id = id; inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off';
          inp.dataset.key = it.key;
          if (S.answers[`raw_${it.key}`] !== undefined) inp.value = S.answers[`raw_${it.key}`];
          inp.addEventListener('input', () => {
            S.answers[`raw_${it.key}`] = inp.value;
            S.answers[it.key] = PR.parseNum(lang, inp.value);
          });
          // La corrección de la casilla queda asociada al campo (lectores de pantalla).
          inp.setAttribute('aria-describedby', `pr-${it.key}-st`);
          const rs = statusFor(it.key);
          if (rs && (rs.status === 'wrong' || rs.status === 'carried')) inp.setAttribute('aria-invalid', 'true');
          const unit = it.kind === 'money' ? '€' : it.kind === 'time' ? units : it.kind === 'int' ? unitOne : '';
          const row = K.el('div', 'pr-row'); row.append(inp, K.el('span', 'pr-unit', unit));
          cell.append(lab, row);
          if (S.hints) cell.append(K.el('div', 'pr-hint', L[`hint_${it.key}`]));
          cell.append(statusEl(it.key, it));
          grid.append(cell);
        }
        card.append(grid);
        for (const ch of PR.CHOICES.filter((x) => x.block === b)) {
          const fs = K.el('fieldset', 'pr-choice');
          fs.append(K.el('legend', null, L[{ schedule: 'qSchedule', cost: 'qCost', decCost: 'qDecCost', decTime: 'qDecTime' }[ch.key]]));
          if (ch.decision) fs.classList.add('pr-decision');
          for (const o of ch.options) {
            const lab = K.el('label', 'check');
            const r = K.el('input'); r.type = 'radio'; r.name = `pr-${ch.key}`; r.value = o; r.checked = S.answers[ch.key] === o;
            r.addEventListener('change', () => { S.answers[ch.key] = o; });
            lab.append(r, document.createTextNode(` ${L[o]}`));
            fs.append(lab);
          }
          fs.append(statusEl(ch.key, null));
          // En las decisiones, tras comprobar se explica la regla con los valores del ejercicio.
          const rch = statusFor(ch.key);
          if (ch.decision && rch && rch.status !== 'empty') {
            fs.append(K.el('p', 'pr-why', fill(L[`why_${ch.key}`], { tcpi: F.num(lang, m.TCPI, 3), cpi: F.num(lang, m.CPI, 3), spit: F.num(lang, m.SPIt, 3) })));
          }
          fs.setAttribute('aria-describedby', `pr-${ch.key}-st`);
          card.append(fs);
        }
        container.append(card);
      }

      // ---- Acciones
      const bar = K.el('section', 'card pr-actions');
      // Tras rehacer la vista, el foco vuelve al mismo botón (no se pierde en el documento).
      const mk = (txt, cls, fn, act) => {
        const x = K.el('button', `btn ${cls || ''}`, txt); x.type = 'button'; x.dataset.act = act;
        x.addEventListener('click', () => {
          fn();
          const n = container.querySelector(`[data-act="${act}"]`);
          if (n) n.focus();
        });
        return x;
      };
      const doCheck = () => {
        // Releer las casillas por si el navegador las rellenó sin evento input.
        container.querySelectorAll('.pr-in').forEach((n) => { S.answers[`raw_${n.dataset.key}`] = n.value; S.answers[n.dataset.key] = PR.parseNum(lang, n.value); });
        S.result = PR.check(ex, S.answers, st.blocks);
      };
      const row = K.el('div', 'btn-row');
      row.append(
        mk(L.check, 'primary', () => { doCheck(); render(); announce(fill(L.score, S.result.score)); }, 'check'),
        mk(S.hints ? L.hideHints : L.hints, '', () => { S.hints = !S.hints; render(); }, 'hints'),
        mk(S.solution ? L.hideSol : L.showSol, '', () => { doCheck(); S.solution = !S.solution; render(); }, 'sol'),
        mk(L.reset, '', () => { S.answers = {}; S.result = null; S.solution = false; render(); announce(''); }, 'reset'),
      );
      bar.append(row);
      if (S.result) bar.append(K.el('p', 'pr-score', fill(L.score, S.result.score)));
      bar.append(K.el('p', 'f-note', L.tolNote));
      container.append(bar);

      // ---- Solución paso a paso
      if (S.solution) {
        const sol = K.el('section', 'card');
        sol.append(K.el('h2', null, L.solTitle));
        const nar = root.PCNarration.build(project, AT, lang, F, 'index');
        for (const b of st.blocks) {
          sol.append(K.el('h3', 'step-sub', nar.tabs[b]));
          const extra = b === 'evm' ? [
            `ETC = EAC − AC = ${F.money(lang, m.costEAC.cpi)} − ${F.money(lang, m.AC)} = ${F.money(lang, m.costEAC.cpi - m.AC)}`,
            `TCPI = (BAC − EV)/(BAC − AC) = ${F.money(lang, m.BAC - m.EV)}/${F.money(lang, m.BAC - m.AC)} = ${F.num(lang, m.TCPI, 3)}`,
          ] : [];
          sol.append(K.formulas(...nar.groups[b].map((s) => s.formula).filter(Boolean), ...extra));
        }
        const links = K.el('p', 'pr-links');
        links.append(document.createTextNode(`${L.openIn} `));
        for (const b of PR.BLOCKS) {
          const a = K.el('a', null, nar.tabs[b]);
          a.href = ctx.hashFor(b, project, AT);
          links.append(a, document.createTextNode(' '));
        }
        sol.append(links);
        container.append(sol);
      }

      root.PCGantt.render(gantt, { project, AT, xMax: Math.max(m.PD, AT) + 1, lang, t: ctx.t, fmt: F, planOnly: true, ariaLabel: L.stmtTitle });
    }

    return { render };
  }

  root.PCModulePractice = { create, state: S };
})(this);
