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
  | 'portrait_mentor';

export const ART_MANIFEST: Record<ArtAssetId, string> = {
  stadium_bg: 'assets/art/stadium_bg.jpg',
  bg_title: 'assets/art/bg_title.webp',
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
  trophy_tier2_4: 'assets/art/trophy_tier2_4.webp',
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
  game_logo: 'assets/art/game_logo.webp',
  pitch_grass_top: 'assets/art/pitch_grass_top.webp',
  fixture_vs_bg: 'assets/art/fixture_vs_bg.webp',
  goal_banner: 'assets/art/goal_banner.webp',
  bg_tactics: 'assets/art/bg_tactics.webp',
  ach_blank: 'assets/art/ach/ach_blank.webp',
  ach_first_draft: 'assets/art/ach/ach_first_draft.webp',
  ach_first_win: 'assets/art/ach/ach_first_win.webp',
  ach_playoffs: 'assets/art/ach/ach_playoffs.webp',
  ach_champion: 'assets/art/ach/ach_champion.webp',
  ach_dynasty: 'assets/art/ach/ach_dynasty.webp',
  ach_hattrick: 'assets/art/ach/ach_hattrick.webp',
  ach_clean_sheet: 'assets/art/ach/ach_clean_sheet.webp',
  ach_craft_card: 'assets/art/ach/ach_craft_card.webp',
  ach_recipe_5: 'assets/art/ach/ach_recipe_5.webp',
  ach_hidden_trait: 'assets/art/ach/ach_hidden_trait.webp',
  ach_synergy: 'assets/art/ach/ach_synergy.webp',
  ach_meta_lv3: 'assets/art/ach/ach_meta_lv3.webp',
  prologue_01_tunnel: 'assets/art/prologue_01_tunnel.webp',
  prologue_02_last_kick: 'assets/art/prologue_02_last_kick.webp',
  prologue_03_farewell_phone: 'assets/art/prologue_03_farewell_phone.webp',
  prologue_04_hometown_club: 'assets/art/prologue_04_hometown_club.webp',
  prologue_05_retired_ending: 'assets/art/prologue_05_retired_ending.webp',
  cmd_captain_roar: 'assets/art/cmd_captain_roar.webp',
  pack_recruit: 'assets/art/pack_recruit.webp',
  pack_tactics: 'assets/art/pack_tactics.webp',
  pack_perk: 'assets/art/pack_perk.webp',
  pack_burst_fx: 'assets/art/pack_burst_fx.webp',
  bg_skill_constellation: 'assets/art/bg_skill_constellation.webp',
  bg_season_ceremony: 'assets/art/bg_season_ceremony.webp',
  trophy_grand_cup: 'assets/art/trophy_grand_cup.png',
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
};

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
    (Object.keys(ART_MANIFEST) as ArtAssetId[]).forEach(id => this.load(id));
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
