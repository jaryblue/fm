/**
 * 历史荣誉室、成就里程碑（8项/页）与跨赛季俱乐部编年史档案（PITCH PRINT 风格）
 */

import { ACHIEVEMENTS } from '../../../core/src/Achievements';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { ArtAssetId, AssetLoader, getLeagueTierTrophyAssetId } from '../AssetLoader';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawFoilShimmer,
  drawNavRail,
  drawPrintCard,
  drawRoundRect,
  drawText,
  drawWrappedText,
  fitText,
  HitRegistry,
  NavRailTab,
} from '../CanvasKit';
import { drawTrophyIcon } from '../ClubVisuals';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon, IconName } from '../VectorIcons';

const ACH_VISUAL_MAP: Record<string, { art?: ArtAssetId; icon: IconName; tint: string }> = {
  ach_first_draft: { art: 'ach_first_draft', icon: 'sparkle', tint: THEME.GOLD_LIGHT },
  ach_first_win: { art: 'ach_first_win', icon: 'ball', tint: THEME.GOLD_LIGHT },
  ach_playoffs: { art: 'ach_playoffs', icon: 'bolt', tint: THEME.GOLD_LIGHT },
  ach_champion: { art: 'ach_champion', icon: 'trophy', tint: THEME.GOLD_LIGHT },
  ach_dynasty: { art: 'ach_dynasty', icon: 'star', tint: THEME.GOLD_LIGHT },
  ach_hattrick: { art: 'ach_hattrick', icon: 'ball', tint: THEME.GOLD_LIGHT },
  ach_clean_sheet: { art: 'ach_clean_sheet', icon: 'shield', tint: THEME.LIME },
  ach_craft_card: { art: 'ach_craft_card', icon: 'craft', tint: '#60A5FA' },
  ach_recipe_5: { art: 'ach_recipe_5', icon: 'card', tint: '#C084FC' },
  ach_hidden_trait: { art: 'ach_hidden_trait', icon: 'sparkle', tint: THEME.GOLD_HOT },
  ach_synergy: { art: 'ach_synergy', icon: 'bolt', tint: THEME.LIME },
  ach_meta_lv3: { art: 'ach_meta_lv3', icon: 'talent', tint: THEME.GOLD },
  ach_secret_retire: { icon: 'star', tint: THEME.GOLD_LIGHT },
  ach_skill_rank3: { icon: 'bolt', tint: '#60A5FA' },
  ach_skill_mutate: { icon: 'sparkle', tint: '#C084FC' },
  ach_fusion_power: { icon: 'craft', tint: THEME.GOLD },
  ach_lv4_card: { icon: 'card', tint: THEME.GOLD_LIGHT },
  ach_corrupted_win: { icon: 'bolt', tint: THEME.VERMILION },
  ach_win_streak_5: { icon: 'trophy', tint: THEME.LIME },
  ach_big_win: { icon: 'ball', tint: THEME.GOLD_LIGHT },
  ach_comeback_win: { icon: 'bolt', tint: THEME.LIME },
  ach_triple_synergy: { icon: 'link', tint: '#A78BFA' },
  ach_scout_master: { icon: 'sparkle', tint: '#60A5FA' },
  ach_top_tier: { icon: 'trophy', tint: THEME.GOLD_LIGHT },
};

export class HallOfFameScreen {
  private rightTab: 'achievements' | 'chronicles' = 'achievements';
  private achPage = 0;
  private chronPage = 0;
  private trophyShimmerUntil = 0;

  public onWheel(deltaY: number): boolean {
    if (this.rightTab === 'achievements') {
      const totalPages = Math.max(1, Math.ceil(ACHIEVEMENTS.length / 8));
      this.achPage = Math.max(0, Math.min(totalPages - 1, this.achPage + (deltaY > 0 ? 1 : -1)));
      return true;
    }
    this.chronPage = Math.max(0, this.chronPage + (deltaY > 0 ? 1 : -1));
    return true;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    onBack: () => void,
    onNavigate?: (tab: NavRailTab) => void
  ): void {
    const st = league.getState();
    const hof = league.getHallOfFame();
    const tierInfo = league.getCurrentTierInfo();
    const unlockedSet = new Set(hof.unlockedAchievements);
    const chronicles = league.getChronicles();
    const completedChronCount = chronicles.filter(c => c.status === 'completed').length;
    const activeChronicles = chronicles.filter(c => c.status === 'active');
    const hasRail = !!onNavigate;

    drawBroadcastHeader(ctx, hits, {
      kicker: 'HALL OF FAME · CAREER MILESTONES',
      title: '历史荣誉室与编年史',
      club: hasRail ? league.getUserClub() : undefined,
      onBack: hasRail ? undefined : onBack,
      badge: `成就 ${unlockedSet.size}/${ACHIEVEMENTS.length} · 编年史已完成 ${completedChronCount}/${chronicles.length}`,
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
    });

    if (onNavigate) {
      drawNavRail(ctx, hits, 'hof', onNavigate);
    }

    const lx = hasRail ? 96 : 16;
    const lw = hasRail ? 420 : 460;
    drawPrintCard(ctx, lx, 80, lw, 624, {
      paper: false,
      radius: 12,
      shadowOffset: 5,
      topBandColor: THEME.BRASS,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });

    const wonTiers = new Set<number>();
    let bestWonTier = 7;
    for (const rec of hof.records) {
      if (rec.isChampion) {
        const t = rec.tier ?? 7;
        wonTiers.add(t);
        if (t < bestWonTier) bestWonTier = t;
      }
    }

    // 顶部执教生涯徽章框（矢量奖杯 + 铜牌印章感）
    drawPrintCard(ctx, lx + 20, 94, 52, 48, {
      paper: true,
      radius: 8,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    drawTrophyIcon(ctx, lx + 46, 118, 28);
    if (performance.now() < this.trophyShimmerUntil) {
      drawFoilShimmer(ctx, lx + 18, 92, 56, 52, performance.now() / 320, 'rgba(231, 194, 102, 0.45)');
    }
    hits.addTouchTarget(lx + 20, 92, 56, 52, () => {
      SoundEngine.playRewardChime();
      this.trophyShimmerUntil = performance.now() + 1200;
    });

    drawText(ctx, '执教生涯荣誉档案', lx + 84, 110, { size: 17, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `当前第 ${st.seasonNumber} 赛季 · ${tierInfo.name}`, lx + 84, 132, { size: 12, color: THEME.TX2 });

    const statW = Math.floor((lw - 52) / 2);
    const statCards: Array<[string, string, string]> = [
      ['执教赛季', `${hof.seasonsPlayed}`, THEME.BRASS],
      ['夺冠次数', `${hof.championships}`, THEME.VERMILION],
      ['累计胜场', `${hof.totalWins}`, THEME.LIME],
      ['累计进球', `${hof.totalGoals}`, THEME.COBALT],
    ];
    statCards.forEach(([label, val, accent], i) => {
      const cx = lx + 20 + (i % 2) * (statW + 12);
      const cy = 152 + Math.floor(i / 2) * 62;
      drawPrintCard(ctx, cx, cy, statW, 54, {
        paper: true,
        radius: 8,
        shadowOffset: 3,
        topBandColor: accent,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2,
      });
      drawText(ctx, label, cx + 14, cy + 20, { size: 12, bold: true, color: THEME.PAPER_MUTED });
      drawText(ctx, val, cx + statW - 14, cy + 36, { size: 22, bold: true, italic: true, color: THEME.PAPER_INK, align: 'right', mono: true });
    });

    // 7 级联赛专属冠军奖杯陈列架（T7 业余 -> T1 超级）
    drawText(ctx, `联赛奖杯陈列架 (${wonTiers.size}/7)`, lx + 20, 290, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
    const shelfY = 304;
    const shelfW = lw - 40;
    drawPrintCard(ctx, lx + 20, shelfY, shelfW, 70, {
      paper: false,
      radius: 8,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2,
    });
    const tierOrder = [7, 6, 5, 4, 3, 2, 1];
    const slotW = shelfW / 7;
    tierOrder.forEach((tierNum, idx) => {
      const won = wonTiers.has(tierNum);
      const sx = lx + 20 + idx * slotW;
      const cxSlot = sx + slotW / 2;
      drawRoundRect(
        ctx,
        sx + 4,
        shelfY + 7,
        slotW - 8,
        40,
        6,
        won ? THEME.PAPER_CREAM : THEME.BG_DEEP,
        won ? THEME.BRASS : THEME.BORDER,
        won ? 1.8 : 1
      );
      if (won) {
        drawTrophyIcon(ctx, cxSlot, shelfY + 27, 22);
      } else {
        drawIcon(ctx, 'trophy', cxSlot, shelfY + 27, 16, THEME.TX3);
      }
      drawText(ctx, `T${tierNum}`, cxSlot, shelfY + 58, {
        size: 12,
        bold: won,
        color: won ? THEME.GOLD_LIGHT : THEME.TX3,
        align: 'center',
        mono: true,
      });
    });

    drawText(ctx, '历届赛季履历', lx + 20, 392, { size: 14.5, bold: true, color: THEME.TX1 });
    if (hof.records.length === 0) {
      // 充实空白区：当前赛季征程卡 + 在研编年史进度卡
      drawPrintCard(ctx, lx + 20, 408, lw - 40, 126, {
        paper: true,
        radius: 10,
        shadowOffset: 4,
        topBandColor: THEME.VERMILION,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2,
      });
      drawBadge(ctx, lx + 34, 424, 92, 22, `S${st.seasonNumber} 进行中`, THEME.BG_DEEP, THEME.LIME);
      drawText(ctx, fitText(ctx, league.getUserClub().name, lw - 160, 15, true), lx + 134, 435, {
        size: 15,
        bold: true,
        color: THEME.PAPER_INK,
      });
      drawWrappedText(
        ctx,
        '首个执教赛季尚未完赛。赛季收官后，您的最终排名、冠军奖杯与高光赛季记忆将永久封存于此档案柜。',
        lx + 34,
        460,
        lw - 68,
        19,
        { size: 12.5, color: THEME.PAPER_MUTED, maxLines: 3 }
      );

      // 下方：编年史连载线索卡
      drawPrintCard(ctx, lx + 20, 548, lw - 40, 138, {
        paper: false,
        radius: 10,
        shadowOffset: 3,
        topBandColor: THEME.LIME,
        strokeColor: THEME.INK_LINE,
        lineWidth: 2,
      });
      const focusChron = activeChronicles[0] ?? chronicles[0];
      drawBadge(
        ctx,
        lx + 34,
        564,
        118,
        22,
        activeChronicles.length > 0 ? '编年史连载中' : '待开启编年史',
        THEME.BG_DEEP,
        THEME.LIME
      );
      drawText(ctx, `${activeChronicles.length} 篇推进中`, lx + lw - 34, 575, {
        size: 12,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'right',
      });
      if (focusChron) {
        drawText(ctx, fitText(ctx, focusChron.title, lw - 68, 15, true), lx + 34, 604, {
          size: 15,
          bold: true,
          color: THEME.TX1,
        });
        drawWrappedText(ctx, focusChron.subtitle, lx + 34, 626, lw - 68, 18, {
          size: 12,
          color: THEME.TX2,
          maxLines: 2,
        });
        drawText(ctx, '点击右侧「俱乐部编年史」查看全部 7 篇长线档案 ▶', lx + 34, 668, {
          size: 12,
          color: THEME.LIME,
        });
      }
    } else {
      [...hof.records].reverse().slice(0, 4).forEach((rec, i) => {
        const hasMem = !!rec.topMemory;
        const ry = 408 + i * 71;
        drawPrintCard(ctx, lx + 20, ry, lw - 40, hasMem ? 64 : 56, {
          paper: rec.isChampion,
          radius: 8,
          shadowOffset: 3,
          strokeColor: THEME.INK_LINE,
          lineWidth: 1.8,
        });
        drawBadge(
          ctx,
          lx + 30,
          ry + 10,
          44,
          22,
          `S${rec.seasonNumber}`,
          rec.isChampion ? THEME.BRASS : THEME.BG_DEEP,
          rec.isChampion ? THEME.INK_LINE : THEME.TX1
        );
        if (rec.isChampion) {
          drawIcon(ctx, 'trophy', lx + 86, ry + 20, 14, THEME.VERMILION);
        }
        drawText(ctx, fitText(ctx, rec.clubName, lw - 175, 13.5, true, true), rec.isChampion ? lx + 100 : lx + 82, ry + 18, {
          size: 13.5,
          bold: true,
          color: rec.isChampion ? THEME.PAPER_INK : THEME.TX1,
        });
        drawText(ctx, fitText(ctx, `${rec.storylineTitle || '常规赛季'} · ${rec.points}分 · ${rec.gf}/${rec.ga}`, lw - 120, 12, false, true), lx + 82, ry + 37, {
          size: 12,
          color: rec.isChampion ? THEME.PAPER_MUTED : THEME.TX2,
        });
        if (rec.topMemory) {
          const mem = rec.topMemory;
          const oppExtra = mem.oppPlayerName ? ` · 敌:${mem.oppPlayerName}` : '';
          drawText(ctx, fitText(ctx, `★ ${mem.badge} · ${mem.title} (${mem.scoreText}${oppExtra})`, lw - 60, 12, false, true), lx + 30, ry + 54, {
            size: 12,
            color: mem.isPainful ? THEME.VERMILION : rec.isChampion ? THEME.PAPER_INK : THEME.GOLD_LIGHT,
          });
        }
        drawText(ctx, `第 ${rec.finalRank} 名`, lx + lw - 34, ry + 20, {
          size: 13.5,
          bold: true,
          color: rec.isChampion ? THEME.VERMILION : THEME.TX1,
          align: 'right',
        });
      });
    }

    const rx = lx + lw + 14;
    const rw = 1264 - rx;
    drawPrintCard(ctx, rx, 80, rw, 624, {
      paper: false,
      radius: 12,
      shadowOffset: 5,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });

    drawButton(ctx, hits, rx + 20, 92, 178, 34, `成就里程碑 (${unlockedSet.size}/${ACHIEVEMENTS.length})`, () => {
      this.rightTab = 'achievements';
    }, { variant: this.rightTab === 'achievements' ? 'gold' : 'ghost', fontSize: 12.5 });
    drawButton(ctx, hits, rx + 206, 92, 212, 34, `俱乐部编年史 (已完成 ${completedChronCount}/${chronicles.length})`, () => {
      this.rightTab = 'chronicles';
    }, { variant: this.rightTab === 'chronicles' ? 'gold' : 'ghost', fontSize: 12.5 });

    if (this.rightTab === 'achievements') {
      const perPage = 8; // 每页 8 项大卡 (2×4)
      const totalPages = Math.max(1, Math.ceil(ACHIEVEMENTS.length / perPage));
      this.achPage = Math.max(0, Math.min(totalPages - 1, this.achPage));
      drawButton(ctx, hits, rx + rw - 144, 92, 44, 34, '◀', () => {
        this.achPage = Math.max(0, this.achPage - 1);
      }, { variant: 'ghost', fontSize: 13 });
      drawText(ctx, `${this.achPage + 1}/${totalPages}`, rx + rw - 78, 109, { size: 12.5, bold: true, color: THEME.TX2, align: 'center', mono: true });
      drawButton(ctx, hits, rx + rw - 60, 92, 44, 34, '▶', () => {
        this.achPage = Math.min(totalPages - 1, this.achPage + 1);
      }, { variant: 'ghost', fontSize: 13 });

      const achW = Math.floor((rw - 52) / 2);
      const blankMedalImg = AssetLoader.get('ach_blank');
      const achSlice = ACHIEVEMENTS.slice(this.achPage * perPage, this.achPage * perPage + perPage);
      achSlice.forEach((ach, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const ax = rx + 20 + col * (achW + 12);
        const ay = 140 + row * 134;
        const achH = 120;
        const unlocked = unlockedSet.has(ach.id);

        drawPrintCard(ctx, ax, ay, achW, achH, {
          paper: unlocked,
          radius: 9,
          shadowOffset: unlocked ? 5 : 3,
          topBandColor: unlocked ? THEME.BRASS : undefined,
          strokeColor: THEME.INK_LINE,
          lineWidth: unlocked ? 2.2 : 1.8,
        });
        if (unlocked) {
          drawFoilShimmer(ctx, ax, ay, achW, achH, performance.now() / 1000 + idx * 0.23, 'rgba(216, 168, 66, 0.20)');
        }
        const vis = ACH_VISUAL_MAP[ach.id] ?? { icon: 'trophy' as IconName, tint: THEME.GOLD_LIGHT };
        const dedicatedImg = vis.art ? AssetLoader.get(vis.art) : null;
        drawRoundRect(
          ctx,
          ax + 12,
          ay + 34,
          52,
          52,
          8,
          unlocked ? THEME.BG_DEEP : THEME.BG_DEEP,
          unlocked ? THEME.BRASS : THEME.BORDER,
          unlocked ? 2 : 1.2
        );
        if (dedicatedImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.globalAlpha = unlocked ? 1 : 0.35;
          ctx.drawImage(dedicatedImg, ax + 14, ay + 36, 48, 48);
          ctx.restore();
        } else if (blankMedalImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.globalAlpha = unlocked ? 0.9 : 0.28;
          ctx.drawImage(blankMedalImg, ax + 14, ay + 36, 48, 48);
          ctx.restore();
          drawIcon(ctx, vis.icon, ax + 38, ay + 60, 20, unlocked ? vis.tint : THEME.TX3);
        } else {
          drawIcon(ctx, vis.icon, ax + 38, ay + 60, 22, unlocked ? THEME.GOLD_LIGHT : THEME.TX3);
        }

        drawText(ctx, fitText(ctx, ach.title, achW - 156, 15, true, true), ax + 74, ay + 36, {
          size: 15,
          bold: true,
          color: unlocked ? THEME.PAPER_INK : THEME.TX1,
        });
        drawWrappedText(ctx, ach.desc, ax + 74, ay + 60, achW - 88, 19, {
          size: 12.5,
          color: unlocked ? THEME.PAPER_MUTED : THEME.TX2,
          maxLines: 2,
        });
        drawBadge(
          ctx,
          ax + achW - 88,
          ay + 14,
          76,
          24,
          unlocked ? '已解锁 ✓' : `+${ach.metaReward} pt`,
          unlocked ? THEME.BRASS : THEME.BG_DEEP,
          unlocked ? THEME.INK_LINE : THEME.GOLD_LIGHT
        );
      });
    } else {
      const perPage = 3;
      const totalPages = Math.max(1, Math.ceil(chronicles.length / perPage));
      this.chronPage = Math.max(0, Math.min(totalPages - 1, this.chronPage));
      drawButton(ctx, hits, rx + rw - 144, 92, 44, 34, '◀', () => {
        this.chronPage = Math.max(0, this.chronPage - 1);
      }, { variant: 'ghost', fontSize: 13 });
      drawText(ctx, `${this.chronPage + 1}/${totalPages}`, rx + rw - 78, 109, { size: 12.5, bold: true, color: THEME.TX2, align: 'center', mono: true });
      drawButton(ctx, hits, rx + rw - 60, 92, 44, 34, '▶', () => {
        this.chronPage = Math.min(totalPages - 1, this.chronPage + 1);
      }, { variant: 'ghost', fontSize: 13 });

      const pageItems = chronicles.slice(this.chronPage * perPage, this.chronPage * perPage + perPage);
      pageItems.forEach((c, i) => {
        const cy = 140 + i * 182;
        const ch = 170;
        const cw = rw - 40;
        const cx = rx + 20;
        const isDone = c.status === 'completed';
        const isActive = c.status === 'active';
        const bandCol = isDone ? THEME.BRASS : isActive ? THEME.LIME : undefined;

        drawPrintCard(ctx, cx, cy, cw, ch, {
          paper: isDone,
          radius: 10,
          shadowOffset: isDone || isActive ? 5 : 3,
          topBandColor: bandCol,
          strokeColor: THEME.INK_LINE,
          lineWidth: 2,
        });
        if (isDone) {
          drawFoilShimmer(ctx, cx, cy, cw, ch, performance.now() / 1000 + i * 0.4, 'rgba(216, 168, 66, 0.22)');
        }

        const ix = cx + 14;
        const iy = cy + 16;
        const iw = 192;
        const ih = 108;
        drawRoundRect(ctx, ix, iy, iw, ih, 8, THEME.BG_DEEP, THEME.INK_LINE, 1.8);
        const artImg = AssetLoader.get(c.artId as ArtAssetId);
        if (artImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.globalAlpha = c.status === 'locked' ? 0.22 : 1;
          ctx.beginPath();
          ctx.rect(ix + 2, iy + 2, iw - 4, ih - 4);
          ctx.clip();
          ctx.drawImage(artImg, ix + 2, iy + 2, iw - 4, ih - 4);
          ctx.restore();
        }
        drawText(
          ctx,
          c.status === 'locked' ? '未开启' : isDone ? '已封存' : `第 ${c.chapter}/${c.maxChapters} 章`,
          ix + iw / 2,
          iy + ih + 18,
          { size: 12, bold: true, align: 'center', color: isDone ? THEME.PAPER_INK : isActive ? THEME.LIME : THEME.TX3 }
        );

        if (c.maxChapters > 0) {
          const dotsW = c.maxChapters * 14 - 4;
          const dx0 = ix + (iw - dotsW) / 2;
          for (let d = 0; d < c.maxChapters; d++) {
            const lit = isDone || (isActive && d < c.chapter);
            drawRoundRect(
              ctx,
              dx0 + d * 14,
              iy + ih + 30,
              10,
              4,
              2,
              lit ? (isDone ? THEME.BRASS : THEME.LIME) : THEME.BG_DEEP
            );
          }
        }

        const tx = ix + iw + 16;
        const tw = cw - iw - 44;
        const mainTextCol = isDone ? THEME.PAPER_INK : isActive ? THEME.TX1 : THEME.TX2;
        const subTextCol = isDone ? THEME.PAPER_MUTED : THEME.TX2;
        drawText(ctx, c.title, tx, cy + 28, {
          size: 16,
          bold: true,
          color: mainTextCol,
        });
        const statusLabel = isDone ? '圆满归档' : isActive ? '连载推进中' : '未解锁';
        const statusBg = isDone ? THEME.BG_PANEL : isActive ? THEME.BG_DEEP : THEME.BG_DEEP;
        const statusFg = isDone ? THEME.GOLD_LIGHT : isActive ? THEME.LIME : THEME.TX3;
        drawBadge(ctx, cx + cw - 98, cy + 14, 84, 24, statusLabel, statusBg, statusFg);

        drawWrappedText(ctx, c.status === 'locked' ? `解锁条件：${c.subtitle}` : c.subtitle, tx, cy + 50, tw, 18, {
          size: 12.5,
          color: subTextCol,
          maxLines: 2,
        });

        if (c.status !== 'locked') {
          const spanText = c.startSeason
            ? `跨度：S${c.startSeason}(T${c.startTier ?? 7})${c.endSeason ? ` → S${c.endSeason}(T${c.endTier ?? 7})` : ' → 进行中'}`
            : '';
          const peopleText = c.keyPeople.length > 0 ? `关键人物：${c.keyPeople.join(' · ')}` : '';
          drawText(ctx, fitText(ctx, [spanText, peopleText].filter(Boolean).join(' | '), 456, 12, false, true), tx, cy + 98, {
            size: 12,
            color: isDone ? THEME.COBALT : THEME.LIME,
          });
          drawText(ctx, fitText(ctx, `进度：${c.statSnapshot}`, 456, 12, false, true), tx, cy + 120, {
            size: 12,
            color: mainTextCol,
          });
          const lastChoice = c.choicesMade[c.choicesMade.length - 1];
          const footText = c.memorableMoment
            ? `铭记时刻：${c.memorableMoment}`
            : lastChoice
              ? `关键抉择：${lastChoice}`
              : '等待下一章节触发...';
          drawText(ctx, fitText(ctx, footText, 456, 12, false, true), tx, cy + 144, {
            size: 12,
            bold: !!c.memorableMoment,
            color: c.memorableMoment ? (isDone ? '#9A6B12' : THEME.GOLD_LIGHT) : (isDone ? '#166534' : THEME.LIME),
          });
        }
      });
    }
  }
}
