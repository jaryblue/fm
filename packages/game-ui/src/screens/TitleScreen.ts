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
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawRoundRect,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  formatFunds,
  HitRegistry,
} from '../CanvasKit';
import { drawClubCrest, drawJerseyIcon } from '../ClubVisuals';
import { drawGameLogoEmblem, easeOutBack, easeOutCubic } from '../Motion';
import { getRunningVersion } from '../RuntimeInfo';
import { SoundEngine } from '../SoundEngine';
import { IS_MOBILE, THEME } from '../Theme';
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

export class TitleScreen {
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

    // 柔和暗调聚焦遮罩 + 球场扫射探照光束与飘浮金色微粒
    ctx.save();
    for (let bi = 0; bi < 2; bi++) {
      const originX = bi === 0 ? THEME.W * 0.14 : THEME.W * 0.86;
      const sweepX = THEME.W * 0.5 + Math.sin(this.ambientTime * 0.8 + bi * Math.PI) * 240;
      const beam = ctx.createLinearGradient(originX, 0, sweepX, THEME.H * 0.85);
      beam.addColorStop(0, bi === 0 ? 'rgba(250, 204, 21, 0.12)' : 'rgba(249, 115, 22, 0.11)');
      beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(originX - 24, 0);
      ctx.lineTo(originX + 24, 0);
      ctx.lineTo(sweepX + 200, THEME.H);
      ctx.lineTo(sweepX - 200, THEME.H);
      ctx.closePath();
      ctx.fill();
    }

    const centerScrim = ctx.createRadialGradient(THEME.W / 2, 330, 100, THEME.W / 2, 340, 580);
    centerScrim.addColorStop(0, 'rgba(6, 10, 18, 0.78)');
    centerScrim.addColorStop(0.65, 'rgba(6, 10, 18, 0.48)');
    centerScrim.addColorStop(1, 'rgba(6, 10, 18, 0.08)');
    ctx.fillStyle = centerScrim;
    ctx.fillRect(0, 0, THEME.W, THEME.H);

    for (let pi = 0; pi < 22; pi++) {
      const px = ((pi * 89 + Math.sin(this.ambientTime * 0.55 + pi) * 24) % THEME.W + THEME.W) % THEME.W;
      const py = THEME.H - ((this.ambientTime * (34 + (pi % 4) * 14) + pi * 61) % THEME.H);
      const pa = 0.18 + 0.24 * Math.sin(this.ambientTime * 2.2 + pi);
      ctx.fillStyle = pi % 3 === 0
        ? `rgba(249, 115, 22, ${Math.max(0.05, pa).toFixed(2)})`
        : `rgba(250, 204, 21, ${Math.max(0.05, pa).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.4 + (pi % 2) * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const pTitle = easeOutCubic(Math.min(1, this.enterTime / 0.35));
    const pLogo = easeOutBack(Math.min(1, this.enterTime / 0.45));
    const pCard = easeOutBack(Math.min(1, Math.max(0, (this.enterTime - 0.1) / 0.42)));
    const pBtns = easeOutCubic(Math.min(1, Math.max(0, (this.enterTime - 0.18) / 0.38)));

    // 右上角桌面端工具栏
    let toolRightX = 1256;
    if (actions.onQuitApp) {
      toolRightX -= 84;
      drawButton(ctx, hits, toolRightX, 24, 84, 36, '退出', actions.onQuitApp, { variant: 'ghost', fontSize: 12 });
      toolRightX -= 10;
    }
    if (actions.onOpenSettings) {
      toolRightX -= 88;
      drawButton(ctx, hits, toolRightX, 24, 88, 36, '设置', actions.onOpenSettings, { variant: 'ghost', fontSize: 12, icon: 'gear' });
      toolRightX -= 10;
    } else {
      toolRightX -= 102;
      drawButton(ctx, hits, toolRightX, 24, 102, 36, SoundEngine.getAudioModeLabel(), () => {
        SoundEngine.cycleAudioMode();
      }, { variant: 'ghost', fontSize: 12, icon: SoundEngine.muted ? 'sound_off' : 'sound_on' });
      toolRightX -= 10;
    }
    if (actions.onOpenSaveSlots) {
      toolRightX -= 116;
      drawButton(ctx, hits, toolRightX, 24, 116, 36, actions.activeSlotLabel || '存档位 1', actions.onOpenSaveSlots, { variant: 'primary', fontSize: 12 });
      toolRightX -= 10;
    }
    if (hasActiveRun && actions.onResetSave) {
      toolRightX -= 92;
      drawButton(ctx, hits, toolRightX, 24, 92, 36, '重置存档', actions.onResetSave, { variant: 'ghost', fontSize: 12 });
    }

    const cx = THEME.W / 2;

    // 1. 居中高燃主视觉 Logo
    const tyOff = Math.round((1 - pTitle) * 18);
    const logoSize = hasActiveRun ? 206 : 248;
    const logoCenterY = (hasActiveRun ? 168 : 204) + tyOff;
    ctx.save();
    ctx.globalAlpha = pTitle;

    const heroGlow = ctx.createRadialGradient(cx, logoCenterY, 24, cx, logoCenterY, 340);
    heroGlow.addColorStop(0, 'rgba(250, 204, 21, 0.24)');
    heroGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.14)');
    heroGlow.addColorStop(1, 'rgba(8, 12, 20, 0)');
    ctx.fillStyle = heroGlow;
    ctx.fillRect(cx - 360, logoCenterY - 170, 720, 340);

    ctx.save();
    ctx.translate(cx, logoCenterY);
    ctx.scale(pLogo, pLogo);
    drawGameLogoEmblem(ctx, 0, 0, logoSize, this.ambientTime, 'showcase');
    ctx.restore();
    ctx.restore();

    // 2. 统一半透明指令坞
    const cyOff = Math.round((1 - pCard) * 16);
    const floatY = Math.round(Math.sin(this.ambientTime * 1.8) * 2);
    const dockInnerW = 516;
    const dockPadX = 16;
    const dockPadY = 16;
    const dockW = dockInnerW + dockPadX * 2;
    const dockX = cx - dockW / 2;
    const dockY = (hasActiveRun ? 298 : 362) + cyOff + floatY;
    const row1H = hasActiveRun ? 108 : 58;
    const rowGap = 12;
    const row2H = 44;
    const dockH = dockPadY * 2 + row1H + rowGap + row2H;

    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, pCard));
    drawChamferPanel(
      ctx,
      dockX,
      dockY,
      dockW,
      dockH,
      14,
      'rgba(8, 13, 24, 0.80)',
      'rgba(250, 204, 21, 0.34)',
      1.4,
      THEME.FLAME
    );

    const innerX = dockX + dockPadX;
    const row1Y = dockY + dockPadY;

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

      drawChamferPanel(
        ctx,
        innerX,
        row1Y,
        dockInnerW,
        row1H,
        10,
        'rgba(14, 22, 40, 0.92)',
        THEME.BORDER_GOLD,
        1.2,
        userClub.primaryColor || THEME.GOLD_LIGHT
      );
      drawClubCrest(ctx, innerX + 52, row1Y + row1H / 2, 26, userClub);
      drawText(ctx, `第 ${st.seasonNumber} 赛季 · ${userClub.name}`, innerX + 96, row1Y + 38, {
        size: 19,
        bold: true,
        color: THEME.TX1,
      });
      drawText(ctx, `${phaseText} · ${userClub.formation}`, innerX + 96, row1Y + 68, {
        size: 12,
        color: THEME.TX2,
      });
      drawButton(ctx, hits, innerX + dockInnerW - 150, row1Y + (row1H - 42) / 2, 134, 42, '继续赛季', actions.onContinue, {
        variant: 'gold',
        fontSize: 14,
        icon: 'play',
      });
    } else {
      drawButton(ctx, hits, innerX, row1Y, dockInnerW, row1H, '开始新赛季', () => {
        if (!league.isPrologueCompleted() && actions.onOpenPrologue) {
          actions.onOpenPrologue();
        } else {
          this.openNewSeasonWizard();
        }
      }, { variant: 'gold', fontSize: 18, icon: 'sparkle' });
    }
    ctx.restore();

    // 第二排 3 个等宽功能按钮
    const row2Y = row1Y + row1H + rowGap;
    const dockBtnW = 164;
    const dockGap = 12;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, pBtns));
    drawButton(ctx, hits, innerX, row2Y, dockBtnW, row2H, `教练天赋 (${st.metaPointsTotal})`, actions.onOpenMeta, {
      variant: 'ghost',
      fontSize: 12.5,
      icon: 'talent',
    });
    drawButton(ctx, hits, innerX + dockBtnW + dockGap, row2Y, dockBtnW, row2H, '我的球队', actions.onOpenRoster, {
      variant: 'ghost',
      fontSize: 12.5,
      icon: 'tactics',
    });
    drawButton(ctx, hits, innerX + (dockBtnW + dockGap) * 2, row2Y, dockBtnW, row2H, `荣誉室 (${hof?.unlockedAchievements.length ?? 0}/${ACHIEVEMENTS.length})`, actions.onOpenHallOfFame, {
      variant: 'ghost',
      fontSize: 12.5,
      icon: 'trophy',
    });
    ctx.restore();

    if (!this.wizardOpen) {
      const verText = getRunningVersion();
      const verW = Math.max(118, verText.length * 6.2 + 20);
      drawRoundRect(ctx, THEME.W - verW - 8, THEME.H - 30, verW, 24, 5, 'rgba(4,7,14,0.66)', THEME.BORDER);
      drawText(ctx, verText, THEME.W - 18, THEME.H - 13, {
        size: 10.5,
        color: '#94A3B8',
        align: 'right',
        mono: true,
      });
    }

    if (this.wizardOpen) {
      this.renderWizardModal(ctx, hits, metaLv, actions);
    }
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
    ctx.fillStyle = 'rgba(4, 7, 14, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 136;
    const my = 58;
    const mw = 1008;
    const mh = 604;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(12, 19, 36, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    // 顶栏：标题 + 2 步导航胶囊 + 关闭
    drawText(ctx, '新赛季建队向导', mx + 26, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    const steps: Array<[1 | 2, string]> = [
      [1, '1. 俱乐部形象室'],
      [2, '2. 阵型与战术星盘'],
    ];
    steps.forEach(([s, lbl], i) => {
      drawButton(ctx, hits, mx + 236 + i * 204, my + 18, 190, 32, lbl, () => {
        if (s === 2) this.enterStep2();
        else this.wizardStep = 1;
      }, { active: this.wizardStep === s, fontSize: 12.5 });
    });
    drawButton(ctx, hits, mx + mw - 100, my + 18, 76, 32, '关闭', () => {
      this.wizardOpen = false;
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    const sx = mx + 24;
    const sy = my + 68;
    const sw = this.wizardStep === 2 ? 324 : 286;
    const sh = 508;

    if (this.wizardStep === 1) {
      this.renderStep1LeftShowcase(ctx, hits, sx, sy, sw, sh, metaLv);
    } else {
      this.renderStep2AstrolabeViewport(ctx, sx, sy, sw, sh);
    }

    const rx = sx + sw + 20;
    const ry = my + 68;
    const rw = mx + mw - rx - 24;

    if (this.wizardStep === 1) {
      this.renderStep1RightPanel(ctx, hits, rx, ry, rw, actions);
      drawButton(ctx, hits, mx + mw - 246, my + mh - 58, 222, 42, '下一步：星盘与哲学 ▶', () => {
        this.enterStep2();
      }, { variant: 'gold', fontSize: 13.5, icon: 'sparkle' });
    } else {
      this.renderStep2RightPanel(ctx, hits, rx, ry, rw);
      drawButton(ctx, hits, rx, my + mh - 58, 146, 42, '◀ 上一步', () => {
        this.wizardStep = 1;
      }, { variant: 'ghost', fontSize: 13 });
      drawButton(ctx, hits, mx + mw - 304, my + mh - 58, 280, 42, '确认建队 · 开启核心开包 ▶', () => {
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
      }, { variant: 'gold', fontSize: 14, icon: 'sparkle' });
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

    drawChamferPanel(ctx, sx, sy, sw, sh, 12, 'rgba(9, 14, 26, 0.96)', THEME.BORDER_GOLD, 1.2, activeKit.primaryColor);

    ctx.save();
    const spot = ctx.createRadialGradient(sx + sw / 2, sy + 188, 14, sx + sw / 2, sy + 188, 148);
    spot.addColorStop(0, `${activeKit.primaryColor}44`);
    spot.addColorStop(0.55, `${activeKit.secondaryColor}18`);
    spot.addColorStop(1, 'rgba(9, 14, 26, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(sx + 4, sy + 4, sw - 8, 340);
    ctx.restore();

    drawButton(ctx, hits, sx + 18, sy + 16, 120, 30, '主场战袍', () => {
      this.previewKitMode = 'home';
    }, { active: isHome, variant: isHome ? 'gold' : 'ghost', fontSize: 11.5 });
    drawButton(ctx, hits, sx + 148, sy + 16, 120, 30, '客场战袍', () => {
      this.previewKitMode = 'away';
    }, { active: !isHome, variant: !isHome ? 'primary' : 'ghost', fontSize: 11.5 });

    const jerseyFloat = Math.sin(this.ambientTime * 2.1) * 3;
    drawJerseyIcon(ctx, sx + sw / 2, sy + 176 + jerseyFloat, 118, activeKit, 10);
    drawRoundRect(ctx, sx + sw - 74, sy + 64, 56, 56, 28, 'rgba(8, 13, 24, 0.92)', THEME.BORDER_GOLD, 1.4);
    drawClubCrest(ctx, sx + sw - 46, sy + 92, 22, crestClub);

    drawBadge(
      ctx,
      sx + sw / 2 - 64,
      sy + 266,
      128,
      22,
      isHome ? 'HOME KIT · 主场' : 'AWAY KIT · 客场',
      isHome ? 'rgba(212,168,67,0.18)' : 'rgba(56,189,248,0.18)',
      isHome ? THEME.GOLD_LIGHT : '#7DD3FC'
    );

    drawText(ctx, this.customName.slice(0, 12), sx + sw / 2, sy + 318, {
      size: 21,
      bold: true,
      color: THEME.TX1,
      align: 'center',
    });
    drawText(ctx, fitText(ctx, `EST. 2026 · ${this.formation} · ${TACTICAL_PRESETS[this.style].name}`, sw - 28, FONT.LABEL, false, true), sx + sw / 2, sy + 346, {
      token: 'LABEL',
      color: THEME.GOLD_LIGHT,
      align: 'center',
    });

    drawRoundRect(ctx, sx + 18, sy + 378, sw - 36, 110, 8, 'rgba(15, 23, 42, 0.86)', THEME.BORDER);
    const startFunds = 900 + (metaLv.finance || 0) * 150;
    drawText(ctx, '初始资金', sx + 30, sy + 402, { token: 'MICRO', color: THEME.TX2 });
    drawText(ctx, formatFunds(startFunds), sx + sw - 30, sy + 402, { token: 'BODY', bold: true, color: THEME.GREEN, align: 'right', mono: true });
    drawText(ctx, '建队流程', sx + 30, sy + 434, { token: 'MICRO', color: THEME.TX2 });
    drawText(ctx, '3核心包 → 夏窗26人', sx + sw - 30, sy + 434, { token: 'LABEL', bold: true, color: THEME.GOLD_LIGHT, align: 'right' });
    drawText(ctx, '防撞色', sx + 30, sy + 466, { token: 'MICRO', color: THEME.TX2 });
    drawText(ctx, '已启用 · 客场自动切换', sx + sw - 30, sy + 466, { token: 'MICRO', color: '#38BDF8', align: 'right' });
  }

  private renderStep1RightPanel(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    rx: number,
    ry: number,
    rw: number,
    actions: { onEditName?: (current: string, apply: (next: string) => void) => void }
  ): void {
    drawText(ctx, '俱乐部名称', rx, ry + 14, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '点击输入框自定义（最多 12 字）或随机生成', rx + 96, ry + 14, { size: 11.5, color: THEME.TX2 });

    const nameBoxW = rw - 156;
    drawRoundRect(ctx, rx, ry + 32, nameBoxW, 46, 8, THEME.BG_CARD, hits.isHovered(rx, ry + 32, nameBoxW, 46) ? THEME.GOLD : THEME.BORDER_GOLD);
    drawText(ctx, this.customName, rx + 18, ry + 55, { size: 19, bold: true, color: THEME.TX1 });
    drawIcon(ctx, 'edit', rx + nameBoxW - 72, ry + 55, 13, THEME.GOLD_LIGHT);
    drawText(ctx, '编辑', rx + nameBoxW - 16, ry + 55, { size: 11.5, color: THEME.GOLD_LIGHT, align: 'right' });
    if (actions.onEditName) {
      hits.add(rx, ry + 32, nameBoxW, 46, () => {
        SoundEngine.playClick();
        actions.onEditName!(this.customName, (next) => {
          this.customName = next;
        });
      });
    }
    drawButton(ctx, hits, rx + nameBoxW + 10, ry + 32, 146, 46, '随机队名', () => {
      this.customName = generateFictionalClubName();
    }, { variant: 'primary', fontSize: 12.5, icon: 'dice' });

    drawText(ctx, '选择队徽与底色模板', rx, ry + 102, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
    FICTIONAL_CLUBS.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bw = Math.floor((rw - 12) / 2);
      const bx = rx + col * (bw + 12);
      const by = ry + 122 + row * 44;
      const active = this.selectedClubId === c.id;
      drawRoundRect(ctx, bx, by, bw, 38, 7, active ? '#1E293B' : THEME.BG_CARD, active ? THEME.GOLD : THEME.BORDER, active ? 1.8 : 1);
      drawClubCrest(ctx, bx + 22, by + 19, 13, c);
      drawText(ctx, c.name, bx + 44, by + 19, { size: 12.5, bold: active, color: active ? THEME.GOLD_LIGHT : THEME.TX1 });
      drawRoundRect(ctx, bx + bw - 42, by + 13, 12, 12, 6, c.primaryColor, '#FFFFFF', 0.8);
      drawRoundRect(ctx, bx + bw - 24, by + 13, 12, 12, 6, c.secondaryColor, '#FFFFFF', 0.8);
      hits.add(bx, by, bw, 38, () => {
        SoundEngine.playClick();
        this.selectTemplate(c.id);
      });
    });

    const isHome = this.previewKitMode === 'home';
    const palY = ry + 314;
    drawChamferPanel(ctx, rx, palY, rw, 126, 10, 'rgba(15, 23, 42, 0.78)', isHome ? THEME.BORDER_GOLD : 'rgba(56,189,248,0.45)');
    drawText(
      ctx,
      isHome ? '自定义主场战袍配色' : '自定义客场战袍配色',
      rx + 16,
      palY + 22,
      { size: 13.5, bold: true, color: isHome ? THEME.GOLD_LIGHT : '#7DD3FC' }
    );
    drawButton(ctx, hits, rx + rw - 150, palY + 8, 136, 26, isHome ? '切换编辑客场 ⇄' : '切换编辑主场 ⇄', () => {
      this.previewKitMode = isHome ? 'away' : 'home';
    }, { variant: 'ghost', fontSize: 11 });

    const curPrimPalette = isHome ? HOME_PRIMARY_PALETTE : AWAY_PRIMARY_PALETTE;
    const curSecPalette = isHome ? HOME_SECONDARY_PALETTE : AWAY_SECONDARY_PALETTE;
    const curPrimVal = isHome ? this.primaryColor : this.awayPrimaryColor;
    const curSecVal = isHome ? this.secondaryColor : this.awaySecondaryColor;

    drawText(ctx, '主色:', rx + 16, palY + 62, { size: 12, color: THEME.TX2 });
    curPrimPalette.forEach((col, i) => {
      const px = rx + 66 + i * 42;
      const sel = curPrimVal === col;
      drawRoundRect(ctx, px, palY + 46, 32, 30, 6, col, sel ? '#FFFFFF' : THEME.BORDER, sel ? 2.5 : 1);
      if (sel) {
        const chk = col === '#F8FAFC' || col === '#FACC15' ? '#090D16' : '#FFFFFF';
        drawIcon(ctx, 'check', px + 16, palY + 61, 12, chk);
      }
      hits.addTouchTarget(px, palY + 46, 32, 30, () => {
        SoundEngine.playClick();
        if (isHome) this.primaryColor = col;
        else this.awayPrimaryColor = col;
      });
    });

    drawText(ctx, '副色:', rx + 344, palY + 62, { size: 12, color: THEME.TX2 });
    curSecPalette.forEach((col, i) => {
      const px = rx + 392 + i * 42;
      const sel = curSecVal === col;
      drawRoundRect(ctx, px, palY + 46, 32, 30, 6, col, sel ? THEME.GOLD_LIGHT : THEME.BORDER, sel ? 2.5 : 1);
      if (sel) {
        const chk = col === '#F8FAFC' || col === '#FACC15' ? '#090D16' : '#FFFFFF';
        drawIcon(ctx, 'check', px + 16, palY + 61, 12, chk);
      }
      hits.addTouchTarget(px, palY + 46, 32, 30, () => {
        SoundEngine.playClick();
        if (isHome) this.secondaryColor = col;
        else this.awaySecondaryColor = col;
      });
    });

    drawText(
      ctx,
      '提示：左侧展示台会实时同步所选战袍；比赛日与对手撞色时自动启用客场战袍',
      rx + 16,
      palY + 102,
      { size: 11, color: THEME.TX3 }
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

    drawChamferPanel(ctx, sx, sy, sw, sh, 12, 'rgba(7, 12, 24, 0.98)', THEME.BORDER_GOLD, 1.4, styleInfo.color);

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
      burstGrad.addColorStop(1, 'rgba(8, 13, 24, 0)');
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
        size: 9.5,
        bold: true,
        color: sysInfo.color,
      });
    }

    // 当前阵型节点
    ctx.save();
    if (!IS_MOBILE) {
      ctx.shadowColor = THEME.GREEN;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.arc(formPos.x, formPos.y, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = THEME.GREEN;
    ctx.stroke();
    ctx.restore();
    drawText(ctx, this.formation, formPos.x, formPos.y + 1, {
      size: 9,
      bold: true,
      color: '#ECFDF5',
      align: 'center',
      mono: true,
    });

    // 7b. 第 3 层：正对碰撞融合奇点
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

    // 7c. 外环：打法原点 + 流派主纹章 + 攻守被动 + 主动技 + 手牌
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

    // 中央流派大纹章
    ctx.save();
    if (!IS_MOBILE) {
      ctx.shadowColor = styleInfo.color;
      ctx.shadowBlur = 16;
    }
    ctx.fillStyle = '#13233E';
    ctx.beginPath();
    ctx.arc(emblemPos.x, emblemPos.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = THEME.GOLD_LIGHT;
    ctx.stroke();
    ctx.strokeStyle = `${styleInfo.color}88`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(emblemPos.x, emblemPos.y, 24.5, this.ambientTime * 0.55, this.ambientTime * 0.55 + Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);
    drawSkillGlyph(ctx, ASTROLABE_STYLE_GLYPH[this.style], emblemPos.x, emblemPos.y, 24, styleInfo.color, THEME.GOLD_LIGHT);
    ctx.restore();

    if (atkPassive) {
      drawAstrolabeCircleNode(ctx, atkPassivePos.x, atkPassivePos.y, 8.5, getAstrolabePassiveGlyph(atkPassive), styleInfo.color, true, false, false, this.ambientTime);
    }
    if (defPassive) {
      drawAstrolabeCircleNode(ctx, defPassivePos.x, defPassivePos.y, 8.5, getAstrolabePassiveGlyph(defPassive), styleInfo.color, true, false, false, this.ambientTime);
    }
    if (atkSkill) {
      drawAstrolabeDiamondSkillNode(ctx, atkSkillPos.x, atkSkillPos.y, 10.5, ASTROLABE_STYLE_GLYPH[this.style], true, false, true, false, atkSkill.name.slice(0, 4));
    }
    if (defSkill) {
      drawAstrolabeDiamondSkillNode(ctx, defSkillPos.x, defSkillPos.y, 10.5, ASTROLABE_STYLE_GLYPH[this.style], true, false, true, false, defSkill.name.slice(0, 4));
    }
    if (atkDir) {
      drawAstrolabeDirectiveNode(ctx, cx, cy, atkDirPos.x, atkDirPos.y, 9, atkDir.tendency, atkDir.zone, true, false, true, false, [], atkDir.name.slice(0, 4));
    }
    if (defDir) {
      drawAstrolabeDirectiveNode(ctx, cx, cy, defDirPos.x, defDirPos.y, 9, defDir.tendency, defDir.zone, true, false, true, false, [], defDir.name.slice(0, 4));
    }

    // 8. 顶部星盘抬头与底部融合奇点铭牌
    drawRoundRect(ctx, sx + 12, sy + 12, sw - 24, 46, 8, 'rgba(8, 13, 25, 0.88)', styleInfo.color, 1.1);
    drawSkillGlyph(ctx, ASTROLABE_SYSTEM_GLYPH[sys], sx + 32, sy + 35, 19, sysInfo.color, THEME.GOLD_LIGHT);
    drawText(ctx, `${styleInfo.name} × ${this.formation}`, sx + sw / 2, sy + 28, {
      size: 13.5,
      bold: true,
      color: THEME.TX1,
      align: 'center',
    });
    drawText(ctx, `星盘正上方 · 已选共鸣预览`, sx + sw / 2, sy + 46, {
      size: 10,
      color: styleInfo.color,
      align: 'center',
    });
    drawSkillGlyph(ctx, ASTROLABE_STYLE_GLYPH[this.style], sx + sw - 32, sy + 35, 19, styleInfo.color, THEME.GOLD_LIGHT);

    drawRoundRect(ctx, sx + 12, sy + sh - 62, sw - 24, 50, 8, 'rgba(24, 15, 6, 0.90)', THEME.BORDER_GOLD, 1.3);
    drawText(ctx, `✦ 碰撞奇点：${fusion.name}`, sx + sw / 2, sy + sh - 44, {
      size: 12.5,
      bold: true,
      color: THEME.GOLD_LIGHT,
      align: 'center',
    });
    drawText(ctx, `${fusion.branchA.label} / ${fusion.branchB.label}`, sx + sw / 2, sy + sh - 24, {
      size: 10.5,
      color: '#FDE68A',
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
      }, { active: this.sysTab === sys, fontSize: 11 });
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
        7,
        active ? 'rgba(24, 38, 66, 0.96)' : THEME.BG_CARD,
        active ? sCol : hits.isHovered(bx, by, swBtn, 34) ? THEME.GOLD : THEME.BORDER,
        active ? 1.8 : 1
      );
      ctx.fillStyle = sCol;
      ctx.beginPath();
      ctx.arc(bx + 16, by + 17, 4.5, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, TACTICAL_PRESETS[s].name, bx + 28, by + 17, {
        size: 12.5,
        bold: active,
        color: active ? '#FFFFFF' : THEME.TX1,
      });
      if (active) {
        drawText(ctx, '★', bx + swBtn - 16, by + 17, { size: 11, color: sCol, align: 'center' });
      }
      hits.add(bx, by, swBtn, 34, () => {
        this.selectStyle(s);
      });
    });

    // 3. 实时「阵型 × 打法」协同看板：左侧五维雷达优劣势 + 右侧代表技能与手牌
    const dashY = styleY + 114;
    const dashH = 226;
    const sys = getDefenseSystem(this.formation);
    const styleInfo = STYLE_LABELS[this.style];
    drawChamferPanel(ctx, rx, dashY, rw, dashH, 10, 'rgba(9, 15, 29, 0.94)', THEME.BORDER_GOLD, 1.2, styleInfo.color);

    // 3a. 左侧：图形化五维雷达图 + 优势/短板
    const leftW = 266;
    drawText(ctx, `战术画像 · ${SYSTEM_NOTE[sys]}`, rx + 14, dashY + 18, {
      size: 11.5,
      bold: true,
      color: styleInfo.color,
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
    drawRoundRect(ctx, rx + 12, dashY + 168, leftW - 20, 22, 5, 'rgba(20, 83, 45, 0.30)', 'rgba(34, 197, 94, 0.45)');
    drawText(ctx, `优势：${fitText(ctx, pc.pros, leftW - 36, 10)}`, rx + 20, dashY + 179, {
      size: 10,
      color: '#86EFAC',
    });
    drawRoundRect(ctx, rx + 12, dashY + 195, leftW - 20, 22, 5, 'rgba(127, 29, 29, 0.28)', 'rgba(248, 113, 113, 0.42)');
    drawText(ctx, `短板：${fitText(ctx, pc.cons, leftW - 36, 10)}`, rx + 20, dashY + 206, {
      size: 10,
      color: '#FCA5A5',
    });

    // 中间竖线分隔
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + leftW + 4, dashY + 12);
    ctx.lineTo(rx + leftW + 4, dashY + dashH - 12);
    ctx.stroke();

    // 3b. 右侧：代表技能 & 代表手牌
    const rColX = rx + leftW + 16;
    const rColW = rw - leftW - 28;

    const styleSkill = V6_ACTIVE_SKILLS.find(s => s.source === 'style' && s.style === this.style);
    const formSkill = V6_ACTIVE_SKILLS.find(s => s.source === 'formation' && s.formation === this.formation);
    const repSkills = [styleSkill, formSkill].filter((x): x is NonNullable<typeof x> => !!x).slice(0, 2);

    drawText(ctx, '代表主动技 (星盘解锁后 F 键瞬发)', rColX, dashY + 18, {
      size: 11,
      bold: true,
      color: '#7DD3FC',
    });
    repSkills.forEach((sk, idx) => {
      const cardY = dashY + 30 + idx * 42;
      drawRoundRect(ctx, rColX, cardY, rColW, 36, 6, 'rgba(12, 54, 86, 0.42)', '#38BDF8', 1);
      drawBadge(ctx, rColX + 6, cardY + 8, 42, 20, sk.source === 'formation' ? '阵型技' : '流派技', '#0F172A', '#38BDF8');
      drawText(ctx, sk.name, rColX + 54, cardY + 13, { size: 11.5, bold: true, color: '#FFFFFF' });
      drawText(ctx, fitText(ctx, `${sk.situationLabel} · ${sk.instantLabel}`, rColW - 62, 9.5), rColX + 54, cardY + 27, {
        size: 9.5,
        color: '#BAE6FD',
      });
    });

    const styleDir = V6_DIRECTIVES.find(d => d.source === 'style' && d.style === this.style && d.route === 'steady');
    const formDir = V6_DIRECTIVES.find(d => d.source === 'formation' && d.formation === this.formation)
      ?? V6_DIRECTIVES.find(d => d.source === 'style' && d.style === this.style && d.id !== styleDir?.id);
    const repDirs = [styleDir, formDir].filter((x): x is NonNullable<typeof x> => !!x).slice(0, 2);

    const dirTitleY = dashY + 124;
    drawText(ctx, '代表临场手牌 (比赛四赛段拍板)', rColX, dirTitleY, {
      size: 11,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    repDirs.forEach((d, idx) => {
      const cardY = dirTitleY + 12 + idx * 44;
      const zCol = ASTROLABE_ZONE_COLOR[d.zone];
      drawRoundRect(ctx, rColX, cardY, rColW, 38, 6, 'rgba(18, 29, 51, 0.90)', zCol, 1);
      ctx.fillStyle = zCol;
      ctx.fillRect(rColX + 2, cardY + 4, 3, 30);
      drawBadge(ctx, rColX + 10, cardY + 9, 36, 20, `${d.tpCost}TP`, '#78350F', THEME.GOLD_LIGHT);
      drawText(ctx, `${d.name} (${ASTROLABE_ZONE_LABEL[d.zone]}·${d.tendency === 'ATK' ? '攻' : '守'})`, rColX + 52, cardY + 13, {
        size: 11,
        bold: true,
        color: THEME.TX1,
      });
      drawText(ctx, fitText(ctx, d.benefitSummary, rColW - 60, 9.5), rColX + 52, cardY + 28, {
        size: 9.5,
        color: '#86EFAC',
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
    // 3 层五边形网格
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
      ctx.strokeStyle = scale === 1.0 ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 5 条轴线与标签
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const ex = cx + Math.cos(ang) * maxR;
      const ey = cy + Math.sin(ang) * maxR;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      const lx = cx + Math.cos(ang) * (maxR + 15);
      const ly = cy + Math.sin(ang) * (maxR + 13);
      drawText(ctx, `${labels[i]}`, lx, ly, {
        size: 9.5,
        bold: true,
        color: '#CBD5E1',
        align: 'center',
      });
    }

    // 能力多边形
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
    ctx.lineWidth = 2;
    ctx.strokeStyle = accentColor;
    if (!IS_MOBILE) {
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
    }
    ctx.stroke();

    // 顶点高亮圆点
    ctx.shadowBlur = 0;
    for (const pt of pts) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
