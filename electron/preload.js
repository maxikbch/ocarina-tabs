const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  onCloseRequest: (callback) => {
    ipcRenderer.removeAllListeners("app-close-request");
    ipcRenderer.on("app-close-request", callback);
  },
});
