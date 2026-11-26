/**
 * 现代化的 8 步场景触发式新手引导系统（全屏聚光灯挖空 + 破框老恩师大立绘 + 暖色高对比战术气泡 + 点击穿透）
 * 第 1 赛季由老恩师在场边督导玩家（#10 林锋）熟悉俱乐部运转；第 2 赛季起林锋正式挂靴任主帅。
 */

import { LeagueManager } from '../../core/src/LeagueManager';
import { AssetLoader } from './AssetLoader';
import {
  drawBadge,
  drawButton,
  drawRoundRect,
  drawText,
  drawWrappedText,
  HitRegistry,
} from './CanvasKit';
import { THEME } from './Theme';

export type TutorialStepKey =
  | 'draft'
  | 'portal_summer'
  | 'portal_prep'
  | 'portal_scout'
  | 'tactics'
  | 'cards'
  | 'match'
  | 'post_match';

interface StepSpec {
  stepNum: string;
  title: string;
  body: string;
  x: number;
  y: number;
  w: number;
  h: number;
  highlight: { x: number; y: number; w: number; h: number };
  arrowTo?: { x: number; y: number };
}

const STEP_CONFIG: Record<TutorialStepKey, StepSpec> = {
  draft: {
    stepNum: '引导 1/8 · 核心开包',
    title: '每轮 5 选 3 组建骨架',
    body: '从 5 名试训球员中挑选 3 人入队，选满后点底部确认。',
    x: 330,
    y: 604,
    w: 640,
    h: 108,
    highlight: { x: 52, y: 168, w: 1176, h: 432 },
    arrowTo: { x: 640, y: 598 },
  },
  portal_summer: {
    stepNum: '引导 2/8 · 季前夏窗',
    title: '凑齐 26 人大名单开赛',
    body: '点击左侧「前往引援中心」或直接免签青训补齐 26 人。',
    x: 392,
    y: 158,
    w: 560,
    h: 132,
    highlight: { x: 106, y: 302, w: 572, h: 60 },
    arrowTo: { x: 480, y: 302 },
  },
  portal_prep: {
    stepNum: '引导 3/8 · 赛前整备',
    title: '理疗 · 训练 · 更衣室谈话',
    body: '每轮开球前有 1 次整备机会，可恢复体能或加赛前 Buff。',
    x: 704,
    y: 404,
    w: 540,
    h: 136,
    highlight: { x: 96, y: 386, w: 590, h: 318 },
    arrowTo: { x: 686, y: 472 },
  },
  portal_scout: {
    stepNum: '引导 4/8 · 战前录像室',
    title: '抓出破绽，解锁克制红利',
    body: '排错烟雾弹并指证真破绽，即可二选一强力赛中红利。',
    x: 704,
    y: 198,
    w: 540,
    h: 136,
    highlight: { x: 108, y: 238, w: 566, h: 66 },
    arrowTo: { x: 674, y: 270 },
  },
  tactics: {
    stepNum: '引导 5/8 · 战术室',
    title: '点选球员调站位 · 换人需点按钮',
    body: '点击球员打开周边浮层，可调角色、微调站位或触发换人。',
    x: 590,
    y: 486,
    w: 566,
    h: 136,
    highlight: { x: 96, y: 80, w: 462, h: 590 },
    arrowTo: { x: 558, y: 546 },
  },
  cards: {
    stepNum: '引导 6/8 · 指挥手牌工坊',
    title: '元素合成 · 4 槽出战卡组',
    body: '元素入炉合成强力手牌，装入上方 4 槽即可带进比赛日。',
    x: 350,
    y: 342,
    w: 580,
    h: 136,
    highlight: { x: 96, y: 78, w: 1154, h: 224 },
    arrowTo: { x: 640, y: 302 },
  },
  match: {
    stepNum: '引导 7/8 · 比赛日指挥',
    title: '手牌控场 + 子弹时间主动技',
    body: '看准节奏打出右下角手牌，关键时刻按 F 释放主动技。',
    x: 112,
    y: 386,
    w: 472,
    h: 136,
    highlight: { x: 610, y: 556, w: 410, h: 152 },
    arrowTo: { x: 610, y: 622 },
  },
  post_match: {
    stepNum: '引导 8/8 · 赛后补强',
    title: '战利品 3 选 1 滚雪球',
    body: '每场赛后挑 1 项强化并领元素，季末结算点数永久升级天赋。',
    x: 350,
    y: 526,
    w: 580,
    h: 136,
    highlight: { x: 96, y: 138, w: 1148, h: 350 },
    arrowTo: { x: 640, y: 488 },
  },
};

export class TutorialOverlay {
  private pulseTime = 0;

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    step: TutorialStepKey,
    onUpdate: () => void
  ): void {
    const tut = league.getTutorialProgress();
    if (tut.skippedAll || tut[step]) return;

    this.pulseTime += 0.04;
    const pulse = 0.55 + 0.45 * Math.sin(this.pulseTime * 3.2);
    const cfg = STEP_CONFIG[step];
    const h = cfg.highlight;

    // 1. 全屏聚光灯暗角挖空（仅高亮区透亮，其余区域压暗退居背景）
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, THEME.W, THEME.H);
    ctx.roundRect(h.x, h.y, h.w, h.h, 12);
    ctx.fillStyle = 'rgba(2, 6, 16, 0.72)';
    ctx.fill('evenodd');

    // 挖空区呼吸金色光环
    ctx.shadowColor = 'rgba(250, 204, 21, 0.75)';
    ctx.shadowBlur = 14 + pulse * 10;
    ctx.strokeStyle = `rgba(254, 240, 138, ${(0.70 + pulse * 0.30).toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(h.x, h.y, h.w, h.h, 12);
    ctx.stroke();
    ctx.restore();

    // 2. 四周遮罩拦截误触，挖空区本身允许直接点击穿透到底层按钮/卡片
    if (h.y > 0) hits.add(0, 0, THEME.W, h.y, () => {});
    if (h.y + h.h < THEME.H) hits.add(0, h.y + h.h, THEME.W, THEME.H - (h.y + h.h), () => {});
    if (h.x > 0) hits.add(0, h.y, h.x, h.h, () => {});
    if (h.x + h.w < THEME.W) hits.add(h.x + h.w, h.y, THEME.W - (h.x + h.w), h.h, () => {});

    // 3. 动态指示线 + 箭头指向目标区
    if (cfg.arrowTo) {
      const fromX = Math.max(cfg.x, Math.min(cfg.x + cfg.w, cfg.arrowTo.x));
      const fromY = Math.max(cfg.y, Math.min(cfg.y + cfg.h, cfg.arrowTo.y));
      const dx = cfg.arrowTo.x - fromX;
      const dy = cfg.arrowTo.y - fromY;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        const ang = Math.atan2(dy, dx);
        const shift = Math.sin(this.pulseTime * 4) * 4;
        const tipX = cfg.arrowTo.x - Math.cos(ang) * (4 - shift);
        const tipY = cfg.arrowTo.y - Math.sin(ang) * (4 - shift);
        ctx.save();
        ctx.strokeStyle = '#FEF08A';
        ctx.fillStyle = '#FEF08A';
        ctx.lineWidth = 2.8;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(tipX - Math.cos(ang) * 8, tipY - Math.sin(ang) * 8);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(ang - 0.48) * 12, tipY - Math.sin(ang - 0.48) * 12);
        ctx.lineTo(tipX - Math.cos(ang + 0.48) * 12, tipY - Math.sin(ang + 0.48) * 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 4. 暖色羊皮纸高对比战术气泡（与深蓝赛博 UI 形成强烈视觉剥离）
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 6;
    drawRoundRect(ctx, cfg.x, cfg.y, cfg.w, cfg.h, 14, '#FEF9E7', '#D97706', 2.6);
    ctx.restore();
    hits.add(cfg.x, cfg.y, cfg.w, cfg.h, () => {});

    // 顶部暖金装饰条
    drawRoundRect(ctx, cfg.x + 2, cfg.y + 2, cfg.w - 4, 6, 3, '#F59E0B');

    // 5. 破框探出的老恩师大号立绘（92×92）
    const mentorImg = AssetLoader.get('portrait_mentor');
    const textLeft = mentorImg ? cfg.x + 86 : cfg.x + 18;
    const textW = mentorImg ? cfg.w - 104 : cfg.w - 36;
    if (mentorImg && typeof ctx.drawImage === 'function') {
      const px = cfg.x - 14;
      const py = cfg.y - 12;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 10;
      drawRoundRect(ctx, px, py, 88, 88, 14, '#78350F', '#F59E0B', 2.6);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, 84, 84, 12);
      ctx.clip();
      ctx.drawImage(mentorImg, px + 2, py + 2, 84, 84);
      ctx.restore();
      drawBadge(ctx, px - 2, py + 76, 92, 18, '老恩师·督导', '#78350F', '#FEF08A');
    }

    drawBadge(ctx, textLeft, cfg.y + 14, 188, 20, cfg.stepNum, '#92400E', '#FEF3C7');
    drawText(ctx, cfg.title, textLeft + 196, cfg.y + 24, {
      size: 13.5,
      bold: true,
      color: '#1E293B',
    });
    drawWrappedText(ctx, cfg.body, textLeft, cfg.y + 44, textW, 17.5, {
      size: 11.5,
      color: '#334155',
      maxLines: 3,
    });

    // 底部按钮（深色字体/高对比按钮）
    drawButton(ctx, hits, cfg.x + cfg.w - 224, cfg.y + cfg.h - 34, 108, 26, '跳过全部引导', () => {
      league.markTutorialStep('skipAll');
      onUpdate();
    }, { variant: 'ghost', fontSize: 10 });

    drawButton(ctx, hits, cfg.x + cfg.w - 108, cfg.y + cfg.h - 34, 94, 26, '明白了 ▶', () => {
      league.markTutorialStep(step);
      onUpdate();
    }, { variant: 'gold', fontSize: 11 });
  }
}
