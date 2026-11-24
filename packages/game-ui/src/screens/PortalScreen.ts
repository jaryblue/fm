/**
 * 页面 2：发行级 Portal 备战门户（聚焦赛前高频决策：对阵侦察 + 赛前整备 + 出战摘要 + 词条复盘）
 * 18 队积分榜与赛程统计已拆至独立一级页面 LeagueScreen，彻底释放首页呼吸感与字号
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import { WEATHER_INFO } from '../../../core/src/Chronicles';
import { computePerkSynergies } from '../../../core/src/PlayerPool';
import { OpponentMatchupIntel, PrepTrainingKind } from '../../../core/src/types';
import { TACTICAL_PRESETS } from '../../../engine/src/types';
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
    const userRankIdx = standings.findIndex(r => r.isUser);
    const userRow = standings[userRankIdx];

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

    // ==================== 左栏 (x: 96..686, w: 590)：焦点战海报 + 赛前整备与沟通 ====================
    // 左上：焦点战海报卡 (h: 280)
    drawChamferPanel(ctx, 96, 80, 590, 280, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER_GOLD, 1.4, THEME.GOLD_LIGHT);
    drawText(ctx, `NEXT FIXTURE · 第 ${st.currentRound}/34 轮`, 118, 102, {
      size: 12,
      bold: true,
      color: THEME.GOLD,
      mono: true,
    });
    drawText(ctx, `${tierInfo.name} · 我队暂列第 ${userRankIdx + 1} 名`, 666, 102, {
      size: 11.5,
      color: '#38BDF8',
      align: 'right',
    });

    const prep = league.getInterMatchPrep();

    if (nextFx) {
      const home = st.clubs.find(c => c.id === nextFx.homeClubId)!;
      const away = st.clubs.find(c => c.id === nextFx.awayClubId)!;
      const homeRankIdx = standings.findIndex(r => r.clubId === home.id);
      const awayRankIdx = standings.findIndex(r => r.clubId === away.id);
      const homeRow = standings[homeRankIdx];
      const awayRow = standings[awayRankIdx];

      drawChamferPanel(ctx, 114, 120, 554, 104, 10, THEME.BG_CARD, THEME.BORDER);
      drawClubCrest(ctx, 226, 150, 19, home);
      drawText(ctx, home.name, 226, 184, {
        size: 15,
        bold: true,
        align: 'center',
        color: home.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      drawText(ctx, `第${homeRankIdx + 1}名 · ${homeRow?.points ?? 0}分 · ${home.formation}`, 226, 206, {
        size: 11,
        align: 'center',
        color: THEME.TX2,
      });

      drawText(ctx, 'VS', 391, 172, { size: 24, bold: true, italic: true, align: 'center', color: THEME.GOLD_LIGHT });

      drawClubCrest(ctx, 556, 150, 19, away);
      drawText(ctx, away.name, 556, 184, {
        size: 15,
        bold: true,
        align: 'center',
        color: away.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      drawText(ctx, `第${awayRankIdx + 1}名 · ${awayRow?.points ?? 0}分 · ${away.formation}`, 556, 206, {
        size: 11,
        align: 'center',
        color: THEME.TX2,
      });

      // 球探情报简报条
      const oppClub = home.isUser ? away : home;
      const brief = league.getOpponentBriefing(oppClub.id);
      const intel = prep?.matchupIntel;
      drawRoundRect(ctx, 114, 234, 554, 56, 8, 'rgba(15, 23, 42, 0.92)', 'rgba(56, 189, 248, 0.35)');
      const famText = intel ? `了解 ${intel.familiarity}%` : '球探情报';
      const famColor = intel && intel.familiarity >= 70 ? THEME.GREEN : '#38BDF8';
      drawBadge(ctx, 124, 243, 76, 18, famText, '#1E3A5F', famColor);
      drawText(ctx, `${brief.styleName} · ${brief.weakLineLabel}`, 208, 252, {
        size: 12,
        bold: true,
        color: THEME.TX1,
      });
      const subTip = intel?.chosenCounterId
        ? (intel.spotCorrect ? '异议成立：已锁定针对性赛前战术红利' : '已完成指证（误判干扰线索，正常应战）')
        : brief.counterTip;
      drawText(ctx, subTip, 124, 273, {
        size: 11.5,
        color: intel?.spotCorrect ? THEME.GREEN : THEME.GOLD_LIGHT,
      });
      if (intel) {
        drawButton(ctx, hits, 534, 244, 122, 36, intel.chosenCounterId ? '情报详情' : '侦察抓破绽', () => {
          this.scoutNotice = '';
          this.scoutModalOpen = true;
        }, { variant: intel.chosenCounterId ? 'ghost' : 'primary', fontSize: 11.5 });
      }

      drawButton(ctx, hits, 114, 302, 156, 44, '首发与阵型', () => actions.onNavigate('tactics'), {
        variant: 'ghost',
        fontSize: 13,
        icon: 'tactics',
      });
      drawButton(ctx, hits, 280, 302, 108, 44, '跳过本轮', () => {
        actions.onQuickSim?.();
      }, {
        variant: 'ghost',
        fontSize: 12.5,
      });
      drawButton(ctx, hits, 398, 302, 270, 44, '▶ 亲自指挥本场对决', actions.onStartMatch, {
        variant: 'gold',
        fontSize: 14,
      });
    }

    // 左下：天气预报 + 赛前轻训练 + 1对1球员沟通 (h: 330)
    drawChamferPanel(ctx, 96, 374, 590, 330, 12, 'rgba(14, 22, 40, 0.92)', 'rgba(56, 189, 248, 0.45)');
    if (prep) {
      const wInfo = WEATHER_INFO[prep.weather];
      drawBadge(ctx, 114, 390, 84, 22, wInfo.label, '#0F172A', wInfo.color);
      drawText(ctx, wInfo.tip, 208, 401, { size: 12, color: THEME.TX2 });
      drawText(ctx, `赛前整备次数 ${prep.actionsLeft}/1`, 666, 401, {
        size: 12,
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
        const bx = 114 + bi * 140;
        const done = prep.doneTraining === tb.kind;
        drawButton(ctx, hits, bx, 424, 132, 38, tb.label, () => {
          const res = league.applyPrepTraining(tb.kind);
          if (res.msg) this.prepToast = res.msg;
          if (res.ok) SoundEngine.playCraftSuccess();
          else SoundEngine.playWarning();
          actions.onSave?.();
        }, {
          variant: done ? 'green' : 'ghost',
          disabled: prep.actionsLeft <= 0 && !done,
          fontSize: 11.5,
        });
      });

      const talk = prep.playerTalk;
      if (talk) {
        drawRoundRect(ctx, 114, 476, 554, 210, 10, THEME.BG_CARD, talk.resolved ? THEME.GREEN : THEME.BORDER_GOLD);
        drawBadge(ctx, 128, 492, 46, 20, talk.role, '#1E3A5F', THEME.TX1);
        drawText(ctx, `${talk.playerName} · 赛前一对一沟通`, 184, 502, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
        if (talk.resolved) {
          drawText(ctx, `已回应：${talk.chosenLabel}`, 128, 552, { size: 13, bold: true, color: THEME.GREEN });
          drawWrappedText(
            ctx,
            this.prepToast || '球员士气已稳住，专注迎接本轮较量',
            128,
            586,
            524,
            20,
            { size: 12, color: THEME.TX2, maxLines: 3 }
          );
        } else {
          drawWrappedText(ctx, talk.prompt, 128, 532, 524, 21, { size: 12.5, color: THEME.TX1, maxLines: 3 });
          drawButton(ctx, hits, 128, 622, 256, 44, talk.optA.label, () => {
            const res = league.resolvePlayerTalk('A');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'gold', fontSize: 12 });
          drawButton(ctx, hits, 396, 622, 256, 44, talk.optB.label, () => {
            const res = league.resolvePlayerTalk('B');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'primary', fontSize: 12 });
        }
      } else {
        drawRoundRect(ctx, 114, 476, 554, 210, 10, THEME.BG_CARD, THEME.BORDER);
        drawText(ctx, '更衣室氛围平稳 · 全队专注备战下轮对手', 132, 536, { size: 14, bold: true, color: THEME.TX1 });
        const subMsg = this.prepToast || prep.nextMatchBuff?.note || st.lastMatchReview || '可从上方选择 1 项赛前轻训练调整状态';
        drawWrappedText(ctx, subMsg, 132, 574, 518, 22, {
          size: 12.5,
          color: this.prepToast || prep.nextMatchBuff?.note ? THEME.GREEN : st.lastMatchReview ? '#7DD3FC' : THEME.TX2,
          maxLines: 3,
        });
      }
    }

    // ==================== 右栏 (x: 702..1264, w: 562)：出战摘要 + 词条脉络 + 复盘与联赛入口 ====================
    // 右上：当前出战配置快捷摘要（3 张大卡，告别 12 个小格子）(h: 196)
    drawChamferPanel(ctx, 702, 80, 562, 196, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD, 1.2);
    drawText(ctx, '当前出战配置摘要', 722, 102, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `激活：${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, 1244, 102, {
      size: 12,
      bold: true,
      color: '#38BDF8',
      align: 'right',
    });

    const eqSkills = league.getEquippedActiveSkills();
    const loadoutCards = league.getMatchLoadout();
    const presets = league.getTacticalPresets();
    const curPresetIdx = presets.findIndex(pr => pr && club.formation === pr.formation && club.style === pr.style);

    // 摘要卡 1：主动技
    drawRoundRect(ctx, 720, 122, 168, 138, 8, THEME.BG_CARD, 'rgba(56, 189, 248, 0.45)');
    drawText(ctx, `⚡ 主动技 ${eqSkills.length}/4`, 732, 142, { size: 12.5, bold: true, color: '#38BDF8' });
    drawWrappedText(
      ctx,
      eqSkills.length > 0 ? eqSkills.slice(0, 3).map(s => s.name).join(' · ') : '尚未装备主动技，前往星图点亮并装配',
      732,
      164,
      144,
      18,
      { size: 11, color: eqSkills.length > 0 ? THEME.TX1 : THEME.TX3, maxLines: 2 }
    );
    drawButton(ctx, hits, 732, 214, 144, 34, '调整技能', () => actions.onNavigate('meta'), { variant: 'primary', fontSize: 11.5 });

    // 摘要卡 2：指挥手牌
    drawRoundRect(ctx, 898, 122, 168, 138, 8, THEME.BG_CARD, 'rgba(192, 132, 252, 0.45)');
    drawText(ctx, `指挥牌 ${loadoutCards.length}/4`, 910, 142, { size: 12.5, bold: true, color: '#C084FC' });
    drawWrappedText(
      ctx,
      loadoutCards.length > 0 ? loadoutCards.slice(0, 3).map(c => c.name).join(' · ') : '尚未配置手牌，前往工坊合成或装配',
      910,
      164,
      144,
      18,
      { size: 11, color: loadoutCards.length > 0 ? THEME.TX1 : THEME.TX3, maxLines: 2 }
    );
    drawButton(ctx, hits, 910, 214, 144, 34, '配牌与合成', () => actions.onNavigate('cards'), { variant: 'primary', fontSize: 11.5 });

    // 摘要卡 3：战术预案（支持一键轮切下一套）
    drawRoundRect(ctx, 1076, 122, 170, 138, 8, THEME.BG_CARD, THEME.BORDER_GOLD);
    drawText(ctx, curPresetIdx >= 0 ? `预案 ${curPresetIdx + 1}/4` : '4套战术预案', 1088, 142, { size: 12.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `${club.formation}`, 1088, 170, { size: 14, bold: true, color: THEME.GREEN });
    drawText(ctx, `${TACTICAL_PRESETS[club.style].name}`, 1088, 192, { size: 11.5, color: THEME.TX2 });
    drawButton(ctx, hits, 1088, 214, 72, 34, '切预案', () => {
      if (presets.length === 0) return;
      const nextIdx = (curPresetIdx + 1) % presets.length;
      const res = league.applyTacticalPreset(nextIdx);
      if (res.ok && res.preset) {
        SoundEngine.playClick();
        this.prepToast = `已切换至预案${nextIdx + 1}：${res.preset.formation} · ${TACTICAL_PRESETS[res.preset.style].name}`;
        actions.onSave?.();
      }
    }, { variant: 'gold', fontSize: 11 });
    drawButton(ctx, hits, 1166, 214, 68, 34, '改战术', () => actions.onNavigate('tactics'), { variant: 'ghost', fontSize: 11 });

    // 右中：俱乐部赛季脉络与 Rogue 战术词条 (h: 222)
    drawChamferPanel(ctx, 702, 290, 562, 222, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    const story = st.storyline;
    drawIcon(ctx, 'sparkle', 724, 314, 15, THEME.GOLD_LIGHT);
    drawText(ctx, `俱乐部赛季脉络与词条 (${club.perks.length})`, 742, 314, { size: 13.5, bold: true, color: THEME.TX1 });
    if (story) {
      drawBadge(ctx, 974, 303, 92, 22, story.title, '#312E81', '#A5B4FC');
    }
    const syn = computePerkSynergies(club.perks);
    const synLine = syn.synergies[0] ? `共振：${syn.synergies[0]}` : '同系叠加2张激活共振';
    drawText(ctx, synLine, 1244, 314, { size: 11, color: syn.synergies[0] ? THEME.GREEN : THEME.TX3, align: 'right' });

    if (club.perks.length === 0) {
      drawRoundRect(ctx, 720, 338, 526, 156, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, '暂未激活 Rogue 战术词条', 740, 376, { size: 14, bold: true, color: THEME.TX2 });
      drawWrappedText(
        ctx,
        '第 8 / 16 / 24 轮赛后 3 选 1 将必定出现「赛季战术词条」盲盒，也可在其他轮次的肉鸽事件中获取强力词条与觉醒效果。',
        740,
        408,
        486,
        22,
        { size: 12, color: THEME.TX3, maxLines: 3 }
      );
    } else {
      club.perks.slice(0, 3).forEach((pk, i) => {
        const px = 720 + i * 178;
        drawChamferPanel(ctx, px, 338, 170, 156, 8, THEME.BG_CARD, THEME.BORDER_GOLD, 1, THEME.GOLD);
        drawText(ctx, pk.name, px + 12, 362, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
        drawWrappedText(ctx, pk.description, px + 12, 386, 146, 19, { size: 11, color: THEME.TX2, maxLines: 5 });
      });
    }

    // 右下：上轮复盘与队医提醒 + 联赛积分榜直达入口 (h: 178)
    drawChamferPanel(ctx, 702, 526, 562, 178, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    const strainList = club.squad.filter(p => p.strainWarning || (p.injuredRounds ?? 0) > 0 || (p.suspendedRounds ?? 0) > 0);
    drawText(ctx, '上轮战况复盘与队内状态', 722, 550, { size: 13, bold: true, color: '#38BDF8' });
    drawWrappedText(
      ctx,
      st.lastMatchReview || '首轮开赛后将在此生成上轮战术复盘与 xG 诊断',
      722,
      572,
      340,
      19,
      { size: 11.5, color: THEME.TX1, maxLines: 3 }
    );
    drawWrappedText(
      ctx,
      strainList.length > 0
        ? `队医提醒：${strainList.slice(0, 2).map(p => `${p.name}(${(p.injuredRounds ?? 0) > 0 ? '伤停' : (p.suspendedRounds ?? 0) > 0 ? '停赛' : '疲惫'})`).join('、')} · 建议轮换`
        : '全队健康度良好，无伤停或体能疲惫预警',
      722,
      640,
      340,
      18,
      { size: 11.5, color: strainList.length > 0 ? '#FBBF24' : THEME.GREEN, maxLines: 2 }
    );

    // 联赛积分榜快速入口卡片
    drawRoundRect(ctx, 1076, 542, 170, 144, 8, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, '联赛实时排名', 1161, 562, { size: 11.5, color: THEME.TX2, align: 'center' });
    drawText(ctx, `第 ${userRankIdx + 1} 名`, 1161, 590, { size: 20, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
    drawText(
      ctx,
      userRow ? `${userRow.points}分 · ${userRow.won}胜${userRow.drawn}平${userRow.lost}负` : '0分 · 未开赛',
      1161,
      614,
      { size: 10.5, color: THEME.TX3, align: 'center' }
    );
    drawButton(ctx, hits, 1088, 634, 146, 40, '赛程与积分榜 ▶', () => actions.onNavigate('league'), {
      variant: 'primary',
      fontSize: 11.5,
    });

    if (this.scoutModalOpen && prep?.matchupIntel) {
      this.renderScoutModal(ctx, hits, league, prep.matchupIntel, prep.actionsLeft, actions);
    }
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
