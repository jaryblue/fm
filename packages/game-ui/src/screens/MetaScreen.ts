/**
 * 局外养成中枢：124 节点「三大防线体系 × 16 阵型 × 六大战术」融合星图 + 俱乐部基建
 * - 星图铺满全宽 (1168px / 1232px)，撤除常驻 378px 右侧详情栏
 * - 点击星图节点滑出半透明详情浮层（支持关闭与 Esc 收起），顶部新增「引擎修正与重置」入口
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import {
  getFormationMasteryInfo,
  getMetaUpgradeCost,
  getMetaUpgradeRequirement,
  getStyleMasteryInfo,
  INFRA_MIN_TIERS,
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
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, drawSkillGlyph, getNodeGlyphKind, IconName } from '../VectorIcons';

const BRANCH_ICON: Record<MetaBranch, IconName> = {
  academy: 'star',
  scout: 'sparkle',
  finance: 'chart',
  transfer: 'refresh',
  medical: 'shield',
  training_ground: 'bolt',
  stadium: 'trophy',
  analytics: 'tactics',
};

type WebFilter = 'ALL' | 'ACTIVE' | DefenseSystem | TacticalStyle;

const WEB_FILTERS: Array<[WebFilter, string]> = [
  ['ALL', '全图'],
  ['ACTIVE', '主动技'],
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
      clubFunds: league.getClubFunds(),
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
    drawButton(ctx, hits, baseX + 248, 76, 204, 32, '俱乐部基建 (8×8 · 资金)', () => {
      this.tab = 'talents';
      this.nodeDrawerOpen = false;
    }, { active: this.tab === 'talents', fontSize: 12, icon: 'talent' });

    if (this.tab === 'web') {
      drawText(ctx, this.notice, baseX + 468, 92, { size: 11.5, color: '#7DD3FC' });
      drawButton(ctx, hits, baseX + totalW - 310, 76, 160, 32, '引擎修正与熟练度', () => {
        this.summaryModalOpen = true;
      }, { variant: 'primary', fontSize: 11.5, icon: 'chart' });
      drawButton(ctx, hits, baseX + totalW - 142, 76, 142, 32, this.nodeDrawerOpen ? '收起节点详情' : '当前节点详情', () => {
        this.nodeDrawerOpen = !this.nodeDrawerOpen;
      }, { active: this.nodeDrawerOpen, fontSize: 11.5 });
    } else {
      drawText(
        ctx,
        `${this.notice} · 历史最高第 ${league.getBestTierReached()} 级`,
        baseX + 468,
        92,
        { size: 11.5, color: '#7DD3FC' }
      );
    }

    if (this.tab === 'talents') {
      const cardGap = 12;
      const cardW = (totalW - cardGap * 3) / 4;
      const cardH = 286;
      const clubFunds = league.getClubFunds();
      const bestTier = league.getBestTierReached();

      META_BRANCHES.forEach((branch, idx) => {
        const col = idx % 4;
        const row = Math.floor(idx / 4);
        const bx = baseX + col * (cardW + cardGap);
        const by = 120 + row * (cardH + 12);

        const curLv = levels[branch.id] ?? 0;
        const nextLv = curLv + 1;
        const req = getMetaUpgradeRequirement(branch.id, curLv);
        const nextCost = req?.cost ?? null;
        const reqTier = req?.minTier ?? 7;
        const tierLocked = nextCost !== null && bestTier > reqTier;
        const canAfford = nextCost !== null && !tierLocked && clubFunds >= nextCost;

        drawChamferPanel(
          ctx,
          bx,
          by,
          cardW,
          cardH,
          12,
          'rgba(14, 22, 40, 0.92)',
          curLv > 0 ? branch.accent : THEME.BORDER,
          curLv > 0 ? 1.5 : 1,
          curLv > 0 ? branch.accent : undefined
        );
        drawIcon(ctx, BRANCH_ICON[branch.id], bx + 22, by + 24, 15, branch.accent);
        drawText(ctx, branch.name, bx + 38, by + 24, { size: 15.5, bold: true, color: branch.accent });
        drawBadge(ctx, bx + cardW - 76, by + 13, 62, 20, `Lv.${curLv}/${branch.maxLevel}`, '#1E293B', THEME.GOLD_LIGHT);

        // 8 级进度条胶囊
        for (let lvDot = 0; lvDot < branch.maxLevel; lvDot++) {
          const dw = Math.floor((cardW - 36 - 7 * 3) / 8);
          const dx = bx + 18 + lvDot * (dw + 3);
          const lit = curLv > lvDot;
          const lockedDot = lvDot >= 5 && bestTier > (INFRA_MIN_TIERS[lvDot] ?? 7);
          drawRoundRect(
            ctx,
            dx,
            by + 44,
            dw,
            5,
            2,
            lit ? branch.accent : lockedDot ? '#334155' : '#1E293B'
          );
        }

        const startLv = Math.max(0, Math.min(branch.maxLevel - 3, curLv > 0 ? curLv - 1 : 0));
        for (let li = startLv; li < Math.min(branch.maxLevel, startLv + 3); li++) {
          const rowIdx = li - startLv;
          const ly = by + 58 + rowIdx * 56;
          const unlocked = curLv >= li + 1;
          const lvReq = INFRA_MIN_TIERS[li] ?? 7;
          const isLvLocked = !unlocked && bestTier > lvReq;
          drawRoundRect(
            ctx,
            bx + 14,
            ly,
            cardW - 28,
            50,
            7,
            unlocked ? 'rgba(34,197,94,0.12)' : THEME.BG_CARD,
            unlocked ? THEME.GREEN : isLvLocked ? '#475569' : THEME.BORDER
          );
          drawBadge(
            ctx,
            bx + 20,
            ly + 15,
            38,
            20,
            `Lv.${li + 1}`,
            unlocked ? THEME.GREEN : isLvLocked ? '#1E293B' : '#334155',
            unlocked ? '#080C14' : isLvLocked ? '#FCA5A5' : THEME.TX2
          );
          drawWrappedText(ctx, branch.levelDescriptions[li], bx + 64, ly + 10, cardW - 126, 14, {
            size: 10.5,
            color: unlocked ? THEME.TX1 : THEME.TX2,
            maxLines: 2,
          });
          drawText(
            ctx,
            unlocked ? '已建' : isLvLocked ? `需T${lvReq}` : `¥${branch.costs[li]}万`,
            bx + cardW - 20,
            ly + 25,
            {
              size: 10,
              bold: true,
              color: unlocked ? THEME.GREEN : isLvLocked ? '#FCA5A5' : THEME.GOLD_LIGHT,
              align: 'right',
              mono: !unlocked,
            }
          );
        }

        if (nextCost === null) {
          drawBadge(ctx, bx + 14, by + cardH - 44, cardW - 28, 32, '满级基建竣工 (Lv.8)', '#14532D', THEME.GREEN);
        } else {
          const btnLabel = tierLocked
            ? `需打入第 ${reqTier} 级解锁`
            : canAfford
            ? `扩建 Lv.${nextLv} (¥${nextCost}万)`
            : `资金不足 (¥${nextCost}万)`;
          drawButton(
            ctx,
            hits,
            bx + 14,
            by + cardH - 44,
            cardW - 28,
            32,
            btnLabel,
            () => {
              const res = league.upgradeMetaBranch(branch.id);
              if (res.ok) {
                SoundEngine.playClick();
                this.notice = `已将【${branch.name}】扩建至 Lv.${nextLv}`;
                actions.onSave();
              } else {
                this.notice = res.reason || '扩建失败';
              }
            },
            { variant: canAfford ? 'gold' : 'ghost', disabled: !canAfford, fontSize: 11.5 }
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

    // 0. 星图星盘底图（呼吸感轻柔叠加，保证星图节点与连线清晰对比度）
    const constImg = AssetLoader.get('bg_skill_constellation');
    if (constImg && typeof ctx.drawImage === 'function') {
      const iw = (constImg.naturalWidth || constImg.width || 1024);
      const ih = (constImg.naturalHeight || constImg.height || 572);
      const breath = 1.02 + 0.012 * Math.sin(this.animTime * 0.35);
      const coverScale = Math.max((mapW - 8) / iw, (mapH - 8) / ih) * breath;
      const dw = iw * coverScale;
      const dh = ih * coverScale;
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.drawImage(constImg, mapX + mapW / 2 - dw / 2, mapY + mapH / 2 - dh / 2, dw, dh);
      ctx.restore();
    }

    // 0b. 星空微粒背景
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
      const glyphKind = getNodeGlyphKind(node);

      ctx.save();
      ctx.globalAlpha = filterMatch ? 1 : 0.16;

      if (isActiveSkill) {
        const dr = r * 1.32;
        const effR = isUnlocked ? league.getSkillProgressInfo(node.id).effectiveRank || 1 : 1;
        if (filterMatch) {
          ctx.strokeStyle = isEquipped ? '#4ADE80' : effR >= 4 ? THEME.GOLD_LIGHT : '#38BDF8';
          ctx.globalAlpha = (isUnlocked ? 0.55 : 0.28) + pulse * 0.28;
          ctx.lineWidth = isEquipped ? 2.2 : 1.4;
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
          ctx.shadowColor = isSelected ? '#FFFFFF' : isEquipped ? '#4ADE80' : effR >= 4 ? THEME.GOLD_LIGHT : '#38BDF8';
          ctx.shadowBlur = isSelected ? 18 : isEquipped ? 14 : 10 + pulse * 4;
        }

        // 双层金属菱形插槽底座
        ctx.fillStyle = isUnlocked ? (isEquipped ? '#053B2F' : effR >= 4 ? '#422006' : '#0B2E4E') : isReachable ? '#142244' : '#0A101E';
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - dr);
        ctx.lineTo(pt.x + dr, pt.y);
        ctx.lineTo(pt.x, pt.y + dr);
        ctx.lineTo(pt.x - dr, pt.y);
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = isSelected ? 2.8 : isEquipped ? 2.4 : isUnlocked ? 2.2 : 1.5;
        ctx.strokeStyle = isSelected ? '#FFFFFF' : isEquipped ? '#4ADE80' : (isResonating || effR >= 4) ? '#FEF08A' : isUnlocked ? '#38BDF8' : isReachable ? '#38BDF8' : 'rgba(100, 116, 139, 0.6)';
        ctx.stroke();

        // 内圈斜切金属线
        if (dr >= 9) {
          const ir = dr * 0.78;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - ir);
          ctx.lineTo(pt.x + ir, pt.y);
          ctx.lineTo(pt.x, pt.y + ir);
          ctx.lineTo(pt.x - ir, pt.y);
          ctx.closePath();
          ctx.stroke();
        }

        ctx.shadowBlur = 0;
        if (dr >= 8) {
          const gFg = isEquipped ? '#86EFAC' : isUnlocked ? '#FEF08A' : isReachable ? '#BAE6FD' : '#94A3B8';
          const gAc = isEquipped ? '#4ADE80' : node.color;
          drawSkillGlyph(ctx, glyphKind, pt.x, pt.y, dr * 1.42, gFg, gAc, { dim: !isUnlocked && !isReachable });
        } else {
          ctx.fillStyle = isEquipped ? '#4ADE80' : '#38BDF8';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (isUnlocked && filterMatch && dr >= 7) {
          const rBg = effR >= 4 ? '#78350F' : effR >= 2 ? '#0C4A6E' : '#1E293B';
          const rFg = effR >= 4 ? THEME.GOLD_LIGHT : effR >= 2 ? '#7DD3FC' : THEME.TX2;
          drawRoundRect(ctx, pt.x + dr * 0.48 - 10, pt.y - dr - 9, 21, 13, 4, rBg, rFg, 1);
          drawText(ctx, `R${effR}`, pt.x + dr * 0.48 + 0.5, pt.y - dr - 2.5, {
            size: 8.5,
            bold: true,
            color: rFg,
            align: 'center',
          });
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
        const darkMetalNodes = node.kind !== 'path';
        ctx.fillStyle = darkMetalNodes
          ? (isUnlocked ? '#17233B' : isReachable ? '#131D31' : '#0B111F')
          : (isUnlocked ? node.color : isReachable ? '#1E293B' : '#0F172A');
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineWidth = isSelected ? 2.6 : isResonating ? 2.2 : isReachable ? 1.8 : 1.1;
        ctx.strokeStyle = isSelected ? '#FFFFFF' : isResonating ? '#FEF08A' : isUnlocked ? '#FDE047' : isReachable ? node.color : '#334155';
        ctx.stroke();

        ctx.shadowBlur = 0;
        if (node.kind === 'fusion' && node.aspect && filterMatch) {
          const hr = r + 5.5 + (isResonating ? pulse * 1.5 : 0);
          ctx.save();
          ctx.strokeStyle = isResonating ? '#FEF08A' : isUnlocked ? '#F59E0B' : 'rgba(245, 158, 11, 0.48)';
          ctx.lineWidth = isResonating ? 2.1 : isUnlocked ? 1.5 : 1.0;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - hr);
          ctx.lineTo(pt.x + hr, pt.y);
          ctx.lineTo(pt.x, pt.y + hr);
          ctx.lineTo(pt.x - hr, pt.y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          if (r >= 6.5) {
            drawSkillGlyph(
              ctx,
              'fusion',
              pt.x,
              pt.y,
              r * 1.62,
              isResonating ? '#FFFBEB' : isUnlocked ? '#FDE047' : '#F59E0B',
              '#FEF08A',
              { dim: !isUnlocked && !isReachable }
            );
          }
        } else if (darkMetalNodes && r >= 7.5) {
          const gColor = isResonating ? '#FEF08A' : isUnlocked ? '#FDE68A' : node.color;
          drawSkillGlyph(ctx, glyphKind, pt.x, pt.y, r * 1.54, gColor, THEME.GOLD_LIGHT, { dim: !isUnlocked && !isReachable });
        } else if (node.kind === 'path' && this.zoom >= 1.5 && r >= 6) {
          drawSkillGlyph(ctx, glyphKind, pt.x, pt.y, r * 1.15, isUnlocked ? '#0B111E' : '#94A3B8', node.color);
        }

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
        drawText(ctx, rawLabel, pt.x, pt.y + (isActiveSkill ? r * 1.32 : r) + 11, {
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

    // 左上角缩放倍率 & 右上角纯矢量图例
    drawBadge(ctx, mapX + 14, mapY + 14, 184, 24, `缩放 ${Math.round(this.zoom * 100)}% · 拖拽平移`, 'rgba(14,22,40,0.88)', '#7DD3FC');
    const legX = mapX + mapW - 294;
    const legY = mapY + 14;
    drawRoundRect(ctx, legX, legY, 280, 24, 6, 'rgba(14,22,40,0.92)', 'rgba(56,189,248,0.45)');
    drawSkillGlyph(ctx, 'tiki', legX + 18, legY + 12, 14, '#7DD3FC', '#38BDF8');
    drawText(ctx, '主动技(34)', legX + 30, legY + 12, { size: 10.5, bold: true, color: '#7DD3FC' });
    drawSkillGlyph(ctx, 'fusion', legX + 111, legY + 12, 14, '#FDE047', '#F59E0B');
    drawText(ctx, '融合威能(18)', legX + 123, legY + 12, { size: 10.5, bold: true, color: THEME.GOLD_LIGHT });
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.arc(legX + 208, legY + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, '被动(72)', legX + 218, legY + 12, { size: 10.5, bold: true, color: '#CBD5E1' });

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
      sel.activeSkill ? '主动触发技 · 暗黑4质变' :
      sel.kind === 'origin' ? '体系/战术原点' :
      sel.kind === 'formation' ? '阵型专精节点' :
      sel.aspect ? '传奇融合威能奇点' :
      sel.kind === 'keystone' ? '跨界终极奇点' : '战术路径节点';

    drawBadge(ctx, dx + 18, dy + 16, sel.activeSkill ? 156 : 136, 22, kindLabel, sel.activeSkill ? '#0C4A6E' : sel.aspect ? '#78350F' : '#1E293B', sel.activeSkill ? '#38BDF8' : sel.aspect ? THEME.GOLD_LIGHT : sel.color);
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

    drawRoundRect(ctx, dx + 18, dy + 42, 28, 28, 6, 'rgba(15, 23, 42, 0.9)', sel.color, 1.2);
    drawSkillGlyph(ctx, getNodeGlyphKind(sel), dx + 32, dy + 56, 20, selUnlocked ? THEME.GOLD_LIGHT : sel.color, THEME.GOLD_LIGHT);
    drawText(ctx, sel.name, dx + 54, dy + 56, { size: 20, bold: true, color: sel.color });
    drawWrappedText(ctx, sel.desc, dx + 18, dy + 78, dw - 36, 17, {
      size: 12,
      color: THEME.TX1,
      maxLines: 2,
    });

    if (sel.activeSkill) {
      const sk = sel.activeSkill;
      const info = league.getSkillProgressInfo(sel.id);
      const rankBadge = selUnlocked
        ? `R${info.effectiveRank}${info.bonusRank > 0 ? ` (Lv.${info.baseRank}+${info.bonusRank})` : ` (Lv.${info.baseRank})`}`
        : '未点亮';
      drawRoundRect(ctx, dx + 18, dy + 114, dw - 36, 66, 8, 'rgba(12, 74, 110, 0.35)', 'rgba(56, 189, 248, 0.45)');
      drawText(ctx, sk.name, dx + 28, dy + 130, { size: 13, bold: true, color: '#38BDF8' });
      drawText(ctx, rankBadge, dx + dw - 28, dy + 130, { size: 12, bold: true, color: info.effectiveRank >= 4 ? THEME.GOLD_LIGHT : '#7DD3FC', align: 'right' });
      drawText(ctx, `瞬发：${sk.instantLabel ?? '场上即时干预'}`, dx + 28, dy + 149, { size: 11.5, bold: true, color: THEME.GOLD_LIGHT });
      drawText(ctx, `触发:${sk.situationLabel} · 熟≥${sk.minFamiliarity}/默≥${sk.minChemistry}`, dx + 28, dy + 167, { size: 10.5, color: THEME.TX2 });

      if (selUnlocked) {
        const loadoutIds = league.getSkillLoadoutIds();
        const isEquipped = loadoutIds.includes(sel.id);
        const canUp = info.nextUpgradeCost !== null && st.metaPointsTotal >= info.nextUpgradeCost;
        const upLabel = info.nextUpgradeCost !== null
          ? `升级 Lv.${info.baseRank + 1} (${info.nextUpgradeCost}pt)`
          : '基础 Lv.3 已满';
        drawButton(ctx, hits, dx + 18, dy + 186, 172, 32, upLabel, () => {
          const res = league.upgradeSkillRank(sel.id);
          if (res.ok) {
            SoundEngine.playGoalCheer();
            this.notice = `已将【${sk.name}】提升至基础 Lv.${res.newRank}！`;
            actions.onSave();
          } else {
            this.notice = res.reason || '升级失败';
          }
        }, { variant: canUp ? 'gold' : 'ghost', disabled: info.nextUpgradeCost === null || !canUp, fontSize: 11 });

        drawButton(
          ctx,
          hits,
          dx + 198,
          dy + 186,
          176,
          32,
          isEquipped ? `已装配(${loadoutIds.length}/4) · 卸下` : `装配技能(${loadoutIds.length}/4)`,
          () => {
            const res = league.toggleSkillLoadout(sel.id);
            if (res.ok) {
              SoundEngine.playClick();
              this.notice = res.equipped
                ? `已装备主动技【${sk.name}】`
                : `已卸下主动技【${sk.name}】`;
              actions.onSave();
            } else {
              this.notice = res.reason || '操作失败';
            }
          },
          { variant: isEquipped ? 'green' : 'primary', fontSize: 11 }
        );

        drawText(
          ctx,
          `A/B 质变分支 (${info.mutationUnlocked ? '已解锁 · 点击自由切换' : '有效 Lv.2 解锁'})`,
          dx + 18,
          dy + 234,
          { size: 11, bold: true, color: info.mutationUnlocked ? THEME.GOLD_LIGHT : THEME.TX3 }
        );
        (sk.mutations ?? []).forEach((mut, mi) => {
          const my = dy + 246 + mi * 58;
          const isChosen = info.mutationUnlocked && info.mutationChoice === mut.choice;
          const mBg = isChosen ? 'rgba(6, 78, 59, 0.55)' : 'rgba(15, 23, 42, 0.72)';
          const mBorder = isChosen ? THEME.GREEN : info.mutationUnlocked ? 'rgba(148, 163, 184, 0.38)' : 'rgba(51, 65, 85, 0.45)';
          drawRoundRect(ctx, dx + 18, my, dw - 36, 52, 7, mBg, mBorder, isChosen ? 1.5 : 1);
          drawText(ctx, `${mut.choice} · ${mut.name}`, dx + 28, my + 16, {
            size: 12,
            bold: true,
            color: isChosen ? THEME.GREEN : info.mutationUnlocked ? THEME.TX1 : THEME.TX3,
          });
          drawText(ctx, isChosen ? '生效中 ✓' : info.mutationUnlocked ? '点击选用' : 'Lv.2解锁', dx + dw - 28, my + 16, {
            size: 10.5,
            bold: isChosen,
            color: isChosen ? THEME.GREEN : THEME.TX3,
            align: 'right',
          });
          drawWrappedText(ctx, mut.shortDesc, dx + 28, my + 32, dw - 56, 14, {
            size: 10.5,
            color: info.mutationUnlocked ? THEME.TX2 : THEME.TX3,
            maxLines: 1,
          });
          if (info.mutationUnlocked && !isChosen) {
            hits.add(dx + 18, my, dw - 36, 52, () => {
              const r = league.setSkillMutation(sel.id, mut.choice);
              if (r.ok) {
                SoundEngine.playClick();
                this.notice = `【${sk.name}】切换质变：${mut.choice}·${mut.name}`;
                actions.onSave();
              }
            });
          }
        });
      } else {
        drawText(ctx, 'A/B 质变预览（点亮并达 Lv.2 后自由切换）：', dx + 18, dy + 190, { size: 11, color: THEME.TX2 });
        (sk.mutations ?? []).forEach((mut, mi) => {
          const my = dy + 202 + mi * 46;
          drawRoundRect(ctx, dx + 18, my, dw - 36, 40, 6, 'rgba(15, 23, 42, 0.65)', 'rgba(51, 65, 85, 0.45)');
          drawText(ctx, `${mut.choice} · ${mut.name}：${mut.shortDesc.slice(0, 20)}`, dx + 26, my + 20, { size: 10.5, color: THEME.TX2 });
        });
        drawButton(
          ctx,
          hits,
          dx + 18,
          dy + 300,
          dw - 36,
          42,
          !selReachable ? '需先点亮相邻节点' : canBuy ? `点亮此技能 (消耗 ${sel.cost}pt)` : `Meta 点数不足 (需要 ${sel.cost}pt)`,
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
    } else if (sel.aspect) {
      const asp = sel.aspect;
      const aspActive = selUnlocked && selResonating;
      drawRoundRect(ctx, dx + 18, dy + 116, dw - 36, 114, 8, aspActive ? 'rgba(120, 53, 15, 0.34)' : 'rgba(15, 23, 42, 0.72)', aspActive ? THEME.GOLD_LIGHT : 'rgba(245, 158, 11, 0.45)', aspActive ? 1.6 : 1);
      drawText(ctx, `传奇威能 · ${asp.name}`, dx + 28, dy + 134, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
      drawText(ctx, aspActive ? '激活中 ✓' : selUnlocked ? '待匹配战术' : '未点亮', dx + dw - 28, dy + 134, {
        size: 11,
        bold: aspActive,
        color: aspActive ? THEME.GREEN : THEME.TX3,
        align: 'right',
      });
      drawWrappedText(ctx, asp.shortDesc, dx + 28, dy + 156, dw - 56, 17, {
        size: 11.5,
        color: THEME.TX1,
        maxLines: 3,
      });
      drawText(ctx, `激活条件：防线=${asp.system} 且 战术=${TACTICAL_PRESETS[asp.style].name}`, dx + 28, dy + 214, {
        size: 10.5,
        color: THEME.TX2,
      });

      if (selUnlocked) {
        drawBadge(
          ctx,
          dx + 18,
          dy + 244,
          dw - 36,
          38,
          aspActive ? '传奇威能已在比赛中自动生效 ✓' : '已点亮；切换对应防线与战术即可自动激活',
          aspActive ? '#78350F' : '#1E293B',
          aspActive ? THEME.GOLD_LIGHT : THEME.TX2
        );
      } else {
        drawButton(
          ctx,
          hits,
          dx + 18,
          dy + 244,
          dw - 36,
          42,
          !selReachable ? '需先点亮相邻节点' : canBuy ? `点亮融合威能 (消耗 ${sel.cost}pt)` : `Meta 点数不足 (需要 ${sel.cost}pt)`,
          () => {
            const res = league.unlockSkillWebNode(sel.id);
            if (res.ok) {
              SoundEngine.playGoalCheer();
              this.notice = `已点亮传奇融合威能【${asp.name}】！`;
              actions.onSave();
            } else {
              this.notice = res.reason || '无法点亮';
            }
          },
          { variant: canBuy ? 'gold' : 'ghost', disabled: !canBuy, fontSize: 13 }
        );
      }
    } else {
      const actionY = dy + 154;
      if (selUnlocked) {
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
    }

    // 底部精简信息：当前点亮进度 + 威能状态 + 引擎修正入口
    const activeAspectsCnt = league.getActiveLegendaryAspects().length;
    drawChamferPanel(ctx, dx + 18, dy + dh - 146, dw - 36, 76, 8, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `星图：${unlocked.length}/${SKILL_WEB_NODES.length} 节点 · 传奇威能 ${activeAspectsCnt} 个激活`, dx + 30, dy + dh - 124, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `当前激活：${club.formation} · ${TACTICAL_PRESETS[club.style].name}`, dx + 30, dy + dh - 96, { size: 11.5, color: THEME.TX2 });

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

    drawChamferPanel(ctx, mx + 28, my + 70, mw - 56, 132, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, '当前 2D 比赛引擎实时行为修正', mx + 46, my + 94, { size: 13.5, bold: true, color: '#38BDF8' });
    drawWrappedText(
      ctx,
      modTags.length > 0 ? modTags.join('  ·  ') : '尚未激活引擎行为修正，点亮路径或融合奇点后在 2D 比赛中实时生效',
      mx + 46,
      my + 118,
      mw - 92,
      21,
      { size: 12.5, color: THEME.TX1, maxLines: 3 }
    );

    const activeAspects = league.getActiveLegendaryAspects();
    drawChamferPanel(ctx, mx + 28, my + 212, mw - 56, 106, 10, activeAspects.length > 0 ? 'rgba(120, 53, 15, 0.25)' : THEME.BG_CARD, activeAspects.length > 0 ? THEME.GOLD : THEME.BORDER);
    drawText(ctx, `传奇融合威能 (${activeAspects.length} 个当前生效)`, mx + 46, my + 234, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    const aspText = activeAspects.length > 0
      ? activeAspects.map(a => `[${a.name}]：${a.shortDesc}`).join('  |  ')
      : '尚未激活传奇融合威能。点亮星图外环「防线×战术」融合奇点并匹配当前阵型战术即可自动觉醒';
    drawWrappedText(ctx, aspText, mx + 46, my + 258, mw - 92, 19, { size: 12, color: activeAspects.length > 0 ? THEME.TX1 : THEME.TX2, maxLines: 2 });

    const mastery = league.getTacticalMastery();
    const formInfo = getFormationMasteryInfo(club.formation, mastery.formations[club.formation] ?? 0);
    const styleInfo = getStyleMasteryInfo(club.style, mastery.styles[club.style] ?? 0);
    drawChamferPanel(ctx, mx + 28, my + 328, mw - 56, 122, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `实战熟练度与技能等级加成 (${unlocked.length}/${SKILL_WEB_NODES.length} 节点已点亮)`, mx + 46, my + 350, {
      size: 13.5,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(ctx, `${club.formation}：Lv.${formInfo.level} ${formInfo.title} (${formInfo.xp}/15) · ${formInfo.bonusDesc}`, mx + 46, my + 378, {
      size: 12,
      color: THEME.GREEN,
    });
    drawText(ctx, `${TACTICAL_PRESETS[club.style].name}：Lv.${styleInfo.level} ${styleInfo.title} (${styleInfo.xp}/15) · ${styleInfo.bonusDesc}`, mx + 46, my + 404, {
      size: 12,
      color: '#38BDF8',
    });

    drawButton(ctx, hits, mx + 28, my + mh - 64, mw - 56, 44, '重置星图与技能等级（全额退还 Meta 点数）', () => {
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
