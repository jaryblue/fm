/**
 * 桌面端设置弹窗：BGM / SFX 独立音量滑条、音频模式、全屏/窗口切换、快捷键说明与退出游戏
 */

import { drawBadge, drawButton, drawChamferPanel, drawRoundRect, drawText, HitRegistry } from './CanvasKit';
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

    ctx.fillStyle = 'rgba(4, 7, 14, 0.80)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mw = 560;
    const mh = 438;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawChamferPanel(ctx, mx, my, mw, mh, 14, THEME.BG_PANEL, THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);
    drawText(ctx, '游戏设置', mx + 28, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    drawButton(ctx, hits, mx + mw - 96, my + 18, 72, 30, '关闭', () => {
      this.close();
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    // 1. 音频总模式
    const modes: Array<[AudioMode, string]> = [
      ['all', '全开'],
      ['sfx_only', '仅音效'],
      ['muted', '静音'],
    ];
    drawText(ctx, '音频模式', mx + 28, my + 84, { size: 13.5, bold: true, color: THEME.TX1 });
    modes.forEach(([m, label], idx) => {
      drawButton(ctx, hits, mx + 136 + idx * 124, my + 68, 114, 32, label, () => {
        SoundEngine.setAudioMode(m);
        if (m !== 'muted') SoundEngine.playClick();
        cb.onPersistSettings();
      }, { active: SoundEngine.audioMode === m, variant: SoundEngine.audioMode === m ? 'gold' : 'ghost', fontSize: 12 });
    });

    // 2. BGM 音量滑条
    const barX = mx + 72;
    const barW = 416;
    const bgmVol = SoundEngine.getBgmVolume();
    const sfxVol = SoundEngine.getSfxVolume();

    drawText(ctx, '背景音乐 (BGM)', mx + 28, my + 128, { size: 13, bold: true, color: THEME.TX1 });
    drawText(ctx, `${Math.round(bgmVol * 100)}%`, mx + mw - 28, my + 128, {
      size: 13,
      bold: true,
      color: THEME.GOLD_LIGHT,
      align: 'right',
      mono: true,
    });
    drawRoundRect(ctx, barX, my + 148, barW, 12, 6, '#0B111E', THEME.BORDER);
    if (bgmVol > 0) {
      drawRoundRect(ctx, barX, my + 148, Math.max(12, barW * bgmVol), 12, 6, THEME.GOLD_LIGHT);
    }
    const bgmKnobX = barX + barW * bgmVol;
    drawRoundRect(ctx, bgmKnobX - 9, my + 144, 18, 20, 6, '#FEF08A', '#090D16', 1.5);
    hits.addTouchTarget(barX - 10, my + 138, barW + 20, 32, () => {
      this.draggingSlider = 'bgm';
      this.applySliderAt('bgm', hits.hoverX, barX, barW, cb.onPersistSettings);
    });

    // 3. SFX / 现场氛围音量滑条
    drawText(ctx, '音效与现场声浪 (SFX)', mx + 28, my + 190, { size: 13, bold: true, color: THEME.TX1 });
    drawText(ctx, `${Math.round(sfxVol * 100)}%`, mx + mw - 28, my + 190, {
      size: 13,
      bold: true,
      color: '#38BDF8',
      align: 'right',
      mono: true,
    });
    drawRoundRect(ctx, barX, my + 210, barW, 12, 6, '#0B111E', THEME.BORDER);
    if (sfxVol > 0) {
      drawRoundRect(ctx, barX, my + 210, Math.max(12, barW * sfxVol), 12, 6, '#38BDF8');
    }
    const sfxKnobX = barX + barW * sfxVol;
    drawRoundRect(ctx, sfxKnobX - 9, my + 206, 18, 20, 6, '#7DD3FC', '#090D16', 1.5);
    hits.addTouchTarget(barX - 10, my + 200, barW + 20, 32, () => {
      this.draggingSlider = 'sfx';
      this.applySliderAt('sfx', hits.hoverX, barX, barW, cb.onPersistSettings);
      SoundEngine.playClick();
    });

    // 4. 显示模式（全屏 / 窗口）
    const isFs = cb.platform.isFullscreen?.() ?? false;
    drawText(ctx, '显示模式', mx + 28, my + 264, { size: 13.5, bold: true, color: THEME.TX1 });
    drawBadge(ctx, mx + 136, my + 253, 120, 24, isFs ? '当前：全屏模式' : '当前：窗口模式', '#0F172A', isFs ? THEME.GREEN : '#7DD3FC');
    if (cb.platform.toggleFullscreen) {
      drawButton(ctx, hits, mx + 272, my + 248, 260, 34, isFs ? '切换为窗口模式 (F11)' : '切换为全屏模式 (F11)', () => {
        cb.platform.toggleFullscreen!();
        SoundEngine.playClick();
      }, { variant: 'primary', fontSize: 12 });
    }

    // 5. 快捷键速查
    drawRoundRect(ctx, mx + 28, my + 298, mw - 56, 72, 8, 'rgba(11, 17, 30, 0.85)', THEME.BORDER);
    drawText(ctx, '桌面端快捷键', mx + 44, my + 314, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, 'Space：暂停/继续   |   1-4：1x-8x 倍速   |   F：主动技', mx + 44, my + 340, {
      size: 11,
      color: THEME.TX2,
    });

    // 6. 底部按钮（退出游戏 + 保存返回）
    if (cb.platform.quitApp && cb.onRequestQuit) {
      drawButton(ctx, hits, mx + 28, my + mh - 56, 150, 38, '退出游戏', () => {
        cb.onRequestQuit!();
      }, { variant: 'danger', fontSize: 13 });
    }
    drawButton(ctx, hits, mx + mw - 188, my + mh - 56, 160, 38, '完成', () => {
      this.close();
      SoundEngine.playClick();
    }, { variant: 'gold', fontSize: 13 });
  }
}
