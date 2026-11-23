/**
 * 历史荣誉室统计与 12 项里程碑成就系统
 */

import { HallOfFameData, LeagueSaveState } from './types';

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  metaReward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_first_draft',  title: '初出茅庐',   desc: '完成首次 26 人 Shuffle Draft 建队',   icon: '📋', metaReward: 10 },
  { id: 'ach_first_win',    title: '首胜纪念',   desc: '赢得执教生涯首场正式比赛',           icon: '⚽', metaReward: 10 },
  { id: 'ach_playoffs',     title: '冲级成功',   desc: '联赛排名前 3 成功升入更高级别',       icon: '🔥', metaReward: 20 },
  { id: 'ach_champion',     title: '联赛捧杯',   desc: '夺得赛季总冠军奖杯',                 icon: '🏆', metaReward: 50 },
  { id: 'ach_dynasty',      title: '双冠王朝',   desc: '累计夺得 2 座总冠军奖杯',             icon: '👑', metaReward: 80 },
  { id: 'ach_hattrick',     title: '戴帽时刻',   desc: '单场比赛有我方球员上演帽子戏法',     icon: '🎩', metaReward: 20 },
  { id: 'ach_clean_sheet',  title: '零封铁闸',   desc: '以零失球赢得一场正式比赛',           icon: '🧤', metaReward: 15 },
  { id: 'ach_craft_card',   title: '战术炼金师', desc: '在合成台首次合成教练指挥卡',         icon: '⚗️', metaReward: 15 },
  { id: 'ach_recipe_5',     title: '配方大师',   desc: '解锁至少 5 种指挥卡元素配方',         icon: '🃏', metaReward: 30 },
  { id: 'ach_hidden_trait', title: '慧眼识珠',   desc: '比赛中触发觉醒 1 名球员的隐藏特质',   icon: '✨', metaReward: 20 },
  { id: 'ach_synergy',      title: '流派成型',   desc: '单赛季激活同系 2+ 词条协同加成',     icon: '⚡', metaReward: 20 },
  { id: 'ach_meta_lv3',     title: '名帅之路',   desc: '任意 1 条教练天赋升至满级 Lv.3',     icon: '🧬', metaReward: 30 },
];

export function createDefaultHallOfFame(): HallOfFameData {
  return {
    seasonsPlayed: 0,
    championships: 0,
    totalWins: 0,
    totalGoals: 0,
    records: [],
    unlockedAchievements: [],
  };
}

export function tryUnlockAchievement(state: LeagueSaveState, id: string): boolean {
  if (!state.hallOfFame) {
    state.hallOfFame = createDefaultHallOfFame();
  }
  if (state.hallOfFame.unlockedAchievements.includes(id)) return false;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return false;
  state.hallOfFame.unlockedAchievements.push(id);
  state.metaPointsTotal += def.metaReward;
  return true;
}
