/**
 * 我的球队 · 俱乐部大名单管理 + 队内数据榜单 + 球员卡展示
 * - 赛季进行中：大名单彻底锁死（禁止引援、禁止调整报名、禁止重开赛季），仅供查阅大名单与队内榜单
 * - 休赛期/未开赛：可自由招募 40 人俱乐部大名单并勾选 26 人报名出战新赛季
 * - 左侧提供 6 维队内内部榜单（进球、助攻、抢断解围、场均跑动、场均传球、扑救零封）
 * - 右侧以 3×3 球员卡展示，卡面直接外显年龄、核心数值、特质与本赛季数据
 */

import { LeagueManager, MAX_CLUB_ROSTER, SEASON_SQUAD_SIZE } from '../../../core/src/LeagueManager';
import { generateShuffleSet } from '../../../core/src/PlayerPool';
import { DraftPlayer } from '../../../core/src/types';
import { AssetLoader } from '../AssetLoader';
import { drawPlayerAvatar } from '../AvatarRenderer';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawRoundRect,
  drawText,
  HitRegistry,
  tierColor,
} from '../CanvasKit';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';

type PosFilter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT';
type LeaderboardTab = 'goals' | 'assists' | 'defense' | 'distance' | 'passes' | 'gk';
type SortMode = 'ca' | 'age' | 'goals' | 'distance';

const LB_TABS: Array<{ key: LeaderboardTab; label: string }> = [
  { key: 'goals', label: '射手榜' },
  { key: 'assists', label: '助攻榜' },
  { key: 'defense', label: '抢断解围' },
  { key: 'distance', label: '场均跑动' },
  { key: 'passes', label: '场均传球' },
  { key: 'gk', label: '扑救/零封' },
];

export class ClubRosterScreen {
  private filter: PosFilter = 'ALL';
  private lbTab: LeaderboardTab = 'goals';
  private sortMode: SortMode = 'ca';
  private page = 0;
  private recruitPool: DraftPlayer[] = [];

  private ensureRecruitPool(league: LeagueManager): void {
    if (this.recruitPool.length === 0) {
      const meta = league.getMetaLevels();
      this.recruitPool = generateShuffleSet(12, 62 + meta.scout, 82 + meta.scout);
    }
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
    if (tab === 'goals') {
      return { score: s.goals ?? 0, text: `${s.goals ?? 0} 球` };
    }
    if (tab === 'assists') {
      return { score: s.assists ?? 0, text: `${s.assists ?? 0} 助` };
    }
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
      onStartSeasonFromRoster: () => void;
      onInspectPlayer: (p: DraftPlayer, opts?: { scoutFog?: boolean; revealCount?: number }) => void;
      onSave: () => void;
      onToast?: (msg: string, color?: string) => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const isLocked = league.isSeasonInProgress();
    const rawRoster = league.getClubRoster();

    // 合并大名单与当前赛季阵容（确保赛季中数据与报名状态实时一致）
    const activeSquadMap = new Map(club.squad.map(p => [p.id, p]));
    const displayRoster: DraftPlayer[] =
      rawRoster.length > 0
        ? rawRoster.map(rp => activeSquadMap.get(rp.id) ?? rp)
        : club.squad;

    const selectedIds = isLocked
      ? club.squad.map(p => p.id)
      : league.getRosterSelectedIds();
    const selectedSet = new Set(selectedIds);

    drawBroadcastHeader(ctx, hits, {
      kicker: isLocked ? 'CLUB ROSTER · 赛季进行中（大名单已锁死）' : 'CLUB ROSTER · 休赛期大名单管理',
      title: `${club.name} · 我的球队大名单`,
      club,
      badge: isLocked
        ? `🔒 大名单已锁定 · 报名 ${club.squad.length} 人`
        : `俱乐部 ${displayRoster.length}/${MAX_CLUB_ROSTER} · 报名 ${selectedIds.length}/${SEASON_SQUAD_SIZE}`,
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
      rightAction: { label: '返回', variant: 'ghost', onClick: actions.onBack },
    });

    // 仅在【非赛季进行中】且【大名单未满 40 人】时，才允许进入建队招募候选池
    if (!isLocked && rawRoster.length < MAX_CLUB_ROSTER) {
      this.ensureRecruitPool(league);
      const meta = league.getMetaLevels();
      const refreshesLeft = league.getRosterRefreshesRemaining();
      const revealCount = 3 + Math.min(2, meta.scout ?? 0);

      drawChamferPanel(ctx, 16, 80, 620, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER_GOLD);
      drawText(ctx, `组建 ${MAX_CLUB_ROSTER} 人俱乐部大名单 (当前 ${rawRoster.length}/${MAX_CLUB_ROSTER})`, 34, 106, {
        size: 16,
        bold: true,
        color: THEME.GOLD_LIGHT,
      });
      drawText(ctx, `球探盲盒：点卡片查看局部小数据，签入后揭晓真实 CA（刷新上限 ${refreshesLeft} 次）`, 34, 130, {
        size: 11,
        color: '#7DD3FC',
      });

      drawButton(ctx, hits, 34, 148, 156, 30, `刷新候选池 (${refreshesLeft})`, () => {
        const r = league.consumeRosterRefresh();
        if (r.ok) {
          SoundEngine.playClick();
          this.recruitPool = generateShuffleSet(12, 62 + meta.scout, 82 + meta.scout);
          actions.onSave();
        } else {
          actions.onToast?.(r.reason || '刷新次数已用完', THEME.RED_LIGHT);
        }
      }, { variant: 'primary', disabled: refreshesLeft <= 0, fontSize: 11, icon: 'refresh' });

      drawButton(ctx, hits, 200, 148, 200, 30, `一键补齐至 ${MAX_CLUB_ROSTER} 人 ▶`, () => {
        SoundEngine.playClick();
        const res = league.autoFillClubRoster26();
        actions.onSave();
        actions.onToast?.(`已一键招募 ${res.added} 名球员，${MAX_CLUB_ROSTER} 人大名单组建完成！`, THEME.GREEN);
      }, { variant: 'gold', fontSize: 11, icon: 'sparkle' });

      this.recruitPool.slice(0, 12).forEach((cand, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cx = 34 + col * 296;
        const cy = 192 + row * 82;
        drawRoundRect(ctx, cx, cy, 284, 72, 8, THEME.BG_CARD, THEME.BORDER);
        drawPlayerAvatar(ctx, cx + 8, cy + 8, 42, 56, cand, club, { radius: 5, showFrame: false });
        drawBadge(ctx, cx + 58, cy + 10, 24, 18, '?', '#334155', THEME.GOLD_LIGHT);
        drawBadge(ctx, cx + 86, cy + 10, 36, 18, cand.role, '#1E293B', THEME.TX2);
        drawText(ctx, cand.name, cx + 128, cy + 19, { size: 13, bold: true });
        drawText(ctx, '评分 ???', cx + 274, cy + 19, { size: 12, bold: true, color: '#94A3B8', align: 'right', mono: true });
        drawText(ctx, `${cand.age}岁 · ${cand.traits?.[0] || '未知潜质'}`, cx + 58, cy + 44, { size: 10, color: THEME.TX2 });

        hits.add(cx, cy, 184, 72, () => {
          SoundEngine.playClick();
          actions.onInspectPlayer(cand, { scoutFog: true, revealCount });
        });
        drawButton(ctx, hits, cx + 150, cy + 38, 36, 24, '详', () => {
          SoundEngine.playClick();
          actions.onInspectPlayer(cand, { scoutFog: true, revealCount });
        }, { variant: 'ghost', fontSize: 10 });

        drawButton(ctx, hits, cx + 192, cy + 38, 82, 24, '加入名单 +', () => {
          const res = league.addCandidateToClubRoster(cand);
          if (res.ok) {
            SoundEngine.playClick();
            this.recruitPool.splice(idx, 1);
            if (this.recruitPool.length < 6) {
              this.recruitPool.push(...generateShuffleSet(8, 62 + meta.scout, 82 + meta.scout));
            }
            actions.onSave();
            actions.onToast?.(`刮出【${cand.tier}级】${cand.name} (${cand.role}) · CA ${cand.ca}！`, tierColor(cand.tier));
          } else {
            actions.onToast?.(res.reason || '加入失败', THEME.RED_LIGHT);
          }
        }, { variant: 'green', fontSize: 10 });
      });

      drawChamferPanel(ctx, 648, 80, 616, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
      drawText(ctx, `已入队球员 (${rawRoster.length}/${MAX_CLUB_ROSTER})`, 666, 106, { size: 15, bold: true, color: THEME.TX1 });
      const sorted = [...rawRoster].sort((a, b) => b.ca - a.ca);
      sorted.slice(0, 26).forEach((p, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const px = 664 + col * 296;
        const py = 136 + row * 41;
        drawRoundRect(ctx, px, py, 286, 35, 6, THEME.BG_CARD, THEME.BORDER);
        drawBadge(ctx, px + 8, py + 8, 34, 18, p.role, tierColor(p.tier));
        drawText(ctx, `${p.name} (${p.age}岁)`, px + 48, py + 17, { size: 12, bold: true });
        drawText(ctx, `CA ${p.ca}`, px + 240, py + 17, { size: 12, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
        drawButton(ctx, hits, px + 248, py + 6, 30, 22, '详', () => actions.onInspectPlayer(p), { fontSize: 10 });
      });
      return;
    }

    // ==================== 完整大名单视图：左栏队内榜单 + 右栏 3×3 球员卡墙 ====================

    // 左栏：队内内部榜单 (x: 16..344)
    drawChamferPanel(ctx, 16, 80, 328, 624, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD);
    drawText(ctx, '队内数据榜单 · LEADERBOARD', 32, 102, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '本赛季全队一线队实绩排行（点击查看详情）', 32, 121, { size: 10, color: THEME.TX2 });

    LB_TABS.forEach((tab, ti) => {
      const col = ti % 3;
      const row = Math.floor(ti / 3);
      drawButton(ctx, hits, 28 + col * 102, 136 + row * 32, 96, 26, tab.label, () => {
        this.lbTab = tab.key;
      }, { active: this.lbTab === tab.key, fontSize: 10 });
    });

    const lbPool = (this.lbTab === 'gk'
      ? displayRoster.filter(p => p.role === 'GK')
      : displayRoster
    )
      .map(p => ({ p, val: this.getLbValue(p, this.lbTab) }))
      .sort((a, b) => {
        if (b.val.score !== a.val.score) return b.val.score - a.val.score;
        return b.p.ca - a.p.ca;
      });

    const hasAnyMatch = displayRoster.some(p => (p.seasonStats.appearances ?? 0) > 0);
    if (!hasAnyMatch) {
      drawRoundRect(ctx, 28, 206, 304, 26, 6, 'rgba(56, 189, 248, 0.12)', 'rgba(56, 189, 248, 0.35)');
      drawText(ctx, '新赛季首轮开赛后将实时累计赛场榜单数据', 180, 219, {
        size: 10,
        color: '#7DD3FC',
        align: 'center',
      });
    }

    const listStartY = hasAnyMatch ? 210 : 240;
    const maxRows = hasAnyMatch ? 10 : 9;
    lbPool.slice(0, maxRows).forEach((entry, idx) => {
      const { p, val } = entry;
      const ry = listStartY + idx * 46;
      const rankCol = idx === 0 ? THEME.GOLD_LIGHT : idx === 1 ? '#CBD5E1' : idx === 2 ? '#D97706' : THEME.TX3;

      drawRoundRect(
        ctx,
        28,
        ry,
        304,
        40,
        6,
        idx === 0 ? 'rgba(212, 168, 67, 0.12)' : THEME.BG_CARD,
        idx === 0 ? THEME.BORDER_GOLD : THEME.BORDER
      );
      drawText(ctx, `${idx + 1}`, 44, ry + 20, { size: 13, bold: true, color: rankCol, align: 'center', mono: true });
      drawBadge(ctx, 58, ry + 11, 32, 18, p.role, tierColor(p.tier));
      drawText(ctx, p.name, 96, ry + 14, { size: 12, bold: true, color: THEME.TX1 });
      drawText(ctx, `${p.age}岁 · ${p.seasonStats.appearances ?? 0}场 · CA ${p.ca}`, 96, ry + 30, {
        size: 10,
        color: THEME.TX2,
      });
      drawText(ctx, val.text, 322, ry + 20, {
        size: 12,
        bold: true,
        color: idx < 3 ? rankCol : '#7DD3FC',
        align: 'right',
        mono: true,
      });
      hits.add(28, ry, 304, 40, () => {
        SoundEngine.playClick();
        actions.onInspectPlayer(p);
      });
    });

    // 右栏：球员卡墙 (x: 356..1264, w: 908)
    drawChamferPanel(ctx, 356, 80, 908, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);

    // 顶部筛选 + 排序 + 锁定/开启赛季栏
    const filters: Array<[PosFilter, string]> = [
      ['ALL', `全部(${displayRoster.length})`],
      ['GK', '门将'],
      ['DEF', '后卫'],
      ['MID', '中场'],
      ['ATT', '前锋'],
    ];
    filters.forEach(([fk, fl], fi) => {
      drawButton(ctx, hits, 372 + fi * 68, 92, 64, 28, fl, () => {
        this.filter = fk;
        this.page = 0;
      }, { active: this.filter === fk, fontSize: 10 });
    });

    const sorts: Array<[SortMode, string]> = [
      ['ca', '按CA'],
      ['age', '按年龄'],
      ['goals', '按进球'],
      ['distance', '按跑动'],
    ];
    sorts.forEach(([sk, sl], si) => {
      drawButton(ctx, hits, 724 + si * 58, 92, 54, 28, sl, () => {
        this.sortMode = sk;
        this.page = 0;
      }, { active: this.sortMode === sk, fontSize: 10 });
    });

    if (isLocked) {
      drawRoundRect(ctx, 964, 92, 284, 28, 6, 'rgba(239, 68, 68, 0.14)', 'rgba(239, 68, 68, 0.55)');
      drawText(ctx, '🔒 赛季进行中 · 大名单已锁定（休赛期解锁）', 1106, 106, {
        size: 11,
        bold: true,
        color: '#FCA5A5',
        align: 'center',
      });
    } else {
      drawButton(ctx, hits, 964, 92, 118, 28, `智能选 ${SEASON_SQUAD_SIZE} 人`, () => {
        SoundEngine.playClick();
        league.autoSelectSeason16FromRoster();
        actions.onSave();
        actions.onToast?.(`已按位置平衡自动选出最佳 ${SEASON_SQUAD_SIZE} 人！`, THEME.GOLD_LIGHT);
      }, { variant: 'primary', fontSize: 10, icon: 'sparkle' });

      const readyToStart = selectedIds.length === SEASON_SQUAD_SIZE;
      drawButton(
        ctx,
        hits,
        1088,
        92,
        160,
        28,
        readyToStart ? `开启新赛季 (${SEASON_SQUAD_SIZE}人) ▶` : `选满${SEASON_SQUAD_SIZE}人 (${selectedIds.length}/${SEASON_SQUAD_SIZE})`,
        () => actions.onStartSeasonFromRoster(),
        { variant: readyToStart ? 'gold' : 'ghost', disabled: !readyToStart, fontSize: 10, icon: 'play' }
      );
    }

    const filtered = [...displayRoster]
      .filter(p => this.matchFilter(p))
      .sort((a, b) => {
        if (this.sortMode === 'age') return a.age - b.age || b.ca - a.ca;
        if (this.sortMode === 'goals') return (b.seasonStats.goals ?? 0) - (a.seasonStats.goals ?? 0) || b.ca - a.ca;
        if (this.sortMode === 'distance') {
          const da = a.seasonStats.appearances ? (a.seasonStats.distanceM ?? 0) / a.seasonStats.appearances : 0;
          const db = b.seasonStats.appearances ? (b.seasonStats.distanceM ?? 0) / b.seasonStats.appearances : 0;
          return db - da || b.ca - a.ca;
        }
        const sa = selectedSet.has(a.id) ? 0 : 1;
        const sb = selectedSet.has(b.id) ? 0 : 1;
        return sa !== sb ? sa - sb : b.ca - a.ca;
      });

    const pageSize = 9; // 3×3 球员卡展示
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (this.page >= totalPages) this.page = totalPages - 1;
    const visible = filtered.slice(this.page * pageSize, (this.page + 1) * pageSize);

    visible.forEach((p, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const px = 370 + col * 294;
      const py = 134 + row * 174;
      const cw = 284;
      const ch = 164;
      const isSel = selectedSet.has(p.id);
      const isSuspended = (p.suspendedRounds ?? 0) > 0;

      const bgCardId = p.tier === 'S' ? 'card_bg_gold' : p.tier === 'A' ? 'card_bg_purple' : p.tier === 'B' ? 'card_bg_blue' : null;
      const bgCardImg = bgCardId ? AssetLoader.get(bgCardId) : null;

      drawChamferPanel(
        ctx,
        px,
        py,
        cw,
        ch,
        9,
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
        ctx.globalAlpha = 0.2;
        ctx.drawImage(bgCardImg, px, py, cw, ch);
        ctx.restore();
      }

      // 卡面左上：分层拼接球员头像 + S/A 框
      drawPlayerAvatar(ctx, px + 10, py + 10, 44, 54, p, club, { radius: 6 });

      // 卡面顶部信息：等级 + 位置 + 年龄 + 状态
      drawBadge(ctx, px + 62, py + 10, 22, 16, p.tier, tierColor(p.tier));
      drawBadge(ctx, px + 88, py + 10, 34, 16, p.role, '#1E293B', THEME.TX1);
      drawBadge(ctx, px + 126, py + 10, 36, 16, `${p.age}岁`, '#1E3A5F', '#7DD3FC');
      if (isSuspended) {
        drawBadge(ctx, px + 166, py + 10, 34, 16, '停赛', '#991B1B', '#FECACA');
      } else if (isSel) {
        drawBadge(ctx, px + 166, py + 10, 34, 16, '本季', '#14532D', THEME.GREEN);
      }

      // 姓名 + 兼任位置
      drawText(ctx, p.name, px + 62, py + 40, { size: 14, bold: true, color: THEME.TX1 });
      const secText = p.secondaryRoles && p.secondaryRoles.length > 0 ? `兼:${p.secondaryRoles.join('/')}` : '专职';
      drawText(ctx, `${secText} · 体${Math.round(p.fitness ?? 100)}%`, px + 62, py + 57, {
        size: 10,
        color: p.secondaryRoles?.length ? '#38BDF8' : THEME.TX3,
      });

      // 右上大号 CA
      drawText(ctx, 'CA', px + 272, py + 16, { size: 9, color: THEME.TX3, align: 'right', mono: true });
      drawText(ctx, `${p.ca}`, px + 272, py + 36, {
        size: 20,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'right',
        mono: true,
      });

      // 中部 6 项核心数值胶囊（直接外显在卡面！）
      const attrPairs: Array<[string, number]> = p.role === 'GK'
        ? [
            ['扑', p.attributes.goalkeeping],
            ['位', p.attributes.positioning],
            ['冷', p.attributes.composure],
            ['传', p.attributes.passing],
            ['壮', p.attributes.strength],
            ['体', p.attributes.stamina],
          ]
        : [
            ['速', p.attributes.pace],
            ['射', p.attributes.shooting],
            ['传', p.attributes.passing],
            ['盘', p.attributes.dribbling],
            ['防', p.attributes.defending],
            ['体', p.attributes.stamina],
          ];

      attrPairs.forEach(([lbl, val], ai) => {
        const acol = ai % 3;
        const arow = Math.floor(ai / 3);
        const ax = px + 10 + acol * 90;
        const ay = py + 72 + arow * 24;
        drawRoundRect(ctx, ax, ay, 84, 20, 4, 'rgba(11, 17, 30, 0.85)', 'rgba(148, 163, 184, 0.20)');
        drawText(ctx, lbl, ax + 10, ay + 10, { size: 10, color: THEME.TX2 });
        drawText(ctx, `${val}`, ax + 74, ay + 10, {
          size: 11,
          bold: true,
          color: this.statColor(val),
          align: 'right',
          mono: true,
        });
      });

      // 底部：特质 + 本赛季核心数据条
      const traitText = p.traits && p.traits.length > 0 ? p.traits.slice(0, 2).join(' · ') : '均衡型球员';
      drawText(ctx, traitText, px + 12, py + 129, { size: 10, color: '#A5B4FC' });

      const apps = p.seasonStats.appearances ?? 0;
      const avgKm = apps > 0 ? ((p.seasonStats.distanceM ?? 0) / 1000 / apps).toFixed(1) : '0.0';
      const avgPass = apps > 0 ? ((p.seasonStats.passes ?? 0) / apps).toFixed(0) : '0';
      const statLine = p.role === 'GK'
        ? `${apps}场 · ${p.seasonStats.saves ?? 0}扑 ${p.seasonStats.cleanSheets ?? 0}零封 · ${avgPass}传/场`
        : `${apps}场 · ${p.seasonStats.goals ?? 0}球 ${p.seasonStats.assists ?? 0}助 · ${avgKm}km · ${avgPass}传`;

      const statMaxW = isLocked ? 260 : 194;
      drawText(ctx, statLine, px + 12, py + 148, { size: 10, color: THEME.TX2, mono: true });

      if (!isLocked) {
        drawButton(ctx, hits, px + 210, py + 128, 64, 28, isSel ? '已报名✓' : '选入+', () => {
          const res = league.toggleRosterSelection(p.id);
          if (res.ok) {
            SoundEngine.playClick();
            actions.onSave();
          } else {
            actions.onToast?.(res.reason || '操作失败', THEME.RED_LIGHT);
          }
        }, { variant: isSel ? 'green' : 'ghost', fontSize: 10 });
        hits.add(px, py, statMaxW, ch, () => {
          SoundEngine.playClick();
          actions.onInspectPlayer(p);
        });
      } else {
        hits.add(px, py, cw, ch, () => {
          SoundEngine.playClick();
          actions.onInspectPlayer(p);
        });
      }
    });

    if (totalPages > 1) {
      drawButton(ctx, hits, 650, 662, 104, 30, '上一页', () => {
        this.page = Math.max(0, this.page - 1);
      }, { disabled: this.page === 0, fontSize: 11 });
      drawText(ctx, `第 ${this.page + 1} / ${totalPages} 页 (共 ${filtered.length} 人)`, 810, 677, {
        size: 11,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, 866, 662, 104, 30, '下一页', () => {
        this.page = Math.min(totalPages - 1, this.page + 1);
      }, { disabled: this.page >= totalPages - 1, fontSize: 11 });
    }
  }
}
