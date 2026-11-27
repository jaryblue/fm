/**
 * 页面 2：发行级 Portal 备战门户
 * 架构与视觉升级：
 * - 全局背景铺入 `bg_portal` 暗色演播室氛围图，去外层套娃重边框，强化卡片本身材质与光效
 * - 左栏 (x: 96, w: 560)：焦点对阵海报 + 呼吸光主 CTA + 球探情报 + 紧凑轻训练 + 更衣室沟通/复盘
 * - 右栏 (x: 672, w: 592)：F1–F4 主动绝技（带切入图底纹+箔金扫光）+ V6 四赛段指令（实体卡面插画 `cmd_*`）
 *   + 底部阵型预案 `[1..4]` 与紧凑低频入口（联赛排名 + 赛季词条弹窗）
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import { getElementLabel, inferCardElement } from '../../../core/src/CommandCards';
import { WEATHER_INFO } from '../../../core/src/Chronicles';
import { computePerkSynergies } from '../../../core/src/PlayerPool';
import { OpponentMatchupIntel, PrepTrainingKind, ScoutingZoneId, ScoutRewardKind } from '../../../core/src/types';
import { FORMATIONS } from '../../../engine/src/formations';
import { TacticalStyle, TACTICAL_PRESETS } from '../../../engine/src/types';
import { ArtAssetId, AssetLoader } from '../AssetLoader';
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

const STYLE_ICON_ASSET: Record<TacticalStyle, ArtAssetId> = {
  tiki_taka: 'icon_style_tiki',
  gegenpress: 'icon_style_press',
  wing_play: 'icon_style_wing',
  counter: 'icon_style_counter',
  park_bus: 'icon_style_bus',
  balanced: 'icon_style_balanced',
};

function getDirectiveArtAsset(style?: TacticalStyle, zone?: string, tendency?: string): ArtAssetId {
  if (style === 'tiki_taka') return 'cmd_tiki_taka';
  if (style === 'gegenpress') return 'cmd_gegenpress';
  if (style === 'wing_play') return 'cmd_wing_play';
  if (style === 'counter') return 'cmd_blitz';
  if (style === 'park_bus') return 'cmd_iron_wall';
  if (zone === 'DEF' || tendency === 'DEF') return 'cmd_iron_wall';
  if (zone === 'ATT') return 'cmd_long_shot';
  return 'cmd_tiki_taka';
}

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

function drawCroppedArt(
  ctx: CanvasRenderingContext2D,
  assetId: ArtAssetId,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  alpha = 0.28
): void {
  const img = AssetLoader.get(assetId);
  if (!img || typeof ctx.drawImage !== 'function') return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, radius);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x + 1, y + 1, w - 2, h - 2);
  const scrim = ctx.createLinearGradient(x, y, x, y + h);
  scrim.addColorStop(0, 'rgba(10, 15, 26, 0.25)');
  scrim.addColorStop(1, 'rgba(10, 15, 26, 0.92)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = scrim;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

export class PortalScreen {
  private prepToast = '';
  private scoutModalOpen = false;
  private perksModalOpen = false;
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
    if (this.perksModalOpen) {
      this.perksModalOpen = false;
      return true;
    }
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

    // 全局暗色演播室背景图铺底（提升整体质感）
    const portalBg = AssetLoader.get('bg_portal');
    if (portalBg && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.drawImage(portalBg, 0, 0, THEME.W, THEME.H);
      const grad = ctx.createLinearGradient(0, 64, 0, THEME.H);
      grad.addColorStop(0, 'rgba(7, 10, 16, 0.72)');
      grad.addColorStop(1, 'rgba(7, 10, 16, 0.94)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, THEME.W, THEME.H);
      ctx.restore();
    }

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

    const pulse01 = 0.5 + 0.5 * Math.sin(this.animTime * 3.0);

    // ==================== 左栏 (x: 96, w: 560)：焦点战主视觉 + 赛前整备与更衣室 ====================
    const LX = 96;
    const LW = 560;
    const prep = isSummerWindow ? undefined : league.getInterMatchPrep();

    // 左上：焦点战海报卡 / 季前夏窗引援引导卡 (h: 294)
    drawChamferPanel(ctx, LX, 80, LW, 294, 12, 'rgba(13, 19, 30, 0.86)', 'rgba(255,255,255,0.08)', 1);

    if (isSummerWindow) {
      const squadCount = club.squad.length;
      const needCount = Math.max(0, 26 - squadCount);
      const ready = squadCount >= 26;

      drawText(ctx, 'PRE-SEASON · 夏季转会窗', LX + 18, 98, {
        size: 11.5,
        bold: true,
        color: THEME.GOLD,
        mono: true,
      });
      drawText(ctx, `大名单 ${squadCount}/26 · 资金 ${league.getClubFunds()} 万`, LX + LW - 18, 98, {
        size: 11.5,
        color: ready ? THEME.GREEN : '#38BDF8',
        align: 'right',
      });

      // 注册进度条（无重边框，靠底色与进度条区分）
      drawRoundRect(ctx, LX + 16, 114, LW - 32, 48, 8, 'rgba(22, 30, 46, 0.90)', ready ? 'rgba(74, 222, 128, 0.45)' : 'rgba(255,255,255,0.06)', 1);
      drawText(ctx, `足协注册：${squadCount} / 26 人`, LX + 32, 130, {
        size: 13.5,
        bold: true,
        color: THEME.TX1,
      });
      drawBadge(
        ctx,
        LX + LW - 148,
        120,
        118,
        20,
        ready ? '名额已满 · 待盖章' : `还差 ${needCount} 人`,
        ready ? '#14532D' : '#78350F',
        ready ? THEME.GREEN : THEME.GOLD_LIGHT
      );
      drawRoundRect(ctx, LX + 32, 146, LW - 64, 7, 3.5, '#1E293B');
      drawRoundRect(
        ctx,
        LX + 32,
        146,
        Math.max(12, Math.round(Math.min(1, squadCount / 26) * (LW - 64))),
        7,
        3.5,
        ready ? THEME.GREEN : THEME.GOLD_LIGHT
      );

      // 三大引援部门卡（叠放卡包/战术包插画 + 精简短语）
      const channels: Array<{ title: string; sub: string; art: ArtAssetId; color: string }> = [
        { title: '青训学院', sub: '0 万免签提拔', art: 'pack_recruit', color: THEME.GREEN },
        { title: '转会市场', sub: '签即战力 · 出售冗余', art: 'pack_tactics', color: '#38BDF8' },
        { title: '神秘经纪人', sub: '高风险盲盒抽巨星', art: 'pack_perk', color: '#C084FC' },
      ];
      const chW = 168;
      const chGap = 12;
      channels.forEach((ch, ci) => {
        const cx = LX + 16 + ci * (chW + chGap);
        const chHov = hits.isHovered(cx, 172, chW, 126);
        drawRoundRect(
          ctx,
          cx,
          172,
          chW,
          126,
          8,
          chHov ? THEME.BG_CARD_HOVER : THEME.BG_CARD,
          chHov ? ch.color : 'rgba(255,255,255,0.08)',
          chHov ? 1.5 : 1
        );
        drawCroppedArt(ctx, ch.art, cx, 172, chW, 126, 8, chHov ? 0.36 : 0.24);
        ctx.fillStyle = ch.color;
        ctx.fillRect(cx + 12, 173, chW - 24, 2.5);
        drawText(ctx, ch.title, cx + 14, 198, { size: 14, bold: true, color: ch.color });
        drawText(ctx, ch.sub, cx + 14, 222, { size: 11.5, bold: true, color: THEME.TX1 });
        drawBadge(ctx, cx + 14, 266, 70, 22, '进入 ›', 'rgba(15, 23, 42, 0.85)', chHov ? '#FFFFFF' : ch.color);
        hits.add(cx, 172, chW, 126, () => {
          SoundEngine.playClick();
          actions.onNavigate('transfer_hub');
        });
      });

      // 主 CTA 呼吸金色外框
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${(0.22 + 0.32 * pulse01).toFixed(2)})`;
      ctx.lineWidth = 2;
      if (ready) {
        ctx.strokeRect(LX + 14, 306, LW - 28, 52);
        drawButton(ctx, hits, LX + 16, 308, LW - 32, 48, '✓ 足协盖章注册 · 新赛季开哨 ▶', () => {
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
        ctx.strokeRect(LX + 248, 306, 298, 52);
        drawButton(ctx, hits, LX + 16, 310, 224, 46, `一键青训补齐 (${squadCount}/26)`, () => {
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
        drawButton(ctx, hits, LX + 250, 308, 294, 48, '补齐青训并盖章开赛 ▶', () => {
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
      ctx.restore();
    } else {
      drawText(ctx, `NEXT FIXTURE · 第 ${st.currentRound}/${totalRounds} 轮`, LX + 18, 98, {
        size: 11.5,
        bold: true,
        color: THEME.GOLD,
        mono: true,
      });
      drawText(ctx, `${tierInfo.name} · 暂列第 ${userRankIdx + 1} 名`, LX + LW - 18, 98, {
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

      // 焦点对阵海报舞台（整卡可点击开赛）
      const stageX = LX + 16, stageY = 116, stageW = LW - 32, stageH = 122;
      const stageHover = hits.isHovered(stageX, stageY, stageW, stageH);
      drawChamferPanel(
        ctx,
        stageX,
        stageY,
        stageW,
        stageH,
        10,
        THEME.BG_CARD,
        stageHover ? THEME.GOLD_LIGHT : 'rgba(250, 204, 21, 0.22)',
        stageHover ? 1.8 : 1.0
      );
      drawCroppedArt(ctx, 'fixture_vs_bg', stageX, stageY, stageW, stageH, 10, 0.78);

      const drawCrestGlow = (cx: number, cy: number, col: string) => {
        ctx.save();
        ctx.globalAlpha = 0.28 + 0.10 * pulse01;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 52);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      const homeCx = stageX + 106;
      const awayCx = stageX + stageW - 106;
      const midCx = stageX + stageW / 2;

      drawCrestGlow(homeCx, 154, home.primaryColor);
      drawCrestGlow(awayCx, 154, away.primaryColor);

      drawClubCrest(ctx, homeCx, 154, 28, home);
      drawText(ctx, fitText(ctx, home.name, 168, 15.5, true), homeCx, 196, {
        size: 15.5,
        bold: true,
        align: 'center',
        color: home.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      drawText(ctx, `#${homeRankIdx + 1} · ${homeRow?.points ?? 0}分 · ${home.formation}`, homeCx, 216, {
        size: 11,
        align: 'center',
        color: THEME.TX2,
      });

      ctx.save();
      ctx.shadowColor = `rgba(250, 204, 21, ${(0.35 + 0.40 * pulse01).toFixed(2)})`;
      ctx.shadowBlur = 14;
      drawText(ctx, 'VS', midCx, 160, { size: 28, bold: true, italic: true, align: 'center', color: THEME.GOLD_LIGHT });
      ctx.restore();
      drawBadge(
        ctx,
        midCx - 36,
        186,
        72,
        18,
        home.isUser ? '我方主场' : '我方客场',
        'rgba(15, 23, 42, 0.90)',
        home.isUser ? THEME.GOLD_LIGHT : '#7DD3FC'
      );

      drawClubCrest(ctx, awayCx, 154, 28, away);
      drawText(ctx, fitText(ctx, away.name, 168, 15.5, true), awayCx, 196, {
        size: 15.5,
        bold: true,
        align: 'center',
        color: away.isUser ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      drawText(ctx, `#${awayRankIdx + 1} · ${awayRow?.points ?? 0}分 · ${away.formation}`, awayCx, 216, {
        size: 11,
        align: 'center',
        color: THEME.TX2,
      });
      drawBadge(
        ctx,
        midCx - 55,
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

      // 球探情报简报条（精简信息、突出动作）
      const oppClub = home.isUser ? away : home;
      const brief = league.getOpponentBriefing(oppClub.id);
      const intel = prep?.matchupIntel;
      drawRoundRect(ctx, LX + 16, 246, LW - 32, 52, 8, 'rgba(22, 30, 46, 0.82)', 'rgba(255,255,255,0.06)');
      const famText = intel ? `了解 ${intel.familiarity}%` : '球探';
      const famColor = intel && intel.familiarity >= 70 ? THEME.GREEN : '#38BDF8';
      drawBadge(ctx, LX + 26, 253, 76, 18, famText, '#1E3A5F', famColor);
      const ecoSuffix = [brief.isRival ? '宿敌' : null, brief.ecoTag ?? null, brief.formerPlayerName ? `旧将:${brief.formerPlayerName.split('(')[0]}` : null].filter(Boolean).join(' · ');
      drawText(ctx, fitText(ctx, `${brief.styleName} · ${brief.weakLineLabel}${ecoSuffix ? ` · ${ecoSuffix}` : ''}`, 290, 11.5, true), LX + 110, 262, {
        size: 11.5,
        bold: true,
        color: brief.isRival || brief.formerPlayerName ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      const subTip = intel?.chosenCounterId
        ? intel.spotCorrect
          ? intel.chosenRewardKind === 'skill_overclock'
            ? '红利锁定：克制主动技 +1 Rank · 首触发免CD'
            : intel.chosenRewardKind === 'buff_debuff'
            ? `红利锁定：克制牌 -1费+5分 · ${intel.activeDebuff?.label || '弱点减益'}`
            : '破绽成立！点右侧锁定 2 选 1 针对红利'
          : '已指证（误判烟雾弹，常规应战）'
        : brief.counterTip;
      drawText(ctx, fitText(ctx, subTip, 376, 11.5), LX + 26, 282, {
        size: 11.5,
        color: intel?.spotCorrect ? THEME.GREEN : THEME.GOLD_LIGHT,
      });
      if (intel) {
        const needsRewardPick = !!intel.spotCorrect && !intel.chosenRewardKind;
        const btnLabel = !intel.chosenCounterId
          ? '侦察抓破绽'
          : needsRewardPick
          ? '选针对红利'
          : '战术录像室';
        drawButton(ctx, hits, LX + LW - 148, 254, 122, 36, btnLabel, () => {
          this.scoutNotice = '';
          this.selectedZoneId = null;
          this.scoutModalOpen = true;
        }, { variant: needsRewardPick ? 'gold' : intel.chosenCounterId ? 'ghost' : 'primary', fontSize: 11.5 });
      }

      // 主开哨按钮带轻微呼吸光晕
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${(0.22 + 0.34 * pulse01).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(LX + 14, 306, 430, 52);
      ctx.restore();
      drawButton(ctx, hits, LX + 16, 308, 426, 48, '▶ 吹响开场哨 · 亲自指挥本场对决', actions.onStartMatch, {
        variant: 'gold',
        fontSize: 14.5,
      });
      drawButton(ctx, hits, LX + 452, 312, 92, 40, '⏩ 快进', () => {
        actions.onQuickSim?.();
      }, {
        variant: 'ghost',
        fontSize: 12,
      });
    }

    // 左下：天气预报 + 赛前轻训练 + 动态更衣室 (h: 318)
    drawChamferPanel(ctx, LX, 386, LW, 318, 12, 'rgba(13, 19, 30, 0.86)', 'rgba(255,255,255,0.08)', 1);
    if (isSummerWindow) {
      const gkCnt = club.squad.filter(p => p.role === 'GK').length;
      const defCnt = club.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)).length;
      const midCnt = club.squad.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role)).length;
      const fwdCnt = club.squad.filter(p => ['LW', 'RW', 'ST'].includes(p.role)).length;
      const avgOvr = club.squad.length > 0
        ? Math.round(club.squad.reduce((acc, p) => acc + p.ca, 0) / club.squad.length)
        : 0;

      drawBadge(ctx, LX + 16, 400, 100, 22, '季前阵容概览', '#0F172A', THEME.GOLD_LIGHT);
      drawText(ctx, `均评 ${avgOvr} · ${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, LX + 126, 411, {
        size: 12,
        color: THEME.TX2,
      });

      const posBoxes = [
        { label: '门将 GK', val: `${gkCnt}`, col: '#FBBF24' },
        { label: '后卫 DEF', val: `${defCnt}`, col: '#38BDF8' },
        { label: '中场 MID', val: `${midCnt}`, col: THEME.GREEN },
        { label: '前锋 FWD', val: `${fwdCnt}`, col: '#F87171' },
      ];
      posBoxes.forEach((pb, idx) => {
        const bx = LX + 16 + idx * 134;
        drawRoundRect(ctx, bx, 434, 126, 62, 8, 'rgba(22, 30, 46, 0.86)', 'rgba(255,255,255,0.06)');
        drawText(ctx, pb.label, bx + 63, 452, { size: 11, color: THEME.TX2, align: 'center' });
        drawText(ctx, `${pb.val} 人`, bx + 63, 476, { size: 16, bold: true, color: pb.col, align: 'center', mono: true });
      });

      // 助教导师提示卡（带立绘 portrait_mentor，去长段说明书）
      drawRoundRect(ctx, LX + 16, 510, LW - 32, 178, 10, 'rgba(22, 30, 46, 0.82)', 'rgba(250, 204, 21, 0.18)');
      const mentorImg = AssetLoader.get('portrait_mentor');
      if (mentorImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(LX + 28, 524, 96, 150, 8);
        ctx.clip();
        ctx.drawImage(mentorImg, LX + 28, 524, 96, 150);
        ctx.restore();
        drawRoundRect(ctx, LX + 28, 524, 96, 150, 8, undefined, 'rgba(250, 204, 21, 0.32)', 1);
      }
      const guideX = mentorImg ? LX + 140 : LX + 34;
      drawText(ctx, '助教备忘 · 启程清单', guideX, 536, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
      const steps = [
        { ok: true, txt: '已完成 3 轮核心开包，基石球员入队' },
        { ok: club.squad.length >= 26, txt: `补齐 26 人大名单（当前 ${club.squad.length}/26）` },
        { ok: false, txt: '点击上方「盖章开赛」正式踏上征程' },
      ];
      steps.forEach((stItem, si) => {
        const sy = 568 + si * 34;
        drawBadge(ctx, guideX, sy - 9, 22, 18, stItem.ok ? '✓' : `${si + 1}`, stItem.ok ? '#14532D' : '#1E293B', stItem.ok ? THEME.GREEN : '#7DD3FC');
        drawText(ctx, stItem.txt, guideX + 30, sy, {
          size: 12.5,
          color: stItem.ok ? THEME.GREEN : THEME.TX1,
        });
      });
    } else if (prep) {
      const wInfo = WEATHER_INFO[prep.weather];
      drawBadge(ctx, LX + 16, 400, 84, 22, wInfo.label, '#0F172A', wInfo.color);
      drawText(ctx, fitText(ctx, wInfo.tip, 320, 12), LX + 110, 411, { size: 12, color: THEME.TX2 });
      drawText(ctx, `整备 ${prep.actionsLeft}/1`, LX + LW - 18, 411, {
        size: 12,
        bold: true,
        align: 'right',
        color: prep.actionsLeft > 0 ? THEME.GREEN : THEME.TX3,
        mono: true,
      });

      const trainBtns: Array<{ kind: PrepTrainingKind; label: string; icon: 'stat_fit' | 'shield' | 'sparkle' | 'sword' }> = [
        { kind: 'physio', label: '理疗 +14%', icon: 'stat_fit' },
        { kind: 'tactical', label: '传防 +2', icon: 'shield' },
        { kind: 'mentor', label: '青训 +1', icon: 'sparkle' },
        { kind: 'sharp', label: '射门 +2', icon: 'sword' },
      ];
      trainBtns.forEach((tb, bi) => {
        const bx = LX + 16 + bi * 134;
        const done = prep.doneTraining === tb.kind;
        drawButton(ctx, hits, bx, 434, 126, 38, tb.label, () => {
          const res = league.applyPrepTraining(tb.kind);
          if (res.msg) this.prepToast = res.msg;
          if (res.ok) SoundEngine.playCraftSuccess();
          else SoundEngine.playWarning();
          actions.onSave?.();
        }, {
          variant: done ? 'green' : 'ghost',
          disabled: prep.actionsLeft <= 0 && !done,
          fontSize: 12,
          icon: tb.icon,
        });
      });

      const talk = prep.playerTalk;
      if (talk) {
        drawRoundRect(ctx, LX + 16, 486, LW - 32, 204, 10, 'rgba(22, 30, 46, 0.88)', talk.resolved ? THEME.GREEN : 'rgba(250, 204, 21, 0.35)');
        const coachImg = AssetLoader.get('portrait_linfeng');
        if (coachImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(LX + 28, 498, 52, 64, 6);
          ctx.clip();
          ctx.drawImage(coachImg, LX + 28, 498, 52, 64);
          ctx.restore();
        }
        const txLeft = coachImg ? LX + 92 : LX + 30;
        drawBadge(ctx, txLeft, 500, 46, 20, talk.role, '#1E3A5F', THEME.TX1);
        drawText(ctx, `${talk.playerName} · 赛前沟通`, txLeft + 54, 510, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
        if (talk.resolved) {
          drawText(ctx, `已回应：${talk.chosenLabel}`, txLeft, 546, { size: 13, bold: true, color: THEME.GREEN });
          drawWrappedText(
            ctx,
            this.prepToast || '球员士气已稳住，专注迎接本轮较量',
            LX + 30,
            584,
            LW - 60,
            20,
            { size: 12, color: THEME.TX2, maxLines: 3 }
          );
        } else {
          drawWrappedText(ctx, talk.prompt, LX + 30, 568, LW - 60, 20, { size: 12.5, color: THEME.TX1, maxLines: 2 });
          drawButton(ctx, hits, LX + 30, 632, 242, 42, talk.optA.label, () => {
            const res = league.resolvePlayerTalk('A');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'primary', fontSize: 12 });
          drawButton(ctx, hits, LX + 284, 632, 242, 42, talk.optB.label, () => {
            const res = league.resolvePlayerTalk('B');
            if (res.msg) this.prepToast = res.msg;
            if (res.ok) SoundEngine.playRewardChime();
            actions.onSave?.();
          }, { variant: 'ghost', fontSize: 12 });
        }
      } else {
        const strainList = club.squad.filter(p => p.strainWarning || (p.injuredRounds ?? 0) > 0 || (p.suspendedRounds ?? 0) > 0);
        drawRoundRect(ctx, LX + 16, 486, LW - 32, 114, 9, 'rgba(22, 30, 46, 0.84)', 'rgba(255,255,255,0.06)');
        drawIcon(ctx, 'bolt', LX + 32, 506, 13, '#38BDF8');
        drawText(ctx, '上轮战况复盘与备忘', LX + 46, 506, { size: 12.5, bold: true, color: '#38BDF8' });
        const reviewMsg = this.prepToast || prep.nextMatchBuff?.note || st.lastMatchReview || '首轮开赛后将生成上轮战术复盘与 xG 诊断';
        drawWrappedText(ctx, reviewMsg, LX + 30, 528, LW - 60, 20, {
          size: 12,
          color: this.prepToast || prep.nextMatchBuff?.note ? THEME.GREEN : THEME.TX1,
          maxLines: 3,
        });

        drawRoundRect(ctx, LX + 16, 610, LW - 32, 80, 9, 'rgba(22, 30, 46, 0.84)', strainList.length > 0 ? 'rgba(251, 191, 36, 0.40)' : 'rgba(255,255,255,0.06)');
        drawText(ctx, '队医与体能状态', LX + 30, 628, {
          size: 12,
          bold: true,
          color: strainList.length > 0 ? '#FBBF24' : THEME.GREEN,
        });
        drawWrappedText(
          ctx,
          strainList.length > 0
            ? `预警：${strainList.slice(0, 3).map(p => `${p.name}(${(p.injuredRounds ?? 0) > 0 ? '伤停' : (p.suspendedRounds ?? 0) > 0 ? '停赛' : '疲惫'})`).join('、')} · 建议轮换`
            : '全队健康度良好，无伤停或体能预警',
          LX + 30,
          650,
          LW - 60,
          19,
          { size: 12, color: strainList.length > 0 ? '#FDE68A' : THEME.TX2, maxLines: 2 }
        );
      }
    }

    // ==================== 右栏 (x: 672, w: 592)：出战武器库（去外框重线 + 实体卡面图片 + 扫光） ====================
    const RX = 672;
    const RW = 592;
    const eqSkills = league.getEquippedActiveSkills();
    const presets = league.getTacticalPresets();
    const curPresetIdx = presets.findIndex(pr => pr && club.formation === pr.formation && club.style === pr.style);
    const rogue = league.getV6SeasonRogue();
    const v6Cfg = league.getV6MatchRuntimeConfig();
    const s1Cards = league.getV6CheckpointDirectives('s1');

    // 右上 (y: 80, h: 194)：F1–F4 主动绝技 2×2 宽卡 + 圣物槽
    drawChamferPanel(ctx, RX, 80, RW, 194, 12, 'rgba(13, 19, 30, 0.78)', 'rgba(255,255,255,0.06)', 1);
    drawIcon(ctx, 'bolt', RX + 20, 100, 13, '#38BDF8');
    drawText(ctx, `F1–F4 临场主动绝技 (${eqSkills.length}/4)`, RX + 32, 100, { size: 13.5, bold: true, color: '#38BDF8' });
    const hovMetaTop = hits.isHovered(RX + RW - 120, 86, 106, 26);
    drawText(ctx, '星盘配装 ›', RX + RW - 16, 100, {
      size: 12,
      bold: true,
      color: hovMetaTop ? '#FFFFFF' : '#7DD3FC',
      align: 'right',
    });
    hits.add(RX + RW - 120, 86, 106, 26, () => actions.onNavigate('meta'));

    const skW = 274;
    const skH = 54;
    for (let si = 0; si < 4; si++) {
      const col = si % 2;
      const row = Math.floor(si / 2);
      const sx = RX + 16 + col * (skW + 12);
      const sy = 118 + row * 60;
      const sk = eqSkills[si];
      if (sk) {
        const gKind: SkillGlyphKind = sk.styleTag ? (STYLE_GLYPH[sk.styleTag] ?? 'master') : 'master';
        const hovSk = hits.isHovered(sx, sy, skW, skH);
        const rk = sk.effectiveRank ?? sk.rank ?? 1;
        const cutinId: ArtAssetId = sk.vfxTheme === 'att' ? 'fx_skill_cutin_att' : sk.vfxTheme === 'def' ? 'fx_skill_cutin_def' : 'fx_skill_cutin_ult';
        drawRoundRect(
          ctx,
          sx,
          sy,
          skW,
          skH,
          8,
          hovSk ? 'rgba(18, 54, 86, 0.94)' : 'rgba(12, 34, 58, 0.88)',
          hovSk ? '#7DD3FC' : rk >= 3 ? 'rgba(250, 204, 21, 0.55)' : 'rgba(56, 189, 248, 0.42)',
          hovSk ? 1.5 : 1
        );
        drawCroppedArt(ctx, cutinId, sx, sy, skW, skH, 8, hovSk ? 0.38 : 0.24);
        if (rk >= 2 || hovSk) {
          drawFoilShimmer(ctx, sx, sy, skW, skH, this.animTime * 0.65 + si * 0.4, 'rgba(56, 189, 248, 0.16)');
        }
        drawSkillGlyph(ctx, gKind, sx + 22, sy + 27, 24, '#38BDF8', THEME.GOLD_LIGHT);
        drawBadge(ctx, sx + 42, sy + 7, 24, 16, `F${si + 1}`, '#0F172A', '#7DD3FC');
        drawText(ctx, fitText(ctx, sk.name, 134, 13, true), sx + 72, sy + 15, { size: 13, bold: true, color: THEME.TX1 });
        drawBadge(ctx, sx + skW - 84, sy + 7, 28, 16, `R${rk}`, '#1E293B', THEME.GOLD_LIGHT);
        drawText(ctx, `${sk.cooldownMinutes}m`, sx + skW - 10, sy + 15, {
          size: 10.5,
          bold: true,
          color: THEME.TX2,
          align: 'right',
          mono: true,
        });
        const effLine = sk.instantLabel || sk.powerLabel || sk.situationLabel;
        drawText(ctx, fitText(ctx, effLine, skW - 52, 11), sx + 42, sy + 37, { size: 11, color: '#CBD5E1' });
        hits.add(sx, sy, skW, skH, () => actions.onNavigate('meta'));
      } else {
        ctx.save();
        ctx.setLineDash([4, 3]);
        drawRoundRect(
          ctx,
          sx,
          sy,
          skW,
          skH,
          8,
          'rgba(15, 23, 42, 0.50)',
          `rgba(148, 163, 184, ${(0.20 + 0.18 * pulse01).toFixed(2)})`,
          1
        );
        ctx.restore();
        drawText(ctx, `F${si + 1} 空槽 · 点击装配绝技`, sx + skW / 2, sy + 27, {
          size: 11.5,
          color: THEME.TX3,
          align: 'center',
        });
        hits.add(sx, sy, skW, skH, () => actions.onNavigate('meta'));
      }
    }

    drawText(ctx, `赛季圣物 (${rogue.seasonRelics.length}/5)`, RX + 18, 254, { size: 11.5, bold: true, color: '#E9D5FF' });
    for (let ri = 0; ri < 5; ri++) {
      const lit = ri < rogue.seasonRelics.length;
      drawRoundRect(ctx, RX + 122 + ri * 18, 248, 12, 12, 3, lit ? '#C084FC' : 'rgba(148, 163, 184, 0.22)');
    }
    drawText(
      ctx,
      rogue.seasonRelics.length > 0 ? '已在星盘激活赛季圣物协同' : '连胜与里程碑事件中解锁',
      RX + RW - 18,
      254,
      { size: 11, color: THEME.TX3, align: 'right' }
    );

    // 右中 (y: 284, h: 218)：V6 四赛段出战指令 4 张实体卡牌（带 cmd_* 插画 + 扫光）
    const v6DeckWarn = s1Cards.length < 4;
    const deckAccent = v6DeckWarn ? '#F59E0B' : '#C084FC';
    drawChamferPanel(ctx, RX, 284, RW, 218, 12, 'rgba(13, 19, 30, 0.78)', v6DeckWarn ? 'rgba(245, 158, 11, 0.40)' : 'rgba(255,255,255,0.06)', 1);
    drawText(ctx, `V6 四赛段出战指令 (${s1Cards.length}/4)`, RX + 18, 304, { size: 13.5, bold: true, color: deckAccent });
    drawBadge(ctx, RX + 224, 294, 72, 20, `+${v6Cfg.checkpointTpBase} TP/段`, '#1E293B', THEME.GOLD_LIGHT);
    const hovCardsTop = hits.isHovered(RX + RW - 120, 290, 106, 26);
    drawText(ctx, '配装卡组 ›', RX + RW - 16, 304, {
      size: 12,
      bold: true,
      color: hovCardsTop ? '#FFFFFF' : deckAccent,
      align: 'right',
    });
    hits.add(RX + RW - 120, 290, 106, 26, () => actions.onNavigate('cards'));

    const cardW = 134;
    const cardH = 160;
    const cardGap = 8;
    const zoneLabelMap: Record<string, string> = { ATT: '前锋', MID: '中场', DEF: '防线' };
    for (let ci = 0; ci < 4; ci++) {
      const cx = RX + 16 + ci * (cardW + cardGap);
      const cy = 324;
      const entry = s1Cards[ci];
      if (entry) {
        const zCol = entry.def.zone === 'ATT' ? '#F43F5E' : entry.def.zone === 'MID' ? '#38BDF8' : '#22C55E';
        const hovC = hits.isHovered(cx, cy, cardW, cardH);
        const cardArtId = getDirectiveArtAsset(entry.def.style, entry.def.zone, entry.def.tendency);
        drawRoundRect(
          ctx,
          cx,
          cy,
          cardW,
          cardH,
          8,
          hovC ? '#1A2942' : 'rgba(18, 29, 51, 0.94)',
          hovC ? '#FFFFFF' : entry.isGreenSynergy ? THEME.GREEN : zCol,
          hovC ? 1.6 : 1.1
        );
        // 实体卡牌艺术底图 + 暗渐变
        drawCroppedArt(ctx, cardArtId, cx, cy, cardW, cardH, 8, hovC ? 0.52 : 0.36);
        if (entry.isGreenSynergy || entry.isOverclocked || hovC) {
          drawFoilShimmer(ctx, cx, cy, cardW, cardH, this.animTime * 0.7 + ci * 0.3, 'rgba(250, 204, 21, 0.18)');
        }
        ctx.fillStyle = zCol;
        ctx.fillRect(cx + 1, cy + 8, 3, cardH - 16);

        drawBadge(ctx, cx + 10, cy + 10, 44, 18, zoneLabelMap[entry.def.zone] ?? entry.def.zone, 'rgba(15, 23, 42, 0.92)', zCol);
        drawBadge(ctx, cx + cardW - 44, cy + 10, 34, 18, `${entry.effectiveTpCost}T`, 'rgba(15, 23, 42, 0.92)', THEME.GOLD_LIGHT);

        drawWrappedText(ctx, entry.def.name, cx + 10, cy + 44, cardW - 18, 17, {
          size: 12.5,
          bold: true,
          color: '#FFFFFF',
          maxLines: 2,
        });
        drawWrappedText(ctx, entry.def.benefitSummary, cx + 10, cy + 92, cardW - 18, 16, {
          size: 10.5,
          color: '#E2E8F0',
          maxLines: 3,
        });
        hits.add(cx, cy, cardW, cardH, () => actions.onNavigate('cards'));
      } else {
        ctx.save();
        ctx.setLineDash([4, 3]);
        drawRoundRect(
          ctx,
          cx,
          cy,
          cardW,
          cardH,
          8,
          'rgba(15, 23, 42, 0.50)',
          `rgba(245, 158, 11, ${(0.25 + 0.25 * pulse01).toFixed(2)})`,
          1
        );
        ctx.restore();
        drawText(ctx, '+ 空指令槽', cx + cardW / 2, cy + 68, { size: 12, bold: true, color: '#FCD34D', align: 'center' });
        drawText(ctx, '点击配装', cx + cardW / 2, cy + 92, { size: 10.5, color: THEME.TX3, align: 'center' });
        hits.add(cx, cy, cardW, cardH, () => actions.onNavigate('cards'));
      }
    }

    // 右下 (y: 514, h: 190)：双半区条
    // 左半区 (x: 672, w: 324, h: 190)：出战阵型与 [预案1..4] 一键切换
    const leftStripW = 324;
    drawChamferPanel(ctx, RX, 514, leftStripW, 190, 12, 'rgba(13, 19, 30, 0.86)', 'rgba(255,255,255,0.06)', 1);
    drawText(ctx, '出战阵型与预案', RX + 16, 534, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
    const hovTac = hits.isHovered(RX + leftStripW - 92, 520, 80, 26);
    drawText(ctx, '调阵 ›', RX + leftStripW - 14, 534, {
      size: 11.5,
      bold: true,
      color: hovTac ? '#FFFFFF' : '#7DD3FC',
      align: 'right',
    });
    hits.add(RX + leftStripW - 92, 520, 80, 26, () => actions.onNavigate('tactics'));

    // 微型绿茵阵型图 (64×94)
    const mpX = RX + 16, mpY = 554, mpW = 64, mpH = 94;
    drawRoundRect(ctx, mpX, mpY, mpW, mpH, 7, '#0B241A', 'rgba(74, 222, 128, 0.38)', 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mpX + 5, mpY + mpH / 2);
    ctx.lineTo(mpX + mpW - 5, mpY + mpH / 2);
    ctx.stroke();
    const miniSlots = FORMATIONS[club.formation] ?? [];
    miniSlots.forEach((sl, idx) => {
      const dx = mpX + 8 + (sl.baseY / 68) * (mpW - 16);
      const dy = mpY + 8 + (1 - Math.max(0, Math.min(1, (sl.baseX - 5) / 73))) * (mpH - 16);
      ctx.fillStyle = idx === 0 ? '#FACC15' : '#4ADE80';
      ctx.beginPath();
      ctx.arc(dx, dy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    hits.add(mpX, mpY, mpW, mpH, () => actions.onNavigate('tactics'));

    // 流派专属美术徽标优先，回退矢量雕纹
    const styleIconImg = AssetLoader.get(STYLE_ICON_ASSET[club.style]);
    if (styleIconImg && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(RX + 106, 578, 16, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(styleIconImg, RX + 90, 562, 32, 32);
      ctx.restore();
    } else {
      drawSkillGlyph(ctx, STYLE_GLYPH[club.style] ?? 'balanced', RX + 104, 574, 24, '#38BDF8', THEME.GOLD_LIGHT);
    }
    drawText(ctx, club.formation, RX + 130, 570, { size: 17, bold: true, color: THEME.GREEN, mono: true });
    drawText(ctx, TACTICAL_PRESETS[club.style].name, RX + 130, 592, { size: 12.5, bold: true, color: THEME.TX1 });
    drawText(ctx, curPresetIdx >= 0 ? `当前启用：预案 ${curPresetIdx + 1}` : '当前为自定义阵型', RX + 94, 624, {
      size: 11,
      color: THEME.TX2,
    });

    for (let pi = 0; pi < 4; pi++) {
      const pData = presets[pi];
      const activeP = pi === curPresetIdx;
      const pbx = RX + 16 + pi * 74;
      const pby = 658;
      drawButton(ctx, hits, pbx, pby, 68, 32, `预案${pi + 1}`, () => {
        if (!pData) {
          actions.onNavigate('tactics');
          return;
        }
        const res = league.applyTacticalPreset(pi);
        if (res.ok && res.preset) {
          SoundEngine.playClick();
          this.prepToast = `已切换至预案${pi + 1}：${res.preset.formation} · ${TACTICAL_PRESETS[res.preset.style].name}`;
          actions.onSave?.();
        }
      }, {
        variant: activeP ? 'gold' : 'ghost',
        fontSize: 11,
      });
    }

    // 右半区 (x: 1008, w: 256, h: 190)：两张紧凑低频状态入口卡
    const rightStripX = RX + leftStripW + 12;
    const rightStripW = RW - leftStripW - 12;

    // 卡片 1：联赛实时排名 (h: 90)
    const hovLeague = hits.isHovered(rightStripX, 514, rightStripW, 90);
    drawChamferPanel(
      ctx,
      rightStripX,
      514,
      rightStripW,
      90,
      10,
      hovLeague ? THEME.BG_CARD_HOVER : 'rgba(13, 19, 30, 0.88)',
      hovLeague ? THEME.GOLD_LIGHT : 'rgba(255,255,255,0.08)',
      hovLeague ? 1.4 : 1
    );
    drawText(ctx, '联赛实时排名', rightStripX + 16, 536, { size: 12, bold: true, color: THEME.TX2 });
    drawText(ctx, '积分榜 ›', rightStripX + rightStripW - 16, 536, {
      size: 11.5,
      bold: true,
      color: hovLeague ? '#FFFFFF' : '#7DD3FC',
      align: 'right',
    });
    drawText(ctx, `第 ${userRankIdx + 1} 名`, rightStripX + 16, 572, {
      size: 22,
      bold: true,
      color: THEME.GOLD_LIGHT,
      mono: true,
    });
    drawText(
      ctx,
      userRow ? `${userRow.points}分 · ${userRow.won}胜${userRow.drawn}平${userRow.lost}负` : '0分 · 未开赛',
      rightStripX + rightStripW - 16,
      574,
      { size: 11.5, color: THEME.TX1, align: 'right', mono: true }
    );
    hits.add(rightStripX, 514, rightStripW, 90, () => actions.onNavigate('league'));

    // 卡片 2：赛季词条与脉络 (h: 90，叠放 perk_event 底纹与扫光)
    const story = st.storyline;
    const syn = computePerkSynergies(club.perks);
    const hovPerks = hits.isHovered(rightStripX, 614, rightStripW, 90);
    drawChamferPanel(
      ctx,
      rightStripX,
      614,
      rightStripW,
      90,
      10,
      hovPerks ? THEME.BG_CARD_HOVER : 'rgba(13, 19, 30, 0.88)',
      hovPerks ? THEME.GOLD_LIGHT : club.perks.length > 0 ? 'rgba(250, 204, 21, 0.35)' : 'rgba(255,255,255,0.08)',
      hovPerks ? 1.4 : 1
    );
    if (club.perks.length > 0) {
      drawCroppedArt(ctx, 'perk_event', rightStripX, 614, rightStripW, 90, 10, 0.24);
      drawFoilShimmer(ctx, rightStripX, 614, rightStripW, 90, this.animTime * 0.55, 'rgba(250, 204, 21, 0.16)');
    }
    drawIcon(ctx, 'sparkle', rightStripX + 20, 636, 13, THEME.GOLD_LIGHT);
    drawText(ctx, `赛季词条 (${club.perks.length})`, rightStripX + 34, 636, { size: 12.5, bold: true, color: THEME.TX1 });
    drawText(ctx, '详情 ›', rightStripX + rightStripW - 16, 636, {
      size: 11.5,
      bold: true,
      color: hovPerks ? '#FFFFFF' : THEME.GOLD_LIGHT,
      align: 'right',
    });
    if (club.perks.length > 0) {
      drawText(
        ctx,
        fitText(ctx, club.perks.slice(0, 2).map(p => p.name).join(' · '), rightStripW - 32, 12, true),
        rightStripX + 16,
        664,
        { size: 12, bold: true, color: THEME.GOLD_LIGHT }
      );
      drawText(
        ctx,
        syn.synergies[0] ? `共振：${syn.synergies[0]}` : story ? `脉络：${story.title}` : '点击查看全部词条',
        rightStripX + 16,
        684,
        { size: 11, color: syn.synergies[0] ? THEME.GREEN : THEME.TX2 }
      );
    } else {
      drawText(ctx, story ? `脉络：${story.title}` : '暂未激活词条', rightStripX + 16, 664, {
        size: 12,
        bold: true,
        color: story ? '#A5B4FC' : THEME.TX2,
      });
      drawText(ctx, '第 8 / 16 / 24 轮解锁', rightStripX + 16, 684, {
        size: 11,
        color: THEME.TX3,
      });
    }
    hits.add(rightStripX, 614, rightStripW, 90, () => {
      SoundEngine.playClick();
      this.perksModalOpen = true;
    });

    if (this.perksModalOpen) {
      this.renderPerksModal(ctx, hits, league);
    } else if (this.scoutModalOpen && prep?.matchupIntel) {
      this.renderScoutModal(ctx, hits, league, prep.matchupIntel, prep.actionsLeft, actions);
    }
  }

  private renderPerksModal(ctx: CanvasRenderingContext2D, hits: HitRegistry, league: LeagueManager): void {
    const st = league.getState();
    const club = league.getUserClub();
    const story = st.storyline;
    const syn = computePerkSynergies(club.perks);

    ctx.fillStyle = 'rgba(4, 7, 14, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 220;
    const my = 120;
    const mw = 840;
    const mh = 470;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(11, 17, 32, 0.98)', THEME.BORDER_GOLD, 1.8, THEME.GOLD_LIGHT);

    drawIcon(ctx, 'sparkle', mx + 26, my + 28, 16, THEME.GOLD_LIGHT);
    drawText(ctx, `俱乐部赛季脉络与 Rogue 战术词条 (${club.perks.length})`, mx + 46, my + 28, {
      size: 17,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    if (story) {
      drawBadge(ctx, mx + 440, my + 17, 110, 22, story.title, '#312E81', '#A5B4FC');
    }
    drawButton(ctx, hits, mx + mw - 96, my + 14, 76, 30, '关闭', () => {
      this.perksModalOpen = false;
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    drawText(
      ctx,
      syn.synergies.length > 0 ? `已激活共振：${syn.synergies.join(' · ')}` : '同系叠加 2 张词条可激活强力共振效果',
      mx + 26,
      my + 62,
      { size: 12.5, bold: true, color: syn.synergies.length > 0 ? THEME.GREEN : THEME.TX2 }
    );

    if (club.perks.length === 0) {
      drawRoundRect(ctx, mx + 26, my + 90, mw - 52, 340, 10, THEME.BG_CARD, THEME.BORDER);
      drawCroppedArt(ctx, 'perk_event', mx + 26, my + 90, mw - 52, 340, 10, 0.25);
      drawText(ctx, '暂未激活赛季 Rogue 战术词条', mx + mw / 2, my + 225, {
        size: 16,
        bold: true,
        color: THEME.TX1,
        align: 'center',
      });
      drawWrappedText(
        ctx,
        '第 8 / 16 / 24 轮赛后 3 选 1 将必定出现「赛季战术词条」盲盒，也可在日常肉鸽事件中获取强力词条与觉醒效果。',
        mx + 140,
        my + 260,
        mw - 280,
        24,
        { size: 13, color: THEME.TX2, maxLines: 3 }
      );
    } else {
      club.perks.slice(0, 6).forEach((pk, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const px = mx + 26 + col * 266;
        const py = my + 90 + row * 176;
        drawChamferPanel(ctx, px, py, 254, 162, 10, THEME.BG_CARD, THEME.BORDER_GOLD, 1.2, THEME.GOLD);
        drawCroppedArt(ctx, 'perk_event', px, py, 254, 162, 10, 0.20);
        drawFoilShimmer(ctx, px, py, 254, 162, this.animTime * 0.5 + idx * 0.4, 'rgba(250, 204, 21, 0.14)');
        drawIcon(ctx, 'sparkle', px + 18, py + 24, 14, THEME.GOLD_LIGHT);
        drawText(ctx, fitText(ctx, pk.name, 200, 14, true), px + 34, py + 24, {
          size: 14,
          bold: true,
          color: THEME.GOLD_LIGHT,
        });
        drawWrappedText(ctx, pk.description, px + 16, py + 52, 222, 21, {
          size: 12,
          color: THEME.TX1,
          maxLines: 5,
        });
      });
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

    const lx = mx + 24;
    const lw = 296;
    drawText(ctx, '一、对手阵型沙盘（点击区块扫描录像）', lx, colY + 10, { size: 13.5, bold: true, color: '#38BDF8' });

    const px = lx;
    const py = colY + 26;
    const pw = lw;
    const ph = 228;
    drawRoundRect(ctx, px, py, pw, ph, 10, '#0B241A', 'rgba(74, 222, 128, 0.35)', 1.2);
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
