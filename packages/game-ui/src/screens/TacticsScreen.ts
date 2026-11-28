/**
 * 页面 3：发行级战术板与阵容页
 * - 顶部战术摘要条 + 阵型风格独立抽屉浮层
 * - 左栏宽屏绿茵球场 (630px) + 底部固定 48px 操作栏（职责 / 设队长 / 详情 / 取消）
 * - 右栏纯替补席 3 列球员卡片网格 (524px)，与球场卡片视觉完全统一，彻底移除多余按钮
 */

import { FORMATION_SYSTEMS, FORMATIONS, getDefenseSystem, gridToPitch, ROLE_DUTY_OPTIONS } from '../../../engine/src/formations';
import {
  DefenseSystem,
  PITCH,
  TACTICAL_PRESETS,
  TacticalStyle,
} from '../../../engine/src/types';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { DraftPlayer } from '../../../core/src/types';
import { AssetLoader, getDirectiveAssetId, getRelicAssetId, getSkillAssetId } from '../AssetLoader';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawMiniBar,
  drawNavRail,
  drawPrintCard,
  drawRoundRect,
  drawStatMicro,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  getHalftonePattern,
  HitRegistry,
  NavRailTab,
  tierColor,
} from '../CanvasKit';
import {
  STYLE_LABELS,
  V6_ACTIVE_SKILL_MAP,
  V6_DIRECTIVE_ENCHANTS,
  V6_DIRECTIVE_MAP,
  V6_FUSION_MAP,
  V6_RELICS,
  V6_SEGMENTS,
  type V6CheckpointKey,
  type V6DirectiveDef,
} from '../../../core/src/v6';
import { drawPlayerAvatar } from '../AvatarRenderer';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

const SYS_LIST: DefenseSystem[] = ['4-back', '3-back', '5-back'];
const STYLE_LIST: TacticalStyle[] = ['tiki_taka', 'gegenpress', 'balanced', 'wing_play', 'counter', 'park_bus'];

export class TacticsScreen {
  private mainTab: 'pitch' | 'loadout' = 'pitch';
  private loadoutSeg: V6CheckpointKey = 's1';
  private libMode: 'directives' | 'skills' = 'directives';
  private zoneFilter: 'ALL' | 'ATT' | 'MID' | 'DEF' = 'ALL';
  private tendFilter: 'ALL' | 'ATK' | 'DEF' = 'ALL';
  private libPage = 0;
  private inspectDirectiveId: string | null = null;
  private inspectSkillId: string | null = null;
  private selectedRelicId: string | null = null;
  private loadoutToast = '';

  private selectedStarterIdx: number | null = null;
  private selectedBenchPlayerId: string | null = null;
  private swapMode = false;
  private benchFilter: 'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT' = 'ALL';
  private benchPage = 0;
  private activeSysTab: DefenseSystem | null = null;
  private styleModalOpen = false;
  private presetModalOpen = false;
  private presetNotice = '每场比赛最多携带 4 套预置战术（阵型+球员+风格）与 V6 四赛段三区指令实时控场';
  private swapRipple: { x: number; y: number; startMs: number } | null = null;

  public setMainTab(tab: 'pitch' | 'loadout'): void {
    this.mainTab = tab;
  }

  public handleEscape(): boolean {
    if (this.styleModalOpen) {
      this.styleModalOpen = false;
      return true;
    }
    if (this.presetModalOpen) {
      this.presetModalOpen = false;
      return true;
    }
    if (this.selectedStarterIdx !== null || this.selectedBenchPlayerId !== null) {
      this.selectedStarterIdx = null;
      this.selectedBenchPlayerId = null;
      this.swapMode = false;
      return true;
    }
    return false;
  }

  public onWheel(deltaY: number): boolean {
    if (this.presetModalOpen || this.styleModalOpen) return false;
    const step = deltaY > 0 ? 1 : -1;
    if (this.mainTab === 'loadout') {
      this.libPage = Math.max(0, this.libPage + step);
      return true;
    }
    const next = Math.max(0, Math.min(2, this.benchPage + step));
    if (next !== this.benchPage) {
      this.benchPage = next;
      return true;
    }
    return false;
  }

  private swapStarterWithPlayer(
    league: LeagueManager,
    starterIdx: number,
    targetPlayerId: string,
    onSave: () => void,
    ripplePos?: { x: number; y: number }
  ): void {
    const club = league.getUserClub();
    const target = club.squad.find(p => p.id === targetPlayerId);
    if (target && ((target.suspendedRounds ?? 0) > 0 || (target.injuredRounds ?? 0) > 0)) return;
    const next = [...club.starterIds];
    const existingIdx = next.indexOf(targetPlayerId);
    if (existingIdx >= 0) {
      const tmp = next[starterIdx];
      next[starterIdx] = next[existingIdx];
      next[existingIdx] = tmp;
    } else {
      next[starterIdx] = targetPlayerId;
    }
    if (ripplePos) {
      this.swapRipple = { x: ripplePos.x, y: ripplePos.y, startMs: performance.now() };
    }
    league.updateUserTactics(club.formation, club.style, next);
    this.selectedStarterIdx = null;
    this.selectedBenchPlayerId = null;
    this.swapMode = false;
    onSave();
  }

  private getLineRatings(league: LeagueManager): { att: number; mid: number; def: number } {
    const club = league.getUserClub();
    const squadMap = new Map(club.squad.map(p => [p.id, p]));
    const slotsForRating = FORMATIONS[club.formation];
    const lineSums = { def: [] as number[], mid: [] as number[], att: [] as number[] };
    slotsForRating.forEach((sl, idx) => {
      const pl = squadMap.get(club.starterIds[idx]);
      if (!pl) return;
      if (sl.role === 'GK' || ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(sl.role)) lineSums.def.push(pl.ca);
      else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(sl.role)) lineSums.mid.push(pl.ca);
      else lineSums.att.push(pl.ca);
    });
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    return { att: avg(lineSums.att), mid: avg(lineSums.mid), def: avg(lineSums.def) };
  }

  /**
   * 统一球员卡片绘制（PITCH PRINT 暖纸卡面 + 深墨排版，所有字号 >= 12px）
   */
  private drawPlayerCard(
    ctx: CanvasRenderingContext2D,
    club: ReturnType<LeagueManager['getUserClub']>,
    player: DraftPlayer,
    opts: {
      x: number;
      y: number;
      w: number;
      h: number;
      roleLabel: string;
      roleBg: string;
      roleFg: string;
      borderColor: string;
      bgColor: string;
      borderWidth?: number;
      fam: number;
      isCaptain?: boolean;
      statusBadge?: { text: string; bg: string; fg: string };
      detailed?: boolean;
      shadowOffset?: number;
      darkCard?: boolean;
    }
  ): void {
    const { x, y, w, h, detailed } = opts;
    const isDark = opts.darkCard ?? false;
    const primaryInk = isDark ? THEME.PAPER_CREAM : THEME.PAPER_INK;
    const secondaryInk = isDark ? THEME.TX2 : THEME.PAPER_MUTED;
    const caInk = isDark ? THEME.GOLD_LIGHT : THEME.PAPER_INK;

    const cardR = detailed ? 6 : 5;
    const cardSh = opts.shadowOffset ?? (detailed ? 3 : 2);
    const cardBw = opts.borderWidth ?? 1.5;
    if (opts.bgColor === THEME.PAPER_CREAM) {
      drawPrintCard(ctx, x, y, w, h, {
        paper: true,
        radius: cardR,
        shadowOffset: cardSh,
        strokeColor: opts.borderColor,
        lineWidth: cardBw,
      });
    } else {
      if (cardSh > 0) drawRoundRect(ctx, x + cardSh, y + cardSh, w, h, cardR, THEME.HARD_SHADOW);
      drawRoundRect(ctx, x, y, w, h, cardR, opts.bgColor, opts.borderColor, cardBw);
    }

    const a = player.attributes;
    const hasGold = (player.goldTraits?.length ?? 0) > 0;
    const fit = Math.round(player.fitness ?? 100);
    const famCol = isDark
      ? (opts.fam >= 85 ? THEME.GOLD_LIGHT : opts.fam >= 65 ? THEME.GREEN : opts.fam >= 35 ? '#7DD3FC' : '#FCA5A5')
      : (opts.fam >= 85 ? '#7C580C' : opts.fam >= 65 ? '#166534' : opts.fam >= 35 ? '#1D4ED8' : '#B91C1C');

    const paVal = player.pa ?? player.ca;
    const paColor = isDark
      ? (paVal - player.ca >= 8 ? '#E9D5FF' : THEME.GOLD_LIGHT)
      : (paVal - player.ca >= 8 ? '#6D28D9' : '#7C580C');

    if (!detailed) {
      const roleMaxW = opts.statusBadge ? 46 : opts.isCaptain ? 50 : 58;
      const roleW = Math.min(roleMaxW, Math.max(42, Math.ceil(opts.roleLabel.length * 9.5) + 12));
      drawBadge(ctx, x + 4, y + 4, roleW, 17, opts.roleLabel, opts.roleBg, opts.roleFg);

      if (opts.statusBadge) {
        drawBadge(ctx, x + w - 34, y + 4, 30, 17, opts.statusBadge.text, opts.statusBadge.bg, opts.statusBadge.fg);
      } else if (opts.isCaptain) {
        drawBadge(ctx, x + w - 21, y + 4, 17, 17, 'C', THEME.GOLD, THEME.PAPER_INK);
      }

      const caRight = opts.statusBadge ? x + w - 37 : opts.isCaptain ? x + w - 24 : x + w - 5;
      drawText(ctx, `${player.ca}/${paVal}`, caRight, y + 13, {
        size: 12,
        rawSize: true,
        bold: true,
        color: paColor,
        align: 'right',
        mono: true,
      });

      drawPlayerAvatar(ctx, x + 5, y + 23, 22, 24, player, club, { radius: 4, showFrame: false });
      const nameStr = fitText(ctx, `${hasGold ? '★' : ''}${player.name}`, w - 34, 12.5, true, true);
      drawText(ctx, nameStr, x + 30, y + 32, {
        size: 12.5,
        rawSize: true,
        bold: true,
        color: hasGold || player.isNewSigning ? (isDark ? THEME.GOLD_LIGHT : '#854D0E') : primaryInk,
      });

      const botY = y + h - 9;
      drawText(ctx, `${opts.fam}%`, x + 5, botY, {
        size: 12,
        rawSize: true,
        bold: true,
        color: famCol,
        mono: true,
      });
      drawMiniBar(ctx, x + w - 62, botY - 2, 22, 4, fit / 100, fit < 60 ? '#D97706' : '#16A34A');
      drawText(ctx, `${fit}%`, x + w - 5, botY, {
        size: 12,
        rawSize: true,
        color: fit < 60 ? '#B45309' : secondaryInk,
        align: 'right',
        mono: true,
      });
      return;
    }

    // 详细版替补席卡片 (240×134)：暖纸底色 + 深墨大字
    const roleW = Math.min(56, Math.max(38, opts.roleLabel.length * 8.5 + 10));
    const badgeH = 20;
    drawBadge(ctx, x + 8, y + 6, roleW, badgeH, opts.roleLabel, opts.roleBg, opts.roleFg);

    if (opts.statusBadge) {
      drawBadge(ctx, x + w - 44, y + 6, 36, badgeH, opts.statusBadge.text, opts.statusBadge.bg, opts.statusBadge.fg);
    } else if (opts.isCaptain) {
      drawBadge(ctx, x + w - 24, y + 6, 16, badgeH, 'C', THEME.GOLD, THEME.PAPER_INK);
    }

    const caRight = opts.statusBadge ? x + w - 48 : opts.isCaptain ? x + w - 27 : x + w - 8;
    drawText(ctx, `${player.ca}/${paVal}`, caRight, y + 16, {
      size: 14.5,
      rawSize: true,
      bold: true,
      color: paColor,
      align: 'right',
      mono: true,
    });

    const avW = 36;
    const avH = 44;
    const nameStr = fitText(ctx, `${hasGold ? '★' : ''}${player.name}`, w - avW - 26, 15, true, true);
    drawPlayerAvatar(ctx, x + 8, y + 28, avW, avH, player, club, { radius: 4, showFrame: true });
    drawText(ctx, nameStr, x + 14 + avW, y + 40, {
      size: 15,
      rawSize: true,
      bold: true,
      color: hasGold || player.isNewSigning ? (isDark ? THEME.GOLD_LIGHT : '#854D0E') : caInk,
    });

    const secTxt = player.secondaryRoles && player.secondaryRoles.length > 0 ? ` · ${player.secondaryRoles.slice(0, 2).join('/')}` : '';
    drawText(ctx, fitText(ctx, `${player.age}岁${secTxt}`, w - avW - 26, 12.5, false, true), x + 14 + avW, y + 60, {
      size: 12.5,
      rawSize: true,
      color: secondaryInk,
      mono: true,
    });

    const statsRowY = y + 89;
    const statItems: Array<['stat_pace' | 'stat_shoot' | 'stat_pass' | 'stat_def' | 'stat_gk' | 'stat_pos' | 'stat_calm', number]> = player.role === 'GK'
      ? [
          ['stat_gk', a.goalkeeping],
          ['stat_pos', a.positioning],
          ['stat_calm', a.composure],
        ]
      : [
          ['stat_pace', a.pace],
          ['stat_shoot', a.shooting],
          ['stat_pass', a.passing],
          ['stat_def', a.defending],
        ];
    const colStep = player.role === 'GK' ? 74 : 56;
    statItems.forEach(([ic, val], si) => {
      drawStatMicro(ctx, ic, `${val}`, x + 10 + si * colStep, statsRowY, {
        iconSize: 13,
        fontSize: 12.5,
        iconColor: secondaryInk,
        valueColor: val >= 75 ? (isDark ? THEME.GOLD_LIGHT : '#854D0E') : primaryInk,
        bold: val >= 75,
        gap: 3,
      });
    });

    const botY = y + h - 14;
    const maxLx = x + w - 88;
    const g = player.seasonStats.goals;
    const ast = player.seasonStats.assists;
    let lx = x + 10;
    lx += drawStatMicro(ctx, 'stat_fam', `${opts.fam}%`, lx, botY, {
      iconSize: 12,
      fontSize: 12,
      iconColor: secondaryInk,
      valueColor: famCol,
      gap: 3,
    });
    if (g > 0 && lx + 30 < maxLx) {
      lx += 6;
      lx += drawStatMicro(ctx, 'ball', `${g}`, lx, botY, { iconSize: 12, fontSize: 12, iconColor: secondaryInk, valueColor: primaryInk, gap: 2 });
    }
    if (ast > 0 && lx + 28 < maxLx) {
      lx += 5;
      drawStatMicro(ctx, 'stat_assist', `${ast}`, lx, botY, { iconSize: 12, fontSize: 12, iconColor: secondaryInk, valueColor: primaryInk, gap: 2 });
    }
    drawMiniBar(ctx, x + w - 80, botY - 2, 26, 4, fit / 100, fit < 60 ? '#D97706' : '#16A34A');
    drawText(ctx, `${fit}%`, x + w - 10, botY, {
      size: 12,
      rawSize: true,
      color: fit < 60 ? '#B45309' : secondaryInk,
      align: 'right',
      mono: true,
    });
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onNavigate: (tab: NavRailTab) => void;
      onStartMatch: () => void;
      onSave: () => void;
      onInspectPlayer: (p: DraftPlayer) => void;
      onOpenRoster?: () => void;
    }
  ): void {
    const club = league.getUserClub();
    const squadMap = new Map(club.squad.map(p => [p.id, p]));

    drawBroadcastHeader(ctx, hits, {
      kicker: 'TACTICAL BOARD · SQUAD MANAGEMENT',
      title: `${club.name} · 战术与阵容`,
      club,
      metaPoints: league.getState().metaPointsTotal,
      showSoundToggle: true,
      rightAction: { label: '进入比赛日', icon: 'play', variant: 'gold', onClick: actions.onStartMatch },
    });

    drawNavRail(ctx, hits, 'tactics', actions.onNavigate);

    // ==================== 顶部战术摘要与操作条 (x: 96..1264, y: 80, h: 48) ====================
    const activePreset = TACTICAL_PRESETS[club.style];
    const lineRatings = this.getLineRatings(league);

    drawPrintCard(ctx, 96, 80, 1168, 48, { paper: false, radius: 8, shadowOffset: 3, strokeColor: THEME.BORDER_GOLD, lineWidth: 1.5 });
    const astTop = league.getV6Astrolabe();
    const s1TopCount = astTop.checkpointPools.s1.length;
    const totalDirCount =
      astTop.checkpointPools.s1.length +
      astTop.checkpointPools.s2.length +
      astTop.checkpointPools.s3.length +
      astTop.checkpointPools.s4.length;
    const skTopCount = astTop.equippedSkills.length;
    const loadoutTabLabel = astTop.useUniversalPool
      ? `② 指令与绝技 (通用${s1TopCount}/4 · ${skTopCount}/4)`
      : `② 指令与绝技 (${totalDirCount}/16 · ${skTopCount}/4)`;

    drawButton(ctx, hits, 106, 88, 130, 32, '① 阵容与站位', () => {
      this.mainTab = 'pitch';
    }, { active: this.mainTab === 'pitch', fontSize: 12, icon: 'tactics' });

    drawButton(
      ctx,
      hits,
      242,
      88,
      238,
      32,
      loadoutTabLabel,
      () => {
        this.mainTab = 'loadout';
      },
      { active: this.mainTab === 'loadout', variant: s1TopCount < 4 ? 'gold' : 'primary', fontSize: 12, icon: 'bolt' }
    );

    const formPillW = 180;
    const formPillHov = hits.isHovered(488, 88, formPillW, 32);
    drawPrintCard(ctx, 488, 88, formPillW, 32, { paper: false, radius: 6, shadowOffset: 2, strokeColor: formPillHov ? THEME.GOLD_LIGHT : THEME.INK_LINE, lineWidth: 1.8 });
    drawBadge(ctx, 494, 92, 56, 24, club.formation, THEME.BG_PANEL, THEME.GOLD_LIGHT);
    drawText(ctx, `${activePreset.name} ▾`, 556, 104, {
      size: 12.5,
      bold: true,
      color: formPillHov ? THEME.GOLD_LIGHT : THEME.TX1,
    });
    hits.addTouchTarget(488, 88, formPillW, 32, () => {
      SoundEngine.playClick();
      this.activeSysTab = getDefenseSystem(club.formation);
      this.styleModalOpen = true;
    });

    drawText(
      ctx,
      `攻${lineRatings.att} · 中${lineRatings.mid} · 防${lineRatings.def}`,
      680,
      104,
      { size: 12.5, bold: true, color: THEME.GOLD_LIGHT, mono: true }
    );

    const presetsTop = league.getTacticalPresets();
    const curPrIdx = presetsTop.findIndex(pr => pr && club.formation === pr.formation && club.style === pr.style);
    drawText(ctx, '预案', 1028, 104, { size: 12, color: THEME.TX3, align: 'right' });
    for (let pi = 0; pi < 4; pi++) {
      const tx = 1036 + pi * 42;
      const isActPr = curPrIdx === pi;
      const prExists = !!presetsTop[pi];
      drawButton(ctx, hits, tx, 88, 38, 32, `${pi + 1}`, () => {
        if (!prExists) {
          this.presetModalOpen = true;
          return;
        }
        const res = league.applyTacticalPreset(pi);
        if (res.ok && res.preset) {
          this.activeSysTab = getDefenseSystem(res.preset.formation);
          this.selectedStarterIdx = null;
          this.selectedBenchPlayerId = null;
          actions.onSave();
        }
      }, { active: isActPr, variant: isActPr ? 'gold' : 'ghost', fontSize: 12.5 });
    }
    drawButton(ctx, hits, 1208, 88, 44, 32, '⚙', () => {
      this.presetModalOpen = true;
    }, { variant: 'ghost', fontSize: 14 });

    if (this.mainTab === 'loadout') {
      this.renderLoadoutStudio(ctx, hits, league, actions);
      if (this.styleModalOpen) this.renderStyleModal(ctx, hits, league, actions);
      if (this.presetModalOpen) this.renderPresetModal(ctx, hits, league, actions);
      return;
    }

    // ==================== 左主区：宽屏竖向深松绿茵球场 (x: 96..726, w: 630, y: 138..704, h: 566) ====================
    const px = 96, py = 138, pw = 630, ph = 566;
    drawPrintCard(ctx, px, py, pw, ph, { paper: false, radius: 10, shadowOffset: 4, strokeColor: THEME.BORDER, lineWidth: 1.5 });

    const selectedStarter = this.selectedStarterIdx !== null ? squadMap.get(club.starterIds[this.selectedStarterIdx]) : null;
    const selectedBench = this.selectedBenchPlayerId ? squadMap.get(this.selectedBenchPlayerId) : null;
    drawPrintCard(ctx, px + 12, py + 10, pw - 24, 36, { paper: false, radius: 6, shadowOffset: 2, strokeColor: (selectedStarter || selectedBench) ? THEME.LIME : THEME.BORDER, lineWidth: 1.2 });
    drawIcon(ctx, (selectedStarter || selectedBench) ? 'refresh' : 'tactics', px + 28, py + 28, 14, (selectedStarter || selectedBench) ? THEME.LIME : THEME.GOLD_LIGHT);
    const hasReset = !!(club.gridSlots || club.slotDuties);
    const hintMaxW = selectedBench ? pw - 196 : (selectedStarter && this.swapMode) ? pw - 156 : hasReset ? pw - 130 : pw - 60;
    const hintText = selectedStarter
      ? (this.swapMode
        ? `换位/换人【${selectedStarter.name}】：点队友互换，或点右侧替补`
        : this.selectedStarterIdx! > 0
        ? `已选【${selectedStarter.name}】：点空白格调站位，或点浮层操作`
        : `已选门将【${selectedStarter.name}】：请在浮层换人或查详情`)
      : selectedBench
      ? `已选替补【${selectedBench.role}·${selectedBench.name}】：点球场首发位置换上`
      : '点击球场球员可调站位/换人，或点击右侧替补替换上场';
    drawText(ctx, fitText(ctx, hintText, hintMaxW, 12, !!(selectedStarter || selectedBench)), px + 44, py + 28, {
      size: 12,
      bold: !!(selectedStarter || selectedBench),
      color: (selectedStarter || selectedBench) ? THEME.LIME : THEME.GOLD_LIGHT,
    });

    if (selectedStarter && this.swapMode) {
      drawButton(ctx, hits, px + pw - 96, py + 14, 80, 28, '取消换人', () => {
        this.swapMode = false;
      }, { variant: 'ghost', fontSize: 12 });
    } else if (selectedBench) {
      drawButton(ctx, hits, px + pw - 134, py + 14, 58, 28, '详情', () => {
        actions.onInspectPlayer(selectedBench);
      }, { variant: 'primary', fontSize: 12 });
      drawButton(ctx, hits, px + pw - 70, py + 14, 54, 28, '取消', () => {
        this.selectedBenchPlayerId = null;
      }, { variant: 'ghost', fontSize: 12 });
    } else if (hasReset) {
      drawButton(ctx, hits, px + pw - 74, py + 14, 58, 28, '重置', () => {
        league.resetClubGridAndDuties();
        actions.onSave();
      }, { variant: 'ghost', fontSize: 12 });
    }

    const slots = FORMATIONS[club.formation];
    const pitchX = px + 32, pitchY = py + 54, pitchW = pw - 64, pitchH = ph - 66;
    const stripeH = pitchH / 8;
    for (let si = 0; si < 8; si++) {
      ctx.fillStyle = si % 2 === 0 ? THEME.BG_PITCH : THEME.BG_PITCH_ALT;
      ctx.fillRect(pitchX, pitchY + si * stripeH, pitchW, stripeH);
    }
    const pitchHalftone = getHalftonePattern(ctx, true);
    if (pitchHalftone) {
      ctx.fillStyle = pitchHalftone;
      ctx.fillRect(pitchX, pitchY, pitchW, pitchH);
    }
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.48)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);
    ctx.beginPath();
    ctx.moveTo(pitchX, pitchY + pitchH / 2);
    ctx.lineTo(pitchX + pitchW, pitchY + pitchH / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pitchX + pitchW / 2, pitchY + pitchH / 2, 44, 0, Math.PI * 2);
    ctx.stroke();
    const penW = Math.round(pitchW * 0.56);
    const penH = Math.round(pitchH * 0.14);
    const sixW = Math.round(pitchW * 0.26);
    const sixH = Math.round(pitchH * 0.055);
    ctx.strokeRect(pitchX + (pitchW - penW) / 2, pitchY, penW, penH);
    ctx.strokeRect(pitchX + (pitchW - penW) / 2, pitchY + pitchH - penH, penW, penH);
    ctx.strokeRect(pitchX + (pitchW - sixW) / 2, pitchY, sixW, sixH);
    ctx.strokeRect(pitchX + (pitchW - sixW) / 2, pitchY + pitchH - sixH, sixW, sixH);

    const toTacScreen = (baseX: number, baseY: number) => {
      const normX = Math.max(0, Math.min(1, (baseX - 5) / 73));
      const normY = Math.max(0, Math.min(1, baseY / PITCH.WIDTH));
      return {
        x: pitchX + 8 + normY * (pitchW - 16),
        y: pitchY + 34 + (1 - normX) * (pitchH - 68),
      };
    };

    if (this.selectedStarterIdx !== null && this.selectedStarterIdx > 0 && !this.swapMode) {
      const cellW = (12 / PITCH.WIDTH) * (pitchW - 16);
      const cellH = (13 / 73) * (pitchH - 68);
      const sIdx = this.selectedStarterIdx;
      const curGrid = club.gridSlots?.[sIdx];
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 6; r++) {
          const gp = gridToPitch(c, r);
          const center = toTacScreen(gp.baseX, gp.baseY);
          const gx = center.x - cellW / 2;
          const gy = center.y - cellH / 2;
          const isCur = !!(curGrid && curGrid.col === c && curGrid.row === r);
          const isHov = hits.isHovered(gx, gy, cellW, cellH);
          ctx.strokeStyle = isCur ? THEME.GOLD_LIGHT : isHov ? THEME.LIME : 'rgba(244, 239, 228, 0.22)';
          ctx.lineWidth = isCur || isHov ? 1.5 : 1;
          ctx.strokeRect(gx + 1, gy + 1, cellW - 2, cellH - 2);
          if (isCur || isHov) {
            ctx.fillStyle = isCur ? 'rgba(216, 168, 66, 0.20)' : 'rgba(200, 242, 48, 0.14)';
            ctx.fillRect(gx + 1, gy + 1, cellW - 2, cellH - 2);
          }
          hits.addTouchTarget(gx, gy, cellW, cellH, () => {
            SoundEngine.playClick();
            league.setClubGridSlot(sIdx, c, r);
            actions.onSave();
          });
        }
      }
    }

    const chemSummary = league.getTacticsChemistrySummary();
    const slotCoords = slots.map((sl, idx) => {
      const customGrid = idx > 0 ? club.gridSlots?.[idx] : undefined;
      const pos = customGrid ? gridToPitch(customGrid.col, customGrid.row) : sl;
      return toTacScreen(pos.baseX, pos.baseY);
    });

    const roleLine = (r: string) =>
      r === 'GK' ? 'GK' :
      ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r) ? 'DEF' :
      ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(r) ? 'MID' : 'ATT';

    // 同线阵型结构虚线
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.20)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    (['DEF', 'MID', 'ATT'] as const).forEach(lg => {
      const pts = slots
        .map((sl, idx) => ({ role: sl.role, coord: slotCoords[idx] }))
        .filter(item => roleLine(item.role) === lg)
        .sort((a, b) => a.coord.x - b.coord.x);
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].coord.x, pts[0].coord.y);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(pts[k].coord.x, pts[k].coord.y);
        }
        ctx.stroke();
      }
    });
    ctx.restore();

    const pointToSegDist = (px0: number, py0: number, x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq <= 0.0001) return Math.hypot(px0 - x1, py0 - y1);
      const t = Math.max(0, Math.min(1, ((px0 - x1) * dx + (py0 - y1) * dy) / lenSq));
      return Math.hypot(px0 - (x1 + t * dx), py0 - (y1 + t * dy));
    };

    let hoveredLink: (typeof chemSummary.specs)[number] | null = null;
    let hoveredMidX = 0;
    let hoveredMidY = 0;
    let minHoverDist = 22;

    const flowDashOffset = -(performance.now() / 48) % 14;
    ctx.save();
    for (const sp of chemSummary.specs) {
      const a = slotCoords[sp.slotA];
      const b = slotCoords[sp.slotB];
      if (!a || !b) continue;
      const score = sp.link.score;
      const dist = pointToSegDist(hits.hoverX, hits.hoverY, a.x, a.y, b.x, b.y);
      const isHovered = dist < minHoverDist;
      if (isHovered) {
        minHoverDist = dist;
        hoveredLink = sp;
        hoveredMidX = (a.x + b.x) / 2;
        hoveredMidY = (a.y + b.y) / 2;
      }

      const color =
        score >= 85 ? THEME.LIME :
        score >= 65 ? '#34D399' :
        score >= 35 ? '#2B6BE6' : 'rgba(244, 239, 228, 0.35)';
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 4 : sp.kind === 'spine' ? 2.6 : 1.8;
      ctx.setLineDash(score < 35 ? [5, 5] : [8, 6]);
      ctx.lineDashOffset = score >= 35 ? flowDashOffset : 0;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const showScore = isHovered || (this.selectedStarterIdx !== null && (sp.slotA === this.selectedStarterIdx || sp.slotB === this.selectedStarterIdx));
      if (showScore) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        drawRoundRect(ctx, mx - 16, my - 10, 32, 20, 4, THEME.BG_DEEP, color, 1.2);
        drawText(ctx, `${Math.round(score)}`, mx, my, { size: 12, bold: true, color, align: 'center', mono: true });
      }
    }
    ctx.restore();

    // 换人粉笔扩散波纹
    if (this.swapRipple) {
      const elapsed = performance.now() - this.swapRipple.startMs;
      if (elapsed < 450) {
        const t = elapsed / 450;
        const rad = 18 + t * 54;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.strokeStyle = THEME.LIME;
        ctx.lineWidth = 3 * (1 - t * 0.6);
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(this.swapRipple.x, this.swapRipple.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        this.swapRipple = null;
      }
    }

    const spine = chemSummary.spineInfo;
    if (spine.linkCount > 0) {
      const spineCol = spine.bonus >= 4 ? THEME.LIME : spine.bonus >= 2 ? THEME.GOLD_LIGHT : THEME.TX2;
      drawBadge(
        ctx,
        pitchX + 8,
        pitchY + 8,
        186,
        24,
        `中轴脊柱 ${spine.avg}${spine.bonus > 0 ? ` · 共振+${spine.bonus}` : ''}`,
        THEME.BG_DEEP,
        spineCol
      );
    }

    const captainId = league.getCaptainId(club);
    slots.forEach((slot, i) => {
      const pid = club.starterIds[i];
      const player = squadMap.get(pid);
      if (!player) return;

      const sx = slotCoords[i].x;
      const sy = slotCoords[i].y;
      const isSelected = this.selectedStarterIdx === i;
      const isInjured = (player.injuredRounds ?? 0) > 0;
      const isSuspended = (player.suspendedRounds ?? 0) > 0;
      const isBlocked = isInjured || isSuspended;
      const canDropBench = this.selectedBenchPlayerId !== null && !isBlocked;
      const isSwapTarget = this.swapMode && this.selectedStarterIdx !== null && this.selectedStarterIdx !== i && !isBlocked;
      const exactFit = player.role === slot.role;
      const secondaryFit = !exactFit && (player.secondaryRoles?.includes(slot.role) ?? false);
      const lineFit = exactFit || secondaryFit || (roleLine(player.role) === roleLine(slot.role) && (slot.role !== 'GK' || player.role === 'GK'));
      const fitBorder = isBlocked
        ? THEME.RED
        : isSelected
        ? THEME.LIME
        : canDropBench || isSwapTarget
        ? THEME.LIME
        : !lineFit
        ? THEME.RED
        : secondaryFit
        ? '#2B6BE6'
        : !exactFit
        ? THEME.GOLD
        : THEME.PAPER_INK;
      const fam = league.getPlayerFamiliarity(player, club.formation);

      const slotDuty = club.slotDuties?.[i] ?? 'default';
      const dutyOpt = slotDuty !== 'default' ? ROLE_DUTY_OPTIONS[slot.role]?.find(d => d.duty === slotDuty) : undefined;
      const roleLabel = dutyOpt ? `${slot.role}·${dutyOpt.label.slice(0, 2)}` : `${slot.role}${secondaryFit ? '·兼' : ''}`;
      const cw = 116;
      const ch = 64;

      ctx.save();
      if (isSelected) {
        ctx.translate(sx, sy);
        ctx.scale(1.08, 1.08);
        drawRoundRect(ctx, -cw / 2 + 8, -ch / 2 + 8, cw, ch, 5, THEME.HARD_SHADOW);
        this.drawPlayerCard(ctx, club, player, {
          x: -cw / 2,
          y: -ch / 2,
          w: cw,
          h: ch,
          roleLabel,
          roleBg: !lineFit ? THEME.RED : secondaryFit ? '#1D4ED8' : THEME.BG_PANEL,
          roleFg: '#FFFFFF',
          borderColor: THEME.LIME,
          bgColor: '#FFFDF7',
          borderWidth: 2.4,
          fam,
          isCaptain: player.id === captainId,
          statusBadge: isBlocked
            ? { text: isSuspended ? '停赛' : '伤停', bg: THEME.RED, fg: '#FFFFFF' }
            : !lineFit
            ? { text: '错位', bg: THEME.RED, fg: '#FFFFFF' }
            : undefined,
          detailed: false,
          shadowOffset: 0,
        });
      } else {
        this.drawPlayerCard(ctx, club, player, {
          x: sx - cw / 2,
          y: sy - ch / 2,
          w: cw,
          h: ch,
          roleLabel,
          roleBg: !lineFit ? THEME.RED : secondaryFit ? '#1D4ED8' : THEME.BG_PANEL,
          roleFg: '#FFFFFF',
          borderColor: fitBorder,
          bgColor: isBlocked ? '#FEE2E2' : (canDropBench || isSwapTarget) ? '#ECFCCB' : !lineFit ? '#FEF2F2' : THEME.PAPER_CREAM,
          borderWidth: isBlocked || canDropBench || isSwapTarget || !lineFit ? 2.2 : 1.5,
          fam,
          isCaptain: player.id === captainId,
          statusBadge: isBlocked
            ? { text: isSuspended ? '停赛' : '伤停', bg: THEME.RED, fg: '#FFFFFF' }
            : !lineFit
            ? { text: '错位', bg: THEME.RED, fg: '#FFFFFF' }
            : undefined,
          detailed: false,
          shadowOffset: 3,
        });
      }
      ctx.restore();

      // 错位红粉笔手绘叉号标记
      if (!lineFit) {
        ctx.save();
        ctx.strokeStyle = THEME.RED;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx - cw / 2 + 6, sy - ch / 2 + 6);
        ctx.lineTo(sx - cw / 2 + 18, sy - ch / 2 + 18);
        ctx.moveTo(sx - cw / 2 + 18, sy - ch / 2 + 6);
        ctx.lineTo(sx - cw / 2 + 6, sy - ch / 2 + 18);
        ctx.stroke();
        ctx.restore();
      } else if (fam < 35) {
        ctx.fillStyle = THEME.GOLD;
        ctx.fillRect(sx - cw / 2 + 2, sy - ch / 2 + 6, 3, ch - 12);
      }

      hits.addTouchTarget(sx - cw / 2, sy - ch / 2, cw, ch, () => {
        SoundEngine.playClick();
        if (this.selectedBenchPlayerId) {
          this.swapStarterWithPlayer(league, i, this.selectedBenchPlayerId, actions.onSave, { x: sx, y: sy });
        } else if (this.swapMode && this.selectedStarterIdx !== null) {
          if (this.selectedStarterIdx === i) {
            this.swapMode = false;
          } else {
            this.swapStarterWithPlayer(league, this.selectedStarterIdx, pid, actions.onSave, { x: sx, y: sy });
          }
        } else if (this.selectedStarterIdx === i) {
          this.selectedStarterIdx = null;
          this.swapMode = false;
        } else {
          this.selectedStarterIdx = i;
          this.swapMode = false;
        }
      });
    });

    // 选中首发球员周边浮动快捷操作栏
    if (selectedStarter && this.selectedStarterIdx !== null) {
      const sIdx = this.selectedStarterIdx;
      const coord = slotCoords[sIdx];
      const slotRole = slots[sIdx]?.role;
      const dutyOptions = slotRole ? ROLE_DUTY_OPTIONS[slotRole] : undefined;
      const curDuty = club.slotDuties?.[sIdx] ?? 'default';
      if (coord) {
        if (this.swapMode) {
          const pillW = 240;
          const pillH = 44;
          const px0 = Math.max(pitchX + 6, Math.min(pitchX + pitchW - pillW - 6, Math.round(coord.x - pillW / 2)));
          const placeAbove = coord.y + 40 + pillH > pitchY + pitchH - 6;
          const py0 = placeAbove ? Math.round(coord.y - 40 - pillH) : Math.round(coord.y + 40);
          drawPrintCard(ctx, px0, py0, pillW, pillH, { paper: false, radius: 8, shadowOffset: 4, strokeColor: THEME.LIME, lineWidth: 1.8 });
          hits.add(px0, py0, pillW, pillH, () => {});
          drawText(ctx, '请点队友或右侧替补换人', px0 + 10, py0 + 22, { size: 12, bold: true, color: THEME.LIME });
          drawButton(ctx, hits, px0 + pillW - 58, py0 + 8, 50, 28, '取消', () => {
            this.swapMode = false;
          }, { variant: 'ghost', fontSize: 12 });
        } else {
          const hasDuties = !!(dutyOptions && dutyOptions.length > 0);
          const popW = 276;
          const popH = hasDuties ? 124 : 84;
          const popX = Math.max(pitchX + 6, Math.min(pitchX + pitchW - popW - 6, Math.round(coord.x - popW / 2)));
          const placeAbove = coord.y + 42 + popH > pitchY + pitchH - 6;
          const popY = placeAbove ? Math.round(coord.y - 42 - popH) : Math.round(coord.y + 42);

          drawPrintCard(ctx, popX, popY, popW, popH, { paper: false, radius: 8, shadowOffset: 6, strokeColor: THEME.GOLD_LIGHT, lineWidth: 1.8 });
          hits.add(popX, popY, popW, popH, () => {});

          const tipX = Math.max(popX + 16, Math.min(popX + popW - 16, coord.x));
          ctx.save();
          ctx.fillStyle = THEME.GOLD_LIGHT;
          ctx.beginPath();
          if (placeAbove) {
            ctx.moveTo(tipX - 6, popY + popH);
            ctx.lineTo(tipX + 6, popY + popH);
            ctx.lineTo(tipX, popY + popH + 6);
          } else {
            ctx.moveTo(tipX - 6, popY);
            ctx.lineTo(tipX + 6, popY);
            ctx.lineTo(tipX, popY - 6);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          const shirtTxt = selectedStarter.shirtNumber ? `#${selectedStarter.shirtNumber} ` : '';
          drawText(ctx, fitText(ctx, `${shirtTxt}${selectedStarter.name}`, popW - 110, 14, true, true), popX + 12, popY + 19, { size: 14, bold: true, color: THEME.PAPER_CREAM });
          drawText(ctx, `${slotRole} · CA ${selectedStarter.ca}`, popX + popW - 42, popY + 19, { size: 12, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
          drawButton(ctx, hits, popX + popW - 34, popY + 6, 26, 26, '×', () => {
            this.selectedStarterIdx = null;
            this.swapMode = false;
          }, { variant: 'ghost', fontSize: 13 });

          drawButton(ctx, hits, popX + 12, popY + 38, 122, 32, '换位 / 换人', () => {
            this.swapMode = true;
          }, { variant: 'primary', icon: 'refresh', fontSize: 12 });
          drawButton(ctx, hits, popX + 142, popY + 38, 122, 32, '球员详情', () => {
            actions.onInspectPlayer(selectedStarter);
          }, { variant: 'ghost', icon: 'chart', fontSize: 12 });

          if (hasDuties && dutyOptions) {
            drawText(ctx, '角色', popX + 12, popY + 95, { size: 12, color: THEME.TX3 });
            const availW = popW - 56;
            const gap = 4;
            const btnW = Math.floor((availW - gap * (dutyOptions.length - 1)) / dutyOptions.length);
            dutyOptions.forEach((opt, di) => {
              const bx = popX + 46 + di * (btnW + gap);
              drawButton(ctx, hits, bx, popY + 80, btnW, 30, opt.label.slice(0, 4), () => {
                league.setClubSlotDuty(sIdx, opt.duty);
                actions.onSave();
              }, { active: curDuty === opt.duty, fontSize: 12 });
            });
          }
        }
      }
    }

    if (hoveredLink) {
      const tx = Math.max(pitchX + 4, Math.min(pitchX + pitchW - 232, hoveredMidX - 116));
      const ty = Math.max(pitchY + 6, hoveredMidY - 68);
      const lk = hoveredLink.link;
      drawPrintCard(ctx, tx, ty, 232, 60, { paper: false, radius: 6, shadowOffset: 4, strokeColor: THEME.GOLD_LIGHT, lineWidth: 1.5 });
      const titleTxt = lk.title ? `${hoveredLink.defaultLabel} · ${lk.title}` : hoveredLink.defaultLabel;
      drawText(ctx, `${hoveredLink.playerA.name.slice(0, 4)} × ${hoveredLink.playerB.name.slice(0, 4)}`, tx + 10, ty + 18, { size: 12.5, bold: true, color: THEME.PAPER_CREAM });
      drawText(ctx, titleTxt, tx + 222, ty + 18, { size: 12, bold: true, color: THEME.GOLD_LIGHT, align: 'right' });
      drawText(ctx, `默契 ${Math.round(lk.score)} · 同场 ${lk.matches} · 传 ${lk.passes} · 助 ${lk.assists}`, tx + 10, ty + 42, {
        size: 12,
        color: THEME.LIME,
        mono: true,
      });
    }

    // ==================== 右主区：替补席 2×3 大卡网格 + 位置筛选 (x: 740..1264, w: 524, y: 138..704, h: 566) ====================
    const starterSet = new Set(club.starterIds);
    const allBench = club.squad
      .filter(p => !starterSet.has(p.id))
      .sort((a, b) => b.ca - a.ca);
    const matchBenchPos = (r: string) => {
      if (this.benchFilter === 'ALL') return true;
      if (this.benchFilter === 'GK') return r === 'GK';
      if (this.benchFilter === 'DEF') return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r);
      if (this.benchFilter === 'MID') return ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(r);
      return ['LW', 'RW', 'ST'].includes(r);
    };
    const benchSquad = allBench.filter(p => matchBenchPos(p.role));

    drawPrintCard(ctx, 740, 138, 524, 566, { paper: false, radius: 10, shadowOffset: 4, strokeColor: THEME.BORDER, lineWidth: 1.5 });
    drawText(ctx, `替补席 (${allBench.length}人)`, 758, 162, { size: 16, bold: true, color: THEME.GOLD_LIGHT });
    drawText(
      ctx,
      this.selectedStarterIdx !== null && this.swapMode ? '点击替补卡换入首发' : '点卡选中 · 再点球场换上',
      1246,
      162,
      { size: 12, color: this.selectedStarterIdx !== null && this.swapMode ? THEME.LIME : THEME.TX3, align: 'right' }
    );

    const benchFilters: Array<['ALL' | 'GK' | 'DEF' | 'MID' | 'ATT', string]> = [
      ['ALL', `全部(${allBench.length})`],
      ['GK', '门将'],
      ['DEF', '后卫'],
      ['MID', '中场'],
      ['ATT', '前锋'],
    ];
    benchFilters.forEach(([fk, fl], fi) => {
      const fx = 758 + fi * 68;
      drawButton(ctx, hits, fx, 178, 62, 28, fl, () => {
        this.benchFilter = fk;
        this.benchPage = 0;
      }, { active: this.benchFilter === fk, fontSize: 12 });
    });

    drawButton(ctx, hits, 1138, 178, 108, 28, '⚡ 最佳首发', () => {
      league.updateUserTactics(club.formation, club.style);
      this.selectedStarterIdx = null;
      this.selectedBenchPlayerId = null;
      actions.onSave();
    }, { variant: 'ghost', fontSize: 12 });

    const cols = 2;
    const pageSize = 6;
    const totalPages = Math.max(1, Math.ceil(benchSquad.length / pageSize));
    if (this.benchPage >= totalPages) this.benchPage = totalPages - 1;
    const visibleBench = benchSquad.slice(this.benchPage * pageSize, (this.benchPage + 1) * pageSize);

    visibleBench.forEach((p, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cw = 240;
      const ch = 134;
      const cx = 758 + col * 248;
      const cy = 216 + row * 142;

      const isBenchSelected = this.selectedBenchPlayerId === p.id;
      const isSuspended = (p.suspendedRounds ?? 0) > 0;
      const isInjured = (p.injuredRounds ?? 0) > 0;
      const isBlocked = isSuspended || isInjured;
      const canQuickSwap = this.selectedStarterIdx !== null && this.swapMode && !isBlocked;
      const fam = league.getPlayerFamiliarity(p, club.formation);

      const statusBadge = isBlocked
        ? { text: isSuspended ? '停赛' : '伤停', bg: THEME.RED, fg: '#FFFFFF' }
        : p.strainWarning
        ? { text: '疲惫', bg: '#B45309', fg: '#FEF3C7' }
        : p.morale === 'high'
        ? { text: '高昂', bg: '#166534', fg: '#ECFCCB' }
        : p.morale === 'low'
        ? { text: '低迷', bg: THEME.RED, fg: '#FFFFFF' }
        : p.isNewSigning
        ? { text: '新援', bg: '#1D4ED8', fg: '#FFFFFF' }
        : undefined;

      this.drawPlayerCard(ctx, club, p, {
        x: cx,
        y: cy,
        w: cw,
        h: ch,
        roleLabel: p.role,
        roleBg: tierColor(p.tier),
        roleFg: '#FFFFFF',
        borderColor: isBlocked ? THEME.RED : isBenchSelected ? THEME.LIME : canQuickSwap ? THEME.LIME : THEME.PAPER_INK,
        bgColor: isBlocked ? '#FEE2E2' : isBenchSelected ? '#ECFCCB' : THEME.PAPER_CREAM,
        borderWidth: isBenchSelected || canQuickSwap ? 2.2 : 1.5,
        fam,
        statusBadge,
        detailed: true,
        shadowOffset: isBenchSelected ? 5 : 3,
      });

      hits.addTouchTarget(cx, cy, cw, ch, () => {
        if (isBlocked) {
          SoundEngine.playWarning();
          return;
        }
        SoundEngine.playClick();
        if (this.selectedStarterIdx !== null && this.swapMode) {
          const targetCoord = slotCoords[this.selectedStarterIdx];
          this.swapStarterWithPlayer(league, this.selectedStarterIdx, p.id, actions.onSave, targetCoord);
        } else {
          this.selectedStarterIdx = null;
          this.swapMode = false;
          this.selectedBenchPlayerId = isBenchSelected ? null : p.id;
        }
      });
    });

    if (totalPages > 1) {
      drawButton(ctx, hits, 758, 658, 112, 32, '上一页', () => {
        this.benchPage = Math.max(0, this.benchPage - 1);
      }, { disabled: this.benchPage === 0, fontSize: 12.5 });
      drawText(ctx, `第 ${this.benchPage + 1} / ${totalPages} 页（共 ${benchSquad.length} 人）`, 1002, 674, {
        size: 12.5,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, 1134, 658, 112, 32, '下一页', () => {
        this.benchPage = Math.min(totalPages - 1, this.benchPage + 1);
      }, { disabled: this.benchPage >= totalPages - 1, fontSize: 12.5 });
    } else {
      drawText(ctx, `当前筛选 ${benchSquad.length} 名替补`, 1002, 674, {
        size: 12.5,
        color: THEME.TX3,
        align: 'center',
      });
    }

    if (this.styleModalOpen) {
      this.renderStyleModal(ctx, hits, league, actions);
    } else if (this.presetModalOpen) {
      this.renderPresetModal(ctx, hits, league, actions);
    }
  }

  /**
   * 独立抽屉浮层：三大防线体系 × 16 阵型 + 六大战术风格 + 实时参数与三线战力
   */
  private renderStyleModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: { onSave: () => void }
  ): void {
    ctx.fillStyle = 'rgba(7, 16, 12, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 110;
    const my = 56;
    const mw = 1060;
    const mh = 608;
    drawPrintCard(ctx, mx, my, mw, mh, { paper: false, radius: 12, shadowOffset: 6, strokeColor: THEME.BORDER_GOLD, lineWidth: 2 });

    const club = league.getUserClub();
    drawText(ctx, '阵型体系与战术风格配置', mx + 28, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '切换阵型后自动调整默认站位，返回球场即可继续微调首发人选', mx + 28, my + 58, { size: 12.5, color: THEME.TX2 });
    drawButton(ctx, hits, mx + mw - 118, my + 20, 94, 34, '完成并返回', () => {
      this.styleModalOpen = false;
    }, { variant: 'gold', fontSize: 12.5 });

    drawPrintCard(ctx, mx + 28, my + 82, 540, 498, { paper: false, radius: 10, shadowOffset: 3, strokeColor: THEME.BORDER, lineWidth: 1.5 });
    drawText(ctx, '一、选择防线体系与阵型', mx + 46, my + 106, { size: 14.5, bold: true, color: THEME.GOLD_LIGHT });

    const curSys = this.activeSysTab ?? getDefenseSystem(club.formation);
    SYS_LIST.forEach((sys, si) => {
      const label = sys === '4-back' ? '4 后卫体系 (8阵)' : sys === '3-back' ? '3 后卫体系 (4阵)' : '5 后卫体系 (4阵)';
      drawButton(ctx, hits, mx + 46 + si * 170, my + 124, 162, 32, label, () => {
        this.activeSysTab = sys;
      }, { active: curSys === sys, fontSize: 12 });
    });

    const sysForms = FORMATION_SYSTEMS[curSys].formations;
    sysForms.forEach((f, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawButton(
        ctx,
        hits,
        mx + 46 + col * 256,
        my + 168 + row * 38,
        244,
        32,
        f,
        () => {
          league.updateUserTactics(f, club.style);
          this.activeSysTab = getDefenseSystem(f);
          this.selectedStarterIdx = null;
          this.selectedBenchPlayerId = null;
          actions.onSave();
        },
        { active: club.formation === f, fontSize: 13 }
      );
    });

    drawText(ctx, '二、选择战术风格 (2×3)', mx + 46, my + 344, { size: 14.5, bold: true, color: THEME.GOLD_LIGHT });
    STYLE_LIST.forEach((s, idx) => {
      const preset = TACTICAL_PRESETS[s];
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawButton(
        ctx,
        hits,
        mx + 46 + col * 256,
        my + 366 + row * 56,
        244,
        46,
        preset.name,
        () => {
          league.updateUserTactics(club.formation, s, club.starterIds);
          actions.onSave();
        },
        { active: club.style === s, fontSize: 13.5 }
      );
    });

    const activePreset = TACTICAL_PRESETS[club.style];
    const mastery = league.getTacticalMastery();
    const formLv = Math.min(3, (mastery.formations[club.formation] ?? 0) >= 15 ? 3 : (mastery.formations[club.formation] ?? 0) >= 6 ? 2 : 1);
    const styleLv = Math.min(3, (mastery.styles[club.style] ?? 0) >= 15 ? 3 : (mastery.styles[club.style] ?? 0) >= 6 ? 2 : 1);

    drawPrintCard(ctx, mx + 586, my + 82, 446, 268, { paper: false, radius: 10, shadowOffset: 3, strokeColor: THEME.BORDER_GOLD, lineWidth: 1.5 });
    drawText(ctx, `${activePreset.name} · 风格熟练 Lv.${styleLv}`, mx + 606, my + 110, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
    drawBadge(ctx, mx + 914, my + 98, 98, 24, `阵型 Lv.${formLv}`, formLv >= 2 ? '#14532D' : THEME.BG_DEEP, formLv >= 2 ? THEME.LIME : THEME.TX2);

    const styleBars: Array<[string, number, string, string]> = [
      ['防线高度', (activePreset.lineHeight + 8) / 16, `${activePreset.lineHeight >= 0 ? '+' : ''}${activePreset.lineHeight}m`, '#38BDF8'],
      ['逼抢强度', (activePreset.pressIntensity - 0.5) / 1.0, `${Math.round(activePreset.pressIntensity * 100)}%`, THEME.RED_LIGHT],
      ['比赛节奏', (activePreset.tempo - 0.7) / 0.6, `${activePreset.tempo.toFixed(2)}x`, THEME.GOLD_LIGHT],
      ['直传倾角', activePreset.directness, `${Math.round(activePreset.directness * 100)}%`, THEME.LIME],
    ];
    styleBars.forEach(([lbl, ratio, txt, col], si) => {
      const sy = my + 154 + si * 46;
      const pct = Math.max(0.08, Math.min(1, ratio));
      drawText(ctx, lbl, mx + 606, sy, { size: 13.5, color: THEME.TX2 });
      drawRoundRect(ctx, mx + 694, sy - 6, 240, 12, 5, THEME.BG_DEEP);
      drawRoundRect(ctx, mx + 694, sy - 6, Math.round(pct * 240), 12, 5, col);
      drawText(ctx, txt, mx + 1012, sy, { size: 13.5, bold: true, color: col, align: 'right', mono: true });
    });

    const lineRatings = this.getLineRatings(league);
    drawPrintCard(ctx, mx + 586, my + 368, 446, 212, { paper: false, radius: 10, shadowOffset: 3, strokeColor: THEME.BORDER, lineWidth: 1.5 });
    drawText(ctx, '当前首发三线实时战力', mx + 606, my + 396, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
    const lines: Array<[string, number, string, 'sword' | 'ball' | 'shield']> = [
      ['锋线进攻', lineRatings.att, THEME.RED_LIGHT, 'sword'],
      ['中场调度', lineRatings.mid, '#38BDF8', 'ball'],
      ['防线稳固', lineRatings.def, THEME.LIME, 'shield'],
    ];
    lines.forEach(([lbl, val, col, ic], li) => {
      const ly = my + 440 + li * 44;
      drawIcon(ctx, ic, mx + 614, ly, 15, col);
      drawText(ctx, lbl, mx + 634, ly, { size: 13.5, color: THEME.TX2 });
      drawRoundRect(ctx, mx + 720, ly - 6, 224, 12, 5, THEME.BG_DEEP);
      drawRoundRect(ctx, mx + 720, ly - 6, Math.round((Math.min(99, val) / 99) * 224), 12, 5, col);
      drawText(ctx, `${val}`, mx + 1012, ly, { size: 14, bold: true, color: col, align: 'right', mono: true });
    });
  }

  private renderLoadoutStudio(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onNavigate: (tab: NavRailTab) => void;
      onSave: () => void;
    }
  ): void {
    const club = league.getUserClub();
    const ast = league.getV6Astrolabe();
    const rogue = league.getV6SeasonRogue();
    const cfg = league.getV6MatchRuntimeConfig();
    const activeSeg: V6CheckpointKey = ast.useUniversalPool ? 's1' : this.loadoutSeg;
    const poolEntries = league.getV6CheckpointDirectives(activeSeg);
    const poolIdSet = new Set(ast.checkpointPools[activeSeg] ?? []);

    const zColor = (z: 'ATT' | 'MID' | 'DEF') => (z === 'ATT' ? THEME.RED : z === 'MID' ? '#2B6BE6' : '#16A34A');
    const zLabel = (z: 'ATT' | 'MID' | 'DEF') => (z === 'ATT' ? '前场' : z === 'MID' ? '中场' : '后场');

    // ==================== 上半部左栏：四赛段临场指令槽 (x: 96..816, y: 136..332, w: 720, h: 196) ====================
    drawPrintCard(ctx, 96, 136, 720, 196, { paper: false, radius: 10, shadowOffset: 4, strokeColor: THEME.BORDER_GOLD, lineWidth: 1.5 });
    drawText(ctx, `四赛段出战指令池 (每段+${cfg.checkpointTpBase}TP · 结余≤${cfg.maxCarryTp}TP)`, 112, 156, {
      size: 13,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });

    drawButton(
      ctx,
      hits,
      404,
      142,
      98,
      28,
      ast.useUniversalPool ? '通用4卡 ✓' : '四段独立配',
      () => {
        league.setV6UniversalPool(!ast.useUniversalPool);
        this.loadoutToast = !ast.useUniversalPool ? '已开启【通用4卡全场复用】' : '已切换为四赛段独立定制模式';
        actions.onSave();
      },
      { active: ast.useUniversalPool, fontSize: 12 }
    );

    V6_SEGMENTS.forEach((seg, si) => {
      const act = activeSeg === seg.key && !ast.useUniversalPool;
      drawButton(
        ctx,
        hits,
        508 + si * 48,
        142,
        45,
        28,
        seg.shortLabel,
        () => {
          if (ast.useUniversalPool) {
            league.setV6UniversalPool(false);
          }
          this.loadoutSeg = seg.key;
        },
        { active: act || (ast.useUniversalPool && si === 0), fontSize: 12 }
      );
    });

    drawButton(
      ctx,
      hits,
      704,
      142,
      100,
      28,
      '⚡智能配齐',
      () => {
        const r = league.autoFillV6LoadoutForClub();
        SoundEngine.playRewardChime();
        this.loadoutToast = `已按【${club.formation}·${TACTICAL_PRESETS[club.style].name}】智能配齐 ${r.filledDirectives} 张指令 + ${r.filledSkills} 个绝技！`;
        actions.onSave();
      },
      { variant: 'gold', fontSize: 12 }
    );

    // 4 个大号清晰指令槽位 (166 × 144, >= 140px)
    for (let i = 0; i < 4; i++) {
      const sx = 110 + i * 174;
      const sy = 178;
      const sw = 166;
      const sh = 144;
      const entry = poolEntries[i];
      if (entry) {
        const { def, effectiveTpCost, satellites, enchant, isGreenSynergy, isOverclocked } = entry;
        const zc = zColor(def.zone);
        const isSel = this.libMode === 'directives' && this.inspectDirectiveId === def.id;
        drawPrintCard(ctx, sx, sy, sw, sh, { paper: true, radius: 8, shadowOffset: isSel ? 5 : 3, strokeColor: isSel ? THEME.GOLD_LIGHT : zc, lineWidth: isSel ? 2.2 : 1.6 });
        drawBadge(ctx, sx + 8, sy + 8, 52, 20, `${zLabel(def.zone)}·${def.tendency === 'ATK' ? '攻' : '守'}`, zc, '#FFFFFF');
        drawBadge(
          ctx,
          sx + 64,
          sy + 8,
          42,
          20,
          `${effectiveTpCost}TP`,
          effectiveTpCost < def.tpCost ? '#166534' : THEME.PAPER_INK,
          THEME.GOLD_LIGHT
        );
        if (isGreenSynergy) {
          drawBadge(ctx, sx + 109, sy + 8, 32, 20, '契', '#166534', THEME.LIME);
        }
        drawButton(ctx, hits, sx + sw - 26, sy + 6, 22, 22, '×', () => {
          league.toggleV6CheckpointCard(activeSeg, def.id);
          SoundEngine.playClick();
          actions.onSave();
        }, { variant: 'ghost', fontSize: 12 });

        // 嵌入 16 张临场指令方形漫画剪报画窗（1.5px 墨线框，不遮挡标题与 TP 角标）
        const dirImg = AssetLoader.get(getDirectiveAssetId({ source: def.source, style: def.style, system: def.defenseSystem, tendency: def.tendency, zone: def.zone }));
        if (dirImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(sx + 8, sy + 34, 46, 46, 4);
          ctx.clip();
          ctx.drawImage(dirImg, sx + 8, sy + 34, 46, 46);
          ctx.restore();
          drawRoundRect(ctx, sx + 8, sy + 34, 46, 46, 4, undefined, THEME.INK_LINE, 1.5);
        }
        const titleX = dirImg ? sx + 60 : sx + 10;
        const titleMaxW = dirImg ? sw - 68 : sw - 16;
        drawText(ctx, fitText(ctx, def.name, titleMaxW, 13.5, true, true), titleX, sy + 46, {
          size: 13.5,
          bold: true,
          color: THEME.PAPER_INK,
        });
        drawText(ctx, fitText(ctx, `+ ${def.benefitSummary}`, titleMaxW, 12, false, true), titleX, sy + 68, {
          size: 12,
          color: '#166534',
        });
        const enchOrSat = enchant
          ? `✦附魔：${V6_DIRECTIVE_ENCHANTS[enchant].name}`
          : satellites.length > 0
          ? `★卫星 ${satellites.join('+')}${isOverclocked ? '(超频)' : ''}`
          : `- ${def.riskSummary}`;
        drawText(ctx, fitText(ctx, enchOrSat, sw - 18, 12, false, true), sx + 10, sy + 108, {
          size: 12,
          color: enchant ? '#6D28D9' : satellites.length > 0 ? '#9A6B12' : '#B91C1C',
        });

        hits.addTouchTarget(sx, sy + 30, sw, sh - 30, () => {
          this.libMode = 'directives';
          this.inspectDirectiveId = def.id;
        });
      } else {
        drawPrintCard(ctx, sx, sy, sw, sh, { paper: false, radius: 8, shadowOffset: 2, strokeColor: THEME.BORDER, lineWidth: 1.2 });
        drawText(ctx, `+ 指令槽 ${i + 1}`, sx + sw / 2, sy + 58, { size: 14, bold: true, color: THEME.TX3, align: 'center' });
        drawText(ctx, '从下方牌库装配', sx + sw / 2, sy + 84, { size: 12, color: THEME.TX3, align: 'center' });
        hits.addTouchTarget(sx, sy, sw, sh, () => {
          this.libMode = 'directives';
        });
      }
    }

    // ==================== 上半部右栏：F1-F4 主动技槽 + 赛季圣物5槽展示 (x: 826..1264, y: 136..332, w: 438, h: 196) ====================
    drawPrintCard(ctx, 826, 136, 438, 196, { paper: false, topBandColor: THEME.COBALT, topBandHeight: 4, radius: 8, shadowOffset: 4, strokeColor: THEME.INK_LINE, lineWidth: 2 });
    drawText(ctx, `F1–F4 子弹时间绝技 (${ast.equippedSkills.length}/4)`, 842, 155, { size: 13, bold: true, color: THEME.LIME });
    drawButton(ctx, hits, 1140, 142, 112, 26, '浏览全部绝技', () => {
      this.libMode = 'skills';
      this.libPage = 0;
    }, { active: this.libMode === 'skills', fontSize: 12 });

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = 840 + col * 208;
      const sy = 172 + row * 48;
      const sw = 200;
      const sh = 42;
      const sid = ast.equippedSkills[i];
      const sk = sid ? V6_ACTIVE_SKILL_MAP[sid] : undefined;
      if (sk && sid) {
        const br = ast.skillBranchChoice[sid] ?? 'A';
        const isOv = rogue.overloadedSkills.includes(sid);
        const isSel = this.libMode === 'skills' && this.inspectSkillId === sid;
        drawPrintCard(ctx, sx, sy, sw, sh, { paper: true, radius: 5, shadowOffset: 2, strokeColor: isSel ? THEME.VERMILION : THEME.INK_LINE, lineWidth: isSel ? 2.2 : 1.8 });
        const skImg = AssetLoader.get(getSkillAssetId(sk.id, sk.style, sk.tendency));
        if (skImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.translate(sx + 20, sy + 21);
          ctx.rotate((i % 2 === 0 ? -2 : 2) * Math.PI / 180);
          ctx.drawImage(skImg, -16, -16, 32, 32);
          ctx.restore();
        }
        const skTextX = skImg ? sx + 38 : sx + 37;
        if (!skImg) drawBadge(ctx, sx + 5, sy + 5, 28, 17, `F${i + 1}`, THEME.BG_PANEL, THEME.LIME);
        drawText(ctx, fitText(ctx, `F${i + 1} ${sk.name}`, 100, 12, true, true), skTextX, sy + 14, { size: 12, bold: true, color: THEME.PAPER_INK });
        drawText(ctx, fitText(ctx, isOv ? '★A+B双支过载' : `${br === 'B' ? sk.branchB.label : sk.branchA.label}`, 100, 12, false, true), skTextX, sy + 32, {
          size: 12,
          color: isOv ? THEME.VERMILION : THEME.COBALT,
        });
        drawButton(ctx, hits, sx + sw - 58, sy + 7, 32, 28, isOv ? 'AB' : `${br}支`, () => {
          const nextBr = br === 'A' ? 'B' : 'A';
          league.setV6SkillBranch(sid, nextBr);
          SoundEngine.playClick();
          actions.onSave();
        }, { variant: 'primary', fontSize: 12 });
        drawButton(ctx, hits, sx + sw - 23, sy + 7, 18, 28, '×', () => {
          league.toggleV6EquippedSkill(sid);
          SoundEngine.playClick();
          actions.onSave();
        }, { variant: 'ghost', fontSize: 12 });
        hits.addTouchTarget(sx, sy, sw - 60, sh, () => {
          this.libMode = 'skills';
          this.inspectSkillId = sid;
        });
      } else {
        drawPrintCard(ctx, sx, sy, sw, sh, { paper: false, radius: 5, shadowOffset: 2, strokeColor: THEME.INK_LINE, lineWidth: 1.5 });
        drawText(ctx, `F${i + 1} 空槽 · 点击装配`, sx + sw / 2, sy + 21, { size: 12, color: THEME.TX3, align: 'center' });
        hits.addTouchTarget(sx, sy, sw, sh, () => {
          this.libMode = 'skills';
          this.libPage = 0;
        });
      }
    }

    // 本季圣物 5 槽实体展台（接入 8 张圣物模切贴纸，点击/悬停展示完整效果）
    const relics = rogue.seasonRelics.slice(0, 5);
    const relicTopY = 272;
    let hoveredRelicTip = '';
    const rSlotW = 78;
    const rGap = 6;
    for (let ri = 0; ri < 5; ri++) {
      const rxS = 840 + ri * (rSlotW + rGap);
      const rId = relics[ri];
      const rDef = rId ? V6_RELICS[rId] : null;
      const isHov = hits.isHovered(rxS, relicTopY, rSlotW, 34);
      if (rDef && rId) {
        const rarCol = rDef.rarity === 'mythic' ? THEME.VERMILION : rDef.rarity === 'gold' ? THEME.BRASS : THEME.VIOLET;
        drawRoundRect(ctx, rxS + 2, relicTopY + 2, rSlotW, 34, 4, THEME.HARD_SHADOW);
        drawRoundRect(ctx, rxS, relicTopY, rSlotW, 34, 4, THEME.PAPER_CREAM, rarCol, 2);
        const rArtId = getRelicAssetId(rId);
        const rImg = rArtId ? AssetLoader.get(rArtId) : null;
        if (rImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.translate(rxS + 16, relicTopY + 17);
          ctx.rotate((ri % 2 === 0 ? -2 : 2) * Math.PI / 180);
          ctx.drawImage(rImg, -14, -14, 28, 28);
          ctx.restore();
          drawText(ctx, fitText(ctx, rDef.name, rSlotW - 34, 11.5, true, true), rxS + 32, relicTopY + 17, {
            size: 11.5,
            rawSize: true,
            bold: true,
            color: THEME.PAPER_INK,
          });
        } else {
          drawText(ctx, fitText(ctx, rDef.name, rSlotW - 8, 12, true, true), rxS + rSlotW / 2, relicTopY + 17, {
            size: 12,
            bold: true,
            color: THEME.PAPER_INK,
            align: 'center',
          });
        }
        if (isHov || this.selectedRelicId === rId) {
          hoveredRelicTip = `【${rDef.name}】${rDef.desc}`;
        }
        hits.addTouchTarget(rxS, relicTopY, rSlotW, 34, () => {
          this.selectedRelicId = this.selectedRelicId === rId ? null : rId;
          this.loadoutToast = `圣物【${rDef.name}】：${rDef.desc}`;
          SoundEngine.playClick();
        });
      } else {
        ctx.save();
        drawRoundRect(ctx, rxS, relicTopY, rSlotW, 34, 4, THEME.BG_DEEP);
        ctx.strokeStyle = 'rgba(154, 176, 163, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(rxS + 1, relicTopY + 1, rSlotW - 2, 32);
        ctx.restore();
        drawText(ctx, `圣物${ri + 1}`, rxS + rSlotW / 2, relicTopY + 17, { size: 12, color: THEME.TX3, align: 'center' });
      }
    }
    const borrowedTxt = rogue.borrowedFusion ? ` · 借用奇点【${V6_FUSION_MAP[rogue.borrowedFusion.id]?.name ?? ''}】` : '';
    drawText(
      ctx,
      hoveredRelicTip ? fitText(ctx, hoveredRelicTip, 412, 12) : fitText(ctx, `本季圣物 (${relics.length}/5)${borrowedTxt} · 点击槽位查详情`, 412, 12),
      840,
      320,
      { size: 12, bold: !!hoveredRelicTip, color: hoveredRelicTip ? THEME.LIME : THEME.TX2 }
    );

    // ==================== 下半部左栏：已解锁牌库 / 绝技库浏览器 (x: 96..848, y: 342..704, w: 752, h: 362) ====================
    drawPrintCard(ctx, 96, 342, 752, 362, { paper: false, radius: 10, shadowOffset: 4, strokeColor: THEME.BORDER, lineWidth: 1.5 });
    drawButton(ctx, hits, 110, 350, 148, 28, `已解锁手牌 (${ast.unlockedDirectives.length})`, () => {
      this.libMode = 'directives';
      this.libPage = 0;
    }, { active: this.libMode === 'directives', fontSize: 12 });
    drawButton(ctx, hits, 264, 350, 148, 28, `已解锁绝技 (${ast.unlockedSkills.length})`, () => {
      this.libMode = 'skills';
      this.libPage = 0;
    }, { active: this.libMode === 'skills', fontSize: 12 });

    if (this.libMode === 'directives') {
      const zTabs: Array<['ALL' | 'ATT' | 'MID' | 'DEF', string]> = [
        ['ALL', '全区'],
        ['ATT', '前场'],
        ['MID', '中场'],
        ['DEF', '后场'],
      ];
      zTabs.forEach(([zk, zlbl], zi) => {
        drawButton(ctx, hits, 422 + zi * 46, 350, 42, 28, zlbl, () => {
          this.zoneFilter = zk;
          this.libPage = 0;
        }, { active: this.zoneFilter === zk, fontSize: 12 });
      });
      const tTabs: Array<['ALL' | 'ATK' | 'DEF', string]> = [
        ['ALL', '全'],
        ['ATK', '攻'],
        ['DEF', '守'],
      ];
      tTabs.forEach(([tk, tlbl], ti) => {
        drawButton(ctx, hits, 612 + ti * 38, 350, 34, 28, tlbl, () => {
          this.tendFilter = tk;
          this.libPage = 0;
        }, { active: this.tendFilter === tk, fontSize: 12 });
      });
    }

    drawButton(ctx, hits, 732, 350, 104, 28, '去星盘解锁 ▶', () => {
      actions.onNavigate('meta');
    }, { variant: 'primary', fontSize: 12 });

    if (this.libMode === 'directives') {
      const filteredDirs = ast.unlockedDirectives
        .map(id => V6_DIRECTIVE_MAP[id])
        .filter((d): d is V6DirectiveDef => !!d)
        .filter(d => (this.zoneFilter === 'ALL' || d.zone === this.zoneFilter) && (this.tendFilter === 'ALL' || d.tendency === this.tendFilter))
        .sort((a, b) => {
          const synA = a.formation === club.formation || a.style === club.style ? 1 : 0;
          const synB = b.formation === club.formation || b.style === club.style ? 1 : 0;
          return synB !== synA ? synB - synA : a.tpCost - b.tpCost;
        });

      const pageSize = 8;
      const totalPages = Math.max(1, Math.ceil(filteredDirs.length / pageSize));
      const curPage = Math.min(this.libPage, totalPages - 1);
      const pageItems = filteredDirs.slice(curPage * pageSize, (curPage + 1) * pageSize);
      if (!this.inspectDirectiveId && pageItems[0]) this.inspectDirectiveId = pageItems[0].id;

      pageItems.forEach((d, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cx = 112 + col * 364;
        const cy = 386 + row * 66;
        const cw = 354;
        const ch = 60;
        const isEq = poolIdSet.has(d.id);
        const isSel = this.inspectDirectiveId === d.id;
        const zc = zColor(d.zone);
        const isGreen = d.style === club.style || d.formation === club.formation;
        const ench = rogue.directiveEnchants[d.id];
        const satCount = rogue.overclockedDirectives.includes(d.id) ? 3 : (ast.directiveSatellites[d.id]?.length ?? 0);

        drawPrintCard(ctx, cx, cy, cw, ch, { paper: true, radius: 7, shadowOffset: 2, strokeColor: isSel ? THEME.GOLD_LIGHT : isEq ? '#16A34A' : zc, lineWidth: isSel ? 2 : 1.4 });
        const dImg = AssetLoader.get(getDirectiveAssetId({ source: d.source, style: d.style, system: d.defenseSystem, tendency: d.tendency, zone: d.zone }));
        if (dImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cx + 8, cy + 8, 44, 44, 4);
          ctx.clip();
          ctx.drawImage(dImg, cx + 8, cy + 8, 44, 44);
          ctx.restore();
          drawRoundRect(ctx, cx + 8, cy + 8, 44, 44, 4, undefined, THEME.INK_LINE, 1.5);
        }
        const dOx = dImg ? 50 : 0;
        drawBadge(ctx, cx + 8 + dOx, cy + 7, 48, 18, `${zLabel(d.zone)}·${d.tendency === 'ATK' ? '攻' : '守'}`, zc, '#FFFFFF');
        drawBadge(ctx, cx + 60 + dOx, cy + 7, 36, 18, `${d.tpCost}TP`, THEME.PAPER_INK, THEME.GOLD_LIGHT);
        drawText(ctx, fitText(ctx, `${d.name}${satCount > 0 ? ` ★${satCount}` : ''}${ench ? ' ✦' : ''}`, 152 - dOx, 13, true, true), cx + 100 + dOx, cy + 16, {
          size: 13,
          bold: true,
          color: THEME.PAPER_INK,
        });
        if (isGreen) {
          drawText(ctx, '✓契合', cx + cw - 78, cy + 16, { size: 12, bold: true, color: '#166534', align: 'right' });
        }
        drawText(ctx, fitText(ctx, `+${d.benefitSummary}`, cw - 92 - dOx, 12, false, true), cx + 10 + dOx, cy + 40, { size: 12, color: '#166534' });

        drawButton(ctx, hits, cx + cw - 72, cy + 15, 62, 30, isEq ? '已装 ✓' : '装配', () => {
          this.inspectDirectiveId = d.id;
          const res = league.toggleV6CheckpointCard(activeSeg, d.id);
          if (!res.ok) {
            SoundEngine.playWarning();
            this.loadoutToast = res.reason || '槽位已满';
          } else {
            SoundEngine.playClick();
            actions.onSave();
          }
        }, { variant: isEq ? 'green' : 'primary', fontSize: 12 });

        hits.addTouchTarget(cx, cy, cw - 76, ch, () => {
          this.inspectDirectiveId = d.id;
        });
      });

      drawButton(ctx, hits, 332, 660, 78, 30, '◀ 上页', () => {
        this.libPage = Math.max(0, curPage - 1);
      }, { disabled: curPage === 0, fontSize: 12 });
      drawText(ctx, `${curPage + 1} / ${totalPages} 页`, 472, 675, { size: 12.5, color: THEME.TX2, align: 'center' });
      drawButton(ctx, hits, 536, 660, 78, 30, '下页 ▶', () => {
        this.libPage = Math.min(totalPages - 1, curPage + 1);
      }, { disabled: curPage >= totalPages - 1, fontSize: 12 });
    } else {
      const unlockedSkills = ast.unlockedSkills
        .map(id => V6_ACTIVE_SKILL_MAP[id])
        .filter((s): s is NonNullable<typeof s> => !!s);
      const eqSet = new Set(ast.equippedSkills);
      const pageSize = 8;
      const totalPages = Math.max(1, Math.ceil(unlockedSkills.length / pageSize));
      const curPage = Math.min(this.libPage, totalPages - 1);
      const pageItems = unlockedSkills.slice(curPage * pageSize, (curPage + 1) * pageSize);
      if (!this.inspectSkillId && pageItems[0]) this.inspectSkillId = pageItems[0].id;

      pageItems.forEach((sk, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cx = 112 + col * 364;
        const cy = 386 + row * 66;
        const cw = 354;
        const ch = 60;
        const isEq = eqSet.has(sk.id);
        const isSel = this.inspectSkillId === sk.id;
        drawPrintCard(ctx, cx, cy, cw, ch, { paper: true, radius: 7, shadowOffset: 2, strokeColor: isSel ? THEME.GOLD_LIGHT : isEq ? '#2B6BE6' : THEME.PAPER_INK, lineWidth: isSel ? 2 : 1.4 });
        const skImg = AssetLoader.get(getSkillAssetId(sk.id, sk.style, sk.tendency));
        if (skImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.translate(cx + 28, cy + 30);
          ctx.rotate((idx % 2 === 0 ? -2 : 2) * Math.PI / 180);
          ctx.drawImage(skImg, -21, -21, 42, 42);
          ctx.restore();
        }
        const sOx = skImg ? 48 : 0;
        drawBadge(ctx, cx + 8 + sOx, cy + 7, 74, 18, `CD ${sk.cooldownMinutes}'·${sk.maxPerMatch}次`, '#082F49', '#7DD3FC');
        drawText(ctx, fitText(ctx, sk.name, 176 - sOx, 13, true, true), cx + 86 + sOx, cy + 16, { size: 13, bold: true, color: THEME.PAPER_INK });
        drawText(ctx, fitText(ctx, `${sk.situationLabel} → ${sk.instantLabel}`, cw - 92 - sOx, 12, false, true), cx + 10 + sOx, cy + 40, {
          size: 12,
          color: '#1E3A8A',
        });
        drawButton(ctx, hits, cx + cw - 72, cy + 15, 62, 30, isEq ? '已装 ✓' : '装备', () => {
          this.inspectSkillId = sk.id;
          const res = league.toggleV6EquippedSkill(sk.id);
          if (!res.ok) {
            SoundEngine.playWarning();
            this.loadoutToast = res.reason || '主动技槽已满';
          } else {
            SoundEngine.playClick();
            actions.onSave();
          }
        }, { variant: isEq ? 'green' : 'primary', fontSize: 12 });
        hits.addTouchTarget(cx, cy, cw - 76, ch, () => {
          this.inspectSkillId = sk.id;
        });
      });
    }

    if (this.loadoutToast) {
      drawText(ctx, fitText(ctx, this.loadoutToast, 210, 12), 116, 675, { size: 12, color: THEME.GOLD_LIGHT });
    }

    // ==================== 下半部右栏：选中手牌 / 绝技高清检视台 (x: 858..1264, y: 342..704, w: 406, h: 362) ====================
    const ix = 858;
    const iy = 342;
    const iw = 406;
    const ih = 362;
    drawPrintCard(ctx, ix, iy, iw, ih, { paper: false, radius: 10, shadowOffset: 4, strokeColor: THEME.BORDER_GOLD, lineWidth: 1.5 });

    if (this.libMode === 'directives') {
      const selId = this.inspectDirectiveId ?? ast.checkpointPools[activeSeg]?.[0] ?? ast.unlockedDirectives[0];
      const def = selId ? V6_DIRECTIVE_MAP[selId] : undefined;
      if (def) {
        const zc = zColor(def.zone);
        const isEq = poolIdSet.has(def.id);
        const isGreen = def.style === club.style || def.formation === club.formation;
        const isOc = rogue.overclockedDirectives.includes(def.id);
        const sats = isOc ? ['A', 'B', 'C'] : (ast.directiveSatellites[def.id] ?? []);
        const ench = rogue.directiveEnchants[def.id];

        drawBadge(ctx, ix + 18, iy + 14, 68, 22, `${zLabel(def.zone)}·${def.tendency === 'ATK' ? '主攻' : '稳守'}`, zc, '#FFFFFF');
        drawBadge(ctx, ix + 92, iy + 14, 48, 22, `${def.tpCost} TP`, THEME.PAPER_INK, THEME.GOLD_LIGHT);
        const srcTxt = def.source === 'fusion' ? '融合王牌' : def.formation ? `${def.formation}专属` : STYLE_LABELS[def.style ?? 'balanced'].name;
        drawBadge(ctx, ix + 146, iy + 14, 92, 22, srcTxt, THEME.BG_DEEP, THEME.PAPER_CREAM);
        if (isGreen) {
          drawBadge(ctx, ix + iw - 102, iy + 14, 84, 22, '✓ 契合', '#14532D', THEME.LIME);
        }

        drawText(ctx, `《${def.name}》`, ix + 18, iy + 54, { size: 17, bold: true, color: THEME.GOLD_LIGHT });
        drawText(ctx, `${def.durationMinutes}分钟`, ix + iw - 18, iy + 54, { size: 12, color: THEME.TX2, align: 'right' });

        drawRoundRect(ctx, ix + 18, iy + 72, iw - 36, 44, 6, 'rgba(20, 83, 45, 0.35)', '#22C55E', 1);
        drawWrappedText(ctx, `+ ${def.benefitSummary}`, ix + 26, iy + 86, iw - 52, 16, { size: 12, bold: true, color: THEME.LIME, maxLines: 2 });

        drawRoundRect(ctx, ix + 18, iy + 122, iw - 36, 44, 6, 'rgba(127, 29, 29, 0.35)', THEME.RED_LIGHT, 1);
        drawWrappedText(ctx, `- ${def.riskSummary}`, ix + 26, iy + 136, iw - 52, 16, { size: 12, color: '#FCA5A5', maxLines: 2 });

        if (ench) {
          const ei = V6_DIRECTIVE_ENCHANTS[ench];
          drawRoundRect(ctx, ix + 18, iy + 172, iw - 36, 30, 6, 'rgba(59, 31, 110, 0.45)', '#C084FC', 1);
          drawText(ctx, fitText(ctx, `✦附魔【${ei.name}】：${ei.desc}`, iw - 52, 12), ix + 26, iy + 187, { size: 12, bold: true, color: '#E9D5FF' });
        }

        const satStartY = ench ? iy + 208 : iy + 174;
        (['A', 'B', 'C'] as const).forEach((sk, si) => {
          const sDef = def.satellites[sk];
          const lit = sats.includes(sk);
          const sy2 = satStartY + si * 34;
          drawRoundRect(ctx, ix + 18, sy2, iw - 36, 30, 6, lit ? 'rgba(120, 53, 15, 0.4)' : THEME.BG_DEEP, lit ? THEME.GOLD_LIGHT : THEME.BORDER, 1);
          drawText(ctx, `${lit ? '★' : '☆'}卫星${sk}: ${fitText(ctx, sDef.desc, iw - 128, 12)}`, ix + 26, sy2 + 15, {
            size: 12,
            bold: lit,
            color: lit ? THEME.GOLD_LIGHT : THEME.TX2,
          });
          if (!lit) {
            drawButton(ctx, hits, ix + iw - 78, sy2 + 3, 54, 24, `+${sDef.cost}pt`, () => {
              const r = league.unlockV6DirectiveSatellite(def.id, sk);
              if (r.ok) {
                SoundEngine.playRewardChime();
                actions.onSave();
              } else {
                SoundEngine.playWarning();
                this.loadoutToast = r.reason || '星盘点不足';
              }
            }, { variant: 'ghost', fontSize: 12 });
          }
        });

        drawButton(
          ctx,
          hits,
          ix + 18,
          iy + ih - 48,
          iw - 36,
          36,
          isEq ? '从当前赛段槽位卸下' : `装配至 ${ast.useUniversalPool ? '通用四赛段池' : V6_SEGMENTS.find(s => s.key === activeSeg)?.range}`,
          () => {
            const res = league.toggleV6CheckpointCard(activeSeg, def.id);
            if (!res.ok) {
              SoundEngine.playWarning();
              this.loadoutToast = res.reason || '槽位已满';
            } else {
              SoundEngine.playClick();
              actions.onSave();
            }
          },
          { variant: isEq ? 'ghost' : 'gold', fontSize: 13 }
        );
      }
    } else {
      const skId = this.inspectSkillId ?? ast.equippedSkills[0] ?? ast.unlockedSkills[0];
      const sk = skId ? V6_ACTIVE_SKILL_MAP[skId] : undefined;
      if (sk && skId) {
        const isEq = ast.equippedSkills.includes(sk.id);
        const curBr = ast.skillBranchChoice[sk.id] ?? 'A';
        const isOv = rogue.overloadedSkills.includes(sk.id);

        drawBadge(ctx, ix + 18, iy + 14, 94, 22, `CD ${sk.cooldownMinutes}' · 限${sk.maxPerMatch}次`, '#082F49', '#7DD3FC');
        drawText(ctx, `《${sk.name}》`, ix + 18, iy + 54, { size: 17, bold: true, color: '#7DD3FC' });
        drawText(ctx, `触发窗口：${sk.situationLabel}`, ix + 18, iy + 80, { size: 12.5, bold: true, color: THEME.GOLD_LIGHT });
        drawWrappedText(ctx, `瞬时干预：${sk.instantLabel}（${sk.powerLabel}）`, ix + 18, iy + 104, iw - 36, 18, { size: 12, color: THEME.TX1, maxLines: 2 });

        (['A', 'B'] as const).forEach((bk, bi) => {
          const bDef = bk === 'B' ? sk.branchB : sk.branchA;
          const act = isOv || curBr === bk;
          const by2 = iy + 154 + bi * 74;
          drawPrintCard(ctx, ix + 18, by2, iw - 36, 64, { paper: false, radius: 8, shadowOffset: 2, strokeColor: act ? '#38BDF8' : THEME.BORDER, lineWidth: 1.4 });
          drawText(ctx, `分支 ${bk} · ${bDef.label} ${act ? '✓已激活' : ''}`, ix + 28, by2 + 18, { size: 13, bold: true, color: act ? '#7DD3FC' : THEME.TX2 });
          drawWrappedText(ctx, bDef.desc, ix + 28, by2 + 38, iw - 56, 18, { size: 12, color: THEME.TX1, maxLines: 2 });
          hits.addTouchTarget(ix + 18, by2, iw - 36, 64, () => {
            league.setV6SkillBranch(sk.id, bk);
            SoundEngine.playClick();
            actions.onSave();
          });
        });

        drawButton(ctx, hits, ix + 18, iy + ih - 48, iw - 36, 36, isEq ? '从 F1–F4 绝技槽卸下' : '装备至 F1–F4 绝技槽', () => {
          const res = league.toggleV6EquippedSkill(sk.id);
          if (!res.ok) {
            SoundEngine.playWarning();
            this.loadoutToast = res.reason || '绝技槽已满';
          } else {
            SoundEngine.playClick();
            actions.onSave();
          }
        }, { variant: isEq ? 'ghost' : 'gold', fontSize: 13 });
      }
    }
  }

  private renderPresetModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onNavigate: (tab: NavRailTab) => void;
      onSave: () => void;
    }
  ): void {
    ctx.fillStyle = 'rgba(7, 16, 12, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 110;
    const my = 56;
    const mw = 1060;
    const mh = 608;
    drawPrintCard(ctx, mx, my, mw, mh, { paper: false, radius: 12, shadowOffset: 6, strokeColor: THEME.BORDER_GOLD, lineWidth: 2 });

    const club = league.getUserClub();
    const squadMap = new Map(club.squad.map(p => [p.id, p]));
    const presets = league.getTacticalPresets();
    const s1Entries = league.getV6CheckpointDirectives('s1');
    const v6Cfg = league.getV6MatchRuntimeConfig();
    const deckWarn = s1Entries.length < 4;

    drawText(ctx, '战术保存中心 · 赛前 4 套预置战术 & V6 四赛段出战指令', mx + 28, my + 32, { size: 19, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, this.presetNotice, mx + 28, my + 56, { size: 12.5, color: THEME.TX2 });
    drawButton(ctx, hits, mx + mw - 104, my + 18, 80, 32, '关闭', () => {
      this.presetModalOpen = false;
    }, { variant: 'ghost', fontSize: 12.5, icon: 'close' });

    presets.forEach((pr, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = mx + 28 + col * 510;
      const py = my + 82 + row * 176;
      const pw = 494;
      const ph = 162;
      const isCurrent = club.formation === pr.formation && club.style === pr.style;

      drawPrintCard(ctx, px, py, pw, ph, { paper: false, radius: 10, shadowOffset: 3, strokeColor: isCurrent ? THEME.LIME : THEME.BORDER_GOLD, lineWidth: isCurrent ? 1.8 : 1.2 });
      drawBadge(ctx, px + 14, py + 12, 54, 22, `预案 ${idx + 1}`, THEME.BG_DEEP, THEME.GOLD_LIGHT);
      drawText(ctx, pr.name, px + 76, py + 23, { size: 15, bold: true, color: THEME.TX1 });
      drawBadge(ctx, px + 210, py + 12, 72, 22, pr.formation, THEME.BG_DEEP, '#7DD3FC');
      drawBadge(ctx, px + 288, py + 12, 82, 22, TACTICAL_PRESETS[pr.style].name, '#312E81', '#E9D5FF');
      if (isCurrent) {
        drawBadge(ctx, px + 380, py + 12, 98, 22, '当前已激活 ✓', '#14532D', THEME.LIME);
      }

      const starterNames = pr.starterIds.map(id => squadMap.get(id)?.name?.slice(0, 4)).filter(Boolean);
      drawText(ctx, `首发11人: ${starterNames.slice(0, 6).join(' · ')}`, px + 14, py + 54, { size: 12, color: THEME.TX2 });
      drawText(ctx, `          ${starterNames.slice(6, 11).join(' · ')}`, px + 14, py + 76, { size: 12, color: THEME.TX2 });
      drawText(ctx, `当前配置: ${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, px + 14, py + 98, { size: 12, color: THEME.TX3 });

      drawButton(ctx, hits, px + 14, py + 116, 174, 32, '保存当前阵容至此', () => {
        SoundEngine.playClick();
        league.saveTacticalPreset(idx);
        actions.onSave();
        this.presetNotice = `已将当前【${club.formation} · ${TACTICAL_PRESETS[club.style].name}】及 11 名首发保存至预案 ${idx + 1}！`;
      }, { variant: 'primary', fontSize: 12, icon: 'save' });

      drawButton(ctx, hits, px + 198, py + 116, 140, 32, '▶ 载入此预案', () => {
        SoundEngine.playClick();
        const res = league.applyTacticalPreset(idx);
        if (res.ok && res.preset) {
          this.activeSysTab = getDefenseSystem(res.preset.formation);
          this.selectedStarterIdx = null;
          this.selectedBenchPlayerId = null;
          actions.onSave();
          this.presetNotice = `已载入预案 ${idx + 1}【${res.preset.name}】：${res.preset.formation} · ${TACTICAL_PRESETS[res.preset.style].name}`;
        }
      }, { variant: 'gold', fontSize: 12 });

      drawButton(ctx, hits, px + 348, py + 116, 132, 32, '以当前风格命名', () => {
        SoundEngine.playClick();
        league.saveTacticalPreset(idx, `${club.formation} ${TACTICAL_PRESETS[club.style].name.slice(0, 2)}`);
        actions.onSave();
      }, { variant: 'ghost', fontSize: 12 });
    });

    drawPrintCard(ctx, mx + 28, my + 444, mw - 56, 144, { paper: false, radius: 10, shadowOffset: 3, strokeColor: deckWarn ? THEME.GOLD_LIGHT : THEME.BORDER, lineWidth: 1.4 });
    const deckHead = `四赛段出战指令池 (${s1Entries.length}/4 张 · 每段 +${v6Cfg.checkpointTpBase} TP)${deckWarn ? ' · ⚠ 尚未配满 4 张指令' : ''}`;
    drawText(ctx, deckHead, mx + 44, my + 466, { size: 13, bold: true, color: deckWarn ? THEME.GOLD_LIGHT : THEME.LIME });
    drawButton(ctx, hits, mx + mw - 356, my + 452, 156, 28, '⚡ 一键智能配齐', () => {
      const r = league.autoFillV6LoadoutForClub();
      SoundEngine.playRewardChime();
      this.presetNotice = `已按当前阵型风格智能配齐 ${r.filledDirectives} 张指令 + ${r.filledSkills} 个绝技！`;
      actions.onSave();
    }, { variant: 'ghost', fontSize: 12 });
    drawButton(ctx, hits, mx + mw - 190, my + 452, 148, 28, '调整指令与绝技 ▶', () => {
      this.presetModalOpen = false;
      this.mainTab = 'loadout';
    }, { variant: deckWarn ? 'gold' : 'primary', fontSize: 12 });

    s1Entries.slice(0, 4).forEach((entry, ci) => {
      const { def, effectiveTpCost } = entry;
      const cx = mx + 44 + ci * 246;
      const cy = my + 490;
      const zc = def.zone === 'ATT' ? THEME.RED : def.zone === 'MID' ? '#2B6BE6' : '#16A34A';
      drawPrintCard(ctx, cx, cy, 234, 82, { paper: true, radius: 8, shadowOffset: 2, strokeColor: zc, lineWidth: 1.5 });
      drawBadge(ctx, cx + 10, cy + 10, 46, 18, `${def.zone === 'ATT' ? '前' : def.zone === 'MID' ? '中' : '后'}·${def.tendency === 'ATK' ? '攻' : '守'}`, zc, '#FFFFFF');
      drawBadge(ctx, cx + 60, cy + 10, 38, 18, `${effectiveTpCost}TP`, THEME.PAPER_INK, THEME.GOLD_LIGHT);
      drawText(ctx, fitText(ctx, def.name, 122, 13, true, true), cx + 104, cy + 19, { size: 13, bold: true, color: THEME.PAPER_INK });
      drawText(ctx, fitText(ctx, `+ ${def.benefitSummary}`, 214, 12, false, true), cx + 10, cy + 44, { size: 12, color: '#166534' });
      drawText(ctx, fitText(ctx, `- ${def.riskSummary}`, 214, 12, false, true), cx + 10, cy + 64, { size: 12, color: '#B91C1C' });
    });
  }
}
