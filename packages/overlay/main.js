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
// process and cache the bindings we need.
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
    gradeFor: grades.gradeFor,
    play: sound.play,
    getAnimal: animals.getAnimal,
  };
}

function currentAnimal() {
  return core.getAnimal(core.loadConfig().animal);
}

let tray = null;
let win = null;
let overlayEnabled = true;
let typeIntoTerminal = false; // default OFF for safety (Accessibility + focus risk)
let mode = "wand"; // "wand" (reward) | "whip" (punish)
let msgCounter = 0;

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreenSpaces: true });
  // Fully click-through, but forward mousemove so the wand/whip can follow the
  // cursor in the renderer.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.webContents.once("did-finish-load", () => {
    win.webContents.send("mode", mode);
    win.webContents.send("enabled", overlayEnabled);
  });
}

function statusSummary() {
  if (!core) return "Loading…";
  const { balance } = core.loadLedger();
  const g = core.gradeFor(balance);
  return `${g.emoji} ${g.name} — ${balance} treats`;
}

// Star template icon (black + alpha; macOS recolors for light/dark menu bars).
// Falls back to an empty image if the asset is missing.
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

// Short menu-bar title: the animal's treat emoji + signed balance.
function trayTitle() {
  if (!core) return "";
  const { balance } = core.loadLedger();
  return ` ${currentAnimal().treat} ${balance > 0 ? "+" : ""}${balance}`;
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: statusSummary(), enabled: false },
    { type: "separator" },
    {
      label: `Mode: Toss a Treat ${core ? currentAnimal().treat : "🦴"}`,
      type: "radio",
      checked: mode === "wand",
      click: () => setMode("wand"),
    },
    {
      label: `Mode: ${core ? currentAnimal().scold : "Bad dog"} 🚫`,
      type: "radio",
      checked: mode === "whip",
      click: () => setMode("whip"),
    },
    { type: "separator" },
    {
      label: "Overlay visible",
      type: "checkbox",
      checked: overlayEnabled,
      click: (item) => setOverlayEnabled(item.checked),
    },
    {
      label: "Type messages into terminal (needs Accessibility)",
      type: "checkbox",
      checked: typeIntoTerminal,
      click: (item) => (typeIntoTerminal = item.checked),
    },
    { type: "separator" },
    { label: "Give a treat  (⌘⇧G)", click: () => trigger("reward") },
    { label: "Bad dog  (⌘⇧B)", click: () => trigger("punish") },
    { type: "separator" },
    { label: "Quit", role: "quit" },
  ]);
}

function refreshTray() {
  if (tray) tray.setContextMenu(buildMenu());
}

function setMode(m) {
  mode = m;
  if (win) win.webContents.send("mode", mode);
  refreshTray();
}

function setOverlayEnabled(on) {
  overlayEnabled = on;
  if (win) {
    if (on) win.showInactive();
    else win.hide();
    win.webContents.send("enabled", on);
  }
  refreshTray();
}

// Core action: record to the ledger (same atomic writer the CLI uses, so the
// next UserPromptSubmit hook injects the change), animate, sound, and optionally
// type into the focused terminal.
function trigger(kind) {
  if (!core) return;
  const source = kind === "reward" ? "overlay-wand" : "overlay-whip";
  try {
    core.append({ type: kind, reason: "via overlay", source });
  } catch {
    /* ledger write failed — still animate */
  }
  core.play(kind === "reward" ? "reward" : "punish");

  if (win && overlayEnabled) {
    win.webContents.send("trigger", kind);
  }

  if (typeIntoTerminal || core.loadConfig().typeIntoTerminal) {
    const isReward = kind === "reward";
    const message = pick(isReward ? PRAISE : SCOLD, msgCounter++);
    typeIntoFocusedApp(message, { sendInterrupt: !isReward });
  }
  refreshTray();
}

app.whenReady().then(async () => {
  await loadCore();
  typeIntoTerminal = !!core.loadConfig().typeIntoTerminal;

  createWindow();

  tray = new Tray(trayIcon());
  tray.setTitle(trayTitle()); // signed treat count beside the icon
  tray.setToolTip("Treats — train Claude Code");
  refreshTray();

  globalShortcut.register("CommandOrControl+Shift+G", () => {
    setMode("wand");
    trigger("reward");
  });
  globalShortcut.register("CommandOrControl+Shift+B", () => {
    setMode("whip");
    trigger("punish");
  });

  // Keep the tray balance label/menu fresh (the CLI writes from another process).
  setInterval(() => {
    if (tray) tray.setTitle(trayTitle());
    refreshTray();
  }, 4000);
});

ipcMain.on("animation-done", () => {});

app.on("will-quit", () => globalShortcut.unregisterAll());
// Tray app: keep running with no windows.
app.on("window-all-closed", () => {});
