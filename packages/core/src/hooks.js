import { loadConfig, loadState, saveState, entriesFor, projectKeyFor, append } from "./ledger.js";
import { buildContext } from "./context.js";
import { play } from "./sound.js";

// Read all of stdin as a string (hooks receive a JSON payload there).
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 500).unref?.();
  });
}

function parsePayload(raw) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function emitContext(hookEventName, additionalContext) {
  if (!additionalContext) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName, additionalContext },
    }),
  );
}

// Newest entry id for a given project (for per-project injection dedup).
function newestEntryIdFor(project) {
  const entries = entriesFor(project);
  return entries.length ? entries[entries.length - 1].id : null;
}

// Record which project a session is working in, so the desktop pet can follow
// the project you're currently active in.
function markActiveProject(project) {
  const state = loadState();
  state.lastActiveProject = project;
  saveState(state);
}

// SessionStart: inject this project's standing so Claude starts each session
// aware of how it's been doing on THIS project.
async function sessionStart(payload) {
  const config = loadConfig();
  const project = projectKeyFor(payload.cwd);
  const ctx = buildContext({ entryCount: config.contextEntries, cwd: payload.cwd, includeHouseRules: true });
  emitContext("SessionStart", ctx);
  const state = loadState();
  state.injected = state.injected || {};
  state.injected[project] = newestEntryIdFor(project);
  state.lastActiveProject = project;
  saveState(state);
}

// UserPromptSubmit: re-inject only when THIS project's score changed since the
// last injection for it. Keeps each session quiet unless its own score moved.
async function userPromptSubmit(payload) {
  const config = loadConfig();
  const project = projectKeyFor(payload.cwd);
  const state = loadState();
  state.injected = state.injected || {};
  const newest = newestEntryIdFor(project);

  // Always update the active project (cheap) so the pet follows you.
  state.lastActiveProject = project;

  if (!config.injectEveryPrompt && newest === state.injected[project]) {
    saveState(state);
    return; // nothing new for this project
  }
  const ctx = buildContext({ entryCount: config.contextEntries, cwd: payload.cwd });
  emitContext("UserPromptSubmit", ctx);
  state.injected[project] = newest;
  saveState(state);
}

// ---- guard dog (PreToolUse): block genuinely destructive commands ----

// Each entry: [regex, human reason]. Kept deliberately narrow — only things that
// destroy work or the machine. Opt-in via config.guardDog.
const DANGER = [
  [/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, "recursive force-delete"],
  [/\brm\s+-rf?\s+(\/|~|\$HOME|\*)\s*$/i, "deleting your home or root"],
  [/\bgit\s+push\b[^\n]*--force(?!-with-lease)/i, "force-push (can erase history)"],
  [/\bgit\s+push\b[^\n]*\s-f(\s|$)/i, "force-push (can erase history)"],
  [/\bgit\s+reset\s+--hard\b/i, "hard reset (throws away changes)"],
  [/\bgit\s+clean\s+-[a-z]*f[a-z]*d|\bgit\s+clean\s+-[a-z]*d[a-z]*f/i, "deleting untracked files"],
  [/\bchmod\s+-R\s+777\b/i, "world-writable permissions"],
  [/\b(mkfs|dd\s+if=|>\s*\/dev\/sd)/i, "wiping a disk"],
  [/:\(\)\s*\{\s*:\|:&\s*\}\s*;:/, "a fork bomb"],
];

function dangerReason(cmd) {
  for (const [re, reason] of DANGER) if (re.test(cmd)) return reason;
  return null;
}

async function preToolUse(payload) {
  if (!loadConfig().guardDog) return;
  if (payload.tool_name !== "Bash") return;
  const cmd = payload.tool_input?.command || "";
  const reason = dangerReason(cmd);
  if (!reason) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `🐶 Bad dog! Blocked: that command looks like ${reason}. If you really mean it, do it yourself.`,
      },
    }),
  );
}

// ---- auto-feedback from real command outcomes (PostToolUse) ----

const TEST_RE = /(\b(npm|yarn|pnpm)\s+(run\s+)?test\b|\bnpx?\s+(jest|vitest)\b|\bjest\b|\bvitest\b|\bpytest\b|\bgo\s+test\b|\bcargo\s+test\b|\bmocha\b|\brspec\b|\bphpunit\b|python\s+-m\s+(unittest|pytest))/i;
const LINT_RE = /(\beslint\b|\b(npm|yarn|pnpm)\s+(run\s+)?lint\b|\bruff\b|\bflake8\b|\bcargo\s+clippy\b|\bclippy\b|\bgolangci-lint\b|\bbiome\s+(check|lint)\b|\bprettier\b[^\n]*--check)/i;
const BUILD_RE = /(\b(npm|yarn|pnpm)\s+(run\s+)?(build|typecheck|tsc|check)\b|\btsc\b|\bcargo\s+build\b|\bgo\s+build\b|\bmake\b)/i;

// Exported for unit testing (tests/hooks.test.js).
export function classify(cmd) {
  if (TEST_RE.test(cmd)) return "tests";
  if (LINT_RE.test(cmd)) return "lint";
  if (BUILD_RE.test(cmd)) return "build";
  return null;
}

// Pull a numeric exit code out of the various shapes a tool result can take.
function exitCodeOf(payload) {
  const r = payload.tool_result ?? payload.tool_response ?? payload.toolResult ?? {};
  if (r && typeof r === "object") {
    for (const k of ["exit_code", "exitCode", "code", "returncode"]) {
      if (typeof r[k] === "number") return r[k];
    }
  }
  return undefined;
}

function emitSystemMessage(msg) {
  process.stdout.write(JSON.stringify({ systemMessage: msg }));
}

// PostToolUse: when Claude runs tests/lint/build, react to the real result.
// Default: a clean pass earns a treat (rate-limited per project). A failure only
// scolds if autoScold is on (failing tests mid-development is normal), but then
// nudges Claude to fix it.
async function postToolUse(payload) {
  if (payload.tool_name !== "Bash") return;
  const cmd = payload.tool_input?.command || "";
  const cat = classify(cmd);
  if (!cat) return;
  const exit = exitCodeOf(payload);
  if (exit === undefined) return; // can't judge — stay quiet

  const cfg = loadConfig();
  const project = projectKeyFor(payload.cwd);
  const state = loadState();
  state.auto = state.auto || {};
  const now = Date.now();
  const last = state.auto[project] || 0;
  const cooldown = cfg.autoCooldownMs || 90000;

  if (exit === 0) {
    if (!cfg.autoTreats) return;
    if (now - last < cooldown) return; // don't farm treats on repeated runs
    append({ type: "reward", reason: `${cat} passed ✅ (auto)`, source: "auto", cwd: payload.cwd, project });
    state.auto[project] = now;
    saveState(state);
    if (cfg.sounds) play("reward");
    return;
  }

  // failure
  if (!cfg.autoScold) return; // default: don't punish normal red-test cycles
  if (now - last >= cooldown) {
    append({ type: "punish", reason: `${cat} failed ❌ (auto)`, source: "auto", cwd: payload.cwd, project });
    state.auto[project] = now;
    saveState(state);
    if (cfg.sounds) play("punish");
  }
  emitSystemMessage(`🐾 Treats: that ${cat} run failed — fix it before you finish to earn a treat.`);
}

// Stop: record the finished session + its project for attribution.
async function stop(payload) {
  const project = projectKeyFor(payload.cwd);
  const state = loadState();
  state.lastStopSessionId = payload.session_id || null;
  state.lastActiveProject = project;
  saveState(state);
  if (loadConfig().sounds) play("report");
}

// Dispatch a hook event. Always resolves; never throws — a broken ledger must
// not block Claude.
export async function runHook(event) {
  let raw = "";
  try {
    raw = await readStdin();
  } catch {
    /* ignore */
  }
  const payload = parsePayload(raw);
  try {
    switch (event) {
      case "session-start":
        await sessionStart(payload);
        break;
      case "user-prompt-submit":
        await userPromptSubmit(payload);
        break;
      case "stop":
        await stop(payload);
        break;
      case "post-tool-use":
        await postToolUse(payload);
        break;
      case "pre-tool-use":
        await preToolUse(payload);
        break;
      default:
        process.stderr.write(`[treats] unknown hook event: ${event}\n`);
    }
  } catch (err) {
    process.stderr.write(`[treats] hook error (${event}): ${err.message}\n`);
  }
}
