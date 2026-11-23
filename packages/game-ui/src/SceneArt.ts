/**
 * @fm-league/game-ui 统一暗调转播风自定义插画渲染层
 * 当外部新美术资源尚未放入 assets/art/ 时，提供与 UI 完全统一的高精矢量场景、故事线与奖励插画
 * 零旧项目废弃图片依赖
 */

import { THEME } from './Theme';
import { drawTrophyIcon } from './ClubVisuals';
import { drawIcon } from './VectorIcons';

export function drawTitleStageArt(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  // 右侧荣耀阶梯金字塔剪影
  const cx = 960;
  const baseY = 580;
  for (let i = 0; i < 6; i++) {
    const w = 420 - i * 54;
    const h = 28;
    const y = baseY - i * 42;
    const alpha = 0.08 + i * 0.055;
    ctx.fillStyle = i === 5 ? 'rgba(250, 204, 21, 0.36)' : `rgba(212, 168, 67, ${alpha.toFixed(2)})`;
    ctx.fillRect(cx - w / 2, y, w, h);
    ctx.strokeStyle = i === 5 ? 'rgba(250, 204, 21, 0.65)' : 'rgba(212, 168, 67, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - w / 2, y, w, h);
  }

  // 顶部聚光灯束
  const beam = ctx.createRadialGradient(cx, 250, 12, cx, 320, 340);
  beam.addColorStop(0, 'rgba(250, 204, 21, 0.26)');
  beam.addColorStop(0.5, 'rgba(37, 99, 235, 0.10)');
  beam.addColorStop(1, 'rgba(8, 12, 20, 0)');
  ctx.fillStyle = beam;
  ctx.fillRect(520, 40, 760, 620);

  // 顶端冠军奖杯剪影
  drawTrophyIcon(ctx, cx, 290, 96, 'rgba(250, 204, 21, 0.85)', 'rgba(212, 168, 67, 0.95)');
  ctx.restore();
}

export function drawStoryIllustration(
  ctx: CanvasRenderingContext2D,
  storyId: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const accent =
    storyId === 'underdog' ? '#22C55E' :
    storyId === 'revenge' ? '#F87171' :
    storyId === 'veteran' ? '#FACC15' : '#38BDF8';

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(1, '#1E293B');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const glow = ctx.createRadialGradient(x + w * 0.5, y + h * 0.45, 6, x + w * 0.5, y + h * 0.45, w * 0.55);
  glow.addColorStop(0, `${accent}38`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);

  // 战术线框与徽记焦点
  ctx.strokeStyle = `${accent}44`;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 14, y + 14, w - 28, h - 28);
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 34, 0, Math.PI * 2);
  ctx.stroke();

  const iconName =
    storyId === 'underdog' ? 'sparkle' :
    storyId === 'revenge' ? 'sword' :
    storyId === 'veteran' ? 'trophy' : 'star';
  drawIcon(ctx, iconName, x + w / 2, y + h / 2, 34, accent);
  ctx.restore();
}

export function drawRewardIllustration(
  ctx: CanvasRenderingContext2D,
  isWin: boolean,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const col = isWin ? THEME.GOLD_LIGHT : '#38BDF8';
  const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w * 0.6);
  glow.addColorStop(0, isWin ? 'rgba(250, 204, 21, 0.28)' : 'rgba(56, 189, 248, 0.22)');
  glow.addColorStop(1, 'rgba(14, 22, 40, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = `${col}55`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 28, 0, Math.PI * 2);
  ctx.stroke();

  if (isWin) {
    drawTrophyIcon(ctx, x + w / 2, y + h / 2, 38, THEME.GOLD_LIGHT, THEME.GOLD);
  } else {
    drawIcon(ctx, 'craft', x + w / 2, y + h / 2, 30, '#38BDF8');
  }
  ctx.restore();
}

export function drawCraftBackdropArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 110);
  glow.addColorStop(0, 'rgba(212, 168, 67, 0.22)');
  glow.addColorStop(1, 'rgba(212, 168, 67, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(212, 168, 67, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
