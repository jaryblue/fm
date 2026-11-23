/**
 * FM27 Shuffle Draft 选秀与 Re-Draft 补强系统
 */

import { FORMATIONS } from '../../engine/src/formations';
import { FormationName, PlayerRole } from '../../engine/src/types';
import {
  generateDraftPlayer,
  generateShuffleSet,
  TACTICAL_PERKS,
} from './PlayerPool';
import {
  DraftPlayer,
  DraftState,
  MetaLevels,
  ReDraftOffer,
  TacticalPerk,
} from './types';

export const DRAFT_SQUAD_SIZE = 26;
export const DRAFT_BUDGET_TOTAL = 2080;
export const DRAFT_SETS_TOTAL = 7;
export const DRAFT_PICKS_PER_SET = 4;

/**
 * 创建初始 Shuffle Draft 状态（7 轮候选池，支持 Meta 预算/刷新次数/质量加成）
 */
export function createInitialDraftState(meta?: MetaLevels, tier = 7): DraftState {
  const financeLv = meta?.finance ?? 0;
  const scoutLv = meta?.scout ?? 0;
  const fitnessLv = meta?.fitness ?? 0;
  const budgetTotal = DRAFT_BUDGET_TOTAL + financeLv * 60;
  const clampTier = Math.max(1, Math.min(7, tier));
  const tierBase = 38 + (7 - clampTier) * 6;
  const minBand = tierBase + scoutLv + (fitnessLv >= 3 ? 2 : 0);
  const maxBand = tierBase + 12 + (scoutLv >= 3 ? 2 : 0);
  return {
    targetSquadSize: DRAFT_SQUAD_SIZE,
    budgetTotal,
    budgetRemaining: budgetTotal,
    currentSetIndex: 0,
    picksInCurrentSet: 0,
    refreshesRemaining: scoutLv,
    currentPool: generateShuffleSet(20, minBand, maxBand),
  };
}

/**
 * 为 AI 俱乐部自动完成 26 人 Shuffle Draft 建队
 */
export function generateAIDraftSquad(baseStrength = 44): DraftPlayer[] {
  const requiredRoles: PlayerRole[] = [
    'GK', 'GK', 'GK',
    'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB',
    'CDM', 'CDM', 'CM', 'CM', 'CM', 'CAM', 'LM', 'RM',
    'LW', 'LW', 'RW', 'RW', 'ST', 'ST', 'ST',
  ];
  return requiredRoles.map((role) => {
    const variance = Math.floor(Math.random() * 5) - 2;
    const ca = Math.max(32, Math.min(92, baseStrength + variance * 2));
    return generateDraftPlayer(role, ca);
  });
}

/**
 * 根据阵型从 16 人名单中自动选出最合适的 11 名首发 ID
 */
export function autoSelectStarters(
  squad: DraftPlayer[],
  formation: FormationName
): string[] {
  const slots = FORMATIONS[formation];
  const eligible = squad.filter(p => (p.suspendedRounds ?? 0) <= 0 && (p.injuredRounds ?? 0) <= 0);
  const pool = eligible.length >= 11 ? eligible : squad;
  const used = new Set<string>();
  const starters: string[] = [];

  for (const slot of slots) {
    // 1. 优先主位置完全匹配
    let best = pool
      .filter(p => !used.has(p.id) && p.role === slot.role)
      .sort((a, b) => b.ca - a.ca)[0];

    // 2. 其次选择具备该位置第二/兼任适应度的球员
    if (!best && slot.role !== 'GK') {
      best = pool
        .filter(p => !used.has(p.id) && p.role !== 'GK' && (p.secondaryRoles?.includes(slot.role) ?? false))
        .sort((a, b) => b.ca - a.ca)[0];
    }

    // 3. 再次同线客串
    if (!best && slot.role !== 'GK') {
      const isDef = ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(slot.role);
      const isMid = ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(slot.role);
      const isAtt = ['LW', 'RW', 'ST'].includes(slot.role);
      best = pool
        .filter(p => !used.has(p.id) && p.role !== 'GK')
        .filter(p => {
          if (isDef) return ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.role);
          if (isMid) return ['CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW'].includes(p.role);
          if (isAtt) return ['ST', 'LW', 'RW', 'CAM', 'LM', 'RM'].includes(p.role);
          return true;
        })
        .sort((a, b) => b.ca - a.ca)[0];
    }

    if (!best) {
      best = pool
        .filter(p => !used.has(p.id))
        .sort((a, b) => b.ca - a.ca)[0];
    }

    if (best) {
      used.add(best.id);
      starters.push(best.id);
    }
  }

  return starters;
}

/**
 * 生成赛季中段 Re-Draft 补强包（按联赛等级与轮次动态缩放新秀 CA）
 */
export function createReDraftOffer(
  roundCompleted: number,
  ownedPerkIds: string[],
  meta?: MetaLevels,
  tier = 7
): ReDraftOffer {
  const clampTier = Math.max(1, Math.min(7, tier));
  const tierBase = 40 + (7 - clampTier) * 6;
  const progBonus = roundCompleted >= 24 ? 4 : roundCompleted >= 16 ? 2 : 0;
  const minCA = tierBase + progBonus;
  const maxCA = tierBase + 14 + progBonus;
  const candidates = generateShuffleSet(6, minCA, maxCA);

  const coachingLv = meta?.coaching ?? 0;
  const financeLv = meta?.finance ?? 0;
  const perkCount = coachingLv >= 3 ? 4 : 3;
  const availablePerks = TACTICAL_PERKS.filter(p => !ownedPerkIds.includes(p.id));
  const pool = availablePerks.length >= perkCount ? availablePerks : TACTICAL_PERKS;
  const shuffled = [...pool].sort((a, b) => {
    const wa = coachingLv >= 1 && a.rarity !== 'common' ? 0.2 : 0;
    const wb = coachingLv >= 1 && b.rarity !== 'common' ? 0.2 : 0;
    return (Math.random() - wb) - (Math.random() - wa);
  });
  const perkChoices: TacticalPerk[] = shuffled.slice(0, perkCount);

  return {
    roundCompleted,
    candidates,
    perkChoices,
    maxSwaps: financeLv >= 3 ? 3 : 2,
    swapsUsed: 0,
    perkChosen: false,
  };
}
