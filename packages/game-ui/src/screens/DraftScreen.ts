/**
 * 页面 1：开局 3 次核心开包（防守核心包 → 中场大脑包 → 锋线尖刀包），每包 5 选 3
 * 复用赛后肉鸽撕包光爆 + 3D 翻牌动效与美术素材
 * 选完 9 名核心球员后，与 11 名本地草根班底组成 20 人阵容，正式进入夏季转会窗（只差 6 人）
 */

import { LeagueManager } from '../../../core/src/LeagueManager';
import { CorePackLine, DraftPlayer } from '../../../core/src/types';
import { AssetLoader } from '../AssetLoader';
import { drawPlayerAvatar } from '../AvatarRenderer';
import {
  drawBadge,
  drawBroadcastHeader,
  drawButton,
  drawChamferPanel,
  drawFoilShimmer,
  drawRoundRect,
  drawText,
  fitText,
  FONT,
  HitRegistry,
  tierColor,
} from '../CanvasKit';
import { easeOutBack, easeOutCubic } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';

const LINE_META: Record<CorePackLine, { title: string; badge: string; desc: string; color: string }> = {
  DEF: {
    title: '慕名投奔 · 后防旧部与门将 (5选3)',
    badge: '第 1 / 3 批 · 铁血防线',
    desc: '听闻你重返教练席，5 名后防旧部与年轻门将慕名赶来试训，从中挑选 3 人签入一线队',
    color: THEME.GREEN,
  },
  MID: {
    title: '慕名投奔 · 中场追随者 (5选3)',
    badge: '第 2 / 3 批 · 节拍引擎',
    desc: '你的执教口碑传开后，5 名中场指挥官主动递交投名状，从中挑选 3 人掌控中场节奏',
    color: '#38BDF8',
  },
  ATT: {
    title: '慕名投奔 · 锋线尖刀与新星 (5选3)',
    badge: '第 3 / 3 批 · 终结王牌',
    desc: '最后一批慕名而来的锋线杀手与天才小将已抵达训练场，挑选 3 人完成建队拼图',
    color: THEME.GOLD_LIGHT,
  },
};

const CORE_ARCHETYPE_META: Record<'veteran' | 'balanced' | 'wonderkid', { label: string; hint: string; bg: string; color: string }> = {
  veteran: {
    label: '追随旧部 · 即战老将',
    hint: '冲着老交情来扛鼎，PA 见顶且季末微衰',
    bg: '#78350F',
    color: '#FDE047',
  },
  balanced: {
    label: '慕名中坚 · 当打主力',
    hint: '仰慕你的战术而来，上限高于老将可扛多季',
    bg: '#0C4A6E',
    color: '#7DD3FC',
  },
  wonderkid: {
    label: '慕名新星 · 高潜小妖',
    hint: '冲着青训口碑投奔，拥有全队最高 PA 上限',
    bg: '#4C1D95',
    color: '#E9D5FF',
  },
};

export class DraftScreen {
  private animClock = 0;
  private signToast: { text: string; timer: number } | null = null;
  private packStage: 'sealed' | 'ripping' | 'reveal' = 'sealed';
  private ripTimer = 0;
  private ripBursted = false;
  private dealTimer = 0;
  private flipped: boolean[] = [false, false, false, false, false];
  private flipTimers: number[] = [0, 0, 0, 0, 0];
  private flipSoundPlayed: boolean[] = [false, false, false, false, false];
  private selectedIds: string[] = [];
  private lastStep = -1;
  private doneTriggered = false;

  private resetPackAnim(): void {
    this.packStage = 'sealed';
    this.ripTimer = 0;
    this.ripBursted = false;
    this.dealTimer = 0;
    this.flipped = [false, false, false, false, false];
    this.flipTimers = [0, 0, 0, 0, 0];
    this.flipSoundPlayed = [false, false, false, false, false];
    this.selectedIds = [];
  }

  public update(dtSec: number): void {
    this.animClock += dtSec;
    if (this.signToast) {
      this.signToast.timer -= dtSec;
      if (this.signToast.timer <= 0) this.signToast = null;
    }
    if (this.packStage === 'ripping') {
      this.ripTimer += dtSec;
      if (this.ripTimer >= 0.56) {
        this.packStage = 'reveal';
        this.dealTimer = 0;
      }
      return;
    }
    if (this.packStage === 'reveal') {
      this.dealTimer += dtSec;
      const autoThresholds = [0.24, 0.44, 0.64, 0.84, 1.04];
      for (let i = 0; i < 5; i++) {
        if (!this.flipped[i] && this.dealTimer >= autoThresholds[i]) {
          this.flipped[i] = true;
        }
        if (this.flipped[i] && this.flipTimers[i] < 0.44) {
          this.flipTimers[i] = Math.min(0.44, this.flipTimers[i] + dtSec);
        }
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    actions: {
      onDone: () => void;
      onSave: () => void;
      onInspectPlayer: (p: DraftPlayer) => void;
      onBurst?: (x: number, y: number, color?: string) => void;
      onRequestAutoComplete?: () => void;
    }
  ): void {
    const st = league.getState();
    const club = league.getUserClub();
    const cpd = league.getCorePackDraftState();
    const step = cpd.step;

    if (step >= 3 || st.phase !== 'INIT_DRAFT') {
      if (!this.doneTriggered) {
        this.doneTriggered = true;
        actions.onDone();
      }
      return;
    }

    this.doneTriggered = false;
    if (step !== this.lastStep) {
      this.lastStep = step;
      this.resetPackAnim();
    }

    const line = cpd.lines[step] ?? 'DEF';
    const meta = LINE_META[line];

    drawBroadcastHeader(ctx, hits, {
      kicker: `COACH REPUTATION · 慕名投奔试训 (${step + 1}/3)`,
      title: `${club.name} · 慕名而来的建队班底 (5选3)`,
      club,
      badge: `当前班底 ${club.squad.length} / 20 人`,
      clubFunds: league.getClubFunds(),
      metaPoints: st.metaPointsTotal,
      showSoundToggle: true,
    });

    // 顶部进度条：防守 -> 中场 -> 前锋 -> 夏窗引援
    drawRoundRect(ctx, 16, 78, 1248, 44, 8, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    const stepLabels = ['1. 后防核心包 (5选3)', '2. 中场大脑包 (5选3)', '3. 锋线尖刀包 (5选3)', '4. 进入夏窗 (20→26人)'];
    stepLabels.forEach((lbl, i) => {
      const done = i < step;
      const active = i === step;
      drawBadge(
        ctx,
        36 + i * 308,
        88,
        280,
        24,
        done ? `✓ ${lbl}` : lbl,
        done ? '#14532D' : active ? '#1E3A5F' : '#0F172A',
        done ? THEME.GREEN : active ? THEME.GOLD_LIGHT : THEME.TX3
      );
    });

    const packImg = AssetLoader.get('pack_recruit');
    const burstFxImg = AssetLoader.get('pack_burst_fx');
    const cardBackArt = AssetLoader.get('command_card_back');

    // ==================== 阶段 A：密封卡包等待撕开 ====================
    if (this.packStage === 'sealed') {
      const floatY = Math.sin(this.animClock * 2.4) * 6;
      const cx = 640;
      const cy = 358 + floatY;
      const hovered = hits.isHovered(cx - 160, cy - 200, 320, 400);

      ctx.save();
      const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 250);
      glow.addColorStop(0, meta.color + (hovered ? '66' : '44'));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 250, 0, Math.PI * 2);
      ctx.fill();

      drawText(ctx, meta.title, cx, 152, { size: 22, bold: true, color: meta.color, align: 'center' });
      drawText(ctx, meta.desc, cx, 182, { size: 13.5, color: THEME.TX2, align: 'center' });

      if (packImg && typeof ctx.drawImage === 'function') {
        const sc = hovered ? 1.06 : 1.0;
        const pw = Math.round(212 * sc);
        const ph = Math.round(284 * sc);
        ctx.drawImage(packImg, cx - pw / 2, cy - ph / 2 - 6, pw, ph);
      } else {
        drawChamferPanel(ctx, cx - 120, cy - 150, 240, 300, 14, '#0F172A', meta.color, 2.4, meta.color);
      }
      drawFoilShimmer(ctx, cx - 110, cy - 145, 220, 290, this.animClock * 1.1, meta.color + '44');
      ctx.restore();

      const ripNow = () => {
        SoundEngine.playPackRip();
        this.packStage = 'ripping';
        this.ripTimer = 0;
        this.ripBursted = false;
      };
      drawButton(ctx, hits, cx - 150, 526, 300, 48, `撕开${meta.badge.split('·')[1].trim()}包 ▶`, ripNow, {
        variant: 'gold',
        fontSize: 15,
        icon: 'sparkle',
      });
      hits.add(cx - 140, cy - 160, 280, 320, ripNow);
      this.renderPickedSummaryBar(ctx, club.squad, cpd.pickedCores);
      return;
    }

    // ==================== 阶段 B：开包撕裂光爆动画 (0 -> 0.56s) ====================
    if (this.packStage === 'ripping') {
      const t = this.ripTimer;
      if (t >= 0.36 && !this.ripBursted) {
        this.ripBursted = true;
        actions.onBurst?.(640, 350, meta.color);
        SoundEngine.playBreakthrough();
      }
      ctx.save();
      ctx.fillStyle = 'rgba(4, 7, 14, 0.72)';
      ctx.fillRect(0, 126, THEME.W, THEME.H - 126);

      if (t < 0.36) {
        const shakeAmp = t > 0.14 ? (t - 0.14) * 34 : 0;
        const jx = (Math.random() * 2 - 1) * shakeAmp;
        const jy = (Math.random() * 2 - 1) * shakeAmp;
        const scale = 1 + 0.25 * easeOutCubic(Math.min(1, t / 0.24));

        const radGrad = ctx.createRadialGradient(640 + jx, 350 + jy, 18, 640 + jx, 350 + jy, 270);
        radGrad.addColorStop(0, meta.color + 'AA');
        radGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(640 + jx, 350 + jy, 270, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(640 + jx, 350 + jy);
        ctx.scale(scale, scale);
        if (packImg && typeof ctx.drawImage === 'function') {
          ctx.drawImage(packImg, -120, -162, 240, 324);
        } else {
          drawChamferPanel(ctx, -140, -180, 280, 360, 14, '#0F172A', meta.color, 2.6, meta.color);
        }
        if (t > 0.16) {
          const beamP = (t - 0.16) / 0.20;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3 + beamP * 10;
          ctx.shadowColor = meta.color;
          ctx.shadowBlur = 24;
          ctx.beginPath();
          ctx.moveTo(0, -180);
          ctx.lineTo(0, 180);
          ctx.stroke();
        }
      } else {
        const postP = (t - 0.36) / 0.20;
        const flashP = Math.max(0, 1 - postP);
        if (burstFxImg && typeof ctx.drawImage === 'function') {
          const bScale = 0.65 + postP * 1.15;
          const bw = 760 * bScale;
          const bh = 425 * bScale;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = Math.min(1, flashP * 1.25);
          ctx.drawImage(burstFxImg, 640 - bw / 2, 350 - bh / 2, bw, bh);
          ctx.restore();
        }
        ctx.fillStyle = `rgba(255, 250, 220, ${Math.max(0, flashP * 0.45)})`;
        ctx.fillRect(0, 126, THEME.W, THEME.H - 126);
      }
      ctx.restore();
      return;
    }

    // ==================== 阶段 C：5 张核心球员卡 3D 翻牌 5 选 3 ====================
    const choices = cpd.currentChoices.slice(0, 5);
    const needPick = Math.min(3, choices.length);
    drawText(ctx, `${meta.title} — 点击勾选 ${needPick} 名球员入队（已选 ${this.selectedIds.length}/${needPick}）`, 640, 148, {
      size: 16.5,
      bold: true,
      color: meta.color,
      align: 'center',
    });

    const allRevealed = choices.every((_, idx) => this.flipped[idx] && this.flipTimers[idx] >= 0.36);
    drawButton(ctx, hits, 926, 134, 150, 30, '一键推荐选满', () => {
      this.flipped = [true, true, true, true, true];
      this.flipTimers = [0.24, 0.24, 0.24, 0.24, 0.24];
      this.selectedIds = [...choices]
        .sort((a, b) => (b.ca * 0.7 + (b.pa ?? b.ca) * 0.3) - (a.ca * 0.7 + (a.pa ?? a.ca) * 0.3))
        .slice(0, needPick)
        .map(p => p.id);
      SoundEngine.playClick();
    }, { variant: 'gold', fontSize: 11.5, icon: 'sparkle' });
    if (!allRevealed) {
      drawButton(ctx, hits, 1086, 134, 154, 30, '一键全翻', () => {
        this.flipped = [true, true, true, true, true];
        this.flipTimers = [0.24, 0.24, 0.24, 0.24, 0.24];
      }, { variant: 'primary', fontSize: 12, icon: 'sparkle' });
    }

    const cw = 224;
    const ch = 366;
    const gap = 16;
    const startX = (THEME.W - (choices.length * cw + Math.max(0, choices.length - 1) * gap)) / 2;

    const toggleSelect = (pid: string) => {
      const idx = this.selectedIds.indexOf(pid);
      if (idx >= 0) {
        this.selectedIds.splice(idx, 1);
      } else if (this.selectedIds.length < needPick) {
        this.selectedIds.push(pid);
      } else {
        this.selectedIds.shift();
        this.selectedIds.push(pid);
      }
      SoundEngine.playClick();
    };

    choices.forEach((p, idx) => {
      const targetX = startX + idx * (cw + gap);
      const targetY = 172;

      const dealP = easeOutBack(Math.max(0, Math.min(1, (this.dealTimer - idx * 0.04) / 0.32)));
      const cx = 640 - cw / 2 + (targetX - (640 - cw / 2)) * dealP;
      const cy = 350 - ch / 2 + (targetY - (350 - ch / 2)) * dealP;

      const fp = this.flipped[idx] ? Math.min(1, this.flipTimers[idx] / 0.44) : 0;
      const showFront = fp >= 0.5;
      const scaleX = Math.max(0.06, Math.abs(Math.cos(fp * Math.PI)));
      const rCol = p.tier === 'S' ? THEME.GOLD_LIGHT : p.tier === 'A' ? '#C084FC' : '#38BDF8';

      if (showFront && !this.flipSoundPlayed[idx]) {
        this.flipSoundPlayed[idx] = true;
        SoundEngine.playCardFlip(p.tier === 'S' ? 'epic' : p.tier === 'A' ? 'rare' : 'common');
        actions.onBurst?.(targetX + cw / 2, targetY + ch / 2, rCol);
      }

      const isPicked = this.selectedIds.includes(p.id);
      const hovered = showFront && fp >= 0.9 && hits.isHovered(cx, cy, cw, ch);

      ctx.save();
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.scale(scaleX, 1);
      ctx.translate(-(cx + cw / 2), -(cy + ch / 2));

      if (!showFront) {
        ctx.shadowColor = meta.color;
        ctx.shadowBlur = 16;
        drawChamferPanel(ctx, cx, cy, cw, ch, 12, '#0B1324', meta.color, 2, meta.color);
        if (cardBackArt && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx + 5, cy + 5, cw - 10, ch - 10);
          ctx.clip();
          ctx.globalAlpha = 0.55;
          ctx.drawImage(cardBackArt, cx + 5, cy + 5, cw - 10, ch - 10);
          ctx.restore();
        }
        drawFoilShimmer(ctx, cx, cy, cw, ch, this.animClock * 1.4 + idx, meta.color + '44');
        drawBadge(ctx, cx + cw / 2 - 50, cy + ch / 2 - 14, 100, 28, '点击翻开', 'rgba(8,12,22,0.9)', meta.color);
        ctx.restore();
        hits.add(cx, cy, cw, ch, () => {
          this.flipped[idx] = true;
        });
        return;
      }

      const archKey: 'veteran' | 'balanced' | 'wonderkid' = p.coreTag ?? (idx === 0 ? 'veteran' : idx <= 2 ? 'balanced' : 'wonderkid');
      const arch = CORE_ARCHETYPE_META[archKey];
      const cardBorder = isPicked ? THEME.GREEN : hovered ? THEME.GOLD_LIGHT : arch.color;

      if (isPicked || hovered) {
        ctx.shadowColor = isPicked ? THEME.GREEN : arch.color;
        ctx.shadowBlur = isPicked ? 24 : 18;
      }
      drawChamferPanel(
        ctx,
        cx,
        cy,
        cw,
        ch,
        12,
        isPicked ? '#112A22' : hovered ? '#1B2B4B' : THEME.BG_PANEL,
        cardBorder,
        isPicked ? 2.6 : hovered ? 2.2 : 1.5,
        isPicked ? THEME.GREEN : arch.color
      );
      drawFoilShimmer(ctx, cx, cy, cw, ch, this.animClock * 1.1 + idx * 0.5, arch.color + '24');

      drawBadge(ctx, cx + 12, cy + 10, cw - 24, 20, arch.label, arch.bg, arch.color);

      drawBadge(ctx, cx + 12, cy + 36, 36, 18, p.role, '#1E293B', THEME.TX1);
      drawBadge(ctx, cx + 52, cy + 36, 34, 18, `${p.tier}级`, tierColor(p.tier));
      drawBadge(ctx, cx + 90, cy + 36, 40, 18, `${p.age}岁`, '#1E3A5F', '#7DD3FC');
      drawText(ctx, `${p.ca}/${p.pa ?? p.ca}`, cx + cw - 12, cy + 45, {
        size: 12.5,
        bold: true,
        color: archKey === 'wonderkid' ? '#E9D5FF' : archKey === 'balanced' ? '#7DD3FC' : THEME.GOLD_LIGHT,
        align: 'right',
        mono: true,
      });

      drawPlayerAvatar(ctx, cx + cw / 2 - 30, cy + 62, 60, 74, p, club, { radius: 8 });
      drawText(ctx, fitText(ctx, p.name, cw - 20, FONT.TITLE, true, true), cx + cw / 2, cy + 150, { token: 'TITLE', bold: true, color: THEME.TX1, align: 'center' });
      drawText(ctx, fitText(ctx, p.traits?.slice(0, 2).join(' · ') || '建队核心', cw - 24, FONT.MICRO, false, true), cx + cw / 2, cy + 170, {
        token: 'MICRO',
        color: '#C4B5FD',
        align: 'center',
      });

      const pairs: Array<[string, number]> = p.role === 'GK'
        ? [
            ['扑', p.attributes.goalkeeping],
            ['站', p.attributes.positioning],
            ['冷', p.attributes.composure],
            ['传', p.attributes.passing],
            ['力', p.attributes.strength],
            ['体', p.attributes.stamina],
          ]
        : [
            ['速', p.attributes.pace],
            ['射', p.attributes.shooting],
            ['传', p.attributes.passing],
            ['盘', p.attributes.dribbling],
            ['防', p.attributes.defending],
            ['体', p.attributes.stamina],
          ];
      pairs.forEach(([lbl, val], pi) => {
        const col = pi % 2;
        const row = Math.floor(pi / 2);
        const ax = cx + 12 + col * 102;
        const ay = cy + 186 + row * 26;
        drawRoundRect(ctx, ax, ay, 98, 22, 4, 'rgba(11, 17, 30, 0.86)', THEME.BORDER);
        drawText(ctx, lbl, ax + 8, ay + 11, { token: 'MICRO', color: THEME.TX2 });
        drawText(ctx, `${val}`, ax + 90, ay + 11, { token: 'LABEL', bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      });

      drawText(ctx, fitText(ctx, arch.hint, cw - 20, FONT.MICRO, true, true), cx + cw / 2, cy + 274, {
        token: 'MICRO',
        bold: true,
        color: arch.color,
        align: 'center',
      });
      const roleValLine = `兼:${p.secondaryRoles?.join('/') || '专职'} · ¥${p.marketValue ?? p.cost}万`;
      drawText(ctx, fitText(ctx, roleValLine, cw - 20, FONT.MICRO, false, true), cx + cw / 2, cy + 292, {
        token: 'MICRO',
        color: THEME.TX2,
        align: 'center',
      });

      // 底部：游戏化「SIGNED ✓」印章 / 点击提示 + 右下角紧凑「i 档案」胶囊
      if (isPicked) {
        ctx.save();
        ctx.translate(cx + 68, cy + ch - 22);
        ctx.rotate(-0.08);
        drawRoundRect(ctx, -50, -13, 100, 26, 4, 'rgba(6, 78, 59, 0.92)', THEME.GREEN, 1.8);
        drawText(ctx, 'SIGNED ✓', 0, 0, { size: 12, bold: true, color: '#86EFAC', align: 'center', mono: true });
        ctx.restore();
      } else {
        drawText(ctx, hovered ? '点击签入大名单 +' : '点击整卡签入', cx + 14, cy + ch - 21, {
          size: 10.5,
          bold: hovered,
          color: hovered ? THEME.GOLD_LIGHT : THEME.TX3,
        });
      }
      ctx.restore();

      if (fp >= 0.8) {
        hits.add(cx, cy, cw, ch, () => toggleSelect(p.id));

        const infoX = cx + cw - 58;
        const infoY = cy + ch - 31;
        const infoHover = hits.isHovered(infoX, infoY, 46, 20);
        drawRoundRect(
          ctx,
          infoX,
          infoY,
          46,
          20,
          10,
          infoHover ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.85)',
          infoHover ? '#7DD3FC' : 'rgba(148, 163, 184, 0.35)',
          1
        );
        drawText(ctx, 'i 档案', infoX + 23, infoY + 10, {
          token: 'MICRO',
          bold: infoHover,
          color: infoHover ? '#BAE6FD' : THEME.TX2,
          align: 'center',
        });
        hits.addTouchTarget(infoX, infoY, 46, 20, () => {
          SoundEngine.playClick();
          actions.onInspectPlayer(p);
        });
      }
    });

    const readyConfirm = this.selectedIds.length === needPick;
    if (readyConfirm) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(436, 546, 408, 54);
      ctx.restore();
      drawButton(
        ctx,
        hits,
        440,
        550,
        400,
        46,
        step === 2 ? '吹哨集结 · 签入这 3 人开启夏窗 ▶' : '吹哨集结 · 签入这 3 人进入下一包 ▶',
        () => {
          const res = league.pickCorePackPlayers(this.selectedIds);
          if (res.ok) {
            SoundEngine.playRewardChime();
            actions.onBurst?.(420, 340, THEME.GOLD_LIGHT);
            actions.onBurst?.(640, 320, THEME.GREEN);
            actions.onBurst?.(860, 340, THEME.GOLD_LIGHT);
            const addedVal = (res.players ?? []).reduce((s, x) => s + (x.marketValue ?? x.cost), 0);
            const avgAddedCa = res.players?.length ? Math.round(res.players.reduce((s, x) => s + x.ca, 0) / res.players.length) : 0;
            this.signToast = {
              text: `签入成功！3 名新援入队（均分 CA ${avgAddedCa} · 身价 +¥${addedVal}万）`,
              timer: 2.0,
            };
            actions.onSave();
            if (res.completed) {
              this.doneTriggered = true;
              actions.onDone();
            } else {
              this.resetPackAnim();
            }
          }
        },
        { variant: 'gold', fontSize: 14, icon: 'sparkle' }
      );
    } else {
      // 未满 3 人时：3 个更衣室名牌空位槽替代死板的灰色禁用按钮
      const slotW = 148;
      const slotGap = 12;
      const slotsX = 640 - (needPick * slotW + (needPick - 1) * slotGap) / 2;
      for (let si = 0; si < needPick; si++) {
        const sx = slotsX + si * (slotW + slotGap);
        const sy = 550;
        const pickedId = this.selectedIds[si];
        const pickedPlayer = pickedId ? choices.find(c => c.id === pickedId) : undefined;
        if (pickedPlayer) {
          drawRoundRect(ctx, sx, sy, slotW, 46, 8, 'rgba(6, 78, 59, 0.72)', THEME.GREEN, 1.4);
          drawPlayerAvatar(ctx, sx + 8, sy + 6, 28, 34, pickedPlayer, club, { radius: 4 });
          drawText(ctx, fitText(ctx, pickedPlayer.name, 96, 11.5, true), sx + 42, sy + 16, {
            size: 11.5,
            bold: true,
            color: THEME.TX1,
          });
          drawText(ctx, `${pickedPlayer.role} · CA ${pickedPlayer.ca}`, sx + 42, sy + 33, {
            size: 9.5,
            color: '#86EFAC',
            mono: true,
          });
          hits.add(sx, sy, slotW, 46, () => toggleSelect(pickedPlayer.id));
        } else {
          ctx.save();
          ctx.setLineDash([4, 3]);
          drawRoundRect(ctx, sx, sy, slotW, 46, 8, 'rgba(15, 23, 42, 0.55)', 'rgba(148, 163, 184, 0.3)', 1.2);
          ctx.restore();
          drawText(ctx, `名牌空位 #${si + 1}`, sx + slotW / 2, sy + 23, {
            size: 11,
            color: THEME.TX3,
            align: 'center',
          });
        }
      }
    }

    this.renderPickedSummaryBar(ctx, club.squad, cpd.pickedCores);
    if (this.signToast) {
      const alpha = Math.min(1, this.signToast.timer / 0.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawRoundRect(ctx, 340, 128, 600, 32, 8, 'rgba(6, 78, 59, 0.94)', THEME.GREEN, 1.6);
      drawText(ctx, this.signToast.text, 640, 144, { size: 12.5, bold: true, color: '#FEF08A', align: 'center' });
      ctx.restore();
    }
  }

  private renderPickedSummaryBar(ctx: CanvasRenderingContext2D, squad: DraftPlayer[], pickedCores: DraftPlayer[]): void {
    drawRoundRect(ctx, 16, 610, 1248, 86, 10, 'rgba(14, 22, 40, 0.92)', THEME.BORDER);
    drawText(ctx, `当前 ${squad.length} 人（已抽核心 ${pickedCores.length}/9） → 选秀后 20 人 → 夏窗补至 26 人开赛`, 36, 636, {
      size: 13.5,
      bold: true,
      color: THEME.GOLD_LIGHT,
    });
    drawText(ctx, '11 名草根骨架已就位，每包从 5 名慕名试训球员中挑选 3 人', 36, 666, {
      size: 11.5,
      color: THEME.TX2,
    });
    const recent = pickedCores.slice(-6);
    recent.forEach((p, idx) => {
      const bx = 668 + idx * 96;
      drawRoundRect(ctx, bx, 624, 90, 56, 6, THEME.BG_CARD, THEME.GOLD);
      drawBadge(ctx, bx + 6, 630, 32, 16, p.role, tierColor(p.tier));
      drawText(ctx, `${p.ca}/${p.pa ?? p.ca}`, bx + 84, 638, { size: 9.5, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      drawText(ctx, p.name.slice(0, 4), bx + 45, 662, { size: 11, bold: true, align: 'center' });
    });
  }
}
