/**
 * 局外养成中枢：124 节点「三大防线体系 × 16 阵型 × 六大战术」融合星图 + 俱乐部基建
 * - 支持缩放 (0.75x ~ 1.45x)、方向平移、LOD 分级细节、流派高亮筛选、共鸣指示与一键洗点
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
  private webFilter: WebFilter = 'ALL';
  private zoom = 1.85;
  private panX = 0;
  private panY = 0;
  private animTime = 0;
  private dragging = false;
  private dragLastX = 0;
  private dragLastY = 0;
  private lastMapRect = { x: 96, y: 154, w: 776, h: 550 };
  private notice = '滚轮缩放 · 拖拽平移星图 · 匹配当前阵型与战术的节点触发「体系共鸣 ×2」';

  private inMap(x: number, y: number): boolean {
    const r = this.lastMapRect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  public update(dtSec: number): void {
    this.animTime += dtSec;
  }

  public onPointerDown(x: number, y: number): void {
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
    if (this.tab !== 'web' || !this.inMap(x, y)) return false;
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
    // 顶部 Tab 切换
    drawButton(ctx, hits, baseX, 76, 232, 30, `战术星图 (${webStats.activeCount}主动+${webStats.modifierCount}改造)`, () => {
      this.tab = 'web';
    }, { active: this.tab === 'web', fontSize: 11.5, icon: 'tactics' });
    drawButton(ctx, hits, baseX + 234, 76, 176, 30, '俱乐部基建 (5分支)', () => {
      this.tab = 'talents';
    }, { active: this.tab === 'talents', fontSize: 12, icon: 'talent' });

    drawText(ctx, this.notice, baseX + 426, 91, { size: 11.5, color: '#7DD3FC' });

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

    // Tab 1：124 节点「三大防线体系 × 16 阵型 × 六大战术」融合星图
    const club = league.getUserClub();
    const unlocked = league.getSkillWebUnlocked();
    const unlockedSet = new Set(unlocked);
    const mapW = totalW - 392;
    const mapH = 550;
    const mapX = baseX;
    const mapY = 154;

    // 筛选芯片栏
    const chipW = Math.floor((mapW - (WEB_FILTERS.length - 1) * 4) / WEB_FILTERS.length);
    WEB_FILTERS.forEach(([fk, fl], fi) => {
      drawButton(ctx, hits, mapX + fi * (chipW + 4), 116, chipW, 28, fl, () => {
        this.webFilter = fk;
      }, { active: this.webFilter === fk, fontSize: 9.5 });
    });

    this.lastMapRect = { x: mapX, y: mapY, w: mapW, h: mapH };
    drawChamferPanel(ctx, mapX, mapY, mapW, mapH, 12, 'rgba(9, 14, 26, 0.96)', THEME.BORDER_GOLD);

    const cx = mapX + mapW / 2 + this.panX;
    const cy = mapY + mapH / 2 + this.panY;
    const scaleBase = Math.min(mapW, mapH) * 1.02 * this.zoom;
    const toPt = (nx: number, ny: number) => ({
      x: cx + (nx - 0.5) * scaleBase,
      y: cy + (ny - 0.5) * scaleBase,
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX + 4, mapY + 4, mapW - 8, mapH - 8);
    ctx.clip();

    // 0. 星空微粒背景
    for (let si = 0; si < 30; si++) {
      const sx = mapX + ((si * 97 + Math.sin(this.animTime * 0.2 + si) * 14) % mapW + mapW) % mapW;
      const sy = mapY + ((si * 61 + Math.cos(this.animTime * 0.16 + si) * 10) % mapH + mapH) % mapH;
      const sa = 0.14 + 0.18 * Math.sin(this.animTime * 1.6 + si * 1.7);
      ctx.fillStyle = `rgba(148, 163, 184, ${sa.toFixed(2)})`;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // 1. 绘制连线（含行进蚂蚁线与已解锁流光粒子）
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

    // 2. 绘制 124 个节点 (3级 LOD + 主动技菱形双环⚡高亮 + 动态呼吸/脉冲/旋转星环)
    const showMidLabels = this.zoom >= 1.15;
    const showAllLabels = this.zoom >= 1.65;
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
      const r = Math.max(4, (isActiveSkill ? Math.max(baseR, 8.5) * 1.18 : baseR) * Math.min(1.4, Math.max(0.78, this.zoom * 0.72)));
      const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 3.0 + nIdx * 0.4);

      ctx.save();
      ctx.globalAlpha = filterMatch ? 1 : 0.16;

      if (isActiveSkill) {
        // 主动技专属：45° 菱形星核 + 电光青/金双层外环 + ⚡ 标识
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

        // 中心 ⚡ 徽标（足够大时直接绘制，小缩放时绘制高光菱心）
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
        // 被动改造节点：保持圆形节点样式
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
        drawText(ctx, label, pt.x, pt.y + (isActiveSkill ? r * 1.28 : r) + 10, {
          size: isActiveSkill ? 10 : node.kind === 'path' ? 9.5 : 10.5,
          bold: isActiveSkill || isUnlocked || isSelected || node.kind === 'origin' || node.kind === 'keystone',
          color: isEquipped ? '#4ADE80' : isActiveSkill ? '#7DD3FC' : isResonating ? '#FEF08A' : isUnlocked ? THEME.GOLD_LIGHT : isReachable ? THEME.TX1 : THEME.TX3,
          align: 'center',
        });
      }

      if (pt.x >= mapX + 6 && pt.x <= mapX + mapW - 6 && pt.y >= mapY + 6 && pt.y <= mapY + mapH - 6) {
        hits.add(pt.x - r - 6, pt.y - r - 6, (r + 6) * 2, (r + 6) * 2 + 8, () => {
          SoundEngine.playClick();
          this.selectedNodeId = node.id;
        });
      }
    });
    ctx.restore();

    // 左上角缩放倍率胶囊提示 & 右上角图例
    drawBadge(ctx, mapX + 12, mapY + 12, 168, 22, `缩放 ${Math.round(this.zoom * 100)}% · 滚轮/拖拽`, 'rgba(14,22,40,0.88)', '#7DD3FC');
    drawBadge(ctx, mapX + mapW - 228, mapY + 12, 216, 22, '◆⚡ 主动触发技(34)   ● 被动改造(90)', 'rgba(14,22,40,0.90)', '#38BDF8');

    // 画布左下角/右下角缩放与平移控制
    drawButton(ctx, hits, mapX + 12, mapY + mapH - 36, 56, 26, '全景', () => {
      this.zoom = 0.88;
      this.panX = 0;
      this.panY = 0;
    }, { active: this.zoom <= 0.95, fontSize: 10 });
    drawButton(ctx, hits, mapX + 74, mapY + mapH - 36, 44, 26, '－', () => {
      this.zoom = Math.max(0.72, Math.round((this.zoom - 0.25) * 100) / 100);
    }, { fontSize: 12 });
    drawButton(ctx, hits, mapX + 122, mapY + mapH - 36, 44, 26, '＋', () => {
      this.zoom = Math.min(2.8, Math.round((this.zoom + 0.25) * 100) / 100);
    }, { fontSize: 12 });
    drawButton(ctx, hits, mapX + 170, mapY + mapH - 36, 62, 26, '特写', () => {
      this.zoom = 1.85;
      this.panX = 0;
      this.panY = 0;
    }, { active: this.zoom >= 1.65, fontSize: 10 });

    drawButton(ctx, hits, mapX + mapW - 140, mapY + mapH - 36, 30, 26, '←', () => { this.panX += 60; }, { variant: 'ghost', fontSize: 11 });
    drawButton(ctx, hits, mapX + mapW - 106, mapY + mapH - 36, 30, 26, '↑', () => { this.panY += 60; }, { variant: 'ghost', fontSize: 11 });
    drawButton(ctx, hits, mapX + mapW - 72, mapY + mapH - 36, 30, 26, '↓', () => { this.panY -= 60; }, { variant: 'ghost', fontSize: 11 });
    drawButton(ctx, hits, mapX + mapW - 38, mapY + mapH - 36, 30, 26, '→', () => { this.panX -= 60; }, { variant: 'ghost', fontSize: 11 });

    // 右侧：节点详情 + 体系共鸣 + 引擎行为修正总览 + 洗点重置
    const rx = mapX + mapW + 14;
    const rw = 378;
    const rightY = 116;
    const rightH = 588;
    drawChamferPanel(ctx, rx, rightY, rw, rightH, 12, 'rgba(14, 22, 40, 0.94)', THEME.BORDER);

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

    drawBadge(ctx, rx + 18, rightY + 18, sel.activeSkill ? 156 : 128, 22, kindLabel, sel.activeSkill ? '#0C4A6E' : '#1E293B', sel.activeSkill ? '#38BDF8' : sel.color);
    drawBadge(
      ctx,
      rx + rw - 108,
      rightY + 18,
      90,
      22,
      selResonating ? '共鸣 ×2 ✓' : selUnlocked ? '已点亮 ✓' : selReachable ? '可点亮' : '未连通',
      selResonating ? '#78350F' : selUnlocked ? '#14532D' : selReachable ? '#1E3A5F' : '#111827',
      selResonating ? THEME.GOLD_LIGHT : selUnlocked ? THEME.GREEN : selReachable ? '#7DD3FC' : THEME.TX3
    );

    drawText(ctx, sel.name, rx + 18, rightY + 60, { size: 21, bold: true, color: sel.color });
    drawWrappedText(ctx, sel.desc, rx + 18, rightY + 88, rw - 36, 18, {
      size: 12,
      color: THEME.TX1,
      maxLines: 2,
    });

    if (sel.activeSkill) {
      const sk = sel.activeSkill;
      drawText(ctx, `⚡ 主动技：${sk.name} (${sk.situationLabel})`, rx + 18, rightY + 126, { size: 11, bold: true, color: '#38BDF8' });
      drawText(ctx, `门槛:熟度≥${sk.minFamiliarity}/默契≥${sk.minChemistry} · ${sk.powerLabel.slice(0, 18)}`, rx + 18, rightY + 142, { size: 10, color: THEME.GOLD_LIGHT });
    }

    if (selUnlocked) {
      if (sel.activeSkill) {
        const loadoutIds = league.getSkillLoadoutIds();
        const isEquipped = loadoutIds.includes(sel.id);
        drawButton(
          ctx,
          hits,
          rx + 18,
          rightY + 156,
          rw - 36,
          36,
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
          { variant: isEquipped ? 'green' : 'primary', fontSize: 11.5 }
        );
      } else {
        drawBadge(
          ctx,
          rx + 18,
          rightY + 156,
          rw - 36,
          34,
          selResonating ? '当前阵型战术触发双倍共鸣生效中 ✓' : '该战术节点已永久生效 ✓',
          selResonating ? '#78350F' : '#14532D',
          selResonating ? THEME.GOLD_LIGHT : THEME.GREEN
        );
      }
    } else {
      drawButton(
        ctx,
        hits,
        rx + 18,
        rightY + 154,
        rw - 36,
        38,
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
        { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 13 }
      );
    }

    // 当前引擎行为修正实装总览
    const activeMods = computeSkillWebMods(unlocked, club.formation, club.style);
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

    drawChamferPanel(ctx, rx + 18, rightY + 206, rw - 36, 128, 8, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `引擎行为修正 (${club.formation} · ${TACTICAL_PRESETS[club.style].name})`, rx + 30, rightY + 224, {
      size: 12,
      bold: true,
      color: '#38BDF8',
    });
    drawWrappedText(
      ctx,
      modTags.length > 0 ? modTags.join(' · ') : '尚未激活引擎行为修正，点亮路径或融合奇点后在 2D 比赛中实时生效',
      rx + 30,
      rightY + 248,
      rw - 60,
      17,
      { size: 11, color: THEME.TX1, maxLines: 4 }
    );

    // 实战阵型与战术熟练度概览
    const mastery = league.getTacticalMastery();
    const formInfo = getFormationMasteryInfo(club.formation, mastery.formations[club.formation] ?? 0);
    const styleInfo = getStyleMasteryInfo(club.style, mastery.styles[club.style] ?? 0);
    drawChamferPanel(ctx, rx + 18, rightY + 346, rw - 36, 118, 8, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `实战熟练度 (${unlocked.length}/${SKILL_WEB_NODES.length} 节点已点亮)`, rx + 30, rightY + 364, {
      size: 12,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(ctx, `${club.formation}：Lv.${formInfo.level} ${formInfo.title} (${formInfo.xp}/15)`, rx + 30, rightY + 390, {
      size: 11.5,
      color: THEME.TX1,
    });
    drawText(ctx, formInfo.bonusDesc, rx + 30, rightY + 408, { size: 10.5, color: THEME.GREEN });
    drawText(ctx, `${TACTICAL_PRESETS[club.style].name}：Lv.${styleInfo.level} ${styleInfo.title} (${styleInfo.xp}/15)`, rx + 30, rightY + 432, {
      size: 11.5,
      color: THEME.TX1,
    });
    drawText(ctx, styleInfo.bonusDesc, rx + 30, rightY + 450, { size: 10.5, color: '#38BDF8' });

    // 洗点重置星图按钮
    drawButton(ctx, hits, rx + 18, rightY + rightH - 50, rw - 36, 36, '重置星图（全额退还 Meta 点数）', () => {
      const res = league.resetSkillWeb();
      if (res.ok) {
        SoundEngine.playClick();
        this.notice = `星图已重置，全额退还 ${res.refunded} Meta 点数！`;
        actions.onSave();
      } else {
        this.notice = res.reason || '无法重置';
      }
    }, { variant: 'ghost', fontSize: 12, icon: 'refresh' });
  }
}
