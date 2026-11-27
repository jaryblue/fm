import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const WWW_DIR = path.join(ROOT, 'apps', 'android-www');
const OUT_DIR = path.join(ROOT, 'dist-ota');
const MANIFEST_SRC = path.join(WWW_DIR, 'ota-manifest.json');
const ZIP_NAME = 'ota-bundle.zip';
const ZIP_PATH = path.join(OUT_DIR, ZIP_NAME);

if (!fs.existsSync(WWW_DIR) || !fs.existsSync(MANIFEST_SRC)) {
  console.error('Missing apps/android-www or ota-manifest.json. Run npm run android:sync first.');
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

execFileSync('/usr/bin/zip', ['-rq', ZIP_PATH, '.'], { cwd: WWW_DIR });

const zipBuf = fs.readFileSync(ZIP_PATH);
const zipSha256 = crypto.createHash('sha256').update(zipBuf).digest('hex');

const baseManifest = JSON.parse(fs.readFileSync(MANIFEST_SRC, 'utf8'));
const fullManifest = {
  ...baseManifest,
  bundleZip: ZIP_NAME,
  zipSha256,
  zipSize: zipBuf.length,
  updatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(OUT_DIR, 'ota-manifest.json'), JSON.stringify(fullManifest, null, 2) + '\n', 'utf8');
console.log(`Built OTA package: ${ZIP_PATH} (${(zipBuf.length / 1024 / 1024).toFixed(2)} MB, sha256=${zipSha256.slice(0, 12)}...)`);
