/**
 * Canvas 内置文本输入弹窗（PITCH PRINT 暖纸档案输入卡，支持中文 IME 与键盘/鼠标操作）
 */

import { generateFictionalClubName } from '../../core/src/namePool';
import { drawButton, drawPrintCard, drawRoundRect, drawText, HitRegistry } from './CanvasKit';
import { PlatformAdapter } from './Platform';
import { SoundEngine } from './SoundEngine';
import { THEME } from './Theme';

export class TextInputModal {
  private visible = false;
  private title = '';
  private value = '';
  private maxLen = 12;
  private onSubmit: ((val: string) => void) | null = null;
  private unbindIme: (() => void) | null = null;
  private blinkTimer = 0;

  public isOpen(): boolean {
    return this.visible;
  }

  public open(
    title: string,
    defaultValue: string,
    onSubmit: (val: string) => void,
    opts?: { maxLen?: number; platform?: PlatformAdapter }
  ): void {
    this.close();
    this.visible = true;
    this.title = title;
    this.maxLen = opts?.maxLen ?? 12;
    this.value = defaultValue.slice(0, this.maxLen);
    this.onSubmit = onSubmit;
    this.blinkTimer = 0;

    if (opts?.platform?.bindImeInput) {
      this.unbindIme = opts.platform.bindImeInput(
        this.value,
        this.maxLen,
        (next) => {
          this.value = next.slice(0, this.maxLen);
        },
        () => this.confirm(),
        () => this.close()
      );
    }
  }

  public close(): void {
    if (this.unbindIme) {
      this.unbindIme();
      this.unbindIme = null;
    }
    this.visible = false;
    this.onSubmit = null;
  }

  public confirm(): void {
    const trimmed = this.value.trim().slice(0, this.maxLen);
    const cb = this.onSubmit;
    this.close();
    if (trimmed && cb) {
      SoundEngine.playClick();
      cb(trimmed);
    }
  }

  public update(dtSec: number): void {
    if (!this.visible) return;
    this.blinkTimer += dtSec;
  }

  public onKeyDown(code: string, key?: string): boolean {
    if (!this.visible) return false;
    if (code === 'Escape') {
      this.close();
      return true;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
      this.confirm();
      return true;
    }
    if (code === 'Backspace') {
      this.value = this.value.slice(0, -1);
      return true;
    }
    if (key && key.length === 1 && key !== 'Process') {
      if (this.value.length < this.maxLen) {
        this.value += key;
      }
      return true;
    }
    return true;
  }

  public render(ctx: CanvasRenderingContext2D, hits: HitRegistry): void {
    if (!this.visible) return;

    ctx.fillStyle = 'rgba(7, 16, 12, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mw = 496;
    const mh = 248;
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
    drawText(ctx, this.title, mx + 24, my + 48, {
      size: 19,
      bold: true,
      color: THEME.PAPER_INK,
    });
    drawText(ctx, '直接键盘输入（支持中文），回车确认 / ESC 取消', mx + 24, my + 74, {
      size: 12.5,
      color: THEME.PAPER_MUTED,
    });

    const ix = mx + 24;
    const iy = my + 96;
    const iw = mw - 48;
    const ih = 50;
    drawRoundRect(ctx, ix, iy, iw, ih, 8, THEME.BG_DEEP, THEME.GOLD_LIGHT, 1.8);

    const display = this.value || '';
    drawText(ctx, display, ix + 16, iy + ih / 2, {
      size: 20,
      bold: true,
      color: THEME.PAPER_CREAM,
    });

    if (Math.floor(this.blinkTimer * 2.2) % 2 === 0) {
      ctx.save();
      ctx.font = `bold 20px ${THEME.FONT_FAMILY}`;
      const tw = ctx.measureText(display).width;
      ctx.fillStyle = THEME.LIME;
      ctx.fillRect(ix + 18 + tw, iy + 13, 2, 24);
      ctx.restore();
    }

    if (this.value.length > 0) {
      drawText(ctx, `${this.value.length}/${this.maxLen}`, ix + iw - 48, iy + ih / 2, {
        size: 12,
        color: THEME.TX2,
        align: 'right',
        mono: true,
      });
      drawButton(ctx, hits, ix + iw - 40, iy + 9, 32, 32, '×', () => {
        this.value = '';
        SoundEngine.playClick();
      }, { variant: 'ghost', fontSize: 15 });
    } else {
      drawText(ctx, `${this.value.length}/${this.maxLen}`, ix + iw - 14, iy + ih / 2, {
        size: 12,
        color: THEME.TX2,
        align: 'right',
        mono: true,
      });
    }

    drawButton(ctx, hits, mx + 24, my + mh - 62, 132, 44, '随机队名', () => {
      this.value = generateFictionalClubName().slice(0, this.maxLen);
      SoundEngine.playClick();
    }, { variant: 'primary', fontSize: 13, icon: 'dice' });

    drawButton(ctx, hits, mx + mw - 232, my + mh - 62, 96, 44, '取消', () => {
      this.close();
    }, { variant: 'ghost', fontSize: 13 });

    drawButton(ctx, hits, mx + mw - 124, my + mh - 62, 100, 44, '确认', () => {
      this.confirm();
    }, { variant: 'gold', fontSize: 13.5, disabled: this.value.trim().length === 0 });
  }
}
