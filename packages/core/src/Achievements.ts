/**
 * 历史荣誉室统计与 24 项里程碑成就系统
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
  { id: 'ach_first_draft',  title: '初出茅庐',   desc: '完成首次 26 人 Shuffle Draft 建队',           icon: 'clipboard', metaReward: 10 },
  { id: 'ach_first_win',    title: '首胜纪念',   desc: '赢得执教生涯首场正式比赛',                   icon: 'ball',      metaReward: 10 },
  { id: 'ach_playoffs',     title: '冲级成功',   desc: '联赛排名前 3 成功升入更高级别',               icon: 'bolt',      metaReward: 20 },
  { id: 'ach_champion',     title: '联赛捧杯',   desc: '夺得赛季总冠军奖杯',                         icon: 'trophy',    metaReward: 50 },
  { id: 'ach_dynasty',      title: '双冠王朝',   desc: '累计夺得 2 座总冠军奖杯',                     icon: 'star',      metaReward: 80 },
  { id: 'ach_hattrick',     title: '戴帽时刻',   desc: '单场比赛有我方球员上演帽子戏法',             icon: 'ball',      metaReward: 20 },
  { id: 'ach_clean_sheet',  title: '零封铁闸',   desc: '以零失球赢得一场正式比赛',                   icon: 'shield',    metaReward: 15 },
  { id: 'ach_craft_card',   title: '战术炼金师', desc: '首次合成或融合获得高阶教练指挥卡',           icon: 'craft',     metaReward: 15 },
  { id: 'ach_recipe_5',     title: '配方大师',   desc: '解锁至少 5 种化学神卡配方',                   icon: 'card',      metaReward: 30 },
  { id: 'ach_hidden_trait', title: '慧眼识珠',   desc: '比赛中触发觉醒 1 名球员的隐藏特质',           icon: 'sparkle',   metaReward: 20 },
  { id: 'ach_synergy',      title: '流派成型',   desc: '单赛季激活同系 2+ 词条协同加成',             icon: 'bolt',      metaReward: 20 },
  { id: 'ach_meta_lv3',     title: '名帅之路',   desc: '任意 1 条教练天赋升至满级 Lv.3',             icon: 'talent',    metaReward: 30 },
  { id: 'ach_secret_retire',  title: '急流勇退',   desc: '功成身退，达成隐藏传奇名帅谢幕结局',       icon: 'star',      metaReward: 60 },
  { id: 'ach_skill_rank3',    title: '战术大师',   desc: '将任意 1 个流派主动技升至满级 Rank 3',     icon: 'bolt',      metaReward: 25 },
  { id: 'ach_skill_mutate',   title: '宗师异变',   desc: '为任意主动技选择解锁分支专精异变',         icon: 'sparkle',   metaReward: 25 },
  { id: 'ach_fusion_power',   title: '双卡合璧',   desc: '在融合炉首次融合出双效指挥卡',             icon: 'craft',     metaReward: 25 },
  { id: 'ach_lv4_card',       title: '巅峰神卡',   desc: '持有至少 1 张满阶 Lv.4 指挥卡',            icon: 'card',      metaReward: 30 },
  { id: 'ach_corrupted_win',  title: '禁忌赌约',   desc: '携带腐蚀双刃指挥卡赢下正式比赛',           icon: 'card',      metaReward: 30 },
  { id: 'ach_win_streak_5',   title: '五连霸',     desc: '单赛季正赛达成至少 5 连胜势头',            icon: 'trophy',    metaReward: 35 },
  { id: 'ach_big_win',        title: '血洗绿茵',   desc: '单场正赛以净胜 4 球或以上大胜对手',        icon: 'ball',      metaReward: 25 },
  { id: 'ach_comeback_win',   title: '绝地大逆转', desc: '单场正赛在比分落后后完成翻盘取胜',         icon: 'bolt',      metaReward: 30 },
  { id: 'ach_triple_synergy', title: '三才归元',   desc: '单赛季同时集齐 攻/防/控 三系流派词条',     icon: 'link',      metaReward: 35 },
  { id: 'ach_scout_master',   title: '火眼金睛',   desc: '赛前侦察直抓真破绽并达成宗师洞察',         icon: 'sparkle',   metaReward: 25 },
  { id: 'ach_top_tier',       title: '剑指超联',   desc: '跨越金字塔攀登，踏入第 1 级超级联赛',     icon: 'trophy',    metaReward: 50 },
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
