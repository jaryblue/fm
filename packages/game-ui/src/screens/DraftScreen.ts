/**
 * 页面 1：开局 3 次核心开包（防守核心包 → 中场大脑包 → 锋线尖刀包），每包 5 选 3
 * PITCH PRINT v1.0 移动端大字舒展版：
 * - 撕朱红封条开牛皮纸球探档案袋
 * - 同屏 5 张竖版暖纸大卡（5选3 不分页，正面大头像 + 大号斜体 CA/PA + 实心暖米色条属性）
 * - 右上角折耳 2D 翻牌（180ms scaleX 1→0→1）看兼职/特质/球探评语与「打开完整档案」大按钮
 * - 点击整卡触发 StampSlam（180ms）砸下斜角朱红「✓ 已签入」印章
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import { CorePackLine, DraftPlayer } from '../../../core/src/types';
import { drawPlayerAvatar } from '../AvatarRenderer';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawPrintCard,
  drawRoundRect,
  drawStamp,
  drawStatBar,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  getHalftonePattern,
  getPaperGrainPattern,
  HitRegistry,
  tierColor,
} from '../CanvasKit';
import { easeOutBack, easeOutCubic, StampSlam } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';

const LINE_META: Record<CorePackLine, { title: string; badge: string; desc: string; color: string }> = {
  DEF: {
    title: '慕名投奔 · 后防旧部与门将 (5选3)',
    badge: '第 1 / 3 批 · 铁血防线',
    desc: '5 名后防旧部与年轻门将慕名赶来试训，从中挑选 3 人签入一线队',
    color: THEME.LIME,
  },
  MID: {
    title: '慕名投奔 · 中场追随者 (5选3)',
    badge: '第 2 / 3 批 · 节拍引擎',
    desc: '5 名中场指挥官主动递交投名状，从中挑选 3 人掌控中场节奏',
    color: THEME.COBALT,
  },
  ATT: {
    title: '慕名投奔 · 锋线尖刀与新星 (5选3)',
    badge: '第 3 / 3 批 · 终结王牌',
    desc: '5 名锋线杀手与天才小将已抵达训练场，挑选 3 人完成建队拼图',
    color: THEME.VERMILION,
  },
};

const CORE_ARCHETYPE_META: Record<'veteran' | 'balanced' | 'wonderkid', { label: string; shortTag: string; hint: string; color: string }> = {
  veteran: {
    label: '追随旧部 · 即战老将',
    shortTag: '即战老将',
    hint: '冲着老交情来扛鼎，PA 见顶且季末微衰',
    color: THEME.BRASS,
  },
  balanced: {
    label: '慕名中坚 · 当打主力',
    shortTag: '当打主力',
    hint: '仰慕你的战术而来，上限高于老将可扛多季',
    color: THEME.COBALT,
  },
  wonderkid: {
    label: '慕名新星 · 高潜小妖',
    shortTag: '高潜小妖',
    hint: '冲着青训口碑投奔，拥有全队最高 PA 上限',
    color: THEME.VIOLET,
  },
};

export class DraftScreen {
  private animClock = 0;
  private signToast: { text: string; timer: number } | null = null;
  private packStage: 'sealed' | 'ripping' | 'reveal' = 'sealed';
  private ripTimer = 0;
  private ripBursted = false;
  private dealTimer = 0;
  private flipped: boolean[] = [true, true, true, true, true];
  private detailFlipped: boolean[] = [false, false, false, false, false];
  private detailFlipAnim: number[] = [0, 0, 0, 0, 0];
  private stampSlams: StampSlam[] = [
    new StampSlam(),
    new StampSlam(),
    new StampSlam(),
    new StampSlam(),
    new StampSlam(),
  ];
  private selectedIds: string[] = [];
  private lastStep = -1;
  private doneTriggered = false;

  private resetPackAnim(): void {
    this.packStage = 'sealed';
    this.ripTimer = 0;
    this.ripBursted = false;
    this.dealTimer = 0;
    this.flipped = [true, true, true, true, true];
    this.detailFlipped = [false, false, false, false, false];
    this.detailFlipAnim = [0, 0, 0, 0, 0];
    this.stampSlams = [new StampSlam(), new StampSlam(), new StampSlam(), new StampSlam(), new StampSlam()];
    this.selectedIds = [];
  }

  public update(dtSec: number): void {
    const dt = Math.min(0.05, Math.max(0.001, dtSec));
    this.animClock += dt;
    if (this.signToast) {
      this.signToast.timer -= dt;
      if (this.signToast.timer <= 0) this.signToast = null;
    }
    for (const slam of this.stampSlams) {
      slam.update(dt);
    }
    for (let i = 0; i < 5; i++) {
      const target = this.detailFlipped[i] ? 1 : 0;
      const cur = this.detailFlipAnim[i];
      if (cur !== target) {
        const speed = dt / 0.18;
        this.detailFlipAnim[i] = target > cur ? Math.min(1, cur + speed) : Math.max(0, cur - speed);
      }
    }
    if (this.packStage === 'ripping') {
      this.ripTimer += dt;
      if (this.ripTimer >= 0.22) {
        this.packStage = 'reveal';
        this.dealTimer = 0;
      }
      return;
    }
    if (this.packStage === 'reveal') {
      this.dealTimer += dt;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onDone: () => void;
      onSave: () => void;
      onInspectPlayer: (p: DraftPlayer) => void;
      onBurst?: (x: number, y: number, color?: string) => void;
      onRequestAutoComplete?: () => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const cpd = league.getCorePackDraftState();
    const step = cpd.step;

    if (step >= 3 || st.phase !== 'INIT_DRAFT') {
      if (!this.doneTriggered) {
        this.doneTriggered = true;
        actions.onDone();
      }
      return;
    }

    this.doneTriggered = false;
    if (step !== this.lastStep) {
      this.lastStep = step;
      this.resetPackAnim();
    }

    const line = cpd.lines[step] ?? 'DEF';
    const meta = LINE_META[line];

    drawBroadcastHeader(ctx, hits, {
      kicker: `COACH REPUTATION · 慕名投奔试训 (${step + 1}/3)`,
      title: `${club.name} · 慕名而来的建队班底 (5选3)`,
      club,
      badge: `当前班底 ${club.squad.length} / 20 人`,
      clubFunds: league.getClubFunds(),
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
    });

    // 顶部进度条（大字 >= 13px）
    drawRoundRect(ctx, 16, 76, 1248, 44, 8, THEME.BG_PANEL, THEME.INK_LINE, 2);
    const stepLabels = ['1. 后防核心包 (5选3)', '2. 中场大脑包 (5选3)', '3. 锋线尖刀包 (5选3)', '4. 进入夏窗 (20→26人)'];
    stepLabels.forEach((lbl, i) => {
      const done = i < step;
      const active = i === step;
      drawBadge(
        ctx,
        32 + i * 308,
        85,
        286,
        26,
        done ? `✓ ${lbl}` : lbl,
        done ? THEME.BG_PITCH_ALT : active ? THEME.PAPER_CREAM : THEME.BG_CARD_DARK,
        done ? THEME.LIME : active ? THEME.PAPER_INK : THEME.TX2
      );
    });

    // ==================== 阶段 A：牛皮纸球探档案袋 + 朱红斜封条 ====================
    if (this.packStage === 'sealed') {
      const floatY = Math.sin(this.animClock * 2.2) * 4;
      const cx = 640;
      const cy = 368 + floatY;
      const envW = 292;
      const envH = 316;
      const ex = cx - envW / 2;
      const ey = cy - envH / 2;
      const hovered = hits.isHovered(ex, ey, envW, envH);

      drawText(ctx, meta.title, cx, 152, { size: 22, bold: true, color: THEME.TX1, align: 'center' });
      drawText(ctx, meta.desc, cx, 182, { size: 14.5, color: THEME.TX2, align: 'center' });

      ctx.save();
      // 硬偏移黑影
      drawRoundRect(ctx, ex + 6, ey + 6, envW, envH, 10, THEME.HARD_SHADOW);
      // 牛皮纸档案袋主体
      drawRoundRect(ctx, ex, ey, envW, envH, 10, '#C9A26B', THEME.INK_LINE, 3);
      // 档案袋上折盖
      ctx.fillStyle = '#B88D52';
      ctx.strokeStyle = THEME.INK_LINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ex, ey + 10);
      ctx.lineTo(ex + envW / 2, ey + 114);
      ctx.lineTo(ex + envW, ey + 10);
      ctx.lineTo(ex + envW, ey);
      ctx.lineTo(ex, ey);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 黄铜扣环
      ctx.fillStyle = THEME.BRASS;
      ctx.beginPath();
      ctx.arc(cx, ey + 114, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 斜向朱红纸封条
      ctx.save();
      ctx.translate(cx, cy + 28);
      ctx.rotate(-0.14);
      drawRoundRect(ctx, -envW * 0.56, -24, envW * 1.12, 48, 4, hovered ? '#F25C50' : THEME.VERMILION, THEME.INK_LINE, 2.5);
      drawText(ctx, `CONFIDENTIAL · 撕开${meta.badge.split('·')[1].trim()}封条`, 0, 0, {
        size: 15,
        bold: true,
        color: THEME.PAPER_CREAM,
        align: 'center',
      });
      ctx.restore();

      drawStamp(ctx, 'SCOUT DOSSIER', cx - 64, ey + envH - 42, THEME.INK_LINE, -5, 0.9);
      ctx.restore();

      const ripNow = () => {
        SoundEngine.playPackRip();
        this.packStage = 'ripping';
        this.ripTimer = 0;
        this.ripBursted = false;
      };
      drawButton(ctx, hits, cx - 165, 536, 330, 50, `撕开${meta.badge.split('·')[1].trim()}档案袋 ▶`, ripNow, {
        variant: 'primary',
        fontSize: 16,
        icon: 'sparkle',
      });
      hits.addTouchTarget(ex, ey, envW, envH, ripNow);
      this.renderPickedSummaryBar(ctx, club.squad, cpd.pickedCores);
      return;
    }

    // ==================== 阶段 B：撕封条开袋瞬爆 (0 -> 0.22s，零 shadowBlur) ====================
    if (this.packStage === 'ripping') {
      const t = this.ripTimer;
      const p = Math.min(1, t / 0.22);
      if (p >= 0.5 && !this.ripBursted) {
        this.ripBursted = true;
        actions.onBurst?.(640, 350, THEME.VERMILION);
        SoundEngine.playBreakthrough();
      }
      ctx.save();
      ctx.fillStyle = 'rgba(10, 26, 20, 0.72)';
      ctx.fillRect(0, 126, THEME.W, THEME.H - 126);

      // 左右撕裂飞出的朱红封条
      const spread = easeOutCubic(p) * 320;
      ctx.translate(640 - spread, 360);
      ctx.rotate(-0.14 - p * 0.3);
      drawRoundRect(ctx, -160, -24, 160, 48, 4, THEME.VERMILION, THEME.INK_LINE, 2.5);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      ctx.translate(640 + spread, 360);
      ctx.rotate(-0.14 + p * 0.3);
      drawRoundRect(ctx, 0, -24, 160, 48, 4, THEME.VERMILION, THEME.INK_LINE, 2.5);
      ctx.restore();
      return;
    }

    // ==================== 阶段 C：同屏 5 张竖版暖纸大卡 (5选3 不分页 + 折耳翻牌 + 砸红章) ====================
    const choices = cpd.currentChoices.slice(0, 5);
    const needPick = Math.min(3, choices.length);

    // 顶部控制栏：提示 + 一键推荐选满
    drawText(ctx, `${meta.title} · 已选 ${this.selectedIds.length}/${needPick}（点击整卡签入 · 右上折耳翻面看详情）`, 24, 146, {
      size: 15.5,
      bold: true,
      color: THEME.TX1,
    });

    drawButton(ctx, hits, 1084, 124, 172, 44, '一键推荐选满', () => {
      this.selectedIds = [...choices]
        .sort((a, b) => (b.ca * 0.7 + (b.pa ?? b.ca) * 0.3) - (a.ca * 0.7 + (a.pa ?? a.ca) * 0.3))
        .slice(0, needPick)
        .map(p => p.id);
      this.stampSlams.forEach(s => s.trigger());
      SoundEngine.playClick();
    }, { variant: 'gold', fontSize: 14, icon: 'sparkle' });

    const cw = 236;
    const ch = 368;
    const gap = 14;
    const totalW = choices.length * cw + Math.max(0, choices.length - 1) * gap;
    const startX = (THEME.W - totalW) / 2;

    const toggleSelect = (pid: string, idx: number) => {
      const pos = this.selectedIds.indexOf(pid);
      if (pos >= 0) {
        this.selectedIds.splice(pos, 1);
      } else if (this.selectedIds.length < needPick) {
        this.selectedIds.push(pid);
        this.stampSlams[idx]?.trigger();
      } else {
        this.selectedIds.shift();
        this.selectedIds.push(pid);
        this.stampSlams[idx]?.trigger();
      }
      SoundEngine.playClick();
    };

    const grain = getPaperGrainPattern(ctx);
    const ht = getHalftonePattern(ctx, false);

    choices.forEach((p, idx) => {
      const targetX = startX + idx * (cw + gap);
      const targetY = 172;

      const dealP = easeOutBack(Math.max(0, Math.min(1, (this.dealTimer - idx * 0.04) / 0.24)));
      const cx = targetX;
      const cy = targetY + Math.round((1 - dealP) * 28);

      // 2D 折耳翻牌缩放（1 -> 0 -> 1, 180ms）
      const flipP = this.detailFlipAnim[idx];
      const scaleX = Math.max(0.05, Math.abs(Math.cos(flipP * Math.PI)));
      const showBack = flipP >= 0.5;

      const isPicked = this.selectedIds.includes(p.id);
      const hovered = hits.isHovered(cx, cy, cw, ch);
      const archKey: 'veteran' | 'balanced' | 'wonderkid' = p.coreTag ?? (idx === 0 ? 'veteran' : idx <= 2 ? 'balanced' : 'wonderkid');
      const arch = CORE_ARCHETYPE_META[archKey];
      const topBand = isPicked ? THEME.VERMILION : arch.color;

      ctx.save();
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.scale(scaleX, 1);
      ctx.translate(-(cx + cw / 2), -(cy + ch / 2));

      // 暖纸实体大卡（直角微圆角 + 30px 满宽顶部档案色带 + 墨线隔断）
      drawPrintCard(ctx, cx, cy, cw, ch, {
        paper: true,
        topBandColor: topBand,
        topBandHeight: 30,
        halftone: true,
        radius: 3,
        shadowOffset: hovered || isPicked ? 6 : 4,
        strokeColor: isPicked ? THEME.VERMILION : THEME.INK_LINE,
        lineWidth: isPicked ? 3.2 : 2.5,
      });

      // 30px 满宽顶部档案色带文案
      const bandTextCol = archKey === 'veteran' && !isPicked ? THEME.PAPER_INK : THEME.PAPER_CREAM;
      drawText(ctx, arch.shortTag, cx + 12, cy + 15, {
        size: 13,
        bold: true,
        color: bandTextCol,
      });
      drawText(ctx, `${p.tier}级`, cx + cw - 12, cy + 15, {
        size: 12.5,
        bold: true,
        color: bandTextCol,
        align: 'right',
        mono: true,
      });

      // 右上角翻牌角标（置于色带下方，干净小方扣 + 居中翻面图标，无斜线穿字）
      const earSize = 28;
      const ex = cx + cw - earSize;
      const ey = cy + 30;
      ctx.fillStyle = showBack ? THEME.VERMILION : THEME.PAPER_WARM;
      ctx.strokeStyle = THEME.INK_LINE;
      ctx.lineWidth = 2;
      ctx.fillRect(ex, ey, earSize, earSize);
      ctx.strokeRect(ex, ey, earSize, earSize);
      drawText(ctx, showBack ? '↩' : '↻', ex + earSize * 0.5, ey + earSize * 0.5, {
        size: 14,
        bold: true,
        color: showBack ? THEME.PAPER_CREAM : THEME.PAPER_INK,
        align: 'center',
      });

      if (!showBack) {
        // ========== 卡片正面：位置章 + 大号斜体 CA/PA + 居中漫画头像 + 暖米色条属性 ==========
        drawBadge(ctx, cx + 10, cy + 37, 46, 24, p.role, THEME.PAPER_INK, THEME.PAPER_CREAM);

        // 大号斜体 CA / PA（避开右侧折耳）
        ctx.save();
        ctx.font = `italic 900 28px ${THEME.NUM_FONT_FAMILY}`;
        ctx.fillStyle = THEME.PAPER_INK;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${p.ca}`, cx + cw - 68, cy + 48);
        ctx.font = `700 13.5px ${THEME.NUM_FONT_FAMILY}`;
        ctx.fillStyle = THEME.PAPER_MUTED;
        ctx.fillText(`/${p.pa ?? p.ca}`, cx + cw - 34, cy + 52);
        ctx.restore();

        // 居中大尺寸漫画头像（134×114）
        drawPlayerAvatar(ctx, cx + (cw - 134) / 2, cy + 67, 134, 114, p, club, { radius: 2 });

        // 姓名 + 年龄身价 + 招牌特质
        drawText(ctx, fitText(ctx, p.name, cw - 20, 18, true), cx + cw / 2, cy + 195, {
          size: 18,
          bold: true,
          color: THEME.PAPER_INK,
          align: 'center',
        });
        drawText(ctx, `${p.age}岁 · ¥${p.marketValue ?? p.cost}万`, cx + cw / 2, cy + 217, {
          size: 12.5,
          bold: true,
          color: THEME.PAPER_MUTED,
          align: 'center',
        });
        drawText(ctx, fitText(ctx, p.traits?.slice(0, 2).join(' · ') || '建队核心', cw - 20, 12.5, true), cx + cw / 2, cy + 236, {
          size: 12.5,
          bold: true,
          color: THEME.VERMILION,
          align: 'center',
        });

        // 2×3 实心暖米色条属性（#E7DEC9，>=12.5px）
        const pairs: Array<[string, number]> = p.role === 'GK'
          ? [
              ['扑', p.attributes.goalkeeping],
              ['站', p.attributes.positioning],
              ['冷', p.attributes.composure],
              ['传', p.attributes.passing],
              ['力', p.attributes.strength],
              ['体', p.attributes.stamina],
            ]
          : [
              ['速', p.attributes.pace],
              ['射', p.attributes.shooting],
              ['传', p.attributes.passing],
              ['盘', p.attributes.dribbling],
              ['防', p.attributes.defending],
              ['体', p.attributes.stamina],
            ];
        pairs.forEach(([lbl, val], pi) => {
          const col = pi % 2;
          const row = Math.floor(pi / 2);
          const ax = cx + 10 + col * 112;
          const ay = cy + 250 + row * 27;
          drawRoundRect(ctx, ax, ay, 104, 22, 2, THEME.PAPER_WARM, THEME.INK_LINE, 1.5);
          drawText(ctx, lbl, ax + 6, ay + 11, { size: 12.5, bold: true, color: THEME.PAPER_INK });
          drawStatBar(ctx, val, 100, ax + 26, ay + 7, 44, 8, val >= 65 ? THEME.VERMILION : val >= 50 ? THEME.COBALT : THEME.PAPER_MUTED);
          drawText(ctx, `${val}`, ax + 98, ay + 11, { size: 13, bold: true, color: val >= 65 ? THEME.VERMILION : THEME.PAPER_INK, align: 'right', mono: true });
        });

        // 底部签入提示或 StampSlam 红章
        if (isPicked) {
          const t = this.stampSlams[idx]?.getTransform() ?? { scale: 1, alpha: 1 };
          ctx.save();
          ctx.globalAlpha = t.alpha;
          drawStamp(ctx, '✓ 已签入', cx + cw / 2, cy + ch - 21, THEME.VERMILION, -6, 0.90 * t.scale);
          ctx.restore();
        } else {
          drawText(ctx, hovered ? '点击整卡签入 +' : '点击签入 · 折耳翻面', cx + cw / 2, cy + ch - 19, {
            size: 12.5,
            bold: hovered,
            color: hovered ? THEME.VERMILION : THEME.PAPER_MUTED,
            align: 'center',
          });
        }
      } else {
        // ========== 卡片背面：兼职 + 特质详解 + 球探评语 + 「打开完整档案」大按钮 ==========
        drawText(ctx, fitText(ctx, `${p.name} · 档案`, cw - 52, 16, true), cx + 14, cy + 46, {
          size: 16,
          bold: true,
          color: THEME.PAPER_INK,
        });
        drawRoundRect(ctx, cx + 12, cy + 68, cw - 24, 82, 3, THEME.PAPER_WARM, THEME.INK_LINE, 1.8);
        drawText(ctx, arch.label, cx + 20, cy + 86, { size: 13, bold: true, color: arch.color });
        drawWrappedText(ctx, arch.hint, cx + 20, cy + 106, cw - 40, 18, {
          size: 12.5,
          color: THEME.PAPER_INK,
          maxLines: 2,
        });

        drawRoundRect(ctx, cx + 12, cy + 158, cw - 24, 134, 3, THEME.PAPER_WARM, THEME.INK_LINE, 1.8);
        drawText(ctx, `位置：${p.role}`, cx + 20, cy + 176, {
          size: 13,
          bold: true,
          color: THEME.PAPER_INK,
        });
        drawText(ctx, `兼职：${p.secondaryRoles?.join('/') || '专职'}`, cx + 20, cy + 198, {
          size: 13,
          bold: true,
          color: THEME.PAPER_MUTED,
        });
        const traitsLine = p.traits && p.traits.length > 0 ? p.traits.join('、') : '常规轮换型球员';
        drawWrappedText(ctx, `特点：${traitsLine}`, cx + 20, cy + 220, cw - 40, 18, {
          size: 12.5,
          color: THEME.PAPER_MUTED,
          maxLines: 2,
        });
        drawText(ctx, `CA ${p.ca} / PA ${p.pa ?? p.ca}`, cx + 20, cy + 272, {
          size: 13.5,
          bold: true,
          color: THEME.VERMILION,
          mono: true,
        });

        drawButton(ctx, hits, cx + 12, cy + ch - 56, cw - 24, 44, '打开完整档案', () => {
          SoundEngine.playClick();
          actions.onInspectPlayer(p);
        }, { variant: 'ghost', fontSize: 13.5 });
      }

      ctx.restore();

      // 注册点击热区：先注册整卡（唯一 236×368 热区），再注册右上角翻牌（后注册优先命中）
      if (!showBack) {
        hits.add(cx, cy, cw, ch, () => toggleSelect(p.id, idx));
      }
      hits.addTouchTarget(ex - 10, ey - 6, 44, 44, () => {
        this.detailFlipped[idx] = !this.detailFlipped[idx];
        SoundEngine.playCardFlip('common');
      });
    });

    // 底部确认区：满 3 人时显示大号朱红/黄铜开哨按钮，未满时显示 3 个更衣室名牌槽
    const readyConfirm = this.selectedIds.length === needPick;
    if (readyConfirm) {
      drawButton(
        ctx,
        hits,
        400,
        552,
        480,
        50,
        step === 2 ? '吹哨集结 · 签入这 3 人开启夏窗 ▶' : '吹哨集结 · 签入这 3 人进入下一包 ▶',
        () => {
          const res = league.pickCorePackPlayers(this.selectedIds);
          if (res.ok) {
            SoundEngine.playRewardChime();
            actions.onBurst?.(420, 340, THEME.BRASS);
            actions.onBurst?.(640, 320, THEME.LIME);
            actions.onBurst?.(860, 340, THEME.BRASS);
            const addedVal = (res.players ?? []).reduce((s, x) => s + (x.marketValue ?? x.cost), 0);
            const avgAddedCa = res.players?.length ? Math.round(res.players.reduce((s, x) => s + x.ca, 0) / res.players.length) : 0;
            this.signToast = {
              text: `签入成功！3 名新援入队（均分 CA ${avgAddedCa} · 身价 +¥${addedVal}万）`,
              timer: 2.0,
            };
            actions.onSave();
            if (res.completed) {
              this.doneTriggered = true;
              actions.onDone();
            } else {
              this.resetPackAnim();
            }
          }
        },
        { variant: 'primary', fontSize: 15.5, icon: 'sparkle' }
      );
    } else {
      const slotW = 196;
      const slotGap = 16;
      const slotsX = 640 - (needPick * slotW + (needPick - 1) * slotGap) / 2;
      for (let si = 0; si < needPick; si++) {
        const sx = slotsX + si * (slotW + slotGap);
        const sy = 552;
        const pickedId = this.selectedIds[si];
        const pickedPlayer = pickedId ? choices.find(c => c.id === pickedId) : undefined;
        const choiceIdx = pickedId ? choices.findIndex(c => c.id === pickedId) : -1;
        if (pickedPlayer) {
          drawRoundRect(ctx, sx, sy, slotW, 48, 8, THEME.BG_PITCH_ALT, THEME.LIME, 2.2);
          drawPlayerAvatar(ctx, sx + 8, sy + 6, 30, 36, pickedPlayer, club, { radius: 4 });
          drawText(ctx, fitText(ctx, pickedPlayer.name, 136, 14, true), sx + 46, sy + 16, {
            size: 14,
            bold: true,
            color: THEME.TX1,
          });
          drawText(ctx, `${pickedPlayer.role} · CA ${pickedPlayer.ca}`, sx + 46, sy + 35, {
            size: 12,
            color: THEME.LIME,
            mono: true,
          });
          hits.addTouchTarget(sx, sy, slotW, 48, () => toggleSelect(pickedPlayer.id, choiceIdx));
        } else {
          ctx.save();
          ctx.setLineDash([5, 4]);
          drawRoundRect(ctx, sx, sy, slotW, 48, 8, THEME.BG_PANEL, 'rgba(244, 239, 228, 0.35)', 1.5);
          ctx.restore();
          drawText(ctx, `名牌空位 #${si + 1}`, sx + slotW / 2, sy + 24, {
            size: 13.5,
            color: THEME.TX2,
            align: 'center',
          });
        }
      }
    }

    this.renderPickedSummaryBar(ctx, club.squad, cpd.pickedCores);
    if (this.signToast) {
      const alpha = Math.min(1, this.signToast.timer / 0.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawRoundRect(ctx, 320, 128, 640, 38, 8, THEME.BG_PITCH_ALT, THEME.LIME, 2);
      drawText(ctx, this.signToast.text, 640, 147, { size: 14, bold: true, color: THEME.LIME, align: 'center' });
      ctx.restore();
    }
  }

  private renderPickedSummaryBar(ctx: CanvasRenderingContext2D, squad: DraftPlayer[], pickedCores: DraftPlayer[]): void {
    drawRoundRect(ctx, 16, 612, 1248, 88, 10, THEME.BG_PANEL, THEME.INK_LINE, 2);
    drawText(ctx, `当前 ${squad.length} 人（已抽核心 ${pickedCores.length}/9） → 选秀后 20 人 → 夏窗补至 26 人开赛`, 36, 638, {
      size: 14.5,
      bold: true,
      color: THEME.BRASS,
    });
    drawText(ctx, '11 名草根骨架已就位，每包从 5 名慕名试训球员中挑选 3 人', 36, 668, {
      size: 13.5,
      color: THEME.TX2,
    });
    const recent = pickedCores.slice(-5);
    recent.forEach((p, idx) => {
      const bx = 668 + idx * 116;
      drawRoundRect(ctx, bx, 624, 108, 62, 6, THEME.BG_CARD_DARK, THEME.INK_LINE, 1.8);
      drawBadge(ctx, bx + 6, 630, 36, 20, p.role, tierColor(p.tier));
      drawText(ctx, `${p.ca}/${p.pa ?? p.ca}`, bx + 102, 640, { size: 12, bold: true, color: THEME.BRASS, align: 'right', mono: true });
      drawText(ctx, fitText(ctx, p.name, 96, 13.5, true), bx + 54, 668, { size: 13.5, bold: true, color: THEME.TX1, align: 'center' });
    });
  }
}
