/**
 * 纯 Canvas 2D PITCH PRINT v1.0 绘图工具、暖纸实体卡、橡胶印章、离线纹理与粒子系统
 * 零 DOM 依赖，零 Emoji 依赖，零每帧 shadowBlur / ctx.filter，100% 兼容 Steam / Web / 微信小游戏
 */

import { CommandCard, ElementId, TACTICAL_ELEMENTS } from '../../core/src/CommandCards';
import { ArtAssetId, AssetLoader, getDirectiveAssetId, getSkillAssetId } from './AssetLoader';

export const getActiveSkillArtId = getSkillAssetId;
export const getDirectiveArtId = getDirectiveAssetId;
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
   * 触控热区兜底：至少扩展至 minSize×minSize（默认 44×44 设计像素）
   */
  public addTouchTarget(
    x: number,
    y: number,
    w: number,
    h: number,
    onClick: () => void,
    minSize = 44
  ): void {
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

// ==================== 离屏 Pattern 缓存（64×64，禁止每帧重建） ====================
let halftoneDarkPattern: CanvasPattern | null | undefined;
let halftoneLightPattern: CanvasPattern | null | undefined;
let paperGrainPattern: CanvasPattern | null | undefined;

function createOffscreenCanvas(size: number): HTMLCanvasElement | null {
  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      return c;
    }
  } catch {
    return null;
  }
  return null;
}

export function getHalftonePattern(ctx: CanvasRenderingContext2D, dark = true): CanvasPattern | null {
  if (dark && halftoneDarkPattern !== undefined) return halftoneDarkPattern;
  if (!dark && halftoneLightPattern !== undefined) return halftoneLightPattern;

  const off = createOffscreenCanvas(16);
  const octx = off?.getContext('2d');
  if (!off || !octx) {
    if (dark) halftoneDarkPattern = null;
    else halftoneLightPattern = null;
    return null;
  }

  octx.clearRect(0, 0, 16, 16);
  octx.fillStyle = dark ? 'rgba(7, 16, 12, 0.30)' : 'rgba(17, 20, 18, 0.12)';
  const dots: Array<[number, number, number]> = [
    [4, 4, 1.5],
    [12, 12, 1.5],
    [12, 4, 1.0],
    [4, 12, 1.0],
  ];
  for (const [dx, dy, r] of dots) {
    octx.beginPath();
    octx.arc(dx, dy, r, 0, Math.PI * 2);
    octx.fill();
  }

  const pat = ctx.createPattern(off, 'repeat');
  if (dark) halftoneDarkPattern = pat;
  else halftoneLightPattern = pat;
  return pat;
}

export function getPaperGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (paperGrainPattern !== undefined) return paperGrainPattern;
  const off = createOffscreenCanvas(64);
  const octx = off?.getContext('2d');
  if (!off || !octx) {
    paperGrainPattern = null;
    return null;
  }

  octx.clearRect(0, 0, 64, 64);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 110; i++) {
    const gx = Math.floor(rand() * 64);
    const gy = Math.floor(rand() * 64);
    octx.fillStyle = rand() > 0.5 ? 'rgba(20, 25, 22, 0.035)' : 'rgba(255, 255, 255, 0.045)';
    octx.fillRect(gx, gy, 1, 1);
  }
  paperGrainPattern = ctx.createPattern(off, 'repeat');
  return paperGrainPattern;
}

export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string | CanvasGradient | CanvasPattern,
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
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * PITCH PRINT 硬墨线斜切面板（禁用 shadowBlur，改用纯色硬偏移底影 #07100C）
 */
export function drawChamferPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut = 10,
  fill: string | CanvasGradient = THEME.BG_PANEL,
  stroke: string = THEME.INK_LINE,
  lineWidth = 2,
  accentTop?: string
): void {
  const c = Math.min(cut, w / 3, h / 3);
  const traceChamfer = (ox: number, oy: number) => {
    ctx.beginPath();
    ctx.moveTo(x + ox + c, y + oy);
    ctx.lineTo(x + ox + w - c, y + oy);
    ctx.lineTo(x + ox + w, y + oy + c);
    ctx.lineTo(x + ox + w, y + oy + h - c);
    ctx.lineTo(x + ox + w - c, y + oy + h);
    ctx.lineTo(x + ox + c, y + oy + h);
    ctx.lineTo(x + ox, y + oy + h - c);
    ctx.lineTo(x + ox, y + oy + c);
    ctx.closePath();
  };

  ctx.save();
  if (cut >= 6 && w > 64 && h > 36) {
    traceChamfer(4, 4);
    ctx.fillStyle = THEME.HARD_SHADOW;
    ctx.fill();
  }

  traceChamfer(0, 0);
  ctx.fillStyle = fill;
  ctx.fill();

  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  if (accentTop) {
    ctx.strokeStyle = accentTop;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + c + 2, y + 2);
    ctx.lineTo(x + w - c - 2, y + 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * PITCH PRINT 实体档案卡 / 暖纸卡绘制（硬阴影 + 2.5px 墨线 + 纸噪点 + 可选顶部色带/半调网点）
 */
export function drawPrintCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    paper?: boolean;
    topBandColor?: string;
    topBandHeight?: number;
    halftone?: boolean;
    radius?: number;
    shadowOffset?: number;
    strokeColor?: string;
    lineWidth?: number;
  } = {}
): void {
  const paper = opts.paper ?? true;
  const radius = opts.radius ?? 3;
  const shadowOffset = opts.shadowOffset ?? 5;
  const strokeColor = opts.strokeColor ?? THEME.INK_LINE;
  const lineWidth = opts.lineWidth ?? 2.5;
  const fillCol = paper ? THEME.PAPER_CREAM : THEME.BG_CARD_DARK;

  ctx.save();
  if (shadowOffset > 0) {
    drawRoundRect(ctx, x + shadowOffset, y + shadowOffset, w, h, radius, THEME.HARD_SHADOW);
  }
  drawRoundRect(ctx, x, y, w, h, radius, fillCol);

  if (paper) {
    const grain = getPaperGrainPattern(ctx);
    if (grain) {
      drawRoundRect(ctx, x, y, w, h, radius, grain);
    }
  }

  if (opts.halftone) {
    const ht = getHalftonePattern(ctx, !paper);
    if (ht) {
      ctx.save();
      ctx.globalAlpha = paper ? 0.16 : 0.34;
      drawRoundRect(ctx, x, y, w, h, radius, ht);
      ctx.restore();
    }
  }

  if (opts.topBandColor) {
    const bandH = opts.topBandHeight ?? 7;
    ctx.save();
    ctx.beginPath();
    const rad = Math.min(radius, w / 2, h / 2);
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = opts.topBandColor;
    ctx.fillRect(x, y, w, bandH);
    if (bandH >= 20) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + bandH);
      ctx.lineTo(x + w, y + bandH);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRoundRect(ctx, x, y, w, h, radius, undefined, strokeColor, lineWidth);
  ctx.restore();
}

/**
 * 斜角实体橡胶油墨印章（双线矩形外框 + 微硬影 + 倾斜角度 + 粗体油墨字）
 */
export function drawStamp(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = THEME.VERMILION,
  angleDeg = -6,
  scale = 1,
  bgColor = 'rgba(244, 239, 228, 0.95)'
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  if (scale !== 1) ctx.scale(scale, scale);

  const fontSize = 13.5;
  ctx.font = `900 ${fontSize}px ${THEME.FONT_FAMILY}`;
  const tw = ctx.measureText(text).width;
  const bw = Math.max(64, Math.ceil(tw) + 20);
  const bh = 28;

  ctx.fillStyle = 'rgba(7, 16, 12, 0.30)';
  ctx.fillRect(-bw / 2 + 2, -bh / 2 + 2, bw, bh);

  ctx.fillStyle = bgColor;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);

  ctx.lineWidth = 1;
  ctx.strokeRect(-bw / 2 + 3, -bh / 2 + 3, bw - 6, bh - 6);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

/**
 * 移动端唯一大字舒展版语义字号 Token（全端同构，不再做端内分叉）
 */
export const FONT = {
  HERO_NUM: 40,
  DISPLAY: 32,
  HEADLINE: 24,
  TITLE: 18,
  BODY: 15,
  LABEL: 13.5,
  MICRO: 12,
} as const;

export type FontToken = keyof typeof FONT;

/**
 * 字号硬下限兜底：任何传入小于 12px 的旧字号统一钳位到 12px
 */
export function mobileFontSize(size: number): number {
  return size < 12 ? 12 : size;
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
  const raw = opts.token ? FONT[opts.token] : (opts.size ?? 14);
  const size = opts.rawSize || opts.token ? Math.max(12, raw) : mobileFontSize(raw);
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
  size = 14,
  bold = false,
  maxLines = 3,
  rawSize = false
): string[] {
  const effSize = rawSize ? Math.max(12, size) : mobileFontSize(size);
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
  const raw = opts.token ? FONT[opts.token] : (opts.size ?? 14);
  const useRaw = !!(opts.rawSize || opts.token);
  const effSize = useRaw ? Math.max(12, raw) : mobileFontSize(raw);
  const effLineHeight = Math.max(lineHeight, Math.round(effSize * 1.35));
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
 * 全局复用：极简灰阶微图标 + 运动数字组合
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
  const baseFont = opts.fontSize ?? 13.5;
  const effFont = mobileFontSize(baseFont);
  const iconSize = Math.max(opts.iconSize ?? 13, Math.round(effFont * 0.92));
  const gap = opts.gap ?? 4;
  const iconColor = opts.iconColor ?? THEME.TX3;
  const valueColor = opts.valueColor ?? THEME.TX1;
  drawIcon(ctx, icon, x + iconSize / 2, y, iconSize, iconColor);
  drawText(ctx, value, x + iconSize + gap, y, {
    size: effFont,
    bold: opts.bold,
    color: valueColor,
    mono: true,
    rawSize: true,
  });
  ctx.font = `${opts.bold ? 'bold ' : ''}${effFont}px ${THEME.NUM_FONT_FAMILY}`;
  return iconSize + gap + ctx.measureText(value).width;
}

/**
 * 全局复用：硬墨线细进度条
 */
export function drawMiniBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fillColor: string,
  bgColor = 'rgba(10, 26, 20, 0.72)'
): void {
  const r = Math.max(0, Math.min(1, ratio));
  drawRoundRect(ctx, x, y, w, h, Math.min(4, h / 2), bgColor, THEME.INK_LINE, 1);
  if (r > 0) {
    drawRoundRect(ctx, x, y, Math.max(h, Math.round(w * r)), h, Math.min(4, h / 2), fillColor);
  }
}

/**
 * 数值色条编码（>=70 朱红/荧光绿，>=55 钴蓝，默认灰石板）
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
  bgColor = 'rgba(17, 20, 18, 0.14)'
): void {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const fillColor =
    color ??
    (ratio >= 0.80 ? THEME.VERMILION : ratio >= 0.68 ? '#15803D' : ratio >= 0.52 ? THEME.COBALT : THEME.PAPER_MUTED);
  drawMiniBar(ctx, x, y, w, h, ratio, fillColor, bgColor);
}

/**
 * 紧凑缩写标签 + 等宽数字组合（如 "射 71"），返回实际占用宽度
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
  const gap = opts.gap ?? 3;
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
  const h = opts.h ?? 22;
  const text = delta > 0 ? `▲+${delta}` : delta < 0 ? `▼${delta}` : '—';
  const bg = delta > 0 ? '#163529' : delta < 0 ? '#5C1814' : THEME.BG_CARD_DARK;
  const fg = delta > 0 ? THEME.LIME : delta < 0 ? '#FCA5A5' : THEME.TX3;

  ctx.font = `bold ${FONT.MICRO}px ${THEME.NUM_FONT_FAMILY}`;
  const w = Math.max(opts.minW ?? 40, Math.ceil(ctx.measureText(text).width) + 12);
  drawRoundRect(ctx, x, y - h / 2, w, h, 4, bg, THEME.INK_LINE, 1.5);
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
  size = 26
): number {
  const palette: Record<typeof tier, { bg: string; fg: string }> = {
    gold: { bg: THEME.BRASS, fg: THEME.PAPER_INK },
    blue: { bg: THEME.COBALT, fg: THEME.PAPER_CREAM },
    green: { bg: THEME.LIME, fg: THEME.PAPER_INK },
    red: { bg: THEME.VERMILION, fg: THEME.PAPER_CREAM },
    neutral: { bg: THEME.BG_CARD_DARK, fg: THEME.TX2 },
  };
  const pal = palette[tier];
  drawRoundRect(ctx, x, y - size / 2, size, size, 2, pal.bg, THEME.INK_LINE, 1.8);
  drawText(ctx, String(rank), x + size / 2, y, {
    token: 'LABEL',
    bold: true,
    color: pal.fg,
    align: 'center',
    mono: true,
  });
  return size;
}

export type ButtonVariant = 'gold' | 'primary' | 'ghost' | 'danger' | 'green' | 'lime' | 'paper';

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
  const pressed = hovered && hits.pointerDown;

  let fillCol: string = THEME.BG_CARD_DARK;
  let textColor: string = THEME.PAPER_CREAM;
  let borderCol: string = THEME.INK_LINE;

  if (variant === 'primary') {
    fillCol = hovered ? '#EA4D41' : THEME.VERMILION;
    textColor = THEME.PAPER_CREAM;
  } else if (variant === 'gold') {
    fillCol = hovered ? '#E5BC5E' : THEME.BRASS;
    textColor = THEME.PAPER_INK;
  } else if (variant === 'green') {
    fillCol = hovered ? '#1E4636' : THEME.BG_PITCH_ALT;
    textColor = THEME.LIME;
  } else if (variant === 'lime') {
    fillCol = hovered ? '#D6FA52' : THEME.LIME;
    textColor = THEME.PAPER_INK;
  } else if (variant === 'paper') {
    fillCol = hovered ? '#FAF6EE' : THEME.PAPER_CREAM;
    textColor = THEME.PAPER_INK;
  } else if (variant === 'danger') {
    fillCol = hovered ? '#DC2626' : '#B91C1C';
    textColor = THEME.PAPER_CREAM;
  } else {
    fillCol = opts.active ? THEME.BG_PITCH_ALT : hovered ? THEME.BG_CARD_HOVER : THEME.BG_CARD_DARK;
    textColor = opts.active ? THEME.LIME : THEME.TX1;
    borderCol = opts.active ? THEME.LIME : THEME.INK_LINE;
  }

  if (opts.disabled) {
    fillCol = '#0F1C17';
    textColor = THEME.TX3;
    borderCol = 'rgba(17, 20, 18, 0.55)';
  }

  const dx = pressed ? 2 : 0;
  const dy = pressed ? 2 : 0;
  const shadowOff = opts.disabled ? 0 : pressed ? 2 : 4;

  ctx.save();
  if (shadowOff > 0) {
    drawRoundRect(ctx, x + shadowOff, y + shadowOff, w, h, 3, THEME.HARD_SHADOW);
  }
  drawRoundRect(ctx, x + dx, y + dy, w, h, 3, fillCol, borderCol, 2.5);
  ctx.restore();

  const fSize = Math.max(12, opts.fontSize ?? 14);
  const effFSize = mobileFontSize(fSize);
  if (opts.icon && label) {
    const iconSize = Math.max(13, Math.round(effFSize * 1.02));
    ctx.font = `bold ${effFSize}px ${THEME.FONT_FAMILY}`;
    const tw = ctx.measureText(label).width;
    const totalW = iconSize + 6 + tw;
    const startX = x + dx + (w - totalW) / 2;
    drawIcon(ctx, opts.icon, startX + iconSize / 2, y + dy + h / 2, iconSize, textColor);
    drawText(ctx, label, startX + iconSize + 6, y + dy + h / 2, {
      size: effFSize,
      bold: true,
      color: textColor,
      align: 'left',
      rawSize: true,
    });
  } else if (opts.icon) {
    drawIcon(ctx, opts.icon, x + dx + w / 2, y + dy + h / 2, Math.max(16, Math.round(effFSize * 1.15)), textColor);
  } else {
    drawText(ctx, label, x + dx + w / 2, y + dy + h / 2, {
      size: effFSize,
      bold: true,
      color: textColor,
      align: 'center',
      rawSize: true,
    });
  }

  if (!opts.disabled) {
    hits.addTouchTarget(x, y, w, h, () => {
      SoundEngine.playClick();
      onClick();
    });
  }
}

/**
 * 转播级顶部主栏（深松石底 + 2.5px 硬墨线底边 + 预留微信胶囊安全区）
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
  ctx.fillStyle = THEME.BG_DEEP;
  ctx.fillRect(0, 0, THEME.W, 68);

  const ht = getHalftonePattern(ctx, true);
  if (ht) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = ht;
    ctx.fillRect(0, 0, THEME.W, 68);
    ctx.restore();
  }

  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 68);
  ctx.lineTo(THEME.W, 68);
  ctx.stroke();

  let lx = 20;
  if (opts.onBack) {
    drawButton(ctx, hits, lx, 12, 96, 44, opts.backLabel || '返回', opts.onBack, {
      variant: 'ghost',
      fontSize: 13.5,
    });
    lx += 110;
  }
  if (opts.club) {
    drawClubCrest(ctx, lx + 18, 34, 17, opts.club);
    lx += 46;
  }

  let rightReserve = 0;
  if (opts.showSoundToggle) rightReserve += 96;
  if (opts.rightAction) rightReserve += 156;
  const rightEdge = 1140 - rightReserve - 16;

  ctx.font = `bold 12px ${THEME.FONT_FAMILY}`;
  const badgeW = opts.badge ? Math.max(96, Math.ceil(ctx.measureText(opts.badge).width) + 22) : 0;
  const metaLabel = opts.metaPoints !== undefined ? `PT ${opts.metaPoints}` : '';
  const metaW = metaLabel ? Math.max(76, Math.ceil(ctx.measureText(metaLabel).width) + 22) : 0;
  const fundsLabel = opts.clubFunds !== undefined ? formatFunds(opts.clubFunds) : '';
  const fundsW = fundsLabel ? Math.max(96, Math.ceil(ctx.measureText(fundsLabel).width) + 22) : 0;
  const badgesW = (badgeW ? badgeW + 10 : 0) + (metaW ? metaW + 10 : 0) + (fundsW ? fundsW + 10 : 0);
  const titleMax = Math.max(120, rightEdge - lx - badgesW - 18);

  drawText(ctx, fitText(ctx, opts.kicker, titleMax + badgesW, 12, true, true), lx, 18, {
    size: 12,
    bold: true,
    color: THEME.BRASS,
    mono: true,
    rawSize: true,
  });
  const title = fitText(ctx, opts.title, titleMax, 19, true, true);
  drawText(ctx, title, lx, 44, { size: 19, bold: true, color: THEME.TX1, rawSize: true });
  ctx.font = `bold 19px ${THEME.FONT_FAMILY}`;
  const titleW = ctx.measureText(title).width;

  let bx = lx + Math.min(titleMax + 18, Math.max(210, titleW + 18));
  if (opts.badge) {
    drawBadge(ctx, bx, 31, badgeW, 24, opts.badge, THEME.BG_PITCH_ALT, THEME.LIME);
    bx += badgeW + 10;
  }
  if (fundsLabel) {
    drawBadge(ctx, bx, 31, fundsW, 24, fundsLabel, THEME.PAPER_CREAM, THEME.PAPER_INK);
    bx += fundsW + 10;
  }
  if (metaLabel) {
    drawBadge(ctx, bx, 31, metaW, 24, metaLabel, THEME.BRASS, THEME.PAPER_INK);
  }

  let rx = 1140;
  if (opts.showSoundToggle) {
    rx -= 88;
    drawButton(
      ctx,
      hits,
      rx,
      12,
      88,
      44,
      SoundEngine.getAudioModeLabel(),
      () => SoundEngine.cycleAudioMode(),
      { variant: 'ghost', fontSize: 12.5, icon: SoundEngine.muted ? 'sound_off' : 'sound_on' }
    );
    rx -= 10;
  }
  if (opts.rightAction) {
    const rw = 152;
    rx -= rw;
    drawButton(ctx, hits, rx, 12, rw, 44, opts.rightAction.label, opts.rightAction.onClick, {
      variant: opts.rightAction.variant ?? 'gold',
      icon: opts.rightAction.icon,
      fontSize: 13.5,
    });
  }
}

export function formatFunds(amount: number): string {
  return `¥${Math.round(amount)}万`;
}

export type NavRailTab = 'portal' | 'league' | 'tactics' | 'cards' | 'transfer_hub' | 'meta' | 'hof' | 'title';

/**
 * 绘制 PITCH PRINT 风格立体图钉（针孔 + 投射阴影 + 钢针 + 双层红帽）
 */
function drawPushpin(ctx: CanvasRenderingContext2D, pinX: number, pinY: number): void {
  ctx.save();

  // 1. 针孔（扎入纸面的黑点）
  ctx.fillStyle = THEME.INK_LINE;
  ctx.beginPath();
  ctx.arc(pinX, pinY, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // 2. 投射硬阴影
  ctx.strokeStyle = 'rgba(17, 20, 18, 0.32)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pinX + 1, pinY + 0.5);
  ctx.lineTo(pinX + 8.5, pinY + 3.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(17, 20, 18, 0.32)';
  ctx.beginPath();
  ctx.ellipse(pinX + 8.5, pinY + 3.5, 4.2, 2.2, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // 3. 钢针（外墨线 + 金属高光）
  ctx.lineCap = 'round';
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(pinX, pinY);
  ctx.lineTo(pinX + 3.2, pinY - 5.2);
  ctx.stroke();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(pinX, pinY);
  ctx.lineTo(pinX + 3.2, pinY - 5.2);
  ctx.stroke();

  // 4. 图钉底盘（深红扁椭圆）
  ctx.fillStyle = '#B91C1C';
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(pinX + 3.8, pinY - 5.8, 5.6, 3.1, 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 5. 图钉柱颈
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(pinX + 3.8, pinY - 5.8);
  ctx.lineTo(pinX + 6.2, pinY - 8.6);
  ctx.stroke();
  ctx.strokeStyle = '#B91C1C';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(pinX + 3.8, pinY - 5.8);
  ctx.lineTo(pinX + 6.2, pinY - 8.6);
  ctx.stroke();

  // 6. 图钉顶帽 + 左上高光点
  ctx.fillStyle = THEME.VERMILION;
  ctx.strokeStyle = THEME.INK_LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(pinX + 6.2, pinY - 8.6, 4.5, 2.7, 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = THEME.PAPER_CREAM;
  ctx.beginPath();
  ctx.arc(pinX + 4.8, pinY - 9.4, 1.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 统一左侧垂直导航轨道（深松石底 + 墨线描边 + 选中态图钉钉住暖纸便签）
 */
export function drawNavRail(
  ctx: CanvasRenderingContext2D,
  hits: HitRegistry,
  activeTab: NavRailTab,
  onNavigate: (tab: NavRailTab) => void
): void {
  drawChamferPanel(ctx, 14, 80, 68, 624, 10, THEME.BG_DEEP, THEME.INK_LINE, 2.5);
  const items: Array<{ key: NavRailTab; label: string; icon: IconName }> = [
    { key: 'portal', label: '门户', icon: 'ball' },
    { key: 'league', label: '联赛', icon: 'chart' },
    { key: 'tactics', label: '战术', icon: 'tactics' },
    { key: 'transfer_hub', label: '引援', icon: 'refresh' },
    { key: 'meta', label: '星盘', icon: 'talent' },
    { key: 'hof', label: '荣誉', icon: 'trophy' },
  ];

  items.forEach((item, i) => {
    const iy = 92 + i * 72;
    const isAct = activeTab === item.key;
    const hovered = hits.isHovered(20, iy, 56, 62);
    if (isAct) {
      ctx.save();
      ctx.translate(48, iy + 31);
      ctx.rotate(-0.04);
      drawRoundRect(ctx, -28 + 3, -31 + 3, 56, 62, 4, THEME.HARD_SHADOW);
      drawRoundRect(ctx, -28, -31, 56, 62, 4, THEME.PAPER_CREAM, THEME.INK_LINE, 2.2);
      drawIcon(ctx, item.icon, 0, -4, 18, THEME.VERMILION);
      drawText(ctx, item.label, 0, 19, { size: 12.5, bold: true, color: THEME.PAPER_INK, align: 'center', rawSize: true });
      ctx.restore();
      drawPushpin(ctx, 48, iy + 5);
    } else {
      if (hovered) {
        drawRoundRect(ctx, 20, iy, 56, 62, 8, THEME.BG_CARD_HOVER, THEME.INK_LINE, 1.5);
      }
      const col = hovered ? THEME.TX1 : THEME.TX2;
      drawIcon(ctx, item.icon, 48, iy + 22, 19, col);
      drawText(ctx, item.label, 48, iy + 47, { size: 12.5, bold: false, color: col, align: 'center', rawSize: true });
    }
    hits.addTouchTarget(20, iy, 56, 62, () => {
      SoundEngine.playClick();
      onNavigate(item.key);
    });
  });

  // 底部返回主页按钮
  const hy = 632;
  const hHover = hits.isHovered(20, hy, 56, 58);
  if (hHover) drawRoundRect(ctx, 20, hy, 56, 58, 8, THEME.BG_CARD_HOVER, THEME.INK_LINE, 1.5);
  drawIcon(ctx, 'home', 48, hy + 20, 19, hHover ? THEME.TX1 : THEME.TX2);
  drawText(ctx, '主页', 48, hy + 45, { size: 12.5, color: hHover ? THEME.TX1 : THEME.TX2, align: 'center', rawSize: true });
  hits.addTouchTarget(20, hy, 56, 58, () => {
    SoundEngine.playClick();
    onNavigate('title');
  });
}

/**
 * 全局场景背景绘制（深松石战术底 + 离屏半调网点）
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
    ctx.globalAlpha = brighten ? 0.52 : 0.30;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    ctx.fillStyle = brighten ? 'rgba(10, 26, 20, 0.42)' : 'rgba(10, 26, 20, 0.65)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
  } else {
    ctx.fillStyle = THEME.BG_MID;
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    const ht = getHalftonePattern(ctx, true);
    if (ht) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = ht;
      ctx.fillRect(0, 0, THEME.W, THEME.H);
      ctx.restore();
    }
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
  color: string = THEME.PAPER_CREAM
): void {
  const pad = w <= 36 ? 4 : 8;
  const innerMax = Math.max(12, w - pad);
  const candidates = [13.5, 12.5, 12];
  let fontSize = 12;
  for (const s of candidates) {
    ctx.font = `bold ${s}px ${THEME.FONT_FAMILY}`;
    if (ctx.measureText(text).width <= innerMax) {
      fontSize = s;
      break;
    }
  }
  const label = fitText(ctx, text, innerMax, fontSize, true, true);
  drawRoundRect(ctx, x, y, w, h, Math.min(5, h / 2), bg, THEME.INK_LINE, 1.5);
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
  const effSize = rawSize ? Math.max(12, size) : mobileFontSize(size);
  ctx.font = `${bold ? 'bold ' : ''}${effSize}px ${THEME.FONT_FAMILY}`;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

export function tierColor(tier: 'S' | 'A' | 'B' | 'C'): string {
  if (tier === 'S') return THEME.BRASS;
  if (tier === 'A') return THEME.VIOLET;
  if (tier === 'B') return THEME.COBALT;
  return THEME.PAPER_MUTED;
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
  shape: 'square' | 'triangle';
  rot: number;
  vRot: number;
}

const MAX_PARTICLES = 40;

export class ParticleSystem {
  private particles: Particle[] = [];

  public burst(x: number, y: number, color: string = THEME.BRASS, count = 18): void {
    const budget = Math.max(0, MAX_PARTICLES - this.particles.length);
    const actualCount = Math.min(count, budget);
    for (let i = 0; i < actualCount; i++) {
      const a = (Math.PI * 2 * i) / Math.max(1, actualCount) + (Math.random() - 0.5) * 0.4;
      const spd = 70 + Math.random() * 170;
      const maxLife = 0.35 + Math.random() * 0.35;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 45,
        life: maxLife,
        maxLife,
        size: 4 + Math.random() * 4,
        color,
        shape: i % 2 === 0 ? 'square' : 'triangle',
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 10,
      });
    }
  }

  public update(dtSec: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 260 * dtSec;
      p.rot += p.vRot * dtSec;
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
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = THEME.INK_LINE;
      ctx.lineWidth = 1;
      const s = p.size;
      if (p.shape === 'square') {
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.65);
        ctx.lineTo(s * 0.6, s * 0.55);
        ctx.lineTo(-s * 0.6, s * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

/**
 * 动态斜向扫光（Foil Shimmer），用于 S/A 级星卡与荣誉奖杯拭亮
 */
export function drawFoilShimmer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  timeSec: number,
  color = 'rgba(216, 168, 66, 0.24)'
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
