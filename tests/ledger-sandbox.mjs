// Exercises the write-path ledger functions (append/undoLast/resetProject)
// against a sandbox HOME so the real ~/.treats ledger is never touched. This is
// run by tests/ledger.test.js in a child process with HOME pointed at a
// throwaway temp dir; it prints a JSON result blob on stdout for the parent to
// assert on. Not named *.test.js, so the runner never picks it up directly.
import {
  append,
  balanceFor,
  undoLast,
  resetProject,
  DATA_DIR,
} from "../packages/core/src/ledger.js";

// Hard safety guard: if DATA_DIR somehow points outside the sandbox HOME, bail
// before writing anything rather than risk clobbering the real ledger.
if (!DATA_DIR.startsWith(process.env.HOME)) {
  process.stderr.write(
    `refusing to run: DATA_DIR ${DATA_DIR} is outside sandbox HOME ${process.env.HOME}\n`,
  );
  process.exit(2);
}

const P1 = "/proj/alpha";
const P2 = "/proj/beta";

// Seed: P1 gets two rewards (+2); P2 gets a punish then a reward (0).
append({ type: "reward", project: P1 });
append({ type: "reward", project: P1 });
append({ type: "punish", project: P2 });
append({ type: "reward", project: P2 });

const out = {};
out.balanceP1 = balanceFor(P1);
out.balanceP2 = balanceFor(P2);

// undoLast scoped to P1 removes only P1's most recent entry.
const u1 = undoLast(P1);
out.undoP1Type = u1.entry.type;
out.undoP1Balance = u1.balance;
out.balanceP1After = balanceFor(P1);

// undoLast with no project removes the most recent entry overall (P2's reward).
const u2 = undoLast();
out.undoGlobalProject = u2.entry.project;

// resetProject wipes one project and reports how many it removed.
out.removed = resetProject(P2);
out.balanceP2After = balanceFor(P2);
out.removedEmpty = resetProject("/nope");

// undoLast on a project with no entries returns null.
out.undoEmpty = undoLast("/nope");

process.stdout.write(JSON.stringify(out));
