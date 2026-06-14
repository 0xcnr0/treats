import { loadLedger, loadConfig } from "./ledger.js";
import { gradeFor, currentStreak, dominantTheme } from "./grades.js";
import { getAnimal } from "./animals.js";

const MAX_LEN = 450;
const REASON_MAX = 60;

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

// Build the compact context string injected into Claude via hooks. Hard-capped
// at ~450 chars so it never bloats the conversation. Empty string => nothing to
// inject (caller should emit no output).
export function buildContext({ entryCount = 5 } = {}) {
  const ledger = loadLedger();
  const { entries, balance } = ledger;
  if (!entries.length) return "";

  const grade = gradeFor(balance);
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

  const animal = getAnimal(loadConfig().animal);

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

  const text =
    `[Treats] ${balance} treat(s) — Rank: ${grade.name}. Recent feedback:\n` +
    `${feedback}\n${nudge}`;

  return text.length > MAX_LEN ? `${text.slice(0, MAX_LEN - 1)}…` : text;
}
