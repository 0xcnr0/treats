// Desktop pet renderer: a little animal you pet with the mouse.
// Click / stroke = treat (+1), right-click = scold (-1), drag to move.
// State (animal, treats, rank, mood) comes from the main process.

const petWrap = document.getElementById("petWrap");
const petEl = document.getElementById("pet");
const moodEl = document.getElementById("mood");
const treatsEl = document.getElementById("treats");
const rankEl = document.getElementById("rank");
const redflash = document.getElementById("redflash");
const stage = document.getElementById("stage");

let state = { emoji: "🐶", treat: "🦴", balance: 0, rank: "Good Pup", tone: "neutral" };

function render() {
  petEl.textContent = state.emoji;
  treatsEl.textContent = `${state.balance > 0 ? "+" : ""}${state.balance} ${state.treat}`;
  rankEl.textContent = state.rank;
  // Idle mood badge
  petWrap.classList.toggle("show-mood", state.tone === "celebratory" || state.tone === "proud");
  moodEl.textContent = "✨";
}

if (window.cte && window.cte.onPetState) {
  window.cte.onPetState((s) => {
    state = { ...state, ...s };
    render();
  });
}
render();

// --- particles (hearts on treat, sweat on scold) ---
function spawnParticles(chars, count) {
  const rect = petWrap.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    p.textContent = chars[Math.floor(Math.random() * chars.length)];
    const startX = rect.left + rect.width / 2 - 9;
    const startY = rect.top + rect.height / 2 - 9;
    p.style.left = `${startX}px`;
    p.style.top = `${startY}px`;
    document.body.appendChild(p);
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const dist = 26 + Math.random() * 34;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 10;
    const dur = 600 + Math.random() * 400;
    p.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.3)`, opacity: 0 },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.7,.3,1)" },
    ).onfinish = () => p.remove();
  }
}

function reactHappy() {
  petWrap.classList.remove("happy");
  void petWrap.offsetWidth;
  petWrap.classList.add("happy");
  spawnParticles(["❤️", "✨", "💛"], 6);
}
function reactSad() {
  petWrap.classList.remove("sad");
  void petWrap.offsetWidth;
  petWrap.classList.add("sad");
  spawnParticles(["💢", "💧"], 4);
  redflash.classList.add("on");
  setTimeout(() => redflash.classList.remove("on"), 220);
}

// --- interactions ---
let lastPat = 0;
function pat() {
  const now = Date.now();
  if (now - lastPat < 350) return; // debounce rapid double-fire
  lastPat = now;
  reactHappy();
  window.cte?.petPat?.();
}
function scold() {
  reactSad();
  window.cte?.petScold?.();
}

// Left click anywhere on the pet = a pat.
petWrap.addEventListener("click", pat);
// Right click = scold (suppress native menu).
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  scold();
});

// Stroking: accumulate mouse movement over the pet; a good stroke = a pat,
// with a cooldown so you can't farm treats by wiggling.
let strokeDist = 0;
let lastStroke = 0;
let lastX = null, lastY = null;
petWrap.addEventListener("mousemove", (e) => {
  if (lastX !== null) {
    strokeDist += Math.hypot(e.clientX - lastX, e.clientY - lastY);
  }
  lastX = e.clientX;
  lastY = e.clientY;
  const now = Date.now();
  if (strokeDist > 140 && now - lastStroke > 2500) {
    strokeDist = 0;
    lastStroke = now;
    pat();
  }
});
petWrap.addEventListener("mouseleave", () => {
  strokeDist = 0;
  lastX = lastY = null;
});

// Main process can also trigger reactions (e.g. global hotkeys).
if (window.cte && window.cte.onPetReact) {
  window.cte.onPetReact((kind) => (kind === "reward" ? reactHappy() : reactSad()));
}
