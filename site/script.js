// In-browser simulation of the real CLI + hook output. Mirrors the logic in
// packages/core (animals.js, grades.js, context.js, report.js) so the demo is
// faithful — including the pick-your-animal theming.

const THRESHOLDS = {
  valedictorian: 20, honorRoll: 10, goldStar: 5, goodStanding: 0,
  detention: -5, suspended: -10,
};

// tiers order: [vale, honor, gold, good, needs, bad, bottom]
const ANIMALS = {
  dog: { label: "Dog", emoji: "🐶", treat: "🦴", badPhrase: "a bad dog",
    tiers: [["Best Boy","🏆"],["Very Good Boy","🌟"],["Good Boy","⭐"],["Good Pup","🐶"],["Needs Training","⚠️"],["Bad Dog","🚫"],["Doghouse","⛔"]] },
  cat: { label: "Cat", emoji: "🐱", treat: "🐟", badPhrase: "a bad cat",
    tiers: [["Top Cat","🏆"],["Purrfect","🌟"],["Good Kitty","⭐"],["Fine Feline","🐱"],["Needs Training","⚠️"],["Bad Cat","🚫"],["Spray Bottle","⛔"]] },
  dragon: { label: "Dragon", emoji: "🐉", treat: "💎", badPhrase: "a disgrace to the hoard",
    tiers: [["Elder Wyrm","🏆"],["Great Wyrm","🌟"],["Fine Dragon","⭐"],["Hatchling","🐉"],["Restless","⚠️"],["Disgraced","🚫"],["Banished","⛔"]] },
  horse: { label: "Horse", emoji: "🐴", treat: "🥕", badPhrase: "a stubborn mule",
    tiers: [["Derby Winner","🏆"],["Champion","🌟"],["Good Horse","⭐"],["Good Foal","🐴"],["Needs Training","⚠️"],["Stubborn Mule","🚫"],["Out to Pasture","⛔"]] },
  hamster: { label: "Hamster", emoji: "🐹", treat: "🌰", badPhrase: "a bad hammy",
    tiers: [["Wheel Champion","🏆"],["Very Good Hammy","🌟"],["Good Hammy","⭐"],["Fluffball","🐹"],["Needs Training","⚠️"],["Bad Hammy","🚫"],["No Wheel","⛔"]] },
  parrot: { label: "Parrot", emoji: "🦜", treat: "🥜", badPhrase: "a bad bird",
    tiers: [["Top Bird","🏆"],["Very Good Bird","🌟"],["Good Bird","⭐"],["Fledgling","🦜"],["Needs Training","⚠️"],["Bad Bird","🚫"],["Covered Cage","⛔"]] },
};

let ANIMAL = ANIMALS[localStorage.getItem("treats-animal") || "dog"] || ANIMALS.dog;

function gradeFor(b) {
  const t = ANIMAL.tiers;
  const mk = (i) => ({ name: t[i][0], emoji: t[i][1] });
  if (b >= THRESHOLDS.valedictorian) return mk(0);
  if (b >= THRESHOLDS.honorRoll) return mk(1);
  if (b >= THRESHOLDS.goldStar) return mk(2);
  if (b >= THRESHOLDS.goodStanding) return mk(3);
  if (b <= THRESHOLDS.suspended) return mk(6);
  if (b <= THRESHOLDS.detention) return mk(5);
  return mk(4);
}

const STOP = new Set(["the","a","an","to","of","for","and","or","in","on","at","is","was","were","be","no","not","didnt","did","you","your","it","with","too","so","but","this","that","had","has","have","i"]);
function dominantTheme(reasons, min = 2) {
  const c = new Map();
  for (const r of reasons) {
    for (const t of String(r || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
      if (t.length > 2 && !STOP.has(t)) c.set(t, (c.get(t) || 0) + 1);
    }
  }
  let best = null, n = 0;
  for (const [t, k] of c) if (k > n) { best = t; n = k; }
  return n >= min ? best : null;
}

function gpa(entries, w = 20) {
  const s = entries.slice(-w);
  if (!s.length) return 4.0;
  const mean = s.reduce((a, e) => a + e.delta, 0) / s.length;
  return Math.round(((Math.max(-1, Math.min(1, mean)) + 1) / 2) * 4 * 10) / 10;
}

const SPARK = "▁▂▃▄▅▆▇█";
function sparkline(vals) {
  if (!vals.length) return "▁";
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  return vals.map((v) => SPARK[Math.round(((v - mn) / rng) * (SPARK.length - 1))]).join("");
}

// ---- state ----
let entries = [];
const balance = () => entries.reduce((a, e) => a + e.delta, 0);

function add(type, reason) {
  entries.push({ type, delta: type === "reward" ? 1 : -1, reason, ts: Date.now() });
  render(type);
}
function undo() { if (entries.length) { entries.pop(); render("undo"); } }
function reset() { entries = []; render("reset"); }

// ---- context block (mirrors context.js) ----
function buildContext() {
  const b = balance();
  if (!entries.length) {
    return `<span class="k">[Treats]</span> No feedback yet. Earn treats by being correct, concise and thorough.`;
  }
  const g = gradeFor(b);
  const recent = entries.slice(-5).reverse();
  const fb = recent.map((e) => {
    const mark = e.type === "reward" ? `<span class="ok">✓</span>` : `<span class="no">✗</span>`;
    return `${mark} "${e.reason}"`;
  }).join("  |  ");

  const window = entries.slice(-5);
  const punish = window.filter((e) => e.type === "punish").length;
  const theme = dominantTheme(entries.filter((e) => e.type === "punish").slice(-10).map((e) => e.reason));

  let nudge;
  if (b <= THRESHOLDS.suspended) nudge = `Rock bottom (${g.name}). Stop and reconsider your approach completely.`;
  else if (punish >= 3) nudge = `You've been ${ANIMAL.badPhrase} on ${punish} of the last ${window.length} tasks${theme ? `; repeated reason: ${theme}` : ""}. Shape up to earn treats.`;
  else if (theme) nudge = `Watch out for the recurring issue: ${theme}.`;
  else nudge = "Earn treats by being correct, concise and thorough.";

  return `<span class="k">[Treats]</span> ${b} treat(s) — Rank: ${g.name}. Recent feedback:\n${fb}\n<span class="nudge">${nudge}</span>`;
}

// ---- render ----
const $ = (id) => document.getElementById(id);

function render(action) {
  const b = balance();
  const g = gradeFor(b);

  $("mbIcon").textContent = action === "punish" ? "🚫" : ANIMAL.treat;
  $("mbBalance").textContent = (b > 0 ? "+" : "") + b;
  $("mbBalance").style.color = b < 0 ? "var(--red)" : "var(--gold)";
  $("mbGrade").textContent = g.name;

  const ctx = $("ctx");
  ctx.innerHTML = buildContext();
  ctx.classList.remove("flash");
  void ctx.offsetWidth; // reflow to restart animation
  ctx.classList.add("flash");

  $("ctrlGood").textContent = `Good work — give a treat ${ANIMAL.treat}`;

  $("rcGrade").textContent = `${g.emoji} ${g.name}`;
  $("rcBalance").textContent = b;
  $("rcGpa").textContent = gpa(entries).toFixed(1);

  let run = 0;
  const series = entries.map((e) => (run += e.delta));
  $("rcSpark").textContent = sparkline(series);

  const hist = $("rcHistory");
  hist.innerHTML = entries.slice(-8).reverse().map((e) => {
    const m = e.type === "reward" ? "✓" : "✗";
    return `<div>${m} ${e.reason}</div>`;
  }).join("");

  if (action === "reward") burst();
  if (action === "punish") crack();
}

// ---- canvas fx (lightweight wand sparkle / whip flash) ----
const cv = $("fx");
const ctx2d = cv.getContext("2d");
let parts = [];
function resize() { cv.width = innerWidth; cv.height = innerHeight; }
addEventListener("resize", resize); resize();

let mouse = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("mousemove", (e) => { mouse = { x: e.clientX, y: e.clientY }; });

function burst() {
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7;
    parts.push({ x: mouse.x, y: mouse.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1, c: "gold" });
  }
}
let flash = 0;
function crack() {
  flash = 1;
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 6;
    parts.push({ x: mouse.x, y: mouse.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: "red" });
  }
}

function tick() {
  ctx2d.clearRect(0, 0, cv.width, cv.height);
  if (flash > 0) {
    ctx2d.fillStyle = `rgba(180,0,0,${0.25 * flash})`;
    ctx2d.fillRect(0, 0, cv.width, cv.height);
    flash = Math.max(0, flash - 0.04);
  }
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.vy += 0.14; p.x += p.vx; p.y += p.vy; p.life -= 0.022;
    ctx2d.globalAlpha = Math.max(0, p.life);
    ctx2d.fillStyle = p.c === "gold" ? "#ffcf4d" : "#ff5d6c";
    ctx2d.beginPath();
    ctx2d.arc(p.x, p.y, p.c === "gold" ? 2.4 : 2, 0, Math.PI * 2);
    ctx2d.fill();
  }
  ctx2d.globalAlpha = 1;
  requestAnimationFrame(tick);
}
tick();

// ---- animal picker + ranks table ----
function renderRanks() {
  const labels = ["20+", "10+", "5+", "0+", "-1 to -4", "-5 or less", "-10 or less"];
  $("ranksBody").innerHTML = ANIMAL.tiers
    .map((t, i) => `<tr><td>${labels[i]} treats</td><td>${t[1]} ${t[0]}</td></tr>`)
    .join("");
  const ra = $("ranksAnimal");
  if (ra) ra.textContent = `${ANIMAL.emoji} (${ANIMAL.label})`;
}

function buildPicker() {
  const wrap = $("animalPicker");
  wrap.innerHTML = Object.entries(ANIMALS)
    .map(([k, a]) => `<button class="animal-btn" data-animal="${k}" title="${a.label}">${a.emoji}</button>`)
    .join("");
  wrap.querySelectorAll("[data-animal]").forEach((btn) =>
    btn.addEventListener("click", () => {
      ANIMAL = ANIMALS[btn.dataset.animal];
      localStorage.setItem("treats-animal", btn.dataset.animal);
      syncPicker();
      renderRanks();
      render("animal");
    }),
  );
  syncPicker();
}

function syncPicker() {
  document.querySelectorAll("#animalPicker [data-animal]").forEach((b) => {
    b.classList.toggle("active", ANIMALS[b.dataset.animal] === ANIMAL);
  });
}

// ---- wire buttons ----
document.querySelectorAll("[data-type]").forEach((b) =>
  b.addEventListener("click", () => add(b.dataset.type, b.dataset.reason)),
);
$("undoBtn").addEventListener("click", undo);
$("resetBtn").addEventListener("click", reset);

buildPicker();
renderRanks();
render("reset");
