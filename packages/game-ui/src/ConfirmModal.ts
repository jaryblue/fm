/**
 * 轻量二次确认弹窗（用于重开赛季、一键补齐等不可逆操作防误触）
 */

import { ButtonVariant, drawButton, drawRoundRect, drawText, drawWrappedText, HitRegistry } from './CanvasKit';
import { THEME } from './Theme';

export class ConfirmModal {
  private visible = false;
  private title = '';
  private message = '';
  private confirmLabel = '确认';
  private onConfirm: (() => void) | null = null;
  private variant: ButtonVariant = 'danger';

  public isOpen(): boolean {
    return this.visible;
  }

  public open(
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = '确认继续',
    variant: ButtonVariant = 'danger'
  ): void {
    this.visible = true;
    this.variant = variant;
    this.title = title;
    this.message = message;
    this.confirmLabel = confirmLabel;
    this.onConfirm = onConfirm;
  }

  public close(): void {
    this.visible = false;
    this.onConfirm = null;
  }

  public render(ctx: CanvasRenderingContext2D, hits: HitRegistry): void {
    if (!this.visible) return;

    ctx.fillStyle = 'rgba(4, 7, 14, 0.72)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mw = 440;
    const mh = 210;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawRoundRect(ctx, mx, my, mw, mh, 12, THEME.BG_PANEL, THEME.BORDER_GOLD, 1.6);
    drawText(ctx, this.title, mx + 24, my + 34, {
      size: 18,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawWrappedText(ctx, this.message, mx + 24, my + 68, mw - 48, 22, {
      size: 13,
      color: THEME.TX2,
      maxLines: 3,
    });

    drawButton(ctx, hits, mx + 24, my + mh - 56, 184, 38, '取消', () => {
      this.close();
    }, { variant: 'ghost', fontSize: 13 });

    drawButton(ctx, hits, mx + mw - 208, my + mh - 56, 184, 38, this.confirmLabel, () => {
      const cb = this.onConfirm;
      this.close();
      if (cb) cb();
    }, { variant: this.variant, fontSize: 13 });
  }
}
