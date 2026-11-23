/**
 * 跨平台美术资源加载与缓存管理器
 * 对齐《RELEASE_ART_AND_UI_PLAN.md》正式美术资源清单
 * 兼容 Steam/Web (`new Image()`) 与微信小游戏 (`wx.createImage()`)
 */

export type ArtAssetId =
  | 'bg_title'
  | 'bg_draft'
  | 'bg_portal'
  | 'bg_match'
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
  | 'craft_fusion'
  | 'draft_scout'
  | 'perk_event'
  | 'champ_celebrate'
  | 'trophy_champ'
  | 'trophy_tier1'
  | 'trophy_tier2_4'
  | 'trophy_tier5_7'
  | 'league_pyramid_emblem'
  | 'pitch_stage_bg'
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
  | 'role_gk'
  | 'role_def'
  | 'role_mid'
  | 'role_att'
  | 'command_card_back'
  | 'achievement_badge'
  | 'stadium_bg'
  | 'game_logo'
  | 'avatar_face_0' | 'avatar_face_1' | 'avatar_face_2' | 'avatar_face_3' | 'avatar_face_4' | 'avatar_face_5'
  | 'avatar_eyes_0' | 'avatar_eyes_1' | 'avatar_eyes_2' | 'avatar_eyes_3' | 'avatar_eyes_4' | 'avatar_eyes_5'
  | 'avatar_hair_0' | 'avatar_hair_1' | 'avatar_hair_2' | 'avatar_hair_3' | 'avatar_hair_4'
  | 'avatar_hair_5' | 'avatar_hair_6' | 'avatar_hair_7' | 'avatar_hair_8' | 'avatar_hair_9'
  | 'avatar_beard_0' | 'avatar_beard_1' | 'avatar_beard_2' | 'avatar_beard_3' | 'avatar_beard_4' | 'avatar_beard_5'
  | 'avatar_kit_0' | 'avatar_kit_1' | 'avatar_kit_2' | 'avatar_kit_3'
  | 'avatar_acc_0' | 'avatar_acc_1' | 'avatar_acc_2' | 'avatar_acc_3';

export const ART_MANIFEST: Record<ArtAssetId, string> = {
  stadium_bg: 'assets/art/stadium_bg.jpg',
  bg_title: 'assets/art/bg_title.jpg',
  bg_draft: 'assets/art/bg_draft.jpg',
  bg_portal: 'assets/art/bg_portal.jpg',
  bg_match: 'assets/art/bg_match.jpg',
  bg_champion: 'assets/art/bg_champion.jpg',
  story_underdog: 'assets/art/story_underdog.jpg',
  story_revenge: 'assets/art/story_revenge.jpg',
  story_veteran: 'assets/art/story_veteran.jpg',
  story_wonderkid: 'assets/art/story_wonderkid.jpg',
  story_relegation: 'assets/art/story_relegation.webp',
  story_academy: 'assets/art/story_academy.webp',
  story_poach: 'assets/art/story_poach.webp',
  story_tactician: 'assets/art/story_tactician.webp',
  reward_win: 'assets/art/reward_win.jpg',
  reward_draw: 'assets/art/reward_draw.jpg',
  craft_fusion: 'assets/art/craft_fusion.jpg',
  draft_scout: 'assets/art/draft_scout.jpg',
  perk_event: 'assets/art/perk_event.jpg',
  champ_celebrate: 'assets/art/champ_celebrate.jpg',
  trophy_champ: 'assets/art/trophy_champ.png',
  trophy_tier1: 'assets/art/trophy_tier1.webp',
  trophy_tier2_4: 'assets/art/trophy_tier2_4.webp',
  trophy_tier5_7: 'assets/art/trophy_tier5_7.webp',
  league_pyramid_emblem: 'assets/art/league_pyramid_emblem.webp',
  pitch_stage_bg: 'assets/art/pitch_stage_bg.webp',
  panel_carbon_bg: 'assets/art/panel_carbon_bg.webp',
  card_frame_s: 'assets/art/card_frame_s.png',
  card_frame_a: 'assets/art/card_frame_a.png',
  card_bg_gold: 'assets/art/card_bg_gold.webp',
  card_bg_purple: 'assets/art/card_bg_purple.webp',
  card_bg_blue: 'assets/art/card_bg_blue.webp',
  elem_press: 'assets/art/elem_press.png',
  elem_pass: 'assets/art/elem_pass.png',
  elem_wing: 'assets/art/elem_wing.png',
  elem_iron: 'assets/art/elem_iron.png',
  elem_blitz: 'assets/art/elem_blitz.png',
  cmd_tiki_taka: 'assets/art/cmd_tiki_taka.webp',
  cmd_gegenpress: 'assets/art/cmd_gegenpress.webp',
  cmd_iron_wall: 'assets/art/cmd_iron_wall.webp',
  cmd_blitz: 'assets/art/cmd_blitz.webp',
  cmd_super_sub: 'assets/art/cmd_super_sub.webp',
  cmd_wing_play: 'assets/art/cmd_wing_play.webp',
  cmd_set_piece: 'assets/art/cmd_set_piece.webp',
  cmd_offside_trap: 'assets/art/cmd_offside_trap.webp',
  role_gk: 'assets/art/role_gk.jpg',
  role_def: 'assets/art/role_def.jpg',
  role_mid: 'assets/art/role_mid.jpg',
  role_att: 'assets/art/role_att.jpg',
  command_card_back: 'assets/art/command_card_back.jpg',
  achievement_badge: 'assets/art/achievement_badge.png',
  game_logo: 'assets/art/game_logo.png',
  avatar_face_0: 'assets/art/avatar/face_0.png',
  avatar_face_1: 'assets/art/avatar/face_1.png',
  avatar_face_2: 'assets/art/avatar/face_2.png',
  avatar_face_3: 'assets/art/avatar/face_3.png',
  avatar_face_4: 'assets/art/avatar/face_4.png',
  avatar_face_5: 'assets/art/avatar/face_5.png',
  avatar_eyes_0: 'assets/art/avatar/eyes_0.png',
  avatar_eyes_1: 'assets/art/avatar/eyes_1.png',
  avatar_eyes_2: 'assets/art/avatar/eyes_2.png',
  avatar_eyes_3: 'assets/art/avatar/eyes_3.png',
  avatar_eyes_4: 'assets/art/avatar/eyes_4.png',
  avatar_eyes_5: 'assets/art/avatar/eyes_5.png',
  avatar_hair_0: 'assets/art/avatar/hair_0.png',
  avatar_hair_1: 'assets/art/avatar/hair_1.png',
  avatar_hair_2: 'assets/art/avatar/hair_2.png',
  avatar_hair_3: 'assets/art/avatar/hair_3.png',
  avatar_hair_4: 'assets/art/avatar/hair_4.png',
  avatar_hair_5: 'assets/art/avatar/hair_5.png',
  avatar_hair_6: 'assets/art/avatar/hair_6.png',
  avatar_hair_7: 'assets/art/avatar/hair_7.png',
  avatar_hair_8: 'assets/art/avatar/hair_8.png',
  avatar_hair_9: 'assets/art/avatar/hair_9.png',
  avatar_beard_0: 'assets/art/avatar/beard_0.png',
  avatar_beard_1: 'assets/art/avatar/beard_1.png',
  avatar_beard_2: 'assets/art/avatar/beard_2.png',
  avatar_beard_3: 'assets/art/avatar/beard_3.png',
  avatar_beard_4: 'assets/art/avatar/beard_4.png',
  avatar_beard_5: 'assets/art/avatar/beard_5.png',
  avatar_kit_0: 'assets/art/avatar/kit_0.png',
  avatar_kit_1: 'assets/art/avatar/kit_1.png',
  avatar_kit_2: 'assets/art/avatar/kit_2.png',
  avatar_kit_3: 'assets/art/avatar/kit_3.png',
  avatar_acc_0: 'assets/art/avatar/acc_0.png',
  avatar_acc_1: 'assets/art/avatar/acc_1.png',
  avatar_acc_2: 'assets/art/avatar/acc_2.png',
  avatar_acc_3: 'assets/art/avatar/acc_3.png',
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
