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
  drawNavRail,
  drawRoundRect,
  drawText,
  fitText,
  HitRegistry,
  NavRailTab,
  tierColor,
} from '../CanvasKit';
import { MECHANIC_LABELS } from '../../../core/src/CommandCards';
import { drawPlayerAvatar } from '../AvatarRenderer';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

const SYS_LIST: DefenseSystem[] = ['4-back', '3-back', '5-back'];
const STYLE_LIST: TacticalStyle[] = ['tiki_taka', 'gegenpress', 'balanced', 'wing_play', 'counter', 'park_bus'];

export class TacticsScreen {
  private selectedStarterIdx: number | null = null;
  private selectedBenchPlayerId: string | null = null;
  private swapMode = false;
  private benchPage = 0;
  private activeSysTab: DefenseSystem | null = null;
  private styleModalOpen = false;
  private presetModalOpen = false;
  private presetNotice = '每场比赛最多携带 4 套预置战术（阵型+球员+风格）与 4 张手牌实时控场';

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
      // 紧凑版球场首发卡 (106×62)：零遮挡 + 显示 CA/PA + 年龄/兼职
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
        size: 10.5,
        bold: true,
        color: paVal - player.ca >= 8 ? '#E9D5FF' : THEME.GOLD_LIGHT,
        align: 'right',
        mono: true,
      });

      drawPlayerAvatar(ctx, x + 4, y + 20, 22, 24, player, club, { radius: 4, showFrame: false });
      const nameStr = fitText(ctx, `${hasGold ? '★' : ''}${player.name}`, w - 32, 10, true);
      drawText(ctx, nameStr, x + 28, y + 27, {
        size: 10,
        bold: true,
        color: hasGold || player.isNewSigning ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      const secTxt = player.secondaryRoles && player.secondaryRoles.length > 0 ? `·兼${player.secondaryRoles[0]}` : '';
      drawText(ctx, fitText(ctx, `${player.age}岁${secTxt}`, w - 32, 8.5), x + 28, y + 39, {
        size: 8.5,
        color: '#93C5FD',
      });

      const botY = y + h - 8;
      drawText(ctx, `熟${opts.fam}%`, x + 6, botY, {
        size: 8.5,
        color: famCol,
        mono: true,
      });
      drawText(ctx, `体${fit}%`, x + w - 6, botY, {
        size: 8.5,
        color: fit < 60 ? '#FBBF24' : THEME.TX2,
        align: 'right',
        mono: true,
      });
      return;
    }

    // 详细版替补席卡片 (156×88)
    const roleW = Math.min(50, Math.max(34, opts.roleLabel.length * 8.5 + 10));
    drawBadge(ctx, x + 6, y + 5, roleW, 16, opts.roleLabel, opts.roleBg, opts.roleFg);

    if (opts.statusBadge) {
      drawBadge(ctx, x + w - 34, y + 5, 28, 16, opts.statusBadge.text, opts.statusBadge.bg, opts.statusBadge.fg);
    } else if (opts.isCaptain) {
      drawBadge(ctx, x + w - 22, y + 5, 16, 16, 'C', '#FACC15', '#080C14');
    }

    const caRight = opts.statusBadge ? x + w - 38 : opts.isCaptain ? x + w - 25 : x + w - 6;
    drawText(ctx, `${player.ca}/${paVal}`, caRight, y + 13, {
      size: 11.5,
      bold: true,
      color: paVal - player.ca >= 8 ? paColor : THEME.GOLD_LIGHT,
      align: 'right',
      mono: true,
    });

    const nameStr = fitText(ctx, `${hasGold ? '★' : ''}${player.name}`, w - 46, 12, true);
    drawPlayerAvatar(ctx, x + 6, y + 20, 28, 34, player, club, { radius: 5, showFrame: true });
    const midY = y + 36;
    drawText(ctx, nameStr, x + 38, midY - 4, {
      size: 11.5,
      bold: true,
      color: hasGold || player.isNewSigning ? THEME.GOLD_LIGHT : THEME.TX1,
    });

    const secTxt = player.secondaryRoles && player.secondaryRoles.length > 0 ? `·兼${player.secondaryRoles.slice(0, 2).join('/')}` : '';
    drawText(ctx, fitText(ctx, `${player.age}岁${secTxt}`, w - 44, 9.5), x + 38, midY + 10, {
      size: 9,
      color: '#93C5FD',
    });
    const attrLine = player.role === 'GK'
      ? `扑${a.goalkeeping} 站${a.positioning} 冷${a.composure}`
      : `速${a.pace} 射${a.shooting} 传${a.passing} 防${a.defending}`;
    drawText(ctx, attrLine, x + 7, y + 58, {
      size: 9.5,
      color: '#93C5FD',
      mono: true,
    });

    const botY = y + h - 10;
    const g = player.seasonStats.goals;
    const ast = player.seasonStats.assists;
    const leftTxt = g > 0 || ast > 0 ? `熟${opts.fam}% · ${g}球${ast}助` : `熟${opts.fam}%`;
    drawText(ctx, leftTxt, x + 7, botY, {
      size: 9.2,
      color: famCol,
      mono: true,
    });
    drawText(ctx, `体${fit}%`, x + w - 7, botY, {
      size: 9.2,
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
    drawBadge(ctx, 110, 92, 68, 24, club.formation, '#1E3A5F', THEME.GOLD_LIGHT);
    drawText(ctx, `${activePreset.name}`, 188, 104, { size: 14, bold: true, color: THEME.TX1 });
    drawBadge(ctx, 276, 93, 76, 22, `阵型 Lv.${formLv}`, formLv >= 2 ? '#14532D' : '#1E293B', formLv >= 2 ? THEME.GREEN : THEME.TX2);
    drawBadge(ctx, 358, 93, 76, 22, `风格 Lv.${styleLv}`, styleLv >= 2 ? '#1E3A5F' : '#1E293B', styleLv >= 2 ? '#38BDF8' : THEME.TX2);

    drawText(
      ctx,
      `攻 ${lineRatings.att}  ·  中 ${lineRatings.mid}  ·  防 ${lineRatings.def}`,
      454,
      104,
      { size: 12.5, bold: true, color: THEME.GOLD_LIGHT, mono: true }
    );

    drawButton(ctx, hits, 668, 88, 152, 32, '切换阵型与风格 ▾', () => {
      this.activeSysTab = getDefenseSystem(club.formation);
      this.styleModalOpen = true;
    }, { variant: 'primary', fontSize: 11.5, icon: 'tactics' });

    drawButton(ctx, hits, 828, 88, 102, 32, '最佳首发', () => {
      league.updateUserTactics(club.formation, club.style);
      this.selectedStarterIdx = null;
      this.selectedBenchPlayerId = null;
      actions.onSave();
    }, { variant: 'ghost', fontSize: 11.5, icon: 'sparkle' });

    drawButton(ctx, hits, 938, 88, 132, 32, '战术预案 (4套)', () => {
      this.presetModalOpen = true;
    }, { variant: 'ghost', fontSize: 11.5 });

    if (actions.onOpenRoster) {
      drawButton(ctx, hits, 1078, 88, 172, 32, '球队榜单 / 大名单', actions.onOpenRoster, {
        variant: 'ghost',
        fontSize: 11.5,
      });
    }

    // ==================== 左主区：宽屏竖向绿茵球场 (x: 96..726, w: 630, y: 138..704, h: 566) ====================
    const px = 96, py = 138, pw = 630, ph = 566;
    drawChamferPanel(ctx, px, py, pw, ph, 10, '#0B1810', THEME.BORDER);

    const selectedStarter = this.selectedStarterIdx !== null ? squadMap.get(club.starterIds[this.selectedStarterIdx]) : null;
    const selectedBench = this.selectedBenchPlayerId ? squadMap.get(this.selectedBenchPlayerId) : null;
    drawRoundRect(ctx, px + 12, py + 10, pw - 24, 36, 6, 'rgba(14,22,40,0.92)', (selectedStarter || selectedBench) ? THEME.GREEN : THEME.BORDER);
    drawIcon(ctx, (selectedStarter || selectedBench) ? 'refresh' : 'tactics', px + 28, py + 28, 14, (selectedStarter || selectedBench) ? THEME.GREEN : THEME.GOLD_LIGHT);
    const hintText = selectedStarter
      ? (this.swapMode
        ? `换位/换人模式【${selectedStarter.name}】：点击球场队友换位，或点右侧替补换上`
        : this.selectedStarterIdx! > 0
        ? `已选【${selectedStarter.name}】：点击球场空位格子微调站位，或使用周边浮层操作`
        : `已选门将【${selectedStarter.name}】：请在周边浮层触发换人或查看详情`)
      : selectedBench
      ? `已选替补【${selectedBench.name}】：点击下方球场任意首发位置换上`
      : '点击球场球员即可微调站位、设置角色或触发换人';
    drawText(ctx, hintText, px + 44, py + 28, {
      size: 11.5,
      bold: !!(selectedStarter || selectedBench),
      color: (selectedStarter || selectedBench) ? THEME.GREEN : THEME.GOLD_LIGHT,
    });

    if (club.gridSlots || club.slotDuties) {
      drawButton(ctx, hits, px + pw - 74, py + 14, 58, 28, '重置', () => {
        league.resetClubGridAndDuties();
        actions.onSave();
      }, { variant: 'ghost', fontSize: 11 });
    }

    const slots = FORMATIONS[club.formation];
    // 固定预留底部 48px 操作栏，球场高度永远稳定不跳动
    const pitchX = px + 24, pitchY = py + 54, pitchW = pw - 48, pitchH = ph - 118;
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
          hits.add(gx, gy, cellW, cellH, () => {
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
    let minHoverDist = 12;

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

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.shadowBlur = 0;
      drawRoundRect(ctx, mx - 14, my - 9, 28, 18, 4, 'rgba(8, 12, 20, 0.85)', color, 1);
      drawText(ctx, `${Math.round(score)}`, mx, my, { size: 10, bold: true, color, align: 'center', mono: true });
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
          drawText(ctx, `${shirtTxt}${selectedStarter.name.slice(0, 6)}`, popX + 12, popY + 18, { size: 12.5, bold: true, color: THEME.TX1 });
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

    // 球场底部状态提示条（46px，保持球场高度稳定）
    const barY = pitchY + pitchH + 10;
    drawRoundRect(ctx, pitchX, barY, pitchW, 46, 7, 'rgba(14, 22, 40, 0.94)', (selectedStarter || selectedBench) ? THEME.BORDER_GOLD : THEME.BORDER, 1.2);
    if (selectedStarter && this.swapMode) {
      drawText(ctx, `换位/换人模式【${selectedStarter.name}】：点击球场队友互换，或点击右侧替补换上`, pitchX + 14, barY + 23, {
        size: 11.5,
        bold: true,
        color: THEME.GREEN,
      });
      drawButton(ctx, hits, pitchX + pitchW - 92, barY + 9, 80, 28, '取消换人', () => {
        this.swapMode = false;
      }, { variant: 'ghost', fontSize: 11 });
    } else if (selectedBench) {
      drawText(ctx, `已选替补【${selectedBench.role}·${selectedBench.name}】· 点球场任意位置换上`, pitchX + 14, barY + 23, {
        size: 12,
        bold: true,
        color: THEME.GREEN,
      });
      drawButton(ctx, hits, pitchX + pitchW - 122, barY + 9, 58, 28, '详情', () => {
        actions.onInspectPlayer(selectedBench);
      }, { variant: 'primary', fontSize: 11 });
      drawButton(ctx, hits, pitchX + pitchW - 58, barY + 9, 48, 28, '取消', () => {
        this.selectedBenchPlayerId = null;
      }, { variant: 'ghost', fontSize: 11 });
    } else if (selectedStarter) {
      drawText(ctx, `已选【${selectedStarter.name}】· 点空白格微调站位`, pitchX + pitchW / 2, barY + 23, {
        size: 11,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
    } else {
      drawText(ctx, '点球场球员调站位/换人 · 点替补卡替换上场', pitchX + pitchW / 2, barY + 23, {
        size: 11.5,
        color: THEME.TX3,
        align: 'center',
      });
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

    // ==================== 右主区：纯替补席 3 列球员卡片网格 (x: 740..1264, w: 524, y: 138..704, h: 566) ====================
    const starterSet = new Set(club.starterIds);
    const benchSquad = club.squad
      .filter(p => !starterSet.has(p.id))
      .sort((a, b) => b.ca - a.ca);

    drawChamferPanel(ctx, 740, 138, 524, 566, 10, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    drawText(ctx, `替补席 (${benchSquad.length}人)`, 758, 164, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
    drawText(
      ctx,
      this.selectedStarterIdx !== null && this.swapMode ? '点击任意替补卡直接换入首发' : '点击替补卡选中，再点左侧球场替换',
      1246,
      164,
      { size: 11, color: this.selectedStarterIdx !== null && this.swapMode ? THEME.GREEN : THEME.TX3, align: 'right' }
    );

    const pageSize = 15; // 3列 × 5行 = 15张卡片，26人阵容一页全展示
    const totalPages = Math.max(1, Math.ceil(benchSquad.length / pageSize));
    if (this.benchPage >= totalPages) this.benchPage = totalPages - 1;
    const visibleBench = benchSquad.slice(this.benchPage * pageSize, (this.benchPage + 1) * pageSize);

    visibleBench.forEach((p, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cw = 156;
      const ch = 88;
      const cx = 758 + col * 166;
      const cy = 186 + row * 94;

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
      drawButton(ctx, hits, 758, 662, 108, 30, '上一页', () => {
        this.benchPage = Math.max(0, this.benchPage - 1);
      }, { disabled: this.benchPage === 0, fontSize: 11.5 });
      drawText(ctx, `第 ${this.benchPage + 1} / ${totalPages} 页（替补 ${benchSquad.length} 人）`, 1002, 677, {
        size: 11.5,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, 1138, 662, 108, 30, '下一页', () => {
        this.benchPage = Math.min(totalPages - 1, this.benchPage + 1);
      }, { disabled: this.benchPage >= totalPages - 1, fontSize: 11.5 });
    } else {
      drawText(ctx, `共 ${benchSquad.length} 名替补 · 全部展示`, 1002, 677, {
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
    const loadout = league.getMatchLoadout();

    drawText(ctx, '战术保存中心 · 赛前 4 套预置战术 & 4 张出战手牌', mx + 28, my + 32, { size: 19, bold: true, color: THEME.GOLD_LIGHT });
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

    drawChamferPanel(ctx, mx + 28, my + 444, mw - 56, 144, 10, 'rgba(11, 17, 30, 0.9)', THEME.BORDER);
    drawText(ctx, `本场出战手牌 (${loadout.length}/4) · 比赛日将与以上 4 套预案共同控场`, mx + 44, my + 466, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, mx + mw - 190, my + 452, 148, 28, '前往合成台配牌 ▶', () => {
      this.presetModalOpen = false;
      actions.onNavigate('cards');
    }, { variant: 'primary', fontSize: 11 });

    loadout.slice(0, 4).forEach((card, ci) => {
      const cx = mx + 44 + ci * 246;
      const cy = my + 490;
      drawRoundRect(ctx, cx, cy, 234, 82, 8, THEME.BG_CARD, THEME.BORDER_GOLD);
      drawBadge(ctx, cx + 10, cy + 10, 26, 18, `E${card.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
      drawBadge(ctx, cx + 40, cy + 10, 34, 18, `Lv.${card.level ?? 1}`, '#0F172A', '#38BDF8');
      drawText(ctx, card.name.slice(0, 9), cx + 80, cy + 19, { size: 12, bold: true, color: THEME.TX1 });
      const mech = card.mechanic ? MECHANIC_LABELS[card.mechanic] : card.summary.slice(0, 16);
      drawIcon(ctx, 'bolt', cx + 16, cy + 44, 11, '#7DD3FC');
      drawText(ctx, mech, cx + 26, cy + 44, { size: 10, bold: true, color: '#7DD3FC' });
      drawText(ctx, `${card.durationMinutes}分钟 · ${card.chainEffect ? card.chainEffect.label.slice(0, 12) : '基础强化'}`, cx + 10, cy + 64, { size: 10, color: THEME.TX2 });
    });
  }
}
