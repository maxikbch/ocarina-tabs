import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getOutDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "out")
    : path.join(__dirname, "..", "out");
}

function getIconPath() {
  const base = app.getAppPath();
  // En Windows el .ico suele verse mejor en la barra de tareas; si existe, usarlo
  if (process.platform === "win32") {
    const ico = path.join(base, "app", "app-icon.ico");
    if (fs.existsSync(ico)) return ico;
  }
  return path.join(base, "app", "app-icon.png");
}

function createWindow() {
  const outDir = getOutDir();
  const indexPath = path.join(outDir, "index.html");

  let allowClose = false;

  const iconPath = getIconPath();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(indexPath);

  win.on("close", (e) => {
    if (!allowClose) {
      e.preventDefault();
      win.webContents.send("app-close-request");
    }
  });

  ipcMain.on("window-minimize", () => {
    if (win && !win.isDestroyed()) win.minimize();
  });

  ipcMain.on("window-maximize", () => {
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });

  ipcMain.on("window-close", () => {
    if (win && !win.isDestroyed()) {
      allowClose = true;
      win.close();
    }
  });

  win.webContents.once("did-finish-load", () => {
    win.show();
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
