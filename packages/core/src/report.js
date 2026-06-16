import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { configFor, DATA_DIR, entriesFor, projectKeyFor, projectName, listProjects } from "./ledger.js";
import { gradeFor, currentStreak, gpa, dominantTheme } from "./grades.js";
import { getAnimal } from "./animals.js";

export const REPORTS_DIR = path.join(DATA_DIR, "reports");

const SPARK = "▁▂▃▄▅▆▇█";

function sparkline(values) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (SPARK.length - 1));
      return SPARK[idx];
    })
    .join("");
}

function relTime(iso) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

// Synthesize "Teacher's Comments" from reward vs punishment reason themes.
function teacherComments(entries) {
  const praiseTheme = dominantTheme(
    entries.filter((e) => e.type === "reward").map((e) => e.reason),
  );
  const scoldTheme = dominantTheme(
    entries.filter((e) => e.type === "punish").map((e) => e.reason),
  );
  const lines = [];
  if (praiseTheme) {
    lines.push(`Consistently praised for **${praiseTheme}** — keep it up.`);
  }
  if (scoldTheme) {
    lines.push(
      `Recurring problem area: **${scoldTheme}**. Needs focused improvement.`,
    );
  }
  if (!lines.length) {
    lines.push("Not enough feedback yet to identify patterns.");
  }
  return lines;
}

// Build the full markdown report card for one project. Pass an explicit
// `project` key, or a `cwd` to resolve one (defaults to the current dir).
export function buildReport({ cwd, project: projectKey } = {}) {
  const project = projectKey || projectKeyFor(cwd);
  const cfg = configFor(project);
  const entries = entriesFor(project);
  const balance = entries.reduce((s, e) => s + (e.delta || 0), 0);
  const grade = gradeFor(balance, cfg);
  const streak = currentStreak(entries);
  const score = gpa(entries);

  const rewards = entries.filter((e) => e.type === "reward").length;
  const punishments = entries.filter((e) => e.type === "punish").length;

  // running balance for the sparkline
  let running = 0;
  const runningSeries = entries.map((e) => (running += e.delta || 0));

  const a = getAnimal(cfg.animal);

  const lines = [];
  lines.push(`# ${a.treat} Treats — ${projectName(project)} (${a.label}) Report Card`);
  lines.push("");
  lines.push(`**Rank:** ${grade.emoji} ${grade.name}`);
  lines.push(`**Treats:** ${balance} ${a.treat}`);
  lines.push(`**Obedience:** ${score.toFixed(1)} / 4.0`);
  lines.push(
    `**Treats given:** ${rewards}  •  **Scoldings:** ${punishments}  •  **Total feedback:** ${entries.length}`,
  );
  if (streak.type) {
    const label = streak.type === "reward" ? "treats" : "scoldings";
    lines.push(`**Current streak:** ${streak.count} ${label} in a row`);
    if (streak.type === "reward" && streak.count >= 5) {
      lines.push("");
      lines.push("> 🏅 **Good boy bonus** — five clean tasks running!");
    }
  }
  if (runningSeries.length) {
    lines.push("");
    lines.push(`**Trend:** \`${sparkline(runningSeries)}\``);
  }

  lines.push("");
  lines.push("## Trainer's Notes");
  for (const c of teacherComments(entries)) lines.push(`- ${c}`);

  lines.push("");
  lines.push("## Recent History");
  if (!entries.length) {
    lines.push("_No feedback recorded yet._");
  } else {
    lines.push("| When | Type | Δ | Reason | Source |");
    lines.push("|---|---|---|---|---|");
    for (const e of entries.slice(-15).reverse()) {
      const icon = e.type === "reward" ? `${a.treat} treat` : "🚫 scold";
      const reason = (e.reason || "—").replace(/\|/g, "\\|");
      lines.push(
        `| ${relTime(e.ts)} | ${icon} | ${e.delta > 0 ? "+" : ""}${e.delta} | ${reason} | ${e.source} |`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

// A filesystem-safe, collision-resistant slug for a project key: its folder
// name plus a short hash of the full path (so two repos sharing a basename
// don't overwrite each other's archived card).
function projectSlug(projectKey) {
  const name =
    projectName(projectKey)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";
  const hash = crypto.createHash("sha1").update(String(projectKey)).digest("hex").slice(0, 6);
  return `${name}-${hash}`;
}

// Write a date-stamped report card for EVERY project into the archive dir. Used
// by the weekly launchd job. Falls back to the cwd's project when the ledger is
// empty, so the command always produces at least one card. Returns the list of
// file paths written.
export function archiveReport(date = new Date()) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const projects = listProjects();
  const keys = projects.length ? projects.map((p) => p.project) : [projectKeyFor()];
  const files = [];
  for (const project of keys) {
    const file = path.join(REPORTS_DIR, `report-${stamp}-${projectSlug(project)}.md`);
    fs.writeFileSync(file, buildReport({ project }));
    files.push(file);
  }
  return files;
}
