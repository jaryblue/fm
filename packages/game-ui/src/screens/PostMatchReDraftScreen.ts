/**
 * 页面 5：赛后结算战报 & 2步式 Re-Draft 补强向导（PITCH PRINT 报刊/档案风）
 * 第 1 屏：演播室赛后战报（胜平负横幅、队徽比分、双向统计条、MVP 暖纸卡、动量时间轴与本轮赛果）
 * 第 2 屏：3选1 战术盲盒（PITCH PRINT 矢量封条档案袋）与 2 步 Re-Draft 补强向导
 */

import { MatchState } from '../../../engine/src/types';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { DraftPlayer } from '../../../core/src/types';
import { ArtAssetId, AssetLoader, getRelicAssetId } from '../AssetLoader';
import { drawPlayerAvatar } from '../AvatarRenderer';
import {
  drawBadge,
  drawButton,
  drawFoilShimmer,
  drawPrintCard,
  drawRoundRect,
  drawStamp,
  drawStatBar,
  drawStatMicro,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  HitRegistry,
  tierColor,
} from '../CanvasKit';
import { drawClubCrest } from '../ClubVisuals';
import { easeOutBack, easeOutCubic } from '../Motion';
import { drawRewardIllustration } from '../SceneArt';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, IconName } from '../VectorIcons';

export interface PostMatchFxCallbacks {
  onBurst?: (x: number, y: number, color?: string) => void;
  onShake?: (intensity: number, dur: number) => void;
  onInspectPlayer?: (p: DraftPlayer) => void;
}

export class PostMatchReDraftScreen {
  private lastMatch: MatchState | null = null;
  private viewMode: 'recap' | 'card_unlock' | 'reward' | 'redraft' = 'recap';
  private recapTab: 'analytics' | 'results' = 'analytics';
  private selectedCandidateId: string | null = null;
  private selectedDropId: string | null = null;
  private ratingPage = 0;
  private resultsPage = 0;
  private squadPage = 0;
  private statTargetPage = 0;
  private statTargetFilter: 'all' | 'starters' | 'bench' = 'all';
  private lastPickedOptionId: string | null = null;

  // 抽卡开包与逐张翻牌动画状态
  private animClock = 0;
  private recapEnterTimer = 0;
  private catEnterTimer = 0;
  private packAnim: {
    active: boolean;
    cat: string;
    color: string;
    title: string;
    shortTag: string;
    icon: IconName;
    startX: number;
    timer: number;
    bursted: boolean;
  } | null = null;
  private dealTimer = 0;
  private flipped: boolean[] = [false, false, false, false];
  private flipTimers: number[] = [0, 0, 0, 0];
  private flipSoundPlayed: boolean[] = [false, false, false, false];
  private fx: PostMatchFxCallbacks = {};

  public setLastMatch(match: MatchState): void {
    this.lastMatch = match;
    this.viewMode = 'recap';
    this.recapTab = 'analytics';
    this.ratingPage = 0;
    this.resultsPage = 0;
    this.squadPage = 0;
    this.selectedCandidateId = null;
    this.selectedDropId = null;
    this.statTargetPage = 0;
    this.statTargetFilter = 'all';
    this.recapEnterTimer = 0;
    this.catEnterTimer = 0;
    this.packAnim = null;
    this.resetCardRevealAnim();
  }

  public dispose(): void {
    this.lastMatch = null;
    this.packAnim = null;
    this.ratingPage = 0;
    this.resultsPage = 0;
    this.squadPage = 0;
    this.selectedCandidateId = null;
    this.selectedDropId = null;
    this.statTargetPage = 0;
    this.statTargetFilter = 'all';
  }

  private resetCardRevealAnim(): void {
    this.dealTimer = 0;
    this.flipped = [false, false, false, false];
    this.flipTimers = [0, 0, 0, 0];
    this.flipSoundPlayed = [false, false, false, false];
  }

  public update(dtSec: number): void {
    this.animClock += dtSec;
    if (this.viewMode === 'recap') {
      this.recapEnterTimer += dtSec;
      return;
    }
    if (this.viewMode !== 'reward') return;

    this.catEnterTimer += dtSec;
    if (this.packAnim?.active) {
      this.packAnim.timer += dtSec;
      if (this.packAnim.timer >= 0.36 && !this.packAnim.bursted) {
        this.packAnim.bursted = true;
        this.fx.onBurst?.(640, 340, this.packAnim.color);
        this.fx.onShake?.(6, 0.22);
        SoundEngine.playBreakthrough();
      }
      if (this.packAnim.timer >= 0.56) {
        this.packAnim.active = false;
        this.packAnim = null;
        this.dealTimer = 0;
      }
      return;
    }

    this.dealTimer += dtSec;
    const autoThresholds = [0.46, 0.82, 1.18, 1.54];
    for (let i = 0; i < this.flipped.length; i++) {
      if (!this.flipped[i] && this.dealTimer >= autoThresholds[i]) {
        this.flipped[i] = true;
      }
      if (this.flipped[i] && this.flipTimers[i] < 0.44) {
        this.flipTimers[i] = Math.min(0.44, this.flipTimers[i] + dtSec);
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    onContinue: () => void,
    onSave: () => void,
    fx?: PostMatchFxCallbacks
  ): void {
    if (fx) this.fx = fx;
    const st = league.getState();
    const rd = st.reDraft;
    const rw = st.pendingPostMatchReward;

    if (this.viewMode === 'recap') {
      this.renderRecapView(ctx, hits, league, onContinue, onSave);
      return;
    }

    if (
      (this.viewMode === 'card_unlock' || this.viewMode === 'reward') &&
      rw?.tutorialCardUnlock &&
      !rw.tutorialCardUnlock.claimed
    ) {
      this.renderCardUnlockView(ctx, hits, league, onContinue, onSave);
      return;
    }

    if (this.viewMode === 'reward' && rw) {
      this.renderRewardView(ctx, hits, league, onContinue, onSave);
      return;
    }

    if (rd) {
      this.renderReDraftWizard(ctx, hits, league, onContinue, onSave);
      return;
    }

    this.renderRecapView(ctx, hits, league, onContinue, onSave);
  }

  private getPackArtIdForCategory(cat: string): ArtAssetId {
    if (cat === 'player') return 'pack_recruit';
    if (cat === 'season_perk' || cat === 'craft_card' || cat === 'trait_forge') return 'pack_perk';
    return 'pack_tactics';
  }

  /** 绘制 PITCH PRINT 风格印刷战术盲盒卡包（优先新卡包插画，兜底矢量档案袋） */
  private drawPrintTacticalPack(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    pw: number,
    ph: number,
    accent: string,
    shortTag: string,
    icon: IconName,
    hovered: boolean,
    packArtId?: ArtAssetId
  ): void {
    const packImg = packArtId ? AssetLoader.get(packArtId) : null;
    if (packImg && typeof ctx.drawImage === 'function') {
      drawRoundRect(ctx, px + (hovered ? 6 : 4), py + (hovered ? 6 : 4), pw, ph, 10, THEME.HARD_SHADOW);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 10);
      ctx.clip();
      ctx.drawImage(packImg, px, py, pw, ph);
      ctx.restore();
      drawRoundRect(ctx, px, py, pw, ph, 10, undefined, hovered ? THEME.LIME : THEME.INK_LINE, 2.5);
      drawBadge(ctx, px + 14, py + ph - 30, pw - 28, 22, shortTag, THEME.BG_DEEP, THEME.GOLD_LIGHT);
      return;
    }
    // 硬阴影 + 档案袋主体
    drawPrintCard(ctx, px, py, pw, ph, {
      paper: false,
      radius: 10,
      shadowOffset: hovered ? 6 : 4,
      topBandColor: accent,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });

    // 锯齿封口压痕线
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 24);
    ctx.lineTo(px + pw - 10, py + 24);
    ctx.moveTo(px + 10, py + ph - 24);
    ctx.lineTo(px + pw - 10, py + ph - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    // 中央暖纸封条
    const bandY = py + Math.round(ph * 0.30);
    const bandH = Math.round(ph * 0.40);
    ctx.fillStyle = THEME.PAPER_CREAM;
    ctx.fillRect(px + 4, bandY, pw - 8, bandH);
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 4, bandY, pw - 8, bandH);

    // 封条顶部色带
    ctx.fillStyle = accent;
    ctx.fillRect(px + 5, bandY + 1, pw - 10, 6);

    // 中心徽章圆章
    const cx = px + pw / 2;
    const cy = bandY + bandH / 2 + 2;
    ctx.fillStyle = THEME.BG_DEEP;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    drawIcon(ctx, icon, cx, cy - 8, 20, accent);

    drawText(ctx, shortTag, cx, bandY + bandH - 13, {
      size: 12.5,
      bold: true,
      color: THEME.PAPER_INK,
      align: 'center',
      rawSize: true,
    });

    // 底部机密编号条
    drawText(ctx, 'PITCH PRINT · SEALED', cx, py + ph - 12, {
      size: 12,
      bold: true,
      color: THEME.TX3,
      align: 'center',
      mono: true,
      rawSize: true,
    });
    ctx.restore();
  }

  private renderRecapView(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    onContinue: () => void,
    onSave: () => void
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const rd = st.reDraft;
    const rw = st.pendingPostMatchReward;
    const m = this.lastMatch;
    const summary = league.getLastMatchSummary();
    const tierInfo = league.getCurrentTierInfo();

    const hasPendingCardUnlock = !!(rw?.tutorialCardUnlock && !rw.tutorialCardUnlock.claimed);
    const hasPendingReward = !!(rw && !rw.completed);
    const nextActionLabel = hasPendingCardUnlock
      ? '领取新解锁战术卡 ▶'
      : hasPendingReward
      ? '领取赛后战利品 (3选1) ▶'
      : rd
      ? '进入赛后补强 (2步) ▶'
      : '继续下一轮 · 返回门户 ▶';
    const goNext = () => {
      if (hasPendingCardUnlock) {
        this.viewMode = 'card_unlock';
      } else if (hasPendingReward) {
        this.catEnterTimer = 0;
        this.packAnim = null;
        this.resetCardRevealAnim();
        this.viewMode = 'reward';
      } else if (rd) {
        this.viewMode = 'redraft';
      } else {
        onSave();
        onContinue();
      }
    };

    const t = this.recapEnterTimer;
    const pHero = easeOutCubic(Math.min(1, Math.max(0.05, t / 0.34)));
    const pScore = easeOutCubic(Math.min(1, Math.max(0.01, t / 0.35)));
    const pBars = easeOutCubic(Math.min(1, Math.max(0, (t - 0.14) / 0.50)));
    const pMvp = easeOutBack(Math.min(1, Math.max(0, (t - 0.18) / 0.42)));
    const pRewards = easeOutBack(Math.min(1, Math.max(0, (t - 0.42) / 0.45)));

    // ==================== 1. 顶部演播室顶栏 (y: 12..60, h: 48) ====================
    drawPrintCard(ctx, 16, 12, 1248, 48, {
      paper: false,
      radius: 10,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    const roundLabel = summary?.roundNumber ?? (rd ? rd.roundCompleted : Math.max(1, st.currentRound - 1));
    const tierBadgeTxt = `${tierInfo.name} · 第${roundLabel}轮`;
    drawBadge(ctx, 28, 23, 246, 26, tierBadgeTxt, THEME.BG_DEEP, THEME.LIME);
    drawText(ctx, '赛后演播室 · 战报与战术复盘', 288, 36, { size: 17, bold: true, color: THEME.GOLD_LIGHT });
    if (m) {
      drawText(ctx, `${m.minute}' 全场终场哨响`, 1246, 36, { size: 12.5, color: THEME.TX2, align: 'right', mono: true });
    }

    // ==================== 2. 计算我方全部出场球员评分 ====================
    const userSide = m ? (m.homeName === club.name ? 'home' : 'away') : 'home';
    const growthMap = league.getLastMatchGrowth();
    const userSquadMap = new Map(club.squad.map(sp => [sp.id, sp]));
    const ratedList: Array<{
      player: MatchState['players'][number];
      dp?: DraftPlayer;
      rating: number;
      statIcons: Array<{ ic: 'ball' | 'stat_assist' | 'stat_gk' | 'stat_pass' | 'stat_def' | 'stat_shoot'; val: number }>;
      gainText: string;
      keyTrait?: string;
      isUnlocked: boolean;
      bestPartner?: string;
    }> = [];

    if (m) {
      const myScoreVal = userSide === 'home' ? m.homeScore : m.awayScore;
      const oppScoreVal = userSide === 'home' ? m.awayScore : m.homeScore;
      const teamBonus = myScoreVal > oppScoreVal ? 0.4 : myScoreVal === oppScoreVal ? 0.1 : -0.1;
      const seenIds = new Set<string>();
      const allUserPlayed = [...m.players, ...(m.subbedOutPlayers ?? [])].filter(p => {
        if (p.team !== userSide || seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      });

      for (const p of allUserPlayed) {
        const ms = p.matchStats;
        const g = growthMap[p.id];
        const dp = userSquadMap.get(p.id);
        const passAcc = ms.passes >= 6 ? ms.passesSuccess / ms.passes : 0.7;
        const chemBonus = g ? Math.min(0.45, g.chemGain * 0.025) : 0;
        const traitBonus = g?.unlockedTrait ? 0.55 : (dp?.traits?.length || p.traits?.length) ? 0.15 : 0;
        const subBonus = p.subbedIn && (ms.goals > 0 || ms.assists > 0) ? 0.3 : 0;
        const raw =
          5.7 +
          teamBonus +
          subBonus +
          ms.goals * 1.35 +
          ms.assists * 0.85 +
          ms.shots * 0.14 +
          ms.passesSuccess * 0.035 +
          (passAcc >= 0.82 ? 0.25 : 0) +
          (ms.tackles + ms.interceptions) * 0.24 +
          ms.saves * 0.42 +
          (p.role === 'GK' && oppScoreVal === 0 ? 0.75 : 0) +
          chemBonus +
          traitBonus;
        const rating = Math.max(5.2, Math.min(10.0, Math.round(raw * 10) / 10));

        const statIcons: Array<{ ic: 'ball' | 'stat_assist' | 'stat_gk' | 'stat_pass' | 'stat_def' | 'stat_shoot'; val: number }> = [];
        if (ms.goals > 0) statIcons.push({ ic: 'ball', val: ms.goals });
        if (ms.assists > 0) statIcons.push({ ic: 'stat_assist', val: ms.assists });
        if (p.role === 'GK') {
          statIcons.push({ ic: 'stat_gk', val: ms.saves });
          statIcons.push({ ic: 'stat_pass', val: ms.passesSuccess });
        } else {
          statIcons.push({ ic: 'stat_pass', val: ms.passesSuccess });
          if (ms.tackles + ms.interceptions > 0) statIcons.push({ ic: 'stat_def', val: ms.tackles + ms.interceptions });
          else if (ms.shots > 0) statIcons.push({ ic: 'stat_shoot', val: ms.shots });
        }

        const gainParts: string[] = [];
        if (g?.unlockedTrait) {
          gainParts.push(`觉醒【${g.unlockedTrait}】`);
        } else {
          if (g && g.famGain > 0) gainParts.push(`熟+${g.famGain}`);
          if (g && g.chemGain > 0) gainParts.push(`默+${g.chemGain.toFixed(1)}`);
        }
        const keyTrait = g?.unlockedTrait ? undefined : (p.goldTraits?.[0] || p.traits?.[0] || dp?.traits?.[0]);

        ratedList.push({
          player: p,
          dp,
          rating,
          statIcons: statIcons.slice(0, 3),
          gainText: gainParts.join(' '),
          keyTrait,
          isUnlocked: !!g?.unlockedTrait,
          bestPartner: g?.bestPartner,
        });
      }
      ratedList.sort((a, b) => b.rating - a.rating);
    }

    // ==================== 3. Hero Row (y: 70..286, h: 216) ====================
    ctx.save();
    ctx.globalAlpha = pHero;
    ctx.translate(0, (1 - pHero) * 12);

    if (m) {
      const userIsHome = m.homeName === club.name;
      const myScore = userIsHome ? m.homeScore : m.awayScore;
      const oppScore = userIsHome ? m.awayScore : m.homeScore;
      const isWin = myScore > oppScore;
      const isDraw = myScore === oppScore;
      const resultTag = isWin ? '比赛胜利' : isDraw ? '握手言和' : '遗憾惜败';
      const resultColor = isWin ? THEME.LIME : isDraw ? THEME.BRASS : THEME.VERMILION;
      const homeClub = st.clubs.find(c => c.name === m.homeName) || club;
      const awayClub = st.clubs.find(c => c.name === m.awayName) || club;

      const storyTags: Array<{ label: string; bg: string; col: string }> = [];
      if (isWin) {
        let hCur = 0;
        let aCur = 0;
        let trailed = false;
        let lastUserGoalMin = 0;
        for (const ev of m.events) {
          if (ev.type === 'goal') {
            if (ev.team === 'home') hCur++;
            else aCur++;
            const myCur = userIsHome ? hCur : aCur;
            const oppCur = userIsHome ? aCur : hCur;
            if (myCur < oppCur) trailed = true;
            if (ev.team === userSide) lastUserGoalMin = ev.minute;
          }
        }
        if (lastUserGoalMin >= 85 && myScore - oppScore === 1) {
          storyTags.push({ label: '读秒绝杀', bg: '#78350F', col: '#FDE047' });
        }
        if (trailed) {
          storyTags.push({ label: '逆转翻盘', bg: '#4C1D95', col: '#E9D5FF' });
        }
        if (oppScore === 0) {
          storyTags.push({ label: '零封锁死', bg: '#064E3B', col: '#6EE7B7' });
        }
        if (myScore >= 3) {
          storyTags.push({ label: '火力全开', bg: '#7F1D1D', col: '#FCA5A5' });
        }
      }

      // 左侧比分与双向数据对比条卡片 (x: 16..796, w: 780, h: 216)
      drawPrintCard(ctx, 16, 70, 780, 216, {
        paper: false,
        radius: 12,
        shadowOffset: 5,
        topBandColor: resultColor,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2.5,
      });

      drawBadge(ctx, 32, 84, 92, 22, resultTag, THEME.BG_DEEP, resultColor);
      storyTags.slice(0, 3).forEach((tg, ti) => {
        drawBadge(ctx, 132 + ti * 86, 84, 78, 22, tg.label, tg.bg, tg.col);
      });

      // 队徽与暖纸大比分框
      drawClubCrest(ctx, 148, 124, 22, homeClub);
      drawText(ctx, m.homeName + (homeClub.isUser ? ' (我)' : ''), 180, 124, {
        size: 16,
        bold: true,
        color: homeClub.isUser ? THEME.LIME : THEME.TX1,
      });

      const animHomeScore = Math.round(m.homeScore * pScore);
      const animAwayScore = Math.round(m.awayScore * pScore);
      drawPrintCard(ctx, 342, 100, 128, 46, {
        paper: true,
        radius: 8,
        shadowOffset: 3,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2.2,
      });
      drawText(ctx, `${animHomeScore} : ${animAwayScore}`, 406, 123, {
        size: 27,
        bold: true,
        italic: true,
        color: THEME.PAPER_INK,
        align: 'center',
        mono: true,
      });

      drawClubCrest(ctx, 662, 124, 22, awayClub);
      drawText(ctx, m.awayName + (awayClub.isUser ? ' (我)' : ''), 630, 124, {
        size: 16,
        bold: true,
        color: awayClub.isUser ? THEME.LIME : THEME.TX1,
        align: 'right',
      });

      // 4 条双向数据对比条：三栏错位排版（[左值] [左条] [居中指标名] [右条] [右值]），彻底杜绝文字撞条！
      const h = m.stats.home;
      const a = m.stats.away;
      const totPoss = h.possessionTicks + a.possessionTicks || 1;
      const hPoss = Math.round((h.possessionTicks / totPoss) * 100);
      const aPoss = 100 - hPoss;
      const hDef = h.tackles + h.interceptions;
      const aDef = a.tackles + a.interceptions;

      const compRows: Array<{
        label: string;
        leftVal: number;
        rightVal: number;
        leftTxt: string;
        rightTxt: string;
      }> = [
        {
          label: '控球率',
          leftVal: hPoss,
          rightVal: aPoss,
          leftTxt: `${Math.round(hPoss * pBars)}%`,
          rightTxt: `${Math.round(aPoss * pBars)}%`,
        },
        {
          label: '射门(正)',
          leftVal: h.shots,
          rightVal: a.shots,
          leftTxt: `${Math.round(h.shots * pBars)}(${Math.round(h.shotsOnTarget * pBars)})`,
          rightTxt: `${Math.round(a.shots * pBars)}(${Math.round(a.shotsOnTarget * pBars)})`,
        },
        {
          label: '预期进球 xG',
          leftVal: h.xG,
          rightVal: a.xG,
          leftTxt: (h.xG * pBars).toFixed(2),
          rightTxt: (a.xG * pBars).toFixed(2),
        },
        {
          label: '抢断 / 拦截',
          leftVal: hDef,
          rightVal: aDef,
          leftTxt: `${Math.round(hDef * pBars)}`,
          rightTxt: `${Math.round(aDef * pBars)}`,
        },
      ];

      const barCenterX = 406;
      const labelHalfW = 58;
      const halfBarMax = 186;
      const leftColColor = userIsHome ? THEME.BRASS : THEME.VERMILION;
      const rightColColor = !userIsHome ? THEME.LIME : THEME.COBALT;

      compRows.forEach((cr, ci) => {
        const ry = 166 + ci * 28;
        const sum = Math.max(0.01, cr.leftVal + cr.rightVal);
        const lRatio = (cr.leftVal / sum) * pBars;
        const rRatio = (cr.rightVal / sum) * pBars;
        const lW = Math.max(6, Math.round(lRatio * halfBarMax));
        const rW = Math.max(6, Math.round(rRatio * halfBarMax));

        const leftTrackRight = barCenterX - labelHalfW;
        const leftTrackX = leftTrackRight - halfBarMax;
        const rightTrackX = barCenterX + labelHalfW;

        drawText(ctx, cr.leftTxt, leftTrackX - 10, ry, {
          size: 12.5,
          bold: cr.leftVal >= cr.rightVal,
          color: cr.leftVal >= cr.rightVal ? leftColColor : THEME.TX2,
          align: 'right',
          mono: true,
        });
        drawRoundRect(ctx, leftTrackX, ry - 5, halfBarMax, 10, 4, THEME.BG_DEEP, THEME.INK_LINE, 1);
        drawRoundRect(ctx, leftTrackRight - lW, ry - 5, lW, 10, 4, leftColColor);

        drawText(ctx, cr.label, barCenterX, ry, {
          size: 12,
          bold: true,
          color: THEME.TX1,
          align: 'center',
        });

        drawRoundRect(ctx, rightTrackX, ry - 5, halfBarMax, 10, 4, THEME.BG_DEEP, THEME.INK_LINE, 1);
        drawRoundRect(ctx, rightTrackX, ry - 5, rW, 10, 4, rightColColor);
        drawText(ctx, cr.rightTxt, rightTrackX + halfBarMax + 10, ry, {
          size: 12.5,
          bold: cr.rightVal >= cr.leftVal,
          color: cr.rightVal >= cr.leftVal ? rightColColor : THEME.TX2,
          align: 'left',
          mono: true,
        });
      });

      // 右侧 MVP 暖纸头版卡 (x: 810..1264, w: 454, h: 216)
      const mvp = ratedList[0];
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(1, pMvp));
      ctx.translate(0, (1 - Math.min(1, pMvp)) * 10);
      drawPrintCard(ctx, 810, 70, 454, 216, {
        paper: true,
        radius: 12,
        shadowOffset: 5,
        topBandColor: THEME.BRASS,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2.5,
      });

      drawBadge(ctx, 826, 84, 148, 22, '全场最佳 · MVP', THEME.BG_DEEP, THEME.LIME);
      if (mvp) {
        const mp = mvp.player;
        const dp = mvp.dp;
        const shirtTxt = mp.shirtNumber ? `#${mp.shirtNumber} ` : '';
        if (mp.subbedIn) {
          drawBadge(ctx, 980, 84, 74, 22, '替补奇兵', THEME.VERMILION, THEME.PAPER_CREAM);
        }
        const animRating = (mvp.rating * Math.min(1, pMvp)).toFixed(1);
        drawRoundRect(ctx, 1188, 80, 60, 42, 8, THEME.BG_DEEP, THEME.INK_LINE, 2);
        drawText(ctx, animRating, 1218, 101, {
          size: 21,
          bold: true,
          color: THEME.LIME,
          align: 'center',
          mono: true,
        });

        const fakeDp: DraftPlayer = dp ?? {
          id: mp.id,
          name: mp.name,
          role: mp.role,
          shirtNumber: mp.shirtNumber,
          attributes: mp.attributes,
          traits: mp.traits,
          fitness: mp.fitness,
          ca: 75,
          cost: 100,
          tier: 'A',
          age: 25,
          trait: mp.traits?.[0] ?? '',
          seasonStats: { appearances: 1, goals: mp.matchStats.goals, assists: mp.matchStats.assists, cleanSheets: 0, yellowCards: 0, redCards: 0 },
        };
        drawPlayerAvatar(ctx, 828, 118, 68, 86, fakeDp, club, { radius: 8 });

        drawBadge(ctx, 908, 120, 38, 18, mp.role, THEME.INK_LINE, THEME.PAPER_CREAM);
        if (dp?.tier) drawBadge(ctx, 950, 120, 24, 18, dp.tier, tierColor(dp.tier));
        drawText(ctx, fitText(ctx, `${shirtTxt}${mp.name}`, 196, 18, true), 908, 154, {
          size: 18,
          bold: true,
          color: THEME.PAPER_INK,
        });

        const ms = mp.matchStats;
        const distKm = ((ms.distanceM ?? 0) / 1000).toFixed(1);
        const mvpLine1 = mp.role === 'GK'
          ? `扑救 ${ms.saves} · 成功传球 ${ms.passesSuccess} · 跑动 ${distKm}km`
          : `进球 ${ms.goals} · 助攻 ${ms.assists} · 抢断拦截 ${ms.tackles + ms.interceptions} · 跑动 ${distKm}km`;
        drawText(ctx, mvpLine1, 908, 180, { size: 12, bold: true, color: THEME.PAPER_MUTED, mono: true });

        const mvpNote = mvp.isUnlocked
          ? `★ ${mvp.gainText}`
          : mvp.bestPartner
          ? `黄金连线：${mvp.bestPartner} · ${mvp.gainText || '全场核心驱动'}`
          : mvp.keyTrait
          ? `核心特质：【${mvp.keyTrait}】 · ${mvp.gainText || '统治全场'}`
          : mvp.gainText || '全场核心驱动 · 评分冠绝全队';
        drawRoundRect(ctx, 908, 198, 340, 32, 6, THEME.PAPER_WARM, THEME.INK_LINE, 1.4);
        drawText(ctx, fitText(ctx, mvpNote, 324, 12, true), 918, 214, {
          size: 12,
          bold: true,
          color: mvp.isUnlocked ? THEME.COBALT : THEME.PAPER_INK,
        });

        drawText(ctx, '点击卡面查看球员完整档案 ▶', 1246, 266, { size: 12, bold: true, color: THEME.PAPER_MUTED, align: 'right' });
        if (dp) {
          hits.add(810, 70, 454, 216, () => {
            SoundEngine.playClick();
            this.fx.onInspectPlayer?.(dp);
          });
        }
      }
      ctx.restore();
    }

    // ==================== 4. Middle Row (y: 298..620, h: 322) ====================
    drawPrintCard(ctx, 16, 298, 620, 322, {
      paper: false,
      radius: 10,
      shadowOffset: 4,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawText(ctx, '攻防动量与战术时间轴 (0\'–90\')', 32, 318, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '金点=进球 · 青/紫标=换人与战术拐点', 620, 318, { size: 12, color: THEME.TX3, align: 'right' });

    if (m) {
      const smX = 30, smY = 334, smW = 592, smH = 204;
      drawRoundRect(ctx, smX, smY, smW, smH, 8, THEME.BG_DEEP, THEME.INK_LINE, 1.5);

      const momBuckets = new Array(18).fill(0);
      const momGoalBuckets: Array<{ bucket: number; team: 'home' | 'away'; minute: number }> = [];
      const momTacticMarkers: Array<{ minute: number; kind: 'sub' | 'tactic'; label: string }> = [];
      for (const ev of m.events) {
        const b = Math.max(0, Math.min(17, Math.floor(Math.max(0, ev.minute - 0.01) / 5)));
        const sign = ev.team === 'home' ? 1 : -1;
        let w = 0;
        if (ev.type === 'goal') {
          w = 5.5;
          momGoalBuckets.push({ bucket: b, team: ev.team, minute: ev.minute });
        } else if (ev.type === 'shot' || ev.type === 'save' || ev.type === 'miss') {
          w = 2.2 + (ev.xG ? ev.xG * 4.5 : 0);
        } else if (ev.type === 'corner') {
          w = 1.4;
        } else if (ev.type === 'pass') {
          w = 0.25;
        } else if (ev.type === 'tackle' || ev.type === 'interception') {
          w = 0.65;
        }
        momBuckets[b] += sign * w;

        if (ev.team === userSide && ev.type === 'substitution') {
          momTacticMarkers.push({ minute: ev.minute, kind: 'sub', label: '换' });
        } else if (
          ev.team === userSide &&
          (ev.type === 'tactic' || (ev.type === 'commentary' && (ev.text.includes('Zone') || ev.text.includes('指令') || ev.text.includes('核心'))))
        ) {
          momTacticMarkers.push({ minute: ev.minute, kind: 'tactic', label: '策' });
        }
      }
      const maxMom = Math.max(4.5, ...momBuckets.map(v => Math.abs(v)));
      const mPadL = 36, mPadR = 14, mPadT = 22, mPadB = 26;
      const mPlotW = smW - mPadL - mPadR;
      const mPlotH = smH - mPadT - mPadB;
      const midY = smY + mPadT + mPlotH / 2;
      const halfH = mPlotH / 2 - 4;

      ctx.strokeStyle = 'rgba(244, 239, 228, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(smX + mPadL, midY);
      ctx.lineTo(smX + mPadL + mPlotW, midY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(244, 239, 228, 0.12)';
      ctx.setLineDash([3, 3]);
      [midY - halfH * 0.6, midY + halfH * 0.6].forEach(gy => {
        ctx.beginPath();
        ctx.moveTo(smX + mPadL, gy);
        ctx.lineTo(smX + mPadL + mPlotW, gy);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      drawText(ctx, m.homeName.slice(0, 4), smX + 6, smY + mPadT + 10, { size: 12, bold: true, color: THEME.BRASS });
      drawText(ctx, m.awayName.slice(0, 4), smX + 6, smY + smH - mPadB - 18, { size: 12, bold: true, color: THEME.COBALT });

      const slotW = mPlotW / 18;
      const barW = Math.max(10, slotW - 6);
      const userIsHomeSide = m.homeName === club.name;
      for (let bi = 0; bi < 18; bi++) {
        const barProg = easeOutCubic(Math.max(0.06, Math.min(1, (t - 0.18 - bi * 0.025) / 0.34)));
        const val = momBuckets[bi];
        const ratio = Math.min(1, Math.abs(val) / maxMom);
        const bh = Math.max(3, ratio * halfH * barProg);
        const bx = smX + mPadL + bi * slotW + (slotW - barW) / 2;
        if (val >= 0) {
          const col = userIsHomeSide ? THEME.BRASS : THEME.VERMILION;
          drawRoundRect(ctx, bx, midY - bh, barW, bh, 3, col);
        } else {
          const col = !userIsHomeSide ? THEME.LIME : THEME.COBALT;
          drawRoundRect(ctx, bx, midY, barW, bh, 3, col);
        }
      }

      for (const gb of momGoalBuckets) {
        const revealT = 0.18 + gb.bucket * 0.025 + 0.16;
        if (t < revealT) continue;
        const pop = easeOutBack(Math.min(1, (t - revealT) / 0.25));
        const gx = smX + mPadL + (gb.bucket + 0.5) * slotW;
        const gy = gb.team === 'home' ? smY + mPadT + 8 : smY + smH - mPadB - 8;
        ctx.save();
        ctx.fillStyle = THEME.LIME;
        ctx.beginPath();
        ctx.arc(gx, gy, 4.5 * Math.min(1.2, pop), 0, Math.PI * 2);
        ctx.fill();
        drawText(ctx, `${gb.minute}'`, gx, gy + (gb.team === 'home' ? -9 : 9), {
          size: 12,
          bold: true,
          color: THEME.LIME,
          align: 'center',
          mono: true,
        });
        ctx.restore();
      }

      const shownMarkerBuckets = new Set<number>();
      for (const tm of momTacticMarkers.slice(0, 6)) {
        const b = Math.max(0, Math.min(17, Math.floor(Math.max(0, tm.minute - 0.01) / 5)));
        if (shownMarkerBuckets.has(b)) continue;
        shownMarkerBuckets.add(b);
        const mx = Math.max(smX + mPadL + 10, smX + mPadL + (tm.minute / 90) * mPlotW);
        const my = smY + smH - mPadB + 2;
        const col = tm.kind === 'sub' ? THEME.LIME : '#C084FC';
        drawRoundRect(ctx, mx - 7, my - 7, 14, 14, 4, THEME.BG_DEEP, col, 1.1);
        drawText(ctx, tm.label, mx, my, { size: 12, bold: true, color: col, align: 'center' });
      }

      [0, 15, 30, 45, 60, 75, 90].forEach(min => {
        const gx = smX + mPadL + (min / 90) * mPlotW;
        drawText(ctx, min === 45 ? 'HT' : `${min}'`, gx, smY + smH - 9, {
          size: 12,
          color: min === 45 ? THEME.GOLD_LIGHT : THEME.TX3,
          align: 'center',
          mono: true,
        });
      });

      const goals = m.events.filter(e => e.type === 'goal').slice(0, 3);
      const evBoxY = 546;
      drawRoundRect(ctx, 30, evBoxY, 592, 62, 8, THEME.BG_CARD_DARK, THEME.INK_LINE, 1.5);
      if (goals.length === 0) {
        drawText(ctx, '本场双方互交白卷 · 攻防拉锯激烈', 44, evBoxY + 20, { size: 12, color: THEME.TX2 });
      } else {
        goals.forEach((g, gi) => {
          const gx = 40 + gi * 194;
          const isUserGoal = g.team === userSide;
          drawRoundRect(ctx, gx, evBoxY + 8, 186, 22, 5, THEME.BG_DEEP, isUserGoal ? THEME.LIME : THEME.VERMILION, 1.2);
          drawText(ctx, fitText(ctx, `${g.minute}' ${g.playerName}`, 174, 12, true), gx + 93, evBoxY + 19, {
            size: 12,
            bold: true,
            color: isUserGoal ? THEME.LIME : '#FCA5A5',
            align: 'center',
          });
        });
      }
      drawText(ctx, fitText(ctx, st.lastMatchReview || '战术执行稳健，准备迎接下一轮挑战', 568, 12), 42, evBoxY + 46, {
        size: 12,
        color: THEME.TX1,
      });
    }

    // 右栏：双 Tab 面板 (x: 650..1264, w: 614, h: 322)
    drawPrintCard(ctx, 650, 298, 614, 322, {
      paper: false,
      radius: 10,
      shadowOffset: 4,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawButton(ctx, hits, 666, 306, 200, 26, `出场球员评分 (${ratedList.length}人)`, () => {
      this.recapTab = 'analytics';
    }, { active: this.recapTab === 'analytics', fontSize: 12 });
    drawButton(ctx, hits, 874, 306, 150, 26, '本轮全联盟赛果', () => {
      this.recapTab = 'results';
    }, { active: this.recapTab === 'results', fontSize: 12 });

    if (this.recapTab === 'analytics' && m) {
      const pageSize = 6;
      const totalPages = Math.max(1, Math.ceil(ratedList.length / pageSize));
      if (this.ratingPage >= totalPages) this.ratingPage = totalPages - 1;
      const slice = ratedList.slice(this.ratingPage * pageSize, (this.ratingPage + 1) * pageSize);

      const avgRating = ratedList.length > 0
        ? (ratedList.reduce((s, r) => s + r.rating, 0) / ratedList.length).toFixed(1)
        : '6.5';
      const totalChemGain = ratedList.reduce((s, r) => s + (growthMap[r.player.id]?.chemGain ?? 0), 0);
      drawText(ctx, `全队均分 ${avgRating} · 默契 +${totalChemGain.toFixed(0)}`, 1248, 319, {
        size: 12,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'right',
      });

      slice.forEach((item, localIdx) => {
        const globalIdx = this.ratingPage * pageSize + localIdx;
        const rowP = easeOutCubic(Math.max(0.05, Math.min(1, (t - 0.25 - localIdx * 0.05) / 0.28)));
        const rx = 666 + (1 - rowP) * 16;
        const ry = 340 + localIdx * 40;
        const rw = 582;
        const rh = 36;
        const isMvp = globalIdx === 0;
        const rColor = item.rating >= 8.0 ? THEME.LIME : item.rating >= 7.0 ? THEME.BRASS : THEME.TX1;

        ctx.save();
        ctx.globalAlpha = rowP;
        drawRoundRect(
          ctx,
          rx,
          ry,
          rw,
          rh,
          6,
          isMvp ? THEME.BG_PITCH_ALT : THEME.BG_CARD_DARK,
          isMvp ? THEME.BRASS : item.isUnlocked ? THEME.COBALT : THEME.INK_LINE,
          isMvp || item.isUnlocked ? 1.8 : 1.2
        );

        if (isMvp) {
          drawBadge(ctx, rx + 8, ry + 8, 36, 20, 'MVP', THEME.BRASS, THEME.PAPER_INK);
        } else {
          drawText(ctx, `#${globalIdx + 1}`, rx + 24, ry + 18, { size: 12, bold: true, color: THEME.TX3, align: 'center', mono: true });
        }
        drawBadge(
          ctx,
          rx + 50,
          ry + 9,
          34,
          18,
          item.player.subbedIn ? '替补' : '首发',
          item.player.subbedIn ? THEME.COBALT : THEME.BG_DEEP,
          item.player.subbedIn ? THEME.PAPER_CREAM : THEME.TX2
        );
        drawBadge(ctx, rx + 88, ry + 9, 34, 18, item.player.role, THEME.BG_DEEP, THEME.TX1);
        drawText(ctx, fitText(ctx, item.player.name, 110, 12.5, true), rx + 128, ry + 18, {
          size: 12.5,
          bold: true,
          color: isMvp ? THEME.GOLD_LIGHT : THEME.TX1,
        });

        let sx = rx + 246;
        item.statIcons.forEach(si => {
          sx += drawStatMicro(ctx, si.ic, `${si.val}`, sx, ry + 18, {
            iconSize: 11,
            fontSize: 12,
            iconColor: THEME.TX3,
            valueColor: THEME.TX1,
            gap: 3,
          });
          sx += 10;
        });

        if (item.gainText) {
          drawText(ctx, item.gainText, rx + rw - 58, ry + 18, {
            size: 12,
            bold: item.isUnlocked,
            color: item.isUnlocked ? THEME.LIME : THEME.GREEN,
            align: 'right',
          });
        } else if (item.keyTrait) {
          drawText(ctx, `[${item.keyTrait.slice(0, 4)}]`, rx + rw - 58, ry + 18, {
            size: 12,
            color: '#C4B5FD',
            align: 'right',
          });
        }

        drawRoundRect(ctx, rx + rw - 48, ry + 5, 40, 26, 5, THEME.BG_DEEP, rColor, 1.4);
        drawText(ctx, item.rating.toFixed(1), rx + rw - 28, ry + 18, {
          size: 13,
          bold: true,
          color: rColor,
          align: 'center',
          mono: true,
        });
        ctx.restore();

        if (item.dp) {
          hits.add(rx, ry, rw, rh, () => {
            SoundEngine.playClick();
            this.fx.onInspectPlayer?.(item.dp!);
          });
        }
      });

      drawButton(ctx, hits, 666, 584, 86, 26, '◀ 上页', () => {
        this.ratingPage = Math.max(0, this.ratingPage - 1);
      }, { disabled: this.ratingPage === 0, fontSize: 12 });
      drawText(ctx, `第 ${this.ratingPage + 1} / ${totalPages} 页 (共 ${ratedList.length} 人出场 · 点击查看详情)`, 957, 597, {
        size: 12,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, 1162, 584, 86, 26, '下页 ▶', () => {
        this.ratingPage = Math.min(totalPages - 1, this.ratingPage + 1);
      }, { disabled: this.ratingPage >= totalPages - 1, fontSize: 12 });
    } else {
      const targetRound = rd ? rd.roundCompleted : st.currentRound - 1;
      const fixtures = st.fixtures.filter(f => f.round === targetRound && f.played);
      const fPageSize = 8;
      const fPages = Math.max(1, Math.ceil(fixtures.length / fPageSize));
      if (this.resultsPage >= fPages) this.resultsPage = fPages - 1;
      const fSlice = fixtures.slice(this.resultsPage * fPageSize, (this.resultsPage + 1) * fPageSize);

      fSlice.forEach((fx, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = 666 + col * 296;
        const by = 342 + row * 58;
        const h = st.clubs.find(c => c.id === fx.homeClubId)!;
        const a = st.clubs.find(c => c.id === fx.awayClubId)!;
        const hasUser = h.isUser || a.isUser;
        drawRoundRect(ctx, bx, by, 286, 50, 7, THEME.BG_CARD_DARK, hasUser ? THEME.BRASS : THEME.INK_LINE, hasUser ? 2 : 1.4);
        drawText(ctx, fitText(ctx, h.name, 96, 12, h.isUser), bx + 114, by + 25, {
          size: 12,
          bold: h.isUser,
          align: 'right',
          color: h.isUser ? THEME.LIME : THEME.TX1,
        });
        drawText(ctx, `${fx.homeGoals}:${fx.awayGoals}`, bx + 143, by + 25, {
          size: 14,
          bold: true,
          align: 'center',
          mono: true,
          color: THEME.GOLD_LIGHT,
        });
        drawText(ctx, fitText(ctx, a.name, 96, 12, a.isUser), bx + 172, by + 25, {
          size: 12,
          bold: a.isUser,
          align: 'left',
          color: a.isUser ? THEME.LIME : THEME.TX1,
        });
      });

      if (fPages > 1) {
        drawButton(ctx, hits, 666, 584, 86, 26, '◀ 上页', () => {
          this.resultsPage = Math.max(0, this.resultsPage - 1);
        }, { disabled: this.resultsPage === 0, fontSize: 12 });
        drawText(ctx, `第 ${this.resultsPage + 1} / ${fPages} 页 (共 ${fixtures.length} 场)`, 957, 597, {
          size: 12,
          color: THEME.TX2,
          align: 'center',
        });
        drawButton(ctx, hits, 1162, 584, 86, 26, '下页 ▶', () => {
          this.resultsPage = Math.min(fPages - 1, this.resultsPage + 1);
        }, { disabled: this.resultsPage >= fPages - 1, fontSize: 12 });
      }
    }
    ctx.restore();

    // ==================== 5. Bottom Action & Rewards Bar (y: 632..706, h: 74) ====================
    drawPrintCard(ctx, 16, 632, 824, 74, {
      paper: false,
      radius: 10,
      shadowOffset: 4,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    const userWonNow = m ? ((m.homeName === club.name ? m.homeScore : m.awayScore) > (m.homeName === club.name ? m.awayScore : m.homeScore)) : true;
    const rwThumb = AssetLoader.get(userWonNow ? 'reward_win' : 'reward_draw');
    if (rwThumb && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(26, 640, 92, 58, 6);
      ctx.clip();
      ctx.drawImage(rwThumb, 26, 640, 92, 58);
      ctx.restore();
    } else {
      drawRewardIllustration(ctx, userWonNow, 26, 640, 92, 58);
    }

    const rewardTitle = hasPendingCardUnlock
      ? '新流派战术卡解锁待领取'
      : hasPendingReward
      ? '赛后 3 选 1 战利品已就绪'
      : rd
      ? '中期 Re-Draft 补强已开启'
      : '本轮收益已结算入账';
    drawText(ctx, rewardTitle, 130, 653, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(
      ctx,
      hasPendingReward ? '赛季圣物 · 手牌附魔 · 星盘点数等你挑选' : '俱乐部资金与积分榜排名已实时更新',
      130,
      673,
      { size: 12, color: THEME.TX2 }
    );

    const popAlpha = Math.max(0.1, Math.min(1, pRewards));
    ctx.save();
    ctx.globalAlpha = popAlpha;
    const fundsEarned = summary?.fundsEarned ?? 0;
    const metaGain = summary?.metaGain ?? 0;
    const standingsNow = league.getStandings();
    const curRank = summary?.rankAfter ?? (standingsNow.findIndex(r => r.isUser) + 1);
    const prevRank = summary?.rankBefore ?? curRank;
    const rankDelta = prevRank - curRank;

    const countFunds = Math.round(fundsEarned * Math.min(1, pRewards));
    drawRoundRect(ctx, 412, 644, 136, 50, 8, THEME.BG_DEEP, THEME.LIME, 1.4);
    drawText(ctx, '本场资金入账', 480, 658, { size: 12, color: THEME.TX2, align: 'center' });
    drawText(ctx, `+¥${countFunds}万`, 480, 678, { size: 14.5, bold: true, color: THEME.LIME, align: 'center', mono: true });

    drawRoundRect(ctx, 556, 644, 114, 50, 8, THEME.BG_DEEP, THEME.COBALT, 1.4);
    drawText(ctx, '星盘点数', 613, 658, { size: 12, color: THEME.TX2, align: 'center' });
    drawText(ctx, `+${metaGain} pt`, 613, 678, { size: 14.5, bold: true, color: '#7DD3FC', align: 'center', mono: true });

    const rankCol = rankDelta > 0 ? THEME.LIME : rankDelta < 0 ? THEME.VERMILION : THEME.BRASS;
    const rankSub = rankDelta > 0 ? `▲ 升 ${rankDelta} 位` : rankDelta < 0 ? `▼ 降 ${Math.abs(rankDelta)} 位` : '名次稳固';
    drawRoundRect(ctx, 678, 644, 150, 50, 8, THEME.BG_DEEP, rankCol, 1.4);
    drawText(ctx, `第 ${curRank} 名`, 753, 658, { size: 13, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
    drawText(ctx, rankSub, 753, 678, { size: 12, bold: true, color: rankCol, align: 'center' });
    ctx.restore();

    drawButton(ctx, hits, 856, 632, 408, 74, nextActionLabel, goNext, { variant: 'gold', fontSize: 16.5 });
    drawFoilShimmer(ctx, 856, 632, 408, 74, this.animClock * 1.15, 'rgba(254, 240, 138, 0.30)');
  }

  private renderCardUnlockView(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    onContinue: () => void,
    onSave: () => void
  ): void {
    const st = league.getState();
    const rd = st.reDraft;
    const rw = st.pendingPostMatchReward!;
    const tc = rw.tutorialCardUnlock!;
    const card = tc.card;
    const stage = tc.stage ?? (card.comboRule ? 'combo' : card.timingCondition ? 'timing' : 'skill');

    const stageMeta =
      stage === 'combo'
        ? {
            num: '1/3',
            title: '连击配合卡',
            accent: THEME.VIOLET,
            flowLeft: `${tc.openerName || '主力态势卡'}（先打起手）`,
            flowRight: `${card.name}（接在后面打出）`,
            howToPlay: '入队后会自动排在起手卡后面！下场先打出起手卡切出态势，再打这张卡就能触发亮紫【态势连击】额外收益。',
          }
        : stage === 'timing'
        ? {
            num: '2/3',
            title: '时机白嫖卡',
            accent: THEME.LIME,
            flowLeft: '平时先捏在手里别急着打',
            flowRight: `满足条件亮绿 → 0 费白嫖 ${card.name}`,
            howToPlay: '不要盲目开局就打掉！比赛过程中随时看底部手牌栏，一旦条件达成卡片会自动亮起绿光，此时点击可 0 费白嫖！',
          }
        : {
            num: '3/3',
            title: '大招联动卡',
            accent: THEME.BRASS,
            flowLeft: `打出 ${card.name}`,
            flowRight: '加速弹出队友子弹时间大招',
            howToPlay: '准备发起强攻或破局时打出这张牌，能大幅提升场上核心球员主动大招的触发概率，打出连续技！',
          };

    drawPrintCard(ctx, 16, 14, 1248, 56, { paper: false, radius: 10, shadowOffset: 3, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawButton(ctx, hits, 28, 24, 104, 36, '← 看战报', () => {
      this.viewMode = 'recap';
    }, { variant: 'ghost', fontSize: 12 });
    drawBadge(ctx, 152, 29, 210, 26, `流派递进教学 · 第 ${stageMeta.num} 阶段`, THEME.BG_DEEP, stageMeta.accent);
    drawText(ctx, `新战术卡解锁：${stageMeta.title}`, 382, 42, { size: 17, bold: true, color: THEME.GOLD_LIGHT });

    drawPrintCard(ctx, 90, 96, 1100, 566, {
      paper: false,
      radius: 14,
      shadowOffset: 6,
      topBandColor: stageMeta.accent,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });

    drawText(ctx, '赛后新卡入队确认（点击下方按钮正式收入卡组）', 640, 134, {
      size: 16,
      bold: true,
      color: THEME.GOLD_LIGHT,
      align: 'center',
    });

    const cx = 140;
    const cy = 170;
    const cw = 300;
    const ch = 366;
    drawPrintCard(ctx, cx, cy, cw, ch, {
      paper: true,
      radius: 12,
      shadowOffset: 5,
      topBandColor: stageMeta.accent,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });

    drawBadge(ctx, cx + 16, cy + 16, 56, 26, `E${card.cost}`, THEME.BG_DEEP, THEME.LIME);
    drawBadge(ctx, cx + 80, cy + 16, 102, 26, stageMeta.title, THEME.INK_LINE, THEME.PAPER_CREAM);
    if (card.maxUses) {
      drawBadge(ctx, cx + cw - 82, cy + 16, 66, 26, `剩${card.maxUses}次`, THEME.VIOLET, THEME.PAPER_CREAM);
    }

    drawText(ctx, card.name, cx + cw / 2, cy + 84, { size: 22, bold: true, color: THEME.PAPER_INK, align: 'center' });
    drawRoundRect(ctx, cx + 22, cy + 114, cw - 44, 158, 8, THEME.PAPER_WARM, THEME.INK_LINE, 1.5);
    drawWrappedText(ctx, card.summary || card.name, cx + 34, cy + 134, cw - 68, 24, {
      size: 13.5,
      color: THEME.PAPER_INK,
      maxLines: 5,
    });

    drawBadge(ctx, cx + 24, cy + ch - 46, cw - 48, 28, card.isBase ? '0阶常备底牌' : `${card.tier ?? 1}阶流派战术卡`, THEME.BG_DEEP, THEME.LIME);

    const rx = 472;
    const ry = 170;
    const rwBox = 668;
    const rhBox = 366;
    drawPrintCard(ctx, rx, ry, rwBox, rhBox, {
      paper: false,
      radius: 12,
      shadowOffset: 4,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawText(ctx, '这张卡怎么用？', rx + 24, ry + 34, { size: 18, bold: true, color: THEME.GOLD_LIGHT });

    drawRoundRect(ctx, rx + 22, ry + 58, rwBox - 44, 84, 8, THEME.BG_DEEP, stageMeta.accent, 1.5);
    drawText(ctx, '触发流程', rx + 36, ry + 76, { size: 12, bold: true, color: THEME.TX2 });
    drawRoundRect(ctx, rx + 36, ry + 90, 264, 38, 6, THEME.BG_CARD_DARK, THEME.INK_LINE, 1.4);
    drawText(ctx, fitText(ctx, stageMeta.flowLeft, 248, 12.5), rx + 168, ry + 109, {
      size: 12.5,
      bold: true,
      color: THEME.TX1,
      align: 'center',
    });
    drawText(ctx, '──▶', rx + 334, ry + 109, { size: 15, bold: true, color: stageMeta.accent, align: 'center' });
    drawRoundRect(ctx, rx + 368, ry + 90, 264, 38, 6, THEME.BG_PITCH_ALT, stageMeta.accent, 1.5);
    drawText(ctx, fitText(ctx, stageMeta.flowRight, 248, 12.5), rx + 500, ry + 109, {
      size: 12.5,
      bold: true,
      color: stageMeta.accent,
      align: 'center',
    });

    drawRoundRect(ctx, rx + 22, ry + 156, rwBox - 44, 92, 8, THEME.BG_PITCH_ALT, THEME.LIME, 1.4);
    drawText(ctx, '核心用法', rx + 36, ry + 176, { size: 12, bold: true, color: THEME.LIME });
    drawWrappedText(ctx, tc.tip, rx + 36, ry + 196, rwBox - 72, 24, {
      size: 14.5,
      bold: true,
      color: THEME.TX1,
      maxLines: 2,
    });

    drawRoundRect(ctx, rx + 22, ry + 262, rwBox - 44, 86, 8, THEME.BG_DEEP, THEME.INK_LINE, 1.4);
    drawText(ctx, '赛中操作提示', rx + 36, ry + 282, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawWrappedText(ctx, stageMeta.howToPlay, rx + 36, ry + 302, rwBox - 72, 22, {
      size: 13,
      color: THEME.TX1,
      maxLines: 2,
    });

    drawButton(
      ctx,
      hits,
      410,
      574,
      460,
      54,
      `收入卡组 · 我学会了（${card.name}） ▶`,
      () => {
        league.claimTutorialCardUnlock();
        SoundEngine.playRewardChime();
        this.fx.onBurst?.(640, 320, stageMeta.accent);
        this.fx.onBurst?.(420, 340, THEME.GOLD_LIGHT);
        onSave();
        const hasPendingReward = !rw.completed;
        if (hasPendingReward) {
          this.catEnterTimer = 0;
          this.packAnim = null;
          this.resetCardRevealAnim();
          this.viewMode = 'reward';
        } else if (rd) {
          this.viewMode = 'redraft';
        } else {
          onContinue();
        }
      },
      { variant: 'gold', fontSize: 16 }
    );
  }

  private renderRewardView(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    onContinue: () => void,
    onSave: () => void
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const rd = st.reDraft;
    const rw = st.pendingPostMatchReward!;

    // 顶栏步骤条
    drawPrintCard(ctx, 16, 14, 1248, 56, {
      paper: false,
      radius: 10,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawButton(ctx, hits, 28, 24, 104, 36, '← 看战报', () => {
      this.viewMode = 'recap';
    }, { variant: 'ghost', fontSize: 12 });

    const step1Done = !!rw.chosenCategory;
    const step2Done = rw.completed;
    drawBadge(ctx, 156, 29, 196, 26, '第1步：选战术盲盒 (3选1)', step1Done ? THEME.BG_PITCH_ALT : THEME.BG_DEEP, step1Done ? THEME.LIME : THEME.GOLD_LIGHT);
    drawText(ctx, '→', 366, 42, { size: 16, color: THEME.TX3, align: 'center' });
    drawBadge(
      ctx,
      382,
      29,
      210,
      26,
      rw.pendingStatOptionId ? '第2步：指定受训球员' : '第2步：开包翻牌领奖',
      step2Done ? THEME.BG_PITCH_ALT : step1Done ? THEME.BG_DEEP : THEME.BG_CARD_DARK,
      step2Done ? THEME.LIME : step1Done ? THEME.GOLD_LIGHT : THEME.TX3
    );

    const cadence = rw.cadence ?? 'normal';
    const cadBadgeText = cadence === 'crisis' ? '连败救火轮' : cadence === 'focus' ? '焦点强强轮' : '常规赛后轮';
    const cadBadgeBg = cadence === 'crisis' ? THEME.VERMILION : cadence === 'focus' ? THEME.BRASS : THEME.BG_DEEP;
    const cadBadgeCol = cadence === 'crisis' ? THEME.PAPER_CREAM : cadence === 'focus' ? THEME.PAPER_INK : THEME.TX2;
    drawBadge(ctx, 608, 29, 108, 26, cadBadgeText, cadBadgeBg, cadBadgeCol);

    if ((rw.rerollsLeft ?? 0) > 0 && !rw.completed && !rw.pendingStatOptionId) {
      const prepLeft = st.interMatchPrep?.actionsLeft ?? 0;
      const canReroll = prepLeft > 0 || st.metaPointsTotal >= 8;
      const rerollLabel = prepLeft > 0 ? '重抽 (1备战点)' : '重抽 (8 Meta)';
      drawButton(
        ctx,
        hits,
        1076,
        24,
        174,
        36,
        rerollLabel,
        () => {
          const rRes = league.rerollPostMatchReward();
          if (rRes.ok) {
            if (rw.chosenCategory) this.resetCardRevealAnim();
            SoundEngine.playClick();
            onSave();
          }
        },
        { variant: 'primary', disabled: !canReroll, fontSize: 12 }
      );
    }

    if (rw.completed) {
      drawButton(
        ctx,
        hits,
        980,
        24,
        270,
        36,
        rd ? '下一步：中期 Re-Draft ▶' : '继续下一轮 · 返回门户 ▶',
        () => {
          if (rd) {
            this.viewMode = 'redraft';
          } else {
            onSave();
            onContinue();
          }
        },
        { variant: 'gold' }
      );
    }

    const CAT_META: Record<string, { title: string; badge: string; shortTag: string; desc: string; color: string; icon: IconName }> = {
      player: {
        title: '新援盲盒 · 招募球员',
        badge: '3选1入队',
        shortTag: '球探档案',
        desc: '球探盲盒 3 选 1 立即入队',
        color: THEME.COBALT,
        icon: 'star',
      },
      stat_boost: {
        title: '单体特训包 · 王牌精修',
        badge: '永久属性 +2~+4',
        shortTag: '特训密令',
        desc: '指定 1 名球员永久提升属性',
        color: THEME.BRASS,
        icon: 'bolt',
      },
      line_boost: {
        title: '位置共振包 · 整线强化',
        badge: '全线协同增益',
        shortTag: '整线共振',
        desc: '门/防/中/锋整条线全员强化',
        color: '#15803D',
        icon: 'shield',
      },
      craft_card: {
        title: '星盘圣物 · 手牌暗金附魔',
        badge: '赛季圣物 / 附魔 + 星盘点',
        shortTag: '战术圣物',
        desc: '装备单季规则圣物、手牌附魔或三星超频',
        color: THEME.VIOLET,
        icon: 'sparkle',
      },
      event: {
        title: '更衣室奇遇 · 随机事件',
        badge: '恢复 / 默契 / 特质',
        shortTag: '更衣室简报',
        desc: '回满体能、涨默契或觉醒特质',
        color: THEME.VERMILION,
        icon: 'ball',
      },
      trait_forge: {
        title: '临时徽章 · 临场觉醒',
        badge: '3~5轮 / 兼职',
        shortTag: '徽章锻造',
        desc: '赐予临时金/银标或解锁兼职位置',
        color: THEME.VERMILION,
        icon: 'sparkle',
      },
      tactical_pact: {
        title: '更衣室契约 · 双刃剑',
        badge: '高风险高回报',
        shortTag: '双刃契约',
        desc: '以体能换战力暴涨或 Meta 点数',
        color: THEME.VERMILION,
        icon: 'bolt',
      },
      chemistry_forge: {
        title: '化学连线 · 宗师蜕变',
        badge: '黄金连线 / 超频',
        shortTag: '化学连线',
        desc: '铸造黄金连线或高费手牌降费',
        color: THEME.COBALT,
        icon: 'link',
      },
      gamble: {
        title: '风险博弈 · 三态对赌',
        badge: '绿正 / 红负 / 金暴击',
        shortTag: '风险博弈',
        desc: '按当前联赛等级触发高风险博弈：常规收益 · 负面代价 · 超额暴击',
        color: THEME.BRASS,
        icon: 'trophy',
      },
      season_perk: {
        title: '赛季战术词条 · 永久强化',
        badge: '里程碑必出 · 3/4选1',
        shortTag: '赛季词条',
        desc: '从 3~4 张赛季级战术词条中任选 1 张永久激活，同系叠加 2 张触发共振',
        color: THEME.BRASS,
        icon: 'card',
      },
    };

    // 开包撕裂过场动画（0 -> 0.56s，PITCH PRINT 档案袋拆封）
    if (this.packAnim?.active) {
      const pa = this.packAnim;
      const t = pa.timer;
      ctx.save();
      ctx.fillStyle = 'rgba(10, 26, 20, 0.86)';
      ctx.fillRect(0, 70, THEME.W, THEME.H - 70);

      if (t < 0.36) {
        const moveP = easeOutCubic(Math.min(1, t / 0.24));
        const px = pa.startX + (640 - pa.startX) * moveP;
        const py = 354 + (340 - 354) * moveP;
        const shakeAmp = t > 0.14 ? (t - 0.14) * 32 : 0;
        const jx = (Math.random() * 2 - 1) * shakeAmp;
        const jy = (Math.random() * 2 - 1) * shakeAmp;
        const scale = 1 + 0.22 * moveP;

        ctx.translate(px + jx, py + jy);
        ctx.scale(scale, scale);
        this.drawPrintTacticalPack(ctx, -110, -145, 220, 290, pa.color, pa.shortTag, pa.icon, true, this.getPackArtIdForCategory(pa.cat));
        drawText(ctx, pa.title, 0, 174, { size: 17, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
        drawText(ctx, '正在拆封战利品档案袋...', 0, 200, { size: 12.5, color: THEME.LIME, align: 'center' });

        if (t > 0.16) {
          const beamP = (t - 0.16) / 0.20;
          ctx.strokeStyle = THEME.LIME;
          ctx.lineWidth = 3 + beamP * 8;
          ctx.beginPath();
          ctx.moveTo(-110, -80);
          ctx.lineTo(110, -80);
          ctx.stroke();
        }
      } else {
        const postP = (t - 0.36) / 0.20;
        const flashP = Math.max(0, 1 - postP);
        ctx.fillStyle = `rgba(244, 239, 228, ${Math.max(0, flashP * 0.45)})`;
        ctx.fillRect(0, 70, THEME.W, THEME.H - 70);
      }
      ctx.restore();
      return;
    }

    // 状态 A：第一步 3 选 1 门类盲盒卡包（PITCH PRINT 矢量/印刷战术盲盒包）
    if (!rw.chosenCategory) {
      drawText(ctx, '选择 1 个赛后战术盲盒开启（3选1 · 拆封后逐张翻牌揭示奖励）', 640, 118, {
        size: 17,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
      rw.categories.forEach((cat, idx) => {
        const meta = CAT_META[cat] ?? CAT_META.stat_boost;
        const enterP = easeOutBack(Math.max(0, Math.min(1, (this.catEnterTimer - idx * 0.08) / 0.38)));
        const floatY = Math.sin(this.animClock * 2.2 + idx * 1.4) * 3;
        const cx = 86 + idx * 384;
        const cy = 158 + (1 - enterP) * 50 + floatY;
        const cw = 340;
        const ch = 406;
        const hovered = hits.isHovered(cx, cy, cw, ch);

        ctx.save();
        ctx.globalAlpha = Math.max(0.05, enterP);
        drawPrintCard(ctx, cx, cy, cw, ch, {
          paper: true,
          radius: 12,
          shadowOffset: hovered ? 8 : 5,
          topBandColor: meta.color,
          strokeColor: hovered ? THEME.LIME : THEME.INK_LINE,
          lineWidth: hovered ? 3 : 2.5,
        });

        drawBadge(ctx, cx + 18, cy + 16, 170, 24, meta.badge, THEME.BG_DEEP, THEME.LIME);
        drawBadge(ctx, cx + cw - 86, cy + 16, 68, 24, `NO.0${idx + 1}`, THEME.PAPER_WARM, THEME.PAPER_INK);

        // 中央 PITCH PRINT 封条战术档案袋 / 新盲盒卡包插画
        const packW = 156;
        const packH = 192;
        const packX = Math.round(cx + (cw - packW) / 2);
        const packY = Math.round(cy + 52);
        this.drawPrintTacticalPack(ctx, packX, packY, packW, packH, meta.color, meta.shortTag, meta.icon, hovered, this.getPackArtIdForCategory(cat));

        drawText(ctx, meta.title, cx + cw / 2, cy + 268, { size: 17, bold: true, color: THEME.PAPER_INK, align: 'center' });
        drawWrappedText(ctx, meta.desc, cx + 22, cy + 288, cw - 44, 19, { size: 12.5, color: THEME.PAPER_MUTED, maxLines: 2 });

        drawRoundRect(
          ctx,
          cx + 34,
          cy + ch - 46,
          cw - 68,
          32,
          8,
          hovered ? THEME.VERMILION : THEME.BG_DEEP,
          THEME.INK_LINE,
          2
        );
        drawText(ctx, hovered ? '点击拆封此盲盒 ▶' : '点击拆封战术盲盒', cx + cw / 2, cy + ch - 30, {
          size: 13,
          bold: true,
          color: hovered ? THEME.PAPER_CREAM : THEME.LIME,
          align: 'center',
        });
        ctx.restore();

        hits.add(cx, cy, cw, ch, () => {
          SoundEngine.playPackRip();
          this.resetCardRevealAnim();
          this.packAnim = {
            active: true,
            cat,
            color: meta.color,
            title: meta.title,
            shortTag: meta.shortTag,
            icon: meta.icon,
            startX: cx + cw / 2,
            timer: 0,
            bursted: false,
          };
          league.pickPostMatchRewardCategory(cat);
          onSave();
        });
      });
      return;
    }

    // 状态 B：单体特训卡 / 特质移植待指定受训球员
    if (rw.pendingStatOptionId && !rw.completed) {
      const opt = rw.options.find(o => o.id === rw.pendingStatOptionId);
      const isTraitForge = opt?.category === 'trait_forge';
      const starterSet = new Set(club.starterIds);
      const attrKey = opt?.statBoost?.attr ?? 'shooting';

      const scored = [...club.squad].map(p => {
        const isStarter = starterSet.has(p.id);
        let score = (isStarter ? 40 : 0) + p.ca * 0.5 + Math.max(0, (p.pa ?? p.ca) - p.ca) * 0.6;
        if (isTraitForge) {
          if (opt?.traitForge?.kind === 'unlock_role') {
            const secCount = p.secondaryRoles?.length ?? 0;
            score += secCount === 0 ? 35 : -secCount * 12;
          } else {
            const traitCount = (p.goldTraits?.length ?? 0) * 2 + (p.silverTraits?.length ?? 0);
            score += Math.max(0, 6 - traitCount) * 8;
          }
        } else {
          if (attrKey === 'goalkeeping' && p.role === 'GK') score += 50;
          else if (attrKey === 'goalkeeping' && p.role !== 'GK') score -= 80;
          else if (attrKey === 'defending' && ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.role)) score += 25;
          else if (attrKey === 'passing' && ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role)) score += 25;
          else if (attrKey === 'shooting' && ['ST', 'CF', 'LW', 'RW', 'CAM'].includes(p.role)) score += 25;
        }
        return { p, score };
      }).sort((a, b) => b.score - a.score);
      const recommended = scored[0]?.p;

      drawText(ctx, `已选【${opt?.title || '专项强化'}】`, 42, 106, { size: 15.5, bold: true, color: THEME.GOLD_LIGHT });
      const filters: Array<['all' | 'starters' | 'bench', string]> = [
        ['all', `全部 (${club.squad.length})`],
        ['starters', '首发'],
        ['bench', '替补'],
      ];
      filters.forEach(([fk, fl], fi) => {
        drawButton(ctx, hits, 310 + fi * 82, 92, 76, 28, fl, () => {
          this.statTargetFilter = fk;
          this.statTargetPage = 0;
        }, { active: this.statTargetFilter === fk, fontSize: 12 });
      });

      if (recommended) {
        drawButton(
          ctx,
          hits,
          936,
          90,
          302,
          32,
          `一键应用给推荐【${recommended.role}·${recommended.name}】▶`,
          () => {
            league.applyPostMatchRewardOption(rw.pendingStatOptionId!, recommended.id);
            SoundEngine.playRewardChime();
            this.fx.onBurst?.(1087, 106, isTraitForge ? '#F472B6' : THEME.GOLD_LIGHT);
            onSave();
          },
          { variant: 'gold', fontSize: 12, icon: 'sparkle' }
        );
      }

      const filtered = club.squad
        .filter(p =>
          this.statTargetFilter === 'starters' ? starterSet.has(p.id) :
          this.statTargetFilter === 'bench' ? !starterSet.has(p.id) : true
        )
        .sort((a, b) => {
          const aRec = recommended && a.id === recommended.id ? 1 : 0;
          const bRec = recommended && b.id === recommended.id ? 1 : 0;
          if (aRec !== bRec) return bRec - aRec;
          const aSt = starterSet.has(a.id) ? 1 : 0;
          const bSt = starterSet.has(b.id) ? 1 : 0;
          return bSt - aSt || b.ca - a.ca;
        });

      const pageSize = 12;
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (this.statTargetPage >= totalPages) this.statTargetPage = totalPages - 1;
      const visible = filtered.slice(this.statTargetPage * pageSize, (this.statTargetPage + 1) * pageSize);

      visible.forEach((p, idx) => {
        const col = idx % 4;
        const row = Math.floor(idx / 4);
        const cx = 42 + col * 302;
        const cy = 136 + row * 158;
        const cw = 288;
        const ch = 148;
        const isRec = recommended?.id === p.id;
        const isStarter = starterSet.has(p.id);
        const hovered = hits.isHovered(cx, cy, cw, ch);

        drawPrintCard(ctx, cx, cy, cw, ch, {
          paper: isRec,
          radius: 8,
          shadowOffset: isRec || hovered ? 4 : 2,
          topBandColor: isRec ? THEME.BRASS : undefined,
          strokeColor: hovered ? THEME.LIME : THEME.INK_LINE,
          lineWidth: isRec || hovered ? 2 : 1.5,
        });

        drawBadge(ctx, cx + 8, cy + 9, 34, 17, p.role, tierColor(p.tier));
        drawBadge(ctx, cx + 45, cy + 9, 34, 17, isStarter ? '首发' : '替补', isStarter ? THEME.BG_PITCH_ALT : THEME.BG_DEEP, isStarter ? THEME.LIME : THEME.TX3);
        if (isRec) {
          drawBadge(ctx, cx + 82, cy + 9, 34, 17, '推荐', THEME.VERMILION, THEME.PAPER_CREAM);
        }
        drawText(ctx, `CA ${p.ca}/${p.pa ?? p.ca}`, cx + cw - 8, cy + 17, {
          size: 12,
          bold: true,
          color: isRec ? THEME.PAPER_INK : THEME.GOLD_LIGHT,
          align: 'right',
          mono: true,
        });

        drawPlayerAvatar(ctx, cx + 10, cy + 32, 44, 54, p, club, { radius: 6 });
        const shirtTxt = p.shirtNumber ? `#${p.shirtNumber} ` : '';
        drawText(ctx, `${shirtTxt}${p.name.slice(0, 6)}`, cx + 62, cy + 40, { size: 12.5, bold: true, color: isRec ? THEME.PAPER_INK : THEME.TX1 });
        drawText(ctx, `${p.age}岁 · 兼:${p.secondaryRoles?.join('/') || '专职'}`, cx + 62, cy + 57, { size: 12, color: isRec ? THEME.PAPER_MUTED : THEME.TX2 });

        const a = p.attributes;
        const attrSummary = p.role === 'GK'
          ? `扑${a.goalkeeping} 站${a.positioning} 冷${a.composure} 传${a.passing}`
          : `速${a.pace} 射${a.shooting} 传${a.passing} 防${a.defending}`;
        drawText(ctx, attrSummary, cx + 62, cy + 73, { size: 12, color: isRec ? THEME.PAPER_MUTED : THEME.TX2, mono: true });

        if (isTraitForge) {
          const gCnt = p.goldTraits?.length ?? 0;
          const sList = p.silverTraits?.slice(0, 2).join('/') || p.trait || '无';
          drawText(ctx, `金标:${gCnt} · 银标:${sList}`, cx + 10, cy + 98, { size: 12, color: isRec ? THEME.VERMILION : '#F472B6' });
        } else {
          drawText(ctx, `当前 ${opt?.statBoost?.attrLabel || '属性'}: ${p.attributes[attrKey]}`, cx + 10, cy + 98, {
            size: 12,
            bold: true,
            color: isRec ? THEME.COBALT : THEME.LIME,
            mono: true,
          });
        }

        drawButton(ctx, hits, cx + 10, cy + ch - 34, 68, 26, '详情', () => {
          this.fx.onInspectPlayer?.(p);
        }, { variant: 'ghost', fontSize: 12 });
        drawButton(ctx, hits, cx + 84, cy + ch - 34, cw - 94, 26, isTraitForge ? '移植改造' : '特训此人', () => {
          league.applyPostMatchRewardOption(rw.pendingStatOptionId!, p.id);
          SoundEngine.playRewardChime();
          this.fx.onBurst?.(cx + cw / 2, cy + ch / 2, isTraitForge ? '#F472B6' : THEME.GOLD_LIGHT);
          onSave();
        }, { variant: isRec ? 'gold' : 'primary', fontSize: 12 });
      });

      if (totalPages > 1) {
        drawButton(ctx, hits, 440, 622, 110, 32, '上一页', () => {
          this.statTargetPage = Math.max(0, this.statTargetPage - 1);
        }, { disabled: this.statTargetPage === 0, fontSize: 12 });
        drawText(ctx, `第 ${this.statTargetPage + 1} / ${totalPages} 页`, 640, 638, { size: 12, color: THEME.TX2, align: 'center' });
        drawButton(ctx, hits, 730, 622, 110, 32, '下一页', () => {
          this.statTargetPage = Math.min(totalPages - 1, this.statTargetPage + 1);
        }, { disabled: this.statTargetPage >= totalPages - 1, fontSize: 12 });
      }
      return;
    }

    // 状态 C：已完成领奖 — PITCH PRINT 暖纸荣誉结算卡
    if (rw.completed) {
      const rolledOpt = rw.options.find(o => o.gamble?.rolledTier);
      const rolledTier = rolledOpt?.gamble?.rolledTier;
      const pickedOpt = rw.options.find(o => o.id === this.lastPickedOptionId) ?? rolledOpt ?? rw.options[0];
      const catMeta = CAT_META[rw.chosenCategory ?? 'stat_boost'] ?? CAT_META.stat_boost;
      const resCol = rolledTier === 'jackpot' ? THEME.BRASS : rolledTier === 'negative' ? THEME.VERMILION : '#15803D';
      const resBadgeTxt = rolledTier === 'jackpot' ? '超额暴击 · 荣誉结算' : rolledTier === 'negative' ? '触发代价 · 博弈结算' : rolledTier === 'positive' ? '稳健收益 · 荣誉结算' : '赛后战利品 · 已生效';

      const mx = 220;
      const my = 128;
      const mw = 840;
      const mh = 436;
      drawPrintCard(ctx, mx, my, mw, mh, {
        paper: true,
        radius: 14,
        shadowOffset: 8,
        topBandColor: resCol,
        strokeColor: THEME.INK_LINE,
        lineWidth: 3,
      });

      drawBadge(ctx, mx + 28, my + 24, 188, 26, resBadgeTxt, THEME.BG_DEEP, THEME.LIME);
      drawBadge(ctx, mx + mw - 148, my + 24, 120, 26, catMeta.shortTag, THEME.PAPER_WARM, THEME.PAPER_INK);

      // 中央勋章图标盒（若获得圣物则直接居中贴上暖纸模切贴纸，不套深色方框压边）
      const iconBoxX = mx + 36;
      const iconBoxY = my + 74;
      const rewardRelicId = pickedOpt?.v6RogueReward?.relicId;
      const rewardRelicArt = rewardRelicId ? getRelicAssetId(rewardRelicId) : null;
      const rewardRelicImg = rewardRelicArt ? AssetLoader.get(rewardRelicArt) : null;
      if (rewardRelicImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.translate(iconBoxX + 60, iconBoxY + 60);
        ctx.rotate(-2 * Math.PI / 180);
        ctx.drawImage(rewardRelicImg, -56, -56, 112, 112);
        ctx.restore();
      } else {
        drawPrintCard(ctx, iconBoxX, iconBoxY, 120, 120, {
          paper: false,
          radius: 12,
          shadowOffset: 4,
          topBandColor: catMeta.color,
          strokeColor: THEME.INK_LINE,
          lineWidth: 2.5,
        });
        drawIcon(ctx, catMeta.icon, iconBoxX + 60, iconBoxY + 54, 44, catMeta.color);
        drawText(ctx, pickedOpt?.rarity?.toUpperCase() ?? 'REWARD', iconBoxX + 60, iconBoxY + 98, {
          size: 12,
          bold: true,
          color: THEME.LIME,
          align: 'center',
          mono: true,
        });
      }

      // 右侧标题与生效拆解
      const tx = iconBoxX + 144;
      const tw = mw - 216;
      drawText(ctx, fitText(ctx, pickedOpt?.title || catMeta.title, tw, 22, true), tx, iconBoxY + 22, {
        size: 22,
        bold: true,
        color: THEME.PAPER_INK,
      });
      if (pickedOpt?.v6RogueReward) {
        drawBadge(ctx, tx, iconBoxY + 46, 224, 24, `${pickedOpt.v6RogueReward.badge} · 另赠星盘点 +${pickedOpt.v6RogueReward.metaBonus}pt`, THEME.VIOLET, THEME.PAPER_CREAM);
      } else {
        drawBadge(ctx, tx, iconBoxY + 46, 168, 24, catMeta.badge, THEME.BG_DEEP, THEME.GOLD_LIGHT);
      }

      // 暖纸深框拆解结果说明
      drawRoundRect(ctx, tx, iconBoxY + 82, tw, 98, 8, THEME.PAPER_WARM, THEME.INK_LINE, 1.8);
      drawText(ctx, '生效效果拆解', tx + 14, iconBoxY + 98, { size: 12, bold: true, color: THEME.PAPER_MUTED });
      drawWrappedText(ctx, rw.summaryText || pickedOpt?.subtitle || '战利品已生效并写入本季档案', tx + 14, iconBoxY + 118, tw - 28, 22, {
        size: 14.5,
        bold: true,
        color: rolledTier === 'negative' ? THEME.VERMILION : THEME.PAPER_INK,
        maxLines: 3,
      });

      // 右上角印章
      drawStamp(ctx, '已入账', mx + mw - 78, my + 126, resCol, -12, 0.92);

      if (rw.tutorialCardUnlock?.claimed) {
        drawRoundRect(ctx, mx + 36, my + 276, mw - 72, 38, 8, THEME.BG_DEEP, THEME.LIME, 1.5);
        drawText(
          ctx,
          `✓ 本轮新解锁流派卡【${rw.tutorialCardUnlock.card.name}】已收入卡组，可在「战术」页调整顺序`,
          640,
          my + 295,
          { size: 12.5, bold: true, color: THEME.LIME, align: 'center' }
        );
      }

      drawButton(
        ctx,
        hits,
        420,
        my + mh - 76,
        440,
        54,
        rd ? '下一步：进入中期 Re-Draft 补强 ▶' : '继续下一轮 · 返回门户首页 ▶',
        () => {
          if (rd) {
            this.viewMode = 'redraft';
          } else {
            onSave();
            onContinue();
          }
        },
        { variant: 'gold', fontSize: 16 }
      );
      return;
    }

    // 状态 C：第二步 展开 3~4 张战利品卡
    const catInfo = CAT_META[rw.chosenCategory] ?? CAT_META.stat_boost;
    drawText(ctx, `${catInfo.title} — 逐张翻牌揭示，选择 1 项战利品`, 640, 118, {
      size: 16,
      bold: true,
      color: THEME.GOLD_LIGHT,
      align: 'center',
    });

    const optCount = rw.options.length;
    const allRevealed = rw.options.every((_, idx) => this.flipped[idx] && this.flipTimers[idx] >= 0.35);
    if (!allRevealed) {
      drawButton(ctx, hits, 1072, 102, 160, 32, '一键全翻', () => {
        this.flipped = [true, true, true, true];
        this.flipTimers = [0.22, 0.22, 0.22, 0.22];
      }, { variant: 'primary', fontSize: 12, icon: 'sparkle' });
    }

    const cw = optCount >= 4 ? 276 : 340;
    const ch = 376;
    const gap = optCount >= 4 ? 24 : 44;
    const startX = (THEME.W - (optCount * cw + (optCount - 1) * gap)) / 2;

    rw.options.forEach((opt, idx) => {
      const targetX = startX + idx * (cw + gap);
      const targetY = 174;

      const dealP = easeOutBack(Math.max(0, Math.min(1, (this.dealTimer - idx * 0.05) / 0.34)));
      const cx = 640 - cw / 2 + (targetX - (640 - cw / 2)) * dealP;
      const cy = 340 - ch / 2 + (targetY - (340 - ch / 2)) * dealP;

      const rCol = opt.rarity === 'epic' ? THEME.BRASS : opt.rarity === 'rare' ? THEME.COBALT : THEME.INK_LINE;
      const rLabel = opt.rarity === 'epic' ? '稀有 · EPIC' : opt.rarity === 'rare' ? '精良 · RARE' : '常规 · COMMON';

      const fp = this.flipped[idx] ? Math.min(1, this.flipTimers[idx] / 0.44) : 0;
      const showFront = fp >= 0.5;
      const scaleX = Math.max(0.06, Math.abs(Math.cos(fp * Math.PI)));

      if (showFront && !this.flipSoundPlayed[idx]) {
        this.flipSoundPlayed[idx] = true;
        SoundEngine.playCardFlip(opt.rarity);
        if (opt.rarity === 'epic') {
          this.fx.onBurst?.(targetX + cw / 2, targetY + ch / 2, THEME.GOLD_LIGHT);
          this.fx.onShake?.(4, 0.14);
        } else if (opt.rarity === 'rare') {
          this.fx.onBurst?.(targetX + cw / 2, targetY + ch / 2, THEME.COBALT);
        }
      }

      const hovered = showFront && fp >= 0.9 && hits.isHovered(cx, cy, cw, ch);

      ctx.save();
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.scale(scaleX, showFront ? 1 : 0.98 + Math.sin(this.animClock * 4 + idx) * 0.012);
      ctx.translate(-(cx + cw / 2), -(cy + ch / 2));

      if (!showFront) {
        drawPrintCard(ctx, cx, cy, cw, ch, {
          paper: false,
          radius: 12,
          shadowOffset: 5,
          topBandColor: rCol,
          strokeColor: THEME.INK_LINE,
          lineWidth: 2.5,
        });
        drawBadge(ctx, cx + cw / 2 - 58, cy + ch / 2 - 14, 116, 28, '点击翻开', THEME.BG_DEEP, THEME.LIME);
        ctx.restore();

        hits.add(cx, cy, cw, ch, () => {
          this.flipped[idx] = true;
        });
        return;
      }

      drawPrintCard(ctx, cx, cy, cw, ch, {
        paper: true,
        radius: 12,
        shadowOffset: hovered ? 8 : 5,
        topBandColor: rCol,
        strokeColor: hovered ? THEME.LIME : THEME.INK_LINE,
        lineWidth: hovered ? 3 : 2.5,
      });

      drawBadge(ctx, cx + 20, cy + 22, 116, 24, rLabel, THEME.BG_DEEP, opt.rarity === 'epic' ? THEME.GOLD_LIGHT : THEME.LIME);
      if (opt.v6RogueReward) {
        drawBadge(ctx, cx + cw - 122, cy + 22, 102, 24, `${opt.v6RogueReward.badge} +${opt.v6RogueReward.metaBonus}pt`, THEME.VIOLET, THEME.PAPER_CREAM);
      }
      drawText(ctx, fitText(ctx, opt.title, cw - 40, 17, true), cx + 20, cy + 74, { size: 17, bold: true, color: THEME.PAPER_INK });
      drawWrappedText(ctx, opt.subtitle, cx + 20, cy + 106, cw - 40, 21, { size: 13.5, color: THEME.PAPER_MUTED, maxLines: 4 });

      if (opt.v6RogueReward) {
        const optRelicArt = opt.v6RogueReward.relicId ? getRelicAssetId(opt.v6RogueReward.relicId) : null;
        const optRelicImg = optRelicArt ? AssetLoader.get(optRelicArt) : null;
        if (optRelicImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.translate(cx + cw / 2, cy + 190);
          ctx.rotate((idx % 2 === 0 ? -2 : 2) * Math.PI / 180);
          ctx.drawImage(optRelicImg, -36, -36, 72, 72);
          ctx.restore();
        }
        drawRoundRect(ctx, cx + 20, cy + 232, cw - 40, 58, 8, THEME.PAPER_WARM, THEME.VIOLET, 1.6);
        drawText(ctx, `★ 本季常驻 · 另赠星盘点 +${opt.v6RogueReward.metaBonus}pt`, cx + cw / 2, cy + 250, {
          size: 12,
          bold: true,
          color: THEME.VIOLET,
          align: 'center',
        });
        drawText(ctx, fitText(ctx, opt.v6RogueReward.description, cw - 56, 12), cx + cw / 2, cy + 272, {
          size: 12,
          color: THEME.PAPER_INK,
          align: 'center',
        });
      }

      if (opt.player) {
        const pl = opt.player;
        drawPlayerAvatar(ctx, cx + cw / 2 - 34, cy + 178, 68, 86, pl, club, { radius: 8 });
        drawRoundRect(ctx, cx + 20, cy + 272, cw - 40, 32, 6, THEME.BG_DEEP, THEME.INK_LINE, 1.4);
        drawText(
          ctx,
          pl.role === 'GK'
            ? `扑${pl.attributes.goalkeeping} 站${pl.attributes.positioning} 传${pl.attributes.passing}`
            : `速${pl.attributes.pace} 射${pl.attributes.shooting} 传${pl.attributes.passing} 防${pl.attributes.defending}`,
          cx + cw / 2,
          cy + 288,
          { size: 12, color: THEME.LIME, align: 'center', mono: true }
        );
      } else if (opt.gamble) {
        const g = opt.gamble;
        const barX = cx + 20;
        const barY = cy + 186;
        const barW = cw - 40;
        const barH = 14;
        const wPos = Math.round((barW * g.positive.prob) / 100);
        const wNeg = Math.round((barW * g.negative.prob) / 100);
        const wJack = Math.max(4, barW - wPos - wNeg);

        drawRoundRect(ctx, barX - 1, barY - 1, barW + 2, barH + 2, 5, THEME.BG_DEEP, THEME.INK_LINE, 1.4);
        ctx.fillStyle = '#15803D';
        ctx.fillRect(barX, barY, wPos, barH);
        ctx.fillStyle = THEME.VERMILION;
        ctx.fillRect(barX + wPos, barY, wNeg, barH);
        ctx.fillStyle = THEME.BRASS;
        ctx.fillRect(barX + wPos + wNeg, barY, wJack, barH);

        drawText(ctx, `${g.positive.prob}% 正 · ${g.positive.label}`, barX, cy + 216, { size: 12, bold: true, color: '#15803D' });
        drawText(ctx, `${g.negative.prob}% 负 · ${g.negative.label}`, barX, cy + 236, { size: 12, bold: true, color: THEME.VERMILION });
        drawText(ctx, `${g.jackpot.prob}% 暴 · ${g.jackpot.label}`, barX, cy + 256, { size: 12, bold: true, color: '#9A6B12' });
        if (g.modifierHint) {
          drawWrappedText(ctx, `校准：${g.modifierHint}`, barX, cy + 278, barW, 15, { size: 12, color: THEME.PAPER_MUTED, maxLines: 2 });
        }
      }
      ctx.restore();

      if (fp >= 0.8) {
        const needsPlayerTarget = opt.category === 'stat_boost' || opt.category === 'trait_forge';
        const btnTxt = opt.category === 'gamble' ? '点击卡牌开奖博弈 ▶' : needsPlayerTarget ? '点击选择并指定球员 ▶' : '点击卡牌收入囊中 ▶';
        drawRoundRect(
          ctx,
          cx + 20,
          cy + ch - 46,
          cw - 40,
          30,
          8,
          hovered ? THEME.VERMILION : THEME.BG_DEEP,
          THEME.INK_LINE,
          2
        );
        drawText(ctx, btnTxt, cx + cw / 2, cy + ch - 31, {
          size: 12.5,
          bold: true,
          color: hovered ? THEME.PAPER_CREAM : THEME.LIME,
          align: 'center',
        });
        hits.add(cx, cy, cw, ch, () => {
          this.lastPickedOptionId = opt.id;
          const res = league.applyPostMatchRewardOption(opt.id);
          if (!res.needsTarget) {
            if (res.gambleTier === 'jackpot') {
              SoundEngine.playBreakthrough();
              this.fx.onBurst?.(targetX + cw / 2, targetY + ch / 2, THEME.GOLD_LIGHT);
              this.fx.onShake?.(6, 0.2);
            } else if (res.gambleTier === 'negative') {
              SoundEngine.playClick();
              this.fx.onBurst?.(targetX + cw / 2, targetY + ch / 2, THEME.RED_LIGHT);
              this.fx.onShake?.(4, 0.14);
            } else {
              SoundEngine.playRewardChime();
              this.fx.onBurst?.(targetX + cw / 2, targetY + ch / 2, THEME.GREEN);
            }
          } else {
            SoundEngine.playClick();
          }
          onSave();
        });
      }
    });
  }

  private renderReDraftWizard(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    onContinue: () => void,
    onSave: () => void
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const rd = st.reDraft!;

    drawPrintCard(ctx, 16, 14, 1248, 56, { paper: false, radius: 10, shadowOffset: 3, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawButton(ctx, hits, 28, 24, 104, 36, '← 看战报', () => {
      this.viewMode = 'recap';
    }, { variant: 'ghost', fontSize: 12 });

    const step1Done = rd.perkChosen;
    drawBadge(ctx, 154, 29, 178, 26, '第1步：选战术词条', step1Done ? THEME.BG_PITCH_ALT : THEME.BG_DEEP, step1Done ? THEME.LIME : THEME.GOLD_LIGHT);
    drawText(ctx, '→', 346, 42, { size: 16, color: THEME.TX3, align: 'center' });
    drawBadge(ctx, 362, 29, 210, 26, `第2步：新援替换 (${rd.swapsUsed}/${rd.maxSwaps})`, step1Done ? THEME.BG_DEEP : THEME.BG_CARD_DARK, step1Done ? THEME.GOLD_LIGHT : THEME.TX3);

    drawButton(
      ctx,
      hits,
      1034,
      24,
      216,
      36,
      step1Done ? '完成补强 · 下一轮 ▶' : '请先完成第 1 步选词条',
      () => {
        league.finishReDraft();
        onSave();
        onContinue();
      },
      { variant: 'gold', disabled: !step1Done }
    );

    if (!step1Done) {
      drawPrintCard(ctx, 16, 84, 1248, 620, { paper: false, radius: 12, shadowOffset: 4, strokeColor: THEME.INK_LINE, lineWidth: 2.2 });
      drawText(ctx, `第 ${rd.roundCompleted} 轮赛后强化：请先选择 1 张本赛季战术词条`, 640, 124, {
        size: 22,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
      drawText(ctx, '同系词条叠加 2 张可触发额外协同加成；选完词条后将进入第 2 步新援补强', 640, 156, {
        size: 13,
        color: THEME.TX2,
        align: 'center',
      });

      const count = rd.perkChoices.length;
      const cw = count >= 4 ? 276 : 360;
      const ch = 410;
      const gap = 24;
      const startX = (THEME.W - (count * cw + (count - 1) * gap)) / 2;

      rd.perkChoices.forEach((pk, i) => {
        const cx = startX + i * (cw + gap);
        const cy = 192;
        const hovered = hits.isHovered(cx, cy, cw, ch);
        const catColor =
          pk.category === 'attack' ? THEME.VERMILION : pk.category === 'defense' ? '#15803D' : THEME.COBALT;
        const catLabel =
          pk.category === 'attack' ? '进攻系' : pk.category === 'defense' ? '防守系' : '控制系';
        const catIcon: IconName =
          pk.category === 'attack' ? 'bolt' : pk.category === 'defense' ? 'shield' : 'sparkle';

        drawPrintCard(ctx, cx, cy, cw, ch, {
          paper: true,
          radius: 12,
          shadowOffset: hovered ? 8 : 5,
          topBandColor: catColor,
          strokeColor: hovered ? THEME.LIME : THEME.INK_LINE,
          lineWidth: hovered ? 3 : 2.5,
        });

        drawBadge(
          ctx,
          cx + 18,
          cy + 20,
          68,
          22,
          pk.rarity.toUpperCase(),
          pk.rarity === 'epic' ? THEME.VIOLET : pk.rarity === 'rare' ? THEME.COBALT : THEME.BG_DEEP,
          THEME.PAPER_CREAM
        );
        drawBadge(ctx, cx + 92, cy + 20, 64, 22, catLabel, THEME.PAPER_WARM, catColor);

        drawPrintCard(ctx, cx + cw / 2 - 42, cy + 68, 84, 84, {
          paper: false,
          radius: 12,
          shadowOffset: 3,
          strokeColor: THEME.INK_LINE,
          lineWidth: 2,
        });
        drawIcon(ctx, catIcon, cx + cw / 2, cy + 110, 38, catColor);

        drawText(ctx, pk.name, cx + 22, cy + 184, { size: 20, bold: true, color: THEME.PAPER_INK });
        drawWrappedText(ctx, pk.description, cx + 22, cy + 220, cw - 44, 22, {
          size: 14,
          color: THEME.PAPER_MUTED,
          maxLines: 4,
        });
        drawButton(ctx, hits, cx + 22, cy + ch - 64, cw - 44, 44, '选择此词条 ▶', () => {
          league.chooseReDraftPerk(pk.id);
          onSave();
        }, { variant: 'gold', fontSize: 14 });
      });
      return;
    }

    const sortedSquad = [...club.squad].sort((a, b) => a.ca - b.ca);
    const starterSet = new Set(club.starterIds);

    drawPrintCard(ctx, 16, 84, 1248, 44, { paper: false, radius: 8, shadowOffset: 3, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    const guideText = this.selectedCandidateId
      ? '已选中新援！请点击右侧任意一名我方球员将其替换入队（或点右侧一键替换最低分）'
      : this.selectedDropId
      ? '已选中待淘汰球员！现在点击左侧任意一名新援，即可完成替换'
      : `操作提示：点选左侧【新援】与右侧【待换下球员】（顺序任意，最多可换 ${rd.maxSwaps} 人，也可直接点右上角跳过）`;
    drawText(ctx, guideText, this.selectedCandidateId ? 540 : 640, 106, {
      size: 13,
      bold: true,
      color: (this.selectedCandidateId || this.selectedDropId) ? THEME.LIME : THEME.GOLD_LIGHT,
      align: 'center',
    });

    if (this.selectedCandidateId && rd.swapsUsed < rd.maxSwaps && sortedSquad.length > 0) {
      drawButton(ctx, hits, 1054, 91, 196, 30, '一键替换最低分球员 ▶', () => {
        league.swapPlayerInReDraft(sortedSquad[0].id, this.selectedCandidateId!);
        this.selectedDropId = null;
        this.selectedCandidateId = null;
        onSave();
      }, { variant: 'green', fontSize: 12 });
    }

    drawPrintCard(ctx, 16, 140, 616, 564, { paper: false, radius: 10, shadowOffset: 4, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawText(ctx, '高潜新援候选池 (点击选中)', 34, 166, { size: 15, bold: true, color: THEME.GOLD_LIGHT });

    rd.candidates.forEach((c, idx) => {
      const cy = 192 + idx * 82;
      const isSel = this.selectedCandidateId === c.id;
      const canClick = rd.swapsUsed < rd.maxSwaps;

      drawPrintCard(ctx, 32, cy, 584, 72, {
        paper: isSel,
        radius: 8,
        shadowOffset: isSel ? 4 : 2,
        strokeColor: isSel ? THEME.LIME : THEME.INK_LINE,
        lineWidth: isSel ? 2.5 : 1.5,
      });

      drawPlayerAvatar(ctx, 40, cy + 6, 48, 60, c, club, { radius: 6 });

      drawBadge(ctx, 98, cy + 12, 24, 18, c.tier, tierColor(c.tier));
      drawBadge(ctx, 128, cy + 12, 38, 18, c.role, THEME.BG_DEEP, THEME.TX1);
      drawText(ctx, fitText(ctx, c.name, 220, FONT.TITLE, true, true), 176, cy + 21, { token: 'TITLE', bold: true, color: isSel ? THEME.PAPER_INK : THEME.TX1 });
      drawText(ctx, `CA ${c.ca}`, 488, cy + 21, { token: 'TITLE', bold: true, color: isSel ? THEME.VERMILION : THEME.GOLD_LIGHT, align: 'right', mono: true });
      const traitStatsLine = `${c.traits?.[0] || '均衡'} · 速${c.attributes.pace} 射${c.attributes.shooting} 传${c.attributes.passing} 防${c.attributes.defending}`;
      drawText(
        ctx,
        fitText(ctx, traitStatsLine, 390, FONT.MICRO, false, true),
        98,
        cy + 48,
        { token: 'LABEL', color: isSel ? THEME.PAPER_MUTED : THEME.TX2 }
      );
      drawButton(ctx, hits, 496, cy + 24, 110, 24, '一键替最低分', () => {
        if (canClick && sortedSquad.length > 0) {
          league.swapPlayerInReDraft(sortedSquad[0].id, c.id);
          this.selectedDropId = null;
          this.selectedCandidateId = null;
          SoundEngine.playSub();
          onSave();
        }
      }, { variant: isSel ? 'gold' : 'ghost', disabled: !canClick || sortedSquad.length === 0, fontSize: 12 });

      if (canClick) {
        hits.add(32, cy, 460, 72, () => {
          if (this.selectedDropId) {
            league.swapPlayerInReDraft(this.selectedDropId, c.id);
            this.selectedDropId = null;
            this.selectedCandidateId = null;
            SoundEngine.playSub();
            onSave();
          } else {
            this.selectedCandidateId = isSel ? null : c.id;
          }
        });
      }
    });

    drawPrintCard(ctx, 648, 140, 616, 564, { paper: false, radius: 10, shadowOffset: 4, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawText(ctx, '我方当前阵容 (按评分从低到高排列，靠前建议替换)', 666, 166, {
      size: 14,
      bold: true,
      color: THEME.TX1,
    });

    const sqPageSize = 10;
    const sqPages = Math.max(1, Math.ceil(sortedSquad.length / sqPageSize));
    if (this.squadPage >= sqPages) this.squadPage = sqPages - 1;
    const visibleSquad = sortedSquad.slice(this.squadPage * sqPageSize, (this.squadPage + 1) * sqPageSize);
    visibleSquad.forEach((p, idx) => {
      const globalIdx = this.squadPage * sqPageSize + idx;
      const ry = 192 + idx * 44;
      const isSel = this.selectedDropId === p.id;
      const isSuggest = globalIdx < 3;
      const isStarter = starterSet.has(p.id);
      drawRoundRect(
        ctx,
        664,
        ry,
        584,
        40,
        5,
        isSel ? THEME.BG_PITCH_ALT : THEME.BG_CARD_DARK,
        isSel ? THEME.VERMILION : THEME.INK_LINE,
        isSel ? 2 : 1.4
      );
      if (isSuggest) {
        drawBadge(ctx, 670, ry + 10, 44, 20, '建议换', THEME.VERMILION, THEME.PAPER_CREAM);
      } else {
        drawBadge(ctx, 670, ry + 10, 44, 20, p.tier, tierColor(p.tier));
      }
      drawBadge(ctx, 718, ry + 10, 34, 20, isStarter ? '首发' : '替补', isStarter ? THEME.BG_PITCH_ALT : THEME.BG_DEEP, isStarter ? THEME.LIME : THEME.TX2);
      drawBadge(ctx, 756, ry + 10, 36, 20, p.role, THEME.BG_DEEP, THEME.TX1);
      drawText(ctx, fitText(ctx, p.name, 220, FONT.LABEL, true, true), 800, ry + 20, { token: 'LABEL', bold: true });
      drawStatBar(ctx, p.ca, 99, 1036, ry + 17, 46, 5, THEME.GOLD_LIGHT);
      drawText(ctx, `CA ${p.ca}`, 1140, ry + 20, { token: 'LABEL', bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      drawBadge(
        ctx,
        1154,
        ry + 10,
        84,
        20,
        this.selectedCandidateId ? '点击换下 ▶' : isSel ? '已选中' : '选为换下',
        this.selectedCandidateId ? THEME.BG_PITCH_ALT : isSel ? THEME.VERMILION : THEME.BG_DEEP,
        this.selectedCandidateId ? THEME.LIME : isSel ? THEME.PAPER_CREAM : THEME.TX2
      );

      if (rd.swapsUsed < rd.maxSwaps) {
        hits.addTouchTarget(664, ry, 584, 42, () => {
          if (this.selectedCandidateId) {
            league.swapPlayerInReDraft(p.id, this.selectedCandidateId);
            this.selectedDropId = null;
            this.selectedCandidateId = null;
            onSave();
          } else {
            this.selectedDropId = isSel ? null : p.id;
          }
        });
      }
    });
    if (sqPages > 1) {
      drawButton(ctx, hits, 664, 650, 96, 36, '◀ 上页', () => {
        this.squadPage = Math.max(0, this.squadPage - 1);
      }, { disabled: this.squadPage === 0, fontSize: 12 });
      drawText(ctx, `第 ${this.squadPage + 1} / ${sqPages} 页`, 956, 668, { size: 12.5, color: THEME.TX2, align: 'center' });
      drawButton(ctx, hits, 1152, 650, 96, 36, '下页 ▶', () => {
        this.squadPage = Math.min(sqPages - 1, this.squadPage + 1);
      }, { disabled: this.squadPage >= sqPages - 1, fontSize: 12 });
    }
  }
}
