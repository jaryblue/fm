/**
 * 页面 2：发行级 Portal 备战门户（PITCH PRINT v1.0 移动端大字舒展版）
 * - 左栏：一体式可撕红蓝对抗球票（含 140ms 沿打孔齿线撕票动画）+ 硬墨线赛前轻训练（盖确认红章）+ 更衣室沟通
 * - 右栏顶部：融合备战通道的「主教练战术夹板」（黄铜夹头 + 单行摘要 + 4 项备战快捷入口，点击 220ms easeOutBack 展开
 *   1-4 预案拨片 + 四段指令便签 + F1-F4 绝技与圣物一览）
 * - 右栏主体：舒展暖纸 `#N` 巨型斜体排名票（含俱乐部资金/名单/剩余轮次速览）+ 肉鸽赛季词条大字展示卡
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import { getElementLabel, inferCardElement } from '../../../core/src/CommandCards';
import { WEATHER_INFO } from '../../../core/src/Chronicles';
import { computePerkSynergies } from '../../../core/src/PlayerPool';
import { OpponentMatchupIntel, PrepTrainingKind, ScoutingZoneId, ScoutRewardKind } from '../../../core/src/types';
import { V6_RELICS } from '../../../core/src/v6/AstrolabeManager';
import type { V6CheckpointKey, V6RelicId } from '../../../core/src/v6/types';
import { FORMATIONS } from '../../../engine/src/formations';
import { TacticalStyle, TACTICAL_PRESETS } from '../../../engine/src/types';
import { ArtAssetId, AssetLoader, getRelicAssetId, getSkillAssetId } from '../AssetLoader';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawFoilShimmer,
  drawNavRail,
  drawPrintCard,
  drawRoundRect,
  drawStamp,
  drawText,
  drawWrappedText,
  fitText,
  getHalftonePattern,
  getPaperGrainPattern,
  HitRegistry,
  NavRailTab,
} from '../CanvasKit';
import { drawClubCrest } from '../ClubVisuals';
import { easeOutBack, easeOutCubic } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, drawSkillGlyph, SkillGlyphKind } from '../VectorIcons';

const STYLE_GLYPH: Record<TacticalStyle, SkillGlyphKind> = {
  tiki_taka: 'tiki',
  gegenpress: 'press',
  wing_play: 'wing',
  counter: 'counter',
  park_bus: 'bus',
  balanced: 'balanced',
};

const ELEMENT_COLOR: Record<string, string> = {
  press: THEME.VERMILION,
  pass: THEME.COBALT,
  wing: THEME.BRASS,
  iron: THEME.LIME,
  blitz: THEME.VIOLET,
};

function mapRoleToScoutZone(role: string): ScoutingZoneId {
  if (role === 'GK' || role === 'ST') return 'gk_core';
  if (role === 'CB') return 'defense';
  if (['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM', 'LW', 'RW'].includes(role)) return 'wings';
  return 'midfield';
}

function drawCroppedArt(
  ctx: CanvasRenderingContext2D,
  assetId: ArtAssetId,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  alpha = 0.28
): void {
  const img = AssetLoader.get(assetId);
  if (!img || typeof ctx.drawImage !== 'function') return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, radius);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x + 2, y + 2, w - 4, h - 4);
  ctx.restore();
}

function traceUnifiedTicketPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seamX: number,
  r: number,
  nr: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(seamX - nr, y);
  ctx.arc(seamX, y, nr, Math.PI, 0, true);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(seamX + nr, y + h);
  ctx.arc(seamX, y + h, nr, 0, Math.PI, true);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function traceLeftTearHalfPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  nr: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - nr, y);
  ctx.arc(x + w, y, nr, Math.PI, Math.PI / 2, true);
  ctx.lineTo(x + w, y + h - nr);
  ctx.arc(x + w, y + h, nr, -Math.PI / 2, Math.PI, true);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function traceRightStubHalfPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  nr: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + nr, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + nr, y + h);
  ctx.arc(x, y + h, nr, 0, -Math.PI / 2, true);
  ctx.lineTo(x, y + nr);
  ctx.arc(x, y, nr, Math.PI / 2, 0, true);
  ctx.closePath();
}

function drawPerforationHoles(
  ctx: CanvasRenderingContext2D,
  seamX: number,
  y: number,
  h: number,
  nr: number
): void {
  const startY = y + nr + 7;
  const endY = y + h - nr - 7;
  ctx.save();
  ctx.strokeStyle = 'rgba(17, 20, 18, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(seamX, startY);
  ctx.lineTo(seamX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let hy = startY; hy <= endY; hy += 10) {
    ctx.fillStyle = THEME.BG_DEEP;
    ctx.beginPath();
    ctx.arc(seamX, hy, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(17, 20, 18, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTicketSurface(
  ctx: CanvasRenderingContext2D,
  traceFn: () => void,
  boundX: number,
  boundY: number,
  boundW: number,
  boundH: number,
  grain: CanvasPattern | null,
  bandH = 26
): void {
  ctx.save();
  ctx.translate(5, 5);
  traceFn();
  ctx.fillStyle = THEME.HARD_SHADOW;
  ctx.fill();
  ctx.restore();

  traceFn();
  ctx.fillStyle = THEME.PAPER_CREAM;
  ctx.fill();

  if (grain) {
    ctx.save();
    traceFn();
    ctx.clip();
    ctx.fillStyle = grain;
    ctx.fillRect(boundX, boundY, boundW, boundH);
    ctx.restore();
  }

  ctx.save();
  traceFn();
  ctx.clip();
  ctx.fillStyle = THEME.VERMILION;
  ctx.fillRect(boundX, boundY, boundW, bandH);
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(boundX, boundY + bandH);
  ctx.lineTo(boundX + boundW, boundY + bandH);
  ctx.stroke();
  ctx.restore();

  traceFn();
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawTicketStubContent(
  ctx: CanvasRenderingContext2D,
  stubX: number,
  stubY: number,
  stubW: number,
  seasonNumber: number,
  currentRound: number,
  isHome: boolean
): void {
  const stubCx = stubX + stubW / 2;

  // 顶条轮次标识（中文直观标注）
  drawText(ctx, `第${currentRound}轮`, stubCx, stubY + 13, {
    size: 13,
    bold: true,
    color: THEME.PAPER_CREAM,
    align: 'center',
    rawSize: true,
  });

  // 上部检票信息区
  drawText(ctx, '副券 · 检票', stubCx, stubY + 42, {
    size: 11.5,
    bold: true,
    color: THEME.PAPER_MUTED,
    align: 'center',
    rawSize: true,
  });
  ctx.strokeStyle = 'rgba(17, 20, 18, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(stubX + 12, stubY + 54);
  ctx.lineTo(stubX + stubW - 12, stubY + 54);
  ctx.stroke();

  drawText(ctx, `S${seasonNumber} 赛季`, stubCx, stubY + 69, {
    size: 12,
    bold: true,
    color: THEME.PAPER_INK,
    align: 'center',
    mono: true,
    rawSize: true,
  });
  const serial = `NO.${String(seasonNumber * 100 + currentRound).padStart(4, '0')}`;
  drawText(ctx, serial, stubCx, stubY + 86, {
    size: 11.5,
    bold: true,
    color: THEME.VERMILION,
    align: 'center',
    mono: true,
    rawSize: true,
  });

  // 中部竖排条形码区（横条叠放模拟球票检票码）
  const bars = [3, 1.5, 4, 1.5, 2, 3.5, 1.5, 1.5, 4.5, 2, 1.5, 3, 2, 4, 1.5, 2.5];
  const barLeft = stubX + 14;
  const barW = stubW - 28;
  let barY = stubY + 104;
  ctx.fillStyle = THEME.INK_LINE;
  bars.forEach((bw, idx) => {
    if (barY + bw <= stubY + 178) {
      if (idx % 2 === 0) {
        ctx.fillRect(barLeft, barY, barW, bw);
      }
      barY += bw + 2.2;
    }
  });
  drawText(ctx, 'FM-2026', stubCx, stubY + 190, {
    size: 10.5,
    bold: true,
    color: THEME.PAPER_MUTED,
    align: 'center',
    mono: true,
    rawSize: true,
  });

  // 下部虚线分隔 + 橡胶章 + 撕票提示
  ctx.save();
  ctx.strokeStyle = 'rgba(17, 20, 18, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(stubX + 12, stubY + 206);
  ctx.lineTo(stubX + stubW - 12, stubY + 206);
  ctx.stroke();
  ctx.restore();

  drawStamp(ctx, isHome ? '主场' : '客场', stubCx, stubY + 244, THEME.VERMILION, -12, 0.78);
  drawText(ctx, '开赛撕票', stubCx, stubY + 286, {
    size: 11.5,
    bold: true,
    color: THEME.PAPER_MUTED,
    align: 'center',
    rawSize: true,
  });
}

export class PortalScreen {
  private prepToast = '';
  private scoutModalOpen = false;
  private perksModalOpen = false;
  private scoutNotice = '';
  private selectedZoneId: ScoutingZoneId | null = null;
  private animTime = 0;
  private stampAnimTimer = 0;

  // 右上角「主教练战术夹板抽屉」状态（默认收起）
  private clipboardOpen = false;
  private clipboardAnim = 0; // 0 = 收起, 1 = 展开
  private clipboardSeg: V6CheckpointKey = 's1';
  private selectedRelicId: V6RelicId | null = null;

  // 开球撕票动画（140ms 后触发 onStartMatch）
  private ticketTearTimer = 0;
  private pendingStartMatch: (() => void) | null = null;

  public update(dtSec: number): void {
    const dt = Math.min(0.05, Math.max(0.001, dtSec));
    this.animTime += dt;
    if (this.stampAnimTimer > 0) {
      this.stampAnimTimer = Math.max(0, this.stampAnimTimer - dt);
    }

    const targetClip = this.clipboardOpen ? 1 : 0;
    if (this.clipboardAnim !== targetClip) {
      const speed = this.clipboardOpen ? dt / 0.22 : dt / 0.18;
      this.clipboardAnim = this.clipboardOpen
        ? Math.min(1, this.clipboardAnim + speed)
        : Math.max(0, this.clipboardAnim - speed);
    }

    if (this.ticketTearTimer > 0) {
      this.ticketTearTimer = Math.max(0, this.ticketTearTimer - dt);
      if (this.ticketTearTimer === 0 && this.pendingStartMatch) {
        const fn = this.pendingStartMatch;
        this.pendingStartMatch = null;
        fn();
      }
    }
  }

  public handleEscape(): boolean {
    if (this.perksModalOpen) {
      this.perksModalOpen = false;
      return true;
    }
    if (this.scoutModalOpen) {
      this.scoutModalOpen = false;
      return true;
    }
    if (this.clipboardOpen) {
      this.clipboardOpen = false;
      return true;
    }
    return false;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onNavigate: (tab: NavRailTab) => void;
      onStartMatch: () => void;
      onQuickSim?: () => void;
      onSave?: () => void;
      onToast?: (msg: string, color?: string) => void;
      onSeasonStarted?: () => void;
      onBurst?: (x: number, y: number, color?: string) => void;
      onShake?: (intensity: number, dur: number) => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const standings = league.getStandings();
    const nextFx = league.getUserCurrentFixture();
    const tierInfo = league.getCurrentTierInfo();
    const diffStars = '★'.repeat(8 - tierInfo.tier) + '☆'.repeat(tierInfo.tier - 1);
    const userRankIdx = standings.findIndex(r => r.isUser);
    const userRow = standings[userRankIdx];
    const isSummerWindow = st.phase === 'SUMMER_WINDOW';

    // PITCH PRINT 深松石战术室底 + 半调网点
    ctx.fillStyle = THEME.BG_DEEP;
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    const ht = getHalftonePattern(ctx, true);
    if (ht) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = ht;
      ctx.fillRect(0, 0, THEME.W, THEME.H);
      ctx.restore();
    }

    const totalRounds = league.getTotalRegularRounds();
    const stageLabel = isSummerWindow ? '季前夏窗 · 未开启赛季' : `${tierInfo.shortLabel} · 第 ${st.currentRound}/${totalRounds} 轮`;

    drawBroadcastHeader(ctx, hits, {
      kicker: `SEASON ${st.seasonNumber} · ${tierInfo.name} (${diffStars})`,
      title: club.name,
      club,
      badge: stageLabel,
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
    });

    drawNavRail(ctx, hits, 'portal', actions.onNavigate);

    const LX = 96;
    const LW = 564;
    const RX = 678;
    const RW = 584;
    const prep = isSummerWindow ? undefined : league.getInterMatchPrep();
    const grain = getPaperGrainPattern(ctx);

    // ==================== 左栏：暖纸球票主视觉 + 赛前轻训练 + 更衣室 ====================
    if (isSummerWindow) {
      const squadCount = club.squad.length;
      const needCount = Math.max(0, 26 - squadCount);
      const ready = squadCount >= 26;

      drawPrintCard(ctx, LX, 80, LW, 306, { paper: true, topBandColor: THEME.BRASS, radius: 10, shadowOffset: 5 });
      if (grain) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = grain;
        ctx.fillRect(LX + 4, 88, LW - 8, 290);
        ctx.restore();
      }
      drawText(ctx, 'PRE-SEASON · 夏季转会窗', LX + 18, 104, { size: 13.5, bold: true, color: THEME.VERMILION, mono: true });
      drawText(ctx, `大名单 ${squadCount}/26 · 资金 ${league.getClubFunds()} 万`, LX + LW - 18, 104, {
        size: 13.5,
        bold: true,
        color: THEME.PAPER_INK,
        align: 'right',
      });

      drawRoundRect(ctx, LX + 16, 122, LW - 32, 52, 8, THEME.PAPER_WARM, THEME.INK_LINE, 2);
      drawText(ctx, `足协注册：${squadCount} / 26 人`, LX + 30, 138, { size: 15, bold: true, color: THEME.PAPER_INK });
      drawBadge(
        ctx,
        LX + LW - 156,
        128,
        126,
        24,
        ready ? '名额已满 · 待盖章' : `还差 ${needCount} 人`,
        ready ? THEME.BG_PITCH_ALT : THEME.VERMILION,
        ready ? THEME.LIME : THEME.PAPER_CREAM
      );
      drawRoundRect(ctx, LX + 30, 158, LW - 60, 8, 4, THEME.BG_CARD_DARK);
      drawRoundRect(ctx, LX + 30, 158, Math.max(14, Math.round(Math.min(1, squadCount / 26) * (LW - 60))), 8, 4, ready ? THEME.LIME : THEME.BRASS);

      const channels: Array<{ title: string; sub: string; color: string }> = [
        { title: '青训学院', sub: '0 万免签提拔', color: THEME.LIME },
        { title: '转会市场', sub: '签即战力·卖冗余', color: THEME.COBALT },
        { title: '神秘经纪人', sub: '盲盒抽巨星', color: THEME.VIOLET },
      ];
      const chW = 168;
      const chGap = 14;
      channels.forEach((ch, ci) => {
        const cx = LX + 16 + ci * (chW + chGap);
        const chHov = hits.isHovered(cx, 184, chW, 118);
        drawRoundRect(ctx, cx, 184, chW, 118, 8, chHov ? THEME.BG_CARD_HOVER : THEME.BG_PANEL, chHov ? THEME.LIME : THEME.INK_LINE, 2.2);
        ctx.fillStyle = ch.color;
        ctx.fillRect(cx + 8, 188, chW - 16, 4);
        drawText(ctx, ch.title, cx + 14, 214, { size: 15.5, bold: true, color: ch.color });
        drawText(ctx, ch.sub, cx + 14, 240, { size: 13.5, bold: true, color: THEME.TX1 });
        drawBadge(ctx, cx + 14, 268, 78, 24, '进入 ›', THEME.PAPER_CREAM, THEME.PAPER_INK);
        hits.addTouchTarget(cx, 184, chW, 118, () => {
          SoundEngine.playClick();
          actions.onNavigate('transfer_hub');
        });
      });

      if (ready) {
        drawButton(ctx, hits, LX + 16, 316, LW - 32, 52, '✓ 足协盖章注册 · 新赛季开哨 ▶', () => {
          const res = league.finishSummerWindowAndStartSeason();
          if (res.ok) {
            SoundEngine.playFanfare();
            actions.onSeasonStarted?.();
          } else {
            SoundEngine.playWarning();
            actions.onToast?.(res.reason || '需凑齐 26 人大名单才能开启赛季', THEME.RED_LIGHT);
          }
        }, { variant: 'primary', fontSize: 16, icon: 'sparkle' });
      } else {
        drawButton(ctx, hits, LX + 16, 316, 236, 52, `一键青训补齐 (${squadCount}/26)`, () => {
          const res = league.signFreeAcademyFill(true);
          if (res.ok) {
            SoundEngine.playCraftSuccess();
            actions.onSave?.();
            actions.onToast?.(`已从青训学院免费补齐 ${res.added} 名球员！`, THEME.LIME);
            actions.onBurst?.(230, 310, THEME.LIME);
          } else {
            SoundEngine.playWarning();
            actions.onToast?.(res.reason || '当前已满 26 人或青训人数不足', THEME.BRASS);
          }
        }, { variant: 'gold', fontSize: 14 });
        drawButton(ctx, hits, LX + 264, 316, 284, 52, '补齐青训并盖章开赛 ▶', () => {
          const fillRes = league.signFreeAcademyFill(true);
          if (fillRes.ok) actions.onSave?.();
          const res = league.finishSummerWindowAndStartSeason();
          if (res.ok) {
            SoundEngine.playFanfare();
            actions.onSeasonStarted?.();
          } else {
            SoundEngine.playWarning();
            actions.onToast?.(res.reason || '需凑齐 26 人大名单才能开启赛季', THEME.RED_LIGHT);
          }
        }, { variant: 'primary', fontSize: 14.5, icon: 'sparkle' });
      }
    } else if (nextFx) {
      const home = st.clubs.find(c => c.id === nextFx.homeClubId)!;
      const away = st.clubs.find(c => c.id === nextFx.awayClubId)!;
      const homeRankIdx = standings.findIndex(r => r.clubId === home.id);
      const awayRankIdx = standings.findIndex(r => r.clubId === away.id);
      const homeRow = standings[homeRankIdx];
      const awayRow = standings[awayRankIdx];

      // 一体式可撕暖纸球票（静止态完全一体成型，开球时沿打孔线 140ms 撕开飞出）
      const tearProgress = this.ticketTearTimer > 0 ? 1 - this.ticketTearTimer / 0.14 : 0;
      const stubDx = Math.round(tearProgress * 18);
      const stubDy = Math.round(tearProgress * 22);
      const stubRot = tearProgress * 0.12;

      const ticketX = LX;
      const ticketY = 80;
      const stubW = 84;
      const mainW = LW - stubW;
      const ticketW = LW;
      const ticketH = 308;
      const seamX = ticketX + mainW;
      const notchR = 9;
      const cornerR = 4;

      if (tearProgress === 0) {
        drawTicketSurface(
          ctx,
          () => traceUnifiedTicketPath(ctx, ticketX, ticketY, ticketW, ticketH, seamX, cornerR, notchR),
          ticketX,
          ticketY,
          ticketW,
          ticketH,
          grain
        );
        drawPerforationHoles(ctx, seamX, ticketY, ticketH, notchR);
        drawTicketStubContent(ctx, seamX, ticketY, stubW, st.seasonNumber, st.currentRound, home.isUser);
      } else {
        drawTicketSurface(
          ctx,
          () => traceLeftTearHalfPath(ctx, ticketX, ticketY, mainW, ticketH, cornerR, notchR),
          ticketX,
          ticketY,
          mainW,
          ticketH,
          grain
        );

        ctx.save();
        ctx.translate(seamX + stubDx, ticketY + stubDy);
        ctx.rotate(stubRot);
        drawTicketSurface(
          ctx,
          () => traceRightStubHalfPath(ctx, 0, 0, stubW, ticketH, cornerR, notchR),
          0,
          0,
          stubW,
          ticketH,
          grain
        );
        drawTicketStubContent(ctx, 0, 0, stubW, st.seasonNumber, st.currentRound, home.isUser);
        ctx.restore();
      }

      drawText(ctx, `MATCH TICKET · 第 ${st.currentRound}/${totalRounds} 轮`, ticketX + 14, ticketY + 13, {
        size: 13,
        bold: true,
        color: THEME.PAPER_CREAM,
        mono: true,
      });
      drawText(ctx, `${tierInfo.shortLabel} · 暂列第 ${userRankIdx + 1} 名`, ticketX + mainW - 16, ticketY + 13, {
        size: 13,
        bold: true,
        color: THEME.PAPER_CREAM,
        align: 'right',
      });

      // 红蓝斜切漫画对抗海报（#E03A2E vs #2B6BE6 + 粗黑斜分割 + 强网点）
      const pX = ticketX + 14;
      const pY = ticketY + 38;
      const pW = mainW - 32;
      const pH = 128;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pX, pY, pW, pH, 3);
      ctx.clip();
      ctx.fillStyle = THEME.VERMILION;
      ctx.beginPath();
      ctx.moveTo(pX, pY);
      ctx.lineTo(pX + pW * 0.56, pY);
      ctx.lineTo(pX + pW * 0.44, pY + pH);
      ctx.lineTo(pX, pY + pH);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = THEME.COBALT;
      ctx.beginPath();
      ctx.moveTo(pX + pW * 0.56, pY);
      ctx.lineTo(pX + pW, pY);
      ctx.lineTo(pX + pW, pY + pH);
      ctx.lineTo(pX + pW * 0.44, pY + pH);
      ctx.closePath();
      ctx.fill();

      const htPoster = getHalftonePattern(ctx, true);
      if (htPoster) {
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = htPoster;
        ctx.fillRect(pX, pY, pW, pH);
        ctx.globalAlpha = 1;
      }

      // 居中粗黑斜切分隔墨线
      ctx.strokeStyle = THEME.INK_LINE;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(pX + pW * 0.56, pY);
      ctx.lineTo(pX + pW * 0.44, pY + pH);
      ctx.stroke();
      ctx.restore();
      drawRoundRect(ctx, pX, pY, pW, pH, 3, undefined, THEME.INK_LINE, 2.5);

      const homeCx = pX + 86;
      const awayCx = pX + pW - 86;
      const midCx = pX + pW / 2;

      drawClubCrest(ctx, homeCx, pY + 42, 26, home);
      drawText(ctx, fitText(ctx, home.name, 150, 15.5, true), homeCx + 1.5, pY + 85.5, {
        size: 15.5,
        bold: true,
        align: 'center',
        color: THEME.HARD_SHADOW,
      });
      drawText(ctx, fitText(ctx, home.name, 150, 15.5, true), homeCx, pY + 84, {
        size: 15.5,
        bold: true,
        align: 'center',
        color: THEME.PAPER_CREAM,
      });
      drawText(ctx, `#${homeRankIdx + 1} · ${homeRow?.points ?? 0}分 · ${home.formation}`, homeCx, pY + 108, {
        size: 12.5,
        bold: true,
        align: 'center',
        color: 'rgba(244, 239, 228, 0.92)',
      });

      // 倾斜荧光绿 VS 徽章 + 高对比「我方主场」橡胶印章（朱红油墨印在暖白底上）
      ctx.save();
      ctx.translate(midCx, pY + 48);
      ctx.rotate(-0.12);
      drawRoundRect(ctx, -34 + 3, -22 + 3, 68, 44, 3, THEME.HARD_SHADOW);
      drawRoundRect(ctx, -34, -22, 68, 44, 3, THEME.LIME, THEME.INK_LINE, 2.5);
      ctx.font = `italic 900 26px ${THEME.NUM_FONT_FAMILY}`;
      ctx.fillStyle = THEME.PAPER_INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', 0, 2);
      ctx.restore();
      drawStamp(ctx, home.isUser ? '我方主场' : '客场征战', midCx, pY + 104, home.isUser ? THEME.VERMILION : THEME.PAPER_INK, -5, 0.85);

      drawClubCrest(ctx, awayCx, pY + 42, 26, away);
      drawText(ctx, fitText(ctx, away.name, 150, 15.5, true), awayCx + 1.5, pY + 85.5, {
        size: 15.5,
        bold: true,
        align: 'center',
        color: THEME.HARD_SHADOW,
      });
      drawText(ctx, fitText(ctx, away.name, 150, 15.5, true), awayCx, pY + 84, {
        size: 15.5,
        bold: true,
        align: 'center',
        color: THEME.PAPER_CREAM,
      });
      drawText(ctx, `#${awayRankIdx + 1} · ${awayRow?.points ?? 0}分 · ${away.formation}`, awayCx, pY + 108, {
        size: 12.5,
        bold: true,
        align: 'center',
        color: 'rgba(244, 239, 228, 0.92)',
      });

      // 球探简报条（暖纸副区）
      const oppClub = home.isUser ? away : home;
      const brief = league.getOpponentBriefing(oppClub.id);
      const intel = prep?.matchupIntel;
      drawRoundRect(ctx, pX, pY + 136, pW, 54, 3, THEME.PAPER_WARM, THEME.INK_LINE, 1.8);
      drawBadge(ctx, pX + 10, pY + 143, 82, 22, intel ? `了解 ${intel.familiarity}%` : '球探', THEME.BG_PANEL, THEME.LIME);
      drawText(ctx, fitText(ctx, `${brief.styleName} · ${brief.weakLineLabel}`, pW - 220, 13.5, true), pX + 100, pY + 154, {
        size: 13.5,
        bold: true,
        color: THEME.PAPER_INK,
      });
      const subTip = intel?.chosenCounterId
        ? intel.spotCorrect
          ? '破绽锁定生效 · 战术红利已就绪'
          : '已指证（误判烟雾弹）'
        : brief.counterTip;
      drawText(ctx, fitText(ctx, subTip, pW - 144, 12.5), pX + 10, pY + 176, {
        size: 12.5,
        bold: true,
        color: intel?.spotCorrect ? THEME.VERMILION : THEME.PAPER_MUTED,
      });
      if (intel) {
        const needsRewardPick = !!intel.spotCorrect && !intel.chosenRewardKind;
        drawButton(ctx, hits, pX + pW - 128, pY + 141, 120, 44, needsRewardPick ? '选针对红利' : '录像侦察', () => {
          this.scoutNotice = '';
          this.selectedZoneId = null;
          this.scoutModalOpen = true;
        }, { variant: needsRewardPick ? 'gold' : 'ghost', fontSize: 13 });
      }

      // 开球主按钮（触发 140ms 撕票动画后进场）+ 快进按钮
      const triggerKickoff = () => {
        if (this.ticketTearTimer > 0) return;
        SoundEngine.playPackRip();
        this.ticketTearTimer = 0.14;
        this.pendingStartMatch = actions.onStartMatch;
      };
      drawButton(ctx, hits, pX, ticketY + 244, pW - 110, 50, '吹响开场哨 · 亲自指挥 ▶', triggerKickoff, {
        variant: 'primary',
        fontSize: 15.5,
      });
      drawButton(ctx, hits, pX + pW - 100, ticketY + 244, 100, 50, '⏩ 快进', () => {
        actions.onQuickSim?.();
      }, { variant: 'ghost', fontSize: 13.5 });
    }

    // 左下：赛前整备 + 更衣室（深松石面板，大字 >= 13.5px，按钮 >= 44px）
    drawPrintCard(ctx, LX, 400, LW, 304, { paper: false, topBandColor: THEME.LIME, radius: 3, shadowOffset: 5 });
    if (isSummerWindow) {
      const gkCnt = club.squad.filter(p => p.role === 'GK').length;
      const defCnt = club.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)).length;
      const midCnt = club.squad.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role)).length;
      const fwdCnt = club.squad.filter(p => ['LW', 'RW', 'ST'].includes(p.role)).length;
      const avgOvr = club.squad.length > 0 ? Math.round(club.squad.reduce((acc, p) => acc + p.ca, 0) / club.squad.length) : 0;

      drawBadge(ctx, LX + 16, 416, 118, 24, '季前阵容概览', THEME.BG_DEEP, THEME.BRASS);
      drawText(ctx, `均评 ${avgOvr} · ${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, LX + 144, 428, {
        size: 13.5,
        bold: true,
        color: THEME.TX1,
      });

      const posBoxes = [
        { label: '门将 GK', val: `${gkCnt}`, col: THEME.BRASS },
        { label: '后卫 DEF', val: `${defCnt}`, col: THEME.COBALT },
        { label: '中场 MID', val: `${midCnt}`, col: THEME.LIME },
        { label: '前锋 FWD', val: `${fwdCnt}`, col: THEME.VERMILION },
      ];
      posBoxes.forEach((pb, idx) => {
        const bx = LX + 16 + idx * 134;
        drawRoundRect(ctx, bx, 452, 126, 66, 8, THEME.BG_PANEL, THEME.INK_LINE, 2);
        drawText(ctx, pb.label, bx + 63, 470, { size: 12.5, color: THEME.TX2, align: 'center' });
        drawText(ctx, `${pb.val} 人`, bx + 63, 496, { size: 18, bold: true, color: pb.col, align: 'center', mono: true });
      });

      drawRoundRect(ctx, LX + 16, 530, LW - 32, 158, 10, THEME.BG_PANEL, THEME.INK_LINE, 2);
      const mentorImg = AssetLoader.get('portrait_mentor');
      if (mentorImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(LX + 28, 542, 90, 134, 8);
        ctx.clip();
        ctx.drawImage(mentorImg, LX + 28, 542, 90, 134);
        ctx.restore();
        drawRoundRect(ctx, LX + 28, 542, 90, 134, 8, undefined, THEME.INK_LINE, 2);
      }
      const guideX = mentorImg ? LX + 134 : LX + 34;
      drawText(ctx, '助教备忘 · 启程清单', guideX, 554, { size: 15, bold: true, color: THEME.BRASS });
      const steps = [
        { ok: true, txt: '已完成 3 轮核心开包，基石球员入队' },
        { ok: club.squad.length >= 26, txt: `补齐 26 人大名单（当前 ${club.squad.length}/26）` },
        { ok: false, txt: '点击上方「盖章开赛」正式踏上征程' },
      ];
      steps.forEach((stItem, si) => {
        const sy = 588 + si * 32;
        drawBadge(ctx, guideX, sy - 11, 24, 22, stItem.ok ? '✓' : `${si + 1}`, stItem.ok ? THEME.BG_PITCH_ALT : THEME.BG_DEEP, stItem.ok ? THEME.LIME : THEME.TX1);
        drawText(ctx, stItem.txt, guideX + 32, sy, { size: 13.5, color: stItem.ok ? THEME.LIME : THEME.TX1 });
      });
    } else if (prep) {
      const wInfo = WEATHER_INFO[prep.weather];
      drawBadge(ctx, LX + 16, 414, 92, 24, wInfo.label, THEME.BG_PANEL, wInfo.color);
      drawText(ctx, fitText(ctx, wInfo.tip, 320, 13.5), LX + 118, 426, { size: 13.5, color: THEME.TX1 });
      drawText(ctx, `整备 ${prep.actionsLeft}/1`, LX + LW - 18, 426, {
        size: 13.5,
        bold: true,
        align: 'right',
        color: prep.actionsLeft > 0 ? THEME.LIME : THEME.TX3,
        mono: true,
      });

      const trainBtns: Array<{ kind: PrepTrainingKind; label: string; icon: 'stat_fit' | 'shield' | 'sparkle' | 'sword' }> = [
        { kind: 'physio', label: '理疗 +14%', icon: 'stat_fit' },
        { kind: 'tactical', label: '传防 +2', icon: 'shield' },
        { kind: 'mentor', label: '青训 +1', icon: 'sparkle' },
        { kind: 'sharp', label: '射门 +2', icon: 'sword' },
      ];
      trainBtns.forEach((tb, bi) => {
        const bx = LX + 16 + bi * 134;
        const done = prep.doneTraining === tb.kind;
        drawButton(ctx, hits, bx, 448, 128, 44, tb.label, () => {
          const res = league.applyPrepTraining(tb.kind);
          if (res.msg) this.prepToast = res.msg;
          if (res.ok) SoundEngine.playCraftSuccess();
          else SoundEngine.playWarning();
          actions.onSave?.();
        }, {
          variant: done ? 'lime' : 'ghost',
          disabled: prep.actionsLeft <= 0 && !done,
          fontSize: 13,
          icon: tb.icon,
        });
        if (done) {
          drawStamp(ctx, '已练', bx + 98, 454, THEME.VERMILION, -12, 0.72);
        }
      });

      const talk = prep.playerTalk;
      if (talk) {
        drawRoundRect(ctx, LX + 16, 504, LW - 32, 186, 10, THEME.BG_PANEL, talk.resolved ? THEME.LIME : THEME.BRASS, 2);
        const coachImg = AssetLoader.get('portrait_linfeng');
        if (coachImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(LX + 28, 516, 56, 68, 6);
          ctx.clip();
          ctx.drawImage(coachImg, LX + 28, 516, 56, 68);
          ctx.restore();
        }
        const txLeft = coachImg ? LX + 96 : LX + 30;
        drawBadge(ctx, txLeft, 516, 52, 22, talk.role, THEME.BG_DEEP, THEME.TX1);
        drawText(ctx, `${talk.playerName} · 赛前沟通`, txLeft + 60, 527, { size: 14.5, bold: true, color: THEME.BRASS });
        if (talk.resolved) {
          drawText(ctx, `已回应：${talk.chosenLabel}`, txLeft, 562, { size: 14, bold: true, color: THEME.LIME });
          drawWrappedText(ctx, this.prepToast || '球员士气已稳住，专注迎接本轮较量', LX + 30, 596, LW - 60, 22, {
            size: 13.5,
            color: THEME.TX2,
            maxLines: 3,
          });
        } else {
          drawWrappedText(ctx, talk.prompt, LX + 30, 588, LW - 60, 21, { size: 13.5, color: THEME.TX1, maxLines: 2 });
          drawButton(ctx, hits, LX + 30, 636, 242, 44, talk.optA.label, () => {
            const res = league.resolvePlayerTalk('A');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'primary', fontSize: 13 });
          drawButton(ctx, hits, LX + 284, 636, 242, 44, talk.optB.label, () => {
            const res = league.resolvePlayerTalk('B');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'ghost', fontSize: 13 });
        }
      } else {
        const strainList = club.squad.filter(p => p.strainWarning || (p.injuredRounds ?? 0) > 0 || (p.suspendedRounds ?? 0) > 0);
        drawRoundRect(ctx, LX + 16, 504, LW - 32, 96, 9, THEME.BG_PANEL, THEME.INK_LINE, 1.8);
        drawText(ctx, '上轮战况复盘与备忘', LX + 30, 524, { size: 14, bold: true, color: '#7DD3FC' });
        const reviewMsg = this.prepToast || prep.nextMatchBuff?.note || st.lastMatchReview || '首轮开赛后将生成上轮战术复盘与 xG 诊断';
        drawWrappedText(ctx, reviewMsg, LX + 30, 548, LW - 60, 21, {
          size: 13.5,
          color: this.prepToast || prep.nextMatchBuff?.note ? THEME.LIME : THEME.TX1,
          maxLines: 2,
        });

        drawRoundRect(ctx, LX + 16, 610, LW - 32, 80, 9, THEME.BG_PANEL, strainList.length > 0 ? THEME.BRASS : THEME.INK_LINE, 1.8);
        drawText(ctx, '队医与体能状态', LX + 30, 628, {
          size: 14,
          bold: true,
          color: strainList.length > 0 ? THEME.BRASS : THEME.LIME,
        });
        drawWrappedText(
          ctx,
          strainList.length > 0
            ? `预警：${strainList.slice(0, 3).map(p => `${p.name}(${(p.injuredRounds ?? 0) > 0 ? '伤停' : (p.suspendedRounds ?? 0) > 0 ? '停赛' : '疲惫'})`).join('、')}`
            : '全队健康度良好，无伤停或体能预警',
          LX + 30,
          654,
          LW - 60,
          20,
          { size: 13.5, color: strainList.length > 0 ? '#FDE68A' : THEME.TX2, maxLines: 2 }
        );
      }
    }

    // ==================== 右栏下层：巨型斜体排名暖纸票 + 肉鸽赛季词条大卡 ====================
    const eqSkills = league.getEquippedActiveSkills();
    const presets = league.getTacticalPresets();
    const curPresetIdx = presets.findIndex(pr => pr && club.formation === pr.formation && club.style === pr.style);
    const rogue = league.getV6SeasonRogue();
    const ast = league.getV6Astrolabe();
    const segCards: Record<V6CheckpointKey, ReturnType<LeagueManager['getV6CheckpointDirectives']>> = {
      s1: league.getV6CheckpointDirectives('s1'),
      s2: league.getV6CheckpointDirectives('s2'),
      s3: league.getV6CheckpointDirectives('s3'),
      s4: league.getV6CheckpointDirectives('s4'),
    };

    const BODY_Y = 218; // 留出顶部 124px（含黄铜夹头 + 备战快捷入口）给融合式战术夹板

    // 1. 巨型斜体排名暖纸票 (y: 218, h: 196)
    const hovLeague = hits.isHovered(RX, BODY_Y, RW, 196);
    drawPrintCard(ctx, RX, BODY_Y, RW, 196, {
      paper: true,
      topBandColor: THEME.BRASS,
      topBandHeight: 28,
      radius: 3,
      shadowOffset: hovLeague ? 6 : 5,
    });
    drawText(ctx, `${tierInfo.name} · 实时联赛排名`, RX + 16, BODY_Y + 14, {
      size: 13.5,
      bold: true,
      color: THEME.PAPER_INK,
    });
    drawButton(ctx, hits, RX + RW - 142, BODY_Y + 38, 128, 44, '完整积分榜 ›', () => actions.onNavigate('league'), {
      variant: 'ghost',
      fontSize: 13.5,
    });

    // 巨型斜体 #N
    ctx.save();
    ctx.font = `italic 900 54px ${THEME.NUM_FONT_FAMILY}`;
    ctx.fillStyle = userRankIdx < 2 ? THEME.VERMILION : THEME.PAPER_INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${userRankIdx + 1}`, RX + 22, BODY_Y + 104);
    ctx.restore();

    const rankStatX = RX + 148;
    drawText(
      ctx,
      userRow ? `${userRow.points} 分  |  ${userRow.won}胜 ${userRow.drawn}平 ${userRow.lost}负` : '0 分  |  季前未开赛',
      rankStatX,
      BODY_Y + 92,
      { size: 19, bold: true, color: THEME.PAPER_INK }
    );
    drawText(
      ctx,
      userRow
        ? `进 ${userRow.gf} 球 · 失 ${userRow.ga} 球 · 净胜 ${userRow.gf - userRow.ga >= 0 ? '+' : ''}${userRow.gf - userRow.ga} · 均评 ${club.squad.length > 0 ? Math.round(club.squad.reduce((a, b) => a + b.ca, 0) / club.squad.length) : 0}`
        : `阵容 ${club.squad.length}/26 人 · 补齐阵容后即可开赛`,
      rankStatX,
      BODY_Y + 124,
      { size: 14, bold: true, color: THEME.PAPER_MUTED }
    );
    drawStamp(
      ctx,
      userRankIdx < 2 ? '冲级区' : userRankIdx >= standings.length - 2 ? '保级区' : '中游稳固',
      RX + RW - 76,
      BODY_Y + 122,
      userRankIdx < 2 ? THEME.VERMILION : THEME.COBALT,
      -8,
      0.90
    );

    // 底部浅虚线分隔 + 俱乐部资金/大名单/剩余轮次速览
    ctx.save();
    ctx.strokeStyle = 'rgba(17, 20, 18, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(RX + 16, BODY_Y + 154);
    ctx.lineTo(RX + RW - 16, BODY_Y + 154);
    ctx.stroke();
    ctx.restore();

    const clubSnapText = isSummerWindow
      ? `资金 ¥${league.getClubFunds()}万  ·  大名单 ${club.squad.length}/26 人  ·  季前夏窗期`
      : `资金 ¥${league.getClubFunds()}万  ·  大名单 ${club.squad.length} 人  ·  剩余 ${Math.max(0, totalRounds - st.currentRound + 1)} 轮`;
    drawText(ctx, clubSnapText, RX + 18, BODY_Y + 175, {
      size: 13,
      bold: true,
      color: THEME.PAPER_MUTED,
    });
    hits.add(RX, BODY_Y, RW - 150, 196, () => actions.onNavigate('league'));

    // 2. 肉鸽赛季词条 & 俱乐部脉络卡 (y: 430, h: 274 -> 底部 704 与左栏严格齐平)
    const perkY = 430;
    const perkH = 274;
    const story = st.storyline;
    const syn = computePerkSynergies(club.perks);
    const hovPerks = hits.isHovered(RX, perkY, RW, perkH);
    drawPrintCard(ctx, RX, perkY, RW, perkH, {
      paper: false,
      topBandColor: THEME.VIOLET,
      halftone: true,
      radius: 3,
      shadowOffset: hovPerks ? 6 : 5,
    });
    drawText(ctx, `赛季 Rogue 词条与脉络 (${club.perks.length})`, RX + 20, perkY + 32, {
      size: 16,
      bold: true,
      color: THEME.TX1,
    });
    drawButton(ctx, hits, RX + RW - 142, perkY + 16, 128, 44, '查看全部 ›', () => {
      SoundEngine.playClick();
      this.perksModalOpen = true;
    }, { variant: 'ghost', fontSize: 13.5 });

    if (club.perks.length > 0) {
      if (club.perks.length <= 2) {
        club.perks.slice(0, 2).forEach((pk, idx) => {
          const bx = RX + 18 + idx * 278;
          const by = perkY + 68;
          drawRoundRect(ctx, bx, by, 266, 154, 3, THEME.BG_PANEL, THEME.INK_LINE, 2);
          drawText(ctx, fitText(ctx, pk.name, 240, 15.5, true), bx + 14, by + 26, {
            size: 15.5,
            bold: true,
            color: THEME.LIME,
          });
          drawWrappedText(ctx, pk.description, bx + 14, by + 54, 238, 22, {
            size: 13.5,
            color: THEME.TX1,
            maxLines: 4,
          });
        });
      } else {
        club.perks.slice(0, 4).forEach((pk, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const bx = RX + 18 + col * 278;
          const by = perkY + 68 + row * 82;
          drawRoundRect(ctx, bx, by, 266, 74, 3, THEME.BG_PANEL, THEME.INK_LINE, 2);
          drawText(ctx, fitText(ctx, pk.name, 240, 14.5, true), bx + 12, by + 20, {
            size: 14.5,
            bold: true,
            color: THEME.LIME,
          });
          drawWrappedText(ctx, pk.description, bx + 12, by + 40, 242, 17, {
            size: 12.5,
            color: THEME.TX1,
            maxLines: 2,
          });
        });
      }
      const perkFooterLeft = syn.synergies[0]
        ? `已激活共振：${syn.synergies[0]}`
        : story
          ? `赛季脉络：${story.title}`
          : '同系叠加 2 张词条可激活共振';
      drawText(ctx, fitText(ctx, perkFooterLeft, RW - 140, 13.5, true), RX + 20, perkY + perkH - 24, {
        size: 13.5,
        bold: true,
        color: syn.synergies[0] ? THEME.LIME : THEME.BRASS,
      });
      drawText(ctx, `圣物 ${rogue.seasonRelics.length}/5`, RX + RW - 20, perkY + perkH - 24, {
        size: 13.5,
        bold: true,
        color: '#7DD3FC',
        align: 'right',
        mono: true,
      });
    } else {
      drawRoundRect(ctx, RX + 18, perkY + 68, RW - 36, 176, 3, THEME.BG_PANEL, THEME.INK_LINE, 2);
      drawText(ctx, story ? `当前脉络：${story.title}` : '暂未激活赛季词条', RX + 32, perkY + 104, {
        size: 16,
        bold: true,
        color: THEME.LIME,
      });
      drawWrappedText(
        ctx,
        '第 8 / 16 / 24 轮赛后补强将必定出现「赛季战术词条」三选一盲盒，也可在日常肉鸽事件中获取强力词条。',
        RX + 32,
        perkY + 136,
        RW - 64,
        24,
        { size: 14, color: THEME.TX2, maxLines: 3 }
      );
      drawText(ctx, `当前赛季圣物：${rogue.seasonRelics.length}/5`, RX + 32, perkY + 220, {
        size: 13.5,
        bold: true,
        color: '#7DD3FC',
        mono: true,
      });
    }
    hits.add(RX, perkY, RW - 150, perkH, () => {
      SoundEngine.playClick();
      this.perksModalOpen = true;
    });

    // ==================== 右栏顶部：融合备战通道的主教练战术夹板抽屉（收起 124px，展开 442px） ====================
    this.renderClipboardDrawer(ctx, hits, RX, 80, RW, league, eqSkills, segCards, ast.useUniversalPool, presets, curPresetIdx, rogue, actions);

    if (this.perksModalOpen) {
      this.renderPerksModal(ctx, hits, league);
    } else if (this.scoutModalOpen && prep?.matchupIntel) {
      this.renderScoutModal(ctx, hits, league, prep.matchupIntel, prep.actionsLeft, actions);
    }
  }

  private renderClipboardDrawer(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    x: number,
    y: number,
    w: number,
    league: LeagueManager,
    eqSkills: ReturnType<LeagueManager['getEquippedActiveSkills']>,
    segCards: Record<V6CheckpointKey, ReturnType<LeagueManager['getV6CheckpointDirectives']>>,
    useUniversalPool: boolean,
    presets: ReturnType<LeagueManager['getTacticalPresets']>,
    curPresetIdx: number,
    rogue: ReturnType<LeagueManager['getV6SeasonRogue']>,
    actions: {
      onNavigate: (tab: NavRailTab) => void;
      onSave?: () => void;
    }
  ): void {
    const club = league.getUserClub();
    const animP = this.clipboardOpen ? easeOutBack(this.clipboardAnim) : easeOutCubic(this.clipboardAnim);
    const expanded = this.clipboardAnim > 0.02;

    if (expanded) {
      // 底层暗幕遮罩（点击抽屉外空白处平滑收起）
      ctx.save();
      ctx.fillStyle = `rgba(10, 26, 20, ${(0.55 * this.clipboardAnim).toFixed(2)})`;
      ctx.fillRect(0, 0, THEME.W, THEME.H);
      ctx.restore();
      hits.clear();
      hits.add(0, 0, THEME.W, THEME.H, () => {
        this.clipboardOpen = false;
        SoundEngine.playClick();
      });
    }

    const collapsedH = 124;
    const expandedH = 528;
    const curH = Math.round(collapsedH + (expandedH - collapsedH) * Math.max(0, animP));

    // 抽屉本体（深松石战术夹板 + 顶部黄铜金属夹头铆钉）
    drawPrintCard(ctx, x, y, w, curH, { paper: false, topBandColor: THEME.BRASS, radius: 3, shadowOffset: 6 });

    // 黄铜金属夹头横条 + 两侧铆钉
    drawRoundRect(ctx, x + w / 2 - 74, y - 6, 148, 16, 2, THEME.BRASS, THEME.INK_LINE, 2);
    ctx.fillStyle = THEME.INK_LINE;
    ctx.beginPath();
    ctx.arc(x + w / 2 - 58, y + 2, 2.2, 0, Math.PI * 2);
    ctx.arc(x + w / 2 + 58, y + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    const presetText = curPresetIdx >= 0 ? `预案${curPresetIdx + 1}/4` : '自定义';
    const totalDirs = segCards.s1.length + segCards.s2.length + segCards.s3.length + segCards.s4.length;
    const dirSummary = useUniversalPool ? `指令 通用${segCards.s1.length}/4` : `指令 ${totalDirs}/16`;
    const summaryText = `${club.formation} ${TACTICAL_PRESETS[club.style].name} · 绝技 ${eqSkills.length}/4 · ${dirSummary} · ${presetText}`;
    drawText(ctx, fitText(ctx, summaryText, w - 168, 14.5, true), x + 18, y + 36, {
      size: 14.5,
      bold: true,
      color: THEME.TX1,
    });

    drawButton(ctx, hits, x + w - 144, y + 12, 128, 44, this.clipboardOpen ? '收起夹板 ▲' : '展开夹板 ▼', () => {
      this.clipboardOpen = !this.clipboardOpen;
      SoundEngine.playClick();
    }, { variant: this.clipboardOpen ? 'lime' : 'gold', fontSize: 13.5 });

    // 整条摘要行触发热区 >=44px
    hits.addTouchTarget(x, y, w - 150, 60, () => {
      this.clipboardOpen = !this.clipboardOpen;
      SoundEngine.playClick();
    });

    // 顶部摘要与下方区域细分隔线
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 63);
    ctx.lineTo(x + w - 16, y + 63);
    ctx.stroke();

    if (expanded && this.clipboardAnim >= 0.25) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, y + 65, w - 8, Math.max(0, curH - 125));
      ctx.clip();
      ctx.globalAlpha = Math.min(1, (this.clipboardAnim - 0.2) / 0.6);

      // 1. 预案 1 / 2 / 3 / 4 物理拨片（>=44×44）
      drawText(ctx, '出战战术预案拨片', x + 18, y + 88, { size: 13.5, bold: true, color: THEME.BRASS });
      for (let pi = 0; pi < 4; pi++) {
        const pData = presets[pi];
        const activeP = pi === curPresetIdx;
        const pbx = x + 150 + pi * 106;
        drawButton(ctx, hits, pbx, y + 70, 98, 44, `预案 ${pi + 1}`, () => {
          if (!pData) {
            this.clipboardOpen = false;
            actions.onNavigate('tactics');
            return;
          }
          const res = league.applyTacticalPreset(pi);
          if (res.ok && res.preset) {
            SoundEngine.playClick();
            this.prepToast = `已切换至预案${pi + 1}：${res.preset.formation} · ${TACTICAL_PRESETS[res.preset.style].name}`;
            actions.onSave?.();
          }
        }, { variant: activeP ? 'lime' : 'ghost', fontSize: 13.5 });
      }

      // 2. 四段临场指令（赛段切换页签 + 当前赛段的 4 张暖纸便签）
      drawText(ctx, '四段临场指令（每段 4 卡）', x + 18, y + 132, { size: 13.5, bold: true, color: THEME.TX1 });
      drawText(
        ctx,
        useUniversalPool ? '通用4卡 · 四段共用' : `四段独立配 · 共 ${totalDirs}/16`,
        x + w - 18,
        y + 132,
        {
          size: 12.5,
          bold: true,
          color: useUniversalPool ? THEME.BRASS : THEME.LIME,
          align: 'right',
          mono: true,
        }
      );

      const segMeta: Array<{ key: V6CheckpointKey; label: string }> = [
        { key: 's1', label: "0'-20'" },
        { key: 's2', label: "21'-45'" },
        { key: 's3', label: "46'-70'" },
        { key: 's4', label: "71'-90'" },
      ];
      const tabW = 132;
      segMeta.forEach((seg, si) => {
        const tabX = x + 16 + si * (tabW + 8);
        const isSegAct = this.clipboardSeg === seg.key;
        drawButton(
          ctx,
          hits,
          tabX,
          y + 146,
          tabW,
          34,
          `${seg.label} (${segCards[seg.key].length}/4)`,
          () => {
            this.clipboardSeg = seg.key;
            SoundEngine.playClick();
          },
          { variant: isSegAct ? 'lime' : 'ghost', fontSize: 12.5 }
        );
      });

      const activeSegCards = segCards[this.clipboardSeg];
      const cw = Math.floor((w - 52) / 4);
      for (let ci = 0; ci < 4; ci++) {
        const cx = x + 16 + ci * (cw + 6);
        const cy = y + 188;
        const entry = activeSegCards[ci];
        drawRoundRect(ctx, cx, cy, cw, 92, 6, entry ? THEME.PAPER_CREAM : THEME.BG_PANEL, THEME.INK_LINE, 2);
        if (entry) {
          const zoneName = entry.def.zone === 'ATT' ? '前场' : entry.def.zone === 'MID' ? '中场' : '后场';
          const zoneCol = entry.def.zone === 'ATT' ? THEME.VERMILION : entry.def.zone === 'MID' ? THEME.COBALT : '#15803D';
          const tendLabel = entry.def.tendency === 'ATK' ? '攻' : '守';
          drawText(ctx, `${zoneName}·${tendLabel}`, cx + 8, cy + 16, {
            size: 11.5,
            bold: true,
            color: zoneCol,
            rawSize: true,
          });
          drawText(ctx, `${entry.effectiveTpCost} TP`, cx + cw - 8, cy + 16, {
            size: 12,
            bold: true,
            color: THEME.COBALT,
            align: 'right',
            mono: true,
          });
          drawText(ctx, fitText(ctx, entry.def.name, cw - 16, 13.5, true), cx + 8, cy + 38, {
            size: 13.5,
            bold: true,
            color: THEME.PAPER_INK,
          });
          drawText(ctx, fitText(ctx, entry.def.benefitSummary, cw - 16, 12), cx + 8, cy + 64, {
            size: 12,
            color: THEME.PAPER_MUTED,
          });
        } else {
          drawText(ctx, `槽位 ${ci + 1} 空`, cx + cw / 2, cy + 48, {
            size: 12.5,
            color: THEME.TX3,
            align: 'center',
          });
        }
      }

      // 3. F1–F4 主动绝技（接入 16 张绝技模切贴纸）
      drawText(ctx, `F1–F4 主动绝技 (${eqSkills.length}/4)`, x + 18, y + 300, {
        size: 13.5,
        bold: true,
        color: '#7DD3FC',
      });
      for (let si = 0; si < 4; si++) {
        const sx = x + 16 + si * (cw + 6);
        const sy = y + 314;
        const sk = eqSkills[si];
        drawRoundRect(ctx, sx, sy, cw, 46, 6, sk ? THEME.BG_PITCH_ALT : THEME.BG_PANEL, THEME.INK_LINE, 1.8);
        if (sk) {
          const skImg = AssetLoader.get(getSkillAssetId(sk.id, sk.styleTag));
          if (skImg && typeof ctx.drawImage === 'function') {
            ctx.save();
            ctx.translate(sx + 20, sy + 23);
            ctx.rotate((si % 2 === 0 ? -1.8 : 1.8) * Math.PI / 180);
            ctx.drawImage(skImg, -17, -17, 34, 34);
            ctx.restore();
          }
          const textOff = skImg ? 40 : 8;
          drawText(ctx, `F${si + 1} ${fitText(ctx, sk.name, cw - textOff - 6, 12, true)}`, sx + textOff, sy + 15, { size: 12, bold: true, color: THEME.LIME });
          drawText(ctx, `R${sk.effectiveRank ?? sk.rank ?? 1} · ${sk.cooldownMinutes}m`, sx + textOff, sy + 33, { size: 12, color: THEME.TX2, mono: true });
        } else {
          drawText(ctx, `F${si + 1} 空槽`, sx + cw / 2, sy + 23, { size: 12, color: THEME.TX3, align: 'center' });
        }
      }

      // 4. 本季战术圣物 5 槽展示架（接入 8 张圣物模切贴纸，支持悬停/点击查看效果）
      const relicY = y + 378;
      const relics = rogue.seasonRelics.slice(0, 5);
      let activeRelicId: V6RelicId | null = this.selectedRelicId && relics.includes(this.selectedRelicId) ? this.selectedRelicId : null;
      drawText(ctx, `本季战术圣物 (${relics.length}/5)`, x + 18, relicY, {
        size: 13.5,
        bold: true,
        color: THEME.BRASS,
      });
      const slotGap = 8;
      const slotW = Math.floor((w - 32 - slotGap * 4) / 5);
      for (let ri = 0; ri < 5; ri++) {
        const rxSlot = x + 16 + ri * (slotW + slotGap);
        const rySlot = relicY + 12;
        const rId = relics[ri];
        const rDef = rId ? V6_RELICS[rId] : null;
        const hovered = hits.isHovered(rxSlot, rySlot, slotW, 48);
        if (hovered && rId) activeRelicId = rId;
        if (rDef && rId) {
          const rarCol = rDef.rarity === 'mythic' ? THEME.VERMILION : rDef.rarity === 'gold' ? THEME.BRASS : THEME.VIOLET;
          drawRoundRect(ctx, rxSlot + 2, rySlot + 2, slotW, 48, 5, THEME.HARD_SHADOW);
          drawRoundRect(ctx, rxSlot, rySlot, slotW, 48, 5, THEME.PAPER_CREAM, rarCol, 2.2);
          ctx.fillStyle = rarCol;
          ctx.fillRect(rxSlot + 2, rySlot + 2, slotW - 4, 4);
          const rArtId = getRelicAssetId(rId);
          const rImg = rArtId ? AssetLoader.get(rArtId) : null;
          if (rImg && typeof ctx.drawImage === 'function') {
            ctx.save();
            ctx.translate(rxSlot + 20, rySlot + 27);
            ctx.rotate((ri % 2 === 0 ? -2 : 2) * Math.PI / 180);
            ctx.drawImage(rImg, -17, -17, 34, 34);
            ctx.restore();
            drawText(ctx, fitText(ctx, rDef.name, slotW - 42, 12, true, true), rxSlot + 38, rySlot + 21, {
              size: 12,
              bold: true,
              color: THEME.PAPER_INK,
            });
            drawText(ctx, rDef.rarity === 'mythic' ? '神话' : rDef.rarity === 'gold' ? '传说' : '史诗', rxSlot + 38, rySlot + 38, {
              size: 11.5,
              rawSize: true,
              bold: true,
              color: rarCol,
            });
          } else {
            drawIcon(ctx, rDef.rarity === 'mythic' ? 'star' : rDef.rarity === 'gold' ? 'trophy' : 'sparkle', rxSlot + 16, rySlot + 20, 13, rarCol);
            drawText(ctx, fitText(ctx, rDef.name, slotW - 28, 12, true, true), rxSlot + 26, rySlot + 20, {
              size: 12,
              bold: true,
              color: THEME.PAPER_INK,
            });
            drawText(ctx, rDef.rarity === 'mythic' ? '神话圣物' : rDef.rarity === 'gold' ? '传说圣物' : '史诗圣物', rxSlot + slotW / 2, rySlot + 38, {
              size: 12,
              color: rarCol,
              align: 'center',
            });
          }
          hits.addTouchTarget(rxSlot, rySlot, slotW, 48, () => {
            this.selectedRelicId = this.selectedRelicId === rId ? null : rId;
            SoundEngine.playClick();
          });
        } else {
          ctx.save();
          drawRoundRect(ctx, rxSlot, rySlot, slotW, 48, 5, THEME.BG_PANEL);
          ctx.strokeStyle = 'rgba(154, 176, 163, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(rxSlot + 1, rySlot + 1, slotW - 2, 46);
          ctx.restore();
          drawText(ctx, `空槽 ${ri + 1}`, rxSlot + slotW / 2, rySlot + 24, {
            size: 12,
            color: THEME.TX3,
            align: 'center',
          });
        }
      }
      const shownRelic = activeRelicId ? V6_RELICS[activeRelicId] : (relics[0] ? V6_RELICS[relics[0]] : null);
      const tipText = shownRelic
        ? `【${shownRelic.name}】${shownRelic.desc}`
        : '赛后 3 选 1 补强盲盒中可赢取赛季战术圣物（最多同时装备 5 件）';
      drawText(ctx, fitText(ctx, tipText, w - 36, 12), x + 18, relicY + 74, {
        size: 12,
        color: shownRelic ? THEME.LIME : THEME.TX3,
      });

      ctx.restore();
    }

    // 融合备战通道（收起态与展开态统一贴附夹板底部，零重复直达 4 大备战页）
    const btnY = y + curH - 54;
    if (expanded) {
      ctx.strokeStyle = 'rgba(244, 239, 228, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 16, btnY - 8);
      ctx.lineTo(x + w - 16, btnY - 8);
      ctx.stroke();
    }

    const quickNavs: Array<{ label: string; tab: NavRailTab; variant: 'gold' | 'ghost' }> = [
      { label: '阵型战术 ›', tab: 'tactics', variant: 'gold' },
      { label: '四赛段配卡 ›', tab: 'cards', variant: 'ghost' },
      { label: '转会青训 ›', tab: 'transfer_hub', variant: 'ghost' },
      { label: '星盘绝技 ›', tab: 'meta', variant: 'ghost' },
    ];
    quickNavs.forEach((qn, qi) => {
      const bw = 132;
      drawButton(ctx, hits, x + 16 + qi * (bw + 8), btnY, bw, 44, qn.label, () => {
        this.clipboardOpen = false;
        actions.onNavigate(qn.tab);
      }, { variant: qn.variant, fontSize: 13.5 });
    });
  }

  private renderPerksModal(ctx: CanvasRenderingContext2D, hits: HitRegistry, league: LeagueManager): void {
    const st = league.getState();
    const club = league.getUserClub();
    const story = st.storyline;
    const syn = computePerkSynergies(club.perks);
    const rogue = league.getV6SeasonRogue();
    const relics = rogue.seasonRelics.slice(0, 5);

    ctx.fillStyle = 'rgba(10, 26, 20, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 164;
    const my = 56;
    const mw = 952;
    const mh = 608;
    drawPrintCard(ctx, mx, my, mw, mh, { paper: false, topBandColor: THEME.BRASS, radius: 10, shadowOffset: 6 });

    drawIcon(ctx, 'sparkle', mx + 26, my + 32, 16, THEME.BRASS);
    drawText(ctx, `俱乐部赛季圣物与 Rogue 战术词条 (${club.perks.length})`, mx + 48, my + 32, {
      size: 18,
      bold: true,
      color: THEME.BRASS,
    });
    if (story) {
      drawBadge(ctx, mx + 520, my + 20, 126, 24, story.title, THEME.BG_PANEL, '#C4B5FD');
    }
    drawButton(ctx, hits, mx + mw - 104, my + 14, 84, 44, '关闭', () => {
      this.perksModalOpen = false;
    }, { variant: 'ghost', fontSize: 14, icon: 'close' });

    // 顶部：本季战术圣物陈列架 (X/5)
    const shelfY = my + 68;
    drawText(ctx, `本季战术圣物陈列架 (${relics.length}/5)`, mx + 26, shelfY + 8, {
      size: 14.5,
      bold: true,
      color: THEME.BRASS,
    });
    const rGap = 10;
    const rW = Math.floor((mw - 52 - rGap * 4) / 5);
    for (let ri = 0; ri < 5; ri++) {
      const rxS = mx + 26 + ri * (rW + rGap);
      const ryS = shelfY + 24;
      const rId = relics[ri];
      const rDef = rId ? V6_RELICS[rId] : null;
      if (rDef && rId) {
        const rarCol = rDef.rarity === 'mythic' ? THEME.VERMILION : rDef.rarity === 'gold' ? THEME.BRASS : THEME.VIOLET;
        const rarLabel = rDef.rarity === 'mythic' ? '神话' : rDef.rarity === 'gold' ? '传说' : '史诗';
        drawPrintCard(ctx, rxS, ryS, rW, 124, { paper: true, topBandColor: rarCol, topBandHeight: 5, radius: 6, shadowOffset: 3, strokeColor: THEME.INK_LINE, lineWidth: 2 });
        drawBadge(ctx, rxS + 8, ryS + 10, 44, 20, rarLabel, rarCol, rDef.rarity === 'gold' ? THEME.PAPER_INK : THEME.PAPER_CREAM);
        const rArtId = getRelicAssetId(rId);
        const rImg = rArtId ? AssetLoader.get(rArtId) : null;
        if (rImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.translate(rxS + rW - 28, ryS + 32);
          ctx.rotate((ri % 2 === 0 ? -2 : 2) * Math.PI / 180);
          ctx.drawImage(rImg, -22, -22, 44, 44);
          ctx.restore();
        }
        drawText(ctx, fitText(ctx, rDef.name, rW - 60, 13.5, true), rxS + 8, ryS + 44, {
          size: 13.5,
          bold: true,
          color: THEME.PAPER_INK,
        });
        drawWrappedText(ctx, rDef.desc, rxS + 8, ryS + 60, rW - 16, 17, {
          size: 12,
          color: THEME.PAPER_MUTED,
          maxLines: 3,
        });
      } else {
        ctx.save();
        drawRoundRect(ctx, rxS, ryS, rW, 124, 6, THEME.BG_PANEL);
        ctx.strokeStyle = 'rgba(154, 176, 163, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(rxS + 2, ryS + 2, rW - 4, 120);
        ctx.restore();
        drawText(ctx, `圣物槽 ${ri + 1}`, rxS + rW / 2, ryS + 52, { size: 13, bold: true, color: THEME.TX3, align: 'center' });
        drawText(ctx, '待赛后获取', rxS + rW / 2, ryS + 74, { size: 12, color: THEME.TX3, align: 'center' });
      }
    }

    const perkTop = shelfY + 166;
    drawText(
      ctx,
      syn.synergies.length > 0 ? `已激活词条共振：${syn.synergies.join(' · ')}` : '同系叠加 2 张词条可激活强力共振效果',
      mx + 26,
      perkTop,
      { size: 14, bold: true, color: syn.synergies.length > 0 ? THEME.LIME : THEME.TX2 }
    );

    if (club.perks.length === 0) {
      drawRoundRect(ctx, mx + 26, perkTop + 20, mw - 52, 330, 8, THEME.BG_PANEL, THEME.INK_LINE, 2);
      drawText(ctx, '暂未激活赛季 Rogue 战术词条', mx + mw / 2, perkTop + 150, {
        size: 18,
        bold: true,
        color: THEME.TX1,
        align: 'center',
      });
      drawWrappedText(
        ctx,
        '第 8 / 16 / 24 轮赛后 3 选 1 将必定出现「赛季战术词条」盲盒，也可在日常肉鸽事件中获取强力词条与觉醒效果。',
        mx + 140,
        perkTop + 186,
        mw - 280,
        24,
        { size: 14.5, color: THEME.TX2, maxLines: 3 }
      );
    } else {
      const pkW = Math.floor((mw - 52 - 24) / 3);
      club.perks.slice(0, 6).forEach((pk, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const px = mx + 26 + col * (pkW + 12);
        const py = perkTop + 20 + row * 168;
        drawPrintCard(ctx, px, py, pkW, 156, { paper: true, topBandColor: THEME.BRASS, radius: 6, shadowOffset: 4 });
        drawText(ctx, fitText(ctx, pk.name, pkW - 28, 15, true), px + 14, py + 26, {
          size: 15,
          bold: true,
          color: THEME.VERMILION,
        });
        drawWrappedText(ctx, pk.description, px + 14, py + 48, pkW - 28, 20, {
          size: 13,
          color: THEME.PAPER_INK,
          maxLines: 5,
        });
      });
    }
  }

  private renderScoutModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    intel: OpponentMatchupIntel,
    actionsLeft: number,
    actions: {
      onSave?: () => void;
      onBurst?: (x: number, y: number, color?: string) => void;
      onShake?: (intensity: number, dur: number) => void;
    }
  ): void {
    ctx.fillStyle = 'rgba(10, 26, 20, 0.88)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 64;
    const my = 34;
    const mw = 1152;
    const mh = 652;
    drawPrintCard(ctx, mx, my, mw, mh, { paper: false, topBandColor: THEME.BRASS, radius: 12, shadowOffset: 6 });

    drawText(ctx, `战术录像室 · 沙盘抓破绽 · ${intel.oppClubName}`, mx + 24, my + 32, {
      size: 19,
      bold: true,
      color: THEME.BRASS,
    });
    if (intel.oppFormation) {
      drawBadge(ctx, mx + 390, my + 20, 74, 24, intel.oppFormation, THEME.BG_PANEL, '#7DD3FC');
    }
    drawButton(ctx, hits, mx + mw - 104, my + 14, 84, 44, '关闭', () => {
      this.scoutModalOpen = false;
    }, { variant: 'ghost', fontSize: 13.5, icon: 'close' });

    drawRoundRect(ctx, mx + 24, my + 64, mw - 48, 66, 10, THEME.BG_PANEL, THEME.INK_LINE, 2);
    const fam = intel.familiarity;
    const famCol = fam >= 70 ? THEME.LIME : fam >= 40 ? '#7DD3FC' : THEME.BRASS;
    drawText(ctx, `了解度 ${fam}%`, mx + 40, my + 84, { size: 14, bold: true, color: famCol, mono: true });
    drawRoundRect(ctx, mx + 140, my + 78, 170, 12, 6, THEME.BG_DEEP);
    drawRoundRect(ctx, mx + 140, my + 78, Math.max(10, Math.round((fam / 100) * 170)), 12, 6, famCol);

    const ap = intel.analysisPoints ?? 2;
    const maxAp = intel.maxAnalysisPoints ?? 2;
    drawText(ctx, '录像分析点:', mx + 330, my + 84, { size: 13.5, bold: true, color: '#7DD3FC' });
    for (let gi = 0; gi < maxAp; gi++) {
      const lit = gi < ap;
      ctx.fillStyle = lit ? THEME.BRASS : THEME.BG_DEEP;
      ctx.beginPath();
      ctx.arc(mx + 422 + gi * 20, my + 84, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = THEME.INK_LINE;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    drawText(ctx, `${ap}/${maxAp}`, mx + 426 + maxAp * 20, my + 84, { size: 13.5, bold: true, color: THEME.BRASS, mono: true });
    drawText(ctx, `${intel.recentFormText}   |   ${intel.h2hText}`, mx + 40, my + 112, {
      size: 13,
      color: THEME.TX2,
    });

    drawButton(
      ctx,
      hits,
      mx + mw - 304,
      my + 75,
      268,
      44,
      intel.scoutedThisRound ? '本轮已深度侦察 ✓' : '深度侦察 (+30%了解度 · 耗1整备)',
      () => {
        const res = league.scoutOpponent();
        if (res.msg) this.scoutNotice = res.msg;
        if (res.ok) SoundEngine.playCraftSuccess();
        else SoundEngine.playWarning();
        actions.onSave?.();
      },
      {
        variant: intel.scoutedThisRound ? 'ghost' : 'primary',
        disabled: !!intel.scoutedThisRound || actionsLeft <= 0,
        fontSize: 13,
      }
    );

    const colY = my + 142;
    const zones = intel.zones ?? [];
    const zoneLabelShort: Record<ScoutingZoneId, string> = {
      gk_core: '门将/核心',
      defense: '防线/肋部',
      midfield: '中场轴心',
      wings: '两翼走廊',
    };

    const lx = mx + 24;
    const lw = 304;
    drawText(ctx, '一、对手阵型沙盘（点击区块扫描）', lx, colY + 10, { size: 14, bold: true, color: '#7DD3FC' });

    const px = lx;
    const py = colY + 26;
    const pw = lw;
    const ph = 228;
    drawRoundRect(ctx, px, py, pw, ph, 10, THEME.BG_PANEL, THEME.INK_LINE, 2);
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.20)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 14, py + 12, pw - 28, ph - 24);
    ctx.strokeRect(px + pw * 0.25, py + 12, pw * 0.5, 42);
    ctx.beginPath();
    ctx.moveTo(px + 14, py + ph - 16);
    ctx.lineTo(px + pw - 14, py + ph - 16);
    ctx.arc(px + pw / 2, py + ph - 16, 36, Math.PI, Math.PI * 2);
    ctx.stroke();

    const activeZ = zones.find(z => z.id === this.selectedZoneId) ?? zones.find(z => z.scanned) ?? zones[0];
    const isRevealed = !!intel.chosenCounterId;
    const slots = FORMATIONS[intel.oppFormation ?? '4-4-2'] ?? FORMATIONS['4-4-2'];
    slots.forEach(sl => {
      const zId = mapRoleToScoutZone(sl.role);
      const zObj = zones.find(z => z.id === zId);
      const dx = px + 16 + (sl.baseY / 68) * (pw - 32);
      const dy = py + 18 + Math.min(0.92, Math.max(0.06, sl.baseX / 84)) * (ph - 36);
      const weakLit = zObj && (zObj.scanned || isRevealed) && zObj.isWeakZone;
      const scannedNormal = zObj && zObj.scanned && !zObj.isWeakZone;

      if (weakLit) {
        const pulseR = 16 + Math.sin(this.animTime * 5.2) * 2.5;
        ctx.strokeStyle = THEME.VERMILION;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dx, dy, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.selectedZoneId === zId) {
        ctx.strokeStyle = THEME.LIME;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dx, dy, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = weakLit ? THEME.VERMILION : scannedNormal ? THEME.COBALT : THEME.BG_CARD_DARK;
      ctx.beginPath();
      ctx.arc(dx, dy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = THEME.INK_LINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, sl.role.slice(0, 3), dx, dy + 0.5, { size: 12, rawSize: true, bold: true, color: THEME.TX1, align: 'center' });

      if (zObj) {
        // 严格 >=44×44 热区
        hits.addTouchTarget(dx - 22, dy - 22, 44, 44, () => {
          if (this.selectedZoneId === zId && !zObj.scanned && !isRevealed) {
            const res = league.scanOpponentZone(zId);
            if (res.msg) this.scoutNotice = res.msg;
            if (res.ok) SoundEngine.playCraftSuccess();
            else SoundEngine.playWarning();
            actions.onSave?.();
          } else {
            this.selectedZoneId = zId;
            SoundEngine.playClick();
          }
        });
      }
    });
    ctx.restore();

    zones.forEach((z, zi) => {
      const col = zi % 2;
      const row = Math.floor(zi / 2);
      const bx = lx + col * 154;
      const by = py + ph + 10 + row * 48;
      const bw = 150;
      const bh = 44;
      const isWeakFound = (z.scanned || isRevealed) && z.isWeakZone;
      const isSel = this.selectedZoneId === z.id;
      const bCol = isWeakFound ? THEME.VERMILION : z.scanned ? THEME.COBALT : isSel ? THEME.LIME : THEME.INK_LINE;
      drawRoundRect(ctx, bx, by, bw, bh, 7, isWeakFound ? 'rgba(224, 58, 46, 0.25)' : THEME.BG_PANEL, bCol, 2);
      drawText(ctx, z.label, bx + 10, by + 15, { size: 12.5, bold: true, color: isWeakFound ? '#FCA5A5' : THEME.TX1 });
      drawText(
        ctx,
        isWeakFound ? '发现破绽!' : z.scanned ? '已核实' : isSel && ap > 0 && !isRevealed ? '再点扫描' : '点击预览',
        bx + 10,
        by + 33,
        { size: 12, color: isWeakFound ? THEME.BRASS : z.scanned ? '#7DD3FC' : isSel ? THEME.LIME : THEME.TX2 }
      );
      hits.addTouchTarget(bx, by, bw, bh, () => {
        if (this.selectedZoneId === z.id && !z.scanned && !isRevealed) {
          const res = league.scanOpponentZone(z.id);
          if (res.msg) this.scoutNotice = res.msg;
          if (res.ok) SoundEngine.playCraftSuccess();
          else SoundEngine.playWarning();
          actions.onSave?.();
        } else {
          this.selectedZoneId = z.id;
          SoundEngine.playClick();
        }
      });
    });

    const detailY = py + ph + 112;
    const zShow = activeZ;
    drawRoundRect(ctx, lx, detailY, lw, 114, 9, THEME.BG_PANEL, zShow && (zShow.scanned || isRevealed) && zShow.isWeakZone ? THEME.VERMILION : THEME.INK_LINE, 2);
    if (zShow && (zShow.scanned || isRevealed)) {
      drawBadge(
        ctx,
        lx + 12,
        detailY + 12,
        122,
        22,
        zShow.isWeakZone ? '录像锁定异常' : '录像实况记录',
        zShow.isWeakZone ? THEME.VERMILION : THEME.BG_CARD_DARK,
        THEME.TX1
      );
      drawText(ctx, zShow.label, lx + 142, detailY + 23, { size: 12.5, bold: true, color: THEME.BRASS });
      drawWrappedText(ctx, zShow.summary, lx + 12, detailY + 42, lw - 24, 19, { size: 12.5, color: THEME.TX1, maxLines: 3 });
    } else {
      const zLabel = zShow ? zShow.label : '未选择区域';
      drawText(ctx, `预览【${zLabel}】(-1分析点)`, lx + 12, detailY + 22, { size: 13, bold: true, color: '#7DD3FC' });
      drawWrappedText(ctx, '点击上方阵型区块可先预览，再点一次或点右下按钮扫描。', lx + 12, detailY + 44, lw - 24, 18, { size: 12, color: THEME.TX2, maxLines: 2 });
      if (zShow && !zShow.scanned && !isRevealed) {
        drawButton(ctx, hits, lx + lw - 144, detailY + 64, 132, 44, '扫描此区 (-1点)', () => {
          const res = league.scanOpponentZone(zShow.id);
          if (res.msg) this.scoutNotice = res.msg;
          if (res.ok) SoundEngine.playCraftSuccess();
          else SoundEngine.playWarning();
          actions.onSave?.();
        }, { variant: 'gold', disabled: ap <= 0, fontSize: 12.5 });
      }
    }

    const cx = lx + lw + 20;
    const cw = 378;
    drawText(ctx, '二、情报线索库（1 条为烟雾弹）', cx, colY + 10, { size: 14, bold: true, color: '#7DD3FC' });

    intel.clues.forEach((cl, ci) => {
      const cy = colY + 26 + ci * 118;
      const shownSmoke = !!cl.debunked || (isRevealed && !!cl.isSmoke);
      const borderCol = shownSmoke ? THEME.VERMILION : THEME.INK_LINE;
      drawRoundRect(ctx, cx, cy, cw, 110, 9, shownSmoke ? 'rgba(224, 58, 46, 0.14)' : THEME.BG_PANEL, borderCol, 2);
      const confLabel = shownSmoke
        ? '烟雾弹已证伪 ✗'
        : cl.confidence === 'high'
        ? '核实线索'
        : cl.confidence === 'mid'
        ? '常规情报'
        : '小道消息';
      const confCol = shownSmoke ? THEME.RED_LIGHT : cl.confidence === 'high' ? THEME.LIME : cl.confidence === 'mid' ? '#7DD3FC' : THEME.BRASS;
      drawBadge(ctx, cx + 14, cy + 10, shownSmoke ? 120 : 94, 22, confLabel, THEME.BG_DEEP, confCol);
      drawText(ctx, `线索 #${ci + 1}`, cx + (shownSmoke ? 142 : 116), cy + 21, { size: 12.5, color: THEME.TX2, mono: true });
      drawWrappedText(ctx, cl.text, cx + 14, cy + 40, cw - 28, 20, {
        size: 13,
        color: shownSmoke ? THEME.TX3 : THEME.TX1,
        maxLines: 3,
      });
    });

    const hasUndebunkedSmoke = intel.clues.some(c => c.isSmoke && !c.debunked);
    const debunkY = colY + 384;
    drawRoundRect(ctx, cx, debunkY, cw, 98, 9, THEME.BG_PANEL, THEME.INK_LINE, 2);
    drawButton(
      ctx,
      hits,
      cx + 14,
      debunkY + 10,
      cw - 28,
      44,
      !hasUndebunkedSmoke
        ? '当前无待排除的虚假烟雾弹 ✓'
        : intel.chosenCounterId
        ? '已完成破绽指证'
        : '交叉核实 · 排除 1 条烟雾弹 (-1点)',
      () => {
        const res = league.debunkSmokeClue();
        if (res.msg) this.scoutNotice = res.msg;
        if (res.ok) SoundEngine.playCraftSuccess();
        else SoundEngine.playWarning();
        actions.onSave?.();
      },
      {
        variant: hasUndebunkedSmoke && !intel.chosenCounterId ? 'primary' : 'ghost',
        disabled: !hasUndebunkedSmoke || !!intel.chosenCounterId || ap <= 0,
        fontSize: 13,
      }
    );
    drawText(
      ctx,
      '提示：直接指证抓出真破绽 → 获【宗师洞察】+1克制卡',
      cx + cw / 2,
      debunkY + 74,
      { size: 12, color: THEME.BRASS, align: 'center' }
    );

    const rx = cx + cw + 20;
    const rw = 378;
    drawText(
      ctx,
      isRevealed ? '三、指证裁定与针对红利' : '三、拍案指证（答对锁定 2 选 1 红利）',
      rx,
      colY + 10,
      { size: 14, bold: true, color: THEME.BRASS }
    );

    if (!isRevealed) {
      intel.counters.forEach((cnt, idx) => {
        const cy = colY + 26 + idx * 148;
        const zoneTag = cnt.targetZone ? zoneLabelShort[cnt.targetZone] : '全区';
        drawPrintCard(ctx, rx, cy, rw, 138, { paper: true, topBandColor: THEME.COBALT, radius: 9, shadowOffset: 4 });
        drawBadge(ctx, rx + 14, cy + 14, 92, 22, `区:${zoneTag}`, THEME.BG_PANEL, '#7DD3FC');
        const el0 = cnt.counterElements?.[0];
        const el1 = cnt.counterElements?.[1];
        if (el0) {
          const elText = el1 ? `克制:${getElementLabel(el0)}/${getElementLabel(el1)}` : `克制:${getElementLabel(el0)}`;
          drawBadge(ctx, rx + 112, cy + 14, 134, 22, elText, THEME.BG_PANEL, ELEMENT_COLOR[el0] ?? THEME.BRASS);
        }
        drawText(ctx, fitText(ctx, cnt.label, rw - 28, 15, true), rx + 14, cy + 52, {
          size: 15,
          bold: true,
          color: THEME.PAPER_INK,
        });
        drawWrappedText(ctx, `基础红利：${cnt.desc}`, rx + 14, cy + 72, rw - 28, 18, {
          size: 12.5,
          color: THEME.PAPER_MUTED,
          maxLines: 1,
        });
        drawButton(ctx, hits, rx + 14, cy + 88, rw - 28, 44, '拍案指证此破绽 ▶', () => {
          const res = league.chooseOpponentCounter(cnt.id);
          if (res.msg) this.scoutNotice = res.msg;
          if (res.correct) {
            this.stampAnimTimer = 1.1;
            SoundEngine.playBreakthrough();
            actions.onShake?.(7, 0.22);
            actions.onBurst?.(rx + rw / 2, colY + 120, THEME.BRASS);
          } else {
            SoundEngine.playWarning();
          }
          actions.onSave?.();
        }, { variant: 'primary', fontSize: 13.5 });
      });
    } else if (intel.spotCorrect) {
      const winCounter = intel.counters.find(c => c.isCorrect);
      const isMaster = intel.mastery === 'master';
      const stampP = this.stampAnimTimer > 0 ? easeOutBack(Math.min(1, (1.1 - this.stampAnimTimer) / 0.28)) : 1;

      drawPrintCard(ctx, rx, colY + 26, rw, 106, { paper: true, topBandColor: isMaster ? THEME.BRASS : THEME.LIME, radius: 10, shadowOffset: 4 });
      ctx.save();
      ctx.translate(rx + 126, colY + 48);
      ctx.scale(0.85 + 0.15 * stampP, 0.85 + 0.15 * stampP);
      drawStamp(ctx, isMaster ? '宗师洞察' : '指证成立', 0, 0, THEME.VERMILION, -4, 0.92);
      ctx.restore();
      drawText(ctx, winCounter?.label ?? '真实破绽已锁定', rx + 14, colY + 78, { size: 14.5, bold: true, color: THEME.PAPER_INK });
      drawWrappedText(ctx, winCounter?.buff.note ?? '', rx + 14, colY + 98, rw - 28, 18, { size: 12.5, color: THEME.COBALT, maxLines: 2 });

      const loadoutCards = league.getActiveMatchDeck();
      const counterEls = new Set(intel.counterElements ?? []);
      const matchedCards = loadoutCards.filter(c => {
        const mainEl = inferCardElement(c);
        const parts = (c.recipeKey ?? '').split('+');
        return counterEls.has(mainEl) || parts.some(p => counterEls.has(p as any));
      });
      const eqSkills = league.getEquippedActiveSkills();
      const counterStyles = new Set(intel.counterStyles ?? []);
      const matchedSkills = eqSkills.filter(s => s.styleTag && counterStyles.has(s.styleTag));
      const targetSkills = matchedSkills.length > 0 ? matchedSkills : eqSkills.slice(0, 1);

      const pickBonus = (kind: ScoutRewardKind) => {
        const res = league.chooseScoutReward(kind);
        if (res.msg) this.scoutNotice = res.msg;
        if (res.ok) {
          SoundEngine.playFanfare();
          actions.onBurst?.(rx + rw / 2, colY + 300, THEME.BRASS);
        }
        actions.onSave?.();
      };

      const renderRewardChoiceCard = (
        kind: ScoutRewardKind,
        topY: number,
        badgeTxt: string,
        titleTxt: string,
        bodyTxt: string,
        subTxt: string,
        accent: string
      ) => {
        const isChosen = intel.chosenRewardKind === kind;
        drawPrintCard(ctx, rx, topY, rw, 162, { paper: true, topBandColor: isChosen ? THEME.LIME : accent, radius: 10, shadowOffset: 4 });
        drawBadge(ctx, rx + 14, topY + 12, 154, 22, badgeTxt, THEME.BG_PANEL, accent);
        if (isChosen) drawStamp(ctx, '已锁定 ✓', rx + rw - 64, topY + 26, THEME.VERMILION, -6, 0.85);
        drawText(ctx, titleTxt, rx + 14, topY + 48, { size: 14.5, bold: true, color: THEME.PAPER_INK });
        drawWrappedText(ctx, bodyTxt, rx + 14, topY + 68, rw - 28, 18, { size: 12.5, color: THEME.PAPER_MUTED, maxLines: 2 });
        drawText(ctx, fitText(ctx, subTxt, rw - 28, 12), rx + 14, topY + 104, { size: 12, bold: true, color: THEME.COBALT });
        if (!intel.chosenRewardKind) {
          drawButton(ctx, hits, rx + 14, topY + 114, rw - 28, 44, '锁定此针对红利 ▶', () => pickBonus(kind), {
            variant: 'primary',
            fontSize: 13.5,
          });
        }
      };

      const elNames = (intel.counterElements ?? []).map(e => getElementLabel(e)).join('/');
      const cardMatchNote = matchedCards.length > 0
        ? `命中 ${matchedCards.length} 张：${matchedCards.slice(0, 3).map(c => c.name).join('、')}`
        : `出战卡组(${loadoutCards.length}张)暂无【${elNames}】卡`;
      renderRewardChoiceCard(
        'buff_debuff',
        colY + 144,
        `手牌基因(${elNames})`,
        '红利 A · 手牌降费超频 + 弱点减益',
        `含【${elNames}】基因 Buff 卡本场 -1 费且持续 +5 分；${intel.activeDebuff?.label ?? '削弱对手弱点线'}。`,
        cardMatchNote,
        THEME.COBALT
      );

      const skillMatchNote = targetSkills.length > 0
        ? `超频：${targetSkills.map(s => `${s.name}(R${s.effectiveRank ?? 1})`).join('、')}`
        : '尚未装备主动技';
      renderRewardChoiceCard(
        'skill_overclock',
        colY + 318,
        '技能体系超频',
        '红利 B · 克制主动技超频觉醒',
        '匹配主动技本场【临时 +1 Rank】且【首次触发免冷却】！',
        skillMatchNote,
        THEME.BRASS
      );
    } else {
      intel.counters.forEach((cnt, idx) => {
        const cy = colY + 26 + idx * 148;
        const isChosen = intel.chosenCounterId === cnt.id;
        drawRoundRect(ctx, rx, cy, rw, 136, 9, isChosen ? 'rgba(224, 58, 46, 0.16)' : THEME.BG_PANEL, cnt.isCorrect ? THEME.LIME : isChosen ? THEME.VERMILION : THEME.INK_LINE, 2);
        drawText(ctx, cnt.label, rx + 14, cy + 28, { size: 14.5, bold: true, color: cnt.isCorrect ? THEME.BRASS : THEME.TX2 });
        drawWrappedText(ctx, cnt.desc, rx + 14, cy + 54, rw - 28, 18, { size: 12.5, color: THEME.TX3, maxLines: 2 });
        drawBadge(
          ctx,
          rx + 14,
          cy + 94,
          126,
          24,
          isChosen ? '误判烟雾弹 ✗' : cnt.isCorrect ? '真实破绽' : '干扰项',
          THEME.BG_DEEP,
          cnt.isCorrect ? THEME.LIME : isChosen ? THEME.RED_LIGHT : THEME.TX3
        );
      });
    }

    const footerMsg =
      this.scoutNotice ||
      (intel.chosenCounterId
        ? intel.spotCorrect
          ? intel.chosenRewardKind
            ? '赛前侦查与针对部署已全部就绪，祝本轮凯旋！'
            : '异议成立！请在右栏 2 选 1 锁定本场红利'
          : '本场未能识破烟雾弹，按常规战术出战'
        : '操作：点击左侧沙盘扫描区（-1分析点）对比中栏线索，指证右栏破绽');
    drawText(ctx, footerMsg, mx + 24, my + mh - 20, {
      size: 13,
      bold: true,
      color: intel.spotCorrect ? THEME.LIME : '#7DD3FC',
    });
  }
}
