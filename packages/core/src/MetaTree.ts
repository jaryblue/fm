/**
 * 8 分支俱乐部基建系统 (Lv.1~8 · 全部消耗 clubFunds · Lv.6~8 绑定联赛阶梯) + 教练阵型/战术熟练度体系
 */

import { FormationName, TacticalStyle } from '../../engine/src/types';
import { MetaBranch, MetaLevels, TacticalMasteryData } from './types';

export interface MetaBranchDef {
  id: MetaBranch;
  name: string;
  icon: string;
  accent: string;
  maxLevel: number;
  costs: number[];
  minTierRequired: number[];
  levelDescriptions: string[];
}

export const INFRA_COSTS: number[] = [180, 320, 520, 800, 1150, 1600, 2200, 3000];
export const INFRA_MIN_TIERS: number[] = [7, 7, 7, 7, 7, 5, 3, 1];

export const META_BRANCHES: MetaBranchDef[] = [
  {
    id: 'academy',
    name: '青训学院',
    icon: 'sparkle',
    accent: '#F97316',
    maxLevel: 8,
    costs: INFRA_COSTS,
    minTierRequired: INFRA_MIN_TIERS,
    levelDescriptions: [
      '每季免费青训试训刷新 +1 次，休赛期自动提拔 1 名 U19 新星',
      '每季免费青训试训刷新 +2 次，提拔新星基础 CA +2、PA +2',
      '每季免费青训试训刷新 +3 次，青训签字费降低 15%',
      '储备名单 U21 小妖季末梯队锻炼成长额外 +1 CA',
      '储备名单 U21 小妖季末成长额外 +2 CA，青训签字费降低 25%',
      '青训试训小妖必带 1 个实用比赛特质词条',
      '黄金一代：每季青训试训池必保底 1 名 PA ≥ 86 高潜胚子',
      '顶级青训摇篮：U21 梯队成长 +3 CA，高潜胚子保底 PA ≥ 88',
    ],
  },
  {
    id: 'scout',
    name: '球探网络',
    icon: 'search',
    accent: '#38BDF8',
    maxLevel: 8,
    costs: INFRA_COSTS,
    minTierRequired: INFRA_MIN_TIERS,
    levelDescriptions: [
      '选秀/转会免费刷新 +1 次，迷雾 PA 预测误差收窄至 ±10',
      '选秀/转会免费刷新 +2 次，迷雾 PA 预测误差收窄至 ±8',
      '选秀/转会免费刷新 +3 次，迷雾 PA 预测误差收窄至 ±6',
      '青训一阶体测自动多揭晓 +2 项属性，探查与付费刷新费 -20%',
      '探查与付费刷新费 -35%，季末引援池扩至 4 人',
      '转会货架发现他队漏网高潜新星概率翻倍',
      '高潜新星 PA 上限额外 +2，迷雾 PA 误差收窄至 ±3',
      '全联盟顶级球探网：高潜新星 PA 上限额外 +4，探查半价',
    ],
  },
  {
    id: 'finance',
    name: '商业财政',
    icon: 'coin',
    accent: '#D4A843',
    maxLevel: 8,
    costs: INFRA_COSTS,
    minTierRequired: INFRA_MIN_TIERS,
    levelDescriptions: [
      '开局资金 +150，常规赛单场门票奖金 +15%',
      '开局资金 +300，常规赛单场门票奖金 +25%',
      '开局资金 +450，常规赛单场门票奖金 +35%',
      '每赛季开局额外获赠 2 个随机基础战术元素',
      '赛季末联赛转播分红 +25%',
      '休赛期结余资金享 5% 理财利息（单季利息上限 ¥300）',
      '商业开发升级：单场门票奖金 +50%，转播分红 +40%',
      '豪门全球赞助：赛季结算 PT 额外 +15%，单场门票 +60%',
    ],
  },
  {
    id: 'transfer',
    name: '转会谈判室',
    icon: 'chart',
    accent: '#A855F7',
    maxLevel: 8,
    costs: INFRA_COSTS,
    minTierRequired: INFRA_MIN_TIERS,
    levelDescriptions: [
      '转会市场货架扩至 9 人，买人转会费 -5%',
      '转会市场货架扩至 10 人，买人转会费 -8%',
      '转会市场货架扩至 12 人，买人转会费 -12%',
      '挂牌竞价槽位扩至 5 个，快速兜售保底比例提至 89%',
      '快速兜售保底提至 92%，挂牌吸引 AI 竞标俱乐部 +1 家',
      '转会市场货架扩至 14 人且必含 1 名 S/A 级球星',
      '买人转会费 -16%，AI 竞价报价上限 +15%',
      '顶级谈判专家：买人转会费 -20%，AI 竞价报价上限 +25%',
    ],
  },
  {
    id: 'medical',
    name: '运动医疗中心',
    icon: 'bolt',
    accent: '#22C55E',
    maxLevel: 8,
    costs: INFRA_COSTS,
    minTierRequired: INFRA_MIN_TIERS,
    levelDescriptions: [
      '全队赛后基础体能恢复 +2%，降低黑市“玻璃人”概率',
      '全队赛后基础体能恢复 +4%，伤病停赛风险小幅降低',
      '全队赛后基础体能恢复 +6%，首轮选秀质量保底提升',
      '低出场球员赛季掉点风险减半',
      '全队赛后体能恢复 +8%，连续作战疲劳警告阈值放宽',
      '30 岁以上老将赛季速度与体能自然衰退减半',
      '运动科学理疗：私人魔鬼特训失败轻伤惩罚减半',
      '顶级运动医疗中心：伤病轮次自动 -1（最低1），老将抗衰退最大化',
    ],
  },
  {
    id: 'training_ground',
    name: '训练基地',
    icon: 'clipboard',
    accent: '#EC4899',
    maxLevel: 8,
    costs: INFRA_COSTS,
    minTierRequired: INFRA_MIN_TIERS,
    levelDescriptions: [
      '私人魔鬼特训成功率 +5%，U23 一线队成长速度微幅提升',
      '私人魔鬼特训成功率 +10%，全队基础体能消耗小幅优化',
      'U23 一线队出场达标时赛季成长额外 +1 CA',
      '休赛期允许同一名核心球员特训 2 次，新援初始阵型熟练度 +15%',
      '私人魔鬼特训成功率 +15%，青训小妖入队自带 +10% 熟练度',
      '休赛期单名球员可特训上限扩至 3 次',
      '私人魔鬼特训成功时 PA 突破幅度额外 +1，新援初始熟练度 +25%',
      '世界级科尔尼基地：U23 成长额外 +2 CA，新援初始熟练度 +35%',
    ],
  },
  {
    id: 'stadium',
    name: '主场球场',
    icon: 'shield',
    accent: '#EAB308',
    maxLevel: 8,
    costs: INFRA_COSTS,
    minTierRequired: INFRA_MIN_TIERS,
    levelDescriptions: [
      '主场比赛门票奖金额外 +20%',
      '主场比赛门票奖金额外 +35%',
      '主场比赛门票奖金额外 +50%',
      '主场作战开场士气更容易触发高昂状态',
      '主场比赛门票奖金额外 +70%',
      '扩建看台：主场氛围压迫感增强，门票奖金 +85%',
      '欧战级专业球场：主场门票奖金翻倍 (+100%)',
      '魔鬼主场圣殿：主场门票 +120%，主场高昂士气概率大幅提升',
    ],
  },
  {
    id: 'analytics',
    name: '数据分析室',
    icon: 'tactics',
    accent: '#06B6D4',
    maxLevel: 8,
    costs: INFRA_COSTS,
    minTierRequired: INFRA_MIN_TIERS,
    levelDescriptions: [
      '赛前对手侦察分析点数 +1（初始 3 点）',
      '转会市场自动标注【高性价比】标签',
      '交叉核实剔除烟雾弹不再额外扣减分析点',
      '转会市场自动高亮【大潜力差 (PA-CA≥12)】妖人目标',
      '赛前侦察分析点数 +2（初始 4 点）',
      '青训一阶体测直接揭示隐藏词条具体名称',
      '转会市场直接显示目标球员在当前阵型的适配度评分',
      '超级数据中枢：赛前抓破绽克制红利额外放大',
    ],
  },
];

export function createDefaultMetaLevels(): MetaLevels {
  return {
    academy: 0,
    scout: 0,
    finance: 0,
    transfer: 0,
    medical: 0,
    training_ground: 0,
    stadium: 0,
    analytics: 0,
  };
}

export function getMetaUpgradeRequirement(
  branch: MetaBranch,
  currentLevel: number
): { cost: number; minTier: number } | null {
  const def = META_BRANCHES.find(b => b.id === branch);
  if (!def || currentLevel >= def.maxLevel) return null;
  return {
    cost: def.costs[currentLevel],
    minTier: def.minTierRequired[currentLevel] ?? 7,
  };
}

export function getMetaUpgradeCost(branch: MetaBranch, currentLevel: number): number | null {
  return getMetaUpgradeRequirement(branch, currentLevel)?.cost ?? null;
}

export function createDefaultTacticalMastery(): TacticalMasteryData {
  return {
    formations: {
      '4-3-3': 0, '4-2-3-1': 0, '4-4-2': 0, '4-1-2-1-2': 0,
      '4-4-1-1': 0, '4-1-4-1': 0, '4-2-2-2': 0, '4-3-2-1': 0,
      '3-5-2': 0, '3-4-3': 0, '3-4-2-1': 0, '3-4-1-2': 0,
      '5-4-1': 0, '5-3-2': 0, '5-2-3': 0, '5-2-1-2': 0,
    },
    styles: { tiki_taka: 0, gegenpress: 0, balanced: 0, wing_play: 0, counter: 0, park_bus: 0 },
  };
}

export interface MasteryInfo {
  xp: number;
  level: 1 | 2 | 3;
  title: string;
  nextXp: number | null;
  bonusDesc: string;
}

const FORMATION_BONUS: Record<FormationName, [string, string, string]> = {
  '4-3-3': ['基础三叉戟站位', '娴熟：边锋与中前卫 传球+2 速度+2', '宗师：全队进攻三区 射门+3 跑位+3'],
  '4-2-3-1': ['基础双后腰阵型', '娴熟：前腰与后腰 传球+3 选位+2', '宗师：10号位与锋线 射门+3 盘带+3'],
  '4-4-2': ['基础双前锋体系', '娴熟：双前锋 射门+3 冷静+2', '宗师：两条四人线 防守+2 传球+2 体力+4'],
  '4-1-2-1-2': ['基础菱形中场', '娴熟：中场菱形 传球+3 盘带+2', '宗师：双前锋与前腰 射门+3 跑位+2'],
  '4-4-1-1': ['基础影锋串联', '娴熟：影锋与前锋 射门+2 传球+2', '宗师：紧凑四中场 防守+2 体力+4'],
  '4-1-4-1': ['基础单后腰控场', '娴熟：四中场 传球+2 速度+2', '宗师：单后腰屏障 防守+3 选位+3'],
  '4-2-2-2': ['基础双前腰双锋', '娴熟：双10号位 传球+3 盘带+2', '宗师：肋部合围 射门+3 速度+2'],
  '4-3-2-1': ['基础圣诞树阵型', '娴熟：双影锋 射门+2 盘带+3', '宗师：中路渗透 传球+3 冷静+3'],
  '3-5-2': ['基础三中卫翼卫', '娴熟：翼卫与中场 速度+3 体能+4', '宗师：三中卫防线 防守+3 全队传球+2'],
  '3-4-3': ['基础三前锋压迫', '娴熟：三叉戟 速度+2 射门+3', '宗师：全线压迫 防守+2 体力+4'],
  '3-4-2-1': ['基础三卫双影锋', '娴熟：双影锋 盘带+3 传球+2', '宗师：翼卫前插 速度+3 跑位+2'],
  '3-4-1-2': ['基础三卫单前腰', '娴熟：前腰与双锋 传球+2 射门+3', '宗师：中路控场 冷静+3 体力+3'],
  '5-4-1': ['基础五后卫大巴', '娴熟：五人防线 防守+3 门将+2', '宗师：防反铁壁 全队防守+3 冷静+3'],
  '5-3-2': ['基础五卫双前锋', '娴熟：双前锋与后防 射门+2 防守+2', '宗师：稳守反击 速度+3 防守+3'],
  '5-2-3': ['基础五卫三叉戟', '娴熟：三叉戟反击 速度+3 射门+2', '宗师：长传冲吊 传球+3 防守+3'],
  '5-2-1-2': ['基础五卫带前腰', '娴熟：前腰串联 传球+3 冷静+2', '宗师：翼卫突击 速度+3 体力+4'],
};

const STYLE_BONUS: Record<TacticalStyle, [string, string, string]> = {
  tiki_taka: ['基础短传渗透', '娴熟：全队 传球+3 盘带+2', '宗师：传控大师 全队 传球+4 冷静+3 体力+4'],
  gegenpress: ['基础高位反抢', '娴熟：全队 速度+2 防守+2 体能+3', '宗师：疯狂压迫 全队 速度+3 射门+3 防守+3'],
  balanced: ['基础均衡阵地', '娴熟：全队 传球+2 选位+2', '宗师：全能均衡 全队全核心属性 +2'],
  wing_play: ['基础两翼齐飞', '娴熟：边路 速度+3 传球+2', '宗师：边路爆破 全队 速度+3 射门+3 盘带+2'],
  counter: ['基础快速反击', '娴熟：反击提速 速度+3 冷静+2', '宗师：一击致命 全队 射门+4 速度+3'],
  park_bus: ['基础铁桶防反', '娴熟：禁区铁壁 防守+3 门将+3', '宗师：铜墙铁壁 全队防守+4 门将+4 体力+4'],
};

export function getMasteryLevel(xp: number): { level: 1 | 2 | 3; title: string; nextXp: number | null } {
  if (xp >= 15) return { level: 3, title: '宗师', nextXp: null };
  if (xp >= 6) return { level: 2, title: '娴熟', nextXp: 15 };
  return { level: 1, title: '初窥', nextXp: 6 };
}

export function getFormationMasteryInfo(formation: FormationName, xp: number): MasteryInfo {
  const lv = getMasteryLevel(xp);
  const descs = FORMATION_BONUS[formation] ?? ['基础阵型站位', '娴熟：位置协同 +2', '宗师：阵型精通 +3'];
  return { ...lv, xp, bonusDesc: descs[lv.level - 1] };
}

export function getStyleMasteryInfo(style: TacticalStyle, xp: number): MasteryInfo {
  const lv = getMasteryLevel(xp);
  const descs = STYLE_BONUS[style];
  return { ...lv, xp, bonusDesc: descs[lv.level - 1] };
}
