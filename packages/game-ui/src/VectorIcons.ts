/**
 * 纯 Canvas 2D 发行级矢量图标库（彻底替代系统 Emoji）
 * 零图片/字体外部依赖，全平台渲染完全一致；技能树雕纹支持优先加载高精透明美术资源
 */

import { ArtAssetId, AssetLoader } from './AssetLoader';

export type IconName =
  | 'trophy'
  | 'talent'
  | 'card'
  | 'sound_on'
  | 'sound_off'
  | 'refresh'
  | 'bolt'
  | 'ball'
  | 'home'
  | 'tactics'
  | 'craft'
  | 'dice'
  | 'edit'
  | 'sparkle'
  | 'chart'
  | 'warn'
  | 'check'
  | 'close'
  | 'shield'
  | 'sword'
  | 'play'
  | 'star'
  | 'lock'
  | 'book'
  | 'link'
  | 'gear'
  | 'save';

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  cx: number,
  cy: number,
  size = 14,
  color = '#F1F5F9'
): void {
  const r = size * 0.48;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (name) {
    case 'trophy': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.72, cy - r * 0.78);
      ctx.lineTo(cx + r * 0.72, cy - r * 0.78);
      ctx.quadraticCurveTo(cx + r * 0.65, cy + r * 0.15, cx + r * 0.18, cy + r * 0.28);
      ctx.lineTo(cx + r * 0.18, cy + r * 0.62);
      ctx.lineTo(cx + r * 0.52, cy + r * 0.85);
      ctx.lineTo(cx - r * 0.52, cy + r * 0.85);
      ctx.lineTo(cx - r * 0.18, cy + r * 0.62);
      ctx.lineTo(cx - r * 0.18, cy + r * 0.28);
      ctx.quadraticCurveTo(cx - r * 0.65, cy + r * 0.15, cx - r * 0.72, cy - r * 0.78);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - r * 0.72, cy - r * 0.42, r * 0.26, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.72, cy - r * 0.42, r * 0.26, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      break;
    }
    case 'talent': {
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.65, r * 0.24, 0, Math.PI * 2);
      ctx.arc(cx - r * 0.62, cy + r * 0.52, r * 0.24, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.62, cy + r * 0.52, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.4);
      ctx.lineTo(cx, cy + r * 0.08);
      ctx.lineTo(cx - r * 0.52, cy + r * 0.4);
      ctx.moveTo(cx, cy + r * 0.08);
      ctx.lineTo(cx + r * 0.52, cy + r * 0.4);
      ctx.stroke();
      break;
    }
    case 'card': {
      ctx.strokeRect(cx - r * 0.75, cy - r * 0.85, r * 1.15, r * 1.5);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.75, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.75, cy + r * 0.9);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.9);
      ctx.stroke();
      break;
    }
    case 'sound_on': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy - r * 0.3);
      ctx.lineTo(cx - r * 0.35, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.15, cy - r * 0.72);
      ctx.lineTo(cx + r * 0.15, cy + r * 0.72);
      ctx.lineTo(cx - r * 0.35, cy + r * 0.3);
      ctx.lineTo(cx - r * 0.8, cy + r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + r * 0.2, cy, r * 0.45, -0.75, 0.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + r * 0.2, cy, r * 0.78, -0.75, 0.75);
      ctx.stroke();
      break;
    }
    case 'sound_off': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy - r * 0.3);
      ctx.lineTo(cx - r * 0.35, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.15, cy - r * 0.72);
      ctx.lineTo(cx + r * 0.15, cy + r * 0.72);
      ctx.lineTo(cx - r * 0.35, cy + r * 0.3);
      ctx.lineTo(cx - r * 0.8, cy + r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.42, cy - r * 0.35);
      ctx.lineTo(cx + r * 0.92, cy + r * 0.35);
      ctx.moveTo(cx + r * 0.92, cy - r * 0.35);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.35);
      ctx.stroke();
      break;
    }
    case 'refresh': {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, -Math.PI * 0.8, Math.PI * 0.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.3, cy - r * 0.88);
      ctx.lineTo(cx + r * 0.75, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.22, cy - r * 0.32);
      ctx.stroke();
      break;
    }
    case 'bolt': {
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.18, cy - r * 0.92);
      ctx.lineTo(cx - r * 0.56, cy + r * 0.08);
      ctx.lineTo(cx + r * 0.04, cy + r * 0.08);
      ctx.lineTo(cx - r * 0.18, cy + r * 0.92);
      ctx.lineTo(cx + r * 0.58, cy - r * 0.08);
      ctx.lineTo(cx - r * 0.04, cy - r * 0.08);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ball': {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * r * 0.36;
        const py = cy + Math.sin(a) * r * 0.36;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'home': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.85, cy + r * 0.05);
      ctx.lineTo(cx, cy - r * 0.82);
      ctx.lineTo(cx + r * 0.85, cy + r * 0.05);
      ctx.moveTo(cx - r * 0.62, cy - r * 0.12);
      ctx.lineTo(cx - r * 0.62, cy + r * 0.82);
      ctx.lineTo(cx + r * 0.62, cy + r * 0.82);
      ctx.lineTo(cx + r * 0.62, cy - r * 0.12);
      ctx.stroke();
      break;
    }
    case 'tactics': {
      ctx.strokeRect(cx - r * 0.78, cy - r * 0.82, r * 1.56, r * 1.64);
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy + r * 0.32, r * 0.18, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.35, cy - r * 0.32, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy + r * 0.18);
      ctx.lineTo(cx + r * 0.22, cy - r * 0.2);
      ctx.stroke();
      break;
    }
    case 'craft': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.88);
      ctx.lineTo(cx + r * 0.72, cy);
      ctx.lineTo(cx, cy + r * 0.88);
      ctx.lineTo(cx - r * 0.72, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'dice': {
      ctx.strokeRect(cx - r * 0.75, cy - r * 0.75, r * 1.5, r * 1.5);
      ctx.beginPath();
      ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.13, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.32, cy + r * 0.32, r * 0.13, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'edit': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.72, cy + r * 0.72);
      ctx.lineTo(cx - r * 0.56, cy + r * 0.18);
      ctx.lineTo(cx + r * 0.42, cy - r * 0.78);
      ctx.lineTo(cx + r * 0.78, cy - r * 0.42);
      ctx.lineTo(cx - r * 0.18, cy + r * 0.56);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'sparkle':
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? r * 0.88 : r * 0.32;
        const a = (Math.PI / 4) * i - Math.PI / 2;
        const px = cx + Math.cos(a) * rad;
        const py = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'chart': {
      ctx.fillRect(cx - r * 0.72, cy + r * 0.05, r * 0.34, r * 0.75);
      ctx.fillRect(cx - r * 0.17, cy - r * 0.35, r * 0.34, r * 1.15);
      ctx.fillRect(cx + r * 0.38, cy - r * 0.75, r * 0.34, r * 1.55);
      break;
    }
    case 'warn': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.82);
      ctx.lineTo(cx + r * 0.82, cy + r * 0.72);
      ctx.lineTo(cx - r * 0.82, cy + r * 0.72);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.25);
      ctx.lineTo(cx, cy + r * 0.22);
      ctx.moveTo(cx, cy + r * 0.46);
      ctx.lineTo(cx, cy + r * 0.52);
      ctx.stroke();
      break;
    }
    case 'check': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy + r * 0.05);
      ctx.lineTo(cx - r * 0.15, cy + r * 0.6);
      ctx.lineTo(cx + r * 0.75, cy - r * 0.55);
      ctx.stroke();
      break;
    }
    case 'close': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx + r * 0.6, cy + r * 0.6);
      ctx.moveTo(cx + r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx - r * 0.6, cy + r * 0.6);
      ctx.stroke();
      break;
    }
    case 'shield': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy - r * 0.78);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.78);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.06);
      ctx.quadraticCurveTo(cx + r * 0.65, cy + r * 0.65, cx, cy + r * 0.88);
      ctx.quadraticCurveTo(cx - r * 0.65, cy + r * 0.65, cx - r * 0.7, cy + r * 0.06);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'sword': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.68, cy + r * 0.68);
      ctx.lineTo(cx + r * 0.74, cy - r * 0.74);
      ctx.moveTo(cx - r * 0.48, cy + r * 0.12);
      ctx.lineTo(cx - r * 0.12, cy + r * 0.48);
      ctx.stroke();
      break;
    }
    case 'play': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.48, cy - r * 0.72);
      ctx.lineTo(cx + r * 0.72, cy);
      ctx.lineTo(cx - r * 0.48, cy + r * 0.72);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'lock': {
      ctx.strokeRect(cx - r * 0.54, cy - r * 0.08, r * 1.08, r * 0.72);
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.10, r * 0.34, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.28, Math.max(1.2, r * 0.13), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'book': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.44);
      ctx.lineTo(cx - r * 0.68, cy - r * 0.56);
      ctx.lineTo(cx - r * 0.68, cy + r * 0.42);
      ctx.lineTo(cx, cy + r * 0.56);
      ctx.lineTo(cx + r * 0.68, cy + r * 0.42);
      ctx.lineTo(cx + r * 0.68, cy - r * 0.56);
      ctx.closePath();
      ctx.moveTo(cx, cy - r * 0.44);
      ctx.lineTo(cx, cy + r * 0.56);
      ctx.stroke();
      break;
    }
    case 'link': {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.roundRect(-r * 0.68, -r * 0.24, r * 0.78, r * 0.48, r * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-r * 0.10, -r * 0.24, r * 0.78, r * 0.48, r * 0.22);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'gear': {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.46, cy + Math.sin(a) * r * 0.46);
        ctx.lineTo(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74);
        ctx.stroke();
      }
      break;
    }
    case 'save': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.62, cy - r * 0.62);
      ctx.lineTo(cx + r * 0.34, cy - r * 0.62);
      ctx.lineTo(cx + r * 0.62, cy - r * 0.34);
      ctx.lineTo(cx + r * 0.62, cy + r * 0.62);
      ctx.lineTo(cx - r * 0.62, cy + r * 0.62);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeRect(cx - r * 0.36, cy - r * 0.62, r * 0.56, r * 0.34);
      ctx.strokeRect(cx - r * 0.38, cy + r * 0.12, r * 0.76, r * 0.50);
      break;
    }
  }
  ctx.restore();
}

export type SkillGlyphKind =
  | 'master'
  | 'press'
  | 'tiki'
  | 'wing'
  | 'counter'
  | 'bus'
  | 'balanced'
  | 'sys_4back'
  | 'sys_3back'
  | 'sys_5back'
  | 'fusion'
  | 'keystone'
  | 'stat_shoot'
  | 'stat_pass'
  | 'stat_def'
  | 'stat_pace'
  | 'stat_fit';

export function getNodeGlyphKind(node: {
  id?: string;
  kind: string;
  styleTag?: string;
  systemTag?: string;
  effect?: {
    shooting?: number;
    passing?: number;
    composure?: number;
    defending?: number;
    goalkeeping?: number;
    positioning?: number;
    pace?: number;
    dribbling?: number;
  };
}): SkillGlyphKind {
  if (node.id === 'core_master') return 'master';
  if (node.kind === 'fusion') return 'fusion';
  if (node.kind === 'keystone') return 'keystone';
  if (node.styleTag === 'gegenpress') return 'press';
  if (node.styleTag === 'tiki_taka') return 'tiki';
  if (node.styleTag === 'wing_play') return 'wing';
  if (node.styleTag === 'counter') return 'counter';
  if (node.styleTag === 'park_bus') return 'bus';
  if (node.styleTag === 'balanced') return 'balanced';
  if (node.systemTag === '4-back') return 'sys_4back';
  if (node.systemTag === '3-back') return 'sys_3back';
  if (node.systemTag === '5-back') return 'sys_5back';
  const ef = node.effect ?? {};
  if ((ef.shooting ?? 0) > 0) return 'stat_shoot';
  if ((ef.passing ?? 0) > 0 || (ef.composure ?? 0) > 0) return 'stat_pass';
  if ((ef.defending ?? 0) > 0 || (ef.goalkeeping ?? 0) > 0 || (ef.positioning ?? 0) > 0) return 'stat_def';
  if ((ef.pace ?? 0) > 0 || (ef.dribbling ?? 0) > 0) return 'stat_pace';
  return 'stat_fit';
}

const GLYPH_ART_MAP: Partial<Record<SkillGlyphKind, ArtAssetId>> = {
  master: 'icon_skill_master',
  press: 'icon_style_press',
  tiki: 'icon_style_tiki',
  wing: 'icon_style_wing',
  counter: 'icon_style_counter',
  bus: 'icon_style_bus',
  balanced: 'icon_style_balanced',
  sys_4back: 'icon_sys_4back',
  sys_3back: 'icon_sys_3back',
  sys_5back: 'icon_sys_5back',
  fusion: 'icon_node_fusion',
  keystone: 'icon_node_keystone',
};

/**
 * 暗黑鎏金雕纹技能图标（优先使用高清透明美术雕纹，未命中或被动微图标回退纯矢量）
 */
export function drawSkillGlyph(
  ctx: CanvasRenderingContext2D,
  kind: SkillGlyphKind,
  cx: number,
  cy: number,
  size: number,
  primaryColor: string,
  accentColor = '#FACC15',
  opts?: { dim?: boolean }
): void {
  const artId = GLYPH_ART_MAP[kind];
  const img = artId ? AssetLoader.get(artId) : null;
  if (img && typeof ctx.drawImage === 'function') {
    const drawS = size * 1.24;
    ctx.save();
    if (opts?.dim) ctx.globalAlpha *= 0.48;
    ctx.drawImage(img, cx - drawS / 2, cy - drawS / 2, drawS, drawS);
    ctx.restore();
    return;
  }

  const r = size * 0.48;
  ctx.save();
  ctx.strokeStyle = primaryColor;
  ctx.fillStyle = primaryColor;
  ctx.lineWidth = Math.max(1.2, size * 0.105);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (kind) {
    case 'master': {
      // 主权皇冠 + 四芒星核
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.72, cy + r * 0.36);
      ctx.lineTo(cx - r * 0.80, cy - r * 0.36);
      ctx.lineTo(cx - r * 0.32, cy - r * 0.04);
      ctx.lineTo(cx, cy - r * 0.74);
      ctx.lineTo(cx + r * 0.32, cy - r * 0.04);
      ctx.lineTo(cx + r * 0.80, cy - r * 0.36);
      ctx.lineTo(cx + r * 0.72, cy + r * 0.36);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.56, Math.max(1.5, r * 0.16), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'press': {
      // 双重猎杀尖牙 + 向心冲击刃
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.68, cy - r * 0.62);
      ctx.lineTo(cx - r * 0.14, cy - r * 0.08);
      ctx.lineTo(cx - r * 0.42, cy + r * 0.64);
      ctx.moveTo(cx + r * 0.68, cy - r * 0.62);
      ctx.lineTo(cx + r * 0.14, cy - r * 0.08);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.64);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.52);
      ctx.lineTo(cx + r * 0.22, cy);
      ctx.lineTo(cx, cy + r * 0.52);
      ctx.lineTo(cx - r * 0.22, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'tiki': {
      // 几何传控三角星环 + 三节点
      const pts: Array<[number, number]> = [
        [cx, cy - r * 0.68],
        [cx - r * 0.64, cy + r * 0.48],
        [cx + r * 0.64, cy + r * 0.48],
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = accentColor;
      for (const [px, py] of pts) {
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, r * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'wing': {
      // 双翼展翅气旋刃
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.48);
      ctx.quadraticCurveTo(cx - r * 0.28, cy - r * 0.16, cx - r * 0.86, cy - r * 0.54);
      ctx.quadraticCurveTo(cx - r * 0.42, cy - r * 0.08, cx - r * 0.58, cy + r * 0.22);
      ctx.moveTo(cx, cy + r * 0.48);
      ctx.quadraticCurveTo(cx + r * 0.28, cy - r * 0.16, cx + r * 0.86, cy - r * 0.54);
      ctx.quadraticCurveTo(cx + r * 0.42, cy - r * 0.08, cx + r * 0.58, cy + r * 0.22);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.12, Math.max(1.4, r * 0.16), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'counter': {
      // 弯刀长矛突击箭头
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.68, cy + r * 0.64);
      ctx.lineTo(cx + r * 0.72, cy - r * 0.68);
      ctx.moveTo(cx + r * 0.16, cy - r * 0.70);
      ctx.lineTo(cx + r * 0.72, cy - r * 0.68);
      ctx.lineTo(cx + r * 0.70, cy - r * 0.12);
      ctx.moveTo(cx - r * 0.44, cy - r * 0.08);
      ctx.lineTo(cx + r * 0.18, cy + r * 0.52);
      ctx.stroke();
      break;
    }
    case 'bus': {
      // 重装堡垒鸢盾 + 中脊铁柱
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.66, cy - r * 0.66);
      ctx.lineTo(cx + r * 0.66, cy - r * 0.66);
      ctx.lineTo(cx + r * 0.66, cy + r * 0.05);
      ctx.quadraticCurveTo(cx + r * 0.58, cy + r * 0.62, cx, cy + r * 0.84);
      ctx.quadraticCurveTo(cx - r * 0.58, cy + r * 0.62, cx - r * 0.66, cy + r * 0.05);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.58);
      ctx.lineTo(cx, cy + r * 0.72);
      ctx.moveTo(cx - r * 0.46, cy - r * 0.12);
      ctx.lineTo(cx + r * 0.46, cy - r * 0.12);
      ctx.stroke();
      break;
    }
    case 'balanced': {
      // 宝石星盘双轨均衡徽
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.74);
      ctx.lineTo(cx + r * 0.74, cy);
      ctx.lineTo(cx, cy + r * 0.74);
      ctx.lineTo(cx - r * 0.74, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'sys_4back': {
      // 四枚整肃横排防线菱片
      for (const ox of [-0.66, -0.22, 0.22, 0.66]) {
        const px = cx + r * ox;
        ctx.fillRect(px - r * 0.14, cy - r * 0.34, r * 0.28, r * 0.68);
      }
      ctx.strokeStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.78, cy);
      ctx.lineTo(cx + r * 0.78, cy);
      ctx.stroke();
      break;
    }
    case 'sys_3back': {
      // 三叉戟推进战阵
      for (const ox of [-0.56, 0, 0.56]) {
        const px = cx + r * ox;
        ctx.beginPath();
        ctx.moveTo(px - r * 0.2, cy + r * 0.35);
        ctx.lineTo(px, cy - (ox === 0 ? r * 0.65 : r * 0.42));
        ctx.lineTo(px + r * 0.2, cy + r * 0.35);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.58, cy + r * 0.54);
      ctx.lineTo(cx + r * 0.58, cy + r * 0.54);
      ctx.stroke();
      break;
    }
    case 'sys_5back': {
      // 五垛城墙弧壁
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.22, r * 0.74, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      for (const ox of [-0.62, -0.31, 0, 0.31, 0.62]) {
        const px = cx + r * ox;
        ctx.fillRect(px - r * 0.08, cy - r * 0.58 + Math.abs(ox) * r * 0.45, r * 0.16, r * 0.28);
      }
      break;
    }
    case 'fusion': {
      // 双重交锁炼金日轮
      ctx.beginPath();
      ctx.arc(cx - r * 0.22, cy, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = accentColor;
      ctx.beginPath();
      ctx.arc(cx + r * 0.22, cy, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.4, r * 0.18), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'keystone': {
      // 八芒星奥术核心
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * r * 0.78, cy - Math.sin(a) * r * 0.78);
        ctx.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
        ctx.stroke();
      }
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stat_shoot': {
      // 准星十字
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
      ctx.moveTo(cx - r * 0.8, cy);
      ctx.lineTo(cx + r * 0.8, cy);
      ctx.moveTo(cx, cy - r * 0.8);
      ctx.lineTo(cx, cy + r * 0.8);
      ctx.stroke();
      break;
    }
    case 'stat_pass': {
      // 穿透弧线
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.65, cy + r * 0.45);
      ctx.quadraticCurveTo(cx, cy - r * 0.75, cx + r * 0.65, cy - r * 0.15);
      ctx.lineTo(cx + r * 0.25, cy - r * 0.45);
      ctx.stroke();
      break;
    }
    case 'stat_def': {
      // 极简盾徽
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.56, cy - r * 0.56);
      ctx.lineTo(cx + r * 0.56, cy - r * 0.56);
      ctx.lineTo(cx, cy + r * 0.72);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'stat_pace': {
      // 双箭头疾风
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy - r * 0.45);
      ctx.lineTo(cx - r * 0.05, cy);
      ctx.lineTo(cx - r * 0.55, cy + r * 0.45);
      ctx.moveTo(cx + r * 0.05, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.55, cy);
      ctx.lineTo(cx + r * 0.05, cy + r * 0.45);
      ctx.stroke();
      break;
    }
    case 'stat_fit': {
      // 极简菱形核心
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.58);
      ctx.lineTo(cx + r * 0.58, cy);
      ctx.lineTo(cx, cy + r * 0.58);
      ctx.lineTo(cx - r * 0.58, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
