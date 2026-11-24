/**
 * @fm-league/core - 赛后分层肉鸽事件池与三态概率博弈系统 (x% 正收益 / y% 负收益 / z% 超额收益)
 * - 按 7 级联赛分层：草根(Tier 7-6) / 职业中游(Tier 5-3) / 豪门顶级(Tier 2-1) / 全等级通用参数化事件
 * - 控制单赛季永久属性膨胀，让常规轮聚焦临时/资源调度，焦点轮与危机轮承担高波动博弈
 */

import {
  DraftPlayer,
  GambleOutcomeTier,
  LeagueClub,
  LeagueTierBracket,
  MetaLevels,
  PostMatchRewardOption,
  PostMatchRoundCadence,
  TriStateGambleSpec,
} from './types';

export interface GambleGenContext {
  tier: number;
  round: number;
  won: boolean;
  winlessStreak: number;
  club: LeagueClub;
  metaLevels: MetaLevels;
  recentEventIds: string[];
}

interface TierGambleTemplate {
  id: string;
  bracket: LeagueTierBracket;
  tierMin: number;
  tierMax: number;
  cadences: PostMatchRoundCadence[];
  rarity: 'common' | 'rare' | 'epic';
  build: (ctx: GambleGenContext) => PostMatchRewardOption;
}

/**
 * 判定当前轮次的赛后奖励节奏：
 * - crisis: 连败 >= 2 场，触发救火博弈
 * - focus: 每 4 轮焦点战 (R4/R8/R12...)，开放高上限事件
 * - normal: 常规轮，以消耗品/临时 Buff/轻度博弈为主
 */
export function getRoundCadence(round: number, winlessStreak: number): PostMatchRoundCadence {
  if (winlessStreak >= 2) return 'crisis';
  if (round % 4 === 0) return 'focus';
  return 'normal';
}

export function getTierBracket(tier: number): Exclude<LeagueTierBracket, 'all'> {
  if (tier >= 6) return 'grassroots';
  if (tier >= 3) return 'pro';
  return 'elite';
}

/**
 * 根据俱乐部基建等级、胜负动量与队长状态，动态校准 x% 正收益 / y% 负收益 / z% 超额收益
 * 保证三态概率之和严格等于 100
 */
export function computeAdjustedProbs(
  base: { pos: number; neg: number; jack: number },
  adjust: { jackBonus?: number; negReduce?: number }
): { pos: number; neg: number; jack: number } {
  const jAdd = Math.max(0, Math.min(20, Math.round(adjust.jackBonus ?? 0)));
  const nSub = Math.max(0, Math.min(base.neg - 8, Math.round(adjust.negReduce ?? 0)));
  const neg = Math.max(8, base.neg - nSub);
  const jack = Math.min(45, base.jack + jAdd);
  const pos = Math.max(10, 100 - neg - jack);
  return { pos, neg, jack };
}

/**
 * 结算三态概率博弈，返回命中的结果档位
 */
export function rollTriStateGamble(spec: TriStateGambleSpec): GambleOutcomeTier {
  const roll = Math.random() * 100;
  if (roll < spec.jackpot.prob) return 'jackpot';
  if (roll < spec.jackpot.prob + spec.negative.prob) return 'negative';
  return 'positive';
}

function pickKeyPlayers(club: LeagueClub) {
  const squad = club.squad;
  const starterSet = new Set(club.starterIds);
  const starters = squad.filter(p => starterSet.has(p.id));
  const captain = squad.find(p => p.id === club.captainId) ?? starters[0] ?? squad[0];
  const topScorer = [...squad].sort((a, b) => b.seasonStats.goals - a.seasonStats.goals || b.ca - a.ca)[0] ?? squad[0];
  const u23 = [...squad].filter(p => p.age <= 23).sort((a, b) => b.ca - a.ca)[0] ?? squad[0];
  const veteran = [...squad].filter(p => p.age >= 27).sort((a, b) => b.ca - a.ca)[0] ?? squad[0];
  return { captain, topScorer, u23, veteran };
}

export const TIER_GAMBLE_TEMPLATES: TierGambleTemplate[] = [
  // ==================== 1. 草根与地区联赛专属 (Tier 7 ~ 6) ====================
  {
    id: 'gr_part_time_extra',
    bracket: 'grassroots',
    tierMin: 6,
    tierMax: 7,
    cadences: ['normal', 'focus', 'crisis'],
    rarity: 'rare',
    build: (ctx) => {
      const { u23 } = pickKeyPlayers(ctx.club);
      const p = computeAdjustedProbs(
        { pos: 55, neg: 25, jack: 20 },
        { jackBonus: ctx.won ? 5 : 0, negReduce: ctx.metaLevels.fitness * 2 }
      );
      return {
        id: `pm_gb_gr_part_${ctx.round}`,
        category: 'gamble',
        title: `草根夜训赌约：${u23.name} 留堂加练`,
        subtitle: `${p.pos}%下场传射+2 | ${p.neg}%抽筋体能-15% | ${p.jack}%临时觉醒银标(4轮)`,
        rarity: 'rare',
        gamble: {
          eventId: 'gr_part_time_extra',
          bracket: 'grassroots',
          tierMin: 6,
          tierMax: 7,
          modifierHint: '赢球提高超额概率，体能医疗等级降低抽筋风险',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '加练见效',
            summary: `${u23.name} 手感火热，下场比赛全队传球/射门 +2`,
            effect: { nextMatchBuff: { passingBonus: 2, shootingBonus: 2, note: '草根夜训生效：下场传球/射门 +2' } },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '过度疲劳',
            summary: `${u23.name} 兼职打工叠加加练导致疲惫，体能 -15%`,
            effect: { targetPlayerId: u23.id, fitnessDelta: -15, moraleShift: 'low' },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '草根开窍！',
            summary: `${u23.name} 突破瓶颈，获得持续 4 轮的临时银标【禁区狐狸】且下场射门 +3！`,
            effect: {
              targetPlayerId: u23.id,
              tempTrait: { trait: '禁区狐狸', tier: 'silver', rounds: 4 },
              nextMatchBuff: { shootingBonus: 3, note: '草根开窍：下场射门 +3' },
            },
          },
        },
      };
    },
  },
  {
    id: 'gr_sponsor_bet',
    bracket: 'grassroots',
    tierMin: 6,
    tierMax: 7,
    cadences: ['normal', 'focus'],
    rarity: 'common',
    build: (ctx) => {
      const p = computeAdjustedProbs(
        { pos: 52, neg: 28, jack: 20 },
        { jackBonus: ctx.metaLevels.finance * 3, negReduce: ctx.metaLevels.finance * 2 }
      );
      return {
        id: `pm_gb_gr_spon_${ctx.round}`,
        category: 'gamble',
        title: '社区赞助商对赌：球场广告牌',
        subtitle: `${p.pos}%获1元素+8pt | ${p.neg}%扣1备战点感官干扰 | ${p.jack}%入账2元素+20pt`,
        rarity: 'common',
        gamble: {
          eventId: 'gr_sponsor_bet',
          bracket: 'grassroots',
          tierMin: 6,
          tierMax: 7,
          modifierHint: '财政基建等级越高，赞助暴击率越高',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '赞助到位',
            summary: '社区商家按约结款：获得战术元素 ×1 及 Meta +8pt',
            effect: { elementsGain: 1, metaDelta: 8 },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '商业扯皮',
            summary: '场地协调占用训练时间，下轮备战行动点 -1',
            effect: { prepActionsDelta: -1 },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '大额冠名！',
            summary: '社区金主追加预算：入账战术元素 ×2、Meta +20pt、备战点 +1！',
            effect: { elementsGain: 2, metaDelta: 20, prepActionsDelta: 1 },
          },
        },
      };
    },
  },
  {
    id: 'gr_mud_pitch',
    bracket: 'grassroots',
    tierMin: 6,
    tierMax: 7,
    cadences: ['normal', 'crisis'],
    rarity: 'rare',
    build: (ctx) => {
      const p = computeAdjustedProbs(
        { pos: 55, neg: 25, jack: 20 },
        { jackBonus: ctx.metaLevels.fitness * 3, negReduce: ctx.metaLevels.fitness * 3 }
      );
      return {
        id: `pm_gb_gr_mud_${ctx.round}`,
        category: 'gamble',
        title: '泥泞草皮抢修与冰敷恢复',
        subtitle: `${p.pos}%全队体能+15% | ${p.neg}%随机1首发轻伤1轮 | ${p.jack}%全队回满+下场防抢+3`,
        rarity: 'rare',
        gamble: {
          eventId: 'gr_mud_pitch',
          bracket: 'grassroots',
          tierMin: 6,
          tierMax: 7,
          modifierHint: '体能医疗等级可显著压低受伤概率',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '冰敷舒缓',
            summary: '土法冰敷有效缓解肌肉酸痛：全队体能 +15%',
            effect: { fitnessDelta: 15 },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '场地滑倒',
            summary: '草皮积水导致 1 名首发脚踝轻扭，下轮休战',
            effect: { injureStarterRounds: 1 },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '铁血适应！',
            summary: '全队体能 +35% 并磨炼出下场防线抢断 +3 的硬仗意志！',
            effect: {
              fitnessDelta: 35,
              nextMatchBuff: { defendingBonus: 3, note: '泥泞硬仗意志：下场防守 +3' },
            },
          },
        },
      };
    },
  },

  // ==================== 2. 职业中游联赛专属 (Tier 5 ~ 3) ====================
  {
    id: 'pro_black_scout',
    bracket: 'pro',
    tierMin: 3,
    tierMax: 5,
    cadences: ['normal', 'focus'],
    rarity: 'rare',
    build: (ctx) => {
      const p = computeAdjustedProbs(
        { pos: 52, neg: 28, jack: 20 },
        { jackBonus: ctx.metaLevels.scout * 3, negReduce: ctx.metaLevels.scout * 2 }
      );
      return {
        id: `pm_gb_pro_scout_${ctx.round}`,
        category: 'gamble',
        title: '黑市球探密报：战术情报交易',
        subtitle: `${p.pos}%了解度+35%且送Lv.2手牌 | ${p.neg}%情报烟雾(-20%了解) | ${p.jack}%直接空降Lv.3指挥卡`,
        rarity: 'rare',
        gamble: {
          eventId: 'pro_black_scout',
          bracket: 'pro',
          tierMin: 3,
          tierMax: 5,
          modifierHint: '球探网络等级越高，越容易截获 Lv.3 成品卡',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '线报准确',
            summary: '摸清下轮对手弱点（了解度 +35%）并获赠 Lv.2 战术指挥卡',
            effect: { scoutIntelDelta: 35, grantCardLevel: 2 },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '遭遇反间',
            summary: '收到假情报误导备战（了解度 -20%，下轮备战点 -1）',
            effect: { scoutIntelDelta: -20, prepActionsDelta: -1 },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '绝密蓝图！',
            summary: '截获对手完整战术手册：了解度 +60% 且获赠 Lv.3 高阶指挥卡！',
            effect: { scoutIntelDelta: 60, grantCardLevel: 3 },
          },
        },
      };
    },
  },
  {
    id: 'pro_media_mindgame',
    bracket: 'pro',
    tierMin: 3,
    tierMax: 5,
    cadences: ['normal', 'focus', 'crisis'],
    rarity: 'rare',
    build: (ctx) => {
      const { captain } = pickKeyPlayers(ctx.club);
      const capHigh = captain.morale === 'high';
      const p = computeAdjustedProbs(
        { pos: 55, neg: 25, jack: 20 },
        { jackBonus: capHigh ? 6 : 0, negReduce: capHigh ? 8 : 0 }
      );
      return {
        id: `pm_gb_pro_media_${ctx.round}`,
        category: 'gamble',
        title: `赛后新闻战：${captain.name} 回应媒体质疑`,
        subtitle: `${p.pos}%全队默契+6 | ${p.neg}%舆论反噬(核心士气低迷) | ${p.jack}%全队阵型熟度+10%+备战点+1`,
        rarity: 'rare',
        gamble: {
          eventId: 'pro_media_mindgame',
          bracket: 'pro',
          tierMin: 3,
          tierMax: 5,
          modifierHint: '队长士气高昂时，抗压回应成功率大幅提升',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '众志成城',
            summary: '强硬发声凝聚更衣室：首发连线默契 +6',
            effect: { pairChemistryDelta: 6 },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '舆论失控',
            summary: `媒体断章取义引发内耗，${captain.name} 士气转低迷`,
            effect: { targetPlayerId: captain.id, moraleShift: 'low' },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '反客为主！',
            summary: '队长发言引爆全队斗志：全队当前阵型熟练度 +10%、备战点 +1、Meta +15pt！',
            effect: { teamFamiliarityDelta: 10, prepActionsDelta: 1, metaDelta: 15 },
          },
        },
      };
    },
  },
  {
    id: 'pro_schedule_sprint',
    bracket: 'pro',
    tierMin: 3,
    tierMax: 5,
    cadences: ['focus', 'crisis'],
    rarity: 'epic',
    build: (ctx) => {
      const p = computeAdjustedProbs(
        { pos: 50, neg: 30, jack: 20 },
        { jackBonus: ctx.metaLevels.coaching * 2, negReduce: ctx.metaLevels.fitness * 2 }
      );
      return {
        id: `pm_gb_pro_sprint_${ctx.round}`,
        category: 'gamble',
        title: '魔鬼赛程赌局：高强度战术闭门练',
        subtitle: `${p.pos}%阵型熟度+8%且下场控球传球+2 | ${p.neg}%全队体能-14% | ${p.jack}%全队阵型熟度+15%且冷静+3`,
        rarity: 'epic',
        gamble: {
          eventId: 'pro_schedule_sprint',
          bracket: 'pro',
          tierMin: 3,
          tierMax: 5,
          modifierHint: '战术幕僚等级提高超额收益概率',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '演练顺畅',
            summary: '全队当前阵型熟练度 +8%，下场传球 +2',
            effect: {
              teamFamiliarityDelta: 8,
              nextMatchBuff: { passingBonus: 2, note: '闭门演练生效：下场传球 +2' },
            },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '操之过急',
            summary: '密闭高强度加练消耗过大：全队体能 -14%',
            effect: { fitnessDelta: -14 },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '战术顿悟！',
            summary: '全队阵型熟练度 +15%，下场传球/冷静/防守各 +3！',
            effect: {
              teamFamiliarityDelta: 15,
              nextMatchBuff: { passingBonus: 3, composureBonus: 3, defendingBonus: 3, note: '战术顿悟：下场传/冷/防 +3' },
            },
          },
        },
      };
    },
  },

  // ==================== 3. 豪门与顶级联赛专属 (Tier 2 ~ 1) ====================
  {
    id: 'el_star_ego_clash',
    bracket: 'elite',
    tierMin: 1,
    tierMax: 2,
    cadences: ['normal', 'focus', 'crisis'],
    rarity: 'epic',
    build: (ctx) => {
      const { topScorer } = pickKeyPlayers(ctx.club);
      const p = computeAdjustedProbs(
        { pos: 50, neg: 30, jack: 20 },
        { jackBonus: ctx.won ? 6 : 0, negReduce: ctx.metaLevels.coaching * 2 }
      );
      return {
        id: `pm_gb_el_ego_${ctx.round}`,
        category: 'gamble',
        title: `顶级更衣室博弈：${topScorer.name} 战术核心权`,
        subtitle: `${p.pos}%授其金标+(3轮) | ${p.neg}%更衣室分歧(默契-4/体能-10%) | ${p.jack}%授金标+(5轮)+全队下场攻+4`,
        rarity: 'epic',
        gamble: {
          eventId: 'el_star_ego_clash',
          bracket: 'elite',
          tierMin: 1,
          tierMax: 2,
          modifierHint: '顶级联赛高压决策：胜利余威或高教练等级能压低内耗风险',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '确立核心',
            summary: `${topScorer.name} 承担绝对核心职责，获得临时金标+【致命直塞】(3轮)`,
            effect: {
              targetPlayerId: topScorer.id,
              moraleShift: 'high',
              tempTrait: { trait: '致命直塞', tier: 'gold', rounds: 3 },
            },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '话语权分裂',
            summary: '球权分配引发不满：全队体能 -10%，部分连线默契下降',
            effect: { fitnessDelta: -10, pairChemistryDelta: -4 },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '双核共振！',
            summary: `${topScorer.name} 获得 5 轮金标+【禁区狐狸】，下场全队射门/速度 +4！`,
            effect: {
              targetPlayerId: topScorer.id,
              moraleShift: 'high',
              tempTrait: { trait: '禁区狐狸', tier: 'gold', rounds: 5 },
              nextMatchBuff: { shootingBonus: 4, paceBonus: 4, note: '豪门双核共振：下场射/速 +4' },
            },
          },
        },
      };
    },
  },
  {
    id: 'el_bio_overclock',
    bracket: 'elite',
    tierMin: 1,
    tierMax: 2,
    cadences: ['focus', 'crisis'],
    rarity: 'epic',
    build: (ctx) => {
      const p = computeAdjustedProbs(
        { pos: 52, neg: 28, jack: 20 },
        { jackBonus: ctx.metaLevels.fitness * 3, negReduce: ctx.metaLevels.fitness * 2 }
      );
      return {
        id: `pm_gb_el_bio_${ctx.round}`,
        category: 'gamble',
        title: '豪门运动科学：高压超频恢复协议',
        subtitle: `${p.pos}%全队体能+25%且下场速度+2 | ${p.neg}%过载警告(1首发伤1轮) | ${p.jack}%全队体能回满+下场全属性+3`,
        rarity: 'epic',
        gamble: {
          eventId: 'el_bio_overclock',
          bracket: 'elite',
          tierMin: 1,
          tierMax: 2,
          modifierHint: '体能医疗室等级直接提升超频成功率',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '指标拉满',
            summary: '全队体能 +25%，下场比赛全队速度 +2',
            effect: { fitnessDelta: 25, nextMatchBuff: { paceBonus: 2, note: '运动科学超频：下场速度 +2' } },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '负荷超标',
            summary: '高强度恢复引发微肌撕裂：随机 1 名首发伤停 1 轮',
            effect: { injureStarterRounds: 1 },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '完美巅峰状态！',
            summary: '全队体能回满，下场比赛全队射门/传球/速度/防守 +3！',
            effect: {
              fitnessDelta: 100,
              nextMatchBuff: {
                shootingBonus: 3,
                passingBonus: 3,
                paceBonus: 3,
                defendingBonus: 3,
                note: '巅峰状态：下场全队攻防速传 +3',
              },
            },
          },
        },
      };
    },
  },

  // ==================== 4. 全等级通用参数化博弈 (Tier 7 ~ 1) ====================
  {
    id: 'all_veteran_gamble',
    bracket: 'all',
    tierMin: 1,
    tierMax: 7,
    cadences: ['normal', 'focus', 'crisis'],
    rarity: 'rare',
    build: (ctx) => {
      const { veteran } = pickKeyPlayers(ctx.club);
      const p = computeAdjustedProbs(
        { pos: 56, neg: 24, jack: 20 },
        { jackBonus: ctx.won ? 4 : 0, negReduce: ctx.metaLevels.fitness * 2 }
      );
      return {
        id: `pm_gb_all_vet_${ctx.round}`,
        category: 'gamble',
        title: `老兵燃尽申请：${veteran.name} 带伤请战`,
        subtitle: `${p.pos}%下场冷静/传球+3 | ${p.neg}%老将体能-18% | ${p.jack}%老将临时金标【节拍器】(4轮)+默契+8`,
        rarity: 'rare',
        gamble: {
          eventId: 'all_veteran_gamble',
          bracket: 'all',
          tierMin: 1,
          tierMax: 7,
          modifierHint: '老将出战意志：胜场可提高金标爆发概率',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '老道稳健',
            summary: `${veteran.name} 稳住军心，下场全队冷静 +3、传球 +2`,
            effect: { nextMatchBuff: { composureBonus: 3, passingBonus: 2, note: '老兵稳心：下场冷静+3传球+2' } },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '体能透支',
            summary: `${veteran.name} 旧伤隐隐作痛，体能 -18%`,
            effect: { targetPlayerId: veteran.id, fitnessDelta: -18 },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '老兵传奇夜！',
            summary: `${veteran.name} 觉醒 4 轮金标+【节拍器】，且核心连线默契 +8！`,
            effect: {
              targetPlayerId: veteran.id,
              tempTrait: { trait: '节拍器', tier: 'gold', rounds: 4 },
              pairChemistryDelta: 8,
            },
          },
        },
      };
    },
  },
  {
    id: 'all_tactical_alchemy',
    bracket: 'all',
    tierMin: 1,
    tierMax: 7,
    cadences: ['normal', 'focus'],
    rarity: 'rare',
    build: (ctx) => {
      const p = computeAdjustedProbs(
        { pos: 54, neg: 26, jack: 20 },
        { jackBonus: ctx.metaLevels.coaching * 2, negReduce: ctx.metaLevels.finance * 2 }
      );
      return {
        id: `pm_gb_all_alch_${ctx.round}`,
        category: 'gamble',
        title: '战术实验室：残页融合试炼',
        subtitle: `${p.pos}%获得2元素+Lv.2卡 | ${p.neg}%实验炸炉(备战点-1) | ${p.jack}%直接合成Lv.4满阶全队卡`,
        rarity: 'rare',
        gamble: {
          eventId: 'all_tactical_alchemy',
          bracket: 'all',
          tierMin: 1,
          tierMax: 7,
          modifierHint: '战术幕僚与财政基建分别提升成卡率与容错率',
          positive: {
            tier: 'positive',
            prob: p.pos,
            label: '提炼成功',
            summary: '获得 2 张随机基础战术元素与 1 张 Lv.2 指挥卡',
            effect: { elementsGain: 2, grantCardLevel: 2 },
          },
          negative: {
            tier: 'negative',
            prob: p.neg,
            label: '实验炸炉',
            summary: '战术板推演超时，下轮赛前备战点 -1',
            effect: { prepActionsDelta: -1 },
          },
          jackpot: {
            tier: 'jackpot',
            prob: p.jack,
            label: '完美炼成！',
            summary: '直接炼成 1 张 Lv.4 满阶全队生效战术指挥卡 + Meta 15pt！',
            effect: { grantCardLevel: 4, metaDelta: 15 },
          },
        },
      };
    },
  },
];

/**
 * 按当前联赛 Tier、轮次节奏与防重复记录，抽取 3 个不重复的三态概率博弈选项
 */
export function rollTieredGambleOptions(ctx: GambleGenContext, count = 3): PostMatchRewardOption[] {
  const cadence = getRoundCadence(ctx.round, ctx.winlessStreak);
  const recentSet = new Set(ctx.recentEventIds);

  const eligible = TIER_GAMBLE_TEMPLATES.filter(
    t => ctx.tier >= t.tierMin && ctx.tier <= t.tierMax
  );

  // 优先：本级专属且符合节奏且近期未出现；次选：通用池
  const weighted = eligible.map(t => {
    let w = t.bracket !== 'all' ? 2.2 : 1.0;
    if (t.cadences.includes(cadence)) w += 1.0;
    if (recentSet.has(t.id)) w *= 0.2;
    return { tpl: t, score: w * (0.6 + Math.random() * 0.8) };
  });

  weighted.sort((a, b) => b.score - a.score);
  const picked = weighted.slice(0, count).map(w => w.tpl.build(ctx));
  return picked;
}
