/**
 * 页面 5：赛后结算战报 & 2步式 Re-Draft 补强向导
 * 第 1 屏：直观的赛后战报（胜平负横幅、队徽比分、关键统计、掉落战术元素与本轮赛果）
 * 第 2 屏（仅 R2/R4/R6）：2 步引导式 Re-Draft（Step1 词条三选一 -> Step2 双向点选新援替换）
 */

import { MatchState, PITCH } from '../../../engine/src/types';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { DraftPlayer } from '../../../core/src/types';
import { ArtAssetId, AssetLoader } from '../AssetLoader';
import { drawPlayerAvatar } from '../AvatarRenderer';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawFoilShimmer,
  drawRoundRect,
  drawText,
  drawWrappedText,
  HitRegistry,
  tierColor,
} from '../CanvasKit';
import { drawClubCrest } from '../ClubVisuals';
import { easeOutBack, easeOutCubic } from '../Motion';
import { drawRewardIllustration } from '../SceneArt';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';

export interface PostMatchFxCallbacks {
  onBurst?: (x: number, y: number, color?: string) => void;
  onShake?: (intensity: number, dur: number) => void;
  onInspectPlayer?: (p: DraftPlayer) => void;
}

export class PostMatchReDraftScreen {
  private lastMatch: MatchState | null = null;
  private viewMode: 'recap' | 'reward' | 'redraft' = 'recap';
  private recapTab: 'analytics' | 'results' = 'analytics';
  private selectedCandidateId: string | null = null;
  private selectedDropId: string | null = null;
  private statTargetPage = 0;
  private statTargetFilter: 'all' | 'starters' | 'bench' = 'all';

  // 抽卡开包与逐张翻牌动画状态
  private animClock = 0;
  private recapEnterTimer = 0;
  private catEnterTimer = 0;
  private packAnim: {
    active: boolean;
    cat: string;
    color: string;
    title: string;
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

    const hasPendingReward = !!(rw && !rw.completed);
    const nextActionLabel = hasPendingReward
      ? '领取赛后肉鸽奖励 (3选1) ▶'
      : rd
      ? '进入赛后补强 (2步) ▶'
      : '返回门户首页 ▶';
    const goNext = () => {
      if (hasPendingReward) {
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

    // 顶栏
    drawRoundRect(ctx, 16, 14, 1248, 56, 10, THEME.BG_PANEL, THEME.BORDER);
    drawText(ctx, '赛后战报与奖励结算', 34, 42, { size: 18, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, 1018, 24, 232, 36, nextActionLabel, goNext, { variant: 'gold' });

    const pHero = easeOutCubic(Math.min(1, Math.max(0.05, this.recapEnterTimer / 0.36)));
    ctx.save();
    ctx.globalAlpha = pHero;
    ctx.translate(0, (1 - pHero) * 14);

    // 1. 胜平负主视觉横幅
    if (m) {
      const userIsHome = m.homeName === club.name;
      const myScore = userIsHome ? m.homeScore : m.awayScore;
      const oppScore = userIsHome ? m.awayScore : m.homeScore;
      const resultTag = myScore > oppScore ? '比赛胜利' : myScore === oppScore ? '握手言和' : '遗憾惜败';
      const resultColor = myScore > oppScore ? THEME.GREEN : myScore === oppScore ? THEME.GOLD_LIGHT : THEME.RED_LIGHT;
      const homeClub = st.clubs.find(c => c.name === m.homeName) || club;
      const awayClub = st.clubs.find(c => c.name === m.awayName) || club;

      drawRoundRect(ctx, 16, 84, 760, 260, 12, THEME.BG_PANEL, myScore > oppScore ? THEME.GREEN : THEME.BORDER_GOLD, 1.5);
      drawBadge(ctx, 36, 104, 130, 26, resultTag, '#1E293B', resultColor);
      drawText(ctx, m.minute + "' 全场结束", 752, 117, { size: 13, color: THEME.TX2, align: 'right' });

      drawClubCrest(ctx, 176, 186, 30, homeClub);
      drawText(ctx, m.homeName + (homeClub.isUser ? ' (我)' : ''), 176, 236, {
        size: 18,
        bold: true,
        color: homeClub.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
        align: 'center',
      });

      drawRoundRect(ctx, 316, 152, 160, 68, 10, THEME.BG_CARD, THEME.GOLD);
      drawText(ctx, `${m.homeScore} : ${m.awayScore}`, 396, 186, {
        size: 32,
        bold: true,
        color: THEME.TX1,
        align: 'center',
        mono: true,
      });

      drawClubCrest(ctx, 616, 186, 30, awayClub);
      drawText(ctx, m.awayName + (awayClub.isUser ? ' (我)' : ''), 616, 236, {
        size: 18,
        bold: true,
        color: awayClub.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
        align: 'center',
      });

      // 关键比赛数据条
      const h = m.stats.home;
      const a = m.stats.away;
      const totPoss = h.possessionTicks + a.possessionTicks || 1;
      const hPoss = Math.round((h.possessionTicks / totPoss) * 100);
      drawRoundRect(ctx, 36, 268, 720, 56, 8, THEME.BG_CARD, THEME.BORDER);
      const reviewTxt = st.lastMatchReview;
      drawText(
        ctx,
        `控球 ${hPoss}% : ${100 - hPoss}%   |   射门 ${h.shots}(正${h.shotsOnTarget}) : ${a.shots}(正${a.shotsOnTarget})   |   xG ${h.xG.toFixed(2)} : ${a.xG.toFixed(2)}`,
        396,
        reviewTxt ? 284 : 296,
        { size: reviewTxt ? 12 : 13, bold: true, color: THEME.TX1, align: 'center' }
      );
      if (reviewTxt) {
        drawText(ctx, reviewTxt, 396, 307, {
          size: 11,
          color: '#7DD3FC',
          align: 'center',
        });
      }

      // 右上：本场收获与奖励插画
      drawChamferPanel(ctx, 792, 84, 472, 260, 12, THEME.BG_PANEL, THEME.BORDER_GOLD, 1.2, THEME.GOLD_LIGHT);
      drawText(ctx, '本场战利品与关键事件', 814, 110, { size: 15, bold: true, color: THEME.GOLD_LIGHT });

      const rwImg = AssetLoader.get(myScore > oppScore ? 'reward_win' : 'reward_draw');
      drawChamferPanel(ctx, 814, 130, 168, 96, 6, THEME.BG_CARD, THEME.BORDER);
      if (rwImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(816, 132, 164, 92);
        ctx.clip();
        ctx.drawImage(rwImg, 816, 132, 164, 92);
        ctx.restore();
      } else {
        drawRewardIllustration(ctx, myScore > oppScore, 816, 132, 164, 92);
      }

      const elemDrop = myScore > oppScore ? 2 : 1;
      drawRoundRect(ctx, 994, 130, 248, 96, 8, THEME.BG_CARD, THEME.BORDER_GOLD);
      drawFoilShimmer(ctx, 994, 130, 248, 96, this.animClock * 0.9, 'rgba(74, 222, 128, 0.22)');
      drawText(ctx, `获得战术元素 x ${elemDrop}`, 1010, 158, { size: 15, bold: true, color: THEME.GREEN });
      drawWrappedText(ctx, '可在门户“合成”中组合新的场外指挥卡', 1010, 178, 216, 16, { size: 11, color: THEME.TX2, maxLines: 2 });

      const goals = m.events.filter(e => e.type === 'goal').slice(0, 3);
      if (goals.length === 0) {
        drawText(ctx, '本场双方握手言和，未产生进球。', 814, 250, { size: 12, color: THEME.TX3 });
      } else {
        goals.forEach((g, gi) => {
          drawText(ctx, `[进球] ${g.minute}' ${g.playerName} (${g.team === 'home' ? m.homeName : m.awayName})`, 814, 244 + gi * 22, {
            size: 12,
            color: THEME.TX1,
          });
        });
      }

      if (m.unlockedHiddenTraits && m.unlockedHiddenTraits.length > 0) {
        const u = m.unlockedHiddenTraits[0];
        drawRoundRect(ctx, 812, 310, 430, 24, 6, 'rgba(12, 74, 110, 0.45)', '#38BDF8', 1);
        drawText(ctx, `隐藏特质觉醒：${u.playerName} 解锁【${u.trait}】`, 822, 322, {
          size: 11.5,
          bold: true,
          color: '#7DD3FC',
        });
      }
    }

    // 2. 下方：分时段攻防动量图 + 首发 11 人赛后评分与 MVP 关键贡献榜 | 本轮全部比赛结果
    drawRoundRect(ctx, 16, 360, 1248, 264, 10, THEME.BG_PANEL, THEME.BORDER);
    drawButton(ctx, hits, 36, 368, 198, 24, '攻防动量与球员评分', () => {
      this.recapTab = 'analytics';
    }, { active: this.recapTab === 'analytics', fontSize: 11 });
    drawButton(ctx, hits, 242, 368, 148, 24, '本轮全部赛果', () => {
      this.recapTab = 'results';
    }, { active: this.recapTab === 'results', fontSize: 11 });

    if (this.recapTab === 'analytics' && m) {
      // 左半区：分时段攻防动量图 (Match Momentum · 5分钟一档 0'~90')
      const smX = 36, smY = 414, smW = 574, smH = 194;
      drawRoundRect(ctx, smX, smY, smW, smH, 8, THEME.BG_CARD, THEME.BORDER);

      const momBuckets = new Array(18).fill(0);
      const momGoalBuckets: Array<{ bucket: number; team: 'home' | 'away'; minute: number }> = [];
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
      }
      const maxMom = Math.max(4.5, ...momBuckets.map(v => Math.abs(v)));
      const mPadL = 34, mPadR = 14, mPadT = 22, mPadB = 22;
      const mPlotW = smW - mPadL - mPadR;
      const mPlotH = smH - mPadT - mPadB;
      const midY = smY + mPadT + mPlotH / 2;
      const halfH = mPlotH / 2 - 4;

      // 网格与中线
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(smX + mPadL, midY);
      ctx.lineTo(smX + mPadL + mPlotW, midY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.setLineDash([3, 3]);
      [midY - halfH * 0.6, midY + halfH * 0.6].forEach(gy => {
        ctx.beginPath();
        ctx.moveTo(smX + mPadL, gy);
        ctx.lineTo(smX + mPadL + mPlotW, gy);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 主/客队标签
      drawText(ctx, m.homeName.slice(0, 4), smX + 6, smY + mPadT + 10, { size: 9, bold: true, color: '#F87171' });
      drawText(ctx, m.awayName.slice(0, 4), smX + 6, smY + smH - mPadB - 10, { size: 9, bold: true, color: '#60A5FA' });

      const momBarProg = easeOutCubic(Math.min(1, Math.max(0.08, this.recapEnterTimer / 0.62)));
      const slotW = mPlotW / 18;
      const barW = Math.max(10, slotW - 6);
      const userIsHomeSide = m.homeName === club.name;
      for (let bi = 0; bi < 18; bi++) {
        const val = momBuckets[bi];
        const ratio = Math.min(1, Math.abs(val) / maxMom);
        const bh = Math.max(3, ratio * halfH * momBarProg);
        const bx = smX + mPadL + bi * slotW + (slotW - barW) / 2;
        if (val >= 0) {
          const col = userIsHomeSide ? '#FB923C' : '#F87171';
          drawRoundRect(ctx, bx, midY - bh, barW, bh, 3, col);
        } else {
          const col = !userIsHomeSide ? '#38BDF8' : '#60A5FA';
          drawRoundRect(ctx, bx, midY, barW, bh, 3, col);
        }
      }
      // 进球标记
      for (const gb of momGoalBuckets) {
        const gx = smX + mPadL + (gb.bucket + 0.5) * slotW;
        const gy = gb.team === 'home' ? smY + mPadT + 8 : smY + smH - mPadB - 8;
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(gx, gy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        drawText(ctx, `${gb.minute}'`, gx, gy + (gb.team === 'home' ? -9 : 9), {
          size: 8.5,
          bold: true,
          color: '#FACC15',
          align: 'center',
          mono: true,
        });
      }
      [0, 15, 30, 45, 60, 75, 90].forEach(min => {
        const gx = smX + mPadL + (min / 90) * mPlotW;
        drawText(ctx, min === 45 ? 'HT' : `${min}'`, gx, smY + smH - 10, {
          size: 9,
          color: min === 45 ? THEME.GOLD_LIGHT : THEME.TX3,
          align: 'center',
          mono: true,
        });
      });

      drawText(ctx, `分时段攻防动量图 (0'~90') · ${m.homeName} (上) vs ${m.awayName} (下) · 金点=进球`, smX + smW / 2, smY - 11, {
        size: 11,
        color: THEME.TX2,
        align: 'center',
      });

      // 右半区：首发 11 人赛后评分与 MVP 关键贡献榜（联动球员默契/隐藏特质与本场成长）
      const xgX = 638, xgY = 414, xgW = 606, xgH = 194;
      drawRoundRect(ctx, xgX, xgY, xgW, xgH, 8, THEME.BG_CARD, THEME.BORDER);

      const userSide = m.homeName === club.name ? 'home' : 'away';
      const myScoreVal = userSide === 'home' ? m.homeScore : m.awayScore;
      const oppScoreVal = userSide === 'home' ? m.awayScore : m.homeScore;
      const teamBonus = myScoreVal > oppScoreVal ? 0.4 : myScoreVal === oppScoreVal ? 0.1 : -0.1;
      const growthMap = league.getLastMatchGrowth();
      const userSquadMap = new Map(club.squad.map(sp => [sp.id, sp]));

      const starters = m.players
        .filter(p => p.team === userSide && !p.subbedIn)
        .slice(0, 11);
      const rated = starters.map(p => {
        const ms = p.matchStats;
        const g = growthMap[p.id];
        const dp = userSquadMap.get(p.id);
        const passAcc = ms.passes >= 6 ? ms.passesSuccess / ms.passes : 0.7;
        const chemBonus = g ? Math.min(0.45, g.chemGain * 0.025) : 0;
        const traitBonus = g?.unlockedTrait ? 0.55 : (dp?.traits?.length || p.traits?.length) ? 0.15 : 0;
        const raw =
          5.7 +
          teamBonus +
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

        const statParts: string[] = [];
        if (ms.goals > 0) statParts.push(`${ms.goals}球`);
        if (ms.assists > 0) statParts.push(`${ms.assists}助`);
        if (p.role === 'GK') {
          statParts.push(`扑${ms.saves}`);
          statParts.push(`传${ms.passesSuccess}`);
        } else {
          statParts.push(`传${ms.passesSuccess}`);
          if (ms.tackles + ms.interceptions > 0) statParts.push(`断${ms.tackles + ms.interceptions}`);
          else if (ms.shots > 0) statParts.push(`射${ms.shots}`);
        }

        const gainParts: string[] = [];
        if (g?.unlockedTrait) {
          gainParts.push(`觉醒【${g.unlockedTrait}】`);
        } else {
          if (g && g.famGain > 0) gainParts.push(`熟+${g.famGain}`);
          if (g && g.chemGain > 0) gainParts.push(`默+${g.chemGain.toFixed(1)}`);
        }
        const keyTrait = g?.unlockedTrait
          ? undefined
          : (p.goldTraits?.[0] || p.traits?.[0] || dp?.traits?.[0]);

        return {
          player: p,
          rating,
          statsText: statParts.slice(0, 3).join(' '),
          gainText: gainParts.join(' '),
          keyTrait,
          isUnlocked: !!g?.unlockedTrait,
          bestPartner: g?.bestPartner,
        };
      }).sort((a, b) => b.rating - a.rating);

      const avgRating = rated.length > 0
        ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1)
        : '6.5';
      const totalChemGain = rated.reduce((s, r) => s + (growthMap[r.player.id]?.chemGain ?? 0), 0);

      rated.forEach((item, idx) => {
        const col = idx < 6 ? 0 : 1;
        const row = idx < 6 ? idx : idx - 6;
        const rx = xgX + 6 + col * 300;
        const ry = xgY + 4 + row * 32;
        const rw = 294;
        const rh = 29;
        const isMvp = idx === 0;
        const rColor = item.rating >= 8.0 ? THEME.GREEN : item.rating >= 7.0 ? THEME.GOLD_LIGHT : THEME.TX1;

        drawRoundRect(
          ctx,
          rx,
          ry,
          rw,
          rh,
          5,
          isMvp ? 'rgba(120, 53, 15, 0.34)' : 'rgba(11, 17, 30, 0.78)',
          isMvp ? THEME.GOLD_LIGHT : item.isUnlocked ? '#38BDF8' : 'rgba(148, 163, 184, 0.16)',
          isMvp || item.isUnlocked ? 1.2 : 0.8
        );

        if (isMvp) {
          drawBadge(ctx, rx + 4, ry + 5, 30, 18, 'MVP', '#78350F', THEME.GOLD_LIGHT);
        } else {
          drawText(ctx, `${idx + 1}`, rx + 13, ry + 14, { size: 9.5, bold: true, color: THEME.TX3, align: 'center', mono: true });
        }
        const nameX = isMvp ? rx + 38 : rx + 24;
        drawBadge(ctx, nameX, ry + 6, 28, 16, item.player.role, '#1E293B', THEME.TX2);
        drawText(ctx, item.player.name.slice(0, 5), nameX + 32, ry + 10, {
          size: 10.5,
          bold: true,
          color: isMvp ? THEME.GOLD_LIGHT : THEME.TX1,
        });

        drawText(ctx, item.statsText, nameX + 32, ry + 22, { size: 8.8, color: THEME.TX2 });
        if (item.gainText) {
          drawText(ctx, item.gainText, rx + rw - 42, ry + 22, {
            size: 8.8,
            bold: item.isUnlocked,
            color: item.isUnlocked ? '#38BDF8' : THEME.GREEN,
            align: 'right',
          });
        }
        if (item.keyTrait) {
          drawText(ctx, `[${item.keyTrait.slice(0, 4)}]`, rx + rw - 42, ry + 10, {
            size: 8.5,
            color: '#C4B5FD',
            align: 'right',
          });
        } else if (item.bestPartner && isMvp) {
          drawText(ctx, `连线:${item.bestPartner.slice(0, 3)}`, rx + rw - 42, ry + 10, {
            size: 8.5,
            color: THEME.GOLD_LIGHT,
            align: 'right',
          });
        }

        drawRoundRect(ctx, rx + rw - 36, ry + 4, 32, 21, 4, '#0F172A', rColor, 1);
        drawText(ctx, item.rating.toFixed(1), rx + rw - 20, ry + 15, {
          size: 10.5,
          bold: true,
          color: rColor,
          align: 'center',
          mono: true,
        });
      });

      const sumX = xgX + 306;
      const sumY = xgY + 4 + 5 * 32;
      drawRoundRect(ctx, sumX, sumY, 294, 29, 5, 'rgba(30, 58, 95, 0.35)', THEME.BORDER_GOLD, 0.9);
      drawText(ctx, `首发均分 ${avgRating} · 默契总升温 +${totalChemGain.toFixed(0)}`, sumX + 147, sumY + 15, {
        size: 10,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });

      drawText(
        ctx,
        '首发 11 人赛后评分与 MVP 贡献榜 · 联动默契/隐藏特质与本场提升',
        xgX + xgW / 2,
        xgY - 11,
        { size: 11, color: THEME.GOLD_LIGHT, align: 'center' }
      );
    } else {
      const targetRound = rd ? rd.roundCompleted : st.currentRound - 1;
      const fixtures = st.fixtures.filter(f => f.round === targetRound && f.played);
      fixtures.slice(0, 4).forEach((fx, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = 36 + col * 612;
        const by = 414 + row * 94;
        const h = st.clubs.find(c => c.id === fx.homeClubId)!;
        const a = st.clubs.find(c => c.id === fx.awayClubId)!;
        const hasUser = h.isUser || a.isUser;
        drawRoundRect(ctx, bx, by, 592, 78, 8, THEME.BG_CARD, hasUser ? THEME.GOLD : THEME.BORDER, hasUser ? 1.5 : 1);
        drawText(ctx, h.name, bx + 220, by + 39, { size: 15, bold: h.isUser, align: 'right', color: h.isUser ? THEME.GOLD_LIGHT : THEME.TX1 });
        drawText(ctx, `${fx.homeGoals} : ${fx.awayGoals}`, bx + 296, by + 39, { size: 20, bold: true, align: 'center', mono: true, color: THEME.GOLD_LIGHT });
        drawText(ctx, a.name, bx + 372, by + 39, { size: 15, bold: a.isUser, align: 'left', color: a.isUser ? THEME.GOLD_LIGHT : THEME.TX1 });
      });
    }
    ctx.restore();

    // 底部醒目主行动按钮
    drawButton(
      ctx,
      hits,
      440,
      642,
      400,
      54,
      hasPendingReward
        ? '下一步：领取赛后肉鸽奖励 (3选1) ▶'
        : rd
        ? '下一步：赛后补强 (领词条 & 换新援) ▶'
        : '继续下一轮 · 返回门户首页 ▶',
      goNext,
      { variant: 'gold', fontSize: 16 }
    );
    if (hasPendingReward || rd) {
      drawFoilShimmer(ctx, 440, 642, 400, 54, this.animClock * 1.15, 'rgba(254, 240, 138, 0.30)');
    }
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
    drawRoundRect(ctx, 16, 14, 1248, 56, 10, THEME.BG_PANEL, THEME.BORDER);
    drawButton(ctx, hits, 28, 24, 104, 36, '← 看战报', () => {
      this.viewMode = 'recap';
    }, { variant: 'ghost', fontSize: 12 });

    const step1Done = !!rw.chosenCategory;
    const step2Done = rw.completed;
    drawBadge(ctx, 156, 29, 196, 26, '第1步：选战术盲盒 (3选1)', step1Done ? '#14532D' : '#1E3A5F', step1Done ? THEME.GREEN : THEME.GOLD_LIGHT);
    drawText(ctx, '→', 366, 42, { size: 16, color: THEME.TX3, align: 'center' });
    drawBadge(
      ctx,
      382,
      29,
      210,
      26,
      rw.pendingStatOptionId ? '第2步：指定受训球员' : '第2步：开包翻牌领奖',
      step2Done ? '#14532D' : step1Done ? '#1E3A5F' : '#111827',
      step2Done ? THEME.GREEN : step1Done ? THEME.GOLD_LIGHT : THEME.TX3
    );

    const cadence = rw.cadence ?? 'normal';
    const cadBadgeText = cadence === 'crisis' ? '连败救火轮' : cadence === 'focus' ? '焦点强强轮' : '常规赛后轮';
    const cadBadgeBg = cadence === 'crisis' ? '#7F1D1D' : cadence === 'focus' ? '#78350F' : '#1E293B';
    const cadBadgeCol = cadence === 'crisis' ? THEME.RED_LIGHT : cadence === 'focus' ? THEME.GOLD_LIGHT : '#94A3B8';
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

    const CAT_META: Record<string, { title: string; badge: string; desc: string; color: string; elemKey: 'elem_press' | 'elem_pass' | 'elem_wing' | 'elem_iron' | 'elem_blitz' }> = {
      player: {
        title: '新援盲盒 · 招募球员',
        badge: '3选1入队',
        desc: '球探盲盒 3 选 1 立即入队',
        color: '#38BDF8',
        elemKey: 'elem_wing',
      },
      stat_boost: {
        title: '单体特训包 · 王牌精修',
        badge: '永久属性 +2~+4',
        desc: '指定 1 名球员永久提升属性',
        color: THEME.GOLD_LIGHT,
        elemKey: 'elem_blitz',
      },
      line_boost: {
        title: '位置共振包 · 整线强化',
        badge: '全线协同增益',
        desc: '门/防/中/锋整条线全员强化',
        color: THEME.GREEN,
        elemKey: 'elem_iron',
      },
      craft_card: {
        title: '战术合成包 · 教练手牌',
        badge: '指挥卡 / 升阶',
        desc: '获得高阶指挥卡或手牌升阶',
        color: '#C084FC',
        elemKey: 'elem_pass',
      },
      event: {
        title: '更衣室奇遇 · 随机事件',
        badge: '恢复 / 默契 / 特质',
        desc: '回满体能、涨默契或觉醒特质',
        color: '#FB923C',
        elemKey: 'elem_press',
      },
      trait_forge: {
        title: '临时徽章 · 临场觉醒',
        badge: '3~5轮 / 兼职',
        desc: '赐予临时金/银标或解锁兼职位置',
        color: '#F472B6',
        elemKey: 'elem_blitz',
      },
      tactical_pact: {
        title: '更衣室契约 · 双刃剑',
        badge: '高风险高回报',
        desc: '以体能换战力暴涨或 Meta 点数',
        color: '#F87171',
        elemKey: 'elem_press',
      },
      chemistry_forge: {
        title: '化学连线 · 宗师蜕变',
        badge: '黄金连线 / 超频',
        desc: '铸造黄金连线或高费手牌降费',
        color: '#2DD4BF',
        elemKey: 'elem_pass',
      },
      gamble: {
        title: '风险博弈 · 三态对赌',
        badge: '绿正 / 红负 / 金暴击',
        desc: '按当前联赛等级定制的风险事件：x%常规正收益、y%负面代价、z%超额暴击',
        color: '#FACC15',
        elemKey: 'elem_blitz',
      },
      season_perk: {
        title: '赛季战术词条 · 永久强化',
        badge: '里程碑必出 · 3/4选1',
        desc: '从 3~4 张赛季级战术词条中任选 1 张永久激活，同系叠加 2 张触发共振',
        color: '#F59E0B',
        elemKey: 'elem_blitz',
      },
    };

    const cardBackArt = AssetLoader.get('command_card_back');
    const getPackArtId = (cat: string): ArtAssetId => {
      if (cat === 'player') return 'pack_recruit';
      if (cat === 'season_perk' || cat === 'trait_forge' || cat === 'tactical_pact' || cat === 'gamble' || cat === 'event') {
        return 'pack_perk';
      }
      return 'pack_tactics';
    };

    // 开包撕裂过场动画（0 -> 0.56s）
    if (this.packAnim?.active) {
      const pa = this.packAnim;
      const t = pa.timer;
      const animPackId = getPackArtId(pa.cat);
      const animPackImg = AssetLoader.get(animPackId);
      const burstFxImg = AssetLoader.get('pack_burst_fx');
      ctx.save();
      ctx.fillStyle = 'rgba(4, 7, 14, 0.78)';
      ctx.fillRect(0, 70, THEME.W, THEME.H - 70);

      if (t < 0.36) {
        const moveP = easeOutCubic(Math.min(1, t / 0.24));
        const px = pa.startX + (640 - pa.startX) * moveP;
        const py = 354 + (340 - 354) * moveP;
        const shakeAmp = t > 0.14 ? (t - 0.14) * 32 : 0;
        const jx = (Math.random() * 2 - 1) * shakeAmp;
        const jy = (Math.random() * 2 - 1) * shakeAmp;
        const scale = 1 + 0.24 * moveP;

        // 聚光光晕
        const radGrad = ctx.createRadialGradient(px + jx, py + jy, 18, px + jx, py + jy, 260);
        radGrad.addColorStop(0, pa.color + 'AA');
        radGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(px + jx, py + jy, 260, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(px + jx, py + jy);
        ctx.scale(scale, scale);
        if (animPackImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          if (animPackId === 'pack_perk') ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(animPackImg, -124, -166, 248, 332);
          ctx.restore();
        } else {
          drawChamferPanel(ctx, -155, -195, 310, 390, 14, '#0F172A', pa.color, 2.6, pa.color);
          if (cardBackArt && typeof ctx.drawImage === 'function') {
            ctx.save();
            ctx.globalAlpha = 0.42;
            ctx.drawImage(cardBackArt, -150, -190, 300, 380);
            ctx.restore();
          }
        }
        drawText(ctx, pa.title, 0, 184, { size: 17, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
        drawText(ctx, '正在开启战利品卡包...', 0, 210, { size: 12.5, color: pa.color, align: 'center' });

        // 中心撕裂光束
        if (t > 0.16) {
          const beamP = (t - 0.16) / 0.20;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3 + beamP * 10;
          ctx.shadowColor = pa.color;
          ctx.shadowBlur = 24;
          ctx.beginPath();
          ctx.moveTo(0, -185);
          ctx.lineTo(0, 185);
          ctx.stroke();
        }
      } else {
        const postP = (t - 0.36) / 0.20;
        const flashP = Math.max(0, 1 - postP);
        if (burstFxImg && typeof ctx.drawImage === 'function') {
          const bScale = 0.65 + postP * 1.15;
          const bw = 760 * bScale;
          const bh = 425 * bScale;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = Math.min(1, flashP * 1.25);
          ctx.drawImage(burstFxImg, 640 - bw / 2, 340 - bh / 2, bw, bh);
          ctx.restore();
        }
        ctx.fillStyle = `rgba(255, 250, 220, ${Math.max(0, flashP * 0.48)})`;
        ctx.fillRect(0, 70, THEME.W, THEME.H - 70);
      }
      ctx.restore();
      return;
    }

    // 状态 A：第一步 3 选 1 门类盲盒卡包
    if (!rw.chosenCategory) {
      drawText(ctx, '选择 1 个赛后战术盲盒开启（3选1 · 开启后逐张翻牌揭示奖励）', 640, 118, {
        size: 17,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
      rw.categories.forEach((cat, idx) => {
        const meta = CAT_META[cat];
        const enterP = easeOutBack(Math.max(0, Math.min(1, (this.catEnterTimer - idx * 0.08) / 0.38)));
        const floatY = Math.sin(this.animClock * 2.2 + idx * 1.4) * 4;
        const cx = 86 + idx * 384;
        const cy = 166 + (1 - enterP) * 60 + floatY;
        const cw = 340;
        const ch = 390;
        const hovered = hits.isHovered(cx, cy, cw, ch);
        const packId = getPackArtId(cat);
        const packImg = AssetLoader.get(packId);

        ctx.save();
        ctx.globalAlpha = Math.max(0.05, enterP);
        if (hovered) {
          ctx.shadowColor = meta.color;
          ctx.shadowBlur = 22;
        }
        drawChamferPanel(
          ctx,
          cx,
          cy,
          cw,
          ch,
          14,
          hovered ? '#152340' : THEME.BG_PANEL,
          hovered ? meta.color : THEME.BORDER_GOLD,
          hovered ? 2.4 : 1.5,
          meta.color
        );
        drawFoilShimmer(ctx, cx, cy, cw, ch, this.animClock * 0.9 + idx * 0.4, meta.color + '26');

        drawBadge(ctx, cx + 18, cy + 16, 144, 22, meta.badge, '#1E293B', meta.color);
        const elemImg = AssetLoader.get(meta.elemKey);
        if (elemImg && typeof ctx.drawImage === 'function') {
          ctx.drawImage(elemImg, cx + cw - 40, cy + 15, 22, 22);
        }

        if (packImg && typeof ctx.drawImage === 'function') {
          const pScale = hovered ? 1.05 : 1.0;
          const pw = Math.round(148 * pScale);
          const ph = Math.round(198 * pScale);
          const px = Math.round(cx + cw / 2 - pw / 2);
          const py = Math.round(cy + 44 - (ph - 198) / 2);
          const glow = ctx.createRadialGradient(cx + cw / 2, py + ph / 2, 10, cx + cw / 2, py + ph / 2, 110);
          glow.addColorStop(0, meta.color + (hovered ? '55' : '33'));
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(cx + cw / 2, py + ph / 2, 110, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          if (packId === 'pack_perk') ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(packImg, px, py, pw, ph);
          ctx.restore();
        } else if (elemImg && typeof ctx.drawImage === 'function') {
          drawRoundRect(ctx, cx + cw / 2 - 42, cy + 84, 84, 84, 16, 'rgba(10,16,30,0.85)', meta.color, 1.5);
          ctx.drawImage(elemImg, cx + cw / 2 - 28, cy + 98, 56, 56);
        }

        drawText(ctx, meta.title, cx + cw / 2, cy + 258, { size: 17, bold: true, color: THEME.TX1, align: 'center' });
        drawWrappedText(ctx, meta.desc, cx + 22, cy + 278, cw - 44, 16, { size: 11.5, color: THEME.TX2, maxLines: 2 });
        ctx.restore();

        const pickPack = () => {
          SoundEngine.playPackRip();
          this.resetCardRevealAnim();
          this.packAnim = {
            active: true,
            cat,
            color: meta.color,
            title: meta.title,
            startX: cx + cw / 2,
            timer: 0,
            bursted: false,
          };
          league.pickPostMatchRewardCategory(cat);
          onSave();
        };
        drawButton(ctx, hits, cx + 22, cy + ch - 56, cw - 44, 40, '撕开此盲盒', pickPack, { variant: 'gold', fontSize: 13.5, icon: 'sparkle' });
        hits.add(cx, cy, cw, ch, pickPack);
      });
      return;
    }

    // 状态 B：单体特训卡 / 特质移植待指定受训球员（统一球员卡片网格 + 推荐人选一键应用）
    if (rw.pendingStatOptionId && !rw.completed) {
      const opt = rw.options.find(o => o.id === rw.pendingStatOptionId);
      const isTraitForge = opt?.category === 'trait_forge';
      const starterSet = new Set(club.starterIds);
      const attrKey = opt?.statBoost?.attr ?? 'shooting';

      // 计算系统推荐的最佳匹配人选
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

      // 顶部标题、筛选与一键应用推荐栏
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
        }, { active: this.statTargetFilter === fk, fontSize: 11 });
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
          { variant: 'gold', fontSize: 11.5, icon: 'sparkle' }
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

      const pageSize = 12; // 4列 × 3行
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

        drawChamferPanel(
          ctx,
          cx,
          cy,
          cw,
          ch,
          8,
          isRec ? 'rgba(42, 30, 12, 0.94)' : hovered ? '#162544' : THEME.BG_CARD,
          isRec ? THEME.GOLD_LIGHT : hovered ? '#38BDF8' : THEME.BORDER,
          isRec || hovered ? 1.5 : 1
        );

        // 头部：位置 + 首发/替补 + 推荐 + 号码姓名 + CA/PA
        drawBadge(ctx, cx + 8, cy + 7, 34, 17, p.role, tierColor(p.tier));
        drawBadge(ctx, cx + 45, cy + 7, 32, 17, isStarter ? '首发' : '替补', isStarter ? '#14532D' : '#1E293B', isStarter ? THEME.GREEN : THEME.TX3);
        if (isRec) {
          drawBadge(ctx, cx + 80, cy + 7, 32, 17, '推荐', '#78350F', THEME.GOLD_LIGHT);
        }
        drawText(ctx, `CA ${p.ca}/${p.pa ?? p.ca}`, cx + cw - 8, cy + 15, {
          size: 11,
          bold: true,
          color: THEME.GOLD_LIGHT,
          align: 'right',
          mono: true,
        });

        // 头像 + 完整信息
        drawPlayerAvatar(ctx, cx + 10, cy + 32, 44, 54, p, club, { radius: 6 });
        const shirtTxt = p.shirtNumber ? `#${p.shirtNumber} ` : '';
        drawText(ctx, `${shirtTxt}${p.name.slice(0, 6)}`, cx + 62, cy + 39, { size: 12.5, bold: true, color: THEME.TX1 });
        drawText(ctx, `${p.age}岁 · 兼:${p.secondaryRoles?.join('/') || '专职'}`, cx + 62, cy + 56, { size: 10, color: THEME.TX2 });

        const a = p.attributes;
        const attrSummary = p.role === 'GK'
          ? `扑${a.goalkeeping} 站${a.positioning} 冷${a.composure} 传${a.passing}`
          : `速${a.pace} 射${a.shooting} 传${a.passing} 防${a.defending}`;
        drawText(ctx, attrSummary, cx + 62, cy + 72, { size: 10, color: '#94A3B8', mono: true });

        // 目标强化项 & 特质摘要
        if (isTraitForge) {
          const gCnt = p.goldTraits?.length ?? 0;
          const sList = p.silverTraits?.slice(0, 2).join('/') || p.trait || '无';
          drawText(ctx, `金标:${gCnt} · 银标:${sList}`, cx + 10, cy + 98, { size: 10.5, color: '#F472B6' });
        } else {
          drawText(ctx, `当前 ${opt?.statBoost?.attrLabel || '属性'}: ${p.attributes[attrKey]}`, cx + 10, cy + 98, {
            size: 11,
            bold: true,
            color: '#38BDF8',
            mono: true,
          });
        }

        // 底部按钮：详情 + 应用
        drawButton(ctx, hits, cx + 10, cy + ch - 34, 68, 26, '详情', () => {
          this.fx.onInspectPlayer?.(p);
        }, { variant: 'ghost', fontSize: 10.5 });
        drawButton(ctx, hits, cx + 84, cy + ch - 34, cw - 94, 26, isTraitForge ? '移植改造' : '特训此人', () => {
          league.applyPostMatchRewardOption(rw.pendingStatOptionId!, p.id);
          SoundEngine.playRewardChime();
          this.fx.onBurst?.(cx + cw / 2, cy + ch / 2, isTraitForge ? '#F472B6' : THEME.GOLD_LIGHT);
          onSave();
        }, { variant: isRec ? 'gold' : 'primary', fontSize: 11 });
      });

      if (totalPages > 1) {
        drawButton(ctx, hits, 440, 622, 110, 32, '上一页', () => {
          this.statTargetPage = Math.max(0, this.statTargetPage - 1);
        }, { disabled: this.statTargetPage === 0, fontSize: 11.5 });
        drawText(ctx, `第 ${this.statTargetPage + 1} / ${totalPages} 页`, 640, 638, { size: 12, color: THEME.TX2, align: 'center' });
        drawButton(ctx, hits, 730, 622, 110, 32, '下一页', () => {
          this.statTargetPage = Math.min(totalPages - 1, this.statTargetPage + 1);
        }, { disabled: this.statTargetPage >= totalPages - 1, fontSize: 11.5 });
      }
      return;
    }

    // 状态 C：第二步 展开 3 个具体选项（或展示已完成结果）
    if (rw.completed) {
      const rolledOpt = rw.options.find(o => o.gamble?.rolledTier);
      const rolledTier = rolledOpt?.gamble?.rolledTier;
      const resCol = rolledTier === 'jackpot' ? THEME.GOLD_LIGHT : rolledTier === 'negative' ? THEME.RED_LIGHT : THEME.GREEN;
      const resBadgeBg = rolledTier === 'jackpot' ? '#78350F' : rolledTier === 'negative' ? '#7F1D1D' : '#14532D';
      const resBadgeTxt = rolledTier === 'jackpot' ? '超额暴击！' : rolledTier === 'negative' ? '触发代价' : rolledTier === 'positive' ? '稳健收益' : '赛后奖励已领取';
      drawChamferPanel(ctx, 240, 196, 800, 290, 14, THEME.BG_PANEL, resCol, 2, resCol);
      drawFoilShimmer(ctx, 240, 196, 800, 290, this.animClock * 1.1, resCol + '33');
      drawBadge(ctx, 560, 224, 160, 28, resBadgeTxt, resBadgeBg, resCol);
      drawWrappedText(ctx, rw.summaryText || '奖励已生效', 290, 286, 700, 28, {
        size: 19,
        bold: true,
        color: rolledTier === 'negative' ? '#FCA5A5' : THEME.GOLD_LIGHT,
        maxLines: 3,
      });
      drawButton(
        ctx,
        hits,
        440,
        384,
        400,
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

    const catInfo = CAT_META[rw.chosenCategory];
    drawText(ctx, `${catInfo.title} — 逐张翻牌揭示，选择 1 项战利品`, 640, 118, {
      size: 16,
      bold: true,
      color: catInfo.color,
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

      // 发牌飞入插值 (0 -> 0.36s)
      const dealP = easeOutBack(Math.max(0, Math.min(1, (this.dealTimer - idx * 0.05) / 0.34)));
      const cx = 640 - cw / 2 + (targetX - (640 - cw / 2)) * dealP;
      const cy = 340 - ch / 2 + (targetY - (340 - ch / 2)) * dealP;

      const rCol = opt.rarity === 'epic' ? THEME.GOLD_LIGHT : opt.rarity === 'rare' ? '#38BDF8' : '#94A3B8';
      const rLabel = opt.rarity === 'epic' ? '稀有 · EPIC' : opt.rarity === 'rare' ? '精良 · RARE' : '常规 · COMMON';

      // 3D 翻牌进度
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
          this.fx.onBurst?.(targetX + cw / 2, targetY + ch / 2, '#38BDF8');
        }
      }

      const hovered = showFront && fp >= 0.9 && hits.isHovered(cx, cy, cw, ch);

      ctx.save();
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.scale(scaleX, showFront ? 1 : 0.98 + Math.sin(this.animClock * 4 + idx) * 0.012);
      ctx.translate(-(cx + cw / 2), -(cy + ch / 2));

      if (!showFront) {
        // 卡背：透出稀有度边缘光晕，制造抽卡期待感
        ctx.shadowColor = rCol;
        ctx.shadowBlur = opt.rarity === 'epic' ? 22 : opt.rarity === 'rare' ? 14 : 6;
        drawChamferPanel(ctx, cx, cy, cw, ch, 14, '#0B1324', rCol, opt.rarity === 'epic' ? 2.4 : 1.6, rCol);
        if (cardBackArt && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx + 6, cy + 6, cw - 12, ch - 12);
          ctx.clip();
          ctx.globalAlpha = 0.55;
          ctx.drawImage(cardBackArt, cx + 6, cy + 6, cw - 12, ch - 12);
          ctx.restore();
        }
        drawFoilShimmer(ctx, cx, cy, cw, ch, this.animClock * 1.4 + idx, rCol + '44');
        drawBadge(ctx, cx + cw / 2 - 58, cy + ch / 2 - 14, 116, 28, '点击翻开', 'rgba(8,12,22,0.9)', rCol);
        ctx.restore();

        hits.add(cx, cy, cw, ch, () => {
          this.flipped[idx] = true;
        });
        return;
      }

      // 卡面正面
      if (opt.rarity === 'epic' || hovered) {
        ctx.shadowColor = rCol;
        ctx.shadowBlur = hovered ? 22 : 14;
      }
      drawChamferPanel(
        ctx,
        cx,
        cy,
        cw,
        ch,
        14,
        hovered ? '#1B2B4B' : THEME.BG_PANEL,
        hovered ? THEME.GOLD_LIGHT : rCol,
        hovered ? 2.4 : 1.6,
        rCol
      );

      const bgId = opt.rarity === 'epic' ? 'card_bg_gold' : opt.rarity === 'rare' ? 'card_bg_blue' : null;
      const bgImg = bgId ? AssetLoader.get(bgId) : null;
      if (bgImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx + 4, cy + 4, cw - 8, ch - 8);
        ctx.clip();
        ctx.globalAlpha = 0.20;
        ctx.drawImage(bgImg, cx + 4, cy + 4, cw - 8, ch - 8);
        ctx.restore();
      }
      if (opt.rarity !== 'common') {
        drawFoilShimmer(ctx, cx, cy, cw, ch, this.animClock * 1.1 + idx * 0.5, opt.rarity === 'epic' ? 'rgba(250,204,21,0.32)' : 'rgba(56,189,248,0.22)');
      }
      if (opt.rarity === 'epic' || opt.category === 'season_perk') {
        const mythicFrame = AssetLoader.get('card_frame_mythic');
        if (mythicFrame && typeof ctx.drawImage === 'function') {
          const ov = optCount >= 4 ? 7 : 10;
          ctx.drawImage(mythicFrame, cx - ov, cy - ov, cw + ov * 2, ch + ov * 2);
          drawRoundRect(
            ctx,
            cx + 18,
            cy + 18,
            cw - 36,
            ch - 36,
            10,
            'rgba(9, 15, 29, 0.82)',
            'rgba(250, 204, 21, 0.32)',
            1
          );
        }
      }

      drawBadge(ctx, cx + 24, cy + 24, 120, 24, rLabel, '#1E293B', rCol);
      drawText(ctx, opt.title, cx + 24, cy + 78, { size: 17, bold: true, color: THEME.TX1 });
      drawWrappedText(ctx, opt.subtitle, cx + 24, cy + 112, cw - 48, 22, { size: 13, color: THEME.TX2, maxLines: 4 });

      if (opt.player) {
        const pl = opt.player;
        drawPlayerAvatar(ctx, cx + cw / 2 - 34, cy + 178, 68, 86, pl, club, { radius: 8 });
        drawRoundRect(ctx, cx + 24, cy + 272, cw - 48, 32, 6, THEME.BG_CARD, THEME.BORDER);
        drawText(
          ctx,
          pl.role === 'GK'
            ? `扑${pl.attributes.goalkeeping} 站${pl.attributes.positioning} 传${pl.attributes.passing}`
            : `速${pl.attributes.pace} 射${pl.attributes.shooting} 传${pl.attributes.passing} 防${pl.attributes.defending}`,
          cx + cw / 2,
          cy + 288,
          { size: 12, color: THEME.GOLD_LIGHT, align: 'center', mono: true }
        );
      } else if (opt.gamble) {
        const g = opt.gamble;
        const barX = cx + 24;
        const barY = cy + 186;
        const barW = cw - 48;
        const barH = 14;
        const wPos = Math.round((barW * g.positive.prob) / 100);
        const wNeg = Math.round((barW * g.negative.prob) / 100);
        const wJack = Math.max(4, barW - wPos - wNeg);

        drawRoundRect(ctx, barX - 1, barY - 1, barW + 2, barH + 2, 5, '#090D16', THEME.BORDER);
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(barX, barY, wPos, barH);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(barX + wPos, barY, wNeg, barH);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(barX + wPos + wNeg, barY, wJack, barH);

        drawText(ctx, `${g.positive.prob}% 正 · ${g.positive.label}`, barX, cy + 216, { size: 11.5, bold: true, color: '#4ADE80' });
        drawText(ctx, `${g.negative.prob}% 负 · ${g.negative.label}`, barX, cy + 236, { size: 11.5, bold: true, color: '#F87171' });
        drawText(ctx, `${g.jackpot.prob}% 暴 · ${g.jackpot.label}`, barX, cy + 256, { size: 11.5, bold: true, color: '#FACC15' });
        if (g.modifierHint) {
          drawWrappedText(ctx, `校准：${g.modifierHint}`, barX, cy + 278, barW, 15, { size: 10.5, color: THEME.TX3, maxLines: 2 });
        }
      }
      ctx.restore();

      if (fp >= 0.8) {
        const needsPlayerTarget = opt.category === 'stat_boost' || opt.category === 'trait_forge';
        const btnTxt = opt.category === 'gamble' ? '开奖博弈' : needsPlayerTarget ? '选择并指定球员 ▶' : '确认领取 ▶';
        drawButton(ctx, hits, cx + 24, cy + ch - 62, cw - 48, 42, btnTxt, () => {
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
        }, { variant: 'gold', fontSize: 14, icon: opt.category === 'gamble' ? 'dice' : undefined });
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

    // 顶栏步骤条
    drawRoundRect(ctx, 16, 14, 1248, 56, 10, THEME.BG_PANEL, THEME.BORDER);
    drawButton(ctx, hits, 28, 24, 104, 36, '← 看战报', () => {
      this.viewMode = 'recap';
    }, { variant: 'ghost', fontSize: 12 });

    const step1Done = rd.perkChosen;
    drawBadge(ctx, 154, 29, 178, 26, '第1步：选战术词条', step1Done ? '#14532D' : '#1E3A5F', step1Done ? THEME.GREEN : THEME.GOLD_LIGHT);
    drawText(ctx, '→', 346, 42, { size: 16, color: THEME.TX3, align: 'center' });
    drawBadge(ctx, 362, 29, 210, 26, `第2步：新援替换 (${rd.swapsUsed}/${rd.maxSwaps})`, step1Done ? '#1E3A5F' : '#111827', step1Done ? THEME.GOLD_LIGHT : THEME.TX3);

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

    // 第 1 步：聚焦展示 3~4 张大号战术词条卡，带配图与系别元素徽章
    if (!step1Done) {
      drawRoundRect(ctx, 16, 84, 1248, 620, 12, THEME.BG_PANEL, THEME.BORDER);
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
      const perkArt = AssetLoader.get('perk_event');
      const cardBackArt = AssetLoader.get('command_card_back');

      rd.perkChoices.forEach((pk, i) => {
        const cx = startX + i * (cw + gap);
        const cy = 192;
        const hovered = hits.isHovered(cx, cy, cw, ch);
        const catColor =
          pk.category === 'attack' ? THEME.RED_LIGHT : pk.category === 'defense' ? THEME.GREEN : '#38BDF8';
        const catLabel =
          pk.category === 'attack' ? '进攻系' : pk.category === 'defense' ? '防守系' : '控制系';
        const elemKey =
          pk.category === 'attack' ? 'elem_blitz' : pk.category === 'defense' ? 'elem_iron' : 'elem_pass';
        const elemImg = AssetLoader.get(elemKey);

        drawChamferPanel(
          ctx,
          cx,
          cy,
          cw,
          ch,
          12,
          hovered ? THEME.BG_CARD_HOVER : THEME.BG_CARD,
          hovered ? THEME.GOLD_LIGHT : THEME.BORDER_GOLD,
          hovered ? 2 : 1.2,
          catColor
        );

        // 顶部配图区：perk_event 场景插画 + 卡背纹理 + 系别元素图标
        const imgH = 148;
        if (perkArt && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx + 2, cy + 2, cw - 4, imgH);
          ctx.clip();
          ctx.drawImage(perkArt, cx + 2, cy + 2, cw - 4, imgH);
          const grad = ctx.createLinearGradient(0, cy + 2, 0, cy + imgH + 2);
          grad.addColorStop(0, 'rgba(10, 16, 30, 0.25)');
          grad.addColorStop(1, 'rgba(14, 22, 40, 0.96)');
          ctx.fillStyle = grad;
          ctx.fillRect(cx + 2, cy + 2, cw - 4, imgH);
          ctx.restore();
        } else if (cardBackArt && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.drawImage(cardBackArt, cx + 2, cy + 2, cw - 4, imgH);
          ctx.restore();
        }

        if (elemImg && typeof ctx.drawImage === 'function') {
          drawRoundRect(ctx, cx + cw - 68, cy + 16, 48, 48, 10, 'rgba(10,16,30,0.82)', catColor, 1.2);
          ctx.drawImage(elemImg, cx + cw - 63, cy + 21, 38, 38);
        }

        drawBadge(
          ctx,
          cx + 18,
          cy + 18,
          66,
          22,
          pk.rarity.toUpperCase(),
          pk.rarity === 'epic' ? THEME.PURPLE : pk.rarity === 'rare' ? THEME.BLUE : '#475569'
        );
        drawBadge(ctx, cx + 92, cy + 18, 62, 22, catLabel, 'rgba(15,23,42,0.9)', catColor);

        drawText(ctx, pk.name, cx + 22, cy + 174, { size: 22, bold: true, color: THEME.GOLD_LIGHT });
        drawWrappedText(ctx, pk.description, cx + 22, cy + 214, cw - 44, 22, {
          size: 14,
          color: THEME.TX1,
          maxLines: 4,
        });
        drawButton(ctx, hits, cx + 22, cy + ch - 64, cw - 44, 44, '选择此词条 ▶', () => {
          league.chooseReDraftPerk(pk.id);
          onSave();
        }, { variant: 'gold', fontSize: 14 });
      });
      return;
    }

    // 第 2 步：极简 2 栏新援替换（支持先选新援，或先选待换下球员）
    const sortedSquad = [...club.squad].sort((a, b) => a.ca - b.ca);
    const starterSet = new Set(club.starterIds);

    // 顶部操作提示条
    drawRoundRect(ctx, 16, 84, 1248, 44, 8, '#111A2E', THEME.BORDER_GOLD);
    const guideText = this.selectedCandidateId
      ? '已选中新援！请点击右侧任意一名我方球员将其替换入队（或点右侧一键替换最低分）'
      : this.selectedDropId
      ? '已选中待淘汰球员！现在点击左侧任意一名新援，即可完成替换'
      : `操作提示：点选左侧【新援】与右侧【待换下球员】（顺序任意，最多可换 ${rd.maxSwaps} 人，也可直接点右上角跳过）`;
    drawText(ctx, guideText, this.selectedCandidateId ? 540 : 640, 106, {
      size: 13,
      bold: true,
      color: (this.selectedCandidateId || this.selectedDropId) ? THEME.GREEN : THEME.GOLD_LIGHT,
      align: 'center',
    });

    if (this.selectedCandidateId && rd.swapsUsed < rd.maxSwaps && sortedSquad.length > 0) {
      drawButton(ctx, hits, 1054, 91, 196, 30, '一键替换最低分球员 ▶', () => {
        league.swapPlayerInReDraft(sortedSquad[0].id, this.selectedCandidateId!);
        this.selectedDropId = null;
        this.selectedCandidateId = null;
        onSave();
      }, { variant: 'green', fontSize: 11 });
    }

    // 左栏：6 名高潜新援候选（带卡框与位置立绘素材）
    drawRoundRect(ctx, 16, 140, 616, 564, 10, THEME.BG_PANEL, THEME.BORDER);
    drawText(ctx, '高潜新援候选池 (点击选中)', 34, 166, { size: 15, bold: true, color: THEME.GOLD_LIGHT });

    rd.candidates.forEach((c, idx) => {
      const cy = 192 + idx * 82;
      const isSel = this.selectedCandidateId === c.id;
      const canClick = rd.swapsUsed < rd.maxSwaps;

      drawRoundRect(
        ctx,
        32,
        cy,
        584,
        72,
        8,
        isSel ? '#1E3A5F' : THEME.BG_CARD,
        isSel ? THEME.GOLD_LIGHT : THEME.BORDER,
        isSel ? 2 : 1
      );

      // 左侧球员分层拼接头像
      drawPlayerAvatar(ctx, 40, cy + 6, 48, 60, c, club, { radius: 6 });

      drawBadge(ctx, 98, cy + 12, 24, 18, c.tier, tierColor(c.tier));
      drawBadge(ctx, 128, cy + 12, 38, 18, c.role, '#1E293B', THEME.TX2);
      drawText(ctx, c.name, 176, cy + 21, { size: 15, bold: true });
      drawText(ctx, `CA ${c.ca}`, 510, cy + 21, { size: 15, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      drawText(
        ctx,
        `${c.traits?.[0] || '均衡'}  |  速${c.attributes.pace} 射${c.attributes.shooting} 传${c.attributes.passing} 防${c.attributes.defending}`,
        98,
        cy + 48,
        { size: 11, color: THEME.TX2 }
      );
      drawButton(ctx, hits, 496, cy + 24, 110, 24, '一键替最低分', () => {
        if (canClick && sortedSquad.length > 0) {
          league.swapPlayerInReDraft(sortedSquad[0].id, c.id);
          this.selectedDropId = null;
          this.selectedCandidateId = null;
          SoundEngine.playSub();
          onSave();
        }
      }, { variant: isSel ? 'gold' : 'ghost', disabled: !canClick || sortedSquad.length === 0, fontSize: 10 });

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

    // 右栏：我方按 CA 从低到高排序的待换下列表（最前面的就是最值得替换的短板球员）
    drawRoundRect(ctx, 648, 140, 616, 564, 10, THEME.BG_PANEL, THEME.BORDER);
    drawText(ctx, '我方当前阵容 (按评分从低到高排列，靠前建议替换)', 666, 166, {
      size: 14,
      bold: true,
      color: THEME.TX1,
    });

    sortedSquad.forEach((p, idx) => {
      const ry = 190 + idx * 31;
      const isSel = this.selectedDropId === p.id;
      const isSuggest = idx < 3;
      const isStarter = starterSet.has(p.id);
      drawRoundRect(
        ctx,
        664,
        ry,
        584,
        27,
        5,
        isSel ? '#3B1E24' : THEME.BG_CARD,
        isSel ? THEME.RED_LIGHT : THEME.BORDER,
        isSel ? 1.5 : 1
      );
      if (isSuggest) {
        drawBadge(ctx, 670, ry + 5, 40, 17, '建议换', '#7C2D12', '#FDBA74');
      } else {
        drawBadge(ctx, 670, ry + 5, 40, 17, p.tier, tierColor(p.tier));
      }
      drawBadge(ctx, 714, ry + 5, 34, 17, isStarter ? '首发' : '替补', isStarter ? '#14532D' : '#334155', isStarter ? THEME.GREEN : THEME.TX2);
      drawBadge(ctx, 752, ry + 5, 36, 17, p.role, '#1E293B', THEME.TX2);
      drawText(ctx, p.name, 796, ry + 13, { size: 12, bold: true });
      drawText(ctx, `CA ${p.ca}`, 1140, ry + 13, { size: 12, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      drawBadge(
        ctx,
        1154,
        ry + 4,
        84,
        19,
        this.selectedCandidateId ? '点击换下 ▶' : isSel ? '已选中' : '选为换下',
        this.selectedCandidateId ? '#14532D' : isSel ? '#991B1B' : '#1E293B',
        this.selectedCandidateId ? THEME.GREEN : THEME.TX2
      );

      if (rd.swapsUsed < rd.maxSwaps) {
        hits.add(664, ry, 584, 27, () => {
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
  }
}
