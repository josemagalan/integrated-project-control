/*
 * Textos del módulo de duración ganada (EDM, Khamooshi y Golafshani, 2014) (ES/EN).
 */
(function (root) {
  'use strict';

  const TEXT = {
    es: {
      s1: '¿Por qué otra medida?',
      s1a: 'El valor ganado y la programación ganada miden el avance en dinero: cada actividad pesa por su presupuesto. Pero el plazo depende de lo que dura cada actividad, no de lo que cuesta.',
      s1b: 'Peso de cada actividad en el coste y en la duración:',
      wCost: 'Peso en coste', wDur: 'Peso en duración',
      s1Aria: 'Peso de cada actividad en el presupuesto y en la duración total',
      s1c: 'Las actividades con más peso en duración que en coste pueden retrasarse sin que el SPI ni el SPI(t) lo noten.',
      s2: 'Unidades de duración planificadas: TPD',
      s2a: 'Cada actividad aporta una unidad por cada {unit} planificada. Sumando las de todas las actividades sale la curva TPD(t). Al final vale la suma de las duraciones, Σd = {tot}. Ojo: Σd no es la duración del proyecto (PD = {pd}), porque las actividades se solapan.',
      s2Aria: 'Curva de unidades de duración planificadas',
      s3: 'Duración ganada: TED',
      s3a: 'Cada actividad gana su duración planificada multiplicada por su % completado. El presupuesto no aparece en ninguna fórmula de este módulo.',
      s4: 'ED(t): proyectar TED sobre la curva TPD',
      s4a: 'Igual que ES, pero sobre la curva de duraciones: ED(t) es el momento en que el plan preveía haber ganado las unidades de duración que hoy se han ganado.',
      s4done: 'El trabajo está terminado: TED = Σd, así que ED(t) = PD.',
      s4Aria: 'Proyección de TED sobre la curva TPD',
      s5: 'Índices: EDI y DPI',
      s5a: 'EDM tiene dos índices, paralelos a los del valor ganado y la programación ganada:',
      ediTxt: 'EDI = TED/TPD compara cantidades, como SPI = EV/PV. Al final también tiende a 1.',
      dpiTxt: 'DPI = ED(t)/AT compara tiempos, como SPI(t) = ES/AT.',
      tabIdx: 'Índice', tabQty: 'Cantidades (tiende a 1 al final)', tabTime: 'Tiempos',
      tabEvm: 'En dinero', tabEdm: 'En duración',
      s6: 'Previsión: EDAC',
      s6a: 'La duración final prevista se calcula como con ES, pero con ED(t) y DPI:',
      pf1: 'PF = 1: el resto va según el plan.',
      pfDpi: 'PF = DPI: el ritmo actual se mantiene.',
      cmpTitle: 'Las cuatro previsiones con los datos de hoy',
      jacobNote: 'No lo confundas con la «duración ganada» de Jacob (2003): ED = AT·SPI. Es un método de previsión que sigue usando el SPI, es decir, el coste.',
      s7: 'Experimento: cambia un presupuesto',
      s7a: 'Cambia el presupuesto de una actividad en la tabla del editor. ES y SPI(t) se mueven; ED(t) y DPI no.',
      s7b: 'ES y ED(t) coinciden cuando todas las actividades gastan lo mismo por {unit}. Con este proyecto, si fuera así, ES valdría {es}, igual que ED(t) = {ed}.',
      now: 'Ahora: ES = {es} y ED(t) = {ed}.',
    },
    en: {
      s1: 'Why another measure?',
      s1a: 'Earned value and earned schedule measure progress in money: each activity weighs by its budget. But the schedule depends on how long each activity lasts, not on what it costs.',
      s1b: 'Weight of each activity in cost and in duration:',
      wCost: 'Weight in cost', wDur: 'Weight in duration',
      s1Aria: 'Weight of each activity in the budget and in the total duration',
      s1c: 'Activities that weigh more in duration than in cost can fall behind without SPI or SPI(t) noticing.',
      s2: 'Planned duration units: TPD',
      s2a: 'Each activity adds one unit for each planned {unit}. Adding all activities gives the TPD(t) curve. At the end it equals the sum of the durations, Σd = {tot}. Note: Σd is not the project duration (PD = {pd}), because activities overlap.',
      s2Aria: 'Planned duration units curve',
      s3: 'Earned duration: TED',
      s3a: 'Each activity earns its planned duration times its % complete. The budget does not appear in any formula of this module.',
      s4: 'ED(t): project TED onto the TPD curve',
      s4a: 'Like ES, but on the duration curve: ED(t) is the moment the plan expected to have earned the duration units earned today.',
      s4done: 'The work is finished: TED = Σd, so ED(t) = PD.',
      s4Aria: 'Projection of TED onto the TPD curve',
      s5: 'Indices: EDI and DPI',
      s5a: 'EDM has two indices, parallel to those of earned value and earned schedule:',
      ediTxt: 'EDI = TED/TPD compares amounts, like SPI = EV/PV. It also tends to 1 at the end.',
      dpiTxt: 'DPI = ED(t)/AT compares times, like SPI(t) = ES/AT.',
      tabIdx: 'Index', tabQty: 'Amounts (tends to 1 at the end)', tabTime: 'Times',
      tabEvm: 'In money', tabEdm: 'In duration',
      s6: 'Forecast: EDAC',
      s6a: 'The forecast final duration is computed as with ES, but with ED(t) and DPI:',
      pf1: 'PF = 1: the rest goes to plan.',
      pfDpi: 'PF = DPI: the current pace holds.',
      cmpTitle: 'The four forecasts with today’s data',
      jacobNote: 'Do not confuse it with Jacob’s (2003) “earned duration”: ED = AT·SPI. It is a forecasting method that still uses SPI, that is, cost.',
      s7: 'Experiment: change a budget',
      s7a: 'Change an activity’s budget in the editor table. ES and SPI(t) move; ED(t) and DPI do not.',
      s7b: 'ES and ED(t) coincide when every activity spends the same per {unit}. With this project, if that were so, ES would be {es}, equal to ED(t) = {ed}.',
      now: 'Now: ES = {es} and ED(t) = {ed}.',
    },
  };

  const api = { TEXT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCEdmText = api;
})(this);
