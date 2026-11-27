/**
 * 页面 0：TitleScreen 发行级主视觉登录门户 + 2 步式建队向导弹窗
 * Step 1: 「俱乐部形象室」—— 命名 + 队徽模板 + 可切换主/客场球衣聚光灯预览（高归属感展示台）
 * Step 2: 「阵型与哲学」—— 4/3/5 后卫阵型 + 六大战术哲学
 */

import { ACHIEVEMENTS } from '../../../core/src/Achievements';
import { LeagueManager, NewSeasonOptions } from '../../../core/src/LeagueManager';
import { FICTIONAL_CLUBS } from '../../../core/src/PlayerPool';
import { generateFictionalClubName } from '../../../core/src/namePool';
import { FORMATION_SYSTEMS, getDefenseSystem } from '../../../engine/src/formations';
import { DefenseSystem, FormationName, TACTICAL_PRESETS, TacticalStyle } from '../../../engine/src/types';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawRoundRect,
  drawText,
  formatFunds,
  HitRegistry,
} from '../CanvasKit';
import { drawClubCrest, drawJerseyIcon } from '../ClubVisuals';
import { drawGameLogoEmblem, easeOutBack, easeOutCubic } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

const HOME_PRIMARY_PALETTE = ['#DC2626', '#2563EB', '#059669', '#EA580C', '#7C3AED', '#0284C7'];
const HOME_SECONDARY_PALETTE = ['#FACC15', '#F8FAFC', '#1E293B', '#38BDF8', '#F59E0B'];
const AWAY_PRIMARY_PALETTE = ['#F8FAFC', '#FACC15', '#38BDF8', '#0F172A', '#EC4899', '#10B981'];
const AWAY_SECONDARY_PALETTE = ['#0F172A', '#DC2626', '#2563EB', '#FACC15', '#F8FAFC'];
const SYS_TABS: DefenseSystem[] = ['4-back', '3-back', '5-back'];
const STYLE_LIST: TacticalStyle[] = ['tiki_taka', 'gegenpress', 'balanced', 'wing_play', 'counter', 'park_bus'];

const STYLE_HINTS: Record<TacticalStyle, string> = {
  balanced: '攻守平衡 · 中位防线，适合通用阵容稳扎稳打',
  tiki_taka: '传控渗透 · 短传配合与高位控球，压制对手持球时间',
  gegenpress: '高位逼抢 · 极高防线与疯狂反抢，节奏最快但体能消耗大',
  counter: '快速反击 · 深度回收诱敌深入，断球后直塞打身后',
  wing_play: '两翼齐飞 · 拉开球场宽度，边路突破与传中制造杀机',
  park_bus: '铁桶防反 · 极限低位防守密度，专克强队并伺机偷袭',
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

  public resetEnterAnim(): void {
    this.enterTime = 0;
  }

  public openNewSeasonWizard(): void {
    this.wizardStep = 1;
    this.previewKitMode = 'home';
    this.wizardOpen = true;
  }

  public update(dtSec: number): void {
    this.enterTime += dtSec;
    this.ambientTime += dtSec;
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

    // 右上角桌面端工具栏（存档位 / 重置 / 设置 / 退出）
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
    ctx.fillStyle = 'rgba(4, 7, 14, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 152;
    const my = 66;
    const mw = 976;
    const mh = 588;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(12, 19, 36, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    // 顶栏：标题 + 2 步导航胶囊 + 关闭
    drawText(ctx, '新赛季建队向导', mx + 28, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    const steps: Array<[1 | 2, string]> = [
      [1, '1. 俱乐部形象室'],
      [2, '2. 阵型与战术哲学'],
    ];
    steps.forEach(([s, lbl], i) => {
      drawButton(ctx, hits, mx + 236 + i * 204, my + 18, 190, 32, lbl, () => {
        this.wizardStep = s;
      }, { active: this.wizardStep === s, fontSize: 12.5 });
    });
    drawButton(ctx, hits, mx + mw - 100, my + 18, 76, 32, '关闭', () => {
      this.wizardOpen = false;
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    // 左侧：高归属感「俱乐部更衣室展示台」（主/客场球衣切换 + 聚光灯光晕 + 悬浮队徽）
    const sx = mx + 26;
    const sy = my + 70;
    const sw = 286;
    const sh = 492;
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

    // 聚光灯呼吸光晕
    ctx.save();
    const spot = ctx.createRadialGradient(sx + sw / 2, sy + 188, 14, sx + sw / 2, sy + 188, 148);
    spot.addColorStop(0, `${activeKit.primaryColor}44`);
    spot.addColorStop(0.55, `${activeKit.secondaryColor}18`);
    spot.addColorStop(1, 'rgba(9, 14, 26, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(sx + 4, sy + 4, sw - 8, 340);
    ctx.restore();

    // 顶部主/客场切换胶囊
    drawButton(ctx, hits, sx + 18, sy + 16, 120, 30, '主场战袍', () => {
      this.previewKitMode = 'home';
    }, { active: isHome, variant: isHome ? 'gold' : 'ghost', fontSize: 11.5 });
    drawButton(ctx, hits, sx + 148, sy + 16, 120, 30, '客场战袍', () => {
      this.previewKitMode = 'away';
    }, { active: !isHome, variant: !isHome ? 'primary' : 'ghost', fontSize: 11.5 });

    // 主视觉：大号球衣 + 右上角悬浮队徽徽章
    const jerseyFloat = Math.sin(this.ambientTime * 2.1) * 3;
    drawJerseyIcon(ctx, sx + sw / 2, sy + 172 + jerseyFloat, 118, activeKit, 10);
    drawRoundRect(ctx, sx + sw - 74, sy + 64, 56, 56, 28, 'rgba(8, 13, 24, 0.92)', THEME.BORDER_GOLD, 1.4);
    drawClubCrest(ctx, sx + sw - 46, sy + 92, 22, crestClub);

    // 球衣标签
    drawBadge(
      ctx,
      sx + sw / 2 - 64,
      sy + 260,
      128,
      22,
      isHome ? 'HOME KIT · 主场' : 'AWAY KIT · 客场',
      isHome ? 'rgba(212,168,67,0.18)' : 'rgba(56,189,248,0.18)',
      isHome ? THEME.GOLD_LIGHT : '#7DD3FC'
    );

    // 俱乐部铭牌
    drawText(ctx, this.customName.slice(0, 12), sx + sw / 2, sy + 312, {
      size: 21,
      bold: true,
      color: THEME.TX1,
      align: 'center',
    });
    drawText(ctx, `EST. 2026 · ${this.formation} · ${TACTICAL_PRESETS[this.style].name}`, sx + sw / 2, sy + 340, {
      size: 11.5,
      color: THEME.GOLD_LIGHT,
      align: 'center',
    });

    // 俱乐部初始资产摘要卡
    drawRoundRect(ctx, sx + 18, sy + 368, sw - 36, 106, 8, 'rgba(15, 23, 42, 0.86)', THEME.BORDER);
    const startFunds = 900 + (metaLv.finance || 0) * 150;
    drawText(ctx, '初始运营资金', sx + 30, sy + 392, { size: 11, color: THEME.TX2 });
    drawText(ctx, formatFunds(startFunds), sx + sw - 30, sy + 392, { size: 13.5, bold: true, color: THEME.GREEN, align: 'right', mono: true });
    drawText(ctx, '开局建队流程', sx + 30, sy + 422, { size: 11, color: THEME.TX2 });
    drawText(ctx, '3 核心包 → 夏窗补齐26人', sx + sw - 30, sy + 422, { size: 11.5, bold: true, color: THEME.GOLD_LIGHT, align: 'right' });
    drawText(ctx, '球衣防撞色系统', sx + 30, sy + 452, { size: 11, color: THEME.TX2 });
    drawText(ctx, '已启用 · 客场自动切换', sx + sw - 30, sy + 452, { size: 11, color: '#38BDF8', align: 'right' });

    // 右侧主编辑区
    const rx = sx + sw + 22;
    const ry = my + 70;
    const rw = mx + mw - rx - 26;

    if (this.wizardStep === 1) {
      // 区块 A：俱乐部名称
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

      // 区块 B：队徽与经典配色模板
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
        // 右侧双色小圆点
        drawRoundRect(ctx, bx + bw - 42, by + 13, 12, 12, 6, c.primaryColor, '#FFFFFF', 0.8);
        drawRoundRect(ctx, bx + bw - 24, by + 13, 12, 12, 6, c.secondaryColor, '#FFFFFF', 0.8);
        hits.add(bx, by, bw, 38, () => {
          SoundEngine.playClick();
          this.selectTemplate(c.id);
        });
      });

      // 区块 C：联动单组球衣调色板（跟随左侧 主/客场 预览切换）
      const palY = ry + 314;
      drawChamferPanel(ctx, rx, palY, rw, 122, 10, 'rgba(15, 23, 42, 0.78)', isHome ? THEME.BORDER_GOLD : 'rgba(56,189,248,0.45)');
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
        hits.add(px, palY + 46, 32, 30, () => {
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
        hits.add(px, palY + 46, 32, 30, () => {
          SoundEngine.playClick();
          if (isHome) this.secondaryColor = col;
          else this.awaySecondaryColor = col;
        });
      });

      drawText(
        ctx,
        '提示：左侧展示台会实时同步所选战袍；比赛日与对手撞色时自动启用客场战袍',
        rx + 16,
        palY + 100,
        { size: 11, color: THEME.TX3 }
      );
    } else {
      // Step 2：阵型与哲学
      drawText(ctx, '选择初始阵型 (4/3/5后卫)', rx, ry + 14, { size: 14.5, bold: true, color: THEME.GOLD_LIGHT });
      SYS_TABS.forEach((sys, si) => {
        const lbl = sys === '4-back' ? '四后卫 (8)' : sys === '3-back' ? '三后卫 (4)' : '五后卫 (4)';
        drawButton(ctx, hits, rx + 236 + si * 126, ry + 2, 118, 26, lbl, () => {
          this.sysTab = sys;
        }, { active: this.sysTab === sys, fontSize: 11.5 });
      });
      const forms = FORMATION_SYSTEMS[this.sysTab].formations;
      const fw = Math.floor((rw - 30) / 4);
      forms.forEach((f, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        drawButton(ctx, hits, rx + col * (fw + 10), ry + 40 + row * 38, fw, 32, f, () => {
          this.formation = f;
          this.sysTab = getDefenseSystem(f);
        }, { active: this.formation === f, fontSize: 12.5 });
      });

      drawText(ctx, '选择战术哲学', rx, ry + 138, { size: 14.5, bold: true, color: THEME.GOLD_LIGHT });
      const swBtn = Math.floor((rw - 24) / 3);
      STYLE_LIST.forEach((s, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        drawButton(ctx, hits, rx + col * (swBtn + 12), ry + 164 + row * 54, swBtn, 44, TACTICAL_PRESETS[s].name, () => {
          this.style = s;
        }, { active: this.style === s, fontSize: 13 });
      });

      const preset = TACTICAL_PRESETS[this.style];
      drawChamferPanel(ctx, rx, ry + 292, rw, 116, 10, THEME.BG_CARD, THEME.BORDER_GOLD);
      drawText(ctx, `当前哲学：${preset.name}`, rx + 18, ry + 320, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
      drawText(
        ctx,
        `防线 ${preset.lineHeight >= 0 ? '+' : ''}${preset.lineHeight}m · 节奏 ${preset.tempo.toFixed(2)}x · 压迫 ${preset.pressIntensity.toFixed(2)}x`,
        rx + rw - 18,
        ry + 320,
        { size: 11.5, color: '#38BDF8', align: 'right', mono: true }
      );
      drawText(ctx, STYLE_HINTS[this.style], rx + 18, ry + 358, { size: 13, color: THEME.TX1 });
      drawText(ctx, '建队后将进入 3 轮核心开包（防线 / 中场 / 锋线各 3 选 1），随后进入夏季转会窗补齐 26 人大名单', rx + 18, ry + 388, {
        size: 11.5,
        color: THEME.TX2,
      });
    }

    // 底部操作栏
    if (this.wizardStep === 1) {
      drawButton(ctx, hits, mx + mw - 236, my + mh - 62, 210, 44, '下一步：阵型与哲学 ▶', () => {
        this.wizardStep = 2;
      }, { variant: 'primary', fontSize: 13.5, icon: 'play' });
    } else {
      drawButton(ctx, hits, rx, my + mh - 62, 150, 44, '◀ 上一步', () => {
        this.wizardStep = 1;
      }, { variant: 'ghost', fontSize: 13 });
      drawButton(ctx, hits, mx + mw - 306, my + mh - 62, 280, 44, '确认建队 · 开启核心开包 ▶', () => {
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
}
