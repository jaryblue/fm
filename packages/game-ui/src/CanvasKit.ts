/**
 * 纯 Canvas 2D 发行级转播绘图工具、斜切金属面板、导航壳与粒子系统
 * 零 DOM 依赖，零 Emoji 依赖，100% 兼容 Steam / Web / 微信小游戏
 */

import { ArtAssetId, AssetLoader } from './AssetLoader';
import { drawClubCrest } from './ClubVisuals';
import { drawTitleStageArt } from './SceneArt';
import { SoundEngine } from './SoundEngine';
import { THEME } from './Theme';
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
 * 发行级 45 度斜切角金属/玻璃面板（支持渐变填充与顶部高光）
 */
export function drawChamferPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut = 12,
  fill: string | CanvasGradient = 'rgba(11, 17, 30, 0.88)',
  stroke: string = THEME.BORDER_GOLD,
  lineWidth = 1.2,
  accentTop?: string
): void {
  const c = Math.min(cut, w / 3, h / 3);
  ctx.save();
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

  ctx.fillStyle = fill;
  ctx.fill();
  if (typeof fill === 'string' && (fill.includes('11, 17, 30') || fill.includes('14, 22, 40') || fill.includes('17, 25, 44'))) {
    const carbon = AssetLoader.get('panel_carbon_bg');
    if (carbon && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.14;
      ctx.drawImage(carbon, x, y, w, h);
      ctx.restore();
    }
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  if (accentTop) {
    ctx.strokeStyle = accentTop;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + c + 4, y + 1.5);
    ctx.lineTo(x + w - c - 4, y + 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    mono?: boolean;
  } = {}
): void {
  const size = opts.size ?? 13;
  const italic = opts.italic ? 'italic ' : '';
  const weight = opts.bold ? 'bold ' : '';
  const family = opts.mono ? 'monospace' : THEME.FONT_FAMILY;
  ctx.font = `${italic}${weight}${size}px ${family}`;
  ctx.fillStyle = opts.color ?? THEME.TX1;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.fillText(text, x, y);
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
    bold?: boolean;
    color?: string;
    maxLines?: number;
  } = {}
): number {
  const size = opts.size ?? 11;
  const weight = opts.bold ? 'bold ' : '';
  ctx.font = `${weight}${size}px ${THEME.FONT_FAMILY}`;
  ctx.fillStyle = opts.color ?? THEME.TX1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const maxLines = opts.maxLines ?? 3;
  const lines: string[] = [];
  let current = '';

  for (const ch of text) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (lines.length === maxLines && current) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.slice(0, Math.max(1, last.length - 1)) + '…';
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
  return lines.length;
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

  let topCol = '#18243E';
  let botCol = '#0F172A';
  let border: string = THEME.BORDER;
  let textColor: string = THEME.TX1;

  if (variant === 'gold') {
    topCol = hovered ? '#FEF08A' : '#FACC15';
    botCol = hovered ? '#EA580C' : '#C2410C';
    border = hovered ? '#FEF08A' : THEME.GOLD_LIGHT;
    textColor = '#090D16';
  } else if (variant === 'primary') {
    topCol = hovered ? '#3B82F6' : '#2563EB';
    botCol = hovered ? '#1D4ED8' : '#1E40AF';
    border = '#60A5FA';
  } else if (variant === 'green') {
    topCol = hovered ? '#22C55E' : '#16A34A';
    botCol = hovered ? '#15803D' : '#14532D';
    border = THEME.GREEN;
  } else if (variant === 'danger') {
    topCol = hovered ? '#EF4444' : '#B91C1C';
    botCol = hovered ? '#991B1B' : '#7F1D1D';
    border = THEME.RED_LIGHT;
  } else {
    topCol = opts.active ? '#1E3A5F' : hovered ? '#1E2D4D' : '#131E36';
    botCol = opts.active ? '#122540' : hovered ? '#142038' : '#0B1221';
    border = opts.active ? THEME.GOLD : THEME.BORDER;
    textColor = opts.active ? THEME.GOLD_LIGHT : THEME.TX1;
  }

  if (opts.disabled) {
    topCol = '#111827';
    botCol = '#0B111E';
    border = 'rgba(255,255,255,0.04)';
    textColor = THEME.TX3;
  }

  const pressed = hovered && hits.pointerDown;
  const dy = pressed ? 1 : hovered ? -1 : 0;
  const grad = ctx.createLinearGradient(x, y + dy, x, y + dy + h);
  grad.addColorStop(0, topCol);
  grad.addColorStop(1, botCol);

  const accent = !opts.disabled && (variant === 'gold' || variant === 'primary' || variant === 'green' || opts.active)
    ? 'rgba(255,255,255,0.32)'
    : undefined;
  ctx.save();
  if (hovered && !opts.disabled && (variant === 'gold' || variant === 'primary' || variant === 'green')) {
    ctx.shadowColor = variant === 'gold' ? 'rgba(250,204,21,0.45)' : variant === 'green' ? 'rgba(34,197,94,0.45)' : 'rgba(59,130,246,0.45)';
    ctx.shadowBlur = 10;
  }
  drawChamferPanel(ctx, x, y + dy, w, h, 6, grad, border, opts.active ? 1.5 : 1, accent);
  ctx.restore();

  const fSize = opts.fontSize ?? 13;
  if (opts.icon && label) {
    const iconSize = Math.max(12, Math.round(fSize * 1.05));
    ctx.font = `bold ${fSize}px ${THEME.FONT_FAMILY}`;
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
    hits.add(x, y, w, h, () => {
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

  drawText(ctx, opts.kicker, lx, 20, { size: 10, bold: true, color: THEME.GOLD, mono: true });
  drawText(ctx, opts.title, lx, 43, { size: 18, bold: true, color: THEME.TX1 });

  if (opts.badge) {
    drawBadge(ctx, lx + 240, 23, 120, 22, opts.badge, '#1E3A5F', THEME.GOLD_LIGHT);
  }
  if (opts.metaPoints !== undefined) {
    drawBadge(ctx, lx + 370, 23, 98, 22, `META ${opts.metaPoints}`, 'rgba(212,168,67,0.16)', THEME.GOLD_LIGHT);
  }

  // 右侧操作区（严格控制在 x <= 1140，为微信右上角胶囊留白）
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

export type NavRailTab = 'portal' | 'tactics' | 'cards' | 'meta' | 'hof' | 'title';

/**
 * 统一左侧垂直导航轨道（门户/战术/合成/天赋/荣誉/主页）
 */
export function drawNavRail(
  ctx: CanvasRenderingContext2D,
  hits: HitRegistry,
  activeTab: NavRailTab,
  onNavigate: (tab: NavRailTab) => void
): void {
  drawChamferPanel(ctx, 14, 80, 68, 624, 10, 'rgba(11, 17, 30, 0.92)', THEME.BORDER, 1, THEME.BORDER_GOLD);
  const items: Array<{ key: NavRailTab; label: string; icon: IconName }> = [
    { key: 'portal', label: '门户', icon: 'chart' },
    { key: 'tactics', label: '战术', icon: 'tactics' },
    { key: 'cards', label: '合成', icon: 'craft' },
    { key: 'meta', label: '天赋', icon: 'talent' },
    { key: 'hof', label: '荣誉', icon: 'trophy' },
  ];

  items.forEach((item, i) => {
    const iy = 96 + i * 74;
    const isAct = activeTab === item.key;
    const hovered = hits.isHovered(20, iy, 56, 62);
    if (isAct) {
      drawRoundRect(ctx, 20, iy, 56, 62, 8, 'rgba(212,168,67,0.18)', THEME.GOLD, 1.4);
      drawRoundRect(ctx, 14, iy + 10, 4, 42, 2, THEME.GOLD_LIGHT);
    } else if (hovered) {
      drawRoundRect(ctx, 20, iy, 56, 62, 8, 'rgba(30,45,77,0.7)', THEME.BORDER);
    }
    const col = isAct ? THEME.GOLD_LIGHT : hovered ? THEME.TX1 : THEME.TX2;
    drawIcon(ctx, item.icon, 48, iy + 22, 20, col);
    drawText(ctx, item.label, 48, iy + 48, { size: 11, bold: isAct, color: col, align: 'center' });
    hits.add(20, iy, 56, 62, () => {
      SoundEngine.playClick();
      onNavigate(item.key);
    });
  });

  // 底部返回主页按钮
  const hy = 626;
  const hHover = hits.isHovered(20, hy, 56, 62);
  if (hHover) drawRoundRect(ctx, 20, hy, 56, 62, 8, 'rgba(30,45,77,0.7)', THEME.BORDER);
  drawIcon(ctx, 'home', 48, hy + 22, 19, hHover ? THEME.TX1 : THEME.TX2);
  drawText(ctx, '主页', 48, hy + 48, { size: 11, color: hHover ? THEME.TX1 : THEME.TX2, align: 'center' });
  hits.add(20, hy, 56, 62, () => {
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
  drawRoundRect(ctx, x, y, w, h, 4, bg);
  drawText(ctx, text, x + w / 2, y + h / 2, {
    size: 10,
    bold: true,
    color,
    align: 'center',
  });
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
