/**
 * V6 八卦战术星盘共享视觉渲染原语
 * 供 MetaScreen 全景星盘与 TitleScreen 建队 Step 2 正上方特写星盘复用
 */

import type { V6PassiveDef, V6SatelliteKey } from '../../core/src/v6';
import type { DefenseSystem, DirectiveTendency, DirectiveZone, TacticalStyle } from '../../engine/src/types';
import { AssetLoader } from './AssetLoader';
import { drawText } from './CanvasKit';
import { IS_MOBILE, THEME } from './Theme';
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
  ATT: '#F43F5E',
  MID: '#38BDF8',
  DEF: '#22C55E',
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
  animTime: number,
  rotFlashTimer: number,
  rotFlashRing: 'outer' | 'inner',
  opts?: { backdropAlpha?: number; topArchOnly?: boolean }
): void {
  const constImg = AssetLoader.get('bg_skill_constellation');
  if (constImg && typeof ctx.drawImage === 'function') {
    const iw = constImg.naturalWidth || constImg.width || 1024;
    const ih = constImg.naturalHeight || constImg.height || 572;
    const cover = Math.max(rect.w / iw, rect.h / ih);
    ctx.save();
    ctx.globalAlpha = opts?.backdropAlpha ?? 0.46;
    ctx.drawImage(
      constImg,
      rect.x + rect.w / 2 - (iw * cover) / 2,
      rect.y + rect.h / 2 - (ih * cover) / 2,
      iw * cover,
      ih * cover
    );
    ctx.restore();
  }

  // 5 层同心轨道圆环
  const ringRadii = [0.20, 0.30, 0.40, 0.50, 0.60, 0.78, 0.90, 0.99];
  ringRadii.forEach((ratio, idx) => {
    const isFusionRing = idx === 3;
    ctx.strokeStyle = isFusionRing ? 'rgba(250, 204, 21, 0.42)' : 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = isFusionRing ? 1.9 : 1;
    if (idx === 1 || idx === 4 || idx === 5) ctx.setLineDash([3, 6]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * ratio, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // 旋转奇点对齐光波与星辉脉冲
  if (rotFlashTimer > 0) {
    const p = 1 - Math.min(1, rotFlashTimer / 0.65);
    const alpha = Math.max(0, (1 - p) * 0.90);
    const pulseCol = rotFlashRing === 'outer' ? '#38BDF8' : '#F59E0B';
    ctx.save();
    ctx.strokeStyle = `rgba(250, 204, 21, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 3.8 * (1 - p * 0.55);
    if (!IS_MOBILE) {
      ctx.shadowColor = THEME.GOLD_LIGHT;
      ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * (0.48 + p * 0.15), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = pulseCol;
    ctx.globalAlpha = alpha * 0.75;
    ctx.lineWidth = 2.6;
    const ringR = rotFlashRing === 'outer' ? 0.78 : 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * ringR, 0, Math.PI * 2);
    ctx.stroke();

    const count = opts?.topArchOnly ? 1 : 6;
    for (let idx = 0; idx < count; idx++) {
      const ang = -Math.PI / 2 + (idx * Math.PI) / 3;
      const fx = cx + Math.cos(ang) * (baseR * 0.50);
      const fy = cy + Math.sin(ang) * (baseR * 0.50);
      const flareR = (18 + p * 28) * Math.max(0.85, baseR / 280);
      const grad = ctx.createRadialGradient(fx, fy, 2, fx, fy, flareR);
      grad.addColorStop(0, `rgba(254, 240, 138, ${alpha.toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(250, 204, 21, ${(alpha * 0.45).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fx, fy, flareR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
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
    ctx.strokeStyle = color;
    ctx.lineWidth = isBridge ? 2.6 : 1.9;
    if (!IS_MOBILE) {
      ctx.shadowColor = color;
      ctx.shadowBlur = isBridge ? 10 : 6;
    }
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    const t = (animTime * 0.48 + ((ax + ay) % 100) * 0.01) % 1;
    const sx = ax + (bx - ax) * t;
    const sy = ay + (by - ay) * t;
    ctx.fillStyle = '#FEF08A';
    if (!IS_MOBILE) ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, isBridge ? 2.4 : 1.7, 0, Math.PI * 2);
    ctx.fill();
  } else if (reachable) {
    ctx.strokeStyle = isBridge ? 'rgba(250, 204, 21, 0.78)' : 'rgba(56, 189, 248, 0.72)';
    ctx.lineWidth = isBridge ? 2 : 1.45;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -animTime * 16;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = isBridge ? 'rgba(250, 204, 21, 0.24)' : 'rgba(100, 116, 139, 0.28)';
    ctx.lineWidth = isBridge ? 1.3 : 1;
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
  if (!IS_MOBILE && (unlocked || reachable || selected)) {
    ctx.shadowColor = selected ? '#FFFFFF' : unlocked ? color : '#38BDF8';
    ctx.shadowBlur = selected ? 14 : unlocked ? 10 : 6;
  }
  ctx.fillStyle = unlocked ? '#16213A' : reachable ? '#0F1D33' : '#090F1D';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = selected ? 2.4 : isOrigin ? 2.2 : unlocked ? 1.8 : 1.2;
  ctx.strokeStyle = selected ? '#FFFFFF' : unlocked ? color : reachable ? '#38BDF8' : '#334155';
  ctx.stroke();

  if (isOrigin && (unlocked || reachable)) {
    ctx.strokeStyle = unlocked ? THEME.GOLD_LIGHT : 'rgba(56,189,248,0.65)';
    ctx.lineWidth = 1.15;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, r + 3.5, rotSlow, rotSlow + Math.PI * 1.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawSkillGlyph(
    ctx,
    glyph,
    x,
    y,
    r * (isOrigin ? 1.42 : 1.26),
    unlocked ? color : reachable ? '#7DD3FC' : '#64748B',
    THEME.GOLD_LIGHT,
    { dim: !unlocked && !reachable }
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
  ctx.save();
  if (!IS_MOBILE && (unlocked || reachable || selected)) {
    ctx.shadowColor = selected ? '#FFFFFF' : THEME.GOLD_LIGHT;
    ctx.shadowBlur = unlocked ? 18 : 12;
  }
  ctx.fillStyle = unlocked ? '#422006' : reachable ? '#1C1917' : '#0F172A';
  ctx.beginPath();
  for (let h = 0; h < 6; h++) {
    const ha = (h * Math.PI) / 3 - Math.PI / 6;
    const hx = x + Math.cos(ha) * r;
    const hy = y + Math.sin(ha) * r;
    if (h === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = selected ? 2.6 : unlocked ? 2.4 : 1.6;
  ctx.strokeStyle = selected ? '#FFFFFF' : unlocked ? '#FEF08A' : reachable ? '#F59E0B' : '#64748B';
  ctx.stroke();

  if (unlocked || reachable) {
    ctx.strokeStyle = unlocked ? 'rgba(254,240,138,0.72)' : 'rgba(245,158,11,0.55)';
    ctx.lineWidth = 1.15;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, r + 4, -rotSlow, -rotSlow + Math.PI * 1.45);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawSkillGlyph(ctx, 'fusion', x, y, r * 1.38, unlocked ? '#FEF08A' : '#F59E0B', THEME.GOLD_LIGHT, {
    dim: !unlocked && !reachable,
  });
  ctx.restore();

  if (label) {
    drawText(ctx, label, x, y + r + 11, {
      size: 10.5,
      bold: true,
      color: unlocked ? THEME.GOLD_LIGHT : '#FDE68A',
      align: 'center',
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
  ctx.save();
  if (!IS_MOBILE && (selected || equipped || unlocked)) {
    ctx.shadowColor = selected ? '#FFFFFF' : equipped ? '#4ADE80' : '#38BDF8';
    ctx.shadowBlur = selected ? 14 : 10;
  }
  ctx.fillStyle = equipped ? '#0C4A6E' : unlocked ? '#172554' : reachable ? '#0E223A' : '#0B111F';
  ctx.beginPath();
  ctx.moveTo(x, y - dr);
  ctx.lineTo(x + dr, y);
  ctx.lineTo(x, y + dr);
  ctx.lineTo(x - dr, y);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = selected ? 2.4 : equipped ? 2.1 : unlocked ? 1.8 : 1.2;
  ctx.strokeStyle = selected ? '#FFFFFF' : equipped ? '#4ADE80' : unlocked ? '#38BDF8' : reachable ? '#7DD3FC' : '#334155';
  ctx.stroke();

  const idr = dr * 0.72;
  ctx.strokeStyle = equipped ? 'rgba(74,222,128,0.55)' : unlocked ? 'rgba(250,204,21,0.45)' : 'rgba(100,116,139,0.22)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y - idr);
  ctx.lineTo(x + idr, y);
  ctx.lineTo(x, y + idr);
  ctx.lineTo(x - idr, y);
  ctx.closePath();
  ctx.stroke();

  drawSkillGlyph(ctx, glyph, x, y, dr * 1.12, unlocked ? '#7DD3FC' : '#64748B', THEME.GOLD_LIGHT, {
    dim: !unlocked && !reachable,
  });
  ctx.restore();

  if (label) {
    drawText(ctx, label, x, y + dr + 9, {
      size: 9,
      bold: equipped || selected,
      color: equipped ? '#4ADE80' : unlocked ? '#7DD3FC' : THEME.TX3,
      align: 'center',
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
  if (!IS_MOBILE && (selected || equipped || unlocked)) {
    ctx.shadowColor = selected ? '#FFFFFF' : equipped ? '#4ADE80' : ASTROLABE_ZONE_COLOR[zone];
    ctx.shadowBlur = selected ? 12 : equipped ? 9 : 5;
  }
  ctx.fillStyle = unlocked ? (equipped ? '#14532D' : '#1E293B') : reachable ? '#101C32' : '#0B111F';
  ctx.beginPath();
  ctx.arc(x, y, nr, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = selected ? 2.4 : equipped ? 2.1 : unlocked ? 1.6 : 1.1;
  ctx.strokeStyle = selected ? '#FFFFFF' : equipped ? '#4ADE80' : unlocked ? ASTROLABE_ZONE_COLOR[zone] : reachable ? '#38BDF8' : '#334155';
  ctx.stroke();

  drawIcon(
    ctx,
    tendency === 'ATK' ? 'sword' : 'shield',
    x,
    y,
    nr * 1.15,
    unlocked ? (equipped ? '#86EFAC' : ASTROLABE_ZONE_COLOR[zone]) : reachable ? '#7DD3FC' : '#475569'
  );

  (['A', 'B', 'C'] as V6SatelliteKey[]).forEach((sk, si) => {
    const sa = subAngle - 0.55 + si * 0.55;
    const sx = x + Math.cos(sa) * (nr + 3.4);
    const sy = y + Math.sin(sa) * (nr + 3.4);
    const lit = sats.includes(sk);
    ctx.fillStyle = lit ? (sk === 'C' ? THEME.GOLD_LIGHT : sk === 'B' ? '#38BDF8' : '#4ADE80') : 'rgba(100,116,139,0.35)';
    ctx.beginPath();
    ctx.arc(sx, sy, lit ? 2.1 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  if (label) {
    drawText(ctx, label, x, y + nr + 8, {
      size: 8.5,
      bold: selected || equipped,
      color: equipped ? '#4ADE80' : unlocked ? THEME.TX1 : THEME.TX3,
      align: 'center',
    });
  }
}
