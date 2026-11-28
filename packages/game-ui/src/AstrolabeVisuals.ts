/**
 * V6 八卦战术星盘共享视觉渲染原语（PITCH PRINT 黄铜几何线雕罗盘版）
 * 供 MetaScreen 全景星盘与 TitleScreen 建队 Step 2 正上方特写星盘复用
 * 禁用 shadowBlur，统一硬墨线 #111412 + 哑光黄铜 #D8A842 + 荧光绿 #C8F230
 */

import type { V6PassiveDef, V6SatelliteKey } from '../../core/src/v6';
import type { DefenseSystem, DirectiveTendency, DirectiveZone, TacticalStyle } from '../../engine/src/types';
import { drawText, getHalftonePattern } from './CanvasKit';
import { THEME } from './Theme';
import { drawIcon, drawSkillGlyph, SkillGlyphKind } from './VectorIcons';

export const ASTROLABE_STYLE_GLYPH: Record<TacticalStyle, SkillGlyphKind> = {
  tiki_taka: 'tiki',
  gegenpress: 'press',
  wing_play: 'wing',
  counter: 'counter',
  park_bus: 'bus',
  balanced: 'balanced',
};

export const ASTROLABE_SYSTEM_GLYPH: Record<DefenseSystem, SkillGlyphKind> = {
  '4-back': 'sys_4back',
  '3-back': 'sys_3back',
  '5-back': 'sys_5back',
};

export const ASTROLABE_ZONE_COLOR: Record<DirectiveZone, string> = {
  ATT: THEME.VERMILION,
  MID: THEME.COBALT,
  DEF: THEME.LIME,
};

export const ASTROLABE_ZONE_LABEL: Record<DirectiveZone, string> = {
  ATT: '前场',
  MID: '中场',
  DEF: '后场',
};

export function getAstrolabePassiveGlyph(p: V6PassiveDef): SkillGlyphKind {
  if (p.tier === 'origin') {
    if (p.style) return ASTROLABE_STYLE_GLYPH[p.style];
    if (p.system) return ASTROLABE_SYSTEM_GLYPH[p.system];
  }
  const sd = p.statDelta;
  const tm = p.tacticalMod;
  if (sd?.shooting || tm?.longShotBias || tm?.boxCrashBonus) return 'stat_shoot';
  if (sd?.passing || sd?.composure || tm?.shortPassBias || tm?.throughPassBias) return 'stat_pass';
  if (sd?.defending || sd?.goalkeeping || p.blockBonus || p.oppShotXgPenalty || p.startingShields || (tm?.lineShift ?? 0) < 0) {
    return 'stat_def';
  }
  if (sd?.pace || tm?.crossBias || tm?.overlapDepthBonus || tm?.dualOverlap || tm?.pressDistBonus) return 'stat_pace';
  return 'stat_fit';
}

export function drawAstrolabeBackdropAndRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseR: number,
  rect: { x: number; y: number; w: number; h: number },
  _animTime: number,
  rotFlashTimer: number,
  rotFlashRing: 'outer' | 'inner',
  opts?: { backdropAlpha?: number; topArchOnly?: boolean }
): void {
  ctx.save();
  // 深松石绒面径向桌面底（中心亮松石 -> 四周深松柏）
  const bg = ctx.createRadialGradient(cx, cy, baseR * 0.08, cx, cy, Math.max(rect.w, rect.h) * 0.72);
  bg.addColorStop(0, THEME.BG_PITCH_ALT);
  bg.addColorStop(0.65, THEME.BG_PANEL);
  bg.addColorStop(1, THEME.BG_DEEP);
  ctx.fillStyle = bg;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const ht = getHalftonePattern(ctx, true);
  if (ht) {
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = ht;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
  }

  // 顶部正对激活扇区荧光绿微光楔形 (-120° ~ -60°)
  ctx.fillStyle = 'rgba(200, 242, 48, 0.07)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, baseR * 1.02, -Math.PI / 2 - Math.PI / 6, -Math.PI / 2 + Math.PI / 6);
  ctx.closePath();
  ctx.fill();

  // 极细战术粉笔十字轴线
  ctx.strokeStyle = 'rgba(244, 239, 228, 0.11)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(cx - baseR * 1.04, cy);
  ctx.lineTo(cx + baseR * 1.04, cy);
  ctx.moveTo(cx, cy - baseR * 1.04);
  ctx.lineTo(cx, cy + baseR * 1.04);
  ctx.stroke();
  ctx.setLineDash([]);

  // 哑光黄铜同心刻度环 (#D8A842)
  const ringRadii = [0.20, 0.30, 0.40, 0.50, 0.60, 0.78, 0.90, 0.99];
  ringRadii.forEach((ratio, idx) => {
    const isFusionRing = idx === 3;
    const isOuterDial = idx === 5 || idx === 7;
    ctx.strokeStyle = isFusionRing
      ? THEME.BRASS
      : isOuterDial
      ? 'rgba(216, 168, 66, 0.50)'
      : 'rgba(216, 168, 66, 0.25)';
    ctx.lineWidth = isFusionRing ? 2.5 : isOuterDial ? 1.5 : 1;
    if (idx === 1 || idx === 4) ctx.setLineDash([4, 6]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * ratio, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // 72 刻度精密黄铜罗盘外齿（每 5° 一齿，30°/60° 加长加粗）
  for (let i = 0; i < 72; i++) {
    const rad = (i * Math.PI * 2) / 72;
    const major = i % 6 === 0;
    const mid = i % 3 === 0;
    ctx.strokeStyle = major ? THEME.BRASS : 'rgba(216, 168, 66, 0.40)';
    ctx.lineWidth = major ? 2 : 1.1;
    const r0 = baseR * (major ? 0.94 : mid ? 0.96 : 0.975);
    const r1 = baseR * 0.995;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * r0, cy + Math.sin(rad) * r0);
    ctx.lineTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
    ctx.stroke();
  }

  // 旋转奇点对齐黄铜星芒（无 shadowBlur）
  if (rotFlashTimer > 0) {
    const p = 1 - Math.min(1, rotFlashTimer / 0.65);
    const alpha = Math.max(0, (1 - p) * 0.88);
    const pulseCol = rotFlashRing === 'outer' ? THEME.LIME : THEME.BRASS;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = THEME.BRASS;
    ctx.lineWidth = 3.2 * (1 - p * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * (0.48 + p * 0.12), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = pulseCol;
    ctx.lineWidth = 2.4;
    const ringR = rotFlashRing === 'outer' ? 0.78 : 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * ringR, 0, Math.PI * 2);
    ctx.stroke();

    const count = opts?.topArchOnly ? 1 : 6;
    for (let idx = 0; idx < count; idx++) {
      const ang = -Math.PI / 2 + (idx * Math.PI) / 3;
      const fx = cx + Math.cos(ang) * (baseR * 0.50);
      const fy = cy + Math.sin(ang) * (baseR * 0.50);
      const starR = 12 + p * 14;
      ctx.strokeStyle = THEME.BRASS;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx - starR, fy);
      ctx.lineTo(fx + starR, fy);
      ctx.moveTo(fx, fy - starR);
      ctx.lineTo(fx, fy + starR);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawAstrolabeEdgeLine(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bothUnlocked: boolean,
  reachable: boolean,
  color: string,
  animTime: number,
  isBridge = false,
  bounds?: { x: number; y: number; w: number; h: number }
): void {
  if (bounds) {
    if (
      Math.max(ax, bx) < bounds.x - 20 ||
      Math.min(ax, bx) > bounds.x + bounds.w + 20 ||
      Math.max(ay, by) < bounds.y - 20 ||
      Math.min(ay, by) > bounds.y + bounds.h + 20
    ) {
      return;
    }
  }
  ctx.save();
  if (bothUnlocked) {
    ctx.strokeStyle = isBridge ? THEME.LIME : color;
    ctx.lineWidth = isBridge ? 3 : 2.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    const t = (animTime * 0.48 + ((ax + ay) % 100) * 0.01) % 1;
    const sx = ax + (bx - ax) * t;
    const sy = ay + (by - ay) * t;
    ctx.fillStyle = THEME.PAPER_CREAM;
    ctx.strokeStyle = THEME.INK_LINE;
    ctx.lineWidth = 1;
    ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
    ctx.strokeRect(sx - 2.5, sy - 2.5, 5, 5);
  } else if (reachable) {
    ctx.strokeStyle = isBridge ? THEME.BRASS : 'rgba(200, 242, 48, 0.65)';
    ctx.lineWidth = isBridge ? 2 : 1.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -animTime * 16;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = isBridge ? 'rgba(216, 168, 66, 0.25)' : 'rgba(154, 176, 163, 0.24)';
    ctx.lineWidth = isBridge ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawAstrolabeCircleNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  glyph: SkillGlyphKind,
  color: string,
  unlocked: boolean,
  reachable: boolean,
  selected: boolean,
  animTime: number,
  isOrigin = false
): void {
  const rotSlow = animTime * 0.55;
  ctx.save();
  if (unlocked || selected) {
    ctx.fillStyle = THEME.HARD_SHADOW;
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = unlocked ? THEME.BG_PITCH_ALT : reachable ? THEME.BG_CARD_DARK : THEME.BG_DEEP;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = selected ? 3 : isOrigin ? 2.6 : 2.2;
  ctx.strokeStyle = selected ? THEME.LIME : unlocked ? THEME.BRASS : reachable ? THEME.LIME : THEME.INK_LINE;
  ctx.stroke();

  if (isOrigin && (unlocked || reachable)) {
    ctx.strokeStyle = unlocked ? THEME.BRASS : THEME.LIME;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, r + 4, rotSlow, rotSlow + Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawSkillGlyph(
    ctx,
    glyph,
    x,
    y,
    r * (isOrigin ? 1.42 : 1.26),
    unlocked ? color : reachable ? THEME.LIME : THEME.TX3,
    THEME.BRASS,
    { dim: !unlocked && !reachable, vectorOnly: true }
  );
  ctx.restore();
}

export function drawAstrolabeHexFusionNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  unlocked: boolean,
  reachable: boolean,
  selected: boolean,
  animTime: number,
  label?: string
): void {
  const rotSlow = animTime * 0.55;
  const traceHex = (ox: number, oy: number) => {
    ctx.beginPath();
    for (let h = 0; h < 6; h++) {
      const ha = (h * Math.PI) / 3 - Math.PI / 6;
      const hx = x + ox + Math.cos(ha) * r;
      const hy = y + oy + Math.sin(ha) * r;
      if (h === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
  };

  ctx.save();
  traceHex(2.5, 2.5);
  ctx.fillStyle = THEME.HARD_SHADOW;
  ctx.fill();

  traceHex(0, 0);
  ctx.fillStyle = unlocked ? '#3F2D0E' : reachable ? THEME.BG_CARD_DARK : THEME.BG_DEEP;
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 2.4;
  ctx.strokeStyle = selected ? THEME.LIME : unlocked ? THEME.BRASS : reachable ? THEME.LIME : THEME.INK_LINE;
  ctx.stroke();

  if (unlocked || reachable) {
    ctx.strokeStyle = unlocked ? THEME.BRASS : THEME.LIME;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, r + 4.5, -rotSlow, -rotSlow + Math.PI * 1.45);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawSkillGlyph(ctx, 'fusion', x, y, r * 1.38, unlocked ? THEME.BRASS : THEME.LIME, THEME.PAPER_CREAM, {
    dim: !unlocked && !reachable,
    vectorOnly: true,
  });
  ctx.restore();

  if (label) {
    drawText(ctx, label, x, y + r + 13, {
      size: 12,
      bold: true,
      color: unlocked ? THEME.BRASS : THEME.TX1,
      align: 'center',
      rawSize: true,
    });
  }
}

export function drawAstrolabeDiamondSkillNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dr: number,
  glyph: SkillGlyphKind,
  unlocked: boolean,
  reachable: boolean,
  equipped: boolean,
  selected: boolean,
  label?: string
): void {
  const traceDiamond = (ox: number, oy: number, rad: number) => {
    ctx.beginPath();
    ctx.moveTo(x + ox, y + oy - rad);
    ctx.lineTo(x + ox + rad, y + oy);
    ctx.lineTo(x + ox, y + oy + rad);
    ctx.lineTo(x + ox - rad, y + oy);
    ctx.closePath();
  };

  ctx.save();
  traceDiamond(2.5, 2.5, dr);
  ctx.fillStyle = THEME.HARD_SHADOW;
  ctx.fill();

  traceDiamond(0, 0, dr);
  ctx.fillStyle = equipped ? THEME.BG_PITCH_ALT : unlocked ? '#1B3429' : reachable ? THEME.BG_CARD_DARK : THEME.BG_DEEP;
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 2.2;
  ctx.strokeStyle = selected ? THEME.PAPER_CREAM : equipped ? THEME.LIME : unlocked ? THEME.BRASS : reachable ? THEME.LIME : THEME.INK_LINE;
  ctx.stroke();

  traceDiamond(0, 0, dr * 0.72);
  ctx.strokeStyle = equipped ? THEME.LIME : unlocked ? THEME.BRASS : 'rgba(154,176,163,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  drawSkillGlyph(ctx, glyph, x, y, dr * 1.12, unlocked ? THEME.BRASS : THEME.TX3, THEME.LIME, {
    dim: !unlocked && !reachable,
    vectorOnly: true,
  });
  ctx.restore();

  if (label) {
    drawText(ctx, label, x, y + dr + 12, {
      size: 12,
      bold: equipped || selected,
      color: equipped ? THEME.LIME : unlocked ? THEME.TX1 : THEME.TX3,
      align: 'center',
      rawSize: true,
    });
  }
}

export function drawAstrolabeDirectiveNode(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  x: number,
  y: number,
  nr: number,
  tendency: DirectiveTendency,
  zone: DirectiveZone,
  unlocked: boolean,
  reachable: boolean,
  equipped: boolean,
  selected: boolean,
  sats: V6SatelliteKey[],
  label?: string
): void {
  const subAngle = Math.atan2(y - cy, x - cx);
  ctx.save();
  if (unlocked || equipped || selected) {
    ctx.fillStyle = THEME.HARD_SHADOW;
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, nr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = unlocked ? (equipped ? THEME.BG_PITCH_ALT : THEME.BG_CARD_DARK) : reachable ? '#12261E' : THEME.BG_DEEP;
  ctx.beginPath();
  ctx.arc(x, y, nr, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = selected ? 2.8 : 2.1;
  ctx.strokeStyle = selected
    ? THEME.PAPER_CREAM
    : equipped
    ? THEME.LIME
    : unlocked
    ? ASTROLABE_ZONE_COLOR[zone]
    : reachable
    ? THEME.BRASS
    : THEME.INK_LINE;
  ctx.stroke();

  drawIcon(
    ctx,
    tendency === 'ATK' ? 'sword' : 'shield',
    x,
    y,
    nr * 1.15,
    unlocked ? (equipped ? THEME.LIME : ASTROLABE_ZONE_COLOR[zone]) : reachable ? THEME.BRASS : THEME.TX3
  );

  (['A', 'B', 'C'] as V6SatelliteKey[]).forEach((sk, si) => {
    const sa = subAngle - 0.55 + si * 0.55;
    const sx = x + Math.cos(sa) * (nr + 3.8);
    const sy = y + Math.sin(sa) * (nr + 3.8);
    const lit = sats.includes(sk);
    ctx.fillStyle = lit ? (sk === 'C' ? THEME.BRASS : sk === 'B' ? THEME.COBALT : THEME.LIME) : 'rgba(110,133,120,0.45)';
    ctx.beginPath();
    ctx.arc(sx, sy, lit ? 2.4 : 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  if (label) {
    drawText(ctx, label, x, y + nr + 11, {
      size: 12,
      bold: selected || equipped,
      color: equipped ? THEME.LIME : unlocked ? THEME.TX1 : THEME.TX3,
      align: 'center',
      rawSize: true,
    });
  }
}
