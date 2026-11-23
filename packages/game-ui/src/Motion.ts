/**
 * 轻量动效、缓动函数、启动加载动画、屏幕震动与广播级转场控制器
 * 零外部依赖，60fps 纯 Canvas 2D 运行
 */

import { AssetLoader } from './AssetLoader';
import { drawRoundRect, drawText } from './CanvasKit';
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
 * 广播级斜切百叶窗转场（覆盖旧画面 -> 中点切换路由 -> 拉开揭示新画面 + 内容滑入）
 */
export class RouteTransition {
  private phase: 'idle' | 'in' | 'out' = 'idle';
  private timer = 0;
  private readonly inDuration = 0.16;
  private readonly outDuration = 0.26;
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
      alpha: 0.35 + 0.65 * p,
      offsetY: Math.round((1 - p) * 14),
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
      ctx.fillStyle = '#070B13';
      ctx.fill();

      ctx.strokeStyle = THEME.FLAME;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(rightX - 4, 0);
      ctx.lineTo(rightX - skew - 4, h);
      ctx.stroke();

      ctx.strokeStyle = THEME.GOLD_LIGHT;
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
      ctx.fillStyle = '#070B13';
      ctx.fill();

      ctx.strokeStyle = THEME.FLAME;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(leftX + 3, 0);
      ctx.lineTo(leftX - skew + 3, h);
      ctx.stroke();

      ctx.strokeStyle = THEME.GOLD_LIGHT;
      ctx.lineWidth = 2.5;
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
      drawRoundRect(ctx, w / 2 - 170, h / 2 - 26, 340, 52, 8, 'rgba(11, 17, 30, 0.94)', THEME.GOLD_LIGHT, 1.5);
      drawText(ctx, this.label, w / 2, h / 2, {
        size: 16,
        bold: true,
        italic: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
    }
    ctx.restore();
  }
}

/**
 * 绘制「再开一局 2026」游戏主 Logo 徽章（优先使用 game_logo 美术资源，未放置时自动呈现矢量金盾+足球+重开回环）
 */
export function drawGameLogoEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  timeSec = 0,
  shape: 'circle' | 'showcase' = 'circle'
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const r = size / 2;

  // 外圈炽金-烈焰呼吸光晕
  const pulse = 0.26 + 0.1 * Math.sin(timeSec * 2.5);
  const halo = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r * 1.38);
  halo.addColorStop(0, `rgba(250, 204, 21, ${pulse.toFixed(2)})`);
  halo.addColorStop(0.5, 'rgba(249, 115, 22, 0.14)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.38, 0, Math.PI * 2);
  ctx.fill();

  const logoImg = AssetLoader.get('game_logo');
  if (logoImg && typeof ctx.drawImage === 'function') {
    if (shape === 'showcase') {
      ctx.save();
      ctx.shadowColor = 'rgba(249, 115, 22, 0.45)';
      ctx.shadowBlur = 22;
      ctx.drawImage(logoImg, -r, -r, size, size);
      ctx.restore();
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(250, 204, 21, 0.35)';
      ctx.shadowBlur = 10;
      ctx.drawImage(logoImg, -r, -r, size, size);
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // 矢量金盾底板
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.96);
  ctx.lineTo(r * 0.84, -r * 0.62);
  ctx.quadraticCurveTo(r * 0.86, r * 0.34, 0, r * 0.96);
  ctx.quadraticCurveTo(-r * 0.86, r * 0.34, -r * 0.84, -r * 0.62);
  ctx.closePath();
  const shieldGrad = ctx.createLinearGradient(0, -r, 0, r);
  shieldGrad.addColorStop(0, '#162442');
  shieldGrad.addColorStop(0.55, '#0B1325');
  shieldGrad.addColorStop(1, '#060A12');
  ctx.fillStyle = shieldGrad;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = THEME.GOLD_LIGHT;
  ctx.stroke();

  // 旋转「再开一局」金色回环箭头
  ctx.save();
  ctx.rotate(timeSec * 0.35);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = Math.max(2.2, size * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -r * 0.04, r * 0.56, -Math.PI * 0.72, Math.PI * 0.92);
  ctx.stroke();
  const tipAng = Math.PI * 0.92;
  const tx = Math.cos(tipAng) * r * 0.56;
  const ty = -r * 0.04 + Math.sin(tipAng) * r * 0.56;
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.moveTo(tx + Math.cos(tipAng + 1.4) * r * 0.18, ty + Math.sin(tipAng + 1.4) * r * 0.18);
  ctx.lineTo(tx + Math.cos(tipAng - 0.55) * r * 0.16, ty + Math.sin(tipAng - 0.55) * r * 0.16);
  ctx.lineTo(tx + Math.cos(tipAng + 2.55) * r * 0.15, ty + Math.sin(tipAng + 2.55) * r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 中心几何足球
  const br = r * 0.31;
  const ballY = -r * 0.04;
  const ballGrad = ctx.createRadialGradient(-br * 0.3, ballY - br * 0.3, br * 0.1, 0, ballY, br);
  ballGrad.addColorStop(0, '#FFFFFF');
  ballGrad.addColorStop(0.75, '#CBD5E1');
  ballGrad.addColorStop(1, '#64748B');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(0, ballY, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // 中心五边形球皮
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const px = Math.cos(a) * br * 0.44;
    const py = ballY + Math.sin(a) * br * 0.44;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // 底部 2026 小徽标
  const pillW = r * 0.72;
  const pillH = Math.max(12, r * 0.24);
  drawRoundRect(ctx, -pillW / 2, r * 0.54, pillW, pillH, 4, '#0B111E', '#D4A843', 1.2);
  drawText(ctx, '2026', 0, r * 0.54 + pillH / 2 + 0.5, {
    size: Math.max(8, Math.round(r * 0.17)),
    bold: true,
    color: '#FACC15',
    align: 'center',
    mono: true,
  });

  ctx.restore();
}

/**
 * 进入游戏的启动加载动画（跟踪资源加载进度 -> 金色光幕拉开进入主页）
 */
export class BootIntro {
  private state: 'loading' | 'opening' | 'done' = 'loading';
  private elapsed = 0;
  private smoothProgress = 0;
  private openTimer = 0;
  private readonly minLoadSec = 1.25;
  private readonly openDuration = 0.55;
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
      // 即使本地秒加载也保留平滑动画推进感
      const timeGate = Math.min(1, this.elapsed / this.minLoadSec);
      const effectiveTarget = Math.min(target, timeGate);
      this.smoothProgress += (effectiveTarget - this.smoothProgress) * Math.min(1, dtSec * 8);

      if (this.elapsed >= this.minLoadSec && (target >= 0.95 || this.elapsed >= 2.2)) {
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
      ctx.fillStyle = '#060A12';
      ctx.fillRect(0, 0, w, halfH);
      ctx.fillRect(0, h - halfH, w, halfH);

      ctx.strokeStyle = THEME.GOLD_LIGHT;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.moveTo(0, halfH);
      ctx.lineTo(w, halfH);
      ctx.moveTo(0, h - halfH);
      ctx.lineTo(w, h - halfH);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Loading 阶段背景（stadium_bg 加载好即刻渐显）
    ctx.fillStyle = '#060A12';
    ctx.fillRect(0, 0, w, h);
    const bg = AssetLoader.get('stadium_bg');
    if (bg && typeof ctx.drawImage === 'function') {
      ctx.save();
      const scale = 1.05 - 0.05 * Math.min(1, this.elapsed / 1.5);
      const dw = w * scale;
      const dh = h * scale;
      ctx.globalAlpha = Math.min(0.45, this.elapsed * 0.42);
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.restore();
    }

    // 球场双侧炽金-烈焰橙红探照灯交叉扫光
    for (let bi = 0; bi < 2; bi++) {
      const ox = bi === 0 ? w * 0.16 : w * 0.84;
      const sx = w * 0.5 + Math.sin(this.elapsed * 1.4 + bi * Math.PI) * 190;
      const beam = ctx.createLinearGradient(ox, 0, sx, h * 0.88);
      beam.addColorStop(0, bi === 0 ? 'rgba(250, 204, 21, 0.15)' : 'rgba(249, 115, 22, 0.13)');
      beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(ox - 18, 0);
      ctx.lineTo(ox + 18, 0);
      ctx.lineTo(sx + 180, h);
      ctx.lineTo(sx - 180, h);
      ctx.closePath();
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, 680);
    vignette.addColorStop(0, 'rgba(8, 12, 20, 0.22)');
    vignette.addColorStop(1, 'rgba(6, 10, 18, 0.94)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // 飘升炽金与火星尘埃
    for (let pi = 0; pi < 20; pi++) {
      const px = ((pi * 97 + Math.sin(this.elapsed * 0.8 + pi) * 24) % w + w) % w;
      const py = h - ((this.elapsed * (52 + (pi % 4) * 18) + pi * 55) % h);
      const pa = 0.2 + 0.26 * Math.sin(this.elapsed * 3.2 + pi);
      ctx.fillStyle = pi % 3 === 0
        ? `rgba(249, 115, 22, ${Math.max(0.06, pa).toFixed(2)})`
        : `rgba(250, 204, 21, ${Math.max(0.06, pa).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.4 + (pi % 2) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 旋转高燃双环 + 完整展示主 Logo
    const cx = w / 2;
    const cy = h / 2 - 44;
    ctx.save();
    ctx.translate(cx, cy - 26);
    ctx.rotate(this.elapsed * 1.1);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.34)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-this.elapsed * 1.9);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.34)';
    ctx.beginPath();
    ctx.arc(0, 0, 112, 0, Math.PI * 1.35);
    ctx.stroke();
    ctx.restore();

    const logoPop = easeOutBack(Math.min(1, this.elapsed / 0.45));
    ctx.save();
    ctx.translate(cx, cy - 26);
    ctx.scale(logoPop, logoPop);
    drawGameLogoEmblem(ctx, 0, 0, 152, this.elapsed, 'showcase');
    ctx.restore();

    const hasArtLogo = !!AssetLoader.get('game_logo');
    const titleReveal = easeOutCubic(Math.min(1, this.elapsed / 0.52));
    ctx.globalAlpha = titleReveal;
    const ty = cy + 72 + (1 - titleReveal) * 12;
    if (hasArtLogo) {
      drawText(ctx, 'ONE MORE RUN · 15 分钟一局肉鸽足球经理', cx, ty + 2, {
        size: 13,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
    } else {
      drawText(ctx, 'ONE MORE RUN · FOOTBALL ROGUELIKE', cx, ty - 14, {
        size: 11,
        bold: true,
        color: THEME.FLAME_LIGHT,
        align: 'center',
        mono: true,
      });
      drawText(ctx, '再开一局 2026', cx, ty + 14, {
        size: 36,
        bold: true,
        italic: true,
        color: THEME.TX1,
        align: 'center',
      });
    }

    // 烈焰金渐变进度条与加载提示
    const barW = 400;
    const barX = cx - barW / 2;
    const barY = cy + 106;
    drawRoundRect(ctx, barX, barY, barW, 8, 4, 'rgba(30, 41, 59, 0.85)', 'rgba(249, 115, 22, 0.5)');
    const fillW = Math.max(12, Math.round(barW * this.smoothProgress));
    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    barGrad.addColorStop(0, '#DC2626');
    barGrad.addColorStop(0.45, '#F97316');
    barGrad.addColorStop(0.8, '#FACC15');
    barGrad.addColorStop(1, '#FEF08A');
    drawRoundRect(ctx, barX, barY, fillW, 8, 4, barGrad);

    const prog = AssetLoader.getProgress();
    const pct = Math.round(this.smoothProgress * 100);
    drawText(
      ctx,
      `正在点亮球场灯光与战术资产 (${prog.loaded}/${prog.total}) · ${pct}%`,
      cx,
      barY + 26,
      { size: 12, color: THEME.TX2, align: 'center' }
    );
    if (this.elapsed >= 0.4) {
      drawText(ctx, '点击画面任意位置可跳过开场', cx, h - 42, {
        size: 11,
        color: THEME.TX3,
        align: 'center',
      });
    }
    ctx.restore();
  }
}
