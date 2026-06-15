You are working autonomously on the **Treats** project (a Claude Code desktop pet
that trains AI coding agents with rewards/punishments). Make **one** small, safe,
valuable improvement this run, verify it, and commit it.

RULES — follow exactly:
- Pick **exactly one** concrete task. Prefer the top unchecked item in
  `docs/BACKLOG.md`; when you finish it, check it off (`- [x]`). If the backlog is
  empty, find one small improvement yourself (a unit test, a doc fix, a tiny UX
  polish, a small bug fix, a new animal, etc.).
- Keep the change **small and focused**. Do NOT rewrite large areas. Do NOT remove
  or break existing features. Match the surrounding code style.
- **Verify before committing**: run `node --check` on every JS file you changed,
  and run `npm run demo` — it must finish without errors. If you touched the sound
  or icon generators, run `npm run gen-assets`.
- **Commit** with a clear message ending with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do **NOT** `git push`.
  Do **NOT** create releases or tags.
- **Never** run destructive commands (`rm -rf`, `git reset --hard`,
  `git push --force`, `git clean -fd`). **Never** touch `~/.claude`, `~/.treats`,
  or `settings.json`. **Never** reset or delete the ledger or the user's data.
- Work only inside this repository. If you can't find a safe, worthwhile change,
  exit without committing.

When done, state in one line what you changed.
