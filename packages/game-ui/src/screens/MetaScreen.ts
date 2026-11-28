/**
 * V6 局外养成中枢：锁定式双环八卦战术星盘 + 0'/25'/50'/70' 临场指令配装栏 + 俱乐部基建
 * - 5 层同心八卦星盘：外环 6×60° 流派(48数值被动+36主动技+72手牌) × 内环 3×120° 防线与16阵型(12防线被动+32阵型被动+32手牌+16主动技)
 *   × 6正对融合奇点(18选6+18王牌手牌) × 6宗师印(+6终极技) × 圆心【★超级宗师】(+全军破限)
 * - 完整星宿连线拓扑与防跨级解锁校验，优先渲染高精透明雕纹美术素材（drawSkillGlyph）
 * - 顶部常驻临场指令池配装栏（0'/25'/50'/70' × 4张手牌 + 4个 F 键主动技槽），保留「俱乐部基建 (8×8 · 资金)」
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import {
  getMetaUpgradeRequirement,
  INFRA_MIN_TIERS,
  META_BRANCHES,
} from '../../../core/src/MetaTree';
import { MetaBranch } from '../../../core/src/types';
import {
  calcRefundablePoints,
  canUnlockCore,
  canUnlockMasterySeal,
  canUnlockV6Node,
  getAlignedFusions,
  getV6NodePrerequisites,
  INNER_RING_SYSTEMS,
  isStyleVisibleInFog,
  OUTER_RING_STYLES,
  STYLE_LABELS,
  STYLE_ORIGIN_PASSIVE,
  SYSTEM_FORMATIONS,
  SYSTEM_LABELS,
  SYSTEM_ORIGIN_PASSIVE,
  V6_ACTIVE_SKILL_MAP,
  V6_ACTIVE_SKILLS,
  V6_ALL_PASSIVES,
  V6_DIRECTIVE_MAP,
  V6_DIRECTIVES,
  V6_FUSION_MAP,
  V6_MASTERY_SEAL_MAP,
  V6_MASTERY_SEALS,
  V6_PASSIVE_MAP,
  V6_SEGMENTS,
  V6_STYLE_PASSIVES,
  V6_SYSTEM_PASSIVES,
  type V6CheckpointKey,
  type V6DirectiveDef,
  type V6PassiveDef,
  type V6SatelliteKey,
} from '../../../core/src/v6';
import { DefenseSystem, FormationName, TacticalStyle } from '../../../engine/src/types';
import { AssetLoader } from '../AssetLoader';
import { drawAstrolabeBackdropAndRings } from '../AstrolabeVisuals';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawNavRail,
  drawPrintCard,
  drawRoundRect,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  HitRegistry,
  NavRailTab,
} from '../CanvasKit';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, drawSkillGlyph, IconName, SkillGlyphKind } from '../VectorIcons';

const BRANCH_ICON: Record<MetaBranch, IconName> = {
  academy: 'star',
  scout: 'sparkle',
  finance: 'chart',
  transfer: 'refresh',
  medical: 'shield',
  training_ground: 'bolt',
  stadium: 'trophy',
  analytics: 'tactics',
};

const STYLE_GLYPH: Record<TacticalStyle, SkillGlyphKind> = {
  tiki_taka: 'tiki',
  gegenpress: 'press',
  wing_play: 'wing',
  counter: 'counter',
  park_bus: 'bus',
  balanced: 'balanced',
};

const SYSTEM_GLYPH: Record<DefenseSystem, SkillGlyphKind> = {
  '4-back': 'sys_4back',
  '3-back': 'sys_3back',
  '5-back': 'sys_5back',
};

function getPassiveStatGlyph(p: V6PassiveDef): SkillGlyphKind {
  if (p.tier === 'origin') {
    if (p.style) return STYLE_GLYPH[p.style];
    if (p.system) return SYSTEM_GLYPH[p.system];
  }
  const sd = p.statDelta;
  const tm = p.tacticalMod;
  if (sd?.shooting || tm?.longShotBias || tm?.boxCrashBonus) return 'stat_shoot';
  if (sd?.passing || sd?.composure || tm?.shortPassBias || tm?.throughPassBias) return 'stat_pass';
  if (sd?.defending || sd?.goalkeeping || p.blockBonus || p.oppShotXgPenalty || p.startingShields || (tm?.lineShift ?? 0) < 0) {
    return 'stat_def';
  }
  if (sd?.pace || tm?.crossBias || tm?.overlapDepthBonus || tm?.dualOverlap || tm?.pressDistBonus) return 'stat_pace';
  return 'stat_fit';
}

type SelectedTarget =
  | { kind: 'core' }
  | { kind: 'seal'; id: string }
  | { kind: 'fusion'; id: string }
  | { kind: 'formation'; formation: FormationName }
  | { kind: 'directive'; id: string }
  | { kind: 'skill'; id: string }
  | { kind: 'passive'; id: string }
  | { kind: 'catalog_directives' }
  | { kind: 'catalog_skills' };

const ZONE_COLOR: Record<'ATT' | 'MID' | 'DEF', string> = {
  ATT: '#F43F5E',
  MID: '#38BDF8',
  DEF: '#22C55E',
};

const ZONE_LABEL: Record<'ATT' | 'MID' | 'DEF', string> = {
  ATT: '前场',
  MID: '中场',
  DEF: '后场',
};

const CHECKPOINT_TABS: Array<{ key: V6CheckpointKey; label: string }> = V6_SEGMENTS.map(s => ({
  key: s.key,
  label: s.shortLabel,
}));

interface CanvasNodePos {
  x: number;
  y: number;
  unlocked: boolean;
  reachable: boolean;
  color: string;
}

export class MetaScreen {
  private tab: 'astrolabe' | 'talents' = 'astrolabe';
  private selected: SelectedTarget = { kind: 'core' };
  private drawerOpen = false;
  private activeCheckpoint: V6CheckpointKey = 's1';
  private catalogFilterStyle: 'ALL' | TacticalStyle | 'formation' | 'fusion' = 'ALL';
  private catalogPage = 0;
  private infraPage = 0;

  private zoom = 0.96;
  private panX = 0;
  private panY = 0;
  private animTime = 0;
  private outerRotOffset = 0;
  private outerRotVel = 0;
  private innerRotOffset = 0;
  private innerRotVel = 0;
  private rotFlashTimer = 0;
  private rotFlashRing: 'outer' | 'inner' = 'outer';
  private dragging = false;
  private dragLastX = 0;
  private dragLastY = 0;
  private lastMapRect = { x: 96, y: 112, w: 1168, h: 592 };
  private lastDrawerRect = { x: 846, y: 122, w: 408, h: 572 };
  private notice = '宏观罗盘可用两侧星轨拨盘旋转双环碰撞 6 大融合奇点 · 点击流派纹章或滚轮放大进入星宿特写';

  public isAnimating(): boolean {
    return (
      Math.abs(this.outerRotOffset) > 0.002 ||
      Math.abs(this.outerRotVel) > 0.002 ||
      Math.abs(this.innerRotOffset) > 0.002 ||
      Math.abs(this.innerRotVel) > 0.002 ||
      this.rotFlashTimer > 0
    );
  }

  public handleEscape(): boolean {
    if (this.drawerOpen) {
      this.drawerOpen = false;
      return true;
    }
    return false;
  }

  private inMap(x: number, y: number): boolean {
    const r = this.lastMapRect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private inDrawer(x: number, y: number): boolean {
    if (!this.drawerOpen) return false;
    const d = this.lastDrawerRect;
    return x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h;
  }

  public update(dtSec: number): void {
    const dt = Math.min(0.05, Math.max(0.001, dtSec));
    this.animTime += dt;
    // 欠阻尼机械弹簧：丝滑旋转 + 轻微落锁回弹质感
    const stiffness = 175;
    const damping = 18.5;
    if (Math.abs(this.outerRotOffset) > 0.0005 || Math.abs(this.outerRotVel) > 0.0005) {
      const acc = -stiffness * this.outerRotOffset - damping * this.outerRotVel;
      this.outerRotVel += acc * dt;
      this.outerRotOffset += this.outerRotVel * dt;
      if (Math.abs(this.outerRotOffset) < 0.0015 && Math.abs(this.outerRotVel) < 0.015) {
        this.outerRotOffset = 0;
        this.outerRotVel = 0;
      }
    }
    if (Math.abs(this.innerRotOffset) > 0.0005 || Math.abs(this.innerRotVel) > 0.0005) {
      const acc = -stiffness * this.innerRotOffset - damping * this.innerRotVel;
      this.innerRotVel += acc * dt;
      this.innerRotOffset += this.innerRotVel * dt;
      if (Math.abs(this.innerRotOffset) < 0.0015 && Math.abs(this.innerRotVel) < 0.015) {
        this.innerRotOffset = 0;
        this.innerRotVel = 0;
      }
    }
    if (this.rotFlashTimer > 0) {
      this.rotFlashTimer = Math.max(0, this.rotFlashTimer - dt);
    }
  }

  public onPointerDown(x: number, y: number): void {
    if (this.inDrawer(x, y)) return;
    if (this.tab === 'astrolabe' && this.inMap(x, y)) {
      this.dragging = true;
      this.dragLastX = x;
      this.dragLastY = y;
    }
  }

  public onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    const dx = x - this.dragLastX;
    const dy = y - this.dragLastY;
    this.dragLastX = x;
    this.dragLastY = y;
    this.panX = Math.max(-560, Math.min(560, this.panX + dx));
    this.panY = Math.max(-560, Math.min(560, this.panY + dy));
  }

  public onPointerUp(): void {
    this.dragging = false;
  }

  public onWheel(deltaY: number, x: number, y: number): boolean {
    if (this.tab !== 'astrolabe') return false;
    if (this.inDrawer(x, y)) {
      if (this.selected.kind === 'catalog_directives' || this.selected.kind === 'catalog_skills') {
        this.catalogPage = Math.max(0, this.catalogPage + (deltaY > 0 ? 1 : -1));
        return true;
      }
      return false;
    }
    if (!this.inMap(x, y)) return false;
    const factor = deltaY < 0 ? 1.15 : 0.87;
    this.applyZoomAt(factor, x, y);
    return true;
  }

  public onPinchZoom(factor: number, x: number, y: number): void {
    if (this.tab !== 'astrolabe' || this.inDrawer(x, y)) return;
    this.dragging = false;
    this.applyZoomAt(factor, x, y);
  }

  private applyZoomAt(factor: number, x: number, y: number): void {
    const oldZoom = this.zoom;
    const nextZoom = Math.max(0.75, Math.min(2.6, Math.round(oldZoom * factor * 100) / 100));
    if (nextZoom === oldZoom) return;
    const r = this.lastMapRect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const ratio = nextZoom / oldZoom;
    this.panX = Math.max(-560, Math.min(560, (x - cx) - ((x - cx) - this.panX) * ratio));
    this.panY = Math.max(-560, Math.min(560, (y - cy) - ((y - cy) - this.panY) * ratio));
    this.zoom = nextZoom;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onBack: () => void;
      onSave: () => void;
      onNavigate?: (tab: NavRailTab) => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const ast = league.getV6Astrolabe();
    const hasRail = !!actions.onNavigate;

    drawBroadcastHeader(ctx, hits, {
      kicker: 'V6 UNIFIED BAGUA ASTROLABE · 92 PASSIVES · 122 DIRECTIVES · 59 SKILLS',
      title: '双环八卦战术星盘与临场指令配装',
      club: hasRail ? club : undefined,
      onBack: hasRail ? undefined : actions.onBack,
      metaPoints: st.metaPointsTotal,
      clubFunds: league.getClubFunds(),
      showSoundToggle: true,
    });

    if (actions.onNavigate) {
      drawNavRail(ctx, hits, 'meta', actions.onNavigate);
    }

    const baseX = hasRail ? 96 : 24;
    const totalW = hasRail ? 1168 : 1232;

    // 顶部主导航与星盘锁盘/旋转栏 (y: 74, h: 30)
    drawButton(ctx, hits, baseX, 74, 178, 30, '八卦战术星盘 (V6)', () => {
      this.tab = 'astrolabe';
    }, { active: this.tab === 'astrolabe', fontSize: 12, icon: 'tactics' });

    drawButton(ctx, hits, baseX + 184, 74, 166, 30, '俱乐部基建 (8×8)', () => {
      this.tab = 'talents';
      this.drawerOpen = false;
    }, { active: this.tab === 'talents', fontSize: 12, icon: 'talent' });

    if (this.tab === 'talents') {
      drawText(ctx, `俱乐部历史最高第 ${league.getBestTierReached()} 级 · 资金扩建永久保留`, baseX + 366, 89, {
        size: 12,
        color: '#7DD3FC',
      });
      this.renderClubInfrastructure(ctx, hits, league, baseX, totalW, actions);
      return;
    }

    const isBeginnerMode = !ast.fogCleared && league.getCurrentTierInfo().tier >= 6;
    let rx = baseX + totalW;
    rx -= 96;
    const isCatalogOpen = this.drawerOpen && (this.selected.kind === 'catalog_directives' || this.selected.kind === 'catalog_skills');
    drawButton(ctx, hits, rx, 74, 96, 30, '星盘图鉴', () => {
      this.selected = { kind: this.selected.kind === 'catalog_directives' ? 'catalog_skills' : 'catalog_directives' };
      this.catalogPage = 0;
      this.drawerOpen = true;
    }, { active: isCatalogOpen, fontSize: 12 });

    if (isBeginnerMode) {
      rx -= 94;
      drawButton(ctx, hits, rx, 74, 88, 30, '展开全盘', () => {
        league.clearV6AstrolabeFog();
        this.notice = '已驱散新手迷雾，六大流派全盘展示！';
        actions.onSave();
      }, { variant: 'ghost', fontSize: 12, icon: 'sparkle' });
    }

    if (!ast.locked) {
      rx -= 104;
      drawButton(ctx, hits, rx, 74, 98, 30, '锁定星盘', () => {
        const r = league.lockV6Astrolabe();
        if (r.ok) {
          SoundEngine.playAstrolabeLock();
          this.rotFlashTimer = 0.65;
          this.rotFlashRing = 'outer';
          this.notice = '双环星盘已锁定！当前 6 个正对融合奇点已激活可点亮路径';
          actions.onSave();
        }
      }, { variant: 'gold', fontSize: 12, icon: 'lock' });
    } else {
      const respecLabel = ast.freeRespecAvailable ? '免费洗点解锁' : '洗点解锁(¥80万)';
      rx -= 124;
      drawButton(ctx, hits, rx, 74, 118, 30, respecLabel, () => {
        const r = league.respecV6Astrolabe();
        if (r.ok) {
          SoundEngine.playClick();
          this.notice = `已重置星盘并全额退还 ${r.refunded ?? 0}pt，可重新旋转双环！`;
          actions.onSave();
        } else {
          SoundEngine.playWarning();
          this.notice = r.reason || '无法洗点';
        }
      }, { variant: 'ghost', fontSize: 12, icon: 'refresh' });
    }

    // ==================== 全景主舞台：两级语义缩放八卦战术星盘 (y: 112, h: 592) ====================
    const mapX = baseX;
    const mapY = 112;
    const mapW = totalW;
    const mapH = 592;
    this.lastMapRect = { x: mapX, y: mapY, w: mapW, h: mapH };

    drawChamferPanel(ctx, mapX, mapY, mapW, mapH, 6, THEME.BG_DEEP, THEME.INK_LINE, 2.5, THEME.BRASS);

    this.renderAstrolabeCanvas(ctx, hits, league, mapX, mapY, mapW, mapH);
    this.renderSideRotateDials(ctx, hits, league, mapX, mapY, mapW, mapH, actions.onSave);

    // 顶部提示与统计徽章
    const defaultNotice = '宏观罗盘可用两侧星轨拨盘旋转双环碰撞 6 大融合奇点 · 点击流派纹章或滚轮放大进入星宿特写';
    const displayNotice = isBeginnerMode && this.notice === defaultNotice
      ? `新手引导：点击【${STYLE_LABELS[club.style].name}】纹章展开星宿，或点右上「展开全盘」解锁全图`
      : this.notice;
    const noticeW = Math.min(490, mapW - 360);
    const noticeH = 38;
    drawRoundRect(ctx, mapX + 12, mapY + 12, noticeW, noticeH, 3, THEME.BG_CARD_DARK, THEME.INK_LINE, 2);
    drawWrappedText(ctx, displayNotice, mapX + 20, mapY + 17, noticeW - 16, 15, {
      token: 'LABEL',
      color: ast.locked ? THEME.BRASS : THEME.LIME,
      maxLines: 2,
    });

    const tpBase = league.getV6MatchRuntimeConfig().checkpointTpBase;
    drawRoundRect(ctx, mapX + mapW - 352, mapY + 12, 340, 38, 3, THEME.BG_CARD_DARK, THEME.INK_LINE, 2);
    drawText(
      ctx,
      `被动${ast.unlockedPassives.length}/92 · 牌${ast.unlockedDirectives.length}/122 · 技${ast.unlockedSkills.length}/59`,
      mapX + mapW - 182,
      mapY + 23,
      { token: 'LABEL', color: THEME.TX1, align: 'center', mono: true }
    );
    drawText(
      ctx,
      `印${ast.unlockedMasterySeals.length}/6 · 每段${tpBase}TP`,
      mapX + mapW - 182,
      mapY + 39,
      { token: 'LABEL', color: THEME.BRASS, align: 'center', mono: true }
    );

    // 底部极简双态罗盘胶囊（滚轮自由缩放，点击一键切换宏观/特写）
    const isMacroNow = this.zoom < 1.32;
    const pillX = mapX + 14;
    const pillY = mapY + mapH - 38;
    const pillW = 204;
    const pillH = 28;
    drawRoundRect(ctx, pillX, pillY, pillW, pillH, 3, THEME.BG_CARD_DARK, THEME.INK_LINE, 2);
    drawRoundRect(
      ctx,
      isMacroNow ? pillX + 2 : pillX + pillW / 2,
      pillY + 2,
      pillW / 2 - 2,
      pillH - 4,
      2,
      THEME.BRASS,
      THEME.INK_LINE,
      1.5
    );
    drawText(ctx, '宏观罗盘', pillX + pillW * 0.25, pillY + 14, {
      size: 12,
      bold: true,
      color: isMacroNow ? THEME.PAPER_INK : THEME.TX2,
      align: 'center',
    });
    drawText(ctx, '星宿特写', pillX + pillW * 0.75, pillY + 14, {
      size: 12,
      bold: true,
      color: !isMacroNow ? THEME.PAPER_INK : THEME.TX2,
      align: 'center',
    });
    const pillPadY = 8 
    hits.add(pillX, pillY - pillPadY, pillW / 2, pillH + pillPadY * 2, () => {
      this.zoom = 0.96;
      this.panX = 0;
      this.panY = 0;
      this.notice = '宏观罗盘视图：可用两侧拨盘旋转双环，点击流派纹章展开星宿';
    });
    hits.add(pillX + pillW / 2, pillY - pillPadY, pillW / 2, pillH + pillPadY * 2, () => {
      const myStyleIdx = Math.max(0, [0, 1, 2, 3, 4, 5].find(k => OUTER_RING_STYLES[((k - ast.outerRingStep) % 6 + 6) % 6] === club.style) ?? 0);
      const focusAng = -Math.PI / 2 + (myStyleIdx * Math.PI) / 3;
      this.zoom = 1.88;
      const unitR = Math.min(mapW, mapH) * 0.48 * this.zoom;
      this.panX = Math.round(-Math.cos(focusAng) * unitR * 0.62);
      this.panY = Math.round(-Math.sin(focusAng) * unitR * 0.62);
      this.notice = `星宿特写视图：已聚焦【${STYLE_LABELS[club.style].name}】扇区，双指捏合/滚轮缩放`;
    });
    const zoomBtnW = 36 
    const zoomBtnH = 32 
    const zoomBtnY = pillY - 2 
    drawButton(ctx, hits, pillX + pillW + 8, zoomBtnY, zoomBtnW, zoomBtnH, '－', () => {
      this.applyZoomAt(0.82, mapX + mapW / 2, mapY + mapH / 2);
    }, { variant: 'ghost', fontSize: 12 });
    drawButton(ctx, hits, pillX + pillW + 12 + zoomBtnW, zoomBtnY, zoomBtnW, zoomBtnH, '＋', () => {
      this.applyZoomAt(1.22, mapX + mapW / 2, mapY + mapH / 2);
    }, { variant: 'ghost', fontSize: 12 });

    if (this.drawerOpen) {
      this.renderInspectorDrawer(ctx, hits, league, mapX, mapY, mapW, mapH, actions);
    }
  }

  private renderLoadoutBar(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    x: number,
    y: number,
    w: number,
    h: number,
    actions: { onSave: () => void }
  ): void {
    const ast = league.getV6Astrolabe();
    drawChamferPanel(ctx, x, y, w, h, 8, 'rgba(13, 21, 38, 0.94)', THEME.BORDER, 1.1);

    drawText(ctx, '临场指令池', x + 12, y + 15, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, x + 12, y + 23, 66, 20, ast.useUniversalPool ? '通用✓' : '分拐点', () => {
      league.setV6UniversalPool(!ast.useUniversalPool);
      this.notice = !ast.useUniversalPool ? '已开启【一键复用 4 张通用指令池】' : '已切换为 20\'/45\'/70\' 独立配牌模式';
      actions.onSave();
    }, { active: ast.useUniversalPool, fontSize: 12 });

    let cx = x + 84;
    CHECKPOINT_TABS.forEach((cp, idx) => {
      const act = this.activeCheckpoint === cp.key;
      drawButton(ctx, hits, cx + idx * 38, y + 10, 34, 28, cp.label, () => {
        this.activeCheckpoint = cp.key;
      }, { active: act, fontSize: 12 });
    });
    cx += 120;

    const poolIds = ast.checkpointPools[this.activeCheckpoint] ?? [];
    const slotW = Math.floor((w - 208 - 356) / 4) - 6;
    for (let i = 0; i < 4; i++) {
      const sx = cx + i * (slotW + 6);
      const did = poolIds[i];
      const def = did ? V6_DIRECTIVE_MAP[did] : undefined;
      if (def) {
        const zCol = ZONE_COLOR[def.zone];
        const sats = ast.directiveSatellites[did]?.length ?? 0;
        drawRoundRect(ctx, sx, y + 6, slotW, 36, 6, 'rgba(18, 29, 51, 0.96)', zCol, 1.2);
        ctx.fillStyle = zCol;
        ctx.fillRect(sx + 2, y + 8, 3, 32);
        drawText(ctx, `${def.tpCost}TP`, sx + 10, y + 16, { size: 12, bold: true, color: THEME.GOLD_LIGHT, mono: true });
        drawText(ctx, `${ZONE_LABEL[def.zone]}·${def.tendency === 'ATK' ? '攻' : '守'}`, sx + slotW - 6, y + 16, {
          size: 12,
          color: zCol,
          align: 'right',
        });
        drawText(ctx, fitText(ctx, `${def.name}${sats > 0 ? ` ★${sats}` : ''}`, slotW - 14, 10.5, true), sx + 10, y + 32, {
          size: 12,
          bold: true,
          color: THEME.TX1,
        });
        hits.add(sx, y + 6, slotW, 36, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'directive', id: def.id };
          this.drawerOpen = true;
        });
      } else {
        drawRoundRect(ctx, sx, y + 6, slotW, 36, 6, 'rgba(10, 16, 28, 0.72)', 'rgba(100,116,139,0.35)', 1);
        drawText(ctx, `+ 槽位 ${i + 1} (点手牌装配)`, sx + slotW / 2, y + 24, {
          size: 12,
          color: THEME.TX3,
          align: 'center',
        });
        hits.add(sx, y + 6, slotW, 36, () => {
          this.selected = { kind: 'catalog_directives' };
          this.catalogPage = 0;
          this.drawerOpen = true;
        });
      }
    }

    const skStartX = x + w - 348;
    drawText(ctx, 'F键主动技', skStartX - 2, y + 24, { size: 12, bold: true, color: '#38BDF8', align: 'right' });
    for (let i = 0; i < 4; i++) {
      const sx = skStartX + 6 + i * 84;
      const sid = ast.equippedSkills[i];
      const sk = sid ? V6_ACTIVE_SKILL_MAP[sid] : undefined;
      if (sk) {
        const br = ast.skillBranchChoice[sid] ?? 'A';
        drawRoundRect(ctx, sx, y + 6, 80, 36, 6, 'rgba(12, 54, 86, 0.85)', '#38BDF8', 1.2);
        drawText(ctx, `F${i + 1} · ${br}支`, sx + 6, y + 16, { size: 12, bold: true, color: '#7DD3FC', mono: true });
        drawText(ctx, fitText(ctx, sk.name, 70, 10, true), sx + 6, y + 32, { size: 12, bold: true, color: '#FFFFFF' });
        hits.add(sx, y + 6, 80, 36, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'skill', id: sk.id };
          this.drawerOpen = true;
        });
      } else {
        drawRoundRect(ctx, sx, y + 6, 80, 36, 6, 'rgba(10, 16, 28, 0.72)', 'rgba(56,189,248,0.28)', 1);
        drawText(ctx, `F${i + 1} 空槽`, sx + 40, y + 24, { size: 12, color: THEME.TX3, align: 'center' });
        hits.add(sx, y + 6, 80, 36, () => {
          this.selected = { kind: 'catalog_skills' };
          this.catalogPage = 0;
          this.drawerOpen = true;
        });
      }
    }
  }

  private drawNodeLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    bold = false,
    mono = false,
    size = 9
  ): void {
    const fontStr = `${bold ? 'bold ' : ''}${size}px ${THEME.FONT_FAMILY}`;
    ctx.save();
    ctx.font = fontStr;
    const tw = Math.ceil(ctx.measureText(text).width);
    const pw = tw + 10;
    const ph = size + 6;
    drawRoundRect(ctx, x - pw / 2, y - ph / 2, pw, ph, 4, 'rgba(8, 13, 24, 0.86)', 'rgba(148, 163, 184, 0.24)', 0.8);
    ctx.restore();
    drawText(ctx, text, x, y, {
      size,
      rawSize: true,
      bold,
      color,
      align: 'center',
      mono,
    });
  }

  private drawEdgeLine(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    bothUnlocked: boolean,
    reachable: boolean,
    color: string,
    isBridge = false
  ): void {
    const mr = this.lastMapRect;
    if (
      Math.max(ax, bx) < mr.x - 20 ||
      Math.min(ax, bx) > mr.x + mr.w + 20 ||
      Math.max(ay, by) < mr.y - 20 ||
      Math.min(ay, by) > mr.y + mr.h + 20
    ) {
      return;
    }
    ctx.save();
    if (bothUnlocked) {
      ctx.strokeStyle = color;
      ctx.lineWidth = isBridge ? 2.6 : 1.9;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // 沿连线流动的金色星辉粒子
      const t = (this.animTime * 0.48 + ((ax + ay) % 100) * 0.01) % 1;
      const sx = ax + (bx - ax) * t;
      const sy = ay + (by - ay) * t;
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(sx, sy, isBridge ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (reachable) {
      ctx.strokeStyle = isBridge ? 'rgba(250, 204, 21, 0.75)' : 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = isBridge ? 2 : 1.45;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -this.animTime * 16;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = isBridge ? 'rgba(250, 204, 21, 0.22)' : 'rgba(100, 116, 139, 0.26)';
      ctx.lineWidth = isBridge ? 1.3 : 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 星盘左右两侧物理机械旋盘拨片（左逆转 / 右顺转，带悬停发光与齿轮刻度） */
  private renderSideRotateDials(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    mapX: number,
    mapY: number,
    mapW: number,
    mapH: number,
    onSave: () => void
  ): void {
    const ast = league.getV6Astrolabe();
    if (ast.locked) return;
    const isBeginnerMode = !ast.fogCleared && league.getCurrentTierInfo().tier >= 6;
    if (isBeginnerMode && this.zoom < 1.32) return;

    const triggerRotate = (ring: 'outer' | 'inner', dir: 1 | -1) => {
      const r = league.rotateV6Astrolabe(ring, dir);
      if (!r.ok) return;
      SoundEngine.playAstrolabeRotate(ring);
      if (ring === 'outer') {
        this.outerRotOffset -= dir * (Math.PI / 3);
        this.outerRotVel = dir * 1.6;
        this.notice = `外环六大流派${dir > 0 ? '顺时针' : '逆时针'}旋转 60°，6 颗融合奇点已重新对齐！`;
      } else {
        this.innerRotOffset -= dir * ((2 * Math.PI) / 3);
        this.innerRotVel = dir * 2.2;
        this.notice = `内环防线体系${dir > 0 ? '顺时针' : '逆时针'}旋转 120°，6 颗融合奇点已重新对齐！`;
      }
      this.rotFlashTimer = 0.58;
      this.rotFlashRing = ring;
      onSave();
    };

    const drawPaddle = (
      px: number,
      py: number,
      pw: number,
      ph: number,
      side: 'left' | 'right',
      ring: 'outer' | 'inner',
      title: string,
      sub: string,
      glyph: string,
      accent: string,
      onClick: () => void
    ) => {
      const hovered = hits.isHovered(px, py, pw, ph);
      ctx.save();
      // 弧形贴合星环的黄铜/钢蓝机械拨片（仅留 ↺/↻ 与度数刻度，大幅收窄占宽）
      const radius = 3;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, radius);
      ctx.fillStyle = hovered ? THEME.BG_PITCH_ALT : THEME.BG_CARD_DARK;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = hovered ? THEME.LIME : THEME.INK_LINE;
      ctx.stroke();

      // 朝向星盘一侧的黄铜齿轮刻线
      const edgeX = side === 'left' ? px + pw - 5 : px + 5;
      ctx.strokeStyle = hovered ? THEME.LIME : THEME.BRASS;
      ctx.lineWidth = 1.8;
      for (let ti = 0; ti < 4; ti++) {
        const ty = py + 14 + ti * ((ph - 28) / 3);
        ctx.beginPath();
        ctx.moveTo(edgeX - 2, ty);
        ctx.lineTo(edgeX + 2, ty);
        ctx.stroke();
      }

      const textCx = side === 'left' ? px + (pw - 4) / 2 : px + (pw + 4) / 2;
      drawText(ctx, glyph, textCx, py + 21, {
        size: hovered ? 20 : 18,
        bold: true,
        color: hovered ? THEME.LIME : accent,
        align: 'center',
      });
      drawText(ctx, sub.split(' ')[0], textCx, py + 45, {
        size: 12,
        bold: true,
        color: hovered ? THEME.PAPER_CREAM : THEME.TX2,
        align: 'center',
        mono: true,
      });
      ctx.restore();
      hits.add(px, py, pw, ph, onClick);
    };

    const pw = 64 
    const ph = 72 
    const midY = mapY + mapH / 2;
    const leftX = mapX + 14;
    const rightLimit = this.drawerOpen ? mapX + mapW - 422 : mapX + mapW - 14;
    const rightX = rightLimit - pw;

    // 左侧：逆时针旋转（外环 -60° / 内环 -120°）
    drawPaddle(leftX, midY - ph - 10, pw, ph, 'left', 'outer', '外环', '-60° 流派', '↺', THEME.LIME, () => triggerRotate('outer', -1));
    drawPaddle(leftX, midY + 10, pw, ph, 'left', 'inner', '内环', '-120° 防线', '↺', THEME.BRASS, () => triggerRotate('inner', -1));

    // 右侧：顺时针旋转（外环 +60° / 内环 +120°）
    drawPaddle(rightX, midY - ph - 10, pw, ph, 'right', 'outer', '外环', '+60° 流派', '↻', THEME.LIME, () => triggerRotate('outer', 1));
    drawPaddle(rightX, midY + 10, pw, ph, 'right', 'inner', '内环', '+120° 防线', '↻', THEME.BRASS, () => triggerRotate('inner', 1));
  }

  private renderAstrolabeCanvas(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    mapX: number,
    mapY: number,
    mapW: number,
    mapH: number
  ): void {
    const ast = league.getV6Astrolabe();
    const club = league.getUserClub();
    const tier = league.getCurrentTierInfo().tier;
    const unlockedDirSet = new Set(ast.unlockedDirectives);
    const unlockedSkillSet = new Set(ast.unlockedSkills);
    const unlockedFusionSet = new Set(ast.unlockedFusions);
    const unlockedSealSet = new Set(ast.unlockedMasterySeals);
    const unlockedPassiveSet = new Set(ast.unlockedPassives);
    const equippedPoolSet = new Set(ast.checkpointPools[this.activeCheckpoint] ?? []);
    const equippedSkillSet = new Set(ast.equippedSkills);

    const cx = mapX + (this.drawerOpen ? (mapW - 410) / 2 : mapW / 2) + this.panX;
    const cy = mapY + mapH / 2 + 6 + this.panY;
    const baseR = Math.min(mapW, mapH) * 0.48 * this.zoom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX + 4, mapY + 4, mapW - 8, mapH - 8);
    ctx.clip();

    // PITCH PRINT 深松石绒面 + 72 刻度精密黄铜兵法罗盘底盘（彻底告别暗蓝星云图）
    drawAstrolabeBackdropAndRings(
      ctx,
      cx,
      cy,
      baseR,
      { x: mapX + 4, y: mapY + 4, w: mapW - 8, h: mapH - 8 },
      this.animTime,
      this.rotFlashTimer,
      this.rotFlashRing
    );

    const canHit = (px: number, py: number) =>
      !this.inDrawer(px, py) && px >= mapX + 6 && px <= mapX + mapW - 6 && py >= mapY + 6 && py <= mapY + mapH - 6;

    // ==================== Pass 1：计算全部星盘节点坐标（用于先画连线、再画节点） ====================
    const posMap = new Map<string, CanvasNodePos>();

    // 外环 6 × 60° 扇区底色 + 计算 48 流派被动 / 36 流派主动技 / 72 流派手牌坐标
    const outerSectors: Array<{
      k: number;
      style: TacticalStyle;
      visible: boolean;
      centerAngle: number;
      startA: number;
      endA: number;
    }> = [];

    for (let k = 0; k < 6; k++) {
      const style = OUTER_RING_STYLES[((k - ast.outerRingStep) % 6 + 6) % 6];
      const info = STYLE_LABELS[style];
      const visible = isStyleVisibleInFog(ast, style, tier, club.style);
      const centerAngle = -Math.PI / 2 + (k * Math.PI) / 3 + this.outerRotOffset;
      const startA = centerAngle - Math.PI / 6;
      const endA = centerAngle + Math.PI / 6;
      outerSectors.push({ k, style, visible, centerAngle, startA, endA });

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, baseR * 1.04, startA, endA);
      ctx.closePath();
      ctx.fillStyle = visible ? `${info.color}12` : 'rgba(10, 26, 20, 0.52)';
      ctx.fill();
      ctx.strokeStyle = visible ? 'rgba(216, 168, 66, 0.34)' : 'rgba(110, 133, 120, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      const labelX = cx + Math.cos(centerAngle) * (baseR * 1.07);
      const labelY = cy + Math.sin(centerAngle) * (baseR * 1.07);
      const isBeginnerMode = !ast.fogCleared && tier >= 6;
      if (visible || !isBeginnerMode) {
        this.drawNodeLabel(
          ctx,
          visible ? info.name : '迷雾流派',
          labelX,
          labelY,
          visible ? info.color : '#64748B',
          true,
          false,
          Math.max(11.5 , Math.min(13.5, 11.5 * this.zoom))
        );
      }

      if (!visible) continue;

      // 8 个流派被动（数值小节点）：原点在 (0, 0.59)，攻线在左翼，守线在右翼
      const stylePassives = V6_STYLE_PASSIVES.filter(p => p.style === style);
      const originId = STYLE_ORIGIN_PASSIVE[style];
      const isBus = style === 'park_bus';
      for (const p of stylePassives) {
        const m = p.id.match(/_([ad])([1-4])$/);
        const br = m ? m[1] : 'a';
        const step = m ? Number(m[2]) : 1;
        let offsetA = 0;
        let radRatio = 0.59;
        if (p.id === originId) {
          offsetA = 0;
          radRatio = 0.59;
        } else if (br === 'a') {
          const idx = isBus ? step : step - 1; // 1..4 for bus, 1..3 for others
          offsetA = -0.075 - idx * 0.062;
          radRatio = 0.59 + idx * 0.04;
        } else {
          const idx = isBus ? step - 1 : step; // 1..3 for bus, 1..4 for others
          offsetA = 0.075 + idx * 0.062;
          radRatio = 0.59 + idx * 0.04;
        }
        const ang = centerAngle + offsetA;
        const px = cx + Math.cos(ang) * (baseR * radRatio);
        const py = cy + Math.sin(ang) * (baseR * radRatio);
        const unl = unlockedPassiveSet.has(p.id);
        const reach = !unl && canUnlockV6Node(ast, 'passive', p.id).ok;
        posMap.set(`passive:${p.id}`, { x: px, y: py, unlocked: unl, reachable: reach, color: info.color });
      }

      // 6 个流派主动技（菱形插槽，左3攻 / 右3守）
      const styleSkills = V6_ACTIVE_SKILLS.filter(s => s.source === 'style' && s.style === style);
      for (const sk of styleSkills) {
        const side = sk.tendency === 'DEF' ? 1 : -1;
        const zoneIdx = sk.zone === 'ATT' ? 0 : sk.zone === 'MID' ? 1 : 2;
        const offsetA = side * (0.11 + zoneIdx * 0.145);
        const radRatio = 0.80 + zoneIdx * 0.018;
        const ang = centerAngle + offsetA;
        const px = cx + Math.cos(ang) * (baseR * radRatio);
        const py = cy + Math.sin(ang) * (baseR * radRatio);
        const unl = unlockedSkillSet.has(sk.id);
        const reach = !unl && canUnlockV6Node(ast, 'skill', sk.id).ok;
        posMap.set(`skill:${sk.id}`, { x: px, y: py, unlocked: unl, reachable: reach, color: '#38BDF8' });
      }

      // 12 张流派手牌（左6攻 / 右6守；内圈稳健 1TP @0.89，外圈豪赌 2TP @0.98）
      const styleDirs = V6_DIRECTIVES.filter(d => d.source === 'style' && d.style === style);
      for (const dir of styleDirs) {
        const side = dir.tendency === 'DEF' ? 1 : -1;
        const zoneIdx = dir.zone === 'ATT' ? 0 : dir.zone === 'MID' ? 1 : 2;
        const offsetA = side * (0.11 + zoneIdx * 0.155);
        const radRatio = dir.route === 'steady' ? 0.89 : 0.985;
        const ang = centerAngle + offsetA;
        const px = cx + Math.cos(ang) * (baseR * radRatio);
        const py = cy + Math.sin(ang) * (baseR * radRatio);
        const unl = unlockedDirSet.has(dir.id);
        const reach = !unl && canUnlockV6Node(ast, 'directive', dir.id).ok;
        posMap.set(`directive:${dir.id}`, { x: px, y: py, unlocked: unl, reachable: reach, color: ZONE_COLOR[dir.zone] });
      }
    }

    // 6 个正对融合奇点坐标
    const aligned = getAlignedFusions(ast.outerRingStep, ast.innerRingStep);
    aligned.forEach((al, idx) => {
      const ang = -Math.PI / 2 + (idx * Math.PI) / 3;
      const px = cx + Math.cos(ang) * (baseR * 0.50);
      const py = cy + Math.sin(ang) * (baseR * 0.50);
      const unl = unlockedFusionSet.has(al.fusion.id);
      const reach = !unl && canUnlockV6Node(ast, 'fusion', al.fusion.id).ok;
      posMap.set(`fusion:${al.fusion.id}`, { x: px, y: py, unlocked: unl, reachable: reach, color: THEME.GOLD_LIGHT });
    });

    // 内环 3 × 120° 防线体系被动（12 个）+ 16 阵型坐标
    for (let s = 0; s < 3; s++) {
      const sys = INNER_RING_SYSTEMS[((s - ast.innerRingStep) % 3 + 3) % 3];
      const sysInfo = SYSTEM_LABELS[sys];
      const startA = -Math.PI / 2 - Math.PI / 6 + (s * 2 * Math.PI) / 3 + this.innerRotOffset;
      const spanA = (2 * Math.PI) / 3;
      const sysCenterA = startA + spanA / 2;

      const sysPassives = V6_SYSTEM_PASSIVES.filter(p => p.system === sys);
      const sysOffsets = [
        { da: 0, r: 0.285 },
        { da: -0.38, r: 0.315 },
        { da: 0, r: 0.345 },
        { da: 0.38, r: 0.315 },
      ];
      sysPassives.forEach((sp, si) => {
        const cfg = sysOffsets[si] ?? { da: 0, r: 0.31 };
        const a = sysCenterA + cfg.da;
        const px = cx + Math.cos(a) * (baseR * cfg.r);
        const py = cy + Math.sin(a) * (baseR * cfg.r);
        const unl = unlockedPassiveSet.has(sp.id);
        const reach = !unl && canUnlockV6Node(ast, 'passive', sp.id).ok;
        posMap.set(`passive:${sp.id}`, { x: px, y: py, unlocked: unl, reachable: reach, color: sysInfo.color });
      });

      const fms = SYSTEM_FORMATIONS[sys];
      fms.forEach((fm, fi) => {
        const fa = startA + ((fi + 0.5) / fms.length) * spanA;
        const px = cx + Math.cos(fa) * (baseR * 0.405);
        const py = cy + Math.sin(fa) * (baseR * 0.405);
        const fmKey = fm.replace(/-/g, '');
        const hasAnyFmPassive = unlockedPassiveSet.has(`pf_${fmKey}_a`) || unlockedPassiveSet.has(`pf_${fmKey}_d`);
        const sysOriginUnl = unlockedPassiveSet.has(SYSTEM_ORIGIN_PASSIVE[sys]);
        posMap.set(`formation:${fm}`, {
          x: px,
          y: py,
          unlocked: hasAnyFmPassive || club.formation === fm,
          reachable: !hasAnyFmPassive && sysOriginUnl,
          color: sysInfo.color,
        });
      });
    }

    // 6 个宗师印坐标
    V6_MASTERY_SEALS.forEach((seal, idx) => {
      const ang = -Math.PI / 2 + (idx * Math.PI) / 3;
      const px = cx + Math.cos(ang) * (baseR * 0.20);
      const py = cy + Math.sin(ang) * (baseR * 0.20);
      const unl = unlockedSealSet.has(seal.id);
      const reach = !unl && canUnlockMasterySeal(ast, seal.style).ok;
      posMap.set(`seal:${seal.id}`, { x: px, y: py, unlocked: unl, reachable: reach, color: STYLE_LABELS[seal.style].color });
    });

    const isMacro = this.zoom < 1.32;

    // ==================== Pass 2：绘制星宿前置连线（宏观罗盘仅绘主干金桥，特写展开全部星轨） ====================
    // 2a. 外环流派节点前置连线（特写模式展开）
    if (!isMacro) {
      for (const sec of outerSectors) {
        if (!sec.visible) continue;
        const style = sec.style;
        const stylePassives = V6_STYLE_PASSIVES.filter(p => p.style === style);
        for (const p of stylePassives) {
          const child = posMap.get(`passive:${p.id}`);
          if (!child) continue;
          for (const pre of getV6NodePrerequisites('passive', p.id).prereqs) {
            const par = posMap.get(`${pre.kind}:${pre.id}`);
            if (par) this.drawEdgeLine(ctx, par.x, par.y, child.x, child.y, par.unlocked && child.unlocked, par.unlocked && !child.unlocked, child.color);
          }
        }
        const styleSkills = V6_ACTIVE_SKILLS.filter(s => s.source === 'style' && s.style === style);
        for (const sk of styleSkills) {
          const child = posMap.get(`skill:${sk.id}`);
          if (!child) continue;
          for (const pre of getV6NodePrerequisites('skill', sk.id).prereqs) {
            const par = posMap.get(`${pre.kind}:${pre.id}`);
            if (par) this.drawEdgeLine(ctx, par.x, par.y, child.x, child.y, par.unlocked && child.unlocked, par.unlocked && !child.unlocked, '#38BDF8');
          }
        }
        const styleDirs = V6_DIRECTIVES.filter(d => d.source === 'style' && d.style === style);
        for (const dir of styleDirs) {
          const child = posMap.get(`directive:${dir.id}`);
          if (!child) continue;
          for (const pre of getV6NodePrerequisites('directive', dir.id).prereqs) {
            const par = posMap.get(`${pre.kind}:${pre.id}`);
            if (par) this.drawEdgeLine(ctx, par.x, par.y, child.x, child.y, par.unlocked && child.unlocked, par.unlocked && !child.unlocked, child.color);
          }
        }
      }

      // 2b. 内环防线体系被动链 + 防线原点→16阵型连线（特写模式展开）
      for (const sp of V6_SYSTEM_PASSIVES) {
        const child = posMap.get(`passive:${sp.id}`);
        if (!child) continue;
        for (const pre of getV6NodePrerequisites('passive', sp.id).prereqs) {
          const par = posMap.get(`${pre.kind}:${pre.id}`);
          if (par) this.drawEdgeLine(ctx, par.x, par.y, child.x, child.y, par.unlocked && child.unlocked, par.unlocked && !child.unlocked, child.color);
        }
      }
      for (const sys of INNER_RING_SYSTEMS) {
        const originPos = posMap.get(`passive:${SYSTEM_ORIGIN_PASSIVE[sys]}`);
        if (!originPos) continue;
        for (const fm of SYSTEM_FORMATIONS[sys]) {
          const fPos = posMap.get(`formation:${fm}`);
          if (fPos) {
            this.drawEdgeLine(ctx, originPos.x, originPos.y, fPos.x, fPos.y, originPos.unlocked && fPos.unlocked, originPos.unlocked && !fPos.unlocked, fPos.color);
          }
        }
      }
    }

    // 2c. 6 个正对融合奇点 ↔ 对齐外环流派原点 & 内环防线原点（金色双桥）
    for (const al of aligned) {
      const fPos = posMap.get(`fusion:${al.fusion.id}`);
      if (!fPos) continue;
      const stOrigin = posMap.get(`passive:${STYLE_ORIGIN_PASSIVE[al.style]}`);
      const sysOrigin = posMap.get(`passive:${SYSTEM_ORIGIN_PASSIVE[al.system]}`);
      if (stOrigin) {
        this.drawEdgeLine(ctx, fPos.x, fPos.y, stOrigin.x, stOrigin.y, fPos.unlocked && stOrigin.unlocked, ast.locked && stOrigin.unlocked && !fPos.unlocked, THEME.GOLD_LIGHT, true);
      }
      if (sysOrigin) {
        this.drawEdgeLine(ctx, sysOrigin.x, sysOrigin.y, fPos.x, fPos.y, fPos.unlocked && sysOrigin.unlocked, ast.locked && sysOrigin.unlocked && !fPos.unlocked, THEME.GOLD_LIGHT, true);
      }
    }

    // 2d. 6 个宗师印 ↔ 圆心星辉线
    for (const seal of V6_MASTERY_SEALS) {
      const sPos = posMap.get(`seal:${seal.id}`);
      if (sPos) {
        this.drawEdgeLine(ctx, cx, cy, sPos.x, sPos.y, sPos.unlocked && ast.coreUnlocked, sPos.unlocked && !ast.coreUnlocked, THEME.GOLD_LIGHT, true);
      }
    }

    // ==================== Pass 3：两级语义缩放绘制（宏观罗盘大纹章 vs 星宿特写精细节点） ====================
    const rotSlow = this.animTime * 0.55;

    const isBeginnerMode = !ast.fogCleared && tier >= 6;
    const nodeHitR = (r: number, pad = 4) => (Math.max(r + 10, 22) );

    // 3a. 外环 6 扇区：宏观罗盘绘制 44px 流派大纹章（点击推入特写），特写绘制完整 26 星宿节点
    if (isMacro) {
      for (const sec of outerSectors) {
        const style = sec.style;
        const info = STYLE_LABELS[style];
        const mx = cx + Math.cos(sec.centerAngle) * (baseR * 0.78);
        const my = cy + Math.sin(sec.centerAngle) * (baseR * 0.78);
        const mr = 23;
        if (!sec.visible) {
          if (!isBeginnerMode) {
            ctx.save();
            ctx.fillStyle = THEME.BG_DEEP;
            ctx.beginPath();
            ctx.arc(mx, my, mr, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(216, 168, 66, 0.35)';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            drawIcon(ctx, 'lock', mx, my, 16, THEME.TX3);
            ctx.restore();
          }
          continue;
        }
        const unlCount =
          V6_STYLE_PASSIVES.filter(p => p.style === style && unlockedPassiveSet.has(p.id)).length +
          V6_ACTIVE_SKILLS.filter(s => s.source === 'style' && s.style === style && unlockedSkillSet.has(s.id)).length +
          V6_DIRECTIVES.filter(d => d.source === 'style' && d.style === style && unlockedDirSet.has(d.id)).length;
        const isClubStyle = club.style === style;

        ctx.save();
        ctx.fillStyle = THEME.HARD_SHADOW;
        ctx.beginPath();
        ctx.arc(mx + 2, my + 2, mr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isClubStyle ? THEME.LIME : THEME.BG_PANEL;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isClubStyle ? THEME.INK_LINE : THEME.BRASS;
        ctx.stroke();

        ctx.strokeStyle = isClubStyle ? THEME.LIME : 'rgba(216, 168, 66, 0.65)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(mx, my, mr + 4.5, rotSlow, rotSlow + Math.PI * 1.5);
        ctx.stroke();
        ctx.setLineDash([]);

        drawSkillGlyph(
          ctx,
          STYLE_GLYPH[style],
          mx,
          my,
          mr * 1.15,
          isClubStyle ? THEME.PAPER_INK : THEME.BRASS,
          isClubStyle ? THEME.VERMILION : THEME.LIME,
          { vectorOnly: true }
        );
        ctx.restore();

        drawRoundRect(ctx, mx - 46, my + mr + 5, 92, 22, 2, isClubStyle ? THEME.PAPER_CREAM : THEME.BG_CARD_DARK, THEME.INK_LINE, 2);
        drawText(ctx, `${info.short} ${unlCount}/26 ▶`, mx, my + mr + 16, {
          size: 12,
          bold: true,
          color: isClubStyle ? THEME.PAPER_INK : THEME.TX1,
          align: 'center',
        });

        if (canHit(mx, my)) {
          hits.add(mx - mr - 10, my - mr - 8, (mr + 10) * 2, mr * 2 + 34, () => {
            SoundEngine.playClick();
            this.zoom = 1.88;
            const unitR = Math.min(mapW, mapH) * 0.48 * this.zoom;
            this.panX = Math.round(-Math.cos(sec.centerAngle) * unitR * 0.62);
            this.panY = Math.round(-Math.sin(sec.centerAngle) * unitR * 0.62);
            this.notice = `已展开【${info.name}】星宿特写（点节点解锁或查看卫星，左下角可返回宏观罗盘）`;
          });
        }
      }
    }

    for (const sec of isMacro ? [] : outerSectors) {
      if (!sec.visible) continue;
      const style = sec.style;
      const info = STYLE_LABELS[style];

      // 48 流派被动（数值节点）
      const stylePassives = V6_STYLE_PASSIVES.filter(p => p.style === style);
      for (const p of stylePassives) {
        const pos = posMap.get(`passive:${p.id}`);
        if (!pos) continue;
        const isOrigin = p.tier === 'origin';
        const isRare = p.tier === 'rare';
        const isSel = this.selected.kind === 'passive' && this.selected.id === p.id;
        const nr = isOrigin
          ? Math.max(8, 10.5 * Math.min(1.3, this.zoom))
          : isRare
          ? Math.max(6, 7.6 * Math.min(1.3, this.zoom))
          : Math.max(4.8, 6.0 * Math.min(1.3, this.zoom));

        ctx.save();
        ctx.fillStyle = pos.unlocked ? '#16213A' : pos.reachable ? '#0F1D33' : '#090F1D';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nr, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = isSel ? 2.4 : isOrigin ? 2.1 : pos.unlocked ? 1.8 : 1.2;
        ctx.strokeStyle = isSel ? '#FFFFFF' : pos.unlocked ? (isRare ? THEME.GOLD_LIGHT : info.color) : pos.reachable ? '#38BDF8' : '#334155';
        ctx.stroke();

        if (isOrigin && (pos.unlocked || pos.reachable)) {
          ctx.strokeStyle = pos.unlocked ? THEME.GOLD_LIGHT : 'rgba(56,189,248,0.65)';
          ctx.lineWidth = 1.1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, nr + 3.2, rotSlow, rotSlow + Math.PI * 1.5);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        drawSkillGlyph(
          ctx,
          getPassiveStatGlyph(p),
          pos.x,
          pos.y,
          nr * (isOrigin ? 1.42 : 1.26),
          pos.unlocked ? (isRare ? THEME.GOLD_LIGHT : info.color) : pos.reachable ? '#7DD3FC' : '#64748B',
          THEME.GOLD_LIGHT,
          { dim: !pos.unlocked && !pos.reachable }
        );
        ctx.restore();

        if (isOrigin || isSel || (false && this.zoom >= 1.5)) {
          this.drawNodeLabel(ctx, isOrigin ? `${info.short}原点` : p.name.slice(0, 4), pos.x, pos.y + nr + (11 ), pos.unlocked ? info.color : pos.reachable ? '#7DD3FC' : THEME.TX3, isOrigin || isSel, false, 10.5 );
        }
        if (canHit(pos.x, pos.y)) {
          const hr = nodeHitR(nr);
          hits.add(pos.x - hr, pos.y - hr, hr * 2, hr * 2, () => {
            SoundEngine.playClick();
            this.selected = { kind: 'passive', id: p.id };
            this.drawerOpen = true;
          });
        }
      }

      // 36 流派主动技（双层金属菱形插槽 + 流派高清雕纹）
      const styleSkills = V6_ACTIVE_SKILLS.filter(s => s.source === 'style' && s.style === style);
      for (const sk of styleSkills) {
        const pos = posMap.get(`skill:${sk.id}`);
        if (!pos) continue;
        const isEq = equippedSkillSet.has(sk.id);
        const isSel = this.selected.kind === 'skill' && this.selected.id === sk.id;
        const dr = Math.max(7.2, 9.2 * Math.min(1.35, this.zoom));

        ctx.save();
        ctx.fillStyle = isEq ? '#0C4A6E' : pos.unlocked ? '#172554' : pos.reachable ? '#0E223A' : '#0B111F';
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - dr);
        ctx.lineTo(pos.x + dr, pos.y);
        ctx.lineTo(pos.x, pos.y + dr);
        ctx.lineTo(pos.x - dr, pos.y);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = isSel ? 2.4 : isEq ? 2.1 : pos.unlocked ? 1.8 : 1.2;
        ctx.strokeStyle = isSel ? '#FFFFFF' : isEq ? '#4ADE80' : pos.unlocked ? '#38BDF8' : pos.reachable ? '#7DD3FC' : '#334155';
        ctx.stroke();

        // 内层鎏金细框
        const idr = dr * 0.72;
        ctx.strokeStyle = isEq ? 'rgba(74,222,128,0.55)' : pos.unlocked ? 'rgba(250,204,21,0.45)' : 'rgba(100,116,139,0.22)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - idr);
        ctx.lineTo(pos.x + idr, pos.y);
        ctx.lineTo(pos.x, pos.y + idr);
        ctx.lineTo(pos.x - idr, pos.y);
        ctx.closePath();
        ctx.stroke();

        drawSkillGlyph(ctx, STYLE_GLYPH[style], pos.x, pos.y, dr * 1.12, pos.unlocked ? '#7DD3FC' : '#64748B', THEME.GOLD_LIGHT, {
          dim: !pos.unlocked && !pos.reachable,
        });
        ctx.restore();

        if (isSel || isEq || (false && this.zoom >= 1.28)) {
          this.drawNodeLabel(ctx, sk.name.slice(0, 4), pos.x, pos.y + dr + (11 ), isEq ? '#4ADE80' : pos.unlocked ? '#7DD3FC' : THEME.TX3, isEq || isSel, false, 10.5 );
        }
        if (canHit(pos.x, pos.y)) {
          const hr = nodeHitR(dr);
          hits.add(pos.x - hr, pos.y - hr, hr * 2, hr * 2, () => {
            SoundEngine.playClick();
            this.selected = { kind: 'skill', id: sk.id };
            this.drawerOpen = true;
          });
        }
      }

      // 72 流派手牌（攻剑/守盾图标 + 3颗环绕卫星宝石）
      const styleDirs = V6_DIRECTIVES.filter(d => d.source === 'style' && d.style === style);
      for (const dir of styleDirs) {
        const pos = posMap.get(`directive:${dir.id}`);
        if (!pos) continue;
        const isEq = equippedPoolSet.has(dir.id);
        const isSel = this.selected.kind === 'directive' && this.selected.id === dir.id;
        const sats = ast.directiveSatellites[dir.id] ?? [];
        const nr = Math.max(5.2, 6.8 * Math.min(1.38, this.zoom));
        const subAngle = Math.atan2(pos.y - cy, pos.x - cx);

        ctx.save();
        ctx.fillStyle = pos.unlocked ? (isEq ? '#14532D' : '#1E293B') : pos.reachable ? '#101C32' : '#0B111F';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nr, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = isSel ? 2.4 : isEq ? 2.1 : pos.unlocked ? 1.6 : 1.1;
        ctx.strokeStyle = isSel ? '#FFFFFF' : isEq ? '#4ADE80' : pos.unlocked ? ZONE_COLOR[dir.zone] : pos.reachable ? '#38BDF8' : '#334155';
        ctx.stroke();

        drawIcon(
          ctx,
          dir.tendency === 'ATK' ? 'sword' : 'shield',
          pos.x,
          pos.y,
          nr * 1.15,
          pos.unlocked ? (isEq ? '#86EFAC' : ZONE_COLOR[dir.zone]) : pos.reachable ? '#7DD3FC' : '#475569'
        );

        (['A', 'B', 'C'] as V6SatelliteKey[]).forEach((sk, si) => {
          const sa = subAngle - 0.55 + si * 0.55;
          const sx = pos.x + Math.cos(sa) * (nr + 3.4);
          const sy = pos.y + Math.sin(sa) * (nr + 3.4);
          const lit = sats.includes(sk);
          ctx.fillStyle = lit ? (sk === 'C' ? THEME.GOLD_LIGHT : sk === 'B' ? '#38BDF8' : '#4ADE80') : 'rgba(100,116,139,0.35)';
          ctx.beginPath();
          ctx.arc(sx, sy, lit ? 2.1 : 1.2, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

        if (isSel || (false && this.zoom >= 1.55)) {
          this.drawNodeLabel(ctx, dir.name.slice(0, 4), pos.x, pos.y + nr + (11 ), isEq ? '#4ADE80' : pos.unlocked ? THEME.TX1 : THEME.TX3, isSel || isEq, false, 10.5 );
        }
        if (canHit(pos.x, pos.y)) {
          const hr = nodeHitR(nr);
          hits.add(pos.x - hr, pos.y - hr, hr * 2, hr * 2, () => {
            SoundEngine.playClick();
            this.selected = { kind: 'directive', id: dir.id };
            this.drawerOpen = true;
          });
        }
      }
    }

    // 3b. 第 3 层：6 个当前正对的【防线×流派融合奇点】（双层鎏金六角星槽 + fusion 高清雕纹）
    for (const al of aligned) {
      const pos = posMap.get(`fusion:${al.fusion.id}`);
      if (!pos) continue;
      const isSel = this.selected.kind === 'fusion' && this.selected.id === al.fusion.id;
      const r = Math.max(9.5, 12.2 * Math.min(1.3, this.zoom));

      ctx.save();
      ctx.fillStyle = pos.unlocked ? '#422006' : pos.reachable ? '#1C1917' : '#0F172A';
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const ha = (h * Math.PI) / 3 - Math.PI / 6;
        const hx = pos.x + Math.cos(ha) * r;
        const hy = pos.y + Math.sin(ha) * r;
        if (h === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = isSel ? 2.6 : pos.unlocked ? 2.3 : 1.5;
      ctx.strokeStyle = isSel ? '#FFFFFF' : pos.unlocked ? '#FEF08A' : pos.reachable ? '#F59E0B' : ast.locked ? '#64748B' : '#38BDF8';
      ctx.stroke();

      if (pos.unlocked || pos.reachable) {
        ctx.strokeStyle = pos.unlocked ? 'rgba(254,240,138,0.65)' : 'rgba(245,158,11,0.5)';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 3.5, -rotSlow, -rotSlow + Math.PI * 1.4);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      drawSkillGlyph(ctx, 'fusion', pos.x, pos.y, r * 1.38, pos.unlocked ? THEME.BRASS : THEME.LIME, THEME.PAPER_CREAM, {
        dim: !pos.unlocked && !pos.reachable,
        vectorOnly: true,
      });
      ctx.restore();

      if (!isBeginnerMode || !isMacro || al.style === club.style || pos.unlocked) {
        this.drawNodeLabel(ctx, al.fusion.name.slice(0, 5), pos.x, pos.y + r + (12 ), pos.unlocked ? THEME.GOLD_LIGHT : pos.reachable ? '#FDE68A' : '#94A3B8', true, false, 11 );
      }
      if (canHit(pos.x, pos.y)) {
        const hr = nodeHitR(r, 6);
        hits.add(pos.x - hr, pos.y - hr, hr * 2, hr * 2, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'fusion', id: al.fusion.id };
          this.drawerOpen = true;
        });
      }
    }

    // 3c. 第 2 层：内环 12 个防线体系被动 + 16 阵型节点（宏观罗盘仅绘三大防线原点与当前阵型，消除拥挤）
    for (const sp of V6_SYSTEM_PASSIVES) {
      const pos = posMap.get(`passive:${sp.id}`);
      if (!pos || !sp.system) continue;
      const isOrigin = sp.tier === 'origin';
      if (isMacro && !isOrigin) continue;
      const isSel = this.selected.kind === 'passive' && this.selected.id === sp.id;
      const sysCol = SYSTEM_LABELS[sp.system].color;
      const r = isOrigin ? (isMacro ? 14 : Math.max(8, 10.2 * Math.min(1.28, this.zoom))) : Math.max(5.2, 6.4 * Math.min(1.28, this.zoom));

      ctx.save();
      ctx.fillStyle = pos.unlocked ? THEME.BG_PITCH_ALT : THEME.BG_DEEP;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = isSel ? 2.6 : isOrigin ? 2.2 : 1.6;
      ctx.strokeStyle = isSel ? THEME.PAPER_CREAM : pos.unlocked ? THEME.BRASS : pos.reachable ? THEME.LIME : THEME.INK_LINE;
      ctx.stroke();

      drawSkillGlyph(ctx, getPassiveStatGlyph(sp), pos.x, pos.y, r * (isOrigin ? 1.42 : 1.24), pos.unlocked ? THEME.BRASS : THEME.TX3, THEME.LIME, {
        dim: !pos.unlocked && !pos.reachable,
        vectorOnly: true,
      });
      ctx.restore();

      if (isOrigin || isSel || (false && this.zoom >= 1.45)) {
        const lblText = isOrigin ? SYSTEM_LABELS[sp.system].name.slice(0, 3) : sp.name.slice(0, 4);
        this.drawNodeLabel(ctx, lblText, pos.x, pos.y + r + (11 ), pos.unlocked ? sysCol : THEME.TX3, isOrigin || isSel, false, 10.5 );
      }
      if (canHit(pos.x, pos.y)) {
        const hr = nodeHitR(r);
        hits.add(pos.x - hr, pos.y - hr, hr * 2, hr * 2, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'passive', id: sp.id };
          this.drawerOpen = true;
        });
      }
    }

    for (const sys of INNER_RING_SYSTEMS) {
      const sysCol = SYSTEM_LABELS[sys].color;
      for (const fm of SYSTEM_FORMATIONS[sys]) {
        const pos = posMap.get(`formation:${fm}`);
        if (!pos) continue;
        const isCurFm = club.formation === fm;
        if (isMacro && !isCurFm) continue;
        const isSel = this.selected.kind === 'formation' && this.selected.formation === fm;
        const r = Math.max(6.2, 7.8 * Math.min(1.28, this.zoom));

        ctx.save();
        ctx.fillStyle = isCurFm ? '#064E3B' : pos.unlocked ? '#16243E' : '#0F172A';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = isSel ? 2.4 : isCurFm ? 2.1 : 1.3;
        ctx.strokeStyle = isSel ? '#FFFFFF' : isCurFm ? THEME.GREEN : pos.unlocked ? sysCol : '#475569';
        ctx.stroke();
        ctx.restore();

        if (this.zoom >= 0.95 || isCurFm || isSel) {
          this.drawNodeLabel(ctx, fm, pos.x, pos.y + r + (11 ), isCurFm ? THEME.GREEN : pos.unlocked ? '#E2E8F0' : '#94A3B8', isCurFm || isSel, true, 10.5 );
        }
        if (canHit(pos.x, pos.y)) {
          const hr = nodeHitR(r, 5);
          hits.add(pos.x - hr, pos.y - hr, hr * 2, hr * 2, () => {
            SoundEngine.playClick();
            this.selected = { kind: 'formation', formation: fm };
            this.drawerOpen = true;
          });
        }
      }
    }

    // 3d. 第 1 层：6 个流派宗师大节点（双环金属槽 + 流派高清雕纹）
    for (const seal of V6_MASTERY_SEALS) {
      const pos = posMap.get(`seal:${seal.id}`);
      if (!pos) continue;
      const isSel = this.selected.kind === 'seal' && this.selected.id === seal.id;
      const sCol = STYLE_LABELS[seal.style].color;
      const r = Math.max(9.5, 11.8 * Math.min(1.25, this.zoom));

      ctx.save();
      ctx.fillStyle = pos.unlocked ? '#3F2D0E' : pos.reachable ? THEME.BG_CARD_DARK : THEME.BG_DEEP;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = isSel ? 2.6 : pos.unlocked ? 2.3 : 1.6;
      ctx.strokeStyle = isSel ? THEME.PAPER_CREAM : pos.unlocked ? THEME.BRASS : pos.reachable ? THEME.LIME : THEME.INK_LINE;
      ctx.stroke();

      drawSkillGlyph(ctx, STYLE_GLYPH[seal.style], pos.x, pos.y, r * 1.38, pos.unlocked ? THEME.BRASS : THEME.TX3, THEME.LIME, {
        dim: !pos.unlocked && !pos.reachable,
        vectorOnly: true,
      });
      ctx.restore();

      if (canHit(pos.x, pos.y)) {
        const hr = nodeHitR(r, 5);
        hits.add(pos.x - hr, pos.y - hr, hr * 2, hr * 2, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'seal', id: seal.id };
          this.drawerOpen = true;
        });
      }
    }

    // 3e. 圆心：★ 超级宗师 · 全攻全守（主权皇冠高清雕纹 + 旋转星环）
    const coreCheck = canUnlockCore(ast);
    const coreR = Math.max(16, 20.5 * Math.min(1.25, this.zoom));
    const coreSel = this.selected.kind === 'core';
    const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 2.8);
    ctx.save();
    ctx.fillStyle = ast.coreUnlocked ? '#3F2D0E' : THEME.PAPER_CREAM;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = coreSel ? THEME.LIME : THEME.INK_LINE;
    ctx.stroke();

    ctx.strokeStyle = ast.coreUnlocked ? THEME.BRASS : 'rgba(216, 168, 66, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, coreR + 4.5, rotSlow, rotSlow + Math.PI * 1.65);
    ctx.stroke();
    ctx.setLineDash([]);

    drawSkillGlyph(ctx, 'master', cx, cy, coreR * 1.35, ast.coreUnlocked ? THEME.BRASS : THEME.BG_PANEL, THEME.VERMILION, {
      dim: false,
      vectorOnly: true,
    });
    ctx.restore();

    if (canHit(cx, cy)) {
      hits.add(cx - coreR - 6, cy - coreR - 6, (coreR + 6) * 2, (coreR + 6) * 2, () => {
        SoundEngine.playClick();
        this.selected = { kind: 'core' };
        this.drawerOpen = true;
      });
    }

    ctx.restore();
  }

  private renderInspectorDrawer(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    mapX: number,
    mapY: number,
    mapW: number,
    mapH: number,
    actions: { onSave: () => void }
  ): void {
    const dw = 408;
    const dh = mapH - 20;
    const dx = mapX + mapW - dw - 10;
    const dy = mapY + 10;
    this.lastDrawerRect = { x: dx, y: dy, w: dw, h: dh };

    drawPrintCard(ctx, dx, dy, dw, dh, { paper: false, radius: 12, shadowOffset: 6, strokeColor: THEME.BORDER_GOLD, lineWidth: 1.8 });
    hits.add(dx, dy, dw, dh, () => {});

    drawButton(ctx, hits, dx + dw - 62, dy + 12, 48, 26, '关闭', () => {
      this.drawerOpen = false;
    }, { variant: 'ghost', fontSize: 12 });

    const sel = this.selected;
    if (sel.kind === 'passive') {
      this.renderPassiveInspector(ctx, hits, league, sel.id, dx, dy, dw, dh, actions);
    } else if (sel.kind === 'directive') {
      this.renderDirectiveInspector(ctx, hits, league, sel.id, dx, dy, dw, dh, actions);
    } else if (sel.kind === 'skill') {
      this.renderSkillInspector(ctx, hits, league, sel.id, dx, dy, dw, dh, actions);
    } else if (sel.kind === 'fusion') {
      this.renderFusionInspector(ctx, hits, league, sel.id, dx, dy, dw, dh, actions);
    } else if (sel.kind === 'formation') {
      this.renderFormationInspector(ctx, hits, league, sel.formation, dx, dy, dw, dh, actions);
    } else if (sel.kind === 'seal') {
      this.renderSealInspector(ctx, hits, league, sel.id, dx, dy, dw, dh, actions);
    } else if (sel.kind === 'core') {
      this.renderCoreInspector(ctx, hits, league, dx, dy, dw, dh, actions);
    } else if (sel.kind === 'catalog_directives') {
      this.renderDirectiveCatalog(ctx, hits, league, dx, dy, dw, dh);
    } else if (sel.kind === 'catalog_skills') {
      this.renderSkillCatalog(ctx, hits, league, dx, dy, dw, dh);
    }
  }

  private renderPassiveInspector(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    passiveId: string,
    dx: number,
    dy: number,
    dw: number,
    _dh: number,
    actions: { onSave: () => void }
  ): void {
    const p = V6_PASSIVE_MAP[passiveId];
    if (!p) return;
    const ast = league.getV6Astrolabe();
    const pt = league.getState().metaPointsTotal;
    const unlocked = ast.unlockedPassives.includes(passiveId);
    const prereq = canUnlockV6Node(ast, 'passive', passiveId);
    const accent = p.style ? STYLE_LABELS[p.style].color : p.system ? SYSTEM_LABELS[p.system].color : '#38BDF8';
    const tierLabel = p.tier === 'origin' ? '星盘原点' : p.tier === 'rare' ? '稀有被动' : '数值被动';

    drawBadge(ctx, dx + 16, dy + 14, 78, 22, tierLabel, '#0F172A', accent);
    drawBadge(ctx, dx + 100, dy + 14, 62, 22, p.tendency === 'ATK' ? '进攻线' : '防守线', '#1E293B', p.tendency === 'ATK' ? '#FB7185' : '#4ADE80');

    drawText(ctx, p.name, dx + 16, dy + 54, { size: 19, bold: true, color: THEME.TX1 });
    drawText(
      ctx,
      p.source === 'style' && p.style
        ? `${STYLE_LABELS[p.style].name} · 永久生效数值节点`
        : p.source === 'system' && p.system
        ? `${SYSTEM_LABELS[p.system].name} · 使用该防线体系时生效`
        : `${p.formation} 阵型专精被动`,
      dx + 16,
      dy + 76,
      { size: 12, color: THEME.TX2 }
    );

    drawRoundRect(ctx, dx + 16, dy + 94, dw - 32, 74, 8, 'rgba(20, 83, 45, 0.25)', accent, 1.3);
    drawText(ctx, '永久数值 / 机制增益', dx + 26, dy + 112, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawWrappedText(ctx, p.desc, dx + 26, dy + 132, dw - 52, 18, { size: 12.5, color: THEME.TX1, maxLines: 2 });

    // 前置连线状态卡
    drawRoundRect(ctx, dx + 16, dy + 180, dw - 32, 58, 8, THEME.BG_CARD, unlocked || prereq.ok ? THEME.GREEN : '#F59E0B');
    drawWrappedText(
      ctx,
      unlocked
        ? '✓ 该数值节点已点亮，并已向后续连线节点导通星轨！'
        : prereq.ok
        ? '✓ 前置星轨已连通，可立即点亮此节点。'
        : `🔒 ${prereq.reason}`,
      dx + 26,
      dy + 194,
      dw - 52,
      16,
      { size: 12, color: unlocked || prereq.ok ? THEME.GREEN : '#FBBF24', maxLines: 2 }
    );

    if (!unlocked) {
      const canBuy = prereq.ok && pt >= p.unlockCost;
      drawButton(
        ctx,
        hits,
        dx + 16,
        dy + 252,
        dw - 32,
        40,
        !prereq.ok ? '前置连线未点亮' : pt >= p.unlockCost ? `点亮数值被动 (消耗 ${p.unlockCost}pt)` : `点数不足 (需要 ${p.unlockCost}pt)`,
        () => {
          const r = league.unlockV6Passive(passiveId);
          if (r.ok) {
            SoundEngine.playGoalCheer();
            this.notice = `已点亮数值被动【${p.name}】！`;
            actions.onSave();
          } else {
            SoundEngine.playWarning();
            this.notice = r.reason || '无法解锁';
          }
        },
        { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 12.5 }
      );

      if (prereq.missing.length > 0) {
        const firstMissing = prereq.missing[0];
        drawButton(ctx, hits, dx + 16, dy + 302, dw - 32, 32, `定位前置节点：【${firstMissing.label}】 ▶`, () => {
          SoundEngine.playClick();
          this.selected = { kind: firstMissing.kind, id: firstMissing.id };
        }, { variant: 'primary', fontSize: 12 });
      }
    } else {
      drawBadge(ctx, dx + 16, dy + 252, dw - 32, 36, '数值被动已永久激活 ✓', '#14532D', THEME.GREEN);
    }
  }

  private renderDirectiveInspector(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    dirId: string,
    dx: number,
    dy: number,
    dw: number,
    _dh: number,
    actions: { onSave: () => void }
  ): void {
    const def = V6_DIRECTIVE_MAP[dirId];
    if (!def) return;
    const ast = league.getV6Astrolabe();
    const pt = league.getState().metaPointsTotal;
    const unlocked = ast.unlockedDirectives.includes(dirId);
    const prereq = canUnlockV6Node(ast, 'directive', dirId);
    const sats = ast.directiveSatellites[dirId] ?? [];
    const pool = ast.checkpointPools[this.activeCheckpoint] ?? [];
    const equipped = pool.includes(dirId);
    const zCol = ZONE_COLOR[def.zone];

    drawBadge(ctx, dx + 16, dy + 14, 62, 22, `${ZONE_LABEL[def.zone]}·${def.tendency === 'ATK' ? '攻' : '守'}`, '#0F172A', zCol);
    drawBadge(ctx, dx + 84, dy + 14, 48, 22, `${def.tpCost} TP`, '#78350F', THEME.GOLD_LIGHT);
    drawBadge(ctx, dx + 138, dy + 14, 64, 22, `${def.durationMinutes} 分钟`, '#1E293B', '#7DD3FC');

    drawText(ctx, def.name, dx + 16, dy + 52, { size: 18.5, bold: true, color: THEME.TX1 });
    drawText(
      ctx,
      def.source === 'style' && def.style
        ? `${STYLE_LABELS[def.style].name} · ${def.route === 'steady' ? '稳健路线' : '赌博爆发'}`
        : def.source === 'formation'
        ? `阵型专属 · ${def.formation}`
        : '融合奇点王牌手牌',
      dx + 16,
      dy + 72,
      { size: 12, color: THEME.TX2 }
    );

    drawRoundRect(ctx, dx + 16, dy + 86, dw - 32, 44, 7, 'rgba(20, 83, 45, 0.28)', 'rgba(34, 197, 94, 0.5)');
    drawText(ctx, '收益', dx + 26, dy + 108, { size: 12, bold: true, color: THEME.GREEN });
    drawWrappedText(ctx, def.benefitSummary, dx + 62, dy + 94, dw - 88, 15, { size: 12, color: THEME.TX1, maxLines: 2 });

    drawRoundRect(ctx, dx + 16, dy + 135, dw - 32, 44, 7, 'rgba(127, 29, 29, 0.28)', 'rgba(248, 113, 113, 0.5)');
    drawText(ctx, '代价', dx + 26, dy + 157, { size: 12, bold: true, color: '#FCA5A5' });
    drawWrappedText(ctx, def.riskSummary, dx + 62, dy + 143, dw - 88, 15, { size: 12, color: '#FECACA', maxLines: 2 });

    if (!unlocked) {
      if (!prereq.ok) {
        drawText(ctx, fitText(ctx, `🔒 ${prereq.reason}`, dw - 32, 10.5), dx + 16, dy + 191, { size: 12, color: '#FBBF24' });
      }
      const canBuy = prereq.ok && pt >= def.unlockCost;
      drawButton(
        ctx,
        hits,
        dx + 16,
        dy + 202,
        dw - 32,
        34,
        !prereq.ok ? '需先点亮前置连线节点' : pt >= def.unlockCost ? `点亮手牌 (消耗 ${def.unlockCost}pt)` : `点数不足 (需要 ${def.unlockCost}pt)`,
        () => {
          const r = league.unlockV6Directive(dirId);
          if (r.ok) {
            SoundEngine.playGoalCheer();
            this.notice = `已解锁手牌【${def.name}】！`;
            actions.onSave();
          } else {
            SoundEngine.playWarning();
            this.notice = r.reason || '解锁失败';
          }
        },
        { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 12 }
      );
    } else {
      const cpLbl = ast.useUniversalPool ? '通用指令池' : `${this.activeCheckpoint.slice(1)}' 拐点池`;
      drawButton(
        ctx,
        hits,
        dx + 16,
        dy + 196,
        dw - 32,
        36,
        equipped ? `已编入 ${cpLbl} (${pool.length}/4) · 点击移出` : `编入 ${cpLbl} (${pool.length}/4)`,
        () => {
          const r = league.toggleV6CheckpointCard(this.activeCheckpoint, dirId);
          if (r.ok) {
            SoundEngine.playClick();
            this.notice = r.equipped ? `已将【${def.name}】编入${cpLbl}` : `已从${cpLbl}移出【${def.name}】`;
            actions.onSave();
          } else {
            SoundEngine.playWarning();
            this.notice = r.reason || '操作失败';
          }
        },
        { variant: equipped ? 'green' : 'primary', fontSize: 12 }
      );
    }

    drawText(ctx, `卫星质变节点 (${sats.length}/3 · 满 3 颗计入宗师印前置)`, dx + 16, dy + 252, {
      size: 12,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });

    (['A', 'B', 'C'] as V6SatelliteKey[]).forEach((sk, idx) => {
      const sDef = def.satellites[sk];
      const sy = dy + 266 + idx * 78;
      const isLit = sats.includes(sk);
      const canBuy = unlocked && !isLit && pt >= sDef.cost;
      const sCol = sk === 'C' ? THEME.GOLD_LIGHT : sk === 'B' ? '#38BDF8' : '#4ADE80';
      drawRoundRect(ctx, dx + 16, sy, dw - 32, 70, 7, isLit ? 'rgba(20, 83, 45, 0.28)' : THEME.BG_CARD, isLit ? sCol : THEME.BORDER);
      drawBadge(ctx, dx + 24, sy + 10, 42, 18, `卫星${sk}`, '#0F172A', sCol);
      drawText(ctx, sDef.label, dx + 72, sy + 19, { size: 12, bold: true, color: isLit ? sCol : THEME.TX1 });
      drawWrappedText(ctx, sDef.desc, dx + 24, sy + 34, dw - 134, 15, { size: 12, color: THEME.TX2, maxLines: 2 });

      if (isLit) {
        drawBadge(ctx, dx + dw - 86, sy + 22, 62, 24, '已点亮 ✓', '#14532D', THEME.GREEN);
      } else {
        drawButton(ctx, hits, dx + dw - 96, sy + 20, 72, 28, `${sDef.cost}pt 点亮`, () => {
          const r = league.unlockV6DirectiveSatellite(dirId, sk);
          if (r.ok) {
            SoundEngine.playGoalCheer();
            this.notice = `已点亮【${def.name}】卫星 ${sk}：${sDef.label}`;
            actions.onSave();
          } else {
            this.notice = r.reason || '无法点亮';
          }
        }, { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 12 });
      }
    });
  }

  private renderSkillInspector(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    skillId: string,
    dx: number,
    dy: number,
    dw: number,
    _dh: number,
    actions: { onSave: () => void }
  ): void {
    const sk = V6_ACTIVE_SKILL_MAP[skillId];
    if (!sk) return;
    const ast = league.getV6Astrolabe();
    const pt = league.getState().metaPointsTotal;
    const unlocked = ast.unlockedSkills.includes(skillId);
    const prereq = canUnlockV6Node(ast, 'skill', skillId);
    const equipped = ast.equippedSkills.includes(skillId);
    const curBranch = ast.skillBranchChoice[skillId] ?? 'A';

    drawBadge(ctx, dx + 16, dy + 14, 126, 22, 'F键子弹时间主动技', '#0C4A6E', '#38BDF8');
    drawBadge(ctx, dx + 148, dy + 14, 72, 22, `CD ${sk.cooldownMinutes}分`, '#1E293B', THEME.GOLD_LIGHT);

    drawText(ctx, sk.name, dx + 16, dy + 54, { size: 19, bold: true, color: '#7DD3FC' });
    drawText(ctx, `触发时机：${sk.situationLabel} · 每场限 ${sk.maxPerMatch} 次`, dx + 16, dy + 76, { size: 12, color: THEME.TX2 });

    drawRoundRect(ctx, dx + 16, dy + 94, dw - 32, 66, 8, 'rgba(12, 74, 110, 0.30)', 'rgba(56, 189, 248, 0.45)');
    drawText(ctx, `⚡ 物理瞬发：${sk.instantLabel}`, dx + 26, dy + 112, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawWrappedText(ctx, `${sk.powerLabel}（持续 ${sk.durationMinutes} 分钟）`, dx + 26, dy + 132, dw - 52, 16, {
      size: 12,
      color: THEME.TX1,
      maxLines: 2,
    });

    if (!unlocked) {
      const isSpecial = sk.source === 'mastery' || sk.source === 'core';
      if (!isSpecial && !prereq.ok) {
        drawText(ctx, fitText(ctx, `🔒 ${prereq.reason}`, dw - 32, 10.5), dx + 16, dy + 170, { size: 12, color: '#FBBF24' });
      }
      const canBuy = !isSpecial && prereq.ok && pt >= sk.unlockCost;
      drawButton(
        ctx,
        hits,
        dx + 16,
        dy + 182,
        dw - 32,
        36,
        isSpecial
          ? '请点亮对应宗师印或圆心解锁'
          : !prereq.ok
          ? '前置连线未点亮'
          : pt >= sk.unlockCost
          ? `点亮主动技 (消耗 ${sk.unlockCost}pt)`
          : `点数不足 (需要 ${sk.unlockCost}pt)`,
        () => {
          const r = league.unlockV6Skill(skillId);
          if (r.ok) {
            SoundEngine.playGoalCheer();
            this.notice = `已解锁主动技【${sk.name}】！`;
            actions.onSave();
          } else {
            SoundEngine.playWarning();
            this.notice = r.reason || '无法解锁';
          }
        },
        { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 12 }
      );
    } else {
      drawButton(
        ctx,
        hits,
        dx + 16,
        dy + 176,
        dw - 32,
        38,
        equipped ? `已装配至 F 键 (${ast.equippedSkills.length}/4) · 点击卸下` : `装配至 F 键槽位 (${ast.equippedSkills.length}/4)`,
        () => {
          const r = league.toggleV6EquippedSkill(skillId);
          if (r.ok) {
            SoundEngine.playClick();
            this.notice = r.equipped ? `已装配主动技【${sk.name}】` : `已卸下主动技【${sk.name}】`;
            actions.onSave();
          } else {
            SoundEngine.playWarning();
            this.notice = r.reason || '操作失败';
          }
        },
        { variant: equipped ? 'green' : 'primary', fontSize: 12 }
      );
    }

    drawText(ctx, 'A / B 互斥质变分支（解锁后可随时免费切换）', dx + 16, dy + 234, {
      size: 12,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });

    ([['A', sk.branchA], ['B', sk.branchB]] as const).forEach(([ch, br], idx) => {
      const by = dy + 250 + idx * 84;
      const chosen = unlocked && curBranch === ch;
      drawRoundRect(ctx, dx + 16, by, dw - 32, 74, 8, chosen ? 'rgba(6, 78, 59, 0.45)' : THEME.BG_CARD, chosen ? THEME.GREEN : THEME.BORDER, chosen ? 1.6 : 1);
      drawText(ctx, `分支 ${ch} · ${br.label}`, dx + 26, by + 18, { size: 12.5, bold: true, color: chosen ? THEME.GREEN : THEME.TX1 });
      drawText(ctx, chosen ? '生效中 ✓' : unlocked ? '点击切换' : '解锁可用', dx + dw - 26, by + 18, {
        size: 12,
        color: chosen ? THEME.GREEN : THEME.TX3,
        align: 'right',
      });
      drawWrappedText(ctx, br.desc, dx + 26, by + 38, dw - 52, 16, { size: 12, color: THEME.TX2, maxLines: 2 });
      if (unlocked && !chosen) {
        hits.add(dx + 16, by, dw - 32, 74, () => {
          league.setV6SkillBranch(skillId, ch);
          SoundEngine.playClick();
          this.notice = `【${sk.name}】已切换为分支 ${ch}：${br.label}`;
          actions.onSave();
        });
      }
    });
  }

  private renderFusionInspector(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    fusionId: string,
    dx: number,
    dy: number,
    dw: number,
    _dh: number,
    actions: { onSave: () => void }
  ): void {
    const f = V6_FUSION_MAP[fusionId];
    if (!f) return;
    const ast = league.getV6Astrolabe();
    const pt = league.getState().metaPointsTotal;
    const unlocked = ast.unlockedFusions.includes(fusionId);
    const prereq = canUnlockV6Node(ast, 'fusion', fusionId);
    const curBr = ast.fusionBranchChoice[fusionId] ?? 'A';
    const royalDir = V6_DIRECTIVE_MAP[f.royalDirectiveId];

    drawBadge(ctx, dx + 16, dy + 14, 150, 22, `${SYSTEM_LABELS[f.system].name} × ${STYLE_LABELS[f.style].short}`, '#78350F', THEME.GOLD_LIGHT);
    drawText(ctx, f.name, dx + 16, dy + 54, { size: 19, bold: true, color: THEME.GOLD_LIGHT });
    drawText(
      ctx,
      unlocked
        ? '融合奇点已激活 · 规则级质变生效中'
        : prereq.ok
        ? '星轨双桥已连通 · 可点亮此融合奇点'
        : fitText(ctx, `🔒 ${prereq.reason}`, dw - 32, 11),
      dx + 16,
      dy + 76,
      { size: 12, color: unlocked || prereq.ok ? THEME.GREEN : '#FBBF24' }
    );

    if (!unlocked) {
      const canBuy = prereq.ok && pt >= f.unlockCost;
      drawButton(
        ctx,
        hits,
        dx + 16,
        dy + 96,
        dw - 32,
        36,
        !prereq.ok ? '前置条件未满足' : pt >= f.unlockCost ? `点亮融合奇点 (消耗 ${f.unlockCost}pt)` : `点数不足 (需要 ${f.unlockCost}pt)`,
        () => {
          const r = league.unlockV6Fusion(fusionId);
          if (r.ok) {
            SoundEngine.playGoalCheer();
            this.notice = `已点亮融合奇点【${f.name}】！`;
            actions.onSave();
          } else {
            SoundEngine.playWarning();
            this.notice = r.reason || '无法解锁';
          }
        },
        { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 12 }
      );
    } else {
      drawBadge(ctx, dx + 16, dy + 96, dw - 32, 32, '融合奇点已激活 · 下方自由切换 A/B 规则分支 ✓', '#14532D', THEME.GREEN);
    }

    ([['A', f.branchA], ['B', f.branchB]] as const).forEach(([ch, br], idx) => {
      const by = dy + 142 + idx * 96;
      const chosen = unlocked && curBr === ch;
      drawRoundRect(ctx, dx + 16, by, dw - 32, 86, 8, chosen ? 'rgba(120, 53, 15, 0.36)' : THEME.BG_CARD, chosen ? THEME.GOLD_LIGHT : THEME.BORDER, chosen ? 1.6 : 1);
      drawText(ctx, `奇点分支 ${ch} · ${br.label}`, dx + 26, by + 18, { size: 12.5, bold: true, color: chosen ? THEME.GOLD_LIGHT : THEME.TX1 });
      drawText(ctx, chosen ? '生效中 ✓' : unlocked ? '点击切换' : '', dx + dw - 26, by + 18, {
        size: 12,
        color: THEME.GREEN,
        align: 'right',
      });
      drawWrappedText(ctx, br.desc, dx + 26, by + 36, dw - 52, 16, { size: 12, color: THEME.TX2, maxLines: 3 });
      if (unlocked && !chosen) {
        hits.add(dx + 16, by, dw - 32, 86, () => {
          league.setV6FusionBranch(fusionId, ch);
          SoundEngine.playClick();
          this.notice = `奇点【${f.name}】切换至分支 ${ch}：${br.label}`;
          actions.onSave();
        });
      }
    });

    if (royalDir) {
      const ry = dy + 350;
      drawRoundRect(ctx, dx + 16, ry, dw - 32, 92, 8, 'rgba(30, 27, 75, 0.45)', '#A855F7');
      drawText(ctx, `👑 伴生王牌手牌（3 TP）：${royalDir.name}`, dx + 26, ry + 20, { size: 12.5, bold: true, color: '#E9D5FF' });
      drawWrappedText(ctx, `收益：${royalDir.benefitSummary}`, dx + 26, ry + 38, dw - 52, 15, { size: 12, color: THEME.GREEN, maxLines: 1 });
      drawButton(ctx, hits, dx + 26, ry + 56, dw - 52, 28, '查看并解锁/装配此王牌手牌 ▶', () => {
        this.selected = { kind: 'directive', id: royalDir.id };
      }, { variant: 'primary', fontSize: 12 });
    }
  }

  private renderFormationInspector(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    fm: FormationName,
    dx: number,
    dy: number,
    dw: number,
    _dh: number,
    actions: { onSave: () => void }
  ): void {
    const ast = league.getV6Astrolabe();
    const pt = league.getState().metaPointsTotal;
    const passives = V6_ALL_PASSIVES.filter(p => p.source === 'formation' && p.formation === fm);
    const dirs = V6_DIRECTIVES.filter(d => d.source === 'formation' && d.formation === fm);
    const sk = V6_ACTIVE_SKILLS.find(s => s.source === 'formation' && s.formation === fm);

    drawBadge(ctx, dx + 16, dy + 14, 118, 22, `阵型专精 · ${fm}`, '#1E3A5F', THEME.GOLD_LIGHT);
    drawText(ctx, `${fm} 专属星盘节点`, dx + 16, dy + 52, { size: 18, bold: true, color: THEME.TX1 });

    let cy = dy + 74;
    drawText(ctx, '阵型被动 (2 个 · 需先点亮对应防线体系原点)', dx + 16, cy, { size: 12, bold: true, color: '#7DD3FC' });
    cy += 12;
    passives.forEach(p => {
      const unl = ast.unlockedPassives.includes(p.id);
      const pre = canUnlockV6Node(ast, 'passive', p.id);
      const canBuy = !unl && pre.ok && pt >= p.unlockCost;
      drawRoundRect(ctx, dx + 16, cy, dw - 32, 52, 7, unl ? 'rgba(20,83,45,0.28)' : THEME.BG_CARD, unl ? THEME.GREEN : THEME.BORDER);
      drawText(ctx, p.name, dx + 26, cy + 16, { size: 12, bold: true, color: unl ? THEME.GREEN : THEME.TX1 });
      drawWrappedText(ctx, p.desc, dx + 26, cy + 30, dw - 122, 14, { size: 12, color: THEME.TX2, maxLines: 1 });
      if (!unl) {
        drawButton(ctx, hits, dx + dw - 92, cy + 12, 68, 28, pre.ok ? `${p.unlockCost}pt` : '未连通', () => {
          const r = league.unlockV6Passive(p.id);
          if (r.ok) {
            SoundEngine.playClick();
            this.notice = `已解锁阵型被动【${p.name}】`;
            actions.onSave();
          } else {
            SoundEngine.playWarning();
            this.notice = r.reason || '无法解锁';
          }
        }, { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 12 });
      }
      cy += 58;
    });

    cy += 6;
    drawText(ctx, '阵型专属手牌 (1攻 + 1守 · 需先点亮对应攻/守被动)', dx + 16, cy, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    cy += 12;
    dirs.forEach(d => {
      const unl = ast.unlockedDirectives.includes(d.id);
      drawRoundRect(ctx, dx + 16, cy, dw - 32, 54, 7, THEME.BG_CARD, ZONE_COLOR[d.zone]);
      drawText(ctx, `${d.name} (${d.tpCost}TP·${d.tendency === 'ATK' ? '攻' : '守'})`, dx + 26, cy + 16, { size: 12, bold: true, color: THEME.TX1 });
      drawText(ctx, fitText(ctx, d.benefitSummary, dw - 126, 10), dx + 26, cy + 36, { size: 12, color: THEME.GREEN });
      drawButton(ctx, hits, dx + dw - 92, cy + 13, 68, 28, unl ? '配装/卫星' : '详情 ▶', () => {
        this.selected = { kind: 'directive', id: d.id };
      }, { variant: 'primary', fontSize: 12 });
      cy += 60;
    });

    if (sk) {
      cy += 6;
      drawText(ctx, '阵型专属主动技 (点亮任一阵型被动后可解锁)', dx + 16, cy, { size: 12, bold: true, color: '#38BDF8' });
      cy += 12;
      drawRoundRect(ctx, dx + 16, cy, dw - 32, 60, 7, 'rgba(12, 74, 110, 0.30)', '#38BDF8');
      drawText(ctx, sk.name, dx + 26, cy + 18, { size: 12, bold: true, color: '#7DD3FC' });
      drawText(ctx, fitText(ctx, sk.instantLabel, dw - 126, 10), dx + 26, cy + 40, { size: 12, color: THEME.GOLD_LIGHT });
      drawButton(ctx, hits, dx + dw - 92, cy + 16, 68, 28, '详情 ▶', () => {
        this.selected = { kind: 'skill', id: sk.id };
      }, { variant: 'primary', fontSize: 12 });
    }
  }

  private renderSealInspector(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    sealId: string,
    dx: number,
    dy: number,
    dw: number,
    _dh: number,
    actions: { onSave: () => void }
  ): void {
    const seal = V6_MASTERY_SEAL_MAP[sealId];
    if (!seal) return;
    const ast = league.getV6Astrolabe();
    const pt = league.getState().metaPointsTotal;
    const unlocked = ast.unlockedMasterySeals.includes(sealId);
    const prereq = canUnlockMasterySeal(ast, seal.style);
    const ult = V6_ACTIVE_SKILL_MAP[seal.activeSkillId];

    drawBadge(ctx, dx + 16, dy + 14, 116, 22, '宗师大节点 · 宗师印', '#78350F', THEME.GOLD_LIGHT);
    drawText(ctx, seal.name, dx + 16, dy + 54, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    drawWrappedText(ctx, seal.desc, dx + 16, dy + 82, dw - 32, 18, { size: 12, color: THEME.TX1, maxLines: 3 });

    drawRoundRect(ctx, dx + 16, dy + 148, dw - 32, 54, 8, THEME.BG_CARD, prereq.ok ? THEME.GREEN : THEME.BORDER);
    drawWrappedText(
      ctx,
      prereq.ok ? '✓ 前置条件已达成，可随时点亮本流派宗师印！' : `前置要求：${prereq.reason}`,
      dx + 26,
      dy + 160,
      dw - 52,
      16,
      { size: 12, color: prereq.ok ? THEME.GREEN : '#FBBF24', maxLines: 2 }
    );

    if (!unlocked) {
      const canBuy = prereq.ok && pt >= seal.unlockCost;
      drawButton(ctx, hits, dx + 16, dy + 214, dw - 32, 40, `点亮宗师印 (消耗 ${seal.unlockCost}pt)`, () => {
        const r = league.unlockV6MasterySeal(sealId);
        if (r.ok) {
          SoundEngine.playGoalCheer();
          this.notice = `宗师印【${seal.name}】已点亮！同时解锁宗师终极主动技！`;
          actions.onSave();
        } else {
          this.notice = r.reason || '无法解锁';
        }
      }, { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 13 });
    } else {
      drawBadge(ctx, dx + 16, dy + 214, dw - 32, 36, '宗师印已永久激活 ✓', '#14532D', THEME.GREEN);
    }

    if (ult) {
      drawRoundRect(ctx, dx + 16, dy + 270, dw - 32, 102, 8, 'rgba(12, 74, 110, 0.35)', '#38BDF8');
      drawText(ctx, `⚡ 伴生终极主动技：${ult.name}`, dx + 26, dy + 290, { size: 13, bold: true, color: '#7DD3FC' });
      drawWrappedText(ctx, `${ult.instantLabel} · ${ult.powerLabel}`, dx + 26, dy + 310, dw - 52, 16, { size: 12, color: THEME.TX1, maxLines: 2 });
      drawButton(ctx, hits, dx + 26, dy + 336, dw - 52, 28, '查看并装配此终极主动技 ▶', () => {
        this.selected = { kind: 'skill', id: ult.id };
      }, { variant: 'primary', fontSize: 12 });
    }
  }

  private renderCoreInspector(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    dx: number,
    dy: number,
    dw: number,
    _dh: number,
    actions: { onSave: () => void }
  ): void {
    const ast = league.getV6Astrolabe();
    const pt = league.getState().metaPointsTotal;
    const chk = canUnlockCore(ast);
    const ult = V6_ACTIVE_SKILL_MAP['sk_ult_core'];
    const club = league.getUserClub();
    const refund = calcRefundablePoints(ast, club.style, club.formation);

    drawBadge(ctx, dx + 16, dy + 14, 152, 22, '星盘圆心 · 终极核心', '#78350F', '#FEF08A');
    drawText(ctx, '★ 超级宗师 · 全攻全守', dx + 16, dy + 54, { size: 20, bold: true, color: '#FEF08A' });
    drawWrappedText(
      ctx,
      '单场前/中/后三区均打出过指令后触发【全攻全守交响】：全队四维 +10、失球率 -25% 持续至终场，并解锁圆心终极技《全军破限》！',
      dx + 16,
      dy + 80,
      dw - 32,
      18,
      { size: 12, color: THEME.TX1, maxLines: 3 }
    );

    drawRoundRect(ctx, dx + 16, dy + 146, dw - 32, 74, 8, THEME.BG_CARD, chk.ok ? THEME.GREEN : THEME.BORDER_GOLD);
    drawText(ctx, '双轨解锁条件（二选一，不强迫全修 6 流派）', dx + 26, dy + 164, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawWrappedText(ctx, chk.reason, dx + 26, dy + 182, dw - 52, 16, {
      size: 12,
      color: chk.ok ? THEME.GREEN : '#CBD5E1',
      maxLines: 2,
    });

    if (!ast.coreUnlocked) {
      const canBuy = chk.ok && pt >= 5;
      drawButton(ctx, hits, dx + 16, dy + 232, dw - 32, 42, '点亮圆心【★ 超级宗师】(消耗 5pt)', () => {
        const r = league.unlockV6Core();
        if (r.ok) {
          SoundEngine.playGoalCheer();
          this.notice = '圆心【★ 超级宗师 · 全攻全守】已觉醒！';
          actions.onSave();
        } else {
          this.notice = r.reason || '未满足条件';
        }
      }, { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 13 });
    } else {
      drawBadge(ctx, dx + 16, dy + 232, dw - 32, 38, '★ 超级宗师已觉醒 · 全攻全守永久生效 ✓', '#78350F', '#FEF08A');
    }

    if (ult) {
      drawRoundRect(ctx, dx + 16, dy + 286, dw - 32, 92, 8, 'rgba(12, 74, 110, 0.35)', '#38BDF8');
      drawText(ctx, `⚡ 圆心终极技：${ult.name}`, dx + 26, dy + 306, { size: 12.5, bold: true, color: '#FEF08A' });
      drawWrappedText(ctx, ult.powerLabel, dx + 26, dy + 324, dw - 52, 15, { size: 12, color: THEME.TX1, maxLines: 2 });
      drawButton(ctx, hits, dx + 26, dy + 344, dw - 52, 26, '查看并装配圆心终极技 ▶', () => {
        this.selected = { kind: 'skill', id: ult.id };
      }, { variant: 'primary', fontSize: 12 });
    }

    drawText(ctx, `已投入可退还点数：${refund}pt · 六印全齐额外 +1 TP/拐点`, dx + 16, dy + 402, {
      size: 12,
      color: THEME.TX3,
    });
  }

  private renderDirectiveCatalog(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    const ast = league.getV6Astrolabe();
    const unlSet = new Set(ast.unlockedDirectives);
    const eqSet = new Set(ast.checkpointPools[this.activeCheckpoint] ?? []);
    drawText(ctx, `122 张三区双刃剑手牌库 (${ast.unlockedDirectives.length}已解锁)`, dx + 16, dy + 24, {
      size: 14,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });

    const filters: Array<['ALL' | TacticalStyle | 'formation' | 'fusion', string]> = [
      ['ALL', '全部'],
      ['tiki_taka', '传控'],
      ['gegenpress', '高压'],
      ['wing_play', '两翼'],
      ['counter', '反击'],
      ['park_bus', '铁桶'],
      ['balanced', '均衡'],
      ['formation', '阵型'],
      ['fusion', '王牌'],
    ];
    filters.forEach(([fk, fl], idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      drawButton(ctx, hits, dx + 16 + col * 76, dy + 46 + row * 28, 70, 24, fl, () => {
        this.catalogFilterStyle = fk;
        this.catalogPage = 0;
      }, { active: this.catalogFilterStyle === fk, fontSize: 12 });
    });

    const list: V6DirectiveDef[] = V6_DIRECTIVES.filter(d => {
      if (this.catalogFilterStyle === 'ALL') return true;
      if (this.catalogFilterStyle === 'formation') return d.source === 'formation';
      if (this.catalogFilterStyle === 'fusion') return d.source === 'fusion';
      return d.style === this.catalogFilterStyle;
    }).sort((a, b) => Number(unlSet.has(b.id)) - Number(unlSet.has(a.id)));

    const pageSize = 6;
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (this.catalogPage >= totalPages) this.catalogPage = totalPages - 1;
    const slice = list.slice(this.catalogPage * pageSize, (this.catalogPage + 1) * pageSize);

    slice.forEach((d, idx) => {
      const ry = dy + 112 + idx * 60;
      const isUnl = unlSet.has(d.id);
      const isEq = eqSet.has(d.id);
      drawRoundRect(ctx, dx + 16, ry, dw - 32, 54, 7, isEq ? 'rgba(20,83,45,0.34)' : THEME.BG_CARD, isEq ? THEME.GREEN : isUnl ? ZONE_COLOR[d.zone] : THEME.BORDER);
      drawBadge(ctx, dx + 24, ry + 8, 44, 16, `${ZONE_LABEL[d.zone]}·${d.tendency === 'ATK' ? '攻' : '守'}`, '#0F172A', ZONE_COLOR[d.zone]);
      drawBadge(ctx, dx + 72, ry + 8, 34, 16, `${d.tpCost}TP`, '#78350F', THEME.GOLD_LIGHT);
      drawText(ctx, fitText(ctx, d.name, 168, 12, true), dx + 112, ry + 16, { size: 12, bold: true, color: isUnl ? THEME.TX1 : THEME.TX3 });
      drawText(ctx, isEq ? '已编入✓' : isUnl ? '已解锁' : `${d.unlockCost}pt`, dx + dw - 24, ry + 16, {
        size: 12,
        bold: true,
        color: isEq ? THEME.GREEN : isUnl ? '#7DD3FC' : THEME.GOLD_LIGHT,
        align: 'right',
      });
      drawText(ctx, fitText(ctx, d.benefitSummary, dw - 52, 10), dx + 24, ry + 38, { size: 12, color: THEME.TX2 });
      hits.add(dx + 16, ry, dw - 32, 54, () => {
        SoundEngine.playClick();
        this.selected = { kind: 'directive', id: d.id };
      });
    });

    drawButton(ctx, hits, dx + 16, dy + dh - 38, 80, 26, '上一页', () => {
      this.catalogPage = Math.max(0, this.catalogPage - 1);
    }, { disabled: this.catalogPage === 0, fontSize: 12 });
    drawText(ctx, `${this.catalogPage + 1} / ${totalPages} (共${list.length}张)`, dx + dw / 2, dy + dh - 25, {
      size: 12,
      color: THEME.TX2,
      align: 'center',
    });
    drawButton(ctx, hits, dx + dw - 96, dy + dh - 38, 80, 26, '下一页', () => {
      this.catalogPage = Math.min(totalPages - 1, this.catalogPage + 1);
    }, { disabled: this.catalogPage >= totalPages - 1, fontSize: 12 });
  }

  private renderSkillCatalog(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    const ast = league.getV6Astrolabe();
    const unlSet = new Set(ast.unlockedSkills);
    const eqSet = new Set(ast.equippedSkills);
    drawText(ctx, `59 个子弹时间主动技库 (${ast.unlockedSkills.length}已解锁)`, dx + 16, dy + 24, {
      size: 14,
      bold: true,
      color: '#38BDF8',
    });

    const list = [...V6_ACTIVE_SKILLS].sort((a, b) => Number(eqSet.has(b.id)) - Number(eqSet.has(a.id)) || Number(unlSet.has(b.id)) - Number(unlSet.has(a.id)));
    const pageSize = 7;
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (this.catalogPage >= totalPages) this.catalogPage = totalPages - 1;
    const slice = list.slice(this.catalogPage * pageSize, (this.catalogPage + 1) * pageSize);

    slice.forEach((sk, idx) => {
      const ry = dy + 52 + idx * 60;
      const isUnl = unlSet.has(sk.id);
      const isEq = eqSet.has(sk.id);
      drawRoundRect(ctx, dx + 16, ry, dw - 32, 54, 7, isEq ? 'rgba(12, 74, 110, 0.45)' : THEME.BG_CARD, isEq ? '#4ADE80' : isUnl ? '#38BDF8' : THEME.BORDER);
      drawText(ctx, sk.name, dx + 24, ry + 16, { size: 12, bold: true, color: isEq ? '#4ADE80' : isUnl ? '#7DD3FC' : THEME.TX3 });
      drawText(ctx, isEq ? '已装配✓' : isUnl ? '已解锁' : `${sk.unlockCost}pt`, dx + dw - 24, ry + 16, {
        size: 12,
        bold: true,
        color: isEq ? THEME.GREEN : isUnl ? '#7DD3FC' : THEME.GOLD_LIGHT,
        align: 'right',
      });
      drawText(ctx, fitText(ctx, `${sk.situationLabel} · ${sk.instantLabel}`, dw - 52, 10), dx + 24, ry + 38, {
        size: 12,
        color: THEME.TX2,
      });
      hits.add(dx + 16, ry, dw - 32, 54, () => {
        SoundEngine.playClick();
        this.selected = { kind: 'skill', id: sk.id };
      });
    });

    drawButton(ctx, hits, dx + 16, dy + dh - 38, 80, 26, '上一页', () => {
      this.catalogPage = Math.max(0, this.catalogPage - 1);
    }, { disabled: this.catalogPage === 0, fontSize: 12 });
    drawText(ctx, `${this.catalogPage + 1} / ${totalPages} (共${list.length}个)`, dx + dw / 2, dy + dh - 25, {
      size: 12,
      color: THEME.TX2,
      align: 'center',
    });
    drawButton(ctx, hits, dx + dw - 96, dy + dh - 38, 80, 26, '下一页', () => {
      this.catalogPage = Math.min(totalPages - 1, this.catalogPage + 1);
    }, { disabled: this.catalogPage >= totalPages - 1, fontSize: 12 });
  }

  private renderClubInfrastructure(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    baseX: number,
    totalW: number,
    actions: { onSave: () => void }
  ): void {
    const levels = league.getMetaLevels();
    const cardGap = 14;
    const cardW = (totalW - cardGap * 2) / 3;
    const cardH = 264;
    const clubFunds = league.getClubFunds();
    const bestTier = league.getBestTierReached();
    const infraPerPage = 6;
    const infraPages = Math.max(1, Math.ceil(META_BRANCHES.length / infraPerPage));
    if (this.infraPage >= infraPages) this.infraPage = infraPages - 1;
    const visibleBranches = META_BRANCHES.slice(this.infraPage * infraPerPage, (this.infraPage + 1) * infraPerPage);

    drawButton(ctx, hits, baseX + totalW - 184, 72, 62, 32, '◀ 上页', () => {
      this.infraPage = Math.max(0, this.infraPage - 1);
    }, { disabled: this.infraPage === 0, fontSize: 12 });
    drawText(ctx, `${this.infraPage + 1}/${infraPages}`, baseX + totalW - 92, 88, { size: 12.5, bold: true, color: THEME.GOLD_LIGHT, align: 'center', mono: true });
    drawButton(ctx, hits, baseX + totalW - 64, 72, 62, 32, '下页 ▶', () => {
      this.infraPage = Math.min(infraPages - 1, this.infraPage + 1);
    }, { disabled: this.infraPage >= infraPages - 1, fontSize: 12 });

    visibleBranches.forEach((branch, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const bx = baseX + col * (cardW + cardGap);
      const by = 116 + row * (cardH + 14);

      const curLv = levels[branch.id] ?? 0;
      const nextLv = curLv + 1;
      const req = getMetaUpgradeRequirement(branch.id, curLv);
      const nextCost = req?.cost ?? null;
      const reqTier = req?.minTier ?? 7;
      const tierLocked = nextCost !== null && bestTier > reqTier;
      const canAfford = nextCost !== null && !tierLocked && clubFunds >= nextCost;

      drawChamferPanel(
        ctx,
        bx,
        by,
        cardW,
        cardH,
        12,
        'rgba(14, 22, 40, 0.92)',
        curLv > 0 ? branch.accent : THEME.BORDER,
        curLv > 0 ? 1.5 : 1,
        curLv > 0 ? branch.accent : undefined
      );
      drawIcon(ctx, BRANCH_ICON[branch.id], bx + 22, by + 24, 15, branch.accent);
      drawText(ctx, branch.name, bx + 38, by + 24, { size: 15.5, bold: true, color: branch.accent });
      drawBadge(ctx, bx + cardW - 76, by + 13, 62, 20, `Lv.${curLv}/${branch.maxLevel}`, '#1E293B', THEME.GOLD_LIGHT);

      for (let lvDot = 0; lvDot < branch.maxLevel; lvDot++) {
        const dw = Math.floor((cardW - 36 - 7 * 3) / 8);
        const dx = bx + 18 + lvDot * (dw + 3);
        const lit = curLv > lvDot;
        const lockedDot = lvDot >= 5 && bestTier > (INFRA_MIN_TIERS[lvDot] ?? 7);
        drawRoundRect(ctx, dx, by + 44, dw, 5, 2, lit ? branch.accent : lockedDot ? '#334155' : '#1E293B');
      }

      const startLv = Math.max(0, Math.min(branch.maxLevel - 3, curLv > 0 ? curLv - 1 : 0));
      for (let li = startLv; li < Math.min(branch.maxLevel, startLv + 3); li++) {
        const rowIdx = li - startLv;
        const ly = by + 58 + rowIdx * 56;
        const unlocked = curLv >= li + 1;
        const lvReq = INFRA_MIN_TIERS[li] ?? 7;
        const isLvLocked = !unlocked && bestTier > lvReq;
        drawRoundRect(
          ctx,
          bx + 14,
          ly,
          cardW - 28,
          50,
          7,
          unlocked ? 'rgba(34,197,94,0.12)' : THEME.BG_CARD,
          unlocked ? THEME.GREEN : isLvLocked ? '#475569' : THEME.BORDER
        );
        drawBadge(
          ctx,
          bx + 20,
          ly + 15,
          38,
          20,
          `Lv.${li + 1}`,
          unlocked ? THEME.GREEN : isLvLocked ? '#1E293B' : '#334155',
          unlocked ? '#080C14' : isLvLocked ? '#FCA5A5' : THEME.TX2
        );
        drawWrappedText(ctx, branch.levelDescriptions[li], bx + 64, ly + 9, cardW - 134, 15, {
          token: 'LABEL',
          color: unlocked ? THEME.TX1 : THEME.TX2,
          maxLines: 2,
        });
        drawText(
          ctx,
          unlocked ? '已建' : isLvLocked ? `需T${lvReq}` : `¥${branch.costs[li]}万`,
          bx + cardW - 18,
          ly + 25,
          {
            size: 12,
            bold: true,
            color: unlocked ? THEME.GREEN : isLvLocked ? '#FCA5A5' : THEME.GOLD_LIGHT,
            align: 'right',
            mono: !unlocked,
          }
        );
      }

      if (nextCost === null) {
        drawBadge(ctx, bx + 14, by + cardH - 44, cardW - 28, 32, '满级基建竣工 (Lv.8)', '#14532D', THEME.GREEN);
      } else {
        const btnLabel = tierLocked
          ? `需打入第 ${reqTier} 级解锁`
          : canAfford
          ? `扩建 Lv.${nextLv} (¥${nextCost}万)`
          : `资金不足 (¥${nextCost}万)`;
        drawButton(
          ctx,
          hits,
          bx + 14,
          by + cardH - 44,
          cardW - 28,
          32,
          btnLabel,
          () => {
            const res = league.upgradeMetaBranch(branch.id);
            if (res.ok) {
              SoundEngine.playClick();
              this.notice = `已将【${branch.name}】扩建至 Lv.${nextLv}`;
              actions.onSave();
            } else {
              this.notice = res.reason || '扩建失败';
            }
          },
          { variant: canAfford ? 'gold' : 'ghost', disabled: !canAfford, fontSize: 12 }
        );
      }
    });
  }
}
