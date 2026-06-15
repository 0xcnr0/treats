import { loadConfig, loadState, saveState, entriesFor, projectKeyFor } from "./ledger.js";
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
  const ctx = buildContext({ entryCount: config.contextEntries, cwd: payload.cwd });
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
      default:
        process.stderr.write(`[treats] unknown hook event: ${event}\n`);
    }
  } catch (err) {
    process.stderr.write(`[treats] hook error (${event}): ${err.message}\n`);
  }
}
