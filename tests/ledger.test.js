// Unit tests for packages/core/src/ledger.js.
//
// The pure query helpers (balanceFor/entriesFor/listProjects) take an explicit
// ledger object, and projectKeyFor only reads the filesystem, so those run
// in-process. The write-path helpers (append/undoLast/resetProject) persist to
// ~/.treats, so they are exercised in a child process with HOME pointed at a
// throwaway temp dir — the real ledger is never touched. See ledger-sandbox.mjs.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert, eq } from "./harness.js";
import {
  projectKeyFor,
  projectName,
  balanceFor,
  entriesFor,
  listProjects,
  globalStats,
  animalKeyFor,
  configFor,
} from "../packages/core/src/ledger.js";

// A synthetic ledger: explicit `project` fields mean entryProject() never has
// to fall back to projectKeyFor(), keeping these tests filesystem-free.
const ledger = {
  version: 1,
  balance: 0,
  entries: [
    { project: "A", delta: 1, type: "reward", ts: "2026-01-01T00:00:00Z" },
    { project: "A", delta: 1, type: "reward", ts: "2026-01-02T00:00:00Z" },
    { project: "B", delta: -1, type: "punish", ts: "2026-01-03T00:00:00Z" },
  ],
};

// --- balanceFor ------------------------------------------------------------

test("balanceFor: sums only the requested project's deltas", () => {
  eq(balanceFor("A", ledger), 2);
  eq(balanceFor("B", ledger), -1);
});

test("balanceFor: unknown project is zero", () => {
  eq(balanceFor("nope", ledger), 0);
});

test("balanceFor: missing delta counts as zero", () => {
  const l = { entries: [{ project: "A" }, { project: "A", delta: 2 }] };
  eq(balanceFor("A", l), 2);
});

test("balanceFor: legacy entries fall back to projectKeyFor(cwd)", () => {
  // No `project` field and a path with no .git anywhere above it, so the key is
  // just the resolved cwd itself.
  const cwd = "/cte/definitely/not/a/repo/xyz";
  const l = { entries: [{ cwd, delta: 1 }, { cwd, delta: 1 }] };
  eq(balanceFor(cwd, l), 2);
});

// --- entriesFor ------------------------------------------------------------

test("entriesFor: returns only the matching project's entries", () => {
  eq(entriesFor("A", ledger).length, 2);
  eq(entriesFor("B", ledger).length, 1);
  eq(entriesFor("nope", ledger).length, 0);
});

// --- listProjects ----------------------------------------------------------

test("listProjects: aggregates balance/count, newest activity first", () => {
  eq(listProjects(ledger), [
    { project: "B", balance: -1, count: 1, lastTs: "2026-01-03T00:00:00Z" },
    { project: "A", balance: 2, count: 2, lastTs: "2026-01-02T00:00:00Z" },
  ]);
});

// --- globalStats -----------------------------------------------------------

test("globalStats: totals treats/scoldings, net, top + busiest project", () => {
  const s = globalStats(ledger);
  eq(s.rewards, 2);
  eq(s.scoldings, 1);
  eq(s.net, 1);
  eq(s.total, 3);
  eq(s.projectCount, 2);
  eq(s.topRanked.project, "A"); // balance 2 beats B's -1
  eq(s.busiest.project, "A"); // 2 entries beats B's 1
});

test("globalStats: empty ledger has zeroed totals and no winners", () => {
  const s = globalStats({ entries: [] });
  eq(s.rewards, 0);
  eq(s.scoldings, 0);
  eq(s.net, 0);
  eq(s.total, 0);
  eq(s.projectCount, 0);
  eq(s.topRanked, null);
  eq(s.busiest, null);
});

// --- animalKeyFor / configFor (per-project animal overrides) ---------------

// Both take an explicit cfg, so they're pure (no ~/.treats access).
const cfgAnimals = { animal: "dog", projectAnimals: { "/proj/cat": "cat" } };

test("animalKeyFor: a per-project override wins over the global animal", () => {
  eq(animalKeyFor("/proj/cat", cfgAnimals), "cat");
});

test("animalKeyFor: projects without an override fall back to global", () => {
  eq(animalKeyFor("/proj/other", cfgAnimals), "dog");
});

test("animalKeyFor: a missing projectAnimals map is tolerated", () => {
  eq(animalKeyFor("/proj/x", { animal: "dragon" }), "dragon");
  eq(animalKeyFor(null, cfgAnimals), "dog");
});

test("configFor: returns a cfg view with animal resolved for the project", () => {
  eq(configFor("/proj/cat", cfgAnimals).animal, "cat");
  eq(configFor("/proj/other", cfgAnimals).animal, "dog");
  // The rest of the config is preserved.
  eq(configFor("/proj/cat", { ...cfgAnimals, sounds: false }).sounds, false);
});

// --- projectName -----------------------------------------------------------

test("projectName: is the trailing folder name of a key", () => {
  eq(projectName("/home/me/code/treats"), "treats");
  eq(projectName(""), "");
});

// --- projectKeyFor (filesystem, read-only) ---------------------------------

test("projectKeyFor: resolves to the nearest git root (realpath'd)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cte-pk-"));
  try {
    fs.mkdirSync(path.join(root, ".git"));
    const sub = path.join(root, "a", "b");
    fs.mkdirSync(sub, { recursive: true });
    const expected = fs.realpathSync(root);
    eq(projectKeyFor(sub), expected, "nested subdir resolves to git root");
    eq(projectKeyFor(root), expected, "git root resolves to itself");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("projectKeyFor: a non-git dir resolves to the dir itself", () => {
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), "cte-plain-"));
  try {
    eq(projectKeyFor(plain), fs.realpathSync(plain));
  } finally {
    fs.rmSync(plain, { recursive: true, force: true });
  }
});

// --- write path (append/undoLast/resetProject), sandboxed ------------------

test("undoLast/resetProject operate per-project (sandboxed HOME)", () => {
  // A throwaway HOME so the child's ~/.treats lives entirely in a temp dir.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "cte-home-"));
  assert(home.startsWith(os.tmpdir()), "sandbox HOME must be under tmpdir");
  try {
    const fixture = fileURLToPath(new URL("./ledger-sandbox.mjs", import.meta.url));
    const stdout = execFileSync(process.execPath, [fixture], {
      env: { ...process.env, HOME: home },
      encoding: "utf8",
    });
    eq(JSON.parse(stdout), {
      balanceP1: 2,
      balanceP2: 0,
      undoP1Type: "reward",
      undoP1Balance: 1,
      balanceP1After: 1,
      undoGlobalProject: "/proj/beta",
      removed: 1,
      balanceP2After: 0,
      removedEmpty: 0,
      undoEmpty: null,
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
