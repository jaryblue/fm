/**
 * 跨赛季多章节长线编年史（7 条主线，覆盖顺风冲级、低级徘徊、降级保级、老将传承、挖角博弈、青训与战术演化）
 * 以及基于真实赛场数据的「赛间缓和期（天气预报 + 轻训练 + 球员沟通）」
 */

import {
  ChronicleId,
  ChronicleProgress,
  InterMatchPrepState,
  LeagueClub,
  LeagueSaveState,
  MatchWeather,
  PendingStoryEvent,
  StandingRow,
} from './types';
import { buildOpponentMatchupIntel } from './OpponentScouting';

export interface ChronicleDef {
  id: ChronicleId;
  title: string;
  subtitle: string;
  artId: string;
  unlockHint: string;
  maxChapters: number;
}

export const CHRONICLE_DEFS: ChronicleDef[] = [
  {
    id: 'pyramid_climb',
    title: '草根崛起 · 金字塔之路',
    subtitle: '从第 7 级起步，无论是连跳升级还是低级徘徊坚守，终将写下俱乐部史诗',
    artId: 'story_underdog',
    unlockHint: '第1季开局自动开启；后续升级或同级停留满2季推进',
    maxChapters: 4,
  },
  {
    id: 'relegation_fight',
    title: '泥潭保级 · 绝地求生',
    subtitle: '跌入降级区或遭遇连败低谷时触发，在暴雨与质疑中守住俱乐部火种',
    artId: 'story_relegation',
    unlockHint: '连续5轮不胜，或第18轮后仍处于降级区(后3名)时触发',
    maxChapters: 4,
  },
  {
    id: 'captain_torch',
    title: '袖标与薪火 · 更衣室传承',
    subtitle: '跨越 2–3 个赛季的老队长与 U21 新秀羁绊，从磨合、竞争到交出袖标',
    artId: 'story_veteran',
    unlockHint: '拥有29+岁(出场≥12)老将与U21(CA≥62)新秀时触发',
    maxChapters: 4,
  },
  {
    id: 'scout_poach',
    title: '球探风云 · 留人还是套现',
    subtitle: '队内核心打出统治级数据时引来豪门球探，抉择重建套现或强留冲级',
    artId: 'story_poach',
    unlockHint: '队内有球员单季进球+助攻≥12 或 CA≥76 时触发',
    maxChapters: 4,
  },
  {
    id: 'academy_roots',
    title: '本土青训 · 造血哲学',
    subtitle: '拒绝盲目大买，用自家年轻球员一次次交学费、成长并扛起球队',
    artId: 'story_academy',
    unlockHint: '单季U23球员累计出场≥45人次时触发',
    maxChapters: 4,
  },
  {
    id: 'tactician_path',
    title: '战术先驱 · 破局之路',
    subtitle: '从执教初期的体系阵痛、被对手摸透，到自成一派的战术宗师',
    artId: 'story_tactician',
    unlockHint: '第12轮起且拥有至少1项Lv.2战术熟练度时触发',
    maxChapters: 4,
  },
  {
    id: 'rival_chronicle',
    title: '宿敌编年史 · 跨季恩怨',
    subtitle: '无论同处低级死磕还是携手升级，跨赛季记录与宿敌的每一次交锋',
    artId: 'story_revenge',
    unlockHint: '与同一对手累计交锋≥3次或宿敌重逢时触发',
    maxChapters: 4,
  },
];

export const WEATHER_INFO: Record<MatchWeather, { label: string; tip: string; color: string }> = {
  sunny: { label: '晴朗微风', tip: '标准场地物理，适合全流派发挥', color: '#FACC15' },
  rain: { label: '大雨积水', tip: '球速略降、门将易脱手，角球与短传更吃香', color: '#38BDF8' },
  wind: { label: '阵风横扫', tip: '长传与高空传中偏差略增，地面配合更稳', color: '#A5B4FC' },
  heat: { label: '酷热午后', tip: '60分钟后体能加速消耗，备好5个换人名额', color: '#FB923C' },
};

export function ensureChronicles(state: LeagueSaveState): Record<ChronicleId, ChronicleProgress> {
  if (!state.chronicles) {
    state.chronicles = {} as Record<ChronicleId, ChronicleProgress>;
  }
  for (const def of CHRONICLE_DEFS) {
    if (!state.chronicles[def.id]) {
      state.chronicles[def.id] = {
        id: def.id,
        title: def.title,
        subtitle: def.subtitle,
        artId: def.artId,
        status: def.id === 'pyramid_climb' ? 'active' : 'locked',
        chapter: def.id === 'pyramid_climb' ? 1 : 0,
        maxChapters: def.maxChapters,
        startSeason: def.id === 'pyramid_climb' ? (state.seasonNumber || 1) : undefined,
        startTier: def.id === 'pyramid_climb' ? (state.currentTier ?? 7) : undefined,
        keyPeople: [],
        choicesMade: [],
        statSnapshot: '等待推进中',
        flags: [],
      };
    }
  }
  return state.chronicles;
}

export function createInterMatchPrep(state: LeagueSaveState, userClub: LeagueClub): InterMatchPrepState {
  const roll = Math.random();
  const weather: MatchWeather =
    roll < 0.48 ? 'sunny' :
    roll < 0.68 ? 'rain' :
    roll < 0.84 ? 'wind' : 'heat';

  const starterSet = new Set(userClub.starterIds);
  let playerTalk: InterMatchPrepState['playerTalk'] = null;

  // 基于真实数据挑选 1 名有合理诉求的球员沟通（体能疲惫预警 / 士气低迷 / 疲劳主力 / 板凳饥渴 / 火热射手）
  const strainedStarter = userClub.squad
    .filter(p => (p.injuredRounds ?? 0) <= 0 && p.strainWarning)
    .sort((a, b) => (a.fitness ?? 100) - (b.fitness ?? 100))[0];

  const lowMoralePlayer = userClub.squad
    .filter(p => (p.injuredRounds ?? 0) <= 0 && p.morale === 'low')
    .sort((a, b) => b.ca - a.ca)[0];

  const tiredStarter = userClub.squad
    .filter(p => starterSet.has(p.id) && (p.injuredRounds ?? 0) <= 0 && (p.fitness ?? 100) < 58 && p.role !== 'GK')
    .sort((a, b) => (a.fitness ?? 100) - (b.fitness ?? 100))[0];

  const hungrySub = userClub.squad
    .filter(p => !starterSet.has(p.id) && (p.suspendedRounds ?? 0) <= 0 && (p.injuredRounds ?? 0) <= 0 && p.ca >= 58 && (p.seasonStats.appearances ?? 0) <= Math.max(1, state.currentRound - 4))
    .sort((a, b) => b.ca - a.ca)[0];

  const hotScorer = userClub.squad
    .filter(p => (p.injuredRounds ?? 0) <= 0 && (p.seasonStats.goals ?? 0) >= 3 && (p.fitness ?? 100) >= 70)
    .sort((a, b) => (b.seasonStats.goals ?? 0) - (a.seasonStats.goals ?? 0))[0];

  if (strainedStarter) {
    playerTalk = {
      id: `talk_strain_${state.currentRound}_${strainedStarter.id}`,
      playerId: strainedStarter.id,
      playerName: strainedStarter.name,
      role: strainedStarter.role,
      prompt: `教练，我感觉身体有些疲惫（体能 ${Math.round(strainedStarter.fitness ?? 55)}%），强行打满可能会拉伤…`,
      optA: { label: '轮休理疗 (消疲惫+18%体)', effectDesc: '消除疲惫预警，体能 +18%，士气提升', kind: 'rest' },
      optB: { label: '咬牙坚持 (冷静/防+4)', effectDesc: '下场冷静与防守 +4，但仍带有疲惫拉伤风险', kind: 'boost' },
    };
  } else if (lowMoralePlayer) {
    playerTalk = {
      id: `talk_morale_${state.currentRound}_${lowMoralePlayer.id}`,
      playerId: lowMoralePlayer.id,
      playerName: lowMoralePlayer.name,
      role: lowMoralePlayer.role,
      prompt: `教练，最近状态有些低迷，感觉在场上找不到节奏，我该怎么调整？`,
      optA: { label: '鼓励信任 (士气恢复+传射+3)', effectDesc: '士气恢复平稳，下场传球与射门 +3', kind: 'promise_start' },
      optB: { label: '降压当奇兵 (士气恢复+回满体)', effectDesc: '卸下包袱，士气恢复且体能补满 100%', kind: 'promise_sub' },
    };
  } else if (tiredStarter && Math.random() < 0.55) {
    playerTalk = {
      id: `talk_tired_${state.currentRound}_${tiredStarter.id}`,
      playerId: tiredStarter.id,
      playerName: tiredStarter.name,
      role: tiredStarter.role,
      prompt: `教练，我目前体能只剩 ${Math.round(tiredStarter.fitness ?? 50)}% 了，下场要让我缓一缓吗？`,
      optA: { label: '同意轮休替补 (+18%体能)', effectDesc: '立即恢复 18% 体能，士气提升', kind: 'rest' },
      optB: { label: '再咬牙坚持 (冷静+4)', effectDesc: '下场意志力提升，冷静与防守各 +4', kind: 'boost' },
    };
  } else if (hungrySub && Math.random() < 0.50) {
    playerTalk = {
      id: `talk_sub_${state.currentRound}_${hungrySub.id}`,
      playerId: hungrySub.id,
      playerName: hungrySub.name,
      role: hungrySub.role,
      prompt: `教练，我最近训练状态很好 (CA ${hungrySub.ca})，下轮能给我上场表现的机会吗？`,
      optA: { label: '承诺给机会 (高昂士气+射/传+4)', effectDesc: '士气升至高昂，下场比赛射门与传球 +4', kind: 'promise_start' },
      optB: { label: '安抚当奇兵 (体能回满)', effectDesc: '接受轮换定位，体能补满 100% 随时待命', kind: 'promise_sub' },
    };
  } else if (hotScorer && Math.random() < 0.35) {
    playerTalk = {
      id: `talk_hot_${state.currentRound}_${hotScorer.id}`,
      playerId: hotScorer.id,
      playerName: hotScorer.name,
      role: hotScorer.role,
      prompt: `本赛季已经打进 ${hotScorer.seasonStats.goals} 球了，我感觉脚风正顺，下场继续交给我！`,
      optA: { label: '围绕他主打进攻 (射门+5)', effectDesc: '下场比赛该核心射门 +5', kind: 'boost' },
      optB: { label: '提醒团队配合 (全队传球+2)', effectDesc: '下场比赛全队传球 +2', kind: 'promise_sub' },
    };
  }

  return {
    round: state.currentRound,
    actionsLeft: 1,
    weather,
    matchupIntel: buildOpponentMatchupIntel(state, userClub),
    playerTalk,
  };
}

/**
 * 新赛季开局保底触发：每个新赛季必定承接/推进 1 条核心主线（第1季默认金字塔第1章）
 */
export function triggerSeasonStartChronicle(
  state: LeagueSaveState,
  userClub: LeagueClub
): PendingStoryEvent | null {
  const chrons = ensureChronicles(state);
  state.chronicleSeasonAdvancedIds = state.chronicleSeasonAdvancedIds ?? [];
  if (state.seasonNumber <= 1) {
    if (!state.chronicleSeasonAdvancedIds.includes('pyramid_climb')) {
      state.chronicleSeasonAdvancedIds.push('pyramid_climb');
    }
    return null;
  }

  const tier = state.currentTier ?? 7;
  const stayed = state.stayedTierCount ?? 0;
  const pyr = chrons.pyramid_climb;

  // 1. 优先承接未完结的金字塔主线（升级或停留满2季）
  if (pyr.status === 'active' && pyr.chapter < pyr.maxChapters && (tier < (pyr.startTier ?? 7) || stayed >= 2 || pyr.chapter === 1)) {
    const isStagnant = stayed >= 2 && tier >= 6;
    pyr.statSnapshot = `第${state.seasonNumber}季 · 第${tier}级联赛 (停留${stayed + 1}季)`;
    return {
      id: `chr_pyr_s${state.seasonNumber}_ch${pyr.chapter + 1}`,
      kind: 'choice',
      round: 1,
      chronicleId: 'pyramid_climb',
      artId: isStagnant ? 'story_relegation' : 'story_underdog',
      badge: `📖 新季主线 · 金字塔之路 第${pyr.chapter + 1}章`,
      title: isStagnant ? `低级别坚守：第 ${tier} 级联赛的十字路口` : `迈向更高舞台：第 ${tier} 级联赛的考验`,
      body: isStagnant
        ? `球队已经在第 ${tier} 级联赛徘徊了数个赛季。外界质疑球队的天花板也就到此为止，新赛季你打算如何重整旗鼓？`
        : `新赛季拉开帷幕，【${userClub.name}】将在第 ${tier} 级联赛迎接全新挑战。你的建队基调是？`,
      options: [
        { id: 'pyr_s_a', label: '深耕班底与体能储备，稳步争胜', effectDesc: '全队体能 +4、防守 +2，Meta +20pt', effect: { staminaBonus: 4, defendingBonus: 2 }, metaPointsDelta: 20 },
        { id: 'pyr_s_b', label: '重塑进攻火力，抢开局冲排名', effectDesc: '全队射门 +3、速度 +3', effect: { shootingBonus: 3, paceBonus: 3 } },
      ],
    };
  }

  // 2. 承接进行中的袖标与薪火
  const cap = chrons.captain_torch;
  if (cap.status === 'active' && cap.chapter < cap.maxChapters) {
    const veteran = [...userClub.squad].filter(p => p.age >= 28).sort((a, b) => b.ca - a.ca)[0];
    const rookie = [...userClub.squad].filter(p => p.age <= 22 && p.role !== 'GK').sort((a, b) => (b.pa ?? b.ca) - (a.pa ?? a.ca))[0];
    if (veteran && rookie) {
      cap.statSnapshot = `${cap.keyPeople[0] || veteran.name} & ${cap.keyPeople[1] || rookie.name} 新季搭档`;
      return {
        id: `chr_cap_s${state.seasonNumber}_ch${cap.chapter + 1}`,
        kind: 'choice',
        round: 1,
        chronicleId: 'captain_torch',
        artId: 'story_veteran',
        badge: `📖 新季主线 · 袖标与薪火 第${cap.chapter + 1}章`,
        title: '更衣室交接：新赛季由谁扛旗？',
        body: `新赛季集结，【${rookie.name}】的实力已逼近老队长【${veteran.name}】。更衣室都在看你如何安排新季核心秩序：`,
        options: [
          { id: 'cap_s_a', label: `力挺新星 ${rookie.name} 挑大梁`, effectDesc: 'U23 传/射 +2，Meta +20pt', youngBoost: true, metaPointsDelta: 20 },
          { id: 'cap_s_b', label: `信任老队长 ${veteran.name} 镇场`, effectDesc: '28+老将关键属性 +3', veteranBoost: true },
        ],
      };
    }
  }

  // 3. 若宿敌交锋已满 3 次且尚未解锁，开季开启宿敌编年史
  const riv = chrons.rival_chronicle;
  const rivalRec = Object.values(state.opponentIntel ?? {}).find(r => r.playedCount >= 3);
  if (riv.status === 'locked' && rivalRec) {
    const rivalClub = state.clubs.find(c => c.id === rivalRec.clubId);
    const rName = rivalClub?.name ?? '老对手';
    riv.status = 'active';
    riv.chapter = 1;
    riv.startSeason = state.seasonNumber;
    riv.startTier = tier;
    riv.keyPeople = [rName];
    riv.statSnapshot = `与 ${rName} 累计交锋 ${rivalRec.playedCount} 次 (${rivalRec.wins}胜${rivalRec.draws}平${rivalRec.losses}负)`;
    return {
      id: `chr_riv_1_s${state.seasonNumber}`,
      kind: 'choice',
      round: 1,
      chronicleId: 'rival_chronicle',
      artId: 'story_revenge',
      badge: '📖 新季主线 · 宿敌编年史 第1章',
      title: `窄路相逢：再战 ${rName}`,
      body: `跨过数个赛季，你们与【${rName}】已累计交手 ${rivalRec.playedCount} 次。新赛季抽签再次将两队放在一起，你如何定调这段恩怨？`,
      options: [
        { id: 'riv_1_a', label: '全队严阵以待：以稳固防守克敌', effectDesc: '全队防守 +3、门将扑救 +2', effect: { defendingBonus: 3, goalkeepingBonus: 2 } },
        { id: 'riv_1_b', label: '针锋相对：以更犀利的进攻压制', effectDesc: '全队射门 +3、速度 +2', effect: { shootingBonus: 3, paceBonus: 2 } },
      ],
    };
  }

  return null;
}

/**
 * 评估并触发跨赛季主线章节事件（固定检查节点 + 单季1+1上限 + 每季每线最多1章）
 */
export function evaluateChronicleTrigger(
  state: LeagueSaveState,
  userClub: LeagueClub,
  standings: StandingRow[]
): PendingStoryEvent | null {
  if (state.pendingStoryEvent) return null;
  const round = state.currentRound;
  // 仅在固定节点（第12轮半程前、第24轮冲刺期）检查触发，避免每场乱弹
  if (round !== 12 && round !== 24) return null;

  const chrons = ensureChronicles(state);
  const advIds = state.chronicleSeasonAdvancedIds ?? [];
  if (advIds.length >= 2) return null;
  const advSet = new Set(advIds);
  const canUnlockNew = !state.chronicleExtraUnlockedThisSeason;

  const tier = state.currentTier ?? 7;
  const rankIdx = standings.findIndex(r => r.clubId === userClub.id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : 9;
  const stayed = state.stayedTierCount ?? 0;
  const winless = state.winlessStreak ?? 0;

  // 1. 泥潭保级线：连续5轮不胜，或第18轮后仍处于降级区(后3名)
  const rel = chrons.relegation_fight;
  if (!advSet.has('relegation_fight') && rel.status !== 'completed' && (winless >= 5 || (round >= 18 && rank >= Math.max(12, standings.length - 2)))) {
    if (rel.status === 'locked' && canUnlockNew) {
      rel.status = 'active';
      rel.chapter = 1;
      rel.startSeason = state.seasonNumber;
      rel.startTier = tier;
      rel.keyPeople = [userClub.name];
      rel.statSnapshot = `S${state.seasonNumber} 第${round}轮 · 第${rank}名 (${winless}轮不胜)`;
      return {
        id: `chr_rel_1_s${state.seasonNumber}_r${round}`,
        kind: 'choice',
        round,
        chronicleId: 'relegation_fight',
        artId: 'story_relegation',
        badge: '📖 长线主线 · 泥潭保级 第1章',
        title: '风雨飘摇的保级警报',
        body: `连续的失分让【${userClub.name}】滑向降级危险区（当前第 ${rank} 名）。训练场外聚集了焦急的球迷，你决定如何稳住军心？`,
        options: [
          { id: 'rel_1_a', label: '狠抓防线纪律：先扎紧篱笆', effectDesc: '全队防守 +3、门将扑救 +3', effect: { defendingBonus: 3, goalkeepingBonus: 3 } },
          { id: 'rel_1_b', label: '召开全队誓师：放手一搏抢分', effectDesc: '全队射门 +3、速度 +2', effect: { shootingBonus: 3, paceBonus: 2 } },
        ],
      };
    }
    if (rel.status === 'active' && rel.chapter < rel.maxChapters && round >= 24) {
      rel.statSnapshot = `S${state.seasonNumber} 第${round}轮 · 第${rank}名`;
      return {
        id: `chr_rel_${rel.chapter + 1}_s${state.seasonNumber}_r${round}`,
        kind: 'choice',
        round,
        chronicleId: 'relegation_fight',
        artId: 'story_relegation',
        badge: `📖 长线主线 · 泥潭保级 第${rel.chapter + 1}章`,
        title: '背水一战的更衣室抉择',
        body: `赛季进入冲刺生死时刻，伤病与体能压力让主力阵容捉襟见肘。面对接下来的硬仗，你把筹码押在哪边？`,
        options: [
          { id: 'rel_3_a', label: '死磕防守反击偷三分', effectDesc: '全队防守 +4、体能 +4', effect: { defendingBonus: 4, staminaBonus: 4 } },
          { id: 'rel_3_b', label: '启用替补奇兵搏命对攻', effectDesc: '全队速度 +3、Meta +25pt', effect: { paceBonus: 3 }, metaPointsDelta: 25 },
        ],
      };
    }
  }

  // 2. 宿敌编年史：与同一对手累计交锋 >= 3 次
  const riv = chrons.rival_chronicle;
  if (!advSet.has('rival_chronicle') && riv.status !== 'completed') {
    const rivalRec = Object.values(state.opponentIntel ?? {}).find(r => r.playedCount >= 3);
    if (rivalRec && riv.status === 'locked' && canUnlockNew) {
      const rivalClub = state.clubs.find(c => c.id === rivalRec.clubId);
      const rName = rivalClub?.name ?? '老对手';
      riv.status = 'active';
      riv.chapter = 1;
      riv.startSeason = state.seasonNumber;
      riv.startTier = tier;
      riv.keyPeople = [rName];
      riv.statSnapshot = `与 ${rName} 累计交锋 ${rivalRec.playedCount} 次`;
      return {
        id: `chr_riv_1_s${state.seasonNumber}_r${round}`,
        kind: 'choice',
        round,
        chronicleId: 'rival_chronicle',
        artId: 'story_revenge',
        badge: '📖 长线主线 · 宿敌编年史 第1章',
        title: `宿敌档案：${rName} 的恩怨局`,
        body: `算上过往交锋，你们已与【${rName}】交手 ${rivalRec.playedCount} 次（${rivalRec.wins}胜${rivalRec.draws}平${rivalRec.losses}负）。这段跨季对决正在成为联赛焦点：`,
        options: [
          { id: 'riv_c_a', label: '研究录像细节，主打针对性控制', effectDesc: '全队传球 +3、防守 +2', effect: { passingBonus: 3, defendingBonus: 2 } },
          { id: 'riv_c_b', label: '全队动员，用高强度对攻回应', effectDesc: '全队射门 +3、速度 +2', effect: { shootingBonus: 3, paceBonus: 2 } },
        ],
      };
    }
  }

  // 3. 球探风云：队内有球员单季进球+助攻 >= 12 或 CA >= 76
  const poach = chrons.scout_poach;
  if (!advSet.has('scout_poach') && poach.status === 'locked' && canUnlockNew) {
    const star = [...userClub.squad]
      .filter(p => p.role !== 'GK' && ((p.seasonStats.goals ?? 0) + (p.seasonStats.assists ?? 0) >= 12 || p.ca >= 76))
      .sort((a, b) => (b.seasonStats.goals + b.seasonStats.assists) - (a.seasonStats.goals + a.seasonStats.assists))[0];
    if (star) {
      poach.status = 'active';
      poach.chapter = 1;
      poach.startSeason = state.seasonNumber;
      poach.startTier = tier;
      poach.keyPeople = [star.name];
      poach.statSnapshot = `${star.name} (${star.seasonStats.goals}球${star.seasonStats.assists}助 · CA ${star.ca})`;
      return {
        id: `chr_poach_1_s${state.seasonNumber}_r${round}`,
        kind: 'choice',
        round,
        chronicleId: 'scout_poach',
        artId: 'story_poach',
        badge: '📖 长线主线 · 球探风云 第1章',
        title: `看台上的球探：${star.name} 引来关注`,
        body: `【${star.name}】本季打出统治级数据（${star.seasonStats.goals}球 ${star.seasonStats.assists}助 · CA ${star.ca}），已有上级联赛球探开出诱惑报价。你如何表态？`,
        options: [
          { id: 'poach_1_a', label: '公开声明非卖品，承诺带队冲级', effectDesc: '全队传球与射门 +2，确立留核冲级誓言', effect: { shootingBonus: 2, passingBonus: 2 } },
          { id: 'poach_1_b', label: '开放谈判换取球探建设基金', effectDesc: '立即获得 +35 Meta 点数用于人才储备', metaPointsDelta: 35 },
        ],
      };
    }
  }

  // 4. 袖标与薪火：拥有29+岁(出场>=12)老将与U21(CA>=62)新秀
  const cap = chrons.captain_torch;
  if (!advSet.has('captain_torch') && cap.status !== 'completed') {
    const veteran = [...userClub.squad].filter(p => p.age >= 29 && (p.seasonStats.appearances ?? 0) >= 12).sort((a, b) => b.ca - a.ca)[0];
    const rookie = [...userClub.squad].filter(p => p.age <= 21 && p.ca >= 62 && p.role !== 'GK').sort((a, b) => (b.pa ?? b.ca) - (a.pa ?? a.ca))[0];
    if (veteran && rookie) {
      if (cap.status === 'locked' && canUnlockNew) {
        cap.status = 'active';
        cap.chapter = 1;
        cap.startSeason = state.seasonNumber;
        cap.startTier = tier;
        cap.keyPeople = [veteran.name, rookie.name];
        cap.statSnapshot = `老队长 ${veteran.name}(${veteran.age}岁) · 新星 ${rookie.name}(${rookie.age}岁)`;
        return {
          id: `chr_cap_1_s${state.seasonNumber}_r${round}`,
          kind: 'choice',
          round,
          chronicleId: 'captain_torch',
          artId: 'story_veteran',
          badge: '📖 长线主线 · 袖标与薪火 第1章',
          title: '老队长与年轻人的第一次对话',
          body: `训练结束后，${veteran.age} 岁的老将【${veteran.name}】主动找到你，谈起表现亮眼的小将【${rookie.name}】（${rookie.age} 岁 · CA ${rookie.ca}）。你希望两人如何相处？`,
          options: [
            { id: 'cap_1_a', label: `让 ${veteran.name} 手把手带新秀`, effectDesc: 'U23 传射 +2，开启师徒传承路线', youngBoost: true },
            { id: 'cap_1_b', label: '保持良性竞争：强者首发', effectDesc: '28+老将防守与冷静 +3', veteranBoost: true },
          ],
        };
      }
      if (cap.status === 'active' && cap.chapter < cap.maxChapters && state.seasonNumber > (cap.startSeason ?? 1)) {
        cap.statSnapshot = `${cap.keyPeople[0] || veteran.name} & ${cap.keyPeople[1] || rookie.name} 竞争升级`;
        return {
          id: `chr_cap_${cap.chapter + 1}_s${state.seasonNumber}_r${round}`,
          kind: 'choice',
          round,
          chronicleId: 'captain_torch',
          artId: 'story_veteran',
          badge: `📖 长线主线 · 袖标与薪火 第${cap.chapter + 1}章`,
          title: '更衣室交接：关键战由谁扛旗？',
          body: `跨过赛季的磨合，【${rookie.name}】的实力已逼近老队长【${veteran.name}】。更衣室都在看你如何平衡这对核心！`,
          options: [
            { id: 'cap_2_a', label: `力挺新星 ${rookie.name} 挑大梁`, effectDesc: 'U23 传/射 +2，Meta +20pt', youngBoost: true, metaPointsDelta: 20 },
            { id: 'cap_2_b', label: `信任老队长 ${veteran.name} 镇场`, effectDesc: '28+老将关键属性 +3', veteranBoost: true },
          ],
        };
      }
    }
  }

  // 5. 本土青训：单季U23球员累计出场 >= 45 人次
  const aca = chrons.academy_roots;
  const u23Apps = userClub.squad.filter(p => p.age <= 23).reduce((s, p) => s + (p.seasonStats.appearances ?? 0), 0);
  if (!advSet.has('academy_roots') && aca.status === 'locked' && canUnlockNew && u23Apps >= 45) {
    aca.status = 'active';
    aca.chapter = 1;
    aca.startSeason = state.seasonNumber;
    aca.startTier = tier;
    aca.statSnapshot = `U23 本季累计出场 ${u23Apps} 人次`;
    return {
      id: `chr_aca_1_s${state.seasonNumber}_r${round}`,
      kind: 'choice',
      round,
      chronicleId: 'academy_roots',
      artId: 'story_academy',
      badge: '📖 长线主线 · 本土青训 第1章',
      title: '青春的代价与光芒',
      body: `年轻球员们本季已累计出场 ${u23Apps} 人次，你用真金白银的出场时间喂出了这批青训骨架。下一步你打算怎么培养他们？`,
      options: [
        { id: 'aca_1_a', label: '继续放手让他们挑大梁', effectDesc: '23岁及以下球员传球 +2、射门 +2', youngBoost: true },
        { id: 'aca_1_b', label: '狠抓基本功与体能纪律', effectDesc: '全队体能 +4、传球 +2', effect: { staminaBonus: 4, passingBonus: 2 } },
      ],
    };
  }

  // 6. 战术先驱：第12轮起且拥有至少1项 Lv.2 战术熟练度 (XP >= 6)
  const tac = chrons.tactician_path;
  const hasLv2Mastery =
    Object.values(state.tacticalMastery?.formations ?? {}).some(xp => xp >= 6) ||
    Object.values(state.tacticalMastery?.styles ?? {}).some(xp => xp >= 6);
  if (!advSet.has('tactician_path') && tac.status === 'locked' && canUnlockNew && hasLv2Mastery) {
    tac.status = 'active';
    tac.chapter = 1;
    tac.startSeason = state.seasonNumber;
    tac.startTier = tier;
    tac.keyPeople = [userClub.formation];
    tac.statSnapshot = `主战阵型 ${userClub.formation} (Lv.2+) · 第${round}轮`;
    return {
      id: `chr_tac_1_s${state.seasonNumber}_r${round}`,
      kind: 'choice',
      round,
      chronicleId: 'tactician_path',
      artId: 'story_tactician',
      badge: '📖 长线主线 · 战术先驱 第1章',
      title: '当对手开始研究你的战术板',
      body: `你的【${userClub.formation}】体系已臻成熟，但联赛对手也开始针对性布防。面对研究透彻的防线，你决定如何破局？`,
      options: [
        { id: 'tac_1_a', label: '深化传切细节，把一套体系磨到极致', effectDesc: '全队传球 +3、防守 +2', effect: { passingBonus: 3, defendingBonus: 2 } },
        { id: 'tac_1_b', label: '提速变奏，打对手一个措手不及', effectDesc: '全队速度 +3、射门 +2', effect: { paceBonus: 3, shootingBonus: 2 } },
      ],
    };
  }

  // 7. 草根崛起：仅当已升级或同级停留满2季时在检查点推进下一章
  const pyr = chrons.pyramid_climb;
  if (!advSet.has('pyramid_climb') && pyr.status === 'active' && pyr.chapter < pyr.maxChapters && (stayed >= 2 || tier < 7)) {
    const isStagnant = stayed >= 2 && tier >= 6;
    pyr.statSnapshot = `第${state.seasonNumber}季 · 第${tier}级联赛 (停留${stayed + 1}季)`;
    return {
      id: `chr_pyr_${pyr.chapter + 1}_s${state.seasonNumber}_r${round}`,
      kind: 'choice',
      round,
      chronicleId: 'pyramid_climb',
      artId: isStagnant ? 'story_relegation' : 'story_underdog',
      badge: `📖 长线主线 · 金字塔之路 第${pyr.chapter + 1}章`,
      title: isStagnant ? `低级别坚守：第 ${tier} 级联赛的十字路口` : `迈向更高舞台：第 ${tier} 级联赛的考验`,
      body: isStagnant
        ? `球队已经在第 ${tier} 级联赛徘徊了数个赛季。有人质疑球队的天花板也就到此为止，作为主帅，你的态度决定这支俱乐部的灵魂：`
        : `【${userClub.name}】在更高舞台站稳了脚跟，接下来的赛程强度将全面升级。你选择如何打造这支球队？`,
      options: [
        { id: 'pyr_2_a', label: '深耕班底与体能储备，厚积薄发', effectDesc: '全队体能 +4、防守 +2，Meta +20pt', effect: { staminaBonus: 4, defendingBonus: 2 }, metaPointsDelta: 20 },
        { id: 'pyr_2_b', label: '重塑进攻火力，不破不立', effectDesc: '全队射门 +3、速度 +3', effect: { shootingBonus: 3, paceBonus: 3 } },
      ],
    };
  }

  return null;
}

export function recordChronicleChoice(
  state: LeagueSaveState,
  ev: PendingStoryEvent,
  optionLabel: string
): void {
  if (!ev.chronicleId) return;
  const chrons = ensureChronicles(state);
  const c = chrons[ev.chronicleId];
  if (!c) return;
  c.status = 'active';
  c.choicesMade.push(`S${state.seasonNumber} R${ev.round}: ${optionLabel}`);
  c.flags.push(ev.id);
  state.chronicleSeasonAdvancedIds = state.chronicleSeasonAdvancedIds ?? [];
  if (!state.chronicleSeasonAdvancedIds.includes(ev.chronicleId)) {
    state.chronicleSeasonAdvancedIds.push(ev.chronicleId);
  }
  if (ev.id.includes('_1_') && ev.chronicleId !== 'pyramid_climb') {
    state.chronicleExtraUnlockedThisSeason = true;
  }
  c.chapter = Math.min(c.maxChapters, c.chapter + 1);
  if (c.chapter >= c.maxChapters) {
    c.status = 'completed';
    c.endSeason = state.seasonNumber;
    c.endTier = state.currentTier ?? 7;
    if (!c.memorableMoment) {
      c.memorableMoment = `第 ${state.seasonNumber} 赛季第 ${ev.round} 轮圆满收官`;
    }
  }
}

export function recordChronicleMoment(
  state: LeagueSaveState,
  chronicleId: ChronicleId,
  momentText: string,
  markComplete = false
): void {
  const chrons = ensureChronicles(state);
  const c = chrons[chronicleId];
  if (!c || c.status === 'locked') return;
  c.memorableMoment = momentText;
  if (markComplete) {
    c.status = 'completed';
    c.chapter = c.maxChapters;
    c.endSeason = state.seasonNumber;
    c.endTier = state.currentTier ?? 7;
  }
}
