/**
 * 对手了解度、历史交锋记录、16维战术/球员/心态破绽推演（1400+ 动态随机线索池）与赛后复盘
 */

import { MatchState } from '../../engine/src/types';
import {
  DraftPlayer,
  LeagueClub,
  LeagueSaveState,
  OpponentClueItem,
  OpponentCounterOption,
  OpponentIntelRecord,
  OpponentMatchupIntel,
} from './types';

export function getOpponentIntelRecord(state: LeagueSaveState, oppClubId: string): OpponentIntelRecord {
  if (!state.opponentIntel) state.opponentIntel = {};
  if (!state.opponentIntel[oppClubId]) {
    const scoutLv = state.metaLevels?.scout ?? 0;
    state.opponentIntel[oppClubId] = {
      clubId: oppClubId,
      familiarity: Math.min(80, 15 + scoutLv * 12),
      playedCount: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    };
  }
  return state.opponentIntel[oppClubId];
}

export function updateOpponentIntelAfterMatch(
  state: LeagueSaveState,
  oppClubId: string,
  userGoals: number,
  oppGoals: number
): void {
  const rec = getOpponentIntelRecord(state, oppClubId);
  rec.playedCount += 1;
  if (userGoals > oppGoals) rec.wins += 1;
  else if (userGoals === oppGoals) rec.draws += 1;
  else rec.losses += 1;
  rec.lastScore = `${userGoals}:${oppGoals} (S${state.seasonNumber} R${state.currentRound})`;
  rec.familiarity = Math.min(100, rec.familiarity + 25);
}

export function generatePostMatchReview(
  m: MatchState,
  userClubName: string
): string {
  const isHome = m.homeName === userClubName;
  const myGoals = isHome ? m.homeScore : m.awayScore;
  const oppGoals = isHome ? m.awayScore : m.homeScore;
  const myStats = isHome ? m.stats.home : m.stats.away;
  const oppStats = isHome ? m.stats.away : m.stats.home;
  const totPoss = myStats.possessionTicks + oppStats.possessionTicks || 1;
  const myPoss = Math.round((myStats.possessionTicks / totPoss) * 100);

  if (myGoals > oppGoals) {
    if (oppStats.xG > myStats.xG + 0.4) {
      return `复盘：虽然 ${myGoals}:${oppGoals} 取胜，但对手创造了 ${oppStats.xG.toFixed(2)} xG，下场需留意防线保护。`;
    }
    return `复盘：控球 ${myPoss}%、预期进球 ${myStats.xG.toFixed(2)}，成功兑现战术优势拿下三分。`;
  }
  if (myGoals === oppGoals) {
    return `复盘：双方 ${myGoals}:${oppGoals} 战平（xG ${myStats.xG.toFixed(2)} : ${oppStats.xG.toFixed(2)}），临门一脚效率决定胜负。`;
  }
  if (myPoss >= 55 && oppStats.xG >= myStats.xG) {
    return `复盘：控球 ${myPoss}% 却以 ${myGoals}:${oppGoals} 落败，对手高效反击打穿了高位防线身后。`;
  }
  if (myStats.xG > oppStats.xG + 0.35) {
    return `复盘：创造出 ${myStats.xG.toFixed(2)} xG 却惜败，门前冷静度与射门把握尚需特训提升。`;
  }
  return `复盘：本场被对手压制（xG ${myStats.xG.toFixed(2)} : ${oppStats.xG.toFixed(2)}），下轮建议赛前侦察抓对手弱点。`;
}

type WeaknessArchetypeId =
  | 'high_line_behind'
  | 'flank_fatigue'
  | 'midfield_press'
  | 'gk_longshot'
  | 'park_bus_cross'
  | 'leaky_box'
  | 'drought_attack'
  | 'card_prone'
  | 'slow_cb_turn'
  | 'tired_core_legs'
  | 'weak_foot_turnover'
  | 'rookie_inexperience'
  | 'low_composure_panic'
  | 'drought_striker_tilt'
  | 'dressing_room_rift'
  | 'overconfident_complacency';

interface ArchetypeContext {
  opp: LeagueClub;
  form: string;
  styleName: string;
  gf: number;
  ga: number;
  recentLen: number;
  cbName: string;
  cbPace: number;
  cbDef: number;
  fbName: string;
  fbFit: number;
  fbDef: number;
  midName: string;
  midComp: number;
  midPass: number;
  gkName: string;
  gkSave: number;
  gkPos: number;
  attName: string;
  attShoot: number;
  attGoals: number;
  tiredName: string;
  tiredFit: number;
  rookieName: string;
  rookieAge: number;
  lowCompName: string;
  lowCompVal: number;
  yellows: number;
  suspendedCount: number;
  streakText: string;
}

interface ArchetypeDef {
  id: WeaknessArchetypeId;
  counterLabels: string[];
  counterDesc: string;
  buff: OpponentCounterOption['buff'];
  evidences: Array<(c: ArchetypeContext) => string>;
  decoys: Array<(c: ArchetypeContext) => string>;
}

const CLUE_CHANNELS = [
  '【训练场线报】',
  '【录像分析师笔记】',
  '【更衣室匿名消息】',
  '【随队记者专栏】',
  '【球探现场观察】',
  '【数据模型预警】',
  '【热身赛情报】',
  '【赛前发布会细节】',
] as const;

const ARCHETYPES: Record<WeaknessArchetypeId, ArchetypeDef> = {
  high_line_behind: {
    id: 'high_line_behind',
    counterLabels: ['指证：直塞打高位身后', '指证：反击突击防线空当', '指证：斜长传吊打身后'],
    counterDesc: '速度+3、传球+2、开局能量+1',
    buff: { paceBonus: 3, passingBonus: 2, energyBonus: 1, note: '抓准高位防线身后空当！全队速度+3、传球+2，开局能量+1' },
    evidences: [
      c => `${c.opp.name}防线前压极深，中卫${c.cbName}速度仅${c.cbPace}，转身追防极吃力`,
      c => `${c.form}体系压上过猛，近${c.recentLen || 1}轮屡次被对手直塞打穿防线身后`,
      c => `后防线平均回追速度偏慢(${c.cbPace})，一旦中场丢球身后就是大片开阔地`,
      c => `主帅执迷高位造越位，但${c.cbName}起速慢，反越位斜插一打一个准`,
      c => `防线与门将之间空当巨大，快速反击与直塞球是撕开${c.opp.name}的最佳钥匙`,
    ],
    decoys: [
      c => `传闻${c.opp.name}本周改练五后卫深度退守，禁区前沿几乎不留冲刺空间`,
      c => `消息称中卫${c.cbName}近期加练了回追冲刺，防线身后保护非常严密`,
      c => `赛前风声显示对手准备全面回收半场打铁桶，直塞球很难找到空当`,
      c => `热身观察称${c.opp.name}大幅下调了防线高度，宁可放弃控球也要守住身后`,
      c => `内部人士透露对手本轮忌惮速度型前锋，已安排专人拖后扫荡防直塞`,
      c => `线报称${c.opp.name}后防协同极佳，近阶段几乎没有被对手反越位成功过`,
    ],
  },
  flank_fatigue: {
    id: 'flank_fatigue',
    counterLabels: ['指证：两翼轮番冲击边路', '指证：边路强吃体能短板', '指证：边中结合撕开肋部'],
    counterDesc: '速度+3、射门+2、开局能量+1',
    buff: { paceBonus: 3, shootingBonus: 2, energyBonus: 1, note: '撕开对手边路防线！全队速度+3、射门+2，开局能量+1' },
    evidences: [
      c => `边卫${c.fbName}体能仅剩${c.fbFit}%且防守${c.fbDef}，边路上下往返已力不从心`,
      c => `${c.form}阵型边路保护薄弱，${c.fbName}身后经常出现一对二的无解局面`,
      c => `对手边后卫连续作战体能疲惫，下半场边路回防速度明显掉档`,
      c => `${c.opp.name}两翼协防脱节，边锋与边卫之间的肋部通道频频漏风`,
      c => `针对${c.fbName}所在侧持续下底传中或内切，能迅速耗空对手边路防线`,
    ],
    decoys: [
      c => `球探简报称${c.fbName}体能恢复极佳，边路一对一防守几乎滴水不漏`,
      c => `消息称对手本轮在两翼安排了双人协防锁边，边路强突很难占到便宜`,
      c => `赛前风声显示${c.opp.name}重点强化了边路折返跑，两翼防线固若金汤`,
      c => `线报透露对手边后卫本场得到充分轮休，速度与体能均处于巅峰`,
      c => `观察显示${c.opp.name}边路退防极快，强打两翼反而容易陷入包夹丢球`,
      c => `内部消息称对手宁可放空禁区弧顶，也要死守两侧边路走廊`,
    ],
  },
  midfield_press: {
    id: 'midfield_press',
    counterLabels: ['指证：中路高压绞杀出球', '指证：贴身逼抢切断节拍', '指证：封锁中场出球轴心'],
    counterDesc: '传球+3、防守+2、开局能量+1',
    buff: { passingBonus: 3, defendingBonus: 2, energyBonus: 1, note: '切断对手中场出球轴心！全队传球+3、防守+2，开局能量+1' },
    evidences: [
      c => `中场${c.midName}抗压冷静度仅${c.midComp}，遭高位贴身逼抢极易传球失误`,
      c => `${c.opp.name}中场衔接生涩(均传${c.midPass})，一被中路绞杀前后场就彻底脱节`,
      c => `核心出球点${c.midName}缺少接应点，中路施压能直接就地打成反击`,
      c => `对手中场推进节奏偏慢且护球不稳，高强度对抗下失误率飙升`,
      c => `切断${c.midName}的拿球转身路线，${c.opp.name}的进攻组织便会陷入瘫痪`,
    ],
    decoys: [
      c => `坊间传闻${c.midName}近期脚感火热，中场短传渗透极其稳健不怕逼抢`,
      c => `消息称${c.opp.name}中场出球点众多，正面高位绞杀反而容易被一脚打穿`,
      c => `线报称对手中场线对抗强硬，中路肉搏很难从${c.midName}脚下断球`,
      c => `赛前评估显示对手擅长利用长传直接跳过中场，逼抢中路收效甚微`,
      c => `内部人士透露${c.opp.name}专门演练了破解高压逼抢的三角出球套路`,
      c => `热身观察称${c.midName}状态沉稳，面对包夹也能从容完成摆脱分球`,
    ],
  },
  gk_longshot: {
    id: 'gk_longshot',
    counterLabels: ['指证：外围远射轰门试探', '指证：弧顶重炮打击门将', '指证：多起脚考验门线站位'],
    counterDesc: '射门+4、传球+1、开局能量+1',
    buff: { shootingBonus: 4, passingBonus: 1, energyBonus: 1, note: '瞄准门将站位与扑救短板！全队射门+4、传球+1，开局能量+1' },
    evidences: [
      c => `门将${c.gkName}扑救仅${c.gkSave}、站位${c.gkPos}，面对禁区外重炮远射反应偏慢`,
      c => `${c.gkName}选位习惯过于靠前，弧顶一带果断起脚远射或吊射威胁极大`,
      c => `对手门将脱手率偏高(${c.gkSave})，外围大力射门能制造大量补射良机`,
      c => `近几轮对手远射失球偏多，${c.gkName}对贴地斩与弧线球的判断存在明显盲区`,
      c => `无需非要渗透进小禁区，在20米外果断起脚就能直接动摇${c.gkName}的防线`,
    ],
    decoys: [
      c => `赛前消息称门将${c.gkName}近期扑救手感爆棚，禁区外远射几乎毫无威胁`,
      c => `线报称${c.gkName}门线反应极快，想破门必须耐心地传导渗透到小禁区`,
      c => `专栏指出${c.opp.name}门将最擅长扑救远射，外围起脚只会白白交出球权`,
      c => `内部消息称${c.gkName}训练中连续扑出重炮轰门，心理信心正处于巅峰`,
      c => `观察显示对手禁区前沿封堵极其积极，几乎不给对手起脚远射的视野`,
      c => `传闻${c.opp.name}门将高接低挡状态神勇，只有近距离抢点才能攻破十指关`,
    ],
  },
  park_bus_cross: {
    id: 'park_bus_cross',
    counterLabels: ['指证：边路起球破密集防线', '指证：高空轰炸砸开铁桶', '指证：转移调度拉扯大巴'],
    counterDesc: '传球+3、射门+2、开局能量+1',
    buff: { passingBonus: 3, shootingBonus: 2, energyBonus: 1, note: '两翼传中撕破铁桶阵！全队传球+3、射门+2，开局能量+1' },
    evidences: [
      c => `${c.opp.name}摆出${c.form}密集铁桶阵，中路堆满防守队员但两翼传中点防不住`,
      c => `对手禁区正面人山人海，唯有大范围横向转移与高空传中能拉开防线`,
      c => `${c.styleName}打法过度收缩中路，二点球保护和后点包抄经常无人盯防`,
      c => `面对${c.opp.name}的${c.form}低位防线，强走中路只会陷入泥潭，边路起球才是正解`,
      c => `对手防线虽密但防空层次混乱，高空轰炸与下底倒三角能制造决定性杀机`,
    ],
    decoys: [
      c => `小道消息称${c.opp.name}中卫防空能力极强，边路高空球基本会被直接解围`,
      c => `线报称对手本轮准备高位压出对攻，中路地面短传渗透空间非常充裕`,
      c => `传闻${c.opp.name}禁区制空权垄断级存在，传中打法完全占不到半点便宜`,
      c => `消息称对手阵型拉得很散，直接中路直塞就能打穿，根本不必费力起高球`,
      c => `热身观察称${c.opp.name}边路拦截传中成功率极高，建议坚持中路地面配合`,
      c => `内部消息称对手中卫头球解围精准，边路传中反而容易送给对手反击起点`,
    ],
  },
  leaky_box: {
    id: 'leaky_box',
    counterLabels: ['指证：肋部渗透强攻禁区', '指证：直捣漏洞百出的禁区', '指证：小范围配合打穿中卫'],
    counterDesc: '射门+3、速度+2、开局能量+1',
    buff: { shootingBonus: 3, paceBonus: 2, energyBonus: 1, note: '直捣脆弱禁区腹地！全队射门+3、速度+2，开局能量+1' },
    evidences: [
      c => `近${c.recentLen || 1}轮狂丢${c.ga}球，中卫${c.cbName}(防${c.cbDef})禁区内盯人频频走神漏人`,
      c => `${c.opp.name}禁区防守沟通混乱${c.suspendedCount > 0 ? `且有${c.suspendedCount}人缺阵` : ''}，肋部斜插极易获单刀`,
      c => `中卫线平均防守仅${c.cbDef}，面对禁区内二过一撞墙配合几乎毫无招架之力`,
      c => `对手门前解围不干净、补位缓慢，持续冲击禁区腹地就能逼出致命失误`,
      c => `${c.cbName}领衔的防线近期失球不断，只要把球送入危险区域就有极高转化率`,
    ],
    decoys: [
      c => `内部传闻${c.opp.name}重点加练了禁区协防，中路渗透很难找到起脚空当`,
      c => `线报称中卫${c.cbName}近期状态回勇，禁区内一对一防守成功率大幅提升`,
      c => `消息称对手门前筑起铜墙铁壁，想靠禁区配合打穿几乎是不可能完成的任务`,
      c => `专栏分析认为${c.opp.name}防线整体性极强，近期丢球多纯属门将个人偶然失误`,
      c => `赛前风声显示对手准备在禁区前布置双后腰屏障，中路渗透将寸步难行`,
      c => `观察表明${c.opp.name}中卫盯人极为贴身，进攻端很难在禁区内得到转身空间`,
    ],
  },
  drought_attack: {
    id: 'drought_attack',
    counterLabels: ['指证：全线压上围攻半场', '指证：大胆前压碾压攻势', '指证：趁对手哑火猛攻抢分'],
    counterDesc: '传球+2、射门+2、开局能量+1',
    buff: { passingBonus: 2, shootingBonus: 2, energyBonus: 1, note: '趁对手锋线哑火大胆压上！全队传球+2、射门+2，开局能量+1' },
    evidences: [
      c => `近${c.recentLen || 1}轮仅进${c.gf}球，锋线均射${c.attShoot}，进攻端缺乏一锤定音的爆点`,
      c => `主力前锋${c.attName}射门仅${c.attShoot}，面对压上围攻也难以打出高质量反击`,
      c => `${c.opp.name}前场终结效率跌入谷底，我方完全可以放心前压把战火烧到对方半场`,
      c => `对手进攻线配合脱节、支点拿不住球，大举压上围攻几乎没有后顾之忧`,
      c => `锋线哑火让${c.opp.name}心态愈发保守，持续半场围攻极易击溃其心理防线`,
    ],
    decoys: [
      c => `球探警告称${c.opp.name}锋线反击极其锐利，大举压上极易被对手偷袭得手`,
      c => `消息称前锋${c.attName}训练中射门脚感滚烫，防线必须留足重兵严防反击`,
      c => `线报显示对手专打以弱胜强的快速防反，前压围攻正中${c.opp.name}下怀`,
      c => `赛前风声称对手前场速度奇快，我方防线不宜过分压上以免后院起火`,
      c => `内部人士透露${c.opp.name}本轮蓄力反击，近期进球少只是战术性收力`,
      c => `观察指出${c.attName}反越位嗅觉敏锐，稍有松懈就会被对手打成致命反击`,
    ],
  },
  card_prone: {
    id: 'card_prone',
    counterLabels: ['指证：突破造犯规抢定位球', '指证：冲击毛躁防线造黄牌', '指证：盘带贴身诱发犯规'],
    counterDesc: '射门+2、速度+2、传球+1、开局能量+1',
    buff: { shootingBonus: 2, paceBonus: 2, passingBonus: 1, energyBonus: 1, note: '利用对手防线毛躁制造定位球！全队攻传+2、速度+2，开局能量+1' },
    evidences: [
      c => `${c.opp.name}本季已狂领${c.yellows}张黄牌，防线动作偏大极易在危险区域送定位球`,
      c => `对手防守习惯鲁莽下脚，多用突破与变向冲击能制造大量前场任意球甚至红黄牌`,
      c => `面对${c.opp.name}的粗野防守，大胆一对一强突能迅速让对手主力背上黄牌束手束脚`,
      c => `对手犯规数居高不下，利用前场定位球和点球压力能轻松打破比赛平衡`,
      c => `后卫${c.cbName}拦截动作过大，正面带球加速变向极易骗出犯规良机`,
    ],
    decoys: [
      c => `赛前评估显示${c.opp.name}防线纪律极其严明，极少在禁区前送出任意球`,
      c => `线报称对手防守强调站位卡线而不盲目下脚，造犯规战术很难奏效`,
      c => `消息称${c.opp.name}主帅严格整顿了防守纪律，本场犯规率将大幅下降`,
      c => `观察显示对手裁判尺度偏宽松，盲目寻求身体对抗突破容易吃亏`,
      c => `内部消息称对手中卫下脚极其精准干脆，一对一强突造犯规成功率很低`,
      c => `专栏指出${c.opp.name}定位球防守严密，即使送出任意球也难以对其造成实质威胁`,
    ],
  },
  slow_cb_turn: {
    id: 'slow_cb_turn',
    counterLabels: ['指证：变向与小快灵戏耍中卫', '指证：地面斜塞打中卫转身', '指证：高频换位撕扯笨重中卫'],
    counterDesc: '速度+3、射门+2、开局能量+1',
    buff: { paceBonus: 3, shootingBonus: 2, energyBonus: 1, note: '专打中卫转身笨重！全队速度+3、射门+2，开局能量+1' },
    evidences: [
      c => `中卫${c.cbName}虽然高大但速度仅${c.cbPace}，面对灵巧型前锋的连续变向极其笨重`,
      c => `${c.opp.name}双中卫转身速率偏慢，禁区前突然撞墙二过一能瞬间甩开半个身位`,
      c => `与其和${c.cbName}拼高空对抗，不如多打地面脚下配合与斜向穿插`,
      c => `对手中卫习惯上抢却回身慢，假动作晃动与横向拉扯能让其频频失位`,
      c => `${c.cbName}在开放空间内一对一防守吃亏，把阵型拉开打快节奏反击效果拔群`,
    ],
    decoys: [
      c => `线报称中卫${c.cbName}卡位意识极强，小快灵前锋很难在其面前完成转身`,
      c => `消息显示${c.opp.name}防线采用双中卫一前一后保护，完全不怕地面穿插`,
      c => `专栏认为对手中卫脚下频率不慢，盲目追求地面单兵突破容易陷入包夹`,
      c => `赛前风声称${c.opp.name}专门安排了防守型后腰替中卫扫荡补位`,
      c => `内部人士透露对手防线收得很窄，地面渗透几乎没有闪转腾挪的缝隙`,
      c => `热身观察称${c.cbName}动作敏捷灵活，正面突破很难轻易将其过掉`,
    ],
  },
  tired_core_legs: {
    id: 'tired_core_legs',
    counterLabels: ['指证：高节奏拉锯拖垮体能', '指证：重点冲击疲惫主力点', '指证：加快转换消耗对手残血'],
    counterDesc: '速度+2、传球+3、开局能量+1',
    buff: { paceBonus: 2, passingBonus: 3, energyBonus: 1, note: '精准打击体能透支点！全队速度+2、传球+3，开局能量+1' },
    evidences: [
      c => `核心${c.tiredName}体能仅剩${c.tiredFit}%，连续征战已显露疲态，60分钟后必然大幅掉速`,
      c => `${c.opp.name}多名主力体能亮起黄灯(${c.tiredName} ${c.tiredFit}%)，开场加快传递就能拖垮对方`,
      c => `对手上周消耗过大、恢复不足，中后段比赛的回追与逼抢强度将明显下滑`,
      c => `把球频繁调度到${c.tiredName}防区，反复消耗就能在下半场收割胜局`,
      c => `体能储备处于劣势的${c.opp.name}最怕高节奏攻防转换，保持跑动就能压垮对手`,
    ],
    decoys: [
      c => `线报称${c.opp.name}本轮进行了大面积体能轮休，全队活力非常充沛`,
      c => `消息透露${c.tiredName}经过理疗师加急恢复，体能已重回满格状态`,
      c => `赛前风声显示对手储备体能极佳，打高节奏消耗战我方未必占优`,
      c => `内部人士称${c.opp.name}本场打算靠体能冲垮对手，开场逼抢会非常凶猛`,
      c => `观察指出对手替补席生力军充足，体能问题根本不会成为本场隐患`,
      c => `专栏分析认为${c.opp.name}节奏控制老道，懂得在场上合理分配体能`,
    ],
  },
  weak_foot_turnover: {
    id: 'weak_foot_turnover',
    counterLabels: ['指证：围堵出球弱点打反击', '指证：压迫失误率高发区', '指证：断球就地发起快攻'],
    counterDesc: '防守+3、速度+2、开局能量+1',
    buff: { defendingBonus: 3, paceBonus: 2, energyBonus: 1, note: '精准断球反击！全队防守+3、速度+2，开局能量+1' },
    evidences: [
      c => `对手中前场传球均分仅${c.midPass}，${c.midName}逆足与长传失误频发，是天然的反击发起点`,
      c => `${c.opp.name}由守转攻第一脚出球粗糙，前场贴防逼其仓促起脚就能直接断下球权`,
      c => `多名进攻队员技术粗糙、盘带丢球率高，只要阵型紧凑拦截就能频频打反击`,
      c => `${c.midName}在压迫下传球成功率骤降，放其最不擅长的侧翼持球就能轻松断球`,
      c => `对手进攻端失误偏多，稳固拦截后迅速直塞前锋能打出极高效率的反击`,
    ],
    decoys: [
      c => `球探报告称${c.midName}脚法细腻、出球失误率极低，逼抢很难讨到便宜`,
      c => `消息称${c.opp.name}近期重点打磨了由守转攻的短传衔接，流畅度极高`,
      c => `线报透露对手前场球员护球能力很强，抢断不成功反而会暴露身后`,
      c => `赛前风声称${c.opp.name}减少冒险传球，整体传球成功率高居联赛前列`,
      c => `内部消息显示对手中前场技术功底扎实，盲目上抢容易被对手连续过人`,
      c => `专栏指出${c.opp.name}擅长诱导对手上抢后再打空当，需谨慎防守`,
    ],
  },
  rookie_inexperience: {
    id: 'rookie_inexperience',
    counterLabels: ['指证：老道施压考验年轻球员', '指证：针对U21新星心态盲区', '指证：节奏变化打乱新秀防线'],
    counterDesc: '传球+2、射门+2、防守+1、开局能量+1',
    buff: { passingBonus: 2, shootingBonus: 2, defendingBonus: 1, energyBonus: 1, note: '老辣针对年轻新星！全队传射+2、防守+1，开局能量+1' },
    evidences: [
      c => `年轻首发${c.rookieName}(${c.rookieAge}岁)大赛经验尚浅，面对连续压迫极易判断失误`,
      c => `${c.opp.name}启用多名年轻球员挑大梁，比赛陷入胶着时容易出现站位失神`,
      c => `${c.rookieName}虽然有冲劲但阅读比赛不足，假跑动与节奏变化能轻松调动其失位`,
      c => `对手年轻防线在客场/高压环境下抗压能力薄弱，开局抢攻能迅速打乱其部署`,
      c => `针对${c.rookieName}所在区域多做穿插配合，年轻球员的协防交接极易出错`,
    ],
    decoys: [
      c => `随队记者盛赞${c.rookieName}(${c.rookieAge}岁)球风极其老练，丝毫看不出年轻球员的青涩`,
      c => `消息称${c.opp.name}这批年轻球员初生牛犊不怕虎，越是高压越能超常发挥`,
      c => `线报称${c.rookieName}在队内老将带领下站位非常稳健，几乎没有低级失误`,
      c => `赛前风声显示对手年轻阵容跑动覆盖惊人，老道控节奏反而可能被冲散`,
      c => `内部人士透露${c.opp.name}青年军默契度极高，长期配合让其防线严丝合缝`,
      c => `观察指出${c.rookieName}心理素质过硬，常规的节奏变化很难欺骗到他`,
    ],
  },
  low_composure_panic: {
    id: 'low_composure_panic',
    counterLabels: ['指证：高压抢攻逼出防线慌乱', '指证：针对冷静度不足强行施压', '指证：连续冲击击溃心理防线'],
    counterDesc: '射门+3、传球+2、开局能量+1',
    buff: { shootingBonus: 3, passingBonus: 2, energyBonus: 1, note: '高压击溃脆弱心态！全队射门+3、传球+2，开局能量+1' },
    evidences: [
      c => `${c.lowCompName}冷静度仅${c.lowCompVal}，一旦被对手连续射门或先丢球，全队防守极易慌乱`,
      c => `对手中后场心理承压能力偏弱(${c.lowCompName} ${c.lowCompVal})，开场猛攻能迅速制造混乱`,
      c => `${c.opp.name}关键时刻容易解围踢呲或传球回传失误，高压逼抢收益极高`,
      c => `球员心态普遍偏急躁，一旦比分僵持或落后，防守站位就会开始脱节`,
      c => `不断向${c.lowCompName}施压，就能迫使对手在门前犯下致命的低级错误`,
    ],
    decoys: [
      c => `线报称${c.opp.name}队内心理辅导效果显著，球员在逆境下依然极其沉稳`,
      c => `消息称${c.lowCompName}近期表现十分冷静老道，抗压能力在队内名列前茅`,
      c => `赛前风声显示对手主打沉稳防守反击，开场抢攻很难让其阵脚大乱`,
      c => `内部人士透露${c.opp.name}越到关键球处理越果断，几乎不会出现慌乱解围`,
      c => `观察指出对手后防核心情绪控制极佳，连续冲击也无法动摇其防守体系`,
      c => `专栏称赞${c.opp.name}具备强队心态，领先或落后都能严格执行既定战术`,
    ],
  },
  drought_striker_tilt: {
    id: 'drought_striker_tilt',
    counterLabels: ['指证：孤立球荒前锋诱导浪射', '指证：放突不放传锁死锋线心态', '指证：针对急躁射手稳守反击'],
    counterDesc: '防守+3、传球+2、开局能量+1',
    buff: { defendingBonus: 3, passingBonus: 2, energyBonus: 1, note: '利用前锋球荒急躁心态！全队防守+3、传球+2，开局能量+1' },
    evidences: [
      c => `当家前锋${c.attName}近期球荒焦虑明显(本季${c.attGoals}球)，拿球后急躁浪射不愿分球`,
      c => `${c.attName}心态失衡急于证明自己，贴身限制其内切角度即可逼其频繁浪射交出球权`,
      c => `${c.opp.name}锋线因长期破门乏术产生内耗，切断前锋与中场连线即可彻底熄火`,
      c => `对手进攻过于依赖急躁的${c.attName}，守住禁区正面就能稳稳化解危机`,
      c => `当家射手久疏球门导致信心动摇，门前面对门将时冷静度大打折扣`,
    ],
    decoys: [
      c => `线报称前锋${c.attName}心态极其放松，主动为队友做球策应，团队配合流畅`,
      c => `消息显示${c.attName}射门效率正在稳步回升，本轮极有可能迎来爆发`,
      c => `赛前风声称对手锋线多点开花，并非只靠${c.attName}一人解决战斗`,
      c => `内部人士透露主帅对${c.attName}给予绝对信任，其状态已无任何心理包袱`,
      c => `观察指出${c.attName}无球跑动非常无私，若盲目盯死他反而会漏掉后插上`,
      c => `专栏认为${c.opp.name}前场传切默契极高，锋线心态并未受到任何外界影响`,
    ],
  },
  dressing_room_rift: {
    id: 'dressing_room_rift',
    counterLabels: ['指证：抢开局击穿低迷士气', '指证：乘更衣室动荡痛打落水狗', '指证：前15分钟强攻抢先手'],
    counterDesc: '射门+3、速度+2、开局能量+1',
    buff: { shootingBonus: 3, paceBonus: 2, energyBonus: 1, note: '趁对手士气低迷抢下先手！全队射门+3、速度+2，开局能量+1' },
    evidences: [
      c => `${c.opp.name}${c.streakText}导致更衣室气氛压抑，球员场上互相抱怨、协防积极性大减`,
      c => `连续丢分让对手全队士气跌入谷底，只要我方率先破门对手就会迅速溃散`,
      c => `更衣室传出主帅与部分主力战术分歧，场上执行力与回防意愿明显不足`,
      c => `低迷的战绩令${c.opp.name}球员信心不足，开场高强度压迫就能迅速建立优势`,
      c => `对手目前处于心理脆弱期，前20分钟抢攻得手基本就能锁定比赛基调`,
    ],
    decoys: [
      c => `随队记者表示${c.opp.name}更衣室异常团结，全队正憋着一股劲准备触底反弹`,
      c => `线报称对手赛前召开了全队动员大会，目前士气高昂战意十足`,
      c => `内部消息透露主帅完全掌控着更衣室，球员在场上拼抢会比以往更凶狠`,
      c => `赛前风声显示${c.opp.name}众志成城，这轮比赛绝不会轻易在心理上崩盘`,
      c => `观察称对手热身时氛围轻松专注，毫无所谓更衣室矛盾的迹象`,
      c => `专栏指出低谷中的${c.opp.name}往往更具韧性，抢开局小心反被对手偷袭`,
    ],
  },
  overconfident_complacency: {
    id: 'overconfident_complacency',
    counterLabels: ['指证：诱敌深入打轻敌反击', '指证：抓对手大意冒进打身后', '指证：稳固阵脚惩罚对手轻敌'],
    counterDesc: '防守+2、速度+3、开局能量+1',
    buff: { defendingBonus: 2, paceBonus: 3, energyBonus: 1, note: '惩罚对手连胜轻敌冒进！全队防守+2、速度+3，开局能量+1' },
    evidences: [
      c => `${c.opp.name}${c.streakText}后全队明显轻敌飘飘然，防守回位懒散且喜欢全员压上`,
      c => `连胜光环让对手过度自信，边后卫与后腰经常盲目插上留出巨大反击空间`,
      c => `对手赛前普遍看轻本场对决，防守端专注度不够，反击偷袭一抓一个准`,
      c => `全队心态过于冒进贪功，只要稳住前20分钟防守，对手自己就会露出破绽`,
      c => `骄兵必败，利用${c.opp.name}大举压上的傲慢心态打快速防反胜算极大`,
    ],
    decoys: [
      c => `线报称${c.opp.name}主帅在连胜后依然严厉敲打全队，防守态度极其谨慎`,
      c => `消息称对手对本场比赛做足了功课，绝不会犯轻敌冒进的低级错误`,
      c => `赛前风声显示${c.opp.name}虽然战绩出色但踢法依然务实稳健`,
      c => `内部人士透露对手本轮打算先稳固防守再图进攻，不会轻易全员压上`,
      c => `观察显示对手训练强度不减反增，心态专注度维持在极高水准`,
      c => `专栏分析认为${c.opp.name}已形成成熟赢球习惯，打法严谨很少留反击空当`,
    ],
  },
};

export function buildOpponentMatchupIntel(state: LeagueSaveState, userClub: LeagueClub): OpponentMatchupIntel | null {
  const fx = state.fixtures.find(
    f => f.round === state.currentRound && !f.played && (f.homeClubId === userClub.id || f.awayClubId === userClub.id)
  );
  if (!fx) return null;
  const oppId = fx.homeClubId === userClub.id ? fx.awayClubId : fx.homeClubId;
  const opp = state.clubs.find(c => c.id === oppId);
  if (!opp) return null;

  const rec = getOpponentIntelRecord(state, oppId);
  const fam = rec.familiarity;

  const oppRecent = state.fixtures
    .filter(f => f.played && (f.homeClubId === oppId || f.awayClubId === oppId))
    .slice(-3);
  let gf = 0;
  let ga = 0;
  const formChars: string[] = [];
  const scoreDetails: string[] = [];
  for (const m of oppRecent) {
    const isH = m.homeClubId === oppId;
    const myG = isH ? m.homeGoals : m.awayGoals;
    const opG = isH ? m.awayGoals : m.homeGoals;
    gf += myG;
    ga += opG;
    formChars.push(myG > opG ? 'W' : myG === opG ? 'D' : 'L');
    scoreDetails.push(`${myG}:${opG}`);
  }
  const recentFormText = oppRecent.length === 0
    ? '赛季初轮，暂无近期联赛样本'
    : fam >= 35
      ? `近${oppRecent.length}轮 [${formChars.join('-')}] (${scoreDetails.join(' / ')}) · 进${gf}失${ga}`
      : `近${oppRecent.length}轮走势 [${formChars.join('-')}] (深度侦察解锁比分详情)`;

  const h2hText = rec.playedCount === 0
    ? '首次交锋 · 暂无过往战绩'
    : `历史交锋 ${rec.playedCount}场 (${rec.wins}胜${rec.draws}平${rec.losses}负${rec.lastScore ? ` · 上次 ${rec.lastScore}` : ''})`;

  const squadMap = new Map(opp.squad.map(p => [p.id, p]));
  const starters = opp.starterIds.map(id => squadMap.get(id)).filter((p): p is DraftPlayer => !!p);
  const gk = starters.find(p => p.role === 'GK') ?? opp.squad.find(p => p.role === 'GK');
  const cbs = starters.filter(p => p.role === 'CB');
  const fullbacks = starters.filter(p => ['LB', 'RB', 'LWB', 'RWB'].includes(p.role));
  const mids = starters.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role));
  const atts = starters.filter(p => ['LW', 'RW', 'ST'].includes(p.role));

  const avgAttr = (list: DraftPlayer[], fn: (p: DraftPlayer) => number, fallback = 62) =>
    list.length ? Math.round(list.reduce((s, p) => s + fn(p), 0) / list.length) : fallback;

  const slowestCb = [...cbs].sort((a, b) => a.attributes.pace - b.attributes.pace)[0];
  const weakFb = [...fullbacks].sort((a, b) => (a.fitness ?? 100) - (b.fitness ?? 100) || a.attributes.defending - b.attributes.defending)[0];
  const weakMid = [...mids].sort((a, b) => a.attributes.composure - b.attributes.composure)[0];
  const mainAtt = [...atts].sort((a, b) => b.ca - a.ca)[0];
  const tiredStarter = [...starters].sort((a, b) => (a.fitness ?? 100) - (b.fitness ?? 100))[0];
  const youngestStarter = [...starters].sort((a, b) => a.age - b.age)[0];
  const lowCompStarter = [...starters].sort((a, b) => a.attributes.composure - b.attributes.composure)[0];

  const cbPace = avgAttr(cbs, p => p.attributes.pace);
  const cbDef = avgAttr(cbs, p => p.attributes.defending);
  const fbFit = weakFb ? Math.round(weakFb.fitness ?? 100) : 90;
  const fbDef = avgAttr(fullbacks, p => p.attributes.defending);
  const midComp = avgAttr(mids, p => p.attributes.composure);
  const midPass = avgAttr(mids, p => p.attributes.passing);
  const attShoot = avgAttr(atts, p => p.attributes.shooting);
  const gkSave = gk ? gk.attributes.goalkeeping : 60;
  const gkPos = gk ? gk.attributes.positioning : 60;
  const yellows = opp.squad.reduce((s, p) => s + p.seasonStats.yellowCards, 0);
  const suspendedCount = opp.squad.filter(p => (p.suspendedRounds ?? 0) > 0 || (p.injuredRounds ?? 0) > 0).length;

  const winsRecent = formChars.filter(c => c === 'W').length;
  const lossesRecent = formChars.filter(c => c === 'L').length;
  const streakText = winsRecent >= 2 ? `近${oppRecent.length}轮${winsRecent}胜` : lossesRecent >= 2 ? `近${oppRecent.length}轮${lossesRecent}负` : '近期状态起伏';

  const styleMap: Record<string, string> = {
    tiki_taka: '传控渗透',
    gegenpress: '高位逼抢',
    balanced: '均衡阵地',
    wing_play: '两翼齐飞',
    counter: '快速反击',
    park_bus: '铁桶防反',
  };

  const ctxObj: ArchetypeContext = {
    opp,
    form: opp.formation,
    styleName: styleMap[opp.style] || opp.style,
    gf,
    ga,
    recentLen: oppRecent.length,
    cbName: slowestCb?.name ?? '主力中卫',
    cbPace,
    cbDef,
    fbName: weakFb?.name ?? '边后卫',
    fbFit,
    fbDef,
    midName: weakMid?.name ?? '中场枢纽',
    midComp,
    midPass,
    gkName: gk?.name ?? '主力门将',
    gkSave,
    gkPos,
    attName: mainAtt?.name ?? '头号射手',
    attShoot,
    attGoals: mainAtt?.seasonStats.goals ?? 0,
    tiredName: tiredStarter?.name ?? '主力球员',
    tiredFit: Math.round(tiredStarter?.fitness ?? 88),
    rookieName: youngestStarter?.name ?? '年轻首发',
    rookieAge: youngestStarter?.age ?? 21,
    lowCompName: lowCompStarter?.name ?? '后防主力',
    lowCompVal: lowCompStarter?.attributes.composure ?? 60,
    yellows,
    suspendedCount,
    streakText,
  };

  // 为 16 个战术/球员/心态维度动态评分（加入少量伪随机权重让每场切入点更丰富）
  const pseudoNoise = (idx: number) => ((state.currentRound * 17 + state.seasonNumber * 31 + opp.name.charCodeAt(0) + idx * 7) % 9);

  const candidates: Array<{ id: WeaknessArchetypeId; score: number }> = [
    { id: 'high_line_behind', score: (opp.style === 'gegenpress' ? 30 : 0) + Math.max(0, 72 - cbPace) * 1.3 + pseudoNoise(1) },
    { id: 'flank_fatigue', score: (opp.style === 'wing_play' ? 18 : 0) + (fullbacks.length <= 1 ? 22 : 0) + Math.max(0, 86 - fbFit) * 1.2 + Math.max(0, 68 - fbDef) + pseudoNoise(2) },
    { id: 'midfield_press', score: (opp.style === 'tiki_taka' ? 20 : 0) + Math.max(0, 70 - midComp) * 1.2 + Math.max(0, 70 - midPass) + pseudoNoise(3) },
    { id: 'gk_longshot', score: Math.max(0, 74 - gkSave) * 1.4 + Math.max(0, 70 - gkPos) * 0.5 + pseudoNoise(4) },
    { id: 'park_bus_cross', score: (opp.style === 'park_bus' || opp.formation.startsWith('5-') ? 34 : 0) + (cbDef >= 68 ? 8 : 0) + pseudoNoise(5) },
    { id: 'leaky_box', score: (oppRecent.length > 0 && ga >= 4 ? 28 : 0) + Math.max(0, 70 - cbDef) * 1.2 + suspendedCount * 7 + pseudoNoise(6) },
    { id: 'drought_attack', score: (oppRecent.length > 0 && gf <= 2 ? 24 : 0) + Math.max(0, 70 - attShoot) * 1.1 + pseudoNoise(7) },
    { id: 'card_prone', score: yellows * 2.5 + Math.max(0, 68 - ctxObj.lowCompVal) + pseudoNoise(8) },
    { id: 'slow_cb_turn', score: Math.max(0, 70 - (slowestCb?.attributes.pace ?? 65)) * 1.4 + ((slowestCb?.attributes.strength ?? 65) >= 72 ? 8 : 0) + pseudoNoise(9) },
    { id: 'tired_core_legs', score: Math.max(0, 88 - ctxObj.tiredFit) * 1.6 + pseudoNoise(10) },
    { id: 'weak_foot_turnover', score: Math.max(0, 68 - midPass) * 1.4 + pseudoNoise(11) },
    { id: 'rookie_inexperience', score: (ctxObj.rookieAge <= 21 ? 26 : ctxObj.rookieAge <= 23 ? 14 : 0) + pseudoNoise(12) },
    { id: 'low_composure_panic', score: Math.max(0, 70 - ctxObj.lowCompVal) * 1.4 + pseudoNoise(13) },
    { id: 'drought_striker_tilt', score: (oppRecent.length >= 2 && ctxObj.attGoals === 0 ? 25 : 0) + Math.max(0, 70 - attShoot) + pseudoNoise(14) },
    { id: 'dressing_room_rift', score: (lossesRecent >= 2 ? 32 : lossesRecent === 1 ? 12 : 0) + pseudoNoise(15) },
    { id: 'overconfident_complacency', score: (winsRecent >= 2 ? 30 : winsRecent === 1 ? 10 : 0) + pseudoNoise(16) },
  ];

  candidates.sort((a, b) => b.score - a.score);
  const topPick = candidates[0];
  const arch = ARCHETYPES[topPick.id];

  // 随机挑取渠道前缀 + 线索文案 + 干扰项文案（组合数 > 1400）
  const pickRand = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const ch1 = pickRand(CLUE_CHANNELS);
  const ch2 = pickRand(CLUE_CHANNELS.filter(c => c !== ch1));
  const ch3 = pickRand(CLUE_CHANNELS.filter(c => c !== ch1 && c !== ch2));

  const starOpp = [...starters].filter(p => p.role !== 'GK').sort((a, b) => b.ca - a.ca)[0];
  const avgAge = starters.length ? Math.round(starters.reduce((s, p) => s + p.age, 0) / starters.length) : 25;
  const styleTemplates = [
    `${ch1} 惯用 ${opp.formation}【${ctxObj.styleName}】，核心 ${starOpp?.name ?? '主力'}(CA ${starOpp?.ca ?? 60})，全队均龄 ${avgAge} 岁`,
    `${ch1} ${opp.name}本轮预计排出 ${opp.formation}（${ctxObj.styleName}），${ctxObj.streakText}`,
    `${ch1} 阵型 ${opp.formation} 主打${ctxObj.styleName}，门将 ${ctxObj.gkName}(${ctxObj.gkSave}) 领衔防线`,
  ];

  const clueStyle: OpponentClueItem = {
    id: 'clue_style',
    text: pickRand(styleTemplates),
    isSmoke: false,
    confidence: fam >= 40 ? 'high' : 'mid',
  };

  const clueReal: OpponentClueItem = {
    id: 'clue_real',
    text: `${ch2} ${pickRand(arch.evidences)(ctxObj)}`,
    isSmoke: false,
    confidence: fam >= 70 ? 'high' : fam >= 40 ? 'mid' : 'low',
  };

  const chosenLabel = pickRand(arch.counterLabels);
  const thirdClue: OpponentClueItem = fam >= 70
    ? {
        id: 'clue_verified',
        text: `${ch3} 交叉核实完毕：核心破绽指向【${chosenLabel.replace('指证：', '')}】`,
        isSmoke: false,
        confidence: 'high',
      }
    : {
        id: 'clue_decoy',
        text: `${ch3} ${pickRand(arch.decoys)(ctxObj)}`,
        isSmoke: true,
        confidence: 'low',
      };

  const seed = Math.floor(Math.random() * 3);
  const clues: OpponentClueItem[] = fam >= 70
    ? [clueReal, clueStyle, thirdClue]
    : seed === 0
      ? [clueStyle, thirdClue, clueReal]
      : seed === 1
        ? [thirdClue, clueReal, clueStyle]
        : [clueReal, clueStyle, thirdClue];

  // 从其余 15 个维度中随机挑 2 个干扰选项（每次标题也会随词库变化）
  const wrongPool = Object.values(ARCHETYPES).filter(a => a.id !== topPick.id);
  for (let i = wrongPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wrongPool[i], wrongPool[j]] = [wrongPool[j], wrongPool[i]];
  }
  const w1 = wrongPool[0];
  const w2 = wrongPool[1];

  const rawCounters: OpponentCounterOption[] = [
    { id: `cnt_${arch.id}`, label: chosenLabel, desc: arch.counterDesc, isCorrect: true, buff: arch.buff },
    { id: `cnt_${w1.id}`, label: pickRand(w1.counterLabels), desc: w1.counterDesc, isCorrect: false, buff: w1.buff },
    { id: `cnt_${w2.id}`, label: pickRand(w2.counterLabels), desc: w2.counterDesc, isCorrect: false, buff: w2.buff },
  ];
  for (let i = rawCounters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rawCounters[i], rawCounters[j]] = [rawCounters[j], rawCounters[i]];
  }

  return {
    oppClubId: oppId,
    oppClubName: opp.name,
    familiarity: fam,
    recentFormText,
    h2hText,
    clues,
    counters: rawCounters,
  };
}
