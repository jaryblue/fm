const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let bootHash = '';
let bootVersion = '';

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getBundledOtaHash() {
  const manifest = readJsonSafe(path.join(__dirname, '..', 'ota-manifest.json'));
  return manifest && manifest.hash ? String(manifest.hash) : '';
}

function getOtaBaseUrl() {
  const envUrl = String(process.env.FM_OTA_BASE_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const cfg = readJsonSafe(path.join(__dirname, '..', 'ota-config.json'));
  const cfgUrl = cfg && cfg.baseUrl ? String(cfg.baseUrl).trim() : '';
  return cfgUrl.replace(/\/+$/, '');
}

function resolveStartHtml() {
  const bundledHtml = path.join(__dirname, '..', 'index.html');
  const bundledHash = getBundledOtaHash();
  const meta = readJsonSafe(path.join(getOtaDir(), 'meta.json'));
  if (!meta || !meta.currentDir) return bundledHtml;
  if (bundledHash && meta.bundledHash && meta.bundledHash !== bundledHash) {
    return bundledHtml;
  }
  const otaHtml = path.join(meta.currentDir, 'index.html');
  return fs.existsSync(otaHtml) ? otaHtml : bundledHtml;
}

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
  const startHtml = resolveStartHtml();
  const bootManifest = readJsonSafe(path.join(path.dirname(startHtml), 'ota-manifest.json'));
  bootHash = (bootManifest && bootManifest.hash ? String(bootManifest.hash) : getBundledOtaHash()).trim();
  bootVersion = (bootManifest && bootManifest.version ? String(bootManifest.version) : bootHash).trim();
  mainWindow.loadFile(startHtml);
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

function getOtaDir() {
  const dir = path.join(app.getPath('userData'), 'ota');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

ipcMain.handle('fm:ota-get', () => {
  try {
    const dir = getOtaDir();
    const metaPath = path.join(dir, 'meta.json');
    const bundlePath = path.join(dir, 'steam.bundle.js');
    if (!fs.existsSync(metaPath) || !fs.existsSync(bundlePath)) return null;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return { hash: meta.hash || '', bundleUrl: `file://${bundlePath}` };
  } catch {
    return null;
  }
});

ipcMain.handle('fm:ota-save', (_event, hash, code) => {
  try {
    const dir = getOtaDir();
    fs.writeFileSync(path.join(dir, 'steam.bundle.js'), String(code), 'utf8');
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ hash: String(hash), updatedAt: Date.now() }), 'utf8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fm:ota-clear', () => {
  try {
    const dir = getOtaDir();
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
});

// 给前端查询 OTA 状态：已下载完成但当前进程尚未加载的版本
ipcMain.handle('fm:ota-status', () => {
  try {
    const bundledHash = getBundledOtaHash();
    const currentBootHash = bootHash || bundledHash;
    const meta = readJsonSafe(path.join(getOtaDir(), 'meta.json'));
    const stagedValid =
      meta &&
      meta.hash &&
      (!bundledHash || !meta.bundledHash || meta.bundledHash === bundledHash) &&
      meta.currentDir &&
      fs.existsSync(path.join(meta.currentDir, 'index.html'));
    const hasPending = !!stagedValid && String(meta.hash) !== currentBootHash;
    return {
      pendingVersion: hasPending ? String(meta.version || meta.hash) : null,
      activeVersion: bootVersion || currentBootHash,
    };
  } catch {
    return { pendingVersion: null, activeVersion: null };
  }
});

ipcMain.on('fm:restart-app', () => {
  // Electron 官方推荐：重启应用以加载新版本
  app.relaunch();
  app.exit(0);
});

async function checkDesktopOta() {
  const baseUrl = getOtaBaseUrl();
  if (!baseUrl) return;
  try {
    const res = await fetch(`${baseUrl}/ota-manifest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const manifest = await res.json();
    const remoteHash = String(manifest.hash || '').trim();
    if (!remoteHash) return;

    const bundledHash = getBundledOtaHash();
    const currentBootHash = bootHash || bundledHash;
    if (remoteHash === currentBootHash) return;

    const metaPath = path.join(getOtaDir(), 'meta.json');
    const currentMeta = readJsonSafe(metaPath);
    if (
      currentMeta &&
      currentMeta.bundledHash === bundledHash &&
      currentMeta.hash === remoteHash &&
      currentMeta.currentDir &&
      fs.existsSync(path.join(currentMeta.currentDir, 'index.html'))
    ) {
      return;
    }

    const bundleZip = String(manifest.bundleZip || 'ota-bundle.zip').trim().replace(/^\/+/, '');
    const zipUrl = bundleZip.startsWith('http://') || bundleZip.startsWith('https://')
      ? bundleZip
      : `${baseUrl}/${bundleZip}`;
    const zipRes = await fetch(zipUrl, { cache: 'no-store' });
    if (!zipRes.ok) return;
    const zipBuf = Buffer.from(await zipRes.arrayBuffer());

    const expectedSha = String(manifest.zipSha256 || '').trim().toLowerCase();
    if (expectedSha) {
      const actualSha = crypto.createHash('sha256').update(zipBuf).digest('hex').toLowerCase();
      if (actualSha !== expectedSha) return;
    }

    const releasesDir = path.join(getOtaDir(), 'releases');
    const targetDir = path.join(releasesDir, remoteHash);
    const tmpZip = path.join(getOtaDir(), `ota_${remoteHash}.zip`);
    fs.mkdirSync(releasesDir, { recursive: true });
    fs.writeFileSync(tmpZip, zipBuf);

    await new Promise((resolve, reject) => {
      const cmd = process.platform === 'win32' ? 'tar' : '/usr/bin/unzip';
      const args = process.platform === 'win32' ? ['-xf', tmpZip, '-C', targetDir] : ['-oq', tmpZip, '-d', targetDir];
      fs.mkdirSync(targetDir, { recursive: true });
      execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
    });
    fs.rmSync(tmpZip, { force: true });

    if (!fs.existsSync(path.join(targetDir, 'index.html'))) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return;
    }

    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        hash: remoteHash,
        version: manifest.version || remoteHash,
        bundledHash,
        currentDir: targetDir,
        updatedAt: Date.now(),
      }),
      'utf8'
    );

    for (const entry of fs.readdirSync(releasesDir)) {
      if (entry !== remoteHash) {
        fs.rmSync(path.join(releasesDir, entry), { recursive: true, force: true });
      }
    }
  } catch {
    // ignore offline/network errors
  }
}

app.whenReady().then(() => {
  createWindow();
  checkDesktopOta();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
