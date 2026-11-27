/**
 * 纯 Canvas 2D 发行级转播绘图工具、斜切金属面板、导航壳与粒子系统
 * 零 DOM 依赖，零 Emoji 依赖，100% 兼容 Steam / Web / 微信小游戏
 */

import { CommandCard, ElementId, TACTICAL_ELEMENTS } from '../../core/src/CommandCards';
import { ArtAssetId, AssetLoader } from './AssetLoader';
import { drawClubCrest } from './ClubVisuals';
import { drawTitleStageArt } from './SceneArt';
import { SoundEngine } from './SoundEngine';
import { IS_MOBILE, THEME } from './Theme';
import { drawIcon, IconName } from './VectorIcons';

export interface HitRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
}

export class HitRegistry {
  private regions: HitRegion[] = [];
  public hoverX = -1;
  public hoverY = -1;
  public pointerDown = false;

  public clear(): void {
    this.regions = [];
  }

  public add(x: number, y: number, w: number, h: number, onClick: () => void): void {
    this.regions.push({ x, y, w, h, onClick });
  }

  /**
   * 移动端自动将手动热区中心扩展至至少 minSize×minSize（默认 44px），桌面端保持原尺寸
   */
  public addTouchTarget(
    x: number,
    y: number,
    w: number,
    h: number,
    onClick: () => void,
    minSize = 44
  ): void {
    if (!IS_MOBILE) {
      this.add(x, y, w, h, onClick);
      return;
    }
    const padX = w < minSize ? Math.ceil((minSize - w) / 2) : 0;
    const padY = h < minSize ? Math.ceil((minSize - h) / 2) : 0;
    this.add(x - padX, y - padY, w + padX * 2, h + padY * 2, onClick);
  }

  public isHovered(x: number, y: number, w: number, h: number): boolean {
    return (
      this.hoverX >= x &&
      this.hoverX <= x + w &&
      this.hoverY >= y &&
      this.hoverY <= y + h
    );
  }

  public handleClick(x: number, y: number): boolean {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        r.onClick();
        return true;
      }
    }
    return false;
  }
}

export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
  if (fill) {
    if (typeof fill === 'string' && (fill === THEME.BG_CARD || fill === THEME.BG_CARD_HOVER)) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, fill === THEME.BG_CARD_HOVER ? '#222E44' : '#1B2538');
      g.addColorStop(1, fill === THEME.BG_CARD_HOVER ? '#182133' : '#121927');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = fill;
    }
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  if (typeof fill === 'string' && (fill === THEME.BG_CARD || fill === THEME.BG_CARD_HOVER) && w > 24 && h > 24) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + rad, y + 1);
    ctx.lineTo(x + w - rad, y + 1);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 发行级 45 度斜切角金属/玻璃面板（支持渐变填充与顶部高光）
 */
export function drawChamferPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut = 12,
  fill: string | CanvasGradient = 'rgba(17, 23, 34, 0.92)',
  stroke: string = THEME.BORDER,
  lineWidth = 1,
  accentTop?: string
): void {
  const c = Math.min(cut, w / 3, h / 3);
  ctx.save();
  if (!IS_MOBILE && cut >= 8 && w > 80 && h > 40) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
  }
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();

  if (typeof fill === 'string' && (fill.includes('17, 23, 34') || fill.includes('14, 19, 29') || fill.includes('15, 21, 31') || fill === THEME.BG_PANEL || fill === THEME.BG_CARD)) {
    const pGrad = ctx.createLinearGradient(x, y, x, y + h);
    pGrad.addColorStop(0, 'rgba(24, 32, 48, 0.96)');
    pGrad.addColorStop(1, 'rgba(12, 17, 27, 0.96)');
    ctx.fillStyle = pGrad;
  } else {
    ctx.fillStyle = fill;
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (typeof fill === 'string' && (fill.includes('11, 17, 30') || fill.includes('14, 22, 40') || fill.includes('17, 25, 44') || fill.includes('17, 23, 34'))) {
    const carbon = AssetLoader.get('panel_carbon_bg');
    if (carbon && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.05;
      ctx.drawImage(carbon, x, y, w, h);
      ctx.restore();
    }
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.save();
  ctx.globalAlpha = accentTop ? 0.45 : 0.08;
  ctx.strokeStyle = accentTop || '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + c + 2, y + 1);
  ctx.lineTo(x + w - c - 2, y + 1);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/**
/**
 * 语义化字号 Token（按移动端/桌面端分别给定目标字号，配合 rawSize/token 避免二次阶梯放大）
 */
export const FONT = {
  DISPLAY: 30,
  HEADLINE: IS_MOBILE ? 24 : 20,
  TITLE: IS_MOBILE ? 18 : 15,
  BODY: IS_MOBILE ? 16 : 13,
  LABEL: IS_MOBILE ? 14 : 11,
  MICRO: IS_MOBILE ? 12.5 : 10,
} as const;

export type FontToken = keyof typeof FONT;

/**
 * 移动端小字阶梯放大（保留为旧代码兜底；新代码请使用 FONT token）
 */
export function mobileFontSize(size: number): number {
  if (!IS_MOBILE) return size;
  if (size <= 9) return 12.5;
  if (size <= 10.5) return 13.5;
  if (size <= 12) return 15;
  if (size <= 14) return 16.5;
  if (size <= 17) return size + 2;
  if (size <= 19) return size + 1.5;
  return size;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    token?: FontToken;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    mono?: boolean;
    rawSize?: boolean;
  } = {}
): void {
  const raw = opts.token ? FONT[opts.token] : (opts.size ?? 13);
  const size = opts.rawSize || opts.token ? raw : mobileFontSize(raw);
  const italic = opts.italic ? 'italic ' : '';
  const weight = opts.bold ? 'bold ' : '';
  const family = opts.mono ? THEME.NUM_FONT_FAMILY : THEME.FONT_FAMILY;
  ctx.font = `${italic}${weight}${size}px ${family}`;
  ctx.fillStyle = opts.color ?? THEME.TX1;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.fillText(text, x, y);
}

/**
 * 计算多行自动换行结果（可用于先测高再绘制背景框）
 */
export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size = 11,
  bold = false,
  maxLines = 3,
  rawSize = false
): string[] {
  const effSize = rawSize ? size : mobileFontSize(size);
  const weight = bold ? 'bold ' : '';
  ctx.font = `${weight}${effSize}px ${THEME.FONT_FAMILY}`;
  const tokens = text.match(/[A-Za-z0-9._%+-]+|\s+|[^\sA-Za-z0-9._%+-]/g) ?? [];
  const lines: string[] = [];
  let current = '';

  for (const tok of tokens) {
    if (/^\s+$/.test(tok) && current.length === 0) continue;
    const test = current + tok;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current.trimEnd());
      current = /^\s+$/.test(tok) ? '' : tok;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }
  if (current.trimEnd() && lines.length < maxLines) {
    lines.push(current.trimEnd());
  } else if (lines.length === maxLines && current.trim()) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

/**
 * 纯 Canvas 2D 多行自动换行文本绘制
 */
export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  opts: {
    size?: number;
    token?: FontToken;
    bold?: boolean;
    color?: string;
    maxLines?: number;
    rawSize?: boolean;
  } = {}
): number {
  const raw = opts.token ? FONT[opts.token] : (opts.size ?? 11);
  const useRaw = !!(opts.rawSize || opts.token);
  const effSize = useRaw ? raw : mobileFontSize(raw);
  const effLineHeight = IS_MOBILE ? Math.max(lineHeight, Math.round(effSize * 1.28)) : lineHeight;
  const lines = wrapTextLines(ctx, text, maxWidth, raw, !!opts.bold, opts.maxLines ?? 3, useRaw);
  ctx.fillStyle = opts.color ?? THEME.TX1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * effLineHeight);
  }
  return lines.length;
}

/**
 * 全局复用：极简灰阶微图标 + 运动数字组合（跨语言零膨胀）
 */
export function drawStatMicro(
  ctx: CanvasRenderingContext2D,
  icon: IconName,
  value: string,
  x: number,
  y: number,
  opts: {
    iconSize?: number;
    fontSize?: number;
    iconColor?: string;
    valueColor?: string;
    bold?: boolean;
    gap?: number;
  } = {}
): number {
  const baseFont = opts.fontSize ?? 11;
  const effFont = mobileFontSize(baseFont);
  const iconSize = IS_MOBILE ? Math.max(opts.iconSize ?? 11, Math.round(effFont * 0.92)) : (opts.iconSize ?? 11);
  const gap = opts.gap ?? 3;
  const iconColor = opts.iconColor ?? THEME.TX3;
  const valueColor = opts.valueColor ?? THEME.TX1;
  drawIcon(ctx, icon, x + iconSize / 2, y, iconSize, iconColor);
  drawText(ctx, value, x + iconSize + gap, y, {
    size: baseFont,
    bold: opts.bold,
    color: valueColor,
    mono: true,
  });
  ctx.font = `${opts.bold ? 'bold ' : ''}${effFont}px ${THEME.NUM_FONT_FAMILY}`;
  return iconSize + gap + ctx.measureText(value).width;
}

/**
 * 全局复用：极简细进度条（用于体能/熟练度等状态可视化）
 */
export function drawMiniBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fillColor: string,
  bgColor = 'rgba(255,255,255,0.08)'
): void {
  const r = Math.max(0, Math.min(1, ratio));
  drawRoundRect(ctx, x, y, w, h, h / 2, bgColor);
  if (r > 0) {
    drawRoundRect(ctx, x, y, Math.max(h, Math.round(w * r)), h, h / 2, fillColor);
  }
}

/**
 * 数值色条编码（替代纯数字对比；未指定颜色时按比例自动分级染色）
 */
export function drawStatBar(
  ctx: CanvasRenderingContext2D,
  value: number,
  max: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color?: string,
  bgColor = 'rgba(255,255,255,0.08)'
): void {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const fillColor =
    color ??
    (ratio >= 0.82 ? THEME.GOLD_LIGHT : ratio >= 0.7 ? THEME.GREEN : ratio >= 0.52 ? THEME.BLUE_LIGHT : '#64748B');
  drawMiniBar(ctx, x, y, w, h, ratio, fillColor, bgColor);
}

/**
 * 紧凑缩写标签 + 等宽数字组合（如 "射71"），返回实际占用宽度
 */
export function drawCompactStat(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string | number,
  x: number,
  y: number,
  opts: {
    labelColor?: string;
    valueColor?: string;
    labelToken?: FontToken;
    valueToken?: FontToken;
    gap?: number;
    bold?: boolean;
  } = {}
): number {
  const lToken = opts.labelToken ?? 'MICRO';
  const vToken = opts.valueToken ?? 'LABEL';
  const gap = opts.gap ?? 2;
  const valStr = String(value);

  drawText(ctx, label, x, y, {
    token: lToken,
    color: opts.labelColor ?? THEME.TX3,
  });
  ctx.font = `${FONT[lToken]}px ${THEME.FONT_FAMILY}`;
  const lw = ctx.measureText(label).width;

  const vx = x + lw + gap;
  drawText(ctx, valStr, vx, y, {
    token: vToken,
    bold: opts.bold ?? true,
    color: opts.valueColor ?? THEME.TX1,
    mono: true,
  });
  ctx.font = `${(opts.bold ?? true) ? 'bold ' : ''}${FONT[vToken]}px ${THEME.NUM_FONT_FAMILY}`;
  const vw = ctx.measureText(valStr).width;
  return lw + gap + vw;
}

/**
 * 升降箭头色块（替代 "+3/-2" 纯文本），返回实际占用宽度
 */
export function drawDeltaBadge(
  ctx: CanvasRenderingContext2D,
  delta: number,
  x: number,
  y: number,
  opts: {
    h?: number;
    minW?: number;
  } = {}
): number {
  const h = opts.h ?? (IS_MOBILE ? 20 : 18);
  const text = delta > 0 ? `▲+${delta}` : delta < 0 ? `▼${delta}` : '—';
  const bg = delta > 0 ? 'rgba(34, 197, 94, 0.18)' : delta < 0 ? 'rgba(220, 38, 38, 0.18)' : 'rgba(100, 116, 139, 0.16)';
  const fg = delta > 0 ? '#4ADE80' : delta < 0 ? '#F87171' : THEME.TX3;
  const border = delta > 0 ? 'rgba(74, 222, 128, 0.35)' : delta < 0 ? 'rgba(248, 113, 113, 0.35)' : 'rgba(148, 163, 184, 0.2)';

  ctx.font = `bold ${FONT.MICRO}px ${THEME.NUM_FONT_FAMILY}`;
  const w = Math.max(opts.minW ?? 34, Math.ceil(ctx.measureText(text).width) + 10);
  drawRoundRect(ctx, x, y - h / 2, w, h, 4, bg, border, 1);
  drawText(ctx, text, x + w / 2, y, {
    token: 'MICRO',
    bold: true,
    color: fg,
    align: 'center',
    mono: true,
  });
  return w;
}

/**
 * 排名分级色块（如冠军/欧战/降级区），返回占用宽度
 */
export function drawRankTile(
  ctx: CanvasRenderingContext2D,
  rank: number,
  tier: 'gold' | 'blue' | 'green' | 'red' | 'neutral',
  x: number,
  y: number,
  size = IS_MOBILE ? 24 : 22
): number {
  const palette: Record<typeof tier, { bg: string; fg: string; border: string }> = {
    gold: { bg: 'rgba(212, 168, 67, 0.22)', fg: THEME.GOLD_LIGHT, border: 'rgba(250, 204, 21, 0.45)' },
    blue: { bg: 'rgba(37, 99, 235, 0.22)', fg: '#7DD3FC', border: 'rgba(96, 165, 250, 0.45)' },
    green: { bg: 'rgba(34, 197, 94, 0.20)', fg: '#4ADE80', border: 'rgba(74, 222, 128, 0.40)' },
    red: { bg: 'rgba(220, 38, 38, 0.22)', fg: '#F87171', border: 'rgba(248, 113, 113, 0.45)' },
    neutral: { bg: 'rgba(30, 41, 59, 0.85)', fg: THEME.TX2, border: 'rgba(255, 255, 255, 0.08)' },
  };
  const pal = palette[tier];
  drawRoundRect(ctx, x, y - size / 2, size, size, 5, pal.bg, pal.border, 1);
  drawText(ctx, String(rank), x + size / 2, y, {
    token: 'LABEL',
    bold: true,
    color: pal.fg,
    align: 'center',
    mono: true,
  });
  return size;
}

export type ButtonVariant = 'gold' | 'primary' | 'ghost' | 'danger' | 'green';

export function drawButton(
  ctx: CanvasRenderingContext2D,
  hits: HitRegistry,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: {
    variant?: ButtonVariant;
    disabled?: boolean;
    active?: boolean;
    fontSize?: number;
    icon?: IconName;
  } = {}
): void {
  const variant = opts.variant ?? 'ghost';
  const hovered = !opts.disabled && hits.isHovered(x, y, w, h);

  let topCol = '#1E283B';
  let midCol = '#151D2D';
  let botCol = '#0F1521';
  let border: string = 'rgba(255,255,255,0.09)';
  let textColor: string = THEME.TX1;

  if (variant === 'gold') {
    topCol = hovered ? '#FCE07A' : '#F3C14B';
    midCol = hovered ? '#E59A1D' : '#D48315';
    botCol = hovered ? '#C46F0C' : '#AD5C08';
    border = hovered ? '#FDE68A' : 'rgba(250, 204, 21, 0.72)';
    textColor = '#0A0E17';
  } else if (variant === 'primary') {
    topCol = hovered ? '#3B72C4' : '#2D5DA6';
    midCol = hovered ? '#29579C' : '#214885';
    botCol = hovered ? '#1E437A' : '#183666';
    border = 'rgba(96, 165, 250, 0.45)';
  } else if (variant === 'green') {
    topCol = hovered ? '#27B860' : '#1E9E51';
    midCol = hovered ? '#1E964D' : '#177D40';
    botCol = hovered ? '#16753B' : '#115E30';
    border = 'rgba(74, 222, 128, 0.45)';
  } else if (variant === 'danger') {
    topCol = hovered ? '#E04848' : '#BE2E2E';
    midCol = hovered ? '#BD2F2F' : '#9E2222';
    botCol = hovered ? '#962020' : '#7D1919';
    border = 'rgba(248, 113, 113, 0.45)';
  } else {
    topCol = opts.active ? '#284575' : hovered ? '#243047' : '#1B2333';
    midCol = opts.active ? '#1E355C' : hovered ? '#1A2438' : '#141B29';
    botCol = opts.active ? '#162745' : hovered ? '#131B2B' : '#0F1521';
    border = opts.active ? 'rgba(212,168,67,0.52)' : hovered ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)';
    textColor = opts.active ? '#FDE68A' : THEME.TX1;
  }

  if (opts.disabled) {
    topCol = '#141923';
    midCol = '#10141D';
    botCol = '#0C1017';
    border = 'rgba(255,255,255,0.04)';
    textColor = THEME.TX3;
  }

  const pressed = hovered && hits.pointerDown;
  const dy = pressed ? 1 : hovered ? -1 : 0;
  const grad = ctx.createLinearGradient(x, y + dy, x, y + dy + h);
  grad.addColorStop(0, topCol);
  grad.addColorStop(0.52, midCol);
  grad.addColorStop(1, botCol);

  const accent = !opts.disabled && (variant === 'gold' || variant === 'primary' || variant === 'green' || opts.active)
    ? 'rgba(255,255,255,0.34)'
    : undefined;
  ctx.save();
  if (!IS_MOBILE && hovered && !opts.disabled && variant === 'gold') {
    ctx.shadowColor = 'rgba(243, 193, 75, 0.30)';
    ctx.shadowBlur = 10;
  }
  drawChamferPanel(ctx, x, y + dy, w, h, 6, grad, border, opts.active ? 1.3 : 1, accent);
  ctx.restore();

  const fSize = opts.fontSize ?? 13;
  const effFSize = mobileFontSize(fSize);
  if (opts.icon && label) {
    const iconSize = Math.max(12, Math.round(effFSize * 1.02));
    ctx.font = `bold ${effFSize}px ${THEME.FONT_FAMILY}`;
    const tw = ctx.measureText(label).width;
    const totalW = iconSize + 6 + tw;
    const startX = x + (w - totalW) / 2;
    drawIcon(ctx, opts.icon, startX + iconSize / 2, y + dy + h / 2, iconSize, textColor);
    drawText(ctx, label, startX + iconSize + 6, y + dy + h / 2, {
      size: fSize,
      bold: true,
      color: textColor,
      align: 'left',
    });
  } else if (opts.icon) {
    drawIcon(ctx, opts.icon, x + w / 2, y + dy + h / 2, Math.max(14, Math.round(fSize * 1.15)), textColor);
  } else {
    drawText(ctx, label, x + w / 2, y + dy + h / 2, {
      size: fSize,
      bold: true,
      color: textColor,
      align: 'center',
    });
  }

  if (!opts.disabled) {
    const padX = IS_MOBILE ? (w < 44 ? Math.ceil((44 - w) / 2) : 4) : 0;
    const padY = IS_MOBILE ? (h < 44 ? Math.ceil((44 - h) / 2) : 4) : 0;
    hits.add(x - padX, y - padY, w + padX * 2, h + padY * 2, () => {
      SoundEngine.playClick();
      onClick();
    });
  }
}

/**
 * 转播级顶部主栏（预留右侧微信胶囊安全区）
 */
export function drawBroadcastHeader(
  ctx: CanvasRenderingContext2D,
  hits: HitRegistry,
  opts: {
    kicker: string;
    title: string;
    club?: { id: string; primaryColor: string; secondaryColor: string };
    badge?: string;
    metaPoints?: number;
    clubFunds?: number;
    onBack?: () => void;
    backLabel?: string;
    rightAction?: { label: string; icon?: IconName; variant?: ButtonVariant; onClick: () => void };
    showSoundToggle?: boolean;
  }
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, 68);
  grad.addColorStop(0, 'rgba(13, 21, 38, 0.96)');
  grad.addColorStop(1, 'rgba(8, 13, 24, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, THEME.W, 68);

  ctx.strokeStyle = 'rgba(212, 168, 67, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 68);
  ctx.lineTo(THEME.W, 68);
  ctx.stroke();

  let lx = 20;
  if (opts.onBack) {
    drawButton(ctx, hits, lx, 16, 92, 36, opts.backLabel || '返回', opts.onBack, {
      variant: 'ghost',
      fontSize: 12,
    });
    lx += 106;
  }
  if (opts.club) {
    drawClubCrest(ctx, lx + 18, 34, 17, opts.club);
    lx += 46;
  }

  // 右侧操作区宽度预估（严格控制在 x <= 1140，为微信右上角胶囊留白）
  let rightReserve = 0;
  if (opts.showSoundToggle) rightReserve += 92;
  if (opts.rightAction) rightReserve += 148;
  const rightEdge = 1140 - rightReserve - 16;

  // 先测量徽章宽度，标题根据剩余空间自动截断，徽章始终排在标题之后，避免重叠
  ctx.font = `bold 10px ${THEME.FONT_FAMILY}`;
  const badgeW = opts.badge ? Math.max(96, Math.ceil(ctx.measureText(opts.badge).width) + 20) : 0;
  const metaLabel = opts.metaPoints !== undefined ? `PT ${opts.metaPoints}` : '';
  const metaW = metaLabel ? Math.max(76, Math.ceil(ctx.measureText(metaLabel).width) + 20) : 0;
  const fundsLabel = opts.clubFunds !== undefined ? formatFunds(opts.clubFunds) : '';
  const fundsW = fundsLabel ? Math.max(92, Math.ceil(ctx.measureText(fundsLabel).width) + 20) : 0;
  const badgesW = (badgeW ? badgeW + 10 : 0) + (metaW ? metaW + 10 : 0) + (fundsW ? fundsW + 10 : 0);
  const titleMax = Math.max(120, rightEdge - lx - badgesW - 18);

  drawText(ctx, fitText(ctx, opts.kicker, titleMax + badgesW, 10, true), lx, 20, { size: 10, bold: true, color: THEME.GOLD, mono: true });
  const title = fitText(ctx, opts.title, titleMax, 18, true);
  drawText(ctx, title, lx, 43, { size: 18, bold: true, color: THEME.TX1 });
  ctx.font = `bold 18px ${THEME.FONT_FAMILY}`;
  const titleW = ctx.measureText(title).width;

  let bx = lx + Math.min(titleMax + 18, Math.max(210, titleW + 18));
  if (opts.badge) {
    drawBadge(ctx, bx, 32, badgeW, 22, opts.badge, '#1E3A5F', THEME.GOLD_LIGHT);
    bx += badgeW + 10;
  }
  if (fundsLabel) {
    drawBadge(ctx, bx, 32, fundsW, 22, fundsLabel, 'rgba(20, 83, 45, 0.72)', THEME.GREEN);
    bx += fundsW + 10;
  }
  if (metaLabel) {
    drawBadge(ctx, bx, 32, metaW, 22, metaLabel, 'rgba(212,168,67,0.16)', THEME.GOLD_LIGHT);
  }

  let rx = 1140;
  if (opts.showSoundToggle) {
    rx -= 82;
    drawButton(
      ctx,
      hits,
      rx,
      16,
      82,
      36,
      SoundEngine.getAudioModeLabel(),
      () => SoundEngine.cycleAudioMode(),
      { variant: 'ghost', fontSize: 11, icon: SoundEngine.muted ? 'sound_off' : 'sound_on' }
    );
    rx -= 10;
  }
  if (opts.rightAction) {
    const rw = 148;
    rx -= rw;
    drawButton(ctx, hits, rx, 16, rw, 36, opts.rightAction.label, opts.rightAction.onClick, {
      variant: opts.rightAction.variant ?? 'gold',
      icon: opts.rightAction.icon,
      fontSize: 13,
    });
  }
}

export function formatFunds(amount: number): string {
  return `¥${Math.round(amount)}万`;
}

export type NavRailTab = 'portal' | 'league' | 'tactics' | 'cards' | 'transfer_hub' | 'meta' | 'hof' | 'title';

/**
 * 统一左侧垂直导航轨道（门户/联赛/战术/合成/引援/基建/荣誉/主页）
 */
export function drawNavRail(
  ctx: CanvasRenderingContext2D,
  hits: HitRegistry,
  activeTab: NavRailTab,
  onNavigate: (tab: NavRailTab) => void
): void {
  drawChamferPanel(ctx, 14, 80, 68, 624, 10, 'rgba(14, 19, 29, 0.94)', THEME.BORDER, 1);
  const items: Array<{ key: NavRailTab; label: string; icon: IconName }> = [
    { key: 'portal', label: '门户', icon: 'ball' },
    { key: 'league', label: '联赛', icon: 'chart' },
    { key: 'tactics', label: '战术', icon: 'tactics' },
    { key: 'transfer_hub', label: '引援', icon: 'refresh' },
    { key: 'meta', label: '星盘', icon: 'talent' },
    { key: 'hof', label: '荣誉', icon: 'trophy' },
  ];

  items.forEach((item, i) => {
    const iy = 92 + i * 70;
    const isAct = activeTab === item.key;
    const hovered = hits.isHovered(20, iy, 56, 60);
    if (isAct) {
      drawRoundRect(ctx, 20, iy, 56, 60, 8, 'rgba(212,168,67,0.12)', 'rgba(212,168,67,0.28)', 1);
      drawRoundRect(ctx, 14, iy + 12, 3, 36, 1.5, THEME.GOLD_LIGHT);
    } else if (hovered) {
      drawRoundRect(ctx, 20, iy, 56, 60, 8, 'rgba(255,255,255,0.05)', THEME.BORDER);
    }
    const col = isAct ? THEME.GOLD_LIGHT : hovered ? THEME.TX1 : THEME.TX2;
    drawIcon(ctx, item.icon, 48, iy + 22, 18, col);
    drawText(ctx, item.label, 48, iy + 45, { size: 11, bold: isAct, color: col, align: 'center' });
    const navPad = IS_MOBILE ? 6 : 0;
    hits.add(20 - navPad, iy - navPad / 2, 56 + navPad * 2, 60 + navPad, () => {
      SoundEngine.playClick();
      onNavigate(item.key);
    });
  });

  // 底部返回主页按钮
  const hy = 632;
  const hHover = hits.isHovered(20, hy, 56, 58);
  if (hHover) drawRoundRect(ctx, 20, hy, 56, 58, 8, 'rgba(30,45,77,0.7)', THEME.BORDER);
  drawIcon(ctx, 'home', 48, hy + 20, 18, hHover ? THEME.TX1 : THEME.TX2);
  drawText(ctx, '主页', 48, hy + 44, { size: 10.5, color: hHover ? THEME.TX1 : THEME.TX2, align: 'center' });
  const homePad = IS_MOBILE ? 6 : 0;
  hits.add(20 - homePad, hy - homePad / 2, 56 + homePad * 2, 58 + homePad, () => {
    SoundEngine.playClick();
    onNavigate('title');
  });
}

/**
 * 全局场景背景绘制（支持 Ken Burns 呼吸微动与球场灯尘粒子）
 */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  assetId?: ArtAssetId,
  timeSec = 0,
  brighten = false
): void {
  ctx.fillStyle = THEME.BG_DEEP;
  ctx.fillRect(0, 0, THEME.W, THEME.H);

  const img = assetId ? AssetLoader.get(assetId) : null;
  if (img && typeof ctx.drawImage === 'function') {
    ctx.save();
    const scale = timeSec > 0 ? 1.015 + Math.sin(timeSec * 0.35) * 0.015 : 1;
    const dw = THEME.W * scale;
    const dh = THEME.H * scale;
    const dx = (THEME.W - dw) / 2;
    const dy = (THEME.H - dh) / 2;
    ctx.globalAlpha = brighten ? 0.68 : 0.45;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    ctx.fillStyle = brighten ? 'rgba(8, 12, 20, 0.28)' : 'rgba(8, 12, 20, 0.46)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);

    // 球场夜赛常驻微弱光尘漂浮
    if (timeSec > 0 && brighten) {
      ctx.save();
      for (let i = 0; i < 16; i++) {
        const px = ((i * 97 + timeSec * (10 + (i % 4) * 4)) % (THEME.W + 40)) - 20;
        const py = THEME.H - ((i * 61 + timeSec * (18 + (i % 5) * 5)) % THEME.H);
        const alpha = 0.14 + 0.12 * Math.sin(timeSec * 2 + i);
        ctx.fillStyle = i % 3 === 0 ? `rgba(250, 204, 21, ${alpha.toFixed(2)})` : `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else {
    const grad = ctx.createRadialGradient(THEME.W * 0.5, 40, 60, THEME.W * 0.5, 280, 760);
    grad.addColorStop(0, 'rgba(30, 58, 95, 0.28)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.14)');
    grad.addColorStop(1, 'rgba(8, 12, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    if (assetId === 'bg_title') {
      drawTitleStageArt(ctx);
    }
  }
}

export function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  bg: string,
  color = '#FFFFFF'
): void {
  // 保持调用方指定的锚点与宽度，移动端在不截断的前提下优先使用更大字号
  const pad = w <= 36 ? 4 : 8;
  const innerMax = Math.max(10, w - pad);
  const candidates = IS_MOBILE ? [13.5, 12.5, 11.5, 10.5, 9.5] : [10, 9, 8];
  let fontSize = candidates[candidates.length - 1];
  for (const s of candidates) {
    ctx.font = `bold ${s}px ${THEME.FONT_FAMILY}`;
    if (ctx.measureText(text).width <= innerMax) {
      fontSize = s;
      break;
    }
  }
  const label = fitText(ctx, text, innerMax, fontSize, true, true);
  drawRoundRect(ctx, x, y, w, h, Math.min(6, h / 2), bg, 'rgba(255,255,255,0.08)', 0.8);
  drawText(ctx, label, x + w / 2, y + h / 2, {
    size: fontSize,
    bold: true,
    color,
    align: 'center',
    rawSize: true,
  });
}

export function getCommandCardArtId(card: CommandCard): ArtAssetId {
  if (card.id === 'card_captain_roar' || card.name.includes('老队长')) return 'cmd_captain_roar';
  if (card.mechanic === 'iron_wall_block') return 'cmd_iron_wall';
  if (card.mechanic === 'gk_counter_launch') return 'cmd_gk_launch';
  if (card.mechanic === 'set_piece_nuke') return 'cmd_set_piece';
  if (card.mechanic === 'super_sub') return 'cmd_super_sub';
  if (card.mechanic === 'offside_trap') return 'cmd_offside_trap';
  if (card.mechanic === 'tiki_taka_flow') return 'cmd_tiki_taka';
  if (card.mechanic === 'high_press_blitz') return 'cmd_gegenpress';
  if (card.mechanic === 'long_shot_cannon') return 'cmd_long_shot';
  if (card.mechanic === 'blood_frenzy') return 'cmd_blood_frenzy';
  if (card.mechanic === 'wing_overload') return 'cmd_wing_play';
  const first = card.recipeKey?.split('+')[0];
  if (first === 'press') return 'cmd_gegenpress';
  if (first === 'pass') return 'cmd_tiki_taka';
  if (first === 'wing') return 'cmd_wing_play';
  if (first === 'iron') return 'cmd_iron_wall';
  if (first === 'blitz') return 'cmd_blitz';
  return card.isCorrupted ? 'cmd_blood_frenzy' : 'cmd_tiki_taka';
}

export function getCommandCardElemId(card: CommandCard): ElementId {
  const first = card.recipeKey?.split('+')[0] as ElementId | undefined;
  if (first && TACTICAL_ELEMENTS.some(e => e.id === first)) return first;
  if (card.targetLine === 'GK' || card.targetLine === 'DEF') return 'iron';
  if (card.targetLine === 'ATT') return 'blitz';
  return 'pass';
}

/**
 * 按最大宽度截断文本（超出补省略号）
 */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  bold = false,
  rawSize = false
): string {
  const effSize = rawSize ? size : mobileFontSize(size);
  ctx.font = `${bold ? 'bold ' : ''}${effSize}px ${THEME.FONT_FAMILY}`;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

export function tierColor(tier: 'S' | 'A' | 'B' | 'C'): string {
  if (tier === 'S') return '#D4A843';
  if (tier === 'A') return '#A855F7';
  if (tier === 'B') return '#2563EB';
  return '#475569';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export class ParticleSystem {
  private particles: Particle[] = [];

  public burst(x: number, y: number, color: string = THEME.GOLD_LIGHT, count = 18): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = 60 + Math.random() * 160;
      const maxLife = 0.45 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 40,
        life: maxLife,
        maxLife,
        size: 2.5 + Math.random() * 3,
        color,
      });
    }
  }

  public update(dtSec: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 220 * dtSec;
      p.life -= dtSec;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * 动态斜向扫光（Foil Shimmer），用于 S/A 级星卡、稀有成就与圆满编年史卡片
 */
export function drawFoilShimmer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  timeSec: number,
  color = 'rgba(250, 204, 21, 0.24)'
): void {
  const cycle = (timeSec * 0.45) % 2.6;
  if (cycle > 1.2) return;
  const p = cycle / 1.2;
  const bandX = x - w * 0.35 + (w * 1.7) * p;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
  ctx.clip();
  const grad = ctx.createLinearGradient(bandX - 36, y, bandX + 36, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
