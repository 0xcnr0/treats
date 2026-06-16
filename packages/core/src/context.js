import { configFor, entriesFor, projectKeyFor, projectName } from "./ledger.js";
import { gradeFor, currentStreak, dominantTheme, topThemes } from "./grades.js";
import { getAnimal } from "./animals.js";

const MAX_LEN = 650;
const REASON_MAX = 60;

// Map a recurring punishment theme to a concrete standing rule.
const RULE_MAP = {
  test: "Always write and run tests for changes.",
  tests: "Always write and run tests for changes.",
  testing: "Always write and run tests for changes.",
  lint: "Fix lint and type errors before finishing.",
  type: "Fix lint and type errors before finishing.",
  types: "Fix lint and type errors before finishing.",
  verbose: "Be concise — no rambling.",
  concise: "Be concise — no rambling.",
  long: "Be concise — no rambling.",
  edge: "Handle edge cases.",
  edge_cases: "Handle edge cases.",
  error: "Handle errors properly.",
  errors: "Handle errors properly.",
  plan: "Plan the approach before coding.",
  slow: "Work efficiently; don't stall.",
  comment: "Document non-obvious code.",
  comments: "Document non-obvious code.",
};

// Derive standing "house rules" for a project from its recurring scoldings.
// Exported for unit testing (tests/context.test.js).
export function houseRules(entries) {
  const themes = topThemes(
    entries.filter((e) => e.type === "punish").map((e) => e.reason),
    3,
    2,
  );
  const rules = [];
  const seen = new Set();
  for (const t of themes) {
    const rule = RULE_MAP[t] || `Watch the recurring issue: "${t}".`;
    if (!seen.has(rule)) {
      seen.add(rule);
      rules.push(rule);
    }
  }
  return rules;
}

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

function clip(s, n) {
  s = String(s || "").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// Build the compact context string injected into Claude via hooks, scoped to the
// session's project (cwd). Hard-capped at ~450 chars. Empty string => nothing to
// inject (this project has no feedback yet).
export function buildContext({ entryCount = 5, cwd, includeHouseRules = false } = {}) {
  const project = projectKeyFor(cwd);
  const entries = entriesFor(project);
  if (!entries.length) return "";
  const balance = entries.reduce((s, e) => s + (e.delta || 0), 0);
  const name = projectName(project);
  const cfg = configFor(project);

  const grade = gradeFor(balance, cfg);
  const recent = entries.slice(-entryCount).reverse();

  const feedback = recent
    .map((e) => {
      const mark = e.type === "reward" ? "✓" : "✗";
      const reason = e.reason ? `"${clip(e.reason, REASON_MAX)}"` : "(no reason)";
      return `${mark} ${reason} (${relTime(e.ts)})`;
    })
    .join(" | ");

  // Behavioral nudge: count punishments in the recent window + dominant theme.
  const window = entries.slice(-entryCount);
  const punishCount = window.filter((e) => e.type === "punish").length;
  const theme = dominantTheme(
    entries.filter((e) => e.type === "punish").slice(-10).map((e) => e.reason),
  );
  const streak = currentStreak(entries);

  const animal = getAnimal(cfg.animal);

  let nudge;
  if (grade.tone === "stern") {
    nudge = `Rock bottom (${grade.name}). Stop and reconsider your approach completely before continuing.`;
  } else if (punishCount >= 3) {
    nudge = `You've been ${animal.badPhrase} on ${punishCount} of the last ${window.length} tasks${theme ? `; repeated reason: ${theme}` : ""}. Shape up to earn treats.`;
  } else if (streak.type === "reward" && streak.count >= 3) {
    nudge = `${streak.count} treats in a row — keep doing exactly that.`;
  } else if (theme) {
    nudge = `Watch out for the recurring issue: ${theme}.`;
  } else {
    nudge = "Earn treats by being correct, concise and thorough.";
  }

  let text =
    `[Treats · ${name}] ${balance} treat(s) — Rank: ${grade.name}. Recent feedback:\n` +
    `${feedback}\n${nudge}`;

  // At session start, add standing rules learned from this project's scoldings.
  if (includeHouseRules) {
    const rules = houseRules(entries);
    if (rules.length) {
      text += `\nHouse rules (learned from past scoldings): ${rules.map((r, i) => `${i + 1}) ${r}`).join(" ")}`;
    }
  }

  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN - 1)}…` : text;
}
