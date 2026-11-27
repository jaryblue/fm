/**
 * 多存档槽位管理弹窗（3 档独立存档：展示俱乐部/赛季/轮次/元点数，支持切换与删除）
 */

import { drawBadge, drawButton, drawChamferPanel, drawRoundRect, drawText, HitRegistry } from './CanvasKit';
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

    ctx.fillStyle = 'rgba(4, 7, 14, 0.80)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mw = 640;
    const mh = 420;
    const mx = (THEME.W - mw) / 2;
    const my = (THEME.H - mh) / 2;

    drawChamferPanel(ctx, mx, my, mw, mh, 14, THEME.BG_PANEL, THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);
    drawText(ctx, '存档位管理', mx + 28, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '支持 3 档本地独立生涯存档，切换后立即生效', mx + 148, my + 34, { size: 12, color: THEME.TX2 });
    drawButton(ctx, hits, mx + mw - 96, my + 18, 72, 30, '关闭', () => {
      this.close();
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    const activeSlot = opts.platform.getActiveSlotId?.() ?? 'slot_1';
    const rawSlots = opts.platform.listSaveSlots?.() ?? [
      { slotId: 'slot_1', raw: opts.platform.loadSave('fm_league_save_v1') },
    ];

    rawSlots.slice(0, 3).forEach((entry, i) => {
      const info = parseSlotSummary(entry.slotId, i, entry.raw);
      const isActive = info.slotId === activeSlot;
      const cy = my + 74 + i * 106;
      const cx = mx + 24;
      const cw = mw - 48;
      const ch = 92;

      drawChamferPanel(
        ctx,
        cx,
        cy,
        cw,
        ch,
        10,
        isActive ? 'rgba(20, 36, 66, 0.96)' : THEME.BG_CARD,
        isActive ? THEME.GOLD_LIGHT : THEME.BORDER,
        isActive ? 1.8 : 1
      );

      drawBadge(
        ctx,
        cx + 16,
        cy + 14,
        74,
        22,
        info.label,
        isActive ? '#78350F' : '#1E293B',
        isActive ? '#FEF08A' : THEME.TX2
      );
      if (isActive) {
        drawBadge(ctx, cx + 98, cy + 14, 72, 22, '当前使用', '#14532D', THEME.GREEN);
      }

      if (info.isEmpty) {
        drawText(ctx, info.clubName, cx + 16, cy + 58, { size: 16, bold: true, color: THEME.TX2 });
        drawText(ctx, info.phaseText, cx + 120, cy + 58, { size: 12, color: THEME.TX3 });
      } else {
        drawText(ctx, `S${info.seasonNumber} · ${info.clubName}`, cx + 16, cy + 58, {
          size: 16,
          bold: true,
          color: isActive ? THEME.GOLD_LIGHT : THEME.TX1,
        });
        drawText(ctx, `${info.phaseText} · 阵容 ${info.squadCount}人 · 天赋 ${info.metaPoints}pt`, cx + 220, cy + 58, {
          size: 12,
          color: '#7DD3FC',
        });
      }

      if (!isActive) {
        drawButton(ctx, hits, cx + cw - 196, cy + 27, 102, 36, info.isEmpty ? '新建到此' : '切换载入', () => {
          SoundEngine.playClick();
          this.close();
          opts.onSelectSlot(info.slotId);
        }, { variant: info.isEmpty ? 'primary' : 'gold', fontSize: 12 });
      }
      if (!info.isEmpty) {
        drawButton(ctx, hits, cx + cw - 84, cy + 27, 70, 36, '删除', () => {
          opts.onDeleteSlot(info.slotId, info.label);
        }, { variant: 'danger', fontSize: 12 });
      }
    });
  }
}
