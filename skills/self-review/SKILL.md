---
name: self-review
description: Before telling the user a change is finished, review your own diff for correctness, edge cases, leftovers and broken tests. Use right before you wrap up any coding task.
---

# Review your own work before saying "done" (earns treats 🦴)

A 30-second self-review catches most of the issues a user would otherwise have to
find. Before you wrap up:

1. **Re-read the diff** as if someone else wrote it. Does it actually do what was
   asked?
2. **Edge cases** — empty input, errors, nulls, the off-by-one. Handled?
3. **Leftovers** — stray debug logs, commented-out code, TODOs, unused imports?
4. **Run the tests and the linter** one more time. Green?
5. **Match the surrounding code** — naming, style, patterns.

Then summarize what changed in a sentence or two. Careful finishers earn treats;
half-done work that the user has to fix earns a scolding.
