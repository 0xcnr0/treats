// Copy the good-practice skills into ~/.claude/skills/ so Claude can auto-invoke
// them (for the from-source / non-plugin setup). The plugin bundles skills/
// automatically, so this is only for manual installs.
// Usage: node scripts/install-skills.js [--uninstall]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "../skills");
const DEST = path.join(os.homedir(), ".claude", "skills");

function skillDirs() {
  if (!fs.existsSync(SRC)) return [];
  return fs.readdirSync(SRC).filter((d) => fs.existsSync(path.join(SRC, d, "SKILL.md")));
}

const uninstall = process.argv.includes("--uninstall");

if (uninstall) {
  for (const name of skillDirs()) {
    const dir = path.join(DEST, `treats-${name}`);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("🗑️  Removed Treats skills.");
  process.exit(0);
}

export function installSkills() {
  const names = skillDirs();
  for (const name of names) {
    const destDir = path.join(DEST, `treats-${name}`);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(path.join(SRC, name, "SKILL.md"), path.join(destDir, "SKILL.md"));
  }
  console.log(`🎓 Installed ${names.length} good-practice skills: ${names.join(", ")}.`);
  console.log(`   ${DEST}/treats-*`);
  console.log("   Claude will draw on these (plan first, test, self-review) to earn treats.");
}

if (import.meta.url === `file://${process.argv[1]}`) installSkills();
