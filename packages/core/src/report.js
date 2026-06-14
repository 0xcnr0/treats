import fs from "node:fs";
import path from "node:path";
import { loadLedger, loadConfig, DATA_DIR } from "./ledger.js";
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

// Build the full markdown report card.
export function buildReport() {
  const ledger = loadLedger();
  const { entries, balance } = ledger;
  const grade = gradeFor(balance);
  const streak = currentStreak(entries);
  const score = gpa(entries);

  const rewards = entries.filter((e) => e.type === "reward").length;
  const punishments = entries.filter((e) => e.type === "punish").length;

  // running balance for the sparkline
  let running = 0;
  const runningSeries = entries.map((e) => (running += e.delta || 0));

  const a = getAnimal(loadConfig().animal);

  const lines = [];
  lines.push(`# ${a.treat} Treats — ${a.label} Training Report Card`);
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

// Write the report into the archive dir with a date-stamped filename. Used by
// the weekly launchd job. Returns the file path.
export function archiveReport(date = new Date()) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const file = path.join(REPORTS_DIR, `report-${stamp}.md`);
  fs.writeFileSync(file, buildReport());
  return file;
}
