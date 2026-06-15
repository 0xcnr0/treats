const { contextBridge, ipcRenderer } = require("electron");

// Bridge between the main process and the renderer windows (pet + overlay).
contextBridge.exposeInMainWorld("cte", {
  // desktop pet
  petPat: () => ipcRenderer.send("pet:pat"),
  petScold: () => ipcRenderer.send("pet:scold"),
  petDragStart: () => ipcRenderer.send("pet:dragStart"),
  petDragMove: (dx, dy) => ipcRenderer.send("pet:dragMove", { dx, dy }),
  petDragEnd: () => ipcRenderer.send("pet:dragEnd"),
  onPetState: (cb) => ipcRenderer.on("pet:state", (_e, s) => cb(s)),
  onPetReact: (cb) => ipcRenderer.on("pet:react", (_e, kind) => cb(kind)),
  // legacy fullscreen overlay
  onMode: (cb) => ipcRenderer.on("mode", (_e, mode) => cb(mode)),
  onEnabled: (cb) => ipcRenderer.on("enabled", (_e, on) => cb(on)),
  onTrigger: (cb) => ipcRenderer.on("trigger", (_e, kind) => cb(kind)),
  animationDone: () => ipcRenderer.send("animation-done"),
});
