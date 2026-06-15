#!/usr/bin/env node
import fs from "node:fs";
import { append, undoLast, resetLedger, loadLedger, loadState, loadConfig, saveConfig, ensureConfig } from "../src/ledger.js";
import { gradeFor, currentStreak, gpa } from "../src/grades.js";
import { buildReport, archiveReport } from "../src/report.js";
import { play, speak } from "../src/sound.js";
import { runHook } from "../src/hooks.js";
import { ANIMALS, getAnimal, animalKeys } from "../src/animals.js";

const animal = () => getAnimal(loadConfig().animal);

function usage() {
  return `treats — train Claude Code like a puppy 🦴

Usage:
  treats good [reason...]     Give Claude a treat (+1) for good work
  treats bad  [reason...]     Scold Claude (-1) for bad work
  treats undo                Take back the last treat/scolding
  treats reset --yes         Wipe the whole record (backs it up first)
  treats status [--json]     Show treats, rank and the last thing it did
  treats report [--out FILE] Print (or write) a training report card
  treats report --archive    Write a date-stamped card to the archive
  treats animal [name]       Show or change your animal (dog, cat, dragon, ...)
  treats statusline          Internal: render the status line (your animal, live)
  treats install             One-shot: hooks + slash commands + status line
  treats install-hooks       Install hooks into ~/.claude/settings.json
  treats install-commands    Install /treats:* slash commands (~/.claude/commands)
  treats install-statusline  Show your animal walking in Claude Code's status bar
  treats hook <event>        Internal: Claude Code hook adapter

Examples:
  treats good wrote great tests and kept it concise
  treats bad ignored the lint errors again
  treats status --json

Aliases: 'reward' = good, 'punish' = bad.
`;
}

function rankLine(balance) {
  const g = gradeFor(balance);
  return `${g.emoji} ${g.name}`;
}

function cmdReward(args) {
  const reason = args.join(" ");
  const a = animal();
  // Attribute to the last finished task's session, if Stop recorded one.
  const sessionId = loadState().lastStopSessionId || null;
  const { balance } = append({ type: "reward", reason, sessionId });
  play("reward");
  console.log(`${a.treat} ${a.give} (+1). Treats: ${balance} — ${rankLine(balance)}`);
  if (reason) console.log(`   For: ${reason}`);
}

function cmdPunish(args) {
  const reason = args.join(" ");
  const a = animal();
  const sessionId = loadState().lastStopSessionId || null;
  const { balance } = append({ type: "punish", reason, sessionId });
  play("punish");
  const grade = gradeFor(balance);
  console.log(`🚫 ${a.scold} (-1). Treats: ${balance} — ${grade.emoji} ${grade.name}`);
  if (reason) console.log(`   For: ${reason}`);
  // Audible scolding once the animal drops into a warning/stern rank.
  if (grade.tone === "warning" || grade.tone === "stern") {
    speak(`${a.speak} ${balance} treats.`);
  }
}

function cmdAnimal(args) {
  const cfg = loadConfig();
  const key = args[0];
  if (!key) {
    const cur = getAnimal(cfg.animal);
    console.log(`Current animal: ${cur.emoji} ${cur.label} (treat: ${cur.treat})`);
    console.log("Available: " + animalKeys().map((k) => `${ANIMALS[k].emoji} ${k}`).join("  "));
    console.log("Change it with:  treats animal <name>");
    return;
  }
  if (!ANIMALS[key]) {
    console.error(`Unknown animal: ${key}`);
    console.log("Available: " + animalKeys().join(", "));
    process.exitCode = 1;
    return;
  }
  saveConfig({ animal: key });
  const a = getAnimal(key);
  console.log(`${a.emoji} Your AI is now a ${a.label}. Treats look like ${a.treat}.`);
  const { balance } = loadLedger();
  console.log(`   Current rank: ${rankLine(balance)}`);
}

function cmdUndo() {
  const result = undoLast();
  if (!result) {
    console.log("Nothing to undo — no record yet.");
    return;
  }
  const { entry, balance } = result;
  const mark = entry.type === "reward" ? "treat (+1)" : "scolding (-1)";
  play("report");
  console.log(`↩️  Took back the last ${mark}. Treats: ${balance} — ${rankLine(balance)}`);
  if (entry.reason) console.log(`   Removed: ${entry.reason}`);
}

function cmdStatus(args) {
  const { entries, balance } = loadLedger();
  const grade = gradeFor(balance);
  const streak = currentStreak(entries);
  const last = entries[entries.length - 1];

  if (args.includes("--json")) {
    console.log(
      JSON.stringify({
        treats: balance,
        rank: grade.name,
        emoji: grade.emoji,
        obedience: gpa(entries),
        streak,
        total: entries.length,
        last: last || null,
      }),
    );
    return;
  }

  console.log(`${grade.emoji} ${grade.name}  |  Treats: ${balance}  |  Obedience: ${gpa(entries).toFixed(1)}`);
  if (streak.type) {
    const label = streak.type === "reward" ? "treat" : "scolding";
    console.log(`   Streak: ${streak.count} ${label}(s) in a row`);
  }
  if (last) {
    const mark = last.type === "reward" ? "🦴" : "🚫";
    console.log(`   Last: ${mark} ${last.reason || "(no reason)"}`);
  } else {
    console.log("   Nothing recorded yet.");
  }
}

function cmdReport(args) {
  if (args.includes("--archive")) {
    const file = archiveReport();
    console.log(`Report archived to ${file}`);
    return;
  }
  const md = buildReport();
  const outIdx = args.indexOf("--out");
  if (outIdx !== -1 && args[outIdx + 1]) {
    fs.writeFileSync(args[outIdx + 1], md);
    console.log(`Report written to ${args[outIdx + 1]}`);
  } else {
    console.log(md);
  }
}

function cmdReset(args) {
  if (!args.includes("--yes")) {
    const { balance, entries } = loadLedger();
    console.log("⚠️  This wipes the entire training record.");
    console.log(`   Current: ${entries.length} entries, ${balance} treats.`);
    console.log("   Re-run with --yes to confirm:  treats reset --yes");
    return;
  }
  const backup = resetLedger();
  console.log("🧹 Record reset. Fresh start — 0 treats.");
  if (backup) console.log(`   Backup: ${backup}`);
}

// Read stdin to a string (Claude Code pipes JSON to the status line). Resolves
// quickly with whatever arrived; never hangs the render.
function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 120).unref?.();
  });
}

// Render one frame of the status line: the chosen animal walking a little track,
// followed by its treat count, rank and (if Claude passed it) context usage.
// Claude Code re-runs this per message and, with refreshInterval, every second —
// so the animal appears to walk. `--frame N` forces a frame (for testing/demo).
async function cmdStatusline(args) {
  let info = {};
  if (!args.includes("--frame")) {
    try {
      info = JSON.parse((await readStdin()) || "{}");
    } catch {
      /* ignore */
    }
  }
  const a = animal();
  const { balance } = loadLedger();
  const g = gradeFor(balance);

  // Ping-pong walk across a small track, stepped from the wall clock (or --frame).
  const TRACK = 5;
  const fi = args.indexOf("--frame");
  const step =
    fi !== -1 && args[fi + 1] !== undefined
      ? parseInt(args[fi + 1], 10) || 0
      : Math.floor(Date.now() / 700);
  const t = step % (2 * (TRACK - 1));
  const pos = t < TRACK ? t : 2 * (TRACK - 1) - t;
  let lane = "";
  for (let i = 0; i < TRACK; i++) lane += i === pos ? a.emoji : "·";

  // ANSI styling (status line supports color + emoji).
  const C = {
    reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
    gold: "\x1b[33m", red: "\x1b[31m", green: "\x1b[32m",
  };
  const sign = balance > 0 ? "+" : "";
  const treatColor = balance < 0 ? C.red : C.gold;

  let line =
    `${a.treat} ${lane}  ` +
    `${treatColor}${C.bold}${sign}${balance} treats${C.reset} ` +
    `${C.dim}·${C.reset} ${g.emoji} ${g.name}`;

  const ctx = info?.context_window?.used_percentage;
  if (typeof ctx === "number") {
    line += ` ${C.dim}· ctx ${Math.round(ctx)}%${C.reset}`;
  }
  process.stdout.write(line);
}

async function main() {
  ensureConfig();
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case "good":
    case "reward":
      cmdReward(args);
      break;
    case "bad":
    case "punish":
      cmdPunish(args);
      break;
    case "undo":
      cmdUndo();
      break;
    case "reset":
      cmdReset(args);
      break;
    case "status":
      cmdStatus(args);
      break;
    case "report":
      cmdReport(args);
      break;
    case "animal":
      cmdAnimal(args);
      break;
    case "statusline":
      await cmdStatusline(args);
      break;
    case "install-statusline": {
      const { installStatusline } = await import("../../../scripts/install-statusline.js");
      installStatusline();
      break;
    }
    case "hook":
      await runHook(args[0]);
      break;
    case "install-hooks": {
      const { installHooks } = await import("../../../scripts/install-hooks.js");
      installHooks();
      break;
    }
    case "install-commands": {
      const { installCommands } = await import("../../../scripts/install-commands.js");
      installCommands();
      break;
    }
    case "install": {
      const { installHooks } = await import("../../../scripts/install-hooks.js");
      const { installCommands } = await import("../../../scripts/install-commands.js");
      const { installStatusline } = await import("../../../scripts/install-statusline.js");
      installHooks();
      console.log("");
      installCommands();
      console.log("");
      installStatusline();
      break;
    }
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(usage());
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(usage());
      process.exitCode = 1;
  }
}

main();
