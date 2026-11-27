/**
 * Canvas 内置文本输入弹窗（替代浏览器原生 window.prompt，支持中文 IME 输入法与键盘/鼠标操作）
 */

import { generateFictionalClubName } from '../../core/src/namePool';
import { drawButton, drawChamferPanel, drawRoundRect, drawText, HitRegistry } from './CanvasKit';
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

    ctx.fillStyle = 'rgba(4, 7, 14, 0.78)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mw = 480;
    const mh = 228;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawChamferPanel(ctx, mx, my, mw, mh, 14, THEME.BG_PANEL, THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);
    drawText(ctx, this.title, mx + 24, my + 32, {
      size: 18,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(ctx, '直接键盘输入（支持中文输入法），回车确认或 ESC 取消', mx + 24, my + 58, {
      size: 11.5,
      color: THEME.TX2,
    });

    // 输入框区域
    const ix = mx + 24;
    const iy = my + 82;
    const iw = mw - 48;
    const ih = 48;
    drawRoundRect(ctx, ix, iy, iw, ih, 8, '#0B111E', THEME.GOLD_LIGHT, 1.6);

    const display = this.value || '';
    drawText(ctx, display, ix + 16, iy + ih / 2, {
      size: 20,
      bold: true,
      color: THEME.TX1,
    });

    // 闪烁光标
    if (Math.floor(this.blinkTimer * 2.2) % 2 === 0) {
      ctx.save();
      ctx.font = `bold 20px ${THEME.FONT_FAMILY}`;
      const tw = ctx.measureText(display).width;
      ctx.fillStyle = THEME.GOLD_LIGHT;
      ctx.fillRect(ix + 18 + tw, iy + 12, 2, 24);
      ctx.restore();
    }

    drawText(ctx, `${this.value.length}/${this.maxLen}`, ix + iw - 14, iy + ih / 2, {
      size: 11,
      color: THEME.TX3,
      align: 'right',
      mono: true,
    });

    // 快捷按钮：随机队名 / 清空 / 取消 / 确认
    drawButton(ctx, hits, mx + 24, my + mh - 58, 108, 38, '随机队名', () => {
      this.value = generateFictionalClubName().slice(0, this.maxLen);
      SoundEngine.playClick();
    }, { variant: 'primary', fontSize: 12, icon: 'dice' });

    drawButton(ctx, hits, mx + 140, my + mh - 58, 72, 38, '清空', () => {
      this.value = '';
      SoundEngine.playClick();
    }, { variant: 'ghost', fontSize: 12 });

    drawButton(ctx, hits, mx + mw - 210, my + mh - 58, 86, 38, '取消', () => {
      this.close();
    }, { variant: 'ghost', fontSize: 12.5 });

    drawButton(ctx, hits, mx + mw - 114, my + mh - 58, 90, 38, '确认', () => {
      this.confirm();
    }, { variant: 'gold', fontSize: 13, disabled: this.value.trim().length === 0 });
  }
}
