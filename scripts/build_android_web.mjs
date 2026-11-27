import fs from 'fs';
import path from 'path';

const root = process.cwd();
const srcDir = path.join(root, 'apps', 'steam');
const outDir = path.join(root, 'apps', 'android-www');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of ['index.html', 'steam.bundle.js', 'engine.iife.js']) {
  const src = path.join(srcDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(outDir, file));
  }
}

function copyDirFiltered(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const sp = path.join(src, entry.name);
    const dp = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirFiltered(sp, dp);
    } else {
      fs.copyFileSync(sp, dp);
    }
  }
}

copyDirFiltered(path.join(srcDir, 'assets'), path.join(outDir, 'assets'));
console.log('Synced Android web assets to', outDir);
