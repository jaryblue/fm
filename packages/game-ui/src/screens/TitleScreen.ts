/**
 * 页面 0：TitleScreen 发行级主视觉登录门户 + 2 步式建队向导弹窗
 * Step 1: 「俱乐部形象室」—— 命名 + 队徽模板 + 可切换主/客场球衣聚光灯预览（高归属感展示台）
 * Step 2: 「阵型与哲学 × 八卦星盘」—— 左侧放大星盘正上方局部（仅显已选阵型与打法，切换时带弹簧旋转），
 *         右侧阵型/打法选择 + 图形化五维雷达优劣势 + 代表技能与代表手牌预览
 */

import { ACHIEVEMENTS } from '../../../core/src/Achievements';
import { LeagueManager, NewSeasonOptions } from '../../../core/src/LeagueManager';
import { FICTIONAL_CLUBS } from '../../../core/src/PlayerPool';
import { generateFictionalClubName } from '../../../core/src/namePool';
import {
  INNER_RING_SYSTEMS,
  OUTER_RING_STYLES,
  STYLE_LABELS,
  STYLE_ORIGIN_PASSIVE,
  SYSTEM_LABELS,
  SYSTEM_ORIGIN_PASSIVE,
  V6_ACTIVE_SKILLS,
  V6_DIRECTIVES,
  V6_FUSION_KEYSTONES,
  V6_PASSIVE_MAP,
  V6_STYLE_PASSIVES,
} from '../../../core/src/v6';
import { FORMATION_SYSTEMS, getDefenseSystem } from '../../../engine/src/formations';
import { DefenseSystem, FormationName, TACTICAL_PRESETS, TacticalStyle } from '../../../engine/src/types';
import {
  ASTROLABE_STYLE_GLYPH,
  ASTROLABE_SYSTEM_GLYPH,
  ASTROLABE_ZONE_COLOR,
  ASTROLABE_ZONE_LABEL,
  drawAstrolabeBackdropAndRings,
  drawAstrolabeCircleNode,
  drawAstrolabeDiamondSkillNode,
  drawAstrolabeDirectiveNode,
  drawAstrolabeEdgeLine,
  drawAstrolabeHexFusionNode,
  getAstrolabePassiveGlyph,
} from '../AstrolabeVisuals';
import { ArtAssetId, AssetLoader } from '../AssetLoader';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawPrintCard,
  drawRoundRect,
  drawStamp,
  drawText,
  fitText,
  FONT,
  formatFunds,
  getHalftonePattern,
  getPaperGrainPattern,
  HitRegistry,
} from '../CanvasKit';
import { drawClubCrest, drawJerseyIcon } from '../ClubVisuals';
import { drawGameLogoEmblem, easeOutBack, easeOutCubic } from '../Motion';
import { getRunningVersion } from '../RuntimeInfo';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, drawSkillGlyph } from '../VectorIcons';

const HOME_PRIMARY_PALETTE = ['#DC2626', '#2563EB', '#059669', '#EA580C', '#7C3AED', '#0284C7'];
const HOME_SECONDARY_PALETTE = ['#FACC15', '#F8FAFC', '#1E293B', '#38BDF8', '#F59E0B'];
const AWAY_PRIMARY_PALETTE = ['#F8FAFC', '#FACC15', '#38BDF8', '#0F172A', '#EC4899', '#10B981'];
const AWAY_SECONDARY_PALETTE = ['#0F172A', '#DC2626', '#2563EB', '#FACC15', '#F8FAFC'];
const SYS_TABS: DefenseSystem[] = ['4-back', '3-back', '5-back'];
const STYLE_LIST: TacticalStyle[] = ['tiki_taka', 'gegenpress', 'balanced', 'wing_play', 'counter', 'park_bus'];

const STYLE_BASE_RADAR: Record<TacticalStyle, [number, number, number, number, number]> = {
  // [控球组织, 前场逼抢, 防线稳固, 边路推进, 反击纵深]
  tiki_taka: [94, 72, 62, 64, 52],
  gegenpress: [70, 96, 56, 74, 78],
  wing_play: [66, 68, 60, 96, 72],
  counter: [46, 54, 78, 72, 96],
  park_bus: [38, 42, 96, 50, 76],
  balanced: [76, 72, 76, 72, 72],
};

const SYSTEM_RADAR_DELTA: Record<DefenseSystem, [number, number, number, number, number]> = {
  '4-back': [6, 4, 2, 4, 2],
  '3-back': [4, 10, -8, 12, 6],
  '5-back': [-8, -6, 14, -4, 10],
};

const STYLE_PROS_CONS: Record<TacticalStyle, { pros: string; cons: string }> = {
  tiki_taka: { pros: '阵地传导极强 · 肋部渗透破铁桶', cons: '防线偏高 · 怕高位疯狂反抢' },
  gegenpress: { pros: '抢断转换极快 · 压迫传控出球', cons: '体能消耗极大 · 身后易留空当' },
  wing_play: { pros: '双翼宽度拉满 · 传中造角能力强', cons: '中路密度略降 · 忌五后卫铁桶' },
  counter: { pros: '纵深直塞致命 · 专克高位逼抢', cons: '控球率偏低 · 面对铁桶难破门' },
  park_bus: { pros: '禁区封堵拉满 · 强队克星护盾多', cons: '进攻兵力有限 · 阵地推进较慢' },
  balanced: { pros: '无明显短板 · 跨流派手牌惩罚减半', cons: '单点极限爆发略逊专精流派' },
};

const SYSTEM_NOTE: Record<DefenseSystem, string> = {
  '4-back': '四后卫攻守均衡',
  '3-back': '三后卫边翼前压',
  '5-back': '五后卫禁区铁闸',
};

interface TitlePosterDef {
  id: ArtAssetId;
  stageLabel: string;
  title: string;
  /** null=默认解锁(00老将登场), 7..1=升入对应级别解锁, 0=夺得超级联赛冠军解锁 */
  unlockTier: number | null;
  unlockHint: string;
}

const TITLE_POSTERS: TitlePosterDef[] = [
  { id: 'bg_title_00_veteran', stageLabel: '00 · 开局', title: '老将登场', unlockTier: null, unlockHint: '默认解锁' },
  { id: 'bg_title_01_amateur', stageLabel: 'T7 · 业余', title: '社区业余联赛', unlockTier: 7, unlockHint: '开启生涯解锁' },
  { id: 'bg_title_02_district', stageLabel: 'T6 · 地区', title: '地区联赛', unlockTier: 6, unlockHint: '升入第6级解锁' },
  { id: 'bg_title_03_tier5', stageLabel: 'T5 · 丙级', title: '丙级联赛', unlockTier: 5, unlockHint: '升入第5级解锁' },
  { id: 'bg_title_04_tier4', stageLabel: 'T4 · 乙级', title: '乙级联赛', unlockTier: 4, unlockHint: '升入第4级解锁' },
  { id: 'bg_title_05_tier3', stageLabel: 'T3 · 甲级', title: '甲级联赛', unlockTier: 3, unlockHint: '升入第3级解锁' },
  { id: 'bg_title_06_championship', stageLabel: 'T2 · 冠军', title: '冠军联赛', unlockTier: 2, unlockHint: '升入第2级解锁' },
  { id: 'bg_title_07_super', stageLabel: 'T1 · 超级', title: '超级联赛', unlockTier: 1, unlockHint: '升入第1级解锁' },
  { id: 'bg_title_08_dynasty', stageLabel: '王朝 · 捧杯', title: '超级联赛王朝', unlockTier: 0, unlockHint: '超级联赛夺冠解锁' },
];

export class TitleScreen {
  private selectedPosterIdx: number | null = null;
  private wizardOpen = false;
  private wizardStep: 1 | 2 = 1;
  private previewKitMode: 'home' | 'away' = 'home';
  private selectedClubId = FICTIONAL_CLUBS[0].id;
  private customName = FICTIONAL_CLUBS[0].name;
  private primaryColor = FICTIONAL_CLUBS[0].primaryColor;
  private secondaryColor = FICTIONAL_CLUBS[0].secondaryColor;
  private awayPrimaryColor = FICTIONAL_CLUBS[0].awayPrimaryColor || '#F8FAFC';
  private awaySecondaryColor = FICTIONAL_CLUBS[0].awaySecondaryColor || FICTIONAL_CLUBS[0].primaryColor;
  private formation: FormationName = '4-3-3';
  private sysTab: DefenseSystem = '4-back';
  private style: TacticalStyle = 'tiki_taka';
  private enterTime = 0;
  private ambientTime = 0;

  // Step 2 星盘震撼降临动画与弹簧旋转状态
  private step2AnimTime = 1.2;
  private outerRotOffset = 0;
  private outerRotVel = 0;
  private innerRotOffset = 0;
  private innerRotVel = 0;
  private rotFlashTimer = 0;
  private rotFlashRing: 'outer' | 'inner' = 'outer';

  public resetEnterAnim(): void {
    this.enterTime = 0;
  }

  public openNewSeasonWizard(): void {
    this.wizardStep = 1;
    this.previewKitMode = 'home';
    this.wizardOpen = true;
    this.step2AnimTime = 1.2;
    this.outerRotOffset = 0;
    this.outerRotVel = 0;
    this.innerRotOffset = 0;
    this.innerRotVel = 0;
    this.rotFlashTimer = 0;
  }

  public isAnimating(): boolean {
    if (!this.wizardOpen) return false;
    return (
      this.step2AnimTime < 1.05 ||
      Math.abs(this.outerRotOffset) > 0.002 ||
      Math.abs(this.outerRotVel) > 0.002 ||
      Math.abs(this.innerRotOffset) > 0.002 ||
      Math.abs(this.innerRotVel) > 0.002 ||
      this.rotFlashTimer > 0
    );
  }

  private enterStep2(): void {
    if (this.wizardStep === 2) return;
    this.wizardStep = 2;
    this.step2AnimTime = 0;
    this.outerRotOffset = Math.PI / 2.2;
    this.outerRotVel = -1.9;
    this.innerRotOffset = -Math.PI / 1.7;
    this.innerRotVel = 2.6;
    this.rotFlashTimer = 0.72;
    this.rotFlashRing = 'outer';
    SoundEngine.playAstrolabeLock();
  }

  private selectStyle(nextStyle: TacticalStyle): void {
    if (this.style === nextStyle) return;
    const prevIdx = Math.max(0, OUTER_RING_STYLES.indexOf(this.style));
    const nextIdx = Math.max(0, OUTER_RING_STYLES.indexOf(nextStyle));
    let delta = nextIdx - prevIdx;
    if (delta > 3) delta -= 6;
    if (delta < -3) delta += 6;
    if (delta === 0) delta = 1;
    this.style = nextStyle;
    this.outerRotOffset -= delta * (Math.PI / 3);
    this.outerRotVel = delta * 1.75;
    this.rotFlashTimer = 0.65;
    this.rotFlashRing = 'outer';
    SoundEngine.playAstrolabeRotate('outer');
  }

  private selectFormation(nextFm: FormationName): void {
    const prevSys = getDefenseSystem(this.formation);
    const nextSys = getDefenseSystem(nextFm);
    this.formation = nextFm;
    this.sysTab = nextSys;
    if (prevSys !== nextSys) {
      const prevIdx = Math.max(0, INNER_RING_SYSTEMS.indexOf(prevSys));
      const nextIdx = Math.max(0, INNER_RING_SYSTEMS.indexOf(nextSys));
      let delta = nextIdx - prevIdx;
      if (delta > 1) delta -= 3;
      if (delta < -1) delta += 3;
      if (delta === 0) delta = 1;
      this.innerRotOffset -= delta * ((2 * Math.PI) / 3);
      this.innerRotVel = delta * 2.2;
      this.rotFlashTimer = 0.65;
      this.rotFlashRing = 'inner';
      SoundEngine.playAstrolabeRotate('inner');
    } else {
      this.rotFlashTimer = Math.max(this.rotFlashTimer, 0.36);
      this.rotFlashRing = 'inner';
      SoundEngine.playClick();
    }
  }

  public update(dtSec: number): void {
    const dt = Math.min(0.05, Math.max(0.001, dtSec));
    this.enterTime += dt;
    this.ambientTime += dt;

    if (this.wizardOpen && this.wizardStep === 2) {
      if (this.step2AnimTime < 1.5) {
        this.step2AnimTime += dt;
      }
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
  }

  private selectTemplate(clubId: string): void {
    const tpl = FICTIONAL_CLUBS.find(c => c.id === clubId) || FICTIONAL_CLUBS[0];
    this.selectedClubId = tpl.id;
    this.customName = tpl.name;
    this.primaryColor = tpl.primaryColor;
    this.secondaryColor = tpl.secondaryColor;
    this.awayPrimaryColor = tpl.awayPrimaryColor || '#F8FAFC';
    this.awaySecondaryColor = tpl.awaySecondaryColor || tpl.primaryColor;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onContinue: () => void;
      onStartNewSeason: (opts: NewSeasonOptions) => void;
      onOpenPrologue?: () => void;
      onOpenMeta: () => void;
      onOpenRoster: () => void;
      onOpenHallOfFame: () => void;
      onResetSave?: () => void;
      onEditName?: (current: string, apply: (next: string) => void) => void;
      onOpenSettings?: () => void;
      onOpenSaveSlots?: () => void;
      onQuitApp?: () => void;
      activeSlotLabel?: string;
      hasSavedGame?: boolean;
    }
  ): void {
    const st = league.getState();
    const userClub = league.getUserClub();
    const hasActiveRun =
      (actions.hasSavedGame ?? true) &&
      (st.phase === 'REGULAR_SEASON' ||
        st.phase === 'SUMMER_WINDOW' ||
        st.phase === 'WINTER_WINDOW' ||
        st.phase === 'RE_DRAFT' ||
        st.phase === 'SEASON_END' ||
        (st.phase === 'INIT_DRAFT' && (userClub.squad.length > 0 || st.seasonNumber > 1)));
    const metaLv = league.getMetaLevels();
    const hof = st.hallOfFame;

    // 计算生涯最高解锁阶段（用于 9 张标题底图默认定位与解锁状态判定）
    const recordBestTier = (hof?.records ?? []).reduce((best, r) => Math.min(best, r.tier ?? 7), 7);
    const bestTier = Math.min(st.bestTierReached ?? 7, st.currentTier ?? 7, recordBestTier);
    const hasCareerProgress = hasActiveRun || (hof?.seasonsPlayed ?? 0) > 0;
    const hasSuperChamp = (hof?.records ?? []).some(r => r.isChampion && (r.tier ?? 7) === 1);
    const isPosterUnlocked = (def: TitlePosterDef): boolean => {
      if (def.unlockTier === null) return true;
      if (def.unlockTier === 0) return hasSuperChamp;
      return hasCareerProgress && bestTier <= def.unlockTier;
    };
    if (this.selectedPosterIdx === null) {
      if (hasSuperChamp) this.selectedPosterIdx = 8;
      else if (hasCareerProgress) this.selectedPosterIdx = Math.max(1, Math.min(7, 8 - bestTier));
      else this.selectedPosterIdx = 0;
    }
    const posterIdx = ((this.selectedPosterIdx % TITLE_POSTERS.length) + TITLE_POSTERS.length) % TITLE_POSTERS.length;
    const activePoster = TITLE_POSTERS[posterIdx];
    const posterUnlocked = isPosterUnlocked(activePoster);
    const posterImg = AssetLoader.get(activePoster.id) ?? AssetLoader.get('bg_title');

    // PITCH PRINT 非对称电影海报构图：优先渲染阶段演进主视觉底图（未解锁时置灰预览）
    ctx.save();
    ctx.fillStyle = '#0A1A14';
    ctx.fillRect(0, 0, THEME.W, THEME.H);

    if (posterImg && typeof ctx.drawImage === 'function') {
      ctx.save();
      if (!posterUnlocked) {
        if ('filter' in ctx) {
          ctx.filter = 'grayscale(100%) brightness(0.45) contrast(0.9)';
        }
        ctx.globalAlpha = 0.72;
      }
      ctx.drawImage(posterImg, 0, 0, THEME.W, THEME.H);
      ctx.restore();
      if (!posterUnlocked) {
        // 未解锁置灰遮罩（兼顾无 ctx.filter 的小游戏环境）
        ctx.fillStyle = 'rgba(10, 20, 18, 0.56)';
        ctx.fillRect(0, 0, THEME.W, THEME.H);
      }
      // 左侧 45% 温和暗角压底，保障菜单与卡片绝对高对比度
      const leftScrim = ctx.createLinearGradient(0, 0, THEME.W * 0.52, 0);
      leftScrim.addColorStop(0, 'rgba(10, 26, 20, 0.72)');
      leftScrim.addColorStop(0.75, 'rgba(10, 26, 20, 0.35)');
      leftScrim.addColorStop(1, 'rgba(10, 26, 20, 0)');
      ctx.fillStyle = leftScrim;
      ctx.fillRect(0, 0, THEME.W * 0.55, THEME.H);
    } else {
      // 底图尚未加载完成时的纯 Canvas 2D 兜底背景
      const bgGrad = ctx.createRadialGradient(THEME.W * 0.72, THEME.H * 0.34, 40, THEME.W * 0.65, THEME.H * 0.45, THEME.W * 0.75);
      bgGrad.addColorStop(0, '#1D4535');
      bgGrad.addColorStop(0.50, THEME.BG_MID);
      bgGrad.addColorStop(1, '#07120D');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, THEME.W, THEME.H);
      const ht = getHalftonePattern(ctx, true);
      if (ht) {
        ctx.save();
        ctx.globalAlpha = 0.50;
        ctx.fillStyle = ht;
        ctx.fillRect(THEME.W * 0.42, 0, THEME.W * 0.58, THEME.H);
        ctx.restore();
      }
      this.drawVeteranTunnelHero(ctx, this.ambientTime);
    }

    for (let pi = 0; pi < 16; pi++) {
      const px = ((pi * 103 + Math.sin(this.ambientTime * 0.55 + pi) * 18) % THEME.W + THEME.W) % THEME.W;
      const py = THEME.H - ((this.ambientTime * (30 + (pi % 4) * 12) + pi * 71) % THEME.H);
      const pa = 0.16 + 0.18 * Math.sin(this.ambientTime * 2.0 + pi);
      ctx.fillStyle = pi % 3 === 0
        ? `rgba(224, 58, 46, ${Math.max(0.06, pa).toFixed(2)})`
        : pi % 3 === 1
        ? `rgba(200, 242, 48, ${Math.max(0.06, pa).toFixed(2)})`
        : `rgba(216, 168, 66, ${Math.max(0.06, pa).toFixed(2)})`;
      const sz = 3 + (pi % 2) * 2;
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.restore();

    const pTitle = easeOutCubic(Math.min(1, this.enterTime / 0.35));
    const pLogo = easeOutBack(Math.min(1, this.enterTime / 0.45));
    const pCard = easeOutBack(Math.min(1, Math.max(0, (this.enterTime - 0.1) / 0.42)));
    const pBtns = easeOutCubic(Math.min(1, Math.max(0, (this.enterTime - 0.18) / 0.38)));

    let toolRightX = 1256;
    if (actions.onQuitApp) {
      toolRightX -= 88;
      drawButton(ctx, hits, toolRightX, 20, 88, 44, '退出', actions.onQuitApp, { variant: 'ghost', fontSize: 13.5 });
      toolRightX -= 10;
    }
    if (actions.onOpenSettings) {
      toolRightX -= 96;
      drawButton(ctx, hits, toolRightX, 20, 96, 44, '设置', actions.onOpenSettings, { variant: 'ghost', fontSize: 13.5, icon: 'gear' });
      toolRightX -= 10;
    } else {
      toolRightX -= 114;
      drawButton(ctx, hits, toolRightX, 20, 114, 44, SoundEngine.getAudioModeLabel(), () => {
        SoundEngine.cycleAudioMode();
      }, { variant: 'ghost', fontSize: 13.5, icon: SoundEngine.muted ? 'sound_off' : 'sound_on' });
      toolRightX -= 10;
    }
    if (actions.onOpenSaveSlots) {
      toolRightX -= 126;
      drawButton(ctx, hits, toolRightX, 20, 126, 44, actions.activeSlotLabel || '存档位 1', actions.onOpenSaveSlots, { variant: 'gold', fontSize: 13.5 });
      toolRightX -= 10;
    }
    if (hasActiveRun && actions.onResetSave) {
      toolRightX -= 104;
      drawButton(ctx, hits, toolRightX, 20, 104, 44, '重置存档', actions.onResetSave, { variant: 'ghost', fontSize: 13.5 });
    }

    // 左侧非对称主视觉专栏（x = 68, w = 620）
    const leftX = 68;
    const dockInnerW = 580;
    const dockPadX = 20;
    const dockPadY = 18;
    const dockW = dockInnerW + dockPadX * 2;
    const dockX = leftX;
    const tyOff = Math.round((1 - pTitle) * 18);

    ctx.save();
    ctx.globalAlpha = pTitle;
    drawStamp(ctx, '2026 · GRASSROOTS', leftX + 86, 62 + tyOff, THEME.LIME, -3, 0.88, THEME.BG_PANEL);
    drawText(ctx, 'TACTICAL ROGUELIKE FOOTBALL', leftX + 186, 62 + tyOff, {
      size: 13,
      bold: true,
      color: THEME.TX2,
      mono: true,
    });

    const logoSize = hasActiveRun ? 176 : 196;
    const logoCenterY = (hasActiveRun ? 156 : 176) + tyOff;
    ctx.save();
    ctx.translate(leftX + 252, logoCenterY);
    ctx.scale(pLogo, pLogo);
    drawGameLogoEmblem(ctx, 0, 0, logoSize, this.ambientTime, 'showcase');
    ctx.restore();
    drawText(ctx, '38 岁老将重返草根母队 · 绿茵战术肉鸽足球经理', leftX + 4, logoCenterY + (hasActiveRun ? 88 : 98), {
      size: 15.5,
      bold: true,
      color: THEME.TX1,
      align: 'left',
    });
    ctx.restore();

    const cyOff = Math.round((1 - pCard) * 16);
    const floatY = Math.round(Math.sin(this.ambientTime * 1.6) * 1.2);
    const dockY = (hasActiveRun ? 320 : 352) + cyOff + floatY;
    const row1H = hasActiveRun ? 116 : 64;
    const rowGap = 16;
    const row2H = 48;
    const dockH = dockPadY * 2 + row1H + rowGap + row2H;

    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, pCard));

    const slotLbl = actions.activeSlotLabel || '存档位 1';
    const tab1W = 148;
    const tabH = 34;
    const tabY = dockY - tabH + 4;
    drawRoundRect(ctx, dockX + 16, tabY, tab1W, tabH + 8, 3, THEME.PAPER_CREAM, THEME.INK_LINE, 2.5);
    drawText(ctx, slotLbl, dockX + 16 + tab1W / 2, tabY + 17, {
      size: 13.5,
      bold: true,
      color: THEME.PAPER_INK,
      align: 'center',
    });
    if (actions.onOpenSaveSlots) {
      hits.addTouchTarget(dockX + 16, tabY - 4, tab1W, 44, () => {
        SoundEngine.playClick();
        actions.onOpenSaveSlots!();
      });
      const tab2X = dockX + 16 + tab1W + 8;
      drawRoundRect(ctx, tab2X, tabY + 4, 118, tabH + 4, 3, THEME.BG_CARD_DARK, THEME.INK_LINE, 2.0);
      drawText(ctx, '切换槽位 ⇄', tab2X + 59, tabY + 19, {
        size: 13,
        bold: true,
        color: THEME.TX1,
        align: 'center',
      });
      hits.addTouchTarget(tab2X, tabY - 4, 118, 44, () => {
        SoundEngine.playClick();
        actions.onOpenSaveSlots!();
      });
    }

    drawPrintCard(ctx, dockX, dockY, dockW, dockH, {
      paper: true,
      topBandColor: THEME.VERMILION,
      radius: 3,
      shadowOffset: 6,
      lineWidth: 3,
    });
    const grain = getPaperGrainPattern(ctx);
    if (grain) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = grain;
      ctx.fillRect(dockX + 4, dockY + 8, dockW - 8, dockH - 12);
      ctx.restore();
    }

    const innerX = dockX + dockPadX;
    const row1Y = dockY + dockPadY + 4;

    if (hasActiveRun) {
      const standings = league.getStandings();
      const myRank = standings.findIndex(r => r.isUser) + 1;
      const tierInfo = league.getCurrentTierInfo();
      const totalRounds = league.getTotalRegularRounds();
      const phaseText =
        st.phase === 'INIT_DRAFT' ? `${tierInfo.shortLabel} · 核心开包 (${userClub.squad.length}/11人)` :
        st.phase === 'SUMMER_WINDOW' ? `${tierInfo.shortLabel} · 夏季转会窗 (${userClub.squad.length}/26人)` :
        st.phase === 'WINTER_WINDOW' ? `${tierInfo.shortLabel} · 冬季转会窗 · 第 ${st.currentRound}/${totalRounds} 轮` :
        st.phase === 'RE_DRAFT' ? `${tierInfo.shortLabel} · 第 ${st.currentRound} 轮赛后补强` :
        `${tierInfo.shortLabel} · 第 ${st.currentRound}/${totalRounds} 轮 · 第 ${myRank} 名`;

      drawRoundRect(ctx, innerX, row1Y, dockInnerW, row1H, 3, THEME.PAPER_WARM, THEME.INK_LINE, 2);
      drawClubCrest(ctx, innerX + 50, row1Y + row1H / 2, 28, userClub);
      drawText(ctx, fitText(ctx, `第 ${st.seasonNumber} 赛季 · ${userClub.name}`, dockInnerW - 280, 21, true), innerX + 94, row1Y + 40, {
        size: 21,
        bold: true,
        color: THEME.PAPER_INK,
      });
      drawText(ctx, fitText(ctx, `${phaseText} · ${userClub.formation}`, dockInnerW - 280, 14), innerX + 94, row1Y + 74, {
        size: 14,
        bold: true,
        color: THEME.PAPER_MUTED,
      });
      drawStamp(ctx, `S${st.seasonNumber} 在任`, innerX + dockInnerW - 216, row1Y + 26, THEME.VERMILION, -7, 0.85);
      drawButton(ctx, hits, innerX + dockInnerW - 166, row1Y + (row1H - 52) / 2, 152, 52, '继续赛季', actions.onContinue, {
        variant: 'primary',
        fontSize: 16,
        icon: 'play',
      });
    } else {
      drawButton(ctx, hits, innerX, row1Y, dockInnerW, row1H, '开始新赛季', () => {
        if (!league.isPrologueCompleted() && actions.onOpenPrologue) {
          actions.onOpenPrologue();
        } else {
          this.openNewSeasonWizard();
        }
      }, { variant: 'primary', fontSize: 20, icon: 'sparkle' });
    }
    ctx.restore();

    const row2Y = row1Y + row1H + rowGap;
    const dockBtnW = Math.floor((dockInnerW - 24) / 3);
    const dockGap = 12;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, pBtns));
    drawButton(ctx, hits, innerX, row2Y, dockBtnW, row2H, `教练天赋 (${st.metaPointsTotal})`, actions.onOpenMeta, {
      variant: 'ghost',
      fontSize: 14,
      icon: 'talent',
    });
    drawButton(ctx, hits, innerX + dockBtnW + dockGap, row2Y, dockBtnW, row2H, '我的球队', actions.onOpenRoster, {
      variant: 'ghost',
      fontSize: 14,
      icon: 'tactics',
    });
    drawButton(ctx, hits, innerX + (dockBtnW + dockGap) * 2, row2Y, dockBtnW, row2H, `荣誉室 (${hof?.unlockedAchievements.length ?? 0}/${ACHIEVEMENTS.length})`, actions.onOpenHallOfFame, {
      variant: 'ghost',
      fontSize: 14,
      icon: 'trophy',
    });
    ctx.restore();

    if (!this.wizardOpen) {
      // 右下角：9 阶段主视觉海报手动左右切换预览条（未解锁时显示置灰锁定提示）
      const barW = 342;
      const barH = 40;
      const barX = THEME.W - barW - 14;
      const barY = THEME.H - 86;
      drawRoundRect(
        ctx,
        barX,
        barY,
        barW,
        barH,
        6,
        posterUnlocked ? 'rgba(10, 26, 20, 0.86)' : 'rgba(18, 22, 24, 0.90)',
        posterUnlocked ? THEME.BORDER_GOLD : 'rgba(148, 163, 184, 0.45)',
        1.5
      );
      drawButton(ctx, hits, barX + 4, barY + 4, 34, 32, '◀', () => {
        this.selectedPosterIdx = (posterIdx - 1 + TITLE_POSTERS.length) % TITLE_POSTERS.length;
      }, { variant: 'ghost', fontSize: 13 });
      drawButton(ctx, hits, barX + barW - 38, barY + 4, 34, 32, '▶', () => {
        this.selectedPosterIdx = (posterIdx + 1) % TITLE_POSTERS.length;
      }, { variant: 'ghost', fontSize: 13 });

      const midX = barX + barW / 2;
      const titleLabel = posterUnlocked
        ? `${activePoster.stageLabel} · ${activePoster.title}`
        : `🔒 ${activePoster.stageLabel} · ${activePoster.title}`;
      drawText(ctx, fitText(ctx, titleLabel, barW - 92, 12.5, true), midX, barY + 14, {
        size: 12.5,
        bold: true,
        color: posterUnlocked ? THEME.GOLD_LIGHT : '#94A3B8',
        align: 'center',
      });
      const subLabel = posterUnlocked
        ? `主视觉 ${posterIdx + 1}/${TITLE_POSTERS.length} · 已解锁`
        : `未解锁 · ${activePoster.unlockHint} (${posterIdx + 1}/${TITLE_POSTERS.length})`;
      drawText(ctx, fitText(ctx, subLabel, barW - 92, 11), midX, barY + 30, {
        size: 11,
        color: posterUnlocked ? THEME.TX2 : '#64748B',
        align: 'center',
      });

      const verText = getRunningVersion();
      const verW = Math.max(132, verText.length * 7.2 + 24);
      drawRoundRect(ctx, THEME.W - verW - 14, THEME.H - 38, verW, 28, 3, THEME.BG_CARD_DARK, THEME.INK_LINE, 2);
      drawText(ctx, verText, THEME.W - 24, THEME.H - 24, {
        size: 12,
        color: THEME.TX2,
        align: 'right',
        mono: true,
      });
    }

    if (this.wizardOpen) {
      this.renderWizardModal(ctx, hits, metaLv, actions);
    }
  }

  /**
   * 标题页右侧主视觉：38 岁老将 #10 队长走出球员通道（粗墨线 + 硬二分阴影 + 球场探照光 + 雨丝）
   */
  private drawVeteranTunnelHero(ctx: CanvasRenderingContext2D, t: number): void {
    ctx.save();
    ctx.translate(770, 96);
    const scale = 1.06;
    ctx.scale(scale, scale);

    // 混凝土球员通道透视框
    ctx.fillStyle = '#07120D';
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 588);
    ctx.lineTo(86, 62);
    ctx.lineTo(368, 62);
    ctx.lineTo(454, 588);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 远端球场绿茵与强光通道口
    ctx.fillStyle = THEME.BG_PITCH_ALT;
    ctx.beginPath();
    ctx.moveTo(100, 82);
    ctx.lineTo(354, 82);
    ctx.lineTo(386, 405);
    ctx.lineTo(68, 405);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(244, 239, 228, 0.11)';
    ctx.beginPath();
    ctx.moveTo(114, 96);
    ctx.lineTo(340, 96);
    ctx.lineTo(366, 386);
    ctx.lineTo(88, 386);
    ctx.closePath();
    ctx.fill();

    // 探照灯炫光光晕（无 shadowBlur）
    ctx.fillStyle = 'rgba(244, 239, 228, 0.55)';
    ctx.beginPath();
    ctx.arc(166, 140, 22, 0, Math.PI * 2);
    ctx.arc(288, 140, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 242, 48, 0.24)';
    ctx.beginPath();
    ctx.arc(227, 130, 34 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
    ctx.fill();

    // 雨丝斜线
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.24)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    const rainPts: Array<[number, number, number]> = [
      [78, 118, 55], [148, 76, 65], [326, 92, 68], [394, 148, 62], [118, 256, 58], [352, 236, 64],
    ];
    for (const [rx, ry, rlen] of rainPts) {
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 14, ry + rlen);
      ctx.stroke();
    }

    // 双腿与球袜
    ctx.fillStyle = THEME.INK_LINE;
    ctx.strokeStyle = THEME.HARD_SHADOW;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(186, 412); ctx.lineTo(173, 566); ctx.lineTo(206, 566); ctx.lineTo(220, 424); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(240, 424); ctx.lineTo(256, 566); ctx.lineTo(290, 566); ctx.lineTo(274, 412); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // 球裤
    ctx.fillStyle = THEME.PAPER_INK;
    ctx.beginPath();
    ctx.moveTo(166, 352); ctx.lineTo(292, 352); ctx.lineTo(284, 430);
    ctx.lineTo(234, 430); ctx.lineTo(229, 396); ctx.lineTo(223, 430); ctx.lineTo(173, 430);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // 手臂
    ctx.fillStyle = '#C78B5D';
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(133, 294); ctx.lineTo(122, 372); ctx.lineTo(148, 377); ctx.lineTo(162, 298); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(296, 298); ctx.lineTo(308, 377); ctx.lineTo(334, 372); ctx.lineTo(323, 294); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // 红色 10 号球衣躯干 + 二分硬阴影
    ctx.fillStyle = THEME.VERMILION;
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(146, 206); ctx.lineTo(183, 182); ctx.lineTo(273, 182); ctx.lineTo(310, 206);
    ctx.lineTo(326, 294); ctx.lineTo(292, 300); ctx.lineTo(284, 244); ctx.lineTo(284, 358);
    ctx.lineTo(172, 358); ctx.lineTo(172, 244); ctx.lineTo(164, 300); ctx.lineTo(130, 294);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#9E2219';
    ctx.beginPath();
    ctx.moveTo(172, 244); ctx.lineTo(226, 238); ctx.lineTo(220, 358); ctx.lineTo(172, 358); ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 球衣背面大号 #10
    ctx.save();
    ctx.font = `italic 900 72px ${THEME.DISPLAY_FONT_NUM}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.strokeText('10', 228, 282);
    ctx.fillStyle = THEME.PAPER_CREAM;
    ctx.fillText('10', 228, 282);
    ctx.restore();

    // 左臂荧光绿队长袖标 'C'
    ctx.save();
    ctx.translate(150, 262);
    ctx.rotate(-0.18);
    ctx.fillStyle = THEME.LIME;
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 3;
    ctx.fillRect(-16, -9, 32, 18);
    ctx.strokeRect(-16, -9, 32, 18);
    drawText(ctx, 'C', 0, 1, { size: 13, bold: true, color: THEME.PAPER_INK, align: 'center', rawSize: true });
    ctx.restore();

    // 颈部与头部剪影 + 轮廓亮边
    ctx.fillStyle = '#9B633B';
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 4;
    ctx.fillRect(212, 154, 32, 32);
    ctx.strokeRect(212, 154, 32, 32);

    ctx.fillStyle = THEME.INK_LINE;
    ctx.beginPath();
    ctx.moveTo(200, 124);
    ctx.bezierCurveTo(200, 92, 256, 92, 256, 124);
    ctx.bezierCurveTo(256, 152, 244, 164, 228, 164);
    ctx.bezierCurveTo(212, 164, 200, 152, 200, 124);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(244, 239, 228, 0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(205, 114);
    ctx.quadraticCurveTo(228, 96, 251, 114);
    ctx.stroke();

    // 漫画动势速度线
    ctx.strokeStyle = THEME.LIME;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(88, 248); ctx.lineTo(123, 242);
    ctx.moveTo(368, 252); ctx.lineTo(336, 246);
    ctx.moveTo(98, 318); ctx.lineTo(126, 316);
    ctx.stroke();

    ctx.restore();
  }

  private renderWizardModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    metaLv: { scout: number; finance: number; [key: string]: number },
    actions: {
      onStartNewSeason: (opts: NewSeasonOptions) => void;
      onEditName?: (current: string, apply: (next: string) => void) => void;
    }
  ): void {
    ctx.fillStyle = 'rgba(10, 26, 20, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 116;
    const my = 44;
    const mw = 1048;
    const mh = 632;
    drawPrintCard(ctx, mx, my, mw, mh, { paper: false, topBandColor: THEME.BRASS, radius: 12, shadowOffset: 6 });

    drawText(ctx, '新赛季建队向导', mx + 26, my + 38, { size: 22, bold: true, color: THEME.BRASS });
    const steps: Array<[1 | 2, string]> = [
      [1, '1. 俱乐部形象室'],
      [2, '2. 阵型与战术星盘'],
    ];
    steps.forEach(([s, lbl], i) => {
      drawButton(ctx, hits, mx + 236 + i * 212, my + 16, 198, 44, lbl, () => {
        if (s === 2) this.enterStep2();
        else this.wizardStep = 1;
      }, { active: this.wizardStep === s, fontSize: 14 });
    });
    drawButton(ctx, hits, mx + mw - 106, my + 16, 84, 44, '关闭', () => {
      this.wizardOpen = false;
    }, { variant: 'ghost', fontSize: 14, icon: 'close' });

    const sx = mx + 24;
    const sy = my + 74;
    const sw = this.wizardStep === 2 ? 324 : 286;
    const sh = 526;

    if (this.wizardStep === 1) {
      this.renderStep1LeftShowcase(ctx, hits, sx, sy, sw, sh, metaLv);
    } else {
      this.renderStep2AstrolabeViewport(ctx, sx, sy, sw, sh);
    }

    const rx = sx + sw + 22;
    const ry = my + 74;
    const rw = mx + mw - rx - 24;

    if (this.wizardStep === 1) {
      this.renderStep1RightPanel(ctx, hits, rx, ry, rw, actions);
      drawButton(ctx, hits, mx + mw - 266, my + mh - 62, 242, 46, '下一步：星盘与哲学 ▶', () => {
        this.enterStep2();
      }, { variant: 'primary', fontSize: 15, icon: 'sparkle' });
    } else {
      this.renderStep2RightPanel(ctx, hits, rx, ry, rw);
      drawButton(ctx, hits, rx, my + mh - 62, 148, 46, '◀ 上一步', () => {
        this.wizardStep = 1;
      }, { variant: 'ghost', fontSize: 14 });
      drawButton(ctx, hits, mx + mw - 318, my + mh - 62, 294, 46, '确认建队 · 开启核心开包 ▶', () => {
        this.wizardOpen = false;
        actions.onStartNewSeason({
          clubId: this.selectedClubId,
          customName: this.customName,
          primaryColor: this.primaryColor,
          secondaryColor: this.secondaryColor,
          awayPrimaryColor: this.awayPrimaryColor,
          awaySecondaryColor: this.awaySecondaryColor,
          formation: this.formation,
          style: this.style,
        });
      }, { variant: 'primary', fontSize: 15, icon: 'sparkle' });
    }
  }

  private renderStep1LeftShowcase(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    metaLv: { scout: number; finance: number; [key: string]: number }
  ): void {
    const isHome = this.previewKitMode === 'home';
    const activeKit = {
      id: this.selectedClubId,
      primaryColor: isHome ? this.primaryColor : this.awayPrimaryColor,
      secondaryColor: isHome ? this.secondaryColor : this.awaySecondaryColor,
    };
    const crestClub = {
      id: this.selectedClubId,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
    };

    drawPrintCard(ctx, sx, sy, sw, sh, { paper: false, topBandColor: activeKit.primaryColor, topBandHeight: 6, radius: 8, shadowOffset: 5, strokeColor: THEME.INK_LINE, lineWidth: 2.5 });

    ctx.save();
    const spot = ctx.createRadialGradient(sx + sw / 2, sy + 188, 14, sx + sw / 2, sy + 188, 148);
    spot.addColorStop(0, `${activeKit.primaryColor}38`);
    spot.addColorStop(0.55, `${activeKit.secondaryColor}16`);
    spot.addColorStop(1, 'rgba(10, 26, 20, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(sx + 4, sy + 6, sw - 8, 336);
    ctx.restore();

    drawButton(ctx, hits, sx + 18, sy + 18, 120, 32, '主场战袍', () => {
      this.previewKitMode = 'home';
    }, { active: isHome, variant: isHome ? 'gold' : 'ghost', fontSize: 12.5 });
    drawButton(ctx, hits, sx + 148, sy + 18, 120, 32, '客场战袍', () => {
      this.previewKitMode = 'away';
    }, { active: !isHome, variant: !isHome ? 'primary' : 'ghost', fontSize: 12.5 });

    const jerseyFloat = Math.sin(this.ambientTime * 2.1) * 3;
    drawJerseyIcon(ctx, sx + sw / 2, sy + 176 + jerseyFloat, 118, activeKit, 10);
    drawRoundRect(ctx, sx + sw - 74, sy + 64, 56, 56, 28, THEME.BG_DEEP, THEME.INK_LINE, 2.2);
    drawClubCrest(ctx, sx + sw - 46, sy + 92, 22, crestClub);

    drawBadge(
      ctx,
      sx + sw / 2 - 68,
      sy + 266,
      136,
      24,
      isHome ? 'HOME KIT · 主场' : 'AWAY KIT · 客场',
      THEME.BG_DEEP,
      isHome ? THEME.BRASS : THEME.LIME
    );

    drawText(ctx, this.customName.slice(0, 12), sx + sw / 2, sy + 318, {
      size: 21,
      bold: true,
      color: THEME.TX1,
      align: 'center',
    });
    drawText(ctx, fitText(ctx, `EST. 2026 · ${this.formation} · ${TACTICAL_PRESETS[this.style].name}`, sw - 28, FONT.LABEL, false, true), sx + sw / 2, sy + 346, {
      token: 'LABEL',
      color: THEME.BRASS,
      align: 'center',
    });

    drawPrintCard(ctx, sx + 18, sy + 378, sw - 36, 114, { paper: true, radius: 6, shadowOffset: 3, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    const startFunds = 900 + (metaLv.finance || 0) * 150;
    drawText(ctx, '初始资金', sx + 30, sy + 402, { token: 'MICRO', bold: true, color: THEME.PAPER_MUTED });
    drawText(ctx, formatFunds(startFunds), sx + sw - 30, sy + 402, { token: 'BODY', bold: true, color: '#15803D', align: 'right', mono: true });
    drawText(ctx, '建队流程', sx + 30, sy + 434, { token: 'MICRO', bold: true, color: THEME.PAPER_MUTED });
    drawText(ctx, '3核心包 → 夏窗26人', sx + sw - 30, sy + 434, { token: 'LABEL', bold: true, color: THEME.VERMILION, align: 'right' });
    drawText(ctx, '防撞色', sx + 30, sy + 466, { token: 'MICRO', bold: true, color: THEME.PAPER_MUTED });
    drawText(ctx, '已启用 · 客场自动切换', sx + sw - 30, sy + 466, { token: 'MICRO', bold: true, color: THEME.COBALT, align: 'right' });
  }

  private renderStep1RightPanel(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    rx: number,
    ry: number,
    rw: number,
    actions: { onEditName?: (current: string, apply: (next: string) => void) => void }
  ): void {
    drawText(ctx, '俱乐部名称', rx, ry + 14, { size: 15, bold: true, color: THEME.BRASS });
    drawText(ctx, '点击输入框自定义（最多 12 字）或随机生成', rx + 104, ry + 14, { size: 13, color: THEME.TX2 });

    const nameBoxW = rw - 166;
    drawRoundRect(ctx, rx, ry + 32, nameBoxW, 46, 8, THEME.BG_CARD, hits.isHovered(rx, ry + 32, nameBoxW, 46) ? THEME.LIME : THEME.INK_LINE, 2.2);
    drawText(ctx, this.customName, rx + 18, ry + 55, { size: 19, bold: true, color: THEME.TX1 });
    drawIcon(ctx, 'edit', rx + nameBoxW - 72, ry + 55, 14, THEME.BRASS);
    drawText(ctx, '编辑', rx + nameBoxW - 16, ry + 55, { size: 13.5, color: THEME.BRASS, align: 'right' });
    if (actions.onEditName) {
      hits.addTouchTarget(rx, ry + 32, nameBoxW, 46, () => {
        SoundEngine.playClick();
        actions.onEditName!(this.customName, (next) => {
          this.customName = next;
        });
      });
    }
    drawButton(ctx, hits, rx + nameBoxW + 12, ry + 32, 154, 46, '随机队名', () => {
      this.customName = generateFictionalClubName();
    }, { variant: 'primary', fontSize: 14, icon: 'dice' });

    drawText(ctx, '选择队徽与底色模板', rx, ry + 100, { size: 15, bold: true, color: THEME.BRASS });
    FICTIONAL_CLUBS.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bw = Math.floor((rw - 12) / 2);
      const bx = rx + col * (bw + 12);
      const by = ry + 118 + row * 46;
      const active = this.selectedClubId === c.id;
      drawRoundRect(ctx, bx, by, bw, 42, 7, active ? THEME.BG_PITCH_ALT : THEME.BG_CARD, active ? THEME.LIME : THEME.INK_LINE, active ? 2.5 : 1.8);
      drawClubCrest(ctx, bx + 22, by + 21, 13, c);
      drawText(ctx, c.name, bx + 44, by + 21, { size: 14, bold: active, color: active ? THEME.LIME : THEME.TX1 });
      drawRoundRect(ctx, bx + bw - 44, by + 14, 14, 14, 7, c.primaryColor, THEME.INK_LINE, 1.5);
      drawRoundRect(ctx, bx + bw - 24, by + 14, 14, 14, 7, c.secondaryColor, THEME.INK_LINE, 1.5);
      hits.addTouchTarget(bx, by, bw, 44, () => {
        SoundEngine.playClick();
        this.selectTemplate(c.id);
      });
    });

    const isHome = this.previewKitMode === 'home';
    const palY = ry + 306;
    drawRoundRect(ctx, rx, palY, rw, 158, 10, THEME.BG_PANEL, THEME.INK_LINE, 2.2);
    drawText(
      ctx,
      isHome ? '自定义主场战袍配色' : '自定义客场战袍配色',
      rx + 16,
      palY + 26,
      { size: 14.5, bold: true, color: isHome ? THEME.BRASS : '#7DD3FC' }
    );
    drawButton(ctx, hits, rx + rw - 176, palY + 6, 160, 44, isHome ? '切换编辑客场 ⇄' : '切换编辑主场 ⇄', () => {
      this.previewKitMode = isHome ? 'away' : 'home';
    }, { variant: 'ghost', fontSize: 13 });

    const curPrimPalette = isHome ? HOME_PRIMARY_PALETTE : AWAY_PRIMARY_PALETTE;
    const curSecPalette = isHome ? HOME_SECONDARY_PALETTE : AWAY_SECONDARY_PALETTE;
    const curPrimVal = isHome ? this.primaryColor : this.awayPrimaryColor;
    const curSecVal = isHome ? this.secondaryColor : this.awaySecondaryColor;

    drawText(ctx, '主色:', rx + 16, palY + 74, { size: 14, bold: true, color: THEME.TX2 });
    curPrimPalette.forEach((col, i) => {
      const px = rx + 68 + i * 50;
      const sel = curPrimVal === col;
      drawRoundRect(ctx, px, palY + 52, 44, 44, 7, col, sel ? THEME.LIME : THEME.INK_LINE, sel ? 3 : 2);
      if (sel) {
        const chk = col === '#F8FAFC' || col === '#FACC15' ? '#141916' : '#F4EFE4';
        drawIcon(ctx, 'check', px + 22, palY + 74, 14, chk);
      }
      hits.addTouchTarget(px, palY + 52, 44, 44, () => {
        SoundEngine.playClick();
        if (isHome) this.primaryColor = col;
        else this.awayPrimaryColor = col;
      });
    });

    drawText(ctx, '副色:', rx + 16, palY + 124, { size: 14, bold: true, color: THEME.TX2 });
    curSecPalette.forEach((col, i) => {
      const px = rx + 68 + i * 50;
      const sel = curSecVal === col;
      drawRoundRect(ctx, px, palY + 102, 44, 44, 7, col, sel ? THEME.LIME : THEME.INK_LINE, sel ? 3 : 2);
      if (sel) {
        const chk = col === '#F8FAFC' || col === '#FACC15' ? '#141916' : '#F4EFE4';
        drawIcon(ctx, 'check', px + 22, palY + 124, 14, chk);
      }
      hits.addTouchTarget(px, palY + 102, 44, 44, () => {
        SoundEngine.playClick();
        if (isHome) this.secondaryColor = col;
        else this.awaySecondaryColor = col;
      });
    });

    drawText(
      ctx,
      '比赛撞色自动切客场战袍',
      rx + rw - 16,
      palY + 124,
      { size: 12.5, color: THEME.TX2, align: 'right' }
    );
  }

  /**
   * Step 2 左侧：放大后的八卦星盘正上方局部视口
   * - 100% 复用星盘视觉与弹簧旋转，只展示当前选中的阵型(内环)、打法(外环)及二者碰撞的融合奇点
   */
  private renderStep2AstrolabeViewport(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    sw: number,
    sh: number
  ): void {
    const sys = getDefenseSystem(this.formation);
    const styleInfo = STYLE_LABELS[this.style];
    const sysInfo = SYSTEM_LABELS[sys];
    const fusion = V6_FUSION_KEYSTONES.find(f => f.system === sys && f.style === this.style)!;

    const pEnter = Math.min(1, this.step2AnimTime / 0.55);
    const pScale = easeOutCubic(pEnter);
    const pFade = Math.min(1, this.step2AnimTime / 0.28);
    const scaleFactor = 0.62 + 0.38 * pScale;

    drawPrintCard(ctx, sx, sy, sw, sh, { paper: false, topBandColor: styleInfo.color, topBandHeight: 6, radius: 8, shadowOffset: 5, strokeColor: THEME.INK_LINE, lineWidth: 2.5 });

    ctx.save();
    ctx.beginPath();
    ctx.rect(sx + 2, sy + 2, sw - 4, sh - 4);
    ctx.clip();
    ctx.globalAlpha = pFade;

    const cx = sx + sw / 2;
    const baseR = 408 * scaleFactor;
    const cy = sy + sh + 40;

    // 1. 星空底图 + 8层同心轨道 + 对齐冲击波
    drawAstrolabeBackdropAndRings(
      ctx,
      cx,
      cy,
      baseR,
      { x: sx, y: sy, w: sw, h: sh },
      this.ambientTime,
      this.rotFlashTimer,
      this.rotFlashRing,
      { backdropAlpha: 0.52, topArchOnly: true }
    );

    // 2. Step1 -> Step2 降临星芒扫射光柱
    if (this.step2AnimTime < 0.85) {
      const bp = this.step2AnimTime / 0.85;
      const bAlpha = Math.max(0, (1 - bp) * 0.72);
      const fx = cx;
      const fy = cy - baseR * 0.50;
      ctx.save();
      const burstGrad = ctx.createRadialGradient(fx, fy, 4, fx, fy, 220 * (0.4 + bp * 0.9));
      burstGrad.addColorStop(0, `rgba(254, 240, 138, ${bAlpha.toFixed(3)})`);
      burstGrad.addColorStop(0.35, `${styleInfo.color}${Math.round(bAlpha * 140).toString(16).padStart(2, '0')}`);
      burstGrad.addColorStop(1, 'rgba(10, 26, 20, 0)');
      ctx.fillStyle = burstGrad;
      ctx.fillRect(sx, sy, sw, sh);

      // 8道金色星盘校准光线
      ctx.strokeStyle = `rgba(254, 240, 138, ${(bAlpha * 0.55).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      for (let ri = 0; ri < 8; ri++) {
        const ra = -Math.PI / 2 + ((ri - 3.5) * 0.22);
        const rLen = 70 + bp * 190;
        ctx.beginPath();
        ctx.moveTo(fx + Math.cos(ra) * 18, fy + Math.sin(ra) * 18);
        ctx.lineTo(fx + Math.cos(ra) * rLen, fy + Math.sin(ra) * rLen);
        ctx.stroke();
      }
      ctx.restore();
    }

    const outerAngle = -Math.PI / 2 + this.outerRotOffset;
    const innerAngle = -Math.PI / 2 + this.innerRotOffset;

    // 3. 仅绘制当前已选外环扇区高亮光带（其余5个扇区不可见）
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, baseR * 1.04, outerAngle - Math.PI / 6, outerAngle + Math.PI / 6);
    ctx.closePath();
    const wedgeGrad = ctx.createRadialGradient(cx, cy, baseR * 0.45, cx, cy, baseR * 1.02);
    wedgeGrad.addColorStop(0, `${styleInfo.color}08`);
    wedgeGrad.addColorStop(0.55, `${styleInfo.color}24`);
    wedgeGrad.addColorStop(1, `${styleInfo.color}0A`);
    ctx.fillStyle = wedgeGrad;
    ctx.fill();
    ctx.strokeStyle = `${styleInfo.color}66`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();

    // 4. 仅绘制当前已选内环防线扇区高亮光带（其余2个体系不可见）
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, baseR * 0.48, innerAngle - Math.PI / 5, innerAngle + Math.PI / 5);
    ctx.closePath();
    ctx.fillStyle = `${sysInfo.color}1C`;
    ctx.fill();
    ctx.strokeStyle = `${sysInfo.color}55`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 5. 计算正上方局部节点坐标
    const polar = (ang: number, ratio: number) => ({
      x: cx + Math.cos(ang) * (baseR * ratio),
      y: cy + Math.sin(ang) * (baseR * ratio),
    });

    const sysOriginId = SYSTEM_ORIGIN_PASSIVE[sys];
    const sysOriginDef = V6_PASSIVE_MAP[sysOriginId];
    const sysOriginPos = polar(innerAngle, 0.295);
    const formPos = polar(innerAngle, 0.40);

    const fusionPos = polar(-Math.PI / 2, 0.50);

    const styleOriginId = STYLE_ORIGIN_PASSIVE[this.style];
    const styleOriginDef = V6_PASSIVE_MAP[styleOriginId];
    const styleOriginPos = polar(outerAngle, 0.595);

    const stylePassives = V6_STYLE_PASSIVES.filter(p => p.style === this.style && p.id !== styleOriginId);
    const atkPassive = stylePassives.find(p => p.tendency === 'ATK');
    const defPassive = stylePassives.find(p => p.tendency === 'DEF');
    const atkPassivePos = polar(outerAngle - 0.145, 0.685);
    const defPassivePos = polar(outerAngle + 0.145, 0.685);

    const styleSkills = V6_ACTIVE_SKILLS.filter(s => s.source === 'style' && s.style === this.style);
    const atkSkill = styleSkills.find(s => s.tendency !== 'DEF') ?? styleSkills[0];
    const defSkill = styleSkills.find(s => s.tendency === 'DEF') ?? styleSkills[1];
    const atkSkillPos = polar(outerAngle - 0.162, 0.79);
    const defSkillPos = polar(outerAngle + 0.162, 0.79);

    const styleDirs = V6_DIRECTIVES.filter(d => d.source === 'style' && d.style === this.style && d.route === 'steady');
    const atkDir = styleDirs.find(d => d.tendency === 'ATK') ?? styleDirs[0];
    const defDir = styleDirs.find(d => d.tendency === 'DEF') ?? styleDirs[1];
    const atkDirPos = polar(outerAngle - 0.115, 0.895);
    const defDirPos = polar(outerAngle + 0.115, 0.895);

    const emblemPos = polar(outerAngle, 0.725);

    // 6. 先画星轨连线（与 MetaScreen 保持一致的发光 + 粒子流）
    drawAstrolabeEdgeLine(ctx, sysOriginPos.x, sysOriginPos.y, formPos.x, formPos.y, true, false, sysInfo.color, this.ambientTime, false);
    drawAstrolabeEdgeLine(ctx, sysOriginPos.x, sysOriginPos.y, fusionPos.x, fusionPos.y, true, false, THEME.GOLD_LIGHT, this.ambientTime, true);
    drawAstrolabeEdgeLine(ctx, fusionPos.x, fusionPos.y, styleOriginPos.x, styleOriginPos.y, true, false, THEME.GOLD_LIGHT, this.ambientTime, true);

    if (atkPassive) {
      drawAstrolabeEdgeLine(ctx, styleOriginPos.x, styleOriginPos.y, atkPassivePos.x, atkPassivePos.y, true, false, styleInfo.color, this.ambientTime);
    }
    if (defPassive) {
      drawAstrolabeEdgeLine(ctx, styleOriginPos.x, styleOriginPos.y, defPassivePos.x, defPassivePos.y, true, false, styleInfo.color, this.ambientTime);
    }
    if (atkSkill && atkPassive) {
      drawAstrolabeEdgeLine(ctx, atkPassivePos.x, atkPassivePos.y, atkSkillPos.x, atkSkillPos.y, true, false, '#38BDF8', this.ambientTime);
    }
    if (defSkill && defPassive) {
      drawAstrolabeEdgeLine(ctx, defPassivePos.x, defPassivePos.y, defSkillPos.x, defSkillPos.y, true, false, '#38BDF8', this.ambientTime);
    }
    if (atkDir && atkPassive) {
      drawAstrolabeEdgeLine(ctx, atkPassivePos.x, atkPassivePos.y, atkDirPos.x, atkDirPos.y, true, false, ASTROLABE_ZONE_COLOR[atkDir.zone], this.ambientTime);
    }
    if (defDir && defPassive) {
      drawAstrolabeEdgeLine(ctx, defPassivePos.x, defPassivePos.y, defDirPos.x, defDirPos.y, true, false, ASTROLABE_ZONE_COLOR[defDir.zone], this.ambientTime);
    }

    // 7. 绘制各层星盘节点
    // 7a. 内环：防线体系原点 + 当前选中阵型
    if (sysOriginDef) {
      drawAstrolabeCircleNode(
        ctx,
        sysOriginPos.x,
        sysOriginPos.y,
        12,
        getAstrolabePassiveGlyph(sysOriginDef),
        sysInfo.color,
        true,
        false,
        false,
        this.ambientTime,
        true
      );
      drawText(ctx, sysInfo.name.slice(0, 3), sysOriginPos.x + 18, sysOriginPos.y + 4, {
        size: 12,
        bold: true,
        color: sysInfo.color,
      });
    }

    ctx.save();
    ctx.fillStyle = THEME.BG_PITCH_ALT;
    ctx.beginPath();
    ctx.arc(formPos.x, formPos.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = THEME.LIME;
    ctx.stroke();
    ctx.restore();
    drawText(ctx, this.formation, formPos.x, formPos.y + 1, {
      size: 12,
      bold: true,
      color: THEME.TX1,
      align: 'center',
      mono: true,
    });

    drawAstrolabeHexFusionNode(
      ctx,
      fusionPos.x,
      fusionPos.y,
      15.5,
      true,
      false,
      true,
      this.ambientTime
    );

    if (styleOriginDef) {
      drawAstrolabeCircleNode(
        ctx,
        styleOriginPos.x,
        styleOriginPos.y,
        13,
        getAstrolabePassiveGlyph(styleOriginDef),
        styleInfo.color,
        true,
        false,
        false,
        this.ambientTime,
        true
      );
    }

    ctx.save();
    ctx.fillStyle = THEME.BG_PANEL;
    ctx.beginPath();
    ctx.arc(emblemPos.x, emblemPos.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = THEME.BRASS;
    ctx.stroke();
    ctx.strokeStyle = `${styleInfo.color}99`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(emblemPos.x, emblemPos.y, 24.5, this.ambientTime * 0.55, this.ambientTime * 0.55 + Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);
    drawSkillGlyph(ctx, ASTROLABE_STYLE_GLYPH[this.style], emblemPos.x, emblemPos.y, 24, styleInfo.color, THEME.BRASS);
    ctx.restore();

    if (atkPassive) {
      drawAstrolabeCircleNode(ctx, atkPassivePos.x, atkPassivePos.y, 8.5, getAstrolabePassiveGlyph(atkPassive), styleInfo.color, true, false, false, this.ambientTime);
    }
    if (defPassive) {
      drawAstrolabeCircleNode(ctx, defPassivePos.x, defPassivePos.y, 8.5, getAstrolabePassiveGlyph(defPassive), styleInfo.color, true, false, false, this.ambientTime);
    }
    if (atkSkill) {
      drawAstrolabeDiamondSkillNode(ctx, atkSkillPos.x, atkSkillPos.y, 10.5, ASTROLABE_STYLE_GLYPH[this.style], true, false, true, false, atkSkill.name);
    }
    if (defSkill) {
      drawAstrolabeDiamondSkillNode(ctx, defSkillPos.x, defSkillPos.y, 10.5, ASTROLABE_STYLE_GLYPH[this.style], true, false, true, false, defSkill.name);
    }
    if (atkDir) {
      drawAstrolabeDirectiveNode(ctx, cx, cy, atkDirPos.x, atkDirPos.y, 9, atkDir.tendency, atkDir.zone, true, false, true, false, [], atkDir.name);
    }
    if (defDir) {
      drawAstrolabeDirectiveNode(ctx, cx, cy, defDirPos.x, defDirPos.y, 9, defDir.tendency, defDir.zone, true, false, true, false, [], defDir.name);
    }

    drawRoundRect(ctx, sx + 12, sy + 12, sw - 24, 52, 8, THEME.BG_DEEP, styleInfo.color, 2);
    drawSkillGlyph(ctx, ASTROLABE_SYSTEM_GLYPH[sys], sx + 32, sy + 38, 19, sysInfo.color, THEME.BRASS);
    drawText(ctx, `${styleInfo.name} × ${this.formation}`, sx + sw / 2, sy + 28, {
      size: 14.5,
      bold: true,
      color: THEME.TX1,
      align: 'center',
    });
    drawText(ctx, '星盘正上方 · 已选共鸣预览', sx + sw / 2, sy + 49, {
      size: 12,
      color: styleInfo.color,
      align: 'center',
    });
    drawSkillGlyph(ctx, ASTROLABE_STYLE_GLYPH[this.style], sx + sw - 32, sy + 38, 19, styleInfo.color, THEME.BRASS);

    drawRoundRect(ctx, sx + 12, sy + sh - 66, sw - 24, 54, 8, THEME.BG_DEEP, THEME.BRASS, 2);
    drawText(ctx, `✦ 碰撞奇点：${fusion.name}`, sx + sw / 2, sy + sh - 46, {
      size: 13.5,
      bold: true,
      color: THEME.BRASS,
      align: 'center',
    });
    drawText(ctx, `${fusion.branchA.label} / ${fusion.branchB.label}`, sx + sw / 2, sy + sh - 24, {
      size: 12,
      color: THEME.TX1,
      align: 'center',
    });

    ctx.restore();
  }

  private renderStep2RightPanel(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    rx: number,
    ry: number,
    rw: number
  ): void {
    const pRight = easeOutCubic(Math.min(1, Math.max(0, (this.step2AnimTime - 0.08) / 0.42)));
    const yOff = Math.round((1 - pRight) * 14);

    ctx.save();
    ctx.globalAlpha = Math.max(0.05, pRight);
    const baseY = ry + yOff;

    // 1. 阵型选择 (4/3/5后卫)
    drawText(ctx, '选择初始阵型 (内环防线)', rx, baseY + 12, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    SYS_TABS.forEach((sys, si) => {
      const lbl = sys === '4-back' ? '四后卫 (8)' : sys === '3-back' ? '三后卫 (4)' : '五后卫 (4)';
      drawButton(ctx, hits, rx + rw - 372 + si * 126, baseY + 1, 118, 24, lbl, () => {
        this.sysTab = sys;
      }, { active: this.sysTab === sys, fontSize: 12 });
    });

    const forms = FORMATION_SYSTEMS[this.sysTab].formations;
    const fw = Math.floor((rw - 30) / 4);
    forms.forEach((f, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      drawButton(ctx, hits, rx + col * (fw + 10), baseY + 32 + row * 34, fw, 29, f, () => {
        this.selectFormation(f);
      }, { active: this.formation === f, fontSize: 12 });
    });

    // 2. 六大战术哲学选择 (外环打法)
    const styleY = baseY + 108;
    drawText(ctx, '选择战术哲学 (外环打法)', rx, styleY + 10, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    const swBtn = Math.floor((rw - 20) / 3);
    STYLE_LIST.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = rx + col * (swBtn + 10);
      const by = styleY + 26 + row * 40;
      const active = this.style === s;
      const sCol = STYLE_LABELS[s].color;
      drawRoundRect(
        ctx,
        bx,
        by,
        swBtn,
        34,
        6,
        active ? THEME.BG_PITCH_ALT : THEME.BG_CARD_DARK,
        active ? sCol : hits.isHovered(bx, by, swBtn, 34) ? THEME.BRASS : THEME.INK_LINE,
        active ? 2.5 : 1.8
      );
      ctx.fillStyle = sCol;
      ctx.beginPath();
      ctx.arc(bx + 16, by + 17, 4.5, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, TACTICAL_PRESETS[s].name, bx + 28, by + 17, {
        size: 12.5,
        bold: active,
        color: active ? THEME.LIME : THEME.TX1,
      });
      if (active) {
        drawText(ctx, '★', bx + swBtn - 16, by + 17, { size: 12, color: sCol, align: 'center' });
      }
      hits.addTouchTarget(bx, by, swBtn, 34, () => {
        this.selectStyle(s);
      });
    });

    // 3. 实时「阵型 × 打法」协同看板：左侧五维雷达优劣势 + 右侧代表技能与手牌
    const dashY = styleY + 114;
    const dashH = 226;
    const sys = getDefenseSystem(this.formation);
    const styleInfo = STYLE_LABELS[this.style];
    drawPrintCard(ctx, rx, dashY, rw, dashH, { paper: false, topBandColor: styleInfo.color, topBandHeight: 5, radius: 8, shadowOffset: 5, strokeColor: THEME.INK_LINE, lineWidth: 2.5 });

    // 3a. 左侧：图形化五维雷达图 + 优势/短板
    const leftW = 266;
    drawText(ctx, `战术画像 · ${SYSTEM_NOTE[sys]}`, rx + 14, dashY + 20, {
      size: 12.5,
      bold: true,
      color: THEME.BRASS,
    });

    const baseAxes = STYLE_BASE_RADAR[this.style];
    const sysDelta = SYSTEM_RADAR_DELTA[sys];
    const axes = baseAxes.map((v, idx) => Math.max(20, Math.min(98, v + sysDelta[idx])));
    this.drawTacticalRadar(
      ctx,
      rx + leftW / 2,
      dashY + 102,
      50,
      axes,
      ['控球', '逼抢', '防守', '边路', '反击'],
      styleInfo.color
    );

    const pc = STYLE_PROS_CONS[this.style];
    drawRoundRect(ctx, rx + 12, dashY + 164, leftW - 20, 26, 4, THEME.BG_PITCH_ALT, THEME.INK_LINE, 1.5);
    drawText(ctx, `优：${fitText(ctx, pc.pros, leftW - 36, 12)}`, rx + 20, dashY + 177, {
      size: 12,
      bold: true,
      color: THEME.LIME,
    });
    drawRoundRect(ctx, rx + 12, dashY + 194, leftW - 20, 26, 4, 'rgba(224, 58, 46, 0.22)', THEME.INK_LINE, 1.5);
    drawText(ctx, `弱：${fitText(ctx, pc.cons, leftW - 36, 12)}`, rx + 20, dashY + 207, {
      size: 12,
      bold: true,
      color: '#FCA5A5',
    });

    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx + leftW + 4, dashY + 12);
    ctx.lineTo(rx + leftW + 4, dashY + dashH - 12);
    ctx.stroke();

    const rColX = rx + leftW + 16;
    const rColW = rw - leftW - 28;

    const styleSkill = V6_ACTIVE_SKILLS.find(s => s.source === 'style' && s.style === this.style);
    const formSkill = V6_ACTIVE_SKILLS.find(s => s.source === 'formation' && s.formation === this.formation);
    const repSkills = [styleSkill, formSkill].filter((x): x is NonNullable<typeof x> => !!x).slice(0, 2);

    drawText(ctx, '代表主动技 (星盘解锁后 F 键瞬发)', rColX, dashY + 20, {
      size: 12.5,
      bold: true,
      color: THEME.LIME,
    });
    repSkills.forEach((sk, idx) => {
      const cardY = dashY + 32 + idx * 44;
      drawPrintCard(ctx, rColX, cardY, rColW, 40, { paper: true, radius: 5, shadowOffset: 2, strokeColor: THEME.INK_LINE, lineWidth: 1.8 });
      drawBadge(ctx, rColX + 6, cardY + 8, 54, 24, sk.source === 'formation' ? '阵型技' : '流派技', THEME.BG_PANEL, THEME.LIME);
      drawText(ctx, sk.name, rColX + 66, cardY + 13, { size: 13, bold: true, color: THEME.PAPER_INK });
      drawText(ctx, fitText(ctx, `${sk.situationLabel} · ${sk.instantLabel}`, rColW - 74, 12), rColX + 66, cardY + 30, {
        size: 12,
        color: THEME.PAPER_MUTED,
      });
    });

    const styleDir = V6_DIRECTIVES.find(d => d.source === 'style' && d.style === this.style && d.route === 'steady');
    const formDir = V6_DIRECTIVES.find(d => d.source === 'formation' && d.formation === this.formation)
      ?? V6_DIRECTIVES.find(d => d.source === 'style' && d.style === this.style && d.id !== styleDir?.id);
    const repDirs = [styleDir, formDir].filter((x): x is NonNullable<typeof x> => !!x).slice(0, 2);

    const dirTitleY = dashY + 125;
    drawText(ctx, '代表临场手牌 (比赛四赛段拍板)', rColX, dirTitleY, {
      size: 12.5,
      bold: true,
      color: THEME.BRASS,
    });
    repDirs.forEach((d, idx) => {
      const cardY = dirTitleY + 12 + idx * 45;
      const zCol = ASTROLABE_ZONE_COLOR[d.zone];
      drawPrintCard(ctx, rColX, cardY, rColW, 41, { paper: true, radius: 5, shadowOffset: 2, strokeColor: THEME.INK_LINE, lineWidth: 1.8 });
      ctx.fillStyle = zCol;
      ctx.fillRect(rColX + 2, cardY + 4, 4, 33);
      drawBadge(ctx, rColX + 10, cardY + 9, 44, 24, `${d.tpCost}TP`, THEME.BG_PANEL, THEME.BRASS);
      drawText(ctx, `${d.name} (${ASTROLABE_ZONE_LABEL[d.zone]}·${d.tendency === 'ATK' ? '攻' : '守'})`, rColX + 60, cardY + 13, {
        size: 12.5,
        bold: true,
        color: THEME.PAPER_INK,
      });
      drawText(ctx, fitText(ctx, d.benefitSummary, rColW - 68, 12), rColX + 60, cardY + 30, {
        size: 12,
        bold: true,
        color: '#15803D',
      });
    });

    ctx.restore();
  }

  private drawTacticalRadar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    maxR: number,
    values: number[],
    labels: string[],
    accentColor: string
  ): void {
    const n = 5;
    ctx.save();
    for (const scale of [0.35, 0.68, 1.0]) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const px = cx + Math.cos(ang) * maxR * scale;
        const py = cy + Math.sin(ang) * maxR * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = scale === 1.0 ? 'rgba(244, 239, 228, 0.35)' : 'rgba(244, 239, 228, 0.16)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const ex = cx + Math.cos(ang) * maxR;
      const ey = cy + Math.sin(ang) * maxR;
      ctx.strokeStyle = 'rgba(244, 239, 228, 0.22)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const lx = cx + Math.cos(ang) * (maxR + 17);
      const ly = cy + Math.sin(ang) * (maxR + 14);
      drawText(ctx, `${labels[i]}`, lx, ly, {
        size: 12,
        bold: true,
        color: THEME.TX1,
        align: 'center',
      });
    }

    ctx.beginPath();
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = maxR * (values[i] / 100);
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      pts.push({ x: px, y: py });
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `${accentColor}44`;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    for (const pt of pts) {
      ctx.fillStyle = THEME.PAPER_CREAM;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
