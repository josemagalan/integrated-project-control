/*
 * El cálculo paso a paso en la fecha de control: cada paso tiene un texto, una fórmula con
 * los números del proyecto y, a veces, una nota de por qué importa.
 */
(function (root) {
  'use strict';

  const TEXT = {
    es: {
      tabs: { evm: 'Valor ganado', es: 'Programación ganada', edm: 'Duración ganada', fc: 'Previsiones' },
      pv: 'El valor planificado (PV) es lo que el plan preveía gastar hasta la fecha de control. Cada actividad reparte su presupuesto por igual entre sus semanas.',
      ev: 'El valor ganado (EV) es el presupuesto del trabajo hecho: el presupuesto de cada actividad por su % completado.',
      ac: 'El coste real (AC) es lo que se ha gastado de verdad hasta la fecha de control.',
      variances: 'Las variaciones comparan el EV con el plan (SV) y con el coste real (CV). Negativo es malo.',
      indices: 'Los índices son cocientes: 1 es lo previsto, por debajo de 1 va peor.',
      eac: 'Si el rendimiento de coste se mantiene, el coste final previsto (EAC) es:',
      lateWhy: 'La fecha de control ya ha pasado la duración planificada: el PV vale el presupuesto total y el SPI solo mide el % completado. Por eso el SPI sube hacia 1 aunque el retraso siga.',
      findC: 'Busca la última semana C en la que el plan ya había ganado lo que hoy se ha ganado: PV(C) ≤ EV < PV(C+1).',
      complete: 'El trabajo está terminado (EV = BAC), así que ES = PD.',
      interpolate: 'Interpola dentro de la semana C+1 para saber cuánto tiempo del plan representa el EV.',
      esIdx: 'Compara el tiempo ganado con el tiempo real transcurrido.',
      esWhy: 'ES se mide en semanas, no en euros: no tiende a 1 al final del proyecto.',
      esFc: 'Si el ritmo se mantiene, la duración final prevista es:',
      tpd: 'Las unidades de duración planificadas (TPD) suman, para cada actividad, cuántas de sus semanas debían estar hechas.',
      ted: 'Las unidades de duración ganadas (TED) suman la duración de cada actividad por su % completado. El presupuesto no aparece.',
      edi: 'El EDI compara la duración ganada con la planificada, como el SPI compara EV con PV.',
      edt: 'ED(t) es la semana en la que el plan alcanzaba el TED de hoy. Se interpola igual que ES, pero sobre la curva TPD.',
      dpi: 'El DPI compara la duración ganada con el tiempo real transcurrido.',
      edmFc: 'Si el ritmo se mantiene, la duración final prevista es:',
      edmWhy: 'Ninguna fórmula de esta pestaña usa costes: una actividad barata y larga pesa tanto como su duración.',
      fcIntro: 'Cuatro métodos para prever la duración final con los datos de la semana {at}. Todos parten de AT y estiman el trabajo pendiente.',
      fcPV: 'Valor planificado (Anbari): convierte SV a semanas dividiendo entre el ritmo medio del plan, BAC/PD.',
      fcED: 'Duración ganada de Jacob: ED = AT · SPI.',
      fcES: 'Programación ganada (Lipke):',
      fcEDM: 'Duración ganada (EDM):',
      fcActual: 'Duración real del proyecto: {ad} semanas. Error de cada previsión en la semana {at}:',
      fcOpen: 'El proyecto aún no ha terminado en los datos disponibles.',
      undefinedIdx: 'El índice no está definido porque el denominador vale 0.',
    },
    en: {
      tabs: { evm: 'Earned value', es: 'Earned schedule', edm: 'Earned duration', fc: 'Forecasts' },
      pv: 'Planned value (PV) is what the plan expected to spend up to the status date. Each activity spreads its budget evenly over its weeks.',
      ev: 'Earned value (EV) is the budget of the work done: each activity’s budget times its % complete.',
      ac: 'Actual cost (AC) is what has really been spent up to the status date.',
      variances: 'The variances compare EV with the plan (SV) and with the actual cost (CV). Negative is bad.',
      indices: 'The indices are ratios: 1 is on plan, below 1 is worse.',
      eac: 'If cost performance holds, the forecast final cost (EAC) is:',
      lateWhy: 'The status date is past the planned duration: PV equals the total budget and SPI only measures % complete. That is why SPI rises towards 1 while the delay remains.',
      findC: 'Find the last week C in which the plan had already earned what has been earned today: PV(C) ≤ EV < PV(C+1).',
      complete: 'The work is finished (EV = BAC), so ES = PD.',
      interpolate: 'Interpolate inside week C+1 to find how much planned time the EV represents.',
      esIdx: 'Compare the earned time with the actual time elapsed.',
      esWhy: 'ES is measured in weeks, not euros: it does not tend to 1 at the end of the project.',
      esFc: 'If the pace holds, the forecast final duration is:',
      tpd: 'Total planned duration units (TPD) add, for each activity, how many of its weeks should be done.',
      ted: 'Total earned duration units (TED) add each activity’s duration times its % complete. The budget does not appear.',
      edi: 'EDI compares earned with planned duration, as SPI compares EV with PV.',
      edt: 'ED(t) is the week in which the plan reached today’s TED. It is interpolated like ES, but on the TPD curve.',
      dpi: 'DPI compares the earned duration with the actual time elapsed.',
      edmFc: 'If the pace holds, the forecast final duration is:',
      edmWhy: 'No formula on this tab uses costs: a cheap, long activity weighs as much as its duration.',
      fcIntro: 'Four methods to forecast the final duration with the data of week {at}. All start from AT and estimate the remaining work.',
      fcPV: 'Planned value (Anbari): turns SV into weeks by dividing by the plan’s average rate, BAC/PD.',
      fcED: 'Jacob’s earned duration: ED = AT · SPI.',
      fcES: 'Earned schedule (Lipke):',
      fcEDM: 'Earned duration (EDM):',
      fcActual: 'Actual project duration: {ad} weeks. Error of each forecast in week {at}:',
      fcOpen: 'The project has not finished yet in the available data.',
      undefinedIdx: 'The index is undefined because the denominator is 0.',
    },
  };

  function fill(s, params) {
    let out = s;
    for (const [k, v] of Object.entries(params || {})) out = out.split(`{${k}}`).join(String(v));
    return out;
  }

  /** Lista «a + b + c = total» con los términos distintos de cero (o «0»). */
  function sum(terms, total, f) {
    const nz = terms.filter((v) => Math.abs(v) > 1e-9);
    if (!nz.length) return `0`;
    return nz.length === 1 ? f(total) : `${nz.map(f).join(' + ')} = ${f(total)}`;
  }

  function build(project, AT, lang, fmt, pfMode) {
    const E = root.PCEngine || require('./core/engine.js');
    const L = TEXT[lang] || TEXT.es;
    const m = E.metricsAt(project, AT);
    const acts = project.activities;
    const money = (v) => fmt.money(lang, v);
    const n2 = (v) => fmt.num(lang, v, 2);
    const n3 = (v) => fmt.num(lang, v, 3);
    const pct = (v) => fmt.pct(lang, v, Math.abs(v * 100 - Math.round(v * 100)) < 1e-6 ? 0 : 1);
    const n0 = (v) => fmt.num(lang, v, 0);
    const MAX = lang === 'en' ? 'max' : 'máx';
    const idx = (v) => (v === null ? L.undefinedIdx : n3(v));

    const evm = [
      { text: L.pv, formula: `PV(${AT}) = ${sum(acts.map((a) => E.pvActivity(a, AT)), m.PV, money)}` },
      {
        text: L.ev,
        formula: `EV(${AT}) = ${acts.filter((a) => E.pcAt(a, AT) > 0).map((a) => `${money(a.budget)}·${pct(E.pcAt(a, AT))}`).join(' + ') || '0'} = ${money(m.EV)}`,
      },
      { text: L.ac, formula: `AC(${AT}) = ${money(m.AC)}` },
      { text: L.variances, formula: `SV = EV − PV = ${money(m.SV)}   ·   CV = EV − AC = ${money(m.CV)}` },
      { text: L.indices, formula: `SPI = EV/PV = ${money(m.EV)}/${money(m.PV)} = ${idx(m.SPI)}   ·   CPI = EV/AC = ${idx(m.CPI)}` },
      { text: L.eac, formula: `EAC = AC + (BAC − EV)/CPI = ${money(m.AC)} + (${money(m.BAC)} − ${money(m.EV)})/${idx(m.CPI)} = ${money(m.costEAC.cpi)}   ·   VAC = ${money(m.VAC)}` },
    ];
    if (AT > m.PD) evm.push({ text: L.lateWhy, formula: `PV(${AT}) = BAC = ${money(m.BAC)}  →  SPI = EV/BAC = ${pct(m.percentComplete)}`, highlight: true });

    const tr = m.esTrace;
    const es = tr.complete
      ? [{ text: L.complete, formula: `EV = ${money(m.EV)} = BAC  →  ES = PD = ${m.PD}` }]
      : [
        { text: L.findC, formula: `PV(${tr.C}) = ${money(tr.low)} ≤ EV = ${money(m.EV)} < PV(${tr.C + 1}) = ${money(tr.high)}  →  C = ${tr.C}` },
        { text: L.interpolate, formula: `ES = C + (EV − PV(C))/(PV(C+1) − PV(C)) = ${tr.C} + (${money(m.EV)} − ${money(tr.low)})/(${money(tr.high)} − ${money(tr.low)}) = ${n2(m.ES)}` },
      ];
    es.push(
      { text: L.esIdx, formula: `SV(t) = ES − AT = ${n2(m.ES)} − ${AT} = ${n2(m.SVt)}   ·   SPI(t) = ES/AT = ${idx(m.SPIt)}` },
      { text: L.esFc, formula: `EAC(t) = AT + (PD − ES)/SPI(t) = ${AT} + (${m.PD} − ${n2(m.ES)})/${idx(m.SPIt)} = ${n2(m.durationEAC.es.spi)}` },
      { text: L.esWhy, formula: `SPI = ${idx(m.SPI)}   ·   SPI(t) = ${idx(m.SPIt)}` },
    );

    const etr = m.edTrace;
    const edm = [
      { text: L.tpd, formula: `TPD(${AT}) = ${sum(acts.map((a) => E.plannedPeriodsElapsed(a, AT)), m.TPDt, n0)}` },
      {
        text: L.ted,
        formula: `TED(${AT}) = ${acts.filter((a) => E.pcAt(a, AT) > 0).map((a) => `${a.duration}·${pct(E.pcAt(a, AT))}`).join(' + ') || '0'} = ${n2(m.TED)}`,
      },
      { text: L.edi, formula: `EDI = TED/TPD = ${n2(m.TED)}/${n0(m.TPDt)} = ${idx(m.EDI)}` },
      etr.complete
        ? { text: L.edt, formula: `TED = ${n2(m.TED)} = Σd  →  ED(t) = PD = ${m.PD}` }
        : { text: L.edt, formula: `TPD(${etr.C}) = ${n0(etr.low)} ≤ TED = ${n2(m.TED)} < TPD(${etr.C + 1}) = ${n0(etr.high)}  →  ED(t) = ${etr.C} + (${n2(m.TED)} − ${n0(etr.low)})/(${n0(etr.high)} − ${n0(etr.low)}) = ${n2(m.EDt)}` },
      { text: L.dpi, formula: `DPI = ED(t)/AT = ${n2(m.EDt)}/${AT} = ${idx(m.DPI)}` },
      { text: L.edmFc, formula: `EDAC(t) = AT + (PD − ED(t))/DPI = ${AT} + (${m.PD} − ${n2(m.EDt)})/${idx(m.DPI)} = ${n2(m.durationEAC.edm.dpi)}` },
      { text: L.edmWhy, formula: `SPI(t) = ${idx(m.SPIt)}   ·   DPI = ${idx(m.DPI)}` },
    ];

    const d = m.durationEAC;
    const useIdx = pfMode !== 'pf1';
    const H = Math.max(m.PD, AT);
    const fc = [
      { text: fill(L.fcIntro, { at: AT }), formula: `AT = ${AT}   ·   PD = ${m.PD}` },
      useIdx
        ? { text: L.fcPV, formula: `EAC(t) = PD/SPI = ${m.PD}/${idx(m.SPI)} = ${n2(d.pv.spi)}` }
        : { text: L.fcPV, formula: `TV = SV/(BAC/PD) = ${money(m.SV)}/${money(m.PVrate)} = ${n2(m.TV)}  →  EAC(t) = PD − TV = ${n2(d.pv.pf1)}` },
      useIdx
        ? { text: L.fcED, formula: `ED = ${AT}·${idx(m.SPI)} = ${n2(m.EDj)}  →  EAC(t) = AT + (${MAX}(PD, AT) − ED)/SPI = ${AT} + (${H} − ${n2(m.EDj)})/${idx(m.SPI)} = ${n2(d.ed.spi)}` }
        : { text: L.fcED, formula: `ED = ${AT}·${idx(m.SPI)} = ${n2(m.EDj)}  →  EAC(t) = AT + (${MAX}(PD, AT) − ED) = ${n2(d.ed.pf1)}` },
      useIdx
        ? { text: L.fcES, formula: `EAC(t) = AT + (PD − ES)/SPI(t) = ${n2(d.es.spi)}` }
        : { text: L.fcES, formula: `EAC(t) = AT + (PD − ES) = ${AT} + (${m.PD} − ${n2(m.ES)}) = ${n2(d.es.pf1)}` },
      useIdx
        ? { text: L.fcEDM, formula: `EDAC(t) = AT + (PD − ED(t))/DPI = ${n2(d.edm.dpi)}` }
        : { text: L.fcEDM, formula: `EDAC(t) = AT + (PD − ED(t)) = ${AT} + (${m.PD} − ${n2(m.EDt)}) = ${n2(d.edm.pf1)}` },
    ];
    const AD = E.actualDuration(project);
    if (AD !== null) {
      const v = useIdx ? [d.pv.spi, d.ed.spi, d.es.spi, d.edm.dpi] : [d.pv.pf1, d.ed.pf1, d.es.pf1, d.edm.pf1];
      const err = (f) => (f === null ? '—' : `${f - AD >= 0 ? '+' : ''}${n2(f - AD)}`);
      fc.push({ text: fill(L.fcActual, { ad: AD, at: AT }), formula: `PV ${err(v[0])}   ·   Jacob ${err(v[1])}   ·   ES ${err(v[2])}   ·   EDM ${err(v[3])}` });
    } else {
      fc.push({ text: L.fcOpen, formula: '' });
    }

    return { tabs: L.tabs, groups: { evm, es, edm, fc }, metrics: m };
  }

  const api = { build, TEXT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCNarration = api;
})(this);
