// Desktop pet renderer.
// Quick click = treat · press-and-drag = move · right-click = scold.
// It speaks (per-animal bubble), wiggles when idle, falls asleep after a while,
// wakes up when you interact, and reacts when its score changes from anywhere.

const petWrap = document.getElementById("petWrap");
const petEl = document.getElementById("pet");
const moodEl = document.getElementById("mood");
const treatsEl = document.getElementById("treats");
const rankEl = document.getElementById("rank");
const redflash = document.getElementById("redflash");
const bubble = document.getElementById("bubble");

let state = { emoji: "🐶", treat: "🦴", voice: "Woof!", balance: 0, rank: "Good Pup", tone: "neutral" };
let lastBalance = null;
let asleep = false;
let lastActive = Date.now();
let lastLocalReact = 0;

function render() {
  petEl.textContent = state.emoji;
  treatsEl.textContent = `${state.balance > 0 ? "+" : ""}${state.balance} ${state.treat}`;
  rankEl.textContent = state.rank;
  petWrap.classList.toggle("show-mood", state.tone === "celebratory" || state.tone === "proud");
}

if (window.cte && window.cte.onPetState) {
  window.cte.onPetState((s) => {
    const prev = lastBalance;
    state = { ...state, ...s };
    render();
    // React to score changes that came from elsewhere (CLI, slash, hotkey),
    // unless we just animated locally (avoid double).
    if (prev !== null && s.balance !== prev && Date.now() - lastLocalReact > 600) {
      wake();
      if (s.balance > prev) reactHappy();
      else reactSad();
    }
    lastBalance = s.balance;
  });
}
render();

// --- speech bubble ---
let bubbleTimer = null;
function say(text, kind) {
  bubble.textContent = text;
  bubble.classList.toggle("sad", kind === "sad");
  bubble.classList.add("show");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove("show"), 1300);
}

// --- particles ---
function spawnParticles(chars, count) {
  const rect = petWrap.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    p.textContent = chars[Math.floor(Math.random() * chars.length)];
    p.style.left = `${rect.left + rect.width / 2 - 9}px`;
    p.style.top = `${rect.top + rect.height / 2 - 9}px`;
    document.body.appendChild(p);
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const dist = 26 + Math.random() * 34;
    p.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 10}px) scale(1.3)`, opacity: 0 },
      ],
      { duration: 600 + Math.random() * 400, easing: "cubic-bezier(.2,.7,.3,1)" },
    ).onfinish = () => p.remove();
  }
}

function reactHappy() {
  wake();
  petWrap.classList.remove("happy");
  void petWrap.offsetWidth;
  petWrap.classList.add("happy");
  spawnParticles(["❤️", "✨", "💛"], 6);
  say(state.voice || "♥", "happy");
}
function reactSad() {
  wake();
  petWrap.classList.remove("sad");
  void petWrap.offsetWidth;
  petWrap.classList.add("sad");
  spawnParticles(["💢", "💧"], 4);
  redflash.classList.add("on");
  setTimeout(() => redflash.classList.remove("on"), 220);
  say("…", "sad");
}

// --- treat / scold (local, via the mouse) ---
let lastPat = 0;
function pat() {
  const now = Date.now();
  if (now - lastPat < 300) return;
  lastPat = now;
  lastLocalReact = now;
  markActive();
  reactHappy();
  window.cte?.petPat?.();
}
function scold() {
  lastLocalReact = Date.now();
  markActive();
  reactSad();
  window.cte?.petScold?.();
}

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  scold();
});

// --- sleep / wake ---
function markActive() {
  lastActive = Date.now();
  wake();
}
function wake() {
  if (asleep) {
    asleep = false;
    petWrap.classList.remove("asleep");
  }
}
setInterval(() => {
  if (!asleep && Date.now() - lastActive > 45000) {
    asleep = true;
    petWrap.classList.add("asleep");
  }
}, 2000);

// Occasional idle wiggle (a little sign of life).
setInterval(() => {
  if (asleep) return;
  if (Math.random() < 0.5) {
    petWrap.classList.remove("wiggle");
    void petWrap.offsetWidth;
    petWrap.classList.add("wiggle");
  }
}, 7000);

// --- press-and-drag to move, quick click to pat ---
let down = false, startX = 0, startY = 0, moved = false, suppressClick = false;
document.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  down = true;
  moved = false;
  startX = e.screenX;
  startY = e.screenY;
  markActive();
  window.cte?.petDragStart?.();
});
document.addEventListener("mousemove", (e) => {
  if (!down) return;
  const dx = e.screenX - startX;
  const dy = e.screenY - startY;
  if (!moved && Math.hypot(dx, dy) > 4) {
    moved = true;
    document.body.style.cursor = "grabbing";
  }
  if (moved) window.cte?.petDragMove?.(dx, dy);
});
document.addEventListener("mouseup", () => {
  if (!down) return;
  down = false;
  document.body.style.cursor = "";
  if (moved) {
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 60);
  }
});
petWrap.addEventListener("click", () => {
  if (suppressClick) return;
  pat();
});

// Wake the pet when you just move the mouse near/over it.
document.addEventListener("mousemove", () => { if (asleep) markActive(); });
