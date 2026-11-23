/**
 * 页面 0：TitleScreen 发行级主视觉登录门户 + 3 步式建队向导弹窗
 * 全屏背景图 + 转播级斜体大标题 + 矢量图标 + 悬浮俱乐部名片 + 向导式建队
 */

import { LeagueManager, NewSeasonOptions } from '../../../core/src/LeagueManager';
import { FICTIONAL_CLUBS } from '../../../core/src/PlayerPool';
import { generateFictionalClubName } from '../../../core/src/namePool';
import { FORMATION_SYSTEMS, getDefenseSystem } from '../../../engine/src/formations';
import { DefenseSystem, FormationName, TACTICAL_PRESETS, TacticalStyle } from '../../../engine/src/types';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawRoundRect,
  drawText,
  HitRegistry,
} from '../CanvasKit';
import { drawClubCrest, drawJerseyIcon } from '../ClubVisuals';
import { drawGameLogoEmblem, easeOutBack, easeOutCubic } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';
import { drawIcon } from '../VectorIcons';

const PRIMARY_PALETTE = ['#DC2626', '#2563EB', '#059669', '#EA580C', '#7C3AED', '#0284C7'];
const SECONDARY_PALETTE = ['#FACC15', '#F8FAFC', '#1E293B', '#38BDF8', '#F59E0B'];
const SYS_TABS: DefenseSystem[] = ['4-back', '3-back', '5-back'];
const STYLE_LIST: TacticalStyle[] = ['tiki_taka', 'gegenpress', 'balanced', 'wing_play', 'counter', 'park_bus'];

const STYLE_HINTS: Record<TacticalStyle, string> = {
  balanced: '攻守平衡 · 中位防线，适合通用阵容稳扎稳打',
  tiki_taka: '传控渗透 · 短传配合与高位控球，压制对手持球时间',
  gegenpress: '高位逼抢 · 极高防线与疯狂反抢，节奏最快但体能消耗大',
  counter: '快速反击 · 深度回收诱敌深入，断球后直塞打身后',
  wing_play: '两翼齐飞 · 拉开球场宽度，边路突破与传中制造杀机',
  park_bus: '铁桶防反 · 极限低位防守密度，专克强队并伺机偷袭',
};

export class TitleScreen {
  private wizardOpen = false;
  private wizardStep: 1 | 2 | 3 = 1;
  private selectedClubId = FICTIONAL_CLUBS[0].id;
  private customName = FICTIONAL_CLUBS[0].name;
  private primaryColor = FICTIONAL_CLUBS[0].primaryColor;
  private secondaryColor = FICTIONAL_CLUBS[0].secondaryColor;
  private formation: FormationName = '4-3-3';
  private sysTab: DefenseSystem = '4-back';
  private style: TacticalStyle = 'tiki_taka';
  private enterTime = 0;
  private ambientTime = 0;

  public resetEnterAnim(): void {
    this.enterTime = 0;
  }

  public update(dtSec: number): void {
    this.enterTime += dtSec;
    this.ambientTime += dtSec;
  }

  private selectTemplate(clubId: string): void {
    const tpl = FICTIONAL_CLUBS.find(c => c.id === clubId) || FICTIONAL_CLUBS[0];
    this.selectedClubId = tpl.id;
    this.customName = tpl.name;
    this.primaryColor = tpl.primaryColor;
    this.secondaryColor = tpl.secondaryColor;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onContinue: () => void;
      onStartNewSeason: (opts: NewSeasonOptions) => void;
      onOpenMeta: () => void;
      onOpenRoster: () => void;
      onOpenHallOfFame: () => void;
      onResetSave?: () => void;
      onEditName?: (current: string, apply: (next: string) => void) => void;
    }
  ): void {
    const st = league.getState();
    const userClub = league.getUserClub();
    const hasActiveRun =
      st.phase === 'REGULAR_SEASON' ||
      st.phase === 'RE_DRAFT' ||
      (st.phase === 'INIT_DRAFT' && (userClub.squad.length > 0 || st.seasonNumber > 1));
    const metaLv = league.getMetaLevels();
    const hof = st.hallOfFame;

    // 柔和暗调聚焦遮罩 + 球场扫射探照光束与飘浮金色微粒
    ctx.save();
    for (let bi = 0; bi < 2; bi++) {
      const originX = bi === 0 ? THEME.W * 0.14 : THEME.W * 0.86;
      const sweepX = THEME.W * 0.5 + Math.sin(this.ambientTime * 0.8 + bi * Math.PI) * 240;
      const beam = ctx.createLinearGradient(originX, 0, sweepX, THEME.H * 0.85);
      beam.addColorStop(0, bi === 0 ? 'rgba(250, 204, 21, 0.12)' : 'rgba(249, 115, 22, 0.11)');
      beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(originX - 24, 0);
      ctx.lineTo(originX + 24, 0);
      ctx.lineTo(sweepX + 200, THEME.H);
      ctx.lineTo(sweepX - 200, THEME.H);
      ctx.closePath();
      ctx.fill();
    }

    const centerScrim = ctx.createRadialGradient(THEME.W / 2, 330, 100, THEME.W / 2, 340, 580);
    centerScrim.addColorStop(0, 'rgba(6, 10, 18, 0.78)');
    centerScrim.addColorStop(0.65, 'rgba(6, 10, 18, 0.48)');
    centerScrim.addColorStop(1, 'rgba(6, 10, 18, 0.08)');
    ctx.fillStyle = centerScrim;
    ctx.fillRect(0, 0, THEME.W, THEME.H);

    for (let pi = 0; pi < 22; pi++) {
      const px = ((pi * 89 + Math.sin(this.ambientTime * 0.55 + pi) * 24) % THEME.W + THEME.W) % THEME.W;
      const py = THEME.H - ((this.ambientTime * (34 + (pi % 4) * 14) + pi * 61) % THEME.H);
      const pa = 0.18 + 0.24 * Math.sin(this.ambientTime * 2.2 + pi);
      ctx.fillStyle = pi % 3 === 0
        ? `rgba(249, 115, 22, ${Math.max(0.05, pa).toFixed(2)})`
        : `rgba(250, 204, 21, ${Math.max(0.05, pa).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.4 + (pi % 2) * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const pTitle = easeOutCubic(Math.min(1, this.enterTime / 0.35));
    const pLogo = easeOutBack(Math.min(1, this.enterTime / 0.45));
    const pCard = easeOutBack(Math.min(1, Math.max(0, (this.enterTime - 0.1) / 0.42)));
    const pBtns = easeOutCubic(Math.min(1, Math.max(0, (this.enterTime - 0.18) / 0.38)));

    // 右上角极简工具栏（贴合右边距 24px）
    if (hasActiveRun && actions.onResetSave) {
      drawButton(ctx, hits, 1044, 24, 98, 36, '重置存档', actions.onResetSave, { variant: 'ghost', fontSize: 12 });
    }
    drawButton(ctx, hits, 1154, 24, 102, 36, SoundEngine.getAudioModeLabel(), () => {
      SoundEngine.cycleAudioMode();
    }, { variant: 'ghost', fontSize: 12, icon: SoundEngine.muted ? 'sound_off' : 'sound_on' });

    const cx = THEME.W / 2;

    // 1. 居中高燃主视觉 Logo 展示区（纯透明悬浮 + 炽金烈焰呼吸光晕）
    const tyOff = Math.round((1 - pTitle) * 18);
    const logoSize = hasActiveRun ? 206 : 248;
    const logoCenterY = (hasActiveRun ? 168 : 204) + tyOff;
    ctx.save();
    ctx.globalAlpha = pTitle;

    const heroGlow = ctx.createRadialGradient(cx, logoCenterY, 24, cx, logoCenterY, 340);
    heroGlow.addColorStop(0, 'rgba(250, 204, 21, 0.24)');
    heroGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.14)');
    heroGlow.addColorStop(1, 'rgba(8, 12, 20, 0)');
    ctx.fillStyle = heroGlow;
    ctx.fillRect(cx - 360, logoCenterY - 170, 720, 340);

    ctx.save();
    ctx.translate(cx, logoCenterY);
    ctx.scale(pLogo, pLogo);
    drawGameLogoEmblem(ctx, 0, 0, logoSize, this.ambientTime, 'showcase');
    ctx.restore();
    ctx.restore();

    // 2. 统一半透明指令坞（主入口 + 3 个功能按钮左右严格对齐）
    const cyOff = Math.round((1 - pCard) * 16);
    const floatY = Math.round(Math.sin(this.ambientTime * 1.8) * 2);
    const dockInnerW = 516;
    const dockPadX = 16;
    const dockPadY = 16;
    const dockW = dockInnerW + dockPadX * 2;
    const dockX = cx - dockW / 2;
    const dockY = (hasActiveRun ? 298 : 362) + cyOff + floatY;
    const row1H = hasActiveRun ? 108 : 58;
    const rowGap = 12;
    const row2H = 44;
    const dockH = dockPadY * 2 + row1H + rowGap + row2H;

    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, pCard));
    drawChamferPanel(
      ctx,
      dockX,
      dockY,
      dockW,
      dockH,
      14,
      'rgba(8, 13, 24, 0.80)',
      'rgba(250, 204, 21, 0.34)',
      1.4,
      THEME.FLAME
    );

    const innerX = dockX + dockPadX;
    const row1Y = dockY + dockPadY;

    if (hasActiveRun) {
      const standings = league.getStandings();
      const myRank = standings.findIndex(r => r.isUser) + 1;
      const tierInfo = league.getCurrentTierInfo();
      const phaseText =
        st.phase === 'INIT_DRAFT' ? `${tierInfo.shortLabel} · 开局选秀 (${userClub.squad.length}/26人)` :
        st.phase === 'RE_DRAFT' ? `${tierInfo.shortLabel} · 第 ${st.currentRound} 轮赛后补强` :
        `${tierInfo.shortLabel} · 第 ${st.currentRound}/34 轮 · 第 ${myRank} 名`;

      drawChamferPanel(
        ctx,
        innerX,
        row1Y,
        dockInnerW,
        row1H,
        10,
        'rgba(14, 22, 40, 0.92)',
        THEME.BORDER_GOLD,
        1.2,
        userClub.primaryColor || THEME.GOLD_LIGHT
      );
      drawClubCrest(ctx, innerX + 52, row1Y + row1H / 2, 26, userClub);
      drawText(ctx, `第 ${st.seasonNumber} 赛季 · ${userClub.name}`, innerX + 96, row1Y + 38, {
        size: 19,
        bold: true,
        color: THEME.TX1,
      });
      drawText(ctx, `${phaseText} · ${userClub.formation}`, innerX + 96, row1Y + 68, {
        size: 12,
        color: THEME.TX2,
      });
      drawButton(ctx, hits, innerX + dockInnerW - 150, row1Y + (row1H - 42) / 2, 134, 42, '继续赛季', actions.onContinue, {
        variant: 'gold',
        fontSize: 14,
        icon: 'play',
      });
    } else {
      drawButton(ctx, hits, innerX, row1Y, dockInnerW, row1H, '开始新赛季', () => {
        this.wizardStep = 1;
        this.wizardOpen = true;
      }, { variant: 'gold', fontSize: 18, icon: 'sparkle' });
    }
    ctx.restore();

    // 第二排 3 个等宽功能按钮，与上方主入口左右边缘像素级对齐 (164*3 + 12*2 = 516)
    const row2Y = row1Y + row1H + rowGap;
    const dockBtnW = 164;
    const dockGap = 12;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, pBtns));
    drawButton(ctx, hits, innerX, row2Y, dockBtnW, row2H, `教练天赋 (${st.metaPointsTotal})`, actions.onOpenMeta, {
      variant: 'ghost',
      fontSize: 12.5,
      icon: 'talent',
    });
    drawButton(ctx, hits, innerX + dockBtnW + dockGap, row2Y, dockBtnW, row2H, '我的球队', actions.onOpenRoster, {
      variant: 'ghost',
      fontSize: 12.5,
      icon: 'tactics',
    });
    drawButton(ctx, hits, innerX + (dockBtnW + dockGap) * 2, row2Y, dockBtnW, row2H, `荣誉室 (${hof.unlockedAchievements.length}/12)`, actions.onOpenHallOfFame, {
      variant: 'ghost',
      fontSize: 12.5,
      icon: 'trophy',
    });
    ctx.restore();

    if (this.wizardOpen) {
      this.renderWizardModal(ctx, hits, metaLv, actions);
    }
  }

  private renderWizardModal(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    metaLv: { scout: number; finance: number; coaching: number; fitness: number },
    actions: {
      onStartNewSeason: (opts: NewSeasonOptions) => void;
      onEditName?: (current: string, apply: (next: string) => void) => void;
    }
  ): void {
    ctx.fillStyle = 'rgba(4, 7, 14, 0.8)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 180;
    const my = 76;
    const mw = 920;
    const mh = 568;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(14, 22, 40, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    drawText(ctx, '新赛季建队向导', mx + 30, my + 34, { size: 20, bold: true, color: THEME.GOLD_LIGHT });
    const steps: Array<[1 | 2 | 3, string]> = [
      [1, '1. 队徽与球衣'],
      [2, '2. 俱乐部命名'],
      [3, '3. 阵型与哲学'],
    ];
    steps.forEach(([s, lbl], i) => {
      drawButton(ctx, hits, mx + 230 + i * 164, my + 18, 152, 32, lbl, () => {
        this.wizardStep = s;
      }, { active: this.wizardStep === s, fontSize: 12 });
    });
    drawButton(ctx, hits, mx + mw - 100, my + 18, 76, 32, '关闭', () => {
      this.wizardOpen = false;
    }, { variant: 'ghost', fontSize: 12, icon: 'close' });

    const previewClub = {
      id: this.selectedClubId,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
    };
    drawChamferPanel(ctx, mx + 28, my + 74, 240, 412, 10, THEME.BG_CARD, THEME.BORDER);
    drawClubCrest(ctx, mx + 148, my + 154, 42, previewClub);
    drawJerseyIcon(ctx, mx + 148, my + 244, 62, previewClub, 10);
    drawText(ctx, this.customName.slice(0, 10), mx + 148, my + 312, {
      size: 20,
      bold: true,
      color: THEME.TX1,
      align: 'center',
    });
    drawText(ctx, `${this.formation} · ${TACTICAL_PRESETS[this.style].name}`, mx + 148, my + 344, {
      size: 13,
      color: THEME.GOLD_LIGHT,
      align: 'center',
    });
    drawText(ctx, `开局预算 ${2080 + metaLv.finance * 60}`, mx + 148, my + 394, {
      size: 12,
      color: THEME.GREEN,
      align: 'center',
    });
    drawText(ctx, `球探刷新 ${metaLv.scout} 次`, mx + 148, my + 420, {
      size: 12,
      color: '#38BDF8',
      align: 'center',
    });

    const rx = mx + 292;
    const ry = my + 74;

    if (this.wizardStep === 1) {
      drawText(ctx, '选择俱乐部底板图腾', rx, ry + 16, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
      FICTIONAL_CLUBS.forEach((c, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const bx = rx + col * 296;
        const by = ry + 38 + row * 60;
        const active = this.selectedClubId === c.id;
        drawRoundRect(ctx, bx, by, 282, 50, 7, active ? '#1E293B' : THEME.BG_CARD, active ? THEME.GOLD : THEME.BORDER, active ? 1.8 : 1);
        drawClubCrest(ctx, bx + 26, by + 25, 15, c);
        drawText(ctx, c.name, bx + 52, by + 25, { size: 13, bold: active, color: active ? THEME.GOLD_LIGHT : THEME.TX1 });
        hits.add(bx, by, 282, 50, () => {
          SoundEngine.playClick();
          this.selectTemplate(c.id);
        });
      });

      drawText(ctx, '主色:', rx, ry + 312, { size: 13, color: THEME.TX2 });
      PRIMARY_PALETTE.forEach((col, i) => {
        const sx = rx + 50 + i * 44;
        const sel = this.primaryColor === col;
        drawRoundRect(ctx, sx, ry + 296, 34, 32, 6, col, sel ? '#FFFFFF' : THEME.BORDER, sel ? 2.5 : 1);
        if (sel) drawIcon(ctx, 'check', sx + 17, ry + 312, 14, '#FFFFFF');
        hits.add(sx, ry + 296, 34, 32, () => {
          SoundEngine.playClick();
          this.primaryColor = col;
        });
      });

      drawText(ctx, '副色:', rx, ry + 364, { size: 13, color: THEME.TX2 });
      SECONDARY_PALETTE.forEach((col, i) => {
        const sx = rx + 50 + i * 44;
        const sel = this.secondaryColor === col;
        drawRoundRect(ctx, sx, ry + 348, 34, 32, 6, col, sel ? THEME.GOLD_LIGHT : THEME.BORDER, sel ? 2.5 : 1);
        if (sel) {
          const checkCol = col === '#F8FAFC' || col === '#FACC15' ? '#090D16' : '#FFFFFF';
          drawIcon(ctx, 'check', sx + 17, ry + 364, 14, checkCol);
        }
        hits.add(sx, ry + 348, 34, 32, () => {
          SoundEngine.playClick();
          this.secondaryColor = col;
        });
      });
    } else if (this.wizardStep === 2) {
      drawText(ctx, '为你的俱乐部命名', rx, ry + 24, { size: 16, bold: true, color: THEME.GOLD_LIGHT });
      drawText(ctx, '支持点击输入框自定义（最多 12 字），或使用内置中文队名库随机生成', rx, ry + 54, {
        size: 12,
        color: THEME.TX2,
      });
      drawRoundRect(ctx, rx, ry + 96, 580, 56, 8, THEME.BG_CARD, hits.isHovered(rx, ry + 96, 580, 56) ? THEME.GOLD : THEME.BORDER_GOLD);
      drawText(ctx, this.customName, rx + 22, ry + 124, { size: 22, bold: true, color: THEME.TX1 });
      drawIcon(ctx, 'edit', rx + 504, ry + 124, 14, THEME.GOLD_LIGHT);
      drawText(ctx, '点击编辑', rx + 564, ry + 124, { size: 12, color: THEME.GOLD_LIGHT, align: 'right' });
      if (actions.onEditName) {
        hits.add(rx, ry + 96, 580, 56, () => {
          SoundEngine.playClick();
          actions.onEditName!(this.customName, (next) => {
            this.customName = next;
          });
        });
      }
      drawButton(ctx, hits, rx, ry + 176, 220, 44, '随机生成中文队名', () => {
        this.customName = generateFictionalClubName();
      }, { variant: 'primary', fontSize: 13, icon: 'dice' });
    } else {
      drawText(ctx, '选择初始阵型 (4/3/5后卫)', rx, ry + 14, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
      SYS_TABS.forEach((sys, si) => {
        const lbl = sys === '4-back' ? '四后卫 (8)' : sys === '3-back' ? '三后卫 (4)' : '五后卫 (4)';
        drawButton(ctx, hits, rx + 220 + si * 120, ry + 2, 112, 24, lbl, () => {
          this.sysTab = sys;
        }, { active: this.sysTab === sys, fontSize: 11 });
      });
      const forms = FORMATION_SYSTEMS[this.sysTab].formations;
      forms.forEach((f, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        drawButton(ctx, hits, rx + col * 146, ry + 34 + row * 32, 138, 28, f, () => {
          this.formation = f;
          this.sysTab = getDefenseSystem(f);
        }, { active: this.formation === f, fontSize: 12 });
      });

      drawText(ctx, '选择战术哲学', rx, ry + 108, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
      STYLE_LIST.forEach((s, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        drawButton(ctx, hits, rx + col * 194, ry + 132 + row * 52, 182, 42, TACTICAL_PRESETS[s].name, () => {
          this.style = s;
        }, { active: this.style === s });
      });

      const preset = TACTICAL_PRESETS[this.style];
      drawChamferPanel(ctx, rx, ry + 260, 580, 96, 8, THEME.BG_CARD, THEME.BORDER);
      drawText(ctx, `当前哲学：${preset.name}`, rx + 18, ry + 286, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
      drawText(
        ctx,
        `防线 ${preset.lineHeight >= 0 ? '+' : ''}${preset.lineHeight}m · 节奏 ${preset.tempo.toFixed(2)}x · 压迫 ${preset.pressIntensity.toFixed(2)}x`,
        rx + 562,
        ry + 286,
        { size: 11, color: '#38BDF8', align: 'right', mono: true }
      );
      drawText(ctx, STYLE_HINTS[this.style], rx + 18, ry + 322, { size: 13, color: THEME.TX2 });
    }

    if (this.wizardStep > 1) {
      drawButton(ctx, hits, rx, my + mh - 64, 140, 42, '上一步', () => {
        this.wizardStep = (this.wizardStep - 1) as 1 | 2 | 3;
      }, { variant: 'ghost', fontSize: 13 });
    }
    if (this.wizardStep < 3) {
      drawButton(ctx, hits, mx + mw - 208, my + mh - 64, 180, 42, '下一步', () => {
        this.wizardStep = (this.wizardStep + 1) as 1 | 2 | 3;
      }, { variant: 'primary', fontSize: 14, icon: 'play' });
    } else {
      drawButton(ctx, hits, mx + mw - 278, my + mh - 64, 250, 42, '确认建队并进入选秀', () => {
        this.wizardOpen = false;
        actions.onStartNewSeason({
          clubId: this.selectedClubId,
          customName: this.customName,
          primaryColor: this.primaryColor,
          secondaryColor: this.secondaryColor,
          formation: this.formation,
          style: this.style,
        });
      }, { variant: 'gold', fontSize: 14, icon: 'sparkle' });
    }
  }
}
