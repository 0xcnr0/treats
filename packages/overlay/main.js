const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  screen,
  ipcMain,
  nativeImage,
} = require("electron");
const path = require("node:path");
const { typeIntoFocusedApp } = require("./lib/automation.cjs");
const { PRAISE, SCOLD, pick } = require("./lib/messages.cjs");

// @treats/core is ESM; load it via dynamic import() from this CommonJS main
// process and cache what we need.
let core = null;
async function loadCore() {
  const [ledger, grades, sound, animals] = await Promise.all([
    import("@treats/core/ledger"),
    import("@treats/core/grades"),
    import("@treats/core/sound"),
    import("@treats/core/animals"),
  ]);
  core = {
    append: ledger.append,
    loadLedger: ledger.loadLedger,
    loadConfig: ledger.loadConfig,
    saveConfig: ledger.saveConfig,
    gradeFor: grades.gradeFor,
    play: sound.play,
    getAnimal: animals.getAnimal,
    ANIMALS: animals.ANIMALS,
  };
}

let tray = null;
let petWin = null;
let typeIntoTerminal = false; // optional, off by default
let msgCounter = 0;

function currentAnimal() {
  return core.getAnimal(core.loadConfig().animal);
}

function petState() {
  const { balance } = core.loadLedger();
  const g = core.gradeFor(balance);
  const a = currentAnimal();
  return { emoji: a.emoji, treat: a.treat, balance, rank: g.name, tone: g.tone };
}

function createPetWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const W = 180, H = 170;
  petWin = new BrowserWindow({
    width: W,
    height: H,
    x: wa.x + wa.width - W - 24,
    y: wa.y + wa.height - H - 24,
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
  try {
    core.append({ type: kind, reason, source: "overlay-pet" });
  } catch {
    /* ledger write failed — still animate */
  }
  core.play(kind === "reward" ? "reward" : "punish");
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send("pet:react", kind);
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
