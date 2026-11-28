/**
 * PITCH PRINT v1.0 轻量动效、缓动函数、矢量新 Logo、启动动画、斜切转场与漫画原语
 * 零外部依赖，零 shadowBlur / ctx.filter，60fps 纯 Canvas 2D 运行
 */

import { AssetLoader } from './AssetLoader';
import { drawPrintCard, drawRoundRect, drawText, getHalftonePattern } from './CanvasKit';
import { THEME } from './Theme';

export function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

export function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutBack(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export class ScreenShake {
  private timer = 0;
  private duration = 0;
  private intensity = 0;

  public trigger(intensity = 6, duration = 0.22): void {
    this.intensity = intensity;
    this.duration = duration;
    this.timer = duration;
  }

  public update(dtSec: number): void {
    if (this.timer > 0) {
      this.timer = Math.max(0, this.timer - dtSec);
    }
  }

  public getOffset(): { x: number; y: number } {
    if (this.timer <= 0 || this.duration <= 0) return { x: 0, y: 0 };
    const ratio = this.timer / this.duration;
    const amp = this.intensity * ratio;
    return {
      x: (Math.random() * 2 - 1) * amp,
      y: (Math.random() * 2 - 1) * amp,
    };
  }
}

/**
 * 油墨盖章砸落动效（180ms easeOutBack: scale 1.48 -> 1.0, alpha 0 -> 1）
 */
export class StampSlam {
  private timer = 0;
  private readonly duration = 0.18;
  private active = false;
  private settled = false;

  public trigger(): void {
    this.timer = 0;
    this.active = true;
    this.settled = true;
  }

  public reset(): void {
    this.timer = 0;
    this.active = false;
    this.settled = false;
  }

  public update(dtSec: number): void {
    if (!this.active) return;
    this.timer += dtSec;
    if (this.timer >= this.duration) {
      this.timer = this.duration;
      this.active = false;
    }
  }

  public getTransform(): { scale: number; alpha: number; active: boolean; settled: boolean } {
    if (!this.settled) return { scale: 1, alpha: 0, active: false, settled: false };
    if (!this.active) return { scale: 1, alpha: 1, active: false, settled: true };
    const t = Math.min(1, this.timer / this.duration);
    const p = easeOutBack(t);
    return {
      scale: 1.48 - 0.48 * p,
      alpha: Math.min(1, t * 2.2),
      active: true,
      settled: true,
    };
  }
}

/**
 * 数值跳变脉冲动效（220ms easeOutCubic: 1.0 -> 1.22 -> 1.0，前 80ms 闪烁 #C8F230）
 */
export class ValuePulse {
  private timer = 0;
  private readonly duration = 0.22;
  private active = false;

  public trigger(): void {
    this.timer = 0;
    this.active = true;
  }

  public update(dtSec: number): void {
    if (!this.active) return;
    this.timer += dtSec;
    if (this.timer >= this.duration) {
      this.timer = 0;
      this.active = false;
    }
  }

  public getScale(): number {
    if (!this.active) return 1;
    const half = this.duration * 0.4;
    if (this.timer <= half) {
      return 1 + 0.22 * easeOutCubic(this.timer / half);
    }
    return 1.22 - 0.22 * easeOutCubic((this.timer - half) / (this.duration - half));
  }

  public isFlash(): boolean {
    return this.active && this.timer <= 0.08;
  }
}

/**
 * 漫画斜切速度线 Cut-In 横幅（140ms 滑入 + 860ms 停留 + 200ms 划出 = 1.2s，支持点击秒跳）
 */
export class MangaCutIn {
  private active = false;
  private timer = 0;
  private readonly inDur = 0.14;
  private readonly holdDur = 0.86;
  private readonly outDur = 0.20;
  private title = '';
  private subtitle = '';
  private tag = '';
  private accent: string = THEME.VERMILION;
  private artId: import('./AssetLoader').ArtAssetId | null = null;

  public trigger(opts: { title: string; subtitle?: string; accent?: string; tag?: string; artId?: import('./AssetLoader').ArtAssetId }): void {
    this.title = opts.title;
    this.subtitle = opts.subtitle ?? '';
    this.tag = opts.tag ?? '';
    this.accent = opts.accent ?? THEME.VERMILION;
    this.artId = opts.artId ?? null;
    this.timer = 0;
    this.active = true;
  }

  public dismiss(): void {
    this.active = false;
    this.timer = 0;
  }

  public isActive(): boolean {
    return this.active;
  }

  public update(dtSec: number): void {
    if (!this.active) return;
    this.timer += dtSec;
    if (this.timer >= this.inDur + this.holdDur + this.outDur) {
      this.active = false;
      this.timer = 0;
    }
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.active) return;
    const total = this.inDur + this.holdDur + this.outDur;
    let slideX = 0;
    let dimAlpha = 0.5;
    if (this.timer < this.inDur) {
      const p = easeOutCubic(this.timer / this.inDur);
      slideX = (1 - p) * -w;
      dimAlpha = 0.5 * p;
    } else if (this.timer > this.inDur + this.holdDur) {
      const p = easeInOutCubic((this.timer - this.inDur - this.holdDur) / this.outDur);
      slideX = p * w;
      dimAlpha = 0.5 * (1 - p);
    }

    ctx.save();
    ctx.fillStyle = `rgba(10, 26, 20, ${dimAlpha.toFixed(2)})`;
    ctx.fillRect(0, 0, w, h);

    ctx.translate(slideX, 0);
    const bandTop = h * 0.34;
    const bandH = 196;
    const skew = 48;

    // 硬阴影偏移底条
    ctx.fillStyle = THEME.HARD_SHADOW;
    ctx.beginPath();
    ctx.moveTo(0, bandTop + 8);
    ctx.lineTo(w, bandTop - 10 + 8);
    ctx.lineTo(w, bandTop + bandH - 10 + 8);
    ctx.lineTo(0, bandTop + bandH + 8);
    ctx.closePath();
    ctx.fill();

    // 主斜切漫画横幅
    ctx.fillStyle = this.accent;
    ctx.beginPath();
    ctx.moveTo(0, bandTop);
    ctx.lineTo(w, bandTop - 10);
    ctx.lineTo(w, bandTop + bandH - 10);
    ctx.lineTo(0, bandTop + bandH);
    ctx.closePath();
    ctx.fill();

    // 速度线滚动
    ctx.save();
    ctx.clip();
    const scroll = (this.timer * 1400) % 160;
    ctx.fillStyle = 'rgba(244, 239, 228, 0.20)';
    for (let sx = -160; sx < w + 160; sx += 80) {
      const lx = sx + scroll;
      ctx.fillRect(lx, bandTop - 16, 26, 4);
      ctx.fillRect(lx + 40, bandTop + bandH - 36, 42, 5);
    }
    ctx.fillStyle = THEME.LIME;
    ctx.fillRect(0, bandTop + bandH - 18, w, 6);
    ctx.restore();

    // 硬墨线上下边界
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, bandTop);
    ctx.lineTo(w, bandTop - 10);
    ctx.moveTo(0, bandTop + bandH);
    ctx.lineTo(w, bandTop + bandH - 10);
    ctx.stroke();

    // 呼号文字（大号斜体 + 硬偏移影）
    if (this.tag) {
      drawRoundRect(ctx, w / 2 - 90, bandTop - 18, 180, 32, 4, THEME.PAPER_CREAM, THEME.INK_LINE, 2.5);
      drawText(ctx, this.tag, w / 2, bandTop - 2, {
        size: 14,
        bold: true,
        color: THEME.PAPER_INK,
        align: 'center',
        rawSize: true,
      });
    }
    const cy = bandTop + bandH / 2 - 4;
    const cutSticker = this.artId ? AssetLoader.get(this.artId) : null;
    if (cutSticker && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.translate(w * 0.20, cy + 4);
      ctx.rotate(-0.06);
      ctx.drawImage(cutSticker, -56, -56, 112, 112);
      ctx.restore();
    }
    drawText(ctx, this.title, w / 2 + 4, cy + 4, {
      size: 46,
      bold: true,
      italic: true,
      color: THEME.HARD_SHADOW,
      align: 'center',
      rawSize: true,
    });
    drawText(ctx, this.title, w / 2, cy, {
      size: 46,
      bold: true,
      italic: true,
      color: THEME.PAPER_CREAM,
      align: 'center',
      rawSize: true,
    });
    if (this.subtitle) {
      drawText(ctx, this.subtitle, w / 2, cy + 44, {
        size: 18,
        bold: true,
        color: THEME.LIME,
        align: 'center',
        rawSize: true,
      });
    }
    if (this.timer < total - 0.1) {
      drawText(ctx, '点击任意位置跳过 ▶', w - 28 - skew * 0.2, bandTop + bandH - 30, {
        size: 13,
        bold: true,
        color: THEME.PAPER_CREAM,
        align: 'right',
        rawSize: true,
      });
    }
    ctx.restore();
  }
}

/**
 * PITCH PRINT 斜切战术板转场（120ms 遮盖 -> 180ms 拉开，深松柏绿 + 朱红/荧光绿边界）
 */
export class RouteTransition {
  private phase: 'idle' | 'in' | 'out' = 'idle';
  private timer = 0;
  private readonly inDuration = 0.12;
  private readonly outDuration = 0.18;
  private onMidpoint: (() => void) | null = null;
  private label = '';

  public isActive(): boolean {
    return this.phase !== 'idle';
  }

  public trigger(onMidpoint?: () => void, label = ''): void {
    if (!onMidpoint) {
      this.phase = 'out';
      this.timer = 0;
      this.onMidpoint = null;
      this.label = label;
      return;
    }
    this.phase = 'in';
    this.timer = 0;
    this.onMidpoint = onMidpoint;
    this.label = label;
  }

  public update(dtSec: number): void {
    if (this.phase === 'idle') return;
    this.timer += dtSec;
    if (this.phase === 'in' && this.timer >= this.inDuration) {
      const cb = this.onMidpoint;
      this.onMidpoint = null;
      cb?.();
      this.phase = 'out';
      this.timer = 0;
    } else if (this.phase === 'out' && this.timer >= this.outDuration) {
      this.phase = 'idle';
      this.timer = 0;
      this.label = '';
    }
  }

  public getContentReveal(): { alpha: number; offsetY: number } {
    if (this.phase === 'idle') return { alpha: 1, offsetY: 0 };
    if (this.phase === 'in') return { alpha: 1, offsetY: 0 };
    const p = easeOutCubic(this.timer / this.outDuration);
    return {
      alpha: 0.4 + 0.6 * p,
      offsetY: Math.round((1 - p) * 10),
    };
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.phase === 'idle') return;
    ctx.save();
    const skew = 140;
    if (this.phase === 'in') {
      const p = easeOutCubic(this.timer / this.inDuration);
      const rightX = -skew + (w + skew * 2) * p;
      ctx.beginPath();
      ctx.moveTo(-skew, 0);
      ctx.lineTo(rightX, 0);
      ctx.lineTo(rightX - skew, h);
      ctx.lineTo(-skew * 2, h);
      ctx.closePath();
      ctx.fillStyle = THEME.BG_DEEP;
      ctx.fill();

      ctx.strokeStyle = THEME.VERMILION;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(rightX - 4, 0);
      ctx.lineTo(rightX - skew - 4, h);
      ctx.stroke();

      ctx.strokeStyle = THEME.LIME;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rightX, 0);
      ctx.lineTo(rightX - skew, h);
      ctx.stroke();
    } else {
      const p = easeInOutCubic(this.timer / this.outDuration);
      const leftX = -skew + (w + skew * 2) * p;
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(w + skew, 0);
      ctx.lineTo(w + skew, h);
      ctx.lineTo(leftX - skew, h);
      ctx.closePath();
      ctx.fillStyle = THEME.BG_DEEP;
      ctx.fill();

      ctx.strokeStyle = THEME.VERMILION;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(leftX + 3, 0);
      ctx.lineTo(leftX - skew + 3, h);
      ctx.stroke();

      ctx.strokeStyle = THEME.LIME;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX - skew, h);
      ctx.stroke();
    }

    if (this.label) {
      const alpha = this.phase === 'in'
        ? easeOutCubic(this.timer / this.inDuration)
        : 1 - easeOutCubic(this.timer / this.outDuration);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      drawPrintCard(ctx, w / 2 - 170, h / 2 - 28, 340, 56, { paper: true, radius: 6, shadowOffset: 4 });
      drawText(ctx, this.label, w / 2, h / 2, {
        size: 18,
        bold: true,
        italic: true,
        color: THEME.PAPER_INK,
        align: 'center',
        rawSize: true,
      });
    }
    ctx.restore();
  }
}

/**
 * 绘制「再开一局 2026」PITCH PRINT 矢量新版 Logo
 * （倾斜硬阴影暖纸底板 + 红绿双拼盾牌与五边形足球 + 粗黑斜体字标 + 朱红战术箭头 + 2026 黄铜铭牌）
 */
export function drawGameLogoEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  _timeSec = 0,
  shape: 'circle' | 'showcase' = 'circle'
): void {
  ctx.save();
  ctx.translate(cx, cy);

  if (shape === 'circle') {
    const r = size * 0.46;
    ctx.fillStyle = THEME.HARD_SHADOW;
    ctx.beginPath();
    ctx.arc(3, 3, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = THEME.PAPER_CREAM;
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 盾牌分色
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = THEME.VERMILION;
    ctx.fillRect(-r, -r, r, r * 2);
    ctx.fillStyle = THEME.BG_PANEL;
    ctx.fillRect(0, -r, r, r * 2);
    ctx.restore();

    // 中心黑白五边形足球
    const br = r * 0.48;
    ctx.fillStyle = THEME.PAPER_CREAM;
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = THEME.INK_LINE;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = Math.cos(a) * br * 0.44;
      const py = Math.sin(a) * br * 0.44;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // showcase 模式：优先绘制俱乐部双框正式 Logo（1024x512），加载前兜底使用 PITCH PRINT 矢量横幅
  const logoImg = AssetLoader.get('game_logo');
  if (logoImg && typeof ctx.drawImage === 'function') {
    const lw = Math.max(380, size * 2.38);
    const lh = Math.round(lw * 0.5);
    ctx.save();
    // 硬阴影底托
    drawRoundRect(ctx, -lw / 2 + 5, -lh / 2 + 5, lw, lh, 10, THEME.HARD_SHADOW);
    // 圆角裁切绘制正式 Logo
    ctx.beginPath();
    ctx.roundRect(-lw / 2, -lh / 2, lw, lh, 10);
    ctx.clip();
    ctx.drawImage(logoImg, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();
    // 细墨线外框保证与标题页左侧深背景干净融合
    drawRoundRect(ctx, -lw / 2, -lh / 2, lw, lh, 10, undefined, 'rgba(216, 168, 66, 0.35)', 1.5);
    ctx.restore();
    return;
  }

  const bw = Math.max(360, size * 2.30);
  const bh = Math.max(104, size * 0.60);
  const skew = 18;

  // 7px 硬偏移黑影 (#07100C)
  ctx.fillStyle = THEME.HARD_SHADOW;
  ctx.beginPath();
  ctx.moveTo(-bw / 2 + skew + 7, -bh / 2 + 7);
  ctx.lineTo(bw / 2 + skew + 7, -bh / 2 + 7);
  ctx.lineTo(bw / 2 - skew + 7, bh / 2 + 7);
  ctx.lineTo(-bw / 2 - skew + 7, bh / 2 + 7);
  ctx.closePath();
  ctx.fill();

  // 暖象牙底板 (#F4EFE4, 3.5px #111412 描边 + 右半侧网点)
  ctx.beginPath();
  ctx.moveTo(-bw / 2 + skew, -bh / 2);
  ctx.lineTo(bw / 2 + skew, -bh / 2);
  ctx.lineTo(bw / 2 - skew, bh / 2);
  ctx.lineTo(-bw / 2 - skew, bh / 2);
  ctx.closePath();
  ctx.fillStyle = THEME.PAPER_CREAM;
  ctx.fill();

  const ht = getHalftonePattern(ctx, false);
  if (ht) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ht;
    ctx.fillRect(0, -bh / 2, bw / 2 + skew, bh);
    ctx.restore();
  }

  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 左侧经典红绿双拼盾牌 + 几何五边形足球
  const sx = -bw / 2 + 54;
  const sw = 56;
  const sh = 64;
  ctx.save();
  ctx.translate(sx, -2);
  ctx.beginPath();
  ctx.moveTo(-sw / 2, -sh / 2);
  ctx.lineTo(sw / 2, -sh / 2);
  ctx.lineTo(sw / 2, 0);
  ctx.quadraticCurveTo(sw / 2, sh * 0.45, 0, sh * 0.55);
  ctx.quadraticCurveTo(-sw / 2, sh * 0.45, -sw / 2, 0);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = THEME.VERMILION;
  ctx.fillRect(-sw / 2, -sh / 2, sw / 2, sh + 8);
  ctx.fillStyle = THEME.BG_PANEL;
  ctx.fillRect(0, -sh / 2, sw / 2, sh + 8);
  ctx.restore();
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 足球
  ctx.fillStyle = THEME.PAPER_CREAM;
  ctx.beginPath();
  ctx.arc(0, -2, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = THEME.INK_LINE;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = Math.cos(a) * 6.8;
    const py = -2 + Math.sin(a) * 6.8;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 右侧粗黑斜体「再开一局」（双层厚重字标）
  const textX = sx + 50;
  const titleSize = Math.round(bh * 0.54);
  ctx.save();
  ctx.font = `italic 900 ${titleSize}px ${THEME.DISPLAY_FONT_CN}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(17, 20, 18, 0.16)';
  ctx.fillText('再开一局', textX + 2.5, -6 + 2.5);
  ctx.fillStyle = THEME.PAPER_INK;
  ctx.fillText('再开一局', textX, -6);
  ctx.restore();

  // 底部横穿朱砂红填充战术大箭头 (#E03A2E + 2.5px #111412 描边)
  const arrowY = bh * 0.30;
  const arrowLeft = textX - 4;
  const arrowRight = bw / 2 - 4;
  ctx.save();
  ctx.fillStyle = THEME.VERMILION;
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(arrowLeft, arrowY - 4);
  ctx.lineTo(arrowRight - 22, arrowY - 6);
  ctx.lineTo(arrowRight - 26, arrowY - 13);
  ctx.lineTo(arrowRight + 6, arrowY - 1);
  ctx.lineTo(arrowRight - 26, arrowY + 11);
  ctx.lineTo(arrowRight - 22, arrowY + 4);
  ctx.lineTo(arrowLeft, arrowY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 右上角微倾黄铜色「2026」实体铭牌
  ctx.save();
  ctx.translate(bw / 2 - 22, -bh / 2 + 2);
  ctx.rotate(-0.10);
  ctx.fillStyle = THEME.HARD_SHADOW;
  ctx.fillRect(-34 + 3, -15 + 3, 68, 30);
  ctx.fillStyle = THEME.BRASS;
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 2.5;
  ctx.fillRect(-34, -15, 68, 30);
  ctx.strokeRect(-34, -15, 68, 30);
  drawText(ctx, '2026', 0, 1, {
    size: 15,
    bold: true,
    italic: true,
    color: THEME.PAPER_INK,
    align: 'center',
    mono: true,
    rawSize: true,
  });
  ctx.restore();

  ctx.restore();
}

/**
 * 进入游戏的启动加载动画（深松柏绿底 + 矢量新 Logo + 硬墨线进度条）
 */
export class BootIntro {
  private state: 'loading' | 'opening' | 'done' = 'loading';
  private elapsed = 0;
  private smoothProgress = 0;
  private openTimer = 0;
  private readonly minLoadSec = 1.1;
  private readonly openDuration = 0.42;
  private onEnteredTitle?: () => void;

  public constructor(onEnteredTitle?: () => void) {
    this.onEnteredTitle = onEnteredTitle;
  }

  public isBlocking(): boolean {
    return this.state === 'loading';
  }

  public isDone(): boolean {
    return this.state === 'done';
  }

  public skip(): void {
    if (this.state === 'loading' && this.elapsed >= 0.35) {
      this.smoothProgress = 1;
      this.state = 'opening';
      this.openTimer = 0;
      this.onEnteredTitle?.();
    }
  }

  public update(dtSec: number): void {
    if (this.state === 'done') return;
    this.elapsed += dtSec;

    if (this.state === 'loading') {
      const prog = AssetLoader.getProgress();
      const target = prog.total > 0 ? Math.min(1, prog.loaded / prog.total) : 1;
      const timeGate = Math.min(1, this.elapsed / this.minLoadSec);
      const effectiveTarget = Math.min(target, timeGate);
      this.smoothProgress += (effectiveTarget - this.smoothProgress) * Math.min(1, dtSec * 8);

      if (this.elapsed >= this.minLoadSec && (target >= 0.85 || this.elapsed >= 2.2)) {
        this.smoothProgress = 1;
        this.state = 'opening';
        this.openTimer = 0;
        this.onEnteredTitle?.();
      }
    } else if (this.state === 'opening') {
      this.openTimer += dtSec;
      if (this.openTimer >= this.openDuration) {
        this.state = 'done';
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.state === 'done') return;
    ctx.save();

    if (this.state === 'opening') {
      const p = easeInOutCubic(this.openTimer / this.openDuration);
      const halfH = (h / 2) * (1 - p);
      ctx.fillStyle = THEME.BG_DEEP;
      ctx.fillRect(0, 0, w, halfH);
      ctx.fillRect(0, h - halfH, w, halfH);

      ctx.strokeStyle = THEME.LIME;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, halfH);
      ctx.lineTo(w, halfH);
      ctx.moveTo(0, h - halfH);
      ctx.lineTo(w, h - halfH);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.fillStyle = THEME.BG_DEEP;
    ctx.fillRect(0, 0, w, h);

    const ht = getHalftonePattern(ctx, true);
    if (ht) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = ht;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 粉笔战术中线装饰
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 160, 0, Math.PI * 2);
    ctx.stroke();

    const cx = w / 2;
    const cy = h / 2 - 36;
    const logoPop = easeOutBack(Math.min(1, this.elapsed / 0.36));
    ctx.save();
    ctx.translate(cx, cy - 26);
    ctx.scale(logoPop, logoPop);
    drawGameLogoEmblem(ctx, 0, 0, 164, this.elapsed, 'showcase');
    ctx.restore();

    drawText(ctx, 'ONE MORE RUN · 15 分钟一局肉鸽足球经理', cx, cy + 62, {
      size: 14,
      bold: true,
      color: THEME.BRASS,
      align: 'center',
      rawSize: true,
    });

    const barW = 420;
    const barX = cx - barW / 2;
    const barY = cy + 96;
    drawRoundRect(ctx, barX + 3, barY + 3, barW, 12, 4, THEME.HARD_SHADOW);
    drawRoundRect(ctx, barX, barY, barW, 12, 4, THEME.BG_CARD_DARK, THEME.INK_LINE, 2);
    const fillW = Math.max(14, Math.round(barW * this.smoothProgress));
    drawRoundRect(ctx, barX + 2, barY + 2, Math.max(10, fillW - 4), 8, 3, THEME.LIME);

    const prog = AssetLoader.getProgress();
    const pct = Math.round(this.smoothProgress * 100);
    drawText(
      ctx,
      `正在整备战术资产 (${prog.loaded}/${prog.total}) · ${pct}%`,
      cx,
      barY + 32,
      { size: 13.5, color: THEME.TX2, align: 'center', rawSize: true }
    );
    if (this.elapsed >= 0.4) {
      drawText(ctx, '点击画面任意位置跳过开场', cx, h - 42, {
        size: 12.5,
        color: THEME.TX3,
        align: 'center',
        rawSize: true,
      });
    }
    ctx.restore();
  }
}
