/**
 * 页面 1：FM27 Shuffle Draft 选秀界面（触屏点击预览 + 球星剪影立绘 + 粒子爆发 + 零 Emoji）
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import { DRAFT_SETS_TOTAL } from '../../../core/src/ShuffleDraft';
import { DraftPlayer } from '../../../core/src/types';
import { AssetLoader } from '../AssetLoader';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawFoilShimmer,
  drawRoundRect,
  drawText,
  HitRegistry,
  tierColor,
} from '../CanvasKit';
import { drawPlayerAvatar } from '../AvatarRenderer';
import { drawPlayerSilhouette } from '../ClubVisuals';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

type PosFilter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT';
type SortBy = 'ca' | 'cost' | 'pace';

export class DraftScreen {
  private message = '悬停星卡实时对比队内同线均分，点击卡片或「+ 签入」直接入队（右栏可随时点“退”调整）';
  private posFilter: PosFilter = 'ALL';
  private sortBy: SortBy = 'ca';
  private lastPickedId: string | null = null;
  private flyAnims: Array<{
    sx: number;
    sy: number;
    ex: number;
    ey: number;
    name: string;
    color: string;
    startMs: number;
    durMs: number;
  }> = [];

  private matchFilter(p: DraftPlayer): boolean {
    if (this.posFilter === 'ALL') return true;
    if (this.posFilter === 'GK') return p.role === 'GK';
    if (this.posFilter === 'DEF') return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role);
    if (this.posFilter === 'MID') return ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role);
    return ['LW', 'RW', 'ST'].includes(p.role);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onDone: () => void;
      onSave: () => void;
      onInspectPlayer: (p: DraftPlayer) => void;
      onRequestAutoComplete?: () => void;
      onBurst?: (x: number, y: number, color?: string) => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const draft = st.draft;
    const refreshes = draft.refreshesRemaining ?? 0;

    const isFull = club.squad.length >= draft.targetSquadSize;

    drawBroadcastHeader(ctx, hits, {
      kicker: `SHUFFLE DRAFT · SET ${draft.currentSetIndex + 1}/${DRAFT_SETS_TOTAL}`,
      title: `${club.name} · 选秀建队`,
      club,
      badge: `已选 ${club.squad.length}/${draft.targetSquadSize}`,
      showSoundToggle: true,
      rightAction: isFull
        ? {
            label: '确认名单并开赛 ▶',
            icon: 'play',
            variant: 'green',
            onClick: () => {
              const res = league.confirmInitialDraft();
              if (res.ok) {
                actions.onSave();
                actions.onDone();
              } else {
                this.message = res.reason || '无法开启赛季';
              }
            },
          }
        : {
            label: '智能补齐阵容',
            icon: 'sparkle',
            variant: 'gold',
            onClick: () => {
              if (actions.onRequestAutoComplete) {
                actions.onRequestAutoComplete();
              } else {
                league.autoCompleteDraft();
                this.message = '阵容已补齐 26 人，可在右侧点“退”微调或确认开赛';
                actions.onSave();
              }
            },
          },
    });

    drawText(ctx, `剩余预算 ${draft.budgetRemaining}`, 520, 24, {
      size: 13,
      bold: true,
      color: THEME.GREEN,
      mono: true,
    });
    const pct = Math.min(1, club.squad.length / Math.max(1, draft.targetSquadSize));
    drawRoundRect(ctx, 520, 42, 140, 6, 3, '#1E293B');
    if (pct > 0) drawRoundRect(ctx, 520, 42, Math.max(8, Math.round(140 * pct)), 6, 3, THEME.GOLD);

    drawButton(
      ctx,
      hits,
      676,
      16,
      128,
      36,
      `刷新池 (${refreshes})`,
      () => {
        const res = league.refreshDraftPool();
        if (res.ok) {
          this.message = '球探已刷新本组 20 人候选池';
          actions.onSave();
        } else {
          this.message = res.reason || '刷新失败';
        }
      },
      { variant: 'primary', disabled: refreshes <= 0, fontSize: 12, icon: 'refresh' }
    );

    // 左侧候选星卡池
    drawChamferPanel(ctx, 16, 80, 888, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    drawText(ctx, '候选星卡池', 34, 104, { size: 14, bold: true, color: THEME.TX1 });

    const filters: Array<[PosFilter, string]> = [
      ['ALL', '全部'],
      ['GK', '门将'],
      ['DEF', '后卫'],
      ['MID', '中场'],
      ['ATT', '前锋'],
    ];
    filters.forEach(([key, label], i) => {
      drawButton(ctx, hits, 122 + i * 62, 90, 56, 28, label, () => {
        this.posFilter = key;
      }, { active: this.posFilter === key, fontSize: 11 });
    });

    const sorts: Array<[SortBy, string]> = [
      ['ca', '按综合'],
      ['pace', '按速度'],
      ['cost', '按身价'],
    ];
    sorts.forEach(([key, label], i) => {
      drawButton(ctx, hits, 690 + i * 68, 90, 62, 28, label, () => {
        this.sortBy = key;
      }, { active: this.sortBy === key, fontSize: 11 });
    });

    drawText(ctx, this.message, 34, 130, { size: 11, color: THEME.GOLD_LIGHT });

    const filteredPool = draft.currentPool
      .filter(p => this.matchFilter(p))
      .sort((a, b) => {
        if (this.sortBy === 'pace') return b.attributes.pace - a.attributes.pace;
        if (this.sortBy === 'cost') return a.cost - b.cost;
        return b.ca - a.ca;
      });

    const cols = 4;
    const cardW = 204;
    const cardH = 96;
    const gap = 10;
    const startX = 32;
    const startY = 148;
    const remainingAfter = draft.targetSquadSize - club.squad.length - 1;
    let previewPlayer: DraftPlayer | null = null;
    const roleGroup = (r: string) =>
      r === 'GK' ? 'GK' :
      ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r) ? 'DEF' :
      ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(r) ? 'MID' : 'ATT';

    const isSquadFull = club.squad.length >= draft.targetSquadSize;

    const signPlayer = (p: DraftPlayer, bx: number, by: number) => {
      const targetIdx = club.squad.length;
      const res = league.pickDraftPlayer(p.id);
      if (!res.ok) {
        this.message = res.reason || '无法选择该球员';
        SoundEngine.playWarning();
      } else {
        this.lastPickedId = p.id;
        this.message = club.squad.length >= draft.targetSquadSize
          ? `已签下 ${p.name}，26人名单已满，可退选微调或点击确认开赛`
          : `已签下 ${p.name} (${p.role} · 评定 ${p.ca})`;
        const tColIdx = Math.floor(targetIdx / 13);
        const tRowIdx = targetIdx % 13;
        const ex = 928 + tColIdx * 164 + 79;
        const ey = 124 + tRowIdx * 41 + 18;
        this.flyAnims.push({
          sx: bx,
          sy: by,
          ex,
          ey,
          name: p.name.slice(0, 4),
          color: tierColor(p.tier),
          startMs: performance.now(),
          durMs: 420,
        });
        SoundEngine.playSub();
        actions.onBurst?.(bx, by, tierColor(p.tier));
        actions.onSave();
      }
    };

    filteredPool.slice(0, 20).forEach((p, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = startX + col * (cardW + gap);
      const cy = startY + row * (cardH + gap);

      const affordable = !isSquadFull && draft.budgetRemaining - p.cost >= remainingAfter * 30;
      const hovered = hits.isHovered(cx, cy, cardW, cardH);
      if (hovered) {
        previewPlayer = p;
      }

      const tCol = tierColor(p.tier);
      const baseBg = !affordable
        ? 'rgba(14, 21, 37, 0.85)'
        : hovered
        ? '#1E2D4D'
        : p.tier === 'S'
        ? 'rgba(212,168,67,0.1)'
        : THEME.BG_CARD;

      const frameId = p.tier === 'S' ? 'card_frame_s' : p.tier === 'A' ? 'card_frame_a' : null;
      const frameImg = frameId && affordable ? AssetLoader.get(frameId) : null;
      if (frameImg && typeof ctx.drawImage === 'function' && !hovered) {
        ctx.drawImage(frameImg, cx, cy, cardW, cardH);
      } else {
        drawChamferPanel(
          ctx,
          cx,
          cy,
          cardW,
          cardH,
          7,
          baseBg,
          hovered && affordable ? THEME.GOLD_LIGHT : p.tier === 'S' && affordable ? 'rgba(212,168,67,0.55)' : THEME.BORDER,
          hovered && affordable ? 1.8 : 1,
          affordable ? tCol : '#334155'
        );
      }

      if (affordable && (p.tier === 'S' || p.tier === 'A')) {
        drawFoilShimmer(
          ctx,
          cx,
          cy,
          cardW,
          cardH,
          performance.now() / 1000 + idx * 0.17,
          p.tier === 'S' ? 'rgba(250, 204, 21, 0.24)' : 'rgba(168, 85, 247, 0.20)'
        );
      }

      // 卡面位置立绘水印（优先使用已落盘的 role_gk/def/mid/att 立绘，未加载时回退矢量剪影）
      const roleAssetId =
        p.role === 'GK' ? 'role_gk' :
        ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role) ? 'role_def' :
        ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role) ? 'role_mid' : 'role_att';
      const roleImg = AssetLoader.get(roleAssetId);
      if (roleImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx + cardW - 68, cy + 8, 60, cardH - 16);
        ctx.clip();
        ctx.globalAlpha = !affordable ? 0.16 : hovered ? 0.48 : 0.34;
        ctx.drawImage(roleImg, cx + cardW - 68, cy + 4, 60, 80);
        ctx.restore();
      } else {
        drawPlayerSilhouette(ctx, cx + cardW - 32, cy + 56, 44, p.role, hovered ? 'rgba(250,204,21,0.18)' : 'rgba(241,245,249,0.09)');
      }

      if (p.tier === 'S' || p.tier === 'A') {
        drawRoundRect(ctx, cx + 9, cy + 9, 24, 20, 4, 'rgba(255,255,255,0.18)', p.tier === 'S' ? '#FEF08A' : '#E9D5FF', 1.2);
      }
      drawBadge(ctx, cx + 10, cy + 10, 22, 18, p.tier, tCol, p.tier === 'S' ? '#090D16' : '#FFFFFF');
      drawBadge(ctx, cx + 36, cy + 10, 36, 18, p.role, '#1E293B', THEME.TX2);
      const secText = p.secondaryRoles && p.secondaryRoles.length > 0 ? `+${p.secondaryRoles[0]}` : '';
      drawText(ctx, `${p.age}岁${secText ? ' ' + secText : ''}`, cx + 76, cy + 19, {
        size: 10,
        color: secText ? '#38BDF8' : THEME.TX3,
      });
      drawText(ctx, `${p.ca}`, cx + cardW - 44, cy + 19, {
        size: 15,
        bold: true,
        italic: true,
        color: p.ca >= 82 ? THEME.GOLD_LIGHT : THEME.TX1,
        align: 'right',
        mono: true,
      });

      drawButton(ctx, hits, cx + cardW - 36, cy + 9, 26, 20, '详', () => {
        actions.onInspectPlayer(p);
      }, { fontSize: 10 });

      drawText(ctx, p.name, cx + 10, cy + 41, {
        size: 14,
        bold: true,
        color: affordable ? THEME.TX1 : THEME.TX3,
      });

      const keyStat =
        p.role === 'GK'
          ? `扑${p.attributes.goalkeeping} 站${p.attributes.positioning} 传${p.attributes.passing}`
          : `速${p.attributes.pace} 射${p.attributes.shooting} 传${p.attributes.passing} 防${p.attributes.defending}`;
      drawText(ctx, keyStat, cx + 10, cy + 62, { size: 11, color: affordable ? THEME.TX2 : THEME.TX3 });

      const traitLabel = (p.traits && p.traits.length > 0) ? p.traits.slice(0, 2).join('·') : '均衡型';
      drawText(ctx, traitLabel, cx + 10, cy + 82, { size: 10.5, color: '#60A5FA' });

      if (affordable) {
        // 就地一键签入胶囊，无需再跑到屏幕最底端确认
        drawButton(ctx, hits, cx + cardW - 76, cy + 71, 68, 20, `+ 签入 ¥${p.cost}`, () => {
          signPlayer(p, cx + cardW / 2, cy + cardH / 2);
        }, { variant: hovered ? 'green' : 'ghost', fontSize: 9.5 });
        hits.add(cx, cy + 28, cardW - 76, cardH - 28, () => {
          signPlayer(p, cx + cardW / 2, cy + cardH / 2);
        });
      } else {
        drawText(ctx, isSquadFull ? '名单已满' : '预算不足', cx + cardW - 10, cy + 82, {
          size: 10,
          bold: true,
          color: THEME.RED_LIGHT,
          align: 'right',
        });
      }
    });

    // 底部悬停同线战力实时对比条（纯信息展示，不再要求去底部确认）
    if (previewPlayer) {
      const pp = previewPlayer as DraftPlayer;
      const sameLine = club.squad.filter(s => roleGroup(s.role) === roleGroup(pp.role));
      let compareTxt = '';
      if (sameLine.length === 0) {
        compareTxt = `${pp.name} (${pp.role} CA ${pp.ca})：队内暂无同线球员，点击卡片即可直接签入填补空缺`;
      } else {
        const avgLineCa = Math.round(sameLine.reduce((a, b) => a + b.ca, 0) / sameLine.length);
        const diff = pp.ca - avgLineCa;
        compareTxt = `${pp.name} (CA ${pp.ca}) vs 队内同线均分 ${avgLineCa}：${diff >= 0 ? `+${diff} 强于均分` : `${diff} 低于均分`} · 点击卡片直接签入`;
      }
      drawRoundRect(ctx, 32, 672, 856, 26, 6, 'rgba(20, 38, 70, 0.92)', THEME.BORDER);
      drawIcon(ctx, 'chart', 46, 685, 12, '#7DD3FC');
      drawText(ctx, compareTxt, 60, 685, { size: 11, bold: true, color: '#7DD3FC' });
    }

    // 右侧已选阵容栏
    drawChamferPanel(ctx, 918, 80, 346, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    drawText(ctx, `已选名单 (${club.squad.length}/${draft.targetSquadSize})`, 936, 104, {
      size: 14,
      bold: true,
      color: THEME.TX1,
    });

    const gkCount = club.squad.filter(p => p.role === 'GK').length;
    const defCount = club.squad.filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)).length;
    const midCount = club.squad.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role)).length;
    const attCount = club.squad.filter(p => ['LW', 'RW', 'ST'].includes(p.role)).length;
    drawText(ctx, `门${gkCount}/3  后${defCount}/8  中${midCount}/8  锋${attCount}/7`, 1246, 104, {
      size: 11,
      color: gkCount === 0 ? '#FBBF24' : THEME.GREEN,
      align: 'right',
    });

    for (let i = 0; i < club.squad.length; i++) {
      const sp = club.squad[i];
      const col = Math.floor(i / 13);
      const row = i % 13;
      const rx = 928 + col * 164;
      const ry = 124 + row * 41;
      const isNew = sp.id === this.lastPickedId;
      const grp = roleGroup(sp.role);
      const lineDot = grp === 'GK' ? '#F97316' : grp === 'DEF' ? THEME.GREEN : grp === 'MID' ? '#38BDF8' : THEME.RED_LIGHT;
      drawRoundRect(
        ctx,
        rx,
        ry,
        158,
        36,
        5,
        isNew ? 'rgba(212,168,67,0.16)' : THEME.BG_CARD,
        isNew ? THEME.GOLD : undefined,
        isNew ? 1 : 0
      );
      drawRoundRect(ctx, rx, ry + 5, 3, 26, 1, lineDot);
      drawBadge(ctx, rx + 6, ry + 4, 30, 14, sp.role, '#1E293B', THEME.TX2);
      drawText(ctx, `${sp.ca}`, rx + 96, ry + 11, {
        size: 11,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'right',
        mono: true,
      });
      drawText(ctx, sp.name.slice(0, 4), rx + 7, ry + 27, { size: 11, bold: true, color: isNew ? THEME.GOLD_LIGHT : THEME.TX1 });
      drawButton(ctx, hits, rx + 102, ry + 7, 23, 22, '退', () => {
        const res = league.releaseDraftPlayer(sp.id);
        if (res.ok) {
          this.message = `已退选 ${sp.name}，返还预算 ¥${res.refunded ?? 0}，可重新挑选`;
          SoundEngine.playSub();
          actions.onSave();
        } else {
          this.message = res.reason || '无法退选';
          SoundEngine.playWarning();
        }
      }, { variant: 'ghost', fontSize: 10 });
      drawButton(ctx, hits, rx + 128, ry + 7, 24, 22, '详', () => {
        actions.onInspectPlayer(sp);
      }, { fontSize: 10 });
    }

    if (club.squad.length >= draft.targetSquadSize) {
      drawButton(ctx, hits, 932, 662, 318, 32, '确认 26 人名单并开启赛季 ▶', () => {
        const res = league.confirmInitialDraft();
        if (res.ok) {
          SoundEngine.playFanfare();
          actions.onSave();
          actions.onDone();
        } else {
          this.message = res.reason || '无法开启赛季';
          SoundEngine.playWarning();
        }
      }, { variant: 'green', fontSize: 12, icon: 'check' });
    } else {
      drawText(ctx, '点“退”可随时退选返还预算；补齐 26 人后仍可调整', 1091, 680, {
        size: 10.5,
        color: THEME.TX3,
        align: 'center',
      });
    }

    // 签入飞入弧线动效
    if (this.flyAnims.length > 0) {
      const nowMs = performance.now();
      for (let i = this.flyAnims.length - 1; i >= 0; i--) {
        const fa = this.flyAnims[i];
        const t = Math.min(1, (nowMs - fa.startMs) / fa.durMs);
        if (t >= 1) {
          this.flyAnims.splice(i, 1);
          continue;
        }
        const ease = 1 - Math.pow(1 - t, 3);
        const arcY = -68 * Math.sin(ease * Math.PI);
        const fx = fa.sx + (fa.ex - fa.sx) * ease;
        const fy = fa.sy + (fa.ey - fa.sy) * ease + arcY;
        ctx.save();
        ctx.globalAlpha = 1 - t * 0.25;
        ctx.shadowColor = fa.color;
        ctx.shadowBlur = 12;
        drawRoundRect(ctx, fx - 44, fy - 14, 88, 28, 6, 'rgba(14, 22, 40, 0.94)', fa.color, 1.8);
        drawText(ctx, fa.name, fx, fy, { size: 11, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
        ctx.restore();
      }
    }
  }
}
