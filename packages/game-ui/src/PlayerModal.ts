/**
 * 通用球员完整属性详情弹窗（PITCH PRINT 暖纸球探档案卡 + 10维能力条 + 5×4 大号选号器）
 */

import { PlayerAttributes } from '../../engine/src/types';
import { LeagueManager } from '../../core/src/LeagueManager';
import { TRAIT_DESCRIPTIONS } from '../../core/src/PlayerPool';
import { DraftPlayer } from '../../core/src/types';
import { drawPlayerAvatar } from './AvatarRenderer';
import {
  drawBadge,
  drawButton,
  drawPrintCard,
  drawRoundRect,
  drawStatBar,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  HitRegistry,
  tierColor,
} from './CanvasKit';
import { THEME } from './Theme';

const ATTR_LABELS: Array<[keyof PlayerAttributes, string]> = [
  ['pace', '速度与爆发'],
  ['shooting', '射门与终结'],
  ['passing', '传球与视野'],
  ['dribbling', '盘带与护球'],
  ['defending', '抢断与拦截'],
  ['positioning', '跑位与选位'],
  ['strength', '身体对抗'],
  ['composure', '门前冷静'],
  ['stamina', '体能耐久'],
  ['goalkeeping', '门将扑救'],
];

export interface PlayerModalOptions {
  scoutFog?: boolean;
  revealCount?: number;
}

export interface PlayerModalClubContext {
  league: LeagueManager;
  onSave: () => void;
  onToast?: (msg: string, color?: string) => void;
}

export class PlayerModal {
  private player: DraftPlayer | null = null;
  private scoutFog = false;
  private revealCount = 3;
  private numberPickerOpen = false;
  private numberPage = 0;

  public open(player: DraftPlayer, opts?: PlayerModalOptions): void {
    this.player = player;
    const fogLv = player.scoutFogLevel ?? 0;
    this.scoutFog = !!opts?.scoutFog && fogLv < 2;
    this.revealCount = Math.max(2, Math.min(10, opts?.revealCount ?? (fogLv === 1 ? 6 : 3)));
    this.numberPickerOpen = false;
    this.numberPage = 0;
  }

  public close(): void {
    this.player = null;
    this.scoutFog = false;
    this.numberPickerOpen = false;
  }

  private getRevealedKeys(p: DraftPlayer, count: number): Set<keyof PlayerAttributes> {
    const primary: keyof PlayerAttributes =
      p.role === 'GK' ? 'goalkeeping' :
      ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role) ? 'defending' :
      ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role) ? 'passing' : 'shooting';
    const res = new Set<keyof PlayerAttributes>([primary]);
    const pool = ATTR_LABELS.map(x => x[0]).filter(k => k !== primary && (p.role === 'GK' || k !== 'goalkeeping'));
    const seed = `${p.id}_${p.name}`;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let step = 0;
    while (res.size < count && pool.length > 0 && step < 20) {
      const idx = Math.abs((h >>> 0) + step * 37) % pool.length;
      res.add(pool.splice(idx, 1)[0]);
      step++;
    }
    return res;
  }

  public isOpen(): boolean {
    return this.player !== null;
  }

  public render(ctx: CanvasRenderingContext2D, hits: HitRegistry, clubCtx?: PlayerModalClubContext): void {
    if (!this.player) return;
    const p = this.player;
    const pa = p.pa ?? p.ca;
    const fogLv = p.scoutFogLevel ?? 0;

    ctx.fillStyle = 'rgba(7, 16, 12, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.add(0, 0, THEME.W, THEME.H, () => this.close());

    const mx = 270, my = 76, mw = 740, mh = 568;
    drawPrintCard(ctx, mx, my, mw, mh, {
      paper: true,
      radius: 12,
      shadowOffset: 6,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    hits.add(mx, my, mw, mh, () => {});

    drawPlayerAvatar(ctx, mx + 22, my + 16, 62, 74, p, undefined, { radius: 8 });

    const revealedSet = this.scoutFog ? this.getRevealedKeys(p, this.revealCount) : null;

    drawBadge(ctx, mx + 92, my + 22, 32, 24, this.scoutFog ? '?' : p.tier, this.scoutFog ? THEME.BG_PANEL : tierColor(p.tier), this.scoutFog ? THEME.GOLD_LIGHT : '#FFFFFF');
    drawBadge(ctx, mx + 130, my + 22, 46, 24, p.role, THEME.BG_PANEL, THEME.PAPER_CREAM);
    const nameStr = fitText(ctx, p.name, 165, FONT.HEADLINE, true, true);
    drawText(ctx, nameStr, mx + 186, my + 34, { token: 'HEADLINE', bold: true, color: THEME.PAPER_INK });
    if (this.scoutFog) {
      drawBadge(
        ctx,
        mx + 356,
        my + 22,
        164,
        24,
        fogLv === 1 ? `初探 Lv.1 · 显 ${revealedSet!.size}/10` : `球探盲盒 · 仅显 ${revealedSet!.size}/10`,
        '#1D4ED8',
        '#FFFFFF'
      );
    } else if (p.careerStats && p.careerStats.championships >= 1 && p.careerStats.seasons >= 2) {
      drawBadge(ctx, mx + 356, my + 22, 78, 24, '队史传奇', THEME.INK_LINE, THEME.GOLD_LIGHT);
    } else if (p.careerStats && p.careerStats.seasons >= 2) {
      drawBadge(ctx, mx + 356, my + 22, 78, 24, '功勋老臣', '#1D4ED8', '#FFFFFF');
    } else if (p.isNewSigning) {
      drawBadge(ctx, mx + 356, my + 22, 58, 24, '新援', '#166534', THEME.LIME);
    }

    const secText = p.secondaryRoles && p.secondaryRoles.length > 0 ? ` · 兼 ${p.secondaryRoles.join('/')}` : '';
    const mVal = p.marketValue ?? p.cost;
    const paSub = this.scoutFog
      ? fogLv === 1
        ? `${p.age}岁${secText} · 估测 CA ~${Math.round(p.ca / 5) * 5} · 潜力 PA ${Math.max(45, pa - 7)}~${Math.min(99, pa + 7)}`
        : `${p.age}岁${secText} · CA ??? · 潜力 PA ??? · 球探深度探查或签入后揭晓`
      : `${p.age}岁${secText} · CA ${p.ca} / PA ${pa} · 身价 ¥${mVal}万`;
    if (this.scoutFog) {
      drawWrappedText(ctx, paSub, mx + 92, my + 52, 360, 18, {
        size: 12.5,
        color: '#1D4ED8',
        maxLines: 2,
      });
    } else {
      const fittedSub = fitText(ctx, paSub, 365, 13, false, true);
      drawText(ctx, fittedSub, mx + 92, my + 60, { size: 13, color: THEME.PAPER_MUTED });
    }

    if (!this.scoutFog) {
      const ratio = Math.max(0.08, Math.min(1, p.ca / Math.max(1, pa)));
      const gap = Math.max(0, pa - p.ca);
      drawRoundRect(ctx, mx + 92, my + 77, 248, 8, 4, THEME.PAPER_WARM);
      drawRoundRect(ctx, mx + 92, my + 77, Math.round(248 * ratio), 8, 4, gap >= 8 ? '#2B6BE6' : gap > 0 ? '#16A34A' : THEME.GOLD);
      drawText(
        ctx,
        gap > 0 ? `可成长 +${gap} PA` : '潜力已兑现',
        mx + 348,
        my + 81,
        { size: 12, bold: true, color: gap >= 8 ? '#1D4ED8' : gap > 0 ? '#166534' : '#9A6B12' }
      );
    }
    drawButton(ctx, hits, mx + mw - 104, my + 18, 82, 34, '关闭', () => this.close(), { variant: 'ghost', icon: 'close', fontSize: 12.5 });

    const userClub = !this.scoutFog && clubCtx ? clubCtx.league.getUserClub() : null;
    const isOwnPlayer = !!userClub && userClub.squad.some(x => x.id === p.id);
    if (isOwnPlayer && clubCtx && userClub) {
      const captainId = clubCtx.league.getCaptainId(userClub);
      const isCap = p.id === captainId;
      drawButton(
        ctx,
        hits,
        mx + mw - 212,
        my + 18,
        100,
        34,
        isCap ? '现队长' : '设为队长',
        () => {
          if (isCap) return;
          const res = clubCtx.league.setCaptain(p.id);
          if (res.ok) clubCtx.onSave();
          clubCtx.onToast?.(res.msg ?? '', res.ok ? THEME.GOLD_LIGHT : THEME.RED_LIGHT);
        },
        { variant: isCap ? 'gold' : 'primary', disabled: isCap, icon: 'star', fontSize: 12 }
      );

      const curNum = p.shirtNumber ?? 10;
      drawText(ctx, '号码', mx + mw - 252, my + 73, { size: 12, color: THEME.PAPER_MUTED });
      drawButton(ctx, hits, mx + mw - 212, my + 58, 32, 28, '-', () => {
        const res = clubCtx.league.setPlayerShirtNumber(p.id, curNum <= 1 ? 99 : curNum - 1);
        if (res.ok) clubCtx.onSave();
        clubCtx.onToast?.(res.msg, THEME.GOLD_LIGHT);
      }, { variant: 'ghost', fontSize: 13 });
      drawButton(ctx, hits, mx + mw - 176, my + 58, 72, 28, `#${curNum} ▾`, () => {
        this.numberPickerOpen = !this.numberPickerOpen;
      }, { active: this.numberPickerOpen, fontSize: 12 });
      drawButton(ctx, hits, mx + mw - 100, my + 58, 32, 28, '+', () => {
        const res = clubCtx.league.setPlayerShirtNumber(p.id, curNum >= 99 ? 1 : curNum + 1);
        if (res.ok) clubCtx.onSave();
        clubCtx.onToast?.(res.msg, THEME.GOLD_LIGHT);
      }, { variant: 'ghost', fontSize: 13 });
    }

    drawText(
      ctx,
      this.scoutFog
        ? `球探局部侦察（仅展示 ${revealedSet!.size} 项小数据，其余签入后揭晓）`
        : '完整技术与身体属性（全部实装于 2D 引擎）',
      mx + 24,
      my + 106,
      { size: 14, bold: true, color: THEME.PAPER_INK }
    );

    ATTR_LABELS.forEach(([key, label], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const ax = mx + 24 + col * 356;
      const ay = my + 128 + row * 45;
      const isShown = !revealedSet || revealedSet.has(key);
      const val = p.attributes[key];
      const barColor =
        val >= 82 ? THEME.GOLD :
        val >= 70 ? '#16A34A' :
        val >= 55 ? THEME.BLUE : '#64748B';

      drawText(ctx, label, ax, ay + 8, { size: 14, bold: true, color: isShown ? THEME.PAPER_INK : THEME.PAPER_MUTED });
      drawText(ctx, isShown ? String(val) : '??', ax + 336, ay + 8, {
        size: 14,
        bold: true,
        color: isShown ? barColor : THEME.PAPER_MUTED,
        align: 'right',
        mono: true,
      });
      if (isShown) {
        drawStatBar(ctx, val, 99, ax, ay + 22, 336, 10, barColor, THEME.PAPER_WARM);
      } else {
        drawRoundRect(ctx, ax, ay + 22, 336, 10, 5, THEME.PAPER_WARM);
        drawRoundRect(ctx, ax, ay + 22, 96, 10, 5, '#CBD5E1');
      }
    });

    drawText(ctx, '实装特质与词条（★金标2x引擎加成 / ◆银标1x）', mx + 24, my + 370, {
      size: 14,
      bold: true,
      color: THEME.PAPER_INK,
    });
    const goldList = p.goldTraits ?? [];
    const silverList = p.silverTraits ?? [];
    const fallbackTraits = p.traits && p.traits.length > 0 ? p.traits : [];
    const combinedBadges: Array<{ name: string; isGold: boolean }> =
      goldList.length > 0 || silverList.length > 0
        ? [
            ...goldList.map(t => ({ name: t, isGold: true })),
            ...silverList.map(t => ({ name: t, isGold: false })),
          ]
        : fallbackTraits.map((t, i) => ({ name: t, isGold: i === 0 && p.tier === 'S' }));

    if (combinedBadges.length === 0) {
      drawText(ctx, p.trait || '常规均衡型球员', mx + 24, my + 402, { size: 13, color: THEME.PAPER_MUTED });
    } else {
      const shown = combinedBadges.slice(0, 4);
      const count = shown.length;
      const gap = 10;
      const cardW = Math.floor((mw - 48 - gap * (count - 1)) / count);
      shown.forEach((item, ti) => {
        const tx = mx + 24 + ti * (cardW + gap);
        drawPrintCard(ctx, tx, my + 382, cardW, 82, {
          paper: false,
          radius: 8,
          shadowOffset: 3,
          strokeColor: item.isGold ? THEME.GOLD_LIGHT : THEME.INK_LINE,
          lineWidth: item.isGold ? 2 : 1.5,
        });
        drawBadge(
          ctx,
          tx + 10,
          my + 390,
          58,
          18,
          item.isGold ? '★ 金标' : '◆ 银标',
          item.isGold ? '#78350F' : THEME.BG_DEEP,
          item.isGold ? THEME.GOLD_HOT : THEME.TX2
        );
        const nameFitted = fitText(ctx, item.name, cardW - 80, 13, true, true);
        drawText(ctx, nameFitted, tx + 72, my + 399, {
          size: 13,
          bold: true,
          color: item.isGold ? THEME.GOLD_HOT : THEME.PAPER_CREAM,
        });
        drawWrappedText(ctx, TRAIT_DESCRIPTIONS[item.name] || '比赛决策与执行加成', tx + 10, my + 418, cardW - 20, 18, {
          size: 12,
          color: THEME.TX2,
          maxLines: 2,
        });
      });
    }
    if (p.hiddenTrait) {
      drawText(ctx, '隐藏特质：待比赛特定条件触发觉醒', mx + 372, my + 370, {
        size: 12.5,
        bold: true,
        color: '#1D4ED8',
      });
    }

    drawPrintCard(ctx, mx + 24, my + 472, mw - 48, 76, {
      paper: false,
      radius: 8,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 1.5,
    });
    const banTxt = (p.suspendedRounds ?? 0) > 0 ? `  |  停赛 ${p.suspendedRounds} 轮` : '';
    const hasCareer = !!p.careerStats && p.careerStats.seasons > 0;
    drawText(
      ctx,
      `本赛季：出场 ${p.seasonStats.appearances}  |  进球 ${p.seasonStats.goals}  |  助攻 ${p.seasonStats.assists}  |  零封 ${p.seasonStats.cleanSheets}  |  黄牌 ${p.seasonStats.yellowCards}${banTxt}`,
      mx + mw / 2,
      my + (hasCareer ? 494 : 510),
      { size: 14, bold: true, align: 'center', color: (p.suspendedRounds ?? 0) > 0 ? THEME.RED_LIGHT : THEME.PAPER_CREAM }
    );
    if (hasCareer) {
      const cs = p.careerStats!;
      drawText(
        ctx,
        `生涯累计 (${cs.seasons} 季)：出场 ${cs.appearances}  |  进球 ${cs.goals}  |  助攻 ${cs.assists}  |  零封 ${cs.cleanSheets}  |  冠军 ×${cs.championships}`,
        mx + mw / 2,
        my + 524,
        { size: 12.5, bold: true, align: 'center', color: THEME.GOLD_LIGHT }
      );
    }

    // 5×4 球衣号码选择器（每页 20 个，44×44 热区）
    if (this.numberPickerOpen && isOwnPlayer && clubCtx && userClub) {
      const npx = mx + mw - 332;
      const npy = my + 92;
      const npw = 316;
      const nph = 328;
      drawPrintCard(ctx, npx, npy, npw, nph, {
        paper: false,
        radius: 10,
        shadowOffset: 6,
        strokeColor: THEME.GOLD_LIGHT,
        lineWidth: 1.8,
      });
      hits.add(npx, npy, npw, nph, () => {});
      drawText(ctx, '选择号码 (1-99)', npx + 16, npy + 22, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
      drawButton(ctx, hits, npx + npw - 66, npy + 8, 52, 28, '收起', () => {
        this.numberPickerOpen = false;
      }, { variant: 'ghost', fontSize: 12 });

      const takenSet = new Set(userClub.squad.filter(x => x.id !== p.id && x.shirtNumber).map(x => x.shirtNumber!));
      const totalNumPages = 5;
      if (this.numberPage >= totalNumPages) this.numberPage = totalNumPages - 1;
      const startNum = this.numberPage * 20 + 1;
      for (let i = 0; i < 20; i++) {
        const num = startNum + i;
        if (num > 99) break;
        const col = i % 5;
        const row = Math.floor(i / 5);
        const bx = npx + 18 + col * 58;
        const by = npy + 46 + row * 54;
        const isCur = p.shirtNumber === num;
        const isTaken = takenSet.has(num);
        drawRoundRect(
          ctx,
          bx,
          by,
          48,
          46,
          6,
          isCur ? '#78350F' : isTaken ? THEME.BG_DEEP : THEME.BG_PANEL,
          isCur ? THEME.GOLD_LIGHT : isTaken ? THEME.BORDER : THEME.BORDER_GOLD,
          isCur ? 1.8 : 1.2
        );
        drawText(ctx, String(num), bx + 24, by + 23, {
          size: 15,
          bold: isCur,
          color: isCur ? THEME.GOLD_HOT : isTaken ? THEME.TX3 : THEME.PAPER_CREAM,
          align: 'center',
          mono: true,
        });
        hits.addTouchTarget(bx, by, 48, 46, () => {
          const res = clubCtx.league.setPlayerShirtNumber(p.id, num);
          if (res.ok) clubCtx.onSave();
          clubCtx.onToast?.(res.msg, THEME.GOLD_LIGHT);
          this.numberPickerOpen = false;
        });
      }

      const endNum = Math.min(99, startNum + 19);
      drawButton(ctx, hits, npx + 18, npy + 272, 76, 38, '◀ 上页', () => {
        this.numberPage = Math.max(0, this.numberPage - 1);
      }, { disabled: this.numberPage === 0, fontSize: 12 });
      drawText(ctx, `${startNum}-${endNum}`, npx + npw / 2, npy + 291, {
        size: 13,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
        mono: true,
      });
      drawButton(ctx, hits, npx + npw - 94, npy + 272, 76, 38, '下页 ▶', () => {
        this.numberPage = Math.min(totalNumPages - 1, this.numberPage + 1);
      }, { disabled: this.numberPage >= totalNumPages - 1, fontSize: 12 });
    }
  }
}
