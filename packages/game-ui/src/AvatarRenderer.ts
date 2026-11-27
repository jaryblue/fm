/**
 * 高精度热血体育赛璐璐「千人千面」球员头像引擎 (V6)
 * 7 全球肤色 × 6 雕塑感脸型 × 14 现代足球发型 × 8 发色 × 8 眉眼神态 × 6 虹膜色 × 7 竞技表情 × 7 胡须款 × 6 球衣领型（含门将多色系） × 6 稀有配饰
 * 理论确定性组合 > 5,000,000 种，并在 256×320 离屏画布超采样缓存，缩放至任意尺寸均锐利无锯齿。
 */

import { DraftPlayer } from '../../core/src/types';
import { drawRoundRect, tierColor } from './CanvasKit';

const PW = 256;
const PH = 320;
const CX = PW / 2;
const INK = '#141B2D';
const MAX_AVATAR_CACHE = 260;

// 离屏超采样画布 LRU 缓存（避免每帧重绘 11 个矢量图层）
const portraitCache = new Map<string, HTMLCanvasElement>();

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mixSeed(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length >= 6) {
    return [
      parseInt(clean.slice(0, 2), 16) || 0,
      parseInt(clean.slice(2, 4), 16) || 0,
      parseInt(clean.slice(4, 6), 16) || 0,
    ];
  }
  return [37, 99, 235];
}

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(r1 + (r2 - r1) * k);
  const g = Math.round(g1 + (g2 - g1) * k);
  const bl = Math.round(b1 + (b2 - b1) * k);
  return `rgb(${r},${g},${bl})`;
}

function hexLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

interface SkinPalette {
  base: string;
  shadow1: string;
  shadow2: string;
  rim: string;
  lip: string;
}

const SKIN_PALETTES: SkinPalette[] = [
  { base: '#F7D7C4', shadow1: '#DFAD92', shadow2: '#BD8164', rim: '#FFF2EA', lip: '#C97F73' },
  { base: '#F1C5A4', shadow1: '#D29B74', shadow2: '#AE724B', rim: '#FFEAD8', lip: '#BF7464' },
  { base: '#E2AC80', shadow1: '#BC8156', shadow2: '#965D36', rim: '#FAD8BC', lip: '#AB6352' },
  { base: '#C78B5D', shadow1: '#9B633B', shadow2: '#754524', rim: '#E9B991', lip: '#93503F' },
  { base: '#A36841', shadow1: '#7B4828', shadow2: '#593017', rim: '#CA926A', lip: '#7B3E2F' },
  { base: '#7C492C', shadow1: '#59301A', shadow2: '#3B1D0D', rim: '#A57050', lip: '#612F23' },
  { base: '#58321F', shadow1: '#3A1E11', shadow2: '#231007', rim: '#845740', lip: '#492218' },
];

interface HairPalette {
  base: string;
  mid: string;
  hi: string;
  shadow: string;
}

const HAIR_PALETTES: HairPalette[] = [
  { base: '#161B28', mid: '#263047', hi: '#586D96', shadow: '#0A0D14' }, // 0: Jet Black
  { base: '#2D1E18', mid: '#4A3329', hi: '#7B5A49', shadow: '#170E0A' }, // 1: Espresso Dark Brown
  { base: '#5D3622', mid: '#804E34', hi: '#B47956', shadow: '#371D10' }, // 2: Chestnut Brown
  { base: '#B58338', mid: '#D6A454', hi: '#F6D788', shadow: '#7B521B' }, // 3: Golden Blonde
  { base: '#B79E6B', mid: '#D4BD8C', hi: '#F5E7C4', shadow: '#7D6840' }, // 4: Dirty Honey Blonde (avoiding white-cap look)
  { base: '#9A3D1D', mid: '#C4552B', hi: '#EA8456', shadow: '#5F210C' }, // 5: Copper Ginger
  { base: '#8D9BB0', mid: '#B4C1D4', hi: '#F8FAFC', shadow: '#4B5970' }, // 6: Sleek Gunmetal Silver (never flat white helmet)
  { base: '#1E293B', mid: '#334155', hi: '#64748B', shadow: '#0F172A' }, // 7: Cool Slate Black
];

interface IrisPalette {
  base: string;
  dark: string;
}

const IRIS_PALETTES: IrisPalette[] = [
  { base: '#4A2B1D', dark: '#24120A' },
  { base: '#B56B22', dark: '#63360B' },
  { base: '#256AD0', dark: '#12387A' },
  { base: '#1F8756', dark: '#0D4A2E' },
  { base: '#55708F', dark: '#2A3C52' },
  { base: '#693922', dark: '#361A0D' },
];

const GK_KIT_PAIRS: Array<[string, string]> = [
  ['#0EA5E9', '#FACC15'],
  ['#16A34A', '#F8FAFC'],
  ['#F97316', '#0F172A'],
  ['#9333EA', '#FDE047'],
];

interface JawSpec {
  topY: number;
  templeX: number;
  cheekX: number;
  cheekY: number;
  jawX: number;
  jawY: number;
  chinX: number;
  chinY: number;
}

const JAW_SPECS: JawSpec[] = [
  // 0: Sharp Striker V-Jaw
  { topY: 62, templeX: 50, cheekX: 52, cheekY: 138, jawX: 37, jawY: 179, chinX: 11, chinY: 209 },
  // 1: Strong Square Defender Jaw
  { topY: 63, templeX: 51, cheekX: 53, cheekY: 139, jawX: 43, jawY: 178, chinX: 16, chinY: 207 },
  // 2: Balanced Athletic Oval
  { topY: 61, templeX: 49, cheekX: 51, cheekY: 137, jawX: 39, jawY: 177, chinX: 13, chinY: 208 },
  // 3: Lean High-Cheekbone Wingback
  { topY: 62, templeX: 48, cheekX: 52, cheekY: 135, jawX: 36, jawY: 176, chinX: 12, chinY: 207 },
  // 4: Youthful Prodigy Contour
  { topY: 64, templeX: 50, cheekX: 52, cheekY: 141, jawX: 41, jawY: 178, chinX: 14, chinY: 205 },
  // 5: Chiseled Captain Jaw
  { topY: 61, templeX: 52, cheekX: 54, cheekY: 137, jawX: 42, jawY: 180, chinX: 15, chinY: 210 },
];

interface PortraitTraits {
  skin: SkinPalette;
  skinIdx: number;
  hairPalette: HairPalette;
  iris: IrisPalette;
  jaw: JawSpec;
  jawIdx: number;
  hairIdx: number;
  eyeIdx: number;
  noseIdx: number;
  mouthIdx: number;
  beardIdx: number;
  kitIdx: number;
  accIdx: number;
  primary: string;
  secondary: string;
  tier: 'S' | 'A' | 'B' | 'C';
  isCaptain: boolean;
  isVeteran: boolean;
  saltPepper: boolean;
}

function buildHeadPath(ctx: CanvasRenderingContext2D, j: JawSpec): void {
  ctx.beginPath();
  ctx.moveTo(CX, j.topY);
  // 右半脸（观众右侧 = 光影暗面）
  ctx.bezierCurveTo(CX + j.templeX * 0.72, j.topY, CX + j.templeX, j.topY + 26, CX + j.cheekX, j.cheekY);
  ctx.quadraticCurveTo(CX + j.cheekX * 0.96, j.jawY - 12, CX + j.jawX, j.jawY);
  ctx.quadraticCurveTo(CX + j.jawX * 0.62, j.chinY - 4, CX + j.chinX, j.chinY);
  ctx.quadraticCurveTo(CX, j.chinY + 3.5, CX - j.chinX, j.chinY);
  // 左半脸（观众左侧 = 受光面）
  ctx.quadraticCurveTo(CX - j.jawX * 0.62, j.chinY - 4, CX - j.jawX, j.jawY);
  ctx.quadraticCurveTo(CX - j.cheekX * 0.96, j.jawY - 12, CX - j.cheekX, j.cheekY);
  ctx.bezierCurveTo(CX - j.templeX, j.topY + 26, CX - j.templeX * 0.72, j.topY, CX, j.topY);
  ctx.closePath();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, tier: 'S' | 'A' | 'B' | 'C'): void {
  const bg = ctx.createLinearGradient(0, 0, PW, PH);
  bg.addColorStop(0, '#0C1730');
  bg.addColorStop(0.55, '#15284E');
  bg.addColorStop(1, '#081020');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PW, PH);

  // 斜向球场聚光灯束
  ctx.save();
  const beam = ctx.createLinearGradient(0, 0, PW * 0.85, PH * 0.85);
  beam.addColorStop(0, 'rgba(147, 197, 253, 0.20)');
  beam.addColorStop(0.5, 'rgba(56, 189, 248, 0.06)');
  beam.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(135, 0);
  ctx.lineTo(256, 220);
  ctx.lineTo(256, PH);
  ctx.lineTo(80, PH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 等级光晕
  const haloColor =
    tier === 'S'
      ? 'rgba(250, 204, 21, 0.34)'
      : tier === 'A'
      ? 'rgba(192, 132, 252, 0.30)'
      : tier === 'B'
      ? 'rgba(56, 189, 248, 0.24)'
      : 'rgba(52, 211, 153, 0.18)';
  const halo = ctx.createRadialGradient(CX, 146, 16, CX, 156, 150);
  halo.addColorStop(0, haloColor);
  halo.addColorStop(0.65, 'rgba(30, 58, 138, 0.08)');
  halo.addColorStop(1, 'rgba(9, 13, 22, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, PW, PH);

  const botGrad = ctx.createLinearGradient(0, PH * 0.68, 0, PH);
  botGrad.addColorStop(0, 'rgba(8, 12, 22, 0)');
  botGrad.addColorStop(1, 'rgba(4, 7, 14, 0.58)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, PH * 0.68, PW, PH * 0.32);
}

function drawBackHair(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { hairPalette: hp, hairIdx } = t;
  if (![3, 5, 6, 9, 11, 13].includes(hairIdx)) return;

  ctx.save();
  ctx.fillStyle = hp.shadow;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';

  if (hairIdx === 3) {
    // 紧致高顶卷发 Afro 轮廓
    ctx.beginPath();
    ctx.arc(CX, 88, 60, Math.PI * 0.9, Math.PI * 2.1);
    ctx.lineTo(CX + 54, 132);
    ctx.lineTo(CX - 54, 132);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hairIdx === 5) {
    // 清爽微长中分后脑轮廓（贴耳收尖，不挡颈部，告别蘑菇厚垫感）
    ctx.beginPath();
    ctx.moveTo(CX - 55, 108);
    ctx.quadraticCurveTo(CX - 61, 138, CX - 53, 162);
    ctx.lineTo(CX - 40, 154);
    ctx.lineTo(CX + 40, 154);
    ctx.lineTo(CX + 53, 162);
    ctx.quadraticCurveTo(CX + 61, 138, CX + 55, 108);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hairIdx === 6) {
    // 顶部束发丸子头（干净利落）
    ctx.beginPath();
    ctx.ellipse(CX + 4, 42, 18, 13, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hp.base;
    ctx.beginPath();
    ctx.arc(CX + 2, 41, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (hairIdx === 9) {
    // 干净收尖脏辫侧绺（带高光边缘与颈部拉开层次）
    const locs = [
      { ox: -55, len: 60 },
      { ox: -47, len: 68 },
      { ox: 47, len: 68 },
      { ox: 55, len: 60 },
    ];
    for (const loc of locs) {
      ctx.fillStyle = loc.ox > 0 ? hp.shadow : hp.base;
      ctx.beginPath();
      ctx.moveTo(CX + loc.ox - 5, 114);
      ctx.lineTo(CX + loc.ox + 5, 114);
      ctx.lineTo(CX + loc.ox + 4, 114 + loc.len - 8);
      ctx.quadraticCurveTo(CX + loc.ox, 114 + loc.len, CX + loc.ox - 4, 114 + loc.len - 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (hairIdx === 11) {
    // 蓬松自然卷泡芙轮廓
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.94 + (Math.PI * 1.12 * i) / 10;
      const bump = i % 2 === 0 ? 61 : 58;
      const rx = CX + Math.cos(a) * bump;
      const ry = 98 + Math.sin(a) * bump;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.lineTo(CX + 54, 144);
    ctx.lineTo(CX - 54, 144);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (hairIdx === 13) {
    // 飘逸后梳碎发长发（两耳旁微飘扬发梢）
    ctx.beginPath();
    ctx.moveTo(CX - 55, 96);
    ctx.quadraticCurveTo(CX - 66, 128, CX - 56, 158);
    ctx.lineTo(CX - 42, 148);
    ctx.lineTo(CX + 42, 148);
    ctx.lineTo(CX + 58, 160);
    ctx.quadraticCurveTo(CX + 68, 126, CX + 55, 96);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawJersey(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { primary, secondary, kitIdx, isCaptain } = t;
  const darkKit = mixHex(primary, '#070C18', 0.42);
  const lightKit = mixHex(primary, '#FFFFFF', 0.22);
  const brightPrimary = hexLuminance(primary) > 0.72;
  const secEdge = brightPrimary && hexLuminance(secondary) > 0.72 ? '#1E293B' : secondary;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(14, PH + 4);
  ctx.bezierCurveTo(18, 272, 46, 250, CX - 30, 236);
  ctx.quadraticCurveTo(CX, 245, CX + 30, 236);
  ctx.bezierCurveTo(PW - 46, 250, PW - 18, 272, PW - 14, PH + 4);
  ctx.closePath();

  ctx.save();
  ctx.clip();

  const kitGrad = ctx.createLinearGradient(20, 236, PW - 20, PH);
  kitGrad.addColorStop(0, lightKit);
  kitGrad.addColorStop(0.45, primary);
  kitGrad.addColorStop(1, darkKit);
  ctx.fillStyle = kitGrad;
  ctx.fillRect(0, 230, PW, 95);

  ctx.fillStyle = 'rgba(7, 12, 24, 0.28)';
  ctx.beginPath();
  ctx.moveTo(CX + 16, 234);
  ctx.lineTo(PW, 234);
  ctx.lineTo(PW, PH);
  ctx.lineTo(CX + 38, PH);
  ctx.quadraticCurveTo(CX + 26, 272, CX + 16, 234);
  ctx.closePath();
  ctx.fill();

  if (kitIdx === 0) {
    ctx.fillStyle = mixHex(primary, secondary, 0.28);
    for (let sx = 34; sx < PW - 24; sx += 30) {
      ctx.fillRect(sx, 236, 12, 90);
    }
  } else if (kitIdx === 1) {
    ctx.fillStyle = secEdge;
    ctx.beginPath();
    ctx.moveTo(46, 256);
    ctx.lineTo(CX, 294);
    ctx.lineTo(PW - 46, 256);
    ctx.lineTo(PW - 46, 272);
    ctx.lineTo(CX, 310);
    ctx.lineTo(46, 272);
    ctx.closePath();
    ctx.fill();
  } else if (kitIdx === 2) {
    ctx.fillStyle = secEdge;
    ctx.fillRect(CX - 6, 254, 12, 34);
    ctx.strokeStyle = secEdge;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(28, 276);
    ctx.lineTo(CX - 34, 242);
    ctx.moveTo(PW - 28, 276);
    ctx.lineTo(CX + 34, 242);
    ctx.stroke();
  } else if (kitIdx === 3) {
    ctx.fillStyle = secEdge;
    ctx.beginPath();
    ctx.moveTo(48, 240);
    ctx.lineTo(84, 240);
    ctx.lineTo(PW - 46, PH);
    ctx.lineTo(PW - 84, PH);
    ctx.closePath();
    ctx.fill();
  } else if (kitIdx === 4) {
    ctx.fillStyle = mixHex(primary, secEdge, 0.72);
    ctx.beginPath();
    ctx.moveTo(0, 240);
    ctx.lineTo(CX - 34, 236);
    ctx.lineTo(66, PH);
    ctx.lineTo(0, PH);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(PW, 240);
    ctx.lineTo(CX + 34, 236);
    ctx.lineTo(PW - 66, PH);
    ctx.lineTo(PW, PH);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = secEdge;
    ctx.beginPath();
    ctx.moveTo(32, 266);
    ctx.lineTo(74, 246);
    ctx.lineTo(86, 252);
    ctx.lineTo(44, 276);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(PW - 32, 266);
    ctx.lineTo(PW - 74, 246);
    ctx.lineTo(PW - 86, 252);
    ctx.lineTo(PW - 44, 276);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(10, 15, 28, 0.34)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(58, 284);
  ctx.quadraticCurveTo(68, 300, 62, 316);
  ctx.moveTo(PW - 58, 284);
  ctx.quadraticCurveTo(PW - 68, 300, PW - 62, 316);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.44)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(22, 306);
  ctx.bezierCurveTo(26, 274, 48, 252, CX - 30, 238);
  ctx.stroke();

  // 胸口斜向球衣面料高光带，增强立体裁剪质感
  const chestSheen = ctx.createLinearGradient(36, 238, CX + 20, PH);
  chestSheen.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
  chestSheen.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = chestSheen;
  ctx.fillRect(20, 236, PW - 40, PH - 236);

  const crX = CX + 44;
  const crY = 285;
  ctx.fillStyle = secEdge;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(crX - 9, crY - 8);
  ctx.lineTo(crX + 9, crY - 8);
  ctx.lineTo(crX + 9, crY + 2);
  ctx.quadraticCurveTo(crX, crY + 12, crX, crY + 12);
  ctx.quadraticCurveTo(crX, crY + 12, crX - 9, crY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(14, PH + 4);
  ctx.bezierCurveTo(18, 272, 46, 250, CX - 30, 236);
  ctx.moveTo(CX + 30, 236);
  ctx.bezierCurveTo(PW - 46, 250, PW - 18, 272, PW - 14, PH + 4);
  ctx.stroke();

  ctx.fillStyle = secEdge;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  if (kitIdx === 1 || kitIdx === 5) {
    ctx.beginPath();
    ctx.moveTo(CX - 34, 235);
    ctx.lineTo(CX, 268);
    ctx.lineTo(CX + 34, 235);
    ctx.lineTo(CX + 26, 232);
    ctx.lineTo(CX, 256);
    ctx.lineTo(CX - 26, 232);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kitIdx === 2) {
    ctx.beginPath();
    ctx.moveTo(CX - 29, 232);
    ctx.lineTo(CX - 40, 254);
    ctx.lineTo(CX - 8, 260);
    ctx.lineTo(CX - 16, 240);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(CX + 29, 232);
    ctx.lineTo(CX + 40, 254);
    ctx.lineTo(CX + 8, 260);
    ctx.lineTo(CX + 16, 240);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(CX - 33, 236);
    ctx.quadraticCurveTo(CX, 264, CX + 33, 236);
    ctx.lineTo(CX + 26, 232);
    ctx.quadraticCurveTo(CX, 254, CX - 26, 232);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (isCaptain) {
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(22, 272, 28, 16, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', 36, 280.5);
  }

  ctx.restore();
}

function drawNeck(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { skin } = t;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CX - 22, 186);
  ctx.lineTo(CX + 22, 186);
  ctx.quadraticCurveTo(CX + 23, 224, CX + 30, 244);
  ctx.quadraticCurveTo(CX, 260, CX - 30, 244);
  ctx.quadraticCurveTo(CX - 23, 224, CX - 22, 186);
  ctx.closePath();
  ctx.fillStyle = skin.shadow1;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = skin.shadow2;
  ctx.fillRect(CX + 2, 184, 34, 78);

  ctx.fillStyle = skin.shadow2;
  ctx.beginPath();
  ctx.moveTo(CX - 28, 190);
  ctx.lineTo(CX + 28, 190);
  ctx.lineTo(CX + 28, 228);
  ctx.quadraticCurveTo(CX + 2, 238, CX - 26, 214);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skin.base;
  ctx.beginPath();
  ctx.moveTo(CX - 24, 212);
  ctx.quadraticCurveTo(CX - 15, 226, CX - 14, 248);
  ctx.lineTo(CX - 28, 248);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = skin.shadow2;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CX - 21, 218);
  ctx.quadraticCurveTo(CX - 12, 232, CX - 4, 243);
  ctx.moveTo(CX + 21, 218);
  ctx.quadraticCurveTo(CX + 12, 232, CX + 4, 243);
  ctx.stroke();

  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CX - 22, 194);
  ctx.quadraticCurveTo(CX - 23, 222, CX - 28, 236);
  ctx.moveTo(CX + 22, 194);
  ctx.quadraticCurveTo(CX + 23, 222, CX + 28, 236);
  ctx.stroke();
  ctx.restore();
}

function drawEars(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { skin, jaw } = t;
  const ey = jaw.cheekY + 4;
  ctx.save();
  for (const side of [-1, 1]) {
    const ex = CX + side * (jaw.cheekX + 1.5);
    ctx.beginPath();
    ctx.ellipse(ex, ey, 8.5, 16, side * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = side === 1 ? skin.shadow1 : skin.base;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.stroke();

    ctx.strokeStyle = skin.shadow2;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ex - side * 1.2, ey - 1, 5.2, side > 0 ? -Math.PI * 0.45 : Math.PI * 0.55, side > 0 ? Math.PI * 0.52 : Math.PI * 1.45);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFace(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { skin, jaw, isVeteran, tier } = t;
  ctx.save();

  buildHeadPath(ctx, jaw);
  ctx.fillStyle = skin.base;
  ctx.fill();

  ctx.save();
  ctx.clip();

  // 右半侧赛璐璐立体面阴影
  ctx.fillStyle = skin.shadow1;
  ctx.beginPath();
  ctx.moveTo(CX + 18, jaw.topY);
  ctx.lineTo(CX + 70, jaw.topY);
  ctx.lineTo(CX + 70, jaw.chinY + 12);
  ctx.lineTo(CX + 4, jaw.chinY + 12);
  ctx.quadraticCurveTo(CX + 28, 174, CX + 34, 146);
  ctx.quadraticCurveTo(CX + 38, 114, CX + 18, jaw.topY);
  ctx.closePath();
  ctx.fill();

  // 颧骨微暖过渡
  ctx.fillStyle = mixHex(skin.shadow1, '#E11D48', 0.10);
  ctx.beginPath();
  ctx.ellipse(CX - 29, 152, 10, 5, -0.15, 0, Math.PI * 2);
  ctx.ellipse(CX + 29, 152, 10, 5, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // 左脸颊受光边沿反光
  ctx.strokeStyle = tier === 'S' ? mixHex(skin.rim, '#FDE047', 0.25) : skin.rim;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(CX - jaw.chinX + 2, jaw.chinY - 2);
  ctx.quadraticCurveTo(CX - jaw.jawX * 0.68, jaw.chinY - 5, CX - jaw.jawX + 2, jaw.jawY);
  ctx.quadraticCurveTo(CX - jaw.cheekX + 3, jaw.jawY - 12, CX - jaw.cheekX + 3, jaw.cheekY);
  ctx.stroke();

  ctx.fillStyle = skin.rim;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(CX - 14, 98, 16, 8, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (isVeteran) {
    ctx.strokeStyle = skin.shadow2;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(CX - 27, 164);
    ctx.quadraticCurveTo(CX - 22, 172, CX - 19, 181);
    ctx.moveTo(CX + 27, 164);
    ctx.quadraticCurveTo(CX + 22, 172, CX + 19, 181);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  buildHeadPath(ctx, jaw);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.restore();
}

function drawBeard(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { beardIdx, jaw, hairPalette, saltPepper } = t;
  if (beardIdx === 0) return;

  const beardCol = saltPepper ? mixHex(hairPalette.shadow, '#94A3B8', 0.14) : hairPalette.shadow;
  const beardMid = saltPepper ? mixHex(hairPalette.base, '#CBD5E1', 0.15) : hairPalette.base;

  ctx.save();
  buildHeadPath(ctx, jaw);
  ctx.clip();

  if (beardIdx === 1) {
    // 1: 贴合下颌的清爽型男青茬（高冷帅气）
    ctx.fillStyle = beardCol;
    ctx.globalAlpha = 0.20;
    ctx.beginPath();
    ctx.moveTo(CX - jaw.cheekX + 2, 160);
    ctx.quadraticCurveTo(CX - 26, 176, CX, 178);
    ctx.quadraticCurveTo(CX + 26, 176, CX + jaw.cheekX - 2, 160);
    ctx.lineTo(CX + jaw.cheekX, jaw.chinY + 8);
    ctx.lineTo(CX - jaw.cheekX, jaw.chinY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(CX - 17, 172, 34, 6.5, 3);
    ctx.fill();
  } else if (beardIdx === 2) {
    // 2: 利落山羊胡 + 精细八字胡
    ctx.fillStyle = beardMid;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(CX - 15, 175);
    ctx.quadraticCurveTo(CX, 169, CX + 15, 175);
    ctx.quadraticCurveTo(CX + 7, 177.5, CX, 176);
    ctx.quadraticCurveTo(CX - 7, 177.5, CX - 15, 175);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(CX - 11, 193);
    ctx.quadraticCurveTo(CX, 197, CX + 11, 193);
    ctx.lineTo(CX + 9, jaw.chinY + 2);
    ctx.quadraticCurveTo(CX, jaw.chinY + 4, CX - 9, jaw.chinY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (beardIdx === 3) {
    // 3: 精致收窄修剪胡须（沿下颌线收薄，完全露出颧骨，绝不显厚盔甲！）
    ctx.fillStyle = beardMid;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(CX - jaw.cheekX, 152);
    ctx.lineTo(CX - jaw.cheekX + 5, 152);
    ctx.quadraticCurveTo(CX - jaw.jawX + 3, 186, CX - 14, 195);
    ctx.quadraticCurveTo(CX, 199, CX + 14, 195);
    ctx.quadraticCurveTo(CX + jaw.jawX - 3, 186, CX + jaw.cheekX - 5, 152);
    ctx.lineTo(CX + jaw.cheekX, 152);
    ctx.lineTo(CX + jaw.cheekX, jaw.chinY + 8);
    ctx.lineTo(CX - jaw.cheekX, jaw.chinY + 8);
    ctx.closePath();
    ctx.fill();
    // 严格裁剪在胡须轮廓内再画右侧阴影，避免溢出方框
    ctx.save();
    ctx.clip();
    ctx.fillStyle = beardCol;
    ctx.fillRect(CX + 6, 152, jaw.cheekX, 65);
    ctx.restore();
    ctx.stroke();
  } else if (beardIdx === 4) {
    // 4: 欧冠硬汉络腮胡（上下唇与双颊弧度舒展，2色明暗立体）
    ctx.fillStyle = beardMid;
    ctx.beginPath();
    ctx.moveTo(CX - jaw.cheekX, 148);
    ctx.lineTo(CX - jaw.cheekX + 8, 148);
    ctx.quadraticCurveTo(CX - 30, 174, CX - 18, 178);
    ctx.quadraticCurveTo(CX - 20, 193, CX - 12, 195);
    ctx.quadraticCurveTo(CX, 198, CX + 12, 195);
    ctx.quadraticCurveTo(CX + 20, 193, CX + 18, 178);
    ctx.quadraticCurveTo(CX + 30, 174, CX + jaw.cheekX - 8, 148);
    ctx.lineTo(CX + jaw.cheekX, 148);
    ctx.lineTo(CX + jaw.cheekX, jaw.chinY + 8);
    ctx.lineTo(CX - jaw.cheekX, jaw.chinY + 8);
    ctx.closePath();
    ctx.fill();

    // 右侧体块立体暗部
    ctx.save();
    ctx.clip();
    ctx.fillStyle = beardCol;
    ctx.fillRect(CX + 8, 146, jaw.cheekX, 70);
    ctx.restore();

    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // 清晰雕刻感上唇胡
    ctx.fillStyle = beardMid;
    ctx.beginPath();
    ctx.moveTo(CX - 19, 177);
    ctx.quadraticCurveTo(CX, 168, CX + 19, 177);
    ctx.lineTo(CX + 14, 180);
    ctx.quadraticCurveTo(CX, 175, CX - 14, 180);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (beardIdx === 5) {
    // 5: 极细下颌修边须（现代锋线潮男风）
    ctx.strokeStyle = beardCol;
    ctx.lineWidth = 5.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(CX - jaw.cheekX + 3, 154);
    ctx.quadraticCurveTo(CX - jaw.jawX, jaw.jawY + 1, CX, jaw.chinY - 2);
    ctx.quadraticCurveTo(CX + jaw.jawX, jaw.jawY + 1, CX + jaw.cheekX - 3, 154);
    ctx.stroke();
  } else {
    // 6: 精细上唇须 + 下唇小簇
    ctx.fillStyle = beardMid;
    ctx.beginPath();
    ctx.moveTo(CX - 17, 176);
    ctx.quadraticCurveTo(CX - 5, 170, CX, 174);
    ctx.quadraticCurveTo(CX + 5, 170, CX + 17, 176);
    ctx.quadraticCurveTo(CX + 6, 178, CX, 176);
    ctx.quadraticCurveTo(CX - 6, 178, CX - 17, 176);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CX, 195, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMouth(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { mouthIdx, skin } = t;
  const my = 183;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (t.beardIdx === 4) {
    ctx.fillStyle = skin.base;
    ctx.beginPath();
    ctx.ellipse(CX, my + 1, 14, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawUnderLip = (width = 7, dy = 5.5) => {
    ctx.strokeStyle = skin.shadow2;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(CX - width, my + dy);
    ctx.quadraticCurveTo(CX, my + dy + 2, CX + width, my + dy);
    ctx.stroke();
  };

  if (mouthIdx === 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CX - 12, my + 1);
    ctx.quadraticCurveTo(CX + 1, my + 3, CX + 14, my - 3);
    ctx.stroke();
    drawUnderLip(7, 6);
  } else if (mouthIdx === 1) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(CX - 12, my);
    ctx.quadraticCurveTo(CX, my + 1.5, CX + 12, my);
    ctx.stroke();
    drawUnderLip(7, 6);
  } else if (mouthIdx === 2) {
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.7;
    ctx.beginPath();
    ctx.moveTo(CX - 15, my - 2);
    ctx.quadraticCurveTo(CX, my, CX + 15, my - 2);
    ctx.quadraticCurveTo(CX + 11, my + 8.5, CX, my + 8.5);
    ctx.quadraticCurveTo(CX - 11, my + 8.5, CX - 15, my - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawUnderLip(7, 11);
  } else if (mouthIdx === 3) {
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.7;
    ctx.beginPath();
    ctx.moveTo(CX - 14, my);
    ctx.quadraticCurveTo(CX, my - 2, CX + 15, my - 3);
    ctx.quadraticCurveTo(CX + 10, my + 6.5, CX - 1, my + 6);
    ctx.quadraticCurveTo(CX - 10, my + 5, CX - 14, my);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawUnderLip(7, 9);
  } else if (mouthIdx === 4) {
    ctx.fillStyle = skin.lip;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(CX, my + 1.5, 11, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.9;
    ctx.beginPath();
    ctx.moveTo(CX - 12, my);
    ctx.quadraticCurveTo(CX, my + 2.2, CX + 12, my - 0.5);
    ctx.stroke();
    drawUnderLip(7, 6);
  } else if (mouthIdx === 5) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CX - 14, my - 1);
    ctx.quadraticCurveTo(CX, my + 6, CX + 14, my - 1.5);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX - 16, my - 1, 2.2, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
    drawUnderLip(7, 7);
  } else {
    // 6: 酷帅不羁微扬沉着嘴线（消除苦瓜扁嘴感）
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(CX - 11, my + 0.5);
    ctx.quadraticCurveTo(CX + 2, my + 1.5, CX + 12, my - 1.5);
    ctx.stroke();
    drawUnderLip(7, 6);
  }
  ctx.restore();
}

function drawNose(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { noseIdx, skin } = t;
  const topY = 136;
  const tipY = 162;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.fillStyle = skin.shadow1;
  ctx.beginPath();
  if (noseIdx === 0 || noseIdx === 2) {
    ctx.moveTo(CX + 1, topY);
    ctx.lineTo(CX + 7, tipY - 2);
    ctx.quadraticCurveTo(CX + 2, tipY + 4, CX - 3, tipY + 1);
    ctx.closePath();
  } else if (noseIdx === 1) {
    ctx.moveTo(CX + 2, topY + 2);
    ctx.lineTo(CX + 9, tipY - 1);
    ctx.quadraticCurveTo(CX + 2, tipY + 5, CX - 5, tipY + 2);
    ctx.closePath();
  } else {
    ctx.moveTo(CX + 1, topY);
    ctx.lineTo(CX + 6, tipY - 4);
    ctx.lineTo(CX - 1, tipY + 2);
    ctx.closePath();
  }
  ctx.fill();

  ctx.strokeStyle = skin.rim;
  ctx.lineWidth = 2.6;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.moveTo(CX - 1.5, topY + 4);
  ctx.lineTo(CX - 2.5, tipY - 4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  if (noseIdx === 1) {
    ctx.moveTo(CX - 7, tipY);
    ctx.quadraticCurveTo(CX, tipY + 4, CX + 7, tipY);
  } else {
    ctx.moveTo(CX - 3, tipY + 2);
    ctx.quadraticCurveTo(CX + 2, tipY + 4, CX + 6, tipY - 1);
  }
  ctx.stroke();
  ctx.restore();
}

function drawEyesAndBrows(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { eyeIdx, iris, hairPalette, saltPepper, skinIdx } = t;
  const ey = 135;
  const eyeOffsets = [-23, 23];
  const browCol = saltPepper ? mixHex(hairPalette.base, '#CBD5E1', 0.25) : hairPalette.shadow;

  // 深肤色增强虹膜微亮色度与白高光对比度，确保小头像依然神采奕奕
  const irisBase = skinIdx >= 4 ? mixHex(iris.base, '#F59E0B', 0.16) : iris.base;
  const irisDark = iris.dark;

  const eyeW = eyeIdx === 3 ? 13 : eyeIdx === 5 ? 12.5 : 12;
  const eyeH = eyeIdx === 3 ? 8.0 : eyeIdx === 5 ? 5.6 : eyeIdx === 4 ? 6.2 : 7.0;
  const irisR = eyeIdx === 3 ? 6.4 : 5.8;

  ctx.save();
  for (let i = 0; i < 2; i++) {
    const dir = i === 0 ? -1 : 1;
    const ex = CX + eyeOffsets[i];
    const tilt = eyeIdx === 0 || eyeIdx === 5 ? -1.4 : eyeIdx === 6 ? 1.0 : -0.6;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ex - dir * eyeW, ey + tilt);
    ctx.quadraticCurveTo(ex, ey - eyeH * 1.35, ex + dir * eyeW, ey - tilt * 0.6);
    ctx.quadraticCurveTo(ex, ey + eyeH * 1.1, ex - dir * eyeW, ey + tilt);
    ctx.closePath();

    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.clip();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.fillRect(ex - eyeW - 2, ey - eyeH * 1.5, eyeW * 2 + 4, eyeH * 0.55);

    const ix = ex - dir * 0.4;
    const iy = ey - 0.5;
    ctx.fillStyle = irisBase;
    ctx.beginPath();
    ctx.arc(ix, iy, irisR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = irisDark;
    ctx.beginPath();
    ctx.arc(ix, iy, irisR, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();

    ctx.fillStyle = '#090D16';
    ctx.beginPath();
    ctx.arc(ix, iy, irisR * 0.46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ix - 2.1, iy - 2.1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ix + 2.1, iy + 2.1, 1.0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.strokeStyle = INK;
    ctx.lineWidth = eyeIdx === 2 || eyeIdx === 7 ? 3.8 : 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - dir * (eyeW + 1), ey + tilt + 0.5);
    ctx.quadraticCurveTo(ex, ey - eyeH * 1.38, ex + dir * (eyeW + 1.5), ey - tilt * 0.6);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(20, 27, 45, 0.40)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ex - dir * (eyeW * 0.55), ey + eyeH * 0.85);
    ctx.quadraticCurveTo(ex, ey + eyeH * 1.05, ex + dir * (eyeW * 0.65), ey + eyeH * 0.72);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(20, 27, 45, 0.30)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ex - dir * (eyeW * 0.7), ey - eyeH * 1.35);
    ctx.quadraticCurveTo(ex, ey - eyeH * 1.75, ex + dir * (eyeW * 0.7), ey - eyeH * 1.35);
    ctx.stroke();

    const browThickness = eyeIdx === 2 ? 6.2 : eyeIdx === 7 ? 5.6 : 4.8;
    const innerY =
      eyeIdx === 0 || eyeIdx === 2 || eyeIdx === 7
        ? 121
        : eyeIdx === 3
        ? 116
        : 118;
    const outerY =
      eyeIdx === 0 || eyeIdx === 7
        ? 113
        : eyeIdx === 4 && dir === 1
        ? 112
        : eyeIdx === 6
        ? 121
        : 116;

    ctx.fillStyle = browCol;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(ex - dir * 13, innerY - browThickness * 0.55);
    ctx.quadraticCurveTo(ex + dir * 2, Math.min(innerY, outerY) - browThickness * 0.45, ex + dir * 16, outerY);
    ctx.quadraticCurveTo(ex + dir * 2, Math.min(innerY, outerY) + browThickness * 0.45, ex - dir * 13, innerY + browThickness * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrontHair(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { hairIdx, hairPalette: hp, jaw, saltPepper } = t;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (hairIdx !== 10 && hairIdx !== 4) {
    ctx.save();
    buildHeadPath(ctx, jaw);
    ctx.clip();
    ctx.fillStyle = t.skin.shadow1;
    ctx.globalAlpha = 0.52;
    ctx.beginPath();
    ctx.ellipse(CX, 84, 52, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 10: 精致光头
  if (hairIdx === 10) {
    ctx.save();
    buildHeadPath(ctx, jaw);
    ctx.clip();
    ctx.fillStyle = t.skin.rim;
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.ellipse(CX - 14, 72, 18, 8, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }

  // 4: 利落运动圆寸头（强硬发际线描边 + 短发质感深浅过渡，绝不显泳帽/头巾！）
  if (hairIdx === 4) {
    const buzzBase = mixHex(hp.base, '#161B28', 0.35);
    const buzzDark = mixHex(hp.shadow, '#0A0D14', 0.35);
    ctx.save();
    buildHeadPath(ctx, jaw);
    ctx.clip();
    ctx.fillStyle = buzzBase;
    ctx.beginPath();
    ctx.moveTo(CX - 54, 122);
    ctx.lineTo(CX - 48, 122);
    ctx.lineTo(CX - 44, 96);
    ctx.lineTo(CX - 34, 86);
    ctx.quadraticCurveTo(CX, 81, CX + 34, 86);
    ctx.lineTo(CX + 44, 96);
    ctx.lineTo(CX + 48, 122);
    ctx.lineTo(CX + 54, 122);
    ctx.lineTo(CX + 56, 54);
    ctx.lineTo(CX - 56, 54);
    ctx.closePath();
    ctx.fill();

    // 右半侧推青暗部 + 发际线细腻描边
    ctx.fillStyle = buzzDark;
    ctx.fillRect(CX + 14, 54, 42, 68);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(CX - 48, 122);
    ctx.lineTo(CX - 44, 96);
    ctx.lineTo(CX - 34, 86);
    ctx.quadraticCurveTo(CX, 81, CX + 34, 86);
    ctx.lineTo(CX + 44, 96);
    ctx.lineTo(CX + 48, 122);
    ctx.stroke();

    ctx.fillStyle = hp.hi;
    ctx.globalAlpha = 0.36;
    ctx.beginPath();
    ctx.ellipse(CX - 14, 70, 20, 6.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }

  const drawStyledCrown = (pathFn: () => void, sheenY: number, sheenRx = 26) => {
    ctx.beginPath();
    pathFn();
    ctx.closePath();
    ctx.fillStyle = hp.base;
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = hp.shadow;
    ctx.beginPath();
    ctx.moveTo(CX + 14, 20);
    ctx.lineTo(PW, 20);
    ctx.lineTo(PW, 170);
    ctx.lineTo(CX + 28, 170);
    ctx.quadraticCurveTo(CX + 30, 84, CX + 14, 20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = hp.hi;
    ctx.globalAlpha = 0.60;
    ctx.beginPath();
    ctx.ellipse(CX - 12, sheenY, sheenRx, 7.2, -0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (saltPepper) {
      ctx.fillStyle = '#E2E8F0';
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(CX - 48, 118, 4.5, 11, 0.1, 0, Math.PI * 2);
      ctx.ellipse(CX + 48, 118, 4.5, 11, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.beginPath();
    pathFn();
    ctx.closePath();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  };

  if (hairIdx === 0) {
    // 0: 现代前刺飞机头 (Modern Taper Quiff)
    drawStyledCrown(() => {
      ctx.moveTo(CX - 52, 128);
      ctx.lineTo(CX - 47, 128);
      ctx.lineTo(CX - 44, 96);
      ctx.quadraticCurveTo(CX - 22, 86, CX - 6, 94);
      ctx.quadraticCurveTo(CX + 20, 82, CX + 44, 96);
      ctx.lineTo(CX + 47, 128);
      ctx.lineTo(CX + 52, 128);
      ctx.bezierCurveTo(CX + 56, 86, CX + 44, 52, CX + 16, 42);
      ctx.quadraticCurveTo(CX - 8, 28, CX - 26, 44);
      ctx.bezierCurveTo(CX - 52, 54, CX - 56, 86, CX - 52, 128);
    }, 60, 24);
  } else if (hairIdx === 1) {
    // 1: 斜分背头 Undercut
    drawStyledCrown(() => {
      ctx.moveTo(CX - 52, 126);
      ctx.lineTo(CX - 47, 126);
      ctx.lineTo(CX - 44, 92);
      ctx.quadraticCurveTo(CX - 18, 108, CX + 2, 104);
      ctx.quadraticCurveTo(CX - 6, 86, CX + 18, 82);
      ctx.quadraticCurveTo(CX + 40, 86, CX + 47, 118);
      ctx.lineTo(CX + 52, 118);
      ctx.bezierCurveTo(CX + 56, 78, CX + 42, 46, CX + 6, 42);
      ctx.bezierCurveTo(CX - 38, 40, CX - 56, 76, CX - 52, 126);
    }, 62, 26);
  } else if (hairIdx === 2) {
    // 2: 热血刺猬头前锋（Spiky Striker Tuft）
    drawStyledCrown(() => {
      ctx.moveTo(CX - 52, 128);
      ctx.lineTo(CX - 47, 128);
      ctx.lineTo(CX - 42, 92);
      ctx.lineTo(CX - 26, 106);
      ctx.lineTo(CX - 18, 88);
      ctx.lineTo(CX, 108);
      ctx.lineTo(CX + 14, 86);
      ctx.lineTo(CX + 28, 102);
      ctx.lineTo(CX + 43, 90);
      ctx.lineTo(CX + 48, 126);
      ctx.lineTo(CX + 53, 126);
      ctx.lineTo(CX + 55, 76);
      ctx.lineTo(CX + 38, 50);
      ctx.lineTo(CX + 22, 38);
      ctx.lineTo(CX + 4, 46);
      ctx.lineTo(CX - 10, 32);
      ctx.lineTo(CX - 24, 46);
      ctx.lineTo(CX - 42, 42);
      ctx.lineTo(CX - 54, 72);
    }, 62, 24);
  } else if (hairIdx === 3) {
    // 3: 高顶卷发 Afro + 两鬓渐变
    drawStyledCrown(() => {
      ctx.moveTo(CX - 50, 118);
      ctx.lineTo(CX - 46, 102);
      ctx.quadraticCurveTo(CX, 84, CX + 46, 102);
      ctx.lineTo(CX + 50, 118);
      ctx.quadraticCurveTo(CX + 62, 74, CX + 42, 42);
      ctx.quadraticCurveTo(CX, 26, CX - 42, 42);
      ctx.quadraticCurveTo(CX - 62, 74, CX - 50, 118);
    }, 54, 28);
  } else if (hairIdx === 5) {
    // 5: 现代足球微卷逗号中分刘海（两侧飘逸尖发梢外扩露眉，彻底告别厚重蘑菇头！）
    drawStyledCrown(() => {
      ctx.moveTo(CX - 53, 128);
      ctx.lineTo(CX - 46, 114);
      ctx.quadraticCurveTo(CX - 36, 98, CX - 20, 106);
      ctx.lineTo(CX - 14, 112);
      ctx.quadraticCurveTo(CX - 6, 92, CX, 78);
      ctx.quadraticCurveTo(CX + 6, 92, CX + 14, 112);
      ctx.lineTo(CX + 20, 106);
      ctx.quadraticCurveTo(CX + 36, 98, CX + 46, 114);
      ctx.lineTo(CX + 53, 128);
      ctx.bezierCurveTo(CX + 59, 82, CX + 45, 44, CX, 42);
      ctx.bezierCurveTo(CX - 45, 44, CX - 59, 82, CX - 53, 128);
    }, 62, 26);
  } else if (hairIdx === 6) {
    // 6: 大背头扎丸子（干净露额）
    drawStyledCrown(() => {
      ctx.moveTo(CX - 51, 122);
      ctx.lineTo(CX - 46, 122);
      ctx.quadraticCurveTo(CX - 44, 82, CX - 18, 76);
      ctx.quadraticCurveTo(CX, 73, CX + 18, 76);
      ctx.quadraticCurveTo(CX + 44, 82, CX + 46, 122);
      ctx.lineTo(CX + 51, 122);
      ctx.bezierCurveTo(CX + 55, 78, CX + 42, 46, CX, 45);
      ctx.bezierCurveTo(CX - 42, 46, CX - 55, 78, CX - 51, 122);
    }, 59, 25);
  } else if (hairIdx === 7) {
    // 7: 厚重霸气大背头 Pompadour
    drawStyledCrown(() => {
      ctx.moveTo(CX - 52, 126);
      ctx.lineTo(CX - 46, 126);
      ctx.quadraticCurveTo(CX - 42, 82, CX - 16, 78);
      ctx.quadraticCurveTo(CX, 84, CX + 22, 78);
      ctx.quadraticCurveTo(CX + 44, 86, CX + 47, 126);
      ctx.lineTo(CX + 52, 126);
      ctx.bezierCurveTo(CX + 58, 78, CX + 46, 38, CX + 8, 36);
      ctx.bezierCurveTo(CX - 38, 36, CX - 56, 72, CX - 52, 126);
    }, 52, 27);
  } else if (hairIdx === 8) {
    // 8: 灵动微乱青年新星碎刘海
    drawStyledCrown(() => {
      ctx.moveTo(CX - 54, 130);
      ctx.lineTo(CX - 46, 128);
      ctx.quadraticCurveTo(CX - 42, 102, CX - 28, 108);
      ctx.lineTo(CX - 16, 94);
      ctx.lineTo(CX - 8, 112);
      ctx.lineTo(CX + 6, 92);
      ctx.lineTo(CX + 18, 110);
      ctx.lineTo(CX + 32, 95);
      ctx.quadraticCurveTo(CX + 43, 108, CX + 47, 128);
      ctx.lineTo(CX + 54, 128);
      ctx.bezierCurveTo(CX + 58, 78, CX + 42, 44, CX, 42);
      ctx.bezierCurveTo(CX - 44, 44, CX - 58, 78, CX - 54, 130);
    }, 64, 26);
  } else if (hairIdx === 9) {
    // 9: 黑人脏辫贴头编（Cornrows）
    drawStyledCrown(() => {
      ctx.moveTo(CX - 52, 124);
      ctx.lineTo(CX - 46, 124);
      ctx.quadraticCurveTo(CX - 40, 86, CX, 82);
      ctx.quadraticCurveTo(CX + 40, 86, CX + 46, 124);
      ctx.lineTo(CX + 52, 124);
      ctx.bezierCurveTo(CX + 56, 78, CX + 42, 48, CX, 46);
      ctx.bezierCurveTo(CX - 42, 48, CX - 56, 78, CX - 52, 124);
    }, 62, 22);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    for (const bx of [-28, -14, 0, 14, 28]) {
      ctx.beginPath();
      ctx.moveTo(CX + bx, 82);
      ctx.quadraticCurveTo(CX + bx * 0.85, 62, CX + bx * 0.65, 48);
      ctx.stroke();
    }
  } else if (hairIdx === 11) {
    // 11: 蓬松自然卷发（Fluffy Curly Mop）
    drawStyledCrown(() => {
      ctx.moveTo(CX - 54, 126);
      ctx.quadraticCurveTo(CX - 44, 100, CX - 26, 106);
      ctx.quadraticCurveTo(CX - 10, 92, CX + 6, 106);
      ctx.quadraticCurveTo(CX + 26, 94, CX + 44, 108);
      ctx.lineTo(CX + 54, 126);
      ctx.bezierCurveTo(CX + 62, 84, CX + 48, 46, CX + 22, 40);
      ctx.quadraticCurveTo(CX, 32, CX - 22, 40);
      ctx.bezierCurveTo(CX - 48, 46, CX - 62, 84, CX - 54, 126);
    }, 58, 28);
  } else if (hairIdx === 12) {
    // 12: 凌厉侧推碎发前刺（自然丰盈顶部轮廓，告别生硬三角圆锥！）
    drawStyledCrown(() => {
      ctx.moveTo(CX - 50, 122);
      ctx.lineTo(CX - 46, 122);
      ctx.quadraticCurveTo(CX - 42, 88, CX - 18, 92);
      ctx.lineTo(CX - 4, 102);
      ctx.lineTo(CX + 10, 88);
      ctx.quadraticCurveTo(CX + 38, 86, CX + 46, 122);
      ctx.lineTo(CX + 50, 122);
      ctx.bezierCurveTo(CX + 54, 82, CX + 44, 54, CX + 28, 46);
      ctx.lineTo(CX + 16, 38);
      ctx.lineTo(CX + 4, 44);
      ctx.lineTo(CX - 12, 38);
      ctx.lineTo(CX - 22, 46);
      ctx.lineTo(CX - 34, 44);
      ctx.bezierCurveTo(CX - 50, 56, CX - 54, 82, CX - 50, 122);
    }, 58, 20);
  } else {
    // 13: 飘逸后梳发带长发（发际线自然上扬暴露眉目，与止汗发带严丝合缝）
    drawStyledCrown(() => {
      ctx.moveTo(CX - 55, 126);
      ctx.lineTo(CX - 49, 100);
      ctx.quadraticCurveTo(CX, 88, CX + 49, 100);
      ctx.lineTo(CX + 55, 126);
      ctx.bezierCurveTo(CX + 60, 82, CX + 46, 42, CX + 6, 38);
      ctx.bezierCurveTo(CX - 42, 38, CX - 58, 76, CX - 55, 126);
    }, 56, 26);
  }

  ctx.restore();
}

function drawAccessories(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  const { accIdx, hairIdx, primary, secondary } = t;
  if (accIdx < 0 && hairIdx !== 13) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const effectiveAcc = accIdx >= 0 ? accIdx : 0;

  if (effectiveAcc === 0) {
    // 0: 俱乐部配色运动止汗发带
    ctx.fillStyle = primary;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(CX - 51, 93);
    ctx.quadraticCurveTo(CX, 84, CX + 51, 93);
    ctx.lineTo(CX + 52, 105);
    ctx.quadraticCurveTo(CX, 96, CX - 52, 105);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = secondary;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(CX - 48, 99);
    ctx.quadraticCurveTo(CX, 90, CX + 48, 99);
    ctx.stroke();
  } else if (effectiveAcc === 1) {
    // 1: 职业球员鼻翼通气贴
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(CX - 11, 146, 22, 6, 2.5);
    ctx.fill();
    ctx.stroke();
  } else if (effectiveAcc === 2) {
    // 2: 流线型包裹式运动护目镜（Edgar Davids 竞速护目镜，弧形流线框+高反光镜片，告别呆板方框近视镜！）
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(CX - 52, 133);
    ctx.lineTo(CX - 39, 132);
    ctx.moveTo(CX + 39, 132);
    ctx.lineTo(CX + 52, 133);
    ctx.stroke();

    // 一体式半包裹顶部风镜梁
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(CX - 40, 126);
    ctx.quadraticCurveTo(CX, 121, CX + 40, 126);
    ctx.stroke();

    for (const dir of [-1, 1]) {
      const gx = CX + dir * 23;
      ctx.fillStyle = 'rgba(14, 165, 233, 0.34)';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(gx - dir * 15, 126);
      ctx.quadraticCurveTo(gx, 123, gx + dir * 16, 127);
      ctx.quadraticCurveTo(gx + dir * 15, 143, gx + dir * 2, 143);
      ctx.quadraticCurveTo(gx - dir * 13, 142, gx - dir * 15, 126);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 锐利斜向高速反光亮条
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(gx - 8, 127);
      ctx.lineTo(gx - 2, 139);
      ctx.stroke();
    }
  } else if (effectiveAcc === 3) {
    // 3: 热血颧骨白色创可贴
    ctx.save();
    ctx.translate(CX + 30, 155);
    ctx.rotate(-0.24);
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-10, -4, 20, 8, 2.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-3.5, -3, 7, 6);
    ctx.restore();
  } else if (effectiveAcc === 4) {
    // 4: 左耳金属耳钉闪光点缀
    const ex = CX - 54;
    const ey = t.jaw.cheekY + 17;
    ctx.fillStyle = '#FDE047';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 1, ey - 1, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 5: 锋利右侧颧骨小战痕
    ctx.strokeStyle = t.skin.shadow2;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(CX + 22, 146);
    ctx.lineTo(CX + 35, 160);
    ctx.stroke();
    ctx.strokeStyle = t.skin.rim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(CX + 23.5, 145.5);
    ctx.lineTo(CX + 36, 159);
    ctx.stroke();
  }

  ctx.restore();
}

function resolveTraits(
  player: Pick<DraftPlayer, 'id' | 'name' | 'age' | 'role' | 'tier' | 'isCaptain'>,
  club?: AvatarClubColors
): PortraitTraits {
  const seed = hashStr(`${player.id}_${player.name}`);
  const s0 = mixSeed(seed, 11);
  const s1 = mixSeed(seed, 23);
  const s2 = mixSeed(seed, 37);
  const s3 = mixSeed(seed, 53);
  const s4 = mixSeed(seed, 71);
  const s5 = mixSeed(seed, 89);

  const skinIdx = s0 % SKIN_PALETTES.length;
  const jawIdx = (s0 >>> 8) % JAW_SPECS.length;
  const hairIdx = s1 % 14;
  const eyeIdx = (s1 >>> 8) % 8;
  const noseIdx = (s2 >>> 4) % 5;
  const mouthIdx = (s2 >>> 12) % 7;

  // 发色与肤色自然协调（严格禁止寸头/卷顶/脏辫配极浅灰白免显白帽）
  let hairColIdx = s3 % 6;
  if (skinIdx >= 4) {
    hairColIdx = s3 % 10 < 8 ? (s3 % 2) : 6;
  } else if (skinIdx <= 1 && s3 % 10 === 0) {
    hairColIdx = 5;
  } else if (player.tier === 'S' && (s3 >>> 6) % 7 === 0) {
    hairColIdx = 6;
  }
  if ((hairIdx === 3 || hairIdx === 4 || hairIdx === 9) && (hairColIdx === 4 || hairColIdx === 6)) {
    hairColIdx = 0;
  }
  const irisIdx = skinIdx >= 4 && s4 % 4 !== 0 ? 0 : s4 % IRIS_PALETTES.length;

  const beardRoll = (s4 >>> 8) % 16;
  let beardIdx = 0;
  if (player.age <= 20) {
    beardIdx = beardRoll < 10 ? 0 : beardRoll < 14 ? 1 : 6;
  } else if (player.age <= 25) {
    beardIdx = beardRoll < 6 ? 0 : (beardRoll % 6) + 1;
  } else {
    beardIdx = beardRoll < 3 ? 0 : [1, 2, 3, 4, 5, 6, 3, 4, 2, 1, 3, 4, 5][beardRoll - 3];
  }

  const gkPair = GK_KIT_PAIRS[s5 % GK_KIT_PAIRS.length];
  const primary = player.role === 'GK' ? gkPair[0] : club?.primaryColor || '#2563EB';
  const secondary = player.role === 'GK' ? gkPair[1] : club?.secondaryColor || '#F8FAFC';
  const kitIdx = player.role === 'GK' ? 5 : (s5 >>> 6) % 6;

  const accRoll = (s5 >>> 14) % 23;
  const accIdx = accRoll < 6 ? accRoll : -1;

  return {
    skin: SKIN_PALETTES[skinIdx],
    skinIdx,
    hairPalette: HAIR_PALETTES[hairColIdx],
    iris: IRIS_PALETTES[irisIdx],
    jaw: JAW_SPECS[jawIdx],
    jawIdx,
    hairIdx,
    eyeIdx,
    noseIdx,
    mouthIdx,
    beardIdx,
    kitIdx,
    accIdx,
    primary,
    secondary,
    tier: player.tier,
    isCaptain: !!player.isCaptain,
    isVeteran: player.age >= 30,
    saltPepper: player.age >= 32,
  };
}

function renderPortraitLayers(ctx: CanvasRenderingContext2D, t: PortraitTraits): void {
  drawBackdrop(ctx, t.tier);
  drawBackHair(ctx, t);
  drawJersey(ctx, t);
  drawNeck(ctx, t);
  drawEars(ctx, t);
  drawFace(ctx, t);
  drawBeard(ctx, t);
  drawMouth(ctx, t);
  drawNose(ctx, t);
  drawEyesAndBrows(ctx, t);
  drawFrontHair(ctx, t);
  drawAccessories(ctx, t);
}

function getOrRenderOffscreen(
  player: Pick<DraftPlayer, 'id' | 'name' | 'age' | 'role' | 'tier' | 'isCaptain'>,
  traits: PortraitTraits
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const key = `${player.id}_${player.name}_${player.age}_${player.role}_${player.tier}_${traits.isCaptain ? 1 : 0}_${traits.primary}_${traits.secondary}`;
  const hit = portraitCache.get(key);
  if (hit) {
    portraitCache.delete(key);
    portraitCache.set(key, hit);
    return hit;
  }

  const off = document.createElement('canvas');
  off.width = PW;
  off.height = PH;
  const octx = off.getContext('2d');
  if (!octx) return null;

  renderPortraitLayers(octx, traits);

  if (portraitCache.size >= MAX_AVATAR_CACHE) {
    const oldest = portraitCache.keys().next().value;
    if (oldest !== undefined) portraitCache.delete(oldest);
  }
  portraitCache.set(key, off);
  return off;
}

function drawPortraitFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
  tier: 'S' | 'A' | 'B' | 'C'
): void {
  const tierCol = tierColor(tier);
  ctx.save();
  if (tier === 'S') {
    drawRoundRect(ctx, x, y, w, h, rad, undefined, '#FACC15', 1.8);
    drawRoundRect(ctx, x + 2, y + 2, Math.max(2, w - 4), Math.max(2, h - 4), Math.max(2, rad - 2), undefined, 'rgba(254, 240, 138, 0.52)', 0.9);
    const sheen = ctx.createLinearGradient(x, y, x + w, y);
    sheen.addColorStop(0, 'rgba(254,240,138,0)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    sheen.addColorStop(1, 'rgba(254,240,138,0)');
    ctx.strokeStyle = sheen;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + rad, y + 0.8);
    ctx.lineTo(x + w - rad, y + 0.8);
    ctx.stroke();

    ctx.fillStyle = '#FEF08A';
    const d = 2.4;
    const pts: Array<[number, number]> = [
      [x + 4, y + 4],
      [x + w - 4, y + 4],
      [x + 4, y + h - 4],
      [x + w - 4, y + h - 4],
    ];
    for (const [px, py] of pts) {
      ctx.beginPath();
      ctx.moveTo(px, py - d);
      ctx.lineTo(px + d, py);
      ctx.lineTo(px, py + d);
      ctx.lineTo(px - d, py);
      ctx.closePath();
      ctx.fill();
    }
  } else if (tier === 'A') {
    drawRoundRect(ctx, x, y, w, h, rad, undefined, '#C084FC', 1.5);
    drawRoundRect(ctx, x + 2, y + 2, Math.max(2, w - 4), Math.max(2, h - 4), Math.max(2, rad - 2), undefined, 'rgba(233, 213, 255, 0.40)', 0.8);
  } else if (tier === 'B') {
    drawRoundRect(ctx, x, y, w, h, rad, undefined, '#3B82F6', 1.2);
  } else {
    drawRoundRect(ctx, x, y, w, h, rad, undefined, tierCol, 1.0);
  }
  ctx.restore();
}

export interface AvatarClubColors {
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * 绘制千人千面高精度球员肖像
 * 顺序：圆角裁剪 -> 256×320 离屏超采样渲染（背景光晕 -> 后发 -> 球衣 -> 颈部 -> 耳 -> 脸型 -> 胡须 -> 嘴 -> 鼻 -> 眉眼 -> 前发 -> 配饰） -> 原生锐利镂空金属框
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
  const traits = resolveTraits(player, club);
  const rad = opts?.radius ?? 6;
  const tierCol = tierColor(player.tier);

  drawRoundRect(ctx, x, y, w, h, rad, '#0B1324', tierCol, 1.0);

  ctx.save();
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();

  const scale = Math.max(w / PW, h / PH);
  const dw = PW * scale;
  const dh = PH * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) * 0.25;

  const off = getOrRenderOffscreen(player, traits);
  if (off && typeof ctx.drawImage === 'function') {
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = w <= 44 ? 'low' : 'medium';
    ctx.drawImage(off, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = prevSmooth;
  } else {
    ctx.translate(dx, dy);
    ctx.scale(scale, scale);
    renderPortraitLayers(ctx, traits);
  }
  ctx.restore();

  if (opts?.showFrame !== false) {
    drawPortraitFrame(ctx, x, y, w, h, rad, player.tier);
  }
}
