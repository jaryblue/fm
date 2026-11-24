/**
 * 分层拼接球员头像渲染器（真·万面路线）
 * 6 肤色脸型 × 6 眉眼 × 10 发型 × 6 嘴/胡须 × 4 球衣领型（动态换色） × 4 配饰 = 34,560 种确定性组合
 */

import { DraftPlayer } from '../../core/src/types';
import { ArtAssetId, AssetLoader } from './AssetLoader';
import { drawRoundRect, tierColor } from './CanvasKit';

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 缓存球衣动态换色后的离屏 Canvas（避免每帧重复创建）
const tintedKitCache = new Map<string, HTMLCanvasElement>();

function getTintedKit(
  kitIdx: number,
  primaryColor: string,
  secondaryColor: string
): HTMLCanvasElement | HTMLImageElement | null {
  const assetId = `avatar_kit_${kitIdx}` as ArtAssetId;
  const baseImg = AssetLoader.get(assetId);
  if (!baseImg) return null;

  const key = `${kitIdx}_${primaryColor}_${secondaryColor}`;
  const cached = tintedKitCache.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined') return baseImg;
  const size = 160;
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d');
  if (!octx) return baseImg;

  // 绘制灰度底模板
  octx.drawImage(baseImg, 0, 0, size, size);
  // 用 multiply 将白色/浅灰球衣染为俱乐部主色
  octx.globalCompositeOperation = 'multiply';
  octx.fillStyle = primaryColor;
  octx.fillRect(0, 0, size, size);

  // 恢复 alpha 遮罩（防止透明区域被染色）
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(baseImg, 0, 0, size, size);

  // 叠加轻微高光与第二色领口点缀
  octx.globalCompositeOperation = 'source-atop';
  octx.fillStyle = secondaryColor;
  octx.globalAlpha = 0.25;
  octx.fillRect(0, 108, size, 12);
  octx.globalAlpha = 1;

  tintedKitCache.set(key, off);
  return off;
}

export interface AvatarClubColors {
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * 绘制分层拼接球员头像
 * 顺序：背景框 -> 球衣领口 -> 脸型 -> 眉眼 -> 胡须/嘴巴 -> 发型 -> 稀有配饰
 */
export function drawPlayerAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  player: Pick<DraftPlayer, 'id' | 'name' | 'age' | 'role' | 'tier' | 'isCaptain'>,
  club?: AvatarClubColors,
  opts?: { radius?: number; showFrame?: boolean }
): void {
  const seed = hashStr(`${player.id}_${player.name}`);
  const faceIdx = seed % 6;
  const eyesIdx = (seed >>> 4) % 6;
  const hairIdx = (seed >>> 8) % 10;

  // 年龄关联胡须概率：<= 21 岁多为清爽款 (0, 1, 5)，>= 27 岁大胡子概率提高
  const beardRaw = (seed >>> 13) % 12;
  let beardIdx = 0;
  if (player.age <= 21) {
    beardIdx = beardRaw < 5 ? 0 : beardRaw < 9 ? 1 : 5;
  } else if (player.age <= 26) {
    beardIdx = beardRaw < 3 ? 0 : beardRaw % 6;
  } else {
    beardIdx = [1, 2, 3, 4, 2, 3, 4, 5, 1, 2, 3, 4][beardRaw];
  }

  const kitIdx = player.role === 'GK' ? 3 : (seed >>> 18) % 4;

  // 配饰（约 22% 球员带鼻贴/护目镜/眉骨贴/耳钉）
  const accRoll = (seed >>> 22) % 18;
  const accIdx = accRoll < 4 ? accRoll : -1;

  // 俱乐部主副色（GK 自动偏青/绿高亮）
  const primary =
    player.role === 'GK'
      ? '#0EA5E9'
      : club?.primaryColor || '#2563EB';
  const secondary =
    player.role === 'GK'
      ? '#FACC15'
      : club?.secondaryColor || '#F8FAFC';

  const rad = opts?.radius ?? 6;
  const tierCol = tierColor(player.tier);

  // 背景底槽
  drawRoundRect(ctx, x, y, w, h, rad, '#0B1324', tierCol, 1.1);

  ctx.save();
  // 圆角裁剪
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();

  // 舞台背光径向渐变
  const bgGrad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.36, 4, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.72);
  bgGrad.addColorStop(0, player.tier === 'S' ? 'rgba(250,204,21,0.22)' : player.tier === 'A' ? 'rgba(168,85,247,0.20)' : 'rgba(56,189,248,0.16)');
  bgGrad.addColorStop(1, 'rgba(9,13,22,0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // 正方形居中贴图区（160x160 图层对齐）
  const sq = Math.max(w, h);
  const dx = x + (w - sq) / 2;
  const dy = y + (h - sq) / 2 + (h > w ? 2 : 0);

  const kitImg = getTintedKit(kitIdx, primary, secondary);
  const faceImg = AssetLoader.get(`avatar_face_${faceIdx}` as ArtAssetId);
  const eyesImg = AssetLoader.get(`avatar_eyes_${eyesIdx}` as ArtAssetId);
  const beardImg = AssetLoader.get(`avatar_beard_${beardIdx}` as ArtAssetId);
  const hairImg = AssetLoader.get(`avatar_hair_${hairIdx}` as ArtAssetId);
  const accImg = accIdx >= 0 ? AssetLoader.get(`avatar_acc_${accIdx}` as ArtAssetId) : null;

  if (faceImg && typeof ctx.drawImage === 'function') {
    if (kitImg) ctx.drawImage(kitImg, dx, dy, sq, sq);
    ctx.drawImage(faceImg, dx, dy, sq, sq);
    if (eyesImg) ctx.drawImage(eyesImg, dx, dy, sq, sq);
    if (beardImg) ctx.drawImage(beardImg, dx, dy, sq, sq);
    if (hairImg) ctx.drawImage(hairImg, dx, dy, sq, sq);
    if (accImg) ctx.drawImage(accImg, dx, dy, sq, sq);
  } else {
    // 轻量程序化矢量头像兜底（肤色 × 发型 × 五官 × 俱乐部球衣领口）
    const skins = ['#F8D5B8', '#EAC096', '#D49E6A', '#AE7349', '#7B4B2A', '#FDE2C8'];
    const hairs = ['#1E293B', '#3E2723', '#78350F', '#D97706', '#0F172A', '#94A3B8'];
    const skin = skins[faceIdx % skins.length];
    const hair = hairs[(hairIdx + (player.age >= 31 ? 5 : 0)) % hairs.length];
    const cx = x + w * 0.5;
    const headY = y + h * 0.42;
    const headR = Math.min(w, h) * 0.27;

    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y + h);
    ctx.quadraticCurveTo(cx, y + h * 0.64, x + w * 0.88, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.72, headR * 0.55, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = skin;
    ctx.fillRect(cx - headR * 0.28, headY + headR * 0.55, headR * 0.56, headR * 0.55);
    ctx.beginPath();
    ctx.ellipse(cx, headY, headR * 0.88, headR, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hair;
    ctx.beginPath();
    if (hairIdx % 3 === 0) {
      ctx.arc(cx, headY - headR * 0.24, headR * 0.92, Math.PI, Math.PI * 2);
    } else if (hairIdx % 3 === 1) {
      ctx.ellipse(cx, headY - headR * 0.55, headR * 0.96, headR * 0.52, -0.1, 0, Math.PI * 2);
    } else {
      ctx.arc(cx, headY - headR * 0.16, headR * 0.94, Math.PI * 0.92, Math.PI * 2.08);
    }
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx - headR * 0.34, headY - headR * 0.04, Math.max(1.2, headR * 0.10), 0, Math.PI * 2);
    ctx.arc(cx + headR * 0.34, headY - headR * 0.04, Math.max(1.2, headR * 0.10), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, headY + headR * 0.36, headR * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  if (opts?.showFrame !== false) {
    const frameId = player.tier === 'S' ? 'card_frame_s' : player.tier === 'A' ? 'card_frame_a' : null;
    const frameImg = frameId ? AssetLoader.get(frameId) : null;
    if (frameImg && typeof ctx.drawImage === 'function') {
      ctx.drawImage(frameImg, x - 1, y - 1, w + 2, h + 2);
    }
  }
}
