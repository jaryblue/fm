/**
 * 卡牌背包与战术合成器（双栏宽屏结构 + 点击浮层详情/配方）
 * - 取消 270px 常驻中栏，将宽度释放给左栏背包 (660px) 与右栏合成器 (492px)
 * - 保留「选卡入炉 → 实时预览 → 合成 → 装配手牌」同屏连续操作流
 * - 卡牌详情（升阶/拆解）与配方图鉴改为点击弹出浮层
 */

import {
  CommandCard,
  CraftFocus,
  ElementId,
  LINE_LABELS,
  MECHANIC_LABELS,
  synthesizeChemistry,
  TACTICAL_ELEMENTS,
} from '../../../core/src/CommandCards';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { ArtAssetId, AssetLoader } from '../AssetLoader';
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

const ELEM_ICON: Record<ElementId, IconName> = {
  press: 'bolt',
  pass: 'ball',
  wing: 'sword',
  iron: 'shield',
  blitz: 'sparkle',
};

const FOCUS_OPTIONS: Array<{ id: CraftFocus; label: string }> = [
  { id: 'balanced', label: '标准' },
  { id: 'endure', label: '持久+5分' },
  { id: 'surge', label: '低费/回气' },
];

type BagFilter = 'all' | 'base' | 'crafted' | 'equipped';
type SelectedItem = { kind: 'base'; elemId: ElementId } | { kind: 'card'; cardId: string };

export class CardCraftScreen {
  private flask: ElementId[] = ['press', 'wing'];
  private fuseSlots: [string | null, string | null] = [null, null];
  private focus: CraftFocus = 'balanced';
  private bagFilter: BagFilter = 'all';
  private bagPage = 0;
  private selected: SelectedItem | null = null;
  private detailModalOpen = false;
  private recipesModalOpen = false;
  private notice = '点击卡面查看详情，或直接点「放入手牌 / + 入炉」快速构筑';
  private fusionFlash = 0;
  private animTime = 0;
  private slotPopTimers = [0, 0, 0, 0];

  public handleEscape(): boolean {
    if (this.detailModalOpen) {
      this.detailModalOpen = false;
      return true;
    }
    if (this.recipesModalOpen) {
      this.recipesModalOpen = false;
      return true;
    }
    return false;
  }

  public update(dtSec: number): void {
    this.animTime += dtSec;
    if (this.fusionFlash > 0) {
      this.fusionFlash = Math.max(0, this.fusionFlash - dtSec);
    }
    for (let i = 0; i < 4; i++) {
      if (this.slotPopTimers[i] > 0) {
        this.slotPopTimers[i] = Math.max(0, this.slotPopTimers[i] - dtSec);
      }
    }
  }

  private drawCardAuraParticles(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    lv: number,
    isCorrupted: boolean,
    seed: number,
    compact = false
  ): void {
    const t = this.animTime;
    const count = lv >= 4 ? (compact ? 7 : 14) : lv === 3 ? (compact ? 5 : 10) : lv === 2 ? (compact ? 3 : 6) : (compact ? 2 : 3);
    const col = lv >= 4 ? '#FACC15' : lv === 3 ? '#C084FC' : lv === 2 ? '#38BDF8' : '#94A3B8';
    const spd = lv >= 4 ? 0.55 : lv === 3 ? 0.42 : lv === 2 ? 0.30 : 0.18;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    for (let i = 0; i < count; i++) {
      const hash = ((seed * 31 + i * 17) % 97) / 97;
      const phase = (t * spd + hash) % 1;
      const px = x + 6 + (((hash * 1.7 + i * 0.29 + Math.sin(t * 1.6 + i) * 0.04) % 1) * (w - 12));
      const py = y + h - phase * (h - 6);
      const alpha = Math.sin(phase * Math.PI) * (lv >= 3 ? 0.85 : 0.58);
      const r = (compact ? 1.3 : 1.8) + (lv >= 4 ? 1.2 : lv === 3 ? 0.8 : 0.3) * Math.sin(t * 3 + i);

      ctx.globalAlpha = Math.max(0.08, alpha);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.9, r), 0, Math.PI * 2);
      ctx.fill();

      if (lv >= 4 && !compact && i % 3 === 0) {
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - 4, py);
        ctx.lineTo(px + 4, py);
        ctx.moveTo(px, py - 4);
        ctx.lineTo(px, py + 4);
        ctx.stroke();
      }
    }

    if (isCorrupted) {
      const darkCount = compact ? 4 : 9;
      for (let i = 0; i < darkCount; i++) {
        const hash = ((seed * 19 + i * 23) % 89) / 89;
        const phase = (t * 0.48 + hash) % 1;
        const px = x + 8 + (((hash * 2.1 + Math.cos(t * 2.2 + i) * 0.05) % 1) * (w - 16));
        const py = y + h - phase * (h - 4);
        const alpha = Math.sin(phase * Math.PI) * 0.90;
        const r = (compact ? 2.0 : 3.2) + Math.sin(t * 4 + i) * 0.7;
        ctx.globalAlpha = Math.max(0.15, alpha);
        ctx.fillStyle = '#05070C';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, r), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private lvColor(lv: number): string {
    if (lv >= 4) return THEME.GOLD_LIGHT;
    if (lv === 3) return '#C084FC';
    if (lv === 2) return '#38BDF8';
    return '#94A3B8';
  }

  private cardArtId(card: CommandCard): ArtAssetId {
    if (card.mechanic === 'iron_wall_block') return 'cmd_iron_wall';
    if (card.mechanic === 'gk_counter_launch') return 'cmd_blitz';
    if (card.mechanic === 'set_piece_nuke') return 'cmd_set_piece';
    if (card.mechanic === 'super_sub') return 'cmd_super_sub';
    if (card.mechanic === 'offside_trap') return 'cmd_offside_trap';
    if (card.mechanic === 'tiki_taka_flow') return 'cmd_tiki_taka';
    if (card.mechanic === 'high_press_blitz') return 'cmd_gegenpress';
    if (card.mechanic === 'long_shot_cannon') return 'cmd_blitz';
    if (card.mechanic === 'blood_frenzy') return 'cmd_gegenpress';
    if (card.mechanic === 'wing_overload') return 'cmd_wing_play';
    const first = card.recipeKey?.split('+')[0];
    if (first === 'press') return 'cmd_gegenpress';
    if (first === 'pass') return 'cmd_tiki_taka';
    if (first === 'wing') return 'cmd_wing_play';
    if (first === 'iron') return 'cmd_iron_wall';
    if (first === 'blitz') return 'cmd_blitz';
    return card.isCorrupted ? 'cmd_gegenpress' : 'cmd_tiki_taka';
  }

  private cardElemId(card: CommandCard): ElementId {
    const first = card.recipeKey?.split('+')[0] as ElementId | undefined;
    if (first && TACTICAL_ELEMENTS.some(e => e.id === first)) return first;
    if (card.targetLine === 'GK' || card.targetLine === 'DEF') return 'iron';
    if (card.targetLine === 'ATT') return 'blitz';
    return 'pass';
  }

  private statSnippet(card: CommandCard): string {
    const parts: string[] = [];
    if (card.shootingDelta) parts.push(`射+${card.shootingDelta}`);
    if (card.passingDelta) parts.push(`传+${card.passingDelta}`);
    if (card.paceDelta) parts.push(`速+${card.paceDelta}`);
    if (card.defendingDelta) parts.push(`防+${card.defendingDelta}`);
    if (card.goalkeepingDelta) parts.push(`扑+${card.goalkeepingDelta}`);
    if (card.composureDelta) parts.push(`冷+${card.composureDelta}`);
    if (card.fitnessInstantDelta) parts.push(`体+${card.fitnessInstantDelta}%`);
    return parts.slice(0, 3).join(' ') || `${card.durationMinutes}分钟强化`;
  }

  private addBaseToForge(id: ElementId): void {
    SoundEngine.playClick();
    this.fuseSlots = [null, null];
    if (this.flask.length >= 4) {
      this.flask.shift();
    }
    this.flask.push(id);
    const slotIdx = Math.max(0, Math.min(3, this.flask.length - 1));
    this.slotPopTimers[slotIdx] = 0.26;
  }

  private addCardToForge(cardId: string): void {
    SoundEngine.playClick();
    if (this.fuseSlots[0] === cardId) {
      this.fuseSlots[0] = null;
      return;
    }
    if (this.fuseSlots[1] === cardId) {
      this.fuseSlots[1] = null;
      return;
    }
    if (!this.fuseSlots[0]) this.fuseSlots[0] = cardId;
    else this.fuseSlots[1] = cardId;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onNavigate: (tab: NavRailTab) => void;
      onSave: () => void;
      onBurst?: (x: number, y: number, color?: string) => void;
    }
  ): void {
    const inv = league.getElementInventory();
    const deck = league.getCoachDeck();
    const loadoutIds = league.getLoadoutIds();
    const loadoutSet = new Set(loadoutIds);
    const club = league.getUserClub();
    const totalElements = TACTICAL_ELEMENTS.reduce((s, e) => s + (inv[e.id] ?? 0), 0);
    const cardBackImg = AssetLoader.get('command_card_back');

    if (this.selected && this.selected.kind === 'card') {
      const selCardId = this.selected.cardId;
      if (!deck.some(c => c.id === selCardId)) {
        this.selected = deck[0] ? { kind: 'card', cardId: deck[0].id } : { kind: 'base', elemId: 'press' };
        this.detailModalOpen = false;
      }
    }
    if (!this.selected) {
      this.selected = deck[0] ? { kind: 'card', cardId: deck[0].id } : { kind: 'base', elemId: 'press' };
    }

    const isFuseMode = !!(this.fuseSlots[0] || this.fuseSlots[1]);

    drawBroadcastHeader(ctx, hits, {
      kicker: 'CARD BACKPACK & SYNTHESIZER',
      title: '卡牌背包与战术合成器',
      club,
      badge: `出战手牌 ${loadoutIds.length}/4 · 背包卡库 ${deck.length}/12`,
      showSoundToggle: true,
      rightAction: { label: '返回门户', variant: 'ghost', onClick: () => actions.onNavigate('portal') },
    });

    drawNavRail(ctx, hits, 'cards', actions.onNavigate);

    // ==================== 左栏 (x: 96..756, w: 660)：出战手牌 + 宽屏卡牌背包 ====================
    drawChamferPanel(ctx, 96, 80, 660, 624, 10, 'rgba(14, 22, 40, 0.94)', THEME.BORDER);

    // 1) 上部：出战手牌 (4 宽屏槽位，每张 152×82)
    drawText(ctx, `出战手牌 (${loadoutIds.length}/4 · 比赛日携带)`, 114, 100, {
      size: 14,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawButton(ctx, hits, 640, 88, 100, 26, '配方图鉴 📖', () => {
      this.recipesModalOpen = true;
    }, { variant: 'primary', fontSize: 11 });

    const selCardForQuickEquip =
      this.selected && this.selected.kind === 'card'
        ? deck.find(c => c.id === (this.selected as { kind: 'card'; cardId: string }).cardId)
        : null;

    for (let i = 0; i < 4; i++) {
      const sx = 114 + i * 158;
      const sy = 118;
      const sw = 150;
      const sh = 82;
      const cid = loadoutIds[i];
      const card = cid ? deck.find(c => c.id === cid) : undefined;
      if (card) {
        const lv = card.level ?? 1;
        const lvCol = this.lvColor(lv);
        const isSel = this.selected?.kind === 'card' && this.selected.cardId === card.id;
        const artImg = AssetLoader.get(this.cardArtId(card));
        drawChamferPanel(ctx, sx, sy, sw, sh, 8, 'rgba(20, 34, 58, 0.96)', isSel ? THEME.GOLD_LIGHT : lvCol, isSel ? 1.8 : 1.2);
        if (artImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(sx + 2, sy + 2, sw - 4, sh - 4);
          ctx.clip();
          ctx.globalAlpha = 0.22;
          ctx.drawImage(artImg, sx + 48, sy, sw - 48, sh);
          ctx.restore();
        }
        this.drawCardAuraParticles(ctx, sx + 2, sy + 2, sw - 4, sh - 4, lv, !!card.isCorrupted, i + card.name.length, true);
        drawBadge(ctx, sx + 8, sy + 7, 26, 16, `E${card.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
        drawBadge(ctx, sx + 38, sy + 7, 32, 16, `Lv.${lv}`, '#0F172A', lvCol);
        drawText(ctx, card.name.slice(0, 8), sx + 8, sy + 39, { size: 12.5, bold: true, color: THEME.TX1 });
        const mech = card.mechanic ? MECHANIC_LABELS[card.mechanic] : this.statSnippet(card);
        drawText(ctx, mech.slice(0, 11), sx + 8, sy + 61, { size: 10.5, color: '#7DD3FC' });

        hits.add(sx, sy, sw, sh, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'card', cardId: card.id };
          this.detailModalOpen = true;
        });
        const xHover = hits.isHovered(sx + sw - 24, sy + 4, 20, 20);
        drawRoundRect(ctx, sx + sw - 24, sy + 5, 19, 19, 4, xHover ? '#991B1B' : 'rgba(15, 23, 42, 0.85)', xHover ? THEME.RED_LIGHT : THEME.BORDER);
        drawText(ctx, '×', sx + sw - 14.5, sy + 14.5, { size: 13, bold: true, color: xHover ? '#FFFFFF' : '#FCA5A5', align: 'center' });
        hits.add(sx + sw - 26, sy + 2, 24, 24, () => {
          const res = league.toggleLoadoutCard(card.id);
          if (!res.ok) this.notice = res.reason || '卸下失败';
          else {
            SoundEngine.playClick();
            this.notice = `已将【${card.name}】移出手牌`;
            actions.onSave();
          }
        });
      } else {
        const canQuickEquip = !!(selCardForQuickEquip && !loadoutSet.has(selCardForQuickEquip.id));
        drawRoundRect(
          ctx,
          sx,
          sy,
          sw,
          sh,
          8,
          'rgba(11, 17, 30, 0.6)',
          canQuickEquip ? 'rgba(34, 197, 94, 0.45)' : 'rgba(148, 163, 184, 0.22)'
        );
        drawText(ctx, `手牌槽 ${i + 1}`, sx + sw / 2, sy + 30, { size: 11.5, color: THEME.TX3, align: 'center' });
        drawText(ctx, canQuickEquip ? '点此放入' : '空置', sx + sw / 2, sy + 54, {
          size: 11,
          color: canQuickEquip ? THEME.GREEN : THEME.TX3,
          align: 'center',
        });
        if (canQuickEquip && selCardForQuickEquip) {
          hits.add(sx, sy, sw, sh, () => {
            const res = league.toggleLoadoutCard(selCardForQuickEquip.id);
            if (res.ok) {
              SoundEngine.playClick();
              actions.onSave();
            }
          });
        }
      }
    }

    // 2) 下部：统一卡牌背包（双列宽屏卡片，每张 308×142）
    drawText(ctx, '卡牌背包（点卡面看详情与升阶）', 114, 222, { size: 13.5, bold: true, color: THEME.TX1 });
    const filters: Array<[BagFilter, string]> = [
      ['all', '全部'],
      ['base', '基础卡'],
      ['crafted', '合成卡'],
      ['equipped', '出战中'],
    ];
    filters.forEach(([fk, fl], fi) => {
      drawButton(ctx, hits, 456 + fi * 72, 209, 66, 26, fl, () => {
        this.bagFilter = fk;
        this.bagPage = 0;
      }, { active: this.bagFilter === fk, fontSize: 11 });
    });

    type BagItem =
      | { kind: 'base'; elem: typeof TACTICAL_ELEMENTS[number]; count: number }
      | { kind: 'card'; card: CommandCard };

    const bagItems: BagItem[] = [];
    if (this.bagFilter === 'all' || this.bagFilter === 'base') {
      for (const el of TACTICAL_ELEMENTS) {
        bagItems.push({ kind: 'base', elem: el, count: inv[el.id] ?? 0 });
      }
    }
    if (this.bagFilter === 'all' || this.bagFilter === 'crafted' || this.bagFilter === 'equipped') {
      for (const c of deck) {
        if (this.bagFilter === 'equipped' && !loadoutSet.has(c.id)) continue;
        bagItems.push({ kind: 'card', card: c });
      }
    }

    const pageSize = 8; // 4列 × 2行 = 8张标准竖版卡牌
    const totalPages = Math.max(1, Math.ceil(bagItems.length / pageSize));
    if (this.bagPage >= totalPages) this.bagPage = totalPages - 1;
    const visibleBag = bagItems.slice(this.bagPage * pageSize, (this.bagPage + 1) * pageSize);

    visibleBag.forEach((item, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const bx = 114 + col * 158;
      const by = 242 + row * 204;
      const bw = 150;
      const bh = 194;

      if (item.kind === 'base') {
        const el = item.elem;
        const count = item.count;
        const usedInFlask = !isFuseMode ? this.flask.filter(f => f === el.id).length : 0;
        const isSel = this.selected?.kind === 'base' && this.selected.elemId === el.id;

        drawChamferPanel(
          ctx,
          bx,
          by,
          bw,
          bh,
          8,
          isSel ? 'rgba(30, 48, 82, 0.95)' : THEME.BG_CARD,
          isSel ? THEME.GOLD_LIGHT : usedInFlask > 0 ? el.color : THEME.BORDER,
          isSel || usedInFlask > 0 ? 1.6 : 1
        );
        drawBadge(ctx, bx + 8, by + 8, 44, 16, '基础卡', '#1E293B', el.color);
        drawText(ctx, `×${count}`, bx + bw - 10, by + 16, {
          size: 13,
          bold: true,
          color: count > 0 ? THEME.GOLD_LIGHT : THEME.TX3,
          align: 'right',
          mono: true,
        });
        drawRoundRect(ctx, bx + 10, by + 30, bw - 20, 62, 6, 'rgba(8, 12, 20, 0.72)', el.color, 0.9);
        const elemImg = AssetLoader.get(`elem_${el.id}`);
        if (elemImg && typeof ctx.drawImage === 'function') {
          ctx.drawImage(elemImg, bx + bw / 2 - 22, by + 39, 44, 44);
        } else {
          drawIcon(ctx, ELEM_ICON[el.id], bx + bw / 2, by + 61, 26, el.color);
        }
        drawText(ctx, `${el.name} [${el.symbol}]`, bx + bw / 2, by + 108, {
          size: 13,
          bold: true,
          color: el.color,
          align: 'center',
        });
        drawWrappedText(ctx, el.desc, bx + 10, by + 122, bw - 20, 14, { size: 9.5, color: THEME.TX2, maxLines: 2 });

        hits.add(bx, by, bw, 152, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'base', elemId: el.id };
          this.detailModalOpen = true;
        });

        const canDirectHand = count > 0 && deck.length < 12 && loadoutIds.length < 4;
        drawButton(ctx, hits, bx + 8, by + 158, 64, 26, '手牌 ▶', () => {
          const res = league.craftChemistryCard([el.id], 'balanced', true);
          if (res.ok && res.card) {
            this.selected = { kind: 'card', cardId: res.card.id };
            this.notice = `已提炼 Lv.1【${res.card.name}】并放入手牌！`;
            SoundEngine.playRewardChime();
            actions.onSave();
          } else {
            this.notice = res.reason || '手牌或卡库已满';
          }
        }, { variant: canDirectHand ? 'green' : 'ghost', disabled: !canDirectHand, fontSize: 10 });

        drawButton(ctx, hits, bx + 76, by + 158, 66, 26, usedInFlask > 0 ? `炉×${usedInFlask}` : '+ 入炉', () => {
          this.addBaseToForge(el.id);
        }, { variant: usedInFlask > 0 ? 'gold' : 'primary', disabled: count <= 0, fontSize: 10 });
      } else {
        const card = item.card;
        const lv = card.level ?? 1;
        const lvCol = this.lvColor(lv);
        const equipped = loadoutSet.has(card.id);
        const inFuse = this.fuseSlots[0] === card.id || this.fuseSlots[1] === card.id;
        const isSel = this.selected?.kind === 'card' && this.selected.cardId === card.id;
        const artImg = AssetLoader.get(this.cardArtId(card));
        const elemImg = AssetLoader.get(`elem_${this.cardElemId(card)}`);

        drawChamferPanel(
          ctx,
          bx,
          by,
          bw,
          bh,
          8,
          isSel ? 'rgba(30, 48, 82, 0.95)' : equipped ? 'rgba(20, 42, 32, 0.9)' : THEME.BG_CARD,
          isSel ? THEME.GOLD_LIGHT : inFuse ? '#C084FC' : equipped ? THEME.GREEN : lv >= 3 ? lvCol : THEME.BORDER,
          isSel || equipped || inFuse ? 1.6 : 1
        );
        drawBadge(ctx, bx + 8, by + 8, 24, 16, `E${card.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
        drawBadge(ctx, bx + 35, by + 8, 30, 16, `Lv.${lv}`, '#0F172A', lvCol);
        if (equipped) {
          drawBadge(ctx, bx + bw - 48, by + 8, 40, 16, '出战', '#14532D', THEME.GREEN);
        } else if (elemImg && typeof ctx.drawImage === 'function') {
          ctx.drawImage(elemImg, bx + bw - 26, by + 6, 18, 18);
        }

        drawRoundRect(ctx, bx + 8, by + 29, bw - 16, 66, 6, '#0B1220', lvCol, 0.9);
        if (artImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx + 9, by + 30, bw - 18, 64);
          ctx.clip();
          ctx.drawImage(artImg, bx + 9, by + 26, bw - 18, 72);
          ctx.restore();
        } else if (cardBackImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx + 9, by + 30, bw - 18, 64);
          ctx.clip();
          ctx.globalAlpha = 0.25;
          ctx.drawImage(cardBackImg, bx + 9, by + 30, bw - 18, 64);
          ctx.restore();
        }
        this.drawCardAuraParticles(ctx, bx + 9, by + 30, bw - 18, 64, lv, !!card.isCorrupted, idx + card.name.length, true);

        drawText(ctx, card.name.slice(0, 8), bx + bw / 2, by + 110, {
          size: 13,
          bold: true,
          color: card.isCorrupted ? '#FCA5A5' : THEME.TX1,
          align: 'center',
        });
        const mechTxt = card.mechanic ? `⚡${MECHANIC_LABELS[card.mechanic]}` : this.statSnippet(card);
        drawText(ctx, mechTxt.slice(0, 12), bx + bw / 2, by + 128, { size: 10, bold: true, color: '#7DD3FC', align: 'center' });
        drawText(ctx, `${LINE_LABELS[card.targetLine ?? 'ALL']} · ${card.durationMinutes}分`, bx + bw / 2, by + 144, {
          size: 9.5,
          color: THEME.TX2,
          align: 'center',
        });

        hits.add(bx, by, bw, 152, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'card', cardId: card.id };
          this.detailModalOpen = true;
        });

        drawButton(ctx, hits, bx + 8, by + 158, 64, 26, equipped ? '移出' : '出战', () => {
          const res = league.toggleLoadoutCard(card.id);
          if (!res.ok) this.notice = res.reason || '操作失败';
          else {
            SoundEngine.playClick();
            actions.onSave();
          }
        }, { variant: equipped ? 'green' : 'primary', fontSize: 10 });

        drawButton(ctx, hits, bx + 76, by + 158, 66, 26, inFuse ? '已入炉' : '+ 融合', () => {
          this.addCardToForge(card.id);
        }, { variant: inFuse ? 'gold' : 'ghost', fontSize: 10 });
      }
    });

    if (totalPages > 1) {
      drawButton(ctx, hits, 114, 666, 108, 28, '上一页', () => {
        this.bagPage = Math.max(0, this.bagPage - 1);
      }, { disabled: this.bagPage === 0, fontSize: 11 });
      drawText(ctx, `第 ${this.bagPage + 1} / ${totalPages} 页`, 426, 680, {
        size: 12,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, 632, 666, 108, 28, '下一页', () => {
        this.bagPage = Math.min(totalPages - 1, this.bagPage + 1);
      }, { disabled: this.bagPage >= totalPages - 1, fontSize: 11 });
    }

    // ==================== 右栏 (x: 772..1264, w: 492)：独立宽屏合成器 ====================
    drawChamferPanel(ctx, 772, 80, 492, 624, 10, 'rgba(14, 22, 40, 0.96)', THEME.BORDER_GOLD, 1.5, THEME.GOLD_LIGHT);
    drawIcon(ctx, 'craft', 794, 104, 18, THEME.GOLD_LIGHT);
    drawText(ctx, isFuseMode ? '合成器 · 双卡融合升阶' : '合成器 · 反应釜', 816, 104, {
      size: 16.5,
      bold: true,
      color: isFuseMode ? '#E9D5FF' : THEME.GOLD_LIGHT,
    });
    drawButton(ctx, hits, 1170, 90, 76, 26, '清空炉', () => {
      this.flask = [];
      this.fuseSlots = [null, null];
    }, { variant: 'ghost', fontSize: 11, disabled: !isFuseMode && this.flask.length === 0 });
    drawWrappedText(ctx, this.notice, 790, 124, 456, 16, { size: 11.5, color: '#7DD3FC', maxLines: 2 });

    if (!isFuseMode) {
      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx = 790 + col * 232;
        const sy = 160 + row * 74;
        const eid = this.flask[i];
        const edef = eid ? TACTICAL_ELEMENTS.find(e => e.id === eid) : null;
        const popT = this.slotPopTimers[i] ?? 0;
        const popScale = popT > 0 ? 1 + 0.12 * Math.sin((popT / 0.26) * Math.PI) : 1;
        ctx.save();
        if (popScale !== 1) {
          ctx.translate(sx + 112, sy + 33);
          ctx.scale(popScale, popScale);
          ctx.translate(-(sx + 112), -(sy + 33));
        }
        drawChamferPanel(ctx, sx, sy, 224, 66, 8, 'rgba(19, 30, 54, 0.9)', edef ? edef.color : THEME.BORDER, edef ? 1.5 : 1);
        if (edef) {
          const img = AssetLoader.get(`elem_${edef.id}`);
          if (img && typeof ctx.drawImage === 'function') ctx.drawImage(img, sx + 14, sy + 15, 36, 36);
          drawText(ctx, edef.name, sx + 60, sy + 24, { size: 14, bold: true, color: edef.color });
          drawText(ctx, `槽${i + 1} · 点击移除`, sx + 60, sy + 46, { size: 10.5, color: THEME.TX3 });
          hits.add(sx, sy, 224, 66, () => {
            SoundEngine.playClick();
            this.flask.splice(i, 1);
          });
        } else {
          drawText(ctx, `+ 反应槽位 ${i + 1}`, sx + 112, sy + 33, { size: 12.5, color: THEME.TX3, align: 'center' });
        }
        ctx.restore();
      }

      if (this.fusionFlash > 0) {
        const r = 24 + (1 - this.fusionFlash / 0.6) * 125;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.fusionFlash * 2);
        ctx.strokeStyle = THEME.GOLD_LIGHT;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(1018, 228, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawText(ctx, '催化倾向:', 790, 322, { size: 12, bold: true, color: THEME.TX2 });
      FOCUS_OPTIONS.forEach((opt, fi) => {
        drawButton(ctx, hits, 864 + fi * 128, 309, 120, 26, opt.label, () => {
          this.focus = opt.id;
        }, { active: this.focus === opt.id, fontSize: 11 });
      });

      if (this.flask.length > 0) {
        const sim = synthesizeChemistry(this.flask, this.focus, false);
        const pc = sim.card;
        const need: Record<ElementId, number> = { press: 0, pass: 0, wing: 0, iron: 0, blitz: 0 };
        for (const e of this.flask) need[e]++;
        const hasEnough = (Object.keys(need) as ElementId[]).every(e => (inv[e] ?? 0) >= need[e]);
        const canCraft = hasEnough && deck.length < 12;
        const pArtImg = AssetLoader.get(this.cardArtId(pc));

        drawChamferPanel(
          ctx,
          790,
          348,
          456,
          266,
          10,
          pc.isCorrupted ? 'rgba(127, 29, 29, 0.28)' : 'rgba(20, 34, 58, 0.94)',
          sim.stabilityColor,
          1.6,
          sim.stabilityColor
        );
        if (pArtImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(792, 350, 452, 92);
          ctx.clip();
          ctx.globalAlpha = 0.24;
          ctx.drawImage(pArtImg, 960, 344, 286, 108);
          ctx.restore();
        }
        this.drawCardAuraParticles(ctx, 792, 350, 452, 92, pc.level, !!pc.isCorrupted, pc.name.length + this.flask.length * 13, false);
        drawText(ctx, '产物预览 · PREVIEW', 806, 368, { size: 11, bold: true, color: THEME.TX3, mono: true });
        drawBadge(ctx, 1158, 357, 74, 20, sim.stability, '#111827', sim.stabilityColor);
        drawBadge(ctx, 806, 386, 32, 19, `E${pc.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
        drawBadge(ctx, 842, 386, 40, 19, `Lv.${pc.level}`, '#0F172A', this.lvColor(pc.level));
        drawBadge(ctx, 886, 386, 72, 19, LINE_LABELS[pc.targetLine ?? 'ALL'], '#1E293B', '#7DD3FC');
        drawText(ctx, pc.name, 806, 424, {
          size: 18,
          bold: true,
          color: pc.isCorrupted ? '#FCA5A5' : THEME.GOLD_LIGHT,
        });
        if (pc.mechanic) {
          drawRoundRect(ctx, 806, 444, 424, 26, 6, 'rgba(56, 189, 248, 0.16)', 'rgba(56, 189, 248, 0.45)');
          drawText(ctx, `⚡ 机制：${MECHANIC_LABELS[pc.mechanic]}`, 816, 457, { size: 12, bold: true, color: '#7DD3FC' });
        }
        if (pc.chainEffect) {
          drawRoundRect(ctx, 806, 476, 424, 24, 6, 'rgba(192, 132, 252, 0.16)', 'rgba(192, 132, 252, 0.45)');
          drawText(ctx, `🔗 ${pc.chainEffect.label}`, 816, 488, { size: 11, bold: true, color: '#E9D5FF' });
        }
        drawWrappedText(ctx, pc.summary, 806, 510, 424, 19, { size: 12, color: THEME.TX1, maxLines: 5 });

        drawButton(
          ctx,
          hits,
          790,
          628,
          456,
          56,
          canCraft
            ? `⚡ 立即合成 Lv.${pc.level} 战术卡！`
            : deck.length >= 12
            ? '背包卡库已满 (12/12)'
            : '基础卡库存不足',
          () => {
            const res = league.craftChemistryCard(this.flask, this.focus, false);
            if (res.ok && res.card) {
              this.fusionFlash = 0.6;
              this.selected = { kind: 'card', cardId: res.card.id };
              this.notice = `⚡ 合成成功！【${res.card.name}】已收入左侧背包！`;
              SoundEngine.playRewardChime();
              actions.onBurst?.(1018, 228, sim.stabilityColor);
              actions.onSave();
            } else {
              this.notice = res.reason || '合成失败';
            }
          },
          { variant: canCraft ? 'gold' : 'ghost', disabled: !canCraft, fontSize: 15, icon: canCraft ? 'sparkle' : undefined }
        );
      } else {
        drawChamferPanel(ctx, 790, 348, 456, 266, 10, 'rgba(19, 30, 54, 0.65)', THEME.BORDER);
        drawText(ctx, '从左侧背包投入 1~4 张基础卡', 1018, 452, {
          size: 13.5,
          color: THEME.TX3,
          align: 'center',
        });
        drawButton(ctx, hits, 918, 486, 200, 38, '打开配方图鉴一键填炉 📖', () => {
          this.recipesModalOpen = true;
        }, { variant: 'primary', fontSize: 12 });
      }
    } else {
      const cA = this.fuseSlots[0] ? deck.find(c => c.id === this.fuseSlots[0]) : null;
      const cB = this.fuseSlots[1] ? deck.find(c => c.id === this.fuseSlots[1]) : null;
      [cA, cB].forEach((card, si) => {
        const sy = 160 + si * 124;
        drawChamferPanel(ctx, 790, sy, 456, 112, 9, 'rgba(20, 34, 58, 0.92)', card ? '#C084FC' : THEME.BORDER, card ? 1.5 : 1);
        if (card) {
          drawBadge(ctx, 804, sy + 12, 38, 19, `Lv.${card.level ?? 1}`, '#581C87', THEME.GOLD_LIGHT);
          drawBadge(ctx, 846, sy + 12, 28, 19, `E${card.cost}`, '#1E3A5F', '#7DD3FC');
          drawText(ctx, card.name, 882, sy + 21, { size: 14, bold: true, color: THEME.TX1 });
          drawWrappedText(ctx, card.summary, 804, sy + 42, 428, 17, { size: 11, color: '#E9D5FF', maxLines: 3 });
          drawText(ctx, '点击移除', 1232, sy + 96, { size: 10.5, color: THEME.TX3, align: 'right' });
          hits.add(790, sy, 456, 112, () => {
            SoundEngine.playClick();
            this.fuseSlots[si] = null;
          });
        } else {
          drawText(ctx, `融合槽位 ${si + 1}（从左侧卡库点选）`, 1018, sy + 56, { size: 13, color: THEME.TX3, align: 'center' });
        }
      });

      drawChamferPanel(ctx, 790, 412, 456, 198, 9, 'rgba(168, 85, 247, 0.10)', '#A855F7');
      drawText(ctx, '双卡二合一升阶说明', 808, 436, { size: 14, bold: true, color: '#E9D5FF' });
      drawWrappedText(
        ctx,
        '将背包中两张战术卡投入上方融合槽，二合一生成更高阶的新卡（最高 Lv.4 全队生效），达到 Lv.3 以上自动觉醒连锁效果！',
        808,
        464,
        420,
        20,
        { size: 12, color: THEME.TX2, maxLines: 5 }
      );

      const canFuse = !!(cA && cB && cA.id !== cB.id);
      drawButton(
        ctx,
        hits,
        790,
        628,
        456,
        56,
        canFuse ? '✨ 立即二合一融合！' : '请从左侧再选 1 张卡投入融合',
        () => {
          if (!cA || !cB) return;
          const res = league.fuseCoachCards(cA.id, cB.id);
          this.fuseSlots = [null, null];
          if (res.ok && res.card) {
            this.fusionFlash = 0.6;
            this.selected = { kind: 'card', cardId: res.card.id };
            this.notice = `✨ 融合成功！诞生 Lv.${res.card.level}【${res.card.name}】`;
            SoundEngine.playRewardChime();
            actions.onBurst?.(1018, 280, '#C084FC');
            actions.onSave();
          } else {
            this.notice = res.reason || '融合失败';
          }
        },
        { variant: canFuse ? 'gold' : 'ghost', disabled: !canFuse, fontSize: 15, icon: canFuse ? 'sparkle' : undefined }
      );
    }

    if (this.detailModalOpen) {
      this.renderDetailModal(ctx, hits, league, actions);
    } else if (this.recipesModalOpen) {
      this.renderRecipesModal(ctx, hits);
    }
  }

  private renderDetailModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: { onSave: () => void; onBurst?: (x: number, y: number, color?: string) => void }
  ): void {
    const sel = this.selected;
    if (!sel) return;
    const inv = league.getElementInventory();
    const deck = league.getCoachDeck();
    const loadoutSet = new Set(league.getLoadoutIds());
    const totalElements = TACTICAL_ELEMENTS.reduce((s, e) => s + (inv[e.id] ?? 0), 0);

    ctx.fillStyle = 'rgba(4, 7, 14, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    // 标准竖版实体卡牌比例 (410×600，约 2:3 竖版比例)
    const mx = 435;
    const my = 60;
    const mw = 410;
    const mh = 600;

    if (sel.kind === 'base') {
      const el = TACTICAL_ELEMENTS.find(e => e.id === sel.elemId) ?? TACTICAL_ELEMENTS[0];
      const count = inv[el.id] ?? 0;
      const elemImg = AssetLoader.get(`elem_${el.id}`);
      drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(17, 27, 49, 0.98)', el.color, 1.8, el.color);
      drawBadge(ctx, mx + 22, my + 18, 58, 22, '基础卡', '#1E293B', el.color);
      drawBadge(ctx, mx + 86, my + 18, 68, 22, `库存 ×${count}`, '#0F172A', THEME.GOLD_LIGHT);
      drawButton(ctx, hits, mx + mw - 92, my + 14, 72, 30, '关闭', () => {
        this.detailModalOpen = false;
      }, { variant: 'ghost', fontSize: 11.5, icon: 'close' });

      drawRoundRect(ctx, mx + 24, my + 54, mw - 48, 220, 10, 'rgba(8, 12, 20, 0.88)', el.color);
      if (elemImg && typeof ctx.drawImage === 'function') {
        ctx.drawImage(elemImg, mx + mw / 2 - 72, my + 92, 144, 144);
      } else {
        drawIcon(ctx, ELEM_ICON[el.id], mx + mw / 2, my + 164, 68, el.color);
      }

      drawText(ctx, `${el.name} [${el.symbol}]`, mx + mw / 2, my + 306, { size: 22, bold: true, color: el.color, align: 'center' });
      drawWrappedText(ctx, el.desc, mx + 28, my + 338, mw - 56, 22, { size: 13, color: THEME.TX1, maxLines: 3 });

      drawRoundRect(ctx, mx + 24, my + 416, mw - 48, 96, 8, 'rgba(11, 17, 30, 0.8)');
      drawWrappedText(ctx, '• 「放入手牌」：提炼 Lv.1 位置卡立即出战', mx + 38, my + 432, mw - 76, 22, { size: 12, color: '#7DD3FC', maxLines: 2 });
      drawWrappedText(ctx, '• 「投入合成器」：1~4 张混搭合成高阶卡与连锁效果', mx + 38, my + 466, mw - 76, 22, { size: 12, color: '#7DD3FC', maxLines: 2 });

      drawButton(ctx, hits, mx + 24, my + 530, mw - 48, 46, `+ 投入合成器 (${el.name})`, () => {
        this.addBaseToForge(el.id);
        this.detailModalOpen = false;
      }, { variant: 'primary', disabled: count <= 0, fontSize: 13.5, icon: 'craft' });
      return;
    }

    const card = deck.find(c => c.id === sel.cardId);
    if (!card) {
      this.detailModalOpen = false;
      return;
    }

    const lv = card.level ?? 1;
    const lvCol = this.lvColor(lv);
    const equipped = loadoutSet.has(card.id);
    const artImg = AssetLoader.get(this.cardArtId(card));
    const elemImg = AssetLoader.get(`elem_${this.cardElemId(card)}`);
    const frameImg = lv >= 4 ? AssetLoader.get('card_frame_s') : lv === 3 ? AssetLoader.get('card_frame_a') : null;

    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(17, 27, 49, 0.98)', lvCol, 1.8, lvCol);
    drawBadge(ctx, mx + 22, my + 18, 34, 22, `E${card.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
    drawBadge(ctx, mx + 62, my + 18, 44, 22, `Lv.${lv}`, '#0F172A', lvCol);
    drawBadge(ctx, mx + 112, my + 18, 76, 22, LINE_LABELS[card.targetLine ?? 'ALL'], '#0F172A', THEME.TX1);
    drawButton(ctx, hits, mx + mw - 92, my + 14, 72, 30, '关闭', () => {
      this.detailModalOpen = false;
    }, { variant: 'ghost', fontSize: 11.5, icon: 'close' });

    drawRoundRect(ctx, mx + 24, my + 54, mw - 48, 220, 10, '#0B1220', lvCol);
    if (artImg && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(mx + 26, my + 56, mw - 52, 216);
      ctx.clip();
      ctx.drawImage(artImg, mx + 26, my + 52, mw - 52, 224);
      ctx.restore();
    }
    this.drawCardAuraParticles(ctx, mx + 26, my + 56, mw - 52, 216, lv, !!card.isCorrupted, card.name.length + lv * 7, false);
    if (frameImg && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.drawImage(frameImg, mx + 22, my + 52, mw - 44, 224);
      ctx.restore();
    }
    if (elemImg && typeof ctx.drawImage === 'function') {
      ctx.drawImage(elemImg, mx + mw - 72, my + 224, 38, 38);
    }

    drawText(ctx, card.name, mx + 24, my + 298, { size: 20, bold: true, color: card.isCorrupted ? '#FCA5A5' : THEME.GOLD_LIGHT });
    drawText(ctx, `持续 ${card.durationMinutes} 分钟`, mx + mw - 24, my + 298, { size: 12, color: THEME.TX2, align: 'right' });

    let infoY = my + 324;
    if (card.mechanic) {
      drawRoundRect(ctx, mx + 24, infoY, mw - 48, 28, 6, 'rgba(56, 189, 248, 0.16)', 'rgba(56, 189, 248, 0.45)');
      drawText(ctx, `⚡ 机制：${MECHANIC_LABELS[card.mechanic]}`, mx + 36, infoY + 14, { size: 12, bold: true, color: '#7DD3FC' });
      infoY += 35;
    }
    if (card.chainEffect) {
      drawRoundRect(ctx, mx + 24, infoY, mw - 48, 28, 6, 'rgba(192, 132, 252, 0.16)', 'rgba(192, 132, 252, 0.45)');
      drawText(ctx, `🔗 连锁：${card.chainEffect.label}`, mx + 36, infoY + 14, { size: 11.5, bold: true, color: '#E9D5FF' });
      infoY += 35;
    }
    drawWrappedText(ctx, card.summary, mx + 24, infoY + 4, mw - 48, 20, { size: 12.5, color: THEME.TX1, maxLines: 4 });

    drawButton(ctx, hits, mx + 24, my + 486, mw - 48, 42, equipped ? '移出出战手牌' : '放入出战手牌 ▶', () => {
      const res = league.toggleLoadoutCard(card.id);
      if (!res.ok) this.notice = res.reason || '操作失败';
      else {
        SoundEngine.playClick();
        actions.onSave();
      }
    }, { variant: equipped ? 'green' : 'primary', fontSize: 13 });

    const canUp = lv < 4 && totalElements > 0;
    const upBtnW = deck.length > 2 ? (mw - 58) / 2 : mw - 48;
    drawButton(ctx, hits, mx + 24, my + 538, upBtnW, 40, lv >= 4 ? '已达满阶' : '升阶 (+1材)', () => {
      const res = league.upgradeCoachCard(card.id);
      if (res.ok) {
        this.fusionFlash = 0.5;
        this.notice = `【${card.name}】升阶至 Lv.${card.level}！`;
        SoundEngine.playRewardChime();
        actions.onBurst?.(mx + mw / 2, my + 160, THEME.GOLD_LIGHT);
        actions.onSave();
      } else {
        this.notice = res.reason || '升阶失败';
      }
    }, { variant: canUp ? 'primary' : 'ghost', disabled: !canUp, fontSize: 12 });

    if (deck.length > 2) {
      drawButton(ctx, hits, mx + 34 + upBtnW, my + 538, upBtnW, 40, card.isCorrupted ? '拆解 (+2材)' : '拆解 (+1材)', () => {
        const res = league.dismantleCoachCard(card.id);
        if (res.ok) {
          const rName = TACTICAL_ELEMENTS.find(e => e.id === res.refunded)?.name || '基础卡';
          this.notice = `已拆解【${card.name}】，返还 ${res.count ?? 1} 张【${rName}】`;
          this.detailModalOpen = false;
          actions.onSave();
        }
      }, { variant: 'danger', fontSize: 12 });
    }
  }

  private renderRecipesModal(ctx: CanvasRenderingContext2D, hits: HitRegistry): void {
    ctx.fillStyle = 'rgba(4, 7, 14, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 140;
    const my = 72;
    const mw = 1000;
    const mh = 576;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(14, 22, 40, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);
    drawText(ctx, '常用流派合成配方图鉴', mx + 28, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '点击任意流派卡片，自动填入右侧合成器并关闭本页', mx + 28, my + 58, { size: 12.5, color: '#7DD3FC' });
    drawButton(ctx, hits, mx + mw - 104, my + 20, 80, 34, '关闭', () => {
      this.recipesModalOpen = false;
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    const recipes: Array<{ name: string; elems: ElementId[]; desc: string; col: string }> = [
      { name: '高压抢断流', elems: ['press', 'blitz', 'iron'], desc: '定位球核武 + 高位压迫', col: '#EF4444' },
      { name: '传控连锁流', elems: ['pass', 'pass', 'wing'], desc: '两翼超载 + 全线传导', col: '#38BDF8' },
      { name: '铁血防反流', elems: ['iron', 'blitz', 'pass'], desc: '体能虹吸 + 稳固防守', col: '#22C55E' },
      { name: '远射重炮流', elems: ['pass', 'pass', 'blitz'], desc: '30%远射xG + 连携共鸣', col: '#C084FC' },
      { name: '门线铁壁流', elems: ['iron', 'iron'], desc: '禁区封堵+18% + 门将强化', col: '#10B981' },
      { name: '暴走嗜血流', elems: ['blitz', 'blitz', 'wing'], desc: '落后+8射/速 + 高速突击', col: '#F59E0B' },
    ];

    recipes.forEach((rc, ri) => {
      const col = ri % 2;
      const row = Math.floor(ri / 2);
      const rx = mx + 28 + col * 480;
      const ry = my + 90 + row * 154;
      const rw = 464;
      const rh = 136;
      const hovered = hits.isHovered(rx, ry, rw, rh);
      drawChamferPanel(ctx, rx, ry, rw, rh, 10, hovered ? THEME.BG_CARD_HOVER : THEME.BG_CARD, hovered ? rc.col : THEME.BORDER, hovered ? 1.6 : 1);
      rc.elems.forEach((eid, ei) => {
        const eImg = AssetLoader.get(`elem_${eid}`);
        if (eImg && typeof ctx.drawImage === 'function') {
          ctx.drawImage(eImg, rx + rw - 116 + ei * 34, ry + 18, 28, 28);
        }
      });
      drawText(ctx, rc.name, rx + 20, ry + 32, { size: 17, bold: true, color: rc.col });
      drawText(ctx, rc.desc, rx + 20, ry + 64, { size: 13, color: THEME.TX1 });
      const formulaTxt = rc.elems.map(e => TACTICAL_ELEMENTS.find(t => t.id === e)?.name).join(' + ');
      drawText(ctx, `配方：${formulaTxt}`, rx + 20, ry + 96, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
      drawText(ctx, '点击一键填炉 ▶', rx + rw - 20, ry + 108, { size: 11.5, color: '#7DD3FC', align: 'right' });

      hits.add(rx, ry, rw, rh, () => {
        SoundEngine.playClick();
        this.fuseSlots = [null, null];
        this.flask = [...rc.elems];
        this.recipesModalOpen = false;
        this.notice = `已装填【${rc.name}】，点下方按钮即可合成！`;
      });
    });
  }
}
