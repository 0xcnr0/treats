import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLAUDE_SETTINGS_PATH } from "../packages/core/src/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CTE_BIN = path.resolve(__dirname, "../packages/core/bin/treats.js");

// Hook events this system installs, mapped to the `treats hook <event>` adapter.
// `matcher` (optional) limits the hook to certain tools (PostToolUse → Bash).
const EVENTS = {
  SessionStart: { event: "session-start" },
  UserPromptSubmit: { event: "user-prompt-submit" },
  Stop: { event: "stop" },
  PostToolUse: { event: "post-tool-use", matcher: "Bash" },
  PreToolUse: { event: "pre-tool-use", matcher: "Bash" },
};

function readSettings() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
  } catch (err) {
    throw new Error(
      `~/.claude/settings.json exists but is not valid JSON (${err.message}). Refusing to overwrite.`,
    );
  }
}

function backup() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) return null;
  const dest = `${CLAUDE_SETTINGS_PATH}.backup.${Date.now()}`;
  fs.copyFileSync(CLAUDE_SETTINGS_PATH, dest);
  return dest;
}

// True if some hook entry in `arr` already runs our treats adapter for `event`.
function alreadyInstalled(arr, event) {
  return arr.some((group) =>
    (group.hooks || []).some(
      (h) =>
        typeof h.command === "string" &&
        h.command.includes("treats.js") &&
        h.command.includes(`hook ${event}`),
    ),
  );
}

// Quote a path for safe use in a shell command (the project path may contain
// spaces, e.g. ".../Claude main/...").
function shq(p) {
  return `'${String(p).replace(/'/g, "'\\''")}'`;
}

function hookEntry(event, matcher) {
  const node = process.execPath; // absolute node path; hooks run in a bare shell
  const group = {
    hooks: [
      {
        type: "command",
        command: `${shq(node)} ${shq(CTE_BIN)} hook ${event}`,
      },
    ],
  };
  if (matcher) group.matcher = matcher;
  return group;
}

export function installHooks() {
  const settings = readSettings();
  settings.hooks = settings.hooks || {};

  const added = [];
  const skipped = [];

  for (const [hookName, spec] of Object.entries(EVENTS)) {
    const { event, matcher } = spec;
    const arr = (settings.hooks[hookName] = settings.hooks[hookName] || []);
    if (alreadyInstalled(arr, event)) {
      skipped.push(hookName);
      continue;
    }
    arr.push(hookEntry(event, matcher));
    added.push(hookName);
  }

  if (added.length === 0) {
    console.log("All token-economy hooks already installed. Nothing to do.");
    console.log(`  (present: ${skipped.join(", ") || "none"})`);
    return;
  }

  const backupPath = backup();
  fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));

  console.log("✅ Token economy hooks installed.");
  if (backupPath) console.log(`   Backup: ${backupPath}`);
  console.log(`   Added:   ${added.join(", ")}`);
  if (skipped.length) console.log(`   Skipped (already present): ${skipped.join(", ")}`);
  console.log(`   node:    ${process.execPath}`);
  console.log(`   adapter: ${CTE_BIN}`);
  console.log("\nRestart any running `claude` session for hooks to take effect.");
}
