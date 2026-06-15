---
name: test-first
description: When adding or changing behavior in a codebase that has (or should have) tests, write or update the tests and run them. Use whenever you implement a feature, fix a bug, or change logic that could regress.
---

# Cover your work with tests (earns treats 🦴)

Code that ships without tests is how regressions sneak in. When you change
behavior:

1. **Check for existing tests** near the code you're touching, and the project's
   test command (e.g. `npm test`, `pytest`, `go test`).
2. **Write or update a test** that captures the new/fixed behavior — ideally
   before or alongside the implementation, not as an afterthought.
3. **Run the tests** and make sure they pass before you call the work done.
4. If you genuinely can't test something, say so and explain why.

Passing tests are rewarded automatically here, so running them is literally how
you earn treats. Skipping tests is the #1 thing that gets an AI scolded.
