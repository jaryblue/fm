/**
 * 通用球员完整属性详情弹窗（10维能力条 + 实装词条效果 + 赛季数据）
 */

import { PlayerAttributes } from '../../engine/src/types';
import { LeagueManager } from '../../core/src/LeagueManager';
import { TRAIT_DESCRIPTIONS } from '../../core/src/PlayerPool';
import { DraftPlayer } from '../../core/src/types';
import { drawPlayerAvatar } from './AvatarRenderer';
import {
  drawBadge,
  drawButton,
  drawRoundRect,
  drawText,
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

    // 半透明遮罩
    ctx.fillStyle = 'rgba(4, 7, 13, 0.78)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    // 拦截底层点击
    hits.add(0, 0, THEME.W, THEME.H, () => this.close());

    const mx = 270, my = 80, mw = 740, mh = 560;
    drawRoundRect(ctx, mx, my, mw, mh, 12, THEME.BG_PANEL, THEME.BORDER_GOLD, 1.5);
    // 弹窗内部点击不关闭
    hits.add(mx, my, mw, mh, () => {});

    // 头部 + 球员分层拼接/程序化矢量头像
    drawPlayerAvatar(ctx, mx + 22, my + 16, 62, 74, p, undefined, { radius: 8 });

    const revealedSet = this.scoutFog ? this.getRevealedKeys(p, this.revealCount) : null;

    drawBadge(ctx, mx + 92, my + 24, 30, 22, this.scoutFog ? '?' : p.tier, this.scoutFog ? '#334155' : tierColor(p.tier), this.scoutFog ? THEME.GOLD_LIGHT : undefined);
    drawBadge(ctx, mx + 130, my + 24, 44, 22, p.role, '#1E293B', THEME.TX1);
    drawText(ctx, p.name, mx + 186, my + 35, { size: 22, bold: true });
    if (this.scoutFog) {
      drawBadge(
        ctx,
        mx + 360,
        my + 24,
        164,
        22,
        fogLv === 1 ? `初探 Lv.1 · 显 ${revealedSet!.size}/10 项` : `球探盲盒 · 仅显 ${revealedSet!.size}/10 项`,
        '#1E3A5F',
        '#38BDF8'
      );
    } else if (p.careerStats && p.careerStats.championships >= 1 && p.careerStats.seasons >= 2) {
      drawBadge(ctx, mx + 360, my + 24, 72, 22, '队史传奇', '#78350F', THEME.GOLD_LIGHT);
    } else if (p.careerStats && p.careerStats.seasons >= 2) {
      drawBadge(ctx, mx + 360, my + 24, 72, 22, '功勋老臣', '#1E3A5F', '#7DD3FC');
    } else if (p.isNewSigning) {
      drawBadge(ctx, mx + 360, my + 24, 54, 22, '新援', '#14532D', THEME.GREEN);
    }
    const secText = p.secondaryRoles && p.secondaryRoles.length > 0 ? ` · 兼 ${p.secondaryRoles.join('/')}` : '';
    const mVal = p.marketValue ?? p.cost;
    const paSub = this.scoutFog
      ? fogLv === 1
        ? `${p.age}岁${secText} · 估测 CA ~${Math.round(p.ca / 5) * 5} · 潜力 PA ${Math.max(45, pa - 7)}~${Math.min(99, pa + 7)}`
        : `${p.age}岁${secText} · CA ??? · 潜力 PA ??? · 球探深度探查或签入后揭晓`
      : `${p.age}岁${secText} · CA ${p.ca} / PA ${pa} · 身价 ¥${mVal}万`;
    drawText(ctx, paSub, mx + 92, my + 60, { size: 12.5, color: this.scoutFog ? '#38BDF8' : THEME.TX2 });

    if (!this.scoutFog) {
      const ratio = Math.max(0.08, Math.min(1, p.ca / Math.max(1, pa)));
      const gap = Math.max(0, pa - p.ca);
      drawRoundRect(ctx, mx + 92, my + 76, 260, 7, 3, '#1E293B');
      drawRoundRect(ctx, mx + 92, my + 76, Math.round(260 * ratio), 7, 3, gap >= 8 ? '#38BDF8' : gap > 0 ? THEME.GREEN : THEME.GOLD_LIGHT);
      drawText(
        ctx,
        gap > 0 ? `可成长空间 +${gap} PA` : '潜力已兑现',
        mx + 362,
        my + 79,
        { size: 10.5, bold: true, color: gap >= 8 ? '#7DD3FC' : gap > 0 ? THEME.GREEN : THEME.GOLD_LIGHT }
      );
    }
    drawButton(ctx, hits, mx + mw - 104, my + 22, 80, 32, '关闭', () => this.close(), { variant: 'ghost', icon: 'close' });

    const userClub = !this.scoutFog && clubCtx ? clubCtx.league.getUserClub() : null;
    const isOwnPlayer = !!userClub && userClub.squad.some(x => x.id === p.id);
    if (isOwnPlayer && clubCtx && userClub) {
      const captainId = clubCtx.league.getCaptainId(userClub);
      const isCap = p.id === captainId;
      drawButton(
        ctx,
        hits,
        mx + mw - 210,
        my + 22,
        98,
        32,
        isCap ? '现队长' : '设为队长',
        () => {
          if (isCap) return;
          const res = clubCtx.league.setCaptain(p.id);
          if (res.ok) clubCtx.onSave();
          clubCtx.onToast?.(res.msg ?? '', res.ok ? THEME.GOLD_LIGHT : THEME.RED_LIGHT);
        },
        { variant: isCap ? 'gold' : 'primary', disabled: isCap, icon: 'star', fontSize: 11.5 }
      );

      const curNum = p.shirtNumber ?? 10;
      drawText(ctx, '球衣号码', mx + mw - 270, my + 73, { size: 11, color: THEME.TX2 });
      drawButton(ctx, hits, mx + mw - 210, my + 60, 28, 26, '-', () => {
        const res = clubCtx.league.setPlayerShirtNumber(p.id, curNum <= 1 ? 99 : curNum - 1);
        if (res.ok) clubCtx.onSave();
        clubCtx.onToast?.(res.msg, THEME.GOLD_LIGHT);
      }, { variant: 'ghost', fontSize: 13 });
      drawButton(ctx, hits, mx + mw - 178, my + 60, 74, 26, `#${curNum} ▾`, () => {
        this.numberPickerOpen = !this.numberPickerOpen;
      }, { active: this.numberPickerOpen, fontSize: 11.5 });
      drawButton(ctx, hits, mx + mw - 100, my + 60, 28, 26, '+', () => {
        const res = clubCtx.league.setPlayerShirtNumber(p.id, curNum >= 99 ? 1 : curNum + 1);
        if (res.ok) clubCtx.onSave();
        clubCtx.onToast?.(res.msg, THEME.GOLD_LIGHT);
      }, { variant: 'ghost', fontSize: 13 });
    }

    // 10 维属性面板 (2列 × 5行；球探盲盒模式仅展示局部已侦察项)
    drawText(
      ctx,
      this.scoutFog
        ? `球探局部侦察（仅展示 ${revealedSet!.size} 项小数据，其余签入后揭晓）`
        : '完整技术与身体属性（全部实装于 2D 引擎）',
      mx + 24,
      my + 104,
      { size: 13, bold: true, color: THEME.GOLD_LIGHT }
    );

    ATTR_LABELS.forEach(([key, label], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const ax = mx + 24 + col * 356;
      const ay = my + 128 + row * 44;
      const isShown = !revealedSet || revealedSet.has(key);
      const val = p.attributes[key];
      const barColor =
        val >= 82 ? THEME.GOLD :
        val >= 70 ? THEME.GREEN :
        val >= 55 ? THEME.BLUE_LIGHT : '#64748B';

      drawText(ctx, label, ax, ay + 8, { size: 12, color: isShown ? THEME.TX1 : THEME.TX3 });
      drawText(ctx, isShown ? String(val) : '??', ax + 336, ay + 8, {
        size: 13,
        bold: true,
        color: isShown ? barColor : '#475569',
        align: 'right',
        mono: true,
      });
      drawRoundRect(ctx, ax, ay + 20, 336, 7, 3, '#1E293B');
      if (isShown) {
        drawRoundRect(ctx, ax, ay + 20, Math.max(8, (val / 99) * 336), 7, 3, barColor);
      } else {
        drawRoundRect(ctx, ax, ay + 20, 96, 7, 3, '#334155');
      }
    });

    // 实装词条效果说明（FC26 金标/银标多特质系统）
    drawText(ctx, '实装特质与词条（★金标2x引擎加成 / ◆银标1x）', mx + 24, my + 366, {
      size: 13,
      bold: true,
      color: THEME.GOLD_LIGHT,
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
      drawText(ctx, p.trait || '常规均衡型球员', mx + 24, my + 398, { size: 12, color: THEME.TX2 });
    } else {
      const shown = combinedBadges.slice(0, 4);
      const count = shown.length;
      const gap = 10;
      const cardW = Math.floor((mw - 48 - gap * (count - 1)) / count);
      shown.forEach((item, ti) => {
        const tx = mx + 24 + ti * (cardW + gap);
        const borderCol = item.isGold ? '#FACC15' : '#94A3B8';
        const bgCol = item.isGold ? 'rgba(120, 53, 15, 0.35)' : THEME.BG_CARD;
        drawRoundRect(ctx, tx, my + 384, cardW, 64, 8, bgCol, borderCol, item.isGold ? 1.5 : 1);
        drawBadge(
          ctx,
          tx + 10,
          my + 392,
          44,
          16,
          item.isGold ? '★ 金标' : '◆ 银标',
          item.isGold ? '#78350F' : '#1E293B',
          item.isGold ? '#FACC15' : '#CBD5E1'
        );
        drawText(ctx, item.name, tx + 60, my + 400, {
          size: 12,
          bold: true,
          color: item.isGold ? '#FDE047' : '#E2E8F0',
        });
        const maxDesc = count >= 4 ? 12 : count === 3 ? 16 : 26;
        drawText(ctx, (TRAIT_DESCRIPTIONS[item.name] || '比赛决策与执行加成').slice(0, maxDesc), tx + 10, my + 429, {
          size: 10.5,
          color: THEME.TX2,
        });
      });
    }
    if (p.hiddenTrait) {
      drawText(ctx, '隐藏特质：待比赛特定条件触发觉醒', mx + 360, my + 366, {
        size: 12,
        color: '#38BDF8',
      });
    }

    // 赛季个人数据 + 跨赛季生涯累计履历
    drawRoundRect(ctx, mx + 24, my + 464, mw - 48, 74, 8, THEME.BG_CARD, THEME.BORDER);
    const banTxt = (p.suspendedRounds ?? 0) > 0 ? `  |  停赛 ${p.suspendedRounds} 轮` : '';
    const hasCareer = !!p.careerStats && p.careerStats.seasons > 0;
    drawText(
      ctx,
      `本赛季：出场 ${p.seasonStats.appearances}  |  进球 ${p.seasonStats.goals}  |  助攻 ${p.seasonStats.assists}  |  零封 ${p.seasonStats.cleanSheets}  |  黄牌 ${p.seasonStats.yellowCards}${banTxt}`,
      mx + mw / 2,
      my + (hasCareer ? 486 : 501),
      { size: 13, bold: true, align: 'center', color: (p.suspendedRounds ?? 0) > 0 ? THEME.RED_LIGHT : THEME.TX1 }
    );
    if (hasCareer) {
      const cs = p.careerStats!;
      drawText(
        ctx,
        `生涯累计 (${cs.seasons} 季)：出场 ${cs.appearances}  |  进球 ${cs.goals}  |  助攻 ${cs.assists}  |  零封 ${cs.cleanSheets}  |  冠军 ×${cs.championships}`,
        mx + mw / 2,
        my + 516,
        { size: 12, bold: true, align: 'center', color: THEME.GOLD_LIGHT }
      );
    }

    if (this.numberPickerOpen && isOwnPlayer && clubCtx && userClub) {
      const npx = mx + mw - 388;
      const npy = my + 92;
      const npw = 364;
      const nph = 166;
      drawRoundRect(ctx, npx, npy, npw, nph, 10, 'rgba(9, 15, 28, 0.98)', THEME.GOLD_LIGHT, 1.4);
      hits.add(npx, npy, npw, nph, () => {});
      drawText(ctx, '选择球衣号码 (1-99 · 已有号码将自动互换)', npx + 12, npy + 16, { size: 11, bold: true, color: THEME.GOLD_LIGHT });
      drawButton(ctx, hits, npx + npw - 52, npy + 6, 42, 22, '收起', () => {
        this.numberPickerOpen = false;
      }, { variant: 'ghost', fontSize: 10 });

      const takenSet = new Set(userClub.squad.filter(x => x.id !== p.id && x.shirtNumber).map(x => x.shirtNumber!));
      const startNum = this.numberPage * 33 + 1;
      for (let i = 0; i < 33; i++) {
        const num = startNum + i;
        if (num > 99) break;
        const col = i % 11;
        const row = Math.floor(i / 11);
        const bx = npx + 12 + col * 31;
        const by = npy + 34 + row * 30;
        const isCur = p.shirtNumber === num;
        const isTaken = takenSet.has(num);
        drawRoundRect(
          ctx,
          bx,
          by,
          28,
          25,
          5,
          isCur ? '#78350F' : isTaken ? '#0F172A' : '#1E293B',
          isCur ? THEME.GOLD_LIGHT : isTaken ? '#334155' : '#475569',
          isCur ? 1.5 : 1
        );
        drawText(ctx, String(num), bx + 14, by + 13, {
          size: 11,
          bold: isCur,
          color: isCur ? '#FEF08A' : isTaken ? '#64748B' : THEME.TX1,
          align: 'center',
          mono: true,
        });
        hits.add(bx, by, 28, 25, () => {
          const res = clubCtx.league.setPlayerShirtNumber(p.id, num);
          if (res.ok) clubCtx.onSave();
          clubCtx.onToast?.(res.msg, THEME.GOLD_LIGHT);
          this.numberPickerOpen = false;
        });
      }

      const pageRanges = ['1-33', '34-66', '67-99'];
      pageRanges.forEach((lbl, pg) => {
        drawButton(ctx, hits, npx + 12 + pg * 66, npy + 132, 60, 24, lbl, () => {
          this.numberPage = pg;
        }, { active: this.numberPage === pg, fontSize: 10.5 });
      });
    }
  }
}
