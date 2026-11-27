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
import { AssetLoader } from '../AssetLoader';
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
  FONT,
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
import { IS_MOBILE, THEME } from '../Theme';
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
    onSave: () => void
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
   * 统一球员卡片绘制（球场首发与右侧替补席完全一致，零文本重叠）
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
    }
  ): void {
    const { x, y, w, h, detailed } = opts;
    drawRoundRect(ctx, x, y, w, h, detailed ? 8 : 7, opts.bgColor, opts.borderColor, opts.borderWidth ?? 1.2);

    const a = player.attributes;
    const hasGold = (player.goldTraits?.length ?? 0) > 0;
    const fit = Math.round(player.fitness ?? 100);
    const famCol = opts.fam >= 85 ? THEME.GOLD_LIGHT : opts.fam >= 65 ? THEME.GREEN : opts.fam >= 35 ? '#38BDF8' : '#FCA5A5';

    const paVal = player.pa ?? player.ca;
    const paColor = paVal - player.ca >= 8 ? '#C084FC' : '#7DD3FC';

    if (!detailed) {
      // 紧凑版球场首发卡 (106×60)：灰阶微图标 + 进度条，零文字前缀拥挤
      const roleMaxW = opts.statusBadge ? 38 : opts.isCaptain ? 42 : 48;
      const roleW = Math.min(roleMaxW, Math.max(30, opts.roleLabel.length * 7.5 + 8));
      drawBadge(ctx, x + 5, y + 4, roleW, 14, opts.roleLabel, opts.roleBg, opts.roleFg);

      if (opts.statusBadge) {
        drawBadge(ctx, x + w - 31, y + 4, 27, 14, opts.statusBadge.text, opts.statusBadge.bg, opts.statusBadge.fg);
      } else if (opts.isCaptain) {
        drawBadge(ctx, x + w - 19, y + 4, 15, 14, 'C', '#FACC15', '#080C14');
      }

      const caRight = opts.statusBadge ? x + w - 34 : opts.isCaptain ? x + w - 22 : x + w - 5;
      drawText(ctx, `${player.ca}/${paVal}`, caRight, y + 11, {
        size: 11,
        bold: true,
        color: paVal - player.ca >= 8 ? '#E9D5FF' : THEME.GOLD_LIGHT,
        align: 'right',
        mono: true,
      });

      drawPlayerAvatar(ctx, x + 5, y + 20, 22, 24, player, club, { radius: 4, showFrame: false });
      const nameStr = fitText(ctx, `${hasGold ? '★' : ''}${player.name}`, w - 34, 10.5, true);
      drawText(ctx, nameStr, x + 30, y + 27, {
        size: 10.5,
        bold: true,
        color: hasGold || player.isNewSigning ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      const secTxt = player.secondaryRoles && player.secondaryRoles.length > 0 ? ` · ${player.secondaryRoles[0]}` : '';
      drawText(ctx, fitText(ctx, `${player.age}${secTxt}`, w - 34, 9), x + 30, y + 40, {
        size: 9,
        color: THEME.TX2,
        mono: true,
      });

      const botY = y + h - 8;
      drawStatMicro(ctx, 'stat_fam', `${opts.fam}%`, x + 5, botY, {
        iconSize: 9.5,
        fontSize: IS_MOBILE ? 10 : 9.5,
        iconColor: THEME.TX3,
        valueColor: famCol,
        gap: 2,
      });
      drawMiniBar(ctx, x + w - (IS_MOBILE ? 60 : 46), botY - 2, IS_MOBILE ? 22 : 20, 3.5, fit / 100, fit < 60 ? '#FBBF24' : THEME.GREEN);
      drawText(ctx, `${fit}%`, x + w - 5, botY, {
        size: IS_MOBILE ? 10 : 9,
        rawSize: IS_MOBILE,
        color: fit < 60 ? '#FBBF24' : THEME.TX2,
        align: 'right',
        mono: true,
      });
      return;
    }

    // 详细版替补席卡片 (158×104)：灰阶微图标 + 数值，充裕留白与 i18n 冗余
    const roleW = Math.min(50, Math.max(34, opts.roleLabel.length * 8.5 + 10));
    drawBadge(ctx, x + 8, y + 6, roleW, 16, opts.roleLabel, opts.roleBg, opts.roleFg);

    if (opts.statusBadge) {
      drawBadge(ctx, x + w - (IS_MOBILE ? 42 : 36), y + 6, IS_MOBILE ? 34 : 28, IS_MOBILE ? 17 : 16, opts.statusBadge.text, opts.statusBadge.bg, opts.statusBadge.fg);
    } else if (opts.isCaptain) {
      drawBadge(ctx, x + w - 24, y + 6, 16, 16, 'C', '#FACC15', '#080C14');
    }

    const caRight = opts.statusBadge ? x + w - (IS_MOBILE ? 46 : 40) : opts.isCaptain ? x + w - 27 : x + w - 8;
    drawText(ctx, `${player.ca}/${paVal}`, caRight, y + 14, {
      size: 12,
      bold: true,
      color: paVal - player.ca >= 8 ? paColor : THEME.GOLD_LIGHT,
      align: 'right',
      mono: true,
    });

    const nameStr = fitText(ctx, `${hasGold ? '★' : ''}${player.name}`, w - 52, 12, true);
    drawPlayerAvatar(ctx, x + 8, y + 26, 28, 34, player, club, { radius: 5, showFrame: true });
    drawText(ctx, nameStr, x + 42, y + 36, {
      size: 12,
      bold: true,
      color: hasGold || player.isNewSigning ? THEME.GOLD_LIGHT : THEME.TX1,
    });

    const secTxt = player.secondaryRoles && player.secondaryRoles.length > 0 ? ` · ${player.secondaryRoles.slice(0, 2).join('/')}` : '';
    drawText(ctx, fitText(ctx, `${player.age}y${secTxt}`, w - 52, 10), x + 42, y + 52, {
      size: 10,
      color: THEME.TX2,
      mono: true,
    });

    // 四维 / 门将三维：灰阶微图标 + 清晰数字
    const statsRowY = y + 72;
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
    const colStep = player.role === 'GK' ? 48 : 36;
    statItems.forEach(([ic, val], si) => {
      drawStatMicro(ctx, ic, `${val}`, x + 8 + si * colStep, statsRowY, {
        iconSize: 10.5,
        fontSize: 10.5,
        iconColor: THEME.TX3,
        valueColor: val >= 75 ? THEME.GOLD_LIGHT : THEME.TX1,
        bold: val >= 75,
        gap: 2.5,
      });
    });

    // 底部行：熟悉度微图标 + 进度条 + 体能（右侧留出 70px 避免顶到体能条）
    const botY = y + h - 12;
    const maxLx = x + w - 72;
    const g = player.seasonStats.goals;
    const ast = player.seasonStats.assists;
    let lx = x + 8;
    lx += drawStatMicro(ctx, 'stat_fam', `${opts.fam}%`, lx, botY, {
      iconSize: 10,
      fontSize: 10,
      iconColor: THEME.TX3,
      valueColor: famCol,
      gap: 3,
    });
    if (g > 0 && lx + 26 < maxLx) {
      lx += 5;
      lx += drawStatMicro(ctx, 'ball', `${g}`, lx, botY, { iconSize: 10, fontSize: 10, iconColor: THEME.TX3, valueColor: THEME.TX1, gap: 2 });
    }
    if (ast > 0 && lx + 24 < maxLx) {
      lx += 4;
      drawStatMicro(ctx, 'stat_assist', `${ast}`, lx, botY, { iconSize: 10, fontSize: 10, iconColor: THEME.TX3, valueColor: THEME.TX1, gap: 2 });
    }
    drawMiniBar(ctx, x + w - 64, botY - 2, 24, 4, fit / 100, fit < 60 ? '#FBBF24' : THEME.GREEN);
    drawText(ctx, `${fit}%`, x + w - 8, botY, {
      token: 'MICRO',
      color: fit < 60 ? '#FBBF24' : THEME.TX2,
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
    const mastery = league.getTacticalMastery();
    const formLv = Math.min(3, (mastery.formations[club.formation] ?? 0) >= 15 ? 3 : (mastery.formations[club.formation] ?? 0) >= 6 ? 2 : 1);
    const styleLv = Math.min(3, (mastery.styles[club.style] ?? 0) >= 15 ? 3 : (mastery.styles[club.style] ?? 0) >= 6 ? 2 : 1);
    const lineRatings = this.getLineRatings(league);

    drawChamferPanel(ctx, 96, 80, 1168, 48, 8, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD, 1.2);
    const astTop = league.getV6Astrolabe();
    const s1TopCount = astTop.checkpointPools.s1.length;
    const skTopCount = astTop.equippedSkills.length;

    drawButton(ctx, hits, 106, 88, 128, 32, '① 阵容与站位', () => {
      this.mainTab = 'pitch';
    }, { active: this.mainTab === 'pitch', fontSize: 11.5, icon: 'tactics' });

    drawButton(
      ctx,
      hits,
      240,
      88,
      196,
      32,
      `② 指令与绝技 (${s1TopCount}/4·${skTopCount}/4)`,
      () => {
        this.mainTab = 'loadout';
      },
      { active: this.mainTab === 'loadout', variant: s1TopCount < 4 ? 'gold' : 'primary', fontSize: 11.5, icon: 'bolt' }
    );

    // 阵型与风格徽章本身可点击，直接拉出配置抽屉（取代「切换阵型与风格 ▾」大按钮）
    const formPillW = 196;
    const formPillHov = hits.isHovered(444, 88, formPillW, 32);
    drawRoundRect(
      ctx,
      444,
      88,
      formPillW,
      32,
      6,
      formPillHov ? 'rgba(30, 58, 95, 0.92)' : 'rgba(15, 23, 42, 0.72)',
      formPillHov ? THEME.GOLD_LIGHT : 'rgba(148, 163, 184, 0.28)',
      1.1
    );
    drawBadge(ctx, 450, 92, 56, 24, club.formation, '#1E3A5F', THEME.GOLD_LIGHT);
    drawText(ctx, `${activePreset.name} ▾`, 512, 104, {
      size: 12.5,
      bold: true,
      color: formPillHov ? THEME.GOLD_LIGHT : THEME.TX1,
    });
    hits.add(444, 88, formPillW, 32, () => {
      SoundEngine.playClick();
      this.activeSysTab = getDefenseSystem(club.formation);
      this.styleModalOpen = true;
    });

    drawText(
      ctx,
      `攻${lineRatings.att} · 中${lineRatings.mid} · 防${lineRatings.def}`,
      654,
      104,
      { size: 12, bold: true, color: THEME.GOLD_LIGHT, mono: true }
    );

    // 4 套战术预案磁贴 [1][2][3][4] + ⚙ 管理图标（取代「战术预案(4)」文字按钮）
    const presetsTop = league.getTacticalPresets();
    const curPrIdx = presetsTop.findIndex(pr => pr && club.formation === pr.formation && club.style === pr.style);
    drawText(ctx, '预案', 1028, 104, { size: 10.5, color: THEME.TX3, align: 'right' });
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
      }, { active: isActPr, variant: isActPr ? 'gold' : 'ghost', fontSize: 12 });
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

    // ==================== 左主区：宽屏竖向绿茵球场 (x: 96..726, w: 630, y: 138..704, h: 566) ====================
    const px = 96, py = 138, pw = 630, ph = 566;
    drawChamferPanel(ctx, px, py, pw, ph, 10, '#0B1810', THEME.BORDER);

    const selectedStarter = this.selectedStarterIdx !== null ? squadMap.get(club.starterIds[this.selectedStarterIdx]) : null;
    const selectedBench = this.selectedBenchPlayerId ? squadMap.get(this.selectedBenchPlayerId) : null;
    drawRoundRect(ctx, px + 12, py + 10, pw - 24, 36, 6, 'rgba(14,22,40,0.92)', (selectedStarter || selectedBench) ? THEME.GREEN : THEME.BORDER);
    drawIcon(ctx, (selectedStarter || selectedBench) ? 'refresh' : 'tactics', px + 28, py + 28, 14, (selectedStarter || selectedBench) ? THEME.GREEN : THEME.GOLD_LIGHT);
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
    drawText(ctx, fitText(ctx, hintText, hintMaxW, 11.5, !!(selectedStarter || selectedBench)), px + 44, py + 28, {
      size: 11.5,
      bold: !!(selectedStarter || selectedBench),
      color: (selectedStarter || selectedBench) ? THEME.GREEN : THEME.GOLD_LIGHT,
    });

    if (selectedStarter && this.swapMode) {
      drawButton(ctx, hits, px + pw - 96, py + 14, 80, 28, '取消换人', () => {
        this.swapMode = false;
      }, { variant: 'ghost', fontSize: 11 });
    } else if (selectedBench) {
      drawButton(ctx, hits, px + pw - 134, py + 14, 58, 28, '详情', () => {
        actions.onInspectPlayer(selectedBench);
      }, { variant: 'primary', fontSize: 11 });
      drawButton(ctx, hits, px + pw - 70, py + 14, 54, 28, '取消', () => {
        this.selectedBenchPlayerId = null;
      }, { variant: 'ghost', fontSize: 11 });
    } else if (hasReset) {
      drawButton(ctx, hits, px + pw - 74, py + 14, 58, 28, '重置', () => {
        league.resetClubGridAndDuties();
        actions.onSave();
      }, { variant: 'ghost', fontSize: 11 });
    }

    const slots = FORMATIONS[club.formation];
    // 移除底部重复提示栏，球场纵深与比例更舒展
    const pitchX = px + 32, pitchY = py + 54, pitchW = pw - 64, pitchH = ph - 66;
    const tacGrass = AssetLoader.get('pitch_grass_top');
    if (tacGrass && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(pitchX, pitchY, pitchW, pitchH);
      ctx.clip();
      ctx.translate(pitchX + pitchW / 2, pitchY + pitchH / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(tacGrass, -pitchH / 2, -pitchW / 2, pitchH, pitchW);
      ctx.restore();
    } else {
      const stripeH = pitchH / 8;
      for (let si = 0; si < 8; si++) {
        ctx.fillStyle = si % 2 === 0 ? THEME.BG_PITCH : THEME.BG_PITCH_ALT;
        ctx.fillRect(pitchX, pitchY + si * stripeH, pitchW, stripeH);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.5;
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
          ctx.strokeStyle = isCur ? 'rgba(250, 204, 21, 0.52)' : isHov ? 'rgba(56, 189, 248, 0.48)' : 'rgba(250, 204, 21, 0.16)';
          ctx.lineWidth = isCur || isHov ? 1.4 : 1;
          ctx.strokeRect(gx + 1, gy + 1, cellW - 2, cellH - 2);
          if (isCur || isHov) {
            ctx.fillStyle = isCur ? 'rgba(250, 204, 21, 0.16)' : 'rgba(56, 189, 248, 0.12)';
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
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
    let minHoverDist = IS_MOBILE ? 22 : 12;

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
        score >= 85 ? '#FACC15' :
        score >= 65 ? '#34D399' :
        score >= 35 ? '#38BDF8' : 'rgba(148, 163, 184, 0.45)';
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 4 : sp.kind === 'spine' ? 2.6 : 1.8;
      if (score < 35) ctx.setLineDash([5, 5]);
      else ctx.setLineDash([]);
      if (score >= 85 || isHovered) {
        ctx.shadowColor = color;
        ctx.shadowBlur = isHovered ? 10 : 6;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const showScore = isHovered || (this.selectedStarterIdx !== null && (sp.slotA === this.selectedStarterIdx || sp.slotB === this.selectedStarterIdx));
      if (showScore) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.shadowBlur = 0;
        drawRoundRect(ctx, mx - 14, my - 9, 28, 18, 4, 'rgba(8, 12, 20, 0.88)', color, 1);
        drawText(ctx, `${Math.round(score)}`, mx, my, { size: 10, bold: true, color, align: 'center', mono: true });
      }
    }
    ctx.restore();

    const spine = chemSummary.spineInfo;
    if (spine.linkCount > 0) {
      const spineCol = spine.bonus >= 4 ? THEME.GOLD_LIGHT : spine.bonus >= 2 ? THEME.GREEN : '#94A3B8';
      drawBadge(
        ctx,
        pitchX + 8,
        pitchY + 8,
        172,
        22,
        `中轴脊柱 ${spine.avg}${spine.bonus > 0 ? ` · 共振+${spine.bonus}` : ''}`,
        'rgba(8, 12, 20, 0.86)',
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
        ? THEME.RED_LIGHT
        : isSelected
        ? THEME.GOLD_LIGHT
        : canDropBench || isSwapTarget
        ? THEME.GREEN
        : !lineFit
        ? THEME.RED_LIGHT
        : secondaryFit
        ? '#38BDF8'
        : !exactFit
        ? '#FBBF24'
        : THEME.GOLD;
      const fam = league.getPlayerFamiliarity(player, club.formation);

      const slotDuty = club.slotDuties?.[i] ?? 'default';
      const dutyOpt = slotDuty !== 'default' ? ROLE_DUTY_OPTIONS[slot.role]?.find(d => d.duty === slotDuty) : undefined;
      const roleLabel = dutyOpt ? `${slot.role}·${dutyOpt.label.slice(0, 2)}` : `${slot.role}${secondaryFit ? '·兼' : ''}`;
      const cw = 106;
      const ch = 62;

      ctx.save();
      if (isSelected) {
        const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 220);
        ctx.shadowColor = `rgba(250, 204, 21, ${(0.75 * pulse).toFixed(2)})`;
        ctx.shadowBlur = 16;
        drawRoundRect(ctx, sx - cw / 2 - 4, sy - ch / 2 - 4, cw + 8, ch + 8, 10, 'rgba(250, 204, 21, 0.10)', THEME.GOLD_LIGHT, 2);
      } else if (isSwapTarget || canDropBench) {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 240);
        ctx.shadowColor = `rgba(34, 197, 94, ${(0.55 * pulse).toFixed(2)})`;
        ctx.shadowBlur = 10;
      } else if (isBlocked || !lineFit) {
        const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);
        ctx.shadowColor = `rgba(239, 68, 68, ${(0.55 * pulse).toFixed(2)})`;
        ctx.shadowBlur = 10;
      }
      this.drawPlayerCard(ctx, club, player, {
        x: sx - cw / 2,
        y: sy - ch / 2,
        w: cw,
        h: ch,
        roleLabel,
        roleBg: !lineFit ? '#7F1D1D' : secondaryFit ? '#0C4A6E' : '#1E293B',
        roleFg: !lineFit ? '#FCA5A5' : secondaryFit ? '#7DD3FC' : !exactFit ? '#FBBF24' : THEME.GOLD_LIGHT,
        borderColor: fitBorder,
        bgColor: isBlocked ? 'rgba(127,29,29,0.88)' : isSelected ? '#33260A' : (canDropBench || isSwapTarget) ? '#102A1B' : !lineFit ? 'rgba(127,29,29,0.78)' : 'rgba(14,22,40,0.94)',
        borderWidth: isBlocked || isSelected || canDropBench || isSwapTarget || !lineFit ? 2.2 : 1.2,
        fam,
        isCaptain: player.id === captainId,
        statusBadge: isBlocked
          ? { text: isSuspended ? '停赛' : '伤停', bg: '#991B1B', fg: '#FEE2E2' }
          : !lineFit
          ? { text: '错位', bg: '#7F1D1D', fg: '#FCA5A5' }
          : undefined,
        detailed: false,
      });
      ctx.restore();

      if (!lineFit || fam < 35) {
        ctx.fillStyle = !lineFit ? THEME.RED_LIGHT : '#F59E0B';
        ctx.fillRect(sx - cw / 2 + 1, sy - ch / 2 + 6, 2.5, ch - 12);
      }

      hits.add(sx - cw / 2, sy - ch / 2, cw, ch, () => {
        SoundEngine.playClick();
        if (this.selectedBenchPlayerId) {
          this.swapStarterWithPlayer(league, i, this.selectedBenchPlayerId, actions.onSave);
        } else if (this.swapMode && this.selectedStarterIdx !== null) {
          if (this.selectedStarterIdx === i) {
            this.swapMode = false;
          } else {
            this.swapStarterWithPlayer(league, this.selectedStarterIdx, pid, actions.onSave);
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

    // 选中首发球员周边浮动快捷操作栏（换位/换人 + 球场角色 + 详情，设队长收在详情内）
    if (selectedStarter && this.selectedStarterIdx !== null) {
      const sIdx = this.selectedStarterIdx;
      const coord = slotCoords[sIdx];
      const slotRole = slots[sIdx]?.role;
      const dutyOptions = slotRole ? ROLE_DUTY_OPTIONS[slotRole] : undefined;
      const curDuty = club.slotDuties?.[sIdx] ?? 'default';
      if (coord) {
        if (this.swapMode) {
          const pillW = 224;
          const pillH = 38;
          const px0 = Math.max(pitchX + 6, Math.min(pitchX + pitchW - pillW - 6, Math.round(coord.x - pillW / 2)));
          const placeAbove = coord.y + 38 + pillH > pitchY + pitchH - 6;
          const py0 = placeAbove ? Math.round(coord.y - 38 - pillH) : Math.round(coord.y + 38);
          drawRoundRect(ctx, px0, py0, pillW, pillH, 8, 'rgba(10, 28, 22, 0.96)', THEME.GREEN, 1.5);
          hits.add(px0, py0, pillW, pillH, () => {});
          drawText(ctx, '请点队友或右侧替补换人', px0 + 10, py0 + 19, { size: 11, bold: true, color: THEME.GREEN });
          drawButton(ctx, hits, px0 + pillW - 58, py0 + 6, 50, 26, '取消', () => {
            this.swapMode = false;
          }, { variant: 'ghost', fontSize: 10.5 });
        } else {
          const hasDuties = !!(dutyOptions && dutyOptions.length > 0);
          const popW = 264;
          const popH = hasDuties ? 116 : 80;
          const popX = Math.max(pitchX + 6, Math.min(pitchX + pitchW - popW - 6, Math.round(coord.x - popW / 2)));
          const placeAbove = coord.y + 40 + popH > pitchY + pitchH - 6;
          const popY = placeAbove ? Math.round(coord.y - 40 - popH) : Math.round(coord.y + 40);

          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
          ctx.shadowBlur = 18;
          drawRoundRect(ctx, popX, popY, popW, popH, 10, 'rgba(9, 15, 29, 0.96)', THEME.GOLD_LIGHT, 1.5);
          ctx.restore();
          hits.add(popX, popY, popW, popH, () => {});

          // 指向选中球员的小三角指示标
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

          // 头部：球衣号 + 姓名 + 位置/CA + 关闭
          const shirtTxt = selectedStarter.shirtNumber ? `#${selectedStarter.shirtNumber} ` : '';
          drawText(ctx, fitText(ctx, `${shirtTxt}${selectedStarter.name}`, popW - 24, FONT.LABEL, true, true), popX + 12, popY + 18, { token: 'LABEL', bold: true, color: THEME.TX1 });
          drawText(ctx, `${slotRole} · CA ${selectedStarter.ca}`, popX + popW - 38, popY + 18, { size: 10.5, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
          drawButton(ctx, hits, popX + popW - 30, popY + 7, 22, 22, '×', () => {
            this.selectedStarterIdx = null;
            this.swapMode = false;
          }, { variant: 'ghost', fontSize: 12 });

          // 主操作行：换位/换人 + 球员详情
          drawButton(ctx, hits, popX + 12, popY + 36, 118, 30, '换位 / 换人', () => {
            this.swapMode = true;
          }, { variant: 'primary', icon: 'refresh', fontSize: 11.5 });
          drawButton(ctx, hits, popX + 136, popY + 36, 116, 30, '球员详情', () => {
            actions.onInspectPlayer(selectedStarter);
          }, { variant: 'ghost', icon: 'chart', fontSize: 11.5 });

          // 球场角色/职责行
          if (hasDuties && dutyOptions) {
            drawText(ctx, '角色', popX + 12, popY + 90, { size: 10.5, color: THEME.TX3 });
            const availW = popW - 52;
            const gap = 4;
            const btnW = Math.floor((availW - gap * (dutyOptions.length - 1)) / dutyOptions.length);
            dutyOptions.forEach((opt, di) => {
              const bx = popX + 42 + di * (btnW + gap);
              drawButton(ctx, hits, bx, popY + 76, btnW, 28, opt.label.slice(0, 4), () => {
                league.setClubSlotDuty(sIdx, opt.duty);
                actions.onSave();
              }, { active: curDuty === opt.duty, fontSize: 10.5 });
            });
          }
        }
      }
    }

    if (hoveredLink) {
      const tx = Math.max(pitchX + 4, Math.min(pitchX + pitchW - 216, hoveredMidX - 106));
      const ty = Math.max(pitchY + 6, hoveredMidY - 64);
      const lk = hoveredLink.link;
      drawRoundRect(ctx, tx, ty, 212, 56, 8, 'rgba(8, 12, 22, 0.96)', THEME.GOLD_LIGHT, 1.3);
      const titleTxt = lk.title ? `${hoveredLink.defaultLabel} · ${lk.title}` : hoveredLink.defaultLabel;
      drawText(ctx, `${hoveredLink.playerA.name.slice(0, 4)} × ${hoveredLink.playerB.name.slice(0, 4)}`, tx + 10, ty + 16, { size: 11.5, bold: true, color: THEME.TX1 });
      drawText(ctx, titleTxt, tx + 202, ty + 16, { size: 10, bold: true, color: THEME.GOLD_LIGHT, align: 'right' });
      drawText(ctx, `默契 ${Math.round(lk.score)} · 同场 ${lk.matches} · 传球 ${lk.passes} · 助攻 ${lk.assists}`, tx + 10, ty + 38, {
        size: 10.5,
        color: '#93C5FD',
        mono: true,
      });
    }

    // ==================== 右主区：替补席 3×4 卡片网格 + 位置筛选 (x: 740..1264, w: 524, y: 138..704, h: 566) ====================
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

    drawChamferPanel(ctx, 740, 138, 524, 566, 10, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    drawText(ctx, `替补席 (${allBench.length}人)`, 758, 162, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
    drawText(
      ctx,
      this.selectedStarterIdx !== null && this.swapMode ? '点击替补卡换入首发' : '点卡选中 · 再点球场换上',
      1246,
      162,
      { size: 11, color: this.selectedStarterIdx !== null && this.swapMode ? THEME.GREEN : THEME.TX3, align: 'right' }
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
      drawButton(ctx, hits, fx, 180, 62, 24, fl, () => {
        this.benchFilter = fk;
        this.benchPage = 0;
      }, { active: this.benchFilter === fk, fontSize: 10.5 });
    });

    // 最佳首发收为替补席筛选行右侧的紧凑「⚡ 最佳首发」图标按钮
    drawButton(ctx, hits, 1142, 179, 104, 26, '⚡ 最佳首发', () => {
      league.updateUserTactics(club.formation, club.style);
      this.selectedStarterIdx = null;
      this.selectedBenchPlayerId = null;
      actions.onSave();
    }, { variant: 'ghost', fontSize: IS_MOBILE ? 11 : 10.5 });

    const pageSize = 12; // 3列 × 4行 = 12张高呼吸感卡片
    const totalPages = Math.max(1, Math.ceil(benchSquad.length / pageSize));
    if (this.benchPage >= totalPages) this.benchPage = totalPages - 1;
    const visibleBench = benchSquad.slice(this.benchPage * pageSize, (this.benchPage + 1) * pageSize);

    visibleBench.forEach((p, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cw = 158;
      const ch = 104;
      const cx = 758 + col * 166;
      const cy = 214 + row * 110;

      const isBenchSelected = this.selectedBenchPlayerId === p.id;
      const isSuspended = (p.suspendedRounds ?? 0) > 0;
      const isInjured = (p.injuredRounds ?? 0) > 0;
      const isBlocked = isSuspended || isInjured;
      const canQuickSwap = this.selectedStarterIdx !== null && this.swapMode && !isBlocked;
      const fam = league.getPlayerFamiliarity(p, club.formation);

      const statusBadge = isBlocked
        ? { text: isSuspended ? '停赛' : '伤停', bg: '#991B1B', fg: '#FEE2E2' }
        : p.strainWarning
        ? { text: '疲惫', bg: '#78350F', fg: '#FBBF24' }
        : p.morale === 'high'
        ? { text: '高昂', bg: '#14532D', fg: '#4ADE80' }
        : p.morale === 'low'
        ? { text: '低迷', bg: '#7F1D1D', fg: '#FCA5A5' }
        : p.isNewSigning
        ? { text: '新援', bg: '#1E3A5F', fg: '#38BDF8' }
        : undefined;

      this.drawPlayerCard(ctx, club, p, {
        x: cx,
        y: cy,
        w: cw,
        h: ch,
        roleLabel: p.role,
        roleBg: tierColor(p.tier),
        roleFg: '#FFFFFF',
        borderColor: isBlocked ? THEME.RED_LIGHT : isBenchSelected ? THEME.GREEN : canQuickSwap ? 'rgba(34,197,94,0.65)' : THEME.BORDER,
        bgColor: isBlocked ? 'rgba(127,29,29,0.45)' : isBenchSelected ? '#1B3A2A' : THEME.BG_CARD,
        borderWidth: isBenchSelected || canQuickSwap ? 1.8 : 1,
        fam,
        statusBadge,
        detailed: true,
      });

      hits.add(cx, cy, cw, ch, () => {
        if (isBlocked) {
          SoundEngine.playWarning();
          return;
        }
        SoundEngine.playClick();
        if (this.selectedStarterIdx !== null && this.swapMode) {
          this.swapStarterWithPlayer(league, this.selectedStarterIdx, p.id, actions.onSave);
        } else {
          this.selectedStarterIdx = null;
          this.swapMode = false;
          this.selectedBenchPlayerId = isBenchSelected ? null : p.id;
        }
      });
    });

    if (totalPages > 1) {
      drawButton(ctx, hits, 758, 664, 108, 28, '上一页', () => {
        this.benchPage = Math.max(0, this.benchPage - 1);
      }, { disabled: this.benchPage === 0, fontSize: 11.5 });
      drawText(ctx, `第 ${this.benchPage + 1} / ${totalPages} 页（共 ${benchSquad.length} 人）`, 1002, 678, {
        size: 11.5,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, 1138, 664, 108, 28, '下一页', () => {
        this.benchPage = Math.min(totalPages - 1, this.benchPage + 1);
      }, { disabled: this.benchPage >= totalPages - 1, fontSize: 11.5 });
    } else {
      drawText(ctx, `当前筛选 ${benchSquad.length} 名替补`, 1002, 678, {
        size: 11.5,
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
    ctx.fillStyle = 'rgba(4, 7, 14, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 110;
    const my = 56;
    const mw = 1060;
    const mh = 608;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(14, 22, 40, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    const club = league.getUserClub();
    drawText(ctx, '阵型体系与战术风格配置', mx + 28, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '切换阵型后自动调整默认站位，返回球场即可继续微调首发人选', mx + 28, my + 58, { size: 12, color: '#7DD3FC' });
    drawButton(ctx, hits, mx + mw - 118, my + 20, 94, 34, '完成并返回', () => {
      this.styleModalOpen = false;
    }, { variant: 'gold', fontSize: 12 });

    drawChamferPanel(ctx, mx + 28, my + 82, 540, 498, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, '一、选择防线体系与阵型', mx + 46, my + 106, { size: 14, bold: true, color: THEME.GOLD_LIGHT });

    const curSys = this.activeSysTab ?? getDefenseSystem(club.formation);
    SYS_LIST.forEach((sys, si) => {
      const label = sys === '4-back' ? '4 后卫体系 (8阵)' : sys === '3-back' ? '3 后卫体系 (4阵)' : '5 后卫体系 (4阵)';
      drawButton(ctx, hits, mx + 46 + si * 170, my + 124, 162, 32, label, () => {
        this.activeSysTab = sys;
      }, { active: curSys === sys, fontSize: 11.5 });
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
        { active: club.formation === f, fontSize: 12.5 }
      );
    });

    drawText(ctx, '二、选择战术风格 (2×3)', mx + 46, my + 344, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
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
        { active: club.style === s, fontSize: 13 }
      );
    });

    const activePreset = TACTICAL_PRESETS[club.style];
    const mastery = league.getTacticalMastery();
    const formLv = Math.min(3, (mastery.formations[club.formation] ?? 0) >= 15 ? 3 : (mastery.formations[club.formation] ?? 0) >= 6 ? 2 : 1);
    const styleLv = Math.min(3, (mastery.styles[club.style] ?? 0) >= 15 ? 3 : (mastery.styles[club.style] ?? 0) >= 6 ? 2 : 1);

    drawChamferPanel(ctx, mx + 586, my + 82, 446, 268, 10, THEME.BG_CARD, THEME.BORDER_GOLD);
    drawText(ctx, `${activePreset.name} · 风格熟练 Lv.${styleLv}`, mx + 606, my + 110, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
    drawBadge(ctx, mx + 914, my + 98, 98, 24, `阵型 Lv.${formLv}`, formLv >= 2 ? '#14532D' : '#1E293B', formLv >= 2 ? THEME.GREEN : THEME.TX2);

    const styleBars: Array<[string, number, string, string]> = [
      ['防线高度', (activePreset.lineHeight + 8) / 16, `${activePreset.lineHeight >= 0 ? '+' : ''}${activePreset.lineHeight}m`, '#38BDF8'],
      ['逼抢强度', (activePreset.pressIntensity - 0.5) / 1.0, `${Math.round(activePreset.pressIntensity * 100)}%`, THEME.RED_LIGHT],
      ['比赛节奏', (activePreset.tempo - 0.7) / 0.6, `${activePreset.tempo.toFixed(2)}x`, THEME.GOLD_LIGHT],
      ['直传倾角', activePreset.directness, `${Math.round(activePreset.directness * 100)}%`, THEME.GREEN],
    ];
    styleBars.forEach(([lbl, ratio, txt, col], si) => {
      const sy = my + 154 + si * 46;
      const pct = Math.max(0.08, Math.min(1, ratio));
      drawText(ctx, lbl, mx + 606, sy, { size: 13, color: THEME.TX2 });
      drawRoundRect(ctx, mx + 694, sy - 6, 240, 12, 5, '#1E293B');
      drawRoundRect(ctx, mx + 694, sy - 6, Math.round(pct * 240), 12, 5, col);
      drawText(ctx, txt, mx + 1012, sy, { size: 13, bold: true, color: col, align: 'right', mono: true });
    });

    const lineRatings = this.getLineRatings(league);
    drawChamferPanel(ctx, mx + 586, my + 368, 446, 212, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, '当前首发三线实时战力', mx + 606, my + 396, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
    const lines: Array<[string, number, string, 'sword' | 'ball' | 'shield']> = [
      ['锋线进攻', lineRatings.att, THEME.RED_LIGHT, 'sword'],
      ['中场调度', lineRatings.mid, '#38BDF8', 'ball'],
      ['防线稳固', lineRatings.def, THEME.GREEN, 'shield'],
    ];
    lines.forEach(([lbl, val, col, ic], li) => {
      const ly = my + 440 + li * 44;
      drawIcon(ctx, ic, mx + 614, ly, 15, col);
      drawText(ctx, lbl, mx + 634, ly, { size: 13, color: THEME.TX2 });
      drawRoundRect(ctx, mx + 720, ly - 6, 224, 12, 5, '#1E293B');
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

    const zColor = (z: 'ATT' | 'MID' | 'DEF') => (z === 'ATT' ? '#F43F5E' : z === 'MID' ? '#38BDF8' : '#22C55E');
    const zLabel = (z: 'ATT' | 'MID' | 'DEF') => (z === 'ATT' ? '前场' : z === 'MID' ? '中场' : '后场');

    // ==================== 上半部左栏：四赛段临场指令槽 (x: 96..816, y: 136..298, w: 720, h: 162) ====================
    drawChamferPanel(ctx, 96, 136, 720, 162, 10, 'rgba(13, 21, 38, 0.95)', THEME.BORDER_GOLD, 1.3);
    drawText(ctx, `四赛段出战指令池 (每段+${cfg.checkpointTpBase}TP · 结余≤${cfg.maxCarryTp}TP)`, 112, 156, {
      size: 12.5,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });

    drawButton(
      ctx,
      hits,
      404,
      143,
      98,
      24,
      ast.useUniversalPool ? '通用4卡 ✓' : '四段独立配',
      () => {
        league.setV6UniversalPool(!ast.useUniversalPool);
        this.loadoutToast = !ast.useUniversalPool ? '已开启【通用4卡全场复用】' : '已切换为四赛段独立定制模式';
        actions.onSave();
      },
      { active: ast.useUniversalPool, fontSize: 10.5 }
    );

    V6_SEGMENTS.forEach((seg, si) => {
      const act = activeSeg === seg.key && !ast.useUniversalPool;
      drawButton(
        ctx,
        hits,
        508 + si * 48,
        143,
        45,
        24,
        seg.shortLabel,
        () => {
          if (ast.useUniversalPool) {
            league.setV6UniversalPool(false);
          }
          this.loadoutSeg = seg.key;
        },
        { active: act || (ast.useUniversalPool && si === 0), fontSize: 9.5 }
      );
    });

    drawButton(
      ctx,
      hits,
      704,
      143,
      100,
      24,
      '⚡智能契合配齐',
      () => {
        const r = league.autoFillV6LoadoutForClub();
        SoundEngine.playRewardChime();
        this.loadoutToast = `已按【${club.formation}·${TACTICAL_PRESETS[club.style].name}】智能配齐 ${r.filledDirectives} 张指令 + ${r.filledSkills} 个绝技！`;
        actions.onSave();
      },
      { variant: 'gold', fontSize: 10 }
    );

    // 4 个大号清晰指令槽位 (168 × 114)
    for (let i = 0; i < 4; i++) {
      const sx = 110 + i * 174;
      const sy = 175;
      const sw = 166;
      const sh = 112;
      const entry = poolEntries[i];
      if (entry) {
        const { def, effectiveTpCost, satellites, enchant, isGreenSynergy, isOverclocked } = entry;
        const zc = zColor(def.zone);
        const isSel = this.libMode === 'directives' && this.inspectDirectiveId === def.id;
        drawChamferPanel(
          ctx,
          sx,
          sy,
          sw,
          sh,
          8,
          isSel ? '#1B3154' : 'rgba(18, 29, 51, 0.96)',
          isSel ? THEME.GOLD_LIGHT : zc,
          isSel ? 2 : 1.4,
          zc
        );
        drawBadge(ctx, sx + 8, sy + 8, 52, 18, `${zLabel(def.zone)}·${def.tendency === 'ATK' ? '攻' : '守'}`, '#0B1120', zc);
        drawBadge(
          ctx,
          sx + 64,
          sy + 8,
          38,
          18,
          `${effectiveTpCost}TP`,
          effectiveTpCost < def.tpCost ? '#065F46' : '#78350F',
          effectiveTpCost < def.tpCost ? '#6EE7B7' : '#FEF08A'
        );
        if (isGreenSynergy) {
          drawBadge(ctx, sx + 106, sy + 8, 32, 18, '契合', '#14532D', '#4ADE80');
        }
        drawButton(ctx, hits, sx + sw - 24, sy + 7, 18, 18, '×', () => {
          league.toggleV6CheckpointCard(activeSeg, def.id);
          SoundEngine.playClick();
          actions.onSave();
        }, { variant: 'ghost', fontSize: 10 });

        drawText(ctx, fitText(ctx, def.name, sw - 16, FONT.LABEL, true, true), sx + 10, sy + 37, {
          token: 'LABEL',
          bold: true,
          color: THEME.TX1,
        });
        drawText(ctx, fitText(ctx, `+ ${def.benefitSummary}`, sw - 18, FONT.MICRO, false, true), sx + 10, sy + 62, {
          token: 'MICRO',
          color: '#4ADE80',
        });
        const enchOrSat = enchant
          ? `✦附魔：${V6_DIRECTIVE_ENCHANTS[enchant].name}`
          : satellites.length > 0
          ? `★卫星 ${satellites.join('+')}${isOverclocked ? '(超频)' : ''}`
          : `- ${def.riskSummary}`;
        drawText(ctx, fitText(ctx, enchOrSat, sw - 18, FONT.MICRO, false, true), sx + 10, sy + 88, {
          token: 'MICRO',
          color: enchant ? '#E9D5FF' : satellites.length > 0 ? THEME.GOLD_LIGHT : '#FCA5A5',
        });

        hits.add(sx, sy + 28, sw, sh - 28, () => {
          this.libMode = 'directives';
          this.inspectDirectiveId = def.id;
        });
      } else {
        drawRoundRect(ctx, sx, sy, sw, sh, 8, 'rgba(10, 16, 28, 0.72)', 'rgba(100,116,139,0.4)', 1.2);
        drawText(ctx, `+ 指令槽 ${i + 1}`, sx + sw / 2, sy + 46, { size: 13, bold: true, color: THEME.TX3, align: 'center' });
        drawText(ctx, '从下方牌库点击装配', sx + sw / 2, sy + 68, { size: 10.5, color: '#64748B', align: 'center' });
        hits.add(sx, sy, sw, sh, () => {
          this.libMode = 'directives';
        });
      }
    }

    // ==================== 上半部右栏：F1-F4 主动技槽 + 赛季圣物展示 (x: 826..1264, y: 136..298, w: 438, h: 162) ====================
    drawChamferPanel(ctx, 826, 136, 438, 162, 10, 'rgba(13, 21, 38, 0.95)', 'rgba(56, 189, 248, 0.55)', 1.3);
    drawText(ctx, `F1–F4 子弹时间绝技 (${ast.equippedSkills.length}/4)`, 842, 156, { size: 12.5, bold: true, color: '#38BDF8' });
    drawButton(ctx, hits, 1146, 143, 106, 24, '浏览全部绝技', () => {
      this.libMode = 'skills';
      this.libPage = 0;
    }, { active: this.libMode === 'skills', fontSize: 10 });

    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = 840 + col * 208;
      const sy = 172 + row * 44;
      const sw = 200;
      const sh = 38;
      const sid = ast.equippedSkills[i];
      const sk = sid ? V6_ACTIVE_SKILL_MAP[sid] : undefined;
      if (sk && sid) {
        const br = ast.skillBranchChoice[sid] ?? 'A';
        const isOv = rogue.overloadedSkills.includes(sid);
        const isSel = this.libMode === 'skills' && this.inspectSkillId === sid;
        drawRoundRect(ctx, sx, sy, sw, sh, 7, isSel ? '#123A5A' : 'rgba(12, 42, 68, 0.88)', isSel ? THEME.GOLD_LIGHT : '#38BDF8', 1.3);
        drawBadge(ctx, sx + 6, sy + 6, 30, 16, `F${i + 1}`, '#082F49', '#7DD3FC');
        drawText(ctx, fitText(ctx, sk.name, 96, 11.5, true), sx + 40, sy + 16, { size: 11.5, bold: true, color: '#FFFFFF' });
        drawText(ctx, isOv ? '★A+B双支过载' : `${br === 'B' ? sk.branchB.label : sk.branchA.label}`, sx + 10, sy + 30, {
          size: 9.5,
          color: isOv ? THEME.GOLD_LIGHT : '#7DD3FC',
        });
        drawButton(ctx, hits, sx + sw - 54, sy + 7, 30, 24, isOv ? 'AB' : `${br}支`, () => {
          const nextBr = br === 'A' ? 'B' : 'A';
          league.setV6SkillBranch(sid, nextBr);
          SoundEngine.playClick();
          actions.onSave();
        }, { variant: 'primary', fontSize: 9.5 });
        drawButton(ctx, hits, sx + sw - 21, sy + 7, 16, 24, '×', () => {
          league.toggleV6EquippedSkill(sid);
          SoundEngine.playClick();
          actions.onSave();
        }, { variant: 'ghost', fontSize: 9.5 });
        hits.add(sx, sy, sw - 58, sh, () => {
          this.libMode = 'skills';
          this.inspectSkillId = sid;
        });
      } else {
        drawRoundRect(ctx, sx, sy, sw, sh, 7, 'rgba(10, 16, 28, 0.72)', 'rgba(56,189,248,0.28)', 1);
        drawText(ctx, `F${i + 1} 空槽 · 点击下方装配`, sx + sw / 2, sy + 20, { size: 10.5, color: THEME.TX3, align: 'center' });
        hits.add(sx, sy, sw, sh, () => {
          this.libMode = 'skills';
          this.libPage = 0;
        });
      }
    }

    // 本季肉鸽圣物与借用奇点微缩条
    const relicLabels = rogue.seasonRelics.map(r => `《${V6_RELICS[r]?.name ?? r}》`);
    if (rogue.borrowedFusion) {
      const bf = V6_FUSION_MAP[rogue.borrowedFusion.id];
      if (bf) relicLabels.push(`奇点【${bf.name}】`);
    }
    drawText(
      ctx,
      relicLabels.length > 0 ? fitText(ctx, `本季圣物(${rogue.seasonRelics.length}/5): ${relicLabels.join(' ')}`, 412, 10.5) : '本季圣物 (0/5)：赛后 3 选 1 可获取全局战术圣物与手牌暗金附魔',
      840,
      282,
      { size: 10.5, bold: relicLabels.length > 0, color: relicLabels.length > 0 ? '#E9D5FF' : '#94A3B8' }
    );

    // ==================== 下半部左栏：已解锁牌库 / 绝技库浏览器 (x: 96..848, y: 308..704, w: 752, h: 396) ====================
    drawChamferPanel(ctx, 96, 308, 752, 396, 10, 'rgba(11, 18, 34, 0.96)', THEME.BORDER, 1.2);
    drawButton(ctx, hits, 110, 318, 148, 28, `已解锁手牌 (${ast.unlockedDirectives.length})`, () => {
      this.libMode = 'directives';
      this.libPage = 0;
    }, { active: this.libMode === 'directives', fontSize: 11 });
    drawButton(ctx, hits, 264, 318, 148, 28, `已解锁绝技 (${ast.unlockedSkills.length})`, () => {
      this.libMode = 'skills';
      this.libPage = 0;
    }, { active: this.libMode === 'skills', fontSize: 11 });

    if (this.libMode === 'directives') {
      const zTabs: Array<['ALL' | 'ATT' | 'MID' | 'DEF', string]> = [
        ['ALL', '全区'],
        ['ATT', '前场'],
        ['MID', '中场'],
        ['DEF', '后场'],
      ];
      zTabs.forEach(([zk, zlbl], zi) => {
        drawButton(ctx, hits, 424 + zi * 46, 318, 42, 28, zlbl, () => {
          this.zoneFilter = zk;
          this.libPage = 0;
        }, { active: this.zoneFilter === zk, fontSize: 10 });
      });
      const tTabs: Array<['ALL' | 'ATK' | 'DEF', string]> = [
        ['ALL', '攻守'],
        ['ATK', '攻'],
        ['DEF', '守'],
      ];
      tTabs.forEach(([tk, tlbl], ti) => {
        drawButton(ctx, hits, 614 + ti * 38, 318, 34, 28, tlbl, () => {
          this.tendFilter = tk;
          this.libPage = 0;
        }, { active: this.tendFilter === tk, fontSize: 10 });
      });
    }

    drawButton(ctx, hits, 734, 318, 102, 28, '去星盘解锁 ▶', () => {
      actions.onNavigate('meta');
    }, { variant: 'primary', fontSize: 10.5 });

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
        const cy = 356 + row * 74;
        const cw = 354;
        const ch = 66;
        const isEq = poolIdSet.has(d.id);
        const isSel = this.inspectDirectiveId === d.id;
        const zc = zColor(d.zone);
        const isGreen = d.style === club.style || d.formation === club.formation;
        const ench = rogue.directiveEnchants[d.id];
        const satCount = rogue.overclockedDirectives.includes(d.id) ? 3 : (ast.directiveSatellites[d.id]?.length ?? 0);

        drawRoundRect(
          ctx,
          cx,
          cy,
          cw,
          ch,
          8,
          isEq ? 'rgba(20, 83, 45, 0.28)' : isSel ? '#172846' : THEME.BG_CARD,
          isSel ? THEME.GOLD_LIGHT : isEq ? THEME.GREEN : zc,
          isSel ? 1.8 : 1.2
        );
        drawBadge(ctx, cx + 10, cy + 8, 52, 18, `${zLabel(d.zone)}·${d.tendency === 'ATK' ? '攻' : '守'}`, '#0B1120', zc);
        drawBadge(ctx, cx + 66, cy + 8, 36, 18, `${d.tpCost}TP`, '#78350F', '#FEF08A');
        drawText(ctx, fitText(ctx, `${d.name}${satCount > 0 ? ` ★${satCount}` : ''}${ench ? ' ✦' : ''}`, 152, 12.5, true), cx + 108, cy + 17, {
          size: 12.5,
          bold: true,
          color: THEME.TX1,
        });
        if (isGreen) {
          drawText(ctx, '✓契合', cx + cw - 82, cy + 17, { size: 10.5, bold: true, color: '#4ADE80', align: 'right' });
        }
        drawText(ctx, fitText(ctx, `🟢${d.benefitSummary}`, cw - 92, 10.5), cx + 10, cy + 38, { size: 10.5, color: '#4ADE80' });
        drawText(ctx, fitText(ctx, `🔴${d.riskSummary}`, cw - 92, 10), cx + 10, cy + 54, { size: 10, color: '#FCA5A5' });

        drawButton(ctx, hits, cx + cw - 72, cy + 19, 62, 30, isEq ? '已装 ✓' : '装配', () => {
          this.inspectDirectiveId = d.id;
          const res = league.toggleV6CheckpointCard(activeSeg, d.id);
          if (!res.ok) {
            SoundEngine.playWarning();
            this.loadoutToast = res.reason || '槽位已满';
          } else {
            SoundEngine.playClick();
            actions.onSave();
          }
        }, { variant: isEq ? 'green' : 'primary', fontSize: 11 });

        hits.add(cx, cy, cw - 76, ch, () => {
          this.inspectDirectiveId = d.id;
        });
      });

      drawButton(ctx, hits, 332, 662, 74, 28, '◀ 上页', () => {
        this.libPage = Math.max(0, curPage - 1);
      }, { disabled: curPage === 0, fontSize: 10.5 });
      drawText(ctx, `${curPage + 1} / ${totalPages} 页`, 472, 676, { size: 11.5, color: THEME.TX2, align: 'center' });
      drawButton(ctx, hits, 536, 662, 74, 28, '下页 ▶', () => {
        this.libPage = Math.min(totalPages - 1, curPage + 1);
      }, { disabled: curPage >= totalPages - 1, fontSize: 10.5 });
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
        const cy = 356 + row * 74;
        const cw = 354;
        const ch = 66;
        const isEq = eqSet.has(sk.id);
        const isSel = this.inspectSkillId === sk.id;
        drawRoundRect(ctx, cx, cy, cw, ch, 8, isEq ? 'rgba(12, 74, 110, 0.36)' : isSel ? '#172846' : THEME.BG_CARD, isSel ? THEME.GOLD_LIGHT : isEq ? '#38BDF8' : THEME.BORDER, 1.3);
        drawBadge(ctx, cx + 10, cy + 8, 68, 18, `CD ${sk.cooldownMinutes}'·${sk.maxPerMatch}次`, '#082F49', '#7DD3FC');
        drawText(ctx, fitText(ctx, sk.name, 182, 12.5, true), cx + 84, cy + 17, { size: 12.5, bold: true, color: THEME.TX1 });
        drawText(ctx, fitText(ctx, `时机：${sk.situationLabel} → ${sk.instantLabel}`, cw - 92, 10.5), cx + 10, cy + 40, {
          size: 10.5,
          color: '#7DD3FC',
        });
        drawText(ctx, fitText(ctx, sk.powerLabel, cw - 92, 10), cx + 10, cy + 55, { size: 10, color: THEME.TX2 });
        drawButton(ctx, hits, cx + cw - 72, cy + 19, 62, 30, isEq ? '已装 ✓' : '装备', () => {
          this.inspectSkillId = sk.id;
          const res = league.toggleV6EquippedSkill(sk.id);
          if (!res.ok) {
            SoundEngine.playWarning();
            this.loadoutToast = res.reason || '主动技槽已满';
          } else {
            SoundEngine.playClick();
            actions.onSave();
          }
        }, { variant: isEq ? 'green' : 'primary', fontSize: 11 });
        hits.add(cx, cy, cw - 76, ch, () => {
          this.inspectSkillId = sk.id;
        });
      });
    }

    if (this.loadoutToast) {
      drawText(ctx, this.loadoutToast, 116, 676, { size: 10.5, color: THEME.GOLD_LIGHT });
    }

    // ==================== 下半部右栏：选中手牌 / 绝技高清检视台 (x: 858..1264, y: 308..704, w: 406, h: 396) ====================
    const ix = 858;
    const iy = 308;
    const iw = 406;
    const ih = 396;
    drawChamferPanel(ctx, ix, iy, iw, ih, 10, 'rgba(13, 21, 38, 0.96)', THEME.BORDER_GOLD, 1.4);

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

        drawBadge(ctx, ix + 18, iy + 16, 68, 22, `${zLabel(def.zone)}·${def.tendency === 'ATK' ? '主攻' : '稳守'}`, '#0B1120', zc);
        drawBadge(ctx, ix + 92, iy + 16, 48, 22, `${def.tpCost} TP`, '#78350F', '#FEF08A');
        const srcTxt = def.source === 'fusion' ? '融合王牌' : def.formation ? `${def.formation}专属` : STYLE_LABELS[def.style ?? 'balanced'].name;
        drawBadge(ctx, ix + 146, iy + 16, 92, 22, srcTxt, '#1E293B', '#CBD5E1');
        if (isGreen) {
          drawBadge(ctx, ix + iw - 102, iy + 16, 84, 22, '✓ 契合减风险', '#14532D', '#4ADE80');
        }

        drawText(ctx, `《${def.name}》`, ix + 18, iy + 60, { size: 17, bold: true, color: THEME.GOLD_LIGHT });
        drawText(ctx, `默认持续 ${def.durationMinutes} 分钟`, ix + iw - 18, iy + 60, { size: 11.5, color: THEME.TX2, align: 'right' });

        drawRoundRect(ctx, ix + 18, iy + 80, iw - 36, 52, 7, 'rgba(20, 83, 45, 0.25)', '#22C55E', 1);
        drawWrappedText(ctx, `🟢 正面收益：${def.benefitSummary}`, ix + 28, iy + 94, iw - 56, 18, { size: 12, bold: true, color: '#4ADE80', maxLines: 2 });

        drawRoundRect(ctx, ix + 18, iy + 138, iw - 36, 48, 7, 'rgba(127, 29, 29, 0.22)', '#F87171', 1);
        drawWrappedText(ctx, `🔴 双刃代价：${def.riskSummary}`, ix + 28, iy + 152, iw - 56, 18, { size: 11.5, color: '#FCA5A5', maxLines: 2 });

        if (ench) {
          const ei = V6_DIRECTIVE_ENCHANTS[ench];
          drawRoundRect(ctx, ix + 18, iy + 192, iw - 36, 36, 7, 'rgba(59, 31, 110, 0.45)', '#C084FC', 1);
          drawText(ctx, fitText(ctx, `✦本季附魔【${ei.name}】：${ei.desc}`, iw - 52, 11), ix + 26, iy + 210, { size: 11, bold: true, color: '#E9D5FF' });
        }

        const satStartY = ench ? iy + 234 : iy + 196;
        (['A', 'B', 'C'] as const).forEach((sk, si) => {
          const sDef = def.satellites[sk];
          const lit = sats.includes(sk);
          const sy2 = satStartY + si * 34;
          drawRoundRect(ctx, ix + 18, sy2, iw - 36, 30, 6, lit ? 'rgba(120, 53, 15, 0.34)' : 'rgba(15, 23, 42, 0.7)', lit ? THEME.GOLD_LIGHT : THEME.BORDER, 1);
          drawText(ctx, `${lit ? '★' : '☆'}卫星${sk}: ${fitText(ctx, sDef.desc, iw - 128, 10.5)}`, ix + 26, sy2 + 15, {
            size: 10.5,
            bold: lit,
            color: lit ? THEME.GOLD_LIGHT : THEME.TX2,
          });
          if (!lit) {
            drawButton(ctx, hits, ix + iw - 74, sy2 + 4, 50, 22, `+${sDef.cost}pt`, () => {
              const r = league.unlockV6DirectiveSatellite(def.id, sk);
              if (r.ok) {
                SoundEngine.playRewardChime();
                actions.onSave();
              } else {
                SoundEngine.playWarning();
                this.loadoutToast = r.reason || '星盘点不足';
              }
            }, { variant: 'ghost', fontSize: 9.5 });
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

        drawBadge(ctx, ix + 18, iy + 16, 86, 22, `CD ${sk.cooldownMinutes}' · 限${sk.maxPerMatch}次`, '#082F49', '#7DD3FC');
        drawText(ctx, `《${sk.name}》`, ix + 18, iy + 60, { size: 17, bold: true, color: '#38BDF8' });
        drawText(ctx, `触发窗口：${sk.situationLabel}`, ix + 18, iy + 88, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
        drawWrappedText(ctx, `瞬时物理干预：${sk.instantLabel}（${sk.powerLabel}）`, ix + 18, iy + 112, iw - 36, 20, { size: 12, color: THEME.TX1, maxLines: 2 });

        (['A', 'B'] as const).forEach((bk, bi) => {
          const bDef = bk === 'B' ? sk.branchB : sk.branchA;
          const act = isOv || curBr === bk;
          const by2 = iy + 166 + bi * 74;
          drawRoundRect(ctx, ix + 18, by2, iw - 36, 64, 8, act ? 'rgba(12, 74, 110, 0.42)' : 'rgba(15, 23, 42, 0.72)', act ? '#38BDF8' : THEME.BORDER, 1.3);
          drawText(ctx, `分支 ${bk} · ${bDef.label} ${act ? '✓已激活' : ''}`, ix + 28, by2 + 20, { size: 12.5, bold: true, color: act ? '#7DD3FC' : THEME.TX2 });
          drawWrappedText(ctx, bDef.desc, ix + 28, by2 + 40, iw - 56, 18, { size: 11, color: THEME.TX1, maxLines: 2 });
          hits.add(ix + 18, by2, iw - 36, 64, () => {
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
    ctx.fillStyle = 'rgba(4, 7, 14, 0.82)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 110;
    const my = 56;
    const mw = 1060;
    const mh = 608;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(14, 22, 40, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    const club = league.getUserClub();
    const squadMap = new Map(club.squad.map(p => [p.id, p]));
    const presets = league.getTacticalPresets();
    const s1Entries = league.getV6CheckpointDirectives('s1');
    const v6Cfg = league.getV6MatchRuntimeConfig();
    const deckWarn = s1Entries.length < 4;

    drawText(ctx, '战术保存中心 · 赛前 4 套预置战术 & V6 四赛段出战指令', mx + 28, my + 32, { size: 19, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, this.presetNotice, mx + 28, my + 56, { size: 12, color: '#7DD3FC' });
    drawButton(ctx, hits, mx + mw - 104, my + 18, 80, 32, '关闭', () => {
      this.presetModalOpen = false;
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    presets.forEach((pr, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = mx + 28 + col * 510;
      const py = my + 82 + row * 176;
      const pw = 494;
      const ph = 162;
      const isCurrent = club.formation === pr.formation && club.style === pr.style;

      drawChamferPanel(ctx, px, py, pw, ph, 10, isCurrent ? 'rgba(34, 197, 94, 0.10)' : THEME.BG_CARD, isCurrent ? THEME.GREEN : THEME.BORDER_GOLD, isCurrent ? 1.6 : 1);
      drawBadge(ctx, px + 14, py + 12, 54, 20, `预案 ${idx + 1}`, '#1E3A5F', THEME.GOLD_LIGHT);
      drawText(ctx, pr.name, px + 76, py + 22, { size: 15, bold: true, color: THEME.TX1 });
      drawBadge(ctx, px + 210, py + 12, 72, 20, pr.formation, '#0F172A', '#38BDF8');
      drawBadge(ctx, px + 288, py + 12, 82, 20, TACTICAL_PRESETS[pr.style].name, '#312E81', '#E9D5FF');
      if (isCurrent) {
        drawBadge(ctx, px + 380, py + 12, 98, 20, '当前已激活 ✓', '#14532D', THEME.GREEN);
      }

      const starterNames = pr.starterIds.map(id => squadMap.get(id)?.name?.slice(0, 4)).filter(Boolean);
      drawText(ctx, `首发11人: ${starterNames.slice(0, 6).join(' · ')}`, px + 14, py + 54, { size: 11, color: THEME.TX2 });
      drawText(ctx, `          ${starterNames.slice(6, 11).join(' · ')}`, px + 14, py + 74, { size: 11, color: THEME.TX2 });
      drawText(ctx, `当前配置: ${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, px + 14, py + 98, { size: 10, color: THEME.TX3 });

      drawButton(ctx, hits, px + 14, py + 116, 174, 32, '保存当前阵容至此', () => {
        SoundEngine.playClick();
        league.saveTacticalPreset(idx);
        actions.onSave();
        this.presetNotice = `已将当前【${club.formation} · ${TACTICAL_PRESETS[club.style].name}】及 11 名首发保存至预案 ${idx + 1}！`;
      }, { variant: 'primary', fontSize: 11, icon: 'save' });

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
      }, { variant: 'gold', fontSize: 11 });

      drawButton(ctx, hits, px + 348, py + 116, 132, 32, '以当前风格命名', () => {
        SoundEngine.playClick();
        league.saveTacticalPreset(idx, `${club.formation} ${TACTICAL_PRESETS[club.style].name.slice(0, 2)}`);
        actions.onSave();
      }, { variant: 'ghost', fontSize: 10 });
    });

    drawChamferPanel(ctx, mx + 28, my + 444, mw - 56, 144, 10, 'rgba(11, 17, 30, 0.9)', deckWarn ? '#F59E0B' : THEME.BORDER, deckWarn ? 1.4 : 1);
    const deckHead = `四赛段出战指令池 (${s1Entries.length}/4 张 · 每段 +${v6Cfg.checkpointTpBase} TP)${deckWarn ? ' · ⚠ 尚未配满 4 张指令' : ''}`;
    drawText(ctx, deckHead, mx + 44, my + 466, { size: 12.5, bold: true, color: deckWarn ? '#FCD34D' : THEME.GOLD_LIGHT });
    drawButton(ctx, hits, mx + mw - 356, my + 452, 156, 28, '⚡ 一键智能契合配齐', () => {
      const r = league.autoFillV6LoadoutForClub();
      SoundEngine.playRewardChime();
      this.presetNotice = `已按当前阵型风格智能配齐 ${r.filledDirectives} 张指令 + ${r.filledSkills} 个绝技！`;
      actions.onSave();
    }, { variant: 'ghost', fontSize: 11 });
    drawButton(ctx, hits, mx + mw - 190, my + 452, 148, 28, '调整指令与绝技 ▶', () => {
      this.presetModalOpen = false;
      this.mainTab = 'loadout';
    }, { variant: deckWarn ? 'gold' : 'primary', fontSize: 11 });

    s1Entries.slice(0, 4).forEach((entry, ci) => {
      const { def, effectiveTpCost } = entry;
      const cx = mx + 44 + ci * 246;
      const cy = my + 490;
      const zc = def.zone === 'ATT' ? '#F43F5E' : def.zone === 'MID' ? '#38BDF8' : '#22C55E';
      drawRoundRect(ctx, cx, cy, 234, 82, 8, THEME.BG_CARD, zc);
      drawBadge(ctx, cx + 10, cy + 10, 46, 18, `${def.zone === 'ATT' ? '前' : def.zone === 'MID' ? '中' : '后'}·${def.tendency === 'ATK' ? '攻' : '守'}`, '#0B1120', zc);
      drawBadge(ctx, cx + 60, cy + 10, 38, 18, `${effectiveTpCost}TP`, '#78350F', '#FEF08A');
      drawText(ctx, fitText(ctx, def.name, 122, 12.5, true), cx + 104, cy + 19, { size: 12.5, bold: true, color: THEME.TX1 });
      drawText(ctx, fitText(ctx, `🟢 ${def.benefitSummary}`, 214, 10.5), cx + 10, cy + 44, { size: 10.5, color: '#4ADE80' });
      drawText(ctx, fitText(ctx, `🔴 ${def.riskSummary}`, 214, 10), cx + 10, cy + 64, { size: 10, color: '#FCA5A5' });
    });
  }
}
