/*
 * Proyectos de ejemplo inventados con fines docentes.
 *
 * Cada actividad describe su plan (start, duration, budget) y cómo se ejecutó en realidad
 * (actual: start, duration, costFactor). buildExample() lo convierte en la serie de avance por
 * periodo que usa el motor: % completado acumulado lineal durante la ejecución real y coste
 * real repartido por igual entre los periodos trabajados.
 */
(function (root) {
  'use strict';

  function round(x, digits) {
    const f = 10 ** digits;
    return Math.round(x * f) / f;
  }

  function buildActivity(def, periods) {
    const { start, duration, costFactor } = def.actual;
    const pc = [];
    const ac = [];
    const perPeriodCost = (def.budget * costFactor) / duration;
    for (let t = 1; t <= periods; t++) {
      const worked = Math.min(Math.max(t - start, 0), duration);
      pc.push(worked / duration);
      ac.push(t > start && t <= start + duration ? Math.round(perPeriodCost) : 0);
    }
    return { id: def.id, name: def.name, start: def.start, duration: def.duration, budget: def.budget, pc, ac };
  }

  function buildExample(def) {
    const periods = def.reportedPeriods || Math.max(...def.activities.map((a) => a.actual.start + a.actual.duration));
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      lesson: def.lesson,
      currency: def.currency || 'EUR',
      periodUnit: def.periodUnit || 'week',
      activities: def.activities.map((a) => buildActivity(a, periods)),
    };
  }

  const definitions = [
    {
      id: 'late',
      name: { es: 'Reforma de una oficina', en: 'Office refurbishment' },
      description: {
        es: 'Seis actividades, 10 semanas y 30.000 € de presupuesto. Las instalaciones y la tabiquería se retrasan y el proyecto termina en la semana 13.',
        en: 'Six activities, 10 weeks and a €30,000 budget. Building services and partitions run late and the project ends in week 13.',
      },
      lesson: {
        es: 'Mira el SPI en las semanas 10 a 13: vuelve a 1 al terminar aunque el proyecto acabe 3 semanas tarde. El SPI(t) de la programación ganada no tiene ese defecto.',
        en: 'Watch SPI in weeks 10 to 13: it returns to 1 at completion even though the project ends 3 weeks late. The earned schedule SPI(t) does not have that flaw.',
      },
      activities: [
        { id: 'A', name: { es: 'Diseño', en: 'Design' }, start: 0, duration: 2, budget: 4000, actual: { start: 0, duration: 3, costFactor: 1.1 } },
        { id: 'B', name: { es: 'Demolición', en: 'Demolition' }, start: 2, duration: 1, budget: 2000, actual: { start: 3, duration: 1, costFactor: 1.0 } },
        { id: 'C', name: { es: 'Instalaciones', en: 'Building services' }, start: 3, duration: 3, budget: 9000, actual: { start: 4, duration: 4, costFactor: 1.15 } },
        { id: 'D', name: { es: 'Tabiquería', en: 'Partitions' }, start: 3, duration: 4, budget: 6000, actual: { start: 4, duration: 5, costFactor: 1.05 } },
        { id: 'E', name: { es: 'Acabados', en: 'Finishes' }, start: 7, duration: 2, budget: 5000, actual: { start: 9, duration: 3, costFactor: 1.1 } },
        { id: 'F', name: { es: 'Mobiliario', en: 'Furniture' }, start: 9, duration: 1, budget: 4000, actual: { start: 12, duration: 1, costFactor: 1.0 } },
      ],
    },
    {
      id: 'ahead',
      name: { es: 'Desarrollo de una app', en: 'App development' },
      description: {
        es: 'Seis actividades, 11 semanas y 34.000 € de presupuesto. El equipo adelanta trabajo, gasta menos de lo previsto y termina en la semana 10.',
        en: 'Six activities, 11 weeks and a €34,000 budget. The team works ahead, spends less than planned and finishes in week 10.',
      },
      lesson: {
        es: 'Un proyecto adelantado y por debajo del presupuesto: CPI, SPI, SPI(t) y DPI mayores que 1. Compara las previsiones de plazo de cada método con la duración real.',
        en: 'A project ahead of schedule and under budget: CPI, SPI, SPI(t) and DPI above 1. Compare each method’s duration forecast with the actual duration.',
      },
      activities: [
        { id: 'A', name: { es: 'Requisitos', en: 'Requirements' }, start: 0, duration: 2, budget: 3000, actual: { start: 0, duration: 2, costFactor: 0.9 } },
        { id: 'B', name: { es: 'Diseño UX', en: 'UX design' }, start: 2, duration: 2, budget: 4000, actual: { start: 2, duration: 1, costFactor: 0.95 } },
        { id: 'C', name: { es: 'Backend', en: 'Backend' }, start: 3, duration: 4, budget: 12000, actual: { start: 3, duration: 3, costFactor: 0.95 } },
        { id: 'D', name: { es: 'Frontend', en: 'Frontend' }, start: 4, duration: 4, budget: 9000, actual: { start: 3, duration: 4, costFactor: 1.0 } },
        { id: 'E', name: { es: 'Pruebas', en: 'Testing' }, start: 8, duration: 2, budget: 4000, actual: { start: 7, duration: 2, costFactor: 0.9 } },
        { id: 'F', name: { es: 'Despliegue', en: 'Deployment' }, start: 10, duration: 1, budget: 2000, actual: { start: 9, duration: 1, costFactor: 1.0 } },
      ],
    },
    {
      id: 'decoupled',
      name: { es: 'Nave industrial', en: 'Industrial building' },
      description: {
        es: 'La estructura cuesta el 92 % del presupuesto y va al día. Las actividades baratas (licencias, documentación, señalización, formación) se retrasan y el proyecto termina en la semana 12, no en la 9.',
        en: 'The structure is 92% of the budget and is on time. The cheap activities (permits, documentation, signage, training) run late and the project ends in week 12, not week 9.',
      },
      lesson: {
        es: 'En la semana 6, SPI y SPI(t) rondan 0,97 porque el coste lo domina la estructura. La duración ganada pesa cada actividad por su duración, no por su coste: el DPI cae a 0,74 y su previsión (12,2 semanas) se acerca al final real (12).',
        en: 'In week 6, SPI and SPI(t) are about 0.97 because the structure dominates cost. Earned duration weights each activity by its duration, not its cost: DPI drops to 0.74 and its forecast (12.2 weeks) is close to the actual finish (12).',
      },
      activities: [
        { id: 'A', name: { es: 'Estructura y cubierta', en: 'Structure and roof' }, start: 0, duration: 8, budget: 48000, actual: { start: 0, duration: 8, costFactor: 1.0 } },
        { id: 'B', name: { es: 'Licencias', en: 'Permits' }, start: 0, duration: 3, budget: 600, actual: { start: 0, duration: 5, costFactor: 1.1 } },
        { id: 'C', name: { es: 'Documentación técnica', en: 'Technical documentation' }, start: 1, duration: 5, budget: 800, actual: { start: 2, duration: 7, costFactor: 1.2 } },
        { id: 'D', name: { es: 'Señalización y seguridad', en: 'Signage and safety' }, start: 3, duration: 4, budget: 700, actual: { start: 5, duration: 5, costFactor: 1.1 } },
        { id: 'E', name: { es: 'Formación del personal', en: 'Staff training' }, start: 4, duration: 4, budget: 500, actual: { start: 6, duration: 5, costFactor: 1.0 } },
        { id: 'F', name: { es: 'Recepción y entrega', en: 'Acceptance and handover' }, start: 8, duration: 1, budget: 1400, actual: { start: 11, duration: 1, costFactor: 1.0 } },
      ],
    },
  ];

  const examples = definitions.map(buildExample);

  const api = { definitions, examples, buildExample, byId: (id) => examples.find((e) => e.id === id) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PCExamples = api;
})(this);
