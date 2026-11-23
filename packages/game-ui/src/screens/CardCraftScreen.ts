/**
 * 卡牌背包与战术合成器（主次分明三栏结构 + 实体卡牌插画 + 无外框中栏展示）
 * - 左栏 (480px 主区)：出战手牌 (4槽, 右上角×可靠卸下) + 统一卡牌背包（基础卡 + 合成卡）
 * - 中栏 (270px 无外框辅区)：Tab 切换「卡牌详情」或「配方图鉴」，点击直接展示插画大卡或一键填配方
 * - 右栏 (398px 主区)：独立合成器（支持 1~4 张基础卡合成，或 2 张合成卡二合一融合升阶）
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
type MidTab = 'detail' | 'recipes';
type SelectedItem = { kind: 'base'; elemId: ElementId } | { kind: 'card'; cardId: string };

export class CardCraftScreen {
  private flask: ElementId[] = ['press', 'wing'];
  private fuseSlots: [string | null, string | null] = [null, null];
  private focus: CraftFocus = 'balanced';
  private bagFilter: BagFilter = 'all';
  private midTab: MidTab = 'detail';
  private bagPage = 0;
  private selected: SelectedItem | null = null;
  private notice = '点击左侧卡牌查看详情，点「放入手牌」或「+ 入炉」';
  private fusionFlash = 0;
  private animTime = 0;
  private slotPopTimers = [0, 0, 0, 0];

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

  /**
   * 根据卡牌等级 (Lv.1~4) 与负面反噬状态绘制动态等级粒子与黑色煞气粒子
   */
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

    if (this.selected?.kind === 'card' && !deck.some(c => c.id === this.selected!.cardId)) {
      this.selected = deck[0] ? { kind: 'card', cardId: deck[0].id } : { kind: 'base', elemId: 'press' };
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

    // ==================== 左栏 (主区 1, x: 96..576, w: 480)：出战手牌 + 卡牌背包 ====================
    drawChamferPanel(ctx, 96, 80, 480, 624, 10, 'rgba(14, 22, 40, 0.94)', THEME.BORDER);

    // 1) 上部：出战手牌 (4槽位)
    drawText(ctx, `出战手牌 (${loadoutIds.length}/4 · 比赛日携带)`, 112, 98, {
      size: 13,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    for (let i = 0; i < 4; i++) {
      const sx = 110 + i * 114;
      const sy = 114;
      const sw = 108;
      const sh = 78;
      const cid = loadoutIds[i];
      const card = cid ? deck.find(c => c.id === cid) : undefined;
      if (card) {
        const lv = card.level ?? 1;
        const lvCol = this.lvColor(lv);
        const isSel = this.selected?.kind === 'card' && this.selected.cardId === card.id;
        const artImg = AssetLoader.get(this.cardArtId(card));
        drawChamferPanel(ctx, sx, sy, sw, sh, 7, 'rgba(20, 34, 58, 0.96)', isSel ? THEME.GOLD_LIGHT : lvCol, isSel ? 1.8 : 1.2);
        if (artImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(sx + 2, sy + 2, sw - 4, sh - 4);
          ctx.clip();
          ctx.globalAlpha = 0.22;
          ctx.drawImage(artImg, sx + 34, sy, sw - 34, sh);
          ctx.restore();
        }
        this.drawCardAuraParticles(ctx, sx + 2, sy + 2, sw - 4, sh - 4, lv, !!card.isCorrupted, i + card.name.length, true);
        drawBadge(ctx, sx + 6, sy + 6, 24, 15, `E${card.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
        drawBadge(ctx, sx + 33, sy + 6, 28, 15, `Lv.${lv}`, '#0F172A', lvCol);
        drawText(ctx, card.name.slice(0, 7), sx + 6, sy + 36, { size: 11, bold: true, color: THEME.TX1 });
        const mech = card.mechanic ? MECHANIC_LABELS[card.mechanic] : this.statSnippet(card);
        drawText(ctx, mech.slice(0, 9), sx + 6, sy + 56, { size: 9, color: '#7DD3FC' });

        // 先注册卡面选中，再注册右上角 × 移除（后注册优先响应！）
        hits.add(sx, sy, sw, sh, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'card', cardId: card.id };
          this.midTab = 'detail';
        });
        const xHover = hits.isHovered(sx + sw - 22, sy + 3, 18, 18);
        drawRoundRect(ctx, sx + sw - 22, sy + 4, 17, 17, 4, xHover ? '#991B1B' : 'rgba(15, 23, 42, 0.85)', xHover ? THEME.RED_LIGHT : THEME.BORDER);
        drawText(ctx, '×', sx + sw - 13.5, sy + 12.5, { size: 12, bold: true, color: xHover ? '#FFFFFF' : '#FCA5A5', align: 'center' });
        hits.add(sx + sw - 24, sy + 2, 22, 22, () => {
          const res = league.toggleLoadoutCard(card.id);
          if (!res.ok) this.notice = res.reason || '卸下失败';
          else {
            SoundEngine.playClick();
            this.notice = `已将【${card.name}】移出手牌`;
            actions.onSave();
          }
        });
      } else {
        const selCard = this.selected?.kind === 'card' ? deck.find(c => c.id === this.selected!.cardId) : null;
        const canQuickEquip = !!(selCard && !loadoutSet.has(selCard.id));
        drawRoundRect(
          ctx,
          sx,
          sy,
          sw,
          sh,
          7,
          'rgba(11, 17, 30, 0.6)',
          canQuickEquip ? 'rgba(34, 197, 94, 0.45)' : 'rgba(148, 163, 184, 0.22)'
        );
        drawText(ctx, `手牌槽 ${i + 1}`, sx + sw / 2, sy + 28, { size: 10, color: THEME.TX3, align: 'center' });
        drawText(ctx, canQuickEquip ? '点此放入' : '空置', sx + sw / 2, sy + 48, {
          size: 9.5,
          color: canQuickEquip ? THEME.GREEN : THEME.TX3,
          align: 'center',
        });
        if (canQuickEquip && selCard) {
          hits.add(sx, sy, sw, sh, () => {
            const res = league.toggleLoadoutCard(selCard.id);
            if (res.ok) {
              SoundEngine.playClick();
              actions.onSave();
            }
          });
        }
      }
    }

    // 2) 下部：统一卡牌背包（基础卡 + 合成卡）
    drawText(ctx, '卡牌背包', 112, 210, { size: 13, bold: true, color: THEME.TX1 });
    const filters: Array<[BagFilter, string]> = [
      ['all', '全部'],
      ['base', '基础卡'],
      ['crafted', '合成卡'],
      ['equipped', '出战中'],
    ];
    filters.forEach(([fk, fl], fi) => {
      drawButton(ctx, hits, 326 + fi * 60, 198, 56, 24, fl, () => {
        this.bagFilter = fk;
        this.bagPage = 0;
      }, { active: this.bagFilter === fk, fontSize: 10 });
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

    const pageSize = 6;
    const totalPages = Math.max(1, Math.ceil(bagItems.length / pageSize));
    if (this.bagPage >= totalPages) this.bagPage = totalPages - 1;
    const visibleBag = bagItems.slice(this.bagPage * pageSize, (this.bagPage + 1) * pageSize);

    visibleBag.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = 110 + col * 230;
      const by = 232 + row * 142;
      const bw = 222;
      const bh = 134;

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
        const elemImg = AssetLoader.get(`elem_${el.id}`);
        if (elemImg && typeof ctx.drawImage === 'function') {
          ctx.drawImage(elemImg, bx + 10, by + 10, 34, 34);
        } else {
          drawIcon(ctx, ELEM_ICON[el.id], bx + 27, by + 27, 18, el.color);
        }
        drawBadge(ctx, bx + 50, by + 10, 44, 16, '基础卡', '#1E293B', el.color);
        drawText(ctx, `×${count}`, bx + bw - 10, by + 18, {
          size: 14,
          bold: true,
          color: count > 0 ? THEME.GOLD_LIGHT : THEME.TX3,
          align: 'right',
          mono: true,
        });
        drawText(ctx, `${el.name} [${el.symbol}]`, bx + 50, by + 36, { size: 13, bold: true, color: el.color });
        drawWrappedText(ctx, el.desc, bx + 10, by + 56, bw - 20, 14, { size: 9.5, color: THEME.TX2, maxLines: 2 });

        hits.add(bx, by, bw, 94, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'base', elemId: el.id };
          this.midTab = 'detail';
        });

        const canDirectHand = count > 0 && deck.length < 12 && loadoutIds.length < 4;
        drawButton(ctx, hits, bx + 10, by + 98, 98, 26, '放入手牌 ▶', () => {
          const res = league.craftChemistryCard([el.id], 'balanced', true);
          if (res.ok && res.card) {
            this.selected = { kind: 'card', cardId: res.card.id };
            this.midTab = 'detail';
            this.notice = `已提炼 Lv.1【${res.card.name}】并放入手牌！`;
            SoundEngine.playRewardChime();
            actions.onSave();
          } else {
            this.notice = res.reason || '手牌或卡库已满';
          }
        }, { variant: canDirectHand ? 'green' : 'ghost', disabled: !canDirectHand, fontSize: 10 });

        drawButton(ctx, hits, bx + 114, by + 98, 98, 26, usedInFlask > 0 ? `已入炉 ×${usedInFlask}` : '+ 入炉合成', () => {
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
        if (artImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx + 2, by + 2, bw - 4, 52);
          ctx.clip();
          ctx.globalAlpha = 0.28;
          ctx.drawImage(artImg, bx + 80, by - 4, bw - 80, 64);
          ctx.restore();
        } else if (cardBackImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx + 2, by + 2, bw - 4, bh - 4);
          ctx.clip();
          ctx.globalAlpha = 0.14;
          ctx.drawImage(cardBackImg, bx, by, bw, bh);
          ctx.restore();
        }
        this.drawCardAuraParticles(ctx, bx + 2, by + 2, bw - 4, 54, lv, !!card.isCorrupted, idx + card.name.length, true);
        drawBadge(ctx, bx + 8, by + 8, 24, 16, `E${card.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
        drawBadge(ctx, bx + 35, by + 8, 30, 16, `Lv.${lv}`, '#0F172A', lvCol);
        if (elemImg && typeof ctx.drawImage === 'function') {
          ctx.drawImage(elemImg, bx + 68, by + 7, 18, 18);
        }
        if (equipped) {
          drawBadge(ctx, bx + bw - 54, by + 8, 46, 16, '出战中', '#14532D', THEME.GREEN);
        }
        drawText(ctx, card.name.slice(0, 9), bx + 8, by + 38, {
          size: 13,
          bold: true,
          color: card.isCorrupted ? '#FCA5A5' : THEME.TX1,
        });
        const mechTxt = card.mechanic ? `⚡ ${MECHANIC_LABELS[card.mechanic]}` : this.statSnippet(card);
        drawText(ctx, mechTxt.slice(0, 16), bx + 8, by + 58, { size: 10, bold: true, color: '#7DD3FC' });
        drawText(ctx, `${LINE_LABELS[card.targetLine ?? 'ALL']} · ${card.durationMinutes}分`, bx + 8, by + 76, {
          size: 9.5,
          color: THEME.TX2,
        });

        hits.add(bx, by, bw, 94, () => {
          SoundEngine.playClick();
          this.selected = { kind: 'card', cardId: card.id };
          this.midTab = 'detail';
        });

        drawButton(ctx, hits, bx + 8, by + 98, 98, 26, equipped ? '移出手牌' : '放入手牌 ▶', () => {
          const res = league.toggleLoadoutCard(card.id);
          if (!res.ok) this.notice = res.reason || '操作失败';
          else {
            SoundEngine.playClick();
            actions.onSave();
          }
        }, { variant: equipped ? 'green' : 'primary', fontSize: 10 });

        drawButton(ctx, hits, bx + 114, by + 98, 100, 26, inFuse ? '已入融合' : '+ 融合升阶', () => {
          this.addCardToForge(card.id);
        }, { variant: inFuse ? 'gold' : 'ghost', fontSize: 10 });
      }
    });

    if (totalPages > 1) {
      drawButton(ctx, hits, 110, 666, 92, 26, '上一页', () => {
        this.bagPage = Math.max(0, this.bagPage - 1);
      }, { disabled: this.bagPage === 0, fontSize: 10 });
      drawText(ctx, `第 ${this.bagPage + 1} / ${totalPages} 页`, 336, 679, {
        size: 11,
        color: THEME.TX2,
        align: 'center',
      });
      drawButton(ctx, hits, 470, 666, 92, 26, '下一页', () => {
        this.bagPage = Math.min(totalPages - 1, this.bagPage + 1);
      }, { disabled: this.bagPage >= totalPages - 1, fontSize: 10 });
    }

    // ==================== 中栏 (x: 586..856, w: 270)：无外框！直接悬浮展示插画大卡或配方 ====================
    drawButton(ctx, hits, 594, 84, 124, 28, '卡牌详情', () => {
      this.midTab = 'detail';
    }, { active: this.midTab === 'detail', fontSize: 11 });
    drawButton(ctx, hits, 724, 84, 124, 28, '配方图鉴', () => {
      this.midTab = 'recipes';
    }, { active: this.midTab === 'recipes', fontSize: 11 });

    if (this.midTab === 'detail') {
      if (this.selected?.kind === 'base') {
        const el = TACTICAL_ELEMENTS.find(e => e.id === this.selected!.elemId) ?? TACTICAL_ELEMENTS[0];
        const count = inv[el.id] ?? 0;
        const elemImg = AssetLoader.get(`elem_${el.id}`);
        drawChamferPanel(ctx, 594, 148, 254, 524, 12, 'rgba(17, 27, 49, 0.96)', el.color, 1.6, el.color);

        drawRoundRect(ctx, 606, 160, 230, 176, 8, 'rgba(8, 12, 20, 0.85)', el.color);
        if (elemImg && typeof ctx.drawImage === 'function') {
          ctx.drawImage(elemImg, 661, 188, 120, 120);
        } else {
          drawIcon(ctx, ELEM_ICON[el.id], 721, 248, 52, el.color);
        }
        drawBadge(ctx, 614, 168, 52, 18, '基础卡', '#1E293B', el.color);
        drawBadge(ctx, 774, 168, 54, 18, `×${count}`, '#0F172A', THEME.GOLD_LIGHT);

        drawText(ctx, `${el.name} [${el.symbol}]`, 721, 358, { size: 18, bold: true, color: el.color, align: 'center' });
        drawWrappedText(ctx, el.desc, 612, 384, 218, 18, { size: 11.5, color: THEME.TX1, maxLines: 4 });
        drawRoundRect(ctx, 612, 470, 218, 118, 6, 'rgba(11, 17, 30, 0.78)');
        drawWrappedText(ctx, '• 「放入手牌」：提炼 Lv.1 位置卡立即出战', 622, 482, 198, 18, { size: 10.5, color: '#7DD3FC', maxLines: 2 });
        drawWrappedText(ctx, '• 「投入合成器」：1~4 张混搭合成高阶卡与连锁效果', 622, 526, 198, 18, { size: 10.5, color: '#7DD3FC', maxLines: 3 });
        drawButton(ctx, hits, 612, 606, 218, 46, `+ 投入合成器 (${el.name})`, () => {
          this.addBaseToForge(el.id);
        }, { variant: 'primary', disabled: count <= 0, fontSize: 12, icon: 'craft' });
      } else if (this.selected?.kind === 'card') {
        const card = deck.find(c => c.id === this.selected!.cardId);
        if (card) {
          const lv = card.level ?? 1;
          const lvCol = this.lvColor(lv);
          const equipped = loadoutSet.has(card.id);
          const artImg = AssetLoader.get(this.cardArtId(card));
          const elemImg = AssetLoader.get(`elem_${this.cardElemId(card)}`);
          const frameImg = lv >= 4 ? AssetLoader.get('card_frame_s') : lv === 3 ? AssetLoader.get('card_frame_a') : null;

          drawChamferPanel(ctx, 594, 148, 254, 524, 12, 'rgba(17, 27, 49, 0.96)', lvCol, 1.8, lvCol);

          drawRoundRect(ctx, 606, 160, 230, 182, 8, '#0B1220', lvCol);
          if (artImg && typeof ctx.drawImage === 'function') {
            ctx.save();
            ctx.beginPath();
            ctx.rect(608, 162, 226, 178);
            ctx.clip();
            ctx.drawImage(artImg, 608, 158, 226, 188);
            ctx.restore();
          }
          this.drawCardAuraParticles(ctx, 608, 162, 226, 178, lv, !!card.isCorrupted, card.name.length + lv * 7, false);
          if (frameImg && typeof ctx.drawImage === 'function') {
            ctx.save();
            ctx.globalAlpha = 0.72;
            ctx.drawImage(frameImg, 604, 158, 234, 186);
            ctx.restore();
          }
          drawBadge(ctx, 614, 168, 28, 18, `E${card.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
          drawBadge(ctx, 646, 168, 36, 18, `Lv.${lv}`, '#0F172A', lvCol);
          drawBadge(ctx, 766, 168, 62, 18, LINE_LABELS[card.targetLine ?? 'ALL'], '#0F172A', THEME.TX1);
          if (elemImg && typeof ctx.drawImage === 'function') {
            ctx.drawImage(elemImg, 796, 302, 34, 34);
          }

          drawText(ctx, card.name, 612, 362, { size: 16, bold: true, color: card.isCorrupted ? '#FCA5A5' : THEME.GOLD_LIGHT });
          drawText(ctx, `持续 ${card.durationMinutes} 分钟`, 830, 362, { size: 10, color: THEME.TX2, align: 'right' });

          let infoY = 382;
          if (card.mechanic) {
            drawRoundRect(ctx, 610, infoY, 222, 24, 5, 'rgba(56, 189, 248, 0.16)', 'rgba(56, 189, 248, 0.45)');
            drawText(ctx, `⚡ ${MECHANIC_LABELS[card.mechanic]}`, 618, infoY + 12, { size: 10.5, bold: true, color: '#7DD3FC' });
            infoY += 30;
          }
          if (card.chainEffect) {
            drawRoundRect(ctx, 610, infoY, 222, 24, 5, 'rgba(192, 132, 252, 0.16)', 'rgba(192, 132, 252, 0.45)');
            drawText(ctx, `🔗 ${card.chainEffect.label.slice(0, 15)}`, 618, infoY + 12, { size: 10, bold: true, color: '#E9D5FF' });
            infoY += 30;
          }
          drawWrappedText(ctx, card.summary, 612, infoY + 4, 218, 17, { size: 11, color: THEME.TX1, maxLines: 5 });

          drawButton(ctx, hits, 610, 576, 222, 38, equipped ? '移出出战手牌' : '放入出战手牌 ▶', () => {
            const res = league.toggleLoadoutCard(card.id);
            if (!res.ok) this.notice = res.reason || '操作失败';
            else {
              SoundEngine.playClick();
              actions.onSave();
            }
          }, { variant: equipped ? 'green' : 'primary', fontSize: 12 });

          const canUp = lv < 4 && totalElements > 0;
          drawButton(ctx, hits, 610, 622, 108, 32, lv >= 4 ? '已满阶' : '升阶(1材)', () => {
            const res = league.upgradeCoachCard(card.id);
            if (res.ok) {
              this.fusionFlash = 0.5;
              this.notice = `【${card.name}】升阶至 Lv.${card.level}！`;
              SoundEngine.playRewardChime();
              actions.onBurst?.(721, 280, THEME.GOLD_LIGHT);
              actions.onSave();
            } else {
              this.notice = res.reason || '升阶失败';
            }
          }, { variant: canUp ? 'primary' : 'ghost', disabled: !canUp, fontSize: 10 });

          if (deck.length > 2) {
            drawButton(ctx, hits, 724, 622, 108, 32, card.isCorrupted ? '拆解(+2)' : '拆解返材', () => {
              const res = league.dismantleCoachCard(card.id);
              if (res.ok) {
                const rName = TACTICAL_ELEMENTS.find(e => e.id === res.refunded)?.name || '基础卡';
                this.notice = `已拆解【${card.name}】，返还 ${res.count ?? 1} 张【${rName}】`;
                actions.onSave();
              }
            }, { variant: 'danger', fontSize: 10 });
          }
        }
      }
    } else {
      // 配方图鉴 Tab（无外框，直接悬浮配方卡）
      drawText(ctx, '点击任意流派一键填入右侧合成器', 596, 130, { size: 11, color: '#7DD3FC' });
      const recipes: Array<{ name: string; elems: ElementId[]; desc: string; col: string }> = [
        { name: '高压抢断流', elems: ['press', 'blitz', 'iron'], desc: '定位球核武 + 高位压迫', col: '#EF4444' },
        { name: '传控连锁流', elems: ['pass', 'pass', 'wing'], desc: '两翼超载 + 全线传导', col: '#38BDF8' },
        { name: '铁血防反流', elems: ['iron', 'blitz', 'pass'], desc: '体能虹吸 + 稳固防守', col: '#22C55E' },
        { name: '远射重炮流', elems: ['pass', 'pass', 'blitz'], desc: '30%远射xG + 连携共鸣', col: '#C084FC' },
        { name: '门线铁壁流', elems: ['iron', 'iron'], desc: '禁区封堵+18% + 门将强化', col: '#10B981' },
        { name: '暴走嗜血流', elems: ['blitz', 'blitz', 'wing'], desc: '落后+8射/速 + 高速突击', col: '#F59E0B' },
      ];
      recipes.forEach((rc, ri) => {
        const ry = 150 + ri * 86;
        const hovered = hits.isHovered(594, ry, 254, 76);
        drawChamferPanel(ctx, 594, ry, 254, 76, 8, hovered ? THEME.BG_CARD_HOVER : 'rgba(17, 27, 49, 0.92)', hovered ? rc.col : THEME.BORDER);
        rc.elems.forEach((eid, ei) => {
          const eImg = AssetLoader.get(`elem_${eid}`);
          if (eImg && typeof ctx.drawImage === 'function') {
            ctx.drawImage(eImg, 764 + ei * 26, ry + 12, 22, 22);
          }
        });
        drawText(ctx, rc.name, 608, ry + 22, { size: 13, bold: true, color: rc.col });
        drawText(ctx, rc.desc, 608, ry + 42, { size: 10.5, color: THEME.TX2 });
        const formulaTxt = rc.elems.map(e => TACTICAL_ELEMENTS.find(t => t.id === e)?.name).join(' + ');
        drawText(ctx, `配方: ${formulaTxt}`, 608, ry + 60, { size: 9.5, color: THEME.GOLD_LIGHT });
        hits.add(594, ry, 254, 76, () => {
          SoundEngine.playClick();
          this.fuseSlots = [null, null];
          this.flask = [...rc.elems];
          this.notice = `已装填【${rc.name}】，点右侧按钮即可合成！`;
        });
      });
    }

    // ==================== 右栏 (主区 2, x: 866..1264, w: 398)：独立合成器 ====================
    drawChamferPanel(ctx, 866, 80, 398, 624, 10, 'rgba(14, 22, 40, 0.96)', THEME.BORDER_GOLD, 1.5, THEME.GOLD_LIGHT);
    drawIcon(ctx, 'craft', 886, 102, 16, THEME.GOLD_LIGHT);
    drawText(ctx, isFuseMode ? '合成器 · 双卡融合升阶' : '合成器 · 反应釜', 906, 102, {
      size: 15,
      bold: true,
      color: isFuseMode ? '#E9D5FF' : THEME.GOLD_LIGHT,
    });
    drawButton(ctx, hits, 1180, 89, 70, 24, '清空炉', () => {
      this.flask = [];
      this.fuseSlots = [null, null];
    }, { variant: 'ghost', fontSize: 10, disabled: !isFuseMode && this.flask.length === 0 });
    drawWrappedText(ctx, this.notice, 882, 120, 366, 14, { size: 10.5, color: '#7DD3FC', maxLines: 2 });

    if (!isFuseMode) {
      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx = 882 + col * 186;
        const sy = 156 + row * 72;
        const eid = this.flask[i];
        const edef = eid ? TACTICAL_ELEMENTS.find(e => e.id === eid) : null;
        const popT = this.slotPopTimers[i] ?? 0;
        const popScale = popT > 0 ? 1 + 0.12 * Math.sin((popT / 0.26) * Math.PI) : 1;
        ctx.save();
        if (popScale !== 1) {
          ctx.translate(sx + 90, sy + 32);
          ctx.scale(popScale, popScale);
          ctx.translate(-(sx + 90), -(sy + 32));
        }
        drawChamferPanel(ctx, sx, sy, 180, 64, 8, 'rgba(19, 30, 54, 0.9)', edef ? edef.color : THEME.BORDER, edef ? 1.5 : 1);
        if (edef) {
          const img = AssetLoader.get(`elem_${edef.id}`);
          if (img && typeof ctx.drawImage === 'function') ctx.drawImage(img, sx + 14, sy + 15, 34, 34);
          drawText(ctx, edef.name, sx + 56, sy + 24, { size: 13, bold: true, color: edef.color });
          drawText(ctx, `槽${i + 1} · 点移除`, sx + 56, sy + 44, { size: 9.5, color: THEME.TX3 });
          hits.add(sx, sy, 180, 64, () => {
            SoundEngine.playClick();
            this.flask.splice(i, 1);
          });
        } else {
          drawText(ctx, `+ 槽位 ${i + 1}`, sx + 90, sy + 32, { size: 12, color: THEME.TX3, align: 'center' });
        }
        ctx.restore();
      }

      if (this.fusionFlash > 0) {
        const r = 24 + (1 - this.fusionFlash / 0.6) * 115;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.fusionFlash * 2);
        ctx.strokeStyle = THEME.GOLD_LIGHT;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(1065, 224, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawText(ctx, '催化倾向:', 882, 314, { size: 11, bold: true, color: THEME.TX2 });
      FOCUS_OPTIONS.forEach((opt, fi) => {
        drawButton(ctx, hits, 946 + fi * 102, 302, 96, 24, opt.label, () => {
          this.focus = opt.id;
        }, { active: this.focus === opt.id, fontSize: 10 });
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
          882,
          340,
          366,
          272,
          10,
          pc.isCorrupted ? 'rgba(127, 29, 29, 0.28)' : 'rgba(20, 34, 58, 0.94)',
          sim.stabilityColor,
          1.6,
          sim.stabilityColor
        );
        if (pArtImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(884, 342, 362, 86);
          ctx.clip();
          ctx.globalAlpha = 0.24;
          ctx.drawImage(pArtImg, 1020, 336, 228, 100);
          ctx.restore();
        }
        this.drawCardAuraParticles(ctx, 884, 342, 362, 86, pc.level, !!pc.isCorrupted, pc.name.length + this.flask.length * 13, false);
        drawText(ctx, '产物预览 · PREVIEW', 896, 358, { size: 10, bold: true, color: THEME.TX3, mono: true });
        drawBadge(ctx, 1170, 349, 64, 18, sim.stability, '#111827', sim.stabilityColor);
        drawBadge(ctx, 896, 376, 30, 18, `E${pc.cost}`, '#1E3A5F', THEME.GOLD_LIGHT);
        drawBadge(ctx, 930, 376, 38, 18, `Lv.${pc.level}`, '#0F172A', this.lvColor(pc.level));
        drawBadge(ctx, 972, 376, 66, 18, LINE_LABELS[pc.targetLine ?? 'ALL'], '#1E293B', '#7DD3FC');
        drawText(ctx, pc.name, 896, 414, {
          size: 17,
          bold: true,
          color: pc.isCorrupted ? '#FCA5A5' : THEME.GOLD_LIGHT,
        });
        if (pc.mechanic) {
          drawRoundRect(ctx, 896, 434, 338, 24, 5, 'rgba(56, 189, 248, 0.16)', 'rgba(56, 189, 248, 0.45)');
          drawText(ctx, `⚡ 机制：${MECHANIC_LABELS[pc.mechanic]}`, 906, 446, { size: 11, bold: true, color: '#7DD3FC' });
        }
        if (pc.chainEffect) {
          drawRoundRect(ctx, 896, 464, 338, 22, 5, 'rgba(192, 132, 252, 0.16)', 'rgba(192, 132, 252, 0.45)');
          drawText(ctx, `🔗 ${pc.chainEffect.label}`, 906, 475, { size: 10, bold: true, color: '#E9D5FF' });
        }
        drawWrappedText(ctx, pc.summary, 896, 496, 338, 17, { size: 11, color: THEME.TX1, maxLines: 5 });

        drawButton(
          ctx,
          hits,
          882,
          628,
          366,
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
              this.midTab = 'detail';
              this.notice = `⚡ 合成成功！【${res.card.name}】已收入左侧背包！`;
              SoundEngine.playRewardChime();
              actions.onBurst?.(1065, 224, sim.stabilityColor);
              actions.onBurst?.(721, 240, THEME.GOLD_LIGHT);
              actions.onSave();
            } else {
              this.notice = res.reason || '合成失败';
            }
          },
          { variant: canCraft ? 'gold' : 'ghost', disabled: !canCraft, fontSize: 14, icon: canCraft ? 'sparkle' : undefined }
        );
      } else {
        drawChamferPanel(ctx, 882, 340, 366, 272, 10, 'rgba(19, 30, 54, 0.65)', THEME.BORDER);
        drawText(ctx, '从左侧背包投入 1~4 张基础卡', 1065, 464, {
          size: 12,
          color: THEME.TX3,
          align: 'center',
        });
        drawText(ctx, '或从中间「配方图鉴」点选流派', 1065, 488, {
          size: 12,
          color: THEME.TX3,
          align: 'center',
        });
      }
    } else {
      const cA = this.fuseSlots[0] ? deck.find(c => c.id === this.fuseSlots[0]) : null;
      const cB = this.fuseSlots[1] ? deck.find(c => c.id === this.fuseSlots[1]) : null;
      [cA, cB].forEach((card, si) => {
        const sy = 158 + si * 124;
        drawChamferPanel(ctx, 882, sy, 366, 112, 9, 'rgba(20, 34, 58, 0.92)', card ? '#C084FC' : THEME.BORDER, card ? 1.5 : 1);
        if (card) {
          drawBadge(ctx, 896, sy + 12, 36, 18, `Lv.${card.level ?? 1}`, '#581C87', THEME.GOLD_LIGHT);
          drawBadge(ctx, 936, sy + 12, 26, 18, `E${card.cost}`, '#1E3A5F', '#7DD3FC');
          drawText(ctx, card.name, 970, sy + 21, { size: 13, bold: true, color: THEME.TX1 });
          drawWrappedText(ctx, card.summary, 896, sy + 40, 338, 15, { size: 10, color: '#E9D5FF', maxLines: 3 });
          drawText(ctx, '点击移除', 1236, sy + 96, { size: 9.5, color: THEME.TX3, align: 'right' });
          hits.add(882, sy, 366, 112, () => {
            SoundEngine.playClick();
            this.fuseSlots[si] = null;
          });
        } else {
          drawText(ctx, `融合槽位 ${si + 1}（从左侧卡库点选）`, 1065, sy + 56, { size: 12, color: THEME.TX3, align: 'center' });
        }
      });

      drawChamferPanel(ctx, 882, 412, 366, 198, 9, 'rgba(168, 85, 247, 0.10)', '#A855F7');
      drawText(ctx, '双卡二合一升阶说明', 898, 434, { size: 13, bold: true, color: '#E9D5FF' });
      drawWrappedText(
        ctx,
        '将背包中两张战术卡投入上方融合槽，二合一生成更高阶的新卡（最高 Lv.4 全队生效），达到 Lv.3 以上自动觉醒连锁效果！',
        898,
        460,
        334,
        18,
        { size: 11, color: THEME.TX2, maxLines: 5 }
      );

      const canFuse = !!(cA && cB && cA.id !== cB.id);
      drawButton(
        ctx,
        hits,
        882,
        628,
        366,
        56,
        canFuse ? '✨ 立即二合一融合！' : '请从左侧再选 1 张卡投入融合',
        () => {
          if (!cA || !cB) return;
          const res = league.fuseCoachCards(cA.id, cB.id);
          this.fuseSlots = [null, null];
          if (res.ok && res.card) {
            this.fusionFlash = 0.6;
            this.selected = { kind: 'card', cardId: res.card.id };
            this.midTab = 'detail';
            this.notice = `✨ 融合成功！诞生 Lv.${res.card.level}【${res.card.name}】`;
            SoundEngine.playRewardChime();
            actions.onBurst?.(1065, 280, '#C084FC');
            actions.onSave();
          } else {
            this.notice = res.reason || '融合失败';
          }
        },
        { variant: canFuse ? 'gold' : 'ghost', disabled: !canFuse, fontSize: 14, icon: canFuse ? 'sparkle' : undefined }
      );
    }
  }
}
