/**
 * 页面 6：赛季荣耀结算与休赛期整备（2 阶段：赛季颁奖台 & 赛季宝箱 3 选 1 -> 休赛期引援交换 & 专项特训）
 */

import { ACHIEVEMENTS } from '../../../core/src/Achievements';
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
import { drawClubCrest, drawTrophyIcon } from '../ClubVisuals';
import { easeOutBack } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

export class SeasonEndScreen {
  private viewMode: 'ceremony' | 'roster_prep' = 'ceremony';
  private animClock = 0;
  private enterTimer = 0;
  private ceremonyBurstDone = false;
  private selectedRewardId: string | null = null;
  private selectedDropRosterId: string | null = null;
  private trainFocus: 'auto' | 'attack' | 'playmake' | 'defense' = 'auto';
  private memoryIdx = 0;
  private notice = '点选新秀与老将（顺序不限）即可一对一交换保留至下赛季';

  public resetIntro(): void {
    this.viewMode = 'ceremony';
    this.enterTimer = 0;
    this.ceremonyBurstDone = false;
    this.selectedRewardId = null;
    this.selectedDropRosterId = null;
    this.memoryIdx = 0;
  }

  public update(dtSec: number): void {
    this.animClock += dtSec;
    this.enterTimer += dtSec;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onNewSeason: (carryOver?: boolean) => void;
      onOpenMeta: () => void;
      onGoTitle: () => void;
      onSave?: () => void;
      onToast?: (msg: string, color?: string) => void;
      onBurst?: (x: number, y: number, color?: string) => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const summary = st.lastSummary;

    drawChamferPanel(ctx, 40, 28, 1200, 664, 14, 'rgba(10, 16, 30, 0.84)', THEME.BORDER_GOLD, 1.5, THEME.GOLD_LIGHT);

    const isChamp = summary?.isChampion ?? false;
    const isPromo = summary?.promotionStatus === 'promoted';

    if ((isChamp || isPromo) && !this.ceremonyBurstDone && this.enterTimer >= 0.18) {
      this.ceremonyBurstDone = true;
      SoundEngine.playFanfare();
      actions.onBurst?.(640, 160, THEME.GOLD_LIGHT);
      actions.onBurst?.(360, 220, isChamp ? '#FACC15' : THEME.GREEN);
      actions.onBurst?.(920, 220, isChamp ? '#FACC15' : THEME.GREEN);
    }

    if (isChamp || isPromo) {
      const trophyImg = AssetLoader.get('trophy_grand_cup') ?? AssetLoader.get('trophy_tier1');
      if (trophyImg && typeof ctx.drawImage === 'function') {
        ctx.drawImage(trophyImg, 80, 44, 60, 60);
      } else {
        drawTrophyIcon(ctx, 110, 74, 42);
      }
    } else {
      drawClubCrest(ctx, 100, 74, 24, club);
    }

    drawText(ctx, isChamp ? `${club.name} · ${summary?.tierName ?? '联赛'} 冠军` : `${club.name} · 第 ${st.seasonNumber} 赛季结算`, 154, 62, {
      size: 24,
      bold: true,
      italic: true,
      color: isChamp ? THEME.GOLD_LIGHT : THEME.TX1,
    });
    if (summary) {
      const promoText =
        summary.promotionStatus === 'promoted' ? `▲ 升入第 ${summary.newTier} 级！` :
        summary.promotionStatus === 'relegated' ? `▼ 降入第 ${summary.newTier} 级` :
        `继续征战第 ${summary.newTier ?? 7} 级`;
      drawText(
        ctx,
        `${summary.tierName ?? '联赛'} 第 ${summary.finalRank} 名 · ${summary.points}分 (${summary.gf}/${summary.ga}) · ${promoText} · +${summary.metaPointsEarned}pt`,
        154,
        92,
        { size: 12, color: summary.promotionStatus === 'promoted' ? THEME.GREEN : summary.promotionStatus === 'relegated' ? THEME.RED_LIGHT : THEME.TX2 }
      );
    }

    // 顶栏阶段切换按钮
    drawButton(ctx, hits, 814, 54, 134, 30, '1. 赛季颁奖与宝箱', () => {
      this.viewMode = 'ceremony';
    }, { active: this.viewMode === 'ceremony', fontSize: 10.5 });
    drawButton(ctx, hits, 956, 54, 134, 30, '2. 休赛期引援特训', () => {
      this.viewMode = 'roster_prep';
    }, { active: this.viewMode === 'roster_prep', fontSize: 10.5 });

    drawIcon(ctx, 'trophy', 1110, 69, 14, THEME.GOLD_LIGHT);
    drawText(ctx, `成就 ${st.hallOfFame?.unlockedAchievements.length ?? 0}/${ACHIEVEMENTS.length}`, 1214, 69, {
      size: 12.5,
      bold: true,
      color: THEME.TX2,
      align: 'right',
    });

    if (summary?.retiredLegend) {
      const rl = summary.retiredLegend;
      drawRoundRect(ctx, 64, 108, 1152, 26, 6, 'rgba(120, 53, 15, 0.45)', THEME.GOLD, 1);
      drawText(
        ctx,
        `游子归家 · 传奇挂靴转教练：#10 ${rl.name} (${rl.age}岁 · 本季 ${rl.appearances}场 ${rl.goals}球${rl.assists}助) 正式退役接过教鞭，传承【老队长的怒吼】+50 Meta！`,
        640,
        121,
        { size: 11.5, bold: true, color: THEME.GOLD_LIGHT, align: 'center' }
      );
    }

    if (this.viewMode === 'ceremony') {
      this.renderCeremonyView(ctx, hits, league, actions);
      return;
    }

    this.renderRosterPrepView(ctx, hits, league, actions);
  }

  private renderCeremonyView(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onNewSeason: (carryOver?: boolean) => void;
      onOpenMeta: () => void;
      onGoTitle: () => void;
      onSave?: () => void;
      onToast?: (msg: string, color?: string) => void;
      onBurst?: (x: number, y: number, color?: string) => void;
    }
  ): void {
    const st = league.getState();
    const summary = st.lastSummary;
    const isChamp = summary?.isChampion ?? false;
    const isPromo = summary?.promotionStatus === 'promoted';

    // 左栏：赛季个人荣誉颁奖台
    drawChamferPanel(ctx, 64, 118, 460, 486, 12, 'rgba(14, 22, 40, 0.88)', THEME.BORDER_GOLD, 1.2);
    const celebrateArt = AssetLoader.get('bg_season_ceremony') ?? AssetLoader.get('bg_champion');
    if (celebrateArt && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(66, 120, 456, 108);
      ctx.clip();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(celebrateArt, 66, 110, 456, 148);
      ctx.restore();
    }
    const grandCup = AssetLoader.get('trophy_grand_cup');
    if (grandCup && typeof ctx.drawImage === 'function') {
      const cupEnter = easeOutBack(Math.max(0, Math.min(1, this.enterTimer / 0.45)));
      const cyOff = (1 - cupEnter) * 18;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.drawImage(grandCup, 426, 124 + cyOff, 86, 86);
      ctx.restore();
    }
    drawText(ctx, '赛季个人荣誉殿堂 · SEASON AWARDS', 84, 144, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
    drawText(
      ctx,
      isChamp ? '冠军荣耀加冕！全队载入俱乐部史册' : isPromo ? '成功冲级！下赛季迎战更强对手' : '赛季征程圆满收官，总结得失再出发',
      84,
      168,
      { size: 11.5, color: isChamp ? THEME.GOLD_LIGHT : isPromo ? THEME.GREEN : '#93C5FD' }
    );

    const awards: Array<{ badge: string; title: string; value: string; sub: string; color: string }> = [
      {
        badge: '球队 MVP',
        title: summary?.seasonMVP ? `${summary.seasonMVP.name} (${summary.seasonMVP.role})` : '全队均衡发挥',
        value: summary?.seasonMVP ? `CA ${summary.seasonMVP.ca}` : '-',
        sub: summary?.seasonMVP ? `${summary.seasonMVP.goals} 球 · ${summary.seasonMVP.assists} 助` : '无统计数据',
        color: THEME.GOLD_LIGHT,
      },
      {
        badge: '联赛金靴',
        title: summary?.topScorer ? summary.topScorer.name : '暂无金靴',
        value: summary?.topScorer ? `${summary.topScorer.goals} 球` : '-',
        sub: summary?.topScorer ? summary.topScorer.clubName : '本赛季暂无进球记录',
        color: '#F87171',
      },
      {
        badge: '联赛助攻王',
        title: summary?.topAssister ? summary.topAssister.name : '暂无助攻王',
        value: summary?.topAssister ? `${summary.topAssister.assists} 助` : '-',
        sub: summary?.topAssister ? summary.topAssister.clubName : '本赛季暂无助攻记录',
        color: '#38BDF8',
      },
      {
        badge: '金手套门神',
        title: summary?.goldenGlove ? summary.goldenGlove.name : '暂无门神',
        value: summary?.goldenGlove ? `${summary.goldenGlove.cleanSheets} 零封` : '-',
        sub: summary?.goldenGlove ? summary.goldenGlove.clubName : '本赛季暂无零封记录',
        color: THEME.GREEN,
      },
    ];

    awards.forEach((aw, i) => {
      const enterP = easeOutBack(Math.max(0, Math.min(1, (this.enterTimer - i * 0.08) / 0.35)));
      const ay = 224 + i * 92 + (1 - enterP) * 18;
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, enterP);
      drawRoundRect(ctx, 82, ay, 424, 78, 8, 'rgba(14, 22, 40, 0.9)', aw.color + '88', 1.2);
      drawBadge(ctx, 96, ay + 12, 84, 22, aw.badge, '#1E293B', aw.color);
      drawText(ctx, aw.title, 192, ay + 23, { size: 15, bold: true, color: THEME.TX1 });
      drawText(ctx, aw.sub, 96, ay + 54, { size: 11.5, color: THEME.TX2 });
      drawText(ctx, aw.value, 490, ay + 39, { size: 18, bold: true, color: aw.color, align: 'right', mono: true });
      ctx.restore();
    });

    // 右栏上半：Meta 点数结算明细
    drawChamferPanel(ctx, 544, 118, 672, 128, 12, THEME.BG_CARD, THEME.BORDER_GOLD, 1.2);
    drawText(ctx, 'Meta 教练点数结算明细', 564, 138, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `当前总计：${st.metaPointsTotal} pt`, 1196, 138, { size: 14, bold: true, color: THEME.GREEN, align: 'right', mono: true });

    const bd = summary?.metaBreakdown;
    const items: Array<[string, string, string]> = [
      ['排名基础奖励', `+${bd?.rankBase ?? summary?.metaPointsEarned ?? 0} pt`, THEME.TX1],
      ['冲级突破加奖', `+${bd?.promoBonus ?? 0} pt`, (bd?.promoBonus ?? 0) > 0 ? THEME.GREEN : THEME.TX3],
      ['顶级冠军/故事线', `+${(bd?.champBonus ?? 0) + (bd?.storyBonus ?? 0)} pt`, ((bd?.champBonus ?? 0) + (bd?.storyBonus ?? 0)) > 0 ? THEME.GOLD_LIGHT : THEME.TX3],
      ['本季合计入账', `+${summary?.metaPointsEarned ?? 0} pt`, THEME.GOLD_LIGHT],
    ];
    items.forEach(([lbl, val, col], idx) => {
      const ix = 564 + idx * 160;
      drawRoundRect(ctx, ix, 158, 148, 74, 8, 'rgba(14, 22, 40, 0.85)', idx === 3 ? THEME.GOLD_LIGHT : THEME.BORDER);
      drawText(ctx, lbl, ix + 74, 180, { size: 10.5, color: THEME.TX2, align: 'center' });
      drawText(ctx, val, ix + 74, 210, { size: 17, bold: true, color: col, align: 'center', mono: true });
    });

    // 右栏中部：赛季记忆明信片（支持多条轮播 + 敌方球员/阵型/xG/控球详情）
    const memories = summary?.memories ?? [];
    if (memories.length > 0) {
      this.memoryIdx = ((this.memoryIdx % memories.length) + memories.length) % memories.length;
    } else {
      this.memoryIdx = 0;
    }
    const topMem = memories[this.memoryIdx];
    const memAccent = topMem?.isPainful ? '#FCA5A5' : THEME.GOLD_LIGHT;
    drawChamferPanel(ctx, 544, 254, 672, 118, 12, THEME.BG_CARD, topMem ? memAccent : THEME.BORDER, 1.3, memAccent);
    drawText(ctx, '赛季记忆明信片 · SEASON MEMORY', 564, 274, { size: 13.5, bold: true, color: memAccent });
    if (topMem) {
      drawBadge(ctx, 832, 263, 76, 20, topMem.badge, topMem.isPainful ? '#7F1D1D' : '#78350F', memAccent);
      if (topMem.contextTag) {
        drawBadge(ctx, 914, 263, 78, 20, topMem.contextTag, '#1E293B', '#38BDF8');
      }
      if (memories.length > 1) {
        drawButton(ctx, hits, 1086, 262, 28, 22, '◀', () => {
          this.memoryIdx = (this.memoryIdx - 1 + memories.length) % memories.length;
        }, { variant: 'ghost', fontSize: 10 });
        drawText(ctx, `${this.memoryIdx + 1}/${memories.length}`, 1138, 273, {
          size: 11,
          bold: true,
          color: THEME.TX2,
          align: 'center',
          mono: true,
        });
        drawButton(ctx, hits, 1162, 262, 28, 22, '▶', () => {
          this.memoryIdx = (this.memoryIdx + 1) % memories.length;
        }, { variant: 'ghost', fontSize: 10 });
      } else {
        drawText(
          ctx,
          topMem.isPainful ? '「再来一局」复仇钩子：下赛季找回场子！' : '高光时刻已封存荣誉室',
          1196,
          274,
          { size: 11, bold: true, color: topMem.isPainful ? '#FCA5A5' : THEME.GREEN, align: 'right' }
        );
      }
      drawText(ctx, topMem.title, 564, 300, { size: 14.5, bold: true, color: THEME.TX1 });
      drawWrappedText(ctx, topMem.summary, 564, 320, 632, 16, { size: 11, color: THEME.TX2, maxLines: 2 });
      const metaChips: string[] = [];
      if (topMem.userFormation && topMem.oppFormation) {
        metaChips.push(`${topMem.userFormation} vs ${topMem.oppFormation}${topMem.oppStyle ? `(${topMem.oppStyle})` : ''}`);
      }
      if (topMem.xgText) metaChips.push(topMem.xgText);
      if (topMem.possessionText) metaChips.push(topMem.possessionText);
      if (topMem.oppPlayerName) metaChips.push(`敌方焦点:${topMem.oppPlayerName}`);
      if (topMem.assistPlayerName) metaChips.push(`助攻:${topMem.assistPlayerName}`);
      if (metaChips.length > 0) {
        drawText(ctx, metaChips.slice(0, 4).join('  ·  '), 564, 358, {
          size: 10,
          color: '#7DD3FC',
        });
      }
    } else {
      drawText(ctx, '本赛季波澜不惊 · 期待下赛季书写绝杀与逆转名场面', 880, 318, {
        size: 12.5,
        color: THEME.TX3,
        align: 'center',
      });
    }

    // 右栏下半：赛季结算专属宝箱（3选1）
    drawChamferPanel(ctx, 544, 380, 672, 224, 12, THEME.BG_CARD, THEME.BORDER_GOLD, 1.4, THEME.GOLD_LIGHT);
    drawText(ctx, '赛季结算专属宝箱 · 请任选 1 项带入下赛季', 564, 402, { size: 14, bold: true, color: THEME.GOLD_LIGHT });

    const bonusOpts = summary?.seasonBonusOptions ?? [];
    const claimedId = summary?.seasonBonusClaimedId;

    if (claimedId) {
      drawRoundRect(ctx, 564, 422, 632, 166, 10, 'rgba(20, 83, 45, 0.25)', THEME.GREEN, 1.8);
      drawFoilShimmer(ctx, 564, 422, 632, 166, this.animClock * 1.1, 'rgba(74, 222, 128, 0.22)');
      drawBadge(ctx, 800, 442, 160, 26, '赛季宝箱已开启 ✓', '#14532D', THEME.GREEN);
      drawText(ctx, summary?.seasonBonusSummary || '赛季奖励已发放！', 880, 496, {
        size: 16,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
      drawButton(ctx, hits, 720, 534, 320, 40, '下一步：休赛期引援与特训 ▶', () => {
        this.viewMode = 'roster_prep';
      }, { variant: 'gold', fontSize: 13 });
    } else if (bonusOpts.length > 0) {
      const colors = ['#C084FC', '#38BDF8', THEME.GOLD_LIGHT];
      bonusOpts.forEach((opt, oi) => {
        const bx = 564 + oi * 214;
        const by = 418;
        const bw = 202;
        const bh = 176;
        const col = colors[oi % colors.length];
        const hovered = hits.isHovered(bx, by, bw, bh);

        drawChamferPanel(
          ctx,
          bx,
          by,
          bw,
          bh,
          10,
          hovered ? '#1B2B4B' : 'rgba(14, 22, 40, 0.92)',
          hovered ? THEME.GOLD_LIGHT : col,
          hovered ? 2.2 : 1.4,
          col
        );
        drawFoilShimmer(ctx, bx, by, bw, bh, this.animClock + oi * 0.5, col + '33');
        const showMythicFrame = oi === 2 || hovered;
        if (showMythicFrame) {
          const mf = AssetLoader.get('card_frame_mythic');
          if (mf && typeof ctx.drawImage === 'function') {
            ctx.save();
            ctx.globalAlpha = oi === 2 ? 0.92 : 0.6;
            ctx.drawImage(mf, bx - 5, by - 5, bw + 10, bh + 10);
            ctx.restore();
            drawRoundRect(
              ctx,
              bx + 10,
              by + 10,
              bw - 20,
              bh - 20,
              8,
              hovered ? 'rgba(20, 34, 62, 0.92)' : 'rgba(11, 18, 34, 0.90)',
              'rgba(250, 204, 21, 0.36)',
              1
            );
          }
        }
        drawBadge(ctx, bx + 14, by + 14, 114, 20, opt.badge, '#1E293B', col);
        drawText(ctx, opt.title, bx + 14, by + 50, { size: 13, bold: true, color: THEME.TX1 });
        drawWrappedText(ctx, opt.subtitle, bx + 14, by + 74, bw - 28, 16, { size: 10.5, color: THEME.TX2, maxLines: 3 });

        const claim = () => {
          const res = league.pickSeasonBonusReward(opt.id);
          if (res.ok) {
            SoundEngine.playFanfare();
            actions.onBurst?.(bx + bw / 2, by + bh / 2, col);
            actions.onToast?.(res.summary || '赛季宝箱已领取！', col);
            actions.onSave?.();
          }
        };
        drawButton(ctx, hits, bx + 14, by + bh - 42, bw - 28, 28, '开启宝箱', claim, { variant: 'gold', fontSize: 11.5, icon: 'sparkle' });
        hits.add(bx, by, bw, bh, claim);
      });
    } else {
      drawText(ctx, '点击右下角进入休赛期引援与特训', 880, 504, { size: 14, color: THEME.TX2, align: 'center' });
    }

    // 底部操作按钮
    drawButton(ctx, hits, 64, 620, 200, 48, '返回建队主页', actions.onGoTitle, {
      variant: 'ghost',
      fontSize: 13,
      icon: 'home',
    });
    drawButton(ctx, hits, 280, 620, 230, 48, `教练天赋树 (${st.metaPointsTotal}pt)`, actions.onOpenMeta, {
      variant: 'primary',
      fontSize: 13,
      icon: 'talent',
    });
    drawButton(ctx, hits, 526, 620, 690, 48, '下一步：休赛期引援新秀交换 & 专项特训 ▶', () => {
      this.viewMode = 'roster_prep';
    }, {
      variant: 'gold',
      fontSize: 15,
      icon: 'play',
    });
  }

  private renderRosterPrepView(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onNewSeason: (carryOver?: boolean) => void;
      onOpenMeta: () => void;
      onGoTitle: () => void;
      onSave?: () => void;
      onToast?: (msg: string, color?: string) => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const rewards = st.seasonRewardDrafts ?? [];

    // 左栏：赛季末引援新秀（可与队内老将交换）
    drawChamferPanel(ctx, 64, 122, 420, 480, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `赛季末引援新秀 (${rewards.length}) · 选后点右侧老将交换`, 82, 146, {
      size: 13,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(ctx, this.notice, 82, 168, { size: 11, color: '#7DD3FC' });

    if (rewards.length === 0) {
      drawRoundRect(ctx, 82, 196, 384, 110, 8, 'rgba(14,22,40,0.6)', THEME.BORDER);
      drawText(ctx, '本赛季引援新秀已全部完成交换，或可直接保留班底开启下赛季', 274, 251, {
        size: 12,
        color: THEME.TX3,
        align: 'center',
      });
    } else {
      rewards.forEach((rp, idx) => {
        const ry = 194 + idx * 124;
        const isSel = this.selectedRewardId === rp.id;
        const bgCardId = rp.tier === 'S' ? 'card_bg_gold' : rp.tier === 'A' ? 'card_bg_purple' : rp.tier === 'B' ? 'card_bg_blue' : null;
        const bgCardImg = bgCardId ? AssetLoader.get(bgCardId) : null;

        drawChamferPanel(
          ctx,
          82,
          ry,
          384,
          110,
          8,
          isSel ? 'rgba(34, 197, 94, 0.14)' : 'rgba(14, 22, 40, 0.85)',
          isSel ? THEME.GREEN : THEME.BORDER_GOLD,
          isSel ? 1.8 : 1
        );
        if (bgCardImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(84, ry + 2, 380, 106);
          ctx.clip();
          ctx.globalAlpha = 0.22;
          ctx.drawImage(bgCardImg, 82, ry, 384, 110);
          ctx.restore();
        }

        drawPlayerAvatar(ctx, 94, ry + 14, 62, 82, rp, club, { radius: 6 });
        if (rp.tier === 'S' || rp.tier === 'A') {
          drawFoilShimmer(
            ctx,
            82,
            ry,
            384,
            110,
            this.animClock + idx * 0.35,
            rp.tier === 'S' ? 'rgba(250, 204, 21, 0.24)' : 'rgba(168, 85, 247, 0.20)'
          );
          drawRoundRect(ctx, 167, ry + 13, 26, 20, 4, 'rgba(255,255,255,0.18)', rp.tier === 'S' ? '#FEF08A' : '#E9D5FF', 1.2);
        }

        drawBadge(ctx, 168, ry + 14, 24, 18, rp.tier, tierColor(rp.tier), rp.tier === 'S' ? '#090D16' : '#FFFFFF');
        drawBadge(ctx, 196, ry + 14, 36, 18, rp.role, '#1E293B', THEME.TX2);
        drawText(ctx, rp.name, 240, ry + 23, { size: 16, bold: true, color: isSel ? THEME.GREEN : THEME.TX1 });
        drawText(ctx, `CA ${rp.ca}`, 450, ry + 23, {
          size: 16,
          bold: true,
          color: THEME.GOLD_LIGHT,
          align: 'right',
          mono: true,
        });
        const statLine =
          rp.role === 'GK'
            ? `扑${rp.attributes.goalkeeping} 站${rp.attributes.positioning} 传${rp.attributes.passing}`
            : `速${rp.attributes.pace} 射${rp.attributes.shooting} 传${rp.attributes.passing} 防${rp.attributes.defending}`;
        drawText(ctx, statLine, 168, ry + 54, { size: 12, color: THEME.TX2 });
        drawText(
          ctx,
          isSel ? '已选中：请点击右侧老将完成交换' : this.selectedDropRosterId ? '点击立即与右侧已选老将交换' : `特质：${rp.traits?.join('·') || '均衡型'} · 点击选中`,
          168,
          ry + 82,
          { size: 11, bold: isSel || !!this.selectedDropRosterId, color: isSel || this.selectedDropRosterId ? THEME.GREEN : '#60A5FA' }
        );
        hits.add(82, ry, 384, 110, () => {
          if (this.selectedDropRosterId) {
            const res = league.recruitSeasonRewardToRoster(rp.id, this.selectedDropRosterId);
            if (res.ok) {
              this.notice = `交换成功！已将新秀编入常驻大名单`;
              this.selectedRewardId = null;
              this.selectedDropRosterId = null;
              actions.onToast?.('新秀已替换入俱乐部大名单！', THEME.GREEN);
              actions.onSave?.();
            } else {
              this.notice = res.reason || '交换失败';
            }
          } else {
            this.selectedRewardId = isSel ? null : rp.id;
          }
        });
      });
    }

    // 右栏：我的俱乐部 40 人大名单（含休赛期特训 + 新秀直接补充或满员替换）
    const roster = league.getClubRoster();
    const rosterCount = roster.length;
    drawChamferPanel(ctx, 500, 122, 716, 480, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `俱乐部大名单 (${rosterCount}/40) · 资金 ¥${league.getClubFunds()}万 · ${st.metaPointsTotal}pt`, 518, 144, {
      size: 13,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });

    if (this.selectedRewardId && rosterCount < 40) {
      drawButton(ctx, hits, 518, 566, 280, 28, `直接补充进大名单 (${rosterCount}/40) ▶`, () => {
        const res = league.recruitSeasonRewardToRoster(this.selectedRewardId!);
        if (res.ok) {
          this.notice = `新秀已直接补充进俱乐部大名单！`;
          this.selectedRewardId = null;
          actions.onToast?.('新秀已补充入俱乐部大名单！', THEME.GREEN);
          actions.onSave?.();
        } else {
          actions.onToast?.(res.reason || '操作失败', THEME.RED_LIGHT);
        }
      }, { variant: 'green', fontSize: 11 });
    }

    const focuses: Array<['auto' | 'attack' | 'playmake' | 'defense', string]> = [
      ['auto', '自动'],
      ['attack', '进攻'],
      ['playmake', '组织'],
      ['defense', '防守'],
    ];
    focuses.forEach(([fk, fl], fi) => {
      drawButton(ctx, hits, 932 + fi * 68, 132, 62, 24, fl, () => {
        this.trainFocus = fk;
      }, { active: this.trainFocus === fk, fontSize: 10 });
    });

    const trainedSet = new Set(st.seasonTrainedIds ?? []);
    const squad = [...(roster.length > 0 ? roster : club.squad)].sort((a, b) => b.ca - a.ca);
    squad.slice(0, 16).forEach((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = 516 + col * 346;
      const py = 172 + row * 52;
      const canSwap = !!this.selectedRewardId;
      const isDropSel = this.selectedDropRosterId === p.id;
      const isTrained = trainedSet.has(p.id);
      const paCap = p.pa ?? p.ca;
      const canTrain = !isTrained && st.metaPointsTotal >= 10 && p.ca < paCap;
      drawRoundRect(
        ctx,
        px,
        py,
        336,
        44,
        6,
        isDropSel ? 'rgba(20, 83, 45, 0.65)' : canSwap ? 'rgba(30, 58, 95, 0.45)' : 'rgba(14, 22, 40, 0.8)',
        isDropSel ? THEME.GOLD_LIGHT : canSwap ? THEME.GREEN : isTrained ? THEME.GOLD : THEME.BORDER
      );
      hits.add(px, py, 246, 44, () => {
        if (this.selectedRewardId) {
          const res = league.recruitSeasonRewardToRoster(this.selectedRewardId, p.id);
          if (res.ok) {
            this.notice = `交换成功！已将新秀编入常驻大名单`;
            this.selectedRewardId = null;
            this.selectedDropRosterId = null;
            actions.onToast?.('新秀已替换入俱乐部大名单！', THEME.GREEN);
            actions.onSave?.();
          } else {
            this.notice = res.reason || '交换失败';
          }
        } else {
          this.selectedDropRosterId = isDropSel ? null : p.id;
        }
      });
      drawBadge(ctx, px + 8, py + 13, 34, 18, p.role, tierColor(p.tier));
      drawText(ctx, p.name, px + 48, py + 15, { size: 12, bold: true });
      drawText(
        ctx,
        `进${p.seasonStats.goals} 助${p.seasonStats.assists}`,
        px + 48,
        py + 32,
        { size: 10, color: THEME.TX3 }
      );
      drawText(ctx, `CA ${p.ca}/${paCap}`, px + 244, py + 22, {
        size: 12,
        bold: true,
        color: p.ca >= paCap ? THEME.GOLD_LIGHT : '#7DD3FC',
        align: 'right',
        mono: true,
      });
      if (p.lastCaDelta && p.lastCaDelta !== 0) {
        drawText(
          ctx,
          p.lastCaDelta > 0 ? `▲+${p.lastCaDelta}` : `▼${p.lastCaDelta}`,
          px + 194,
          py + 22,
          { size: 11, bold: true, color: p.lastCaDelta > 0 ? THEME.GREEN : THEME.RED_LIGHT, align: 'right', mono: true }
        );
      }

      if (canSwap) {
        drawButton(ctx, hits, px + 252, py + 10, 76, 24, '替换 ▶', () => {
          const res = league.recruitSeasonRewardToRoster(this.selectedRewardId!, p.id);
          if (res.ok) {
            this.notice = `交换成功！已将新秀编入常驻大名单`;
            this.selectedRewardId = null;
            actions.onToast?.('新秀已替换入俱乐部大名单！', THEME.GREEN);
            actions.onSave?.();
          } else {
            this.notice = res.reason || '交换失败';
          }
        }, { variant: 'green', fontSize: 10 });
      } else if (isTrained) {
        drawBadge(ctx, px + 254, py + 12, 72, 20, '已特训 ✓', '#14532D', THEME.GREEN);
      } else {
        drawButton(ctx, hits, px + 252, py + 10, 76, 24, '特训 10pt', () => {
          const res = league.trainPlayer(p.id, this.trainFocus);
          if (res.ok) {
            const msg = `${p.name} 特训完成：${res.gainedText} (CA ${res.oldCA}→${res.newCA})`;
            this.notice = msg;
            actions.onToast?.(msg, THEME.GOLD_LIGHT);
            actions.onSave?.();
          } else {
            const err = res.reason || '特训失败';
            this.notice = err;
            actions.onToast?.(err, THEME.RED_LIGHT);
          }
        }, { variant: canTrain ? 'gold' : 'ghost', fontSize: 10 });
      }
    });

    // 底部操作按钮
    drawButton(ctx, hits, 64, 620, 200, 48, '返回建队主页', actions.onGoTitle, {
      variant: 'ghost',
      fontSize: 13,
      icon: 'home',
    });
    drawButton(ctx, hits, 280, 620, 230, 48, `教练天赋树 (${st.metaPointsTotal}pt)`, actions.onOpenMeta, {
      variant: 'primary',
      fontSize: 13,
      icon: 'talent',
    });
    drawButton(ctx, hits, 526, 620, 210, 48, '放弃班底 · 重抽开局', () => actions.onNewSeason(false), {
      variant: 'ghost',
      fontSize: 13,
    });
    drawButton(ctx, hits, 752, 620, 464, 48, '保留常驻班底 · 开启下赛季', () => actions.onNewSeason(true), {
      variant: 'gold',
      fontSize: 15,
      icon: 'play',
    });
  }
}
