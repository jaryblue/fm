import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const STEAM_DIR = path.join(ROOT, 'apps', 'steam');
const BUNDLE_PATH = path.join(STEAM_DIR, 'steam.bundle.js');
const PKG_PATH = path.join(ROOT, 'package.json');

if (!fs.existsSync(BUNDLE_PATH)) {
  console.error('Missing steam.bundle.js at', BUNDLE_PATH);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const bundleBuf = fs.readFileSync(BUNDLE_PATH);
const hash = crypto.createHash('sha256').update(bundleBuf).digest('hex').slice(0, 12);

const manifest = {
  version: `${pkg.version || '0.1.0'}+${hash}`,
  nativeMinVersion: pkg.version || '0.1.0',
  hash,
  bundleUrl: `steam.bundle.js?v=${hash}`,
  updatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(STEAM_DIR, 'ota-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(
  path.join(STEAM_DIR, 'ota-native.js'),
  `window.__FM_NATIVE_HASH__ = ${JSON.stringify(hash)};\nwindow.__FM_NATIVE_VERSION__ = ${JSON.stringify(manifest.version)};\n`,
  'utf8'
);

// 同步更新 index.html 里 bundle 的破缓存版本号，避免浏览器/Electron 加载旧 bundle
const htmlPath = path.join(STEAM_DIR, 'index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const updated = html.replace(/(steam\.bundle\.js\?v=)[^"']*/g, `$1${hash}`);
  if (updated !== html) {
    fs.writeFileSync(htmlPath, updated, 'utf8');
    console.log(`Updated index.html cache-buster: v=${hash}`);
  }
}

console.log(`Generated OTA manifest: version=${manifest.version}, hash=${hash}`);
