import { loadConfig } from "./ledger.js";
import { getAnimal } from "./animals.js";

// Map a treat balance to a rank for the configured animal. The animal's
// `tiers` array is ordered to line up with these thresholds.
export function gradeFor(balance, cfg = loadConfig()) {
  const thresholds = cfg.thresholds;
  const tiers = getAnimal(cfg.animal).tiers;
  const [vale, honor, gold, good, needs, bad, bottom] = tiers;
  if (balance >= thresholds.valedictorian) return { ...vale, tone: "celebratory" };
  if (balance >= thresholds.honorRoll) return { ...honor, tone: "proud" };
  if (balance >= thresholds.goldStar) return { ...gold, tone: "encouraging" };
  if (balance >= thresholds.goodStanding) return { ...good, tone: "neutral" };
  if (balance <= thresholds.suspended) return { ...bottom, tone: "stern" };
  if (balance <= thresholds.detention) return { ...bad, tone: "warning" };
  return { ...needs, tone: "concerned" };
}

// Length of the current same-type streak at the end of the ledger.
// Returns { type: "reward"|"punish"|null, count }.
export function currentStreak(entries) {
  if (!entries.length) return { type: null, count: 0 };
  const last = entries[entries.length - 1].type;
  let count = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === last) count++;
    else break;
  }
  return { type: last, count };
}

// "GPA": mean delta over the last `window` entries, mapped from [-1, +1] to
// the 0.0–4.0 scale.
export function gpa(entries, window = 20) {
  const slice = entries.slice(-window);
  if (!slice.length) return 4.0;
  const mean = slice.reduce((s, e) => s + (e.delta || 0), 0) / slice.length;
  const clamped = Math.max(-1, Math.min(1, mean));
  return Math.round(((clamped + 1) / 2) * 4 * 10) / 10;
}

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "for", "and", "or", "in", "on", "at", "is",
  "was", "were", "be", "no", "not", "didnt", "did", "you", "your", "it",
  "with", "too", "so", "but", "this", "that", "had", "has", "have", "i",
]);

// Naive keyword frequency over a set of reasons. Returns the most common
// content token if it appears at least `minCount` times, else null. Cheap, but
// produces the "repeated reason: tests" effect.
export function dominantTheme(reasons, minCount = 2) {
  const counts = new Map();
  for (const reason of reasons) {
    const tokens = String(reason || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t));
    for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [token, count] of counts) {
    if (count > bestCount) {
      best = token;
      bestCount = count;
    }
  }
  return bestCount >= minCount ? best : null;
}

// Top recurring content tokens across a set of reasons (count >= minCount).
export function topThemes(reasons, n = 3, minCount = 2) {
  const counts = new Map();
  for (const reason of reasons) {
    for (const t of String(reason || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t);
}
