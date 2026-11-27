import type {
  ActiveSkillSituation,
  CommandCardEffect,
  DirectiveTendency,
  DirectiveZone,
  FormationName,
  SkillInstantAction,
  SkillMutationTag,
  SkillVfxTheme,
  TacticalStyle,
} from '@fm-league/engine';
import type { V6ActiveSkillDef } from './types';

type RawSkillTuple = [
  id: string,
  name: string,
  situation: ActiveSkillSituation,
  situationLabel: string,
  instantAction: SkillInstantAction,
  instantLabel: string,
  vfxTheme: SkillVfxTheme,
  cd: number,
  maxPerMatch: number,
  dur: number,
  powerLabel: string,
  baseEffect: Omit<CommandCardEffect, 'id' | 'name' | 'durationMinutes'>,
  branchA: [label: string, desc: string, tag: SkillMutationTag, extra?: Partial<CommandCardEffect>],
  branchB: [label: string, desc: string, tag: SkillMutationTag, extra?: Partial<CommandCardEffect>],
  zone?: DirectiveZone,
  tendency?: DirectiveTendency,
];

function mkSkill(
  t: RawSkillTuple,
  meta: { source: V6ActiveSkillDef['source']; style?: TacticalStyle; formation?: FormationName; unlockCost?: number }
): V6ActiveSkillDef {
  const [id, name, situation, situationLabel, instantAction, instantLabel, vfxTheme, cooldownMinutes, maxPerMatch, durationMinutes, powerLabel, baseEffect, bA, bB, zone, tendency] = t;
  return {
    id,
    name,
    source: meta.source,
    style: meta.style,
    formation: meta.formation,
    zone,
    tendency,
    situation,
    situationLabel,
    instantAction,
    instantLabel,
    vfxTheme,
    cooldownMinutes,
    maxPerMatch,
    durationMinutes,
    unlockCost: meta.unlockCost ?? (meta.source === 'core' ? 0 : meta.source === 'mastery' ? 0 : 2),
    powerLabel,
    baseEffect,
    branchA: { choice: 'A', label: bA[0], desc: bA[1], tag: bA[2], extraEffect: bA[3] },
    branchB: { choice: 'B', label: bB[0], desc: bB[1], tag: bB[2], extraEffect: bB[3] },
  };
}

// ============================================================================
// 一、36 个打法主动技（6 打法 × 3 区 × 攻/守）
// ============================================================================

const STYLE_SKILLS: Array<{ style: TacticalStyle; list: RawSkillTuple[] }> = [
  {
    style: 'tiki_taka',
    list: [
      ['sk_tt_1', '手术刀直塞', 'attacking_final_third', '前场渗透窗口', 'force_through_ball', '强制穿透直塞', 'att', 12, 3, 6, '传球+10 · 穿透防线',
        { passingDelta: 10, tacticalMod: { throughPassBias: 0.12 } },
        ['无视越位', '4.5秒内接球无视越位', 'bypass_offside'], ['全CD减3', '全主动技CD-3分钟', 'reduce_all_cd'], 'ATT', 'ATK'],
      ['sk_tt_2', '游龙突破造任意球', 'attacking_final_third', '前场被包夹窗口', 'win_foul_setpiece', '赢得前场高危任意球', 'att', 14, 2, 6, '定位球xG×1.35',
        { composureDelta: 8, mechanic: 'set_piece_nuke' },
        ['任意球必正', '下脚射门必射正', 'guarantee_shot_on_target'], ['迫使吃黄牌', '令最近防守者吃黄牌(可红)', 'force_yellow_card'], 'ATT', 'DEF'],
      ['sk_tt_3', 'Tiki-Taka五连瞬传', 'high_possession', '连续传导4脚窗口', 'force_through_ball', '五连传撕裂中路', 'att', 12, 3, 6, '全队传球+10',
        { passingDelta: 10, tacticalMod: { shortPassBias: 0.10 } },
        ['叠加反击威能', '叠+1反击威能(+0.10xG)', 'counter_damage_amp'], ['双倍时长', '传控增益延至12分钟', 'double_duration'], 'MID', 'ATK'],
      ['sk_tt_4', '反抢夺回球权', 'midfield_press', '中场反抢窗口', 'tempo_burst_intercept', '硬直对手瞬步断球', 'def', 10, 3, 5, '夺回球权控场',
        { defendingDelta: 8, passingDelta: 6 },
        ['窃取节奏', '对手12秒传球易被断', 'steal_tempo'], ['全队回气', '夺球后全队回体+6%', 'heal_team'], 'MID', 'DEF'],
      ['sk_tt_5', '后场破逼抢长传', 'counter_opportunity', '后场反击窗口', 'instant_counter_pass', '后场精准直找前锋', 'att', 12, 3, 6, '无视逼抢推进',
        { passingDelta: 10, paceDelta: 6, tacticalMod: { tempoMul: 1.18 } },
        ['免越位长传', '4.5秒内无视越位', 'bypass_offside'], ['双倍提速', '推进提速延至12分钟', 'double_duration'], 'DEF', 'ATK'],
      ['sk_tt_6', '门前冷静解围控球', 'box_danger', '禁区险情窗口', 'clear_danger', '冷静断球化险', 'def', 12, 3, 6, '全队冷静+12',
        { composureDelta: 12, defendingDelta: 8 },
        ['门前护盾', '叠+1绝杀护盾', 'grant_shield_stack'], ['缩减冷却', '全主动技CD-3分钟', 'reduce_all_cd'], 'DEF', 'DEF'],
    ],
  },
  {
    style: 'gegenpress',
    list: [
      ['sk_gp_1', '前场断球就地爆射', 'attacking_final_third', '前场进攻窗口', 'force_shot_on_target', '校准死角爆射', 'att', 14, 2, 5, '射门+10 · 就地终结',
        { shootingDelta: 10 },
        ['必射正校准', '必射正且xG×1.15', 'guarantee_shot_on_target'], ['反击蓄威', '叠+1反击威能', 'counter_damage_amp'], 'ATT', 'ATK'],
      ['sk_gp_2', '三叉窒息围抢', 'midfield_press', '中前场逼抢窗口', 'tempo_burst_intercept', '3人合围瞬步断球', 'def', 10, 3, 5, '高压抢断打乱节奏',
        { defendingDelta: 10, mechanic: 'high_press_blitz' },
        ['窒息滞缓', '对手12秒节奏迟滞', 'steal_tempo'], ['压榨体能', '立即扣对手5%体能', 'drain_opp_stamina'], 'ATT', 'DEF'],
      ['sk_gp_3', '重金属闪电直刺', 'counter_opportunity', '转换快攻窗口', 'force_through_ball', '闪电直塞撕裂防线', 'att', 12, 3, 5, '全队速度+10',
        { paceDelta: 10, tacticalMod: { throughPassBias: 0.12 } },
        ['反越位穿透', '4.5秒内无视越位', 'bypass_offside'], ['双倍冲刺', '加速延至10分钟', 'double_duration'], 'MID', 'ATK'],
      ['sk_gp_4', '中圈战术犯规掐反击', 'opponent_through_ball', '对手打身后窗口', 'tactical_foul_stop', '果断战术犯规停单刀', 'def', 14, 2, 5, '掐死对手单刀反击',
        { defendingDelta: 8 },
        ['零吃牌护盾', '0吃牌风险且叠+1护盾', 'grant_shield_stack'], ['窃取节奏', '对手12秒传球易被断', 'steal_tempo'], 'MID', 'DEF'],
      ['sk_gp_5', '造越位哨响反打', 'opponent_through_ball', '对手直塞瞬间', 'clear_danger', '吹停/断下对手直塞', 'def', 12, 3, 5, '防线同步前压化险',
        { composureDelta: 10, mechanic: 'offside_trap' },
        ['免越位反打', '4.5秒内反打无视越位', 'bypass_offside'], ['全CD减3', '全主动技CD-3分钟', 'reduce_all_cd'], 'DEF', 'ATK'],
      ['sk_gp_6', '全员疯狗回追补防', 'box_danger', '禁区危急窗口', 'tempo_burst_intercept', '极限回追铲断', 'def', 12, 3, 5, '防线速度+12',
        { targetLine: 'DEF', paceDelta: 12, defendingDelta: 8 },
        ['绝杀护盾', '叠+1绝杀护盾', 'grant_shield_stack'], ['疯狗回气', '全队立即回体+6%', 'heal_team'], 'DEF', 'DEF'],
    ],
  },
  {
    style: 'wing_play',
    list: [
      ['sk_wp_1', '空霸头球绝杀', 'wing_overload', '边路传中窗口', 'force_cross_header', '边路弧线传中头槌', 'att', 14, 2, 6, '头球必杀攻门',
        { shootingDelta: 10, mechanic: 'wing_overload' },
        ['死角头槌', '必射正且xG×1.15', 'guarantee_shot_on_target'], ['反击威能', '叠+1反击威能', 'counter_damage_amp'], 'ATT', 'ATK'],
      ['sk_wp_2', '边路爆破造角球', 'wing_overload', '边路突破窗口', 'win_foul_setpiece', '下底强行造定位球', 'att', 12, 3, 5, '边路造险+禁区抢点',
        { paceDelta: 8, tacticalMod: { cornerRateMul: 1.40 } },
        ['双塔压进', '禁区抢点额外+2人', 'extra_box_crash', { tacticalMod: { boxCrashBonus: 2 } }], ['双倍时长', '边路增益延至10分钟', 'double_duration'], 'ATT', 'DEF'],
      ['sk_wp_3', '跨场50米大转移', 'any_possession', '下半场控球窗口', 'instant_counter_pass', '大范围斜长传撕扯', 'att', 12, 3, 6, '瞬间拉开防线宽度',
        { passingDelta: 10, tacticalMod: { dualOverlap: true } },
        ['免越位斜传', '4.5秒内无视越位', 'bypass_offside'], ['拉扯榨体', '立即扣对手5%体能', 'drain_opp_stamina'], 'MID', 'ATK'],
      ['sk_wp_4', '边路飞铲断反击', 'midfield_press', '中场边线窗口', 'tempo_burst_intercept', '边线精准滑铲断球', 'def', 10, 3, 5, '断球发起边路反攻',
        { defendingDelta: 10 },
        ['全CD减3', '全主动技CD-3分钟', 'reduce_all_cd'], ['震慑节奏', '对手12秒传球易被断', 'steal_tempo'], 'MID', 'DEF'],
      ['sk_wp_5', '翼卫走廊弹射推进', 'counter_opportunity', '转换反击窗口', 'force_through_ball', '翼卫直插边路走廊', 'att', 12, 3, 6, '防线速度+14',
        { targetLine: 'DEF', paceDelta: 14, tacticalMod: { overlapDepthBonus: 5 } },
        ['反击蓄威', '叠+1反击威能', 'counter_damage_amp'], ['双倍走廊', '冲刺延至12分钟', 'double_duration'], 'DEF', 'ATK'],
      ['sk_wp_6', '边路飞铲封传中', 'box_danger', '禁区边路险情', 'clear_danger', '侧翼滑铲化解传中', 'def', 10, 3, 5, '封锁对手下底传中',
        { defendingDelta: 10, tacticalMod: { blockBonus: 0.14 } },
        ['绝杀护盾', '叠+1绝杀护盾', 'grant_shield_stack'], ['免越反打', '4.5秒内反打免越位', 'bypass_offside'], 'DEF', 'DEF'],
    ],
  },
  {
    style: 'counter',
    list: [
      ['sk_ct_1', '孤胆单刀推射', 'attacking_final_third', '单刀面对门将', 'force_shot_on_target', '时间凝固推射死角', 'att', 15, 2, 5, '冷静+12 · 致命单刀',
        { shootingDelta: 12, composureDelta: 12 },
        ['绝对射正', '必射正且xG×1.15', 'guarantee_shot_on_target'], ['震慑防线', '对手12秒节奏迟滞', 'steal_tempo'], 'ATT', 'ATK'],
      ['sk_ct_2', '前锋回追战术拦截', 'midfield_press', '中场回防窗口', 'tempo_burst_intercept', '前锋回撤抢断', 'def', 10, 3, 5, '断球就地反击',
        { defendingDelta: 8, paceDelta: 8 },
        ['反击威能', '叠+1反击威能', 'counter_damage_amp'], ['全CD减3', '全主动技CD-3分钟', 'reduce_all_cd'], 'ATT', 'DEF'],
      ['sk_ct_3', '猎豹断球直刺', 'counter_opportunity', '断球转换瞬间', 'instant_counter_pass', '不停球过顶打身后', 'att', 10, 3, 5, '一脚过顶直找前锋',
        { paceDelta: 10, tacticalMod: { throughPassBias: 0.14 } },
        ['无视越位', '4.5秒内无视越位', 'bypass_offside'], ['反击增伤', '叠+1反击威能(+0.10xG)', 'counter_damage_amp'], 'MID', 'ATK'],
      ['sk_ct_4', '中场口袋合围诱杀', 'opponent_through_ball', '对手推进窗口', 'tempo_burst_intercept', '中圈口袋瞬断反打', 'def', 12, 3, 5, '断球全队速度+10',
        { paceDelta: 10, defendingDelta: 8 },
        ['反打免越位', '夺球后4.5秒免越位', 'bypass_offside'], ['绝杀护盾', '叠+1绝杀护盾', 'grant_shield_stack'], 'MID', 'DEF'],
      ['sk_ct_5', '门神手抛制导导弹', 'box_danger', '门前收球瞬间', 'gk_long_launch', '门将大脚制导找前锋', 'att', 12, 3, 6, '50tick 射门xG×1.25',
        { goalkeepingDelta: 10, mechanic: 'gk_counter_launch' },
        ['免越制导', '4.5秒内无视越位', 'bypass_offside'], ['反击叠加', '叠+1反击威能', 'counter_damage_amp'], 'DEF', 'ATK'],
      ['sk_ct_6', '门前解围一脚长传', 'box_danger', '禁区危急窗口', 'clear_danger', '中卫解围直找锋线', 'def', 10, 3, 5, '化险为夷转反击',
        { defendingDelta: 10, paceDelta: 6 },
        ['免越长传', '4.5秒内无视越位', 'bypass_offside'], ['绝杀护盾', '叠+1绝杀护盾', 'grant_shield_stack'], 'DEF', 'DEF'],
    ],
  },
  {
    style: 'park_bus',
    list: [
      ['sk_pb_1', '定位球核武头槌', 'set_piece_moment', '角球/定位球瞬间', 'force_cross_header', '双中卫冲顶头槌', 'att', 14, 2, 6, '定位球xG×1.35',
        { shootingDelta: 10, mechanic: 'set_piece_nuke' },
        ['头球必正', '必射正且xG×1.15', 'guarantee_shot_on_target'], ['双塔压进', '禁区抢点额外+2', 'extra_box_crash', { tacticalMod: { boxCrashBonus: 2 } }], 'ATT', 'ATK'],
      ['sk_pb_2', '前场倒地骗任意球', 'leading_late', '70分后领先守胜', 'win_foul_setpiece', '前场造犯规耗时间', 'def', 14, 2, 6, '全队冷静+10磨时间',
        { composureDelta: 10, tacticalMod: { tempoMul: 0.80 } },
        ['骗出黄牌', '令最近防守者吃黄牌', 'force_yellow_card'], ['借机回血', '全队立即回体+6%', 'heal_team'], 'ATT', 'DEF'],
      ['sk_pb_3', '丢球后铁血反扑', 'just_conceded', '失球后4分钟内', 'force_through_ball', '全军反扑直塞', 'att', 16, 2, 8, '全队射门+10 · 血怒',
        { shootingDelta: 10, mechanic: 'blood_frenzy' },
        ['双倍反击威能', '叠+1反击威能', 'counter_damage_amp'], ['全CD减3', '其余主动技CD-3分钟', 'reduce_all_cd'], 'MID', 'ATK'],
      ['sk_pb_4', '中场铁闸滑铲锁', 'midfield_press', '中场阻击窗口', 'tactical_foul_stop', '强硬战术犯规断攻势', 'def', 12, 3, 5, '硬朗掐断对手推进',
        { defendingDelta: 12 },
        ['打乱节奏', '对手12秒传球易被断', 'steal_tempo'], ['免牌护盾', '0吃牌且叠+1护盾', 'grant_shield_stack'], 'MID', 'DEF'],
      ['sk_pb_5', '门神飞身神扑', 'box_danger', '门前必进危机', 'GK_save_boost', '门线反应单掌托出', 'def', 12, 3, 6, '门将神扑/叠护盾',
        { goalkeepingDelta: 14, mechanic: 'gk_counter_launch' },
        ['双重结界', '额外再叠+1护盾', 'grant_shield_stack'], ['反击威能', '扑救转+1反击威能', 'counter_damage_amp'], 'DEF', 'ATK'],
      ['sk_pb_6', '门线极限滑铲解围', 'box_danger', '小禁区险情', 'clear_danger', '中卫门线绝命解围', 'def', 10, 3, 5, '门线救主+铁壁封堵',
        { defendingDelta: 14, mechanic: 'iron_wall_block' },
        ['绝杀护盾', '叠+1绝杀护盾', 'grant_shield_stack'], ['解围蓄威', '转化为+1反击威能', 'counter_damage_amp'], 'DEF', 'DEF'],
    ],
  },
  {
    style: 'balanced',
    list: [
      ['sk_bl_1', '电梯世界波', 'any_possession', '下半场弧顶持球', 'force_shot_on_target', '禁区外校准电梯重炮', 'att', 14, 2, 5, '远射重炮轰门',
        { shootingDelta: 12, mechanic: 'long_shot_cannon' },
        ['死角必正', '必射正且xG×1.15', 'guarantee_shot_on_target'], ['全CD减3', '全主动技CD-3分钟', 'reduce_all_cd'], 'ATT', 'ATK'],
      ['sk_bl_2', '老队长的怒吼', 'trailing_late', '68分后落后/平局', 'tempo_burst_intercept', '瞬断+全队回体15%', 'ult', 20, 1, 10, '全队爆发逆转总攻',
        { fitnessInstantDelta: 15, shootingDelta: 12, paceDelta: 8, mechanic: 'blood_frenzy' },
        ['双倍怒吼', '爆发时长延至20分钟', 'double_duration'], ['重置全冷却', '立即重置其余全部主动技CD', 'reset_all_cd'], 'ATT', 'DEF'],
      ['sk_bl_3', '中轴指挥官调度', 'high_possession', '连续4脚传导窗口', 'force_through_ball', '中轴手术刀调度', 'att', 12, 3, 8, '全队临时默契+30',
        { passingDelta: 10, chemistryMod: { scope: 'all', delta: 30 } },
        ['双倍默契', '默契狂潮延至16分钟', 'double_duration'], ['反击威能', '叠+1反击威能', 'counter_damage_amp'], 'MID', 'ATK'],
      ['sk_bl_4', '领先时刻稳节奏', 'leading_late', '70分后领先守胜', 'tempo_burst_intercept', '抢断控稳降速', 'def', 14, 2, 8, '节奏×0.80稳守胜果',
        { composureDelta: 12, defendingDelta: 8, tacticalMod: { tempoMul: 0.80 } },
        ['绝杀护盾', '叠+1绝杀护盾', 'grant_shield_stack'], ['全队回气', '立即全队回体+6%', 'heal_team'], 'MID', 'DEF'],
      ['sk_bl_5', '失球瞬间闪电扳平', 'just_conceded', '失球后4分钟内', 'instant_counter_pass', '开球后闪电直刺', 'att', 16, 2, 6, '前锋射门+12快速回应',
        { targetLine: 'ATT', shootingDelta: 12, paceDelta: 10 },
        ['反越位闪击', '4.5秒内无视越位', 'bypass_offside'], ['校准必正', '下脚射门必射正', 'guarantee_shot_on_target'], 'DEF', 'ATK'],
      ['sk_bl_6', '全队阵型紧急落位', 'opponent_through_ball', '对手打身后危机', 'GK_save_boost', '门前结界+防线落位', 'def', 12, 3, 6, '防线防守+12',
        { targetLine: 'DEF', defendingDelta: 12 },
        ['绝杀护盾', '叠+1绝杀护盾', 'grant_shield_stack'], ['紧急回体', '全队立即回体+6%', 'heal_team'], 'DEF', 'DEF'],
    ],
  },
];

// ============================================================================
// 二、16 个阵型专属主动技
// ============================================================================

const FORMATION_SKILLS: Array<{ formation: FormationName; tuple: RawSkillTuple }> = [
  { formation: '4-3-3', tuple: ['sk_f_433', 'MSN三叉戟三角绝杀', 'attacking_final_third', '前场三叉戟连线', 'force_through_ball', '三叉戟穿透直塞', 'att', 13, 2, 6, '前锋射门+10', { targetLine: 'ATT', shootingDelta: 10 }, ['必射正', '下脚必射正', 'guarantee_shot_on_target'], ['免越位', '4.5秒免越位', 'bypass_offside']] },
  { formation: '4-2-3-1', tuple: ['sk_f_4231', '前腰禁区贴地斩', 'attacking_final_third', '十号位弧顶持球', 'force_shot_on_target', '前腰校准贴地斩', 'att', 14, 2, 5, '中场射门+12', { targetLine: 'MID', shootingDelta: 12 }, ['必射正', '必射正+xG×1.15', 'guarantee_shot_on_target'], ['全CD减3', '全主动技CD-3分', 'reduce_all_cd']] },
  { formation: '4-4-2', tuple: ['sk_f_442', '双塔摆渡凌空抽射', 'wing_overload', '边路传中双塔窗口', 'force_cross_header', '双塔头球摆渡爆射', 'att', 13, 2, 6, '双锋射门+12', { targetLine: 'ATT', shootingDelta: 12 }, ['反击威能', '叠+1反击威能', 'counter_damage_amp'], ['必射正', '下脚必射正', 'guarantee_shot_on_target']] },
  { formation: '4-1-2-1-2', tuple: ['sk_f_41212', '菱形二过一撕裂中路', 'high_possession', '菱形中场连传窗口', 'force_through_ball', '中路撞墙穿透', 'att', 12, 3, 6, '中场传球+14', { targetLine: 'MID', passingDelta: 14 }, ['免越位', '4.5秒免越位', 'bypass_offside'], ['双倍时长', '延至12分钟', 'double_duration']] },
  { formation: '4-4-1-1', tuple: ['sk_f_4411', '影锋后排插上重炮', 'any_possession', '下半场控球窗口', 'force_shot_on_target', '影锋弧顶重炮', 'att', 14, 2, 5, '中场速度+12', { targetLine: 'MID', paceDelta: 12, shootingDelta: 8 }, ['必射正', '必射正+xG×1.15', 'guarantee_shot_on_target'], ['反击威能', '叠+1反击威能', 'counter_damage_amp']] },
  { formation: '4-1-4-1', tuple: ['sk_f_4141', '单后腰弧顶绝命封堵', 'box_danger', '弧顶禁区险情', 'clear_danger', '单后腰飞身解围', 'def', 11, 3, 6, '中场防守+16', { targetLine: 'MID', defendingDelta: 16 }, ['绝杀护盾', '叠+1护盾', 'grant_shield_stack'], ['窃取节奏', '对手12秒节奏迟滞', 'steal_tempo']] },
  { formation: '4-2-2-2', tuple: ['sk_f_4222', '双十号肋部造定位球', 'attacking_final_third', '双前腰肋部渗透', 'win_foul_setpiece', '双十号造高危任意球', 'att', 14, 2, 6, '中场传球+12', { targetLine: 'MID', passingDelta: 12 }, ['迫使黄牌', '防守者吃黄牌', 'force_yellow_card'], ['必射正', '任意球必射正', 'guarantee_shot_on_target']] },
  { formation: '4-3-2-1', tuple: ['sk_f_4321', '圣诞树弧顶圆月弯刀', 'set_piece_moment', '定位球/弧顶窗口', 'force_shot_on_target', '弧顶圆月弯刀重炮', 'att', 14, 2, 5, '远射重炮校准', { shootingDelta: 12, mechanic: 'long_shot_cannon' }, ['必射正', '必射正+xG×1.15', 'guarantee_shot_on_target'], ['全CD减3', '全主动技CD-3分', 'reduce_all_cd']] },
  { formation: '3-5-2', tuple: ['sk_f_352', '翼卫奔袭传中双锋争顶', 'wing_overload', '翼卫下底窗口', 'force_cross_header', '双翼卫喂饼双锋', 'att', 12, 3, 8, '双边卫套上', { tacticalMod: { dualOverlap: true, crossBias: 0.12 } }, ['反击威能', '叠+1反击威能', 'counter_damage_amp'], ['双倍时长', '延至16分钟', 'double_duration']] },
  { formation: '3-4-3', tuple: ['sk_f_343', '五人疯狗前场围抢', 'midfield_press', '中前场压迫窗口', 'tempo_burst_intercept', '五人围抢瞬断', 'def', 11, 3, 8, '3人合围+高压', { mechanic: 'high_press_blitz', tacticalMod: { extraPresser: true } }, ['窃取节奏', '对手12秒迟滞', 'steal_tempo'], ['压榨体能', '扣对手5%体能', 'drain_opp_stamina']] },
  { formation: '3-4-2-1', tuple: ['sk_f_3421', '双影锋斜塞翼卫倒三角', 'wing_overload', '边肋联动窗口', 'force_through_ball', '双影锋肋部斜塞', 'att', 12, 3, 6, '临时默契+25', { chemistryMod: { scope: 'all', delta: 25 } }, ['免越位', '4.5秒免越位', 'bypass_offside'], ['必射正', '下脚必射正', 'guarantee_shot_on_target']] },
  { formation: '3-4-1-2', tuple: ['sk_f_3412', '十号直塞双箭头单刀', 'counter_opportunity', '反击直塞窗口', 'instant_counter_pass', '十号直塞双锋单刀', 'att', 12, 3, 6, '双锋速度+12', { targetLine: 'ATT', paceDelta: 12 }, ['免越位', '4.5秒免越位', 'bypass_offside'], ['反击威能', '叠+1反击威能', 'counter_damage_amp']] },
  { formation: '5-4-1', tuple: ['sk_f_541', '九人门线绝命筑墙', 'box_danger', '禁区围攻危机', 'GK_save_boost', '九人门线铁桶封锁', 'def', 12, 3, 8, '铁壁封堵+门神', { mechanic: 'iron_wall_block', defendingDelta: 12 }, ['绝杀护盾', '叠+1护盾', 'grant_shield_stack'], ['全队回气', '全队回体+6%', 'heal_team']] },
  { formation: '5-3-2', tuple: ['sk_f_532', '门神神扑+双锋快反', 'box_danger', '禁区扑救转换', 'gk_long_launch', '神扑接长传找双锋', 'def', 12, 3, 6, '双锋速度+14', { targetLine: 'ATT', paceDelta: 14, mechanic: 'gk_counter_launch' }, ['免越位', '4.5秒免越位', 'bypass_offside'], ['绝杀护盾', '叠+1护盾', 'grant_shield_stack']] },
  { formation: '5-2-3', tuple: ['sk_f_523', '后场过顶长传找三叉戟', 'counter_opportunity', '后场断球转换', 'instant_counter_pass', '过顶长传制导三叉戟', 'att', 11, 3, 6, '前锋速度+14', { targetLine: 'ATT', paceDelta: 14 }, ['免越位', '4.5秒免越位', 'bypass_offside'], ['反击威能', '叠+1反击威能', 'counter_damage_amp']] },
  { formation: '5-2-1-2', tuple: ['sk_f_5212', '铁桶前腰反击绝命一击', 'counter_opportunity', '前腰反击枢纽', 'force_through_ball', '前腰一脚绝命直塞', 'att', 12, 3, 6, '中场传+14/射+10', { targetLine: 'MID', passingDelta: 14, shootingDelta: 10 }, ['必射正', '下脚必射正', 'guarantee_shot_on_target'], ['窃取节奏', '对手12秒迟滞', 'steal_tempo']] },
];

// ============================================================================
// 三、6 个宗师印奥义技 + 1 个圆心终极技
// ============================================================================

const MASTERY_AND_CORE_SKILLS: V6ActiveSkillDef[] = [
  mkSkill(['sk_m_tt', '梦之队无限短传', 'high_possession', '高控球奥义窗口', 'force_through_ball', '传控奥义撕裂防线', 'ult', 18, 1, 10, '全队传球+16/冷静+14',
    { passingDelta: 16, composureDelta: 14, mechanic: 'tiki_taka_flow' },
    ['校准必正', '下脚射门必射正', 'guarantee_shot_on_target'], ['控球榨体', '立即扣对手5%体能', 'drain_opp_stamina']], { source: 'mastery', style: 'tiki_taka' }),
  mkSkill(['sk_m_gp', '九十秒地狱窒息', 'midfield_press', '中场压迫奥义窗口', 'tempo_burst_intercept', '地狱级全队围抢断球', 'ult', 18, 1, 10, '高压闪电+3人合围',
    { defendingDelta: 14, mechanic: 'high_press_blitz', tacticalMod: { extraPresser: true } },
    ['窒息压榨', '对手节奏迟滞且掉体', 'drain_opp_stamina'], ['以战养战', '全队立即回体+6%', 'heal_team']], { source: 'mastery', style: 'gegenpress' }),
  mkSkill(['sk_m_wp', '两翼飓风无限传中', 'wing_overload', '边路奥义窗口', 'force_cross_header', '两翼飓风高空绝杀', 'ult', 18, 1, 10, '双边卫套上+边路霸权',
    { paceDelta: 12, mechanic: 'wing_overload', tacticalMod: { dualOverlap: true, cornerRateMul: 1.80 } },
    ['飓风蓄威', '叠+1反击威能', 'counter_damage_amp'], ['双塔压进', '禁区抢点额外+2', 'extra_box_crash', { tacticalMod: { boxCrashBonus: 2 } }]], { source: 'mastery', style: 'wing_play' }),
  mkSkill(['sk_m_ct', '十秒闪击一剑封喉', 'counter_opportunity', '反击奥义窗口', 'instant_counter_pass', '十秒闪击过顶单刀', 'ult', 18, 1, 8, '全队速度+16/射门+12',
    { paceDelta: 16, shootingDelta: 12 },
    ['免越必正', '4.5秒无视越位', 'bypass_offside'], ['反击核爆', '叠+1反击威能', 'counter_damage_amp']], { source: 'mastery', style: 'counter' }),
  mkSkill(['sk_m_pb', '圣西罗绝对零封墙', 'box_danger', '禁区奥义窗口', 'GK_save_boost', '圣西罗铁壁零封结界', 'ult', 18, 1, 12, '铁壁封堵+对手xG-30%',
    { defendingDelta: 14, goalkeepingDelta: 14, mechanic: 'iron_wall_block', tacticalMod: { oppShotXgPenalty: 0.30 } },
    ['双重护盾', '额外叠+1绝杀护盾', 'grant_shield_stack'], ['全队回气', '全队回体+6%并稳节奏', 'heal_team']], { source: 'mastery', style: 'park_bus' }),
  mkSkill(['sk_m_bl', '银河战舰补时奇迹', 'trailing_late', '决胜奥义窗口', 'force_shot_on_target', '补时绝杀奇迹重炮', 'ult', 20, 1, 12, '全属性+10+血怒',
    { passingDelta: 10, shootingDelta: 10, defendingDelta: 10, paceDelta: 10, mechanic: 'blood_frenzy' },
    ['重置全CD', '立即重置其余全部主动技CD', 'reset_all_cd'], ['护盾反击', '叠+1绝杀护盾', 'grant_shield_stack']], { source: 'mastery', style: 'balanced' }),
  mkSkill(['sk_ult_core', '★全军破限·全攻全守', 'any_possession', '超级宗师终极奥义', 'force_through_ball', '全攻全守终极破限', 'ult', 25, 1, 15, '全队全属性+10 · 回体+15%',
    { passingDelta: 10, shootingDelta: 10, defendingDelta: 10, paceDelta: 10, composureDelta: 10, fitnessInstantDelta: 15 },
    ['攻守双盾', '叠+1绝杀护盾', 'grant_shield_stack'], ['必正免越', '必射正且xG×1.15', 'guarantee_shot_on_target']], { source: 'core' }),
];

export const V6_ACTIVE_SKILLS: V6ActiveSkillDef[] = [
  ...STYLE_SKILLS.flatMap(g => g.list.map(t => mkSkill(t, { source: 'style', style: g.style }))),
  ...FORMATION_SKILLS.map(x => mkSkill(x.tuple, { source: 'formation', formation: x.formation })),
  ...MASTERY_AND_CORE_SKILLS,
];

export const V6_ACTIVE_SKILL_MAP: Record<string, V6ActiveSkillDef> = Object.fromEntries(
  V6_ACTIVE_SKILLS.map(s => [s.id, s])
);
