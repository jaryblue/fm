/**
 * 球员个人阵型熟练度 + 中轴线/边路搭档默契度系统
 * - 慢热养成 + 年龄初始差异（老将初始更高，小妖从低起步）
 * - 技能树联动（阵型节点抬升初始熟度与单场成长；防线体系节点提供 40% 同系继承）
 * - 真实比赛行为驱动默契增长（并肩首发 + 成功传球连线 + 助攻破门 + 休赛期微幅回落）
 */

import { FORMATIONS, FORMATION_SYSTEMS, getDefenseSystem } from '../../engine/src/formations';
import { FormationName, PlayerRole } from '../../engine/src/types';
import { ChemistryLink, DraftPlayer, LeagueClub } from './types';

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

/**
 * 计算或初始化球员对某一阵型的个人熟练度 (0..100)
 */
export function getPlayerFormationFamiliarity(
  player: DraftPlayer,
  formation: FormationName,
  skillWebUnlocked: string[] = []
): number {
  if (!player.formationFamiliarity) player.formationFamiliarity = {};
  const existing = player.formationFamiliarity[formation];
  if (typeof existing === 'number') return existing;

  if (player.isAcademy) {
    player.formationFamiliarity[formation] = 82;
    return 82;
  }

  // 年龄决定基础初始熟练度（老将经验老道但不过分，小妖慢热养成）
  const age = player.age ?? 24;
  const h = hashStr(`${player.id}_${formation}`);
  let base =
    age <= 21 ? 18 + (h % 9) :      // 18 ~ 26
    age <= 27 ? 28 + (h % 10) :     // 28 ~ 37
    42 + (h % 10);                  // 42 ~ 51

  // 阵型天然位置契合小幅加分
  const slots = FORMATIONS[formation] ?? [];
  if (slots.some(s => s.role === player.role)) {
    base += 6;
  } else if ((player.secondaryRoles ?? []).some(sr => slots.some(s => s.role === sr))) {
    base += 3;
  }

  // 技能树阵型专精节点加成
  if (skillWebUnlocked.includes(`fm_${formation}`)) {
    base += 10;
  }

  // 防线体系原点解锁后，同体系内共享 40% 最高熟练度继承
  const sys = getDefenseSystem(formation);
  const sysOrigin = sys === '4-back' ? 'sys_4back' : sys === '3-back' ? 'sys_3back' : 'sys_5back';
  if (skillWebUnlocked.includes(sysOrigin)) {
    const sameSysForms = FORMATION_SYSTEMS[sys].formations;
    let maxSameSys = 0;
    for (const f of sameSysForms) {
      const val = player.formationFamiliarity[f];
      if (typeof val === 'number' && val > maxSameSys) maxSameSys = val;
    }
    const inherited = Math.round(maxSameSys * 0.45);
    if (inherited > base) base = inherited;
  }

  const clamped = Math.max(15, Math.min(72, base));
  player.formationFamiliarity[formation] = clamped;
  return clamped;
}

/**
 * 获取两位球员之间的初始默契度（年龄越大初始配合越快，小妖需从头磨合）
 */
export function getInitialPairChemistry(a: DraftPlayer, b: DraftPlayer): number {
  const h = hashStr(pairKey(a.id, b.id));
  const ageA = a.age ?? 24;
  const ageB = b.age ?? 24;
  if (ageA >= 27 && ageB >= 27) return 15 + (h % 8); // 15 ~ 22
  if (ageA <= 22 && ageB <= 22) return 4 + (h % 6);  // 4 ~ 9
  return 8 + (h % 7);                                // 8 ~ 14
}

export function getOrCreateChemistryLink(
  links: Record<string, ChemistryLink>,
  a: DraftPlayer,
  b: DraftPlayer
): ChemistryLink {
  const key = pairKey(a.id, b.id);
  if (!links[key]) {
    links[key] = {
      score: getInitialPairChemistry(a, b),
      passes: 0,
      assists: 0,
      matches: 0,
    };
  }
  return links[key];
}

export interface FormationLinkSpec {
  slotA: number;
  slotB: number;
  playerA: DraftPlayer;
  playerB: DraftPlayer;
  kind: 'spine' | 'flank' | 'twin';
  defaultLabel: string;
}

/**
 * 提取当前阵型 11 名首发的「中轴脊柱 + 边路走廊 + 双塔/双锋」核心连线
 */
export function getFormationLinks(
  club: LeagueClub,
  squadMap: Map<string, DraftPlayer>
): FormationLinkSpec[] {
  const slots = FORMATIONS[club.formation];
  const starters = club.starterIds.map((id, idx) => ({
    idx,
    role: slots[idx]?.role ?? 'CM',
    baseX: slots[idx]?.baseX ?? 50,
    baseY: slots[idx]?.baseY ?? 34,
    player: squadMap.get(id),
  })).filter((s): s is { idx: number; role: PlayerRole; baseX: number; baseY: number; player: DraftPlayer } => !!s.player);

  const res: FormationLinkSpec[] = [];
  const added = new Set<string>();
  const pushLink = (aIdx: number, bIdx: number, kind: 'spine' | 'flank' | 'twin', defaultLabel: string) => {
    if (aIdx === bIdx) return;
    const pa = squadMap.get(club.starterIds[aIdx]);
    const pb = squadMap.get(club.starterIds[bIdx]);
    if (!pa || !pb) return;
    const k = aIdx < bIdx ? `${aIdx}-${bIdx}` : `${bIdx}-${aIdx}`;
    if (added.has(k)) return;
    added.add(k);
    res.push({ slotA: aIdx, slotB: bIdx, playerA: pa, playerB: pb, kind, defaultLabel });
  };

  const gk = starters.find(s => s.role === 'GK');
  const cbs = starters.filter(s => s.role === 'CB').sort((a, b) => Math.abs(a.baseY - 34) - Math.abs(b.baseY - 34));
  const dms = starters.filter(s => s.role === 'CDM' || s.role === 'CM').sort((a, b) => a.baseX - b.baseX);
  const cams = starters.filter(s => s.role === 'CAM');
  const sts = starters.filter(s => s.role === 'ST');

  // 1. 中轴脊柱：GK -> 中卫 -> 后腰/中前卫 -> 前腰 -> 中锋
  if (gk && cbs[0]) pushLink(gk.idx, cbs[0].idx, 'spine', '门卫出球');
  if (cbs[0] && dms[0]) pushLink(cbs[0].idx, dms[0].idx, 'spine', '中后衔接');
  if (dms.length >= 2) pushLink(dms[0].idx, dms[1].idx, 'spine', '中场双核');
  const topMid = cams[0] ?? dms[dms.length - 1];
  if (dms[0] && cams[0]) pushLink(dms[0].idx, cams[0].idx, 'spine', '中轴枢纽');
  if (topMid && sts[0]) pushLink(topMid.idx, sts[0].idx, 'spine', '中轴连线');

  // 2. 双中卫 / 双前锋横向搭档
  if (cbs.length >= 2) pushLink(cbs[0].idx, cbs[1].idx, 'twin', '钢铁双塔');
  if (cbs.length >= 3) pushLink(cbs[0].idx, cbs[2].idx, 'twin', '三卫协防');
  if (sts.length >= 2) pushLink(sts[0].idx, sts[1].idx, 'twin', '锋线双煞');

  // 3. 左右边路走廊
  const leftBack = starters.find(s => s.role === 'LB' || s.role === 'LWB');
  const leftWing = starters.find(s => s.role === 'LW' || s.role === 'LM');
  if (leftBack && leftWing) pushLink(leftBack.idx, leftWing.idx, 'flank', '左翼走廊');

  const rightBack = starters.find(s => s.role === 'RB' || s.role === 'RWB');
  const rightWing = starters.find(s => s.role === 'RW' || s.role === 'RM');
  if (rightBack && rightWing) pushLink(rightBack.idx, rightWing.idx, 'flank', '右翼走廊');

  return res;
}

/**
 * 计算当前首发中轴线平均默契度与中轴脊柱共振等级
 */
export function computeCentralSpineInfo(
  club: LeagueClub,
  links: Record<string, ChemistryLink>
): { avg: number; bonus: number; linkCount: number } {
  const squadMap = new Map(club.squad.map(p => [p.id, p]));
  const specs = getFormationLinks(club, squadMap).filter(l => l.kind === 'spine');
  if (specs.length === 0) return { avg: 0, bonus: 0, linkCount: 0 };

  let sum = 0;
  for (const sp of specs) {
    const lk = getOrCreateChemistryLink(links, sp.playerA, sp.playerB);
    sum += lk.score;
  }
  const avg = Math.round(sum / specs.length);
  const bonus = avg >= 85 ? 4 : avg >= 70 ? 2 : 0;
  return { avg, bonus, linkCount: specs.length };
}

/**
 * 休赛期默契度微幅回落：保留 88%（最低保留 15），并清零单季传球/助攻计数
 */
export function decayChemistryOffSeason(links: Record<string, ChemistryLink>): void {
  for (const key of Object.keys(links)) {
    const lk = links[key];
    lk.score = Math.max(15, Math.round(lk.score * 0.88));
    lk.passes = 0;
    lk.assists = 0;
    if (lk.score < 78) {
      delete lk.title;
    }
  }
}
