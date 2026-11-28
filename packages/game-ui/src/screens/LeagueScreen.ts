/**
 * 页面 2B：联赛赛程与积分榜中心（PITCH PRINT 风格 · 8 列积分榜 + >=44px 行高 + >=13px 字号）
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawNavRail,
  drawPrintCard,
  drawRankTile,
  drawRoundRect,
  drawText,
  fitText,
  HitRegistry,
  NavRailTab,
} from '../CanvasKit';
import { drawClubCrest } from '../ClubVisuals';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

export class LeagueScreen {
  private standingsScroll = 0;
  private rightTab: 'standings' | 'stats' = 'standings';
  private toastMsg = '';

  public onWheel(deltaY: number): boolean {
    if (this.rightTab !== 'standings') return false;
    const maxScroll = 9; // 18队显示9行 -> 最多滚动9行
    const step = deltaY > 0 ? 1 : -1;
    const next = Math.max(0, Math.min(maxScroll, this.standingsScroll + step));
    if (next !== this.standingsScroll) {
      this.standingsScroll = next;
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
      onSave?: () => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const standings = league.getStandings();
    const tierInfo = league.getCurrentTierInfo();
    const diffStars = '★'.repeat(8 - tierInfo.tier) + '☆'.repeat(tierInfo.tier - 1);
    const nextFx = league.getUserCurrentFixture();

    drawBroadcastHeader(ctx, hits, {
      kicker: `LEAGUE & FIXTURES · SEASON ${st.seasonNumber} (${diffStars})`,
      title: `${tierInfo.name} · 赛程与积分榜`,
      club,
      badge: `第 ${st.currentRound}/${league.getTotalRegularRounds()} 轮`,
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
      rightAction: nextFx
        ? { label: '进入比赛日', icon: 'play', variant: 'gold', onClick: actions.onStartMatch }
        : { label: '返回门户', variant: 'ghost', onClick: () => actions.onNavigate('portal') },
    });

    drawNavRail(ctx, hits, 'league', actions.onNavigate);

    // ==================== 左栏 (x: 96..556, w: 460)：赛程与近期战果 ====================
    drawPrintCard(ctx, 96, 80, 460, 624, {
      paper: false,
      radius: 12,
      shadowOffset: 4,
      strokeColor: THEME.BORDER_GOLD,
      lineWidth: 1.5,
    });

    const userRankIdx = standings.findIndex(r => r.isUser);
    const userRow = standings[userRankIdx];
    drawText(ctx, '本队赛季赛程与战绩', 116, 104, { size: 16, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, 504, 88, 34, 34, '?', () => {
      league.resetTutorial();
      this.toastMsg = '已重置新手引导，返回对应页面将重新弹出提示';
      actions.onSave?.();
    }, { variant: 'ghost', fontSize: 13 });

    // 顶部本队排名概览暖纸卡
    drawPrintCard(ctx, 114, 128, 424, 56, {
      paper: true,
      radius: 8,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 1.5,
    });
    drawText(ctx, `当前排名 第 ${userRankIdx + 1} 名`, 128, 146, { size: 15, bold: true, color: THEME.PAPER_INK });
    drawText(
      ctx,
      userRow ? `${userRow.points} 积分 · ${userRow.won}胜 ${userRow.drawn}平 ${userRow.lost}负 · 净胜 ${userRow.gd >= 0 ? '+' : ''}${userRow.gd}` : '尚未开赛',
      128,
      168,
      { size: 12.5, color: THEME.PAPER_MUTED }
    );
    const zoneTag =
      tierInfo.tier === 1 ? '第1级·争冠/后3降' :
      tierInfo.tier === 7 ? '第7级·前3升' :
      `前${tierInfo.promoteCount}升·后${tierInfo.relegateCount}降`;
    drawBadge(ctx, 408, 142, 118, 26, zoneTag, THEME.BG_PANEL, THEME.GOLD_LIGHT);

    const userFixtures = st.fixtures
      .filter(f => f.homeClubId === club.id || f.awayClubId === club.id)
      .sort((a, b) => a.round - b.round);
    const upcoming = userFixtures.filter(f => !f.played).slice(0, 5);
    const recent = userFixtures.filter(f => f.played).slice(-4).reverse();

    // 上半：接下来 5 轮赛程预告
    drawText(ctx, '即将迎战（未来赛程）', 116, 206, { size: 14, bold: true, color: THEME.LIME });
    if (upcoming.length === 0) {
      drawRoundRect(ctx, 114, 224, 424, 180, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, '本赛季常规赛程已全部结束', 326, 314, { size: 13.5, color: THEME.TX3, align: 'center' });
    } else {
      upcoming.forEach((fx, idx) => {
        const ry = 224 + idx * 46;
        const isHome = fx.homeClubId === club.id;
        const oppId = isHome ? fx.awayClubId : fx.homeClubId;
        const opp = st.clubs.find(c => c.id === oppId);
        const oppRank = standings.findIndex(r => r.clubId === oppId) + 1;
        const isNext = fx.round === st.currentRound;

        drawRoundRect(
          ctx,
          114,
          ry,
          424,
          40,
          7,
          isNext ? THEME.PAPER_CREAM : THEME.BG_CARD,
          isNext ? THEME.GOLD_LIGHT : THEME.BORDER,
          isNext ? 1.6 : 1
        );
        drawBadge(
          ctx,
          122,
          ry + 8,
          84,
          24,
          isNext ? `第${fx.round}轮·下场` : `第${fx.round}轮`,
          isNext ? THEME.VERMILION : THEME.BG_DEEP,
          isNext ? '#FFFFFF' : THEME.TX2
        );
        drawBadge(
          ctx,
          212,
          ry + 8,
          30,
          24,
          isHome ? '主' : '客',
          isHome ? '#166534' : THEME.COBALT,
          isHome ? THEME.LIME : '#FFFFFF'
        );
        if (opp) drawClubCrest(ctx, 256, ry + 20, 10, opp);
        drawText(ctx, fitText(ctx, opp ? opp.name : oppId, 152, 13.5, isNext, true), 274, ry + 20, {
          size: 13.5,
          bold: isNext,
          color: isNext ? THEME.PAPER_INK : THEME.TX1,
        });
        drawText(ctx, `第${oppRank}名 · ${opp?.formation ?? ''}`, 526, ry + 20, {
          size: 12,
          color: isNext ? THEME.PAPER_MUTED : THEME.TX2,
          align: 'right',
        });
      });
    }

    // 下半：近期已赛战果
    drawText(ctx, '近期已赛战果', 116, 468, { size: 14, bold: true, color: THEME.TX1 });
    if (recent.length === 0) {
      drawRoundRect(ctx, 114, 486, 424, 174, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, '完成首轮比赛后，战果与 xG 记录将展示于此', 326, 573, { size: 13, color: THEME.TX3, align: 'center' });
    } else {
      recent.forEach((fx, idx) => {
        const ry = 486 + idx * 46;
        const isHome = fx.homeClubId === club.id;
        const oppId = isHome ? fx.awayClubId : fx.homeClubId;
        const opp = st.clubs.find(c => c.id === oppId);
        const myG = isHome ? fx.homeGoals : fx.awayGoals;
        const oppG = isHome ? fx.awayGoals : fx.homeGoals;
        const resTag = myG > oppG ? '胜' : myG === oppG ? '平' : '负';
        const resCol = myG > oppG ? THEME.LIME : myG === oppG ? THEME.GOLD_LIGHT : THEME.RED_LIGHT;
        const resBg = myG > oppG ? '#166534' : myG === oppG ? '#78350F' : THEME.VERMILION;

        drawRoundRect(ctx, 114, ry, 424, 40, 7, THEME.BG_CARD, THEME.BORDER);
        drawText(ctx, `第${fx.round}轮`, 122, ry + 20, { size: 12, color: THEME.TX3, mono: true });
        drawBadge(ctx, 166, ry + 9, 28, 22, resTag, resBg, myG === oppG ? THEME.GOLD_HOT : '#FFFFFF');
        if (opp) drawClubCrest(ctx, 210, ry + 20, 9, opp);
        drawText(ctx, fitText(ctx, `${isHome ? '对阵' : '客战'} ${opp?.name ?? oppId}`, 162, 13, false, true), 226, ry + 20, {
          size: 13,
          color: THEME.TX1,
        });
        drawText(ctx, `${myG} : ${oppG}`, 446, ry + 20, {
          size: 14.5,
          bold: true,
          color: resCol,
          align: 'right',
          mono: true,
        });
        const myXg = isHome ? fx.homeXG : fx.awayXG;
        const oppXg = isHome ? fx.awayXG : fx.homeXG;
        drawText(ctx, `xG ${myXg.toFixed(1)}:${oppXg.toFixed(1)}`, 528, ry + 20, {
          size: 12,
          color: THEME.TX2,
          align: 'right',
          mono: true,
        });
      });
    }

    if (this.toastMsg) {
      drawText(ctx, this.toastMsg, 116, 684, { size: 12, color: THEME.LIME });
    } else {
      drawText(ctx, '提示：返回「门户」可直接进行赛前整备与开赛', 116, 684, { size: 12, color: THEME.TX3 });
    }

    // ==================== 右栏 (x: 572..1264, w: 692)：8列积分榜 / 赛季数据统计 ====================
    drawPrintCard(ctx, 572, 80, 692, 624, {
      paper: false,
      radius: 12,
      shadowOffset: 4,
      strokeColor: THEME.BORDER,
      lineWidth: 1.5,
    });

    drawButton(ctx, hits, 590, 92, 138, 34, '联赛积分榜', () => {
      this.rightTab = 'standings';
    }, { active: this.rightTab === 'standings', fontSize: 13, icon: 'trophy' });
    drawButton(ctx, hits, 736, 92, 148, 34, '赛季数据统计', () => {
      this.rightTab = 'stats';
    }, { active: this.rightTab === 'stats', fontSize: 13, icon: 'chart' });

    if (this.rightTab === 'stats') {
      this.renderSeasonStatsPanel(ctx, league);
      return;
    }

    drawButton(ctx, hits, 1034, 92, 90, 34, '定位我队', () => {
      this.standingsScroll = Math.max(0, Math.min(9, userRankIdx - 4));
    }, { variant: 'ghost', fontSize: 12 });
    drawButton(ctx, hits, 1132, 92, 54, 34, '▲', () => {
      this.standingsScroll = Math.max(0, this.standingsScroll - 4);
    }, { variant: 'ghost', fontSize: 13 });
    drawButton(ctx, hits, 1194, 92, 54, 34, '▼', () => {
      this.standingsScroll = Math.min(Math.max(0, standings.length - 9), this.standingsScroll + 4);
    }, { variant: 'ghost', fontSize: 13 });

    const hy = 148;
    drawRoundRect(ctx, 588, hy - 14, 660, 28, 5, THEME.BG_DEEP);
    drawText(ctx, '排名', 612, hy, { size: 12, bold: true, color: THEME.TX2, align: 'center' });
    drawText(ctx, '球队', 654, hy, { size: 12, bold: true, color: THEME.TX2 });
    drawText(ctx, '赛', 842, hy, { size: 12, bold: true, color: THEME.TX2, align: 'center' });
    drawText(ctx, '胜-平-负', 910, hy, { size: 12, bold: true, color: THEME.TX2, align: 'center' });
    drawText(ctx, '进/失', 992, hy, { size: 12, bold: true, color: THEME.TX2, align: 'center' });
    drawText(ctx, '净', 1060, hy, { size: 12, bold: true, color: THEME.TX2, align: 'center' });
    drawText(ctx, '积分', 1118, hy, { size: 12, bold: true, color: THEME.TX2, align: 'center' });
    drawText(ctx, '近期', 1196, hy, { size: 12, bold: true, color: THEME.TX2, align: 'center' });

    const visibleRows = 9;
    const maxStart = Math.max(0, standings.length - visibleRows);
    const startIdx = Math.max(0, Math.min(maxStart, this.standingsScroll));
    const slice = standings.slice(startIdx, startIdx + visibleRows);

    slice.forEach((row, visIdx) => {
      const idx = startIdx + visIdx;
      const ry = 190 + visIdx * 52;
      const isPromote = tierInfo.promoteCount > 0 && idx < tierInfo.promoteCount;
      const isChampionSpot = tierInfo.tier === 1 && idx === 0;
      const isRelegate = tierInfo.relegateCount > 0 && idx >= standings.length - tierInfo.relegateCount;
      const barCol = isChampionSpot ? THEME.GOLD_LIGHT : isPromote ? THEME.LIME : isRelegate ? THEME.VERMILION : '#334155';
      const rankTier = isChampionSpot ? 'gold' : isPromote ? 'green' : isRelegate ? 'red' : 'neutral';

      drawRoundRect(
        ctx,
        588,
        ry - 22,
        660,
        44,
        7,
        row.isUser ? THEME.PAPER_CREAM : THEME.BG_CARD,
        row.isUser ? THEME.GOLD_LIGHT : THEME.BORDER,
        row.isUser ? 1.8 : 1
      );
      drawRoundRect(ctx, 588, ry - 22, 6, 44, 2, barCol);
      drawRankTile(ctx, idx + 1, rankTier, 602, ry, 24);
      const rowClub = st.clubs.find(c => c.id === row.clubId);
      if (rowClub) drawClubCrest(ctx, 642, ry, 10, rowClub);
      const clubLabel = row.isUser ? `${row.clubName} (我)` : row.clubName;
      const textMain = row.isUser ? THEME.PAPER_INK : THEME.TX1;
      const textSub = row.isUser ? THEME.PAPER_MUTED : THEME.TX2;
      drawText(ctx, fitText(ctx, clubLabel, 162, 13.5, row.isUser, true), 660, ry, {
        size: 13.5,
        bold: row.isUser,
        color: textMain,
      });

      drawText(ctx, String(row.played), 842, ry, { size: 13, align: 'center', mono: true, color: textMain });
      drawText(ctx, `${row.won}-${row.drawn}-${row.lost}`, 910, ry, { size: 13, align: 'center', mono: true, color: textMain });
      drawText(ctx, `${row.gf}/${row.ga}`, 992, ry, { size: 13, align: 'center', mono: true, color: textSub });
      drawText(ctx, row.gd >= 0 ? `+${row.gd}` : `${row.gd}`, 1060, ry, {
        size: 13,
        bold: true,
        align: 'center',
        mono: true,
        color: row.gd > 0 ? (row.isUser ? '#166534' : THEME.LIME) : row.gd < 0 ? THEME.VERMILION : textSub,
      });
      drawText(ctx, String(row.points), 1118, ry, {
        size: 15,
        bold: true,
        align: 'center',
        mono: true,
        color: row.isUser ? THEME.PAPER_INK : THEME.GOLD_LIGHT,
      });

      row.form.slice(-4).forEach((f, fi) => {
        const fx = 1162 + fi * 20;
        const col = f === 'W' ? '#16A34A' : f === 'D' ? THEME.GOLD : THEME.VERMILION;
        drawBadge(ctx, fx, ry - 9, 17, 19, f, col, f === 'D' ? THEME.INK_LINE : '#FFFFFF');
      });
    });

    drawText(ctx, `显示第 ${startIdx + 1}-${startIdx + slice.length} / ${standings.length} 名（支持滚轮翻页）`, 918, 684, {
      size: 12,
      color: THEME.TX3,
      align: 'center',
    });
  }

  private renderSeasonStatsPanel(ctx: CanvasRenderingContext2D, league: LeagueManager): void {
    const ts = league.getUserTeamSeasonStats();
    const scorers = league.getTopScorers(5);
    const assisters = league.getTopAssisters(5);
    const winRate = ts.played > 0 ? Math.round((ts.won / ts.played) * 100) : 0;

    drawText(ctx, '本赛季球队综合战绩与预期表现', 590, 148, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    const kpis: Array<{ label: string; val: string; sub: string; col: string }> = [
      { label: '战绩与胜率', val: `${ts.won}-${ts.drawn}-${ts.lost}`, sub: `胜率 ${winRate}% · ${ts.played}轮`, col: THEME.GOLD_LIGHT },
      { label: '攻防净胜球', val: `${ts.gf}/${ts.ga}`, sub: `净胜 ${ts.gf - ts.ga >= 0 ? '+' : ''}${ts.gf - ts.ga}`, col: ts.gf >= ts.ga ? THEME.LIME : THEME.RED_LIGHT },
      { label: '预期进球 xG', val: `${ts.xgFor.toFixed(1)}:${ts.xgAgainst.toFixed(1)}`, sub: `场均 ${(ts.xgFor / Math.max(1, ts.played)).toFixed(2)}`, col: '#60A5FA' },
      { label: '零封与纪律', val: `${ts.cleanSheets} 零封`, sub: `黄${ts.yellows} · 红${ts.reds}`, col: '#C084FC' },
    ];
    kpis.forEach((k, i) => {
      const kx = 590 + i * 166;
      drawPrintCard(ctx, kx, 164, 158, 78, { paper: true, topBandColor: k.col, topBandHeight: 5, radius: 6, shadowOffset: 3, strokeColor: THEME.INK_LINE, lineWidth: 2 });
      drawText(ctx, k.label, kx + 12, 182, { size: 12, bold: true, color: THEME.PAPER_MUTED });
      drawText(ctx, fitText(ctx, k.val, 134, 16, true, true), kx + 12, 205, { size: 16, bold: true, color: THEME.PAPER_INK, mono: true });
      drawText(ctx, k.sub, kx + 12, 228, { size: 12, color: THEME.PAPER_MUTED });
    });

    drawPrintCard(ctx, 590, 256, 322, 240, { paper: false, topBandColor: THEME.BRASS, topBandHeight: 5, radius: 8, shadowOffset: 4, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawIcon(ctx, 'ball', 610, 278, 14, THEME.BRASS);
    drawText(ctx, '联赛射手榜 TOP 5', 628, 278, { size: 13.5, bold: true, color: THEME.BRASS });
    if (scorers.length === 0) {
      drawText(ctx, '首轮开赛后实时统计', 751, 380, { size: 13, color: THEME.TX3, align: 'center' });
    } else {
      scorers.forEach((sc, i) => {
        const sy = 314 + i * 36;
        drawRoundRect(ctx, 604, sy - 13, 294, 30, 5, i === 0 ? THEME.PAPER_CREAM : THEME.BG_DEEP, THEME.INK_LINE, 1.5);
        drawText(ctx, `${i + 1}. ${sc.playerName}`, 614, sy + 2, { size: 13, bold: i === 0, color: i === 0 ? THEME.PAPER_INK : THEME.TX1 });
        drawText(ctx, sc.clubName.slice(0, 6), 748, sy + 2, { size: 12, color: i === 0 ? THEME.PAPER_MUTED : THEME.TX2 });
        drawText(ctx, `${sc.goals} 球`, 886, sy + 2, { size: 13, bold: true, color: i === 0 ? THEME.VERMILION : THEME.LIME, align: 'right', mono: true });
      });
    }

    drawPrintCard(ctx, 926, 256, 322, 240, { paper: false, topBandColor: THEME.COBALT, topBandHeight: 5, radius: 8, shadowOffset: 4, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawIcon(ctx, 'sparkle', 946, 278, 14, '#7DD3FC');
    drawText(ctx, '联赛助攻榜 TOP 5', 964, 278, { size: 13.5, bold: true, color: '#7DD3FC' });
    if (assisters.length === 0) {
      drawText(ctx, '首轮开赛后实时统计', 1087, 380, { size: 13, color: THEME.TX3, align: 'center' });
    } else {
      assisters.forEach((as, i) => {
        const sy = 314 + i * 36;
        drawRoundRect(ctx, 940, sy - 13, 294, 30, 5, i === 0 ? THEME.PAPER_CREAM : THEME.BG_DEEP, THEME.INK_LINE, 1.5);
        drawText(ctx, `${i + 1}. ${as.playerName}`, 950, sy + 2, { size: 13, bold: i === 0, color: i === 0 ? THEME.PAPER_INK : THEME.TX1 });
        drawText(ctx, as.clubName.slice(0, 6), 1084, sy + 2, { size: 12, color: i === 0 ? THEME.PAPER_MUTED : THEME.TX2 });
        drawText(ctx, `${as.assists} 助`, 1222, sy + 2, { size: 13, bold: true, color: i === 0 ? THEME.COBALT : '#60A5FA', align: 'right', mono: true });
      });
    }

    drawPrintCard(ctx, 590, 512, 658, 174, { paper: false, topBandColor: THEME.LIME, topBandHeight: 5, radius: 8, shadowOffset: 4, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawText(ctx, '我队队内核心数据王', 610, 534, { size: 13.5, bold: true, color: THEME.LIME });
    const leaders: Array<{ tag: string; p: typeof ts.topScorer; stat: string; col: string }> = [
      { tag: '队内射手王', p: ts.topScorer, stat: ts.topScorer ? `${ts.topScorer.seasonStats.goals}球 · ${ts.topScorer.seasonStats.assists}助` : '-', col: THEME.VERMILION },
      { tag: '队内助攻王', p: ts.topAssister, stat: ts.topAssister ? `${ts.topAssister.seasonStats.assists}助 · ${ts.topAssister.seasonStats.passesSuccess ?? 0}传` : '-', col: THEME.COBALT },
      { tag: '门线守护神', p: ts.topKeeper, stat: ts.topKeeper ? `${ts.topKeeper.seasonStats.cleanSheets}零封 · ${ts.topKeeper.seasonStats.saves ?? 0}扑` : '-', col: '#15803D' },
      { tag: '全勤铁人', p: ts.ironMan, stat: ts.ironMan ? `出场${ts.ironMan.seasonStats.appearances} · ${Math.round((ts.ironMan.seasonStats.distanceM ?? 0) / 1000)}km` : '-', col: THEME.VIOLET },
    ];
    leaders.forEach((ld, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = 606 + col * 318;
      const ly = 556 + row * 58;
      drawPrintCard(ctx, lx, ly, 306, 48, { paper: true, radius: 6, shadowOffset: 2, strokeColor: THEME.INK_LINE, lineWidth: 1.8 });
      drawBadge(ctx, lx + 10, ly + 12, 78, 24, ld.tag, THEME.BG_PANEL, THEME.PAPER_CREAM);
      drawText(ctx, ld.p ? `${ld.p.name.slice(0, 5)} CA${ld.p.ca}` : '-', lx + 96, ly + 24, {
        size: 13,
        bold: true,
        color: THEME.PAPER_INK,
      });
      drawText(ctx, ld.stat, lx + 296, ly + 24, { size: 12, bold: true, color: ld.col, align: 'right', mono: true });
    });
  }
}
