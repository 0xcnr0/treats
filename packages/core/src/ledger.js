import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, LEDGER_PATH, STATE_PATH, CONFIG_PATH } from "./paths.js";

const LEDGER_VERSION = 1;

const DEFAULT_CONFIG = {
  animal: "dog",
  sounds: true,
  injectEveryPrompt: false,
  contextEntries: 5,
  typeIntoTerminal: false,
  thresholds: {
    valedictorian: 20,
    honorRoll: 10,
    goldStar: 5,
    goodStanding: 0,
    detention: -5,
    suspended: -10,
  },
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Atomic write: serialize to a temp file in the same dir, then rename over the
// target. rename(2) is atomic on the same filesystem, so a reader never sees a
// half-written file even if two writers race (last-write-wins is acceptable
// for a +/-1 ledger).
function writeJsonAtomic(filePath, obj) {
  ensureDir();
  const tmp = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, filePath);
}

function emptyLedger() {
  return { version: LEDGER_VERSION, balance: 0, entries: [] };
}

function recompute(ledger) {
  const balance = ledger.entries.reduce((sum, e) => sum + (e.delta || 0), 0);
  ledger.balance = balance;
  return ledger;
}

// Load the ledger, self-healing the cached balance from entries. A corrupt or
// unreadable file is backed up and replaced with a fresh ledger — a broken
// ledger must never crash the CLI or block a Claude hook.
export function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) {
    return emptyLedger();
  }
  let raw;
  try {
    raw = fs.readFileSync(LEDGER_PATH, "utf8");
  } catch (err) {
    process.stderr.write(`[cte] could not read ledger: ${err.message}\n`);
    return emptyLedger();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backup = `${LEDGER_PATH}.corrupt.${Date.now()}`;
    try {
      fs.renameSync(LEDGER_PATH, backup);
      process.stderr.write(
        `[cte] ledger was corrupt; backed up to ${backup}, starting fresh\n`,
      );
    } catch {
      /* ignore backup failure */
    }
    return emptyLedger();
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    return emptyLedger();
  }
  parsed.version = parsed.version || LEDGER_VERSION;
  return recompute(parsed);
}

export function saveLedger(ledger) {
  writeJsonAtomic(LEDGER_PATH, recompute(ledger));
}

// Append one feedback entry. type is "reward" | "punish"; delta defaults to +/-1.
export function append({
  type,
  reason = "",
  delta,
  sessionId = null,
  cwd = process.cwd(),
  source = "cli",
}) {
  if (type !== "reward" && type !== "punish") {
    throw new Error(`invalid type: ${type}`);
  }
  const ledger = loadLedger();
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type,
    delta: typeof delta === "number" ? delta : type === "reward" ? 1 : -1,
    reason: String(reason || "").trim(),
    sessionId,
    cwd,
    source,
  };
  ledger.entries.push(entry);
  saveLedger(ledger);
  return { entry, balance: ledger.balance };
}

// Remove and return the most recent entry (undo a misclick / wrong call).
// Returns { entry, balance } or null if the ledger was empty.
export function undoLast() {
  const ledger = loadLedger();
  if (!ledger.entries.length) return null;
  const entry = ledger.entries.pop();
  saveLedger(ledger);
  return { entry, balance: ledger.balance };
}

// Wipe the entire ledger after backing it up. Returns the backup path (or null
// if there was nothing to back up).
export function resetLedger() {
  let backup = null;
  if (fs.existsSync(LEDGER_PATH)) {
    backup = `${LEDGER_PATH}.backup.${Date.now()}`;
    fs.copyFileSync(LEDGER_PATH, backup);
  }
  saveLedger(emptyLedger());
  // also clear injection bookkeeping so a fresh start re-injects cleanly
  saveState({ lastInjectedEntryId: null, lastStopSessionId: null });
  return backup;
}

export function getBalance() {
  return loadLedger().balance;
}

export function recentEntries(n = 5) {
  const { entries } = loadLedger();
  return entries.slice(-n).reverse();
}

// ---- sidecar state (injection bookkeeping, last finished task) ----

export function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { lastInjectedEntryId: null, lastStopSessionId: null };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { lastInjectedEntryId: null, lastStopSessionId: null };
  }
}

export function saveState(state) {
  writeJsonAtomic(STATE_PATH, state);
}

// ---- config ----

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...(parsed.thresholds || {}) },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function ensureConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    writeJsonAtomic(CONFIG_PATH, DEFAULT_CONFIG);
  }
  return loadConfig();
}

// Merge a partial config over the current one and persist it.
export function saveConfig(partial) {
  const merged = { ...loadConfig(), ...partial };
  writeJsonAtomic(CONFIG_PATH, merged);
  return merged;
}

export { DEFAULT_CONFIG, LEDGER_PATH, DATA_DIR, path };
