import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    for (const p of [
      '/tmp/pw/node_modules/playwright',
      '/Users/jary/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
    ]) {
      if (fs.existsSync(p)) return require(p);
    }
    throw new Error('Playwright not found');
  }
}

function findHeadlessShell() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const cacheDir = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  if (fs.existsSync(cacheDir)) {
    for (const d of fs.readdirSync(cacheDir)) {
      if (d.startsWith('chromium_headless_shell')) {
        const candidate = path.join(cacheDir, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

const { chromium } = loadPlaywright();
const logoPath = path.join(ROOT, 'apps', 'steam', 'assets', 'art', 'game_logo.webp');
const logoDataUrl = `data:image/webp;base64,${fs.readFileSync(logoPath).toString('base64')}`;

const browser = await chromium.launch({
  ...(findHeadlessShell() ? { executablePath: findHeadlessShell() } : {}),
  headless: true,
  args: ['--single-process', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });

const rendered = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
  });

  function makeCanvas(size = 1024) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return [c, c.getContext('2d')];
  }

  function drawContainerBg(ctx, size, inset, radius) {
    const x = inset;
    const y = inset;
    const w = size - inset * 2;
    const h = size - inset * 2;

    ctx.save();
    // Outer soft shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.035;
    ctx.shadowOffsetY = size * 0.015;

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    const bg = ctx.createRadialGradient(size * 0.5, size * 0.42, size * 0.04, size * 0.5, size * 0.5, w * 0.65);
    bg.addColorStop(0, '#162442');
    bg.addColorStop(0.65, '#0B1222');
    bg.addColorStop(1, '#060A13');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    // Subtle stadium spotlight & gold inner rim
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();

    const glow = ctx.createRadialGradient(size * 0.5, size * 0.46, size * 0.05, size * 0.5, size * 0.46, w * 0.46);
    glow.addColorStop(0, 'rgba(250, 204, 21, 0.20)');
    glow.addColorStop(0.55, 'rgba(249, 115, 22, 0.08)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);

    // Subtle top-to-bottom glossy sheen
    const sheen = ctx.createLinearGradient(0, y, 0, y + h * 0.45);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, h * 0.45);
    ctx.restore();

    // Crisp metallic gold-amber border
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w - 6, h - 6, Math.max(8, radius - 3));
    const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    borderGrad.addColorStop(0, 'rgba(253, 224, 71, 0.72)');
    borderGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.36)');
    borderGrad.addColorStop(1, 'rgba(250, 204, 21, 0.65)');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = Math.max(4, size * 0.008);
    ctx.stroke();
    ctx.restore();
  }

  function drawLogoCentered(ctx, size, ratio) {
    const aspect = img.width / img.height;
    const maxW = size * ratio;
    const maxH = size * ratio;
    let dw = maxW;
    let dh = dw / aspect;
    if (dh > maxH) {
      dh = maxH;
      dw = dh * aspect;
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.028;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    ctx.restore();
  }

  // 1. Desktop Mac / Web app_icon (macOS squircle container with generous safe margin)
  const [cApp, ctxApp] = makeCanvas(1024);
  drawContainerBg(ctxApp, 1024, 68, 200);
  drawLogoCentered(ctxApp, 1024, 0.68);

  // 2. Android adaptive foreground (transparent canvas, logo inside 58% center safe zone)
  const [cFg, ctxFg] = makeCanvas(1024);
  // Subtle glow behind logo
  const fgGlow = ctxFg.createRadialGradient(512, 512, 40, 512, 512, 340);
  fgGlow.addColorStop(0, 'rgba(250, 204, 21, 0.22)');
  fgGlow.addColorStop(0.6, 'rgba(249, 115, 22, 0.08)');
  fgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctxFg.fillStyle = fgGlow;
  ctxFg.fillRect(0, 0, 1024, 1024);
  drawLogoCentered(ctxFg, 1024, 0.58);

  // 3. Android legacy launcher icon (full-bleed container + 74% logo)
  const [cLeg, ctxLeg] = makeCanvas(1024);
  drawContainerBg(ctxLeg, 1024, 0, 160);
  drawLogoCentered(ctxLeg, 1024, 0.74);

  return {
    app: cApp.toDataURL('image/png'),
    fg: cFg.toDataURL('image/png'),
    leg: cLeg.toDataURL('image/png'),
  };
}, logoDataUrl);

await browser.close();

function saveDataUrl(dataUrl, outPath) {
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
}

const tmpDir = '/tmp/fm_icons';
fs.mkdirSync(tmpDir, { recursive: true });
const tmpApp = path.join(tmpDir, 'app_1024.png');
const tmpFg = path.join(tmpDir, 'fg_1024.png');
const tmpLeg = path.join(tmpDir, 'leg_1024.png');
saveDataUrl(rendered.app, tmpApp);
saveDataUrl(rendered.fg, tmpFg);
saveDataUrl(rendered.leg, tmpLeg);

const appIconOut = path.join(ROOT, 'apps', 'steam', 'assets', 'art', 'app_icon.png');
execFileSync('sips', ['-z', '512', '512', tmpApp, '--out', appIconOut], { stdio: 'inherit' });

const resDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const densities = [
  ['mipmap-mdpi', 48, 108],
  ['mipmap-hdpi', 72, 162],
  ['mipmap-xhdpi', 96, 216],
  ['mipmap-xxhdpi', 144, 324],
  ['mipmap-xxxhdpi', 192, 432],
];

for (const [folder, legSize, fgSize] of densities) {
  const dir = path.join(resDir, folder);
  if (!fs.existsSync(dir)) continue;
  execFileSync('sips', ['-z', String(legSize), String(legSize), tmpLeg, '--out', path.join(dir, 'ic_launcher.png')], { stdio: 'inherit' });
  execFileSync('sips', ['-z', String(legSize), String(legSize), tmpLeg, '--out', path.join(dir, 'ic_launcher_round.png')], { stdio: 'inherit' });
  execFileSync('sips', ['-z', String(fgSize), String(fgSize), tmpFg, '--out', path.join(dir, 'ic_launcher_foreground.png')], { stdio: 'inherit' });
}

console.log('Generated container app_icon.png and Android mipmap-* icons successfully.');
