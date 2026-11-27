#!/usr/bin/env node
/**
 * FM-League OTA 一键发版（构建 → 上传 → 校验 → 烟测）
 *
 * 用法：npm run deploy:ota
 *
 * 关键约束：
 * 1. 必须先传 zip 再传 manifest，否则客户端读到新清单时压缩包还没到位
 * 2. 逐文件 scp + 立即 stat/sha256 核验（批量 scp 曾出现过静默只传第一个的坑）
 * 3. 线上烟测在服务器端执行，绕开本机被污染的 DNS
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist-ota');
const ZIP_PATH = path.join(OUT_DIR, 'ota-bundle.zip');
const MANIFEST_PATH = path.join(OUT_DIR, 'ota-manifest.json');

const SERVER = process.env.FM_OTA_HOST || 'root@101.43.29.170';
const REMOTE_DIR = '/www/wwwroot/fm-ota';
const PUBLIC_BASE = 'https://iisliu.cloud/fm-ota';

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function runCapture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fail(msg) {
  console.error(`\n[发版失败] ${msg}`);
  process.exit(1);
}

function ssh(script) {
  return runCapture('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', SERVER, script]);
}

function scp(local, remote) {
  run('scp', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', local, `${SERVER}:${remote}`]);
}

// ---------- 1. 构建 ----------
console.log('\n=== 1/5 构建 OTA 包 ===');
run('npm', ['run', 'build:ota'], { cwd: ROOT });

if (!fs.existsSync(ZIP_PATH) || !fs.existsSync(MANIFEST_PATH)) {
  fail('构建产物缺失：dist-ota/ota-bundle.zip 或 ota-manifest.json');
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const localZipSha = sha256(ZIP_PATH);
const localZipSize = fs.statSync(ZIP_PATH).size;

if (manifest.zipSha256 && manifest.zipSha256 !== localZipSha) {
  fail(`manifest.zipSha256 与实际 zip 不符：${manifest.zipSha256} vs ${localZipSha}`);
}
if (manifest.zipSize && manifest.zipSize !== localZipSize) {
  fail(`manifest.zipSize 与实际 zip 不符：${manifest.zipSize} vs ${localZipSize}`);
}
console.log(`产物 OK：zip ${localZipSize} B, sha256=${localZipSha.slice(0, 16)}…`);
console.log(`版本：${manifest.version || manifest.hash}`);

// ---------- 2. 连通性 ----------
console.log('\n=== 2/5 检查服务器 ===');
try {
  ssh(`test -d ${REMOTE_DIR} && echo OK`);
} catch {
  fail(`服务器目录 ${REMOTE_DIR} 不存在，请先在服务器上创建`);
}

// ---------- 3. 上传（顺序不可反） ----------
console.log('\n=== 3/5 上传（先 zip 后 manifest）===');
console.log('上传 ota-bundle.zip …');
scp(ZIP_PATH, `${REMOTE_DIR}/ota-bundle.zip`);
const remoteZipSize = Number(ssh(`stat -c %s ${REMOTE_DIR}/ota-bundle.zip`));
if (remoteZipSize !== localZipSize) fail(`zip 大小不符：本地 ${localZipSize} vs 远端 ${remoteZipSize}`);
const remoteZipSha = ssh(`sha256sum ${REMOTE_DIR}/ota-bundle.zip | cut -d" " -f1`);
if (remoteZipSha !== localZipSha) fail(`zip SHA-256 不符：本地 ${localZipSha} vs 远端 ${remoteZipSha}`);
console.log(`  zip 核验通过（${remoteZipSize} B）`);

console.log('上传 ota-manifest.json …');
scp(MANIFEST_PATH, `${REMOTE_DIR}/ota-manifest.json`);
const remoteManifestSize = Number(ssh(`stat -c %s ${REMOTE_DIR}/ota-manifest.json`));
const localManifestSize = fs.statSync(MANIFEST_PATH).size;
if (remoteManifestSize !== localManifestSize) {
  fail(`manifest 大小不符：本地 ${localManifestSize} vs 远端 ${remoteManifestSize}`);
}
console.log(`  manifest 核验通过（${remoteManifestSize} B）`);

// ---------- 4. 线上校验 ----------
console.log('\n=== 4/5 线上校验（服务器端 curl，绕开本机 DNS）===');
const manifestHead = ssh(
  `curl -sI --max-time 15 ${PUBLIC_BASE}/ota-manifest.json | grep -iE "^HTTP/|Cache-Control|Access-Control-Allow-Origin"`
);
console.log(manifestHead);
if (!manifestHead.includes('200 OK')) fail('线上 manifest 非 200');
if (!/Cache-Control:.*no-store/i.test(manifestHead)) fail('线上 manifest 缺少 no-store 缓存头');
if (!/Access-Control-Allow-Origin:\s*\*/i.test(manifestHead)) fail('线上 manifest 缺少 CORS 头');

const zipHead = ssh(
  `curl -sI --max-time 15 ${PUBLIC_BASE}/ota-bundle.zip | grep -iE "^HTTP/|Content-Length|Content-Type|Access-Control-Allow-Origin"`
);
console.log(zipHead);
if (!zipHead.includes('200 OK')) fail('线上 zip 非 200（注意是否发生 301 跳转）');
if (!zipHead.includes(String(localZipSize))) fail('线上 zip Content-Length 与本地不符');

// ---------- 5. 结果 ----------
console.log('\n=== 5/5 发版完成 ===');
console.log(`baseUrl:  ${PUBLIC_BASE}`);
console.log(`版本:     ${manifest.version || manifest.hash}`);
console.log(`文件:     ota-manifest.json + ota-bundle.zip (${(localZipSize / 1024 / 1024).toFixed(2)} MB)`);
console.log(`校验:     SHA-256 本地/线上一致，缓存头与 CORS 正常`);
console.log(`\n下一步：如需让新 baseUrl 生效，需重新打 APK / 桌面安装包。`);
