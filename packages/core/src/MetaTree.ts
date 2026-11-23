/**
 * 5 分支局外 Meta 天赋树 (Lv.1~5) + 教练阵型/战术熟练度体系（覆盖 16 种阵型）
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
  levelDescriptions: string[];
}

export const META_BRANCHES: MetaBranchDef[] = [
  {
    id: 'scout',
    name: '球探网络',
    icon: '🔍',
    accent: '#38BDF8',
    maxLevel: 5,
    costs: [40, 80, 140, 200, 280],
    levelDescriptions: [
      '选秀解锁 1 次刷新候选池机会，候选池底线 +1',
      '选秀解锁 2 次刷新候选池机会，候选池底线 +2',
      '选秀解锁 3 次刷新，S/A 级高潜球员出现率显著提升',
      '赛季末引援新秀池扩为 4 人，U22 妖人概率翻倍',
      '全联盟顶级球探网：高潜新星 PA 上限额外 +3',
    ],
  },
  {
    id: 'finance',
    name: '财政预算',
    icon: '💰',
    accent: '#D4A843',
    maxLevel: 5,
    costs: [40, 80, 140, 200, 280],
    levelDescriptions: [
      '开局 Shuffle Draft 预算 +60 (共 2,140)',
      '开局 Shuffle Draft 预算 +120 (共 2,200)',
      '开局预算 +180 (共 2,260)，且 Re-Draft 换人上限 +1',
      '每赛季开局额外获赠 2 个随机基础战术元素',
      '豪门赞助：赛季结算 Meta 点数奖励额外 +15%',
    ],
  },
  {
    id: 'coaching',
    name: '战术幕僚',
    icon: '📋',
    accent: '#A855F7',
    maxLevel: 5,
    costs: [40, 80, 140, 200, 280],
    levelDescriptions: [
      '全队传球与射门 +1，Re-Draft 稀有词条权重提升',
      '全队传球、射门与防守 +2',
      '全队传球、射门与防守 +3，Re-Draft 词条扩为 4 选 1',
      '比赛日中场休息额外回复 +2 战术能量（共+2）',
      '战术实验室：每次使用战术/阵型获得的熟练度经验翻倍',
    ],
  },
  {
    id: 'fitness',
    name: '体能医疗',
    icon: '⚡',
    accent: '#22C55E',
    maxLevel: 5,
    costs: [40, 80, 140, 200, 280],
    levelDescriptions: [
      '全队体能耐久 +3',
      '全队体能耐久 +6，速度 +2',
      '全队体能耐久 +9，速度 +3，首轮选秀质量保底提升',
      '休赛期允许同一名核心球员特训 2 次',
      '运动科学中心：老将衰退减半、低出场球员掉点风险降低',
    ],
  },
  {
    id: 'academy',
    name: '青训学院',
    icon: '🌱',
    accent: '#F97316',
    maxLevel: 5,
    costs: [50, 90, 150, 220, 300],
    levelDescriptions: [
      '每个休赛期自动提拔 1 名 18~20 岁青训新星进 40 人大名单',
      '提拔的青训新星基础 CA +2、潜力 PA +3',
      'U23 球员赛季成长速度额外 +1',
      '提拔的青训新星必带 1 个实用比赛特质词条',
      '黄金一代：青训有高概率产出 S/A 级超新星',
    ],
  },
];

export function createDefaultMetaLevels(): MetaLevels {
  return { scout: 0, finance: 0, coaching: 0, fitness: 0, academy: 0 };
}

export function getMetaUpgradeCost(branch: MetaBranch, currentLevel: number): number | null {
  const def = META_BRANCHES.find(b => b.id === branch);
  if (!def || currentLevel >= def.maxLevel) return null;
  return def.costs[currentLevel];
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
