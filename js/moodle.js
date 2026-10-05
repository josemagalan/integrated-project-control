/*
 * Generador de bancos de preguntas para Moodle (formato Moodle XML).
 *
 * Las preguntas se construyen con el mismo motor y el mismo generador de ejercicios que la
 * herramienta, así que la respuesta guardada es la que calcula el motor. La retroalimentación
 * general da la solución paso a paso y enlaza a la web publicada con el ejercicio cargado.
 *
 * Tipos:
 *  - «Calcular indicadores» (cloze, una casilla numérica por indicador, con el margen del modo
 *    Práctica): valor ganado, programación ganada o duración ganada.
 *  - «Interpretar» (opción múltiple; las erróneas restan un tercio): estado del proyecto (SV y CV),
 *    qué indica el TCPI y por qué el SPI engaña al final del proyecto.
 * Niveles: fácil, media y difícil.
 *
 * El nombre de cada pregunta (que el alumno no ve) lleva su semilla, para reproducirla. La semilla
 * base del banco es aleatoria en cada exportación.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./core/engine.js') : root.PCEngine;
  const PR = isNode ? require('./core/practice.js') : root.PCPractice;
  const P = isNode ? require('./core/project.js') : root.PCProject;
  const F = isNode ? require('./format.js') : root.PCFormat;
  const N = isNode ? require('./narration.js') : root.PCNarration;
  const I = isNode ? require('./i18n.js') : root.PCI18n;

  const APP = 'https://josemagalan.github.io/integrated-project-control/';
  const LEVELS = ['easy', 'medium', 'hard'];
  const MAX_TRIES = 4000;

  const KINDS = [
    { id: 'calc-evm', type: 'calc', block: 'evm' },
    { id: 'calc-es', type: 'calc', block: 'es' },
    { id: 'calc-edm', type: 'calc', block: 'edm' },
    { id: 'status', type: 'interpret' },
    { id: 'tcpi', type: 'interpret' },
    { id: 'spi-end', type: 'interpret' },
    { id: 'dec-cost', type: 'interpret' },
    { id: 'dec-time', type: 'interpret' },
  ];
  const kindById = (id) => KINDS.find((k) => k.id === id);

  const LABELS = { SVt: 'SV(t)', SPIt: 'SPI(t)', IEAC: 'IEAC(t)', EDt: 'ED(t)', EDAC: 'EDAC(t)', C: 'C', TPD: 'TPD(AT)', TED: 'TED(AT)' };

  // ---------- Textos ----------

  const T = {
    es: {
      root: 'Control integrado',
      level: { easy: 'Fácil', medium: 'Media', hard: 'Difícil' },
      type: { calc: 'Calcular indicadores', interpret: 'Interpretar' },
      kind: {
        'calc-evm': 'Valor ganado', 'calc-es': 'Programación ganada', 'calc-edm': 'Duración ganada',
        status: 'Estado del proyecto', tcpi: 'TCPI', 'spi-end': 'SPI al final del proyecto', 'dec-cost': 'Decisión de coste', 'dec-time': 'Decisión de plazo',
      },
      units: { day: 'días', week: 'semanas', month: 'meses' },
      unitOne: { day: 'día', week: 'semana', month: 'mes' },
      stmt: (n, units, at, pd) => `<p>Un proyecto tiene ${n} actividades. El tiempo se mide en ${units}. Cada actividad reparte su presupuesto por igual a lo largo de su duración. En la fecha de control, <strong>AT = ${at}</strong>, el avance y el coste real acumulado son los de la tabla. Duración planificada del proyecto: <strong>PD = ${pd} ${units}</strong>.</p>`,
      ganttCap: (unit) => `Plan por ${unit} (casillas sombreadas); la raya roja marca el final de AT.`,
      cols: (unit) => ['Actividad', `Empieza (${unit})`, 'Duración', 'Presupuesto', '% completado', 'AC acumulado'],
      calcAsk: {
        evm: '<p>Calcula los indicadores de valor ganado en AT.</p>',
        es: '<p>Calcula los indicadores de programación ganada en AT. C es el último periodo con PV(C) ≤ EV.</p>',
        edm: '<p>Calcula los indicadores de duración ganada en AT (TPD y TED en unidades de duración).</p>',
      },
      howTo: 'Escribe solo el número, sin separador de miles ni unidades (por ejemplo, 12900 o 0,915). Se acepta un margen de ±1 % (como mínimo ±1 € en importes y ±0,005 en índices). Usa EAC = BAC/CPI, IEAC(t) = PD/SPI(t) y EDAC(t) = PD/DPI.',
      solTitle: 'Solución',
      stepTitle: 'Paso a paso',
      linkModule: 'Ver la resolución paso a paso en la herramienta',
      linkPractice: 'Repetir este ejercicio en el modo Práctica (con corrección casilla a casilla)',
      statusGiven: (at, units, pv, ev, ac) => `<p>En la fecha de control (AT = ${at} ${units}) un proyecto tiene <strong>PV = ${pv}</strong>, <strong>EV = ${ev}</strong> y <strong>AC = ${ac}</strong>.</p>`,
      statusCompute: '<p>Calcula PV, EV y AC en AT.</p>',
      statusQ: '<p>¿Cómo va el proyecto?</p>',
      quad: {
        aheadUnder: 'Adelantado, y el trabajo hecho ha costado menos de lo presupuestado',
        aheadOver: 'Adelantado, y el trabajo hecho ha costado más de lo presupuestado',
        behindUnder: 'Retrasado, y el trabajo hecho ha costado menos de lo presupuestado',
        behindOver: 'Retrasado, y el trabajo hecho ha costado más de lo presupuestado',
      },
      quadFb: (sv, cv) => `SV = EV − PV = ${sv} y CV = EV − AC = ${cv}.`,
      quadOk: 'Correcto. ',
      quadWrongS: 'El plazo no es ese: mira el signo de SV. ',
      quadWrongC: 'El coste no es ese: mira el signo de CV (compara EV con AC, no PV con AC). ',
      quadWrongB: 'Ni el plazo ni el coste: mira los signos de SV y CV. ',
      statusGeneral: (sv, cv, spi, cpi) => `<p>SV = EV − PV = ${sv} (SPI = ${spi}) y CV = EV − AC = ${cv} (CPI = ${cpi}). SV positiva significa adelanto; CV positiva, que el trabajo hecho ha costado menos de lo presupuestado.</p>`,
      tcpiGiven: (bac, ev, ac) => `<p>Un proyecto tiene un presupuesto <strong>BAC = ${bac}</strong>. En la fecha de control, <strong>EV = ${ev}</strong> y <strong>AC = ${ac}</strong>.</p>`,
      tcpiGivenHard: (bac, pct, cpi) => `<p>Un proyecto tiene un presupuesto <strong>BAC = ${bac}</strong>. En la fecha de control lleva hecho un <strong>${pct}</strong> del trabajo (EV/BAC) con un <strong>CPI = ${cpi}</strong>.</p>`,
      tcpiQ: '<p>Calcula el TCPI = (BAC − EV)/(BAC − AC). ¿Qué conclusión es correcta?</p>',
      tcpiOpt: {
        hard: 'Para terminar en el BAC, el trabajo pendiente tendría que hacerse con más eficiencia de coste que la presupuestada (TCPI > 1).',
        easy: 'Queda más presupuesto que trabajo pendiente: hay margen para terminar dentro del BAC (TCPI < 1).',
        exhausted: 'El gasto ya alcanza o supera el BAC: terminar en el BAC es imposible y el TCPI hay que calcularlo respecto a un nuevo EAC.',
        negative: 'El TCPI sale negativo, lo que indica que el proyecto va mejor de lo previsto.',
      },
      tcpiVal: (v) => `TCPI = ${v}.`,
      tcpiNeg: 'Sale negativo porque BAC − AC es negativo: ya no queda presupuesto. No significa que el proyecto vaya mejor.',
      tcpiNotNeg: (v) => `El TCPI vale ${v}; no es negativo.`,
      tcpiConc: {
        hard: 'Con TCPI > 1, el trabajo que falta tendría que costar menos de lo presupuestado para no pasarse del BAC.',
        easy: 'Con TCPI < 1, el presupuesto que queda es mayor que el valor del trabajo pendiente.',
        exhausted: (eac, t) => `Como AC ≥ BAC, el TCPI respecto al BAC no tiene sentido. Respecto al EAC = BAC/CPI = ${eac}: TCPI = (BAC − EV)/(EAC − AC) = ${t}, que coincide con el CPI.`,
      },
      tcpiLink: 'Ver este caso en el módulo de valor ganado (paso 6)',
      spiGivenEasy: (pd, at, units, spi, spit) => `<p>Un proyecto con una duración planificada <strong>PD = ${pd} ${units}</strong> está en <strong>AT = ${at}</strong> y todavía no ha terminado. Su <strong>SPI = ${spi}</strong> y su <strong>SPI(t) = ${spit}</strong>.</p>`,
      spiGivenMedium: (pd, at, units, bac, pv, ev, es) => `<p>Un proyecto con <strong>BAC = ${bac}</strong> y <strong>PD = ${pd} ${units}</strong> está en <strong>AT = ${at}</strong> y todavía no ha terminado. En AT, <strong>PV = ${pv}</strong>, <strong>EV = ${ev}</strong> y la programación ganada es <strong>ES = ${es}</strong>. Calcula el SPI y el SPI(t).</p>`,
      spiGivenHard: (pd, at, units, ev) => `<p>Un proyecto con <strong>PD = ${pd} ${units}</strong> está en <strong>AT = ${at}</strong> y todavía no ha terminado; su valor ganado es <strong>EV = ${ev}</strong>. La tabla da el PV acumulado al final de cada periodo. Calcula el SPI, la programación ganada (ES) y el SPI(t).</p>`,
      pvRow: 'PV acumulado',
      period: 'Periodo',
      spiQ: '<p>¿Qué conclusión es correcta?</p>',
      spiOpt: {
        ok: 'El retraso es mayor de lo que indica el SPI: al acercarse el final, PV tiende a BAC y el SPI tiende a 1 aunque el proyecto vaya tarde. El SPI(t) mide el retraso en tiempo y es más fiable.',
        onTime: 'El proyecto va casi en plazo, porque el SPI está cerca de 1.',
        exaggerates: 'El SPI(t) exagera el retraso: al medirse en tiempo, penaliza de más los últimos periodos.',
        rounding: 'Los dos índices miden lo mismo; la diferencia se debe solo al redondeo.',
      },
      spiFb: {
        ok: 'Correcto.',
        onTime: (spit) => `No: el SPI(t) = ${spit} muestra que se ha ganado mucho menos tiempo del transcurrido.`,
        exaggerates: 'No: el SPI(t) compara el tiempo ganado con el transcurrido, sin penalizar ningún periodo.',
        rounding: 'No: miden cosas distintas (dinero frente a tiempo) y la diferencia no es de redondeo.',
      },
      spiGeneral: (spi, es, spit, pd, f1, f2) => `<p>SPI = EV/PV = ${spi}; ES = ${es}; SPI(t) = ES/AT = ${spit}. Previsión de la duración: PD/SPI = ${pd}/${spi} = ${f1}, pero PD/SPI(t) = ${pd}/${spit} = ${f2}.</p><p>Cuando AT se acerca a PD o lo supera, PV es casi BAC y el SPI = EV/BAC solo mide el % completado. La programación ganada corrige ese defecto.</p>`,
      spiLink: 'Ver este proyecto en el módulo de programación ganada',
      decCostGivenEasy: (bac, cpi, tcpi) => `<p>Un proyecto tiene un presupuesto <strong>BAC = ${bac}</strong>. En la fecha de control, <strong>CPI = ${cpi}</strong> y <strong>TCPI = ${tcpi}</strong>.</p>`,
      decCostGivenMedium: (bac, ev, ac) => `<p>Un proyecto tiene un presupuesto <strong>BAC = ${bac}</strong>. En la fecha de control, <strong>EV = ${ev}</strong> y <strong>AC = ${ac}</strong>. Calcula el CPI y el TCPI = (BAC − EV)/(BAC − AC).</p>`,
      decCostCompute: '<p>Calcula el CPI y el TCPI = (BAC − EV)/(BAC − AC).</p>',
      decCostRule: '<p>Criterio: con TCPI ≤ 1 basta el ritmo actual; si el TCPI supera al CPI en más de 0,10, la mejora necesaria se considera poco realista. ¿Qué harías?</p>',
      decCostOpt: {
        keepBudget: 'Seguir con el plan: el presupuesto restante basta al ritmo actual.',
        improve: 'Mantener el presupuesto, pero exigir más eficiencia en el trabajo pendiente.',
        rebaseline: 'Revisar la previsión (EAC) y negociar más presupuesto o menos alcance.',
        release: 'Liberar parte del presupuesto: un TCPI mayor que 1 indica que el proyecto va mejor de lo previsto.',
      },
      decCostWhy: (cpi, tcpi) => `CPI = ${cpi} y TCPI = ${tcpi}.`,
      decCostRelease: 'No: el TCPI es la eficiencia que haría falta en el trabajo pendiente; mayor que 1 significa que hay que mejorar, no que sobre dinero.',
      decCostGeneral: (cpi, tcpi, gap) => `<p>CPI = ${cpi}; TCPI = ${tcpi}; TCPI − CPI = ${gap}.</p><p>El TCPI es la eficiencia de coste que necesita el trabajo pendiente para terminar en el BAC. Si es ≤ 1, basta el ritmo presupuestado. Si es mayor que 1 pero cercano al CPI actual, es alcanzable con un esfuerzo moderado. Si lo supera claramente, conviene revisar el EAC y renegociar.</p>`,
      decTimeGivenEasy: (pd, at, units, spit) => `<p>Un proyecto con <strong>PD = ${pd} ${units}</strong> está en <strong>AT = ${at}</strong>. Su <strong>SPI(t) = ${spit}</strong>.</p>`,
      decTimeGivenMedium: (pd, at, units, es) => `<p>Un proyecto con <strong>PD = ${pd} ${units}</strong> está en <strong>AT = ${at}</strong> y su programación ganada es <strong>ES = ${es}</strong>. Calcula el SPI(t).</p>`,
      decTimeCompute: '<p>Calcula la programación ganada ES y el SPI(t).</p>',
      decTimeRule: '<p>Criterio (zonas del semáforo): SPI(t) ≥ 1 satisfactorio; de 0,90 a 1 marginal, recuperable; menor que 0,90 no satisfactorio. ¿Qué harías?</p>',
      decTimeOpt: {
        keepPlan: 'Seguir con el plan: el proyecto va al día o adelantado.',
        recover: 'Recuperar plazo en las actividades que quedan (acelerar o solapar).',
        replan: 'Replanificar e informar del nuevo plazo previsto, IEAC(t) = PD/SPI(t).',
        selfFix: 'Seguir con el plan: al final el SPI vuelve a 1, así que el retraso se corrige solo.',
      },
      decTimeWhy: (spit) => `SPI(t) = ${spit}.`,
      decTimeSelfFix: 'No: el SPI vuelve a 1 al terminar aunque el proyecto acabe tarde; el retraso no se corrige solo.',
      decTimeGeneral: (spit, ieac, pd) => `<p>SPI(t) = ${spit}; previsión IEAC(t) = PD/SPI(t) = ${ieac} frente a PD = ${pd}.</p><p>Con un retraso pequeño todavía se puede recuperar plazo en el trabajo que falta; con uno grande, lo honesto es replanificar y comunicar la nueva fecha.</p>`,
    },
    en: {
      root: 'Integrated control',
      level: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
      type: { calc: 'Compute indicators', interpret: 'Interpret' },
      kind: {
        'calc-evm': 'Earned value', 'calc-es': 'Earned schedule', 'calc-edm': 'Earned duration',
        status: 'Project status', tcpi: 'TCPI', 'spi-end': 'SPI at the end of the project', 'dec-cost': 'Cost decision', 'dec-time': 'Schedule decision',
      },
      units: { day: 'days', week: 'weeks', month: 'months' },
      unitOne: { day: 'day', week: 'week', month: 'month' },
      stmt: (n, units, at, pd) => `<p>A project has ${n} activities. Time is measured in ${units}. Each activity spreads its budget evenly over its duration. At the status date, <strong>AT = ${at}</strong>, progress and cumulative actual cost are those in the table. Planned duration of the project: <strong>PD = ${pd} ${units}</strong>.</p>`,
      ganttCap: (unit) => `Plan by ${unit} (shaded cells); the red line marks the end of AT.`,
      cols: (unit) => ['Activity', `Starts (${unit})`, 'Duration', 'Budget', '% complete', 'Cumulative AC'],
      calcAsk: {
        evm: '<p>Compute the earned value indicators at AT.</p>',
        es: '<p>Compute the earned schedule indicators at AT. C is the last period with PV(C) ≤ EV.</p>',
        edm: '<p>Compute the earned duration indicators at AT (TPD and TED in duration units).</p>',
      },
      howTo: 'Type only the number, with no thousands separator or units (for example, 12900 or 0.915). A margin of ±1% is accepted (at least ±€1 for amounts and ±0.005 for indices). Use EAC = BAC/CPI, IEAC(t) = PD/SPI(t) and EDAC(t) = PD/DPI.',
      solTitle: 'Solution',
      stepTitle: 'Step by step',
      linkModule: 'See the step-by-step solution in the tool',
      linkPractice: 'Redo this exercise in Practice mode (graded box by box)',
      statusGiven: (at, units, pv, ev, ac) => `<p>At the status date (AT = ${at} ${units}) a project has <strong>PV = ${pv}</strong>, <strong>EV = ${ev}</strong> and <strong>AC = ${ac}</strong>.</p>`,
      statusCompute: '<p>Compute PV, EV and AC at AT.</p>',
      statusQ: '<p>How is the project doing?</p>',
      quad: {
        aheadUnder: 'Ahead of schedule, and the work done has cost less than budgeted',
        aheadOver: 'Ahead of schedule, and the work done has cost more than budgeted',
        behindUnder: 'Behind schedule, and the work done has cost less than budgeted',
        behindOver: 'Behind schedule, and the work done has cost more than budgeted',
      },
      quadFb: (sv, cv) => `SV = EV − PV = ${sv} and CV = EV − AC = ${cv}.`,
      quadOk: 'Correct. ',
      quadWrongS: 'Wrong schedule status: look at the sign of SV. ',
      quadWrongC: 'Wrong cost status: look at the sign of CV (compare EV with AC, not PV with AC). ',
      quadWrongB: 'Neither schedule nor cost: look at the signs of SV and CV. ',
      statusGeneral: (sv, cv, spi, cpi) => `<p>SV = EV − PV = ${sv} (SPI = ${spi}) and CV = EV − AC = ${cv} (CPI = ${cpi}). A positive SV means ahead of schedule; a positive CV, that the work done has cost less than budgeted.</p>`,
      tcpiGiven: (bac, ev, ac) => `<p>A project has a budget <strong>BAC = ${bac}</strong>. At the status date, <strong>EV = ${ev}</strong> and <strong>AC = ${ac}</strong>.</p>`,
      tcpiGivenHard: (bac, pct, cpi) => `<p>A project has a budget <strong>BAC = ${bac}</strong>. At the status date it has done <strong>${pct}</strong> of the work (EV/BAC) with <strong>CPI = ${cpi}</strong>.</p>`,
      tcpiQ: '<p>Compute TCPI = (BAC − EV)/(BAC − AC). Which conclusion is correct?</p>',
      tcpiOpt: {
        hard: 'To finish at BAC, the remaining work would have to be done with better cost efficiency than budgeted (TCPI > 1).',
        easy: 'More budget is left than work remains: there is room to finish within BAC (TCPI < 1).',
        exhausted: 'Spending already reaches or exceeds BAC: finishing at BAC is impossible and TCPI must be computed against a new EAC.',
        negative: 'TCPI comes out negative, which means the project is doing better than planned.',
      },
      tcpiVal: (v) => `TCPI = ${v}.`,
      tcpiNeg: 'It is negative because BAC − AC is negative: no budget is left. It does not mean the project is doing better.',
      tcpiNotNeg: (v) => `TCPI is ${v}; it is not negative.`,
      tcpiConc: {
        hard: 'With TCPI > 1, the remaining work would have to cost less than budgeted to stay within BAC.',
        easy: 'With TCPI < 1, the budget left is larger than the value of the remaining work.',
        exhausted: (eac, t) => `Since AC ≥ BAC, TCPI against BAC is meaningless. Against EAC = BAC/CPI = ${eac}: TCPI = (BAC − EV)/(EAC − AC) = ${t}, which equals CPI.`,
      },
      tcpiLink: 'See this case in the earned value module (step 6)',
      spiGivenEasy: (pd, at, units, spi, spit) => `<p>A project with a planned duration <strong>PD = ${pd} ${units}</strong> is at <strong>AT = ${at}</strong> and has not finished yet. Its <strong>SPI = ${spi}</strong> and its <strong>SPI(t) = ${spit}</strong>.</p>`,
      spiGivenMedium: (pd, at, units, bac, pv, ev, es) => `<p>A project with <strong>BAC = ${bac}</strong> and <strong>PD = ${pd} ${units}</strong> is at <strong>AT = ${at}</strong> and has not finished yet. At AT, <strong>PV = ${pv}</strong>, <strong>EV = ${ev}</strong> and the earned schedule is <strong>ES = ${es}</strong>. Compute SPI and SPI(t).</p>`,
      spiGivenHard: (pd, at, units, ev) => `<p>A project with <strong>PD = ${pd} ${units}</strong> is at <strong>AT = ${at}</strong> and has not finished yet; its earned value is <strong>EV = ${ev}</strong>. The table gives cumulative PV at the end of each period. Compute SPI, the earned schedule (ES) and SPI(t).</p>`,
      pvRow: 'Cumulative PV',
      period: 'Period',
      spiQ: '<p>Which conclusion is correct?</p>',
      spiOpt: {
        ok: 'The delay is larger than SPI suggests: near the end, PV tends to BAC and SPI tends to 1 even if the project is late. SPI(t) measures the delay in time and is more reliable.',
        onTime: 'The project is almost on schedule, because SPI is close to 1.',
        exaggerates: 'SPI(t) exaggerates the delay: being measured in time, it over-penalises the last periods.',
        rounding: 'Both indices measure the same thing; the difference is only due to rounding.',
      },
      spiFb: {
        ok: 'Correct.',
        onTime: (spit) => `No: SPI(t) = ${spit} shows that much less time has been earned than has elapsed.`,
        exaggerates: 'No: SPI(t) compares earned time with elapsed time, without penalising any period.',
        rounding: 'No: they measure different things (money versus time) and the gap is not rounding.',
      },
      spiGeneral: (spi, es, spit, pd, f1, f2) => `<p>SPI = EV/PV = ${spi}; ES = ${es}; SPI(t) = ES/AT = ${spit}. Duration forecast: PD/SPI = ${pd}/${spi} = ${f1}, but PD/SPI(t) = ${pd}/${spit} = ${f2}.</p><p>When AT approaches or passes PD, PV is almost BAC and SPI = EV/BAC only measures % complete. Earned schedule fixes that flaw.</p>`,
      spiLink: 'See this project in the earned schedule module',
      decCostGivenEasy: (bac, cpi, tcpi) => `<p>A project has a budget <strong>BAC = ${bac}</strong>. At the status date, <strong>CPI = ${cpi}</strong> and <strong>TCPI = ${tcpi}</strong>.</p>`,
      decCostGivenMedium: (bac, ev, ac) => `<p>A project has a budget <strong>BAC = ${bac}</strong>. At the status date, <strong>EV = ${ev}</strong> and <strong>AC = ${ac}</strong>. Compute CPI and TCPI = (BAC − EV)/(BAC − AC).</p>`,
      decCostCompute: '<p>Compute CPI and TCPI = (BAC − EV)/(BAC − AC).</p>',
      decCostRule: '<p>Criterion: with TCPI ≤ 1 the current rate is enough; if TCPI exceeds CPI by more than 0.10, the improvement needed is considered unrealistic. What would you do?</p>',
      decCostOpt: {
        keepBudget: 'Stay with the plan: the remaining budget is enough at the current rate.',
        improve: 'Keep the budget, but require better efficiency on the remaining work.',
        rebaseline: 'Revise the forecast (EAC) and negotiate more budget or less scope.',
        release: 'Release part of the budget: a TCPI above 1 means the project is doing better than planned.',
      },
      decCostWhy: (cpi, tcpi) => `CPI = ${cpi} and TCPI = ${tcpi}.`,
      decCostRelease: 'No: TCPI is the efficiency the remaining work would need; above 1 means it must improve, not that money is left over.',
      decCostGeneral: (cpi, tcpi, gap) => `<p>CPI = ${cpi}; TCPI = ${tcpi}; TCPI − CPI = ${gap}.</p><p>TCPI is the cost efficiency the remaining work needs to finish at BAC. If it is ≤ 1, the budgeted rate is enough. If it is above 1 but close to the current CPI, it is achievable with moderate effort. If it is clearly higher, the EAC should be revised and renegotiated.</p>`,
      decTimeGivenEasy: (pd, at, units, spit) => `<p>A project with <strong>PD = ${pd} ${units}</strong> is at <strong>AT = ${at}</strong>. Its <strong>SPI(t) = ${spit}</strong>.</p>`,
      decTimeGivenMedium: (pd, at, units, es) => `<p>A project with <strong>PD = ${pd} ${units}</strong> is at <strong>AT = ${at}</strong> and its earned schedule is <strong>ES = ${es}</strong>. Compute SPI(t).</p>`,
      decTimeCompute: '<p>Compute the earned schedule ES and SPI(t).</p>',
      decTimeRule: '<p>Criterion (traffic-light zones): SPI(t) ≥ 1 satisfactory; 0.90 to 1 marginal, recoverable; below 0.90 unsatisfactory. What would you do?</p>',
      decTimeOpt: {
        keepPlan: 'Stay with the plan: the project is on time or ahead.',
        recover: 'Recover time on the remaining activities (crash or overlap).',
        replan: 'Replan and report the new forecast duration, IEAC(t) = PD/SPI(t).',
        selfFix: 'Stay with the plan: SPI returns to 1 at the end, so the delay corrects itself.',
      },
      decTimeWhy: (spit) => `SPI(t) = ${spit}.`,
      decTimeSelfFix: 'No: SPI returns to 1 at completion even if the project finishes late; the delay does not correct itself.',
      decTimeGeneral: (spit, ieac, pd) => `<p>SPI(t) = ${spit}; forecast IEAC(t) = PD/SPI(t) = ${ieac} against PD = ${pd}.</p><p>With a small delay, time can still be recovered on the remaining work; with a large one, the honest course is to replan and communicate the new date.</p>`,
    },
  };

  // ---------- Utilidades ----------

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const a = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;
  const round = (x, d) => Number(x.toFixed(d));

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const hashLink = (params) => `${APP}#${new URLSearchParams(params).toString()}`;
  const moduleLink = (view, project, AT, lang) => hashLink({ v: view, lang, c: P.encode(project, AT), at: String(AT) });
  const practiceLink = (seed, level, block, lang) => hashLink({ v: 'practice', lang, seed: String(seed), lvl: level, b: block, g: String(PR.GENERATOR) });

  const TH = 'padding:4px 8px;text-align:left;border-bottom:1px solid #bbb;';
  const TD = 'padding:4px 8px;text-align:right;';
  const TD0 = 'padding:4px 8px;text-align:left;font-weight:600;';
  /** Tabla HTML con estilos en línea (Moodle no carga el CSS de la herramienta). head puede ser null. */
  function table(head, rows) {
    const h = head ? `<thead><tr>${head.map((x) => `<th style="${TH}">${esc(x)}</th>`).join('')}</tr></thead>` : '';
    const b = rows.map((r) => `<tr>${r.map((c, i) => `<td style="${i ? TD : TD0}">${c}</td>`).join('')}</tr>`).join('');
    return `<table style="border-collapse:collapse;margin:0.6em 0;">${h}<tbody>${b}</tbody></table>`;
  }

  /** Diagrama de Gantt del plan como tabla HTML: casillas sombreadas y AT marcado en rojo. */
  function ganttHtml(project, AT, L) {
    const PD = E.plannedDuration(project);
    const H = Math.max(PD, AT);
    const sep = (k) => (k === AT ? 'border-right:3px solid #c00;' : 'border-right:1px solid #ddd;');
    const head = `<tr><th></th>${Array.from({ length: H }, (_, i) => `<td style="text-align:center;font-size:0.8em;color:#777;padding:0 2px;${sep(i + 1)}">${i + 1}</td>`).join('')}</tr>`;
    const rows = project.activities.map((act) => `<tr><th style="padding:2px 8px;text-align:left;">${esc(act.id)}</th>${Array.from({ length: H }, (_, i) => {
      const on = i + 1 > act.start && i + 1 <= act.start + act.duration;
      return `<td style="min-width:20px;height:18px;padding:0;${on ? 'background:#9fb3d1;' : ''}${sep(i + 1)}"></td>`;
    }).join('')}</tr>`);
    return `<table style="border-collapse:collapse;margin:0.6em 0;">${head}${rows.join('')}</table><p style="font-size:0.85em;color:#666;margin:0;">${esc(L.ganttCap(L.unitOne[project.unit]))}</p>`;
  }

  function dataTable(project, AT, L, lang) {
    return table(L.cols(L.unitOne[project.unit]), project.activities.map((act) => [
      esc(act.id), String(act.start + 1), String(act.duration), esc(F.money(lang, act.budget)),
      esc(F.pctSmart(lang, act.pc[AT - 1])), esc(F.money(lang, act.ac[AT - 1])),
    ]));
  }

  const statement = (project, AT, L) => L.stmt(project.activities.length, L.units[project.unit], AT, E.plannedDuration(project));
  const fmtTruth = (lang, kind, v) => (kind === 'money' ? F.money(lang, v) : kind === 'int' ? String(v) : F.num(lang, v, kind === 'ratio' ? 3 : 2));
  const label = (lang, key) => LABELS[key] || I.acr(lang, key);

  function base(kind, level, seed, L, lang) {
    return {
      kind: kind.id, level, seed,
      category: [L.type[kind.type], L.kind[kind.id], L.level[level]],
      name: [L.type[kind.type], L.kind[kind.id], L.level[level].toLowerCase(), `s=${seed}`].join(' · '),
      tags: [`kind-${kind.id}`, `level-${level}`, `lang-${lang}`, `gen-${PR.GENERATOR}`],
    };
  }

  const mcOptions = (list) => list.map((o) => ({ text: esc(o.text), correct: !!o.correct, feedback: esc(o.feedback) }));

  // ---------- Constructores ----------

  /** «Calcular indicadores»: el ejercicio del modo Práctica con esa semilla y nivel. */
  function calc(seed, level, L, lang, kind) {
    const { project, AT } = PR.generate(seed, level);
    const m = E.metricsAt(project, AT);
    const ctx = { p: project, AT, m };
    const items = PR.ITEMS.filter((it) => it.block === kind.block).map((it) => {
      const value = it.truth(m, ctx);
      return { key: it.key, kind: it.kind, value, tol: Number.isFinite(value) ? PR.tolerance(value, it.kind) : null };
    });
    if (items.some((it) => !Number.isFinite(it.value))) return null;
    const units = L.units[project.unit];
    const unitOf = (k) => (k === 'money' ? '€' : k === 'time' ? units : k === 'int' ? L.unitOne[project.unit] : '');
    const cloze = (it) => `{1:NUMERICAL:=${round(it.value, 6)}:${round(it.tol, 6)}}`;
    const answers = table(null, items.map((it) => [esc(label(lang, it.key)), cloze(it), esc(unitOf(it.kind))]));
    const nar = N.build(project, AT, lang, F, 'index');
    const steps = nar.groups[kind.block].map((s) => s.formula).filter(Boolean);
    if (kind.block === 'evm') {
      steps.push(
        `EAC = BAC/CPI = ${F.money(lang, m.BAC)}/${F.num(lang, m.CPI, 3)} = ${F.money(lang, m.costEAC.cpi)}`,
        `ETC = EAC − AC = ${F.money(lang, m.costEAC.cpi)} − ${F.money(lang, m.AC)} = ${F.money(lang, m.costEAC.cpi - m.AC)}`,
        `TCPI = (BAC − EV)/(BAC − AC) = ${F.money(lang, m.BAC - m.EV)}/${F.money(lang, m.BAC - m.AC)} = ${F.num(lang, m.TCPI, 3)}`,
      );
    }
    const links = { module: moduleLink(kind.block, project, AT, lang), practice: practiceLink(seed, level, kind.block, lang) };
    return Object.assign(base(kind, level, seed, L, lang), {
      qtype: 'cloze', items, AT, links,
      text: statement(project, AT, L) + ganttHtml(project, AT, L) + dataTable(project, AT, L, lang) +
        L.calcAsk[kind.block] + answers + `<p style="font-size:0.9em;color:#555;">${esc(L.howTo)}</p>`,
      general: `<p><strong>${esc(L.solTitle)}.</strong> ${items.map((it) => `${esc(label(lang, it.key))} = ${esc(fmtTruth(lang, it.kind, it.value))}`).join(' · ')}</p>` +
        `<p><strong>${esc(L.stepTitle)}</strong></p><ul>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` +
        `<p>${a(links.module, L.linkModule)}<br>${a(links.practice, L.linkPractice)}</p>`,
    });
  }

  const QUAD = { aheadUnder: [1, 1], aheadOver: [1, -1], behindUnder: [-1, 1], behindOver: [-1, -1] };

  /** «Estado del proyecto»: signos de SV y CV. En difícil hay que calcular PV, EV y AC. */
  function status(seed, level, L, lang, kind) {
    const { project, AT } = PR.generate(seed, level === 'hard' ? 'medium' : 'easy');
    const m = E.metricsAt(project, AT);
    const ds = Math.abs(m.SPI - 1); const dc = Math.abs(m.CPI - 1);
    if (level === 'easy' ? !(ds >= 0.08 && dc >= 0.08) : !(ds >= 0.02 && dc >= 0.02 && Math.min(ds, dc) < 0.08)) return null;
    const s = Math.sign(m.SV); const c = Math.sign(m.CV);
    const money = (v) => F.money(lang, v);
    const fb = L.quadFb(money(m.SV), money(m.CV));
    const options = Object.entries(QUAD).map(([k, [qs, qc]]) => {
      const ok = qs === s && qc === c;
      const pre = ok ? L.quadOk : qs !== s && qc !== c ? L.quadWrongB : qs !== s ? L.quadWrongS : L.quadWrongC;
      return { text: L.quad[k], correct: ok, feedback: pre + fb };
    });
    const text = level === 'hard'
      ? statement(project, AT, L) + ganttHtml(project, AT, L) + dataTable(project, AT, L, lang) + L.statusCompute + L.statusQ
      : L.statusGiven(AT, L.units[project.unit], money(m.PV), money(m.EV), money(m.AC)) + L.statusQ;
    const links = { module: moduleLink('evm', project, AT, lang) };
    return Object.assign(base(kind, level, seed, L, lang), {
      qtype: 'multichoice', options: mcOptions(options), values: { PV: m.PV, EV: m.EV, AC: m.AC }, links,
      text,
      general: L.statusGeneral(esc(money(m.SV)), esc(money(m.CV)), esc(F.num(lang, m.SPI, 3)), esc(F.num(lang, m.CPI, 3))) + `<p>${a(links.module, L.linkModule)}</p>`,
    });
  }

  const TCPI_CASES = ['hard', 'easy', 'exhausted'];
  const TCPI_WIN = {
    easy: { hard: [1.15, 1.6], easy: [0.6, 0.85], exhausted: [1.15, 1.5] },
    medium: { hard: [1.03, 1.12], easy: [0.88, 0.97], exhausted: [1.01, 1.08] },
    hard: { hard: [1.03, 1.3], easy: [0.7, 0.97], exhausted: [1.01, 1.3] },
  };

  /**
   * «TCPI»: más eficiencia necesaria, margen o presupuesto agotado (un tercio de cada).
   * En difícil se dan BAC, el % completado y el CPI, y hay que deducir EV y AC.
   */
  function tcpi(seed, level, L, lang, kind) {
    const r = mulberry32(seed * 31 + 7);
    const between = (lo, hi) => lo + r() * (hi - lo);
    const want = TCPI_CASES[seed % 3];
    const win = TCPI_WIN[level][want];
    const BAC = Math.round(between(20, 200)) * 1000;
    const pct = Math.round(between(0.25, 0.8) * 20) / 20; // múltiplos del 5 %
    const EV = BAC * pct;
    let AC = want === 'exhausted'
      ? Math.round((BAC * between(win[0], win[1])) / 100) * 100
      : Math.round((BAC - (BAC - EV) / between(win[0], win[1])) / 100) * 100;
    let CPIgiven = null;
    if (level === 'hard') { CPIgiven = round(EV / AC, 3); AC = EV / CPIgiven; }
    if (!(AC > 0)) return null;
    const m = E.metricsAt({ activities: [{ id: 'A', start: 0, duration: 10, budget: BAC, pc: [pct], ac: [AC] }] }, 1);
    const got = m.tcpiCase === 'exhausted' ? 'exhausted' : m.tcpiCase === 'normal' ? (m.TCPI > 1 ? 'hard' : 'easy') : null;
    if (got !== want) return null;
    const val = (m.BAC - m.EV) / (m.BAC - m.AC);
    if (got !== 'exhausted' && !(val >= win[0] - 0.02 && val <= win[1] + 0.02)) return null;
    if (got === 'exhausted' && !(m.AC > m.BAC)) return null;
    const money = (v) => F.money(lang, v);
    const n3 = (v) => F.num(lang, v, 3);
    const calcLine = `TCPI = (BAC − EV)/(BAC − AC) = ${money(m.BAC - m.EV)}/${money(m.BAC - m.AC)} = ${n3(val)}`;
    const options = ['hard', 'easy', 'exhausted', 'negative'].map((k) => ({
      text: L.tcpiOpt[k],
      correct: k === got,
      feedback: k === 'negative' ? (got === 'exhausted' ? L.tcpiNeg : L.tcpiNotNeg(n3(val))) : L.tcpiVal(n3(val)),
    }));
    const conc = got === 'exhausted' ? L.tcpiConc.exhausted(money(m.costEAC.cpi), n3(m.TCPIeac)) : L.tcpiConc[got];
    // Proyecto de una actividad para abrir el caso en la herramienta, con AT proporcional al avance.
    const AT = Math.max(1, Math.min(10, Math.round(10 * pct)));
    const at = (v) => Array.from({ length: AT }, (_, i) => (i === AT - 1 ? v : 0));
    const proj = {
      source: 'custom', exampleId: null, name: { es: `TCPI ${seed}`, en: `TCPI ${seed}` }, unit: 'week', currency: 'EUR', historyKnown: false,
      activities: [{ id: 'A', name: { es: 'A', en: 'A' }, start: 0, duration: 10, budget: BAC, pc: at(pct), ac: at(round(AC, 2)) }],
    };
    const links = { module: moduleLink('evm', proj, AT, lang) };
    return Object.assign(base(kind, level, seed, L, lang), {
      qtype: 'multichoice', options: mcOptions(options), case: got, values: { BAC, EV, AC, pct, CPI: CPIgiven, TCPI: val }, links,
      text: (level === 'hard' ? L.tcpiGivenHard(money(BAC), F.pctSmart(lang, pct), n3(CPIgiven)) : L.tcpiGiven(money(BAC), money(EV), money(AC))) + L.tcpiQ,
      general: `<p>${esc(calcLine)}</p><p>${esc(conc)}</p><p>${a(links.module, L.tcpiLink)}</p>`,
    });
  }

  /** «SPI al final»: proyecto en PD o después, sin terminar; SPI cerca de 1 y SPI(t) bastante menor. */
  function spiEnd(seed, level, L, lang, kind) {
    const { project, AT } = PR.generate(seed, 'hard');
    const m = E.metricsAt(project, AT);
    if (!(AT >= m.PD && m.EV < m.BAC - 1e-9 && m.SPI >= 0.85 && m.SPIt <= m.SPI - 0.1)) return null;
    const n2 = (v) => F.num(lang, v, 2); const n3 = (v) => F.num(lang, v, 3);
    const money = (v) => F.money(lang, v);
    const units = L.units[project.unit];
    let text;
    if (level === 'easy') text = L.spiGivenEasy(m.PD, AT, units, n3(m.SPI), n3(m.SPIt));
    else if (level === 'medium') text = L.spiGivenMedium(m.PD, AT, units, money(m.BAC), money(m.PV), money(m.EV), n2(m.ES));
    else {
      const per = Array.from({ length: Math.max(m.PD, AT) }, (_, i) => i + 1);
      text = L.spiGivenHard(m.PD, AT, units, money(m.EV)) +
        table([L.period, ...per.map(String)], [[esc(L.pvRow), ...per.map((t) => esc(money(E.pv(project, t))))]]);
    }
    text += L.spiQ;
    const options = ['ok', 'onTime', 'exaggerates', 'rounding'].map((k) => ({
      text: L.spiOpt[k], correct: k === 'ok', feedback: k === 'onTime' ? L.spiFb.onTime(n3(m.SPIt)) : L.spiFb[k],
    }));
    const links = { module: moduleLink('es', project, AT, lang) };
    return Object.assign(base(kind, level, seed, L, lang), {
      qtype: 'multichoice', options: mcOptions(options), values: { SPI: m.SPI, SPIt: m.SPIt, ES: m.ES, PV: m.PV, EV: m.EV, AT, PD: m.PD }, links,
      text,
      general: L.spiGeneral(esc(n3(m.SPI)), esc(n2(m.ES)), esc(n3(m.SPIt)), m.PD, esc(n2(m.PD / m.SPI)), esc(n2(m.PD / m.SPIt))) + `<p>${a(links.module, L.spiLink)}</p>`,
    });
  }

  /**
   * Decisiones (las mismas reglas que la Práctica): coste con CPI y TCPI; plazo con SPI(t).
   * Las tres respuestas correctas se reparten por semilla; se descartan los casos en el límite.
   * Fácil: se dan los índices. Media: las cantidades. Difícil: el enunciado completo del ejercicio.
   */
  function decision(seed, level, L, lang, kind) {
    const isCost = kind.id === 'dec-cost';
    const ch = PR.CHOICES.find((c) => c.key === (isCost ? 'decCost' : 'decTime'));
    const want = ch.options[seed % 3];
    const { project, AT } = PR.generate(seed, level);
    const m = E.metricsAt(project, AT);
    const got = ch.truth(m);
    if (got !== want) return null;
    if (isCost && (Math.abs(m.TCPI - 1) < 0.01 || Math.abs(m.TCPI - m.CPI - PR.DECISION_GAP) < 0.02)) return null;
    if (!isCost && (Math.abs(m.SPIt - 1) < 0.01 || Math.abs(m.SPIt - 0.9) < 0.01)) return null;
    const money = (v) => F.money(lang, v);
    const n2 = (v) => F.num(lang, v, 2); const n3 = (v) => F.num(lang, v, 3);
    const units = L.units[project.unit];
    const full = () => statement(project, AT, L) + ganttHtml(project, AT, L) + dataTable(project, AT, L, lang);
    let text; let options; let general; let links;
    if (isCost) {
      text = level === 'easy' ? L.decCostGivenEasy(money(m.BAC), n3(m.CPI), n3(m.TCPI))
        : level === 'medium' ? L.decCostGivenMedium(money(m.BAC), money(m.EV), money(m.AC))
          : full() + L.decCostCompute;
      text += L.decCostRule;
      const why = L.decCostWhy(n3(m.CPI), n3(m.TCPI));
      options = ['keepBudget', 'improve', 'rebaseline', 'release'].map((k) => ({
        text: L.decCostOpt[k], correct: k === got, feedback: k === 'release' ? L.decCostRelease : why,
      }));
      links = { module: moduleLink('evm', project, AT, lang) };
      general = L.decCostGeneral(esc(n3(m.CPI)), esc(n3(m.TCPI)), esc(n3(m.TCPI - m.CPI))) + `<p>${a(links.module, L.tcpiLink)}</p>`;
    } else {
      text = level === 'easy' ? L.decTimeGivenEasy(m.PD, AT, units, n3(m.SPIt))
        : level === 'medium' ? L.decTimeGivenMedium(m.PD, AT, units, n2(m.ES))
          : full() + L.decTimeCompute;
      text += L.decTimeRule;
      const why = L.decTimeWhy(n3(m.SPIt));
      options = ['keepPlan', 'recover', 'replan', 'selfFix'].map((k) => ({
        text: L.decTimeOpt[k], correct: k === got, feedback: k === 'selfFix' ? L.decTimeSelfFix : why,
      }));
      links = { module: moduleLink('es', project, AT, lang) };
      general = L.decTimeGeneral(esc(n3(m.SPIt)), esc(n2(m.durationEAC.es.spi)), m.PD) + `<p>${a(links.module, L.spiLink)}</p>`;
    }
    return Object.assign(base(kind, level, seed, L, lang), {
      qtype: 'multichoice', options: mcOptions(options), case: got, values: { CPI: m.CPI, TCPI: m.TCPI, SPIt: m.SPIt, ES: m.ES, AT, PD: m.PD }, links,
      text, general,
    });
  }

  const BUILDERS = { 'calc-evm': calc, 'calc-es': calc, 'calc-edm': calc, status, tcpi, 'spi-end': spiEnd, 'dec-cost': decision, 'dec-time': decision };

  // ---------- Generación ----------

  /**
   * Genera las preguntas.
   * opts: { lang, kinds: [id], levels: [id], count, seed (base; aleatoria si falta) }
   * → { seed, lang, questions: [...], missing: [{ kind, level, made, wanted }] }
   * Las semillas de los ejercicios están en 1..SEED_MAX, para que el enlace a la Práctica funcione.
   */
  function generate(opts) {
    const lang = T[opts.lang] ? opts.lang : 'es';
    const L = T[lang];
    const count = Math.max(1, Math.min(50, Math.round(opts.count) || 10));
    const seed = Number.isInteger(opts.seed) ? opts.seed : 1 + Math.floor(Math.random() * PR.SEED_MAX);
    const questions = [];
    const missing = [];
    let block = 0;
    for (const kid of opts.kinds || []) {
      const kind = kindById(kid);
      if (!kind) continue;
      for (const level of LEVELS.filter((lv) => (opts.levels || []).includes(lv))) {
        // Cada bloque (tipo × nivel) recorre su propia zona de semillas.
        const start = seed * 7 + (block++) * 7919;
        let made = 0;
        for (let k = 0; made < count && k < MAX_TRIES; k++) {
          const s = ((start + k) % PR.SEED_MAX) + 1;
          const q = BUILDERS[kid](s, level, L, lang, kind);
          if (!q) continue;
          questions.push(q);
          made++;
        }
        if (made < count) missing.push({ kind: kid, level, made, wanted: count });
      }
    }
    return { seed, lang, questions, missing, generator: PR.GENERATOR, kinds: (opts.kinds || []).slice(), levels: LEVELS.filter((lv) => (opts.levels || []).includes(lv)), count };
  }

  // ---------- Moodle XML ----------

  const cdata = (s) => `<![CDATA[${String(s).replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;

  function toXml(result) {
    const L = T[result.lang] || T.es;
    const out = [];
    let lastCat = null;
    for (const q of result.questions) {
      const cat = [L.root].concat(q.category).join('/');
      if (cat !== lastCat) {
        out.push(`  <question type="category">\n    <category><text>$course$/top/${esc(cat)}</text></category>\n  </question>`);
        lastCat = cat;
      }
      let body = '';
      if (q.qtype === 'multichoice') {
        const wrong = (-(100 / (q.options.length - 1))).toFixed(5);
        body = `    <single>true</single>
    <shuffleanswers>1</shuffleanswers>
    <answernumbering>abc</answernumbering>
    <showstandardinstruction>0</showstandardinstruction>
    <correctfeedback format="html"><text></text></correctfeedback>
    <partiallycorrectfeedback format="html"><text></text></partiallycorrectfeedback>
    <incorrectfeedback format="html"><text></text></incorrectfeedback>
${q.options.map((o) => `    <answer fraction="${o.correct ? 100 : wrong}" format="html">
      <text>${cdata(o.text)}</text>
      <feedback format="html"><text>${cdata(o.feedback)}</text></feedback>
    </answer>`).join('\n')}
`;
      }
      out.push(`  <question type="${q.qtype}">
    <name><text>${esc(q.name)}</text></name>
    <questiontext format="html"><text>${cdata(q.text)}</text></questiontext>
    <generalfeedback format="html"><text>${cdata(q.general)}</text></generalfeedback>
    <defaultgrade>${q.qtype === 'cloze' ? q.items.length : 1}</defaultgrade>
    <penalty>0</penalty>
    <hidden>0</hidden>
    <idnumber></idnumber>
${body}    <tags>${q.tags.map((t) => `<tag><text>${esc(t)}</text></tag>`).join('')}</tags>
  </question>`);
    }
    // Cabecera con lo necesario para regenerar el mismo banco: semilla, versión del generador y selección.
    const regen = `seed ${result.seed} · generator v${result.generator} · kinds ${(result.kinds || []).join(',')} · levels ${(result.levels || []).join(',')} · count ${result.count}`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${esc(L.root)} · ${esc(regen)} · ${APP} -->\n<quiz>\n${out.join('\n')}\n</quiz>\n`;
  }

  /** Texto de la pregunta para la vista previa: las casillas cloze se sustituyen por campos vacíos. */
  function previewHtml(q) {
    return q.text.replace(/\{1:NUMERICAL:=[^}]*\}/g, '<input size="8" disabled aria-label="…">');
  }

  const api = { generate, toXml, previewHtml, KINDS, LEVELS, texts: T, APP };
  if (isNode) module.exports = api;
  else root.PCMoodle = api;
})(this);
