/**
 * 架空球队库、基于“角色原型 + 独立属性随机 + 实装/隐藏词条”的球员生成器
 * 包含 Perk 协同与反噬计算、单赛季故事线生成
 */

import { PlayerAttributes, PlayerRole } from '../../engine/src/types';
import { getLeagueTierInfo, getTierTeamCount, TOTAL_TIERS } from './LeagueScheduler';
import { ClubDirectoryEntry, DraftPlayer, PerkCategory, PlayerTier, SeasonStoryline, TacticalPerk } from './types';
import { generateChinesePlayerName, generateFictionalClubName } from './namePool';

export interface ClubTemplate {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  awayPrimaryColor?: string;
  awaySecondaryColor?: string;
}

export const FICTIONAL_CLUBS: ClubTemplate[] = [
  { id: 'club_star',   name: '星辰联',   shortName: '星辰', primaryColor: '#DC2626', secondaryColor: '#FACC15', awayPrimaryColor: '#F8FAFC', awaySecondaryColor: '#DC2626' },
  { id: 'club_iron',   name: '铁壁城',   shortName: '铁壁', primaryColor: '#2563EB', secondaryColor: '#E2E8F0', awayPrimaryColor: '#F8FAFC', awaySecondaryColor: '#1E3A8A' },
  { id: 'club_eagle',  name: '蓝鹰竞技', shortName: '蓝鹰', primaryColor: '#0284C7', secondaryColor: '#F8FAFC', awayPrimaryColor: '#0F172A', awaySecondaryColor: '#38BDF8' },
  { id: 'club_flame',  name: '赤焰港',   shortName: '赤焰', primaryColor: '#EA580C', secondaryColor: '#1E293B', awayPrimaryColor: '#F8FAFC', awaySecondaryColor: '#EA580C' },
  { id: 'club_oak',    name: '皇家橡树', shortName: '橡树', primaryColor: '#15803D', secondaryColor: '#FDE047', awayPrimaryColor: '#FEFCE8', awaySecondaryColor: '#15803D' },
  { id: 'club_light',  name: '北海灯塔', shortName: '灯塔', primaryColor: '#4F46E5', secondaryColor: '#CBD5E1', awayPrimaryColor: '#F1F5F9', awaySecondaryColor: '#4338CA' },
  { id: 'club_jade',   name: '翡翠谷',   shortName: '翡翠', primaryColor: '#059669', secondaryColor: '#ECFDF5', awayPrimaryColor: '#1E293B', awaySecondaryColor: '#34D399' },
  { id: 'club_storm',  name: '风暴矿工', shortName: '风暴', primaryColor: '#7C3AED', secondaryColor: '#F59E0B', awayPrimaryColor: '#FEF3C7', awaySecondaryColor: '#5B21B6' },
];

const PYRAMID_COLORS: Array<[string, string, string, string]> = [
  ['#DC2626', '#FACC15', '#F8FAFC', '#DC2626'], ['#2563EB', '#E2E8F0', '#FEF3C7', '#1E3A8A'], ['#0284C7', '#F8FAFC', '#0F172A', '#38BDF8'],
  ['#EA580C', '#1E293B', '#F8FAFC', '#EA580C'], ['#15803D', '#FDE047', '#F8FAFC', '#166534'], ['#4F46E5', '#CBD5E1', '#FEF9C3', '#3730A3'],
  ['#059669', '#ECFDF5', '#0F172A', '#34D399'], ['#7C3AED', '#F59E0B', '#F8FAFC', '#6D28D9'], ['#BE123C', '#FDE68A', '#F1F5F9', '#9F1239'],
  ['#0F766E', '#E2E8F0', '#FEF3C7', '#115E59'], ['#B45309', '#FEF3C7', '#0F172A', '#F59E0B'], ['#4338CA', '#E0E7FF', '#F8FAFC', '#312E81'],
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
    const tierTeams = getTierTeamCount(t);
    const list: ClubDirectoryEntry[] = [];
    for (let i = 0; i < tierTeams; i++) {
      if (t === 7 && i === 0) {
        const base = userClubTemplate ?? FICTIONAL_CLUBS.find(c => c.id === userClubId) ?? FICTIONAL_CLUBS[0];
        list.push({
          id: userClubId,
          name: base.name,
          shortName: base.shortName,
          primaryColor: base.primaryColor,
          secondaryColor: base.secondaryColor,
          awayPrimaryColor: base.awayPrimaryColor ?? '#F8FAFC',
          awaySecondaryColor: base.awaySecondaryColor ?? base.primaryColor,
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
          awayPrimaryColor: fc.awayPrimaryColor ?? '#F8FAFC',
          awaySecondaryColor: fc.awaySecondaryColor ?? fc.primaryColor,
          baseStrength: tierInfo.baseCA + ((i % 5) - 2),
        });
        continue;
      }
      const cname = generateFictionalClubName(usedNames);
      const [pc, sc, apc, asc] = PYRAMID_COLORS[(seq + i) % PYRAMID_COLORS.length];
      list.push({
        id: `club_t${t}_${seq++}`,
        name: cname,
        shortName: cname.slice(0, 2),
        primaryColor: pc,
        secondaryColor: sc,
        awayPrimaryColor: apc,
        awaySecondaryColor: asc,
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
  '逆转王': '【觉醒】落后局面破门觉醒：关键战射门与冷静 +4',
  '超级替补': '【觉醒】替补登场破门觉醒：替补出场时速度与射门 +8',
  '体能充沛': '【觉醒】单场跑动领跑全场觉醒：比赛体能消耗额外降低 30%',
  '大赛先生': '【觉醒】70分钟后关键破门觉醒：决胜时刻冷静与射门 +4',
  '闪电首开': '【觉醒】开场25分钟内首开纪录觉醒：速度 +4、射门 +3',
  '世界波猎手': '【觉醒】20米外远射破门觉醒：远射 xG +15%、射门 +4',
  '门线战神': '【觉醒】单场贡献3+次扑救觉醒：门将扑救 +5 且扑救率额外 +4%',
  '高空霸主': '【觉醒】头球抢点破门觉醒：力量 +5、射门 +3',
  '禁区清道夫': '【觉醒】单场抢断拦截5+次觉醒：防守 +4、站位 +3',
  '传球机器': '【觉醒】单场传球成功25+次觉醒：传球 +4、冷静 +3',
  '铁血硬汉': '【觉醒】高强度对抗完赛觉醒：力量 +4、体能 +4',
  '助攻大师': '【觉醒】单场送出2+次助攻觉醒：传球 +4、盘带 +3',
};

export const HIDDEN_TRAIT_POOL = [
  '逆转王',
  '超级替补',
  '体能充沛',
  '大赛先生',
  '闪电首开',
  '世界波猎手',
  '门线战神',
  '高空霸主',
  '禁区清道夫',
  '传球机器',
  '铁血硬汉',
  '助攻大师',
] as const;

export const TACTICAL_PERKS: TacticalPerk[] = [
  // Attack (8)
  { id: 'perk_finisher', name: '临门一脚', description: '全队射门准度 +5', category: 'attack', rarity: 'common', effect: { shootingBonus: 5 } },
  { id: 'perk_turbo', name: '边路超跑', description: '全队速度 +5、体能 +5', category: 'attack', rarity: 'rare', effect: { paceBonus: 5, staminaBonus: 5 } },
  { id: 'perk_dribble_king', name: '盘带大师', description: '全队盘带 +5、速度 +3', category: 'attack', rarity: 'rare', effect: { dribblingBonus: 5, paceBonus: 3 } },
  { id: 'perk_aerial_target', name: '高空轰炸', description: '全队力量 +6、射门 +3', category: 'attack', rarity: 'common', effect: { strengthBonus: 6, shootingBonus: 3 } },
  { id: 'perk_blitz', name: '闪电快打', description: '开场战术能量 +1、全队速度 +4', category: 'attack', rarity: 'rare', effect: { startEnergyBonus: 1, paceBonus: 4 } },
  { id: 'perk_ice_veins', name: '绝杀冷静', description: '全队冷静 +6、射门 +3', category: 'attack', rarity: 'rare', effect: { composureBonus: 6, shootingBonus: 3 } },
  { id: 'perk_corrupt_pact', name: '深渊血契', description: '腐蚀指挥卡效能 +35%，全队射门 +4', category: 'attack', rarity: 'epic', effect: { corruptedCardBoost: 0.35, shootingBonus: 4 } },
  { id: 'perk_sniper', name: '远程重炮手', description: '全队射门 +7、冷静 +3', category: 'attack', rarity: 'epic', effect: { shootingBonus: 7, composureBonus: 3 } },
  // Defense (8)
  { id: 'perk_wall', name: '钢铁防线', description: '全队抢断防守 +4、门将扑救 +4', category: 'defense', rarity: 'common', effect: { defendingBonus: 4, goalkeepingBonus: 4 } },
  { id: 'perk_keeper', name: '门神附体', description: '门将扑救反应 +9', category: 'defense', rarity: 'rare', effect: { goalkeepingBonus: 9 } },
  { id: 'perk_offside_trap', name: '越位陷阱', description: '全队站位 +6、防守 +3', category: 'defense', rarity: 'rare', effect: { positioningBonus: 6, defendingBonus: 3 } },
  { id: 'perk_iron_body', name: '钢筋铁骨', description: '全队力量 +6、体能 +4', category: 'defense', rarity: 'common', effect: { strengthBonus: 6, staminaBonus: 4 } },
  { id: 'perk_cryo_recovery', name: '赛后冷疗舱', description: '全队赛后体能恢复 +10、体能 +3', category: 'defense', rarity: 'rare', effect: { fitnessRecoveryBonus: 10, staminaBonus: 3 } },
  { id: 'perk_sweep_line', name: '防反清道夫', description: '全队速度 +4、防守 +5', category: 'defense', rarity: 'rare', effect: { paceBonus: 4, defendingBonus: 5 } },
  { id: 'perk_brick_castle', name: '铜墙堡垒', description: '全队防守 +6、冷静 +4', category: 'defense', rarity: 'epic', effect: { defendingBonus: 6, composureBonus: 4 } },
  { id: 'perk_sweeper_gk', name: '清道夫门神', description: '门将扑救 +6、全队传球 +3、站位 +3', category: 'defense', rarity: 'epic', effect: { goalkeepingBonus: 6, passingBonus: 3, positioningBonus: 3 } },
  // Control (8)
  { id: 'perk_tiki', name: '传控大脑', description: '全队传球与控球视野 +5', category: 'control', rarity: 'common', effect: { passingBonus: 5 } },
  { id: 'perk_gegen', name: '全攻全守', description: '全队传球 +4、射门 +4、防守 +4', category: 'control', rarity: 'epic', effect: { passingBonus: 4, shootingBonus: 4, defendingBonus: 4 } },
  { id: 'perk_alchemy_lab', name: '战术炼金室', description: '赛后元素掉落 +1、全队传球 +3', category: 'control', rarity: 'rare', effect: { elementDropBonus: 1, passingBonus: 3 } },
  { id: 'perk_youth_mentor', name: '青训导师团', description: 'U23年轻球员赛后熟练度成长额外 +3、冷静 +3', category: 'control', rarity: 'rare', effect: { youthGrowthBonus: 3, composureBonus: 3 } },
  { id: 'perk_metronome', name: '节拍引擎', description: '全队传球 +4、盘带 +4', category: 'control', rarity: 'common', effect: { passingBonus: 4, dribblingBonus: 4 } },
  { id: 'perk_maestro_energy', name: '运筹帷幄', description: '开场战术能量 +1、全队冷静 +5、传球 +3', category: 'control', rarity: 'epic', effect: { startEnergyBonus: 1, composureBonus: 5, passingBonus: 3 } },
  { id: 'perk_total_prep', name: '全能战备', description: '赛后体能恢复 +6、全队站位 +4、体能 +4', category: 'control', rarity: 'rare', effect: { fitnessRecoveryBonus: 6, positioningBonus: 4, staminaBonus: 4 } },
  { id: 'perk_architect', name: '中场建筑师', description: '全队传球 +6、盘带 +4、站位 +3', category: 'control', rarity: 'epic', effect: { passingBonus: 6, dribblingBonus: 4, positioningBonus: 3 } },
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
  dribblingDelta: number;
  composureDelta: number;
  positioningDelta: number;
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
  let dribblingDelta = 0;
  let composureDelta = 0;
  let positioningDelta = 0;

  if (counts.attack >= 2) {
    synergies.push('锋芒毕露 (2+进攻词条): 射门+4 速度+4');
    shootingDelta += 4;
    paceDelta += 4;
    if (counts.attack >= 3) {
      synergies.push('万箭齐发 (3+进攻极致): 射门额外+4 冷静+3');
      shootingDelta += 4;
      composureDelta += 3;
    }
    if (counts.defense === 0) {
      penalties.push('攻强守弱反噬: 全队防守 -4');
      defendingDelta -= 4;
    }
  }
  if (counts.defense >= 2) {
    synergies.push('铜墙铁壁 (2+防守词条): 防守+4 扑救+4');
    defendingDelta += 4;
    goalkeepingDelta += 4;
    if (counts.defense >= 3) {
      synergies.push('绝对零封 (3+防守极致): 防守额外+4 站位+4');
      defendingDelta += 4;
      positioningDelta += 4;
    }
    if (counts.attack === 0) {
      penalties.push('保守反噬: 全队射门 -4');
      shootingDelta -= 4;
    }
  }
  if (counts.control >= 2) {
    synergies.push('中场统治 (2+控制词条): 传球+5');
    passingDelta += 5;
    if (counts.control >= 3) {
      synergies.push('全能大师 (3+控制极致): 传球额外+4 盘带+4');
      passingDelta += 4;
      dribblingDelta += 4;
    }
    if (counts.defense === 0) {
      penalties.push('高位控球消耗反噬: 全队体能 -3');
      staminaDelta -= 3;
    }
  }
  if (counts.attack >= 1 && counts.defense >= 1 && counts.control >= 1) {
    synergies.push('三才归元 (攻/防/控均衡): 传射防冷 +3');
    passingDelta += 3;
    shootingDelta += 3;
    defendingDelta += 3;
    composureDelta += 3;
  }
  return {
    counts,
    synergies,
    penalties,
    shootingDelta,
    passingDelta,
    defendingDelta,
    paceDelta,
    staminaDelta,
    goalkeepingDelta,
    dribblingDelta,
    composureDelta,
    positioningDelta,
  };
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

function rollHiddenTraitForRole(role: string): string {
  const weighted: string[] =
    role === 'GK'
      ? ['门线战神', '门线战神', '门线战神', '体能充沛', '大赛先生', '传球机器', '铁血硬汉']
      : role === 'CB'
      ? ['禁区清道夫', '禁区清道夫', '高空霸主', '铁血硬汉', '逆转王', '体能充沛', '大赛先生']
      : ['LB', 'RB', 'LWB', 'RWB'].includes(role)
      ? ['禁区清道夫', '体能充沛', '助攻大师', '铁血硬汉', '传球机器', '超级替补']
      : ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(role)
      ? ['传球机器', '传球机器', '助攻大师', '世界波猎手', '体能充沛', '禁区清道夫', '逆转王', '大赛先生']
      : ['闪电首开', '闪电首开', '世界波猎手', '高空霸主', '超级替补', '逆转王', '大赛先生', '助攻大师'];
  return weighted[randInt(0, weighted.length - 1)];
}

export function computeInitialPA(ca: number, age: number, isYouth = false): number {
  if (isYouth) {
    const roll = Math.random();
    const upside =
      roll < 0.08 ? randInt(24, 34) :
      roll < 0.30 ? randInt(15, 24) :
      roll < 0.72 ? randInt(8, 16) :
      randInt(3, 9);
    return Math.min(99, Math.max(ca + 2, ca + upside));
  }
  let bonus = 0;
  if (age <= 20) bonus = randInt(8, 22);
  else if (age <= 23) bonus = randInt(5, 14);
  else if (age <= 27) bonus = randInt(2, 7);
  else if (age <= 30) bonus = randInt(0, 3);
  else bonus = 0;
  return Math.min(99, Math.max(ca, ca + bonus));
}

export function calcTransferValue(player: Pick<DraftPlayer, 'ca' | 'pa' | 'age' | 'tier'>): number {
  const ca = player.ca;
  const pa = player.pa ?? ca;
  const base = Math.max(40, Math.round(Math.pow(Math.max(1, ca - 40), 1.48) * 1.45));
  const upside = Math.max(0, pa - ca);
  const ageFactor =
    player.age <= 20 ? 1.38 :
    player.age <= 23 ? 1.24 :
    player.age <= 27 ? 1.08 :
    player.age <= 30 ? 0.85 :
    0.58;
  const paBonus = upside * (player.age <= 22 ? 6.5 : player.age <= 26 ? 3.5 : 1.2);
  const tierMul = player.tier === 'S' ? 1.22 : player.tier === 'A' ? 1.1 : 1.0;
  return Math.max(45, Math.round((base * ageFactor + paBonus) * tierMul));
}

export function generateDraftPlayer(role: PlayerRole, targetBand?: number, forcedAge?: number): DraftPlayer {
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
  const age = forcedAge ?? randInt(19, 32);
  const pa = computeInitialPA(ca, age, age <= 19);
  const marketValue = calcTransferValue({ ca, pa, age, tier });

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
  const hiddenTrait = rollHiddenTraitForRole(role);

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
    pa,
    scoutFogLevel: 0,
    marketValue,
    cost,
    tier,
    age,
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

export function generateYouthProspect(academyLv: number, currentTier: number, scoutLv = 0, bandBonus = 0): DraftPlayer {
  const roles: PlayerRole[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
  const role = roles[randInt(0, roles.length - 1)];
  const tierBase = Math.max(38, 38 + (7 - Math.max(1, Math.min(7, currentTier))) * 6);
  const band = Math.min(76, Math.max(34, tierBase - 4 + Math.min(8, academyLv * 1.5) + bandBonus + randInt(-3, 4)));
  const age = randInt(16, 18);
  const p = generateDraftPlayer(role, Math.round(band), age);
  const minPA = Math.min(96, p.ca + 10 + academyLv * 2);
  if ((p.pa ?? p.ca) < minPA) {
    p.pa = Math.min(99, minPA + randInt(0, 8));
  }
  p.marketValue = calcTransferValue(p);
  // 入营默认迷雾 Lv.0（球探部门 Lv.7+ 初始即为 Lv.1），随赛季推进自然清晰
  const fog: 0 | 1 | 2 = scoutLv >= 7 ? 1 : 0;
  p.scoutFogLevel = fog;
  const spread = fog === 0 ? 12 : 5;
  const paVal = p.pa ?? p.ca;
  p.paEstMin = Math.max(p.ca, paVal - randInt(Math.floor(spread * 0.4), spread));
  p.paEstMax = Math.min(99, Math.max(p.paEstMin, paVal + randInt(Math.floor(spread * 0.4), spread)));
  return p;
}

export function generateInitialSkeleton8(currentTier: number): DraftPlayer[] {
  return generateInitialSkeleton11(currentTier);
}

export function createReturningCaptainLinFeng(): DraftPlayer {
  const attributes: PlayerAttributes = {
    passing: 84,
    shooting: 88,
    dribbling: 82,
    pace: 72,
    strength: 80,
    defending: 76,
    positioning: 86,
    composure: 92,
    stamina: 76,
    goalkeeping: 25,
  };
  const ca = computeWeightedCA('ST', attributes);
  return {
    id: 'captain_lin_feng',
    name: '梅利纳',
    role: 'ST',
    secondaryRoles: ['CAM', 'CM', 'CDM', 'CB'],
    shirtNumber: 10,
    attributes,
    traits: ['远射重炮', '大赛先生', '节拍器', '禁区狐狸'],
    goldTraits: ['远射重炮', '大赛先生'],
    silverTraits: ['节拍器', '禁区狐狸'],
    hiddenTrait: undefined,
    seasonYellowsSinceBan: 0,
    suspendedRounds: 0,
    fitness: 100,
    ca,
    pa: ca,
    scoutFogLevel: 2,
    paEstMin: ca,
    paEstMax: ca,
    marketValue: 0,
    cost: 0,
    tier: 'S',
    age: 38,
    coreTag: 'veteran',
    isPrologueCaptain: true,
    isNewSigning: true,
    trait: '游子归家 · 中轴全能碾压卡 (S1限)',
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

export function generateInitialSkeleton11(currentTier: number): DraftPlayer[] {
  const tierBase = Math.max(36, 38 + (7 - Math.max(1, Math.min(7, currentTier))) * 6);
  const skeletonRoles: PlayerRole[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
  const shirtNums = [1, 4, 5, 3, 2, 6, 8, 18, 11, 7, 9];
  return skeletonRoles.map((role, idx) => {
    const band = Math.max(32, tierBase - 3 + randInt(-2, 3));
    const p = generateDraftPlayer(role, band, randInt(20, 29));
    p.shirtNumber = shirtNums[idx] ?? (idx + 1);
    p.scoutFogLevel = 2;
    p.paEstMin = p.pa;
    p.paEstMax = p.pa;
    return p;
  });
}

export function generateCorePackChoices(line: 'DEF' | 'MID' | 'ATT', currentTier: number): DraftPlayer[] {
  const tierBase = Math.max(38, 38 + (7 - Math.max(1, Math.min(7, currentTier))) * 6);
  const roleSets: Record<'DEF' | 'MID' | 'ATT', PlayerRole[]> = {
    DEF: ['CB', 'CB', 'LB', 'RB', 'GK'],
    MID: ['CDM', 'CM', 'CM', 'CAM', 'LM'],
    ATT: ['ST', 'ST', 'LW', 'RW', 'CAM'],
  };
  const roles = [...roleSets[line]];
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  // 5 张卡梯度：1 名即战力老将 + 2 名当打中坚 + 2 名高潜小妖（每包 5 选 3）
  const specs: Array<{
    tag: 'veteran' | 'balanced' | 'wonderkid';
    ageMin: number;
    ageMax: number;
    caBand: number;
  }> = [
    {
      // 即战力老将：唯一越级大腿（第7级约 51~54 CA），但 PA = CA 零成长且季末衰老
      tag: 'veteran',
      ageMin: 29,
      ageMax: 33,
      caBand: Math.min(88, tierBase + randInt(11, 14)),
    },
    {
      // 当打中坚 1：略高于同级联赛基准(42)，第7级严格控制在 43~48 CA（不超过 50）
      tag: 'balanced',
      ageMin: 23,
      ageMax: 26,
      caBand: Math.min(83, tierBase + randInt(4, 7)),
    },
    {
      // 当打中坚 2：第7级约 42~47 CA
      tag: 'balanced',
      ageMin: 22,
      ageMax: 25,
      caBand: Math.min(82, tierBase + randInt(3, 6)),
    },
    {
      // 高潜小妖 1：第7级约 34~38 CA，但拥有全队最高 PA 天花板
      tag: 'wonderkid',
      ageMin: 17,
      ageMax: 19,
      caBand: Math.max(33, tierBase - randInt(3, 5)),
    },
    {
      // 高潜小妖 2：17~19 岁高潜彩票
      tag: 'wonderkid',
      ageMin: 17,
      ageMax: 19,
      caBand: Math.max(32, tierBase - randInt(4, 6)),
    },
  ];

  const nudgePlayerCA = (p: DraftPlayer, delta: number) => {
    if (delta === 0) return;
    const keys: Array<keyof PlayerAttributes> =
      p.role === 'GK'
        ? ['goalkeeping', 'positioning', 'composure', 'passing', 'stamina']
        : ['passing', 'shooting', 'dribbling', 'pace', 'strength', 'defending', 'positioning', 'composure', 'stamina'];
    for (const k of keys) p.attributes[k] = clampAttr(p.attributes[k] + delta);
    p.ca = computeWeightedCA(p.role, p.attributes);
    p.tier = calcTier(p.ca);
  };

  const players = specs.map((spec, idx) => {
    const role = roles[idx];
    const p = generateDraftPlayer(role, spec.caBand, randInt(spec.ageMin, spec.ageMax));
    if (spec.tag === 'veteran') {
      p.attributes.composure = clampAttr(p.attributes.composure + 5);
      p.attributes.positioning = clampAttr(p.attributes.positioning + 4);
      p.ca = computeWeightedCA(role, p.attributes);
      p.tier = calcTier(p.ca);
    }
    p.coreTag = spec.tag;
    p.scoutFogLevel = 2;
    p.isNewSigning = true;
    return p;
  });

  const vet = players[0];
  const bals = [players[1], players[2]];
  const kids = [players[3], players[4]];

  // 严格卡死三档 CA 区间：第7级(tierBase=38) 小妖 34~38 / 中坚 42~48 (<=50) / 老将 51~55
  const balMaxCA = Math.min(84, tierBase + 10);
  const kidMaxCA = Math.min(80, tierBase + 1);
  for (const kid of kids) {
    if (kid.ca > kidMaxCA) {
      nudgePlayerCA(kid, kidMaxCA - randInt(1, 3) - kid.ca);
    }
  }
  const maxKidCA = Math.max(...kids.map(k => k.ca));
  for (const bal of bals) {
    if (bal.ca <= maxKidCA + 3) {
      nudgePlayerCA(bal, maxKidCA + 4 - bal.ca);
    }
    if (bal.ca > balMaxCA) {
      nudgePlayerCA(bal, balMaxCA - randInt(0, 2) - bal.ca);
    }
  }
  const maxBalCA = Math.max(...bals.map(b => b.ca));
  if (vet.ca <= maxBalCA + 4) {
    nudgePlayerCA(vet, maxBalCA + 5 - vet.ca);
  }

  // 严格拉开 PA 生态位：老将 PA = CA (零成长) < 中坚 PA (vet.ca + 6~10) < 小妖 PA (balMaxPA + 9~14)
  vet.pa = vet.ca;
  for (const bal of bals) {
    bal.pa = Math.min(94, Math.max(bal.ca + 10, vet.ca + randInt(6, 10)));
  }
  const maxBalPA = Math.max(...bals.map(b => b.pa ?? b.ca));
  for (const kid of kids) {
    kid.pa = Math.min(98, Math.max(kid.ca + 24, maxBalPA + randInt(9, 14)));
  }

  for (const p of players) {
    p.paEstMin = p.pa;
    p.paEstMax = p.pa;
    p.marketValue = calcTransferValue(p);
  }
  return players;
}

export function rollBrokerRecommendation(
  currentTier: number,
  boxTier: 'small' | 'large',
  medLv = 0
): import('./types').PendingBrokerResult {
  const roles: PlayerRole[] = ['CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'GK'];
  const role = roles[randInt(0, roles.length - 1)];
  const tierBaseCA = Math.max(40, 38 + (7 - Math.max(1, Math.min(7, currentTier))) * 6);
  const tierBasePA = Math.min(92, tierBaseCA + 14);
  const packCost = boxTier === 'large' ? 450 : 220;

  const r = Math.random() * 100;
  let outcome: import('./types').BrokerOutcomeTier;
  let caMulMin: number;
  let caMulMax: number;
  let paMulMin: number;
  let paMulMax: number;
  let sellMulMin: number;
  let sellMulMax: number;
  let outcomeLabel: string;
  let note: string;

  if (boxTier === 'small') {
    if (r < 55) {
      outcome = 'bust';
      caMulMin = 0.80; caMulMax = 0.95;
      paMulMin = 0.90; paMulMax = 1.05;
      sellMulMin = 0.30; sellMulMax = 0.50;
      outcomeLabel = '看走眼 · 溢价水货';
      note = '经纪人夸大了录像表现，能力低于联赛基准！建议考虑立即止损出售。';
    } else if (r < 85) {
      outcome = 'solid';
      caMulMin = 1.00; caMulMax = 1.08;
      paMulMin = 1.05; paMulMax = 1.12;
      sellMulMin = 0.65; sellMulMax = 0.82;
      outcomeLabel = '实用即战力';
      note = '发挥稳定的实用拼图，即插即用不亏不赚。';
    } else if (r < 97) {
      outcome = 'gem';
      caMulMin = 1.10; caMulMax = 1.18;
      paMulMin = 1.15; paMulMax = 1.22;
      sellMulMin = 1.15; sellMulMax = 1.40;
      outcomeLabel = '隐世宝藏！';
      note = '捡到大漏！能力显著高于同级联赛，且具备不俗成长空间！';
    } else {
      outcome = 'superstar';
      caMulMin = 1.22; caMulMax = 1.30;
      paMulMin = 1.25; paMulMax = 1.35;
      sellMulMin = 1.85; sellMulMax = 2.30;
      outcomeLabel = '★ 超级巨星降临！★';
      note = '百年一遇的建队基石！远超当前联赛水准，留队争冠或天价套现皆可！';
    }
  } else {
    if (r < 48) {
      outcome = 'bust';
      caMulMin = 0.85; caMulMax = 1.00;
      paMulMin = 0.95; paMulMax = 1.08;
      sellMulMin = 0.32; sellMulMax = 0.52;
      outcomeLabel = '溢价水货 · 状态下滑';
      note = '名气大于实力的高薪水货，及时转手止损或许更明智。';
    } else if (r < 80) {
      outcome = 'solid';
      caMulMin = 1.05; caMulMax = 1.14;
      paMulMin = 1.10; paMulMax = 1.18;
      sellMulMin = 0.70; sellMulMax = 0.88;
      outcomeLabel = '实力主力';
      note = '可靠的主力级即战力，能立刻提升球队下限。';
    } else if (r < 94) {
      outcome = 'gem';
      caMulMin = 1.15; caMulMax = 1.22;
      paMulMin = 1.18; paMulMax = 1.28;
      sellMulMin = 1.22; sellMulMax = 1.50;
      outcomeLabel = '豪门遗珠！';
      note = '从豪门梯队截胡的实力猛将，身价与战力双双暴涨！';
    } else {
      outcome = 'superstar';
      caMulMin = 1.25; caMulMax = 1.35;
      paMulMin = 1.28; paMulMax = 1.40;
      sellMulMin = 1.95; sellMulMax = 2.45;
      outcomeLabel = '★ 超级巨星降临！★';
      note = '天选巨星！满载金标特质的跨级核武，直接改变联赛格局！';
    }
  }

  const caMul = caMulMin + Math.random() * (caMulMax - caMulMin);
  const paMul = paMulMin + Math.random() * (paMulMax - paMulMin);
  const targetBand = Math.max(30, Math.min(92, Math.round(tierBaseCA * caMul)));
  const age = outcome === 'bust' ? randInt(25, 31) : outcome === 'superstar' ? randInt(19, 24) : randInt(20, 27);
  const p = generateDraftPlayer(role, targetBand, age);
  p.pa = Math.max(p.ca, Math.min(99, Math.round(tierBasePA * paMul)));

  if (outcome === 'superstar') {
    const starTrait = role === 'GK' ? '门线神扑' : ['CB', 'LB', 'RB'].includes(role) ? '精准铲断' : ['CDM', 'CM', 'CAM'].includes(role) ? '致命直塞' : '禁区狐狸';
    p.goldTraits = Array.from(new Set([starTrait, ...(p.goldTraits ?? [])]));
    p.traits = Array.from(new Set([starTrait, ...(p.traits ?? [])]));
  } else if (outcome === 'bust') {
    const glassChance = Math.max(0.12, 0.35 - medLv * 0.02);
    if (Math.random() < glassChance) {
      p.injuredRounds = 2;
      p.strainWarning = true;
      note = '玻璃人水货！入队自带 2 轮轻伤隐患，建议直接转手止损。';
    }
  }

  p.marketValue = calcTransferValue(p);
  p.scoutFogLevel = 2;
  p.paEstMin = p.pa;
  p.paEstMax = p.pa;
  p.isNewSigning = true;

  const sellMul = sellMulMin + Math.random() * (sellMulMax - sellMulMin);
  const sellPrice = Math.max(25, Math.round(packCost * sellMul));

  return {
    boxTier,
    outcome,
    outcomeLabel,
    player: p,
    sellPrice,
    note,
  };
}

export function generateBlackMarketPlayer(currentTier: number, _minCA = 66): DraftPlayer {
  return rollBrokerRecommendation(currentTier, 'small', 0).player;
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
