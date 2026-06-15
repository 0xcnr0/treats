// Install personal slash commands into ~/.claude/commands/treats/ so `/treats:good`
// etc. work in every Claude Code session WITHOUT the plugin (handy for the
// from-source / power-user setup). Commands call the local treats.js by absolute
// path. Usage: node scripts/install-commands.js [--uninstall]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TREATS_BIN = path.resolve(__dirname, "../packages/core/bin/treats.js");
const CMD_DIR = path.join(os.homedir(), ".claude", "commands", "treats");

// Quote for safe shell use (the repo path may contain spaces).
const shq = (p) => `"${String(p).replace(/"/g, '\\"')}"`;
const BIN = `node ${shq(TREATS_BIN)}`;

// name -> { verb, desc, hint }  (hint present => command takes $ARGUMENTS)
const COMMANDS = {
  good: { verb: "good", desc: "Give your AI a treat for good work (+1)", hint: "[reason]" },
  bad: { verb: "bad", desc: "Scold your AI for bad work (-1)", hint: "[reason]" },
  status: { verb: "status", desc: "Show treats, rank and last feedback" },
  report: { verb: "report", desc: "Print the training report card" },
  undo: { verb: "undo", desc: "Take back the last treat/scolding" },
  animal: { verb: "animal", desc: "Show or change your animal", hint: "[name]" },
  statusline: { verb: "install-statusline", desc: "Show your animal walking in the status bar" },
};

function fileFor({ verb, desc, hint }) {
  const fm = ["---", `description: ${desc}`];
  if (hint) fm.push(`argument-hint: "${hint}"`);
  fm.push("allowed-tools: Bash(node:*)", "---", "");
  const call = hint ? `!\`${BIN} ${verb} $ARGUMENTS\`` : `!\`${BIN} ${verb}\``;
  return `${fm.join("\n")}\n${call}\n`;
}

const uninstall = process.argv.includes("--uninstall");

if (uninstall) {
  if (fs.existsSync(CMD_DIR)) fs.rmSync(CMD_DIR, { recursive: true, force: true });
  console.log(`🗑️  Removed personal Treats slash commands (${CMD_DIR}).`);
  process.exit(0);
}

export function installCommands() {
  fs.mkdirSync(CMD_DIR, { recursive: true });
  for (const [name, spec] of Object.entries(COMMANDS)) {
    fs.writeFileSync(path.join(CMD_DIR, `${name}.md`), fileFor(spec));
  }
  console.log("⌨️  Treats slash commands installed.");
  console.log(`   ${CMD_DIR}`);
  console.log("   Use in any session: /treats:good · /treats:bad · /treats:status · /treats:report · /treats:animal · /treats:undo · /treats:statusline");
  console.log("\nNo restart needed — Claude Code picks up personal commands immediately.");
}

// Allow running directly: node scripts/install-commands.js
if (import.meta.url === `file://${process.argv[1]}`) installCommands();
