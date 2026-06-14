import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./ledger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = path.resolve(__dirname, "../assets");
const PLATFORM = process.platform; // "darwin" | "win32" | "linux"

// Built-in macOS system sounds (in /System/Library/Sounds) — fallback when a
// custom synthesized asset isn't present. (macOS only.)
const SYSTEM_SOUND = (name) => `/System/Library/Sounds/${name}.aiff`;

// Custom synthesized assets (see scripts/gen-sounds.js), keyed by sound name.
// These .wav files work on every platform, which is why they're preferred.
const CUSTOM = {
  reward: path.join(ASSET_DIR, "reward.wav"),
  punish: path.join(ASSET_DIR, "punish.wav"),
  report: path.join(ASSET_DIR, "reward.wav"),
  levelUp: path.join(ASSET_DIR, "levelup.wav"),
};

const SYSTEM = {
  reward: SYSTEM_SOUND("Glass"),
  punish: SYSTEM_SOUND("Basso"),
  report: SYSTEM_SOUND("Tink"),
  levelUp: SYSTEM_SOUND("Hero"),
};

// Resolve a sound key to a file: prefer the cross-platform custom .wav, then the
// macOS system sound, and finally treat the key itself as a literal path.
function resolveSound(key) {
  if (CUSTOM[key] && fs.existsSync(CUSTOM[key])) return CUSTOM[key];
  if (PLATFORM === "darwin" && SYSTEM[key]) return SYSTEM[key];
  return CUSTOM[key] || key;
}

export const SOUNDS = SYSTEM; // backward-compatible export

function spawnQuiet(cmd, args) {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* missing player — non-fatal */
  }
}

// Build the platform-appropriate "play this audio file" command.
function playFileCommand(file) {
  if (PLATFORM === "darwin") return ["afplay", [file]];
  if (PLATFORM === "win32") {
    // PowerShell SoundPlayer handles WAV synchronously; run detached.
    return [
      "powershell",
      ["-NoProfile", "-Command", `(New-Object Media.SoundPlayer '${file}').PlaySync();`],
    ];
  }
  // Linux: try paplay (PulseAudio); aplay is a common alternative.
  return ["paplay", [file]];
}

// Fire-and-forget audio: spawn detached + unref so the CLI exits immediately.
export function play(key, { force = false } = {}) {
  if (!force && !loadConfig().sounds) return;
  const file = resolveSound(key);
  if (!file || !fs.existsSync(file)) return;
  const [cmd, args] = playFileCommand(file);
  spawnQuiet(cmd, args);
}

// Spoken warning, fire-and-forget, best-effort per platform.
export function speak(text, { force = false } = {}) {
  if (!force && !loadConfig().sounds) return;
  const t = String(text);
  if (PLATFORM === "darwin") {
    spawnQuiet("say", [t]);
  } else if (PLATFORM === "win32") {
    spawnQuiet("powershell", [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${t.replace(/'/g, "")}')`,
    ]);
  } else {
    spawnQuiet("espeak", [t]); // optional on Linux; silently no-ops if absent
  }
}
