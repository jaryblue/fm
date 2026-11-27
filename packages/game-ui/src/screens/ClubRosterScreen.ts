/**
 * 统一「引援中心」与俱乐部大名单管理
 * 4 页签：一线队名单与榜单 / 青训学院 (U19迷雾与成长) / 转会市场 (迷雾考察与买卖竞拍) / 经纪人密荐与私教特训
 * - 夏窗 (SUMMER_WINDOW)：3 核心开包后 11 人进夏窗，买/提拔/密荐/免签凑够 26 人即可开启赛季
 * - 冬窗 (WINTER_WINDOW)：第 17 轮半程开启，青训自然成长与迷雾更新，可交易补强后关闭进入下半程
 * - 常规赛 (REGULAR_SEASON)：锁窗禁止交易，但可随时浏览及付费球探考察迷雾
 */

import { LeagueManager, MAX_CLUB_ROSTER, SEASON_SQUAD_SIZE } from '../../../core/src/LeagueManager';
import { BrokerOutcomeTier, DraftPlayer } from '../../../core/src/types';
import { AssetLoader } from '../AssetLoader';
import { drawPlayerAvatar } from '../AvatarRenderer';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawMiniBar,
  drawNavRail,
  drawRoundRect,
  drawStatMicro,
  drawText,
  drawWrappedText,
  fitText,
  formatFunds,
  HitRegistry,
  NavRailTab,
  tierColor,
} from '../CanvasKit';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, IconName } from '../VectorIcons';

type PosFilter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT';
type LeaderboardTab = 'goals' | 'assists' | 'defense' | 'distance' | 'passes' | 'gk';
type SortMode = 'ca' | 'pa' | 'age' | 'goals' | 'distance';
export type RosterSubTab = 'roster' | 'academy' | 'market' | 'sinks';

const LB_TABS: Array<{ key: LeaderboardTab; label: string }> = [
  { key: 'goals', label: '射手榜' },
  { key: 'assists', label: '助攻榜' },
  { key: 'defense', label: '抢断解围' },
  { key: 'distance', label: '场均跑动' },
  { key: 'passes', label: '场均传球' },
  { key: 'gk', label: '扑救/零封' },
];

const BROKER_TIER_META: Record<BrokerOutcomeTier, { label: string; bg: string; color: string }> = {
  superstar: { label: '★ 绝世巨星降临 ★', bg: '#78350F', color: '#FDE047' },
  gem: { label: '◆ 慧眼捡漏妖人 ◆', bg: '#4C1D95', color: '#E9D5FF' },
  solid: { label: '● 合格即战力 ●', bg: '#0C4A6E', color: '#7DD3FC' },
  bust: { label: '✕ 经纪人水货 ✕', bg: '#7F1D1D', color: '#FCA5A5' },
};

export class ClubRosterScreen {
  private subTab: RosterSubTab = 'roster';
  private filter: PosFilter = 'ALL';
  private lbTab: LeaderboardTab = 'goals';
  private sortMode: SortMode = 'ca';
  private page = 0;
  private marketSellPage = 0;
  private devilTargetId: string | null = null;

  public setSubTab(tab: RosterSubTab): void {
    this.subTab = tab;
  }

  public getSubTab(): RosterSubTab {
    return this.subTab;
  }

  private matchFilter(p: DraftPlayer): boolean {
    if (this.filter === 'ALL') return true;
    if (this.filter === 'GK') return p.role === 'GK';
    if (this.filter === 'DEF') return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role);
    if (this.filter === 'MID') return ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role);
    return ['LW', 'RW', 'ST'].includes(p.role);
  }

  private statColor(val: number): string {
    if (val >= 82) return THEME.GOLD_LIGHT;
    if (val >= 72) return THEME.GREEN;
    if (val >= 60) return '#38BDF8';
    return THEME.TX2;
  }

  private getLbValue(p: DraftPlayer, tab: LeaderboardTab): { score: number; text: string } {
    const s = p.seasonStats;
    const apps = Math.max(0, s.appearances ?? 0);
    if (tab === 'goals') return { score: s.goals ?? 0, text: `${s.goals ?? 0} 球` };
    if (tab === 'assists') return { score: s.assists ?? 0, text: `${s.assists ?? 0} 助` };
    if (tab === 'defense') {
      const def = (s.tackles ?? 0) + (s.interceptions ?? 0);
      return { score: def, text: `${def} 次` };
    }
    if (tab === 'distance') {
      const avgKm = apps > 0 ? (s.distanceM ?? 0) / 1000 / apps : 0;
      return { score: avgKm, text: `${avgKm.toFixed(1)} km` };
    }
    if (tab === 'passes') {
      const avgPass = apps > 0 ? (s.passes ?? 0) / apps : 0;
      const pct = (s.passes ?? 0) > 0 ? Math.round(((s.passesSuccess ?? 0) / (s.passes ?? 1)) * 100) : 0;
      return { score: avgPass, text: `${avgPass.toFixed(1)} (${pct}%)` };
    }
    const gkScore = (s.saves ?? 0) * 10 + (s.cleanSheets ?? 0) * 15;
    return { score: gkScore, text: `${s.saves ?? 0}扑 · ${s.cleanSheets ?? 0}零` };
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onBack: () => void;
      onNavigate?: (tab: NavRailTab) => void;
      activeRailTab?: NavRailTab;
      onStartSeasonFromRoster: () => void;
      onSeasonStarted?: () => void;
      onWinterClosed?: () => void;
      onInspectPlayer: (p: DraftPlayer, opts?: { scoutFog?: boolean; revealCount?: number }) => void;
      onSave: () => void;
      onToast?: (msg: string, color?: string) => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const winState = league.getTransferWindowState();
    const isWindowOpen = winState.isOpen;
    const isSummer = st.phase === 'SUMMER_WINDOW';
    const isWinter = st.phase === 'WINTER_WINDOW';
    const isLocked = league.isSeasonInProgress();
    const rawRoster = league.getClubRoster();

    const activeSquadMap = new Map(club.squad.map(p => [p.id, p]));
    const displayRoster: DraftPlayer[] =
      rawRoster.length > 0
        ? rawRoster.map(rp => activeSquadMap.get(rp.id) ?? rp)
        : club.squad;

    const ya = league.getYouthAcademyState();
    const tm = league.getTransferMarketState();

    const hasRail = !!actions.onNavigate;
    const baseX = hasRail ? 96 : 16;
    const totalW = hasRail ? 1168 : 1248;

    const kickerMap: Record<RosterSubTab, string> = {
      roster: 'SQUAD & STATS · 一线队大名单与数据榜单',
      academy: 'YOUTH ACADEMY · U19 青训营（随季成长 · 超19岁自动解约）',
      market: 'TRANSFER MARKET · 转会市场（迷雾球探与 AI 竞拍）',
      sinks: 'BROKER & TRAINING · 经纪人密荐与私教魔鬼特训',
    };

    drawBroadcastHeader(ctx, hits, {
      kicker: kickerMap[this.subTab],
      title: `${club.name} · 俱乐部引援中心`,
      club,
      badge: `${winState.label} · ${displayRoster.length}/${SEASON_SQUAD_SIZE}人`,
      metaPoints: st.metaPointsTotal,
      clubFunds: league.getClubFunds(),
      showSoundToggle: true,
      rightAction: hasRail || isSummer || isWinter ? undefined : { label: '返回', variant: 'ghost', onClick: actions.onBack },
    });

    if (hasRail && actions.onNavigate) {
      drawNavRail(ctx, hits, actions.activeRailTab ?? 'transfer_hub', actions.onNavigate);
    }

    // ==================== 4 项页签导航栏 (y: 74..102) ====================
    const subTabs: Array<[RosterSubTab, string]> = [
      ['roster', `一线队名单 (${displayRoster.length}人)`],
      ['academy', `青训学院 (${ya.candidates.length})`],
      ['market', `转会市场 (${tm.marketPool.length})`],
      ['sinks', tm.pendingBrokerResult ? '经纪人密荐 (待决策!)' : '经纪人密荐与特训'],
    ];
    const tabW = Math.floor((totalW - 24) / 4);
    subTabs.forEach(([tk, tl], ti) => {
      drawButton(ctx, hits, baseX + ti * (tabW + 8), 74, tabW, 28, tl, () => {
        SoundEngine.playClick();
        this.subTab = tk;
      }, {
        active: this.subTab === tk,
        variant: tk === 'sinks' && tm.pendingBrokerResult && this.subTab !== 'sinks' ? 'gold' : 'ghost',
        fontSize: 11.5,
      });
    });

    // ==================== 转会窗状态与快捷操作横幅 (y: 108..144) ====================
    const bannerY = 108;
    const bannerH = 36;
    if (isSummer) {
      const needCount = Math.max(0, SEASON_SQUAD_SIZE - displayRoster.length);
      const ready = needCount === 0;
      drawRoundRect(
        ctx,
        baseX,
        bannerY,
        totalW,
        bannerH,
        8,
        ready ? 'rgba(20, 83, 45, 0.36)' : 'rgba(120, 53, 15, 0.30)',
        ready ? THEME.GREEN : THEME.GOLD_LIGHT,
        1.2
      );
      drawText(
        ctx,
        ready
          ? `夏季转会窗开放 · 已凑齐 ${displayRoster.length} 人（达标 ${SEASON_SQUAD_SIZE} 人），可继续微调或立即开启新赛季`
          : `夏季转会窗开放 · 当前 ${displayRoster.length}/${SEASON_SQUAD_SIZE} 人（还差 ${needCount} 人），可从青训/转会/密荐引援或免签青训补齐`,
        baseX + 16,
        bannerY + 18,
        { size: 12, bold: true, color: ready ? THEME.GREEN : THEME.GOLD_LIGHT }
      );
      if (!ready) {
        drawButton(ctx, hits, baseX + totalW - 398, bannerY + 4, 210, 28, `免签青年队补齐 (${needCount}人 · ¥0万)`, () => {
          const res = league.signFreeAcademyFill(true);
          if (res.ok) {
            SoundEngine.playClick();
            actions.onSave();
            actions.onToast?.(`已免签 ${res.added} 名青年队球员补齐至 26 人大名单！`, THEME.GREEN);
          } else {
            actions.onToast?.(res.reason || '补齐失败', THEME.RED_LIGHT);
          }
        }, { variant: 'primary', fontSize: 11, icon: 'sparkle' });
      }
      drawButton(
        ctx,
        hits,
        baseX + totalW - 180,
        bannerY + 4,
        170,
        28,
        ready ? '完成注册 · 开启赛季 ▶' : `差 ${needCount} 人开赛`,
        () => {
          const res = league.finishSummerWindowAndStartSeason();
          if (res.ok) {
            SoundEngine.playFanfare();
            actions.onSave();
            if (actions.onSeasonStarted) actions.onSeasonStarted();
            else actions.onStartSeasonFromRoster();
          } else {
            actions.onToast?.(res.reason || '无法开赛', THEME.RED_LIGHT);
          }
        },
        { variant: ready ? 'gold' : 'ghost', disabled: !ready, fontSize: 11.5, icon: 'play' }
      );
    } else if (isWinter) {
      drawRoundRect(ctx, baseX, bannerY, totalW, bannerH, 8, 'rgba(12, 74, 110, 0.36)', '#38BDF8', 1.2);
      drawText(
        ctx,
        '冬季转会窗开放 · 可进行球员买卖、青训提拔或经纪人密荐',
        baseX + 16,
        bannerY + 18,
        { size: 12, bold: true, color: '#7DD3FC' }
      );
      drawButton(ctx, hits, baseX + totalW - 196, bannerY + 4, 186, 28, '关闭冬窗 · 继续下半程 ▶', () => {
        const res = league.closeWinterWindow();
        if (res.ok) {
          SoundEngine.playClick();
          actions.onSave();
          actions.onWinterClosed?.();
        } else {
          actions.onToast?.(res.reason || '无法关闭冬窗', THEME.RED_LIGHT);
        }
      }, { variant: 'gold', fontSize: 11.5, icon: 'play' });
    } else {
      drawRoundRect(ctx, baseX, bannerY, totalW, bannerH, 8, 'rgba(127, 29, 29, 0.24)', 'rgba(239, 68, 68, 0.45)', 1);
      drawIcon(ctx, 'lock', baseX + 22, bannerY + 18, 13, '#FCA5A5');
      const nextHint = winState.roundsToNextWindow > 0 ? `距冬季转会窗还有 ${winState.roundsToNextWindow} 轮` : '冬窗已过，下个窗口为赛季末夏窗';
      drawText(
        ctx,
        `转会窗已关闭（${nextHint}）· 交易/签约/密荐已锁死，但仍可随时浏览并付费球探考察迷雾球员`,
        baseX + 38,
        bannerY + 18,
        { size: 11.5, color: '#FECACA' }
      );
    }

    const panelY = 150;
    const panelH = 554;

    if (this.subTab === 'academy') {
      this.renderYouthAcademyTab(ctx, hits, league, actions, baseX, totalW, panelY, panelH, isWindowOpen);
      return;
    }
    if (this.subTab === 'market') {
      this.renderTransferMarketTab(ctx, hits, league, actions, baseX, totalW, panelY, panelH, isWindowOpen);
      return;
    }
    if (this.subTab === 'sinks') {
      this.renderBrokerAndTrainingTab(ctx, hits, league, actions, baseX, totalW, panelY, panelH, isWindowOpen);
      return;
    }

    this.renderRosterWallTab(ctx, hits, league, actions, baseX, totalW, panelY, panelH, displayRoster, isLocked);
  }

  private renderRosterWallTab(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onInspectPlayer: (p: DraftPlayer) => void;
      onSave: () => void;
      onToast?: (msg: string, color?: string) => void;
    },
    baseX: number,
    totalW: number,
    panelY: number,
    panelH: number,
    displayRoster: DraftPlayer[],
    isLocked: boolean
  ): void {
    const club = league.getUserClub();
    const selectedSet = new Set(club.squad.map(p => p.id));
    const lbW = 316;
    const wallX = baseX + lbW + 12;
    const wallW = totalW - lbW - 12;

    // 左栏：队内榜单
    drawChamferPanel(ctx, baseX, panelY, lbW, panelH, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD);
    drawText(ctx, '队内数据榜单 · LEADERBOARD', baseX + 16, panelY + 20, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '一线队实绩排行（点击查看详情）', baseX + 16, panelY + 38, { size: 10, color: THEME.TX2 });

    LB_TABS.forEach((tab, ti) => {
      const col = ti % 3;
      const row = Math.floor(ti / 3);
      drawButton(ctx, hits, baseX + 12 + col * 98, panelY + 50 + row * 28, 92, 23, tab.label, () => {
        this.lbTab = tab.key;
      }, { active: this.lbTab === tab.key, fontSize: 10 });
    });

    const lbPool = (this.lbTab === 'gk' ? displayRoster.filter(p => p.role === 'GK') : displayRoster)
      .map(p => ({ p, val: this.getLbValue(p, this.lbTab) }))
      .sort((a, b) => (b.val.score !== a.val.score ? b.val.score - a.val.score : b.p.ca - a.p.ca));

    const listStartY = panelY + 114;
    lbPool.slice(0, 10).forEach((entry, idx) => {
      const { p, val } = entry;
      const ry = listStartY + idx * 43;
      if (ry + 38 > panelY + panelH - 6) return;
      const rankCol = idx === 0 ? THEME.GOLD_LIGHT : idx === 1 ? '#CBD5E1' : idx === 2 ? '#D97706' : THEME.TX3;

      drawRoundRect(
        ctx,
        baseX + 12,
        ry,
        lbW - 24,
        36,
        6,
        idx === 0 ? 'rgba(212, 168, 67, 0.12)' : THEME.BG_CARD,
        idx === 0 ? THEME.BORDER_GOLD : THEME.BORDER
      );
      drawText(ctx, `${idx + 1}`, baseX + 24, ry + 18, { size: 12.5, bold: true, color: rankCol, align: 'center', mono: true });
      drawBadge(ctx, baseX + 38, ry + 9, 32, 18, p.role, tierColor(p.tier));
      drawText(ctx, p.name, baseX + 76, ry + 12, { size: 11.5, bold: true, color: THEME.TX1 });
      drawText(ctx, `${p.age}岁 · CA ${p.ca} / PA ${p.pa ?? p.ca}`, baseX + 76, ry + 27, { size: 9.5, color: THEME.TX2 });
      drawText(ctx, val.text, baseX + lbW - 18, ry + 18, {
        size: 11,
        bold: true,
        color: idx < 3 ? rankCol : '#7DD3FC',
        align: 'right',
        mono: true,
      });
      hits.add(baseX + 12, ry, lbW - 24, 36, () => {
        SoundEngine.playClick();
        actions.onInspectPlayer(p);
      });
    });

    // 右栏：3×3 球员卡墙
    drawChamferPanel(ctx, wallX, panelY, wallW, panelH, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);

    const filters: Array<[PosFilter, string]> = [
      ['ALL', `全部(${displayRoster.length})`],
      ['GK', '门将'],
      ['DEF', '后卫'],
      ['MID', '中场'],
      ['ATT', '前锋'],
    ];
    filters.forEach(([fk, fl], fi) => {
      const fx = wallX + 12 + fi * 58;
      const active = this.filter === fk;
      const hov = hits.isHovered(fx, panelY + 10, 54, 24);
      if (active) {
        drawRoundRect(ctx, fx, panelY + 10, 54, 24, 12, 'rgba(245, 158, 11, 0.2)', THEME.GOLD_LIGHT, 1);
      }
      drawText(ctx, fl, fx + 27, panelY + 22, {
        size: 10.5,
        bold: active || hov,
        color: active ? THEME.GOLD_LIGHT : hov ? '#FFFFFF' : THEME.TX2,
        align: 'center',
      });
      hits.add(fx, panelY + 10, 54, 24, () => {
        this.filter = fk;
        this.page = 0;
      });
    });

    const sorts: Array<[SortMode, string]> = [
      ['ca', 'CA'],
      ['pa', 'PA'],
      ['age', '年龄'],
      ['goals', '进球'],
      ['distance', '跑动'],
    ];
    sorts.forEach(([sk, sl], si) => {
      const sx = wallX + 314 + si * 46;
      const active = this.sortMode === sk;
      const hov = hits.isHovered(sx, panelY + 10, 42, 24);
      drawText(ctx, sl, sx + 21, panelY + 22, {
        size: 10,
        bold: active || hov,
        color: active ? '#38BDF8' : hov ? '#E2E8F0' : THEME.TX3,
        align: 'center',
      });
      if (active) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(sx + 8, panelY + 32, 26, 2);
      }
      hits.add(sx, panelY + 10, 42, 24, () => {
        this.sortMode = sk;
        this.page = 0;
      });
    });

    drawText(
      ctx,
      isLocked ? '点击球员查看完整属性面板' : '可在转会市场出售冗余球员',
      wallX + wallW - 14,
      panelY + 22,
      { size: 10.5, color: THEME.TX3, align: 'right' }
    );

    // 助教阵容分析与引援提示模块
    const advice = this.buildAssistantAdvice(displayRoster, club.formation);
    const advY = panelY + 40;
    const advH = 58;
    drawRoundRect(ctx, wallX + 12, advY, wallW - 24, advH, 8, 'rgba(12, 30, 54, 0.88)', '#38BDF8', 1.1);
    const mentorImg = AssetLoader.get('portrait_mentor');
    if (mentorImg && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(wallX + 38, advY + 29, 20, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(mentorImg, wallX + 18, advY + 9, 40, 40);
      ctx.restore();
      ctx.strokeStyle = THEME.GOLD_LIGHT;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(wallX + 38, advY + 29, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawBadge(ctx, wallX + 66, advY + 8, 92, 16, '助教引援建议', '#1E3A5F', '#7DD3FC');
    drawText(ctx, fitText(ctx, advice.line1, wallW - 180, 11, true), wallX + 164, advY + 16, { size: 11, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, fitText(ctx, advice.line2, wallW - 84, 11), wallX + 66, advY + 41, { size: 11, color: '#E2E8F0' });

    const filtered = [...displayRoster]
      .filter(p => this.matchFilter(p))
      .sort((a, b) => {
        if (this.sortMode === 'pa') return (b.pa ?? b.ca) - (a.pa ?? a.ca) || b.ca - a.ca;
        if (this.sortMode === 'age') return a.age - b.age || b.ca - a.ca;
        if (this.sortMode === 'goals') return (b.seasonStats.goals ?? 0) - (a.seasonStats.goals ?? 0) || b.ca - a.ca;
        if (this.sortMode === 'distance') {
          const da = a.seasonStats.appearances ? (a.seasonStats.distanceM ?? 0) / a.seasonStats.appearances : 0;
          const db = b.seasonStats.appearances ? (b.seasonStats.distanceM ?? 0) / b.seasonStats.appearances : 0;
          return db - da || b.ca - a.ca;
        }
        return b.ca - a.ca;
      });

    const pageSize = 9;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (this.page >= totalPages) this.page = totalPages - 1;
    const visible = filtered.slice(this.page * pageSize, (this.page + 1) * pageSize);
    const cw = Math.floor((wallW - 44) / 3);
    const gap = Math.floor((wallW - 24 - cw * 3) / 2);
    const ch = 132;

    visible.forEach((p, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const px = wallX + 12 + col * (cw + gap);
      const py = panelY + 104 + row * 138;
      const isSel = selectedSet.has(p.id);
      const isSuspended = (p.suspendedRounds ?? 0) > 0;
      const paVal = p.pa ?? p.ca;

      const bgCardId = p.tier === 'S' ? 'card_bg_gold' : p.tier === 'A' ? 'card_bg_purple' : p.tier === 'B' ? 'card_bg_blue' : null;
      const bgCardImg = bgCardId ? AssetLoader.get(bgCardId) : null;

      drawChamferPanel(
        ctx,
        px,
        py,
        cw,
        ch,
        8,
        isSel ? 'rgba(20, 36, 30, 0.94)' : 'rgba(17, 25, 44, 0.94)',
        isSuspended ? THEME.RED_LIGHT : p.tier === 'S' ? THEME.GOLD : isSel ? THEME.GREEN : THEME.BORDER,
        p.tier === 'S' || isSel ? 1.5 : 1,
        p.tier === 'S' ? THEME.GOLD_LIGHT : isSel ? THEME.GREEN : undefined
      );
      if (bgCardImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(px + 2, py + 2, cw - 4, ch - 4);
        ctx.clip();
        ctx.globalAlpha = 0.18;
        ctx.drawImage(bgCardImg, px, py, cw, ch);
        ctx.restore();
      }

      drawPlayerAvatar(ctx, px + 10, py + 7, 36, 44, p, club, { radius: 6 });
      drawBadge(ctx, px + 52, py + 7, 20, 15, p.tier, tierColor(p.tier));
      drawBadge(ctx, px + 76, py + 7, 30, 15, p.role, '#1E293B', THEME.TX1);
      drawBadge(ctx, px + 110, py + 7, 34, 15, `${p.age}岁`, '#1E3A5F', '#7DD3FC');
      if (isSuspended) drawBadge(ctx, px + 148, py + 7, 28, 15, '停赛', '#991B1B', '#FECACA');

      drawText(ctx, p.name, px + 52, py + 33, { size: 12.5, bold: true, color: THEME.TX1 });
      const secText = p.secondaryRoles && p.secondaryRoles.length > 0 ? `兼:${p.secondaryRoles.join('/')}` : '专职';
      drawText(ctx, `${secText} · 身价 ${formatFunds(p.marketValue ?? p.cost)}`, px + 52, py + 47, {
        size: 9,
        color: '#7DD3FC',
      });

      drawText(ctx, `CA ${p.ca}`, px + cw - 10, py + 16, { size: 12.5, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      drawText(ctx, `PA ${paVal}`, px + cw - 10, py + 32, { size: 9.5, bold: true, color: paVal >= 85 ? THEME.GOLD_LIGHT : '#38BDF8', align: 'right', mono: true });

      const attrPairs: Array<[IconName, number]> = p.role === 'GK'
        ? [
            ['stat_gk', p.attributes.goalkeeping],
            ['stat_pos', p.attributes.positioning],
            ['stat_calm', p.attributes.composure],
            ['stat_pass', p.attributes.passing],
            ['shield', p.attributes.strength],
            ['stat_fit', p.attributes.stamina],
          ]
        : [
            ['stat_pace', p.attributes.pace],
            ['stat_shoot', p.attributes.shooting],
            ['stat_pass', p.attributes.passing],
            ['ball', p.attributes.dribbling],
            ['stat_def', p.attributes.defending],
            ['stat_fit', p.attributes.stamina],
          ];

      const boxW = Math.floor((cw - 28) / 3);
      attrPairs.forEach(([ic, val], ai) => {
        const acol = ai % 3;
        const arow = Math.floor(ai / 3);
        const ax = px + 10 + acol * (boxW + 4);
        const ay = py + 56 + arow * 20;
        drawRoundRect(ctx, ax, ay, boxW, 17, 4, 'rgba(11, 17, 30, 0.85)', 'rgba(148, 163, 184, 0.20)');
        drawIcon(ctx, ic, ax + 11, ay + 8.5, 10, THEME.TX3);
        drawText(ctx, `${val}`, ax + boxW - 6, ay + 8.5, { size: 10.5, bold: true, color: this.statColor(val), align: 'right', mono: true });
      });

      const traitText = p.traits && p.traits.length > 0 ? p.traits.slice(0, 2).join(' · ') : '均衡型球员';
      drawText(ctx, fitText(ctx, traitText, cw - 60, 9.5), px + 12, py + 103, { size: 9.5, color: '#A5B4FC' });
      drawButton(ctx, hits, px + cw - 42, py + 93, 34, 18, p.isStarred ? '★' : '☆', () => {
        const next = league.toggleStarPlayer(p.id);
        actions.onSave();
        actions.onToast?.(next ? `已收藏【${p.name}】，换人时将优先置顶` : `已取消收藏【${p.name}】`, next ? THEME.GOLD_LIGHT : THEME.TX2);
      }, { variant: p.isStarred ? 'gold' : 'ghost', fontSize: 10 });

      const apps = p.seasonStats.appearances ?? 0;
      const botY = py + 120;
      let lx = px + 12;
      drawText(ctx, `${apps}场`, lx, botY, { size: 9.5, color: THEME.TX2, mono: true });
      lx += 28;
      if (p.role === 'GK') {
        lx += drawStatMicro(ctx, 'stat_gk', `${p.seasonStats.saves ?? 0}`, lx, botY, { iconSize: 9.5, fontSize: 9.5, iconColor: THEME.TX3, valueColor: THEME.TX1, gap: 2 });
        lx += 7;
        drawStatMicro(ctx, 'shield', `${p.seasonStats.cleanSheets ?? 0}`, lx, botY, { iconSize: 9.5, fontSize: 9.5, iconColor: THEME.TX3, valueColor: THEME.GREEN, gap: 2 });
      } else {
        lx += drawStatMicro(ctx, 'ball', `${p.seasonStats.goals ?? 0}`, lx, botY, { iconSize: 9.5, fontSize: 9.5, iconColor: THEME.TX3, valueColor: THEME.TX1, gap: 2 });
        lx += 7;
        drawStatMicro(ctx, 'stat_assist', `${p.seasonStats.assists ?? 0}`, lx, botY, { iconSize: 9.5, fontSize: 9.5, iconColor: THEME.TX3, valueColor: THEME.TX1, gap: 2 });
      }
      const fitPct = Math.round(p.fitness ?? 100);
      drawMiniBar(ctx, px + cw - 64, botY - 2, 26, 4, fitPct / 100, fitPct < 60 ? '#FBBF24' : THEME.GREEN);
      drawText(ctx, `${fitPct}%`, px + cw - 10, botY, { size: 9.5, color: fitPct < 60 ? '#FBBF24' : THEME.TX2, align: 'right', mono: true });

      hits.add(px, py, cw, ch, () => {
        SoundEngine.playClick();
        actions.onInspectPlayer(p);
      });
    });

    if (totalPages > 1) {
      const centerX = wallX + wallW / 2;
      drawButton(ctx, hits, centerX - 154, panelY + panelH - 36, 94, 26, '上一页', () => {
        this.page = Math.max(0, this.page - 1);
      }, { disabled: this.page === 0, fontSize: 10.5 });
      drawText(ctx, `第 ${this.page + 1} / ${totalPages} 页 (共 ${filtered.length} 人)`, centerX, panelY + panelH - 23, {
        size: 10.5,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, centerX + 60, panelY + panelH - 36, 94, 26, '下一页', () => {
        this.page = Math.min(totalPages - 1, this.page + 1);
      }, { disabled: this.page >= totalPages - 1, fontSize: 10.5 });
    }
  }

  private buildAssistantAdvice(roster: DraftPlayer[], formation: string): { line1: string; line2: string } {
    const gk = roster.filter(p => p.role === 'GK');
    const cb = roster.filter(p => p.role === 'CB');
    const fb = roster.filter(p => ['LB', 'RB', 'LWB', 'RWB'].includes(p.role));
    const mid = roster.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role));
    const att = roster.filter(p => ['LW', 'RW', 'ST'].includes(p.role));

    const gap = Math.max(0, SEASON_SQUAD_SIZE - roster.length);
    const countsTxt = `门将${gk.length} · 中卫${cb.length} · 边卫${fb.length} · 中场${mid.length} · 锋线${att.length}`;
    const line1 = gap > 0
      ? `阵型 ${formation} · 距 ${SEASON_SQUAD_SIZE} 人注册还差 ${gap} 人（${countsTxt}）`
      : `阵型 ${formation} · ${roster.length} 人已达标（${countsTxt}）`;

    const needs: string[] = [];
    if (gk.length < 2) needs.push('替补门将');
    if (cb.length < 3) needs.push('中卫轮换');
    if (fb.length < 2) needs.push('边后卫');
    if (mid.length < 5) needs.push('中场厚度');
    if (att.length < 4) needs.push('锋线替补');

    const avgOf = (list: DraftPlayer[]) => (list.length ? Math.round(list.reduce((s, p) => s + p.ca, 0) / list.length) : 0);
    const lineAvgs = [
      { name: '后防', val: avgOf([...cb, ...fb]), count: cb.length + fb.length },
      { name: '中场', val: avgOf(mid), count: mid.length },
      { name: '锋线', val: avgOf(att), count: att.length },
    ].filter(x => x.count > 0).sort((a, b) => a.val - b.val);
    const weakest = lineAvgs[0];
    const u23HighPA = roster.filter(p => p.age <= 23 && (p.pa ?? p.ca) - p.ca >= 8).length;
    const oldAvg = roster.length ? Math.round(roster.reduce((s, p) => s + p.age, 0) / roster.length) : 25;

    let line2 = '';
    if (needs.length > 0) {
      line2 = `急需补全：【${needs.slice(0, 2).join('、')}】；${weakest ? `${weakest.name}均分(${weakest.val})偏低，` : ''}建议优先去转会市场签即战力`;
    } else if (u23HighPA < 3 || oldAvg >= 28) {
      line2 = `阵容已齐但平均年龄偏高(${oldAvg}岁)，建议去青训学院淘 1~2 名 U19 高潜新星接班`;
    } else if (weakest) {
      line2 = `各线人数充足，当前【${weakest.name}】均分(${weakest.val})相对偏低，可针对性升级高 CA 主力`;
    } else {
      line2 = '阵容结构均衡，可按战术偏好在转会市场或经纪人密荐冲击高潜强援';
    }
    return { line1, line2 };
  }

  private renderYouthAcademyTab(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onInspectPlayer: (p: DraftPlayer, opts?: { scoutFog?: boolean; revealCount?: number }) => void;
      onSave: () => void;
      onToast?: (msg: string, color?: string) => void;
    },
    baseX: number,
    totalW: number,
    panelY: number,
    panelH: number,
    isWindowOpen: boolean
  ): void {
    const club = league.getUserClub();
    const funds = league.getClubFunds();
    const ya = league.getYouthAcademyState();
    const meta = league.getMetaLevels();
    const roster = league.getClubRoster();
    const acaLv = meta.academy ?? 0;

    drawChamferPanel(ctx, baseX, panelY, totalW, panelH, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD);
    drawText(ctx, `U19 青训学院 (青训 Lv.${acaLv} · 球探 Lv.${meta.scout || 0} · 在训 ${ya.candidates.length}/6 人)`, baseX + 20, panelY + 24, {
      size: 16,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(
      ctx,
      '小妖每半季自然涨球且迷雾渐清；赛季末超过 19 岁自动解约并补录 16~18 岁新生（锁窗期仍可球探考察）',
      baseX + 20,
      panelY + 45,
      { size: 11, color: '#7DD3FC' }
    );

    const nextRerollCost = 60 + (ya.paidRefreshesUsed ?? 0) * 30;
    const isFreeReroll = ya.freeRefreshesLeft > 0;
    const rerollLabel = !isWindowOpen
      ? '锁窗不可刷新'
      : isFreeReroll
      ? `免费刷新试训 (${ya.freeRefreshesLeft}次)`
      : `刷新试训 (${formatFunds(nextRerollCost)})`;
    drawButton(ctx, hits, baseX + totalW - 428, panelY + 14, 194, 32, rerollLabel, () => {
      const res = league.rerollYouthProspects(!isFreeReroll);
      if (res.ok) {
        SoundEngine.playClick();
        actions.onSave();
        actions.onToast?.(
          isFreeReroll ? '已免费刷新 U19 青训名单！' : `已花费 ${formatFunds(res.cost ?? nextRerollCost)} 刷新名单`,
          '#38BDF8'
        );
      } else {
        actions.onToast?.(res.reason || '刷新失败', THEME.RED_LIGHT);
      }
    }, { variant: 'primary', disabled: !isWindowOpen || (!isFreeReroll && funds < nextRerollCost), fontSize: 11, icon: 'refresh' });

    drawButton(ctx, hits, baseX + totalW - 224, panelY + 14, 204, 32, '海外 U18 盲包×3 (¥380万)', () => {
      const res = league.buyOverseasYouthPack();
      if (res.ok) {
        SoundEngine.playFanfare();
        actions.onSave();
        actions.onToast?.('海外球探带回 3 名全新 U18 小妖进入青训学院！', THEME.GOLD_LIGHT);
      } else {
        actions.onToast?.(res.reason || '购买失败', THEME.RED_LIGHT);
      }
    }, { variant: isWindowOpen && funds >= 380 ? 'gold' : 'ghost', disabled: !isWindowOpen || funds < 380, fontSize: 11, icon: 'sparkle' });

    if (ya.candidates.length === 0) {
      drawText(ctx, '本窗青训学员已全部提拔，新学员将在下个转会窗/季末自动补录', baseX + totalW / 2, panelY + 260, {
        size: 13.5,
        color: THEME.TX2,
        align: 'center',
      });
      return;
    }

    const cw = Math.floor((totalW - 64) / 3);
    const gap = Math.floor((totalW - 40 - cw * 3) / 2);
    const ch = 226;

    ya.candidates.slice(0, 6).forEach((p, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cx = baseX + 20 + col * (cw + gap);
      const cy = panelY + 66 + row * 238;
      const fog = p.scoutFogLevel ?? 0;
      const pa = p.pa ?? p.ca;
      const disc = acaLv >= 5 ? 0.75 : acaLv >= 3 ? 0.85 : 1.0;
      const signCost = Math.round(Math.max(40, (p.ca - 35) * 3.5) * disc);

      drawChamferPanel(ctx, cx, cy, cw, ch, 10, THEME.BG_CARD, fog >= 2 ? THEME.GOLD_LIGHT : fog === 1 ? '#38BDF8' : THEME.BORDER, 1.3);
      drawPlayerAvatar(ctx, cx + 14, cy + 12, 50, 62, p, club, { radius: 6 });

      drawBadge(ctx, cx + 74, cy + 12, 26, 18, fog >= 2 ? p.tier : '?', fog >= 2 ? tierColor(p.tier) : '#334155', THEME.GOLD_LIGHT);
      drawBadge(ctx, cx + 104, cy + 12, 38, 18, p.role, '#1E293B', THEME.TX1);
      drawBadge(ctx, cx + 146, cy + 12, 42, 18, `${p.age}岁`, p.age >= 19 ? '#7F1D1D' : '#1E3A5F', p.age >= 19 ? '#FCA5A5' : '#7DD3FC');
      if (p.age >= 19) {
        drawBadge(ctx, cx + 192, cy + 12, 64, 18, '季末解约', '#991B1B', '#FECACA');
      }
      drawText(ctx, p.name, cx + 74, cy + 44, { size: 15, bold: true, color: THEME.TX1 });

      const caStr = fog === 0 ? 'CA ??' : fog === 1 ? `CA ~${Math.round(p.ca / 5) * 5}` : `CA ${p.ca}`;
      const paStr = fog === 0 ? 'PA ???' : fog === 1 ? `PA ${Math.max(45, pa - 7)}~${Math.min(99, pa + 7)}` : `PA ${pa}`;
      drawText(ctx, caStr, cx + cw - 14, cy + 26, { size: 13, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      drawText(ctx, paStr, cx + cw - 14, cy + 46, { size: 11, bold: true, color: fog >= 2 && pa >= 85 ? THEME.GOLD_LIGHT : '#38BDF8', align: 'right', mono: true });

      if (fog < 2) {
        // 半透明球探迷雾遮罩 + 点击卡片看报告提示
        drawRoundRect(ctx, cx + 14, cy + 84, cw - 28, 38, 6, 'rgba(15, 23, 42, 0.56)', 'rgba(148, 163, 184, 0.25)', 1);
      }
      drawText(ctx, `特质：${p.traits?.slice(0, 2).join(' · ') || '待发掘'}`, cx + 22, cy + 94, { size: 10.5, color: '#A5B4FC' });
      drawText(
        ctx,
        fog === 0 ? '迷雾 Lv.0 · 点击整卡看初探档案' : fog === 1 ? '迷雾 Lv.1 · 点击整卡看潜力区间' : '迷雾 Lv.2 · 真实 CA/PA 已揭晓（点卡看详情）',
        cx + 22,
        cy + 112,
        { size: 10, color: fog >= 2 ? THEME.GREEN : '#7DD3FC' }
      );

      // 整卡上半区点击直接查看球探报告（取消独立「查看球探报告」按钮）
      hits.add(cx, cy, cw, 126, () => {
        SoundEngine.playClick();
        actions.onInspectPlayer(p, { scoutFog: fog < 2, revealCount: fog === 2 ? 10 : fog === 1 ? 6 : 3 });
      });

      if (fog < 2) {
        const scoutCost = fog === 0 ? 40 : 90;
        const scoutLbl = fog === 0 ? '初探揭雾 (¥40万)' : '深探揭秘 (¥90万)';
        drawButton(ctx, hits, cx + 14, cy + 130, cw - 28, 32, scoutLbl, () => {
          const res = league.scoutYouthProspect(p.id);
          if (res.ok) {
            SoundEngine.playGoalCheer();
            actions.onSave();
            actions.onToast?.(
              res.newLevel === 1
                ? `初探 ${p.name} 完成，显露大致潜力区间！`
                : `深度球探报告揭晓：${p.name} CA ${p.ca} / PA ${pa}！`,
              res.newLevel === 1 ? '#38BDF8' : THEME.GOLD_LIGHT
            );
          } else {
            actions.onToast?.(res.reason || '探查失败', THEME.RED_LIGHT);
          }
        }, { variant: fog === 0 ? 'primary' : 'gold', disabled: funds < scoutCost, fontSize: 11, icon: 'sparkle' });
      } else {
        drawBadge(ctx, cx + 14, cy + 134, cw - 28, 24, '✓ 球探报告已 100% 透明', '#14532D', THEME.GREEN);
      }

      const canSign = isWindowOpen && funds >= signCost && roster.length < MAX_CLUB_ROSTER;
      const signLbl = !isWindowOpen ? `锁窗期暂不可提拔 (${formatFunds(signCost)})` : `提拔签入一线队 (${formatFunds(signCost)})`;
      drawButton(ctx, hits, cx + 14, cy + 174, cw - 28, 36, signLbl, () => {
        const res = league.signYouthProspect(p.id);
        if (res.ok && res.player) {
          SoundEngine.playGoalCheer();
          actions.onSave();
          actions.onToast?.(`提拔【${res.player.tier}级】${res.player.name} (CA ${res.player.ca} / PA ${res.player.pa ?? res.player.ca})！`, tierColor(res.player.tier));
        } else {
          actions.onToast?.(res.reason || '提拔失败', THEME.RED_LIGHT);
        }
      }, { variant: canSign ? 'green' : 'ghost', disabled: !canSign, fontSize: 11.5 });
    });
  }

  private renderTransferMarketTab(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onInspectPlayer: (p: DraftPlayer, opts?: { scoutFog?: boolean; revealCount?: number }) => void;
      onSave: () => void;
      onToast?: (msg: string, color?: string) => void;
    },
    baseX: number,
    totalW: number,
    panelY: number,
    panelH: number,
    isWindowOpen: boolean
  ): void {
    const club = league.getUserClub();
    const funds = league.getClubFunds();
    const tm = league.getTransferMarketState();
    const roster = league.getClubRoster();

    const leftW = Math.floor((totalW - 12) / 2);
    const rightX = baseX + leftW + 12;
    const rightW = totalW - leftW - 12;

    // 左半区：买人货架（带 Lv.1 球探迷雾）
    drawChamferPanel(ctx, baseX, panelY, leftW, panelH, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD);
    drawText(ctx, `转会挂牌货架 (${tm.marketPool.length}人 · 点行看报告)`, baseX + 18, panelY + 24, { size: 15, bold: true, color: THEME.GOLD_LIGHT });

    const isFreeRef = tm.freeRefreshesLeft > 0;
    const refreshCost = isFreeRef ? 0 : 80 + (tm.paidRefreshesUsed ?? 0) * 40;
    const refreshLabel = !isWindowOpen
      ? '锁窗不可刷新'
      : isFreeRef
      ? `免费刷新 (${tm.freeRefreshesLeft})`
      : `刷新货架 (${formatFunds(refreshCost)})`;
    drawButton(ctx, hits, baseX + leftW - 186, panelY + 12, 168, 30, refreshLabel, () => {
      const res = league.refreshTransferShelf(!isFreeRef);
      if (res.ok) {
        SoundEngine.playClick();
        actions.onSave();
        actions.onToast?.(isFreeRef ? '已免费刷新转会货架！' : `已花费 ${formatFunds(res.cost ?? refreshCost)} 刷新货架！`, '#38BDF8');
      } else {
        actions.onToast?.(res.reason || '刷新失败', THEME.RED_LIGHT);
      }
    }, { variant: 'primary', disabled: !isWindowOpen || (!isFreeRef && funds < refreshCost), fontSize: 10.5, icon: 'refresh' });

    const discountRate = league.getBuyDiscountRate();
    if (tm.marketPool.length === 0) {
      drawText(ctx, '货架球员已全部签完，请点击右上角刷新货架！', baseX + leftW / 2, panelY + 260, {
        size: 13,
        color: THEME.TX2,
        align: 'center',
      });
    } else {
      tm.marketPool.slice(0, 6).forEach((p, idx) => {
        const py = panelY + 52 + idx * 81;
        const fog = p.scoutFogLevel ?? 1;
        const isClear = fog >= 2;
        const price = Math.round((p.marketValue ?? p.cost) * discountRate);
        const canBuy = isWindowOpen && funds >= price && roster.length < MAX_CLUB_ROSTER;
        const rowHover = hits.isHovered(baseX + 14, py, leftW - 28, 73);

        drawRoundRect(
          ctx,
          baseX + 14,
          py,
          leftW - 28,
          73,
          8,
          rowHover ? THEME.BG_CARD_HOVER : THEME.BG_CARD,
          rowHover ? THEME.GOLD_LIGHT : isClear ? THEME.BORDER_GOLD : THEME.BORDER,
          rowHover ? 1.4 : 1
        );
        drawPlayerAvatar(ctx, baseX + 22, py + 9, 42, 55, p, club, { radius: 6, showFrame: false });
        drawBadge(ctx, baseX + 72, py + 11, 22, 16, isClear ? p.tier : '?', isClear ? tierColor(p.tier) : '#334155', THEME.GOLD_LIGHT);
        drawBadge(ctx, baseX + 98, py + 11, 34, 16, p.role, '#1E293B', THEME.TX1);
        drawText(ctx, `${p.name} (${p.age}岁)`, baseX + 138, py + 19, { size: 12.5, bold: true, color: THEME.TX1 });

        const infoLine = isClear
          ? `CA ${p.ca} / PA ${p.pa ?? p.ca} · ${p.traits?.slice(0, 2).join('·') || '即战力'}`
          : `CA ~${Math.round(p.ca / 5) * 5} / PA ??? · 迷雾中（点行看简报）`;
        drawText(ctx, fitText(ctx, infoLine, leftW - 290, 10.5), baseX + 72, py + 47, { size: 10.5, color: isClear ? '#7DD3FC' : THEME.TX2 });

        // 整行点击看球探报告（取消独立「详」按钮）
        hits.add(baseX + 14, py, leftW - 28, 73, () => {
          SoundEngine.playClick();
          actions.onInspectPlayer(p, { scoutFog: !isClear, revealCount: isClear ? 10 : 5 });
        });

        if (!isClear) {
          drawButton(ctx, hits, baseX + leftW - 216, py + 19, 94, 34, '揭雾 ¥35万', () => {
            const res = league.scoutTransferPlayer(p.id);
            if (res.ok) {
              SoundEngine.playGoalCheer();
              actions.onSave();
              actions.onToast?.(`考察揭秘：${p.name} CA ${p.ca} / PA ${p.pa ?? p.ca}！`, THEME.GOLD_LIGHT);
            } else {
              actions.onToast?.(res.reason || '考察失败', THEME.RED_LIGHT);
            }
          }, { variant: 'primary', disabled: funds < 35, fontSize: 10, icon: 'sparkle' });
        } else {
          drawBadge(ctx, baseX + leftW - 212, py + 25, 86, 22, '✓ 已揭秘', '#14532D', THEME.GREEN);
        }

        drawButton(ctx, hits, baseX + leftW - 114, py + 19, 92, 34, isWindowOpen ? `签 ${formatFunds(price)}` : '锁窗', () => {
          const res = league.buyTransferPlayer(p.id);
          if (res.ok) {
            SoundEngine.playGoalCheer();
            actions.onSave();
            actions.onToast?.(`成功签下 ${p.name}（真实 CA ${p.ca}）！`, THEME.GREEN);
          } else {
            actions.onToast?.(res.reason || '签约失败', THEME.RED_LIGHT);
          }
        }, { variant: canBuy ? 'green' : 'ghost', disabled: !canBuy, fontSize: 10.5 });
      });
    }

    // 右半区：出售球员 & AI 竞拍报价
    drawChamferPanel(ctx, rightX, panelY, rightW, panelH, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER);
    drawText(ctx, `出售与 AI 竞拍 (当前 ${roster.length} 人)`, rightX + 18, panelY + 24, { size: 15, bold: true, color: THEME.GOLD_LIGHT });

    const flatOffers = tm.listings.flatMap(l => l.offers.map(of => ({ listing: l, offer: of })));
    drawText(ctx, `AI 竞拍报价 (${flatOffers.length})`, rightX + 18, panelY + 50, { size: 11.5, bold: true, color: '#38BDF8' });
    if (flatOffers.length === 0) {
      drawRoundRect(ctx, rightX + 18, panelY + 64, rightW - 36, 44, 6, 'rgba(15, 23, 42, 0.65)', THEME.BORDER);
      drawText(
        ctx,
        isWindowOpen
          ? '暂无待处理报价 — 可在下方将冗余球员挂牌竞拍或直接变现'
          : '转会窗关闭中 — 仅夏窗/冬窗开放球员出售与挂牌',
        rightX + rightW / 2,
        panelY + 86,
        { size: 10.5, color: THEME.TX3, align: 'center' }
      );
    } else {
      flatOffers.slice(0, 2).forEach(({ listing, offer }, oi) => {
        const oy = panelY + 64 + oi * 44;
        drawRoundRect(ctx, rightX + 18, oy, rightW - 36, 38, 6, 'rgba(20, 83, 45, 0.25)', offer.isGiant ? THEME.GOLD_LIGHT : THEME.GREEN);
        const tag = offer.isGiant ? '【豪门】' : '';
        drawText(ctx, `${tag}${offer.clubName} 报价【${listing.playerName}】${formatFunds(offer.offerPrice)}`, rightX + 28, oy + 19, {
          size: 11,
          bold: true,
          color: THEME.TX1,
        });
        drawButton(ctx, hits, rightX + rightW - 134, oy + 5, 108, 28, `成交 +${formatFunds(offer.offerPrice)}`, () => {
          const res = league.acceptTransferOffer(listing.playerId, offer.id);
          if (res.ok) {
            SoundEngine.playGoalCheer();
            actions.onSave();
            actions.onToast?.(`已出售给 ${res.buyer}，入账 ${formatFunds(res.revenue ?? 0)}！`, THEME.GOLD_LIGHT);
          } else {
            actions.onToast?.(res.reason || '成交失败', THEME.RED_LIGHT);
          }
        }, { variant: 'gold', disabled: !isWindowOpen, fontSize: 10 });
      });
    }

    drawText(ctx, '我方大名单球员（快卖即时到账 / 挂牌竞拍溢价更高）', rightX + 18, panelY + 162, { size: 11.5, bold: true, color: THEME.TX2 });
    const sellList = [...roster].sort((a, b) => a.ca - b.ca);
    const sPageSize = 7;
    const sPages = Math.max(1, Math.ceil(sellList.length / sPageSize));
    if (this.marketSellPage >= sPages) this.marketSellPage = sPages - 1;
    const visibleSell = sellList.slice(this.marketSellPage * sPageSize, (this.marketSellPage + 1) * sPageSize);

    visibleSell.forEach((p, si) => {
      const sy = panelY + 178 + si * 48;
      const val = p.marketValue ?? p.cost;
      const isListed = tm.listings.some(l => l.playerId === p.id);
      drawRoundRect(ctx, rightX + 18, sy, rightW - 36, 42, 6, THEME.BG_CARD, isListed ? THEME.GOLD : THEME.BORDER);
      drawBadge(ctx, rightX + 26, sy + 12, 32, 18, p.role, tierColor(p.tier));
      drawText(ctx, `${p.name} (${p.age}岁) · CA ${p.ca}/PA ${p.pa ?? p.ca}`, rightX + 64, sy + 21, { size: 11, bold: true });

      drawButton(ctx, hits, rightX + rightW - 252, sy + 7, 110, 28, `快卖 +${formatFunds(Math.round(val * 0.72))}`, () => {
        const res = league.quickSellRosterPlayer(p.id);
        if (res.ok) {
          SoundEngine.playClick();
          actions.onSave();
          actions.onToast?.(`已出售 ${p.name}，入账 ${formatFunds(res.revenue ?? 0)}！`, THEME.GOLD_LIGHT);
        } else {
          actions.onToast?.(res.reason || '无法出售', THEME.RED_LIGHT);
        }
      }, { variant: 'ghost', disabled: !isWindowOpen, fontSize: 10 });

      drawButton(ctx, hits, rightX + rightW - 134, sy + 7, 108, 28, isListed ? '已挂牌竞拍' : '挂牌 AI 竞拍', () => {
        const res = league.listPlayerForAuction(p.id);
        if (res.ok) {
          SoundEngine.playClick();
          actions.onSave();
          actions.onToast?.(`已将 ${p.name} 挂牌竞拍，收到 ${res.listing?.offers.length ?? 0} 份报价！`, '#38BDF8');
        } else {
          actions.onToast?.(res.reason || '挂牌失败', THEME.RED_LIGHT);
        }
      }, { variant: isListed ? 'ghost' : 'primary', disabled: !isWindowOpen || isListed, fontSize: 10 });
    });

    if (sPages > 1) {
      const rcX = rightX + rightW / 2;
      drawButton(ctx, hits, rcX - 146, panelY + panelH - 34, 88, 26, '上一页', () => {
        this.marketSellPage = Math.max(0, this.marketSellPage - 1);
      }, { disabled: this.marketSellPage === 0, fontSize: 10 });
      drawText(ctx, `${this.marketSellPage + 1} / ${sPages}`, rcX, panelY + panelH - 21, { size: 10.5, color: THEME.TX2, align: 'center' });
      drawButton(ctx, hits, rcX + 58, panelY + panelH - 34, 88, 26, '下一页', () => {
        this.marketSellPage = Math.min(sPages - 1, this.marketSellPage + 1);
      }, { disabled: this.marketSellPage >= sPages - 1, fontSize: 10 });
    }
  }

  private renderBrokerAndTrainingTab(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onInspectPlayer: (p: DraftPlayer) => void;
      onSave: () => void;
      onToast?: (msg: string, color?: string) => void;
    },
    baseX: number,
    totalW: number,
    panelY: number,
    panelH: number,
    isWindowOpen: boolean
  ): void {
    const club = league.getUserClub();
    const funds = league.getClubFunds();
    const roster = league.getClubRoster();
    const tm = league.getTransferMarketState();

    drawChamferPanel(ctx, baseX, panelY, totalW, panelH, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD);

    const colGap = 16;
    const leftW = Math.floor((totalW - 40 - colGap) * 0.60);
    const rightW = totalW - 40 - colGap - leftW;
    const x1 = baseX + 20;
    const x2 = x1 + leftW + colGap;

    // 左栏：经纪人密荐（高风险赌博机制：输多赢少 + 超级巨星大奖 + 签入或立卖抉择）
    drawChamferPanel(ctx, x1, panelY + 18, leftW, panelH - 36, 10, THEME.BG_CARD, '#C084FC', 1.4);
    drawBadge(ctx, x1 + 18, panelY + 34, 152, 22, '经纪人密荐 · 风险博弈', '#3B0764', '#E9D5FF');
    drawText(ctx, `可用资金 ${formatFunds(funds)}`, x1 + leftW - 18, panelY + 45, {
      size: 12.5,
      bold: true,
      color: THEME.GREEN,
      align: 'right',
      mono: true,
    });

    const pending = tm.pendingBrokerResult;
    if (pending) {
      const p = pending.player;
      const meta = BROKER_TIER_META[pending.outcome];
      const cardX = x1 + 20;
      const cardY = panelY + 72;
      const cardW = leftW - 40;

      drawChamferPanel(ctx, cardX, cardY, cardW, 316, 12, 'rgba(10, 16, 30, 0.96)', meta.color, 2, meta.color);
      drawBadge(ctx, cardX + cardW / 2 - 96, cardY + 16, 192, 26, meta.label, meta.bg, meta.color);

      drawPlayerAvatar(ctx, cardX + 26, cardY + 60, 82, 104, p, club, { radius: 8 });
      drawBadge(ctx, cardX + 124, cardY + 64, 30, 22, p.tier, tierColor(p.tier));
      drawBadge(ctx, cardX + 160, cardY + 64, 46, 22, p.role, '#1E293B', THEME.TX1);
      drawBadge(ctx, cardX + 212, cardY + 64, 48, 22, `${p.age}岁`, '#1E3A5F', '#7DD3FC');
      drawText(ctx, p.name, cardX + 124, cardY + 106, { size: 22, bold: true, color: THEME.TX1 });
      drawText(ctx, `CA ${p.ca}  /  PA ${p.pa ?? p.ca}  ·  估值 ${formatFunds(p.marketValue ?? p.cost)}`, cardX + 124, cardY + 136, {
        size: 13.5,
        bold: true,
        color: THEME.GOLD_LIGHT,
        mono: true,
      });
      drawText(ctx, `特质：${p.traits?.join(' · ') || '标准型'}`, cardX + 124, cardY + 160, { size: 11.5, color: '#A5B4FC' });

      drawRoundRect(ctx, cardX + 22, cardY + 184, cardW - 44, 54, 8, 'rgba(15, 23, 42, 0.85)', THEME.BORDER);
      drawWrappedText(ctx, pending.note, cardX + 36, cardY + 196, cardW - 72, 18, { size: 12, color: THEME.TX1, maxLines: 2 });

      drawButton(ctx, hits, cardX + 22, cardY + 252, Math.floor((cardW - 56) / 2), 46, '签入球队大名单 ✓', () => {
        const res = league.resolveBrokerResult('sign');
        if (res.ok && res.player) {
          SoundEngine.playGoalCheer();
          actions.onSave();
          actions.onToast?.(`已将 ${res.player.name} (CA ${res.player.ca}) 签入大名单！`, THEME.GREEN);
        } else {
          actions.onToast?.(res.reason || '入队失败', THEME.RED_LIGHT);
        }
      }, { variant: 'green', disabled: roster.length >= MAX_CLUB_ROSTER, fontSize: 13 });

      drawButton(
        ctx,
        hits,
        cardX + 34 + Math.floor((cardW - 56) / 2),
        cardY + 252,
        Math.floor((cardW - 56) / 2),
        46,
        `立即转手出售 (+${formatFunds(pending.sellPrice)})`,
        () => {
          const res = league.resolveBrokerResult('sell');
          if (res.ok) {
            SoundEngine.playClick();
            actions.onSave();
            actions.onToast?.(`已当场转手，回血 ${formatFunds(res.revenue ?? pending.sellPrice)}！`, THEME.GOLD_LIGHT);
          } else {
            actions.onToast?.(res.reason || '出售失败', THEME.RED_LIGHT);
          }
        },
        { variant: 'gold', fontSize: 13 }
      );

      drawButton(ctx, hits, cardX + cardW - 122, cardY + 62, 100, 28, '查看详细属性', () => {
        SoundEngine.playClick();
        actions.onInspectPlayer(p);
      }, { variant: 'ghost', fontSize: 10.5 });
    } else {
      drawText(ctx, '顶级经纪人地下通道 · 按当前联赛标准百分比浮动', x1 + 18, panelY + 72, { size: 16.5, bold: true, color: THEME.TX1 });
      drawText(ctx, '高风险博弈：输多赢少，但有概率直接抽中远超联赛水准的超级巨星！开出后可选择【入队】或【立即出售】', x1 + 18, panelY + 96, {
        size: 11,
        color: '#CBD5E1',
      });

      // 常规密荐 ¥220万
      drawRoundRect(ctx, x1 + 18, panelY + 120, leftW - 36, 174, 10, 'rgba(15, 23, 42, 0.88)', '#38BDF8', 1.2);
      drawText(ctx, '常规经纪人密荐 · ¥220万', x1 + 34, panelY + 144, { size: 15.5, bold: true, color: '#7DD3FC' });
      drawText(ctx, '每赛季限 1 次 · 仅转会窗开放', x1 + leftW - 34, panelY + 144, { size: 11, color: THEME.TX3, align: 'right' });
      drawText(ctx, '• 55% 水货 (-20%~-8% 联赛标准 CA)   · 30% 合格 (-5%~+4%)', x1 + 34, panelY + 174, { size: 11.5, color: '#FCA5A5' });
      drawText(ctx, '• 12% 捡漏精品 (+6%~+14% CA)         · 3% 超级巨星 (+18%~+28% CA)', x1 + 34, panelY + 198, { size: 11.5, color: THEME.GOLD_LIGHT });
      drawText(ctx, '• 若不满意可当场转手变现，及时止损回血', x1 + 34, panelY + 222, { size: 11, color: THEME.TX2 });
      const smallDisabled = !isWindowOpen || tm.mysteryBoxSmallUsed || funds < 220;
      drawButton(
        ctx,
        hits,
        x1 + 34,
        panelY + 242,
        leftW - 68,
        38,
        tm.mysteryBoxSmallUsed ? '本季已开启常规密荐' : !isWindowOpen ? '转会窗关闭中' : '开启常规经纪人密荐 (¥220万)',
        () => {
          const res = league.openBrokerPackage('small');
          if (res.ok && res.result) {
            SoundEngine.playFanfare();
            actions.onSave();
            actions.onToast?.(`密荐揭晓：${res.result.player.name} (CA ${res.result.player.ca})！请选择入队或出售`, BROKER_TIER_META[res.result.outcome].color);
          } else {
            actions.onToast?.(res.reason || '开启失败', THEME.RED_LIGHT);
          }
        },
        { variant: 'primary', disabled: smallDisabled, fontSize: 12 }
      );

      // 金牌密荐 ¥450万
      drawRoundRect(ctx, x1 + 18, panelY + 312, leftW - 36, 186, 10, 'rgba(120, 53, 15, 0.28)', THEME.GOLD, 1.4);
      drawText(ctx, '金牌经纪人密荐 · ¥450万', x1 + 34, panelY + 336, { size: 15.5, bold: true, color: THEME.GOLD_LIGHT });
      drawText(ctx, '巨星概率翻倍 · 每赛季限 1 次', x1 + leftW - 34, panelY + 336, { size: 11, color: THEME.GOLD_LIGHT, align: 'right' });
      drawText(ctx, '• 48% 水货 (-16%~-6% 联赛标准 CA)   · 32% 合格 (-3%~+6%)', x1 + 34, panelY + 366, { size: 11.5, color: '#FCA5A5' });
      drawText(ctx, '• 14% 捡漏精品 (+8%~+16% CA)         · 6% 超级巨星 (+20%~+30% CA)', x1 + 34, panelY + 390, { size: 11.5, color: THEME.GOLD_LIGHT });
      drawText(ctx, '• 高赌注豪赌：开出超级巨星可直接改变整个赛季争冠格局！', x1 + 34, panelY + 414, { size: 11, color: THEME.TX1 });
      const largeDisabled = !isWindowOpen || tm.mysteryBoxLargeUsed || funds < 450;
      drawButton(
        ctx,
        hits,
        x1 + 34,
        panelY + 440,
        leftW - 68,
        42,
        tm.mysteryBoxLargeUsed ? '本季已开启金牌密荐' : !isWindowOpen ? '转会窗关闭中' : '开启金牌经纪人密荐 (¥450万)',
        () => {
          const res = league.openBrokerPackage('large');
          if (res.ok && res.result) {
            SoundEngine.playFanfare();
            actions.onSave();
            actions.onToast?.(`金牌密荐揭晓：${res.result.player.name} (CA ${res.result.player.ca})！请选择入队或出售`, BROKER_TIER_META[res.result.outcome].color);
          } else {
            actions.onToast?.(res.reason || '开启失败', THEME.RED_LIGHT);
          }
        },
        { variant: 'gold', disabled: largeDisabled, fontSize: 12.5 }
      );
    }

    // 右栏：私教魔鬼特训 (¥350万)
    drawChamferPanel(ctx, x2, panelY + 18, rightW, panelH - 36, 10, THEME.BG_CARD, THEME.RED_LIGHT, 1.4);
    drawBadge(ctx, x2 + 18, panelY + 34, 152, 22, '私教特训 · 突破上限', '#7F1D1D', '#FCA5A5');
    drawText(ctx, `魔鬼特训 (¥350万 · ${tm.privateTrainCount}/2)`, x2 + 18, panelY + 72, { size: 15.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '直接 +1~3 CA 并有机会突破 PA 天花板（仅转会窗开放）', x2 + 18, panelY + 95, { size: 10.5, color: '#FCA5A5' });

    const trainPool = [...roster].sort((a, b) => b.ca - a.ca).slice(0, 7);
    if (!this.devilTargetId || !trainPool.some(p => p.id === this.devilTargetId)) {
      this.devilTargetId = trainPool[0]?.id ?? null;
    }
    const canTrainNow = isWindowOpen && funds >= 350 && tm.privateTrainCount < 2;
    trainPool.forEach((p, ti) => {
      const ty = panelY + 114 + ti * 46;
      const isSel = this.devilTargetId === p.id;
      drawRoundRect(ctx, x2 + 16, ty, rightW - 32, 40, 6, isSel ? '#3B1E24' : 'rgba(15, 23, 42, 0.85)', isSel ? THEME.GOLD_LIGHT : THEME.BORDER);
      drawBadge(ctx, x2 + 24, ty + 11, 32, 18, p.role, tierColor(p.tier));
      drawText(ctx, `${p.name} (${p.age}岁)`, x2 + 64, ty + 20, { size: 11.5, bold: true });
      drawText(ctx, `CA ${p.ca}/${p.pa ?? p.ca}`, x2 + rightW - 94, ty + 20, { size: 11, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      hits.add(x2 + 16, ty, rightW - 100, 40, () => {
        SoundEngine.playClick();
        this.devilTargetId = p.id;
      });
      drawButton(ctx, hits, x2 + rightW - 86, ty + 7, 62, 26, '特训', () => {
        this.devilTargetId = p.id;
        const res = league.privateDevilTraining(p.id);
        if (res.ok) {
          SoundEngine.playBreakthrough();
          actions.onSave();
          actions.onToast?.(res.note || `魔鬼特训完成：${p.name} 实力提升！`, res.paBreak ? THEME.GOLD_LIGHT : THEME.GREEN);
        } else {
          actions.onToast?.(res.reason || '特训失败', THEME.RED_LIGHT);
        }
      }, { variant: canTrainNow ? 'gold' : 'ghost', disabled: !canTrainNow, fontSize: 10.5 });
    });

    const targetP = roster.find(r => r.id === this.devilTargetId);
    const trainDisabled = !isWindowOpen || !targetP || funds < 350 || tm.privateTrainCount >= 2;
    drawButton(
      ctx,
      hits,
      x2 + 16,
      panelY + panelH - 72,
      rightW - 32,
      40,
      !isWindowOpen
        ? '转会窗关闭中'
        : tm.privateTrainCount >= 2
        ? '本季特训次数已达上限 (2/2)'
        : targetP
        ? `对【${targetP.name}】开启特训 (¥350万)`
        : '请先点选上方一名球员',
      () => {
        if (!targetP) return;
        const res = league.privateDevilTraining(targetP.id);
        if (res.ok) {
          SoundEngine.playBreakthrough();
          actions.onSave();
          actions.onToast?.(res.note || `魔鬼特训完成：${targetP.name} 实力提升！`, res.paBreak ? THEME.GOLD_LIGHT : THEME.GREEN);
        } else {
          actions.onToast?.(res.reason || '特训失败', THEME.RED_LIGHT);
        }
      },
      { variant: !trainDisabled ? 'gold' : 'ghost', disabled: trainDisabled, fontSize: 11.5 }
    );
  }
}
