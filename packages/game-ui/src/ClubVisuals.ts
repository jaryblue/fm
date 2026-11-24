/**
 * 纯 Canvas 2D 程序化矢量队徽与球衣绘制系统
 * 零图片资源依赖，100% 兼容 Steam / Web / 微信小游戏
 */

export type CrestShape = 'shield' | 'circle' | 'diamond' | 'hexagon';
export type CrestPattern = 'split' | 'stripe' | 'diagonal' | 'chevron';
export type CrestEmblem = 'star' | 'tower' | 'wing' | 'flame' | 'crown' | 'beacon' | 'gem' | 'bolt';
export type JerseyPattern = 'solid' | 'vertical' | 'hoops' | 'sash';

export interface ClubVisualStyle {
  shape: CrestShape;
  pattern: CrestPattern;
  emblem: CrestEmblem;
  jerseyPattern: JerseyPattern;
}

const PRESET_STYLES: Record<string, ClubVisualStyle> = {
  club_star: { shape: 'shield', pattern: 'diagonal', emblem: 'star', jerseyPattern: 'sash' },
  club_iron: { shape: 'hexagon', pattern: 'split', emblem: 'tower', jerseyPattern: 'vertical' },
  club_eagle: { shape: 'shield', pattern: 'chevron', emblem: 'wing', jerseyPattern: 'solid' },
  club_flame: { shape: 'diamond', pattern: 'stripe', emblem: 'flame', jerseyPattern: 'hoops' },
  club_oak: { shape: 'shield', pattern: 'split', emblem: 'crown', jerseyPattern: 'vertical' },
  club_light: { shape: 'circle', pattern: 'stripe', emblem: 'beacon', jerseyPattern: 'hoops' },
  club_jade: { shape: 'diamond', pattern: 'chevron', emblem: 'gem', jerseyPattern: 'sash' },
  club_storm: { shape: 'hexagon', pattern: 'diagonal', emblem: 'bolt', jerseyPattern: 'solid' },
};

const SHAPES: CrestShape[] = ['shield', 'circle', 'diamond', 'hexagon'];
const PATTERNS: CrestPattern[] = ['split', 'stripe', 'diagonal', 'chevron'];
const EMBLEMS: CrestEmblem[] = ['star', 'tower', 'wing', 'flame', 'crown', 'beacon', 'gem', 'bolt'];
const J_PATTERNS: JerseyPattern[] = ['solid', 'vertical', 'hoops', 'sash'];

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getClubVisualStyle(clubId: string): ClubVisualStyle {
  if (PRESET_STYLES[clubId]) return PRESET_STYLES[clubId];
  const h = hashId(clubId);
  return {
    shape: SHAPES[h % SHAPES.length],
    pattern: PATTERNS[(h >> 3) % PATTERNS.length],
    emblem: EMBLEMS[(h >> 6) % EMBLEMS.length],
    jerseyPattern: J_PATTERNS[(h >> 9) % J_PATTERNS.length],
  };
}

function traceCrestPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, shape: CrestShape): void {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.9, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.9, cy);
    ctx.closePath();
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    // 经典盾牌
    ctx.moveTo(cx - r * 0.85, cy - r * 0.92);
    ctx.lineTo(cx + r * 0.85, cy - r * 0.92);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.08);
    ctx.quadraticCurveTo(cx + r * 0.8, cy + r * 0.72, cx, cy + r);
    ctx.quadraticCurveTo(cx - r * 0.8, cy + r * 0.72, cx - r * 0.85, cy + r * 0.08);
    ctx.closePath();
  }
}

function drawEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  emblem: CrestEmblem,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(8,12,20,0.65)';
  ctx.lineWidth = Math.max(1, r * 0.08);

  ctx.beginPath();
  if (emblem === 'star') {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r * 0.52 : r * 0.22;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (emblem === 'gem') {
    ctx.moveTo(cx, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.42, cy);
    ctx.lineTo(cx, cy + r * 0.5);
    ctx.lineTo(cx - r * 0.42, cy);
    ctx.closePath();
  } else if (emblem === 'bolt') {
    ctx.moveTo(cx + r * 0.12, cy - r * 0.5);
    ctx.lineTo(cx - r * 0.28, cy + r * 0.04);
    ctx.lineTo(cx + r * 0.02, cy + r * 0.04);
    ctx.lineTo(cx - r * 0.14, cy + r * 0.5);
    ctx.lineTo(cx + r * 0.3, cy - r * 0.06);
    ctx.lineTo(cx - r * 0.02, cy - r * 0.06);
    ctx.closePath();
  } else if (emblem === 'crown') {
    ctx.moveTo(cx - r * 0.44, cy + r * 0.28);
    ctx.lineTo(cx - r * 0.48, cy - r * 0.24);
    ctx.lineTo(cx - r * 0.18, cy + r * 0.02);
    ctx.lineTo(cx, cy - r * 0.36);
    ctx.lineTo(cx + r * 0.18, cy + r * 0.02);
    ctx.lineTo(cx + r * 0.48, cy - r * 0.24);
    ctx.lineTo(cx + r * 0.44, cy + r * 0.28);
    ctx.closePath();
  } else if (emblem === 'wing') {
    ctx.moveTo(cx - r * 0.45, cy + r * 0.2);
    ctx.quadraticCurveTo(cx - r * 0.1, cy - r * 0.45, cx + r * 0.48, cy - r * 0.32);
    ctx.lineTo(cx + r * 0.2, cy + r * 0.04);
    ctx.lineTo(cx + r * 0.36, cy + r * 0.24);
    ctx.lineTo(cx - r * 0.2, cy + r * 0.32);
    ctx.closePath();
  } else if (emblem === 'flame') {
    ctx.moveTo(cx, cy - r * 0.5);
    ctx.quadraticCurveTo(cx + r * 0.45, cy - r * 0.05, cx + r * 0.24, cy + r * 0.4);
    ctx.quadraticCurveTo(cx, cy + r * 0.52, cx - r * 0.24, cy + r * 0.4);
    ctx.quadraticCurveTo(cx - r * 0.45, cy - r * 0.05, cx, cy - r * 0.5);
    ctx.closePath();
  } else if (emblem === 'beacon') {
    ctx.moveTo(cx - r * 0.18, cy + r * 0.4);
    ctx.lineTo(cx - r * 0.1, cy - r * 0.32);
    ctx.lineTo(cx + r * 0.1, cy - r * 0.32);
    ctx.lineTo(cx + r * 0.18, cy + r * 0.4);
    ctx.closePath();
  } else {
    // tower
    ctx.rect(cx - r * 0.28, cy - r * 0.26, r * 0.56, r * 0.62);
  }
  ctx.fill();
  ctx.stroke();
}

/**
 * 绘制俱乐部程序化矢量队徽
 */
export function drawClubCrest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  club: { id: string; primaryColor: string; secondaryColor: string }
): void {
  const r = Math.max(6, radius);
  const style = getClubVisualStyle(club.id);

  ctx.save();
  traceCrestPath(ctx, cx, cy, r, style.shape);
  ctx.fillStyle = club.primaryColor;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = club.secondaryColor;
  ctx.globalAlpha = 0.28;

  if (style.pattern === 'split') {
    ctx.fillRect(cx, cy - r, r, r * 2);
  } else if (style.pattern === 'stripe') {
    ctx.fillRect(cx - r * 0.28, cy - r, r * 0.56, r * 2);
  } else if (style.pattern === 'diagonal') {
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.1, cy + r * 0.55);
    ctx.lineTo(cx + r * 0.55, cy - r * 1.1);
    ctx.lineTo(cx + r * 1.1, cy - r * 0.55);
    ctx.lineTo(cx - r * 0.55, cy + r * 1.1);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.25);
    ctx.lineTo(cx, cy + r * 0.35);
    ctx.lineTo(cx + r, cy - r * 0.25);
    ctx.lineTo(cx + r, cy + r * 0.12);
    ctx.lineTo(cx, cy + r * 0.72);
    ctx.lineTo(cx - r, cy + r * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 中心图腾
  drawEmblem(ctx, cx, cy, r, style.emblem, '#F8FAFC');

  // 外框金边/副色描边
  traceCrestPath(ctx, cx, cy, r, style.shape);
  ctx.strokeStyle = club.secondaryColor;
  ctx.lineWidth = Math.max(1.4, r * 0.11);
  ctx.stroke();
  ctx.restore();
}

/**
 * 绘制球衣矢量小图标（支持纯色/竖条/横条/斜纹与背号）
 */
export function drawJerseyIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  club: { id: string; primaryColor: string; secondaryColor: string },
  shirtNumber?: number
): void {
  const s = Math.max(12, size);
  const halfW = s * 0.42;
  const halfH = s * 0.48;
  const style = getClubVisualStyle(club.id);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.42, cy - halfH);
  ctx.lineTo(cx + halfW * 0.42, cy - halfH);
  ctx.lineTo(cx + halfW * 1.08, cy - halfH * 0.42);
  ctx.lineTo(cx + halfW * 0.82, cy - halfH * 0.04);
  ctx.lineTo(cx + halfW * 0.58, cy - halfH * 0.18);
  ctx.lineTo(cx + halfW * 0.58, cy + halfH);
  ctx.lineTo(cx - halfW * 0.58, cy + halfH);
  ctx.lineTo(cx - halfW * 0.58, cy - halfH * 0.18);
  ctx.lineTo(cx - halfW * 0.82, cy - halfH * 0.04);
  ctx.lineTo(cx - halfW * 1.08, cy - halfH * 0.42);
  ctx.closePath();

  ctx.fillStyle = club.primaryColor;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = club.secondaryColor;
  ctx.globalAlpha = 0.72;
  if (style.jerseyPattern === 'vertical') {
    ctx.fillRect(cx - halfW * 0.22, cy - halfH, halfW * 0.44, halfH * 2);
  } else if (style.jerseyPattern === 'hoops') {
    ctx.fillRect(cx - halfW * 1.1, cy - halfH * 0.22, halfW * 2.2, halfH * 0.36);
  } else if (style.jerseyPattern === 'sash') {
    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy + halfH);
    ctx.lineTo(cx + halfW * 0.4, cy - halfH);
    ctx.lineTo(cx + halfW, cy - halfH);
    ctx.lineTo(cx - halfW * 0.4, cy + halfH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = club.secondaryColor;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.stroke();

  if (shirtNumber !== undefined) {
    const numStr = String(shirtNumber);
    const numSize = numStr.length >= 2 ? Math.max(8.5, Math.round(s * 0.35)) : Math.max(9.5, Math.round(s * 0.39));
    const numY = cy + s * 0.16;
    ctx.font = `bold ${numSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8, 12, 20, 0.90)';
    ctx.lineWidth = Math.max(2.2, s * 0.11);
    ctx.strokeText(numStr, cx, numY);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(numStr, cx, numY);
  }
  ctx.restore();
}

/**
 * 绘制程序化矢量冠军奖杯（用于赛季结算与历史荣誉室视觉焦点）
 */
export function drawTrophyIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  gold = '#FACC15',
  rim = '#D4A843'
): void {
  const s = Math.max(16, size);
  ctx.save();
  ctx.fillStyle = gold;
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1.2, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.38, cy - s * 0.42);
  ctx.lineTo(cx + s * 0.38, cy - s * 0.42);
  ctx.quadraticCurveTo(cx + s * 0.34, cy + s * 0.1, cx + s * 0.1, cy + s * 0.16);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.32);
  ctx.lineTo(cx + s * 0.28, cy + s * 0.42);
  ctx.lineTo(cx - s * 0.28, cy + s * 0.42);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.32);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.16);
  ctx.quadraticCurveTo(cx - s * 0.34, cy + s * 0.1, cx - s * 0.38, cy - s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx - s * 0.38, cy - s * 0.22, s * 0.14, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + s * 0.38, cy - s * 0.22, s * 0.14, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(cx - s * 0.32, cy + s * 0.42, s * 0.64, s * 0.1);
  ctx.restore();
}

/**
 * 绘制球星卡位置半身剪影立绘（用于选秀星卡与 Re-Draft 卡面视觉焦点）
 */
export function drawPlayerSilhouette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  role: string,
  color = 'rgba(241, 245, 249, 0.14)'
): void {
  const s = Math.max(16, size);
  ctx.save();
  ctx.fillStyle = color;
  // 头部
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.24, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // 肩部与躯干（门将略张开双臂扑救姿态，前锋前倾）
  ctx.beginPath();
  if (role === 'GK') {
    ctx.moveTo(cx - s * 0.48, cy - s * 0.12);
    ctx.lineTo(cx - s * 0.22, cy - s * 0.04);
    ctx.lineTo(cx + s * 0.22, cy - s * 0.04);
    ctx.lineTo(cx + s * 0.48, cy - s * 0.12);
    ctx.lineTo(cx + s * 0.26, cy + s * 0.42);
    ctx.lineTo(cx - s * 0.26, cy + s * 0.42);
  } else {
    ctx.moveTo(cx - s * 0.34, cy + s * 0.42);
    ctx.quadraticCurveTo(cx - s * 0.32, cy - s * 0.02, cx, cy - s * 0.04);
    ctx.quadraticCurveTo(cx + s * 0.32, cy - s * 0.02, cx + s * 0.34, cy + s * 0.42);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
