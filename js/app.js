/*
 * Router de la herramienta: portada, módulos por metodología (con el editor del proyecto) y
 * comparativa en el tiempo. El estado completo vive en la URL (#v=…&lang=…&p=…|c=…&at=…).
 */
(function () {
  'use strict';

  const E = window.PCEngine;
  const P = window.PCProject;
  const I = window.PCI18n;

  const VIEWS = ['home', 'evm', 'es', 'edm', 'compare', 'practice', 'adv', 'about', 'moodle'];
  const MODULES = {
    evm: { title: 'modEvmTitle', lead: 'modEvmLead', render: (c, a) => window.PCModuleEVM.render(c, a) },
    es: { title: 'modEsTitle', lead: 'modEsLead', render: (c, a) => (window.PCModuleES ? window.PCModuleES.render(c, a) : soon(c, a)) },
    edm: { title: 'modEdmTitle', lead: 'modEdmLead', render: (c, a) => (window.PCModuleEDM ? window.PCModuleEDM.render(c, a) : soon(c, a)) },
  };

  const state = { lang: 'es', view: 'home', project: P.fromExample('late'), AT: 6, extra: {}, practice: { seed: 1, level: 'medium', blocks: ['evm', 'es', 'edm'], gen: null } };
  const $ = (id) => document.getElementById(id);
  const t = (key, params) => I.t(state.lang, key, params);

  function soon(c) {
    c.textContent = '';
    const card = document.createElement('section');
    card.className = 'card';
    card.textContent = t('comingSoon');
    c.append(card);
  }

  // ---- URL ---------------------------------------------------------------------

  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (I.languages.includes(h.get('lang'))) state.lang = h.get('lang');
    state.view = VIEWS.includes(h.get('v')) ? h.get('v') : (h.get('p') ? 'compare' : 'home');
    const at = parseInt(h.get('at'), 10);
    let project = null;
    if (h.get('c')) project = P.decode(h.get('c'), Number.isInteger(at) && at > 0 ? at : 1);
    if (!project && h.get('p')) project = P.fromExample(h.get('p'));
    if (project) state.project = project;
    const r = P.atRange(state.project);
    // Las páginas sin proyecto en la URL (Acerca de, Moodle, Práctica) conservan el proyecto y la
    // fecha de control en memoria; la fecha por defecto solo se aplica al cargar o al cambiar de proyecto.
    if (Number.isInteger(at)) state.AT = Math.max(r.min, Math.min(r.max, at));
    else if (project || !state.started) state.AT = Math.min(r.max, Math.max(1, Math.round(E.plannedDuration(state.project) * 0.6)));
    else state.AT = Math.max(r.min, Math.min(r.max, state.AT));
    state.started = true;
    state.extra = { pf: h.get('pf'), tab: h.get('tab') };
    const seed = window.PCPractice.normalizeSeed(h.get('seed'));
    if (seed !== null) state.practice.seed = seed;
    if (['easy', 'medium', 'hard'].includes(h.get('lvl'))) state.practice.level = h.get('lvl');
    // Versión del generador con que se creó el enlace (null si no la lleva).
    state.practice.gen = h.get('v') === 'practice' && h.get('g') !== null ? h.get('g') : null;
    if (h.get('b') !== null) state.practice.blocks = h.get('b').split('.').filter((b) => ['evm', 'es', 'edm'].includes(b));
    if (state.view === 'adv') window.PCModuleAdvanced.setFromHash(h);
    state.rawHash = h;
    return h;
  }

  function hashFor(view, project = state.project, AT = state.AT) {
    const h = new URLSearchParams({ v: view, lang: state.lang });
    if (view === 'about' || view === 'moodle') return `#${h}`;
    if (view === 'adv') {
      const ap = window.PCModuleAdvanced.params();
      for (const k of Object.keys(ap)) h.set(k, ap[k]);
      return `#${h}`;
    }
    if (view === 'practice') {
      h.set('seed', state.practice.seed); h.set('lvl', state.practice.level); h.set('b', state.practice.blocks.join('.'));
      h.set('g', state.practice.gen !== null ? state.practice.gen : window.PCPractice.GENERATOR);
      return `#${h}`;
    }
    if (project.source === 'custom') h.set('c', P.encode(project, AT));
    else h.set('p', project.exampleId);
    h.set('at', AT);
    if (view === 'compare') {
      const cp = window.PCCompare.params();
      // Al entrar desde un módulo con un ejemplo, la comparativa abre ese ejemplo en esa fecha.
      const fromModule = state.view !== 'compare' && project.historyKnown;
      h.set('p', fromModule ? project.exampleId : cp.p);
      h.set('at', fromModule ? AT : cp.at);
      h.set('pf', cp.pf); h.set('tab', cp.tab);
      h.delete('c');
    }
    return `#${h}`;
  }

  function writeHash() {
    history.replaceState(null, '', hashFor(state.view));
  }

  // ---- Dibujo ------------------------------------------------------------------

  function applyStaticText() {
    document.documentElement.lang = state.lang;
    document.title = t('docTitle');
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    $('modnav').setAttribute('aria-label', t('navModules'));
  }

  let editor = null;
  let practice = null;
  let advanced = null;

  function renderModule() {
    const mod = MODULES[state.view];
    $('modTitle').textContent = t(mod.title);
    $('modLead').textContent = t(mod.lead);
    editor.render();
    mod.render($('modBody'), {
      project: state.project, AT: state.AT, lang: state.lang, t,
      go: (v) => { location.hash = hashFor(v); },
    });
  }

  /** Los enlaces llevan el proyecto y la fecha actuales. */
  function updateLinks() {
    document.querySelectorAll('#modnav a').forEach((a) => {
      if (a.dataset.v === state.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      a.href = hashFor(a.dataset.v);
    });
    document.querySelectorAll('.mod-card').forEach((a) => { a.href = hashFor(a.dataset.v); });
    document.querySelector('.brand').href = hashFor('home');
    document.querySelectorAll('[data-back]').forEach((a) => { a.href = hashFor('home'); });
  }

  function render() {
    const v = state.view;
    $('homeView').hidden = v !== 'home';
    $('moduleView').hidden = !MODULES[v];
    $('compareView').hidden = v !== 'compare';
    $('practiceView').hidden = v !== 'practice';
    $('advView').hidden = v !== 'adv';
    $('aboutView').hidden = v !== 'about';
    $('moodleView').hidden = v !== 'moodle';
    $('refs').hidden = v === 'about' || v === 'moodle';
    if (v === 'practice') practice.render();
    if (v === 'adv') advanced.render();
    if (v === 'about') window.PCAbout.renderAbout($('aboutBody'), state.lang);
    if (v === 'moodle') window.PCMoodlePage.render($('moodleBody'), state.lang);
    window.PCAbout.renderFooter($('siteFoot'), state.lang);
    updateLinks();
    if (v !== 'compare') window.PCCompare.hide();
    if (MODULES[v]) renderModule();
    if (v === 'compare') {
      // Los parámetros de la comparativa salen de la URL leída, no de la reescrita.
      const h = state.rawHash ? new URLSearchParams(state.rawHash) : new URLSearchParams({ v: 'compare', ...window.PCCompare.params() });
      state.rawHash = null;
      if (!h.get('p') || h.get('v') !== 'compare') {
        h.set('p', state.project.exampleId || 'late');
        if (state.project.historyKnown) h.set('at', state.AT); else h.delete('at');
      }
      h.set('lang', state.lang);
      window.PCCompare.show(h);
    }
  }

  function set(changes) {
    if (changes.project) state.project = changes.project;
    if (changes.AT !== undefined) state.AT = changes.AT;
    if (!state.project.historyKnown) state.project = P.withAT(state.project, state.AT);
    const r = P.atRange(state.project);
    state.AT = Math.max(r.min, Math.min(r.max, state.AT));
    writeHash();
    updateLinks();
    renderModule();
  }

  function init() {
    readHash();
    editor = window.PCEditor.create($('editor'), {
      t, lang: () => state.lang, get: () => ({ project: state.project, AT: state.AT }), set,
      link: () => location.href,
    });
    practice = window.PCModulePractice.create($('practiceBody'), {
      t, lang: () => state.lang, get: () => state.practice,
      set: (c) => { Object.assign(state.practice, c, c.seed !== undefined || c.level !== undefined ? { gen: null } : {}); writeHash(); updateLinks(); practice.render(); },
      link: () => location.href,
      hashFor: (v, project, AT) => hashFor(v, project, AT),
    });
    advanced = window.PCModuleAdvanced.create($('advBody'), {
      t, lang: () => state.lang, onChange: () => { writeHash(); updateLinks(); },
    });
    window.PCCompare.init({ onChange: () => { if (state.view === 'compare') { writeHash(); updateLinks(); } } });
    document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      applyStaticText();
      writeHash();
      render();
    }));
    // Tras navegar, la URL se reescribe completa (proyecto, AT, versión del generador) para que el enlace copiado sea reproducible.
    window.addEventListener('hashchange', () => { readHash(); applyStaticText(); render(); writeHash(); window.scrollTo(0, 0); });
    let timer = null;
    let lastW = document.querySelector('.wrap').clientWidth;
    new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w === lastW) return;
      lastW = w;
      clearTimeout(timer);
      timer = setTimeout(render, 120);
    }).observe(document.querySelector('.wrap'));
    applyStaticText();
    render();
    writeHash();
  }

  init();
})();
