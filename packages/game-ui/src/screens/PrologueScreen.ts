/**
 * 60 秒老将退役序章与隐藏体面结局（V5 电影级 2.5D 动态分镜演出版）
 * 5 阶段叙事交互：
 *   0: 最后一次步入通道（体积光束 + 浮尘 + 推镜脚步节奏）
 *   1: 90+2' 补时绝杀抽射（实时暴雨 + 闪电 + 子弹时间准星缩圈 + 80ms白闪顿帧 + 金色纸屑雨）
 *   2: 挂靴与恩师来电（过曝白切入冷色更衣室 + 手机来电脉冲 + 语音通话波形条）
 *   3: 回到家乡抉择（双层晨雾漂流 + 朝阳丁达尔光束 + 悬停推拉运镜与冷暖色调响应）
 *   4: 隐藏结局「功成身退 · 绿茵归隐」（慢镜头横移 + 暖金粒子 + 电影落幕滚屏，预留 prologue_05_retired_ending 替换位）
 */

import { AssetLoader, ArtAssetId } from '../AssetLoader';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawFoilShimmer,
  drawRoundRect,
  drawText,
  drawWrappedText,
  HitRegistry,
} from '../CanvasKit';
import { easeOutBack, easeOutCubic } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';

export interface PrologueActions {
  onEnterAct2Match?: () => void;
  onAcceptHometown: () => void;
  onDeclineSecretEnding: () => void;
  onReturnTitle: () => void;
  onSkipPrologue: () => void;
  onBurst?: (x: number, y: number, color?: string) => void;
  onShake?: (intensity: number, dur: number) => void;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
}

const ACT_META: Record<0 | 1 | 2 | 3, { act: string; label: string }> = {
  0: { act: 'ACT I', label: 'THE LAST WALKOUT · 最后一次出场' },
  1: { act: 'ACT II', label: '90+2\' STOPPAGE TIME · 终场绝唱' },
  2: { act: 'ACT III', label: 'MIDNIGHT CALL · 更衣室未接来电' },
  3: { act: 'ACT IV', label: 'HOMECOMING · 清晨的泥地球场' },
};

export class PrologueScreen {
  private stage: 0 | 1 | 2 | 3 | 4 = 0;
  private stageTime = 0;
  private animTime = 0;
  private climaxShotTriggered = false;
  private climaxFlashTimer = 0;
  private impactFreezeTimer = 0;
  private perfectShot = false;
  private transTimer = 0;
  private transMode: 'black' | 'white' = 'black';
  private hoverSide: 'none' | 'left' | 'right' = 'none';
  private hoverBlend = 0; // -1 left, +1 right
  private skipReveal = false;
  private actionsRef: PrologueActions | null = null;

  private rainDrops: RainDrop[] = Array.from({ length: 68 }, (_, i) => ({
    x: (i * 197) % THEME.W,
    y: (i * 113) % THEME.H,
    len: 16 + (i % 4) * 8,
    speed: 680 + (i % 5) * 90,
    alpha: 0.16 + (i % 3) * 0.08,
  }));
  private confetti: ConfettiPiece[] = [];

  public reset(): void {
    this.stage = 0;
    this.stageTime = 0;
    this.climaxShotTriggered = false;
    this.climaxFlashTimer = 0;
    this.impactFreezeTimer = 0;
    this.perfectShot = false;
    this.transTimer = 0.45;
    this.transMode = 'black';
    this.hoverSide = 'none';
    this.hoverBlend = 0;
    this.skipReveal = false;
    this.confetti = [];
    SoundEngine.playVoice('vo_prologue_1', 1500);
  }

  public update(dtSec: number): void {
    if (this.impactFreezeTimer > 0) {
      this.impactFreezeTimer = Math.max(0, this.impactFreezeTimer - dtSec);
      this.animTime += dtSec * 0.25;
      return;
    }

    this.animTime += dtSec;
    this.stageTime += dtSec;
    if (this.transTimer > 0) {
      this.transTimer = Math.max(0, this.transTimer - dtSec);
    }
    if (this.climaxFlashTimer > 0) {
      this.climaxFlashTimer = Math.max(0, this.climaxFlashTimer - dtSec);
    }

    // 悬停倾角平滑插值（Stage 3）
    const targetBlend = this.hoverSide === 'left' ? -1 : this.hoverSide === 'right' ? 1 : 0;
    this.hoverBlend += (targetBlend - this.hoverBlend) * Math.min(1, dtSec * 5.5);

    // 暴雨粒子更新（Stage 1）
    if (this.stage === 1) {
      for (const r of this.rainDrops) {
        r.x -= dtSec * r.speed * 0.24;
        r.y += dtSec * r.speed;
        if (r.y > THEME.H + 30) {
          r.y = -20;
          r.x = (r.x + THEME.W + 180) % THEME.W;
        }
        if (r.x < -40) r.x += THEME.W + 60;
      }
    }

    // 纸屑粒子更新（Stage 1 破门）
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const p = this.confetti[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 260 * dtSec;
      p.vx *= 0.99;
      p.rot += p.vrot * dtSec;
      if (p.y > THEME.H + 40) this.confetti.splice(i, 1);
    }
  }

  public resumeAfterAct2Match(): void {
    this.goStage(2, 'white');
  }

  public onKeyDown(code: string): void {
    if (code === 'Space' || code === 'Enter') {
      if (this.stage === 1 && !this.climaxShotTriggered) {
        this.triggerClimaxShot();
      } else if (this.stage === 0) {
        if (this.actionsRef?.onEnterAct2Match) {
          SoundEngine.playClick();
          this.actionsRef.onEnterAct2Match();
        } else {
          this.goStage(1);
        }
      } else if (this.stage === 1 && this.climaxShotTriggered) {
        this.goStage(2, 'white');
      } else if (this.stage === 2) {
        this.goStage(3);
      }
    }
  }

  private goStage(next: 0 | 1 | 2 | 3 | 4, transMode: 'black' | 'white' = 'black'): void {
    this.stage = next;
    this.stageTime = 0;
    this.skipReveal = false;
    this.transMode = transMode;
    this.transTimer = transMode === 'white' ? 0.65 : 0.42;
    this.hoverSide = 'none';
    SoundEngine.playClick();
    if (next === 1) SoundEngine.playVoice('vo_prologue_2', 1500);
    else if (next === 2) SoundEngine.playVoice('vo_prologue_3', 1500);
    else if (next === 3) SoundEngine.playVoice('vo_prologue_4', 1500);
  }

  private getBulletRingPhase(): number {
    // 0 -> 1 循环缩放相位：0.32..0.62 为黄金甜区
    return 0.5 + 0.44 * Math.sin(this.animTime * 3.8);
  }

  private triggerClimaxShot(): void {
    if (this.climaxShotTriggered) return;
    const phase = this.getBulletRingPhase();
    this.perfectShot = phase >= 0.30 && phase <= 0.64;
    this.climaxShotTriggered = true;
    this.climaxFlashTimer = 1.85;
    this.impactFreezeTimer = 0.08;
    SoundEngine.playGoalCheer();
    if (this.perfectShot) SoundEngine.playBreakthrough();
    this.actionsRef?.onShake?.(this.perfectShot ? 11 : 7, 0.34);
    this.actionsRef?.onBurst?.(640, 300, THEME.GOLD_LIGHT);
    this.actionsRef?.onBurst?.(440, 240, '#EF4444');
    this.actionsRef?.onBurst?.(840, 240, '#38BDF8');

    const colors = ['#FACC15', '#FEF08A', '#38BDF8', '#4ADE80', '#F97316'];
    for (let i = 0; i < 42; i++) {
      const ang = -Math.PI + Math.random() * Math.PI * 2;
      const spd = 140 + Math.random() * 340;
      this.confetti.push({
        x: 640 + (Math.random() - 0.5) * 180,
        y: 280 + (Math.random() - 0.5) * 90,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 160,
        size: 4 + Math.random() * 5,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 8,
      });
    }
  }

  private drawBackdropScene(
    ctx: CanvasRenderingContext2D,
    artId: ArtAssetId,
    darkOverlayAlpha = 0.38,
    cam?: { zoom?: number; panX?: number; panY?: number; tintColor?: string }
  ): void {
    const img = AssetLoader.get(artId);
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    if (img && typeof ctx.drawImage === 'function') {
      const iw = img.naturalWidth || img.width || 1024;
      const ih = img.naturalHeight || img.height || 572;
      const zoom = cam?.zoom ?? 1.0 + Math.min(0.08, this.stageTime * 0.01);
      const scale = Math.max(THEME.W / iw, THEME.H / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const ox = cam?.panX ?? 0;
      const oy = cam?.panY ?? 0;
      ctx.drawImage(img, THEME.W / 2 - dw / 2 + ox, THEME.H / 2 - dh / 2 + oy, dw, dh);
    }

    if (cam?.tintColor) {
      ctx.fillStyle = cam.tintColor;
      ctx.fillRect(0, 0, THEME.W, THEME.H);
    }

    // 电影渐变暗角与底部可读压暗
    const grad = ctx.createLinearGradient(0, 0, 0, THEME.H);
    grad.addColorStop(0, `rgba(6, 10, 18, ${(darkOverlayAlpha * 0.78).toFixed(2)})`);
    grad.addColorStop(0.48, `rgba(6, 10, 18, ${(darkOverlayAlpha * 0.36).toFixed(2)})`);
    grad.addColorStop(1, `rgba(6, 10, 18, ${Math.min(0.95, darkOverlayAlpha + 0.50).toFixed(2)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, THEME.W, THEME.H);
  }

  private drawCinemaFrame(ctx: CanvasRenderingContext2D, stage: 0 | 1 | 2 | 3): void {
    // 2.39:1 宽银幕电影黑边
    const barOpen = easeOutCubic(Math.min(1, this.stageTime / 0.45));
    const barH = Math.round(28 * barOpen);
    ctx.fillStyle = '#03050B';
    ctx.fillRect(0, 0, THEME.W, barH);
    ctx.fillRect(0, THEME.H - barH, THEME.W, barH);

    // 电影章节片头浮卡（前 2.1 秒）
    if (this.stageTime < 2.2) {
      const meta = ACT_META[stage];
      const alpha =
        this.stageTime < 0.35
          ? this.stageTime / 0.35
          : this.stageTime > 1.55
          ? Math.max(0, 1 - (this.stageTime - 1.55) / 0.65)
          : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawText(ctx, `${meta.act}  ·  ${meta.label}`, 640, 62, {
        size: 13,
        bold: true,
        color: '#FDE68A',
        align: 'center',
        mono: true,
      });
      ctx.restore();
    }
  }

  private drawStageTransition(ctx: CanvasRenderingContext2D): void {
    if (this.impactFreezeTimer > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(0, 0, THEME.W, THEME.H);
      return;
    }
    if (this.transTimer <= 0) return;
    const maxT = this.transMode === 'white' ? 0.65 : 0.42;
    const p = Math.max(0, Math.min(1, this.transTimer / maxT));
    ctx.fillStyle = this.transMode === 'white'
      ? `rgba(255, 252, 235, ${(p * 0.92).toFixed(2)})`
      : `rgba(4, 7, 14, ${(p * 0.95).toFixed(2)})`;
    ctx.fillRect(0, 0, THEME.W, THEME.H);
  }

  private revealLine(fullText: string, speedCharsPerSec = 42): string {
    if (this.skipReveal) return fullText;
    const count = Math.floor(this.stageTime * speedCharsPerSec);
    return count >= fullText.length ? fullText : fullText.slice(0, Math.max(1, count));
  }

  public render(ctx: CanvasRenderingContext2D, hits: HitRegistry, actions: PrologueActions): void {
    this.actionsRef = actions;

    // ==================== Stage 0: 球员通道 · 最后一次出场 ====================
    if (this.stage === 0) {
      const stepBob = Math.sin(this.animTime * 4.2) * 3.5;
      const pushZoom = 1.01 + Math.min(0.11, this.stageTime * 0.015);
      this.drawBackdropScene(ctx, 'prologue_01_tunnel', 0.34, {
        zoom: pushZoom,
        panY: stepBob,
      });

      // 通道尽头体积聚光灯束（God Rays，上移至球场通道顶棚出口）
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let ri = 0; ri < 4; ri++) {
        const rayAlpha = 0.09 + 0.05 * Math.sin(this.animTime * 1.8 + ri * 1.4);
        const spread = 160 + ri * 95 + Math.sin(this.animTime * 0.9 + ri) * 24;
        const grad = ctx.createLinearGradient(640, 0, 640, 390);
        grad.addColorStop(0, `rgba(254, 240, 138, ${rayAlpha.toFixed(3)})`);
        grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(640 - 44, 0);
        ctx.lineTo(640 + 44, 0);
        ctx.lineTo(640 + spread, 390);
        ctx.lineTo(640 - spread, 390);
        ctx.closePath();
        ctx.fill();
      }
      // 浮尘粒子
      for (let i = 0; i < 20; i++) {
        const px = (i * 137 + this.animTime * 18) % THEME.W;
        const py = 18 + ((i * 73 - this.animTime * 14) % 320 + 320) % 320;
        const pa = 0.18 + 0.22 * Math.sin(this.animTime * 2.5 + i);
        ctx.fillStyle = `rgba(254, 240, 138, ${pa.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      this.drawCinemaFrame(ctx, 0);
      drawBadge(ctx, 40, 36, 224, 28, 'PROLOGUE · 老将序章 (1/4)', 'rgba(11,17,32,0.85)', THEME.GOLD_LIGHT);
      drawButton(ctx, hits, 1110, 34, 134, 32, '跳过序章 ▶', () => {
        SoundEngine.playClick();
        actions.onSkipPrologue();
      }, { variant: 'ghost', fontSize: 11.5 });

      const fade = easeOutCubic(Math.min(1, this.stageTime / 0.45));
      ctx.save();
      ctx.globalAlpha = fade;
      drawChamferPanel(ctx, 110, 468, 1060, 212, 14, 'rgba(8, 13, 24, 0.90)', THEME.BORDER_GOLD, 1.5, THEME.GOLD_LIGHT);
      drawBadge(ctx, 138, 490, 168, 24, '第一幕 · 最后一次出场', '#0C4A6E', '#7DD3FC');
      drawText(ctx, '38岁，最后一次把队长袖标缠在左臂', 138, 534, { size: 22, bold: true, color: THEME.GOLD_LIGHT });
      const story0 = '职业生涯第 612 场。队医昨夜警告你膝盖软骨早已磨平——但这更是联赛收官决战，只有赢下这场比赛才能捧起冠军奖杯！通道尽头泛着刺眼白光，八万人的合唱已在震动鞋底。';
      drawWrappedText(ctx, this.revealLine(story0, 56), 138, 566, 740, 24, { size: 13.5, color: THEME.TX1, maxLines: 3 });
      hits.add(110, 468, 780, 212, () => { this.skipReveal = true; });
      drawButton(ctx, hits, 916, 584, 224, 52, '踏上球场 · 最后一战 ▶', () => {
        if (actions.onEnterAct2Match) {
          SoundEngine.playClick();
          actions.onEnterAct2Match();
        } else {
          this.goStage(1);
        }
      }, {
        variant: 'gold',
        fontSize: 14,
      });
      ctx.restore();
      this.drawStageTransition(ctx);
      return;
    }

    // ==================== Stage 1: 90+2' 补时绝杀（暴雨 + 子弹时间准星） ====================
    if (this.stage === 1) {
      const flashLightning = !this.climaxShotTriggered && (this.animTime % 5.4 < 0.09);
      const kickZoom = this.climaxShotTriggered ? 1.13 - Math.min(0.05, this.climaxFlashTimer * 0.02) : 1.02 + Math.min(0.06, this.stageTime * 0.01);
      this.drawBackdropScene(ctx, 'prologue_02_last_kick', this.climaxShotTriggered ? 0.34 : 0.42, {
        zoom: kickZoom,
        tintColor: flashLightning ? 'rgba(224, 242, 254, 0.28)' : undefined,
      });

      // 实时暴雨斜线
      ctx.save();
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
      ctx.lineWidth = 1.2;
      for (const r of this.rainDrops) {
        ctx.globalAlpha = r.alpha;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.len * 0.24, r.y + r.len);
        ctx.stroke();
      }
      ctx.restore();

      // 破门后 Cut-In 光轨 + 冲击波纹 + 金色纸屑
      if (this.climaxShotTriggered) {
        for (let wi = 0; wi < 2; wi++) {
          const wp = Math.max(0, 1 - (this.climaxFlashTimer - wi * 0.2) / 1.4);
          if (wp > 0 && wp < 1) {
            ctx.save();
            ctx.strokeStyle = this.perfectShot ? '#FDE047' : '#38BDF8';
            ctx.globalAlpha = (1 - wp) * 0.55;
            ctx.lineWidth = 3 * (1 - wp);
            ctx.beginPath();
            ctx.arc(640, 310, 40 + wp * 420, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
        for (const p of this.confetti) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
          ctx.restore();
        }
      }

      if (this.climaxFlashTimer > 0) {
        const ultArt = AssetLoader.get('fx_skill_cutin_ult');
        const fp = Math.min(1, this.climaxFlashTimer / 0.55);
        if (ultArt && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = fp * 0.92;
          ctx.drawImage(ultArt, 0, 175, THEME.W, 240);
          ctx.restore();
        }
      }

      // 交互态：子弹时间准星缩圈
      if (!this.climaxShotTriggered) {
        const cx = 640;
        const cy = 266;
        const phase = this.getBulletRingPhase();
        const inSweet = phase >= 0.30 && phase <= 0.64;
        const outerR = 32 + phase * 68;
        ctx.save();
        // 黄金甜区环
        ctx.strokeStyle = inSweet ? 'rgba(250, 204, 21, 0.88)' : 'rgba(250, 204, 21, 0.38)';
        ctx.lineWidth = inSweet ? 14 : 10;
        ctx.beginPath();
        ctx.arc(cx, cy, 64, 0, Math.PI * 2);
        ctx.stroke();
        // 动态缩放瞄准圈
        ctx.strokeStyle = inSweet ? '#FEF08A' : '#38BDF8';
        ctx.lineWidth = 3;
        ctx.shadowColor = inSweet ? '#FACC15' : '#38BDF8';
        ctx.shadowBlur = inSweet ? 18 : 8;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.stroke();
        drawText(ctx, inSweet ? 'PERFECT VOLLEY!' : 'TIMING · 瞄准甜区', cx, cy + 92, {
          size: 12,
          bold: true,
          color: inSweet ? '#FEF08A' : '#BAE6FD',
          align: 'center',
          mono: true,
        });
        ctx.restore();
      }

      this.drawCinemaFrame(ctx, 1);
      drawBadge(ctx, 40, 36, 224, 28, 'PROLOGUE · 终场绝唱 (2/4)', 'rgba(11,17,32,0.85)', THEME.GOLD_LIGHT);
      drawButton(ctx, hits, 1110, 34, 134, 32, '跳过序章 ▶', () => actions.onSkipPrologue(), { variant: 'ghost', fontSize: 11.5 });

      if (!this.climaxShotTriggered) {
        drawChamferPanel(ctx, 210, 444, 860, 232, 14, 'rgba(8, 13, 24, 0.92)', THEME.GOLD_LIGHT, 2, THEME.GOLD_LIGHT);
        drawBadge(ctx, 240, 466, 220, 24, '90+2\' 伤停补时 · 1 : 1 平', '#7F1D1D', '#FCA5A5');
        drawText(ctx, '边路传中穿过雨幕砸向门前！抓紧子弹时间在黄金圈内轰出最后一脚——', 640, 514, {
          size: 18.5,
          bold: true,
          color: THEME.TX1,
          align: 'center',
        });

        const bx = 340, by = 544, bw = 600, bh = 12;
        const pos = this.getBulletRingPhase();
        const inSweetBar = pos >= 0.30 && pos <= 0.64;
        drawRoundRect(ctx, bx, by, bw, bh, 6, '#1E293B', THEME.BORDER);
        drawRoundRect(ctx, bx + bw * 0.30, by, bw * 0.34, bh, 4, inSweetBar ? 'rgba(250, 204, 21, 0.62)' : 'rgba(250, 204, 21, 0.32)');
        ctx.fillStyle = inSweetBar ? '#FEF08A' : '#7DD3FC';
        ctx.beginPath();
        ctx.arc(bx + bw * pos, by + bh / 2, 8.5, 0, Math.PI * 2);
        ctx.fill();

        drawButton(ctx, hits, 410, 580, 460, 58, '凌空爆射 · 终结这场比赛！(点击 / Space)', () => {
          this.triggerClimaxShot();
        }, { variant: 'gold', fontSize: 16 });
      } else {
        drawChamferPanel(ctx, 110, 468, 1060, 212, 14, 'rgba(8, 13, 24, 0.92)', THEME.GOLD_LIGHT, 2, THEME.GOLD_LIGHT);
        drawBadge(
          ctx,
          138,
          490,
          this.perfectShot ? 256 : 226,
          24,
          this.perfectShot ? 'GOOOAL!! 完美世界波 · 死角绝杀！' : 'GOOOAL!! 90+2\' 绝杀世界波！',
          '#14532D',
          THEME.GREEN
        );
        drawText(
          ctx,
          this.perfectShot ? '教科书般完美谢幕 · 皮球直挂死角，全场山呼海啸' : '完美谢幕 · 球网震颤，全场起立献上最后掌声',
          138,
          534,
          { size: 22, bold: true, color: THEME.GOLD_LIGHT }
        );
        drawWrappedText(
          ctx,
          '大雨里你双膝滑跪在草皮上，全队扑上来抱住你。主裁判随后吹响终场哨音——你赢下了属于球员时代的最后一座奖杯，也终于要把战靴脱下了。',
          138,
          566,
          740,
          24,
          { size: 13.5, color: THEME.TX1, maxLines: 3 }
        );
        drawButton(ctx, hits, 916, 584, 224, 52, '走进更衣室 · 挂靴告别 ▶', () => this.goStage(2, 'white'), {
          variant: 'gold',
          fontSize: 14,
        });
      }
      this.drawStageTransition(ctx);
      return;
    }

    // ==================== Stage 2: 寂静更衣室 · 老恩师来电 ====================
    if (this.stage === 2) {
      const slowPanY = Math.sin(this.stageTime * 0.45) * 6;
      this.drawBackdropScene(ctx, 'prologue_03_farewell_phone', 0.34, {
        zoom: 1.03 + Math.min(0.05, this.stageTime * 0.006),
        panY: slowPanY,
      });

      // 画面右下角来电手机呼吸脉冲光环
      ctx.save();
      const ringT = (this.animTime * 0.95) % 1;
      const ringR = 24 + ringT * 84;
      ctx.strokeStyle = '#38BDF8';
      ctx.globalAlpha = (1 - ringT) * 0.60;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(940, 428, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // 拟真通话语音波形浮条
      drawRoundRect(ctx, 470, 396, 340, 44, 22, 'rgba(8, 15, 32, 0.88)', 'rgba(56, 189, 248, 0.65)', 1.4);
      drawText(ctx, '老恩师 · 来电通话中', 492, 418, { size: 12, bold: true, color: '#7DD3FC' });
      for (let bi = 0; bi < 14; bi++) {
        const amp = 4 + Math.abs(Math.sin(this.animTime * 8.5 + bi * 0.9)) * 16;
        ctx.fillStyle = bi % 2 === 0 ? '#38BDF8' : '#FACC15';
        ctx.fillRect(654 + bi * 9, 418 - amp / 2, 4, amp);
      }
      ctx.restore();

      this.drawCinemaFrame(ctx, 2);
      drawBadge(ctx, 40, 36, 224, 28, 'PROLOGUE · 更衣室余温 (3/4)', 'rgba(11,17,32,0.85)', '#7DD3FC');
      drawButton(ctx, hits, 1110, 34, 134, 32, '跳过序章 ▶', () => actions.onSkipPrologue(), { variant: 'ghost', fontSize: 11.5 });

      drawChamferPanel(ctx, 110, 468, 1060, 212, 14, 'rgba(8, 13, 24, 0.91)', '#38BDF8', 1.5, '#38BDF8');
      drawBadge(ctx, 138, 490, 186, 24, '第三幕 · 深夜的未接来电', '#0C4A6E', '#7DD3FC');
      drawText(ctx, '泥泞战靴放在长凳旁，屏幕突然亮起老恩师的来电', 138, 534, { size: 22, bold: true, color: THEME.TX1 });
      const story2 = '「看见你那脚绝杀了，小子。」老恩师的声音沙哑又熟悉，「镇上那支你当年踢青训出来的草根小队快挺不住了——七级联赛垫底、没预算、没人愿接。哪怕再踢最后一个赛季也好，回来带着这群孩子打回来吧？」';
      drawWrappedText(ctx, this.revealLine(story2, 54), 138, 566, 740, 24, { size: 13.5, color: '#CBD5E1', maxLines: 3 });
      hits.add(110, 468, 780, 212, () => { this.skipReveal = true; });
      drawButton(ctx, hits, 916, 584, 224, 52, '回到故乡 · 推开铁门 ▶', () => this.goStage(3), {
        variant: 'primary',
        fontSize: 14,
      });
      this.drawStageTransition(ctx);
      return;
    }

    // ==================== Stage 3: 家乡泥地球场分岔抉择（晨雾 + 悬停动态运镜） ====================
    if (this.stage === 3) {
      const lx = 88, ly = 416, lw = 532, lh = 264;
      const rx = 660, ry = 416, rw = 532, rh = 264;
      const lHover = hits.isHovered(lx, ly, lw, lh);
      const rHover = hits.isHovered(rx, ry, rw, rh);
      this.hoverSide = lHover ? 'left' : rHover ? 'right' : 'none';

      const camZoom = 1.04 - this.hoverBlend * 0.04;
      const camPanX = this.hoverBlend * -24;
      const tint =
        this.hoverBlend < -0.15
          ? `rgba(245, 158, 11, ${Math.min(0.14, Math.abs(this.hoverBlend) * 0.14).toFixed(3)})`
          : this.hoverBlend > 0.15
          ? `rgba(56, 189, 248, ${Math.min(0.12, Math.abs(this.hoverBlend) * 0.12).toFixed(3)})`
          : undefined;
      this.drawBackdropScene(ctx, 'prologue_04_hometown_club', 0.36, {
        zoom: camZoom,
        panX: camPanX,
        tintColor: tint,
      });

      // 多层半透明清晨薄雾漂流 + 朝阳丁达尔斜光
      ctx.save();
      for (let mi = 0; mi < 3; mi++) {
        const mistY = 230 + mi * 72;
        const mistShift = ((this.animTime * (16 + mi * 9) + mi * 280) % (THEME.W + 400)) - 200;
        const mg = ctx.createRadialGradient(mistShift, mistY, 20, mistShift, mistY, 340);
        mg.addColorStop(0, 'rgba(226, 232, 240, 0.14)');
        mg.addColorStop(1, 'rgba(226, 232, 240, 0)');
        ctx.fillStyle = mg;
        ctx.fillRect(0, mistY - 120, THEME.W, 240);
      }
      ctx.globalCompositeOperation = 'screen';
      const sunGrad = ctx.createLinearGradient(180, 60, 720, 420);
      sunGrad.addColorStop(0, 'rgba(253, 224, 71, 0.16)');
      sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.moveTo(80, 0);
      ctx.lineTo(360, 0);
      ctx.lineTo(920, 480);
      ctx.lineTo(420, 480);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      this.drawCinemaFrame(ctx, 3);
      drawBadge(ctx, 40, 36, 224, 28, 'PROLOGUE · 命运分岔口 (4/4)', 'rgba(11,17,32,0.85)', THEME.GOLD_LIGHT);

      drawChamferPanel(ctx, 220, 56, 840, 104, 12, 'rgba(8, 13, 24, 0.86)', THEME.BORDER_GOLD, 1.2);
      drawText(ctx, '清晨的泥地球场，等待你的回答', 640, 88, { size: 22, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
      drawText(
        ctx,
        '雾气里一群十五六岁的孩子还在自己加练射门。老恩师递过战术板：是再燃烧一次执掌教鞭，还是彻底告别绿茵？',
        640,
        124,
        { size: 13, color: THEME.TX1, align: 'center' }
      );

      // 左卡：接受邀约，重返家乡执教
      drawChamferPanel(ctx, lx, ly, lw, lh, 14, lHover ? 'rgba(16, 28, 48, 0.96)' : 'rgba(10, 17, 32, 0.92)', THEME.GOLD_LIGHT, lHover ? 2.4 : 1.6, THEME.GOLD_LIGHT);
      drawFoilShimmer(ctx, lx, ly, lw, lh, this.animTime * 0.8, 'rgba(250, 204, 21, 0.16)');
      drawBadge(ctx, lx + 22, ly + 18, 186, 24, '开启执教生涯 · 主线起点', '#78350F', THEME.GOLD_LIGHT);
      const roarImg = AssetLoader.get('cmd_captain_roar');
      if (roarImg && typeof ctx.drawImage === 'function') {
        drawChamferPanel(ctx, lx + 22, ly + 56, 118, 82, 8, '#090F1D', THEME.GOLD);
        ctx.drawImage(roarImg, lx + 24, ly + 58, 114, 78);
      }
      drawText(ctx, '游子归家，再踢最后一季', lx + 156, ly + 72, { size: 18, bold: true, color: THEME.TX1 });
      drawBadge(ctx, lx + 156, ly + 90, 232, 22, '老队长 #10 梅利纳亲自上阵 · S1限', '#14532D', THEME.GREEN);
      drawText(ctx, 'CA 84 中轴全能(ST/CAM/CM/CDM/CB) · 季末转教练', lx + 156, ly + 128, { size: 11.5, color: '#7DD3FC' });
      drawWrappedText(
        ctx,
        '第1赛季化身80+中轴碾压卡带领家乡小队起飞，季末传奇退役转教练并传承【老队长的怒吼】！',
        lx + 22,
        ly + 154,
        lw - 44,
        18,
        { size: 12.5, color: THEME.TX2, maxLines: 2 }
      );
      drawButton(ctx, hits, lx + 22, ly + lh - 58, lw - 44, 44, '接过教鞭，回到家乡执教 ▶', () => {
        SoundEngine.playGoalCheer();
        actions.onAcceptHometown();
      }, { variant: 'gold', fontSize: 14.5 });

      // 右卡：彩蛋抉择 — 婉拒邀约，体面归隐结局
      drawChamferPanel(ctx, rx, ry, rw, rh, 14, rHover ? 'rgba(20, 26, 40, 0.96)' : 'rgba(11, 16, 28, 0.90)', rHover ? '#E2E8F0' : THEME.BORDER, rHover ? 1.8 : 1.2);
      drawBadge(ctx, rx + 22, ry + 18, 174, 24, '★ 彩蛋分支 · 另一种人生', '#1E293B', '#E2E8F0');
      drawText(ctx, '「谢谢老师，我想先回家陪陪家人」', rx + 22, ry + 70, { size: 18, bold: true, color: '#F8FAFC' });
      drawWrappedText(
        ctx,
        '你已经替这座城市与那群球迷踢完了所有硬仗。也许比起再一次背负胜负的重担，现在正是转身走进阳光与日常的最好时刻。',
        rx + 22,
        ry + 104,
        rw - 44,
        21,
        { size: 12.5, color: '#94A3B8', maxLines: 3 }
      );
      drawText(ctx, '解锁独立隐藏结局：《功成身退 · 绿茵归隐》（全剧终）', rx + 22, ry + 180, { size: 11.5, color: THEME.GOLD_LIGHT });
      drawButton(ctx, hits, rx + 22, ry + rh - 58, rw - 44, 44, '婉拒邀约，挂靴体面归隐 ✦', () => {
        SoundEngine.playFanfare();
        actions.onDeclineSecretEnding();
        this.goStage(4);
      }, { variant: 'ghost', fontSize: 13.5 });
      this.drawStageTransition(ctx);
      return;
    }

    // ==================== Stage 4: 隐藏彩蛋体面结局 (夕阳海边咖啡馆全画幅演出) ====================
    const endArtId: ArtAssetId = 'prologue_05_retired_ending';
    const slowHorizontalPan = Math.sin(this.stageTime * 0.22) * 18;
    this.drawBackdropScene(ctx, endArtId, 0.16, {
      zoom: 1.05,
      panX: slowHorizontalPan,
      tintColor: 'rgba(251, 191, 36, 0.05)',
    });
    for (let i = 0; i < 30; i++) {
      const px = ((i * 113 + this.animTime * 16) % THEME.W);
      const py = ((i * 71 - this.animTime * 10) % THEME.H + THEME.H) % THEME.H;
      const a = 0.28 + 0.28 * Math.sin(this.animTime * 2 + i);
      ctx.fillStyle = `rgba(254, 240, 138, ${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const enterAlpha = easeOutCubic(Math.min(1, this.stageTime / 0.55));
    const slideOffset = (1 - easeOutBack(Math.min(1, this.stageTime / 0.55))) * 22;
    ctx.save();
    ctx.globalAlpha = enterAlpha;

    // 顶部左侧浮动荣誉落幕头衔，把黄金夕阳海景、球场、足球与袖标完整让给画面上半区
    drawBadge(ctx, 84, 34, 252, 28, '★ SECRET ENDING · 隐藏彩蛋结局', 'rgba(120, 53, 15, 0.90)', THEME.GOLD_LIGHT);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 14;
    drawText(ctx, '功成身退 · 绿茵归隐', 84, 96, { size: 34, bold: true, italic: true, color: '#FEF08A' });
    drawText(ctx, 'SOME LEGENDS KEEP FIGHTING — OTHERS KNOW WHEN TO TAKE A BOW', 84, 130, {
      size: 11.5,
      bold: true,
      color: '#FDE68A',
      mono: true,
    });
    ctx.restore();

    // 底部半透明磨砂玻璃终章卡片（y: 368..684，不遮挡老将背影与桌面足球/袖标/海岸夕阳）
    const px = 84, py = 368 + slideOffset, pw = 1112, ph = 316;
    drawChamferPanel(ctx, px, py, pw, ph, 14, 'rgba(8, 13, 24, 0.88)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);
    drawFoilShimmer(ctx, px, py, pw, ph, this.animTime * 0.55, 'rgba(250, 204, 21, 0.12)');

    drawChamferPanel(ctx, px + 26, py + 22, pw - 52, 128, 10, 'rgba(15, 23, 42, 0.78)', THEME.BORDER);
    drawWrappedText(
      ctx,
      '老恩师愣了三秒，随即爽朗地拍了拍你的肩膀：「也是，你小子早就替大家踢完所有硬仗了，好好过日子去。」你把那只印着汗渍的队长袖标轻轻放回替补席长椅，挥了挥手，头也不回地走出了清晨的雾气。\n三个月后，你在海边小城盘下一间能看见球场的咖啡馆。偶尔会有少年抱着踢旧的足球害羞地请前任传奇签名——你笑着签完，总会在最后添上一句：「开心最重要。」',
      px + 48,
      py + 46,
      pw - 96,
      24,
      { size: 13.5, color: THEME.TX1, maxLines: 4 }
    );

    const stats: Array<[string, string]> = [
      ['职业生涯出场', '612 场'],
      ['生涯正式进球', '218 粒'],
      ['终场绝杀谢幕', '90+2\''],
      ['彩蛋结局达成', '体面归隐 ✓'],
    ];
    stats.forEach(([lbl, val], si) => {
      const sx = px + 26 + si * 268;
      const sy = py + 164;
      drawRoundRect(ctx, sx, sy, 252, 62, 8, 'rgba(11, 17, 30, 0.90)', si === 3 ? THEME.GOLD_LIGHT : THEME.BORDER);
      drawText(ctx, lbl, sx + 126, sy + 18, { size: 11, color: THEME.TX2, align: 'center' });
      drawText(ctx, val, sx + 126, sy + 42, { size: 16.5, bold: true, color: si === 3 ? THEME.GOLD_LIGHT : THEME.TX1, align: 'center' });
    });

    drawText(ctx, '—— THE END · 感谢游玩，你的传奇已体面落幕 ——', 640, py + 244, {
      size: 13,
      bold: true,
      color: '#FEF08A',
      align: 'center',
    });

    drawButton(ctx, hits, px + 26, py + ph - 58, 340, 44, '结束游戏 · 返回主界面', () => {
      SoundEngine.playClick();
      actions.onReturnTitle();
    }, { variant: 'gold', fontSize: 14, icon: 'home' });
    drawButton(ctx, hits, px + pw - 396, py + ph - 58, 370, 44, '回心转意：接过家乡教鞭 ▶', () => {
      SoundEngine.playGoalCheer();
      actions.onAcceptHometown();
    }, { variant: 'ghost', fontSize: 13.5 });
    ctx.restore();
    this.drawStageTransition(ctx);
  }
}
