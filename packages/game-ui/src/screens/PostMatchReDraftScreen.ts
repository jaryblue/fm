/**
 * 页面 5：赛后结算战报 & 2步式 Re-Draft 补强向导
 * 第 1 屏：直观的赛后战报（胜平负横幅、队徽比分、关键统计、掉落战术元素与本轮赛果）
 * 第 2 屏（仅 R2/R4/R6）：2 步引导式 Re-Draft（Step1 词条三选一 -> Step2 双向点选新援替换）
 */

import { MatchState, PITCH } from '../../../engine/src/types';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { AssetLoader } from '../AssetLoader';
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
}

export class PostMatchReDraftScreen {
  private lastMatch: MatchState | null = null;
  private viewMode: 'recap' | 'reward' | 'redraft' = 'recap';
  private recapTab: 'analytics' | 'results' = 'analytics';
  private selectedCandidateId: string | null = null;
  private selectedDropId: string | null = null;

  // 抽卡开包与逐张翻牌动画状态
  private animClock = 0;
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
  private flipped: [boolean, boolean, boolean] = [false, false, false];
  private flipTimers: [number, number, number] = [0, 0, 0];
  private flipSoundPlayed: [boolean, boolean, boolean] = [false, false, false];
  private fx: PostMatchFxCallbacks = {};

  public setLastMatch(match: MatchState): void {
    this.lastMatch = match;
    this.viewMode = 'recap';
    this.selectedCandidateId = null;
    this.selectedDropId = null;
    this.catEnterTimer = 0;
    this.packAnim = null;
    this.resetCardRevealAnim();
  }

  public dispose(): void {
    this.lastMatch = null;
    this.packAnim = null;
    this.selectedCandidateId = null;
    this.selectedDropId = null;
  }

  private resetCardRevealAnim(): void {
    this.dealTimer = 0;
    this.flipped = [false, false, false];
    this.flipTimers = [0, 0, 0];
    this.flipSoundPlayed = [false, false, false];
  }

  public update(dtSec: number): void {
    this.animClock += dtSec;
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
    const autoThresholds = [0.46, 0.82, 1.18];
    for (let i = 0; i < 3; i++) {
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
        drawText(ctx, `隐藏特质觉醒：${u.playerName} 解锁【${u.trait}】`, 814, 320, {
          size: 12,
          bold: true,
          color: '#38BDF8',
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

      const slotW = mPlotW / 18;
      const barW = Math.max(10, slotW - 6);
      const userIsHomeSide = m.homeName === club.name;
      for (let bi = 0; bi < 18; bi++) {
        const val = momBuckets[bi];
        const ratio = Math.min(1, Math.abs(val) / maxMom);
        const bh = Math.max(3, ratio * halfH);
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
        badge: '扩充 40 人大名单',
        desc: '撕开球探密函盲盒，从 3 名新援中挑选 1 人立即入队（胜场提升高 CA 概率）',
        color: '#38BDF8',
        elemKey: 'elem_wing',
      },
      stat_boost: {
        title: '单体特训包 · 王牌精修',
        badge: '永久属性 +2 ~ +4',
        desc: '开启专项特训卡包，指定队内 1 名核心球员永久提升属性',
        color: THEME.GOLD_LIGHT,
        elemKey: 'elem_blitz',
      },
      line_boost: {
        title: '位置共振包 · 整线强化',
        badge: '全线协同增益',
        desc: '抽取一条位置线（门/防/中/锋）全体成员同步获得属性强化',
        color: THEME.GREEN,
        elemKey: 'elem_iron',
      },
      craft_card: {
        title: '战术合成包 · 教练手牌',
        badge: '指挥卡 / 元素强化',
        desc: '开出成品高阶指挥卡、现有指挥卡免费升阶或高阶元素包',
        color: '#C084FC',
        elemKey: 'elem_pass',
      },
      event: {
        title: '更衣室奇遇 · 随机事件',
        badge: '高收益 / 恢复抉择',
        desc: '触发全队体能回满、合练默契暴涨或球探密报觉醒隐藏特质',
        color: '#FB923C',
        elemKey: 'elem_press',
      },
      trait_forge: {
        title: '临时徽章 · 临场觉醒',
        badge: '持续3~5轮 / 多位置',
        desc: '赐予持续 5 轮的引擎银标、持续 3 轮的临时金标+超频，或解锁第二位置',
        color: '#F472B6',
        elemKey: 'elem_blitz',
      },
      tactical_pact: {
        title: '更衣室契约 · 双刃剑',
        badge: '高风险高回报赌约',
        desc: '签署以体力/局部属性换取战力暴涨或黑市 Meta/备战点炼金的特殊契约',
        color: '#F87171',
        elemKey: 'elem_press',
      },
      chemistry_forge: {
        title: '化学连线 · 宗师蜕变',
        badge: '黄金连线 / 卡牌超频',
        desc: '直接铸造首发黄金连线、阵型宗师灌顶(+Meta)或为高费指挥卡降费超频',
        color: '#2DD4BF',
        elemKey: 'elem_pass',
      },
    };

    const cardBackArt = AssetLoader.get('command_card_back');

    // 开包撕裂过场动画（0 -> 0.56s）
    if (this.packAnim?.active) {
      const pa = this.packAnim;
      const t = pa.timer;
      ctx.save();
      ctx.fillStyle = 'rgba(4, 7, 14, 0.72)';
      ctx.fillRect(0, 80, THEME.W, THEME.H - 80);

      if (t < 0.36) {
        const moveP = easeOutCubic(Math.min(1, t / 0.24));
        const px = pa.startX + (640 - pa.startX) * moveP;
        const py = 354 + (340 - 354) * moveP;
        const shakeAmp = t > 0.14 ? (t - 0.14) * 28 : 0;
        const jx = (Math.random() * 2 - 1) * shakeAmp;
        const jy = (Math.random() * 2 - 1) * shakeAmp;
        const scale = 1 + 0.18 * moveP;

        // 聚光光晕
        const radGrad = ctx.createRadialGradient(px + jx, py + jy, 18, px + jx, py + jy, 240);
        radGrad.addColorStop(0, pa.color + '88');
        radGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(px + jx, py + jy, 240, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(px + jx, py + jy);
        ctx.scale(scale, scale);
        drawChamferPanel(ctx, -155, -195, 310, 390, 14, '#0F172A', pa.color, 2.6, pa.color);
        if (cardBackArt && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.globalAlpha = 0.42;
          ctx.drawImage(cardBackArt, -150, -190, 300, 380);
          ctx.restore();
        }
        drawFoilShimmer(ctx, -155, -195, 310, 390, this.animClock * 2.5, pa.color + '66');
        drawText(ctx, pa.title, 0, 12, { size: 18, bold: true, color: THEME.TX1, align: 'center' });
        drawText(ctx, '正在开启战利品卡包...', 0, 48, { size: 13, color: pa.color, align: 'center' });

        // 中心撕裂光束
        if (t > 0.16) {
          const beamP = (t - 0.16) / 0.20;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2 + beamP * 8;
          ctx.shadowColor = pa.color;
          ctx.shadowBlur = 22;
          ctx.beginPath();
          ctx.moveTo(0, -195);
          ctx.lineTo(0, 195);
          ctx.stroke();
        }
      } else {
        const flashP = 1 - (t - 0.36) / 0.20;
        ctx.fillStyle = `rgba(255, 250, 220, ${Math.max(0, flashP * 0.65)})`;
        ctx.fillRect(0, 70, THEME.W, THEME.H - 70);
      }
      ctx.restore();
      return;
    }

    // 状态 A：第一步 3 选 1 门类盲盒卡包
    if (!rw.chosenCategory) {
      drawText(ctx, '选择 1 个赛后战术盲盒开启（3选1 · 开启后逐张翻牌揭示奖励）', 640, 120, {
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
        const cy = 170 + (1 - enterP) * 60 + floatY;
        const cw = 340;
        const ch = 376;
        const hovered = hits.isHovered(cx, cy, cw, ch);

        ctx.save();
        ctx.globalAlpha = Math.max(0.05, enterP);
        if (hovered) {
          ctx.shadowColor = meta.color;
          ctx.shadowBlur = 20;
        }
        drawChamferPanel(
          ctx,
          cx,
          cy,
          cw,
          ch,
          14,
          hovered ? '#1B2B4B' : THEME.BG_PANEL,
          hovered ? meta.color : THEME.BORDER_GOLD,
          hovered ? 2.4 : 1.5,
          meta.color
        );
        if (cardBackArt && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx + 4, cy + 4, cw - 8, ch - 8);
          ctx.clip();
          ctx.globalAlpha = hovered ? 0.24 : 0.14;
          ctx.drawImage(cardBackArt, cx + 4, cy + 4, cw - 8, ch - 8);
          ctx.restore();
        }
        drawFoilShimmer(ctx, cx, cy, cw, ch, this.animClock * 0.9 + idx * 0.4, meta.color + '2A');

        const elemImg = AssetLoader.get(meta.elemKey);
        if (elemImg && typeof ctx.drawImage === 'function') {
          drawRoundRect(ctx, cx + cw / 2 - 34, cy + 56, 68, 68, 16, 'rgba(10,16,30,0.85)', meta.color, 1.5);
          ctx.drawImage(elemImg, cx + cw / 2 - 24, cy + 66, 48, 48);
        }

        drawBadge(ctx, cx + 24, cy + 20, 144, 24, meta.badge, '#1E293B', meta.color);
        drawText(ctx, meta.title, cx + cw / 2, cy + 154, { size: 19, bold: true, color: THEME.TX1, align: 'center' });
        drawWrappedText(ctx, meta.desc, cx + 26, cy + 188, cw - 52, 22, { size: 13, color: THEME.TX2, maxLines: 4 });
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
        drawButton(ctx, hits, cx + 24, cy + ch - 68, cw - 48, 44, '撕开此盲盒 ✨', pickPack, { variant: 'gold', fontSize: 14 });
        hits.add(cx, cy, cw, ch, pickPack);
      });
      return;
    }

    // 状态 B：单体特训卡 / 特质移植待指定受训球员
    if (rw.pendingStatOptionId && !rw.completed) {
      const opt = rw.options.find(o => o.id === rw.pendingStatOptionId);
      const isTraitForge = opt?.category === 'trait_forge';
      drawText(ctx, `已选【${opt?.title || '专项强化'}】— 请点击 1 名球员立即生效：`, 640, 108, {
        size: 16,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
      const list = [...club.squad].sort((a, b) => b.ca - a.ca).slice(0, 26);
      list.forEach((p, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const px = 48 + col * 604;
        const py = 136 + row * 42;
        const hovered = hits.isHovered(px, py, 580, 36);
        drawRoundRect(ctx, px, py, 580, 36, 6, hovered ? '#1E3A5F' : THEME.BG_CARD, hovered ? THEME.GOLD_LIGHT : THEME.BORDER);
        drawBadge(ctx, px + 10, py + 8, 38, 20, p.role, tierColor(p.tier));
        drawText(ctx, p.name, px + 58, py + 18, { size: 13, bold: true });
        drawText(ctx, `${p.age}岁 · CA ${p.ca}`, px + 168, py + 18, { size: 12, color: THEME.GOLD_LIGHT, mono: true });
        if (isTraitForge) {
          const infoTxt = opt?.traitForge?.kind === 'unlock_role'
            ? `兼:${p.secondaryRoles?.join('/') || '无'}`
            : `金:${p.goldTraits?.length ?? 0} 银:${p.silverTraits?.slice(0, 2).join('/') || '无'}`;
          drawText(ctx, infoTxt, px + 266, py + 18, { size: 11.5, color: '#F472B6' });
        } else {
          const attrKey = opt?.statBoost?.attr ?? 'shooting';
          drawText(ctx, `${opt?.statBoost?.attrLabel || '属性'}: ${p.attributes[attrKey]}`, px + 360, py + 18, {
            size: 12,
            color: '#38BDF8',
          });
        }
        drawButton(ctx, hits, px + 480, py + 5, 90, 26, isTraitForge ? '移植改造' : '特训此人', () => {
          league.applyPostMatchRewardOption(rw.pendingStatOptionId!, p.id);
          SoundEngine.playRewardChime();
          this.fx.onBurst?.(px + 290, py + 18, isTraitForge ? '#F472B6' : THEME.GOLD_LIGHT);
          onSave();
        }, { variant: 'gold', fontSize: 11 });
      });
      return;
    }

    // 状态 C：第二步 展开 3 个具体选项（或展示已完成结果）
    if (rw.completed) {
      drawChamferPanel(ctx, 260, 200, 760, 280, 14, THEME.BG_PANEL, THEME.GREEN, 2, THEME.GREEN);
      drawFoilShimmer(ctx, 260, 200, 760, 280, this.animClock * 1.1, 'rgba(74, 222, 128, 0.20)');
      drawBadge(ctx, 560, 232, 160, 28, '赛后奖励已领取', '#14532D', THEME.GREEN);
      drawText(ctx, rw.summaryText || '奖励已生效', 640, 316, {
        size: 22,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
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

    const allRevealed = this.flipped.every(Boolean) && this.flipTimers.every(t => t >= 0.35);
    if (!allRevealed) {
      drawButton(ctx, hits, 1072, 102, 160, 32, '一键全翻 ✨', () => {
        this.flipped = [true, true, true];
        this.flipTimers = [0.22, 0.22, 0.22];
      }, { variant: 'primary', fontSize: 12 });
    }

    rw.options.forEach((opt, idx) => {
      const targetX = 86 + idx * 384;
      const targetY = 174;
      const cw = 340;
      const ch = 376;

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
        drawBadge(ctx, cx + cw / 2 - 58, cy + ch / 2 - 14, 116, 28, '点击翻开 ✨', 'rgba(8,12,22,0.9)', rCol);
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
      }
      ctx.restore();

      if (fp >= 0.8) {
        const needsPlayerTarget = opt.category === 'stat_boost' || opt.category === 'trait_forge';
        drawButton(ctx, hits, cx + 24, cy + ch - 62, cw - 48, 42, needsPlayerTarget ? '选择并指定球员 ▶' : '确认领取 ▶', () => {
          const res = league.applyPostMatchRewardOption(opt.id);
          if (!res.needsTarget) {
            SoundEngine.playRewardChime();
            this.fx.onBurst?.(targetX + cw / 2, targetY + ch / 2, THEME.GREEN);
          } else {
            SoundEngine.playClick();
          }
          onSave();
        }, { variant: 'gold', fontSize: 14 });
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
