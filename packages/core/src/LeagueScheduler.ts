/**
 * 7 级联赛金字塔定义 + 18 队双循环赛程生成器（Berger 圆桌法）与积分榜统计
 */

import { FixtureMatch, LeagueClub, LeagueTierDef, StandingRow } from './types';

export const TEAMS_PER_TIER = 18;
export const TOTAL_TIERS = 7;

export const LEAGUE_TIERS: LeagueTierDef[] = [
  { tier: 1, name: '第1级 · 超级联赛',     shortLabel: '超级', teamCount: 18, baseCA: 82, promoteCount: 0, relegateCount: 3, metaMul: 1.80 },
  { tier: 2, name: '第2级 · 冠军联赛',     shortLabel: '冠军', teamCount: 18, baseCA: 76, promoteCount: 2, relegateCount: 3, metaMul: 1.50 },
  { tier: 3, name: '第3级 · 甲级联赛',     shortLabel: '甲级', teamCount: 18, baseCA: 70, promoteCount: 2, relegateCount: 3, metaMul: 1.30 },
  { tier: 4, name: '第4级 · 乙级联赛',     shortLabel: '乙级', teamCount: 16, baseCA: 63, promoteCount: 2, relegateCount: 3, metaMul: 1.15 },
  { tier: 5, name: '第5级 · 丙级联赛',     shortLabel: '丙级', teamCount: 14, baseCA: 54, promoteCount: 3, relegateCount: 3, metaMul: 1.00 },
  { tier: 6, name: '第6级 · 地区联赛',     shortLabel: '地区', teamCount: 12, baseCA: 48, promoteCount: 3, relegateCount: 3, metaMul: 0.95 },
  { tier: 7, name: '第7级 · 社区业余联赛', shortLabel: '业余', teamCount: 10, baseCA: 42, promoteCount: 3, relegateCount: 0, metaMul: 0.90 },
];

export function getLeagueTierInfo(tier: number): LeagueTierDef {
  return LEAGUE_TIERS.find(t => t.tier === tier) ?? LEAGUE_TIERS[LEAGUE_TIERS.length - 1];
}

export function getTierTeamCount(tier: number): number {
  return getLeagueTierInfo(tier).teamCount;
}

export function getTierRegularRounds(tier: number): number {
  return Math.max(2, (getTierTeamCount(tier) - 1) * 2);
}

export function getTierMidSeasonRound(tier: number): number {
  return Math.max(1, getTierTeamCount(tier) - 1);
}

/**
 * 生成 N 队双循环（主客场，18队共 34 轮 × 9 场 = 306 场）或单循环赛程
 */
export function generateRoundRobinFixtures(clubIds: string[], doubleRound = true): FixtureMatch[] {
  const n = clubIds.length;
  if (n % 2 !== 0) throw new Error('League team count must be even');

  const ids = [...clubIds];
  const fixed = ids[0];
  const rotating = ids.slice(1);
  const firstHalf: FixtureMatch[] = [];
  const halfRounds = n - 1;

  for (let round = 1; round <= halfRounds; round++) {
    const circle = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const t1 = circle[i];
      const t2 = circle[n - 1 - i];
      const flip = (round + i) % 2 === 0;
      const homeClubId = flip ? t2 : t1;
      const awayClubId = flip ? t1 : t2;
      firstHalf.push({
        id: `fix_r${round}_${i + 1}`,
        round,
        stage: 'regular',
        homeClubId,
        awayClubId,
        played: false,
        homeGoals: 0,
        awayGoals: 0,
        homeXG: 0,
        awayXG: 0,
      });
    }
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  if (!doubleRound) return firstHalf;

  // 下半程主客场对调
  const secondHalf: FixtureMatch[] = firstHalf.map((fx, idx) => {
    const r2 = fx.round + halfRounds;
    const matchIdx = (idx % (n / 2)) + 1;
    return {
      id: `fix_r${r2}_${matchIdx}`,
      round: r2,
      stage: 'regular',
      homeClubId: fx.awayClubId,
      awayClubId: fx.homeClubId,
      played: false,
      homeGoals: 0,
      awayGoals: 0,
      homeXG: 0,
      awayXG: 0,
    };
  });

  return [...firstHalf, ...secondHalf];
}

/**
 * 计算实时联赛积分榜（积分 -> 净胜球 -> 进球数 -> 队名）
 */
export function computeStandings(
  clubs: LeagueClub[],
  fixtures: FixtureMatch[]
): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const c of clubs) {
    map.set(c.id, {
      clubId: c.id,
      clubName: c.name,
      isUser: c.isUser,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      form: [],
    });
  }

  const regularPlayed = fixtures
    .filter(f => f.stage === 'regular' && f.played)
    .sort((a, b) => a.round - b.round);

  for (const f of regularPlayed) {
    const h = map.get(f.homeClubId);
    const a = map.get(f.awayClubId);
    if (!h || !a) continue;

    h.played++;
    a.played++;
    h.gf += f.homeGoals;
    h.ga += f.awayGoals;
    a.gf += f.awayGoals;
    a.ga += f.homeGoals;

    if (f.homeGoals > f.awayGoals) {
      h.won++;
      h.points += 3;
      h.form.push('W');
      a.lost++;
      a.form.push('L');
    } else if (f.homeGoals < f.awayGoals) {
      a.won++;
      a.points += 3;
      a.form.push('W');
      h.lost++;
      h.form.push('L');
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
      h.form.push('D');
      a.form.push('D');
    }
  }

  const rows = Array.from(map.values());
  for (const r of rows) {
    r.gd = r.gf - r.ga;
    if (r.form.length > 5) r.form = r.form.slice(-5);
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.clubName.localeCompare(b.clubName);
  });

  return rows;
}
