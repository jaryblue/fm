/**
 * 多存档槽位管理弹窗（PITCH PRINT 档案馆文件夹槽位）
 */

import { drawBadge, drawButton, drawPrintCard, drawText, HitRegistry } from './CanvasKit';
import { PlatformAdapter } from './Platform';
import { SoundEngine } from './SoundEngine';
import { THEME } from './Theme';

interface ParsedSlotSummary {
  slotId: string;
  label: string;
  isEmpty: boolean;
  clubName: string;
  seasonNumber: number;
  phaseText: string;
  metaPoints: number;
  squadCount: number;
}

const PHASE_LABEL: Record<string, string> = {
  INIT_DRAFT: '核心开包',
  SUMMER_WINDOW: '夏窗备战',
  REGULAR_SEASON: '常规赛',
  WINTER_WINDOW: '冬窗调整',
  RE_DRAFT: '赛后补强',
  PLAYOFF_SEMI: '季后赛半决赛',
  PLAYOFF_FINAL: '季后赛决赛',
  SEASON_END: '赛季结算',
};

function parseSlotSummary(slotId: string, idx: number, raw: string | null): ParsedSlotSummary {
  const label = `存档位 ${idx + 1}`;
  if (!raw) {
    return {
      slotId,
      label,
      isEmpty: true,
      clubName: '空存档位',
      seasonNumber: 0,
      phaseText: '可开启全新执教生涯',
      metaPoints: 0,
      squadCount: 0,
    };
  }
  try {
    const obj = JSON.parse(raw) as {
      seasonNumber?: number;
      currentRound?: number;
      phase?: string;
      metaPointsTotal?: number;
      userClubId?: string;
      clubs?: Array<{ id?: string; name?: string; squad?: unknown[] }>;
    };
    const uc = obj.clubs?.find(c => c.id === obj.userClubId);
    const phaseName = PHASE_LABEL[obj.phase ?? ''] ?? '进行中';
    const roundTxt = obj.phase === 'REGULAR_SEASON' && obj.currentRound ? ` 第${obj.currentRound}轮` : '';
    return {
      slotId,
      label,
      isEmpty: false,
      clubName: uc?.name || '新建俱乐部',
      seasonNumber: obj.seasonNumber ?? 1,
      phaseText: `${phaseName}${roundTxt}`,
      metaPoints: obj.metaPointsTotal ?? 0,
      squadCount: uc?.squad?.length ?? 0,
    };
  } catch {
    return {
      slotId,
      label,
      isEmpty: true,
      clubName: '存档数据损坏',
      seasonNumber: 0,
      phaseText: '可覆盖重建',
      metaPoints: 0,
      squadCount: 0,
    };
  }
}

export class SaveSlotModal {
  private visible = false;

  public isOpen(): boolean {
    return this.visible;
  }

  public open(): void {
    this.visible = true;
  }

  public close(): void {
    this.visible = false;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    opts: {
      platform: PlatformAdapter;
      onSelectSlot: (slotId: string) => void;
      onDeleteSlot: (slotId: string, label: string) => void;
    }
  ): void {
    if (!this.visible) return;

    ctx.fillStyle = 'rgba(7, 16, 12, 0.84)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mw = 660;
    const mh = 436;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawPrintCard(ctx, mx, my, mw, mh, {
      paper: false,
      radius: 12,
      shadowOffset: 6,
      strokeColor: THEME.BORDER_GOLD,
      lineWidth: 2,
    });
    drawText(ctx, '存档位管理', mx + 28, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '支持 3 档本地独立生涯存档，切换后立即生效', mx + 148, my + 34, { size: 12.5, color: THEME.TX2 });
    drawButton(ctx, hits, mx + mw - 102, my + 16, 78, 36, '关闭', () => {
      this.close();
    }, { variant: 'ghost', fontSize: 12.5, icon: 'close' });

    const activeSlot = opts.platform.getActiveSlotId?.() ?? 'slot_1';
    const rawSlots = opts.platform.listSaveSlots?.() ?? [
      { slotId: 'slot_1', raw: opts.platform.loadSave('fm_league_save_v1') },
    ];

    rawSlots.slice(0, 3).forEach((entry, i) => {
      const info = parseSlotSummary(entry.slotId, i, entry.raw);
      const isActive = info.slotId === activeSlot;
      const cy = my + 74 + i * 112;
      const cx = mx + 24;
      const cw = mw - 48;
      const ch = 98;

      drawPrintCard(ctx, cx, cy, cw, ch, {
        paper: true,
        radius: 8,
        shadowOffset: isActive ? 5 : 3,
        strokeColor: isActive ? THEME.LIME : THEME.INK_LINE,
        lineWidth: isActive ? 2.2 : 1.5,
      });

      drawBadge(
        ctx,
        cx + 16,
        cy + 14,
        78,
        24,
        info.label,
        isActive ? THEME.BG_PANEL : '#E7DEC9',
        isActive ? THEME.GOLD_LIGHT : THEME.PAPER_INK
      );
      if (isActive) {
        drawBadge(ctx, cx + 102, cy + 14, 78, 24, '当前使用', '#166534', THEME.LIME);
      }

      if (info.isEmpty) {
        drawText(ctx, info.clubName, cx + 16, cy + 62, { size: 16, bold: true, color: THEME.PAPER_INK });
        drawText(ctx, info.phaseText, cx + 124, cy + 62, { size: 13, color: THEME.PAPER_MUTED });
      } else {
        drawText(ctx, `S${info.seasonNumber} · ${info.clubName}`, cx + 16, cy + 54, {
          size: 16,
          bold: true,
          color: THEME.PAPER_INK,
        });
        drawText(ctx, `${info.phaseText} · 阵容 ${info.squadCount}人 · 天赋 ${info.metaPoints}pt`, cx + 16, cy + 78, {
          size: 12.5,
          color: THEME.PAPER_MUTED,
        });
      }

      if (!isActive) {
        drawButton(ctx, hits, cx + cw - 204, cy + 27, 108, 44, info.isEmpty ? '新建到此' : '切换载入', () => {
          SoundEngine.playClick();
          this.close();
          opts.onSelectSlot(info.slotId);
        }, { variant: info.isEmpty ? 'primary' : 'gold', fontSize: 12.5 });
      }
      if (!info.isEmpty) {
        drawButton(ctx, hits, cx + cw - 86, cy + 27, 72, 44, '删除', () => {
          opts.onDeleteSlot(info.slotId, info.label);
        }, { variant: 'danger', fontSize: 12.5 });
      }
    });
  }
}
