/**
 * 架空球队库、基于“角色原型 + 独立属性随机 + 实装/隐藏词条”的球员生成器
 * 包含 Perk 协同与反噬计算、单赛季故事线生成
 */

import { PlayerAttributes, PlayerRole } from '../../engine/src/types';
import { getLeagueTierInfo, TEAMS_PER_TIER, TOTAL_TIERS } from './LeagueScheduler';
import { ClubDirectoryEntry, DraftPlayer, PerkCategory, PlayerTier, SeasonStoryline, TacticalPerk } from './types';
import { generateChinesePlayerName, generateFictionalClubName } from './namePool';

export interface ClubTemplate {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
}

export const FICTIONAL_CLUBS: ClubTemplate[] = [
  { id: 'club_star',   name: '星辰联',   shortName: '星辰', primaryColor: '#DC2626', secondaryColor: '#FACC15' },
  { id: 'club_iron',   name: '铁壁城',   shortName: '铁壁', primaryColor: '#2563EB', secondaryColor: '#E2E8F0' },
  { id: 'club_eagle',  name: '蓝鹰竞技', shortName: '蓝鹰', primaryColor: '#0284C7', secondaryColor: '#F8FAFC' },
  { id: 'club_flame',  name: '赤焰港',   shortName: '赤焰', primaryColor: '#EA580C', secondaryColor: '#1E293B' },
  { id: 'club_oak',    name: '皇家橡树', shortName: '橡树', primaryColor: '#15803D', secondaryColor: '#FDE047' },
  { id: 'club_light',  name: '北海灯塔', shortName: '灯塔', primaryColor: '#4F46E5', secondaryColor: '#CBD5E1' },
  { id: 'club_jade',   name: '翡翠谷',   shortName: '翡翠', primaryColor: '#059669', secondaryColor: '#ECFDF5' },
  { id: 'club_storm',  name: '风暴矿工', shortName: '风暴', primaryColor: '#7C3AED', secondaryColor: '#F59E0B' },
];

const PYRAMID_COLORS: Array<[string, string]> = [
  ['#DC2626', '#FACC15'], ['#2563EB', '#E2E8F0'], ['#0284C7', '#F8FAFC'],
  ['#EA580C', '#1E293B'], ['#15803D', '#FDE047'], ['#4F46E5', '#CBD5E1'],
  ['#059669', '#ECFDF5'], ['#7C3AED', '#F59E0B'], ['#BE123C', '#FDE68A'],
  ['#0F766E', '#E2E8F0'], ['#B45309', '#FEF3C7'], ['#4338CA', '#E0E7FF'],
];

export function generateTierPyramid(
  userClubId: string,
  userClubTemplate?: ClubTemplate
): Record<number, ClubDirectoryEntry[]> {
  const pyramid: Record<number, ClubDirectoryEntry[]> = {};
  const usedNames = new Set<string>(FICTIONAL_CLUBS.map(c => c.name));
  let seq = 1;
  for (let t = 1; t <= TOTAL_TIERS; t++) {
    const tierInfo = getLeagueTierInfo(t);
    const list: ClubDirectoryEntry[] = [];
    for (let i = 0; i < TEAMS_PER_TIER; i++) {
      if (t === 7 && i === 0) {
        const base = userClubTemplate ?? FICTIONAL_CLUBS.find(c => c.id === userClubId) ?? FICTIONAL_CLUBS[0];
        list.push({
          id: userClubId,
          name: base.name,
          shortName: base.shortName,
          primaryColor: base.primaryColor,
          secondaryColor: base.secondaryColor,
          baseStrength: tierInfo.baseCA,
        });
        continue;
      }
      if (t === 1 && i < FICTIONAL_CLUBS.length && FICTIONAL_CLUBS[i].id !== userClubId) {
        const fc = FICTIONAL_CLUBS[i];
        list.push({
          id: fc.id,
          name: fc.name,
          shortName: fc.shortName,
          primaryColor: fc.primaryColor,
          secondaryColor: fc.secondaryColor,
          baseStrength: tierInfo.baseCA + ((i % 5) - 2),
        });
        continue;
      }
      const cname = generateFictionalClubName(usedNames);
      const [pc, sc] = PYRAMID_COLORS[(seq + i) % PYRAMID_COLORS.length];
      list.push({
        id: `club_t${t}_${seq++}`,
        name: cname,
        shortName: cname.slice(0, 2),
        primaryColor: pc,
        secondaryColor: sc,
        baseStrength: tierInfo.baseCA + ((i % 5) - 2),
      });
    }
    pyramid[t] = list;
  }
  return pyramid;
}

export const TRAIT_DESCRIPTIONS: Record<string, string> = {
  '禁区狐狸': '禁区内射门期望进球 xG +18%',
  '远射重炮': '禁区外远射(18m+) xG +25%',
  '致命直塞': '直塞球决策倾向与穿透收益提升',
  '精准传中': '边路传中决策与到位率提升',
  '精准长传': '长传与斜长传成功率 +7%',
  '节拍器': '短传与中场组织成功率 +5%',
  '铁肺覆盖': '全场奔跑体能消耗降低 40%',
  '精准铲断': '抢断成功率 +10%，犯规风险降低 35%',
  '门线神扑': '门线扑救成功率额外 +7%',
  '逆转王': '【觉醒】落后局面破门觉醒：关键战射门与冷静提升',
  '超级替补': '【觉醒】替补登场破门觉醒：替补出场时速度与射门 +8',
  '体能充沛': '【觉醒】单场跑动领跑全场觉醒：比赛体能消耗额外降低 30%',
  '大赛先生': '【觉醒】70分钟后关键破门觉醒：决胜时刻稳定性提升',
};

export const HIDDEN_TRAIT_POOL = ['逆转王', '超级替补', '体能充沛', '大赛先生'] as const;

export const TACTICAL_PERKS: TacticalPerk[] = [
  { id: 'perk_tiki', name: '传控大脑', description: '全队传球与控球视野 +5', category: 'control', rarity: 'common', effect: { passingBonus: 5 } },
  { id: 'perk_finisher', name: '临门一脚', description: '全队射门准度 +5', category: 'attack', rarity: 'common', effect: { shootingBonus: 5 } },
  { id: 'perk_wall', name: '钢铁防线', description: '全队抢断拦截与门将扑救 +4', category: 'defense', rarity: 'common', effect: { defendingBonus: 4, goalkeepingBonus: 4 } },
  { id: 'perk_turbo', name: '边路超跑', description: '全队速度与体能 +5', category: 'attack', rarity: 'rare', effect: { paceBonus: 5, staminaBonus: 5 } },
  { id: 'perk_gegen', name: '全攻全守', description: '全队传球 +4、射门 +4、防守 +4', category: 'control', rarity: 'epic', effect: { passingBonus: 4, shootingBonus: 4, defendingBonus: 4 } },
  { id: 'perk_keeper', name: '门神附体', description: '门将扑救反应 +9', category: 'defense', rarity: 'rare', effect: { goalkeepingBonus: 9 } },
];

export interface PerkSynergySummary {
  counts: Record<PerkCategory, number>;
  synergies: string[];
  penalties: string[];
  shootingDelta: number;
  passingDelta: number;
  defendingDelta: number;
  paceDelta: number;
  staminaDelta: number;
  goalkeepingDelta: number;
}

export function computePerkSynergies(perks: TacticalPerk[]): PerkSynergySummary {
  const counts: Record<PerkCategory, number> = { attack: 0, defense: 0, control: 0 };
  for (const p of perks) {
    const cat = p.category || 'control';
    counts[cat]++;
  }
  const synergies: string[] = [];
  const penalties: string[] = [];
  let shootingDelta = 0;
  let passingDelta = 0;
  let defendingDelta = 0;
  let paceDelta = 0;
  let staminaDelta = 0;
  let goalkeepingDelta = 0;

  if (counts.attack >= 2) {
    synergies.push('锋芒毕露 (2+进攻词条): 射门+4 速度+4');
    shootingDelta += 4;
    paceDelta += 4;
    if (counts.defense === 0) {
      penalties.push('攻强守弱反噬: 全队防守 -4');
      defendingDelta -= 4;
    }
  }
  if (counts.defense >= 2) {
    synergies.push('铜墙铁壁 (2+防守词条): 防守+4 扑救+4');
    defendingDelta += 4;
    goalkeepingDelta += 4;
    if (counts.attack === 0) {
      penalties.push('保守反噬: 全队射门 -4');
      shootingDelta -= 4;
    }
  }
  if (counts.control >= 2) {
    synergies.push('中场统治 (2+控制词条): 传球+5');
    passingDelta += 5;
    if (counts.defense === 0) {
      penalties.push('高位控球消耗反噬: 全队体能 -3');
      staminaDelta -= 3;
    }
  }
  return { counts, synergies, penalties, shootingDelta, passingDelta, defendingDelta, paceDelta, staminaDelta, goalkeepingDelta };
}

export function rollSeasonStoryline(userClubId: string): SeasonStoryline {
  const candidates = FICTIONAL_CLUBS.filter(c => c.id !== userClubId);
  const rival = candidates[Math.floor(Math.random() * candidates.length)];
  const pool: SeasonStoryline[] = [
    { id: 'underdog', title: '逆袭故事', description: '对阵前4强队全队速度与冷静 +4；赛季末 Meta 点数 +25%' },
    { id: 'revenge', title: '复仇故事', description: `宿敌锁定【${rival.name}】：与其交锋时全队射门与抢断 +5`, rivalClubId: rival.id },
    { id: 'veteran', title: '告别故事', description: '28岁及以上老将全属性 +4，倾尽最后一舞' },
    { id: 'wonderkid', title: '新星故事', description: '23岁及以下年轻球员每轮赛后稳定成长 CA +1' },
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

type RoleGroup = 'GK' | 'CB' | 'FB' | 'MID' | 'ATT';

interface ArchetypeDef {
  label: string;
  biases: Partial<Record<keyof PlayerAttributes, number>>;
  traitPool: string[];
}

const ARCHETYPES: Record<RoleGroup, ArchetypeDef[]> = {
  GK: [
    { label: '门线守护者', biases: { goalkeeping: 14, composure: 8, passing: -10, pace: -12 }, traitPool: ['门线神扑', '精准长传'] },
    { label: '清道夫门将', biases: { goalkeeping: 9, passing: 6, pace: 4, positioning: 8 }, traitPool: ['门线神扑', '精准长传', '节拍器'] },
  ],
  CB: [
    { label: '铁血防空塔', biases: { defending: 13, strength: 14, positioning: 8, pace: -10, dribbling: -14 }, traitPool: ['精准铲断', '铁肺覆盖', '精准长传'] },
    { label: '出球中卫', biases: { defending: 8, passing: 12, composure: 10, strength: 2 }, traitPool: ['精准长传', '节拍器', '精准铲断'] },
    { label: '回追中卫', biases: { defending: 10, pace: 12, stamina: 6, strength: -4 }, traitPool: ['精准铲断', '铁肺覆盖', '节拍器'] },
  ],
  FB: [
    { label: '套边飞翼', biases: { pace: 14, dribbling: 8, passing: 7, stamina: 8, strength: -6 }, traitPool: ['精准传中', '铁肺覆盖', '致命直塞'] },
    { label: '防守型边卫', biases: { defending: 12, positioning: 9, strength: 6, shooting: -14 }, traitPool: ['精准铲断', '铁肺覆盖', '精准长传'] },
  ],
  MID: [
    { label: '节拍器大师', biases: { passing: 15, composure: 12, positioning: 8, pace: -8, strength: -6 }, traitPool: ['节拍器', '致命直塞', '精准长传'] },
    { label: 'B2B 铁肺', biases: { stamina: 16, pace: 6, strength: 8, defending: 6, passing: 5 }, traitPool: ['铁肺覆盖', '精准铲断', '节拍器'] },
    { label: '前插重炮手', biases: { shooting: 14, positioning: 10, dribbling: 6, defending: -12 }, traitPool: ['远射重炮', '致命直塞', '禁区狐狸'] },
  ],
  ATT: [
    { label: '速度反击箭', biases: { pace: 14, dribbling: 10, shooting: 6, strength: -6, passing: -4 }, traitPool: ['精准传中', '禁区狐狸', '致命直塞'] },
    { label: '禁区抢点狐', biases: { shooting: 14, positioning: 12, composure: 10, pace: -2, passing: -6 }, traitPool: ['禁区狐狸', '远射重炮', '铁肺覆盖'] },
    { label: '支点策应锋', biases: { strength: 14, passing: 10, shooting: 12, positioning: 8, composure: 6, pace: -4 }, traitPool: ['致命直塞', '禁区狐狸', '节拍器'] },
  ],
};

export const SECONDARY_ROLE_POOL: Record<PlayerRole, PlayerRole[]> = {
  GK: [],
  CB: ['CDM', 'LB', 'RB'],
  LB: ['LWB', 'LM', 'CB', 'RB'],
  RB: ['RWB', 'RM', 'CB', 'LB'],
  LWB: ['LB', 'LM', 'LW'],
  RWB: ['RB', 'RM', 'RW'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM', 'LM', 'RM'],
  CAM: ['CM', 'LW', 'RW', 'ST'],
  LM: ['LW', 'LWB', 'CM', 'RM'],
  RM: ['RW', 'RWB', 'CM', 'LM'],
  LW: ['LM', 'RW', 'CAM', 'ST'],
  RW: ['RM', 'LW', 'CAM', 'ST'],
  ST: ['LW', 'RW', 'CAM'],
};

export function rollSecondaryRoles(role: PlayerRole, tier: PlayerTier): PlayerRole[] {
  const pool = [...(SECONDARY_ROLE_POOL[role] ?? [])];
  if (pool.length === 0) return [];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = tier === 'S' || tier === 'A' || Math.random() < 0.55 ? Math.min(2, pool.length) : 1;
  return pool.slice(0, count);
}

let playerSeq = 0;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampAttr(v: number): number {
  return Math.max(20, Math.min(99, Math.round(v)));
}

function getRoleGroup(role: PlayerRole): RoleGroup {
  if (role === 'GK') return 'GK';
  if (role === 'CB') return 'CB';
  if (['LB', 'RB', 'LWB', 'RWB'].includes(role)) return 'FB';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(role)) return 'MID';
  return 'ATT';
}

export function computeWeightedCA(role: PlayerRole, a: PlayerAttributes): number {
  const g = getRoleGroup(role);
  if (g === 'GK') {
    return Math.round(a.goalkeeping * 0.52 + a.positioning * 0.18 + a.composure * 0.15 + a.passing * 0.15);
  }
  if (g === 'CB') {
    return Math.round(a.defending * 0.34 + a.strength * 0.22 + a.positioning * 0.20 + a.pace * 0.12 + a.passing * 0.12);
  }
  if (g === 'FB') {
    return Math.round(a.pace * 0.24 + a.defending * 0.24 + a.passing * 0.18 + a.stamina * 0.18 + a.dribbling * 0.16);
  }
  if (g === 'MID') {
    return Math.round(a.passing * 0.28 + a.positioning * 0.18 + a.dribbling * 0.16 + a.stamina * 0.14 + a.defending * 0.12 + a.shooting * 0.12);
  }
  return Math.round(a.shooting * 0.30 + a.pace * 0.20 + a.dribbling * 0.20 + a.positioning * 0.18 + a.composure * 0.12);
}

function calcTier(ca: number): PlayerTier {
  if (ca >= 83) return 'S';
  if (ca >= 75) return 'A';
  if (ca >= 68) return 'B';
  return 'C';
}

export function generateDraftPlayer(role: PlayerRole, targetBand?: number): DraftPlayer {
  playerSeq++;
  const group = getRoleGroup(role);
  const archList = ARCHETYPES[group];
  const arch = archList[randInt(0, archList.length - 1)];

  const baseLevel = targetBand ?? randInt(64, 83);
  const rollAttr = (key: keyof PlayerAttributes, defaultBias = 0) => {
    const bias = (arch.biases[key] ?? defaultBias);
    return clampAttr(baseLevel + bias + randInt(-9, 9));
  };

  const attributes: PlayerAttributes = {
    passing: rollAttr('passing'),
    shooting: rollAttr('shooting', group === 'CB' || group === 'GK' ? -22 : 0),
    dribbling: rollAttr('dribbling', group === 'GK' ? -25 : 0),
    pace: rollAttr('pace'),
    strength: rollAttr('strength'),
    defending: rollAttr('defending', group === 'ATT' ? -28 : 0),
    positioning: rollAttr('positioning'),
    composure: rollAttr('composure'),
    stamina: rollAttr('stamina', 4),
    goalkeeping: group === 'GK' ? rollAttr('goalkeeping') : randInt(20, 35),
  };

  const ca = computeWeightedCA(role, attributes);
  const tier = calcTier(ca);
  const cost = Math.max(30, Math.round(32 + Math.max(0, ca - 35) * 1.9));

  const allTraits = [...arch.traitPool, '节拍器', '铁肺覆盖', '致命直塞', '精准传中', '精准铲断', '禁区狐狸', '远射重炮'];
  const uniquePool = Array.from(new Set(group === 'GK' ? ['门线神扑', '精准长传', '节拍器'] : allTraits));
  const shuffledTraits = [...arch.traitPool];
  for (let i = shuffledTraits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledTraits[i], shuffledTraits[j]] = [shuffledTraits[j], shuffledTraits[i]];
  }
  const extraPool = uniquePool.filter(t => !shuffledTraits.includes(t));
  for (let i = extraPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [extraPool[i], extraPool[j]] = [extraPool[j], extraPool[i]];
  }
  const combinedPool = [...shuffledTraits, ...extraPool];
  const goldCount =
    tier === 'S' ? (group === 'GK' ? 1 : (Math.random() < 0.55 ? 2 : 1)) :
    tier === 'A' ? 1 :
    tier === 'B' ? (Math.random() < 0.35 ? 1 : 0) : 0;
  const totalCount =
    group === 'GK'
      ? (tier === 'S' || tier === 'A' ? 2 : 1)
      : (tier === 'S' ? 4 : tier === 'A' ? 3 : 2);
  const goldTraits = combinedPool.slice(0, goldCount);
  const silverTraits = combinedPool.slice(goldCount, Math.min(combinedPool.length, totalCount));
  const traits = [...goldTraits, ...silverTraits];

  const secondaryRoles = rollSecondaryRoles(role, tier);
  const playerName = generateChinesePlayerName();
  const hiddenTrait = HIDDEN_TRAIT_POOL[randInt(0, HIDDEN_TRAIT_POOL.length - 1)];

  return {
    id: `p_${playerSeq}`,
    name: playerName,
    role,
    secondaryRoles,
    shirtNumber: randInt(1, 99),
    attributes,
    traits,
    goldTraits,
    silverTraits,
    hiddenTrait,
    seasonYellowsSinceBan: 0,
    suspendedRounds: 0,
    fitness: 100,
    ca,
    cost,
    tier,
    age: randInt(19, 32),
    trait: `${arch.label} · ${traits.join(' / ')}`,
    seasonStats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
    },
  };
}

/**
 * 生成一组平衡的 Shuffle Draft 候选池（默认 20 人）
 */
export function generateShuffleSet(size = 20, minBand = 63, maxBand = 85): DraftPlayer[] {
  const roleDistribution: PlayerRole[] = [
    'GK', 'GK',
    'CB', 'CB', 'CB', 'LB', 'RB',
    'CDM', 'CM', 'CM', 'CAM', 'LM', 'RM',
    'LW', 'RW', 'ST', 'ST',
    'CB', 'CM', 'ST',
  ];
  const shuffledRoles = [...roleDistribution];
  for (let i = shuffledRoles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledRoles[i], shuffledRoles[j]] = [shuffledRoles[j], shuffledRoles[i]];
  }
  const pool: DraftPlayer[] = [];
  const span = Math.max(4, maxBand - minBand);
  const midLow = minBand + Math.round(span * 0.35);
  const midHigh = minBand + Math.round(span * 0.72);
  for (let i = 0; i < size; i++) {
    const role = shuffledRoles[i % shuffledRoles.length];
    const roll = Math.random();
    const band =
      roll < 0.16 ? randInt(midHigh, maxBand) :
      roll < 0.56 ? randInt(midLow, midHigh) :
      randInt(minBand, midLow);
    pool.push(generateDraftPlayer(role, band));
  }
  return pool.sort((a, b) => b.ca - a.ca);
}
