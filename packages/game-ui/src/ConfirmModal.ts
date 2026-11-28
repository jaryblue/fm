/**
 * 轻量二次确认弹窗（PITCH PRINT 暖纸通告卡 + 朱红顶栏）
 */

import { ButtonVariant, drawButton, drawPrintCard, drawText, drawWrappedText, HitRegistry } from './CanvasKit';
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

    ctx.fillStyle = 'rgba(7, 16, 12, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mw = 460;
    const mh = 236;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawPrintCard(ctx, mx, my, mw, mh, {
      paper: true,
      topBandColor: this.variant === 'danger' ? THEME.VERMILION : THEME.BG_PANEL,
      radius: 10,
      shadowOffset: 6,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawText(ctx, this.title, mx + 24, my + 50, {
      size: 19,
      bold: true,
      color: THEME.PAPER_INK,
    });
    drawWrappedText(ctx, this.message, mx + 24, my + 84, mw - 48, 22, {
      size: 14,
      color: THEME.PAPER_MUTED,
      maxLines: 3,
    });

    drawButton(ctx, hits, mx + 24, my + mh - 60, 194, 44, '取消', () => {
      this.close();
    }, { variant: 'ghost', fontSize: 13.5 });

    drawButton(ctx, hits, mx + mw - 218, my + mh - 60, 194, 44, this.confirmLabel, () => {
      const cb = this.onConfirm;
      this.close();
      if (cb) cb();
    }, { variant: this.variant, fontSize: 13.5 });
  }
}
