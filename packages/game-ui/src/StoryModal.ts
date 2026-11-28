/**
 * 赛季故事线开局简报与第 3 / 5 轮中期 2 选 1 剧情抉择弹窗（PITCH PRINT 暖纸剧本卡）
 */

import { LeagueManager } from '../../core/src/LeagueManager';
import { ArtAssetId, AssetLoader } from './AssetLoader';
import {
  drawBadge,
  drawButton,
  drawPrintCard,
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

    ctx.fillStyle = 'rgba(7, 16, 12, 0.86)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.add(0, 0, THEME.W, THEME.H, () => {});

    const mw = 840;
    const mh = ev.kind === 'briefing' ? 420 : 500;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawPrintCard(ctx, mx, my, mw, mh, {
      paper: true,
      topBandColor: THEME.BG_PANEL,
      radius: 12,
      shadowOffset: 6,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawBadge(ctx, mx + 28, my + 24, 224, 24, ev.badge, THEME.BG_DEEP, THEME.LIME);
    drawText(ctx, ev.title, mx + 28, my + 68, {
      size: 22,
      bold: true,
      color: THEME.PAPER_INK,
    });

    const storyId = st.storyline?.id || 'underdog';
    const artKey = (ev.artId || `story_${storyId}`) as ArtAssetId;
    const artImg = AssetLoader.get(artKey);
    const ix = mx + 28;
    const iy = my + 96;
    const iw = 256;
    const ih = 152;
    drawPrintCard(ctx, ix, iy, iw, ih, {
      paper: false,
      radius: 8,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
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
    drawPrintCard(ctx, bx, iy, bw, ih, {
      paper: false,
      radius: 8,
      shadowOffset: 3,
      topBandColor: THEME.BRASS,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawWrappedText(ctx, ev.body, bx + 18, iy + 24, bw - 36, 24, {
      size: 14.5,
      color: THEME.PAPER_CREAM,
      maxLines: 5,
    });

    if (ev.kind === 'briefing') {
      const opt = ev.options[0];
      drawText(ctx, `赛季被动：${opt.effectDesc}`, mx + mw / 2, my + 294, {
        size: 14,
        bold: true,
        color: '#166534',
        align: 'center',
      });
      drawButton(ctx, hits, mx + (mw - 310) / 2, my + 336, 310, 48, opt.label, () => {
        league.resolveStoryEvent(opt.id);
        onResolved();
      }, { variant: 'gold', fontSize: 15 });
    } else {
      ev.options.forEach((opt, idx) => {
        const cw = (mw - 76) / 2;
        const cx = mx + 28 + idx * (cw + 20);
        const cy = my + 280;
        drawPrintCard(ctx, cx, cy, cw, 192, {
          paper: false,
          radius: 10,
          shadowOffset: 4,
          strokeColor: idx === 0 ? THEME.GOLD_LIGHT : THEME.BORDER,
          lineWidth: 1.6,
        });
        drawText(ctx, `选项 ${idx === 0 ? 'A' : 'B'}`, cx + 18, cy + 24, {
          size: 13,
          bold: true,
          color: THEME.GOLD_LIGHT,
        });
        drawText(ctx, opt.label, cx + 18, cy + 54, {
          size: 16,
          bold: true,
          color: THEME.PAPER_CREAM,
        });
        drawWrappedText(ctx, `效果：${opt.effectDesc}`, cx + 18, cy + 82, cw - 36, 20, {
          size: 13,
          color: THEME.LIME,
          maxLines: 2,
        });
        drawButton(ctx, hits, cx + 18, cy + 134, cw - 36, 44, '选择此方案', () => {
          league.resolveStoryEvent(opt.id);
          onResolved();
        }, { variant: idx === 0 ? 'gold' : 'primary', fontSize: 13.5 });
        hits.addTouchTarget(cx, cy, cw, 192, () => {
          league.resolveStoryEvent(opt.id);
          onResolved();
        });
      });
    }
  }
}
