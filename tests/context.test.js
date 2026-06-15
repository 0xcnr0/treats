// Unit tests for houseRules() in packages/core/src/context.js. houseRules()
// derives standing rules from a project's recurring scoldings; it's pure over an
// entries array, so these run without touching the ledger or ~/.treats.

import { test, assert, eq } from "./harness.js";
import { houseRules } from "../packages/core/src/context.js";

const punish = (reason) => ({ type: "punish", reason });
const reward = (reason) => ({ type: "reward", reason });

// --- basics ----------------------------------------------------------------

test("houseRules: no entries → no rules", () => {
  eq(houseRules([]), []);
});

test("houseRules: a one-off scolding is not a rule (needs minCount 2)", () => {
  eq(houseRules([punish("forgot the tests")]), []);
});

// --- theme → rule mapping --------------------------------------------------

test("houseRules: a recurring theme maps to its standing rule", () => {
  const entries = [punish("missing tests"), punish("no tests added")];
  eq(houseRules(entries), ["Always write and run tests for changes."]);
});

test("houseRules: an unmapped recurring theme falls back to a watch rule", () => {
  const entries = [punish("flaky deploy"), punish("deploy broke")];
  eq(houseRules(entries), ['Watch the recurring issue: "deploy".']);
});

// --- scoping & dedup -------------------------------------------------------

test("houseRules: only punishments count, rewards are ignored", () => {
  const entries = [
    reward("lint was clean"),
    reward("lint clean again"),
    punish("missing tests"),
    punish("no tests added"),
  ];
  // "lint" recurs in rewards but must not become a rule; only "tests" does.
  eq(houseRules(entries), ["Always write and run tests for changes."]);
});

test("houseRules: synonymous themes dedupe to a single rule", () => {
  // "test" and "tests" both map to the same standing rule.
  const entries = [
    punish("run the test"),
    punish("the test failed"),
    punish("missing tests"),
    punish("more tests"),
  ];
  eq(houseRules(entries), ["Always write and run tests for changes."]);
});

test("houseRules: caps at three rules", () => {
  const entries = ["tests", "tests", "lint", "lint", "verbose", "verbose", "edge", "edge"].map(
    punish,
  );
  assert(houseRules(entries).length === 3, "expected at most 3 house rules");
});
