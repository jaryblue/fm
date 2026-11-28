/**
 * 桌面端设置弹窗（PITCH PRINT 风格：BGM / SFX 音量滑条 >=44px 热区、显示模式与双行快捷键）
 */

import { drawBadge, drawButton, drawPrintCard, drawRoundRect, drawText, HitRegistry } from './CanvasKit';
import { PlatformAdapter } from './Platform';
import { AudioMode, SoundEngine } from './SoundEngine';
import { THEME } from './Theme';

export interface SettingsCallbacks {
  platform: PlatformAdapter;
  onPersistSettings: () => void;
  onRequestQuit?: () => void;
}

export class SettingsModal {
  private visible = false;
  private draggingSlider: 'bgm' | 'sfx' | null = null;

  public isOpen(): boolean {
    return this.visible;
  }

  public open(): void {
    this.visible = true;
    this.draggingSlider = null;
  }

  public close(): void {
    this.visible = false;
    this.draggingSlider = null;
  }

  private applySliderAt(kind: 'bgm' | 'sfx', x: number, barX: number, barW: number, onPersist: () => void): void {
    const ratio = Math.max(0, Math.min(1, (x - barX) / barW));
    const snapped = Math.round(ratio * 20) / 20;
    if (kind === 'bgm') {
      SoundEngine.setBgmVolume(snapped);
    } else {
      SoundEngine.setSfxVolume(snapped);
    }
    onPersist();
  }

  public onPointerMove(x: number, _y: number, onPersist: () => void): void {
    if (!this.visible || !this.draggingSlider) return;
    const barX = 432;
    const barW = 416;
    this.applySliderAt(this.draggingSlider, x, barX, barW, onPersist);
  }

  public onPointerUp(): void {
    if (this.draggingSlider === 'sfx') {
      SoundEngine.playClick();
    }
    this.draggingSlider = null;
  }

  public render(ctx: CanvasRenderingContext2D, hits: HitRegistry, cb: SettingsCallbacks): void {
    if (!this.visible) return;

    ctx.fillStyle = 'rgba(7, 16, 12, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mw = 560;
    const mh = 468;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawPrintCard(ctx, mx, my, mw, mh, {
      paper: false,
      radius: 12,
      shadowOffset: 6,
      strokeColor: THEME.BORDER_GOLD,
      lineWidth: 2,
    });
    drawText(ctx, '游戏设置', mx + 28, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, mx + mw - 102, my + 16, 78, 36, '关闭', () => {
      this.close();
    }, { variant: 'ghost', fontSize: 12.5, icon: 'close' });

    const modes: Array<[AudioMode, string]> = [
      ['all', '全开'],
      ['sfx_only', '仅音效'],
      ['muted', '静音'],
    ];
    drawText(ctx, '音频模式', mx + 28, my + 84, { size: 14, bold: true, color: THEME.TX1 });
    modes.forEach(([m, label], idx) => {
      drawButton(ctx, hits, mx + 136 + idx * 124, my + 66, 114, 36, label, () => {
        SoundEngine.setAudioMode(m);
        if (m !== 'muted') SoundEngine.playClick();
        cb.onPersistSettings();
      }, { active: SoundEngine.audioMode === m, variant: SoundEngine.audioMode === m ? 'gold' : 'ghost', fontSize: 12.5 });
    });

    const barX = mx + 72;
    const barW = 416;
    const bgmVol = SoundEngine.getBgmVolume();
    const sfxVol = SoundEngine.getSfxVolume();

    drawText(ctx, '背景音乐 (BGM)', mx + 28, my + 128, { size: 14, bold: true, color: THEME.TX1 });
    drawText(ctx, `${Math.round(bgmVol * 100)}%`, mx + mw - 28, my + 128, {
      size: 14,
      bold: true,
      color: THEME.GOLD_LIGHT,
      align: 'right',
      mono: true,
    });
    drawRoundRect(ctx, barX, my + 148, barW, 12, 6, THEME.BG_DEEP, THEME.BORDER);
    if (bgmVol > 0) {
      drawRoundRect(ctx, barX, my + 148, Math.max(12, barW * bgmVol), 12, 6, THEME.GOLD_LIGHT);
    }
    const bgmKnobX = barX + barW * bgmVol;
    drawRoundRect(ctx, bgmKnobX - 10, my + 143, 20, 22, 6, THEME.GOLD_HOT, THEME.INK_LINE, 1.8);
    hits.addTouchTarget(barX - 12, my + 132, barW + 24, 44, () => {
      this.draggingSlider = 'bgm';
      this.applySliderAt('bgm', hits.hoverX, barX, barW, cb.onPersistSettings);
    });

    drawText(ctx, '音效与现场声浪 (SFX)', mx + 28, my + 194, { size: 14, bold: true, color: THEME.TX1 });
    drawText(ctx, `${Math.round(sfxVol * 100)}%`, mx + mw - 28, my + 194, {
      size: 14,
      bold: true,
      color: THEME.LIME,
      align: 'right',
      mono: true,
    });
    drawRoundRect(ctx, barX, my + 214, barW, 12, 6, THEME.BG_DEEP, THEME.BORDER);
    if (sfxVol > 0) {
      drawRoundRect(ctx, barX, my + 214, Math.max(12, barW * sfxVol), 12, 6, THEME.LIME);
    }
    const sfxKnobX = barX + barW * sfxVol;
    drawRoundRect(ctx, sfxKnobX - 10, my + 209, 20, 22, 6, THEME.LIME, THEME.INK_LINE, 1.8);
    hits.addTouchTarget(barX - 12, my + 198, barW + 24, 44, () => {
      this.draggingSlider = 'sfx';
      this.applySliderAt('sfx', hits.hoverX, barX, barW, cb.onPersistSettings);
      SoundEngine.playClick();
    });

    const isFs = cb.platform.isFullscreen?.() ?? false;
    drawText(ctx, '显示模式', mx + 28, my + 268, { size: 14, bold: true, color: THEME.TX1 });
    drawBadge(ctx, mx + 136, my + 256, 124, 26, isFs ? '当前：全屏模式' : '当前：窗口模式', THEME.BG_DEEP, isFs ? THEME.LIME : THEME.GOLD_LIGHT);
    if (cb.platform.toggleFullscreen) {
      drawButton(ctx, hits, mx + 272, my + 250, 260, 38, isFs ? '切换为窗口模式 (F11)' : '切换为全屏模式 (F11)', () => {
        cb.platform.toggleFullscreen!();
        SoundEngine.playClick();
      }, { variant: 'primary', fontSize: 12.5 });
    }

    drawPrintCard(ctx, mx + 28, my + 302, mw - 56, 84, {
      paper: true,
      radius: 8,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 1.5,
    });
    drawText(ctx, '桌面端快捷键', mx + 44, my + 322, { size: 13.5, bold: true, color: THEME.PAPER_INK });
    drawText(ctx, 'Space：暂停 / 继续比赛    |    1 ~ 4：切换 1x ~ 8x 倍速', mx + 44, my + 348, {
      size: 12.5,
      color: THEME.PAPER_MUTED,
    });
    drawText(ctx, 'F1 ~ F4：释放绝技    |    F11：全屏切换    |    ESC：关闭浮层', mx + 44, my + 370, {
      size: 12.5,
      color: THEME.PAPER_MUTED,
    });

    if (cb.platform.quitApp && cb.onRequestQuit) {
      drawButton(ctx, hits, mx + 28, my + mh - 62, 156, 44, '退出游戏', () => {
        cb.onRequestQuit!();
      }, { variant: 'danger', fontSize: 13.5 });
    }
    drawButton(ctx, hits, mx + mw - 194, my + mh - 62, 166, 44, '完成', () => {
      this.close();
      SoundEngine.playClick();
    }, { variant: 'gold', fontSize: 13.5 });
  }
}
