#!/usr/bin/env node
/**
 * 批量调用 Gemini API CLI (`lyria-3.5` 配乐 + `gemini-3.8-flash-tts` 中文配音)
 * 生成全套外置音频、压缩为轻量 .m4a (macOS afconvert) 并自动更新 AudioManifest.ts。
 *
 * 前置条件：
 *   1. 安装 CLI: curl -fsSL https://raw.githubusercontent.com/google-gemini/gemini-api-cli/main/scripts/install.sh | bash
 *   2. 配置 Key: gemini-api configure --api-key "<GEMINI_API_KEY>"  (或 export GEMINI_API_KEY=...)
 *
 * 运行：
 *   node scripts/generate_audio.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW_DIR = path.join(ROOT, '.tmp_audio_raw');
const OUT_DIR = path.join(ROOT, 'apps/steam/assets/audio');
const MANIFEST_PATH = path.join(ROOT, 'packages/game-ui/src/AudioManifest.ts');

for (const sub of ['bgm', 'vo', 'sfx']) {
  fs.mkdirSync(path.join(RAW_DIR, sub), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, sub), { recursive: true });
}

const BGM_SPECS = [
  {
    id: 'bgm_title',
    prompt:
      'Instrumental stadium sports anthem rock, 120 BPM, heroic electric guitar riff, punchy live drums, subtle brass swell, uplifting football championship energy, seamless loopable vibe, no vocals',
  },
  {
    id: 'bgm_prologue',
    prompt:
      'Instrumental emotional cinematic piano and warm string quartet, 78 BPM, rain night nostalgia, bittersweet veteran athlete reflection, understated hope, no vocals',
  },
  {
    id: 'bgm_portal',
    prompt:
      'Instrumental sleek tactical sports broadcast lounge beat, 102 BPM, clean synth arpeggio, warm bassline, crisp percussion, focused football manager strategy room mood, no vocals',
  },
  {
    id: 'bgm_match_normal',
    prompt:
      'Instrumental high energy anime rock football match theme, 144 BPM, driving distorted rhythm guitars, melodic lead guitar, tight bass and energetic drums, no vocals',
  },
  {
    id: 'bgm_match_climax',
    prompt:
      'Instrumental urgent final minutes football climax rock, 154 BPM, double-kick drums, intense staccato strings and soaring electric guitar, dramatic comeback tension, no vocals',
  },
  {
    id: 'bgm_celebration',
    prompt:
      'Instrumental triumphant championship victory fanfare rock, 128 BPM, celebratory brass section, bright electric guitars, stadium snare rolls, uplifting trophy ceremony, no vocals',
  },
];

// voice: Kore (沉稳叙事), Puck (活力助教), Fenrir/Charon (激情男解说)
const VO_SPECS = [
  { id: 'vo_prologue_1', voice: 'Charon', text: '三十八岁，最后一次把队长袖标缠在左臂。' },
  { id: 'vo_prologue_2', voice: 'Charon', text: '伤停补时，一比一平！机会就在眼前，最后一脚，绝杀！' },
  { id: 'vo_prologue_3', voice: 'Kore', text: '镇上那支你当年踢青训出来的草根小队快挺不住了。回来当主教练吧。' },
  { id: 'vo_prologue_4', voice: 'Charon', text: '从社区业余联赛起步，再开一局！' },
  { id: 'vo_kickoff', voice: 'Puck', text: '哨响开球！双方正式展开较量！' },
  { id: 'vo_goal', voice: 'Puck', text: '球进了！干得漂亮！皮球应声入网！' },
  { id: 'vo_goal_brace', voice: 'Puck', text: '梅开二度！势不可挡的终结表现！' },
  { id: 'vo_goal_hattrick', voice: 'Puck', text: '帽子戏法！今夜他彻底主宰了整座球场！' },
  { id: 'vo_goal_late', voice: 'Puck', text: '读秒绝杀！奇迹在最后时刻降临！' },
  { id: 'vo_save', voice: 'Puck', text: '不可思议的神扑！门将化解了必进球！' },
  { id: 'vo_foul_yellow', voice: 'Charon', text: '主裁判果断亮出黄牌警告，场上动作需要注意了。' },
  { id: 'vo_card_red', voice: 'Charon', text: '红牌罚下！场上的平衡彻底被打破了！' },
  { id: 'vo_skill_cutin', voice: 'Puck', text: '就是现在！战术技能全功率爆发！' },
  { id: 'vo_cmd_card', voice: 'Kore', text: '执行场边最新战术指令，保持阵型压迫！' },
  { id: 'vo_champ', voice: 'Puck', text: '我们是冠军！整座球场都在为这支传奇之师欢呼！' },
];

const SFX_SPECS = [
  {
    id: 'sfx_goal_roar',
    prompt: 'Sound effect: massive 50000 person football stadium crowd eruption roar and cheering after a goal, realistic sports broadcast audio, 3 seconds, no music',
  },
  {
    id: 'sfx_whistle_long',
    prompt: 'Sound effect: crisp referee pea whistle long blast on a football pitch with light stadium echo, clean isolated audio, no music',
  },
  {
    id: 'sfx_whistle_short',
    prompt: 'Sound effect: sharp short referee foul whistle blast on football pitch, clean isolated audio, no music',
  },
  {
    id: 'sfx_pack_open',
    prompt: 'Sound effect: sleek futuristic trading card pack rip followed by bright golden shimmer chime, crisp UI audio, 1.5 seconds',
  },
];

function runCli(args) {
  return execFileSync('gemini-api', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

function encodeM4a(inputPath, outPath, bitrate = '96k') {
  try {
    execFileSync('ffmpeg', ['-y', '-i', inputPath, '-c:a', 'aac', '-b:a', bitrate, outPath], { stdio: 'ignore' });
    return true;
  } catch {
    // fallback macOS afconvert
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', bitrate.replace('k', '000'), inputPath, outPath], {
      stdio: 'ignore',
    });
    return true;
  }
}

console.log('Checking gemini-api CLI auth...');
runCli(['whoami']);

const bgmMap = {};
for (const item of BGM_SPECS) {
  const rawBase = path.join(RAW_DIR, 'bgm', `${item.id}.wav`);
  console.log(`[BGM] Generating ${item.id}...`);
  const generatedPath = runCli(['music', item.prompt, '--out', rawBase]);
  const finalOut = path.join(OUT_DIR, 'bgm', `${item.id}.m4a`);
  encodeM4a(generatedPath, finalOut, '96k');
  bgmMap[item.id] = `assets/audio/bgm/${item.id}.m4a`;
}

const voMap = {};
for (const item of VO_SPECS) {
  const rawBase = path.join(RAW_DIR, 'vo', `${item.id}.wav`);
  console.log(`[VO] Generating ${item.id} (${item.voice})...`);
  const generatedPath = runCli([
    'tts',
    item.text,
    '-v',
    item.voice,
    '--language',
    'cmn-CN',
    '--out',
    rawBase,
  ]);
  const finalOut = path.join(OUT_DIR, 'vo', `${item.id}.m4a`);
  encodeM4a(generatedPath, finalOut, '64k');
  voMap[item.id] = `assets/audio/vo/${item.id}.m4a`;
}

const sfxMap = {};
for (const item of SFX_SPECS) {
  const rawBase = path.join(RAW_DIR, 'sfx', `${item.id}.wav`);
  console.log(`[SFX] Generating ${item.id}...`);
  const generatedPath = runCli(['music', item.prompt, '--out', rawBase]);
  const finalOut = path.join(OUT_DIR, 'sfx', `${item.id}.m4a`);
  encodeM4a(generatedPath, finalOut, '96k');
  sfxMap[item.id] = `assets/audio/sfx/${item.id}.m4a`;
}

const manifestSrc = `/**
 * 外置音频资源静态清单（由 scripts/generate_audio.mjs 自动生成）
 */

export type ExternalBgmId =
  | 'bgm_title'
  | 'bgm_prologue'
  | 'bgm_portal'
  | 'bgm_match_normal'
  | 'bgm_match_climax'
  | 'bgm_celebration';

export type VoiceAssetId =
  | 'vo_prologue_1'
  | 'vo_prologue_2'
  | 'vo_prologue_3'
  | 'vo_prologue_4'
  | 'vo_kickoff'
  | 'vo_goal'
  | 'vo_goal_brace'
  | 'vo_goal_hattrick'
  | 'vo_goal_late'
  | 'vo_save'
  | 'vo_foul_yellow'
  | 'vo_card_red'
  | 'vo_skill_cutin'
  | 'vo_cmd_card'
  | 'vo_champ';

export type ExternalSfxId =
  | 'sfx_whistle_long'
  | 'sfx_whistle_short'
  | 'sfx_goal_roar'
  | 'sfx_pack_open';

export const EXTERNAL_BGM_FILES: Partial<Record<ExternalBgmId, string>> = ${JSON.stringify(bgmMap, null, 2)};

export const EXTERNAL_VOICE_FILES: Partial<Record<VoiceAssetId, string>> = ${JSON.stringify(voMap, null, 2)};

export const EXTERNAL_SFX_FILES: Partial<Record<ExternalSfxId, string>> = ${JSON.stringify(sfxMap, null, 2)};
`;

fs.writeFileSync(MANIFEST_PATH, manifestSrc, 'utf8');
console.log('Done! AudioManifest.ts updated and compressed .m4a assets saved to apps/steam/assets/audio/.');
