// Unit tests for the `treats config` helpers in packages/core/src/ledger.js.
// coerceConfigValue is pure (string in, typed value or error out), so it runs
// in-process without touching ~/.treats.

import { test, assert, eq } from "./harness.js";
import { CONFIG_FLAGS, coerceConfigValue } from "../packages/core/src/ledger.js";

// --- CONFIG_FLAGS ----------------------------------------------------------

test("CONFIG_FLAGS: exposes the documented settable flags", () => {
  for (const k of ["animal", "sounds", "autoTreats", "autoScold", "guardDog"]) {
    assert(CONFIG_FLAGS[k], `expected ${k} to be settable`);
    assert(typeof CONFIG_FLAGS[k].desc === "string", `${k} needs a description`);
  }
});

// --- coerceConfigValue: booleans -------------------------------------------

test("coerceConfigValue: accepts truthy spellings as true", () => {
  for (const raw of ["true", "on", "yes", "1", "TRUE", " On "]) {
    eq(coerceConfigValue("sounds", raw), { value: true }, `"${raw}" should be true`);
  }
});

test("coerceConfigValue: accepts falsy spellings as false", () => {
  for (const raw of ["false", "off", "no", "0", "FALSE", " Off "]) {
    eq(coerceConfigValue("sounds", raw), { value: false }, `"${raw}" should be false`);
  }
});

test("coerceConfigValue: rejects garbage for a bool flag", () => {
  const { value, error } = coerceConfigValue("autoTreats", "maybe");
  eq(value, undefined);
  assert(/true\/false/.test(error), "error should mention true/false");
});

// --- coerceConfigValue: strings & unknown keys -----------------------------

test("coerceConfigValue: trims string values", () => {
  eq(coerceConfigValue("animal", "  dragon  "), { value: "dragon" });
});

test("coerceConfigValue: empty string value is an error", () => {
  const { error } = coerceConfigValue("animal", "   ");
  assert(/expects a value/.test(error), "empty value should be rejected");
});

test("coerceConfigValue: unknown key is an error", () => {
  const { error } = coerceConfigValue("nope", "x");
  assert(/Unknown config key/.test(error), "unknown key should be rejected");
});
