const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;

function getSavesDir() {
  const dir = path.join(app.getPath('userData'), 'saves');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSaveFilePath(slotId) {
  const safe = String(slotId || 'slot_1').replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(getSavesDir(), `${safe}.json`);
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'art', 'app_icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#04070D',
    autoHideMenuBar: true,
    useContentSize: true,
    icon: iconPath,
    title: '再开一局 · 轻度 Rogue 足球经理',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath);
  }
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
}

ipcMain.on('fm:load-save-sync', (event, slotId) => {
  try {
    const fp = getSaveFilePath(slotId);
    event.returnValue = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
  } catch {
    event.returnValue = null;
  }
});

ipcMain.on('fm:write-save', (_event, slotId, data) => {
  try {
    fs.writeFileSync(getSaveFilePath(slotId), String(data), 'utf8');
  } catch {
    // ignore
  }
});

ipcMain.on('fm:delete-save', (_event, slotId) => {
  try {
    const fp = getSaveFilePath(slotId);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {
    // ignore
  }
});

ipcMain.on('fm:load-settings-sync', (event) => {
  try {
    const fp = getSettingsPath();
    event.returnValue = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
  } catch {
    event.returnValue = null;
  }
});

ipcMain.on('fm:save-settings', (_event, data) => {
  try {
    fs.writeFileSync(getSettingsPath(), String(data), 'utf8');
  } catch {
    // ignore
  }
});

ipcMain.on('fm:is-fullscreen-sync', (event) => {
  event.returnValue = !!(mainWindow && mainWindow.isFullScreen());
});

ipcMain.on('fm:toggle-fullscreen', () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

ipcMain.on('fm:quit-app', () => {
  app.quit();
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
