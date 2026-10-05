/*
 * Textos del módulo de programación ganada (ES/EN).
 */
(function (root) {
  'use strict';

  const TEXT = {
    es: {
      s1: 'El problema: el SPI vuelve a 1',
      s1a: 'SV y SPI miden el plazo en dinero. Cuando pasa la duración planificada, PV vale el presupuesto total (BAC) y deja de crecer. Al terminar, EV también vale BAC: SV = 0 y SPI = 1, aunque el proyecto acabe tarde.',
      s1b: 'La gráfica supone que el proyecto sigue al ritmo de hoy (SPI(t) = {k}) hasta terminar en la {unit} {end}. Mira cómo el SPI vuelve a 1 y el SPI(t) no.',
      s1c: 'Hoy el proyecto va según el plan (SPI(t) = 1): las dos curvas coinciden. Prueba a retrasar alguna actividad en el editor.',
      s1Aria: 'Evolución supuesta de SPI y SPI(t) si el ritmo actual se mantiene',
      s2: 'La idea: medir el plazo en tiempo',
      s2a: 'Lleva el EV de hoy en horizontal hasta la curva del plan. El punto donde la corta es el momento en que el plan preveía haber ganado ese valor: la programación ganada, ES.',
      s2b: 'La distancia horizontal entre ES y AT es la variación de plazo en tiempo, SV(t).',
      s2Aria: 'Proyección del EV sobre la curva PV',
      s3: 'El cálculo de ES',
      s3a: 'Busca la última {unit} C en la que el PV acumulado no supera el EV de hoy. Después interpola dentro de la {unit} siguiente.',
      s3done: 'El trabajo está terminado: EV = BAC, así que ES = PD.',
      s3table: 'PV acumulado del plan. La fila marcada es C.',
      s4: 'Indicadores de plazo en tiempo',
      s4a: 'Con ES ya se compara tiempo con tiempo:',
      svtPos: 'SV(t) positiva: va adelantado {v} {units}.', svtNeg: 'SV(t) negativa: va retrasado {v} {units}.', svtZero: 'SV(t) nula: va según el plan.',
      compareTitle: 'Dinero frente a tiempo',
      colMoney: 'Valor ganado (dinero)', colTime: 'Programación ganada (tiempo)',
      rowVar: 'Variación de plazo', rowIdx: 'Índice de plazo',
      s5: 'Previsión de la duración final',
      s5a: 'La duración que falta, según el plan, es PD − ES. Dividida entre un factor de rendimiento (PF), se suma a AT:',
      pf1: 'PF = 1: el resto va según el plan.',
      pfSpi: 'PF = SPI(t): el ritmo actual se mantiene.',
      pfSci: 'PF = SPI(t)·CPI: influyen el plazo y el coste.',
      s5b: 'Con el valor ganado clásico, EACt = PD/SPI = {v} {units}.',
      s6: 'Límites de la programación ganada',
      s6a: 'ES mide el avance con el valor ganado, así que cada actividad pesa por su coste. Una actividad cara al día puede ocultar el retraso de otras baratas.',
      s6b: 'ES tampoco mira el camino crítico: adelantar trabajo no crítico puede compensar, en las cifras, un retraso que sí importa.',
      goEDM: 'Ir a duración ganada',
    },
    en: {
      s1: 'The problem: SPI returns to 1',
      s1a: 'SV and SPI measure schedule in money. After the planned duration, PV equals the total budget (BAC) and stops growing. At completion EV also equals BAC: SV = 0 and SPI = 1, even if the project finishes late.',
      s1b: 'The chart assumes the project keeps today’s pace (SPI(t) = {k}) until it finishes in {unit} {end}. Watch SPI return to 1 while SPI(t) does not.',
      s1c: 'Today the project is on plan (SPI(t) = 1): both curves coincide. Try delaying an activity in the editor.',
      s1Aria: 'Assumed evolution of SPI and SPI(t) if the current pace holds',
      s2: 'The idea: measure schedule in time',
      s2a: 'Take today’s EV horizontally to the plan curve. Where it meets the curve is the moment the plan expected to have earned that value: the earned schedule, ES.',
      s2b: 'The horizontal distance between ES and AT is the schedule variance in time, SV(t).',
      s2Aria: 'Projection of EV onto the PV curve',
      s3: 'Computing ES',
      s3a: 'Find the last {unit} C in which cumulative PV does not exceed today’s EV. Then interpolate inside the next {unit}.',
      s3done: 'The work is finished: EV = BAC, so ES = PD.',
      s3table: 'Cumulative PV of the plan. The highlighted row is C.',
      s4: 'Schedule indicators in time',
      s4a: 'With ES you compare time with time:',
      svtPos: 'Positive SV(t): {v} {units} ahead.', svtNeg: 'Negative SV(t): {v} {units} behind.', svtZero: 'Zero SV(t): on plan.',
      compareTitle: 'Money versus time',
      colMoney: 'Earned value (money)', colTime: 'Earned schedule (time)',
      rowVar: 'Schedule variance', rowIdx: 'Schedule index',
      s5: 'Final duration forecast',
      s5a: 'The remaining duration, according to the plan, is PD − ES. Divided by a performance factor (PF), it is added to AT:',
      pf1: 'PF = 1: the rest goes to plan.',
      pfSpi: 'PF = SPI(t): the current pace holds.',
      pfSci: 'PF = SPI(t)·CPI: schedule and cost both matter.',
      s5b: 'With classic earned value, EACt = PD/SPI = {v} {units}.',
      s6: 'Limits of earned schedule',
      s6a: 'ES measures progress with earned value, so each activity weighs by its cost. An expensive activity on time can hide the delay of cheap ones.',
      s6b: 'ES does not look at the critical path either: working ahead on non-critical tasks can offset, in the figures, a delay that does matter.',
      goEDM: 'Go to earned duration',
    },
  };

  const api = { TEXT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCEsText = api;
})(this);
