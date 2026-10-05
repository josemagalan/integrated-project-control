/*
 * Módulo «Para profundizar»: precisión de las previsiones, camino crítico, factor P de Lipke y
 * control con incertidumbre. Usa los ejemplos con historial y su propio escenario; no usa el
 * editor del proyecto. El estado va en la URL (e1, err, d, s, cat, xat, e3, at3).
 */
(function (root) {
  'use strict';

  const E = root.PCEngine;
  const F = root.PCFormat;
  const K = root.PCKit;
  const A = root.PCAdvanced;
  const P = root.PCProject;
  const COL = { ac: 'var(--c-ac)', pv: 'var(--c-evm)', ed: 'var(--c-jacob)', es: 'var(--c-es)', edm: 'var(--c-edm)', plan: 'var(--c-plan)', ink: 'var(--ink)' };
  const EXAMPLES = ['late', 'ahead', 'decoupled', 'critical'];
  const LIM = A.SCEN_LIMITS;

  const S = { e1: 'late', err: 'abs', d: 2, s: 1, cat: 3, xat: 2, x: null, e3: 'critical', at3: 3 };
  const CRASH_IDS = ['A', 'B', 'C', 'D'];

  function setFromHash(h) {
    const int = (k, lo, hi) => { const v = parseInt(h.get(k), 10); return Number.isInteger(v) && v >= lo && v <= hi ? v : null; };
    if (EXAMPLES.includes(h.get('e1'))) S.e1 = h.get('e1');
    if (EXAMPLES.includes(h.get('e3'))) S.e3 = h.get('e3');
    const d = int('d', LIM.delay[0], LIM.delay[1]); if (d !== null) S.d = d;
    const s = int('s', LIM.speed[0], LIM.speed[1]); if (s !== null) S.s = s;
    const cat = int('cat', 1, 99); if (cat !== null) S.cat = cat;
    const at3 = int('at3', 1, 99); if (at3 !== null) S.at3 = at3;
    const xat = int('xat', 1, 99); if (xat !== null) S.xat = xat;
    if (['abs', 'sgn'].includes(h.get('err'))) S.err = h.get('err');
    S.x = null; // la elección del laboratorio no va en la URL: quien abre el enlace elige antes de ver el resultado
  }
  const params = () => ({ e1: S.e1, err: S.err, d: S.d, s: S.s, cat: S.cat, xat: S.xat, e3: S.e3, at3: S.at3 });

  const projectFor = (id) => (id === 'critical' ? A.criticalScenario(S.d, S.s).project : P.fromExample(id));

  /** Red de precedencias (actividad en el nodo): camino crítico con trazo continuo. */
  function netDiagram(L, sc) {
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (text !== undefined) n.textContent = text;
      return n;
    };
    const W = 130; const H = 44;
    const pos = { A: [8, 10], B: [176, 10], D: [344, 10], C: [176, 84] };
    const svg = mk('svg', { viewBox: '0 0 482 138', role: 'img', 'aria-label': L.netAria, class: 'adv-net' });
    const defs = mk('defs', {});
    const mark = mk('marker', { id: 'advArrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    mark.append(mk('path', { d: 'M0,0 L10,5 L0,10 z', class: 'adv-net-head' }));
    defs.append(mark); svg.append(defs);
    const edge = (a, b, crit) => {
      const [ax, ay] = pos[a]; const [bx, by] = pos[b];
      const d = ay === by ? `M${ax + W},${ay + H / 2} H${bx - 2}` : `M${ax + W},${ay + H / 2} H${bx - 24} V${by + H - 2} H${bx - 2}`;
      svg.append(mk('path', { d, class: `adv-net-edge${crit ? ' crit' : ''}`, 'marker-end': 'url(#advArrow)' }));
    };
    edge('A', 'B', true); edge('B', 'D', true); edge('C', 'D', false);
    for (const a of sc.project.activities) {
      const [x, y] = pos[a.id];
      const crit = sc.critical.includes(a.id);
      const g = mk('g', { class: `adv-net-node${crit ? ' crit' : ''}` });
      g.append(mk('rect', { x, y, width: W, height: H, rx: 7 }));
      g.append(mk('text', { x: x + 10, y: y + 19, class: 'id' }, a.id));
      g.append(mk('text', { x: x + 10, y: y + 35, class: 'sub' }, `${a.duration} ${L.wk}${crit ? '' : ` · ${L.slackShort} ${sc.slack[a.id]}`}`));
      g.append(mk('text', { x: x + W - 10, y: y + 19, class: 'star', 'text-anchor': 'end' }, crit ? '★' : ''));
      svg.append(g);
    }
    const box = K.el('div', 'adv-net-box');
    box.append(svg, K.el('p', 'f-note', L.netLegend));
    return box;
  }

  function create(container, ctx) {
    // ctx: { t, lang(), onChange() }
    let focusId = null;
    const change = (c, id) => { Object.assign(S, c); focusId = id || null; ctx.onChange(); render(); };

    function select(id, label, value, options, onSel) {
      const f = K.el('div', 'field');
      const l = K.el('label', null, label); l.htmlFor = id;
      const s = K.el('select'); s.id = id;
      for (const [v, txt] of options) { const o = K.el('option', null, txt); o.value = v; s.append(o); }
      s.value = value;
      s.addEventListener('change', () => onSel(s.value));
      f.append(l, s);
      return f;
    }
    function range(id, label, value, min, max, fmt, onSet) {
      const f = K.el('div', 'field at-field');
      const l = K.el('label', null, label); l.htmlFor = id;
      const row = K.el('div', 'at-row');
      const r = K.el('input'); r.type = 'range'; r.id = id; r.min = min; r.max = max; r.step = 1; r.value = value;
      const out = K.el('output', null, fmt(value)); out.htmlFor = id;
      r.setAttribute('aria-valuetext', fmt(value));
      r.addEventListener('input', () => { out.textContent = fmt(Number(r.value)); });
      r.addEventListener('change', () => onSet(Number(r.value)));
      row.append(r, out);
      f.append(l, row);
      return f;
    }
    function think(L, q, a) {
      const box = K.aside(L.think, [K.p(q)]);
      const det = K.el('details', 'adv-answer');
      det.append(K.el('summary', null, L.showAnswer), K.p(a));
      box.append(det);
      return box;
    }

    function render() {
      const lang = ctx.lang();
      const t = ctx.t;
      const L = root.PCAdvancedText.TEXT[lang];
      const n2 = (v) => F.num(lang, v, 2);
      const n3 = (v) => F.num(lang, v, 3);
      const money = (v) => F.money(lang, v);
      const fill = (s, o) => Object.entries(o).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);
      const exName = (id) => (id === 'critical' ? L.scenarioName : P.fromExample(id).name[lang]);
      const exOptions = EXAMPLES.map((id) => [id, exName(id)]);
      const methodLabel = { pv: t('pvMethod'), ed: t('jacob'), es: t('es'), edm: t('edm') };
      const methodShort = { pv: 'PD/SPI', ed: 'Jacob', es: 'PD/SPI(t)', edm: 'PD/DPI' };
      const charts = [];
      container.textContent = '';

      const intro = K.el('section', 'card');
      intro.append(K.p(L.intro), K.p(L.goals));
      container.append(intro);

      // ---- 1. Precisión de las previsiones
      const p1 = projectFor(S.e1);
      const fe = A.forecastErrors(p1);
      const signed = S.err === 'sgn';
      const c1 = K.chartBox();
      const leg1 = K.el('ul', 'legend');
      const ctl1 = K.el('div', 'controls adv-controls');
      ctl1.append(select('advE1', L.project, S.e1, exOptions, (v) => change({ e1: v }, 'advE1')));
      const seg = K.el('div', 'field');
      const segLab = K.el('span', 'label', L.errMode); segLab.id = 'advErrLab';
      const segBox = K.el('div', 'seg'); segBox.setAttribute('role', 'group'); segBox.setAttribute('aria-labelledby', 'advErrLab');
      for (const [k, txt] of [['abs', L.errAbs], ['sgn', L.errSgn]]) {
        const b = K.el('button', null, txt); b.type = 'button'; b.id = `advErr-${k}`;
        b.setAttribute('aria-pressed', String(S.err === k));
        b.addEventListener('click', () => change({ err: k }, `advErr-${k}`));
        segBox.append(b);
      }
      seg.append(segLab, segBox);
      ctl1.append(seg);
      const s1 = [K.p(L.s1a), K.formulas(...L.s1Methods), ctl1];
      if (!fe) s1.push(K.p(L.noForecast));
      else {
        if (signed) s1.push(K.p(L.sgnNote));
        s1.push(leg1, c1);
        const tbl = K.el('table', 'mini-table cmp adv-table');
        tbl.append(K.el('caption', null, signed ? L.s1TableSgn : L.s1Table));
        const hr = tbl.createTHead().insertRow();
        for (const h of ['', ...A.METHODS.map((m) => methodShort[m.key])]) hr.append(K.el('th', null, h));
        const tb = tbl.createTBody();
        const src = signed ? fe.bias : fe.mape;
        const pctTxt = (v) => (v === null ? '—' : `${signed && v > 0.05 ? '+' : ''}${F.num(lang, v, 1)} %`);
        for (const st of ['early', 'middle', 'late', 'all']) {
          const row = tb.insertRow();
          const mp = src[st];
          const c0 = row.insertCell(); c0.append(K.el('span', null, L.stage[st]), K.el('small', 'adv-n', L.weeksN(mp.n)));
          const vals = A.METHODS.map((m) => fe.mape[st][m.key]).filter((v) => v !== null);
          const best = vals.length ? Math.min(...vals) : null;
          for (const m of A.METHODS) {
            const c = row.insertCell();
            c.textContent = pctTxt(mp[m.key]);
            const a = fe.mape[st][m.key];
            if (!signed && a !== null && best !== null && a - best < 0.05) { c.className = 'adv-best'; c.title = L.best; c.textContent += ' ✓'; }
          }
        }
        const tw = K.el('div', 'table-wrap'); tw.append(tbl);
        const lesson = S.e1 === 'critical'
          ? L.s1Lesson.critical[S.d === 0 ? (S.s === 0 ? 'none' : 'ahead') : (S.s === 0 ? 'delay' : 'trap')]
          : L.s1Lesson[S.e1];
        s1.push(tw, K.aside(null, [K.p(lesson)]), K.p(L.s1b), think(L, L.q1, L.a1));
        charts.push(() => {
          root.PCCharts.legend(leg1, A.METHODS.map((m) => ({ label: `${methodShort[m.key]} · ${methodLabel[m.key]}`, color: COL[m.key] })));
          const key = signed ? 'sgn' : 'err';
          const all = fe.rows.flatMap((r) => A.METHODS.map((m) => r[key][m.key])).filter((v) => v !== null);
          const lim = Math.min(100, Math.max(10, ...all.map(Math.abs)) * 1.1);
          const yMin = signed ? -lim : 0;
          const clampY = (v) => (v === null ? null : Math.max(yMin, Math.min(lim, v)));
          const widths = { ed: 7, edm: 5, pv: 2, es: 2 };
          root.PCLines.render(c1, {
            height: 280, xMax: fe.RD, yMin, yMax: lim,
            yFormat: (v) => `${signed && v > 0 ? '+' : ''}${F.num(lang, v, 0)} %`,
            ariaLabel: L.s1Aria, xAxisTitle: t(`unit_${p1.unit}`),
            series: ['ed', 'edm', 'pv', 'es'].map((k) => ({
              key: k, color: COL[k], width: widths[k], endLabel: methodShort[k],
              points: fe.rows.map((r) => ({ x: r.AT, y: clampY(r[key][k]) })),
            })),
            refY: signed ? [{ y: 0, label: '0' }] : [],
            refX: fe.PD < fe.RD ? [{ x: fe.PD, label: 'PD' }] : [],
            xHoverMin: 1, xHoverMax: fe.RD - 1,
            tooltip: {
              title: (x) => `${t(`unitOne_${p1.unit}`)} ${x} · ${F.pct(lang, fe.rows[x - 1].pc)}`,
              rows: (x) => ['pv', 'ed', 'es', 'edm'].map((k) => ({ label: `${methodShort[k]} = ${n2(fe.rows[x - 1].f[k])}`, color: COL[k], value: pctTxt(fe.rows[x - 1][key][k]) })),
            },
          });
        });
      }
      container.append(K.step(1, L.s1, s1));

      // ---- 2. Camino crítico
      const sc = A.criticalScenario(S.d, S.s);
      const cat = Math.max(1, Math.min(sc.RD, S.cat));
      const m2 = E.metricsAt(sc.project, cat);
      const pf2 = A.pFactor(sc.project, cat);
      const net = K.el('table', 'mini-table cmp');
      const nh = net.createTHead().insertRow();
      for (const h of L.s2Table) nh.append(K.el('th', null, h));
      const nb = net.createTBody();
      const succ = { A: 'B', B: 'D', C: 'D', D: '—' };
      for (const a of sc.project.activities) {
        const r = nb.insertRow();
        r.insertCell().textContent = `${a.id} · ${a.name[lang]}`;
        r.insertCell().textContent = String(a.duration);
        r.insertCell().textContent = succ[a.id];
        r.insertCell().textContent = String(sc.slack[a.id] || 0);
        r.insertCell().textContent = sc.critical.includes(a.id) ? `★ ${L.yes}` : L.no;
      }
      const ctl = K.el('div', 'controls adv-controls');
      ctl.append(
        range('advD', L.delay, S.d, LIM.delay[0], LIM.delay[1], L.weeksN, (v) => change({ d: v, x: null }, 'advD')),
        range('advS', L.speed, S.s, LIM.speed[0], LIM.speed[1], L.weeksN, (v) => change({ s: v, x: null }, 'advS')),
        range('advAT', L.at, cat, 1, sc.RD, (v) => `AT = ${v}`, (v) => change({ cat: v }, 'advAT')),
      );
      const g2 = K.chartBox();
      const c2 = K.chartBox();
      const leg2 = K.el('ul', 'legend');
      const late = sc.RD - sc.PD;
      let msg;
      if (late <= 0) msg = fill(L.onTime, { rd: sc.RD });
      else if (m2.SPIt !== null && m2.SPIt >= 0.995) msg = fill(L.trap, { rd: sc.RD, late: L.weeksN(late) });
      else msg = fill(L.seen, { v: n3(m2.SPIt) });
      container.append(K.step(2, L.s2, [
        K.p(L.s2a),
        netDiagram(L, sc),
        (() => { const w = K.el('div', 'table-wrap'); w.append(net); return w; })(),
        ctl,
        g2,
        K.figures([
          { label: 'SPI', value: n3(m2.SPI), color: COL.pv },
          { label: 'SPI(t)', value: n3(m2.SPIt), color: COL.es },
          { label: L.forecastEs, value: n2(m2.durationEAC.es.spi), note: `PD = ${sc.PD}`, color: COL.es },
          { label: L.real, value: String(sc.RD), note: 'RD', color: COL.ink },
        ]),
        K.aside(null, [K.p(msg)]),
        leg2, c2,
        K.p(L.s2b),
        think(L, L.q2, L.a2),
      ]));
      charts.push(() => {
        root.PCGantt.render(g2, { project: sc.project, AT: cat, xMax: Math.max(sc.RD, sc.PD) + 1, lang, t, fmt: F, ariaLabel: L.s2 });
        const ms = []; for (let q = 1; q <= sc.RD; q++) ms.push(E.metricsAt(sc.project, q));
        const ser = [
          { key: 'es', color: COL.es, label: methodShort.es, pick: (m) => m.durationEAC.es.spi },
          { key: 'pv', color: COL.pv, label: methodShort.pv, pick: (m) => m.durationEAC.pv.spi },
        ];
        root.PCCharts.legend(leg2, ser.map((s) => ({ label: s.label, color: s.color })));
        const vals = ms.flatMap((m) => ser.map((s) => s.pick(m))).filter((v) => v !== null && Number.isFinite(v));
        root.PCLines.render(c2, {
          height: 260, xMax: sc.RD, yMin: Math.max(0, Math.min(...vals, sc.PD) - 1), yMax: Math.max(...vals, sc.RD) + 1,
          yFormat: (v) => F.num(lang, v, 0), ariaLabel: L.s2Aria, xAxisTitle: t('unit_week'),
          series: ser.map((s) => ({ key: s.key, color: s.color, width: s.key === 'es' ? 4 : 2, endLabel: s.label, points: ms.filter((m) => m.AT <= cat).map((m) => ({ x: m.AT, y: s.pick(m) })) })),
          refY: [{ y: sc.PD, label: t('plannedDurationRef', { v: sc.PD }) }].concat(sc.RD !== sc.PD ? [{ y: sc.RD, label: t('actualDurationRef', { v: sc.RD }) }] : []),
          at: { x: cat, label: `AT = ${cat}` },
          xHoverMin: 1, xHoverMax: cat,
          tooltip: { title: (x) => `${t('unitOne_week')} ${x}`, rows: (x) => ser.map((s) => ({ label: s.label, color: s.color, value: n2(s.pick(ms[x - 1])) })) },
        });
      });

      // ---- 3. Laboratorio de decisiones
      const xat = Math.max(1, Math.min(sc.RD - 1, S.xat));
      const can = A.crashable(sc.delay, sc.speed, xat);
      const mx = E.metricsAt(sc.project, xat);
      const lab = [
        K.p(fill(L.labA, { d: L.weeksN(sc.delay), s: L.weeksN(sc.speed) })),
      ];
      const ctlx = K.el('div', 'controls adv-controls');
      ctlx.append(range('advXat', L.labWeek, xat, 1, sc.RD - 1, (v) => `AT = ${v}`, (v) => change({ xat: v, x: null }, 'advXat')));
      lab.push(ctlx, K.p(fill(L.labStatus, { at: xat, spit: n3(mx.SPIt), rd: sc.RD, pd: sc.PD }), 'step-p adv-status'));
      const fs = K.el('fieldset', 'pr-choice adv-lab');
      fs.append(K.el('legend', null, L.labChoose));
      const nameOf = (id) => `${id} · ${sc.project.activities.find((a) => a.id === id).name[lang]}`;
      let picked = S.x;
      for (const id of CRASH_IDS.concat('none')) {
        const lb = K.el('label', 'check');
        const r = K.el('input'); r.type = 'radio'; r.name = 'advX'; r.value = id; r.id = `advX-${id}`;
        r.checked = picked === id;
        const ok = id === 'none' || can[id] === true;
        r.disabled = !ok || S.x !== null;
        r.addEventListener('change', () => { picked = id; apply.disabled = false; });
        const crit = sc.critical.includes(id);
        const txt = id === 'none' ? L.labNone
          : `${nameOf(id)}${crit ? ' ★' : ''} — ${ok ? fill(L.labCost, { c: money(A.CRASH_COST[id]) }) : (can[id] === 'done' ? L.labDone : L.labShort)}`;
        lb.append(r, document.createTextNode(` ${txt}`));
        fs.append(lb);
      }
      lab.push(fs);
      const apply = K.el('button', 'btn primary', L.labApply); apply.type = 'button'; apply.id = 'advApply';
      apply.disabled = picked === null;
      apply.addEventListener('click', () => { if (picked) change({ x: picked }, 'advAgain'); });
      const again = K.el('button', 'btn', L.labAgain); again.type = 'button'; again.id = 'advAgain';
      again.addEventListener('click', () => change({ x: null }, 'advX-none'));
      const res = K.el('div', 'adv-result'); res.setAttribute('role', 'status');
      if (S.x === null) {
        lab.push(K.aside(null, [K.p(L.labPredict)]));
        const row = K.el('div', 'btn-row'); row.append(apply); lab.push(row);
      } else {
        const after = S.x === 'none' ? sc : A.criticalScenario(sc.delay, sc.speed, { id: S.x, at: xat });
        const w = Math.min(xat + 1, after.RD);
        const spitB = E.metricsAt(sc.project, Math.min(w, sc.RD)).SPIt;
        const spitA = E.metricsAt(after.project, w).SPIt;
        const cost = S.x === 'none' ? 0 : A.CRASH_COST[S.x];
        res.append(K.figures([
          { label: L.labFinal, value: after.RD === sc.RD ? String(sc.RD) : `${sc.RD} → ${after.RD}`, note: `PD = ${sc.PD}`, color: COL.ink },
          { label: L.labExtra, value: money(cost), color: COL.ac },
          { label: fill(L.labSpit, { w }), value: Math.abs(spitA - spitB) < 0.0005 ? n3(spitA) : `${n3(spitB)} → ${n3(spitA)}`, color: COL.es },
        ]));
        let expl;
        if (S.x === 'none') expl = [fill(L.labNoAct, { rd: sc.RD })];
        else if (sc.critical.includes(S.x)) {
          expl = [fill(L.labCrit, { name: nameOf(S.x), rd: after.RD, c: money(cost) })];
          if (Math.abs(spitA - spitB) < 0.01) expl.push(L.labCritLater);
        } else expl = [fill(L.labNonCrit, { name: nameOf(S.x), a: n3(spitB), b: n3(spitA), rd: after.RD, c: money(cost) })];
        res.append(K.aside(null, expl.map((x) => K.p(x))));
        const row = K.el('div', 'btn-row'); row.append(again);
        lab.push(res, row);
      }
      // La pregunta da una pista del resultado: solo aparece después de elegir.
      if (S.x !== null) lab.push(think(L, L.q5, L.a5));
      container.append(K.step(3, L.s3lab, lab));

      // ---- 4. Factor P
      const p3 = projectFor(S.e3);
      const N3 = E.reportedPeriods(p3);
      const at3 = Math.max(1, Math.min(N3, S.at3));
      const pf = A.pFactor(p3, at3);
      const ctl3 = K.el('div', 'controls adv-controls');
      ctl3.append(
        select('advE3', L.project, S.e3, exOptions, (v) => change({ e3: v }, 'advE3')),
        range('advAT3', L.at, at3, 1, N3, (v) => `AT = ${v}`, (v) => change({ at3: v }, 'advAT3')),
      );
      const pt = K.el('table', 'mini-table cmp adv-table');
      const ph = pt.createTHead().insertRow();
      for (const h of L.s3Table) ph.append(K.el('th', null, h));
      const pb = pt.createTBody();
      for (const r of pf.rows) {
        const row = pb.insertRow();
        row.insertCell().textContent = `${r.id} · ${r.name[lang]}`;
        for (const k of ['pvEs', 'ev', 'matched', 'ahead', 'behind']) {
          const c = row.insertCell();
          c.textContent = r[k] < 0.5 && (k === 'ahead' || k === 'behind') ? '—' : money(r[k]);
          if ((k === 'ahead' || k === 'behind') && r[k] >= 0.5) c.className = `adv-${k}`;
        }
      }
      const tot = pf.rows.reduce((o, r) => ({ pvEs: o.pvEs + r.pvEs, matched: o.matched + r.matched, ahead: o.ahead + r.ahead, behind: o.behind + r.behind }), { pvEs: 0, matched: 0, ahead: 0, behind: 0 });
      const tw3 = K.el('div', 'table-wrap'); tw3.append(pt);
      const c3 = K.chartBox();
      const pTxt = pf.P === null ? '' : pf.P > 0.995 ? L.p1 : fill(L.pLow, { p: n3(pf.P), a: money(tot.ahead), b: money(tot.behind) });
      container.append(K.step(4, L.s3, [
        K.p(L.s3a),
        K.formulas(L.s3f, pf.P === null ? null : `ES = ${n2(pf.ES)}  →  P = ${money(tot.matched)}/${money(tot.pvEs)} = ${n3(pf.P)}`),
        ctl3,
        tw3,
        K.aside(null, [K.p(pTxt)]),
        c3,
        K.p(L.s3b),
        think(L, L.q3, L.a3),
      ]));
      charts.push(() => {
        const ser = A.pFactorSeries(p3);
        const vals = ser.map((r) => r.P).filter((v) => v !== null);
        const lo = Math.min(0.8, ...vals) - 0.05;
        root.PCLines.render(c3, {
          height: 220, xMax: N3, yMin: lo, yMax: 1.05, yFormat: (v) => F.num(lang, v, 2), ariaLabel: L.s3Aria, xAxisTitle: t(`unit_${p3.unit}`),
          series: [{ key: 'P', color: COL.es, width: 3, endLabel: 'P', points: ser.filter((r) => r.AT <= at3).map((r) => ({ x: r.AT, y: r.P })) }],
          refY: [{ y: 1, label: '1' }],
          at: { x: at3, label: `AT = ${at3}` },
          xHoverMin: 1, xHoverMax: at3,
          tooltip: { title: (x) => `${t(`unitOne_${p3.unit}`)} ${x}`, rows: (x) => [{ label: 'P', color: COL.es, value: n3(ser[x - 1].P) }] },
        });
      });

      // ---- 5. Incertidumbre
      const refs = K.el('ol', 'refs');
      for (const r of root.PCAdvancedText.REFS) {
        const li = K.el('li', null, `${r.text} `);
        const a = K.el('a', null, `https://doi.org/${r.doi}`);
        a.href = `https://doi.org/${r.doi}`; a.target = '_blank'; a.rel = 'noopener';
        li.append(a);
        refs.append(li);
      }
      container.append(K.step(5, L.s4, [
        K.p(L.s4a),
        K.list(L.s4list),
        think(L, L.q4, L.a4),
        K.el('h3', 'step-sub', L.s4refs),
        refs,
      ]));

      for (const draw of charts) draw();
      if (focusId) { const n = document.getElementById(focusId); if (n) n.focus(); focusId = null; }
    }

    return { render };
  }

  root.PCModuleAdvanced = { create, params, setFromHash, state: S };
})(this);
