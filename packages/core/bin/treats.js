#!/usr/bin/env node
import fs from "node:fs";
import {
  append, undoLast, resetLedger, resetProject, loadState, loadConfig, saveConfig, ensureConfig,
  entriesFor, balanceFor, projectKeyFor, projectName, listProjects, globalStats,
  CONFIG_FLAGS, coerceConfigValue, animalKeyFor, configFor, setProjectAnimal,
  DATA_DIR,
} from "../src/ledger.js";
import { gradeFor, currentStreak, gpa } from "../src/grades.js";
import { buildReport, archiveReport } from "../src/report.js";
import { play, speak } from "../src/sound.js";
import { runHook } from "../src/hooks.js";
import { ANIMALS, getAnimal, animalKeys } from "../src/animals.js";

const here = () => projectKeyFor(process.cwd());
const animalFor = (project) => getAnimal(animalKeyFor(project));
const animal = () => animalFor(here());

function usage() {
  return `treats — train Claude Code like a puppy 🦴

Usage:
  treats good [reason...]     Give Claude a treat (+1) for good work
  treats bad  [reason...]     Scold Claude (-1) for bad work
  treats undo [--project N]  Take back the last treat/scolding (in project N)
  treats reset --yes         Wipe the whole record (backs it up first)
  treats status [--json]     This project's treats, rank and last feedback
  treats projects [--json]   List every project and its score
  treats stats [--json]      Totals across all projects (treats, scoldings, ...)
  treats report [--out FILE] Print (or write) this project's report card
  treats report --archive    Archive a date-stamped card for every project
  treats animal [name] [--here]  Show/change your animal (--here: this project only)
  treats config [key [val]]  View or change settings (sounds, autoTreats, ...)
  treats statusline          Internal: render the status line (your animal, live)
  treats install             One-shot: hooks + slash commands + status line
  treats install-hooks       Install hooks into ~/.claude/settings.json
  treats install-commands    Install /treats:* slash commands (~/.claude/commands)
  treats install-skills      Install good-practice skills (plan/test/self-review)
  treats install-statusline  Show your animal walking in Claude Code's status bar
  treats hook <event>        Internal: Claude Code hook adapter

Examples:
  treats good wrote great tests and kept it concise
  treats bad ignored the lint errors again
  treats status --json

Aliases: 'reward' = good, 'punish' = bad.
`;
}

// Rank label for a balance. Pass a project key to use that project's animal;
// omit it (e.g. for cross-project aggregates) to use the global animal.
function rankLine(balance, project = null) {
  const g = gradeFor(balance, project ? configFor(project) : loadConfig());
  return `${g.emoji} ${g.name}`;
}

function cmdReward(args) {
  const reason = args.join(" ");
  const a = animal();
  const sessionId = loadState().lastStopSessionId || null;
  const { balance } = append({ type: "reward", reason, sessionId });
  play("reward");
  console.log(`${a.treat} ${a.give} (+1) · ${projectName(here())}. Treats: ${balance} — ${rankLine(balance, here())}`);
  if (reason) console.log(`   For: ${reason}`);
}

function cmdPunish(args) {
  const reason = args.join(" ");
  const a = animal();
  const sessionId = loadState().lastStopSessionId || null;
  const { balance } = append({ type: "punish", reason, sessionId });
  play("punish");
  const grade = gradeFor(balance, configFor(here()));
  console.log(`🚫 ${a.scold} (-1) · ${projectName(here())}. Treats: ${balance} — ${grade.emoji} ${grade.name}`);
  if (reason) console.log(`   For: ${reason}`);
  if (grade.tone === "warning" || grade.tone === "stern") {
    speak(`${a.speak} ${balance} treats.`);
  }
}

function cmdAnimal(args) {
  const cfg = loadConfig();
  const project = here();
  const local = args.includes("--here");
  const key = args.find((a) => !a.startsWith("--"));

  if (!key) {
    const cur = getAnimal(animalKeyFor(project, cfg));
    const override = (cfg.projectAnimals || {})[project];
    const scope = override ? `set for ${projectName(project)}` : "global default";
    console.log(`Current animal: ${cur.emoji} ${cur.label} (treat: ${cur.treat}) — ${scope}`);
    console.log("Available: " + animalKeys().map((k) => `${ANIMALS[k].emoji} ${k}`).join("  "));
    console.log("Change it with:  treats animal <name>          (everywhere)");
    console.log("            or:  treats animal <name> --here   (this project only)");
    return;
  }

  // `--here default` (or global/none/reset) clears the per-project override.
  if (local && ["default", "global", "none", "reset"].includes(key.toLowerCase())) {
    setProjectAnimal(project, null);
    const a = animalFor(project);
    console.log(`↩️  ${projectName(project)} now uses the global animal: ${a.emoji} ${a.label}.`);
    return;
  }

  if (!ANIMALS[key]) {
    console.error(`Unknown animal: ${key}`);
    console.log("Available: " + animalKeys().join(", "));
    process.exitCode = 1;
    return;
  }
  const a = getAnimal(key);
  if (local) {
    setProjectAnimal(project, key);
    console.log(`${a.emoji} ${projectName(project)} is now a ${a.label}. Treats look like ${a.treat}.`);
  } else {
    saveConfig({ animal: key });
    console.log(`${a.emoji} Your AI is now a ${a.label}. Treats look like ${a.treat}.`);
  }
  console.log(`   Current rank (${projectName(project)}): ${rankLine(balanceFor(project), project)}`);
}

function cmdConfig(args) {
  const [key, ...rest] = args;
  const cfg = loadConfig();

  // No key: list every settable flag, its current value and what it does.
  if (!key) {
    console.log("Settings (change with:  treats config <key> <value>)\n");
    for (const [k, flag] of Object.entries(CONFIG_FLAGS)) {
      console.log(`  ${k.padEnd(11)} ${String(cfg[k]).padEnd(7)} ${flag.desc}`);
    }
    return;
  }

  if (!CONFIG_FLAGS[key]) {
    console.error(`Unknown setting: ${key}`);
    console.log("Settable: " + Object.keys(CONFIG_FLAGS).join(", "));
    process.exitCode = 1;
    return;
  }

  // Key only: show that one value.
  if (!rest.length) {
    console.log(`${key} = ${String(cfg[key])}`);
    console.log(`   ${CONFIG_FLAGS[key].desc}`);
    return;
  }

  // animal has its own validation + friendly output; reuse it.
  if (key === "animal") {
    cmdAnimal([rest[0]]);
    return;
  }

  const { value, error } = coerceConfigValue(key, rest.join(" "));
  if (error) {
    console.error(error);
    process.exitCode = 1;
    return;
  }
  saveConfig({ [key]: value });
  console.log(`✅ ${key} = ${value}`);
}

// Resolve a user-typed project name (its folder name, or a full project key) to
// a stored project key. Returns { project } on a unique match, else { error }.
function resolveProject(name) {
  const all = listProjects();
  const exact = all.find((p) => p.project === name);
  if (exact) return { project: exact.project };
  const byName = all.filter((p) => projectName(p.project) === name);
  if (byName.length === 1) return { project: byName[0].project };
  if (byName.length > 1) {
    return {
      error:
        `"${name}" matches ${byName.length} projects:\n` +
        byName.map((p) => `   ${p.project}`).join("\n") +
        `\n   Pass the full path to disambiguate.`,
    };
  }
  return {
    error:
      `No project named "${name}".` +
      (all.length
        ? `\n   Known: ${all.map((p) => projectName(p.project)).join(", ")}`
        : ""),
  };
}

function cmdUndo(args = []) {
  let project = here();
  const pIdx = args.indexOf("--project");
  if (pIdx !== -1) {
    const name = args[pIdx + 1];
    if (!name) {
      console.error("Usage: treats undo --project <name>");
      process.exitCode = 1;
      return;
    }
    const resolved = resolveProject(name);
    if (resolved.error) {
      console.error(resolved.error);
      process.exitCode = 1;
      return;
    }
    project = resolved.project;
  }

  const result = undoLast(project);
  if (!result) {
    console.log(`Nothing to undo in ${projectName(project)}.`);
    return;
  }
  const { entry, balance } = result;
  const mark = entry.type === "reward" ? "treat (+1)" : "scolding (-1)";
  play("report");
  console.log(`↩️  Took back the last ${mark} · ${projectName(project)}. Treats: ${balance} — ${rankLine(balance, project)}`);
  if (entry.reason) console.log(`   Removed: ${entry.reason}`);
}

function cmdStatus(args) {
  const project = here();
  const entries = entriesFor(project);
  const balance = entries.reduce((s, e) => s + (e.delta || 0), 0);
  const grade = gradeFor(balance, configFor(project));
  const streak = currentStreak(entries);
  const last = entries[entries.length - 1];

  if (args.includes("--json")) {
    console.log(
      JSON.stringify({
        project: projectName(project),
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

  console.log(`${grade.emoji} ${grade.name}  |  ${projectName(project)}  |  Treats: ${balance}  |  Obedience: ${gpa(entries).toFixed(1)}`);
  if (streak.type) {
    const label = streak.type === "reward" ? "treat" : "scolding";
    console.log(`   Streak: ${streak.count} ${label}(s) in a row`);
  }
  if (last) {
    const mark = last.type === "reward" ? "🦴" : "🚫";
    console.log(`   Last: ${mark} ${last.reason || "(no reason)"}`);
  } else {
    console.log("   Nothing recorded yet in this project. (See all: treats projects)");
  }
}

function cmdProjects(args = []) {
  const all = listProjects();

  if (args.includes("--json")) {
    console.log(
      JSON.stringify(
        all.map((p) => ({
          project: projectName(p.project),
          balance: p.balance,
          rank: gradeFor(p.balance, configFor(p.project)).name,
          count: p.count,
          lastTs: p.lastTs,
        })),
      ),
    );
    return;
  }

  if (!all.length) {
    console.log("No feedback recorded in any project yet.");
    return;
  }
  console.log("Projects by recent activity:");
  for (const p of all) {
    const g = gradeFor(p.balance, configFor(p.project));
    console.log(`  ${g.emoji} ${String(p.balance).padStart(3)}  ${projectName(p.project).padEnd(22)} ${g.name}`);
  }
}

function cmdStats(args) {
  const s = globalStats();

  if (args.includes("--json")) {
    console.log(
      JSON.stringify({
        treats: s.rewards,
        scoldings: s.scoldings,
        net: s.net,
        total: s.total,
        projects: s.projectCount,
        topRanked: s.topRanked
          ? { project: projectName(s.topRanked.project), balance: s.topRanked.balance }
          : null,
        busiest: s.busiest
          ? { project: projectName(s.busiest.project), count: s.busiest.count }
          : null,
      }),
    );
    return;
  }

  if (!s.total) {
    console.log("No feedback recorded in any project yet.");
    return;
  }

  console.log(`All projects (${s.projectCount}):`);
  console.log(`  🦴 Treats given:  ${s.rewards}`);
  console.log(`  🚫 Scoldings:     ${s.scoldings}`);
  console.log(`  📊 Net balance:   ${s.net > 0 ? "+" : ""}${s.net}  ${rankLine(s.net)}`);
  if (s.topRanked) {
    const g = gradeFor(s.topRanked.balance, configFor(s.topRanked.project));
    const sign = s.topRanked.balance > 0 ? "+" : "";
    console.log(`  🏆 Top project:   ${projectName(s.topRanked.project)} (${sign}${s.topRanked.balance}, ${g.emoji} ${g.name})`);
  }
  if (s.busiest) {
    console.log(`  🔥 Busiest:       ${projectName(s.busiest.project)} (${s.busiest.count} entries)`);
  }
}

function cmdReport(args) {
  if (args.includes("--archive")) {
    const files = archiveReport();
    if (files.length === 1) {
      console.log(`Report archived to ${files[0]}`);
    } else {
      console.log(`Archived ${files.length} report cards:`);
      for (const f of files) console.log(`  ${f}`);
    }
    return;
  }
  const md = buildReport({ cwd: process.cwd() });
  const outIdx = args.indexOf("--out");
  if (outIdx !== -1 && args[outIdx + 1]) {
    fs.writeFileSync(args[outIdx + 1], md);
    console.log(`Report written to ${args[outIdx + 1]}`);
  } else {
    console.log(md);
  }
}

function cmdReset(args) {
  const all = args.includes("--all");
  const project = here();
  if (!args.includes("--yes")) {
    if (all) {
      console.log("⚠️  --all wipes EVERY project's record.");
      console.log("   Re-run to confirm:  treats reset --all --yes");
    } else {
      const n = entriesFor(project).length;
      console.log(`⚠️  This wipes the record for this project (${projectName(project)}): ${n} entries.`);
      console.log("   Re-run to confirm:  treats reset --yes");
      console.log("   (Wipe everything instead: treats reset --all --yes)");
    }
    return;
  }
  if (all) {
    const backup = resetLedger();
    console.log("🧹 All projects reset. Fresh start everywhere.");
    if (backup) console.log(`   Backup: ${backup}`);
  } else {
    const removed = resetProject(project);
    console.log(`🧹 ${projectName(project)} reset — removed ${removed} entries.`);
  }
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
  // Scope the status line to this session's project.
  const cwd = info?.workspace?.current_dir || info?.cwd || process.cwd();
  const project = projectKeyFor(cwd);
  const a = animalFor(project);
  const balance = balanceFor(project);
  const g = gradeFor(balance, configFor(project));

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
      cmdUndo(args);
      break;
    case "reset":
      cmdReset(args);
      break;
    case "status":
      cmdStatus(args);
      break;
    case "projects":
      cmdProjects(args);
      break;
    case "stats":
      cmdStats(args);
      break;
    case "report":
      cmdReport(args);
      break;
    case "animal":
      cmdAnimal(args);
      break;
    case "config":
      cmdConfig(args);
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
    case "install-skills": {
      const { installSkills } = await import("../../../scripts/install-skills.js");
      installSkills();
      break;
    }
    case "install": {
      const { installHooks } = await import("../../../scripts/install-hooks.js");
      const { installCommands } = await import("../../../scripts/install-commands.js");
      const { installSkills } = await import("../../../scripts/install-skills.js");
      const { installStatusline } = await import("../../../scripts/install-statusline.js");
      installHooks();
      console.log("");
      installCommands();
      console.log("");
      installSkills();
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

// A read-only or full ~/.treats volume (e.g. a locked-down corp Mac) shouldn't
// crash with a raw stack trace. Catch the filesystem errors that mean "can't
// write here" and explain it in one friendly line instead.
const WRITE_ERRORS = new Set(["EROFS", "EACCES", "EPERM", "ENOSPC", "EDQUOT"]);
main().catch((err) => {
  if (err && WRITE_ERRORS.has(err.code)) {
    const full = err.code === "ENOSPC" || err.code === "EDQUOT";
    console.error(
      full
        ? `Treats couldn't save: the disk holding ${DATA_DIR} is full.`
        : `Treats couldn't save to ${DATA_DIR} — that folder is read-only.`,
    );
    console.error("Your treat count is safe; nothing was changed this time.");
    process.exitCode = 1;
    return;
  }
  throw err; // unexpected — let it surface with a full stack trace
});
