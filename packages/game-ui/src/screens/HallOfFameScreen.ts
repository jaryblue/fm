/**
 * 历史荣誉室、12 项成就里程碑与跨赛季俱乐部编年史档案
 */

import { ACHIEVEMENTS } from '../../../core/src/Achievements';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { ArtAssetId, AssetLoader } from '../AssetLoader';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawFoilShimmer,
  drawNavRail,
  drawRoundRect,
  drawText,
  drawWrappedText,
  fitText,
  HitRegistry,
  NavRailTab,
} from '../CanvasKit';
import { drawTrophyIcon } from '../ClubVisuals';
import { THEME } from '../Theme';
import { drawIcon, IconName } from '../VectorIcons';

const ACH_VISUAL_MAP: Record<string, { art?: ArtAssetId; icon: IconName; tint: string }> = {
  ach_first_draft: { art: 'ach_first_draft', icon: 'sparkle', tint: THEME.GOLD_LIGHT },
  ach_first_win: { art: 'ach_first_win', icon: 'ball', tint: THEME.GOLD_LIGHT },
  ach_playoffs: { art: 'ach_playoffs', icon: 'bolt', tint: THEME.GOLD_LIGHT },
  ach_champion: { art: 'ach_champion', icon: 'trophy', tint: THEME.GOLD_LIGHT },
  ach_dynasty: { art: 'ach_dynasty', icon: 'star', tint: THEME.GOLD_LIGHT },
  ach_hattrick: { art: 'ach_hattrick', icon: 'ball', tint: '#FACC15' },
  ach_clean_sheet: { art: 'ach_clean_sheet', icon: 'shield', tint: '#34D399' },
  ach_craft_card: { art: 'ach_craft_card', icon: 'craft', tint: '#38BDF8' },
  ach_recipe_5: { art: 'ach_recipe_5', icon: 'card', tint: '#C084FC' },
  ach_hidden_trait: { art: 'ach_hidden_trait', icon: 'sparkle', tint: '#FEF08A' },
  ach_synergy: { art: 'ach_synergy', icon: 'bolt', tint: '#22D3EE' },
  ach_meta_lv3: { art: 'ach_meta_lv3', icon: 'talent', tint: '#F59E0B' },
  ach_secret_retire: { icon: 'star', tint: THEME.GOLD_LIGHT },
  ach_skill_rank3: { icon: 'bolt', tint: '#38BDF8' },
  ach_skill_mutate: { icon: 'sparkle', tint: '#C084FC' },
  ach_fusion_power: { icon: 'craft', tint: '#F59E0B' },
  ach_lv4_card: { icon: 'card', tint: THEME.GOLD_LIGHT },
  ach_corrupted_win: { icon: 'bolt', tint: '#FB7185' },
  ach_win_streak_5: { icon: 'trophy', tint: '#34D399' },
  ach_big_win: { icon: 'ball', tint: '#FACC15' },
  ach_comeback_win: { icon: 'bolt', tint: '#22D3EE' },
  ach_triple_synergy: { icon: 'link', tint: '#A78BFA' },
  ach_scout_master: { icon: 'sparkle', tint: '#38BDF8' },
  ach_top_tier: { icon: 'trophy', tint: THEME.GOLD_LIGHT },
};

export class HallOfFameScreen {
  private rightTab: 'achievements' | 'chronicles' = 'achievements';
  private achPage = 0;
  private chronPage = 0;

  public onWheel(deltaY: number): boolean {
    if (this.rightTab === 'achievements') {
      const totalPages = Math.max(1, Math.ceil(ACHIEVEMENTS.length / 12));
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
    const hof = league.getHallOfFame();
    const unlockedSet = new Set(hof.unlockedAchievements);
    const chronicles = league.getChronicles();
    const completedChronCount = chronicles.filter(c => c.status === 'completed').length;
    const activeChronCount = chronicles.filter(c => c.status === 'active').length;
    const hasRail = !!onNavigate;

    drawBroadcastHeader(ctx, hits, {
      kicker: 'HALL OF FAME · CAREER MILESTONES',
      title: '历史荣誉室与编年史',
      club: hasRail ? league.getUserClub() : undefined,
      onBack: hasRail ? undefined : onBack,
      badge: `成就 ${unlockedSet.size}/${ACHIEVEMENTS.length} · 编年史 ${completedChronCount}/${chronicles.length}`,
      metaPoints: league.getState().metaPointsTotal,
      showSoundToggle: true,
    });

    if (onNavigate) {
      drawNavRail(ctx, hits, 'hof', onNavigate);
    }

    // 左栏：奖杯视觉焦点 + 执教生涯统计 + 历届赛季履历
    const lx = hasRail ? 96 : 16;
    const lw = hasRail ? 420 : 460;
    drawChamferPanel(ctx, lx, 80, lw, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER_GOLD, 1.2, THEME.GOLD_LIGHT);
    const hofTrophy = AssetLoader.get(hof.championships > 0 ? 'trophy_grand_cup' : 'trophy_tier2_4');
    if (hofTrophy && typeof ctx.drawImage === 'function') {
      ctx.drawImage(hofTrophy, lx + 26, 94, 44, 44);
    } else {
      drawTrophyIcon(ctx, lx + 48, 114, 34);
    }
    drawText(ctx, '执教生涯统计', lx + 82, 114, { size: 16, bold: true, color: THEME.GOLD_LIGHT });

    const statW = Math.floor((lw - 52) / 2);
    const statCards: Array<[string, string]> = [
      ['执教赛季', `${hof.seasonsPlayed}`],
      ['夺冠次数', `${hof.championships}`],
      ['累计胜场', `${hof.totalWins}`],
      ['累计进球', `${hof.totalGoals}`],
    ];
    statCards.forEach(([label, val], i) => {
      const cx = lx + 20 + (i % 2) * (statW + 12);
      const cy = 148 + Math.floor(i / 2) * 72;
      drawRoundRect(ctx, cx, cy, statW, 60, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, label, cx + 14, cy + 18, { size: 11, color: THEME.TX2 });
      drawText(ctx, val, cx + 14, cy + 42, { size: 22, bold: true, italic: true, color: THEME.GOLD_LIGHT, mono: true });
    });

    drawText(ctx, '历届赛季履历', lx + 20, 312, { size: 14, bold: true, color: THEME.TX1 });
    if (hof.records.length === 0) {
      drawRoundRect(ctx, lx + 20, 334, lw - 40, 100, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, '完成首个赛季后，冠军奖杯与赛季战绩将收录于此', lx + lw / 2, 384, {
        size: 12,
        color: THEME.TX3,
        align: 'center',
      });
    } else {
      [...hof.records].reverse().slice(0, 5).forEach((rec, i) => {
        const hasMem = !!rec.topMemory;
        const ry = 334 + i * 70;
        drawRoundRect(
          ctx,
          lx + 20,
          ry,
          lw - 40,
          hasMem ? 62 : 50,
          7,
          THEME.BG_CARD,
          rec.isChampion ? THEME.GOLD : THEME.BORDER
        );
        drawBadge(
          ctx,
          lx + 32,
          ry + 12,
          42,
          20,
          `S${rec.seasonNumber}`,
          rec.isChampion ? THEME.GOLD : '#1E293B',
          rec.isChampion ? '#080C14' : THEME.TX1
        );
        if (rec.isChampion) drawIcon(ctx, 'trophy', lx + 86, ry + 16, 13, THEME.GOLD_LIGHT);
        drawText(ctx, rec.clubName, rec.isChampion ? lx + 100 : lx + 86, ry + 16, {
          size: 13,
          bold: true,
          color: rec.isChampion ? THEME.GOLD_LIGHT : THEME.TX1,
        });
        drawText(ctx, `${rec.storylineTitle || '常规赛季'} · ${rec.points}分 · ${rec.gf}/${rec.ga}`, lx + 86, ry + 34, {
          size: 11,
          color: THEME.TX2,
        });
        if (rec.topMemory) {
          const mem = rec.topMemory;
          const oppExtra = mem.oppPlayerName ? ` · 敌方:${mem.oppPlayerName}` : '';
          drawText(ctx, `★ ${mem.badge} · ${mem.title} (${mem.scoreText}${oppExtra})`, lx + 32, ry + 51, {
            size: 10,
            color: mem.isPainful ? '#FCA5A5' : THEME.GOLD_LIGHT,
          });
        }
        drawText(ctx, `第 ${rec.finalRank} 名`, lx + lw - 34, ry + 22, {
          size: 13,
          bold: true,
          color: rec.isChampion ? THEME.GOLD_LIGHT : THEME.TX1,
          align: 'right',
        });
      });
    }

    // 右栏：成就里程碑 | 俱乐部编年史 双标签页
    const rx = lx + lw + 14;
    const rw = 1264 - rx;
    drawChamferPanel(ctx, rx, 80, rw, 624, 12, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);

    drawButton(ctx, hits, rx + 20, 94, 152, 30, `成就里程碑 (${unlockedSet.size}/${ACHIEVEMENTS.length})`, () => {
      this.rightTab = 'achievements';
    }, { variant: this.rightTab === 'achievements' ? 'gold' : 'ghost', fontSize: 12 });
    drawButton(ctx, hits, rx + 180, 94, 180, 30, `俱乐部编年史 (${completedChronCount + activeChronCount}/${chronicles.length})`, () => {
      this.rightTab = 'chronicles';
    }, { variant: this.rightTab === 'chronicles' ? 'gold' : 'ghost', fontSize: 12 });

    if (this.rightTab === 'achievements') {
      const perPage = 12;
      const totalPages = Math.max(1, Math.ceil(ACHIEVEMENTS.length / perPage));
      this.achPage = Math.max(0, Math.min(totalPages - 1, this.achPage));
      drawButton(ctx, hits, rx + rw - 130, 94, 42, 28, '◀', () => {
        this.achPage = Math.max(0, this.achPage - 1);
      }, { variant: 'ghost', fontSize: 11 });
      drawText(ctx, `${this.achPage + 1}/${totalPages}`, rx + rw - 72, 108, { size: 11, color: THEME.TX2, align: 'center', mono: true });
      drawButton(ctx, hits, rx + rw - 54, 94, 34, 28, '▶', () => {
        this.achPage = Math.min(totalPages - 1, this.achPage + 1);
      }, { variant: 'ghost', fontSize: 11 });

      const achW = Math.floor((rw - 52) / 2);
      const blankMedalImg = AssetLoader.get('ach_blank');
      const achSlice = ACHIEVEMENTS.slice(this.achPage * perPage, this.achPage * perPage + perPage);
      achSlice.forEach((ach, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const ax = rx + 20 + col * (achW + 12);
        const ay = 136 + row * 92;
        const unlocked = unlockedSet.has(ach.id);

        drawChamferPanel(
          ctx,
          ax,
          ay,
          achW,
          80,
          8,
          unlocked ? 'rgba(34,197,94,0.12)' : THEME.BG_CARD,
          unlocked ? THEME.GREEN : THEME.BORDER,
          unlocked ? 1.4 : 1,
          unlocked ? THEME.GREEN : undefined
        );
        if (unlocked) {
          drawFoilShimmer(ctx, ax, ay, achW, 80, performance.now() / 1000 + idx * 0.23, 'rgba(34, 197, 94, 0.18)');
        }
        const vis = ACH_VISUAL_MAP[ach.id] ?? { icon: 'trophy' as IconName, tint: THEME.GOLD_LIGHT };
        const dedicatedImg = vis.art ? AssetLoader.get(vis.art) : null;
        if (dedicatedImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.globalAlpha = unlocked ? 1 : 0.28;
          ctx.drawImage(dedicatedImg, ax + 8, ay + 16, 48, 48);
          ctx.restore();
        } else if (blankMedalImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.globalAlpha = unlocked ? 1 : 0.32;
          ctx.drawImage(blankMedalImg, ax + 8, ay + 16, 48, 48);
          // 为通用奖章叠加稀有度金属外环与内圈高光，消除占位感
          const cxM = ax + 32;
          const cyM = ay + 40;
          if (unlocked) {
            ctx.strokeStyle = vis.tint;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(cxM, cyM, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.arc(cxM, cyM, 17, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
          }
          ctx.restore();
          drawIcon(ctx, vis.icon, ax + 32, ay + 40, 18, unlocked ? vis.tint : THEME.TX3);
        } else {
          drawRoundRect(ctx, ax + 12, ay + 20, 36, 36, 8, unlocked ? 'rgba(34,197,94,0.2)' : '#1E293B', unlocked ? THEME.GOLD : undefined, unlocked ? 1.2 : 0);
          drawIcon(ctx, vis.icon, ax + 30, ay + 38, 18, unlocked ? THEME.GREEN : THEME.TX3);
        }
        drawText(ctx, ach.title, ax + 64, ay + 26, {
          size: 14,
          bold: true,
          color: unlocked ? THEME.GOLD_LIGHT : THEME.TX2,
        });
        drawText(ctx, fitText(ctx, ach.desc, achW - 76, 11), ax + 64, ay + 52, {
          size: 11,
          color: unlocked ? THEME.TX1 : THEME.TX2,
        });
        drawBadge(
          ctx,
          ax + achW - 80,
          ay + 14,
          68,
          20,
          unlocked ? '已解锁' : `+${ach.metaReward} pt`,
          unlocked ? '#14532D' : '#1E293B',
          unlocked ? THEME.GREEN : THEME.GOLD_LIGHT
        );
      });
    } else {
      const perPage = 3;
      const totalPages = Math.ceil(chronicles.length / perPage);
      this.chronPage = Math.max(0, Math.min(totalPages - 1, this.chronPage));
      drawButton(ctx, hits, rx + rw - 136, 94, 52, 28, '◀', () => {
        this.chronPage = Math.max(0, this.chronPage - 1);
      }, { variant: 'ghost', fontSize: 11 });
      drawText(ctx, `${this.chronPage + 1}/${totalPages}`, rx + rw - 72, 108, { size: 11, color: THEME.TX2, align: 'center', mono: true });
      drawButton(ctx, hits, rx + rw - 54, 94, 34, 28, '▶', () => {
        this.chronPage = Math.min(totalPages - 1, this.chronPage + 1);
      }, { variant: 'ghost', fontSize: 11 });

      const pageItems = chronicles.slice(this.chronPage * perPage, this.chronPage * perPage + perPage);
      pageItems.forEach((c, i) => {
        const cy = 136 + i * 184;
        const ch = 172;
        const cw = rw - 40;
        const cx = rx + 20;
        const isDone = c.status === 'completed';
        const isActive = c.status === 'active';
        const borderCol = isDone ? THEME.GOLD : isActive ? '#38BDF8' : THEME.BORDER;

        drawChamferPanel(
          ctx,
          cx,
          cy,
          cw,
          ch,
          10,
          isDone ? 'rgba(212,168,67,0.10)' : isActive ? 'rgba(56,189,248,0.08)' : THEME.BG_CARD,
          borderCol,
          isDone || isActive ? 1.4 : 1
        );
        if (isDone) {
          drawFoilShimmer(ctx, cx, cy, cw, ch, performance.now() / 1000 + i * 0.4, 'rgba(250, 204, 21, 0.20)');
        }

        const ix = cx + 14;
        const iy = cy + 16;
        const iw = 192;
        const ih = 108;
        drawRoundRect(ctx, ix, iy, iw, ih, 8, '#0B1120', borderCol);
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
          iy + ih + 16,
          { size: 11, bold: true, align: 'center', color: isDone ? THEME.GOLD_LIGHT : isActive ? '#38BDF8' : THEME.TX3 }
        );
        // 编年史章节进度点阵
        if (c.maxChapters > 0) {
          const dotsW = c.maxChapters * 14 - 4;
          const dx0 = ix + (iw - dotsW) / 2;
          for (let d = 0; d < c.maxChapters; d++) {
            const lit = isDone || (isActive && d < c.chapter);
            drawRoundRect(
              ctx,
              dx0 + d * 14,
              iy + ih + 26,
              10,
              4,
              2,
              lit ? (isDone ? THEME.GOLD_LIGHT : '#38BDF8') : '#1E293B'
            );
          }
        }

        const tx = ix + iw + 16;
        const tw = cw - iw - 44;
        drawText(ctx, c.title, tx, cy + 28, {
          size: 15,
          bold: true,
          color: isDone ? THEME.GOLD_LIGHT : isActive ? THEME.TX1 : THEME.TX2,
        });
        const statusLabel = isDone ? '圆满归档' : isActive ? '连载推进中' : '未解锁';
        const statusBg = isDone ? '#78350F' : isActive ? '#0C4A6E' : '#1E293B';
        const statusFg = isDone ? THEME.GOLD_LIGHT : isActive ? '#38BDF8' : THEME.TX3;
        drawBadge(ctx, cx + cw - 92, cy + 14, 78, 20, statusLabel, statusBg, statusFg);

        drawWrappedText(ctx, c.status === 'locked' ? `解锁条件：${c.subtitle}` : c.subtitle, tx, cy + 48, tw, 17, {
          size: 11,
          color: THEME.TX2,
          maxLines: 2,
        });

        if (c.status !== 'locked') {
          const spanText = c.startSeason
            ? `跨度：S${c.startSeason}(第${c.startTier ?? 7}级)${c.endSeason ? ` → S${c.endSeason}(第${c.endTier ?? 7}级)` : ' → 进行中'}`
            : '';
          const peopleText = c.keyPeople.length > 0 ? `关键人物：${c.keyPeople.join(' · ')}` : '';
          drawText(ctx, [spanText, peopleText].filter(Boolean).join('  |  '), tx, cy + 96, {
            size: 11,
            color: '#93C5FD',
          });
          drawText(ctx, `进度快照：${c.statSnapshot}`, tx, cy + 116, {
            size: 11,
            color: THEME.TX1,
          });
          const lastChoice = c.choicesMade[c.choicesMade.length - 1];
          const footText = c.memorableMoment
            ? `铭记时刻：${c.memorableMoment}`
            : lastChoice
              ? `关键抉择：${lastChoice}`
              : '等待下一章节触发...';
          drawText(ctx, footText, tx, cy + 140, {
            size: 11,
            bold: !!c.memorableMoment,
            color: c.memorableMoment ? THEME.GOLD_LIGHT : THEME.GREEN,
          });
        }
      });
    }
  }
}
