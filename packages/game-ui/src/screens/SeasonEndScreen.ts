/**
 * 页面 6：赛季荣耀结算与休赛期整备（PITCH PRINT 报刊暖纸/档案风）
 * 2 阶段：赛季颁奖台 & 赛季宝箱 3 选 1 -> 休赛期引援交换 & 专项特训
 */

import { ACHIEVEMENTS } from '../../../core/src/Achievements';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { ArtAssetId, AssetLoader, getLeagueTierTrophyAssetId } from '../AssetLoader';
import { drawPlayerAvatar } from '../AvatarRenderer';
import {
  drawBadge,
  drawButton,
  drawDeltaBadge,
  drawFoilShimmer,
  drawPrintCard,
  drawRoundRect,
  drawStamp,
  drawStatBar,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  HitRegistry,
  tierColor,
  wrapTextLines,
} from '../CanvasKit';
import { drawClubCrest, drawTrophyIcon } from '../ClubVisuals';
import { easeOutBack } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, IconName } from '../VectorIcons';

export class SeasonEndScreen {
  private viewMode: 'ceremony' | 'roster_prep' = 'ceremony';
  private animClock = 0;
  private enterTimer = 0;
  private ceremonyBurstDone = false;
  private selectedRewardId: string | null = null;
  private selectedDropRosterId: string | null = null;
  private trainFocus: 'auto' | 'attack' | 'playmake' | 'defense' = 'auto';
  private memoryIdx = 0;
  private rosterPage = 0;
  private notice = '点选新秀与老将（顺序不限）即可一对一交换保留至下赛季';

  public resetIntro(): void {
    this.viewMode = 'ceremony';
    this.enterTimer = 0;
    this.ceremonyBurstDone = false;
    this.selectedRewardId = null;
    this.selectedDropRosterId = null;
    this.memoryIdx = 0;
    this.rosterPage = 0;
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

    const isChamp = summary?.isChampion ?? false;
    const isPromo = summary?.promotionStatus === 'promoted';

    drawPrintCard(ctx, 40, 28, 1200, 664, {
      paper: false,
      radius: 14,
      shadowOffset: 6,
      topBandColor: isChamp ? THEME.BRASS : isPromo ? THEME.LIME : THEME.VERMILION,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });

    if ((isChamp || isPromo) && !this.ceremonyBurstDone && this.enterTimer >= 0.18) {
      this.ceremonyBurstDone = true;
      SoundEngine.playFanfare();
      actions.onBurst?.(640, 160, THEME.GOLD_LIGHT);
      actions.onBurst?.(360, 220, isChamp ? '#FACC15' : THEME.GREEN);
      actions.onBurst?.(920, 220, isChamp ? '#FACC15' : THEME.GREEN);
    }

    if (isChamp || isPromo) {
      drawPrintCard(ctx, 74, 46, 56, 54, { paper: true, radius: 10, shadowOffset: 3, strokeColor: THEME.INK_LINE, lineWidth: 2 });
      const tierTrophyImg = AssetLoader.get(getLeagueTierTrophyAssetId(summary?.newTier ? Math.max(1, summary.newTier) : st.currentTier));
      if (tierTrophyImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(78, 50, 48, 46, 6);
        ctx.clip();
        ctx.drawImage(tierTrophyImg, 78, 50, 48, 46);
        ctx.restore();
      } else {
        drawTrophyIcon(ctx, 102, 73, 30);
      }
    } else {
      drawClubCrest(ctx, 102, 73, 24, club);
    }

    drawText(ctx, isChamp ? `${club.name} · ${summary?.tierName ?? '联赛'} 冠军` : `${club.name} · 第 ${st.seasonNumber} 赛季结算`, 146, 62, {
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
        146,
        88,
        { size: 12.5, color: summary.promotionStatus === 'promoted' ? THEME.LIME : summary.promotionStatus === 'relegated' ? '#FCA5A5' : THEME.TX2 }
      );
    }

    // 顶栏阶段切换按钮
    drawButton(ctx, hits, 814, 52, 136, 32, '1. 赛季颁奖与宝箱', () => {
      this.viewMode = 'ceremony';
    }, { active: this.viewMode === 'ceremony', fontSize: 12 });
    drawButton(ctx, hits, 958, 52, 136, 32, '2. 休赛期引援特训', () => {
      this.viewMode = 'roster_prep';
    }, { active: this.viewMode === 'roster_prep', fontSize: 12 });

    drawIcon(ctx, 'trophy', 1114, 68, 14, THEME.GOLD_LIGHT);
    drawText(ctx, `成就 ${st.hallOfFame?.unlockedAchievements.length ?? 0}/${ACHIEVEMENTS.length}`, 1216, 68, {
      size: 12.5,
      bold: true,
      color: THEME.TX2,
      align: 'right',
    });

    if (summary?.retiredLegend) {
      const rl = summary.retiredLegend;
      const cs = summary.captainSuccessor;
      const bannerText = cs?.chosenPlayerName
        ? `游子归家 · 传奇挂靴：#10 ${rl.name} 转任主教练 · 衣钵传人【${cs.chosenPlayerName}】已觉醒金标【${cs.grantedTrait}】！`
        : `游子归家 · 传奇挂靴转教练：#10 ${rl.name} (${rl.age}岁 · 本季 ${rl.appearances}场 ${rl.goals}球${rl.assists}助) 正式退役接过教鞭，传承【老队长的怒吼】+50 Meta！`;
      const bannerLines = wrapTextLines(ctx, bannerText, 1124, FONT.LABEL, true, 2, true);
      const bannerH = bannerLines.length > 1 ? 38 : 26;
      drawRoundRect(ctx, 64, 106, 1152, bannerH, 6, THEME.BG_PITCH_ALT, THEME.BRASS, 1.8);
      if (bannerLines.length <= 1) {
        drawText(ctx, bannerText, 640, 119, { token: 'LABEL', bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
      } else {
        drawWrappedText(ctx, bannerText, 78, 110, 1124, 16, {
          token: 'LABEL',
          bold: true,
          color: THEME.GOLD_LIGHT,
          maxLines: 2,
        });
      }
    }

    if (this.viewMode === 'ceremony') {
      this.renderCeremonyView(ctx, hits, league, actions);
    } else {
      this.renderRosterPrepView(ctx, hits, league, actions);
    }

    if (summary?.captainSuccessor?.pending) {
      this.renderCaptainSuccessorModal(ctx, hits, league, actions);
    }
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
    const club = league.getUserClub();
    const summary = st.lastSummary;
    const isChamp = summary?.isChampion ?? false;
    const isPromo = summary?.promotionStatus === 'promoted';

    const panelTop = summary?.retiredLegend ? 150 : 118;
    const panelH = summary?.retiredLegend ? 454 : 486;

    // 左栏：赛季个人荣誉颁奖台（PITCH PRINT 暖纸荣誉卡 + 球员头像/队徽）
    drawPrintCard(ctx, 64, panelTop, 464, panelH, {
      paper: false,
      radius: 12,
      shadowOffset: 4,
      topBandColor: THEME.BRASS,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.2,
    });
    drawText(ctx, '赛季个人荣誉殿堂 · SEASON AWARDS', 84, panelTop + 26, { size: 14.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(
      ctx,
      isChamp ? '冠军荣耀加冕！全队载入俱乐部史册' : isPromo ? '成功冲级！下赛季迎战更强对手' : '赛季征程圆满收官，总结得失再出发',
      84,
      panelTop + 48,
      { size: 12, color: isChamp ? THEME.GOLD_LIGHT : isPromo ? THEME.LIME : THEME.TX2 }
    );

    const findSquadPlayer = (name?: string) => (name ? club.squad.find(p => p.name === name) : undefined);
    const findClubByName = (name?: string) => (name ? st.clubs.find(c => c.name === name) : undefined);

    const awards: Array<{
      badge: string;
      title: string;
      value: string;
      sub: string;
      color: string;
      trophyArt: ArtAssetId;
      playerName?: string;
      clubName?: string;
    }> = [
      {
        badge: '球队 MVP',
        title: summary?.seasonMVP ? `${summary.seasonMVP.name} (${summary.seasonMVP.role})` : '全队均衡发挥',
        value: summary?.seasonMVP ? `CA ${summary.seasonMVP.ca}` : '-',
        sub: summary?.seasonMVP ? `${summary.seasonMVP.goals} 球 · ${summary.seasonMVP.assists} 助` : '无统计数据',
        color: THEME.BRASS,
        trophyArt: 'trophy_golden_ball',
        playerName: summary?.seasonMVP?.name,
        clubName: club.name,
      },
      {
        badge: '联赛金靴',
        title: summary?.topScorer ? summary.topScorer.name : '暂无金靴',
        value: summary?.topScorer ? `${summary.topScorer.goals} 球` : '-',
        sub: summary?.topScorer ? summary.topScorer.clubName : '本赛季暂无进球记录',
        color: THEME.VERMILION,
        trophyArt: 'trophy_golden_boot',
        playerName: summary?.topScorer?.name,
        clubName: summary?.topScorer?.clubName,
      },
      {
        badge: '联赛助攻王',
        title: summary?.topAssister ? summary.topAssister.name : '暂无助攻王',
        value: summary?.topAssister ? `${summary.topAssister.assists} 助` : '-',
        sub: summary?.topAssister ? summary.topAssister.clubName : '本赛季暂无助攻记录',
        color: THEME.COBALT,
        trophyArt: 'trophy_tactical_master',
        playerName: summary?.topAssister?.name,
        clubName: summary?.topAssister?.clubName,
      },
      {
        badge: '金手套门神',
        title: summary?.goldenGlove ? summary.goldenGlove.name : '暂无门神',
        value: summary?.goldenGlove ? `${summary.goldenGlove.cleanSheets} 零封` : '-',
        sub: summary?.goldenGlove ? summary.goldenGlove.clubName : '本赛季暂无零封记录',
        color: '#15803D',
        trophyArt: 'trophy_golden_glove',
        playerName: summary?.goldenGlove?.name,
        clubName: summary?.goldenGlove?.clubName,
      },
    ];

    awards.forEach((aw, i) => {
      const enterP = easeOutBack(Math.max(0, Math.min(1, (this.enterTimer - i * 0.08) / 0.35)));
      const ay = panelTop + 72 + i * 96 + (1 - enterP) * 16;
      const awH = 84;
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, enterP);
      drawPrintCard(ctx, 82, ay, 428, awH, {
        paper: true,
        radius: 9,
        shadowOffset: 4,
        topBandColor: aw.color,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2,
      });

      const dp = aw.clubName === club.name ? findSquadPlayer(aw.playerName) : undefined;
      const awClub = findClubByName(aw.clubName);
      if (dp) {
        drawPlayerAvatar(ctx, 94, ay + 12, 48, 60, dp, club, { radius: 6 });
      } else if (awClub) {
        drawRoundRect(ctx, 94, ay + 14, 48, 56, 8, THEME.PAPER_WARM, THEME.INK_LINE, 1.4);
        drawClubCrest(ctx, 118, ay + 42, 18, awClub);
      } else {
        const awImg = AssetLoader.get(aw.trophyArt);
        if (awImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(94, ay + 14, 48, 56, 8);
          ctx.clip();
          ctx.drawImage(awImg, 94, ay + 14, 48, 56);
          ctx.restore();
          drawRoundRect(ctx, 94, ay + 14, 48, 56, 8, undefined, THEME.INK_LINE, 1.5);
        } else {
          drawRoundRect(ctx, 94, ay + 14, 48, 56, 8, THEME.BG_DEEP, THEME.INK_LINE, 1.4);
          drawIcon(ctx, 'trophy', 118, ay + 42, 20, aw.color);
        }
      }

      const miniTrophy = AssetLoader.get(aw.trophyArt);
      if (miniTrophy && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(244, ay + 12, 22, 22, 4);
        ctx.clip();
        ctx.drawImage(miniTrophy, 244, ay + 12, 22, 22);
        ctx.restore();
        drawRoundRect(ctx, 244, ay + 12, 22, 22, 4, undefined, THEME.INK_LINE, 1);
      }
      drawBadge(ctx, 152, ay + 14, 86, 20, aw.badge, THEME.BG_DEEP, THEME.LIME);
      drawText(ctx, fitText(ctx, aw.title, 174, 15.5, true), 152, ay + 48, { size: 15.5, bold: true, color: THEME.PAPER_INK });
      drawText(ctx, fitText(ctx, aw.sub, 174, 12), 152, ay + 68, { size: 12, color: THEME.PAPER_MUTED });

      drawRoundRect(ctx, 412, ay + 24, 86, 38, 7, THEME.BG_DEEP, THEME.INK_LINE, 1.6);
      drawText(ctx, aw.value, 455, ay + 43, { size: 16, bold: true, italic: true, color: THEME.LIME, align: 'center', mono: true });
      ctx.restore();
    });

    // 右栏上半：Meta 点数结算明细
    const metaTop = panelTop;
    drawPrintCard(ctx, 544, metaTop, 672, 108, {
      paper: false,
      radius: 12,
      shadowOffset: 4,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawText(ctx, 'Meta 教练点数结算明细', 564, metaTop + 20, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `当前总计：${st.metaPointsTotal} pt`, 1196, metaTop + 20, { size: 14, bold: true, color: THEME.LIME, align: 'right', mono: true });

    const bd = summary?.metaBreakdown;
    const items: Array<[string, string, string]> = [
      ['排名基础奖励', `+${bd?.rankBase ?? summary?.metaPointsEarned ?? 0} pt`, THEME.PAPER_INK],
      ['冲级突破加奖', `+${bd?.promoBonus ?? 0} pt`, (bd?.promoBonus ?? 0) > 0 ? '#15803D' : THEME.PAPER_MUTED],
      ['冠军/故事线', `+${(bd?.champBonus ?? 0) + (bd?.storyBonus ?? 0)} pt`, ((bd?.champBonus ?? 0) + (bd?.storyBonus ?? 0)) > 0 ? THEME.VERMILION : THEME.PAPER_MUTED],
      ['本季合计入账', `+${summary?.metaPointsEarned ?? 0} pt`, THEME.VERMILION],
    ];
    items.forEach(([lbl, val, col], idx) => {
      const ix = 564 + idx * 160;
      drawPrintCard(ctx, ix, metaTop + 38, 148, 58, {
        paper: true,
        radius: 8,
        shadowOffset: 3,
        topBandColor: idx === 3 ? THEME.BRASS : undefined,
        strokeColor: THEME.INK_LINE,
        lineWidth: 1.8,
      });
      drawText(ctx, lbl, ix + 74, metaTop + 55, { size: 12, bold: true, color: THEME.PAPER_MUTED, align: 'center' });
      drawText(ctx, val, ix + 74, metaTop + 78, { size: 16.5, bold: true, italic: true, color: col, align: 'center', mono: true });
    });

    // 右栏中部：赛季记忆明信片（真实暖纸明信片 + 邮戳）
    const memories = summary?.memories ?? [];
    if (memories.length > 0) {
      this.memoryIdx = ((this.memoryIdx % memories.length) + memories.length) % memories.length;
    } else {
      this.memoryIdx = 0;
    }
    const topMem = memories[this.memoryIdx];
    const memAccent = topMem?.isPainful ? THEME.VERMILION : THEME.BRASS;
    const memY = metaTop + 120;
    drawPrintCard(ctx, 544, memY, 672, 126, {
      paper: true,
      radius: 12,
      shadowOffset: 4,
      topBandColor: memAccent,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.2,
    });
    drawText(ctx, '赛季记忆明信片 · SEASON POSTCARD', 564, memY + 22, { size: 13.5, bold: true, color: THEME.PAPER_INK });
    if (topMem) {
      drawBadge(ctx, 838, memY + 12, 80, 20, topMem.badge, THEME.BG_DEEP, THEME.LIME);
      if (topMem.contextTag) {
        drawBadge(ctx, 924, memY + 12, 82, 20, topMem.contextTag, THEME.PAPER_WARM, THEME.PAPER_INK);
      }
      if (memories.length > 1) {
        drawButton(ctx, hits, 1086, memY + 11, 28, 22, '◀', () => {
          this.memoryIdx = (this.memoryIdx - 1 + memories.length) % memories.length;
        }, { variant: 'ghost', fontSize: 12 });
        drawText(ctx, `${this.memoryIdx + 1}/${memories.length}`, 1138, memY + 22, {
          size: 12,
          bold: true,
          color: THEME.PAPER_INK,
          align: 'center',
          mono: true,
        });
        drawButton(ctx, hits, 1162, memY + 11, 28, 22, '▶', () => {
          this.memoryIdx = (this.memoryIdx + 1) % memories.length;
        }, { variant: 'ghost', fontSize: 12 });
      } else {
        drawStamp(ctx, topMem.isPainful ? '铭记复仇' : '封存荣誉', 1154, memY + 62, memAccent, -10, 0.72);
      }
      drawText(ctx, topMem.title, 564, memY + 48, { size: 15, bold: true, color: THEME.PAPER_INK });
      drawWrappedText(ctx, topMem.summary, 564, memY + 68, 530, 17, { size: 12, color: THEME.PAPER_MUTED, maxLines: 2 });
      const metaChips: string[] = [];
      if (topMem.userFormation && topMem.oppFormation) {
        metaChips.push(`${topMem.userFormation} vs ${topMem.oppFormation}${topMem.oppStyle ? `(${topMem.oppStyle})` : ''}`);
      }
      if (topMem.xgText) metaChips.push(topMem.xgText);
      if (topMem.possessionText) metaChips.push(topMem.possessionText);
      if (topMem.oppPlayerName) metaChips.push(`敌方焦点:${topMem.oppPlayerName}`);
      if (topMem.assistPlayerName) metaChips.push(`助攻:${topMem.assistPlayerName}`);
      if (metaChips.length > 0) {
        const shownChips = metaChips.slice(0, 3);
        const extra = metaChips.length > 3 ? ` · +${metaChips.length - 3}` : '';
        drawText(ctx, fitText(ctx, shownChips.join('  ·  ') + extra, 632, 12, false, true), 564, memY + 108, {
          size: 12,
          bold: true,
          color: THEME.COBALT,
        });
      }
    } else {
      drawText(ctx, '本赛季波澜不惊 · 期待下赛季书写绝杀与逆转名场面', 880, memY + 68, {
        size: 13,
        color: THEME.PAPER_MUTED,
        align: 'center',
      });
    }

    // 右栏下半：赛季结算专属宝箱（PITCH PRINT 荣誉档案锦囊 3 选 1）
    const chestY = memY + 138;
    const chestH = panelTop + panelH - chestY;
    drawPrintCard(ctx, 544, chestY, 672, chestH, {
      paper: false,
      radius: 12,
      shadowOffset: 4,
      topBandColor: THEME.BRASS,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.2,
    });
    drawText(ctx, '赛季结算荣誉锦囊 · 请任选 1 项带入下赛季', 564, chestY + 24, { size: 14, bold: true, color: THEME.GOLD_LIGHT });

    const bonusOpts = summary?.seasonBonusOptions ?? [];
    const claimedId = summary?.seasonBonusClaimedId;

    if (claimedId) {
      drawPrintCard(ctx, 564, chestY + 42, 632, chestH - 56, {
        paper: true,
        radius: 10,
        shadowOffset: 4,
        topBandColor: THEME.LIME,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2,
      });
      drawBadge(ctx, 800, chestY + 58, 160, 26, '荣誉锦囊已领取 ✓', THEME.BG_DEEP, THEME.LIME);
      drawText(ctx, summary?.seasonBonusSummary || '赛季奖励已发放！', 880, chestY + 112, {
        size: 16,
        bold: true,
        color: THEME.PAPER_INK,
        align: 'center',
      });
      drawButton(ctx, hits, 720, chestY + chestH - 66, 320, 40, '下一步：休赛期引援与特训 ▶', () => {
        this.viewMode = 'roster_prep';
      }, { variant: 'gold', fontSize: 13 });
    } else if (bonusOpts.length > 0) {
      const colors = [THEME.VIOLET, THEME.COBALT, THEME.VERMILION];
      const icons: IconName[] = ['sparkle', 'star', 'trophy'];
      bonusOpts.forEach((opt, oi) => {
        const bx = 564 + oi * 214;
        const by = chestY + 42;
        const bw = 202;
        const bh = Math.max(158, chestH - 54);
        const col = colors[oi % colors.length];
        const hovered = hits.isHovered(bx, by, bw, bh);

        drawPrintCard(ctx, bx, by, bw, bh, {
          paper: true,
          radius: 10,
          shadowOffset: hovered ? 6 : 4,
          topBandColor: col,
          strokeColor: hovered ? THEME.LIME : THEME.INK_LINE,
          lineWidth: hovered ? 2.8 : 2,
        });
        drawBadge(ctx, bx + 12, by + 14, 118, 20, opt.badge, THEME.BG_DEEP, THEME.LIME);
        drawIcon(ctx, icons[oi % icons.length], bx + bw - 24, by + 24, 18, col);
        drawText(ctx, fitText(ctx, opt.title, bw - 24, 14, true, true), bx + 12, by + 46, { size: 14, bold: true, color: THEME.PAPER_INK });
        drawWrappedText(ctx, opt.subtitle, bx + 12, by + 64, bw - 24, 15.5, { size: 12, color: THEME.PAPER_MUTED, maxLines: 3 });

        const claim = () => {
          const res = league.pickSeasonBonusReward(opt.id);
          if (res.ok) {
            SoundEngine.playFanfare();
            actions.onBurst?.(bx + bw / 2, by + bh / 2, col);
            actions.onToast?.(res.summary || '赛季荣誉锦囊已领取！', col);
            actions.onSave?.();
          }
        };
        drawButton(ctx, hits, bx + 12, by + bh - 40, bw - 24, 30, '开启锦囊', claim, { variant: 'gold', fontSize: 12, icon: 'sparkle' });
        hits.add(bx, by, bw, bh, claim);
      });
    } else {
      drawText(ctx, '点击右下角进入休赛期引援与特训', 880, chestY + 110, { size: 14, color: THEME.TX2, align: 'center' });
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

    // 左栏：赛季末引援新秀
    drawPrintCard(ctx, 64, 122, 420, 480, { paper: false, radius: 10, shadowOffset: 4, topBandColor: THEME.BRASS, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawText(ctx, `赛季末引援新秀 (${rewards.length}) · 选后点右侧老将交换`, 82, 146, {
      size: 13,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(ctx, this.notice, 82, 168, { size: 12, color: THEME.LIME });

    if (rewards.length === 0) {
      drawRoundRect(ctx, 82, 196, 384, 110, 8, THEME.BG_DEEP, THEME.INK_LINE, 1.5);
      drawText(ctx, '本赛季引援新秀已全部完成交换，或可直接保留班底开启下赛季', 274, 251, {
        size: 12,
        color: THEME.TX3,
        align: 'center',
      });
    } else {
      rewards.forEach((rp, idx) => {
        const ry = 194 + idx * 124;
        const isSel = this.selectedRewardId === rp.id;

        drawPrintCard(ctx, 82, ry, 384, 110, {
          paper: true,
          radius: 9,
          shadowOffset: isSel ? 6 : 3,
          topBandColor: isSel ? THEME.LIME : tierColor(rp.tier),
          strokeColor: isSel ? THEME.LIME : THEME.INK_LINE,
          lineWidth: isSel ? 2.5 : 2,
        });

        drawPlayerAvatar(ctx, 94, ry + 14, 62, 82, rp, club, { radius: 6 });

        drawBadge(ctx, 168, ry + 14, 24, 18, rp.tier, tierColor(rp.tier), rp.tier === 'S' ? THEME.PAPER_INK : '#FFFFFF');
        drawBadge(ctx, 196, ry + 14, 38, 18, rp.role, THEME.INK_LINE, THEME.PAPER_CREAM);
        drawText(ctx, rp.name, 240, ry + 23, { size: 16, bold: true, color: THEME.PAPER_INK });
        drawText(ctx, `CA ${rp.ca}`, 450, ry + 23, {
          size: 16,
          bold: true,
          color: THEME.VERMILION,
          align: 'right',
          mono: true,
        });
        const statLine =
          rp.role === 'GK'
            ? `扑${rp.attributes.goalkeeping} 站${rp.attributes.positioning} 传${rp.attributes.passing}`
            : `速${rp.attributes.pace} 射${rp.attributes.shooting} 传${rp.attributes.passing} 防${rp.attributes.defending}`;
        drawText(ctx, statLine, 168, ry + 54, { size: 12, color: THEME.PAPER_MUTED });
        drawText(
          ctx,
          isSel ? '已选中：请点击右侧老将完成交换' : this.selectedDropRosterId ? '点击立即与右侧已选老将交换' : `特质：${rp.traits?.join('·') || '均衡型'} · 点击选中`,
          168,
          ry + 82,
          { size: 12, bold: isSel || !!this.selectedDropRosterId, color: isSel || this.selectedDropRosterId ? '#15803D' : THEME.COBALT }
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

    // 右栏：我的俱乐部 40 人大名单
    const roster = league.getClubRoster();
    const rosterCount = roster.length;
    drawPrintCard(ctx, 500, 122, 716, 480, { paper: false, radius: 10, shadowOffset: 4, strokeColor: THEME.INK_LINE, lineWidth: 2 });
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
      }, { variant: 'green', fontSize: 12 });
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
      }, { active: this.trainFocus === fk, fontSize: 12 });
    });

    const trainedSet = new Set(st.seasonTrainedIds ?? []);
    const squad = [...(roster.length > 0 ? roster : club.squad)].sort((a, b) => b.ca - a.ca);
    const rPerPage = 10;
    const rPages = Math.max(1, Math.ceil(squad.length / rPerPage));
    if (this.rosterPage >= rPages) this.rosterPage = rPages - 1;
    const visibleSquad = squad.slice(this.rosterPage * rPerPage, (this.rosterPage + 1) * rPerPage);
    if (rPages > 1) {
      drawButton(ctx, hits, 980, 566, 76, 30, '◀ 上页', () => {
        this.rosterPage = Math.max(0, this.rosterPage - 1);
      }, { disabled: this.rosterPage === 0, fontSize: 12 });
      drawText(ctx, `${this.rosterPage + 1}/${rPages}`, 1084, 581, { size: 12, color: THEME.TX2, align: 'center', mono: true });
      drawButton(ctx, hits, 1116, 566, 76, 30, '下页 ▶', () => {
        this.rosterPage = Math.min(rPages - 1, this.rosterPage + 1);
      }, { disabled: this.rosterPage >= rPages - 1, fontSize: 12 });
    }
    visibleSquad.forEach((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = 516 + col * 346;
      const py = 174 + row * 74;
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
        46,
        6,
        isDropSel ? THEME.BG_PITCH_ALT : canSwap ? THEME.BG_PANEL : THEME.BG_CARD_DARK,
        isDropSel ? THEME.LIME : canSwap ? THEME.LIME : isTrained ? THEME.BRASS : THEME.INK_LINE,
        isDropSel || canSwap ? 2 : 1.5
      );
      hits.add(px, py, 246, 46, () => {
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
      drawBadge(ctx, px + 8, py + 13, 34, 20, p.role, tierColor(p.tier));
      drawText(ctx, fitText(ctx, p.name, 94, FONT.LABEL, true, true), px + 48, py + 15, { token: 'LABEL', bold: true });
      drawText(
        ctx,
        `进${p.seasonStats.goals} 助${p.seasonStats.assists}`,
        px + 48,
        py + 32,
        { token: 'LABEL', color: THEME.TX3 }
      );
      if (p.lastCaDelta && p.lastCaDelta !== 0) {
        drawDeltaBadge(ctx, p.lastCaDelta, px + 146, py + 23);
      }
      drawText(ctx, `${p.ca}/${paCap}`, px + 244, py + 16, {
        token: 'LABEL',
        bold: true,
        color: p.ca >= paCap ? THEME.GOLD_LIGHT : THEME.LIME,
        align: 'right',
        mono: true,
      });
      drawStatBar(ctx, p.ca, Math.max(1, paCap), px + 196, py + 30, 48, 4, p.ca >= paCap ? THEME.GOLD_LIGHT : THEME.LIME);

      if (canSwap) {
        drawButton(ctx, hits, px + 252, py + 11, 76, 24, '替换 ▶', () => {
          const res = league.recruitSeasonRewardToRoster(this.selectedRewardId!, p.id);
          if (res.ok) {
            this.notice = `交换成功！已将新秀编入常驻大名单`;
            this.selectedRewardId = null;
            actions.onToast?.('新秀已替换入俱乐部大名单！', THEME.GREEN);
            actions.onSave?.();
          } else {
            this.notice = res.reason || '交换失败';
          }
        }, { variant: 'green', fontSize: 12 });
      } else if (isTrained) {
        drawBadge(ctx, px + 254, py + 13, 72, 20, '已特训 ✓', THEME.BG_DEEP, THEME.LIME);
      } else {
        drawButton(ctx, hits, px + 252, py + 11, 76, 24, '特训 10pt', () => {
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
        }, { variant: canTrain ? 'gold' : 'ghost', fontSize: 12 });
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

  private renderCaptainSuccessorModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onSave?: () => void;
      onToast?: (msg: string, color?: string) => void;
      onBurst?: (x: number, y: number, color?: string) => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const cs = st.lastSummary?.captainSuccessor;
    if (!cs || !cs.pending) return;

    const roster = league.getClubRoster();
    const candidates = cs.candidateIds
      .map(id => club.squad.find(p => p.id === id) ?? roster.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (candidates.length === 0) return;

    ctx.save();
    ctx.fillStyle = 'rgba(7, 16, 12, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    ctx.restore();
    hits.add(0, 0, THEME.W, THEME.H, () => {});

    const mx = 110;
    const my = 88;
    const mw = 1060;
    const mh = 544;
    drawPrintCard(ctx, mx, my, mw, mh, {
      paper: false,
      radius: 14,
      shadowOffset: 8,
      topBandColor: THEME.BRASS,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });

    drawBadge(ctx, mx + 32, my + 24, 152, 24, '传奇挂靴 · 薪火相传', THEME.BG_DEEP, THEME.GOLD_LIGHT);
    drawText(ctx, `#10 ${cs.captainName} 退役传承 · 请亲手钦点 1 名「衣钵传人」`, mx + 198, my + 36, {
      size: 21,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(
      ctx,
      `老队长已正式转任主教练，以下 ${candidates.length} 名队内青年才俊翘首以盼：选中后永久继承核心属性 +3、PA 突破与金标特质！`,
      mx + 32,
      my + 68,
      { size: 12.5, color: THEME.TX2 }
    );

    const count = candidates.length;
    const gap = 18;
    const cw = Math.min(242, Math.floor((mw - 64 - gap * (count - 1)) / count));
    const totalCardsW = cw * count + gap * (count - 1);
    const startX = mx + Math.floor((mw - totalCardsW) / 2);
    const cy = my + 98;
    const ch = 414;

    candidates.forEach((p, idx) => {
      const cx = startX + idx * (cw + gap);
      const hovered = hits.isHovered(cx, cy, cw, ch);
      drawPrintCard(ctx, cx, cy, cw, ch, {
        paper: true,
        radius: 12,
        shadowOffset: hovered ? 7 : 4,
        topBandColor: hovered ? THEME.LIME : THEME.BRASS,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2.2,
      });

      drawPlayerAvatar(ctx, cx + (cw - 76) / 2, cy + 16, 76, 92, p, club, { radius: 8 });
      drawBadge(ctx, cx + 14, cy + 118, 28, 20, p.tier, tierColor(p.tier), p.tier === 'S' ? THEME.PAPER_INK : '#FFFFFF');
      drawBadge(ctx, cx + 46, cy + 118, 38, 20, p.role, THEME.INK_LINE, THEME.PAPER_CREAM);
      drawBadge(ctx, cx + cw - 62, cy + 118, 48, 20, `${p.age}岁`, THEME.PAPER_WARM, THEME.PAPER_INK);

      drawText(ctx, p.name, cx + cw / 2, cy + 154, {
        size: 16,
        bold: true,
        color: THEME.PAPER_INK,
        align: 'center',
      });
      drawText(ctx, `当前 CA ${p.ca}  ·  潜力 PA ${p.pa ?? p.ca}`, cx + cw / 2, cy + 178, {
        size: 12,
        bold: true,
        color: THEME.COBALT,
        align: 'center',
        mono: true,
      });

      const statLine = p.role === 'GK'
        ? `扑${p.attributes.goalkeeping} 站${p.attributes.positioning} 传${p.attributes.passing}`
        : `速${p.attributes.pace} 射${p.attributes.shooting} 传${p.attributes.passing} 防${p.attributes.defending}`;
      drawText(ctx, statLine, cx + cw / 2, cy + 200, { size: 12, color: THEME.PAPER_MUTED, align: 'center' });

      const hasMaster = (p.goldTraits ?? []).includes('大赛先生');
      const nextGold = !hasMaster ? '大赛先生' : !(p.goldTraits ?? []).includes('远射重炮') ? '远射重炮' : '球场领袖';
      const isDefRole = p.role === 'CB' || p.role === 'LB' || p.role === 'RB' || p.role === 'LWB' || p.role === 'RWB' || p.role === 'CDM';
      const mainAttr = isDefRole ? '防守+3' : p.role === 'GK' ? '门将+3' : '射门+3';

      drawRoundRect(ctx, cx + 14, cy + 220, cw - 28, 128, 8, THEME.PAPER_WARM, THEME.INK_LINE, 1.4);
      drawText(ctx, '继承老队长衣钵加成', cx + cw / 2, cy + 238, { size: 12, bold: true, color: THEME.PAPER_INK, align: 'center' });
      drawText(ctx, `• 传球+3 · 冷静+3 · ${mainAttr}`, cx + 24, cy + 262, { size: 12, color: '#15803D' });
      drawText(ctx, `• 潜力上限 PA 突破提升`, cx + 24, cy + 284, { size: 12, color: THEME.COBALT });
      drawText(ctx, `• 觉醒金标【${nextGold}】`, cx + 24, cy + 306, { size: 12, bold: true, color: THEME.VERMILION });
      drawText(ctx, `• 永久铭刻「衣钵传人」`, cx + 24, cy + 328, { size: 12, color: '#9A6B12' });

      const pick = () => {
        const res = league.selectCaptainSuccessor(p.id);
        if (res.ok) {
          SoundEngine.playFanfare();
          actions.onBurst?.(cx + cw / 2, cy + ch / 2, THEME.GOLD_LIGHT);
          actions.onToast?.(`${res.playerName} 已继承梅利纳衣钵，觉醒金标【${res.grantedTrait}】！`, THEME.GOLD_LIGHT);
          actions.onSave?.();
        }
      };
      drawButton(ctx, hits, cx + 16, cy + ch - 52, cw - 32, 36, '钦点接班 ▶', pick, {
        variant: 'gold',
        fontSize: 13,
        icon: 'star',
      });
      hits.add(cx, cy, cw, ch, pick);
    });
  }
}
