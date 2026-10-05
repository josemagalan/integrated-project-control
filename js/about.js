/*
 * Página «Acerca de» y pie común: autores, filiaciones, escudos, cómo citar, licencias y
 * agradecimientos. Mismo esquema que crossover-ga.
 */
(function (root) {
  'use strict';

  const REPO = 'https://github.com/josemagalan/integrated-project-control';

  const authors = [
    { name: 'José Manuel Galán', aff: [1] },
    { name: 'Silvia Díaz-de la Fuente', aff: [2] },
    { name: 'Virginia Ahedo', aff: [1] },
    { name: 'María Pereda', aff: [3] },
    { name: 'José Ignacio Santos', aff: [1] },
  ];

  const affiliations = {
    es: ['Universidad de Burgos', 'Universidad de Salamanca', 'Universidad Politécnica de Madrid'],
    en: ['University of Burgos', 'University of Salamanca', 'Technical University of Madrid (UPM)'],
  };

  // Escudos: la UBU, institución principal, primero y algo mayor.
  const logos = [
    { src: 'img/logos/ubu.png', alt: 'Universidad de Burgos', href: 'https://www.ubu.es', main: true },
    { src: 'img/logos/usal.png', alt: 'Universidad de Salamanca', href: 'https://www.usal.es' },
    { src: 'img/logos/upm.png', alt: 'Universidad Politécnica de Madrid', href: 'https://www.upm.es' },
    { src: 'img/logos/goonies.png', alt: 'Los Goonies · Group of Organization and Industrial Engineering and Simulation', href: null },
  ];

  const text = {
    es: {
      title: 'Acerca de esta herramienta',
      lead: 'Herramienta docente interactiva para aprender el control integrado de proyectos: valor ganado (EVM), programación ganada (ES) y duración ganada (EDM) sobre un mismo proyecto editable, con su comparativa en el tiempo, un módulo para profundizar, ejercicios de práctica corregidos y bancos de preguntas para Moodle.',
      authorsTitle: 'Autores',
      group: 'Todos los autores forman parte del grupo de investigación Los Goonies (Group of Organization and Industrial Engineering and Simulation).',
      citeTitle: 'Cómo citar',
      cite: 'Si quieres citar esta herramienta, ponte en contacto con los autores.',
      codeTitle: 'Código y licencias',
      code: 'El código fuente está en GitHub. El código se publica con licencia MIT y los textos docentes (explicaciones, narración de los pasos, enunciados y retroalimentación de las preguntas), con licencia CC BY 4.0. D3.js tiene licencia ISC.',
      repo: 'Repositorio en GitHub',
      thanksTitle: 'Agradecimientos',
      thanks: 'Agradecemos al programa Claude for Science de Anthropic su apoyo al desarrollo de esta herramienta, que se ha realizado con la ayuda de Claude.',
      foot: 'Acerca de',
      footMoodle: 'Preguntas para Moodle',
      footLicence: 'Código MIT · Textos CC BY 4.0',
      back: 'Volver al inicio',
    },
    en: {
      title: 'About this tool',
      lead: 'Interactive teaching tool to learn integrated project control: earned value (EVM), earned schedule (ES) and earned duration (EDM) on the same editable project, with their comparison over time, a module for going further, graded practice exercises and question banks for Moodle.',
      authorsTitle: 'Authors',
      group: 'All authors are members of the Los Goonies research group (Group of Organization and Industrial Engineering and Simulation).',
      citeTitle: 'How to cite',
      cite: 'If you would like to cite this tool, please contact the authors.',
      codeTitle: 'Code and licences',
      code: 'The source code is on GitHub. The code is released under the MIT licence and the teaching texts (explanations, step narration, question statements and feedback) under CC BY 4.0. D3.js is ISC-licensed.',
      repo: 'GitHub repository',
      thanksTitle: 'Acknowledgements',
      thanks: 'We thank Anthropic’s Claude for Science programme for supporting the development of this tool, which was built with the help of Claude.',
      foot: 'About',
      footMoodle: 'Moodle questions',
      footLicence: 'Code MIT · Texts CC BY 4.0',
      back: 'Back to home',
    },
  };

  function node(tag, cls, content) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (content != null) e.textContent = content;
    return e;
  }

  function authorLine(withAff) {
    const p = node('p', 'about-authors');
    authors.forEach((a, i) => {
      if (i) p.append(document.createTextNode(' · '));
      p.append(document.createTextNode(a.name));
      if (withAff) p.append(node('sup', null, a.aff.join(',')));
    });
    return p;
  }

  function logoRow(cls) {
    const row = node('div', cls);
    logos.forEach((l) => {
      const img = node('img');
      img.src = l.src;
      img.alt = l.alt;
      img.title = l.alt;
      img.loading = 'lazy';
      if (l.main) img.className = 'main';
      if (l.href) {
        const a = node('a');
        a.href = l.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.append(img);
        row.append(a);
      } else row.append(img);
    });
    return row;
  }

  function section(title, ...children) {
    const s = node('section', 'about-section');
    s.append(node('h2', null, title), ...children);
    return s;
  }

  function renderAbout(container, lang) {
    const T = text[lang] || text.es;
    const affs = node('p', 'about-affs');
    (affiliations[lang] || affiliations.es).forEach((a, i) => {
      if (i) affs.append(document.createTextNode(' · '));
      affs.append(node('sup', null, String(i + 1)), document.createTextNode(` ${a}`));
    });
    const repo = node('a', null, T.repo);
    repo.href = REPO;
    const codeP = node('p', null, `${T.code} `);
    codeP.append(repo, document.createTextNode('.'));
    container.replaceChildren(
      node('h1', null, T.title),
      node('p', 'lead', T.lead),
      section(T.authorsTitle, authorLine(true), affs, node('p', null, T.group)),
      logoRow('about-logos'),
      section(T.citeTitle, node('p', null, T.cite)),
      section(T.codeTitle, codeP),
      section(T.thanksTitle, node('p', null, T.thanks)),
    );
  }

  function renderFooter(container, lang) {
    const T = text[lang] || text.es;
    const info = node('div', 'site-foot-info');
    info.append(authorLine(false));
    const links = node('p', 'site-foot-links');
    const about = node('a', null, T.foot);
    about.href = `#v=about&lang=${lang}`;
    const moodle = node('a', null, T.footMoodle);
    moodle.href = `#v=moodle&lang=${lang}`;
    const gh = node('a', null, 'GitHub');
    gh.href = REPO;
    links.append(about, document.createTextNode(' · '), moodle, document.createTextNode(' · '), gh, document.createTextNode(` · ${T.footLicence}`));
    info.append(links);
    container.replaceChildren(logoRow('site-foot-logos'), info);
  }

  root.PCAbout = { renderAbout, renderFooter, authors, affiliations, text, REPO };
})(this);
