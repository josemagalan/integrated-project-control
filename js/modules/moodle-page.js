/*
 * Página «Preguntas para Moodle»: formulario del generador, descarga del banco en Moodle XML,
 * vista previa de una pregunta e instrucciones de uso. Mismo esquema que en crossover-ga.
 */
(function (root) {
  'use strict';

  const M = root.PCMoodle;

  const text = {
    es: {
      title: 'Bancos de preguntas para Moodle',
      lead: 'Genera preguntas con el mismo motor de cálculo de la herramienta y descárgalas en formato Moodle XML para importarlas en el banco de preguntas de tu curso. Cada pregunta enlaza, en su retroalimentación, con la resolución paso a paso de ese mismo ejercicio.',
      typesTitle: 'Tipos de pregunta',
      calc: 'Calcular indicadores',
      calcHint: 'Enunciado con el Gantt del plan y la tabla de corte en AT; una casilla numérica por indicador, con puntuación parcial y el margen del modo Práctica (±1 %).',
      kind: {
        'calc-evm': 'Valor ganado: PV, EV, AC, SV, CV, CPI, SPI, EAC, ETC, VAC y TCPI',
        'calc-es': 'Programación ganada: C, ES, SV(t), SPI(t) e IEAC(t)',
        'calc-edm': 'Duración ganada: TPD, TED, ED(t), EDI, DPI y EDAC(t)',
        status: 'Estado del proyecto: adelantado o retrasado, y coste del trabajo hecho (signos de SV y CV)',
        tcpi: 'TCPI: más eficiencia necesaria, margen o presupuesto agotado',
        'spi-end': 'SPI al final del proyecto: por qué tiende a 1 y el SPI(t) no',
        'dec-cost': 'Decisión de coste: seguir, mejorar la eficiencia o revisar el EAC (CPI y TCPI)',
        'dec-time': 'Decisión de plazo: seguir, recuperar plazo o replanificar (SPI(t))',
      },
      mc: 'Interpretar (opción múltiple)',
      mcHint: 'Cuatro opciones barajadas; las erróneas restan un tercio (solo con el comportamiento «Retroalimentación diferida»; ver abajo). Cada opción explica por qué es o no correcta.',
      levelsTitle: 'Niveles de dificultad',
      level: { easy: 'Fácil', medium: 'Media', hard: 'Difícil' },
      levelsHint: 'Calcular: los niveles del modo Práctica (de 3–4 actividades con avances del 25 % a 5–7 actividades, avances del 5 % y AT después de PD). Interpretar: en fácil se dan los indicadores o las cantidades; en media, desviaciones más pequeñas; en difícil hay que calcular antes las cantidades (PV, EV, AC, ES).',
      sizeTitle: 'Tamaño',
      count: 'Ejemplares por categoría',
      bankSeed: 'Semilla del banco (opcional)',
      bankSeedHint: 'Déjala vacía para un banco nuevo. Para volver a generar un banco, escribe su semilla (va en el nombre del archivo) y marca los mismos tipos, niveles y tamaño.',
      bankSeedBad: 'La semilla va de 1 a 99 999.',
      summary: (q, c) => `Se generarán ${q} preguntas en ${c} categorías (una por tipo y nivel).`,
      nothing: 'Elige al menos un tipo de pregunta y un nivel.',
      download: 'Descargar banco (Moodle XML)',
      done: (q, s, f) => `Descargado ${f}: ${q} preguntas, semilla del banco ${s}.`,
      missing: (list) => `No se han encontrado bastantes ejemplares distintos para: ${list}.`,
      previewTitle: 'Vista previa',
      previewHint: 'Así se verá una pregunta del banco (sin el estilo de Moodle). La solución y los enlaces van en la retroalimentación.',
      previewSolution: 'Retroalimentación general',
      howTitle: 'Cómo usarlo en Moodle',
      how: [
        'En el curso: Banco de preguntas → Importar → formato «Moodle XML». Se crea una categoría por tipo y nivel dentro de «Control integrado».',
        'En el cuestionario, añade una «pregunta aleatoria» de cada categoría: cada estudiante recibe ejemplares distintos del mismo nivel.',
        'En las opciones de revisión, muestra la «Retroalimentación general» solo «Después de cerrar el cuestionario»: contiene la solución y los enlaces a la resolución paso a paso.',
        'Las casillas numéricas aceptan coma o punto decimal según el idioma del sitio; pide al alumnado que no escriba separador de miles.',
        'Puntuación de «Calcular»: cada casilla vale 1 punto, así que al importar la pregunta vale tantos puntos como casillas (11 en valor ganado, 5 en programación ganada y 6 en duración ganada) y tiene puntuación parcial. En el cuestionario puedes darle otra nota máxima y Moodle la reescala; si quieres que los tres tipos pesen igual, asígnales la misma.',
        'Penalización de «Interpretar»: las opciones erróneas restan un tercio solo con el comportamiento de las preguntas «Retroalimentación diferida». Con otros comportamientos (por ejemplo, «Interactiva con varios intentos» o «Modo adaptativo»), Moodle no da notas negativas en esta pregunta y una respuesta errónea vale 0.',
        'Antes de usarlo en una prueba evaluable, importa el banco en un curso de prueba, responde un intento (bien, mal y en blanco) y revisa la calificación y la retroalimentación.',
        'Si usas Safe Exam Browser, comprueba que los enlaces se puedan abrir durante la revisión.',
      ],
      seedNote: 'El archivo lleva en su nombre la semilla del banco y, al principio, la versión del generador y la selección usada, para poder regenerarlo. El nombre de cada pregunta (que el alumnado no ve) lleva su semilla para reproducir el ejercicio ante una reclamación; en «Calcular», es el número de ejercicio del modo Práctica. La retroalimentación enlaza además con el proyecto completo, que no depende de la versión del generador.',
      file: 'banco-control-integrado',
    },
    en: {
      title: 'Question banks for Moodle',
      lead: 'Generate questions with the same calculation engine used in the tool and download them in Moodle XML format to import them into your course question bank. Each question’s feedback links to the step-by-step solution of that very exercise.',
      typesTitle: 'Question types',
      calc: 'Compute indicators',
      calcHint: 'Statement with the plan’s Gantt chart and the cut-off table at AT; one numeric box per indicator, with partial credit and the Practice mode margin (±1%).',
      kind: {
        'calc-evm': 'Earned value: PV, EV, AC, SV, CV, CPI, SPI, EAC, ETC, VAC and TCPI',
        'calc-es': 'Earned schedule: C, ES, SV(t), SPI(t) and IEAC(t)',
        'calc-edm': 'Earned duration: TPD, TED, ED(t), EDI, DPI and EDAC(t)',
        status: 'Project status: ahead or behind, and cost of the work done (signs of SV and CV)',
        tcpi: 'TCPI: better efficiency needed, room left or budget exhausted',
        'spi-end': 'SPI at the end of the project: why it tends to 1 and SPI(t) does not',
        'dec-cost': 'Cost decision: carry on, improve efficiency or revise the EAC (CPI and TCPI)',
        'dec-time': 'Schedule decision: carry on, recover time or replan (SPI(t))',
      },
      mc: 'Interpret (multiple choice)',
      mcHint: 'Four shuffled options; wrong answers deduct one third (only with the “Deferred feedback” behaviour; see below). Each option explains why it is right or wrong.',
      levelsTitle: 'Difficulty levels',
      level: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
      levelsHint: 'Compute: the Practice mode levels (from 3–4 activities with 25% progress steps to 5–7 activities, 5% steps and AT after PD). Interpret: easy gives the indicators or amounts; medium, smaller deviations; hard requires computing the amounts first (PV, EV, AC, ES).',
      sizeTitle: 'Size',
      count: 'Instances per category',
      bankSeed: 'Bank seed (optional)',
      bankSeedHint: 'Leave it empty for a new bank. To regenerate a bank, type its seed (it is in the file name) and tick the same types, levels and size.',
      bankSeedBad: 'The seed goes from 1 to 99,999.',
      summary: (q, c) => `${q} questions will be generated in ${c} categories (one per type and level).`,
      nothing: 'Choose at least one question type and one level.',
      download: 'Download bank (Moodle XML)',
      done: (q, s, f) => `Downloaded ${f}: ${q} questions, bank seed ${s}.`,
      missing: (list) => `Not enough distinct instances were found for: ${list}.`,
      previewTitle: 'Preview',
      previewHint: 'This is how a question from the bank will look (without Moodle’s styling). The solution and the links go in the feedback.',
      previewSolution: 'General feedback',
      howTitle: 'How to use it in Moodle',
      how: [
        'In the course: Question bank → Import → “Moodle XML” format. One category per type and level is created under “Integrated control”.',
        'In the quiz, add a “random question” from each category: each student gets different instances of the same level.',
        'In the review options, show the “General feedback” only “After the quiz is closed”: it contains the solution and the links to the step-by-step solution.',
        'Numeric boxes accept a decimal comma or point depending on the site language; ask students not to type a thousands separator.',
        '“Compute” marks: each box is worth 1 mark, so on import the question is worth as many marks as boxes (11 for earned value, 5 for earned schedule and 6 for earned duration), with partial credit. In the quiz you can give it another maximum mark and Moodle rescales it; give the three types the same mark if they should weigh the same.',
        '“Interpret” penalty: wrong options deduct one third only with the “Deferred feedback” question behaviour. With other behaviours (for example, “Interactive with multiple tries” or “Adaptive mode”), Moodle gives no negative marks for this question and a wrong answer scores 0.',
        'Before using it in a graded quiz, import the bank into a test course, submit an attempt (right, wrong and blank answers) and check the grades and the feedback.',
        'If you use Safe Exam Browser, check that the links can be opened during the review.',
      ],
      seedNote: 'The file name carries the bank seed, and the file starts with the generator version and the selection used, so it can be regenerated. Each question’s name (hidden from students) includes its seed, to reproduce the exercise if a student queries the mark; in “Compute”, it is the Practice mode exercise number. The feedback also links to the full project, which does not depend on the generator version.',
      file: 'integrated-control-bank',
    },
  };

  // Selección del formulario: se conserva al cambiar de idioma o volver a la página.
  const sel = { kinds: new Set(['calc-evm', 'calc-es', 'calc-edm', 'status', 'tcpi', 'spi-end', 'dec-cost', 'dec-time']), levels: new Set(['medium']), count: 10, seed: '' };
  let last = null; // { lang, text } del último resultado mostrado

  function node(tag, cls, content) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (content != null) e.textContent = content;
    return e;
  }

  function check(label, checked, onChange) {
    const l = node('label', 'mq-check');
    const i = node('input');
    i.type = 'checkbox';
    i.checked = checked;
    i.addEventListener('change', () => onChange(i.checked));
    l.append(i, node('span', null, label));
    return l;
  }

  function numberField(label, value, min, max, onChange) {
    const l = node('label', 'mq-num');
    const i = node('input');
    i.type = 'number'; i.min = String(min); i.max = String(max); i.step = '1'; i.value = String(value);
    i.addEventListener('change', () => {
      const v = Math.max(min, Math.min(max, Math.round(Number(i.value)) || value));
      i.value = String(v);
      onChange(v);
    });
    l.append(node('span', null, label), i);
    return l;
  }

  /** Semilla opcional del banco: vacía = aleatoria. */
  function seedField(L) {
    const l = node('label', 'mq-num');
    const i = node('input');
    i.type = 'text'; i.inputMode = 'numeric'; i.autocomplete = 'off'; i.value = sel.seed; i.size = 7;
    i.addEventListener('input', () => { sel.seed = i.value; });
    l.append(node('span', null, L.bankSeed), i);
    return l;
  }

  function group(title, hint, items) {
    const f = node('fieldset', 'mq-group');
    f.append(node('legend', null, title));
    if (hint) f.append(node('p', 'hint', hint));
    const box = node('div', 'mq-items');
    box.append(...items);
    f.append(box);
    return f;
  }

  function download(name, content) {
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = node('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function render(container, lang) {
    const L = text[lang] || text.es;
    const levels = () => M.LEVELS.filter((lv) => sel.levels.has(lv));
    const kinds = () => M.KINDS.map((k) => k.id).filter((k) => sel.kinds.has(k));

    const summary = node('p', 'mq-summary');
    const btn = node('button', 'btn primary', L.download);
    btn.type = 'button';
    const status = node('p', 'mq-status');
    status.setAttribute('role', 'status');
    const preview = node('div', 'mq-preview');

    function renderPreview() {
      // Ejemplar fijo para la vista previa: el primer tipo marcado, en el nivel más bajo marcado.
      preview.replaceChildren();
      const ks = kinds(); const lv = levels();
      if (!ks.length || !lv.length) return;
      const q = M.generate({ lang, kinds: [ks[0]], levels: [lv[0]], count: 1, seed: 1 }).questions[0];
      if (!q) return;
      const qt = node('div', 'mq-qtext');
      qt.innerHTML = M.previewHtml(q);
      if (q.qtype === 'multichoice') {
        const ol = node('ol', 'mq-options');
        q.options.forEach((o) => { const li = node('li'); li.innerHTML = o.text; ol.append(li); });
        qt.append(ol);
      }
      const fb = node('details', 'mq-feedback');
      const body = node('div');
      body.innerHTML = q.general;
      fb.append(node('summary', null, L.previewSolution), body);
      preview.append(node('p', 'mq-qname', q.name), qt, fb);
    }

    function refresh() {
      const cats = kinds().length * levels().length;
      summary.textContent = cats ? L.summary(cats * sel.count, cats) : L.nothing;
      btn.disabled = !cats;
      renderPreview();
    }

    const kindCheck = (k) => check(L.kind[k.id], sel.kinds.has(k.id), (on) => {
      if (on) sel.kinds.add(k.id); else sel.kinds.delete(k.id);
      refresh();
    });
    const calcItems = M.KINDS.filter((k) => k.type === 'calc').map(kindCheck);
    const mcItems = M.KINDS.filter((k) => k.type !== 'calc').map(kindCheck);
    const levelItems = M.LEVELS.map((lv) => check(L.level[lv], sel.levels.has(lv), (on) => {
      if (on) sel.levels.add(lv); else sel.levels.delete(lv);
      refresh();
    }));

    btn.addEventListener('click', () => {
      const raw = String(sel.seed).trim();
      const seed = raw === '' ? undefined : root.PCPractice.normalizeSeed(raw);
      if (seed === null) { status.textContent = L.bankSeedBad; return; }
      const r = M.generate({ lang, kinds: kinds(), levels: levels(), count: sel.count, seed });
      const date = new Date().toISOString().slice(0, 10);
      const file = `${L.file}-${date}-s${r.seed}.xml`;
      download(file, M.toXml(r));
      let msg = L.done(r.questions.length, r.seed, file);
      if (r.missing.length) {
        const list = r.missing.map((m) => `${L.kind[m.kind].split(':')[0]} · ${L.level[m.level]} (${m.made}/${m.wanted})`).join('; ');
        msg += ` ${L.missing(list)}`;
      }
      last = { lang, text: msg };
      status.textContent = msg;
    });

    const how = node('ol', 'mq-how');
    L.how.forEach((h) => how.append(node('li', null, h)));

    const form = node('div', 'mq-form');
    form.append(
      node('h2', null, L.typesTitle),
      group(L.calc, L.calcHint, calcItems),
      group(L.mc, L.mcHint, mcItems),
      group(L.levelsTitle, L.levelsHint, levelItems),
      group(L.sizeTitle, L.bankSeedHint, [numberField(L.count, sel.count, 1, 50, (v) => { sel.count = v; refresh(); }), seedField(L)]),
    );
    const actions = node('div', 'mq-actions');
    actions.append(summary, btn, status);
    if (last && last.lang === lang) status.textContent = last.text;

    const sec = (title, ...kids) => { const s = node('section', 'about-section'); s.append(node('h2', null, title), ...kids); return s; };
    container.replaceChildren(
      node('h1', null, L.title),
      node('p', 'lead', L.lead),
      form,
      actions,
      sec(L.previewTitle, node('p', 'hint', L.previewHint), preview),
      sec(L.howTitle, how, node('p', 'hint', L.seedNote)),
    );
    refresh();
  }

  root.PCMoodlePage = { render, text };
})(this);
