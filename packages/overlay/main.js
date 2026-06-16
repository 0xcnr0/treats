const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  screen,
  ipcMain,
  nativeImage,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { typeIntoFocusedApp } = require("./lib/automation.cjs");
const { PRAISE, SCOLD, pick } = require("./lib/messages.cjs");

// @treats/core is ESM; load it via dynamic import() from this CommonJS main
// process and cache what we need.
let core = null;
async function loadCore() {
  const [ledger, grades, sound, animals, report] = await Promise.all([
    import("@treats/core/ledger"),
    import("@treats/core/grades"),
    import("@treats/core/sound"),
    import("@treats/core/animals"),
    import("@treats/core/report"),
  ]);
  core = {
    append: ledger.append,
    loadLedger: ledger.loadLedger,
    loadConfig: ledger.loadConfig,
    saveConfig: ledger.saveConfig,
    loadState: ledger.loadState,
    balanceFor: ledger.balanceFor,
    projectName: ledger.projectName,
    projectKeyFor: ledger.projectKeyFor,
    listProjects: ledger.listProjects,
    gradeFor: grades.gradeFor,
    play: sound.play,
    getAnimal: animals.getAnimal,
    ANIMALS: animals.ANIMALS,
    buildReport: report.buildReport,
    REPORTS_DIR: report.REPORTS_DIR,
  };
}

// Build this project's report card and open it in the user's default viewer.
// Triggered by a double-click on the pet (or the tray menu).
function openReportCard() {
  if (!core) return;
  try {
    fs.mkdirSync(core.REPORTS_DIR, { recursive: true });
    const md = core.buildReport({ project: activeProject() });
    const file = path.join(core.REPORTS_DIR, "latest.md");
    fs.writeFileSync(file, md);
    shell.openPath(file);
  } catch {
    /* couldn't write/open the card — nothing else to do */
  }
}

// The project the pet currently represents: the last session you were active in,
// else the most recently scored project, else this app's own folder.
function activeProject() {
  const st = core.loadState();
  if (st.lastActiveProject) return st.lastActiveProject;
  const all = core.listProjects();
  if (all.length) return all[0].project;
  return core.projectKeyFor(process.cwd());
}

let tray = null;
let petWin = null;
let typeIntoTerminal = false; // optional, off by default
let msgCounter = 0;

function currentAnimal() {
  return core.getAnimal(core.loadConfig().animal);
}

function petState() {
  const project = activeProject();
  const balance = core.balanceFor(project);
  const g = core.gradeFor(balance);
  const a = currentAnimal();
  return {
    emoji: a.emoji, treat: a.treat, voice: a.voice,
    balance, rank: g.name, tone: g.tone,
    project: core.projectName(project),
  };
}

function createPetWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const W = 150, H = 150;
  // Restore the last dragged position, else default to bottom-right.
  const saved = core.loadConfig().petPos;
  const x = Array.isArray(saved) ? saved[0] : wa.x + wa.width - W - 24;
  const y = Array.isArray(saved) ? saved[1] : wa.y + wa.height - H - 24;
  petWin = new BrowserWindow({
    width: W,
    height: H,
    x,
    y,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWin.setAlwaysOnTop(true, "floating");
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenSpaces: true });
  petWin.loadFile(path.join(__dirname, "pet", "pet.html"));
  petWin.webContents.once("did-finish-load", () => broadcast());
}

function broadcast() {
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send("pet:state", petState());
}

// Core action: record to the ledger (same atomic writer the CLI uses, so the
// next hook injects the change), play a sound, animate the pet, and optionally
// type a message into the focused terminal.
function give(kind) {
  if (!core) return;
  const reason = kind === "reward" ? "petted 🖐️" : "scolded 🖐️";
  const project = activeProject();
  try {
    // Credit the project you're currently working in, not the pet app's folder.
    core.append({ type: kind, reason, source: "overlay-pet", project, cwd: project });
  } catch {
    /* ledger write failed — still animate */
  }
  // Cute per-animal voice on a treat; a soft whimper on a scolding.
  const animalKey = core.loadConfig().animal;
  core.play(kind === "reward" ? `voice-${animalKey}` : "whimper");

  // The pet animates off the broadcast balance change (single source of truth),
  // so a mouse pat, a hotkey, the CLI and slash commands all look the same.
  broadcast();
  refreshTray();

  if (typeIntoTerminal || core.loadConfig().typeIntoTerminal) {
    const isReward = kind === "reward";
    const message = pick(isReward ? PRAISE : SCOLD, msgCounter++);
    typeIntoFocusedApp(message, { sendInterrupt: !isReward });
  }
}

function statusSummary() {
  if (!core) return "Loading…";
  const s = petState();
  return `${s.emoji} ${s.rank} — ${s.balance} treats`;
}

function animalMenu() {
  return Object.entries(core.ANIMALS).map(([key, a]) => ({
    label: `${a.emoji}  ${a.label}`,
    type: "radio",
    checked: core.loadConfig().animal === key,
    click: () => {
      core.saveConfig({ animal: key });
      broadcast();
      refreshTray();
    },
  }));
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: statusSummary(), enabled: false },
    { type: "separator" },
    { label: "Give a treat  (⌘⇧G)", click: () => give("reward") },
    { label: "Bad dog  (⌘⇧B)", click: () => give("punish") },
    { label: "Open report card", click: () => openReportCard() },
    { type: "separator" },
    { label: "Animal", submenu: animalMenu() },
    {
      label: "Type messages into terminal (needs Accessibility)",
      type: "checkbox",
      checked: typeIntoTerminal,
      click: (item) => (typeIntoTerminal = item.checked),
    },
    { type: "separator" },
    { label: "Quit", role: "quit" },
  ]);
}

function refreshTray() {
  if (tray) {
    tray.setContextMenu(buildMenu());
    tray.setTitle(core ? ` ${currentAnimal().treat} ${petState().balance}` : "");
  }
}

function trayIcon() {
  const iconPath = path.join(__dirname, "assets", "trayTemplate.png");
  try {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      img.setTemplateImage(true);
      return img;
    }
  } catch {
    /* fall through */
  }
  return nativeImage.createEmpty();
}

app.whenReady().then(async () => {
  await loadCore();
  typeIntoTerminal = !!core.loadConfig().typeIntoTerminal;

  createPetWindow();

  tray = new Tray(trayIcon());
  tray.setToolTip("Treats — pet your AI");
  refreshTray();

  // Mouse on the pet:
  ipcMain.on("pet:pat", () => give("reward"));
  ipcMain.on("pet:scold", () => give("punish"));
  ipcMain.on("pet:report", () => openReportCard());

  // Drag the pet window by pressing-and-dragging the animal.
  let dragOrigin = null;
  ipcMain.on("pet:dragStart", () => {
    if (petWin && !petWin.isDestroyed()) dragOrigin = petWin.getPosition();
  });
  ipcMain.on("pet:dragMove", (_e, { dx, dy }) => {
    if (dragOrigin && petWin && !petWin.isDestroyed()) {
      petWin.setPosition(Math.round(dragOrigin[0] + dx), Math.round(dragOrigin[1] + dy));
    }
  });
  ipcMain.on("pet:dragEnd", () => {
    if (petWin && !petWin.isDestroyed()) {
      try { core.saveConfig({ petPos: petWin.getPosition() }); } catch {}
    }
  });

  // One-tap keyboard, anywhere:
  globalShortcut.register("CommandOrControl+Shift+G", () => give("reward"));
  globalShortcut.register("CommandOrControl+Shift+B", () => give("punish"));

  // Keep the pet + tray fresh when the CLI / hooks write from another process.
  setInterval(() => {
    broadcast();
    refreshTray();
  }, 1500);
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {}); // tray app stays alive
