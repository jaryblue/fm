/**
 * 页面 3：发行级战术板与阵容页（统一导航轨 + 阵型连线 + 错位警示 + 双向换人）
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
  tierColor,
} from '../CanvasKit';
import { MECHANIC_LABELS } from '../../../core/src/CommandCards';
import { drawJerseyIcon } from '../ClubVisuals';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

const SYS_LIST: DefenseSystem[] = ['4-back', '3-back', '5-back'];
const STYLE_LIST: TacticalStyle[] = ['tiki_taka', 'gegenpress', 'balanced', 'wing_play', 'counter', 'park_bus'];

export class TacticsScreen {
  private selectedStarterIdx: number | null = null;
  private selectedBenchPlayerId: string | null = null;
  private squadPage = 0;
  private activeSysTab: DefenseSystem | null = null;
  private gridMode = false;
  private presetModalOpen = false;
  private presetNotice = '每场比赛最多携带 4 套预置战术（阵型+球员+风格）与 4 张手牌实时控场';

  public handleEscape(): boolean {
    if (this.presetModalOpen) {
      this.presetModalOpen = false;
      return true;
    }
    if (this.selectedStarterIdx !== null || this.selectedBenchPlayerId !== null) {
      this.selectedStarterIdx = null;
      this.selectedBenchPlayerId = null;
      return true;
    }
    return false;
  }

  public onWheel(deltaY: number): boolean {
    if (this.presetModalOpen) return false;
    const step = deltaY > 0 ? 1 : -1;
    const next = Math.max(0, Math.min(2, this.squadPage + step));
    if (next !== this.squadPage) {
      this.squadPage = next;
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
    onSave();
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

    // 左栏：三大防线体系选阵 + 战术风格 + 实时风格参数 + 三线战力
    drawChamferPanel(ctx, 96, 80, 276, 624, 10, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    drawText(ctx, '阵型体系 (4/3/5后卫)', 114, 100, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, 274, 88, 80, 22, '最佳首发', () => {
      league.updateUserTactics(club.formation, club.style);
      this.selectedStarterIdx = null;
      this.selectedBenchPlayerId = null;
      actions.onSave();
    }, { variant: 'primary', fontSize: 10, icon: 'sparkle' });

    const curSys = this.activeSysTab ?? getDefenseSystem(club.formation);
    SYS_LIST.forEach((sys, si) => {
      const label = sys === '4-back' ? '4后卫(8)' : sys === '3-back' ? '3后卫(4)' : '5后卫(4)';
      drawButton(ctx, hits, 114 + si * 82, 116, 78, 24, label, () => {
        this.activeSysTab = sys;
      }, { active: curSys === sys, fontSize: 10 });
    });

    const sysForms = FORMATION_SYSTEMS[curSys].formations;
    sysForms.forEach((f, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawButton(
        ctx,
        hits,
        114 + col * 124,
        146 + row * 27,
        116,
        23,
        f,
        () => {
          league.updateUserTactics(f, club.style);
          this.activeSysTab = getDefenseSystem(f);
          this.selectedStarterIdx = null;
          this.selectedBenchPlayerId = null;
          actions.onSave();
        },
        { active: club.formation === f, fontSize: 11 }
      );
    });

    drawText(ctx, '战术风格 (2×3)', 114, 256, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
    STYLE_LIST.forEach((s, idx) => {
      const preset = TACTICAL_PRESETS[s];
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawButton(
        ctx,
        hits,
        114 + col * 124,
        274 + row * 38,
        116,
        32,
        preset.name,
        () => {
          league.updateUserTactics(club.formation, s, club.starterIds);
          actions.onSave();
        },
        { active: club.style === s, fontSize: 11 }
      );
    });

    // 实时战术风格参数 + 教练熟练度透明面板
    const activePreset = TACTICAL_PRESETS[club.style];
    const mastery = league.getTacticalMastery();
    const formLv = Math.min(3, (mastery.formations[club.formation] ?? 0) >= 15 ? 3 : (mastery.formations[club.formation] ?? 0) >= 6 ? 2 : 1);
    const styleLv = Math.min(3, (mastery.styles[club.style] ?? 0) >= 15 ? 3 : (mastery.styles[club.style] ?? 0) >= 6 ? 2 : 1);
    drawChamferPanel(ctx, 114, 396, 240, 148, 8, THEME.BG_CARD, THEME.BORDER_GOLD);
    drawText(ctx, `${activePreset.name} · 熟练 Lv.${styleLv}`, 128, 414, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawBadge(ctx, 276, 405, 68, 18, `阵型 Lv.${formLv}`, formLv >= 2 ? '#14532D' : '#1E293B', formLv >= 2 ? THEME.GREEN : THEME.TX2);
    const styleBars: Array<[string, number, string, string]> = [
      ['防线高度', (activePreset.lineHeight + 8) / 16, `${activePreset.lineHeight >= 0 ? '+' : ''}${activePreset.lineHeight}m`, '#38BDF8'],
      ['逼抢强度', (activePreset.pressIntensity - 0.5) / 1.0, `${Math.round(activePreset.pressIntensity * 100)}%`, THEME.RED_LIGHT],
      ['比赛节奏', (activePreset.tempo - 0.7) / 0.6, `${activePreset.tempo.toFixed(2)}x`, THEME.GOLD_LIGHT],
      ['直传倾角', activePreset.directness, `${Math.round(activePreset.directness * 100)}%`, THEME.GREEN],
    ];
    styleBars.forEach(([lbl, ratio, txt, col], si) => {
      const sy = 440 + si * 25;
      const pct = Math.max(0.08, Math.min(1, ratio));
      drawText(ctx, lbl, 128, sy, { size: 11, color: THEME.TX2 });
      drawRoundRect(ctx, 188, sy - 4, 112, 8, 4, '#1E293B');
      drawRoundRect(ctx, 188, sy - 4, Math.round(pct * 112), 8, 4, col);
      drawText(ctx, txt, 342, sy, { size: 11, bold: true, color: col, align: 'right', mono: true });
    });

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
    drawChamferPanel(ctx, 114, 558, 240, 128, 8, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, '首发三线实时战力', 128, 578, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    const lines: Array<[string, number, string, 'sword' | 'ball' | 'shield']> = [
      ['锋线进攻', avg(lineSums.att), THEME.RED_LIGHT, 'sword'],
      ['中场调度', avg(lineSums.mid), '#38BDF8', 'ball'],
      ['防线稳固', avg(lineSums.def), THEME.GREEN, 'shield'],
    ];
    lines.forEach(([lbl, val, col, ic], li) => {
      const ly = 604 + li * 26;
      drawIcon(ctx, ic, 134, ly, 12, col);
      drawText(ctx, lbl, 146, ly, { size: 11, color: THEME.TX2 });
      drawRoundRect(ctx, 206, ly - 5, 108, 10, 4, '#1E293B');
      drawRoundRect(ctx, 206, ly - 5, Math.round((Math.min(99, val) / 99) * 108), 10, 4, col);
      drawText(ctx, `${val}`, 342, ly, { size: 12, bold: true, color: col, align: 'right', mono: true });
    });

    // 中栏：竖向战术绿茵球场
    const px = 384, py = 80, pw = 428, ph = 624;
    drawChamferPanel(ctx, px, py, pw, ph, 10, '#0B1810', THEME.BORDER);

    const selectedStarter = this.selectedStarterIdx !== null ? squadMap.get(club.starterIds[this.selectedStarterIdx]) : null;
    const selectedBench = this.selectedBenchPlayerId ? squadMap.get(this.selectedBenchPlayerId) : null;
    drawRoundRect(ctx, px + 10, py + 10, pw - 20, 34, 6, 'rgba(14,22,40,0.92)', (selectedStarter || selectedBench) ? THEME.GREEN : THEME.BORDER);
    drawIcon(ctx, (selectedStarter || selectedBench) ? 'refresh' : 'tactics', px + 24, py + 27, 13, (selectedStarter || selectedBench) ? THEME.GREEN : THEME.GOLD_LIGHT);
    const hintText = selectedStarter
      ? (this.gridMode && this.selectedStarterIdx! > 0
        ? `【${selectedStarter.name}】点绿茵格子微调站位`
        : `已选【${selectedStarter.name}】：点右侧换上或互换`)
      : selectedBench
      ? `已选替补【${selectedBench.name}】：点球场位置换上`
      : '点球场首发调职责/换人 · 悬停连线看默契';
    drawText(ctx, hintText, px + 38, py + 27, {
      size: 10.5,
      bold: !!(selectedStarter || selectedBench),
      color: (selectedStarter || selectedBench) ? THEME.GREEN : THEME.GOLD_LIGHT,
    });

    drawButton(ctx, hits, px + pw - 138, py + 14, 68, 26, '5×6格子', () => {
      this.gridMode = !this.gridMode;
    }, { active: this.gridMode, fontSize: 10 });

    if (selectedStarter || selectedBench) {
      drawButton(ctx, hits, px + pw - 64, py + 14, 48, 26, '取消', () => {
        this.selectedStarterIdx = null;
        this.selectedBenchPlayerId = null;
      }, { variant: 'ghost', fontSize: 10 });
    } else if (club.gridSlots || club.slotDuties) {
      drawButton(ctx, hits, px + pw - 64, py + 14, 48, 26, '重置', () => {
        league.resetClubGridAndDuties();
        actions.onSave();
      }, { variant: 'ghost', fontSize: 10 });
    }

    const slots = FORMATIONS[club.formation];
    const selectedSlotRole = this.selectedStarterIdx !== null ? slots[this.selectedStarterIdx]?.role : undefined;
    const dutyOptions = selectedSlotRole ? ROLE_DUTY_OPTIONS[selectedSlotRole] : undefined;
    const hasDutyBar = !!(dutyOptions && dutyOptions.length > 0);
    const pitchX = px + 20, pitchY = py + 54, pitchW = pw - 40, pitchH = hasDutyBar ? ph - 116 : ph - 74;
    const stripeH = pitchH / 8;
    for (let si = 0; si < 8; si++) {
      ctx.fillStyle = si % 2 === 0 ? THEME.BG_PITCH : THEME.BG_PITCH_ALT;
      ctx.fillRect(pitchX, pitchY + si * stripeH, pitchW, stripeH);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);
    ctx.beginPath();
    ctx.moveTo(pitchX, pitchY + pitchH / 2);
    ctx.lineTo(pitchX + pitchW, pitchY + pitchH / 2);
    ctx.stroke();

    if (this.gridMode) {
      const cellW = pitchW / 5;
      const cellH = pitchH / 6;
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 6; r++) {
          const gx = pitchX + c * cellW;
          const gy = pitchY + (5 - r) * cellH;
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.24)';
          ctx.lineWidth = 1;
          ctx.strokeRect(gx + 1, gy + 1, cellW - 2, cellH - 2);
          if (this.selectedStarterIdx !== null && this.selectedStarterIdx > 0) {
            const curGrid = club.gridSlots?.[this.selectedStarterIdx];
            if (curGrid && curGrid.col === c && curGrid.row === r) {
              ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
              ctx.fillRect(gx + 1, gy + 1, cellW - 2, cellH - 2);
            }
            const sIdx = this.selectedStarterIdx;
            hits.add(gx, gy, cellW, cellH, () => {
              league.setClubGridSlot(sIdx, c, r);
              actions.onSave();
            });
          }
        }
      }
    }

    const chemSummary = league.getTacticsChemistrySummary();
    const slotCoords = slots.map((sl, idx) => {
      const customGrid = idx > 0 ? club.gridSlots?.[idx] : undefined;
      const pos = customGrid ? gridToPitch(customGrid.col, customGrid.row) : sl;
      return {
        x: pitchX + (pos.baseY / PITCH.WIDTH) * pitchW,
        y: pitchY + (1 - pos.baseX / PITCH.LENGTH) * pitchH,
      };
    });

    const pointToSegDist = (px0: number, py0: number, x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq <= 0.0001) return Math.hypot(px0 - x1, py0 - y1);
      const t = Math.max(0, Math.min(1, ((px0 - x1) * dx + (py0 - y1) * dy) / lenSq));
      return Math.hypot(px0 - (x1 + t * dx), py0 - (y1 + t * dy));
    };

    // 绘制中轴脊柱 + 边路走廊 + 双塔默契连线
    let hoveredLink: (typeof chemSummary.specs)[number] | null = null;
    let hoveredMidX = 0;
    let hoveredMidY = 0;
    let minHoverDist = 11;

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
      drawRoundRect(ctx, mx - 13, my - 8, 26, 16, 4, 'rgba(8, 12, 20, 0.85)', color, 1);
      drawText(ctx, `${Math.round(score)}`, mx, my, { size: 9, bold: true, color, align: 'center', mono: true });
    }
    ctx.restore();

    const spine = chemSummary.spineInfo;
    if (spine.linkCount > 0) {
      const spineCol = spine.bonus >= 4 ? THEME.GOLD_LIGHT : spine.bonus >= 2 ? THEME.GREEN : '#94A3B8';
      drawBadge(
        ctx,
        pitchX + 6,
        pitchY + 6,
        158,
        20,
        `中轴脊柱 ${spine.avg}${spine.bonus > 0 ? ` · 共振+${spine.bonus}` : ''}`,
        'rgba(8, 12, 20, 0.86)',
        spineCol
      );
    }

    slots.forEach((slot, i) => {
      const pid = club.starterIds[i];
      const player = squadMap.get(pid);
      if (!player) return;

      const sx = slotCoords[i].x;
      const sy = slotCoords[i].y;
      const isSelected = this.selectedStarterIdx === i;
      const canDropBench = this.selectedBenchPlayerId !== null;
      const roleLine = (r: string) =>
        r === 'GK' ? 'GK' :
        ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r) ? 'DEF' :
        ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(r) ? 'MID' : 'ATT';
      const exactFit = player.role === slot.role;
      const secondaryFit = !exactFit && (player.secondaryRoles?.includes(slot.role) ?? false);
      const lineFit = exactFit || secondaryFit || (roleLine(player.role) === roleLine(slot.role) && (slot.role !== 'GK' || player.role === 'GK'));
      const isInjured = (player.injuredRounds ?? 0) > 0;
      const isSuspended = (player.suspendedRounds ?? 0) > 0;
      const isBlocked = isInjured || isSuspended;
      const fitBorder = isBlocked ? THEME.RED_LIGHT : isSelected ? THEME.GOLD_LIGHT : canDropBench ? THEME.GREEN : !lineFit ? THEME.RED_LIGHT : secondaryFit ? '#38BDF8' : !exactFit ? '#FBBF24' : THEME.GOLD;
      const fam = league.getPlayerFamiliarity(player, club.formation);
      const famCol = fam >= 85 ? THEME.GOLD_LIGHT : fam >= 65 ? THEME.GREEN : fam >= 35 ? '#38BDF8' : '#FCA5A5';

      drawRoundRect(
        ctx,
        sx - 35,
        sy - 28,
        70,
        56,
        7,
        isBlocked ? 'rgba(127,29,29,0.85)' : isSelected ? '#2C220B' : canDropBench ? '#102A1B' : !lineFit ? 'rgba(127,29,29,0.75)' : 'rgba(14,22,40,0.9)',
        fitBorder,
        isBlocked || isSelected || canDropBench || !lineFit ? 2 : 1
      );
      drawJerseyIcon(ctx, sx, sy - 8, 22, club, player.shirtNumber);
      if (isBlocked) {
        drawBadge(ctx, sx - 33, sy - 26, 28, 13, isSuspended ? '停赛' : '伤停', '#991B1B', '#FEE2E2');
      }
      if (player.id === league.getCaptainId(club)) {
        drawBadge(ctx, sx + 18, sy - 26, 15, 13, 'C', '#FACC15', '#080C14');
      }
      const slotDuty = club.slotDuties?.[i] ?? 'default';
      const dutyOpt = slotDuty !== 'default' ? ROLE_DUTY_OPTIONS[slot.role]?.find(d => d.duty === slotDuty) : undefined;
      const roleLabel = dutyOpt ? `${slot.role}·${dutyOpt.label.slice(0, 2)}` : `${slot.role}${secondaryFit ? '·兼' : ''}`;
      drawText(ctx, `${roleLabel} ${player.ca}`, sx, sy + 9, {
        size: 9,
        bold: true,
        color: !lineFit ? THEME.RED_LIGHT : secondaryFit ? '#38BDF8' : !exactFit ? '#FBBF24' : THEME.GOLD_LIGHT,
        align: 'center',
      });
      drawText(ctx, !lineFit ? `${player.name.slice(0, 3)}·错位` : player.name.slice(0, 5), sx, sy + 19, {
        size: 9.5,
        bold: true,
        color: !lineFit ? '#FCA5A5' : THEME.TX1,
        align: 'center',
      });
      drawText(ctx, `熟${fam}%`, sx, sy + 28, {
        size: 8.5,
        color: famCol,
        align: 'center',
        mono: true,
      });

      hits.add(sx - 35, sy - 28, 70, 56, () => {
        if (this.selectedBenchPlayerId) {
          this.swapStarterWithPlayer(league, i, this.selectedBenchPlayerId, actions.onSave);
        } else if (this.selectedStarterIdx === null) {
          this.selectedStarterIdx = i;
        } else if (this.selectedStarterIdx === i) {
          this.selectedStarterIdx = null;
        } else {
          this.swapStarterWithPlayer(league, this.selectedStarterIdx, pid, actions.onSave);
        }
      });
    });

    if (hasDutyBar && this.selectedStarterIdx !== null && dutyOptions) {
      const sIdx = this.selectedStarterIdx;
      const barY = pitchY + pitchH + 8;
      const curDuty = club.slotDuties?.[sIdx] ?? 'default';
      drawRoundRect(ctx, pitchX, barY, pitchW, 44, 6, 'rgba(14, 22, 40, 0.94)', THEME.BORDER_GOLD, 1);
      drawText(ctx, `${selectedSlotRole} 职责:`, pitchX + 10, barY + 22, { size: 10.5, bold: true, color: THEME.GOLD_LIGHT });
      const btnW = Math.min(84, Math.floor((pitchW - 88) / dutyOptions.length) - 4);
      dutyOptions.forEach((opt, di) => {
        drawButton(ctx, hits, pitchX + 76 + di * (btnW + 4), barY + 9, btnW, 26, opt.label.slice(0, 5), () => {
          league.setClubSlotDuty(sIdx, opt.duty);
          actions.onSave();
        }, { active: curDuty === opt.duty, fontSize: 10 });
      });
    }

    if (hoveredLink) {
      const tx = Math.max(pitchX + 4, Math.min(pitchX + pitchW - 196, hoveredMidX - 96));
      const ty = Math.max(pitchY + 6, hoveredMidY - 64);
      const lk = hoveredLink.link;
      drawRoundRect(ctx, tx, ty, 192, 54, 8, 'rgba(8, 12, 22, 0.96)', THEME.GOLD_LIGHT, 1.3);
      const titleTxt = lk.title ? `${hoveredLink.defaultLabel} · ${lk.title}` : hoveredLink.defaultLabel;
      drawText(ctx, `${hoveredLink.playerA.name.slice(0, 4)} × ${hoveredLink.playerB.name.slice(0, 4)}`, tx + 10, ty + 14, { size: 11, bold: true, color: THEME.TX1 });
      drawText(ctx, titleTxt, tx + 182, ty + 14, { size: 9.5, bold: true, color: THEME.GOLD_LIGHT, align: 'right' });
      drawText(ctx, `默契 ${Math.round(lk.score)}  ·  同场 ${lk.matches}  ·  传球 ${lk.passes}  ·  助攻 ${lk.assists}`, tx + 10, ty + 35, {
        size: 10,
        color: '#93C5FD',
        mono: true,
      });
    }

    // 右栏：全队大名单与替补轮换（支持 26 人大名单分页浏览与任意轮换）
    drawChamferPanel(ctx, 824, 80, 440, 624, 10, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    drawText(ctx, `替补轮换 (${club.squad.length}人)`, 842, 104, { size: 14, bold: true });
    drawButton(ctx, hits, 1018, 92, 116, 24, '战术保存/预案(4)', () => {
      this.presetModalOpen = true;
    }, { variant: 'gold', fontSize: 10 });
    if (actions.onOpenRoster) {
      drawButton(ctx, hits, 1140, 92, 110, 24, '球队榜单/大名单', actions.onOpenRoster, { variant: 'ghost', fontSize: 10 });
    }
    const starterSet = new Set(club.starterIds);
    const sortedSquad = [...club.squad].sort((a, b) => {
      const sa = starterSet.has(a.id) ? 0 : 1;
      const sb = starterSet.has(b.id) ? 0 : 1;
      return sa !== sb ? sa - sb : b.ca - a.ca;
    });

    const captainId = league.getCaptainId(club);
    const pageSize = 11;
    const totalPages = Math.max(1, Math.ceil(sortedSquad.length / pageSize));
    if (this.squadPage >= totalPages) this.squadPage = totalPages - 1;
    const visibleSquad = sortedSquad.slice(this.squadPage * pageSize, (this.squadPage + 1) * pageSize);

    visibleSquad.forEach((p, idx) => {
      const ry = 128 + idx * 48;
      const isStarter = starterSet.has(p.id);
      const isBenchSelected = this.selectedBenchPlayerId === p.id;
      const isStarterSelected = this.selectedStarterIdx !== null && club.starterIds[this.selectedStarterIdx] === p.id;
      const isSuspended = (p.suspendedRounds ?? 0) > 0;
      const isInjured = (p.injuredRounds ?? 0) > 0;
      const isBlocked = isSuspended || isInjured;
      const isCaptain = p.id === captainId;
      const storyTag = league.getPlayerStoryTag(p);

      drawRoundRect(
        ctx,
        838,
        ry,
        412,
        44,
        6,
        (isBenchSelected || isStarterSelected) ? '#1B3A2A' : THEME.BG_CARD,
        (isBenchSelected || isStarterSelected) ? THEME.GREEN : isCaptain ? THEME.GOLD_LIGHT : isStarter ? 'rgba(34,197,94,0.35)' : THEME.BORDER,
        (isBenchSelected || isStarterSelected || isCaptain) ? 1.5 : 1
      );

      drawBadge(
        ctx,
        844,
        ry + 4,
        34,
        17,
        isSuspended ? '停赛' : isInjured ? '伤停' : isStarter ? '首发' : '替补',
        isBlocked ? '#991B1B' : isStarter ? '#15803D' : '#334155'
      );
      drawBadge(ctx, 882, ry + 4, 32, 17, p.role, tierColor(p.tier));
      drawText(ctx, p.name.slice(0, 5), 918, ry + 13, { size: 11.5, bold: true, color: p.isNewSigning ? THEME.GOLD_LIGHT : THEME.TX1 });

      if (storyTag) {
        drawBadge(ctx, 988, ry + 4, 52, 17, storyTag, '#312E81', '#C4B5FD');
      }
      if (p.strainWarning && !isBlocked) {
        drawBadge(ctx, 1044, ry + 4, 32, 17, '疲惫', '#78350F', '#FBBF24');
      } else if (p.morale === 'high') {
        drawBadge(ctx, 1044, ry + 4, 32, 17, '高昂', '#14532D', '#4ADE80');
      } else if (p.morale === 'low') {
        drawBadge(ctx, 1044, ry + 4, 32, 17, '低迷', '#7F1D1D', '#FCA5A5');
      } else if (p.isNewSigning) {
        drawBadge(ctx, 1044, ry + 4, 24, 17, '新', '#1E3A5F', '#38BDF8');
      }
      drawText(ctx, `${p.ca}`, 1104, ry + 13, {
        size: 12,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'right',
        mono: true,
      });

      if (isStarter && !isBlocked) {
        if (isCaptain) {
          drawBadge(ctx, 1110, ry + 4, 30, 17, '队长', '#FACC15', '#080C14');
        } else {
          drawButton(ctx, hits, 1110, ry + 3, 30, 19, '设C', () => {
            SoundEngine.playRewardChime();
            league.setCaptain(p.id);
            actions.onSave();
          }, { variant: 'ghost', fontSize: 9.5 });
        }
      }

      const actionLabel =
        isSuspended ? '停赛' :
        isInjured ? '伤停' :
        isStarterSelected || isBenchSelected ? '已选' :
        this.selectedStarterIdx !== null ? '换入' :
        isStarter ? '选下' : '换上';

      drawButton(ctx, hits, 1146, ry + 3, 62, 22, actionLabel, () => {
        if (isBlocked) return;
        if (this.selectedStarterIdx !== null) {
          this.swapStarterWithPlayer(league, this.selectedStarterIdx, p.id, actions.onSave);
        } else if (isStarter) {
          const sIdx = club.starterIds.indexOf(p.id);
          this.selectedStarterIdx = sIdx >= 0 ? sIdx : null;
          this.selectedBenchPlayerId = null;
        } else {
          this.selectedBenchPlayerId = isBenchSelected ? null : p.id;
          this.selectedStarterIdx = null;
        }
      }, {
        variant: isBlocked ? 'danger' : (isStarterSelected || isBenchSelected || this.selectedStarterIdx !== null) ? 'green' : 'primary',
        disabled: isBlocked,
        fontSize: 10,
      });

      drawButton(ctx, hits, 1212, ry + 3, 34, 22, '详', () => {
        actions.onInspectPlayer(p);
      }, { fontSize: 10 });

      // 第二行：关键属性数值 + 体能 + 年龄/兼任
      const a = p.attributes;
      const attrSummary = p.role === 'GK'
        ? `扑${a.goalkeeping} 站${a.positioning} 冷${a.composure}`
        : `速${a.pace} 射${a.shooting} 传${a.passing} 防${a.defending}`;
      const fit = Math.round(p.fitness ?? 100);
      const secTxt = p.secondaryRoles && p.secondaryRoles.length > 0 ? ` +${p.secondaryRoles[0]}` : '';
      drawText(ctx, `${attrSummary}  |  体${fit}%  |  ${p.age}岁${secTxt}`, 846, ry + 33, {
        size: 10,
        color: fit < 60 ? '#FBBF24' : THEME.TX2,
        mono: true,
      });
    });

    if (totalPages > 1) {
      drawButton(ctx, hits, 842, 666, 96, 28, '上一页', () => {
        this.squadPage = Math.max(0, this.squadPage - 1);
      }, { disabled: this.squadPage === 0, fontSize: 11 });
      drawText(ctx, `第 ${this.squadPage + 1} / ${totalPages} 页 (首发11 + 替补${sortedSquad.length - 11})`, 1044, 680, {
        size: 11,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, 1150, 666, 96, 28, '下一页', () => {
        this.squadPage = Math.min(totalPages - 1, this.squadPage + 1);
      }, { disabled: this.squadPage >= totalPages - 1, fontSize: 11 });
    }

    if (this.presetModalOpen) {
      this.renderPresetModal(ctx, hits, league, actions);
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

      drawButton(ctx, hits, px + 14, py + 116, 174, 32, '💾 保存当前阵容至此', () => {
        SoundEngine.playClick();
        league.saveTacticalPreset(idx);
        actions.onSave();
        this.presetNotice = `已将当前【${club.formation} · ${TACTICAL_PRESETS[club.style].name}】及 11 名首发保存至预案 ${idx + 1}！`;
      }, { variant: 'primary', fontSize: 11 });

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
      drawText(ctx, `⚡ ${mech}`, cx + 10, cy + 44, { size: 10, bold: true, color: '#7DD3FC' });
      drawText(ctx, `${card.durationMinutes}分钟 · ${card.chainEffect ? card.chainEffect.label.slice(0, 12) : '基础强化'}`, cx + 10, cy + 64, { size: 10, color: THEME.TX2 });
    });
  }
}
