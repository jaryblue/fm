#!/usr/bin/env node
/**
 * CLI 自动化对战与诊断报告入口
 * 用法：
 *   npm run cli:play
 *   node scripts/cli_playtest.mjs --matches 9 --strategy full_roguelike
 *   node scripts/cli_playtest.mjs --matches 9 --strategy baseline --json
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { buildSync } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);

if (argv.includes('--ui')) {
  const E2E_MJS = path.join(ROOT, 'scripts', 'cli_ui_e2e.mjs');
  execFileSync(process.execPath, [E2E_MJS], { cwd: ROOT, stdio: 'inherit' });
  process.exit(0);
}

const DRIVER_TS = path.join(ROOT, 'scripts', 'cli_playtest_driver.ts');
const BUNDLE_MJS = path.join(ROOT, '.tmp_cli_playtest.mjs');

buildSync({
  entryPoints: [DRIVER_TS],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: BUNDLE_MJS,
  logLevel: 'silent',
});

execFileSync(process.execPath, [BUNDLE_MJS, ...argv], {
  cwd: ROOT,
  stdio: 'inherit',
});
