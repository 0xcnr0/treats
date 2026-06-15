// Synthesize the token-economy sound effects as 16-bit mono WAV files, with no
// external dependencies. Run: node scripts/gen-sounds.js
//
// Produces, in packages/core/assets/:
//   reward.wav   — bright ascending chime (gold-star "ding")
//   punish.wav   — whip crack: sharp noise transient + low thud
//   levelup.wav  — short three-note fanfare
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../packages/core/assets");

const RATE = 44100;

// Build a Float32 sample buffer, then encode to a 16-bit PCM WAV.
function encodeWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}

const sec = (s) => Math.floor(s * RATE);

// Pseudo-random noise with a fixed seed so output is reproducible (no
// Math.random — keeps regenerated assets byte-identical).
function makeNoise(seed = 12345) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

// --- reward: ascending chime, three sine notes with soft exponential decay ---
function reward() {
  const dur = sec(0.9);
  const out = new Float32Array(dur);
  const notes = [659.25, 880.0, 1318.5]; // E5, A5, E6
  notes.forEach((freq, idx) => {
    const start = sec(idx * 0.11);
    for (let i = start; i < dur; i++) {
      const t = (i - start) / RATE;
      const env = Math.exp(-4 * t);
      // fundamental + a soft second partial for a bell-like timbre
      const v =
        (Math.sin(2 * Math.PI * freq * t) +
          0.3 * Math.sin(2 * Math.PI * freq * 2 * t)) *
        env *
        0.28;
      out[i] += v;
    }
  });
  return out;
}

// --- punish: whip crack = very fast noise transient + descending low thud ---
function punish() {
  const dur = sec(0.5);
  const out = new Float32Array(dur);
  const noise = makeNoise();
  for (let i = 0; i < dur; i++) {
    const t = i / RATE;
    // crack: white noise with a near-instant attack and fast decay
    const crackEnv = Math.exp(-38 * t);
    const crack = noise() * crackEnv * 0.9;
    // thud: a low sine sweeping down, slightly delayed
    const thudT = Math.max(0, t - 0.01);
    const thudFreq = 150 * Math.exp(-9 * thudT);
    const thud = Math.sin(2 * Math.PI * thudFreq * thudT) * Math.exp(-14 * thudT) * 0.5;
    out[i] = crack + thud;
  }
  return out;
}

// --- levelup: quick three-note major arpeggio fanfare ---
function levelup() {
  const dur = sec(0.7);
  const out = new Float32Array(dur);
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, idx) => {
    const start = sec(idx * 0.09);
    for (let i = start; i < dur; i++) {
      const t = (i - start) / RATE;
      const env = Math.exp(-5 * t);
      out[i] += Math.sin(2 * Math.PI * freq * t) * env * 0.22;
    }
  });
  return out;
}

// --- per-animal stylized vocalizations (cute, not realistic) ---
const TAU = Math.PI * 2;

// One short "bark" burst: a couple of harmonics with a fast attack/decay + grit.
function barkBurst(out, start, freq, len, noise) {
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.006) * Math.exp(-26 * t); // sharp attack, fast decay
    const v =
      (Math.sin(TAU * freq * t) +
        0.5 * Math.sin(TAU * freq * 2 * t) +
        0.25 * Math.sin(TAU * freq * 3 * t) +
        0.3 * noise()) *
      env *
      0.5;
    if (start + i < out.length) out[start + i] += v;
  }
}

function voiceDog() {
  const out = new Float32Array(sec(0.5));
  const n = makeNoise(7);
  barkBurst(out, 0, 320, sec(0.16), n);
  barkBurst(out, sec(0.2), 250, sec(0.18), n);
  return out;
}

// Pitch-glide vocalization (meow / squeak / neigh share this shape).
function glide(dur, pts, vol = 0.32, vib = 0) {
  const out = new Float32Array(sec(dur));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / out.length; // 0..1
    // piecewise-linear frequency across control points
    const seg = t * (pts.length - 1);
    const a = Math.min(pts.length - 1, Math.floor(seg));
    const b = Math.min(pts.length - 1, a + 1);
    let f = pts[a] + (pts[b] - pts[a]) * (seg - a);
    if (vib) f *= 1 + vib * Math.sin(TAU * 18 * (i / RATE));
    phase += (TAU * f) / RATE;
    const env = Math.sin(Math.PI * t); // soft in/out
    out[i] = (Math.sin(phase) + 0.3 * Math.sin(2 * phase)) * env * vol;
  }
  return out;
}

function voiceCat() { return glide(0.45, [600, 1000, 760, 520], 0.3, 0.02); }
function voiceHamster() {
  const a = glide(0.12, [1500, 2000], 0.26);
  const out = new Float32Array(sec(0.32));
  a.forEach((v, i) => (out[i] += v));
  const b = glide(0.12, [1700, 2200], 0.24);
  b.forEach((v, i) => (out[sec(0.18) + i] += v));
  return out;
}
function voiceHorse() { return glide(0.55, [720, 680, 600, 520, 360, 300], 0.3, 0.08); }
function voiceParrot() {
  const out = new Float32Array(sec(0.34));
  const n = makeNoise(11);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const env = Math.sin(Math.PI * (i / out.length));
    const f = 760 + 220 * Math.sin(TAU * 7 * t);
    out[i] = (Math.sin(TAU * f * t) * 0.6 + n() * 0.5) * env * 0.3;
  }
  return out;
}
function voiceDragon() {
  const out = new Float32Array(sec(0.55));
  const n = makeNoise(3);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const env = Math.sin(Math.PI * (i / out.length));
    const f = 80 + 30 * t; // low, rising slightly
    // sawtooth-ish growl
    const saw = 2 * ((f * t) % 1) - 1;
    out[i] = (saw * 0.6 + n() * 0.4) * env * 0.42;
  }
  return out;
}

// Soft sad descending tone for scoldings.
function whimper() {
  return glide(0.5, [520, 430, 360, 300], 0.22, 0.03);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const targets = {
  "reward.wav": reward(),
  "punish.wav": punish(),
  "levelup.wav": levelup(),
  "whimper.wav": whimper(),
  "voice-dog.wav": voiceDog(),
  "voice-cat.wav": voiceCat(),
  "voice-dragon.wav": voiceDragon(),
  "voice-horse.wav": voiceHorse(),
  "voice-hamster.wav": voiceHamster(),
  "voice-parrot.wav": voiceParrot(),
};
for (const [name, samples] of Object.entries(targets)) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, encodeWav(samples));
  console.log(`wrote ${file} (${samples.length} samples)`);
}
