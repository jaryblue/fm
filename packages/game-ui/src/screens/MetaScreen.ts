/**
 * 局外养成中枢：124 节点「三大防线体系 × 16 阵型 × 六大战术」融合星图 + 俱乐部基建
 * - 星图铺满全宽 (1168px / 1232px)，撤除常驻 378px 右侧详情栏
 * - 点击星图节点滑出半透明详情浮层（支持关闭与 Esc 收起），顶部新增「引擎修正与重置」入口
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import {
  getFormationMasteryInfo,
  getMetaUpgradeCost,
  getStyleMasteryInfo,
  META_BRANCHES,
} from '../../../core/src/MetaTree';
import {
  canUnlockNode,
  computeSkillWebMods,
  getSkillWebEdges,
  getSkillWebSummaryStats,
  isNodeResonating,
  SKILL_WEB_NODES,
  SkillWebNode,
} from '../../../core/src/SkillWeb';
import { MetaBranch } from '../../../core/src/types';
import { DefenseSystem, TACTICAL_PRESETS, TacticalStyle } from '../../../engine/src/types';
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
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, IconName } from '../VectorIcons';

const BRANCH_ICON: Record<MetaBranch, IconName> = {
  scout: 'sparkle',
  finance: 'chart',
  coaching: 'tactics',
  fitness: 'shield',
  academy: 'star',
};

type WebFilter = 'ALL' | 'ACTIVE' | DefenseSystem | TacticalStyle;

const WEB_FILTERS: Array<[WebFilter, string]> = [
  ['ALL', '全图'],
  ['ACTIVE', '⚡主动技'],
  ['4-back', '4后卫'],
  ['3-back', '3后卫'],
  ['5-back', '5后卫'],
  ['tiki_taka', '传控'],
  ['gegenpress', '高压'],
  ['wing_play', '两翼'],
  ['counter', '反击'],
  ['park_bus', '铁桶'],
  ['balanced', '均衡'],
];

export class MetaScreen {
  private tab: 'web' | 'talents' = 'web';
  private selectedNodeId = 'core_master';
  private nodeDrawerOpen = false;
  private summaryModalOpen = false;
  private webFilter: WebFilter = 'ALL';
  private zoom = 1.85;
  private panX = 0;
  private panY = 0;
  private animTime = 0;
  private dragging = false;
  private dragLastX = 0;
  private dragLastY = 0;
  private lastMapRect = { x: 96, y: 156, w: 1168, h: 548 };
  private lastDrawerRect = { x: 872, y: 168, w: 380, h: 524 };
  private notice = '拖拽平移 · 滚轮缩放 · 点击任意星图节点弹出详情与加点浮层';

  public handleEscape(): boolean {
    if (this.summaryModalOpen) {
      this.summaryModalOpen = false;
      return true;
    }
    if (this.nodeDrawerOpen) {
      this.nodeDrawerOpen = false;
      return true;
    }
    return false;
  }

  private inMap(x: number, y: number): boolean {
    const r = this.lastMapRect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private inDrawer(x: number, y: number): boolean {
    if (!this.nodeDrawerOpen) return false;
    const d = this.lastDrawerRect;
    return x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h;
  }

  public update(dtSec: number): void {
    this.animTime += dtSec;
  }

  public onPointerDown(x: number, y: number): void {
    if (this.summaryModalOpen || this.inDrawer(x, y)) return;
    if (this.tab === 'web' && this.inMap(x, y)) {
      this.dragging = true;
      this.dragLastX = x;
      this.dragLastY = y;
    }
  }

  public onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    const dx = x - this.dragLastX;
    const dy = y - this.dragLastY;
    this.dragLastX = x;
    this.dragLastY = y;
    this.panX = Math.max(-700, Math.min(700, this.panX + dx));
    this.panY = Math.max(-700, Math.min(700, this.panY + dy));
  }

  public onPointerUp(): void {
    this.dragging = false;
  }

  public onWheel(deltaY: number, x: number, y: number): boolean {
    if (this.tab !== 'web' || this.summaryModalOpen || this.inDrawer(x, y) || !this.inMap(x, y)) return false;
    const oldZoom = this.zoom;
    const factor = deltaY < 0 ? 1.15 : 0.87;
    const nextZoom = Math.max(0.72, Math.min(2.8, Math.round(oldZoom * factor * 100) / 100));
    if (nextZoom === oldZoom) return true;
    const r = this.lastMapRect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const ratio = nextZoom / oldZoom;
    this.panX = Math.max(-700, Math.min(700, (x - cx) - ((x - cx) - this.panX) * ratio));
    this.panY = Math.max(-700, Math.min(700, (y - cy) - ((y - cy) - this.panY) * ratio));
    this.zoom = nextZoom;
    return true;
  }

  private matchWebFilter(node: SkillWebNode): boolean {
    if (this.webFilter === 'ALL') return true;
    if (this.webFilter === 'ACTIVE') return !!node.activeSkill;
    if (node.id === 'core_master') return true;
    if (this.webFilter === '4-back' || this.webFilter === '3-back' || this.webFilter === '5-back') {
      return node.systemTag === this.webFilter;
    }
    return node.styleTag === this.webFilter;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onBack: () => void;
      onSave: () => void;
      onNavigate?: (tab: NavRailTab) => void;
    }
  ): void {
    const st = league.getState();
    const levels = league.getMetaLevels();
    const hasRail = !!actions.onNavigate;

    drawBroadcastHeader(ctx, hits, {
      kicker: 'META PROGRESSION · 124-NODE TACTICAL SKILL WEB',
      title: '教练战术技能网与俱乐部基建',
      club: hasRail ? league.getUserClub() : undefined,
      onBack: hasRail ? undefined : actions.onBack,
      rightAction: hasRail
        ? { label: '返回门户', variant: 'ghost', onClick: actions.onBack }
        : undefined,
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
    });

    if (actions.onNavigate) {
      drawNavRail(ctx, hits, 'meta', actions.onNavigate);
    }

    const baseX = hasRail ? 96 : 24;
    const totalW = hasRail ? 1168 : 1232;

    const webStats = getSkillWebSummaryStats();
    // 顶部 Tab 切换 + 引擎修正总览入口
    drawButton(ctx, hits, baseX, 76, 240, 32, `战术星图 (${webStats.activeCount}主动+${webStats.modifierCount}改造)`, () => {
      this.tab = 'web';
    }, { active: this.tab === 'web', fontSize: 12, icon: 'tactics' });
    drawButton(ctx, hits, baseX + 248, 76, 180, 32, '俱乐部基建 (5分支)', () => {
      this.tab = 'talents';
      this.nodeDrawerOpen = false;
    }, { active: this.tab === 'talents', fontSize: 12, icon: 'talent' });

    if (this.tab === 'web') {
      drawText(ctx, this.notice, baseX + 444, 92, { size: 11.5, color: '#7DD3FC' });
      drawButton(ctx, hits, baseX + totalW - 310, 76, 160, 32, '引擎修正与熟练度', () => {
        this.summaryModalOpen = true;
      }, { variant: 'primary', fontSize: 11.5, icon: 'chart' });
      drawButton(ctx, hits, baseX + totalW - 142, 76, 142, 32, this.nodeDrawerOpen ? '收起节点详情' : '当前节点详情', () => {
        this.nodeDrawerOpen = !this.nodeDrawerOpen;
      }, { active: this.nodeDrawerOpen, fontSize: 11.5 });
    } else {
      drawText(ctx, this.notice, baseX + 444, 92, { size: 11.5, color: '#7DD3FC' });
    }

    if (this.tab === 'talents') {
      const cardGap = 14;
      const topW = (totalW - cardGap * 2) / 3;
      const botW = (totalW - cardGap) / 2;

      META_BRANCHES.forEach((branch, idx) => {
        const isTop = idx < 3;
        const bx = isTop ? baseX + idx * (topW + cardGap) : baseX + (idx - 3) * (botW + cardGap);
        const by = isTop ? 120 : 418;
        const bw = isTop ? topW : botW;
        const bh = 286;

        const curLv = levels[branch.id] ?? 0;
        const nextCost = getMetaUpgradeCost(branch.id, curLv);
        const canAfford = nextCost !== null && st.metaPointsTotal >= nextCost;

        drawChamferPanel(
          ctx,
          bx,
          by,
          bw,
          bh,
          12,
          'rgba(14, 22, 40, 0.92)',
          curLv > 0 ? branch.accent : THEME.BORDER,
          curLv > 0 ? 1.5 : 1,
          curLv > 0 ? branch.accent : undefined
        );
        drawIcon(ctx, BRANCH_ICON[branch.id], bx + 26, by + 26, 16, branch.accent);
        drawText(ctx, branch.name, bx + 44, by + 26, { size: 17, bold: true, color: branch.accent });
        drawBadge(ctx, bx + bw - 92, by + 15, 72, 22, `Lv.${curLv} / ${branch.maxLevel}`, '#1E293B', THEME.GOLD_LIGHT);

        const startLv = Math.max(0, Math.min(2, curLv - 1));
        for (let li = startLv; li < Math.min(branch.maxLevel, startLv + 3); li++) {
          const row = li - startLv;
          const ly = by + 54 + row * 56;
          const unlocked = curLv >= li + 1;
          drawRoundRect(
            ctx,
            bx + 18,
            ly,
            bw - 36,
            48,
            7,
            unlocked ? 'rgba(34,197,94,0.12)' : THEME.BG_CARD,
            unlocked ? THEME.GREEN : THEME.BORDER
          );
          drawBadge(
            ctx,
            bx + 26,
            ly + 14,
            40,
            20,
            `Lv.${li + 1}`,
            unlocked ? THEME.GREEN : '#334155',
            unlocked ? '#080C14' : THEME.TX2
          );
          drawWrappedText(ctx, branch.levelDescriptions[li], bx + 76, ly + 15, bw - 160, 14, {
            size: 11,
            color: unlocked ? THEME.TX1 : THEME.TX2,
            maxLines: 2,
          });
          drawText(ctx, unlocked ? '已激活' : `${branch.costs[li]}pt`, bx + bw - 28, ly + 24, {
            size: 10,
            bold: true,
            color: unlocked ? THEME.GREEN : THEME.TX3,
            align: 'right',
            mono: !unlocked,
          });
        }

        if (nextCost === null) {
          drawBadge(ctx, bx + 18, by + bh - 46, bw - 36, 32, '该分支已全部精通 (Lv.5)', '#14532D', THEME.GREEN);
        } else {
          drawButton(
            ctx,
            hits,
            bx + 18,
            by + bh - 46,
            bw - 36,
            34,
            canAfford ? `升级 Lv.${curLv + 1} (${nextCost}pt)` : `点数不足 (${nextCost}pt)`,
            () => {
              const res = league.upgradeMetaBranch(branch.id);
              if (res.ok) {
                SoundEngine.playClick();
                this.notice = `已将【${branch.name}】升级至 Lv.${curLv + 1}`;
                actions.onSave();
              } else {
                this.notice = res.reason || '升级失败';
              }
            },
            { variant: canAfford ? 'gold' : 'ghost', disabled: !canAfford, fontSize: 12 }
          );
        }
      });
      return;
    }

    // Tab 1：124 节点融合星图（铺满全宽 totalW）
    const club = league.getUserClub();
    const unlocked = league.getSkillWebUnlocked();
    const unlockedSet = new Set(unlocked);
    const mapW = totalW;
    const mapH = 548;
    const mapX = baseX;
    const mapY = 156;

    // 筛选芯片栏（全宽展开，每个按钮 ~100px 宽，字号放大至 11.5px）
    const chipGap = 6;
    const chipW = Math.floor((mapW - (WEB_FILTERS.length - 1) * chipGap) / WEB_FILTERS.length);
    WEB_FILTERS.forEach(([fk, fl], fi) => {
      drawButton(ctx, hits, mapX + fi * (chipW + chipGap), 116, chipW, 30, fl, () => {
        this.webFilter = fk;
      }, { active: this.webFilter === fk, fontSize: 11.5 });
    });

    this.lastMapRect = { x: mapX, y: mapY, w: mapW, h: mapH };
    drawChamferPanel(ctx, mapX, mapY, mapW, mapH, 12, 'rgba(9, 14, 26, 0.96)', THEME.BORDER_GOLD);

    const cx = mapX + mapW / 2 + this.panX;
    const cy = mapY + mapH / 2 + this.panY;
    const scaleBase = Math.min(mapW, mapH) * 1.05 * this.zoom;
    const toPt = (nx: number, ny: number) => ({
      x: cx + (nx - 0.5) * scaleBase,
      y: cy + (ny - 0.5) * scaleBase,
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX + 4, mapY + 4, mapW - 8, mapH - 8);
    ctx.clip();

    // 0. 星空微粒背景
    for (let si = 0; si < 36; si++) {
      const sx = mapX + ((si * 97 + Math.sin(this.animTime * 0.2 + si) * 14) % mapW + mapW) % mapW;
      const sy = mapY + ((si * 61 + Math.cos(this.animTime * 0.16 + si) * 10) % mapH + mapH) % mapH;
      const sa = 0.14 + 0.18 * Math.sin(this.animTime * 1.6 + si * 1.7);
      ctx.fillStyle = `rgba(148, 163, 184, ${sa.toFixed(2)})`;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // 1. 绘制连线
    const edges = getSkillWebEdges();
    edges.forEach(([a, b], eIdx) => {
      const pa = toPt(a.nx, a.ny);
      const pb = toPt(b.nx, b.ny);
      const both = unlockedSet.has(a.id) && unlockedSet.has(b.id);
      const one = unlockedSet.has(a.id) || unlockedSet.has(b.id);
      const vis = this.matchWebFilter(a) || this.matchWebFilter(b);

      ctx.save();
      ctx.globalAlpha = vis ? 1 : 0.16;
      ctx.strokeStyle = both ? a.color : one ? 'rgba(56, 189, 248, 0.52)' : 'rgba(100, 116, 139, 0.20)';
      ctx.lineWidth = both ? 2.4 : one ? 1.4 : 0.9;
      if (!both && one) {
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -this.animTime * 18;
      }
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();

      if (both && vis) {
        const t = (this.animTime * 0.45 + eIdx * 0.17) % 1;
        const px = pa.x + (pb.x - pa.x) * t;
        const py = pa.y + (pb.y - pa.y) * t;
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 2. 绘制 124 个节点
    const showMidLabels = this.zoom >= 1.12;
    const showAllLabels = this.zoom >= 1.6;
    const equippedSet = new Set(league.getSkillLoadoutIds());
    SKILL_WEB_NODES.forEach((node, nIdx) => {
      const pt = toPt(node.nx, node.ny);
      if (pt.x < mapX - 24 || pt.x > mapX + mapW + 24 || pt.y < mapY - 24 || pt.y > mapY + mapH + 24) return;

      const isUnlocked = unlockedSet.has(node.id);
      const isReachable = canUnlockNode(node.id, unlocked);
      const isSelected = this.selectedNodeId === node.id;
      const isResonating = isUnlocked && isNodeResonating(node, club.formation, club.style);
      const isActiveSkill = !!node.activeSkill;
      const isEquipped = isActiveSkill && equippedSet.has(node.id);
      const filterMatch = this.matchWebFilter(node);

      const baseR =
        node.kind === 'keystone' ? 12 :
        node.kind === 'origin' ? 11 :
        node.kind === 'fusion' ? 9.5 :
        node.kind === 'formation' ? 8.5 : 5.5;
      const r = Math.max(4, (isActiveSkill ? Math.max(baseR, 8.5) * 1.18 : baseR) * Math.min(1.45, Math.max(0.78, this.zoom * 0.72)));
      const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 3.0 + nIdx * 0.4);

      ctx.save();
      ctx.globalAlpha = filterMatch ? 1 : 0.16;

      if (isActiveSkill) {
        const dr = r * 1.28;
        if (filterMatch) {
          ctx.strokeStyle = isEquipped ? '#4ADE80' : '#38BDF8';
          ctx.globalAlpha = (isUnlocked ? 0.55 : 0.30) + pulse * 0.30;
          ctx.lineWidth = isEquipped ? 2.2 : 1.5;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - dr - 4 - pulse * 2);
          ctx.lineTo(pt.x + dr + 4 + pulse * 2, pt.y);
          ctx.lineTo(pt.x, pt.y + dr + 4 + pulse * 2);
          ctx.lineTo(pt.x - dr - 4 - pulse * 2, pt.y);
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha = filterMatch ? 1 : 0.16;
        }

        if (isUnlocked || isSelected || isEquipped) {
          ctx.shadowColor = isSelected ? '#FFFFFF' : isEquipped ? '#4ADE80' : '#38BDF8';
          ctx.shadowBlur = isSelected ? 18 : isEquipped ? 14 : 10 + pulse * 4;
        }

        ctx.fillStyle = isUnlocked ? (isEquipped ? '#065F46' : '#0C4A6E') : isReachable ? '#172554' : '#0B1324';
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - dr);
        ctx.lineTo(pt.x + dr, pt.y);
        ctx.lineTo(pt.x, pt.y + dr);
        ctx.lineTo(pt.x - dr, pt.y);
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = isSelected ? 2.8 : isEquipped ? 2.4 : isUnlocked ? 2.2 : 1.6;
        ctx.strokeStyle = isSelected ? '#FFFFFF' : isEquipped ? '#4ADE80' : isResonating ? '#FEF08A' : isUnlocked ? '#38BDF8' : isReachable ? '#38BDF8' : 'rgba(56, 189, 248, 0.55)';
        ctx.stroke();

        ctx.shadowBlur = 0;
        if (dr >= 9) {
          drawText(ctx, '⚡', pt.x, pt.y + 0.5, {
            size: Math.max(8, Math.round(dr * 0.92)),
            bold: true,
            color: isEquipped ? '#4ADE80' : isUnlocked ? '#FEF08A' : '#7DD3FC',
            align: 'center',
          });
        } else {
          ctx.fillStyle = isEquipped ? '#4ADE80' : '#38BDF8';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        if (isReachable && filterMatch) {
          ctx.strokeStyle = node.color;
          ctx.globalAlpha = (0.22 + pulse * 0.35) * (filterMatch ? 1 : 0.2);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r + 3 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = filterMatch ? 1 : 0.16;
        }
        if (isUnlocked || isSelected || isResonating) {
          ctx.shadowColor = isSelected ? '#FFFFFF' : isResonating ? THEME.GOLD_LIGHT : node.color;
          ctx.shadowBlur = isSelected ? 15 : isResonating ? 10 + pulse * 6 : 6 + pulse * 4;
        }
        ctx.fillStyle = isUnlocked ? node.color : isReachable ? '#1E293B' : '#0F172A';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = isSelected ? 2.6 : isResonating ? 2.2 : isReachable ? 1.8 : 1.1;
        ctx.strokeStyle = isSelected ? '#FFFFFF' : isResonating ? '#FEF08A' : isUnlocked ? '#FDE047' : isReachable ? node.color : '#334155';
        ctx.stroke();

        if ((isResonating || node.kind === 'keystone') && filterMatch) {
          const rot = this.animTime * 1.1 + nIdx;
          ctx.strokeStyle = isResonating ? '#FEF08A' : node.color;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r + 4.5, rot, rot + Math.PI * 0.65);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r + 4.5, rot + Math.PI, rot + Math.PI * 1.65);
          ctx.stroke();
        }
      }
      ctx.restore();

      const showLabel =
        isSelected ||
        node.kind === 'origin' ||
        node.kind === 'keystone' ||
        (showMidLabels && (isActiveSkill || node.kind === 'formation' || node.kind === 'fusion')) ||
        showAllLabels;
      if (filterMatch && showLabel) {
        const rawLabel = node.kind === 'formation' ? node.formationTag! : node.name;
        const label = isActiveSkill ? `⚡${rawLabel}` : rawLabel;
        drawText(ctx, label, pt.x, pt.y + (isActiveSkill ? r * 1.28 : r) + 11, {
          size: isActiveSkill ? 10.5 : node.kind === 'path' ? 10 : 11,
          bold: isActiveSkill || isUnlocked || isSelected || node.kind === 'origin' || node.kind === 'keystone',
          color: isEquipped ? '#4ADE80' : isActiveSkill ? '#7DD3FC' : isResonating ? '#FEF08A' : isUnlocked ? THEME.GOLD_LIGHT : isReachable ? THEME.TX1 : THEME.TX3,
          align: 'center',
        });
      }

      if (
        !this.summaryModalOpen &&
        !this.inDrawer(pt.x, pt.y) &&
        pt.x >= mapX + 6 &&
        pt.x <= mapX + mapW - 6 &&
        pt.y >= mapY + 6 &&
        pt.y <= mapY + mapH - 6
      ) {
        hits.add(pt.x - r - 8, pt.y - r - 8, (r + 8) * 2, (r + 8) * 2 + 8, () => {
          SoundEngine.playClick();
          this.selectedNodeId = node.id;
          this.nodeDrawerOpen = true;
        });
      }
    });
    ctx.restore();

    // 左上角缩放倍率 & 右上角图例
    drawBadge(ctx, mapX + 14, mapY + 14, 184, 24, `缩放 ${Math.round(this.zoom * 100)}% · 拖拽平移`, 'rgba(14,22,40,0.88)', '#7DD3FC');
    drawBadge(ctx, mapX + mapW - 246, mapY + 14, 232, 24, '◆⚡ 主动触发技(34)   ● 被动改造(90)', 'rgba(14,22,40,0.90)', '#38BDF8');

    // 左下角缩放与右下角平移控制
    drawButton(ctx, hits, mapX + 14, mapY + mapH - 40, 62, 28, '全景', () => {
      this.zoom = 0.88;
      this.panX = 0;
      this.panY = 0;
    }, { active: this.zoom <= 0.95, fontSize: 11 });
    drawButton(ctx, hits, mapX + 82, mapY + mapH - 40, 48, 28, '－', () => {
      this.zoom = Math.max(0.72, Math.round((this.zoom - 0.25) * 100) / 100);
    }, { fontSize: 13 });
    drawButton(ctx, hits, mapX + 136, mapY + mapH - 40, 48, 28, '＋', () => {
      this.zoom = Math.min(2.8, Math.round((this.zoom + 0.25) * 100) / 100);
    }, { fontSize: 13 });
    drawButton(ctx, hits, mapX + 190, mapY + mapH - 40, 68, 28, '特写', () => {
      this.zoom = 1.85;
      this.panX = 0;
      this.panY = 0;
    }, { active: this.zoom >= 1.65, fontSize: 11 });

    if (!this.nodeDrawerOpen) {
      drawButton(ctx, hits, mapX + mapW - 156, mapY + mapH - 40, 34, 28, '←', () => { this.panX += 60; }, { variant: 'ghost', fontSize: 12 });
      drawButton(ctx, hits, mapX + mapW - 118, mapY + mapH - 40, 34, 28, '↑', () => { this.panY += 60; }, { variant: 'ghost', fontSize: 12 });
      drawButton(ctx, hits, mapX + mapW - 80, mapY + mapH - 40, 34, 28, '↓', () => { this.panY -= 60; }, { variant: 'ghost', fontSize: 12 });
      drawButton(ctx, hits, mapX + mapW - 42, mapY + mapH - 40, 34, 28, '→', () => { this.panX -= 60; }, { variant: 'ghost', fontSize: 12 });
    }

    // 浮层 1：点击节点滑出的详情抽屉
    if (this.nodeDrawerOpen) {
      this.renderNodeDrawer(ctx, hits, league, mapX, mapY, mapW, mapH, actions);
    }

    // 浮层 2：引擎行为修正、熟练度与洗点重置弹窗
    if (this.summaryModalOpen) {
      this.renderSummaryModal(ctx, hits, league, actions);
    }
  }

  private renderNodeDrawer(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    mapX: number,
    mapY: number,
    mapW: number,
    mapH: number,
    actions: { onSave: () => void }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const unlocked = league.getSkillWebUnlocked();
    const unlockedSet = new Set(unlocked);

    const dw = 392;
    const dh = mapH - 24;
    const dx = mapX + mapW - dw - 12;
    const dy = mapY + 12;
    this.lastDrawerRect = { x: dx, y: dy, w: dw, h: dh };

    drawChamferPanel(ctx, dx, dy, dw, dh, 12, 'rgba(11, 17, 32, 0.96)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    const sel = SKILL_WEB_NODES.find(n => n.id === this.selectedNodeId) ?? SKILL_WEB_NODES[0];
    const selUnlocked = unlockedSet.has(sel.id);
    const selReachable = canUnlockNode(sel.id, unlocked);
    const selResonating = selUnlocked && isNodeResonating(sel, club.formation, club.style);
    const canBuy = selReachable && st.metaPointsTotal >= sel.cost;

    const kindLabel =
      sel.activeSkill ? '⚡ 主动触发技 · 子弹时间' :
      sel.kind === 'origin' ? '体系/战术原点' :
      sel.kind === 'formation' ? '阵型专精节点' :
      sel.kind === 'fusion' ? '体系×战术融合奇点' :
      sel.kind === 'keystone' ? '跨界终极奇点' : '战术路径节点';

    drawBadge(ctx, dx + 18, dy + 16, sel.activeSkill ? 164 : 136, 22, kindLabel, sel.activeSkill ? '#0C4A6E' : '#1E293B', sel.activeSkill ? '#38BDF8' : sel.color);
    drawBadge(
      ctx,
      dx + dw - 168,
      dy + 16,
      90,
      22,
      selResonating ? '共鸣 ×2 ✓' : selUnlocked ? '已点亮 ✓' : selReachable ? '可点亮' : '未连通',
      selResonating ? '#78350F' : selUnlocked ? '#14532D' : selReachable ? '#1E3A5F' : '#111827',
      selResonating ? THEME.GOLD_LIGHT : selUnlocked ? THEME.GREEN : selReachable ? '#7DD3FC' : THEME.TX3
    );
    drawButton(ctx, hits, dx + dw - 68, dy + 14, 52, 26, '关闭', () => {
      this.nodeDrawerOpen = false;
    }, { variant: 'ghost', fontSize: 11 });

    drawText(ctx, sel.name, dx + 18, dy + 62, { size: 22, bold: true, color: sel.color });
    drawWrappedText(ctx, sel.desc, dx + 18, dy + 90, dw - 36, 20, {
      size: 13,
      color: THEME.TX1,
      maxLines: 3,
    });

    if (sel.activeSkill) {
      const sk = sel.activeSkill;
      drawRoundRect(ctx, dx + 18, dy + 154, dw - 36, 54, 8, 'rgba(12, 74, 110, 0.35)', 'rgba(56, 189, 248, 0.45)');
      drawText(ctx, `⚡ 主动技：${sk.name} (${sk.situationLabel})`, dx + 30, dy + 172, { size: 12.5, bold: true, color: '#38BDF8' });
      drawText(ctx, `门槛: 熟度≥${sk.minFamiliarity} / 默契≥${sk.minChemistry} · ${sk.powerLabel.slice(0, 18)}`, dx + 30, dy + 194, { size: 11, color: THEME.GOLD_LIGHT });
    }

    const actionY = sel.activeSkill ? dy + 220 : dy + 166;
    if (selUnlocked) {
      if (sel.activeSkill) {
        const loadoutIds = league.getSkillLoadoutIds();
        const isEquipped = loadoutIds.includes(sel.id);
        drawButton(
          ctx,
          hits,
          dx + 18,
          actionY,
          dw - 36,
          42,
          isEquipped
            ? `⚡ 已装备到比赛槽位 (${loadoutIds.length}/4) · 点击卸下`
            : `⚡ 装备到比赛主动技槽位 (${loadoutIds.length}/4)`,
          () => {
            const res = league.toggleSkillLoadout(sel.id);
            if (res.ok) {
              SoundEngine.playClick();
              this.notice = res.equipped
                ? `已装备主动技【${sel.activeSkill!.name}】`
                : `已卸下主动技【${sel.activeSkill!.name}】`;
              actions.onSave();
            } else {
              this.notice = res.reason || '操作失败';
            }
          },
          { variant: isEquipped ? 'green' : 'primary', fontSize: 12 }
        );
      } else {
        drawBadge(
          ctx,
          dx + 18,
          actionY,
          dw - 36,
          38,
          selResonating ? '当前阵型战术触发双倍共鸣生效中 ✓' : '该战术节点已永久生效 ✓',
          selResonating ? '#78350F' : '#14532D',
          selResonating ? THEME.GOLD_LIGHT : THEME.GREEN
        );
      }
    } else {
      drawButton(
        ctx,
        hits,
        dx + 18,
        actionY,
        dw - 36,
        42,
        !selReachable
          ? '需先点亮相邻节点'
          : canBuy
          ? `点亮此节点 (消耗 ${sel.cost}pt)`
          : `Meta 点数不足 (需要 ${sel.cost}pt)`,
        () => {
          const res = league.unlockSkillWebNode(sel.id);
          if (res.ok) {
            SoundEngine.playGoalCheer();
            this.notice = `已点亮战术节点【${res.nodeName}】！`;
            actions.onSave();
          } else {
            this.notice = res.reason || '无法点亮';
          }
        },
        { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 13.5 }
      );
    }

    // 底部精简信息：当前点亮进度 + 引擎修正入口
    drawChamferPanel(ctx, dx + 18, dy + dh - 146, dw - 36, 76, 8, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `星图进度：${unlocked.length} / ${SKILL_WEB_NODES.length} 节点`, dx + 32, dy + dh - 124, { size: 12.5, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `当前激活：${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, dx + 32, dy + dh - 96, { size: 11.5, color: THEME.TX2 });

    drawButton(ctx, hits, dx + 18, dy + dh - 56, dw - 36, 38, '查看引擎修正 / 重置星图', () => {
      this.summaryModalOpen = true;
    }, { variant: 'ghost', fontSize: 12, icon: 'chart' });
  }

  private renderSummaryModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: { onSave: () => void }
  ): void {
    const club = league.getUserClub();
    const unlocked = league.getSkillWebUnlocked();
    const activeMods = computeSkillWebMods(unlocked, club.formation, club.style);

    ctx.fillStyle = 'rgba(4, 7, 14, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 220;
    const my = 96;
    const mw = 840;
    const mh = 528;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(14, 22, 40, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    drawText(ctx, `引擎行为修正与实战熟练度总览 (${club.formation} · ${TACTICAL_PRESETS[club.style].name})`, mx + 28, my + 34, {
      size: 18,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawButton(ctx, hits, mx + mw - 104, my + 18, 80, 34, '关闭', () => {
      this.summaryModalOpen = false;
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    const modTags: string[] = [];
    if ((activeMods.overlapDepthBonus ?? 0) > 0) modTags.push(`边卫套上 +${activeMods.overlapDepthBonus}m`);
    if (activeMods.dualOverlap) modTags.push('双侧翼卫同插');
    if ((activeMods.falseNineDrop ?? 0) > 0) modTags.push(`伪九回撤 -${activeMods.falseNineDrop}m`);
    if ((activeMods.boxCrashBonus ?? 0) > 0) modTags.push(`中场抢点 +${activeMods.boxCrashBonus}人`);
    if ((activeMods.lineShift ?? 0) !== 0) modTags.push(`防线 ${activeMods.lineShift! > 0 ? '+' : ''}${activeMods.lineShift}m`);
    if ((activeMods.pressDistBonus ?? 0) > 0) modTags.push(`逼抢半径 +${activeMods.pressDistBonus}m`);
    if (activeMods.extraPresser) modTags.push('3人合围围抢');
    if ((activeMods.throughPassBias ?? 0) > 0) modTags.push(`直塞 +${Math.round(activeMods.throughPassBias! * 100)}%`);
    if ((activeMods.longShotBias ?? 0) > 0) modTags.push(`远射 +${Math.round(activeMods.longShotBias! * 100)}%`);
    if ((activeMods.crossBias ?? 0) > 0) modTags.push(`传中 +${Math.round(activeMods.crossBias! * 100)}%`);
    if ((activeMods.shortPassBias ?? 0) > 0) modTags.push(`短传 +${Math.round(activeMods.shortPassBias! * 100)}%`);
    if (activeMods.gkQuickLaunch) modTags.push('门将快发反击');
    if ((activeMods.staminaDrainMul ?? 1) < 1) modTags.push(`体能消耗 -${Math.round((1 - activeMods.staminaDrainMul!) * 100)}%`);

    drawChamferPanel(ctx, mx + 28, my + 74, mw - 56, 172, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, '当前 2D 比赛引擎实时行为修正', mx + 46, my + 100, { size: 14, bold: true, color: '#38BDF8' });
    drawWrappedText(
      ctx,
      modTags.length > 0 ? modTags.join('  ·  ') : '尚未激活引擎行为修正，点亮路径或融合奇点后在 2D 比赛中实时生效',
      mx + 46,
      my + 128,
      mw - 92,
      24,
      { size: 13, color: THEME.TX1, maxLines: 4 }
    );

    const mastery = league.getTacticalMastery();
    const formInfo = getFormationMasteryInfo(club.formation, mastery.formations[club.formation] ?? 0);
    const styleInfo = getStyleMasteryInfo(club.style, mastery.styles[club.style] ?? 0);
    drawChamferPanel(ctx, mx + 28, my + 262, mw - 56, 176, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `实战熟练度 (${unlocked.length}/${SKILL_WEB_NODES.length} 节点已点亮)`, mx + 46, my + 288, {
      size: 14,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(ctx, `${club.formation}：Lv.${formInfo.level} ${formInfo.title} (${formInfo.xp}/15)`, mx + 46, my + 322, {
      size: 13,
      color: THEME.TX1,
    });
    drawText(ctx, formInfo.bonusDesc, mx + 46, my + 344, { size: 12, color: THEME.GREEN });
    drawText(ctx, `${TACTICAL_PRESETS[club.style].name}：Lv.${styleInfo.level} ${styleInfo.title} (${styleInfo.xp}/15)`, mx + 46, my + 380, {
      size: 13,
      color: THEME.TX1,
    });
    drawText(ctx, styleInfo.bonusDesc, mx + 46, my + 402, { size: 12, color: '#38BDF8' });

    drawButton(ctx, hits, mx + 28, my + mh - 66, mw - 56, 44, '重置星图（全额退还 Meta 点数）', () => {
      const res = league.resetSkillWeb();
      if (res.ok) {
        SoundEngine.playClick();
        this.summaryModalOpen = false;
        this.notice = `星图已重置，全额退还 ${res.refunded} Meta 点数！`;
        actions.onSave();
      } else {
        this.notice = res.reason || '无法重置';
      }
    }, { variant: 'ghost', fontSize: 13, icon: 'refresh' });
  }
}
