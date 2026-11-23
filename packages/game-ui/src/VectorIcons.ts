/**
 * 纯 Canvas 2D 发行级矢量图标库（彻底替代系统 Emoji）
 * 零图片/字体外部依赖，全平台渲染完全一致
 */

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
  | 'star';

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
  }
  ctx.restore();
}
