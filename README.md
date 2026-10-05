# Integrated project control: earned value, earned schedule and earned duration

[![Live demo](https://img.shields.io/badge/Live_demo-GitHub_Pages-2ea44f?logo=github)](https://josemagalan.github.io/integrated-project-control/)
[![Tests](https://github.com/josemagalan/integrated-project-control/actions/workflows/tests.yml/badge.svg)](https://github.com/josemagalan/integrated-project-control/actions/workflows/tests.yml)
[![Code: MIT](https://img.shields.io/badge/Code-MIT-yellow.svg)](LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/Content-CC_BY_4.0-lightgrey.svg)](LICENSE-CONTENT.md)
[![D3.js v7 · no build](https://img.shields.io/badge/D3.js_v7-no_build-f9a03c?logo=d3dotjs&logoColor=white)](https://d3js.org/)
[![Languages: ES | EN](https://img.shields.io/badge/Languages-ES_%7C_EN-blue.svg)](#features)
[![Purpose: Teaching tool](https://img.shields.io/badge/Purpose-Teaching_tool-informational.svg)](#pedagogical-purpose)

**José Manuel Galán**¹ · **Silvia Díaz-de la Fuente**² · **Virginia Ahedo**¹ · **María Pereda**³ · **José Ignacio Santos**¹

¹ Universidad de Burgos · ² Universidad de Salamanca · ³ Universidad Politécnica de Madrid
All authors are members of the Los Goonies research group (Group of Organization and Industrial Engineering and Simulation).

---

## Overview

Is a project on schedule and on budget? Comparing what has been spent with what was planned is misleading: you also need to know how much work has been done. This interactive tool explains, step by step and in Spanish or English, the three methods of integrated project control — **earned value (EVM)**, **earned schedule (ES)** and **earned duration (EDM)** — on the same editable project, shows how their indicators and forecasts evolve over time, and lets students practise the calculations with graded exercises.

It runs entirely in the browser, with no build step and no server: open `index.html` or use the [live demo](https://josemagalan.github.io/integrated-project-control/).

## Methods

| Module | What it covers |
| --- | --- |
| Earned value (EVM) | PV, EV and AC at the status date; SV and CV; CPI, SPI and CSI with a traffic light and a CPI–SPI quadrant; EAC with three performance factors, ETC, VAC, TCPI (including the budget-exhausted case) and EAC(t); why SPI tends to 1 at the end of a late project |
| Earned schedule (ES) | Lipke’s earned schedule: the period C, the interpolation of ES on the PV curve, SV(t), SPI(t) and IEAC(t) with three performance factors |
| Earned duration (EDM) | Khamooshi and Golafshani’s TPD, TED, ED(t), EDI and DPI, EDAC(t), and a side-by-side comparison of the duration forecasts of the PV method, Jacob’s earned duration, ES and EDM |
| Comparison over time | All indicators and forecasts week by week for three example projects, with the step-by-step calculation at each status date and the error of each forecast against the actual duration |
| Going further (advanced) | A separate module for students who already master the basics: which duration forecast is most accurate at each project stage and whether it errs on the optimistic or pessimistic side, a critical-path scenario where aggregate indices hide a delay, a decision lab (where to spend to recover a week), Lipke’s P-factor (schedule adherence), and an introduction to project control under uncertainty with further reading |

## Features

- **One shared, editable project:** a draggable Gantt chart (start, duration, % complete and status date) and an editable cut-off table at the top of every module. Three invented example projects with a full weekly history, or your own project; days, weeks or months. Everything is saved in the URL, ready to project in class or share.
- **Step-by-step explanations** with every formula filled in with the project’s numbers, S-curves and duration curves drawn with D3, and a traffic light for the indices.
- **Practice mode:** random exercises with a reproducible number and three levels; students compute the EVM, ES and EDM indicators and the tool grades each box (±1 % margin), detects errors carried over from previous answers, explains common mistakes (inverted ratios, reversed subtractions, SPI used instead of SPI(t)…), asks cost and schedule decisions, and shows hints and the step-by-step solution.
- **Question banks for Moodle (for teachers):** generates graded questions in Moodle XML — compute the EVM, ES or EDM indicators (cloze, one numeric box per indicator, with the Practice mode margin) and interpret the results (project status from SV and CV, what TCPI says, why SPI misleads at the end of a project, cost and schedule decisions) — in three difficulty levels, one category per type and level, ready for Moodle’s random questions. Each question’s general feedback gives the solution and links to that very exercise in the tool and in Practice mode.
- **Spanish and English**, light and dark themes, usable on a phone.

## Pedagogical purpose

The tool is designed for undergraduate courses on project management, industrial engineering and operations management. It can be projected in lectures to walk through each method on the same project, used by students on their own to check hand-worked exercises in Practice mode, used in seminars to discuss the limits of each method (the SPI flaw, the stability of CPI, cost-weighted versus duration-weighted progress), or used to build Moodle quizzes with a different exercise for every student.

## Running locally

Open `index.html` in any modern browser. No server or internet connection is needed: D3 v7 is bundled in `vendor/`.

## Tests

Requires Node.js 22 or later.

```
npm test
```

The tests check the calculation engine (worked examples solved by hand, invariants, and the time projections against an independent implementation), the example projects, the project model and its URL encoding, the practice exercise generator and grader (including number parsing in both languages), the texts in both languages, edge cases (no progress yet, budget exhausted, non-finite input) and the Moodle question generator (stored answers match the engine applied to what each statement shows, one correct option, well-formed XML, links that reproduce each exercise). They run on every push with GitHub Actions.

## Project structure

| Path | Contents |
| --- | --- |
| `index.html`, `css/` | Page and styles |
| `js/core/` | Calculation engine (EVM, ES, EDM and forecasts), project model, example projects, practice exercise generator and advanced-module calculations (forecast errors, P-factor, critical-path scenario) |
| `js/modules/` | EVM, ES, EDM, comparison, practice, advanced and Moodle pages, with their Spanish and English texts |
| `js/charts/`, `js/ui/` | D3 charts (Gantt, lines) and the shared project editor |
| `js/narration.js`, `js/i18n.js`, `js/format.js` | Step-by-step narration; Spanish and English texts; number formatting |
| `js/moodle.js` | Moodle question-bank generator (Moodle XML) |
| `js/about.js`, `js/app.js` | About page and footer; page controller |
| `img/logos/`, `vendor/` | Institution logos; D3.js v7 |
| `tests/` | Tests with `node:test` |

## References

- Anbari, F. T. (2003). Earned value project management method and extensions. *Project Management Journal*, 34(4), 12–23.
- Jacob, D. (2003). Forecasting project schedule completion with earned value metrics. *The Measurable News*, March, 7–9.
- Lipke, W. (2003). Schedule is different. *The Measurable News*, Summer, 31–34.
- Lipke, W. (2004). Connecting earned value to the schedule. *The Measurable News*, Winter.
- Vandevoorde, S., & Vanhoucke, M. (2006). A comparison of different project duration forecasting methods using earned value metrics. *International Journal of Project Management*, 24(4), 289–302.
- Khamooshi, H., & Golafshani, H. (2014). EDM: Earned Duration Management, a new approach to schedule performance management and measurement. *International Journal of Project Management*, 32(6), 1019–1041.
- Project Management Institute (2019). *The Standard for Earned Value Management*. PMI.

## How to cite

If you would like to cite this tool, please contact the authors.

## License

- Code: MIT (see [LICENSE](LICENSE)).
- Teaching texts (explanations, step narration, question statements and feedback): CC BY 4.0 (see [LICENSE-CONTENT.md](LICENSE-CONTENT.md)).
- D3.js: ISC licence (see [vendor/d3-LICENSE](vendor/d3-LICENSE)).

## Acknowledgements

We thank Anthropic’s Claude for Science programme for supporting the development of this tool, which was built with the help of Claude.

<p>
  <img src="img/logos/ubu.png" alt="Universidad de Burgos" height="56">&nbsp;&nbsp;
  <img src="img/logos/usal.png" alt="Universidad de Salamanca" height="44">&nbsp;&nbsp;
  <img src="img/logos/upm.png" alt="Universidad Politécnica de Madrid" height="44">&nbsp;&nbsp;
  <img src="img/logos/goonies.png" alt="Los Goonies research group" height="44">
</p>
