/**
 * 可跳过的 7 步场景触发式轻引导气泡（首次进入对应场景时才弹出 + 一句话讲清收益 + 随时可跳过）
 */

import { LeagueManager } from '../../core/src/LeagueManager';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawText,
  drawWrappedText,
  HitRegistry,
} from './CanvasKit';
import { THEME } from './Theme';

export type TutorialStepKey =
  | 'draft'
  | 'portal_prep'
  | 'portal_scout'
  | 'tactics'
  | 'cards'
  | 'match'
  | 'post_match';

const STEP_CONFIG: Record<TutorialStepKey, {
  stepNum: string;
  title: string;
  body: string;
  x: number;
  y: number;
  w: number;
  h: number;
}> = {
  draft: {
    stepNum: '引导 1/7 · 选秀建队',
    title: '挑选或补齐 26 人征战阵容',
    body: '点击候选星卡签入，右上角可【智能补齐】；补齐后可在右侧点“退”微调名单，满意再确认开赛。',
    x: 42,
    y: 138,
    w: 470,
    h: 138,
  },
  portal_prep: {
    stepNum: 'S1 R1 核心 2/3 · 赛前整备',
    title: '天气应对、理疗消疲惫与谈话',
    body: '每轮有 1 次整备行动：理疗可消除疲惫状态防伤病，1对1谈话能拉升关键球员士气与下场属性。',
    x: 108,
    y: 356,
    w: 450,
    h: 138,
  },
  portal_scout: {
    stepNum: '引导 · 对手侦察博弈',
    title: '识破烟雾弹拿 +1 开局能量',
    body: '了解度 <70% 时线索混有 1 条虚假小道消息，对照战绩指证真实破绽可获开局+1能量（答错无惩罚）。',
    x: 108,
    y: 212,
    w: 456,
    h: 138,
  },
  tactics: {
    stepNum: 'S1 R1 核心 1/3 · 战术与袖标',
    title: '直观换人、状态标记与袖标光环',
    body: '点击场上球员或右侧“换上”可双向换人，留意[疲惫/故事]标记；点“设C”任命队长，本人+4全队+2冷静。',
    x: 396,
    y: 136,
    w: 440,
    h: 138,
  },
  cards: {
    stepNum: '引导 · 化学合成实验室',
    title: '赛后元素合成与 4 槽手牌配置',
    body: '每场赛后掉落战术元素，投入实验室可合成或升阶指挥卡；装备进上方 4 个出战槽即可在比赛日打出。',
    x: 420,
    y: 196,
    w: 446,
    h: 138,
  },
  match: {
    stepNum: 'S1 R1 核心 3/3 · 比赛日临场',
    title: '倍速观赛、手牌干预与 5 次换人',
    body: '顶部支持 1x–8x 倍速，点击场上球员可随时调换位置；攒够能量打右下角指挥卡，每场最多换人 5 次。',
    x: 278,
    y: 134,
    w: 440,
    h: 138,
  },
  post_match: {
    stepNum: '引导 7/7 · 赛后奖励与编年史',
    title: '单场 3 选 1 战利品与跨赛季传承',
    body: '每场赛后可在 3 选 1 门类中强化阵容；在【荣誉室】可追踪多赛季编年史，完成后永久铭记球员与高光时刻。',
    x: 792,
    y: 368,
    w: 456,
    h: 138,
  },
};

export class TutorialOverlay {
  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    step: TutorialStepKey,
    onUpdate: () => void
  ): void {
    const tut = league.getTutorialProgress();
    if (tut.skippedAll || tut[step]) return;

    const cfg = STEP_CONFIG[step];
    drawChamferPanel(ctx, cfg.x, cfg.y, cfg.w, cfg.h, 10, 'rgba(10, 16, 30, 0.96)', THEME.GOLD_LIGHT, 1.8, THEME.GOLD_LIGHT);
    hits.add(cfg.x, cfg.y, cfg.w, cfg.h, () => {});

    const st = league.getState();
    const isS1R1 = st.seasonNumber === 1 && st.currentRound === 1;
    const isCore3Step = step === 'tactics' || step === 'portal_prep' || step === 'match';
    const badgeLabel = isS1R1 && isCore3Step ? cfg.stepNum : cfg.stepNum.replace(/^S1 R1 核心 \d\/3 · /, '引导 · ');
    drawBadge(ctx, cfg.x + 14, cfg.y + 12, 206, 20, badgeLabel, isS1R1 && isCore3Step ? '#78350F' : '#1E3A5F', THEME.GOLD_LIGHT);
    drawText(ctx, cfg.title, cfg.x + 14, cfg.y + 48, {
      size: 14,
      bold: true,
      color: THEME.TX1,
    });
    drawWrappedText(ctx, cfg.body, cfg.x + 14, cfg.y + 64, cfg.w - 28, 17, {
      size: 11,
      color: THEME.TX2,
      maxLines: 3,
    });

    drawButton(ctx, hits, cfg.x + cfg.w - 216, cfg.y + cfg.h - 34, 104, 26, '跳过全部引导', () => {
      league.markTutorialStep('skipAll');
      onUpdate();
    }, { variant: 'ghost', fontSize: 10 });

    drawButton(ctx, hits, cfg.x + cfg.w - 104, cfg.y + cfg.h - 34, 90, 26, '知道了', () => {
      league.markTutorialStep(step);
      onUpdate();
    }, { variant: 'gold', fontSize: 11, icon: 'check' });
  }
}
