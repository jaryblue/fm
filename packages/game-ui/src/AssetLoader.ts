/**
 * 跨平台美术资源加载与缓存管理器
 * 对齐《RELEASE_ART_AND_UI_PLAN.md》正式美术资源清单
 * 兼容 Steam/Web (`new Image()`) 与微信小游戏 (`wx.createImage()`)
 */

export type ArtAssetId =
  | 'bg_title'
  | 'bg_draft'
  | 'bg_portal'
  | 'bg_champion'
  | 'story_underdog'
  | 'story_revenge'
  | 'story_veteran'
  | 'story_wonderkid'
  | 'story_relegation'
  | 'story_academy'
  | 'story_poach'
  | 'story_tactician'
  | 'reward_win'
  | 'reward_draw'
  | 'perk_event'
  | 'trophy_tier1'
  | 'trophy_tier2_4'
  | 'panel_carbon_bg'
  | 'card_frame_s'
  | 'card_frame_a'
  | 'card_bg_gold'
  | 'card_bg_purple'
  | 'card_bg_blue'
  | 'elem_press'
  | 'elem_pass'
  | 'elem_wing'
  | 'elem_iron'
  | 'elem_blitz'
  | 'cmd_tiki_taka'
  | 'cmd_gegenpress'
  | 'cmd_iron_wall'
  | 'cmd_blitz'
  | 'cmd_super_sub'
  | 'cmd_wing_play'
  | 'cmd_set_piece'
  | 'cmd_offside_trap'
  | 'cmd_gk_launch'
  | 'cmd_long_shot'
  | 'cmd_blood_frenzy'
  | 'role_gk'
  | 'role_def'
  | 'role_mid'
  | 'role_att'
  | 'command_card_back'
  | 'stadium_bg'
  | 'game_logo'
  | 'pitch_grass_top'
  | 'fixture_vs_bg'
  | 'goal_banner'
  | 'bg_tactics'
  | 'ach_blank'
  | 'ach_first_draft'
  | 'ach_first_win'
  | 'ach_playoffs'
  | 'ach_champion'
  | 'ach_dynasty'
  | 'ach_hattrick'
  | 'ach_clean_sheet'
  | 'ach_craft_card'
  | 'ach_recipe_5'
  | 'ach_hidden_trait'
  | 'ach_synergy'
  | 'ach_meta_lv3'
  | 'prologue_01_tunnel'
  | 'prologue_02_last_kick'
  | 'prologue_03_farewell_phone'
  | 'prologue_04_hometown_club'
  | 'prologue_05_retired_ending'
  | 'cmd_captain_roar'
  | 'pack_recruit'
  | 'pack_tactics'
  | 'pack_perk'
  | 'pack_burst_fx'
  | 'bg_skill_constellation'
  | 'bg_season_ceremony'
  | 'trophy_grand_cup'
  | 'card_frame_mythic'
  | 'fx_skill_cutin_att'
  | 'fx_skill_cutin_def'
  | 'fx_skill_cutin_ult'
  | 'icon_skill_master'
  | 'icon_style_press'
  | 'icon_style_tiki'
  | 'icon_style_wing'
  | 'icon_style_counter'
  | 'icon_style_bus'
  | 'icon_style_balanced'
  | 'icon_sys_4back'
  | 'icon_sys_3back'
  | 'icon_sys_5back'
  | 'icon_node_fusion'
  | 'icon_node_keystone'
  | 'bg_prologue_coronation'
  | 'fx_prologue_last_dance'
  | 'portrait_linfeng'
  | 'portrait_xiaoyu'
  | 'portrait_mentor'
  | 'game_logo_emblem'
  | 'bg_title_00_veteran'
  | 'bg_title_01_amateur'
  | 'bg_title_02_district'
  | 'bg_title_03_tier5'
  | 'bg_title_04_tier4'
  | 'bg_title_05_tier3'
  | 'bg_title_06_championship'
  | 'bg_title_07_super'
  | 'bg_title_08_dynasty'
  | 'trophy_league_t1_super'
  | 'trophy_league_t2_championship'
  | 'trophy_league_t3_tier3'
  | 'trophy_league_t4_tier4'
  | 'trophy_league_t5_tier5'
  | 'trophy_league_t6_district'
  | 'trophy_league_t7_amateur'
  | 'trophy_cup_fa'
  | 'trophy_cup_league'
  | 'trophy_cup_super'
  | 'trophy_cup_continental'
  | 'trophy_bronze_wood'
  | 'trophy_silver_urn'
  | 'trophy_modern_spiral'
  | 'trophy_salver_plate'
  | 'trophy_golden_boot'
  | 'trophy_golden_glove'
  | 'trophy_golden_ball'
  | 'trophy_dynasty_crown'
  | 'trophy_twin_pillar'
  | 'trophy_tactical_master'
  | 'relic_board_expand'
  | 'relic_rich_budget'
  | 'relic_hairdryer'
  | 'relic_comeback_gene'
  | 'relic_deadball_mage'
  | 'relic_san_siro_gloves'
  | 'relic_super_bench'
  | 'relic_clutch_clock'
  | 'skill_scalpel_pass'
  | 'skill_tiki_flow'
  | 'skill_dribble_foul'
  | 'skill_gegenpress_swarm'
  | 'skill_blitz_counter'
  | 'skill_solo_finish'
  | 'skill_power_volley'
  | 'skill_aerial_header'
  | 'skill_wing_switch'
  | 'skill_long_ball'
  | 'skill_gk_save'
  | 'skill_gk_launch'
  | 'skill_slide_tackle'
  | 'skill_iron_fortress'
  | 'skill_captain_roar'
  | 'skill_total_football_ult'
  | 'dir_tt_atk'
  | 'dir_tt_def'
  | 'dir_gp_atk'
  | 'dir_gp_def'
  | 'dir_wp_atk'
  | 'dir_wp_def'
  | 'dir_ct_atk'
  | 'dir_ct_def'
  | 'dir_pb_atk'
  | 'dir_pb_def'
  | 'dir_bl_atk'
  | 'dir_bl_def'
  | 'dir_fu_3back_blitz'
  | 'dir_fu_4back_control'
  | 'dir_fu_5back_fortress'
  | 'dir_fu_setpiece_clutch';

export const ART_MANIFEST: Record<ArtAssetId, string> = {
  stadium_bg: 'assets/art/stadium_bg.jpg',
  bg_title: 'assets/art/bg_title.jpg',
  bg_draft: 'assets/art/bg_draft.webp',
  bg_portal: 'assets/art/bg_portal.webp',
  bg_champion: 'assets/art/bg_champion.jpg',
  story_underdog: 'assets/art/story_underdog.webp',
  story_revenge: 'assets/art/story_revenge.webp',
  story_veteran: 'assets/art/story_veteran.webp',
  story_wonderkid: 'assets/art/story_wonderkid.webp',
  story_relegation: 'assets/art/story_relegation.webp',
  story_academy: 'assets/art/story_academy.webp',
  story_poach: 'assets/art/story_poach.webp',
  story_tactician: 'assets/art/story_tactician.webp',
  reward_win: 'assets/art/reward_win.webp',
  reward_draw: 'assets/art/reward_draw.webp',
  perk_event: 'assets/art/perk_event.webp',
  trophy_tier1: 'assets/art/trophy_tier1.webp',
  trophy_tier2_4: 'assets/art/trophy_tier2_4.jpg',
  panel_carbon_bg: 'assets/art/panel_carbon_bg.webp',
  card_frame_s: 'assets/art/card_frame_s.webp',
  card_frame_a: 'assets/art/card_frame_a.webp',
  card_bg_gold: 'assets/art/card_bg_gold.webp',
  card_bg_purple: 'assets/art/card_bg_purple.webp',
  card_bg_blue: 'assets/art/card_bg_blue.webp',
  elem_press: 'assets/art/elem_press.webp',
  elem_pass: 'assets/art/elem_pass.webp',
  elem_wing: 'assets/art/elem_wing.webp',
  elem_iron: 'assets/art/elem_iron.webp',
  elem_blitz: 'assets/art/elem_blitz.webp',
  cmd_tiki_taka: 'assets/art/cmd_tiki_taka.webp',
  cmd_gegenpress: 'assets/art/cmd_gegenpress.webp',
  cmd_iron_wall: 'assets/art/cmd_iron_wall.webp',
  cmd_blitz: 'assets/art/cmd_blitz.webp',
  cmd_super_sub: 'assets/art/cmd_super_sub.webp',
  cmd_wing_play: 'assets/art/cmd_wing_play.webp',
  cmd_set_piece: 'assets/art/cmd_set_piece.webp',
  cmd_offside_trap: 'assets/art/cmd_offside_trap.webp',
  cmd_gk_launch: 'assets/art/cmd_gk_launch.webp',
  cmd_long_shot: 'assets/art/cmd_long_shot.webp',
  cmd_blood_frenzy: 'assets/art/cmd_blood_frenzy.webp',
  role_gk: 'assets/art/role_gk.webp',
  role_def: 'assets/art/role_def.webp',
  role_mid: 'assets/art/role_mid.webp',
  role_att: 'assets/art/role_att.webp',
  command_card_back: 'assets/art/command_card_back.webp',
  game_logo: 'assets/art/game_logo.jpg',
  pitch_grass_top: 'assets/art/pitch_grass_top.webp',
  fixture_vs_bg: 'assets/art/fixture_vs_bg.webp',
  goal_banner: 'assets/art/goal_banner.webp',
  bg_tactics: 'assets/art/bg_tactics.webp',
  ach_blank: 'assets/art/ach/ach_blank.webp',
  ach_first_draft: 'assets/art/ach/ach_first_draft.jpg',
  ach_first_win: 'assets/art/ach/ach_first_win.jpg',
  ach_playoffs: 'assets/art/ach/ach_playoffs.jpg',
  ach_champion: 'assets/art/ach/ach_champion.jpg',
  ach_dynasty: 'assets/art/ach/ach_dynasty.jpg',
  ach_hattrick: 'assets/art/ach/ach_hattrick.jpg',
  ach_clean_sheet: 'assets/art/ach/ach_clean_sheet.jpg',
  ach_craft_card: 'assets/art/ach/ach_craft_card.jpg',
  ach_recipe_5: 'assets/art/ach/ach_recipe_5.jpg',
  ach_hidden_trait: 'assets/art/ach/ach_hidden_trait.jpg',
  ach_synergy: 'assets/art/ach/ach_synergy.jpg',
  ach_meta_lv3: 'assets/art/ach/ach_meta_lv3.jpg',
  prologue_01_tunnel: 'assets/art/prologue_01_tunnel.webp',
  prologue_02_last_kick: 'assets/art/prologue_02_last_kick.webp',
  prologue_03_farewell_phone: 'assets/art/prologue_03_farewell_phone.webp',
  prologue_04_hometown_club: 'assets/art/prologue_04_hometown_club.webp',
  prologue_05_retired_ending: 'assets/art/prologue_05_retired_ending.webp',
  cmd_captain_roar: 'assets/art/cmd_captain_roar.webp',
  pack_recruit: 'assets/art/pack_recruit.jpg',
  pack_tactics: 'assets/art/pack_tactics.jpg',
  pack_perk: 'assets/art/pack_perk.jpg',
  pack_burst_fx: 'assets/art/pack_burst_fx.webp',
  bg_skill_constellation: 'assets/art/bg_skill_constellation.webp',
  bg_season_ceremony: 'assets/art/bg_season_ceremony.webp',
  trophy_grand_cup: 'assets/art/trophy_grand_cup.jpg',
  card_frame_mythic: 'assets/art/card_frame_mythic.webp',
  fx_skill_cutin_att: 'assets/art/fx_skill_cutin_att.webp',
  fx_skill_cutin_def: 'assets/art/fx_skill_cutin_def.webp',
  fx_skill_cutin_ult: 'assets/art/fx_skill_cutin_ult.webp',
  icon_skill_master: 'assets/art/icon_skill_master.webp',
  icon_style_press: 'assets/art/icon_style_press.webp',
  icon_style_tiki: 'assets/art/icon_style_tiki.webp',
  icon_style_wing: 'assets/art/icon_style_wing.webp',
  icon_style_counter: 'assets/art/icon_style_counter.webp',
  icon_style_bus: 'assets/art/icon_style_bus.webp',
  icon_style_balanced: 'assets/art/icon_style_balanced.webp',
  icon_sys_4back: 'assets/art/icon_sys_4back.webp',
  icon_sys_3back: 'assets/art/icon_sys_3back.webp',
  icon_sys_5back: 'assets/art/icon_sys_5back.webp',
  icon_node_fusion: 'assets/art/icon_node_fusion.webp',
  icon_node_keystone: 'assets/art/icon_node_keystone.webp',
  bg_prologue_coronation: 'assets/art/bg_prologue_coronation.webp',
  fx_prologue_last_dance: 'assets/art/fx_prologue_last_dance.webp',
  portrait_linfeng: 'assets/art/portrait_linfeng.webp',
  portrait_xiaoyu: 'assets/art/portrait_xiaoyu.webp',
  portrait_mentor: 'assets/art/portrait_mentor.webp',
  game_logo_emblem: 'assets/art/game_logo_emblem.png',
  bg_title_00_veteran: 'assets/art/bg_title_00_veteran.jpg',
  bg_title_01_amateur: 'assets/art/bg_title_01_amateur.jpg',
  bg_title_02_district: 'assets/art/bg_title_02_district.jpg',
  bg_title_03_tier5: 'assets/art/bg_title_03_tier5.jpg',
  bg_title_04_tier4: 'assets/art/bg_title_04_tier4.jpg',
  bg_title_05_tier3: 'assets/art/bg_title_05_tier3.jpg',
  bg_title_06_championship: 'assets/art/bg_title_06_championship.jpg',
  bg_title_07_super: 'assets/art/bg_title_07_super.jpg',
  bg_title_08_dynasty: 'assets/art/bg_title_08_dynasty.jpg',
  trophy_league_t1_super: 'assets/art/trophy_league_t1_super.jpg',
  trophy_league_t2_championship: 'assets/art/trophy_league_t2_championship.jpg',
  trophy_league_t3_tier3: 'assets/art/trophy_league_t3_tier3.jpg',
  trophy_league_t4_tier4: 'assets/art/trophy_league_t4_tier4.jpg',
  trophy_league_t5_tier5: 'assets/art/trophy_league_t5_tier5.jpg',
  trophy_league_t6_district: 'assets/art/trophy_league_t6_district.jpg',
  trophy_league_t7_amateur: 'assets/art/trophy_league_t7_amateur.jpg',
  trophy_cup_fa: 'assets/art/trophy_cup_fa.jpg',
  trophy_cup_league: 'assets/art/trophy_cup_league.jpg',
  trophy_cup_super: 'assets/art/trophy_cup_super.jpg',
  trophy_cup_continental: 'assets/art/trophy_cup_continental.jpg',
  trophy_bronze_wood: 'assets/art/trophy_bronze_wood.jpg',
  trophy_silver_urn: 'assets/art/trophy_silver_urn.jpg',
  trophy_modern_spiral: 'assets/art/trophy_modern_spiral.jpg',
  trophy_salver_plate: 'assets/art/trophy_salver_plate.jpg',
  trophy_golden_boot: 'assets/art/trophy_golden_boot.jpg',
  trophy_golden_glove: 'assets/art/trophy_golden_glove.jpg',
  trophy_golden_ball: 'assets/art/trophy_golden_ball.jpg',
  trophy_dynasty_crown: 'assets/art/trophy_dynasty_crown.jpg',
  trophy_twin_pillar: 'assets/art/trophy_twin_pillar.jpg',
  trophy_tactical_master: 'assets/art/trophy_tactical_master.jpg',
  relic_board_expand: 'assets/art/relics/relic_board_expand.png',
  relic_rich_budget: 'assets/art/relics/relic_rich_budget.png',
  relic_hairdryer: 'assets/art/relics/relic_hairdryer.png',
  relic_comeback_gene: 'assets/art/relics/relic_comeback_gene.png',
  relic_deadball_mage: 'assets/art/relics/relic_deadball_mage.png',
  relic_san_siro_gloves: 'assets/art/relics/relic_san_siro_gloves.png',
  relic_super_bench: 'assets/art/relics/relic_super_bench.png',
  relic_clutch_clock: 'assets/art/relics/relic_clutch_clock.png',
  skill_scalpel_pass: 'assets/art/skills/skill_scalpel_pass.png',
  skill_tiki_flow: 'assets/art/skills/skill_tiki_flow.png',
  skill_dribble_foul: 'assets/art/skills/skill_dribble_foul.png',
  skill_gegenpress_swarm: 'assets/art/skills/skill_gegenpress_swarm.png',
  skill_blitz_counter: 'assets/art/skills/skill_blitz_counter.png',
  skill_solo_finish: 'assets/art/skills/skill_solo_finish.png',
  skill_power_volley: 'assets/art/skills/skill_power_volley.png',
  skill_aerial_header: 'assets/art/skills/skill_aerial_header.png',
  skill_wing_switch: 'assets/art/skills/skill_wing_switch.png',
  skill_long_ball: 'assets/art/skills/skill_long_ball.png',
  skill_gk_save: 'assets/art/skills/skill_gk_save.png',
  skill_gk_launch: 'assets/art/skills/skill_gk_launch.png',
  skill_slide_tackle: 'assets/art/skills/skill_slide_tackle.png',
  skill_iron_fortress: 'assets/art/skills/skill_iron_fortress.png',
  skill_captain_roar: 'assets/art/skills/skill_captain_roar.png',
  skill_total_football_ult: 'assets/art/skills/skill_total_football_ult.png',
  dir_tt_atk: 'assets/art/directives/dir_tt_atk.jpg',
  dir_tt_def: 'assets/art/directives/dir_tt_def.jpg',
  dir_gp_atk: 'assets/art/directives/dir_gp_atk.jpg',
  dir_gp_def: 'assets/art/directives/dir_gp_def.jpg',
  dir_wp_atk: 'assets/art/directives/dir_wp_atk.jpg',
  dir_wp_def: 'assets/art/directives/dir_wp_def.jpg',
  dir_ct_atk: 'assets/art/directives/dir_ct_atk.jpg',
  dir_ct_def: 'assets/art/directives/dir_ct_def.jpg',
  dir_pb_atk: 'assets/art/directives/dir_pb_atk.jpg',
  dir_pb_def: 'assets/art/directives/dir_pb_def.jpg',
  dir_bl_atk: 'assets/art/directives/dir_bl_atk.jpg',
  dir_bl_def: 'assets/art/directives/dir_bl_def.jpg',
  dir_fu_3back_blitz: 'assets/art/directives/dir_fu_3back_blitz.jpg',
  dir_fu_4back_control: 'assets/art/directives/dir_fu_4back_control.jpg',
  dir_fu_5back_fortress: 'assets/art/directives/dir_fu_5back_fortress.jpg',
  dir_fu_setpiece_clutch: 'assets/art/directives/dir_fu_setpiece_clutch.jpg',
};

/**
 * 根据联赛层级 (1=超级联赛 .. 7=社区业余联赛) 返回对应的专属冠军奖杯资源 ID
 */
export function getLeagueTierTrophyAssetId(tier?: number): ArtAssetId {
  switch (tier) {
    case 1: return 'trophy_league_t1_super';
    case 2: return 'trophy_league_t2_championship';
    case 3: return 'trophy_league_t3_tier3';
    case 4: return 'trophy_league_t4_tier4';
    case 5: return 'trophy_league_t5_tier5';
    case 6: return 'trophy_league_t6_district';
    case 7:
    default:
      return 'trophy_league_t7_amateur';
  }
}

/** 根据 V6 圣物 ID 返回对应独立图标资源 ID */
export function getRelicAssetId(relicId: string): ArtAssetId | null {
  const key = `relic_${relicId}` as ArtAssetId;
  return key in ART_MANIFEST ? key : null;
}

/** 根据绝技 ID / 流派 / 倾向映射至 16 个动作母题图标之一 */
export function getSkillAssetId(skillId: string, style?: string, tendency?: string): ArtAssetId {
  const id = skillId.toLowerCase();
  if (id.includes('ult') || id === 'sk_f_433' || id === 'sk_f_4222') return 'skill_total_football_ult';
  if (id === 'sk_tt_1' || id === 'sk_f_3412' || id === 'sk_f_41212') return 'skill_scalpel_pass';
  if (id === 'sk_tt_3' || id === 'sk_m_tt' || id === 'sk_bl_3') return 'skill_tiki_flow';
  if (id === 'sk_tt_2' || id === 'sk_pb_2') return 'skill_dribble_foul';
  if (id === 'sk_gp_1' || id === 'sk_gp_2' || id === 'sk_f_343' || id === 'sk_m_gp') return 'skill_gegenpress_swarm';
  if (id === 'sk_gp_3' || id === 'sk_ct_3' || id === 'sk_m_ct') return 'skill_blitz_counter';
  if (id === 'sk_ct_1' || id === 'sk_f_4231') return 'skill_solo_finish';
  if (id === 'sk_bl_1' || id === 'sk_f_442' || id === 'sk_f_4411' || id === 'sk_f_4321') return 'skill_power_volley';
  if (id === 'sk_wp_1' || id === 'sk_pb_1' || id === 'sk_f_352') return 'skill_aerial_header';
  if (id === 'sk_wp_2' || id === 'sk_wp_3' || id === 'sk_wp_5' || id === 'sk_f_3421' || id === 'sk_m_wp') return 'skill_wing_switch';
  if (id === 'sk_tt_5' || id === 'sk_ct_6' || id === 'sk_f_523') return 'skill_long_ball';
  if (id === 'sk_pb_5' || id === 'sk_f_532' || id === 'sk_tt_6') return 'skill_gk_save';
  if (id === 'sk_ct_5' || id === 'sk_f_5212') return 'skill_gk_launch';
  if (id === 'sk_wp_4' || id === 'sk_wp_6' || id === 'sk_pb_4' || id === 'sk_pb_6' || id === 'sk_ct_2' || id === 'sk_gp_6') return 'skill_slide_tackle';
  if (id === 'sk_f_541' || id === 'sk_f_4141' || id === 'sk_gp_5' || id === 'sk_m_pb' || id === 'sk_bl_6') return 'skill_iron_fortress';
  if (id === 'sk_bl_2' || id === 'sk_bl_4' || id === 'sk_bl_5' || id === 'sk_pb_3' || id === 'sk_m_bl') return 'skill_captain_roar';
  const isDef = tendency === 'DEF';
  switch (style) {
    case 'tiki_taka': return isDef ? 'skill_tiki_flow' : 'skill_scalpel_pass';
    case 'gegenpress': return isDef ? 'skill_slide_tackle' : 'skill_gegenpress_swarm';
    case 'wing_play': return isDef ? 'skill_slide_tackle' : 'skill_wing_switch';
    case 'counter': return isDef ? 'skill_gk_launch' : 'skill_blitz_counter';
    case 'park_bus': return isDef ? 'skill_iron_fortress' : 'skill_aerial_header';
    default: return isDef ? 'skill_captain_roar' : 'skill_power_volley';
  }
}

/** 根据临场指令卡流派/体系/倾向映射至 16 张漫画卡面插画之一 */
export function getDirectiveAssetId(opts: {
  source?: string;
  style?: string;
  system?: string;
  tendency?: string;
  zone?: string;
}): ArtAssetId {
  if (opts.zone === 'clutch' || opts.zone === 'set_piece') return 'dir_fu_setpiece_clutch';
  if (opts.source === 'fusion' || opts.source === 'system') {
    if (opts.system === '3-back') return 'dir_fu_3back_blitz';
    if (opts.system === '5-back') return 'dir_fu_5back_fortress';
    if (opts.system === '4-back') return 'dir_fu_4back_control';
  }
  const isDef = opts.tendency === 'DEF';
  switch (opts.style) {
    case 'tiki_taka': return isDef ? 'dir_tt_def' : 'dir_tt_atk';
    case 'gegenpress': return isDef ? 'dir_gp_def' : 'dir_gp_atk';
    case 'wing_play': return isDef ? 'dir_wp_def' : 'dir_wp_atk';
    case 'counter': return isDef ? 'dir_ct_def' : 'dir_ct_atk';
    case 'park_bus': return isDef ? 'dir_pb_def' : 'dir_pb_atk';
    default: return isDef ? 'dir_bl_def' : 'dir_bl_atk';
  }
}

type ImageLike = HTMLImageElement & { complete?: boolean; naturalWidth?: number; width?: number };

class AssetLoaderImpl {
  private cache = new Map<ArtAssetId, ImageLike>();
  private loading = new Set<ArtAssetId>();
  private failed = new Set<ArtAssetId>();
  private basePath = '';

  public setBasePath(prefix: string): void {
    this.basePath = prefix.replace(/\/+$/, '');
  }

  public preloadAll(): void {
    // 优先加载启动开场与标题页核心资源，避免开场闪现占位图
    const priority: ArtAssetId[] = ['game_logo', 'stadium_bg', 'bg_title'];
    priority.forEach(id => this.load(id));
    (Object.keys(ART_MANIFEST) as ArtAssetId[]).forEach(id => {
      if (!priority.includes(id)) this.load(id);
    });
  }

  public load(id: ArtAssetId): void {
    if (this.cache.has(id) || this.loading.has(id) || this.failed.has(id)) return;
    const rel = ART_MANIFEST[id];
    if (!rel) return;

    const src = this.basePath ? `${this.basePath}/${rel}` : rel;
    let img: ImageLike | null = null;
    try {
      const g = globalThis as unknown as {
        wx?: { createImage?: () => ImageLike };
        Image?: new () => ImageLike;
      };
      if (g.wx && typeof g.wx.createImage === 'function') {
        img = g.wx.createImage();
      } else if (typeof g.Image === 'function') {
        img = new g.Image();
      }
    } catch {
      img = null;
    }

    if (!img) {
      this.failed.add(id);
      return;
    }

    this.loading.add(id);
    img.onload = () => {
      this.loading.delete(id);
      this.cache.set(id, img!);
    };
    img.onerror = () => {
      this.loading.delete(id);
      this.failed.add(id);
    };
    img.src = src;
  }

  public get(id: ArtAssetId): ImageLike | null {
    const cached = this.cache.get(id);
    if (cached && (cached.naturalWidth ? cached.naturalWidth > 0 : (cached.width ?? 0) > 0)) {
      return cached;
    }
    if (!this.loading.has(id) && !this.failed.has(id)) {
      this.load(id);
    }
    return null;
  }

  public getProgress(): { loaded: number; total: number } {
    const total = Object.keys(ART_MANIFEST).length;
    return { loaded: this.cache.size, total };
  }
}

export const AssetLoader = new AssetLoaderImpl();
