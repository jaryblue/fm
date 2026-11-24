/**
 * 页面 2B：联赛赛程与积分榜中心（从原门户拆出的独立一级页面）
 * - 左栏 (460px)：本队赛程预告 + 近期战果 + 联赛升降级规则说明
 * - 右栏 (692px)：18 队联赛积分榜 / 赛季数据统计（双 Tab，大字号舒适浏览）
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawNavRail,
  drawRoundRect,
  drawText,
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
    const maxScroll = 8; // 18队显示10行 -> 最多滚动8行
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
      badge: `第 ${st.currentRound}/34 轮`,
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
      rightAction: nextFx
        ? { label: '进入比赛日', icon: 'play', variant: 'gold', onClick: actions.onStartMatch }
        : { label: '返回门户', variant: 'ghost', onClick: () => actions.onNavigate('portal') },
    });

    drawNavRail(ctx, hits, 'league', actions.onNavigate);

    // ==================== 左栏 (x: 96..556, w: 460)：赛程与近期战果 ====================
    drawChamferPanel(ctx, 96, 80, 460, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER_GOLD, 1.2, THEME.GOLD_LIGHT);

    const userRankIdx = standings.findIndex(r => r.isUser);
    const userRow = standings[userRankIdx];
    drawText(ctx, '本队赛季赛程与战绩', 116, 104, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, 454, 90, 86, 28, '? 重置引导', () => {
      league.resetTutorial();
      this.toastMsg = '已重置新手引导，返回对应页面将重新弹出提示';
      actions.onSave?.();
    }, { variant: 'ghost', fontSize: 11 });

    // 顶部本队排名概览条
    drawRoundRect(ctx, 114, 128, 424, 54, 8, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `当前排名 第 ${userRankIdx + 1} 名`, 128, 147, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
    drawText(
      ctx,
      userRow ? `${userRow.points} 积分 · ${userRow.won}胜 ${userRow.drawn}平 ${userRow.lost}负 · 净胜 ${userRow.gd >= 0 ? '+' : ''}${userRow.gd}` : '尚未开赛',
      128,
      168,
      { size: 11.5, color: THEME.TX2 }
    );
    const zoneTag =
      tierInfo.tier === 1 ? '第1级·争冠/后3降' :
      tierInfo.tier === 7 ? '第7级·前3升' :
      `前${tierInfo.promoteCount}升·后${tierInfo.relegateCount}降`;
    drawBadge(ctx, 412, 143, 114, 24, zoneTag, '#1E3A5F', '#7DD3FC');

    const userFixtures = st.fixtures
      .filter(f => f.homeClubId === club.id || f.awayClubId === club.id)
      .sort((a, b) => a.round - b.round);
    const upcoming = userFixtures.filter(f => !f.played).slice(0, 5);
    const recent = userFixtures.filter(f => f.played).slice(-4).reverse();

    // 上半：接下来 5 轮赛程预告
    drawText(ctx, '即将迎战（未来赛程）', 116, 204, { size: 13.5, bold: true, color: '#38BDF8' });
    if (upcoming.length === 0) {
      drawRoundRect(ctx, 114, 222, 424, 180, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, '本赛季常规赛程已全部结束', 326, 312, { size: 13, color: THEME.TX3, align: 'center' });
    } else {
      upcoming.forEach((fx, idx) => {
        const ry = 222 + idx * 46;
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
          isNext ? 'rgba(212, 168, 67, 0.16)' : THEME.BG_CARD,
          isNext ? THEME.GOLD_LIGHT : THEME.BORDER,
          isNext ? 1.5 : 1
        );
        drawBadge(
          ctx,
          122,
          ry + 9,
          56,
          22,
          isNext ? `第${fx.round}轮·下场` : `第${fx.round}轮`,
          isNext ? '#78350F' : '#1E293B',
          isNext ? THEME.GOLD_LIGHT : THEME.TX2
        );
        drawBadge(
          ctx,
          184,
          ry + 9,
          32,
          22,
          isHome ? '主' : '客',
          isHome ? '#14532D' : '#1E3A5F',
          isHome ? THEME.GREEN : '#7DD3FC'
        );
        if (opp) drawClubCrest(ctx, 232, ry + 20, 10, opp);
        drawText(ctx, opp ? opp.name : oppId, 250, ry + 20, {
          size: 13,
          bold: isNext,
          color: isNext ? THEME.GOLD_LIGHT : THEME.TX1,
        });
        drawText(ctx, `第${oppRank}名 · ${opp?.formation ?? ''}`, 526, ry + 20, {
          size: 11.5,
          color: THEME.TX2,
          align: 'right',
        });
      });
    }

    // 下半：近期已赛战果
    drawText(ctx, '近期已赛战果', 116, 468, { size: 13.5, bold: true, color: THEME.TX1 });
    if (recent.length === 0) {
      drawRoundRect(ctx, 114, 486, 424, 174, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, '完成首轮比赛后，战果与 xG 记录将展示于此', 326, 573, { size: 12.5, color: THEME.TX3, align: 'center' });
    } else {
      recent.forEach((fx, idx) => {
        const ry = 486 + idx * 46;
        const isHome = fx.homeClubId === club.id;
        const oppId = isHome ? fx.awayClubId : fx.homeClubId;
        const opp = st.clubs.find(c => c.id === oppId);
        const myG = isHome ? fx.homeGoals : fx.awayGoals;
        const oppG = isHome ? fx.awayGoals : fx.homeGoals;
        const resTag = myG > oppG ? '胜' : myG === oppG ? '平' : '负';
        const resCol = myG > oppG ? THEME.GREEN : myG === oppG ? THEME.GOLD_LIGHT : THEME.RED_LIGHT;
        const resBg = myG > oppG ? '#14532D' : myG === oppG ? '#78350F' : '#7F1D1D';

        drawRoundRect(ctx, 114, ry, 424, 40, 7, THEME.BG_CARD, THEME.BORDER);
        drawText(ctx, `R${fx.round}`, 124, ry + 20, { size: 11.5, color: THEME.TX3, mono: true });
        drawBadge(ctx, 158, ry + 10, 28, 20, resTag, resBg, resCol);
        if (opp) drawClubCrest(ctx, 202, ry + 20, 9, opp);
        drawText(ctx, `${isHome ? 'vs' : '@'} ${opp?.name ?? oppId}`, 218, ry + 20, {
          size: 12.5,
          color: THEME.TX1,
        });
        drawText(ctx, `${myG} : ${oppG}`, 454, ry + 20, {
          size: 14,
          bold: true,
          color: resCol,
          align: 'right',
          mono: true,
        });
        const myXg = isHome ? fx.homeXG : fx.awayXG;
        const oppXg = isHome ? fx.awayXG : fx.homeXG;
        drawText(ctx, `xG ${myXg.toFixed(1)}:${oppXg.toFixed(1)}`, 528, ry + 20, {
          size: 10.5,
          color: THEME.TX3,
          align: 'right',
          mono: true,
        });
      });
    }

    if (this.toastMsg) {
      drawText(ctx, this.toastMsg, 116, 684, { size: 11.5, color: THEME.GREEN });
    } else {
      drawText(ctx, '提示：返回「门户」可直接进行赛前整备与开赛', 116, 684, { size: 11.5, color: THEME.TX3 });
    }

    // ==================== 右栏 (x: 572..1264, w: 692)：积分榜 / 赛季数据统计 ====================
    drawChamferPanel(ctx, 572, 80, 692, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);

    drawButton(ctx, hits, 590, 94, 136, 32, '联赛积分榜', () => {
      this.rightTab = 'standings';
    }, { active: this.rightTab === 'standings', fontSize: 12.5, icon: 'trophy' });
    drawButton(ctx, hits, 734, 94, 146, 32, '赛季数据统计', () => {
      this.rightTab = 'stats';
    }, { active: this.rightTab === 'stats', fontSize: 12.5, icon: 'chart' });

    if (this.rightTab === 'stats') {
      this.renderSeasonStatsPanel(ctx, league);
      return;
    }

    drawButton(ctx, hits, 1044, 94, 84, 32, '定位我队', () => {
      this.standingsScroll = Math.max(0, Math.min(8, userRankIdx - 4));
    }, { variant: 'ghost', fontSize: 11.5 });
    drawButton(ctx, hits, 1136, 94, 52, 32, '▲', () => {
      this.standingsScroll = Math.max(0, this.standingsScroll - 4);
    }, { variant: 'ghost', fontSize: 12 });
    drawButton(ctx, hits, 1196, 94, 52, 32, '▼', () => {
      this.standingsScroll = Math.min(Math.max(0, standings.length - 10), this.standingsScroll + 4);
    }, { variant: 'ghost', fontSize: 12 });

    const hy = 148;
    drawRoundRect(ctx, 588, hy - 14, 660, 28, 5, '#111A2E');
    drawText(ctx, '排名', 612, hy, { size: 11.5, color: THEME.TX3, align: 'center' });
    drawText(ctx, '球队', 654, hy, { size: 11.5, color: THEME.TX3 });
    drawText(ctx, '赛', 838, hy, { size: 11.5, color: THEME.TX3, align: 'center' });
    drawText(ctx, '胜', 880, hy, { size: 11.5, color: THEME.TX3, align: 'center' });
    drawText(ctx, '平', 922, hy, { size: 11.5, color: THEME.TX3, align: 'center' });
    drawText(ctx, '负', 964, hy, { size: 11.5, color: THEME.TX3, align: 'center' });
    drawText(ctx, '进/失', 1020, hy, { size: 11.5, color: THEME.TX3, align: 'center' });
    drawText(ctx, '净胜', 1078, hy, { size: 11.5, color: THEME.TX3, align: 'center' });
    drawText(ctx, '积分', 1132, hy, { size: 11.5, color: THEME.TX3, align: 'center' });
    drawText(ctx, '近期', 1202, hy, { size: 11.5, color: THEME.TX3, align: 'center' });

    const visibleRows = 10;
    const maxStart = Math.max(0, standings.length - visibleRows);
    const startIdx = Math.max(0, Math.min(maxStart, this.standingsScroll));
    const slice = standings.slice(startIdx, startIdx + visibleRows);

    slice.forEach((row, visIdx) => {
      const idx = startIdx + visIdx;
      const ry = 190 + visIdx * 48;
      const isPromote = tierInfo.promoteCount > 0 && idx < tierInfo.promoteCount;
      const isChampionSpot = tierInfo.tier === 1 && idx === 0;
      const isRelegate = tierInfo.relegateCount > 0 && idx >= standings.length - tierInfo.relegateCount;
      const barCol = isChampionSpot ? THEME.GOLD_LIGHT : isPromote ? THEME.GREEN : isRelegate ? THEME.RED_LIGHT : '#334155';

      drawRoundRect(
        ctx,
        588,
        ry - 18,
        660,
        41,
        7,
        row.isUser ? 'rgba(212,168,67,0.18)' : THEME.BG_CARD,
        row.isUser ? THEME.GOLD : THEME.BORDER,
        row.isUser ? 1.6 : 1
      );
      drawRoundRect(ctx, 588, ry - 18, 5, 41, 2, barCol);
      drawText(ctx, String(idx + 1), 612, ry + 2, {
        size: 13,
        bold: true,
        color: isChampionSpot ? THEME.GOLD_LIGHT : isPromote ? THEME.GREEN : isRelegate ? THEME.RED_LIGHT : THEME.TX2,
        align: 'center',
        mono: true,
      });
      const rowClub = st.clubs.find(c => c.id === row.clubId);
      if (rowClub) drawClubCrest(ctx, 642, ry + 2, 10, rowClub);
      drawText(ctx, row.isUser ? `${row.clubName} (我)` : row.clubName, 662, ry + 2, {
        size: 13,
        bold: row.isUser,
        color: row.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });

      drawText(ctx, String(row.played), 838, ry + 2, { size: 12.5, align: 'center', mono: true });
      drawText(ctx, String(row.won), 880, ry + 2, { size: 12.5, align: 'center', mono: true });
      drawText(ctx, String(row.drawn), 922, ry + 2, { size: 12.5, align: 'center', mono: true });
      drawText(ctx, String(row.lost), 964, ry + 2, { size: 12.5, align: 'center', mono: true });
      drawText(ctx, `${row.gf}/${row.ga}`, 1020, ry + 2, { size: 11.5, align: 'center', mono: true, color: THEME.TX2 });
      drawText(ctx, row.gd >= 0 ? `+${row.gd}` : `${row.gd}`, 1078, ry + 2, {
        size: 12.5,
        align: 'center',
        mono: true,
        color: row.gd > 0 ? THEME.GREEN : row.gd < 0 ? THEME.RED_LIGHT : THEME.TX2,
      });
      drawText(ctx, String(row.points), 1132, ry + 2, {
        size: 14,
        bold: true,
        align: 'center',
        mono: true,
        color: THEME.GOLD_LIGHT,
      });

      row.form.slice(-4).forEach((f, fi) => {
        const fx = 1170 + fi * 18;
        const col = f === 'W' ? THEME.GREEN : f === 'D' ? THEME.GOLD : THEME.RED_LIGHT;
        drawBadge(ctx, fx, ry - 7, 15, 17, f, col, '#080C14');
      });
    });

    drawText(ctx, `显示第 ${startIdx + 1}-${startIdx + slice.length} / ${standings.length} 名（支持滚轮翻页）`, 918, 684, {
      size: 11.5,
      color: THEME.TX3,
      align: 'center',
    });
  }

  private renderSeasonStatsPanel(ctx: CanvasRenderingContext2D, league: LeagueManager): void {
    const ts = league.getUserTeamSeasonStats();
    const scorers = league.getTopScorers(5);
    const assisters = league.getTopAssisters(5);
    const winRate = ts.played > 0 ? Math.round((ts.won / ts.played) * 100) : 0;

    drawText(ctx, '本赛季球队综合战绩与预期表现', 590, 148, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
    const kpis: Array<{ label: string; val: string; sub: string; col: string }> = [
      { label: '战绩与胜率', val: `${ts.won}胜 ${ts.drawn}平 ${ts.lost}负`, sub: `胜率 ${winRate}% · 已赛 ${ts.played} 轮`, col: THEME.GOLD_LIGHT },
      { label: '攻防净胜球', val: `${ts.gf} 进 / ${ts.ga} 失`, sub: `净胜 ${ts.gf - ts.ga >= 0 ? '+' : ''}${ts.gf - ts.ga}`, col: ts.gf >= ts.ga ? THEME.GREEN : THEME.RED_LIGHT },
      { label: '预期进球 xG', val: `${ts.xgFor.toFixed(1)} : ${ts.xgAgainst.toFixed(1)}`, sub: `场均 ${(ts.xgFor / Math.max(1, ts.played)).toFixed(2)} xG`, col: '#38BDF8' },
      { label: '零封与纪律', val: `${ts.cleanSheets} 次零封`, sub: `黄牌 ${ts.yellows} · 红牌 ${ts.reds}`, col: '#C084FC' },
    ];
    kpis.forEach((k, i) => {
      const kx = 590 + i * 166;
      drawRoundRect(ctx, kx, 164, 158, 76, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, k.label, kx + 12, 182, { size: 11, color: THEME.TX2 });
      drawText(ctx, k.val, kx + 12, 204, { size: 13.5, bold: true, color: k.col, mono: true });
      drawText(ctx, k.sub, kx + 12, 226, { size: 10.5, color: THEME.TX3 });
    });

    drawRoundRect(ctx, 590, 256, 322, 240, 10, THEME.BG_CARD, THEME.BORDER);
    drawIcon(ctx, 'ball', 610, 278, 14, THEME.GOLD_LIGHT);
    drawText(ctx, '联赛射手榜 TOP 5', 628, 278, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
    if (scorers.length === 0) {
      drawText(ctx, '首轮开赛后实时统计', 751, 380, { size: 12, color: THEME.TX3, align: 'center' });
    } else {
      scorers.forEach((sc, i) => {
        const sy = 314 + i * 36;
        drawRoundRect(ctx, 604, sy - 13, 294, 29, 6, 'rgba(15, 23, 42, 0.85)');
        drawText(ctx, `${i + 1}. ${sc.playerName}`, 614, sy + 1, { size: 12, bold: i === 0, color: i === 0 ? THEME.GOLD_LIGHT : THEME.TX1 });
        drawText(ctx, sc.clubName.slice(0, 6), 748, sy + 1, { size: 10.5, color: THEME.TX2 });
        drawText(ctx, `${sc.goals} 球`, 886, sy + 1, { size: 12.5, bold: true, color: THEME.GREEN, align: 'right', mono: true });
      });
    }

    drawRoundRect(ctx, 926, 256, 322, 240, 10, THEME.BG_CARD, THEME.BORDER);
    drawIcon(ctx, 'sparkle', 946, 278, 14, '#38BDF8');
    drawText(ctx, '联赛助攻榜 TOP 5', 964, 278, { size: 13, bold: true, color: '#38BDF8' });
    if (assisters.length === 0) {
      drawText(ctx, '首轮开赛后实时统计', 1087, 380, { size: 12, color: THEME.TX3, align: 'center' });
    } else {
      assisters.forEach((as, i) => {
        const sy = 314 + i * 36;
        drawRoundRect(ctx, 940, sy - 13, 294, 29, 6, 'rgba(15, 23, 42, 0.85)');
        drawText(ctx, `${i + 1}. ${as.playerName}`, 950, sy + 1, { size: 12, bold: i === 0, color: i === 0 ? '#7DD3FC' : THEME.TX1 });
        drawText(ctx, as.clubName.slice(0, 6), 1084, sy + 1, { size: 10.5, color: THEME.TX2 });
        drawText(ctx, `${as.assists} 助`, 1222, sy + 1, { size: 12.5, bold: true, color: '#38BDF8', align: 'right', mono: true });
      });
    }

    drawRoundRect(ctx, 590, 512, 658, 174, 10, THEME.BG_CARD, THEME.BORDER_GOLD);
    drawText(ctx, '我队队内核心数据王', 610, 534, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
    const leaders: Array<{ tag: string; p: typeof ts.topScorer; stat: string; col: string }> = [
      { tag: '队内射手王', p: ts.topScorer, stat: ts.topScorer ? `${ts.topScorer.seasonStats.goals}球 · ${ts.topScorer.seasonStats.assists}助` : '-', col: THEME.GOLD_LIGHT },
      { tag: '队内助攻王', p: ts.topAssister, stat: ts.topAssister ? `${ts.topAssister.seasonStats.assists}助 · ${ts.topAssister.seasonStats.passesSuccess ?? 0}传` : '-', col: '#38BDF8' },
      { tag: '门线守护神', p: ts.topKeeper, stat: ts.topKeeper ? `${ts.topKeeper.seasonStats.cleanSheets}零封 · ${ts.topKeeper.seasonStats.saves ?? 0}扑` : '-', col: THEME.GREEN },
      { tag: '全勤铁人', p: ts.ironMan, stat: ts.ironMan ? `出场${ts.ironMan.seasonStats.appearances} · ${Math.round((ts.ironMan.seasonStats.distanceM ?? 0) / 1000)}km` : '-', col: '#C084FC' },
    ];
    leaders.forEach((ld, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = 606 + col * 318;
      const ly = 556 + row * 58;
      drawRoundRect(ctx, lx, ly, 306, 48, 7, 'rgba(11, 17, 30, 0.9)', THEME.BORDER);
      drawBadge(ctx, lx + 10, ly + 13, 74, 22, ld.tag, '#1E293B', ld.col);
      drawText(ctx, ld.p ? `${ld.p.name.slice(0, 5)} CA${ld.p.ca}` : '-', lx + 92, ly + 24, {
        size: 12.5,
        bold: true,
        color: THEME.TX1,
      });
      drawText(ctx, ld.stat, lx + 296, ly + 24, { size: 11.5, color: ld.col, align: 'right', mono: true });
    });
  }
}
