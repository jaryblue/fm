/**
 * 页面 2：发行级 Portal 备战门户（聚焦赛前高频决策：对阵侦察 + 赛前整备 + 出战摘要 + 词条复盘）
 * 18 队积分榜与赛程统计已拆至独立一级页面 LeagueScreen，彻底释放首页呼吸感与字号
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import { getElementLabel, inferCardElement } from '../../../core/src/CommandCards';
import { WEATHER_INFO } from '../../../core/src/Chronicles';
import { computePerkSynergies } from '../../../core/src/PlayerPool';
import { OpponentMatchupIntel, PrepTrainingKind, ScoutingZoneId, ScoutRewardKind } from '../../../core/src/types';
import { FORMATIONS } from '../../../engine/src/formations';
import { TacticalStyle } from '../../../engine/src/types';
import { TACTICAL_PRESETS } from '../../../engine/src/types';
import { AssetLoader } from '../AssetLoader';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawFoilShimmer,
  drawNavRail,
  drawRoundRect,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  HitRegistry,
  NavRailTab,
} from '../CanvasKit';
import { drawClubCrest } from '../ClubVisuals';
import { easeOutBack } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { IS_MOBILE, THEME } from '../Theme';
import { drawIcon, drawSkillGlyph, SkillGlyphKind } from '../VectorIcons';

const STYLE_GLYPH: Record<TacticalStyle, SkillGlyphKind> = {
  tiki_taka: 'tiki',
  gegenpress: 'press',
  wing_play: 'wing',
  counter: 'counter',
  park_bus: 'bus',
  balanced: 'balanced',
};

const ELEMENT_COLOR: Record<string, string> = {
  press: '#EF4444',
  pass: '#38BDF8',
  wing: '#F59E0B',
  iron: '#22C55E',
  blitz: '#C084FC',
};

function mapRoleToScoutZone(role: string): ScoutingZoneId {
  if (role === 'GK' || role === 'ST') return 'gk_core';
  if (role === 'CB') return 'defense';
  if (['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM', 'LW', 'RW'].includes(role)) return 'wings';
  return 'midfield';
}

export class PortalScreen {
  private prepToast = '';
  private scoutModalOpen = false;
  private scoutNotice = '';
  private selectedZoneId: ScoutingZoneId | null = null;
  private animTime = 0;
  private stampAnimTimer = 0;

  public update(dtSec: number): void {
    this.animTime += dtSec;
    if (this.stampAnimTimer > 0) {
      this.stampAnimTimer = Math.max(0, this.stampAnimTimer - dtSec);
    }
  }

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
      onToast?: (msg: string, color?: string) => void;
      onSeasonStarted?: () => void;
      onBurst?: (x: number, y: number, color?: string) => void;
      onShake?: (intensity: number, dur: number) => void;
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
    const isSummerWindow = st.phase === 'SUMMER_WINDOW';

    const totalRounds = league.getTotalRegularRounds();
    const stageLabel = isSummerWindow ? '季前夏窗 · 未开启赛季' : `${tierInfo.shortLabel} · 第 ${st.currentRound}/${totalRounds} 轮`;

    drawBroadcastHeader(ctx, hits, {
      kicker: `SEASON ${st.seasonNumber} · ${tierInfo.name} (${diffStars})`,
      title: club.name,
      club,
      badge: stageLabel,
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
    });

    drawNavRail(ctx, hits, 'portal', actions.onNavigate);

    // ==================== 左栏 (x: 96..686, w: 590)：焦点战海报主视觉 + 赛前整备与沟通 ====================
    // 左上：焦点战海报卡 / 季前夏窗引援引导卡 (h: 294)
    drawChamferPanel(ctx, 96, 80, 590, 294, 12, 'rgba(17, 23, 34, 0.95)', THEME.BORDER, 1);

    const prep = isSummerWindow ? undefined : league.getInterMatchPrep();

    if (isSummerWindow) {
      const squadCount = club.squad.length;
      const needCount = Math.max(0, 26 - squadCount);
      const ready = squadCount >= 26;

      drawText(ctx, 'PRE-SEASON · 夏季转会窗引援引导', 116, 98, {
        size: 11.5,
        bold: true,
        color: THEME.GOLD,
        mono: true,
      });
      drawText(ctx, `当前大名单 ${squadCount}/26 人 · 可用资金 ${league.getClubFunds()} 万`, 666, 98, {
        size: 11.5,
        color: ready ? THEME.GREEN : '#38BDF8',
        align: 'right',
      });

      // 足协大名单注册公文进度条
      drawRoundRect(ctx, 112, 114, 558, 52, 8, THEME.BG_CARD, ready ? 'rgba(74, 222, 128, 0.45)' : THEME.BORDER, 1);
      drawText(ctx, `足协一线队注册公文：${squadCount} / 26 人`, 130, 130, {
        size: 13.5,
        bold: true,
        color: THEME.TX1,
      });
      drawBadge(
        ctx,
        524,
        120,
        130,
        20,
        ready ? '名额已满 · 待盖章' : `还差 ${needCount} 名球员`,
        ready ? '#14532D' : '#78350F',
        ready ? THEME.GREEN : THEME.GOLD_LIGHT
      );
      drawRoundRect(ctx, 130, 148, 524, 8, 4, '#1E293B');
      drawRoundRect(ctx, 130, 148, Math.max(12, Math.round(Math.min(1, squadCount / 26) * 524)), 8, 4, ready ? THEME.GREEN : THEME.GOLD_LIGHT);

      // 三大引援部门门牌（整卡可点直接推门进入，替代重复的「前往引援中心」按钮）
      const channels = [
        { title: '青训学院', sub: '0 万免签提拔小妖', desc: '迷雾随赛季逐步清晰，赛季末超 19 岁自动离队', color: THEME.GREEN },
        { title: '转会市场', sub: '预算签入即战力', desc: '补强薄弱位置，也可挂牌出售冗余球员回笼资金', color: '#38BDF8' },
        { title: '神秘经纪人', sub: '高风险盲盒密荐', desc: '按联赛水平浮动，小概率直接开出超级巨星', color: '#C084FC' },
      ];
      channels.forEach((ch, ci) => {
        const cx = 112 + ci * 189;
        const chHov = hits.isHovered(cx, 176, 180, 122);
        drawRoundRect(
          ctx,
          cx,
          176,
          180,
          122,
          8,
          chHov ? THEME.BG_CARD_HOVER : THEME.BG_CARD,
          chHov ? ch.color : THEME.BORDER,
          chHov ? 1.5 : 1
        );
        ctx.fillStyle = ch.color;
        ctx.fillRect(cx + 10, 177, 160, 2);
        drawText(ctx, ch.title, cx + 14, 198, { size: 13.5, bold: true, color: ch.color });
        drawText(ctx, ch.sub, cx + 14, 219, { size: 11.5, bold: true, color: THEME.TX1 });
        drawWrappedText(ctx, ch.desc, cx + 14, 239, 152, 17, { size: 10.5, color: THEME.TX2, maxLines: 2 });
        drawText(ctx, '进入 ›', cx + 166, 284, {
          size: 10.5,
          bold: true,
          color: chHov ? '#FFFFFF' : ch.color,
          align: 'right',
        });
        hits.add(cx, 176, 180, 122, () => {
          SoundEngine.playClick();
          actions.onNavigate('transfer_hub');
        });
      });

      if (ready) {
        drawButton(ctx, hits, 112, 308, 558, 48, '✓ 足协盖章注册 · 新赛季开哨 ▶', () => {
          const res = league.finishSummerWindowAndStartSeason();
          if (res.ok) {
            SoundEngine.playFanfare();
            actions.onSeasonStarted?.();
          } else {
            SoundEngine.playWarning();
            actions.onToast?.(res.reason || '需凑齐 26 人大名单才能开启赛季', THEME.RED_LIGHT);
          }
        }, {
          variant: 'gold',
          fontSize: 14.5,
          icon: 'sparkle',
        });
      } else {
        drawButton(ctx, hits, 112, 310, 236, 46, `一键征召青训补齐 (${squadCount}/26)`, () => {
          const res = league.signFreeAcademyFill(true);
          if (res.ok) {
            SoundEngine.playCraftSuccess();
            actions.onSave?.();
            actions.onToast?.(`已从青训学院免费补齐 ${res.added} 名球员！`, THEME.GREEN);
            actions.onBurst?.(230, 310, THEME.GREEN);
          } else {
            SoundEngine.playWarning();
            actions.onToast?.(res.reason || '当前已满 26 人或青训人数不足', THEME.GOLD_LIGHT);
          }
        }, {
          variant: 'primary',
          fontSize: 12.5,
        });
        drawButton(ctx, hits, 358, 308, 312, 48, '补齐青训并盖章开赛 ▶', () => {
          const fillRes = league.signFreeAcademyFill(true);
          if (fillRes.ok) {
            actions.onSave?.();
          }
          const res = league.finishSummerWindowAndStartSeason();
          if (res.ok) {
            SoundEngine.playFanfare();
            actions.onSeasonStarted?.();
          } else {
            SoundEngine.playWarning();
            actions.onToast?.(res.reason || '需凑齐 26 人大名单才能开启赛季', THEME.RED_LIGHT);
          }
        }, {
          variant: 'gold',
          fontSize: 13.5,
          icon: 'sparkle',
        });
      }
    } else {
      drawText(ctx, `NEXT FIXTURE · 第 ${st.currentRound}/${totalRounds} 轮`, 116, 98, {
        size: 11.5,
        bold: true,
        color: THEME.GOLD,
        mono: true,
      });
      drawText(ctx, `${tierInfo.name} · 我队暂列第 ${userRankIdx + 1} 名`, 666, 98, {
        size: 11.5,
        color: '#38BDF8',
        align: 'right',
      });
    }

    if (!isSummerWindow && nextFx) {
      const home = st.clubs.find(c => c.id === nextFx.homeClubId)!;
      const away = st.clubs.find(c => c.id === nextFx.awayClubId)!;
      const homeRankIdx = standings.findIndex(r => r.clubId === home.id);
      const awayRankIdx = standings.findIndex(r => r.clubId === away.id);
      const homeRow = standings[homeRankIdx];
      const awayRow = standings[awayRankIdx];

      // 焦点对阵海报舞台（兼比赛日通行证，整卡可点击开赛）
      const stageX = 112, stageY = 116, stageW = 558, stageH = 122;
      const stageHover = hits.isHovered(stageX, stageY, stageW, stageH);
      drawChamferPanel(
        ctx,
        stageX,
        stageY,
        stageW,
        stageH,
        10,
        THEME.BG_CARD,
        stageHover ? THEME.GOLD_LIGHT : THEME.BORDER,
        stageHover ? 1.6 : 1.0
      );
      const vsBg = AssetLoader.get('fixture_vs_bg');
      if (vsBg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(stageX + 1, stageY + 1, stageW - 2, stageH - 2);
        ctx.clip();
        ctx.globalAlpha = 0.78;
        ctx.drawImage(vsBg, stageX + 1, stageY + 1, stageW - 2, stageH - 2);
        const scrim = ctx.createLinearGradient(stageX, stageY, stageX, stageY + stageH);
        scrim.addColorStop(0, 'rgba(10, 16, 30, 0.15)');
        scrim.addColorStop(1, 'rgba(10, 16, 30, 0.88)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = scrim;
        ctx.fillRect(stageX + 1, stageY + 1, stageW - 2, stageH - 2);
        ctx.restore();
      }

      // 主客队队徽光晕
      const drawCrestGlow = (cx: number, cy: number, col: string) => {
        ctx.save();
        ctx.globalAlpha = 0.28;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 50);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      drawCrestGlow(224, 154, home.primaryColor);
      drawCrestGlow(558, 154, away.primaryColor);

      drawClubCrest(ctx, 224, 154, 28, home);
      drawText(ctx, fitText(ctx, home.name, 178, 16, true), 224, 196, {
        size: 16,
        bold: true,
        align: 'center',
        color: home.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      drawText(ctx, `第${homeRankIdx + 1}名 · ${homeRow?.points ?? 0}分 · ${home.formation}`, 224, 216, {
        size: 11,
        align: 'center',
        color: THEME.TX2,
      });

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 12;
      drawText(ctx, 'VS', 391, 160, { size: 28, bold: true, italic: true, align: 'center', color: THEME.GOLD_LIGHT });
      ctx.restore();
      drawBadge(
        ctx,
        355,
        186,
        72,
        18,
        home.isUser ? '我方主场' : '我方客场',
        'rgba(15, 23, 42, 0.90)',
        home.isUser ? THEME.GOLD_LIGHT : '#7DD3FC'
      );

      drawClubCrest(ctx, 558, 154, 28, away);
      drawText(ctx, fitText(ctx, away.name, 178, 16, true), 558, 196, {
        size: 16,
        bold: true,
        align: 'center',
        color: away.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      drawText(ctx, `第${awayRankIdx + 1}名 · ${awayRow?.points ?? 0}分 · ${away.formation}`, 558, 216, {
        size: 11,
        align: 'center',
        color: THEME.TX2,
      });
      drawBadge(
        ctx,
        336,
        210,
        110,
        20,
        'KICK OFF ▶',
        stageHover ? 'rgba(250, 204, 21, 0.96)' : 'rgba(15, 23, 42, 0.88)',
        stageHover ? '#0A0E17' : THEME.GOLD_LIGHT
      );
      hits.add(stageX, stageY, stageW, stageH, () => {
        SoundEngine.playClick();
        actions.onStartMatch();
      });

      // 球探情报简报条
      const oppClub = home.isUser ? away : home;
      const brief = league.getOpponentBriefing(oppClub.id);
      const intel = prep?.matchupIntel;
      drawRoundRect(ctx, 112, 246, 558, 52, 8, THEME.BG_CARD, THEME.BORDER);
      const famText = intel ? `了解 ${intel.familiarity}%` : '球探情报';
      const famColor = intel && intel.familiarity >= 70 ? THEME.GREEN : '#38BDF8';
      drawBadge(ctx, 122, 253, 76, 18, famText, '#1E3A5F', famColor);
      const ecoSuffix = [brief.isRival ? '宿敌' : null, brief.ecoTag ?? null, brief.formerPlayerName ? `旧将:${brief.formerPlayerName.split('(')[0]}` : null].filter(Boolean).join(' · ');
      drawText(ctx, fitText(ctx, `${brief.styleName} · ${brief.weakLineLabel}${ecoSuffix ? ` · ${ecoSuffix}` : ''}`, 318, 11.5, true), 206, 262, {
        size: 11.5,
        bold: true,
        color: brief.isRival || brief.formerPlayerName ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      const subTip = intel?.chosenCounterId
        ? intel.spotCorrect
          ? intel.chosenRewardKind === 'skill_overclock'
            ? '红利锁定：克制主动技本场临时+1 Rank · 首触发免冷却'
            : intel.chosenRewardKind === 'buff_debuff'
            ? `红利锁定：克制手牌-1费+5分 · ${intel.activeDebuff?.label || '已挂弱点减益'}`
            : '破绽指证成立！点「战前录像室」锁定 2 选 1 针对红利'
          : '已完成指证（误判干扰线索，正常应战）'
        : brief.counterTip;
      drawText(ctx, fitText(ctx, subTip, 396, 11.5), 122, 282, {
        size: 11.5,
        color: intel?.spotCorrect ? THEME.GREEN : THEME.GOLD_LIGHT,
      });
      if (intel) {
        const needsRewardPick = !!intel.spotCorrect && !intel.chosenRewardKind;
        const btnLabel = !intel.chosenCounterId
          ? '侦察抓破绽'
          : needsRewardPick
          ? '选择针对红利'
          : '战术录像室';
        drawButton(ctx, hits, 534, 254, 124, 36, btnLabel, () => {
          this.scoutNotice = '';
          this.selectedZoneId = null;
          this.scoutModalOpen = true;
        }, { variant: needsRewardPick ? 'gold' : intel.chosenCounterId ? 'ghost' : 'primary', fontSize: 11.5 });
      }

      drawButton(ctx, hits, 112, 308, 456, 48, '▶ 吹响开场哨 · 亲自指挥本场对决', actions.onStartMatch, {
        variant: 'gold',
        fontSize: 15,
      });
      drawButton(ctx, hits, 578, 312, 92, 40, '⏩ 快进', () => {
        actions.onQuickSim?.();
      }, {
        variant: 'ghost',
        fontSize: 12,
      });
    }

    // 左下：天气预报 + 赛前轻训练 + 1对1球员沟通 (h: 318) / 未开启赛季时显示季前备战指引
    drawChamferPanel(ctx, 96, 386, 590, 318, 12, 'rgba(17, 23, 34, 0.94)', THEME.BORDER, 1);
    if (isSummerWindow) {
      const gkCnt = club.squad.filter(p => p.role === 'GK').length;
      const defCnt = club.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)).length;
      const midCnt = club.squad.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role)).length;
      const fwdCnt = club.squad.filter(p => ['LW', 'RW', 'ST'].includes(p.role)).length;
      const avgOvr = club.squad.length > 0
        ? Math.round(club.squad.reduce((acc, p) => acc + p.ca, 0) / club.squad.length)
        : 0;

      drawBadge(ctx, 114, 400, 108, 22, '季前备战指引', '#0F172A', THEME.GOLD_LIGHT);
      drawText(ctx, `当前阵容均评 ${avgOvr} · ${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, 232, 411, {
        size: 12,
        color: THEME.TX2,
      });

      const posBoxes = [
        { label: '门将 GK', val: `${gkCnt} 人`, col: '#FBBF24' },
        { label: '后卫 DEF', val: `${defCnt} 人`, col: '#38BDF8' },
        { label: '中场 MID', val: `${midCnt} 人`, col: THEME.GREEN },
        { label: '前锋 FWD', val: `${fwdCnt} 人`, col: '#F87171' },
      ];
      posBoxes.forEach((pb, idx) => {
        const bx = 114 + idx * 140;
        drawRoundRect(ctx, bx, 434, 132, 54, 8, THEME.BG_CARD, THEME.BORDER);
        drawText(ctx, pb.label, bx + 66, 450, { size: 11, color: THEME.TX2, align: 'center' });
        drawText(ctx, pb.val, bx + 66, 472, { size: 15, bold: true, color: pb.col, align: 'center' });
      });

      drawRoundRect(ctx, 114, 500, 554, 188, 10, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, '新赛季启程三步走', 132, 524, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
      const steps = [
        '✓ 1. 已完成 3 轮核心开包，获得初始建队基石球员',
        `${club.squad.length >= 26 ? '✓' : '○'} 2. 在引援中心通过青训、转会或经纪人补齐 26 人大名单（当前 ${club.squad.length}/26）`,
        '○ 3. 点击上方「确认开启新赛季」，正式进入第 1 轮备战与比赛日',
      ];
      steps.forEach((line, si) => {
        drawText(ctx, line, 132, 554 + si * 28, {
          size: 12.5,
          color: si === 0 || (si === 1 && club.squad.length >= 26) ? THEME.GREEN : THEME.TX1,
        });
      });
      drawText(ctx, '点击左侧【引援】或【战术】即可随时调整大名单与首发站位', 132, 654, {
        size: 11.5,
        color: '#7DD3FC',
      });
    } else if (prep) {
      const wInfo = WEATHER_INFO[prep.weather];
      drawBadge(ctx, 114, 400, 84, 22, wInfo.label, '#0F172A', wInfo.color);
      drawText(ctx, wInfo.tip, 208, 411, { size: 12, color: THEME.TX2 });
      drawText(ctx, `赛前整备次数 ${prep.actionsLeft}/1`, 666, 411, {
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
        drawButton(ctx, hits, bx, 434, 132, 38, tb.label, () => {
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
        drawRoundRect(ctx, 114, 486, 554, 204, 10, THEME.BG_CARD, talk.resolved ? THEME.GREEN : THEME.BORDER_GOLD);
        drawBadge(ctx, 128, 500, 46, 20, talk.role, '#1E3A5F', THEME.TX1);
        drawText(ctx, `${talk.playerName} · 赛前一对一沟通`, 184, 510, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
        if (talk.resolved) {
          drawText(ctx, `已回应：${talk.chosenLabel}`, 128, 558, { size: 13, bold: true, color: THEME.GREEN });
          drawWrappedText(
            ctx,
            this.prepToast || '球员士气已稳住，专注迎接本轮较量',
            128,
            592,
            524,
            20,
            { size: 12, color: THEME.TX2, maxLines: 3 }
          );
        } else {
          drawWrappedText(ctx, talk.prompt, 128, 538, 524, 21, { size: 12.5, color: THEME.TX1, maxLines: 3 });
          drawButton(ctx, hits, 128, 632, 256, 42, talk.optA.label, () => {
            const res = league.resolvePlayerTalk('A');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'primary', fontSize: 12 });
          drawButton(ctx, hits, 396, 632, 256, 42, talk.optB.label, () => {
            const res = league.resolvePlayerTalk('B');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'ghost', fontSize: 12 });
        }
      } else {
        drawRoundRect(ctx, 114, 486, 554, 204, 10, THEME.BG_CARD, THEME.BORDER);
        drawText(ctx, '更衣室氛围平稳 · 全队专注备战下轮对手', 132, 542, { size: 14, bold: true, color: THEME.TX1 });
        const subMsg = this.prepToast || prep.nextMatchBuff?.note || st.lastMatchReview || '可从上方选择 1 项赛前轻训练调整状态';
        drawWrappedText(ctx, subMsg, 132, 580, 518, 22, {
          size: 12.5,
          color: this.prepToast || prep.nextMatchBuff?.note ? THEME.GREEN : st.lastMatchReview ? '#7DD3FC' : THEME.TX2,
          maxLines: 3,
        });
      }
    }

    // ==================== 右栏 (x: 702..1264, w: 562)：出战摘要 + 词条脉络 + 复盘与联赛入口 ====================
    // 右上：当前出战配置快捷摘要 (h: 196)
    drawChamferPanel(ctx, 702, 80, 562, 196, 12, 'rgba(17, 23, 34, 0.95)', THEME.BORDER, 1);
    drawText(ctx, '当前出战配置摘要', 722, 102, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `激活：${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, 1244, 102, {
      size: 12,
      bold: true,
      color: '#38BDF8',
      align: 'right',
    });

    const eqSkills = league.getEquippedActiveSkills();
    const deckPresets = league.getDeckPresets();
    const presets = league.getTacticalPresets();
    const curPresetIdx = presets.findIndex(pr => pr && club.formation === pr.formation && club.style === pr.style);

    // 摘要卡 1：主动技 + 赛季圣物（4 槽位高清雕纹可视化 + 常驻触屏入口提示）
    const rogue = league.getV6SeasonRogue();
    const hovMeta = hits.isHovered(720, 122, 168, 138);
    drawRoundRect(ctx, 720, 122, 168, 138, 8, hovMeta ? THEME.BG_CARD_HOVER : THEME.BG_CARD, hovMeta ? '#38BDF8' : THEME.BORDER, hovMeta ? 1.4 : 1);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(730, 123, 148, 2);
    drawIcon(ctx, 'bolt', 736, 138, 12, '#38BDF8');
    drawText(ctx, `绝技 ${eqSkills.length}/4`, 746, 138, { size: 11.5, bold: true, color: '#38BDF8' });
    drawText(ctx, `圣物 ${rogue.seasonRelics.length}`, 878, 138, { size: 10.5, bold: true, color: '#E9D5FF', align: 'right', mono: true });

    for (let si = 0; si < 4; si++) {
      const col = si % 2;
      const row = Math.floor(si / 2);
      const sx = 730 + col * 76;
      const sy = 152 + row * 40;
      const sk = eqSkills[si];
      if (sk) {
        const gKind: SkillGlyphKind = sk.styleTag ? (STYLE_GLYPH[sk.styleTag] ?? 'master') : 'master';
        drawRoundRect(ctx, sx, sy, 72, 34, 6, 'rgba(12, 42, 68, 0.85)', 'rgba(56, 189, 248, 0.45)', 1);
        drawSkillGlyph(ctx, gKind, sx + 15, sy + 17, 19, '#38BDF8', THEME.GOLD_LIGHT);
        drawText(ctx, fitText(ctx, sk.name, 42, FONT.MICRO, true, true), sx + 28, sy + 17, { token: 'MICRO', bold: true, color: THEME.TX1 });
      } else {
        ctx.save();
        ctx.setLineDash([3, 2]);
        drawRoundRect(ctx, sx, sy, 72, 34, 6, 'rgba(15, 23, 42, 0.55)', 'rgba(148, 163, 184, 0.28)', 1);
        ctx.restore();
        drawText(ctx, `F${si + 1} 空`, sx + 36, sy + 17, { token: 'MICRO', color: THEME.TX3, align: 'center' });
      }
    }
    // 底部圣物槽点 + 常驻触屏角标
    for (let ri = 0; ri < 5; ri++) {
      const lit = ri < rogue.seasonRelics.length;
      drawRoundRect(ctx, 730 + ri * 12, 240, 8, 8, 2, lit ? '#C084FC' : 'rgba(148, 163, 184, 0.22)');
    }
    drawText(ctx, '星盘 ›', 878, 244, { size: 10.5, bold: true, color: hovMeta ? '#FFFFFF' : '#7DD3FC', align: 'right' });
    hits.add(720, 122, 168, 138, () => actions.onNavigate('meta'));

    // 摘要卡 2：V6 四赛段临场指令池（4 张微缩战术卡可视化 + 常驻触屏入口提示）
    const v6Cfg = league.getV6MatchRuntimeConfig();
    const s1Cards = league.getV6CheckpointDirectives('s1');
    const v6DeckWarn = s1Cards.length < 4;
    const deckAccent = v6DeckWarn ? '#F59E0B' : '#C084FC';
    const hovDeck = hits.isHovered(898, 122, 168, 138);
    drawRoundRect(ctx, 898, 122, 168, 138, 8, hovDeck ? THEME.BG_CARD_HOVER : THEME.BG_CARD, hovDeck ? deckAccent : v6DeckWarn ? 'rgba(245, 158, 11, 0.55)' : THEME.BORDER, hovDeck ? 1.4 : 1);
    ctx.fillStyle = deckAccent;
    ctx.fillRect(908, 123, 148, 2);
    drawText(ctx, `四段指令 (${s1Cards.length}/4)`, 908, 138, { size: 11.5, bold: true, color: deckAccent });
    drawText(ctx, `+${v6Cfg.checkpointTpBase}TP`, 1056, 138, { size: 10, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });

    for (let ci = 0; ci < 4; ci++) {
      const col = ci % 2;
      const row = Math.floor(ci / 2);
      const cx = 908 + col * 76;
      const cy = 152 + row * 40;
      const entry = s1Cards[ci];
      if (entry) {
        const zCol = entry.def.zone === 'ATT' ? '#F43F5E' : entry.def.zone === 'MID' ? '#38BDF8' : '#22C55E';
        drawRoundRect(ctx, cx, cy, 72, 34, 6, 'rgba(18, 29, 51, 0.92)', zCol, 1);
        ctx.fillStyle = zCol;
        ctx.fillRect(cx + 1, cy + 5, 2.5, 24);
        drawIcon(ctx, entry.def.tendency === 'ATK' ? 'sword' : 'shield', cx + 13, cy + 12, 10, zCol);
        drawText(ctx, `${entry.effectiveTpCost}T`, cx + 67, cy + 12, { size: 8.5, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
        drawText(ctx, fitText(ctx, entry.def.name, 60, 9.5, true), cx + 8, cy + 25, { size: 9.5, bold: true, color: THEME.TX1 });
      } else {
        ctx.save();
        ctx.setLineDash([3, 2]);
        drawRoundRect(ctx, cx, cy, 72, 34, 6, 'rgba(15, 23, 42, 0.55)', 'rgba(245, 158, 11, 0.45)', 1);
        ctx.restore();
        drawText(ctx, '+ 空槽', cx + 36, cy + 17, { size: 9.5, color: '#FCD34D', align: 'center' });
      }
    }
    drawText(ctx, '配装 ›', 1056, 244, { size: 10.5, bold: true, color: hovDeck ? '#FFFFFF' : deckAccent, align: 'right' });
    hits.add(898, 122, 168, 138, () => actions.onNavigate('cards'));

    // 摘要卡 3：战术预案（微型绿茵阵型图 + 流派雕纹徽章 + 预案点阵轮换）
    const hovPreset = hits.isHovered(1076, 122, 170, 138);
    drawRoundRect(ctx, 1076, 122, 170, 138, 8, hovPreset ? THEME.BG_CARD_HOVER : THEME.BG_CARD, hovPreset ? THEME.GOLD_LIGHT : THEME.BORDER, hovPreset ? 1.4 : 1);
    ctx.fillStyle = THEME.GOLD_LIGHT;
    ctx.fillRect(1086, 123, 150, 2);
    drawText(ctx, curPresetIdx >= 0 ? `预案 ${curPresetIdx + 1}/4` : '战术预案', 1088, 138, { size: 11.5, bold: true, color: THEME.GOLD_LIGHT });
    for (let pi = 0; pi < 4; pi++) {
      const activeDot = pi === (curPresetIdx >= 0 ? curPresetIdx : 0);
      drawRoundRect(ctx, 1192 + pi * 11, 134, 7, 7, 3.5, activeDot ? THEME.GOLD_LIGHT : 'rgba(148, 163, 184, 0.25)');
    }

    // 微型绿茵阵型站位图 (54×74)
    const mpX = 1088, mpY = 152, mpW = 54, mpH = 74;
    drawRoundRect(ctx, mpX, mpY, mpW, mpH, 6, '#0B241A', 'rgba(74, 222, 128, 0.35)', 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mpX + 4, mpY + mpH / 2);
    ctx.lineTo(mpX + mpW - 4, mpY + mpH / 2);
    ctx.stroke();
    const miniSlots = FORMATIONS[club.formation] ?? [];
    miniSlots.forEach((sl, idx) => {
      const dx = mpX + 7 + (sl.baseY / 68) * (mpW - 14);
      const dy = mpY + 7 + (1 - Math.max(0, Math.min(1, (sl.baseX - 5) / 73))) * (mpH - 14);
      ctx.fillStyle = idx === 0 ? '#FACC15' : '#4ADE80';
      ctx.beginPath();
      ctx.arc(dx, dy, 2.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 右侧流派高清雕纹 + 阵型风格字号
    drawSkillGlyph(ctx, STYLE_GLYPH[club.style] ?? 'balanced', 1192, 174, 28, '#38BDF8', THEME.GOLD_LIGHT);
    drawText(ctx, club.formation, 1192, 202, { size: 14, bold: true, color: THEME.GREEN, align: 'center', mono: true });
    drawText(ctx, TACTICAL_PRESETS[club.style].name, 1192, 220, { size: 11, color: THEME.TX1, align: 'center' });
    drawText(ctx, '轮换 ↻', 1234, 244, { size: 10.5, bold: true, color: hovPreset ? '#FFFFFF' : THEME.GOLD_LIGHT, align: 'right' });
    hits.add(1076, 122, 170, 138, () => {
      if (presets.length === 0) {
        actions.onNavigate('tactics');
        return;
      }
      const nextIdx = (curPresetIdx + 1) % presets.length;
      const res = league.applyTacticalPreset(nextIdx);
      if (res.ok && res.preset) {
        SoundEngine.playClick();
        this.prepToast = `已切换至预案${nextIdx + 1}：${res.preset.formation} · ${TACTICAL_PRESETS[res.preset.style].name}`;
        actions.onSave?.();
      }
    });

    // 右中：俱乐部赛季脉络与 Rogue 战术词条 (h: 222)
    drawChamferPanel(ctx, 702, 290, 562, 222, 12, 'rgba(17, 23, 34, 0.94)', THEME.BORDER);
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
      const perkArt = AssetLoader.get('perk_event');
      if (perkArt && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(734, 352, 118, 128, 6);
        ctx.clip();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(perkArt, 734, 352, 118, 128);
        ctx.restore();
        drawRoundRect(ctx, 734, 352, 118, 128, 6, undefined, 'rgba(250, 204, 21, 0.32)', 1);
      }
      const textLeft = perkArt ? 868 : 742;
      const textMaxW = perkArt ? 360 : 482;
      drawText(ctx, '暂未激活 Rogue 战术词条', textLeft, 374, { size: 14.5, bold: true, color: THEME.TX1 });
      drawWrappedText(
        ctx,
        '第 8 / 16 / 24 轮赛后 3 选 1 将必定出现「赛季战术词条」盲盒，也可在其他轮次的肉鸽事件中获取强力词条与觉醒效果。',
        textLeft,
        404,
        textMaxW,
        24,
        { size: 12, color: THEME.TX2, maxLines: 3 }
      );
    } else {
      club.perks.slice(0, 3).forEach((pk, i) => {
        const px = 720 + i * 178;
        drawChamferPanel(ctx, px, 338, 170, 156, 8, THEME.BG_CARD, THEME.BORDER, 1, THEME.GOLD);
        drawIcon(ctx, 'sparkle', px + 20, 362, 13, THEME.GOLD_LIGHT);
        drawText(ctx, fitText(ctx, pk.name, 122, 13, true), px + 34, 362, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
        drawWrappedText(ctx, pk.description, px + 14, 386, 142, 20, { size: 11.5, color: THEME.TX2, maxLines: 5 });
      });
    }

    // 右下：上轮复盘与队医提醒 + 联赛积分榜直达入口 (h: 178)
    drawChamferPanel(ctx, 702, 526, 562, 178, 12, 'rgba(17, 23, 34, 0.94)', THEME.BORDER);
    const strainList = club.squad.filter(p => p.strainWarning || (p.injuredRounds ?? 0) > 0 || (p.suspendedRounds ?? 0) > 0);
    drawText(ctx, '上轮战况复盘与队内状态', 722, 550, { size: 13.5, bold: true, color: '#38BDF8' });
    drawWrappedText(
      ctx,
      st.lastMatchReview || '首轮开赛后将在此生成上轮战术复盘与 xG 诊断',
      722,
      574,
      340,
      20,
      { size: 11.5, color: THEME.TX1, maxLines: 3 }
    );
    drawWrappedText(
      ctx,
      strainList.length > 0
        ? `队医提醒：${strainList.slice(0, 2).map(p => `${p.name}(${(p.injuredRounds ?? 0) > 0 ? '伤停' : (p.suspendedRounds ?? 0) > 0 ? '停赛' : '疲惫'})`).join('、')} · 建议轮换`
        : '全队健康度良好，无伤停或体能疲惫预警',
      722,
      642,
      340,
      19,
      { size: 11.5, color: strainList.length > 0 ? '#FBBF24' : THEME.GREEN, maxLines: 2 }
    );

    // 联赛积分榜快速入口卡片（整卡直点，常驻触屏角标）
    const hovLeague = hits.isHovered(1076, 542, 170, 144);
    drawRoundRect(ctx, 1076, 542, 170, 144, 8, hovLeague ? THEME.BG_CARD_HOVER : THEME.BG_CARD, hovLeague ? THEME.GOLD_LIGHT : THEME.BORDER, hovLeague ? 1.4 : 1);
    drawText(ctx, '联赛实时排名', 1161, 566, { size: 11.5, color: THEME.TX2, align: 'center' });
    drawText(ctx, `第 ${userRankIdx + 1} 名`, 1161, 604, { size: 26, bold: true, color: THEME.GOLD_LIGHT, align: 'center', mono: true });
    drawText(
      ctx,
      userRow ? `${userRow.points}分 · ${userRow.won}胜${userRow.drawn}平${userRow.lost}负` : '0分 · 未开赛',
      1161,
      638,
      { size: 11, color: THEME.TX2, align: 'center', mono: true }
    );
    drawText(ctx, '积分榜 ›', 1161, 668, { size: 10.5, bold: true, color: hovLeague ? '#FFFFFF' : '#7DD3FC', align: 'center' });
    hits.add(1076, 542, 170, 144, () => actions.onNavigate('league'));

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
    actions: {
      onSave?: () => void;
      onBurst?: (x: number, y: number, color?: string) => void;
      onShake?: (intensity: number, dur: number) => void;
    }
  ): void {
    ctx.fillStyle = 'rgba(4, 7, 14, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 74;
    const my = 42;
    const mw = 1132;
    const mh = 636;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(11, 17, 32, 0.98)', THEME.BORDER_GOLD, 1.8, THEME.GOLD_LIGHT);

    // 顶栏：对手名称 + 阵型 + 了解度 + 分析点宝石 + 深度侦察
    drawText(ctx, `战术录像室 · 沙盘抓破绽 · ${intel.oppClubName}`, mx + 24, my + 30, {
      size: 18,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    if (intel.oppFormation) {
      drawBadge(ctx, mx + 368, my + 19, 66, 22, intel.oppFormation, '#1E3A5F', '#7DD3FC');
    }
    drawButton(ctx, hits, mx + mw - 96, my + 16, 74, 30, '关闭', () => {
      this.scoutModalOpen = false;
    }, { variant: 'ghost', fontSize: 11.5, icon: 'close' });

    drawChamferPanel(ctx, mx + 24, my + 56, mw - 48, 62, 10, THEME.BG_CARD, THEME.BORDER);
    const fam = intel.familiarity;
    const famCol = fam >= 70 ? THEME.GREEN : fam >= 40 ? '#38BDF8' : '#FBBF24';
    drawText(ctx, `了解度 ${fam}%`, mx + 40, my + 75, { size: 12.5, bold: true, color: famCol, mono: true });
    drawRoundRect(ctx, mx + 128, my + 69, 170, 10, 5, '#1E293B');
    drawRoundRect(ctx, mx + 128, my + 69, Math.max(8, Math.round((fam / 100) * 170)), 10, 5, famCol);

    const ap = intel.analysisPoints ?? 2;
    const maxAp = intel.maxAnalysisPoints ?? 2;
    drawText(ctx, '录像分析点:', mx + 318, my + 75, { size: 12, bold: true, color: '#7DD3FC' });
    for (let gi = 0; gi < maxAp; gi++) {
      const lit = gi < ap;
      ctx.fillStyle = lit ? THEME.GOLD_LIGHT : '#1E293B';
      ctx.beginPath();
      ctx.arc(mx + 402 + gi * 18, my + 75, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = lit ? '#FEF08A' : '#475569';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    drawText(ctx, `${ap}/${maxAp}`, mx + 406 + maxAp * 18, my + 75, { size: 12, bold: true, color: THEME.GOLD_LIGHT, mono: true });
    drawText(ctx, `${intel.recentFormText}   |   ${intel.h2hText}`, mx + 40, my + 101, {
      size: 11.5,
      color: THEME.TX2,
    });

    drawButton(
      ctx,
      hits,
      mx + mw - 282,
      my + 71,
      244,
      32,
      intel.scoutedThisRound ? '本轮已深度侦察 ✓' : '深度侦察 (+30%了解度 · +1分析点 · 耗1整备)',
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
        fontSize: 10.5,
      }
    );

    const colY = my + 130;
    const zones = intel.zones ?? [];
    const zoneLabelShort: Record<ScoutingZoneId, string> = {
      gk_core: '门将/核心',
      defense: '防线/肋部',
      midfield: '中场轴心',
      wings: '两翼走廊',
    };

    // ==================== 左列 (w: 296)：对手微型沙盘 + 4大可点击扫描热区 ====================
    const lx = mx + 24;
    const lw = 296;
    drawText(ctx, '一、对手阵型沙盘（点击区块扫描录像）', lx, colY + 10, { size: 13.5, bold: true, color: '#38BDF8' });

    const px = lx;
    const py = colY + 26;
    const pw = lw;
    const ph = 228;
    drawRoundRect(ctx, px, py, pw, ph, 10, '#0B241A', 'rgba(74, 222, 128, 0.35)', 1.2);
    // 球场矢量网格线（垂直朝向：上=门将，下=前锋）
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 14, py + 12, pw - 28, ph - 24);
    ctx.strokeRect(px + pw * 0.25, py + 12, pw * 0.5, 42);
    ctx.beginPath();
    ctx.moveTo(px + 14, py + ph - 16);
    ctx.lineTo(px + pw - 14, py + ph - 16);
    ctx.arc(px + pw / 2, py + ph - 16, 36, Math.PI, Math.PI * 2);
    ctx.stroke();

    // 四个区域的轻量高光感应带
    const activeZ = zones.find(z => z.id === this.selectedZoneId) ?? zones.find(z => z.scanned) ?? zones[0];
    const isRevealed = !!intel.chosenCounterId;
    const slots = FORMATIONS[intel.oppFormation ?? '4-4-2'] ?? FORMATIONS['4-4-2'];
    slots.forEach(sl => {
      const zId = mapRoleToScoutZone(sl.role);
      const zObj = zones.find(z => z.id === zId);
      const dx = px + 16 + (sl.baseY / 68) * (pw - 32);
      const dy = py + 18 + Math.min(0.92, Math.max(0.06, sl.baseX / 84)) * (ph - 36);
      const weakLit = zObj && (zObj.scanned || isRevealed) && zObj.isWeakZone;
      const scannedNormal = zObj && zObj.scanned && !zObj.isWeakZone;

      if (weakLit) {
        const pulseR = 14 + Math.sin(this.animTime * 5.2) * 3;
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(dx, dy, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.selectedZoneId === zId) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(dx, dy, 13, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = weakLit ? '#EF4444' : scannedNormal ? '#38BDF8' : '#334155';
      ctx.beginPath();
      ctx.arc(dx, dy, IS_MOBILE ? 11 : 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = weakLit ? '#FDE047' : '#CBD5E1';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      drawText(ctx, sl.role.slice(0, 3), dx, dy + 0.5, { size: IS_MOBILE ? 9.5 : 7.5, rawSize: true, bold: true, color: '#FFFFFF', align: 'center' });

      if (zObj) {
        hits.addTouchTarget(dx - 19, dy - 19, 38, 38, () => {
          if (this.selectedZoneId === zId && !zObj.scanned && !isRevealed) {
            const res = league.scanOpponentZone(zId);
            if (res.msg) this.scoutNotice = res.msg;
            if (res.ok) SoundEngine.playCraftSuccess();
            else SoundEngine.playWarning();
            actions.onSave?.();
          } else {
            this.selectedZoneId = zId;
            SoundEngine.playClick();
          }
        });
      }
    });
    ctx.restore();

    // 4 个快捷区按钮 (2x2)
    zones.forEach((z, zi) => {
      const col = zi % 2;
      const row = Math.floor(zi / 2);
      const bx = lx + col * 150;
      const by = py + ph + 10 + row * 48;
      const bw = 146;
      const bh = 42;
      const isWeakFound = (z.scanned || isRevealed) && z.isWeakZone;
      const isSel = this.selectedZoneId === z.id;
      const bCol = isWeakFound ? '#EF4444' : z.scanned ? '#38BDF8' : isSel ? THEME.GOLD_LIGHT : THEME.BORDER;
      drawRoundRect(ctx, bx, by, bw, bh, 7, isWeakFound ? 'rgba(127, 29, 29, 0.45)' : z.scanned ? '#12243D' : THEME.BG_CARD, bCol, isWeakFound || isSel ? 1.5 : 1);
      drawText(ctx, z.label, bx + 10, by + 14, { size: 11, bold: true, color: isWeakFound ? '#FCA5A5' : THEME.TX1 });
      drawText(
        ctx,
        isWeakFound ? '异常：发现破绽' : z.scanned ? '已核实 · 无明显短板' : isSel && ap > 0 && !isRevealed ? '再点一次或点下方扫描' : ap > 0 && !isRevealed ? '点击预览区域' : '待扫描',
        bx + 10,
        by + 30,
        { size: 9.5, color: isWeakFound ? '#FDE047' : z.scanned ? '#7DD3FC' : isSel ? THEME.GOLD_LIGHT : THEME.TX3 }
      );
      hits.add(bx, by, bw, bh, () => {
        if (this.selectedZoneId === z.id && !z.scanned && !isRevealed) {
          const res = league.scanOpponentZone(z.id);
          if (res.msg) this.scoutNotice = res.msg;
          if (res.ok) SoundEngine.playCraftSuccess();
          else SoundEngine.playWarning();
          actions.onSave?.();
        } else {
          this.selectedZoneId = z.id;
          SoundEngine.playClick();
        }
      });
    });

    // 沙盘最下方：当前选中/扫描区域精确情报卡片
    const detailY = py + ph + 112;
    const zShow = activeZ;
    drawChamferPanel(ctx, lx, detailY, lw, 108, 9, 'rgba(15, 23, 42, 0.92)', zShow && (zShow.scanned || isRevealed) && zShow.isWeakZone ? '#EF4444' : THEME.BORDER);
    if (zShow && (zShow.scanned || isRevealed)) {
      drawBadge(
        ctx,
        lx + 12,
        detailY + 12,
        120,
        20,
        zShow.isWeakZone ? '录像锁定异常' : '录像实况记录',
        zShow.isWeakZone ? '#7F1D1D' : '#1E3A5F',
        zShow.isWeakZone ? '#FCA5A5' : '#7DD3FC'
      );
      drawText(ctx, zShow.label, lx + 140, detailY + 22, { size: 11.5, bold: true, color: THEME.GOLD_LIGHT });
      drawWrappedText(ctx, zShow.summary, lx + 12, detailY + 42, lw - 24, 18, { size: 11.5, color: THEME.TX1, maxLines: 3 });
    } else {
      const zLabel = zShow ? zShow.label : '未选择区域';
      drawText(ctx, `预览【${zLabel}】· 消耗 1 点分析点调取录像`, lx + 12, detailY + 24, { size: 12, bold: true, color: '#7DD3FC' });
      drawWrappedText(ctx, '点击上方阵型区块可先自由预览，确认目标后点击右侧按钮或再点一次该区块执行扫描。', lx + 12, detailY + 46, lw - 24, 17, { size: 10.5, color: THEME.TX2, maxLines: 2 });
      if (zShow && !zShow.scanned && !isRevealed) {
        drawButton(ctx, hits, lx + lw - 134, detailY + 68, 122, 28, '扫描此区 (-1点)', () => {
          const res = league.scanOpponentZone(zShow.id);
          if (res.msg) this.scoutNotice = res.msg;
          if (res.ok) SoundEngine.playCraftSuccess();
          else SoundEngine.playWarning();
          actions.onSave?.();
        }, { variant: 'gold', disabled: ap <= 0, fontSize: 10.5 });
      }
    }

    // ==================== 中列 (w: 374)：3 条录像线索 + 交叉核实排错 ====================
    const cx = lx + lw + 20;
    const cw = 374;
    drawText(ctx, '二、情报线索库（1 条为烟雾弹）', cx, colY + 10, { size: 13.5, bold: true, color: '#38BDF8' });

    intel.clues.forEach((cl, ci) => {
      const cy = colY + 26 + ci * 118;
      const shownSmoke = !!cl.debunked || (isRevealed && !!cl.isSmoke);
      const borderCol = shownSmoke ? THEME.RED_LIGHT : THEME.BORDER_GOLD;
      drawChamferPanel(ctx, cx, cy, cw, 108, 9, shownSmoke ? 'rgba(30, 16, 22, 0.72)' : THEME.BG_CARD, borderCol);
      const confLabel = shownSmoke
        ? '烟雾弹已证伪 ✗'
        : cl.confidence === 'high'
        ? '核实线索'
        : cl.confidence === 'mid'
        ? '常规情报'
        : '小道消息';
      const confCol = shownSmoke
        ? THEME.RED_LIGHT
        : cl.confidence === 'high'
        ? THEME.GREEN
        : cl.confidence === 'mid'
        ? '#38BDF8'
        : '#FBBF24';
      drawBadge(ctx, cx + 14, cy + 12, shownSmoke ? 112 : 86, 20, confLabel, '#0F172A', confCol);
      drawText(ctx, `线索 #${ci + 1}`, cx + (shownSmoke ? 134 : 108), cy + 22, { size: 11, color: THEME.TX3, mono: true });
      drawWrappedText(ctx, cl.text, cx + 14, cy + 40, cw - 28, 19, {
        size: 11.5,
        color: shownSmoke ? THEME.TX3 : THEME.TX1,
        maxLines: 3,
      });
    });

    const hasUndebunkedSmoke = intel.clues.some(c => c.isSmoke && !c.debunked);
    const debunkY = colY + 384;
    drawChamferPanel(ctx, cx, debunkY, cw, 92, 9, 'rgba(15, 23, 42, 0.92)', THEME.BORDER);
    drawButton(
      ctx,
      hits,
      cx + 14,
      debunkY + 12,
      cw - 28,
      36,
      !hasUndebunkedSmoke
        ? '当前无待排除的虚假烟雾弹 ✓'
        : intel.chosenCounterId
        ? '已完成破绽指证'
        : '交叉核实 · 排除 1 条烟雾弹 (耗1分析点)',
      () => {
        const res = league.debunkSmokeClue();
        if (res.msg) this.scoutNotice = res.msg;
        if (res.ok) SoundEngine.playCraftSuccess();
        else SoundEngine.playWarning();
        actions.onSave?.();
      },
      {
        variant: hasUndebunkedSmoke && !intel.chosenCounterId ? 'primary' : 'ghost',
        disabled: !hasUndebunkedSmoke || !!intel.chosenCounterId || ap <= 0,
        fontSize: 11.5,
      }
    );
    drawText(
      ctx,
      '提示：不用删错直接拍案指证抓出真破绽 → 获【宗师洞察】+1克制1阶卡！',
      cx + cw / 2,
      debunkY + 68,
      { size: 10.5, color: THEME.GOLD_LIGHT, align: 'center' }
    );

    // ==================== 右列 (w: 374)：拍案指证 & 2选1体系内红利 ====================
    const rx = cx + cw + 20;
    const rw = 374;
    drawText(
      ctx,
      isRevealed ? '三、指证裁定与体系内针对红利' : '三、拍案指证（答对锁定 2 选 1 战术红利）',
      rx,
      colY + 10,
      { size: 13.5, bold: true, color: THEME.GOLD_LIGHT }
    );

    if (!isRevealed) {
      intel.counters.forEach((cnt, idx) => {
        const cy = colY + 26 + idx * 144;
        const zoneTag = cnt.targetZone ? zoneLabelShort[cnt.targetZone] : '全区';
        drawChamferPanel(ctx, rx, cy, rw, 132, 9, THEME.BG_CARD, THEME.BORDER);
        drawBadge(ctx, rx + 14, cy + 12, 86, 20, `区:${zoneTag}`, '#1E293B', '#7DD3FC');
        const el0 = cnt.counterElements?.[0];
        const el1 = cnt.counterElements?.[1];
        if (el0) {
          const elText = el1 ? `克制:${getElementLabel(el0)}/${getElementLabel(el1)}` : `克制:${getElementLabel(el0)}`;
          drawBadge(ctx, rx + 106, cy + 12, 118, 20, elText, '#1E293B', ELEMENT_COLOR[el0] ?? THEME.GOLD_LIGHT);
        }
        drawText(ctx, fitText(ctx, cnt.label, rw - 28, 13.5, true), rx + 14, cy + 48, {
          size: 13.5,
          bold: true,
          color: THEME.GOLD_LIGHT,
        });
        drawWrappedText(ctx, `基础红利：${cnt.desc}${cnt.oppDebuff ? ` · ${cnt.oppDebuff.label}` : ''}`, rx + 14, cy + 68, rw - 28, 16, {
          size: 10.5,
          color: THEME.TX2,
          maxLines: 1,
        });
        drawButton(ctx, hits, rx + 14, cy + 90, rw - 28, 32, '拍案指证此破绽 ▶', () => {
          const res = league.chooseOpponentCounter(cnt.id);
          if (res.msg) this.scoutNotice = res.msg;
          if (res.correct) {
            this.stampAnimTimer = 1.1;
            SoundEngine.playBreakthrough();
            actions.onShake?.(7, 0.22);
            actions.onBurst?.(rx + rw / 2, colY + 120, THEME.GOLD_LIGHT);
          } else {
            SoundEngine.playWarning();
          }
          actions.onSave?.();
        }, { variant: 'gold', fontSize: 12 });
      });
    } else if (intel.spotCorrect) {
      // 指证成立展示 + 体系内红利 2 选 1
      const winCounter = intel.counters.find(c => c.isCorrect);
      const isMaster = intel.mastery === 'master';
      const stampP = this.stampAnimTimer > 0 ? easeOutBack(Math.min(1, (1.1 - this.stampAnimTimer) / 0.28)) : 1;

      ctx.save();
      drawChamferPanel(ctx, rx, colY + 26, rw, 106, 10, isMaster ? 'rgba(120, 53, 15, 0.36)' : 'rgba(20, 83, 45, 0.30)', isMaster ? THEME.GOLD_LIGHT : THEME.GREEN, 1.8);
      if (isMaster) drawFoilShimmer(ctx, rx, colY + 26, rw, 106, this.animTime * 0.9, 'rgba(250, 204, 21, 0.25)');
      const badgeW = isMaster ? 228 : 148;
      ctx.save();
      ctx.translate(rx + 14 + badgeW / 2, colY + 48);
      ctx.scale(0.85 + 0.15 * stampP, 0.85 + 0.15 * stampP);
      drawBadge(
        ctx,
        -badgeW / 2,
        -11,
        badgeW,
        22,
        isMaster ? '★ 宗师洞察 · 额外赠克制1阶卡 +1' : '✓ 破绽指证成立',
        isMaster ? '#78350F' : '#14532D',
        isMaster ? THEME.GOLD_LIGHT : THEME.GREEN
      );
      ctx.restore();
      drawText(ctx, winCounter?.label ?? '真实破绽已锁定', rx + 14, colY + 76, { size: 13.5, bold: true, color: THEME.TX1 });
      drawWrappedText(ctx, winCounter?.buff.note ?? '', rx + 14, colY + 96, rw - 28, 16, { size: 10.5, color: '#7DD3FC', maxLines: 2 });
      ctx.restore();

      const loadoutCards = league.getActiveMatchDeck();
      const counterEls = new Set(intel.counterElements ?? []);
      const matchedCards = loadoutCards.filter(c => {
        const mainEl = inferCardElement(c);
        const parts = (c.recipeKey ?? '').split('+');
        return counterEls.has(mainEl) || parts.some(p => counterEls.has(p as any));
      });

      const eqSkills = league.getEquippedActiveSkills();
      const counterStyles = new Set(intel.counterStyles ?? []);
      const matchedSkills = eqSkills.filter(s => s.styleTag && counterStyles.has(s.styleTag));
      const targetSkills = matchedSkills.length > 0 ? matchedSkills : eqSkills.slice(0, 1);

      const pickBonus = (kind: ScoutRewardKind) => {
        const res = league.chooseScoutReward(kind);
        if (res.msg) this.scoutNotice = res.msg;
        if (res.ok) {
          SoundEngine.playFanfare();
          actions.onBurst?.(rx + rw / 2, colY + 300, THEME.GOLD_LIGHT);
        }
        actions.onSave?.();
      };

      const renderRewardChoiceCard = (
        kind: ScoutRewardKind,
        topY: number,
        badgeTxt: string,
        titleTxt: string,
        bodyTxt: string,
        subTxt: string,
        accent: string
      ) => {
        const isChosen = intel.chosenRewardKind === kind;
        const lockedOther = !!intel.chosenRewardKind && !isChosen;
        drawChamferPanel(
          ctx,
          rx,
          topY,
          rw,
          158,
          10,
          isChosen ? 'rgba(20, 83, 45, 0.32)' : THEME.BG_CARD,
          isChosen ? THEME.GREEN : lockedOther ? THEME.BORDER : accent,
          isChosen ? 1.8 : 1.2
        );
        drawBadge(ctx, rx + 14, topY + 12, 138, 20, badgeTxt, '#1E293B', accent);
        if (isChosen) drawBadge(ctx, rx + rw - 110, topY + 12, 96, 20, '已锁定生效 ✓', '#14532D', THEME.GREEN);
        drawText(ctx, titleTxt, rx + 14, topY + 46, { size: 13.5, bold: true, color: THEME.TX1 });
        drawWrappedText(ctx, bodyTxt, rx + 14, topY + 66, rw - 28, 16, { size: 11, color: '#CBD5E1', maxLines: 2 });
        drawText(ctx, fitText(ctx, subTxt, rw - 28, 10.5), rx + 14, topY + 102, { size: 10.5, color: accent });
        if (!intel.chosenRewardKind) {
          drawButton(ctx, hits, rx + 14, topY + 116, rw - 28, 32, `锁定此针对红利 ▶`, () => pickBonus(kind), {
            variant: 'gold',
            fontSize: 11.5,
          });
        }
      };

      const elNames = (intel.counterElements ?? []).map(e => getElementLabel(e)).join('/');
      const cardMatchNote = matchedCards.length > 0
        ? `当前出战卡组命中 ${matchedCards.length} 张：${matchedCards.slice(0, 3).map(c => c.name).join('、')}`
        : `当前出战卡组(${loadoutCards.length}张)暂无【${elNames}】卡（锁定后仍可去战术页装配）`;
      renderRewardChoiceCard(
        'buff_debuff',
        colY + 146,
        `手牌基因(${elNames}) + 减益`,
        '红利 A · 手牌降费超频 + 对手弱点减益',
        `含【${elNames}】基因的出战 Buff 卡本场 -1 费且持续 +5 分；${intel.activeDebuff?.label ?? '大幅削弱对手弱点线'}。`,
        cardMatchNote,
        '#38BDF8'
      );

      const skillMatchNote = targetSkills.length > 0
        ? `将超频主动技：${targetSkills.map(s => (s.effectiveRank ?? 1) >= 5 ? `${s.name}(满阶R5·首触发免CD)` : `${s.name}(R${s.effectiveRank ?? 1}→R${(s.effectiveRank ?? 1) + 1})`).join('、')}`
        : '当前尚未装备主动技（前往天赋星图装配后即可生效）';
      renderRewardChoiceCard(
        'skill_overclock',
        colY + 318,
        '技能体系超频',
        '红利 B · 克制主动技超频觉醒',
        '匹配的星图主动技本场获得【临时 +1 Rank】且【首次触发免冷却】，更快打出改写战局的决定技！',
        skillMatchNote,
        THEME.GOLD_LIGHT
      );
    } else {
      // 指证误判展示
      intel.counters.forEach((cnt, idx) => {
        const cy = colY + 26 + idx * 144;
        const isChosen = intel.chosenCounterId === cnt.id;
        drawChamferPanel(ctx, rx, cy, rw, 132, 9, isChosen ? '#2A181F' : THEME.BG_CARD, cnt.isCorrect ? THEME.GREEN : isChosen ? THEME.RED_LIGHT : THEME.BORDER);
        drawText(ctx, cnt.label, rx + 14, cy + 28, { size: 13.5, bold: true, color: cnt.isCorrect ? THEME.GOLD_LIGHT : THEME.TX2 });
        drawWrappedText(ctx, cnt.desc, rx + 14, cy + 54, rw - 28, 17, { size: 11, color: THEME.TX3, maxLines: 2 });
        drawBadge(
          ctx,
          rx + 14,
          cy + 92,
          114,
          24,
          isChosen ? '误判烟雾弹 ✗' : cnt.isCorrect ? '真实破绽' : '干扰项',
          '#0F172A',
          cnt.isCorrect ? THEME.GREEN : isChosen ? THEME.RED_LIGHT : THEME.TX3
        );
      });
    }

    const footerMsg =
      this.scoutNotice ||
      (intel.chosenCounterId
        ? intel.spotCorrect
          ? intel.chosenRewardKind
            ? '赛前侦查与针对部署已全部就绪，祝本轮凯旋！'
            : '异议成立！请在右栏【手牌+减益】与【主动技超频】中 2 选 1 锁定本场红利'
          : '本场未能识破烟雾弹，仍可按常规战术正常出战'
        : '操作：点击左侧沙盘扫描区（-1分析点）对比中栏线索，即可无误指证右栏真实破绽');
    drawText(ctx, footerMsg, mx + 24, my + mh - 24, {
      size: 11.5,
      bold: true,
      color: intel.spotCorrect ? THEME.GREEN : '#7DD3FC',
    });
  }
}
