/**
 * 赛季故事线开局简报与第 3 / 5 轮中期 2 选 1 剧情抉择弹窗
 * 接入统一暗调转播风自定义插画（外置新美术资源就绪时自动优先使用）
 */

import { LeagueManager } from '../../core/src/LeagueManager';
import { ArtAssetId, AssetLoader } from './AssetLoader';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawRoundRect,
  drawText,
  drawWrappedText,
  HitRegistry,
} from './CanvasKit';
import { drawStoryIllustration } from './SceneArt';
import { SoundEngine } from './SoundEngine';
import { THEME } from './Theme';

export class StoryModal {
  private lastEventId: string | null = null;

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    onResolved: () => void
  ): void {
    const st = league.getState();
    const ev = st.pendingStoryEvent;
    if (!ev) {
      this.lastEventId = null;
      return;
    }
    if (this.lastEventId !== ev.id) {
      this.lastEventId = ev.id;
      if (ev.chronicleId) SoundEngine.playChronicleChime();
      else SoundEngine.playRewardChime();
    }

    ctx.fillStyle = 'rgba(4, 7, 13, 0.82)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.add(0, 0, THEME.W, THEME.H, () => {});

    const mw = 820;
    const mh = ev.kind === 'briefing' ? 400 : 480;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(14, 22, 40, 0.98)', THEME.BORDER_GOLD, 1.8, THEME.GOLD_LIGHT);
    drawBadge(ctx, mx + 28, my + 24, 220, 24, ev.badge, '#312E81', '#C7D2FE');
    drawText(ctx, ev.title, mx + 28, my + 70, {
      size: 22,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });

    const storyId = st.storyline?.id || 'underdog';
    const artKey = (ev.artId || `story_${storyId}`) as ArtAssetId;
    const artImg = AssetLoader.get(artKey);
    const ix = mx + 28;
    const iy = my + 98;
    const iw = 256;
    const ih = 144;
    drawChamferPanel(ctx, ix, iy, iw, ih, 8, THEME.BG_CARD, THEME.BORDER_GOLD, 1.2);
    if (artImg && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ix + 2, iy + 2, iw - 4, ih - 4);
      ctx.clip();
      ctx.drawImage(artImg, ix + 2, iy + 2, iw - 4, ih - 4);
      ctx.restore();
    } else {
      drawStoryIllustration(ctx, storyId, ix + 2, iy + 2, iw - 4, ih - 4);
    }

    const bx = ix + iw + 18;
    const bw = mw - 56 - iw - 18;
    drawRoundRect(ctx, bx, iy, bw, ih, 10, THEME.BG_CARD, THEME.BORDER);
    drawWrappedText(ctx, ev.body, bx + 18, iy + 18, bw - 36, 22, {
      size: 14,
      color: THEME.TX1,
      maxLines: 4,
    });

    if (ev.kind === 'briefing') {
      const opt = ev.options[0];
      drawText(ctx, `赛季被动：${opt.effectDesc}`, mx + mw / 2, my + 276, {
        size: 13,
        bold: true,
        color: THEME.GREEN,
        align: 'center',
      });
      drawButton(ctx, hits, mx + (mw - 300) / 2, my + 318, 300, 46, opt.label, () => {
        league.resolveStoryEvent(opt.id);
        onResolved();
      }, { variant: 'gold', fontSize: 15 });
    } else {
      ev.options.forEach((opt, idx) => {
        const cw = (mw - 76) / 2;
        const cx = mx + 28 + idx * (cw + 20);
        const cy = my + 266;
        drawChamferPanel(ctx, cx, cy, cw, 180, 10, THEME.BG_CARD, THEME.BORDER_GOLD, 1.2);
        drawText(ctx, `选项 ${idx === 0 ? 'A' : 'B'}`, cx + 18, cy + 24, {
          size: 12,
          bold: true,
          color: THEME.GOLD,
        });
        drawText(ctx, opt.label, cx + 18, cy + 52, {
          size: 16,
          bold: true,
          color: THEME.TX1,
        });
        drawWrappedText(ctx, `效果：${opt.effectDesc}`, cx + 18, cy + 78, cw - 36, 18, {
          size: 12,
          color: THEME.GREEN,
          maxLines: 2,
        });
        drawButton(ctx, hits, cx + 18, cy + 126, cw - 36, 36, '选择此方案', () => {
          league.resolveStoryEvent(opt.id);
          onResolved();
        }, { variant: idx === 0 ? 'gold' : 'primary', fontSize: 13 });
        // 整张选项卡片任意区域均可点击确认，防止只点文字无响应
        hits.add(cx, cy, cw, 180, () => {
          league.resolveStoryEvent(opt.id);
          onResolved();
        });
      });
    }
  }
}
