/**
 * 页面 2：发行级 Portal 赛季门户（转播顶栏 + 左侧3段式整备/备战/词条 + 右侧积分榜/赛季数据统计双Tab + 对手侦察指证）
 * 零 Emoji，统一游戏壳架构
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import { WEATHER_INFO } from '../../../core/src/Chronicles';
import { computePerkSynergies } from '../../../core/src/PlayerPool';
import { OpponentMatchupIntel, PrepTrainingKind } from '../../../core/src/types';
import { TACTICAL_PRESETS } from '../../../engine/src/types';
import { AssetLoader } from '../AssetLoader';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawNavRail,
  drawRoundRect,
  drawText,
  drawWrappedText,
  HitRegistry,
  NavRailTab,
} from '../CanvasKit';
import { drawClubCrest } from '../ClubVisuals';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

export class PortalScreen {
  private standingsScroll = 0;
  private rightTab: 'standings' | 'stats' = 'standings';
  private prepToast = '';
  private scoutModalOpen = false;
  private scoutNotice = '';

  public handleEscape(): boolean {
    if (this.scoutModalOpen) {
      this.scoutModalOpen = false;
      return true;
    }
    return false;
  }

  public onWheel(deltaY: number): boolean {
    if (this.scoutModalOpen || this.rightTab !== 'standings') return false;
    const maxScroll = 10; // 18队显示8行 -> 最多滚动10行
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
      onQuickSim?: () => void;
      onSave?: () => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const standings = league.getStandings();
    const nextFx = league.getUserCurrentFixture();
    const tierInfo = league.getCurrentTierInfo();
    const diffStars = '★'.repeat(8 - tierInfo.tier) + '☆'.repeat(tierInfo.tier - 1);

    const stageLabel = `${tierInfo.shortLabel} · 第 ${st.currentRound}/34 轮`;

    drawBroadcastHeader(ctx, hits, {
      kicker: `SEASON ${st.seasonNumber} · ${tierInfo.name} (${diffStars})`,
      title: club.name,
      club,
      badge: stageLabel,
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
      rightAction: nextFx
        ? { label: '进入比赛日', icon: 'play', variant: 'gold', onClick: actions.onStartMatch }
        : undefined,
    });

    drawNavRail(ctx, hits, 'portal', actions.onNavigate);

    // 左栏一：转播级焦点战海报卡
    drawChamferPanel(ctx, 96, 80, 504, 214, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER_GOLD, 1.4, THEME.GOLD_LIGHT);
    drawText(ctx, `NEXT FIXTURE · 第 ${st.currentRound}/34 轮`, 116, 98, { size: 11, bold: true, color: THEME.GOLD, mono: true });
    drawText(ctx, `${tierInfo.name}`, 582, 98, { size: 11, color: '#38BDF8', align: 'right' });

    if (nextFx) {
      const home = st.clubs.find(c => c.id === nextFx.homeClubId)!;
      const away = st.clubs.find(c => c.id === nextFx.awayClubId)!;
      const homeRankIdx = standings.findIndex(r => r.clubId === home.id);
      const awayRankIdx = standings.findIndex(r => r.clubId === away.id);
      const homeRow = standings[homeRankIdx];
      const awayRow = standings[awayRankIdx];

      drawChamferPanel(ctx, 114, 112, 468, 80, 8, THEME.BG_CARD, THEME.BORDER);
      drawClubCrest(ctx, 214, 136, 15, home);
      drawText(ctx, home.name, 214, 163, {
        size: 13.5,
        bold: true,
        align: 'center',
        color: home.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      drawText(ctx, `第${homeRankIdx + 1}名 · ${homeRow?.points ?? 0}分 · ${home.formation}`, 214, 180, {
        size: 10,
        align: 'center',
        color: THEME.TX2,
      });

      drawText(ctx, 'VS', 348, 152, { size: 20, bold: true, italic: true, align: 'center', color: THEME.GOLD_LIGHT });

      drawClubCrest(ctx, 482, 136, 15, away);
      drawText(ctx, away.name, 482, 163, {
        size: 13.5,
        bold: true,
        align: 'center',
        color: away.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      drawText(ctx, `第${awayRankIdx + 1}名 · ${awayRow?.points ?? 0}分 · ${away.formation}`, 482, 180, {
        size: 10,
        align: 'center',
        color: THEME.TX2,
      });

      // 赛前球探情报简报条 + 对手了解度/抓破绽入口
      const oppClub = home.isUser ? away : home;
      const brief = league.getOpponentBriefing(oppClub.id);
      const prepForCard = league.getInterMatchPrep();
      const intel = prepForCard?.matchupIntel;
      drawRoundRect(ctx, 114, 198, 468, 42, 6, 'rgba(15, 23, 42, 0.92)', 'rgba(56, 189, 248, 0.35)');
      const famText = intel ? `了解 ${intel.familiarity}%` : '球探情报';
      const famColor = intel && intel.familiarity >= 70 ? THEME.GREEN : '#38BDF8';
      drawBadge(ctx, 120, 204, 68, 15, famText, '#1E3A5F', famColor);
      drawText(ctx, `${brief.styleName} · ${brief.weakLineLabel}`, 194, 211, {
        size: 10,
        bold: true,
        color: THEME.TX1,
      });
      const subTip = intel?.chosenCounterId
        ? (intel.spotCorrect ? '异议成立：已锁定针对性赛前战术红利' : '已完成指证（误判干扰线索，正常应战）')
        : brief.counterTip;
      drawText(ctx, subTip, 120, 228, {
        size: 10,
        color: intel?.spotCorrect ? THEME.GREEN : THEME.GOLD_LIGHT,
      });
      if (intel) {
        drawButton(ctx, hits, 476, 204, 100, 30, intel.chosenCounterId ? '情报详情' : '侦察抓破绽', () => {
          this.scoutNotice = '';
          this.scoutModalOpen = true;
        }, { variant: intel.chosenCounterId ? 'ghost' : 'primary', fontSize: 10 });
      }

      drawButton(ctx, hits, 114, 248, 132, 36, '首发与阵型', () => actions.onNavigate('tactics'), {
        variant: 'ghost',
        fontSize: 12,
        icon: 'tactics',
      });
      drawButton(ctx, hits, 254, 248, 84, 36, '跳过本轮', () => {
        actions.onQuickSim?.();
      }, {
        variant: 'ghost',
        fontSize: 11,
      });
      drawButton(ctx, hits, 346, 248, 236, 36, '▶ 亲自指挥本场对决', actions.onStartMatch, {
        variant: 'gold',
        fontSize: 13,
      });
    }

    // 左栏二：当前出战配置总览（主动技 + 指挥手牌 + 4套战术预案，紧邻赛前对决主卡片）
    drawChamferPanel(ctx, 96, 304, 504, 190, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD, 1.2);
    drawText(ctx, '当前出战配置总览', 112, 322, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `激活：${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, 584, 322, {
      size: 10.5,
      bold: true,
      color: '#38BDF8',
      align: 'right',
    });

    // 卡片1：主动技 (4槽)
    const eqSkills = league.getEquippedActiveSkills();
    drawRoundRect(ctx, 110, 338, 154, 144, 8, THEME.BG_CARD, 'rgba(56, 189, 248, 0.45)');
    drawText(ctx, `⚡主动技(${eqSkills.length}/4)`, 117, 353, { size: 10.5, bold: true, color: '#38BDF8' });
    drawButton(ctx, hits, 208, 343, 50, 20, '改技能', () => actions.onNavigate('meta'), { variant: 'primary', fontSize: 9.5 });
    for (let si = 0; si < 4; si++) {
      const sk = eqSkills[si];
      const sy = 370 + si * 26;
      drawRoundRect(ctx, 116, sy, 142, 21, 4, 'rgba(11, 17, 30, 0.85)', sk ? 'rgba(56,189,248,0.35)' : '#1E293B');
      drawText(ctx, sk ? `${si + 1}.${sk.name.slice(0, 7)}` : `${si + 1}.空槽位`, 122, sy + 10.5, {
        size: 9.8,
        color: sk ? THEME.TX1 : THEME.TX3,
      });
    }

    // 卡片2：出战指挥卡 (4张)
    const loadoutCards = league.getMatchLoadout();
    drawRoundRect(ctx, 271, 338, 154, 144, 8, THEME.BG_CARD, 'rgba(192, 132, 252, 0.45)');
    drawText(ctx, `指挥牌(${loadoutCards.length}/4)`, 278, 353, { size: 10.5, bold: true, color: '#C084FC' });
    drawButton(ctx, hits, 369, 343, 50, 20, '改卡牌', () => actions.onNavigate('cards'), { variant: 'primary', fontSize: 9.5 });
    for (let ci = 0; ci < 4; ci++) {
      const card = loadoutCards[ci];
      const cy = 370 + ci * 26;
      drawRoundRect(ctx, 277, cy, 142, 21, 4, 'rgba(11, 17, 30, 0.85)', card ? 'rgba(192,132,252,0.35)' : '#1E293B');
      drawText(
        ctx,
        card ? `E${card.cost} ${card.name.slice(0, 5)} L${card.level ?? 1}` : `${ci + 1}.未配置`,
        283,
        cy + 10.5,
        { size: 9.8, color: card ? THEME.TX1 : THEME.TX3 }
      );
    }

    // 卡片3：4套赛前战术预案（点击行直接切换，点右上角直达战术板）
    const presets = league.getTacticalPresets();
    drawRoundRect(ctx, 432, 338, 154, 144, 8, THEME.BG_CARD, THEME.BORDER_GOLD);
    drawText(ctx, '4套战术', 439, 353, { size: 10.5, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, 530, 343, 50, 20, '改战术', () => actions.onNavigate('tactics'), { variant: 'gold', fontSize: 9.5 });
    for (let pi = 0; pi < 4; pi++) {
      const pr = presets[pi];
      const py = 370 + pi * 26;
      const isCur = pr && club.formation === pr.formation && club.style === pr.style;
      drawRoundRect(
        ctx,
        438,
        py,
        142,
        21,
        4,
        isCur ? 'rgba(34, 197, 94, 0.16)' : 'rgba(11, 17, 30, 0.85)',
        isCur ? THEME.GREEN : '#1E293B'
      );
      if (pr) {
        const stShort = TACTICAL_PRESETS[pr.style].name.slice(0, 2);
        drawText(ctx, `${pi + 1}.${pr.formation}·${stShort}`, 444, py + 10.5, {
          size: 9.8,
          bold: isCur,
          color: isCur ? THEME.GREEN : THEME.TX1,
        });
        if (isCur) {
          drawText(ctx, '当前', 574, py + 10.5, { size: 8.8, bold: true, color: THEME.GREEN, align: 'right' });
        }
        hits.add(438, py, 142, 21, () => {
          const res = league.applyTacticalPreset(pi);
          if (res.ok && res.preset) {
            SoundEngine.playClick();
            this.prepToast = `已切换至预案${pi + 1}：${res.preset.formation} · ${TACTICAL_PRESETS[res.preset.style].name}`;
            actions.onSave?.();
          }
        });
      }
    }

    // 左栏三：天气预报 + 1次赛前轻训练 + 1对1球员沟通
    const prep = league.getInterMatchPrep();
    drawChamferPanel(ctx, 96, 504, 504, 200, 10, 'rgba(14, 22, 40, 0.92)', 'rgba(56, 189, 248, 0.45)');
    if (prep) {
      const wInfo = WEATHER_INFO[prep.weather];
      drawBadge(ctx, 112, 516, 74, 18, wInfo.label, '#0F172A', wInfo.color);
      drawText(ctx, wInfo.tip, 192, 525, { size: 10.5, color: THEME.TX2 });
      drawText(ctx, `整备 ${prep.actionsLeft}/1`, 584, 525, {
        size: 10.5,
        bold: true,
        align: 'right',
        color: prep.actionsLeft > 0 ? THEME.GREEN : THEME.TX3,
        mono: true,
      });

      const trainBtns: Array<{ kind: PrepTrainingKind; label: string }> = [
        { kind: 'physio', label: '理疗恢复+14%' },
        { kind: 'tactical', label: '传防演练+2' },
        { kind: 'mentor', label: '青年指导+1' },
        { kind: 'sharp', label: '射门加练+2' },
      ];
      trainBtns.forEach((tb, bi) => {
        const bx = 112 + bi * 119;
        const done = prep.doneTraining === tb.kind;
        drawButton(ctx, hits, bx, 544, 113, 30, tb.label, () => {
          const res = league.applyPrepTraining(tb.kind);
          if (res.msg) this.prepToast = res.msg;
          if (res.ok) SoundEngine.playCraftSuccess();
          else SoundEngine.playWarning();
          actions.onSave?.();
        }, {
          variant: done ? 'green' : 'ghost',
          disabled: prep.actionsLeft <= 0 && !done,
          fontSize: 10,
        });
      });

      const talk = prep.playerTalk;
      if (talk) {
        drawRoundRect(ctx, 112, 584, 472, 104, 8, THEME.BG_CARD, talk.resolved ? THEME.GREEN : THEME.BORDER_GOLD);
        drawBadge(ctx, 122, 594, 40, 16, talk.role, '#1E3A5F', THEME.TX1);
        drawText(ctx, `${talk.playerName} 赛前沟通`, 168, 602, { size: 11.5, bold: true, color: THEME.GOLD_LIGHT });
        if (talk.resolved) {
          drawText(ctx, `已回应：${talk.chosenLabel}`, 122, 632, { size: 11.5, color: THEME.GREEN });
          drawText(ctx, this.prepToast || '球员士气已稳住，专注迎接本轮较量', 122, 658, { size: 10.5, color: THEME.TX2 });
        } else {
          drawText(ctx, talk.prompt.slice(0, 36), 122, 626, { size: 10.5, color: THEME.TX1 });
          drawButton(ctx, hits, 122, 650, 224, 26, talk.optA.label, () => {
            const res = league.resolvePlayerTalk('A');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'gold', fontSize: 10 });
          drawButton(ctx, hits, 354, 650, 224, 26, talk.optB.label, () => {
            const res = league.resolvePlayerTalk('B');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'primary', fontSize: 10 });
        }
      } else {
        drawRoundRect(ctx, 112, 584, 472, 104, 8, THEME.BG_CARD, THEME.BORDER);
        drawText(ctx, '更衣室氛围平稳 · 全队专注备战下轮对手', 126, 616, { size: 12, bold: true, color: THEME.TX1 });
        const subMsg = this.prepToast || prep.nextMatchBuff?.note || st.lastMatchReview || '可从上方选择 1 项赛前轻训练调整状态';
        drawText(ctx, subMsg.slice(0, 42), 126, 648, {
          size: 11,
          color: this.prepToast || prep.nextMatchBuff?.note ? THEME.GREEN : st.lastMatchReview ? '#7DD3FC' : THEME.TX2,
        });
      }
    }

    // 右栏上半：俱乐部赛季脉络与词条（紧凑双列布局，高度 180px）
    drawChamferPanel(ctx, 614, 80, 650, 180, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    const story = st.storyline;
    drawIcon(ctx, 'sparkle', 636, 100, 13, THEME.GOLD_LIGHT);
    drawText(ctx, `俱乐部赛季脉络与词条 (${club.perks.length})`, 652, 100, { size: 12.5, bold: true, color: THEME.TX1 });
    if (story) {
      drawBadge(ctx, 846, 90, 82, 20, story.title, '#312E81', '#A5B4FC');
    }
    const syn = computePerkSynergies(club.perks);
    const synLine = syn.synergies[0] ? `词条共振：${syn.synergies[0]}` : '同系词条叠加 2 张可激活共振';
    drawText(ctx, synLine, 1248, 100, { size: 10, color: syn.synergies[0] ? THEME.GREEN : THEME.TX3, align: 'right' });

    // 左侧子卡：Rogue 战术词条
    if (club.perks.length === 0) {
      drawRoundRect(ctx, 628, 118, 344, 128, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, '暂未激活 Rogue 战术词条', 642, 146, { size: 12, bold: true, color: THEME.TX2 });
      drawWrappedText(ctx, '完成第 8 / 17 / 26 轮比赛后将触发 Re-Draft 词条三选一强化', 642, 174, 316, 18, {
        size: 11,
        color: THEME.TX3,
        maxLines: 2,
      });
    } else {
      club.perks.slice(0, 3).forEach((pk, i) => {
        const px = 628 + i * 116;
        drawChamferPanel(ctx, px, 118, 110, 128, 7, THEME.BG_CARD, THEME.BORDER_GOLD, 1, THEME.GOLD);
        drawText(ctx, pk.name, px + 8, 138, { size: 11, bold: true, color: THEME.GOLD_LIGHT });
        drawWrappedText(ctx, pk.description, px + 8, 158, 94, 16, { size: 9.5, color: THEME.TX2, maxLines: 4 });
      });
    }

    // 右侧子卡：上轮战况与队内状态
    const strainList = club.squad.filter(p => p.strainWarning || (p.injuredRounds ?? 0) > 0 || (p.suspendedRounds ?? 0) > 0);
    drawRoundRect(ctx, 982, 118, 268, 128, 8, 'rgba(15, 23, 42, 0.85)', THEME.BORDER);
    drawText(ctx, '上轮战况与队内状态', 996, 138, { size: 11, bold: true, color: '#38BDF8' });
    drawWrappedText(
      ctx,
      st.lastMatchReview || '首轮开赛后将在此生成上轮战术复盘与 xG 诊断',
      996,
      156,
      240,
      16,
      { size: 10, color: THEME.TX1, maxLines: 3 }
    );
    drawWrappedText(
      ctx,
      strainList.length > 0
        ? `队医提醒：${strainList.slice(0, 2).map(p => `${p.name}(${(p.injuredRounds ?? 0) > 0 ? '伤停' : (p.suspendedRounds ?? 0) > 0 ? '停赛' : '疲惫'})`).join('、')} · 建议轮换`
        : '全队健康度良好，无伤停或体能疲惫预警',
      996,
      210,
      240,
      15,
      { size: 9.8, color: strainList.length > 0 ? '#FBBF24' : THEME.GREEN, maxLines: 2 }
    );

    // 右栏下半：18 队联赛积分榜 / 赛季数据统计（双 Tab 切换，高度 434px）
    drawChamferPanel(ctx, 614, 270, 650, 434, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    drawButton(ctx, hits, 630, 280, 112, 26, '联赛积分榜', () => {
      this.rightTab = 'standings';
    }, { active: this.rightTab === 'standings', fontSize: 11, icon: 'trophy' });
    drawButton(ctx, hits, 748, 280, 124, 26, '赛季数据统计', () => {
      this.rightTab = 'stats';
    }, { active: this.rightTab === 'stats', fontSize: 11, icon: 'chart' });

    drawButton(ctx, hits, 998, 280, 68, 24, '? 引导', () => {
      league.resetTutorial();
      this.prepToast = '已重置新手引导，当前场景将重新弹出轻引导提示';
      actions.onSave?.();
    }, { variant: 'ghost', fontSize: 10 });

    if (this.rightTab === 'stats') {
      this.renderSeasonStatsPanel(ctx, hits, league);
    } else {
      const userRankIdx = standings.findIndex(r => r.isUser);
      drawButton(ctx, hits, 1074, 280, 68, 24, '定位我队', () => {
        this.standingsScroll = Math.max(0, Math.min(10, userRankIdx - 3));
      }, { variant: 'ghost', fontSize: 10 });
      drawButton(ctx, hits, 1148, 280, 44, 24, '▲', () => {
        this.standingsScroll = Math.max(0, this.standingsScroll - 3);
      }, { variant: 'ghost', fontSize: 10 });
      drawButton(ctx, hits, 1198, 280, 44, 24, '▼', () => {
        this.standingsScroll = Math.min(Math.max(0, standings.length - 8), this.standingsScroll + 3);
      }, { variant: 'ghost', fontSize: 10 });

      const zoneHint =
        tierInfo.tier === 1 ? '第1级·争冠|后3降' :
        tierInfo.tier === 7 ? '第7级·前3升|无降' :
        `前${tierInfo.promoteCount}升级·后${tierInfo.relegateCount}降级`;
      drawText(ctx, zoneHint, 935, 293, { size: 9.8, color: THEME.TX2, align: 'center' });

      const hy = 322;
      drawRoundRect(ctx, 628, hy - 12, 622, 24, 4, '#111A2E');
      drawText(ctx, '排名', 648, hy, { size: 10.5, color: THEME.TX3, align: 'center' });
      drawText(ctx, '球队', 686, hy, { size: 10.5, color: THEME.TX3 });
      drawText(ctx, '赛', 854, hy, { size: 10.5, color: THEME.TX3, align: 'center' });
      drawText(ctx, '胜', 896, hy, { size: 10.5, color: THEME.TX3, align: 'center' });
      drawText(ctx, '平', 938, hy, { size: 10.5, color: THEME.TX3, align: 'center' });
      drawText(ctx, '负', 980, hy, { size: 10.5, color: THEME.TX3, align: 'center' });
      drawText(ctx, '进/失', 1034, hy, { size: 10.5, color: THEME.TX3, align: 'center' });
      drawText(ctx, '净胜', 1088, hy, { size: 10.5, color: THEME.TX3, align: 'center' });
      drawText(ctx, '积分', 1138, hy, { size: 10.5, color: THEME.TX3, align: 'center' });
      drawText(ctx, '近期', 1206, hy, { size: 10.5, color: THEME.TX3, align: 'center' });

      const visibleRows = 8;
      const maxStart = Math.max(0, standings.length - visibleRows);
      const startIdx = Math.max(0, Math.min(maxStart, this.standingsScroll));
      const slice = standings.slice(startIdx, startIdx + visibleRows);

      slice.forEach((row, visIdx) => {
        const idx = startIdx + visIdx;
        const ry = 356 + visIdx * 40;
        const isPromote = tierInfo.promoteCount > 0 && idx < tierInfo.promoteCount;
        const isChampionSpot = tierInfo.tier === 1 && idx === 0;
        const isRelegate = tierInfo.relegateCount > 0 && idx >= standings.length - tierInfo.relegateCount;
        const barCol = isChampionSpot ? THEME.GOLD_LIGHT : isPromote ? THEME.GREEN : isRelegate ? THEME.RED_LIGHT : '#334155';

        drawRoundRect(
          ctx,
          628,
          ry - 16,
          622,
          35,
          6,
          row.isUser ? 'rgba(212,168,67,0.18)' : THEME.BG_CARD,
          row.isUser ? THEME.GOLD : THEME.BORDER,
          row.isUser ? 1.5 : 1
        );
        drawRoundRect(ctx, 628, ry - 16, 4, 35, 2, barCol);
        drawText(ctx, String(idx + 1), 648, ry + 1, {
          size: 12,
          bold: true,
          color: isChampionSpot ? THEME.GOLD_LIGHT : isPromote ? THEME.GREEN : isRelegate ? THEME.RED_LIGHT : THEME.TX2,
          align: 'center',
          mono: true,
        });
        const rowClub = st.clubs.find(c => c.id === row.clubId);
        if (rowClub) drawClubCrest(ctx, 676, ry + 1, 8, rowClub);
        drawText(ctx, row.isUser ? `${row.clubName} (我)` : row.clubName, 692, ry + 1, {
          size: 11.5,
          bold: row.isUser,
          color: row.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
        });

        drawText(ctx, String(row.played), 854, ry + 1, { size: 11.5, align: 'center', mono: true });
        drawText(ctx, String(row.won), 896, ry + 1, { size: 11.5, align: 'center', mono: true });
        drawText(ctx, String(row.drawn), 938, ry + 1, { size: 11.5, align: 'center', mono: true });
        drawText(ctx, String(row.lost), 980, ry + 1, { size: 11.5, align: 'center', mono: true });
        drawText(ctx, `${row.gf}/${row.ga}`, 1034, ry + 1, { size: 10.5, align: 'center', mono: true, color: THEME.TX2 });
        drawText(ctx, row.gd >= 0 ? `+${row.gd}` : `${row.gd}`, 1088, ry + 1, {
          size: 11.5,
          align: 'center',
          mono: true,
          color: row.gd > 0 ? THEME.GREEN : row.gd < 0 ? THEME.RED_LIGHT : THEME.TX2,
        });
        drawText(ctx, String(row.points), 1138, ry + 1, {
          size: 13,
          bold: true,
          align: 'center',
          mono: true,
          color: THEME.GOLD_LIGHT,
        });

        row.form.slice(-4).forEach((f, fi) => {
          const fx = 1176 + fi * 16;
          const col = f === 'W' ? THEME.GREEN : f === 'D' ? THEME.GOLD : THEME.RED_LIGHT;
          drawBadge(ctx, fx, ry - 7, 13, 14, f, col, '#080C14');
        });
      });

      drawText(ctx, `显示第 ${startIdx + 1}-${startIdx + slice.length} / ${standings.length} 名 (支持滚轮翻页)`, 939, 688, {
        size: 10,
        color: THEME.TX3,
        align: 'center',
      });
    }

    if (this.scoutModalOpen && prep?.matchupIntel) {
      this.renderScoutModal(ctx, hits, league, prep.matchupIntel, prep.actionsLeft, actions);
    }
  }

  private renderSeasonStatsPanel(
    ctx: CanvasRenderingContext2D,
    _hits: HitRegistry,
    league: LeagueManager
  ): void {
    const ts = league.getUserTeamSeasonStats();
    const scorers = league.getTopScorers(4);
    const assisters = league.getTopAssisters(4);
    const winRate = ts.played > 0 ? Math.round((ts.won / ts.played) * 100) : 0;

    // 1. 我队本季核心 KPI（4 张指标卡）
    drawText(ctx, '本赛季球队综合战绩与预期表现', 630, 318, { size: 11.5, bold: true, color: THEME.GOLD_LIGHT });
    const kpis: Array<{ label: string; val: string; sub: string; col: string }> = [
      { label: '战绩与胜率', val: `${ts.won}胜 ${ts.drawn}平 ${ts.lost}负`, sub: `胜率 ${winRate}% · ${ts.played}轮`, col: THEME.GOLD_LIGHT },
      { label: '攻防净胜球', val: `${ts.gf} 进 / ${ts.ga} 失`, sub: `净胜 ${ts.gf - ts.ga >= 0 ? '+' : ''}${ts.gf - ts.ga}`, col: ts.gf >= ts.ga ? THEME.GREEN : THEME.RED_LIGHT },
      { label: '预期进球 xG', val: `${ts.xgFor.toFixed(1)} : ${ts.xgAgainst.toFixed(1)}`, sub: `场均 ${(ts.xgFor / Math.max(1, ts.played)).toFixed(2)} xG`, col: '#38BDF8' },
      { label: '零封与纪律', val: `${ts.cleanSheets} 次零封`, sub: `黄${ts.yellows} · 红${ts.reds}`, col: '#C084FC' },
    ];
    kpis.forEach((k, i) => {
      const kx = 630 + i * 156;
      drawRoundRect(ctx, kx, 330, 148, 62, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, k.label, kx + 10, 344, { size: 9.5, color: THEME.TX2 });
      drawText(ctx, k.val, kx + 10, 363, { size: 12.5, bold: true, color: k.col, mono: true });
      drawText(ctx, k.sub, kx + 10, 381, { size: 9, color: THEME.TX3 });
    });

    // 2. 联赛射手榜 TOP 4 vs 联赛助攻榜 TOP 4
    drawRoundRect(ctx, 630, 402, 304, 168, 10, THEME.BG_CARD, THEME.BORDER);
    drawIcon(ctx, 'ball', 648, 419, 12, THEME.GOLD_LIGHT);
    drawText(ctx, '联赛射手榜 TOP 4', 664, 419, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    if (scorers.length === 0) {
      drawText(ctx, '首轮开赛后实时统计', 782, 490, { size: 11, color: THEME.TX3, align: 'center' });
    } else {
      scorers.forEach((sc, i) => {
        const sy = 446 + i * 31;
        drawRoundRect(ctx, 642, sy - 11, 280, 24, 5, 'rgba(15, 23, 42, 0.85)');
        drawText(ctx, `${i + 1}. ${sc.playerName}`, 652, sy + 1, { size: 11, bold: i === 0, color: i === 0 ? THEME.GOLD_LIGHT : THEME.TX1 });
        drawText(ctx, sc.clubName.slice(0, 6), 772, sy + 1, { size: 9.5, color: THEME.TX2 });
        drawText(ctx, `${sc.goals} 球`, 912, sy + 1, { size: 11.5, bold: true, color: THEME.GREEN, align: 'right', mono: true });
      });
    }

    drawRoundRect(ctx, 946, 402, 304, 168, 10, THEME.BG_CARD, THEME.BORDER);
    drawIcon(ctx, 'sparkle', 964, 419, 12, '#38BDF8');
    drawText(ctx, '联赛助攻榜 TOP 4', 980, 419, { size: 12, bold: true, color: '#38BDF8' });
    if (assisters.length === 0) {
      drawText(ctx, '首轮开赛后实时统计', 1098, 490, { size: 11, color: THEME.TX3, align: 'center' });
    } else {
      assisters.forEach((as, i) => {
        const sy = 446 + i * 31;
        drawRoundRect(ctx, 958, sy - 11, 280, 24, 5, 'rgba(15, 23, 42, 0.85)');
        drawText(ctx, `${i + 1}. ${as.playerName}`, 968, sy + 1, { size: 11, bold: i === 0, color: i === 0 ? '#7DD3FC' : THEME.TX1 });
        drawText(ctx, as.clubName.slice(0, 6), 1088, sy + 1, { size: 9.5, color: THEME.TX2 });
        drawText(ctx, `${as.assists} 助`, 1228, sy + 1, { size: 11.5, bold: true, color: '#38BDF8', align: 'right', mono: true });
      });
    }

    // 3. 我队内部核心榜（队内射手王、助攻王、门神、出勤铁人）
    drawRoundRect(ctx, 630, 578, 620, 116, 10, THEME.BG_CARD, THEME.BORDER_GOLD);
    drawText(ctx, '我队队内核心数据王', 648, 595, { size: 11.5, bold: true, color: THEME.GOLD_LIGHT });
    const leaders: Array<{ tag: string; p: typeof ts.topScorer; stat: string; col: string }> = [
      { tag: '队内射手王', p: ts.topScorer, stat: ts.topScorer ? `${ts.topScorer.seasonStats.goals}球 · ${ts.topScorer.seasonStats.assists}助` : '-', col: THEME.GOLD_LIGHT },
      { tag: '队内助攻王', p: ts.topAssister, stat: ts.topAssister ? `${ts.topAssister.seasonStats.assists}助 · ${ts.topAssister.seasonStats.passesSuccess ?? 0}传` : '-', col: '#38BDF8' },
      { tag: '门线守护神', p: ts.topKeeper, stat: ts.topKeeper ? `${ts.topKeeper.seasonStats.cleanSheets}零封 · ${ts.topKeeper.seasonStats.saves ?? 0}扑` : '-', col: THEME.GREEN },
      { tag: '全勤铁人', p: ts.ironMan, stat: ts.ironMan ? `出场${ts.ironMan.seasonStats.appearances} · ${Math.round((ts.ironMan.seasonStats.distanceM ?? 0) / 1000)}km` : '-', col: '#C084FC' },
    ];
    leaders.forEach((ld, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = 644 + col * 298;
      const ly = 610 + row * 40;
      drawRoundRect(ctx, lx, ly, 290, 34, 6, 'rgba(11, 17, 30, 0.9)', THEME.BORDER);
      drawBadge(ctx, lx + 8, ly + 8, 66, 18, ld.tag, '#1E293B', ld.col);
      drawText(ctx, ld.p ? `${ld.p.name.slice(0, 4)} CA${ld.p.ca}` : '-', lx + 80, ly + 17, {
        size: 10.5,
        bold: true,
        color: THEME.TX1,
      });
      drawText(ctx, ld.stat, lx + 282, ly + 17, { size: 9.5, color: ld.col, align: 'right', mono: true });
    });
  }

  private renderScoutModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    intel: OpponentMatchupIntel,
    actionsLeft: number,
    actions: { onSave?: () => void }
  ): void {
    ctx.fillStyle = 'rgba(4, 7, 14, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 110;
    const my = 56;
    const mw = 1060;
    const mh = 608;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(14, 22, 40, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    drawText(ctx, `对手战术侦察与破绽指证 · ${intel.oppClubName}`, mx + 28, my + 32, {
      size: 19,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawButton(ctx, hits, mx + mw - 104, my + 18, 80, 32, '关闭', () => {
      this.scoutModalOpen = false;
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    // 了解度进度条 + 深度侦察按钮
    drawChamferPanel(ctx, mx + 28, my + 62, mw - 56, 86, 10, THEME.BG_CARD, THEME.BORDER);
    const fam = intel.familiarity;
    const famCol = fam >= 70 ? THEME.GREEN : fam >= 40 ? '#38BDF8' : '#FBBF24';
    drawText(ctx, `情报了解度：${fam}%`, mx + 46, my + 84, { size: 13, bold: true, color: famCol, mono: true });
    drawRoundRect(ctx, mx + 188, my + 78, 280, 12, 6, '#1E293B');
    drawRoundRect(ctx, mx + 188, my + 78, Math.max(8, Math.round((fam / 100) * 280)), 12, 6, famCol);
    drawText(
      ctx,
      fam >= 70 ? '线索已交叉核实（已排除干扰情报）' : '了解度 < 70%：3 条线索中混有 1 条虚假烟雾弹，请对照赛果数据甄别',
      mx + 482,
      my + 84,
      { size: 11, color: fam >= 70 ? THEME.GREEN : '#FBBF24' }
    );
    drawText(ctx, `${intel.recentFormText}   |   ${intel.h2hText}`, mx + 46, my + 120, {
      size: 12,
      color: THEME.TX2,
    });
    drawButton(
      ctx,
      hits,
      mx + mw - 270,
      my + 104,
      224,
      32,
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
        fontSize: 11,
      }
    );

    // 左列：3 条侦察线索（无剧透标签，需结合赛果与阵型判断真伪）
    drawText(ctx, '一、球探与录像线索（对照上方战绩抽丝剥茧）', mx + 28, my + 174, {
      size: 14,
      bold: true,
      color: '#38BDF8',
    });
    const isRevealed = !!intel.chosenCounterId;
    intel.clues.forEach((cl, ci) => {
      const cy = my + 194 + ci * 108;
      const borderCol = isRevealed && cl.isSmoke ? THEME.RED_LIGHT : THEME.BORDER_GOLD;
      drawChamferPanel(ctx, mx + 28, cy, 488, 96, 8, THEME.BG_CARD, borderCol);
      const confLabel = isRevealed && cl.isSmoke
        ? '虚假烟雾弹 ✗'
        : cl.confidence === 'high'
        ? '核实线索'
        : cl.confidence === 'mid'
        ? '常规情报'
        : '小道消息';
      const confCol = isRevealed && cl.isSmoke
        ? THEME.RED_LIGHT
        : cl.confidence === 'high'
        ? THEME.GREEN
        : cl.confidence === 'mid'
        ? '#38BDF8'
        : '#FBBF24';
      drawBadge(ctx, mx + 44, cy + 14, 96, 20, confLabel, '#0F172A', confCol);
      drawText(ctx, `线索 #${ci + 1}`, mx + 148, cy + 24, { size: 11, color: THEME.TX3, mono: true });
      drawWrappedText(ctx, cl.text, mx + 44, cy + 44, 456, 20, { size: 12, color: THEME.TX1, maxLines: 2 });
    });

    // 右列：3 选 1 战术指证
    drawText(ctx, '二、指证对手破绽（3 选 1 针对布置，答错无惩罚）', mx + 542, my + 174, {
      size: 14,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    intel.counters.forEach((cnt, idx) => {
      const cy = my + 194 + idx * 108;
      const isChosen = intel.chosenCounterId === cnt.id;
      const borderCol = isChosen
        ? (cnt.isCorrect ? THEME.GREEN : THEME.RED_LIGHT)
        : isRevealed && cnt.isCorrect
        ? THEME.GREEN
        : THEME.BORDER;
      drawChamferPanel(ctx, mx + 542, cy, 490, 96, 8, isChosen ? '#182642' : THEME.BG_CARD, borderCol, isChosen ? 1.8 : 1);
      drawText(ctx, cnt.label, mx + 558, cy + 22, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
      drawWrappedText(ctx, cnt.desc, mx + 558, cy + 42, 336, 18, { size: 11, color: THEME.TX2, maxLines: 2 });
      if (!isRevealed) {
        drawButton(ctx, hits, mx + 908, cy + 32, 110, 32, '指证此破绽 ▶', () => {
          const res = league.chooseOpponentCounter(cnt.id);
          if (res.msg) this.scoutNotice = res.msg;
          if (res.correct) SoundEngine.playBreakthrough();
          else SoundEngine.playWarning();
          actions.onSave?.();
        }, { variant: 'gold', fontSize: 11 });
      } else {
        const badgeTxt = isChosen ? (cnt.isCorrect ? '异议成立 ✓' : '误判干扰 ✗') : cnt.isCorrect ? '真实破绽' : '干扰项';
        const badgeCol = cnt.isCorrect ? THEME.GREEN : isChosen ? THEME.RED_LIGHT : THEME.TX3;
        drawBadge(ctx, mx + 914, cy + 36, 98, 24, badgeTxt, '#0F172A', badgeCol);
      }
    });

    const footerMsg =
      this.scoutNotice ||
      (intel.chosenCounterId
        ? intel.spotCorrect
          ? '破绽指证成功！本场已获得对应属性加成与额外战术能量'
          : '本场未能识破烟雾弹，仍可按常规战术正常出战'
        : '提示：对照阵型与近几轮进失球数据，找出彼此矛盾的小道消息并指证真实破绽');
    drawText(ctx, footerMsg, mx + 28, my + mh - 34, {
      size: 12,
      bold: true,
      color: intel.spotCorrect ? THEME.GREEN : '#7DD3FC',
    });
  }
}
