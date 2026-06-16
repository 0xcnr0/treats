# Backlog

Small, safe, valuable improvements for the autopilot (or anyone) to pick up.
Do one at a time; check it off (`- [x]`) when committed. Keep changes focused.

## Tests & safety
- [x] Add a tiny zero-dependency test runner (`tests/run.js`) and unit tests for
      `grades.js` (gradeFor thresholds, gpa, currentStreak, dominantTheme, topThemes).
- [x] Unit tests for `ledger.js` projectKeyFor (git-root + realpath), balanceFor,
      undoLast(project), resetProject.
- [x] Unit tests for `context.js` (per-project injection, house rules) and the
      PostToolUse classifier in `hooks.js` (test/lint/build regexes).
- [x] Add a `test` npm script and run it in CI (.github/workflows/ci.yml).

## CLI
- [x] `treats config` — view and set config flags (animal, sounds, autoTreats,
      autoScold, guardDog) without hand-editing JSON.
- [x] `treats stats` — totals across all projects (treats given, scoldings, top
      rank, busiest project).
- [x] `treats projects --json` for scripting.
- [x] `treats undo --project <name>` to undo in a non-current project.

## Pet & UX
- [x] More animals (fox 🦊, panda 🐼, frog 🐸, penguin 🐧) with ranks + voices.
- [x] A small "double-click to open the report card" on the pet.
- [x] Remember the chosen animal per project (optional), not just globally.
      (`treats animal <name> --here`; `--here default` clears it.)
- [ ] Pet "thinking" pose while Claude is actively working (if detectable).

## Docs & site
- [ ] A short animated GIF or SVG of petting, embedded on the site.
- [ ] An FAQ section on the website (privacy, uninstall, does it slow Claude down).
- [ ] Improve the README's troubleshooting section.

## Polish
- [x] Make `treats report --archive` iterate every project (it currently archives
      only the cwd's project).
- [ ] Graceful handling when `~/.treats` is on a read-only volume.
