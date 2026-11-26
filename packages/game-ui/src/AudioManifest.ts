/**
 * 外置音频资源静态清单（由 scripts/generate_audio.mjs 自动维护）
 * 未生成外置文件时保持为空映射，SoundEngine 自动无缝回退至 WebAudio 程序化合成，确保零 404 报错。
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

export const EXTERNAL_BGM_FILES: Partial<Record<ExternalBgmId, string>> = {};

export const EXTERNAL_VOICE_FILES: Partial<Record<VoiceAssetId, string>> = {};

export const EXTERNAL_SFX_FILES: Partial<Record<ExternalSfxId, string>> = {};
