// Unit tests for the PostToolUse command classifier in
// packages/core/src/hooks.js. classify() is a pure regex matcher over a shell
// command string, so these run without touching the ledger or ~/.treats.

import { test, eq } from "./harness.js";
import { classify } from "../packages/core/src/hooks.js";

// --- test runners ----------------------------------------------------------

test("classify: npm/yarn/pnpm test scripts → tests", () => {
  eq(classify("npm test"), "tests");
  eq(classify("npm run test"), "tests");
  eq(classify("yarn test"), "tests");
  eq(classify("pnpm run test"), "tests");
  eq(classify("npm run test:unit"), "tests");
});

test("classify: common test frameworks → tests", () => {
  eq(classify("npx jest"), "tests");
  eq(classify("vitest run"), "tests");
  eq(classify("pytest -q"), "tests");
  eq(classify("go test ./..."), "tests");
  eq(classify("cargo test"), "tests");
  eq(classify("python -m pytest"), "tests");
});

// --- linters ---------------------------------------------------------------

test("classify: linters → lint", () => {
  eq(classify("eslint ."), "lint");
  eq(classify("npm run lint"), "lint");
  eq(classify("ruff check ."), "lint");
  eq(classify("cargo clippy"), "lint");
  eq(classify("prettier --check ."), "lint");
});

// --- builds / typechecks ---------------------------------------------------

test("classify: builds and typechecks → build", () => {
  eq(classify("npm run build"), "build");
  eq(classify("npm run typecheck"), "build");
  eq(classify("tsc --noEmit"), "build");
  eq(classify("cargo build"), "build");
  eq(classify("go build ./..."), "build");
  eq(classify("make"), "build");
});

// --- non-matches -----------------------------------------------------------

test("classify: unrelated commands → null", () => {
  eq(classify("ls -la"), null);
  eq(classify("git status"), null);
  eq(classify("echo hello"), null);
  eq(classify(""), null);
});

// --- precedence ------------------------------------------------------------

test("classify: tests win over lint/build in mixed commands", () => {
  // classify checks TEST_RE first, then LINT_RE, then BUILD_RE.
  eq(classify("npm run build && npm test"), "tests");
  eq(classify("eslint . && npm test"), "tests");
});

test("classify: lint wins over build when no test present", () => {
  eq(classify("npm run lint && npm run build"), "lint");
});
