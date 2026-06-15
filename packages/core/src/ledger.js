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

// Resolve a working directory to a stable "project" key: the nearest git repo
// root (so several terminals in subdirs of one project share a score), else the
// directory itself.
// Canonicalize a path so symlinks (e.g. macOS /tmp → /private/tmp) don't make
// the same project look like two. Falls back to a plain resolve if realpath
// fails (path doesn't exist yet).
function canonical(p) {
  try {
    return fs.realpathSync(path.resolve(p));
  } catch {
    return path.resolve(p);
  }
}

export function projectKeyFor(cwd) {
  let dir;
  try {
    dir = canonical(cwd || process.cwd());
  } catch {
    return String(cwd || "");
  }
  let d = dir;
  for (;;) {
    try {
      if (fs.existsSync(path.join(d, ".git"))) return d;
    } catch {
      /* ignore */
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return dir;
}

// Short, human-friendly name for a project key (its folder name).
export function projectName(key) {
  return path.basename(String(key || "")) || String(key || "");
}

// The project an entry belongs to (older entries only have cwd).
function entryProject(e) {
  return e.project || projectKeyFor(e.cwd);
}

// Append one feedback entry. type is "reward" | "punish"; delta defaults to +/-1.
export function append({
  type,
  reason = "",
  delta,
  sessionId = null,
  cwd = process.cwd(),
  project,
  source = "cli",
}) {
  if (type !== "reward" && type !== "punish") {
    throw new Error(`invalid type: ${type}`);
  }
  const ledger = loadLedger();
  const proj = project || projectKeyFor(cwd);
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type,
    delta: typeof delta === "number" ? delta : type === "reward" ? 1 : -1,
    reason: String(reason || "").trim(),
    sessionId,
    cwd,
    project: proj,
    source,
  };
  ledger.entries.push(entry);
  saveLedger(ledger);
  return { entry, balance: balanceFor(proj, ledger) };
}

// ---- per-project queries ----

export function entriesFor(project, ledger = loadLedger()) {
  return ledger.entries.filter((e) => entryProject(e) === project);
}

export function balanceFor(project, ledger = loadLedger()) {
  return entriesFor(project, ledger).reduce((s, e) => s + (e.delta || 0), 0);
}

// List every project that has feedback, with its current balance + last activity.
export function listProjects(ledger = loadLedger()) {
  const map = new Map();
  for (const e of ledger.entries) {
    const p = entryProject(e);
    const cur = map.get(p) || { project: p, balance: 0, count: 0, lastTs: e.ts };
    cur.balance += e.delta || 0;
    cur.count += 1;
    if (e.ts > cur.lastTs) cur.lastTs = e.ts;
    map.set(p, cur);
  }
  return [...map.values()].sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1));
}

// Remove and return the most recent entry (optionally within one project).
// Returns { entry, balance } or null if there was nothing to undo.
export function undoLast(project = null) {
  const ledger = loadLedger();
  let idx = ledger.entries.length - 1;
  if (project) {
    for (idx = ledger.entries.length - 1; idx >= 0; idx--) {
      if (entryProject(ledger.entries[idx]) === project) break;
    }
  }
  if (idx < 0) return null;
  const [entry] = ledger.entries.splice(idx, 1);
  saveLedger(ledger);
  return { entry, balance: project ? balanceFor(project, ledger) : ledger.balance };
}

// Remove all entries for one project. Returns the number removed.
export function resetProject(project) {
  const ledger = loadLedger();
  const before = ledger.entries.length;
  ledger.entries = ledger.entries.filter((e) => entryProject(e) !== project);
  saveLedger(ledger);
  return before - ledger.entries.length;
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
