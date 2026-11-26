# V4 Diablo-4-Style Skill System Architecture & Balance Spec

> **Core Thesis**: Shift the coaching loop from passive numerical stat stacking to **"Command Cards + Active Buffs + Diablo 4 Skill Tree directly altering live physical match outcomes"**. Every equipped skill delivers an immediate physics/decision-altering intervention on pitch, scales with Ranks + Mastery/Perk bonuses, diverges into A/B build mutations at Rank 2+, fuses with 18 dual-axis Legendary Aspects, and chains with Command Cards & Squad Perks.

---

## 1. Skill Rank Progression (Rank 1–3 + Mastery/Perk Bonus Ranks up to Rank 5)

### Base Ranks (Permanent Meta Progression)
- **Rank 1**: Unlocked immediately upon unlocking any active skill node in `SkillWeb` (via `skillWebUnlocked`).
- **Rank 1 -> Rank 2**: Costs **`25` Meta Points** (`SKILL_RANK_UPGRADE_COSTS[2] = 25`). Unlocks **A/B Branching Mutation selection**.
- **Rank 2 -> Rank 3**: Costs **`45` Meta Points** (`SKILL_RANK_UPGRADE_COSTS[3] = 45`).
- `resetSkillWeb()` refunds **both** node unlock costs and all spent rank upgrade costs (`25` for Rank 2, `25 + 45 = 70` for Rank 3), resetting `skillRanks` & `skillMutations` cleanly.

### Dynamic Bonus Ranks (`+0` to `+2`, Effective Cap `Rank 5`)
Calculated dynamically when entering a match (`computeSkillBonusRank`) without permanent cost:
1. **Tactical Mastery Alignment (`+1` at Lv.2, `+2` at Lv.3)**:
   - Formation nodes (`fm_*`): matching active `formation` mastery level.
   - Style / Hybrid nodes (`ori_*`, `key_*`): matching `styleTag` (or either crossed style) mastery level.
   - System / Core nodes (`core_master`, `sys_*`): highest defense-system / balanced mastery level (`mastery.maxSystemLevel` / `mastery.maxStyleLevel`).
2. **Rogue Perk Alignment (`+1`)**:
   - Squad has `>= 2` **Attack** perks -> `+1` to Attack-aligned skills (`vfxTheme === 'att'` or `element in ['blitz', 'wing']`).
   - Squad has `>= 2` **Defense** perks -> `+1` to Defense-aligned skills (`vfxTheme === 'def'` or `element === 'iron'`).
   - Squad has `>= 2` **Control** perks -> `+1` to Control/Press-aligned skills (`vfxTheme === 'ult'` or `element in ['pass', 'press']`).
3. **Balanced Foundation Node (`asp_5_bal`)**:
   - Grants **`+1` bonus rank** across equipped skills when unlocked (represents all-around mastery), still respecting the bonus cap.
4. **Capping**:
   - `bonusRank = Math.min(2, masteryBonus + perkBonus + asp5BalBonus)`
   - `effectiveRank = Math.min(5, baseRank + bonusRank)`

### Rank Scaling Curves
- **Power Multiplier**: `powerMul = 1 + (effectiveRank - 1) * 0.20`
  - Rank 1 = `1.00x`, Rank 2 = `1.20x`, Rank 3 = `1.40x`, Rank 4 = `1.60x`, Rank 5 = `1.80x`.
- **Duration Scaling**: `durationMinutes = baseDuration + (effectiveRank >= 3 ? 2 : 0) + (effectiveRank >= 5 ? 2 : 0)`.
- **Cooldown Scaling**: `cooldownMinutes = Math.max(4, baseCooldown - (effectiveRank >= 2 ? 1 : 0) - (effectiveRank >= 4 ? 1 : 0))`.
- **Max Uses Per Match**: `maxPerMatch = baseMax + (effectiveRank >= 4 ? 1 : 0)`.

---

## 2. Immediate Outcome-Changing `SkillInstantAction` (All 34 Active Skills)

When triggered during the 0.25x bullet-time tactical prompt (click or `KeyF`), each skill fires an **immediate physical outcome action** on pitch (`MatchEngine.triggerActiveSkill`) before applying its follow-up tactical buff:

| Action ID | Tactical Trigger Context | Physical / Match Outcome Effect |
| :--- | :--- | :--- |
| `clear_danger` | `box_danger` / `opponent_through_ball` | Defender steps into lane, dispossesses opponent ball-carrier or clears danger upward toward friendly midfielder (`giveBallTo` / long clearance), stalling danger xG. |
| `instant_counter_pass` | `counter_opportunity` | Ball-carrier immediately whips a crisp forward progressive pass (`launchPassBall`) into stride of highest-forward teammate breaking opponent midfield line. |
| `force_through_ball` | `attacking_final_third` / `midfield_press` | Launches incisive penetrating through-pass behind last defensive line to top forward/winger (`launchPassBall`), cutting through cover shadows. |
| `force_shot_on_target` | `attacking_final_third` / `trailing_late` | Forces active forward/carrier in final third to unleash an immediate calibrated strike toward goal corners (`launchShotBall`) with boosted rank-scaled xG & on-target bias. |
| `win_foul_setpiece` | `wing_overload` / `attacking_final_third` | Carrier invites late challenge in danger zone and wins a direct dangerous free kick (`setDeadBall`), halting opponent counter momentum and creating set-piece danger. |
| `GK_save_boost` | `box_danger` / `opponent_through_ball` | Empowers goalkeeper reflex aura for instant parry/claim if shot is incoming or immediate distribution reset + emergency save shield charge. |
| `tempo_burst_intercept` | `midfield_press` / `any_possession` | Midfield press shockwave forces fumble/loose interception by nearest pressing user player and flips possession state immediately. |

---

## 3. A/B Branching Mutations (Unlocked at `effectiveRank >= 2`)

Every one of the 34 active skills defines a `mutations: [SkillMutationSpec, SkillMutationSpec]` pair (`'A'` vs `'B'`), switchable freely in `MetaScreen`:
- **Design Pattern**:
  - **Branch A (Lethal / Outcome Extremes)**: Pushes immediate physics/conversion ceilings (`bypass_offside`, `guarantee_shot_on_target`, `double_duration`, `counter_damage_amp`).
  - **Branch B (Tempo / Economy / Shield Loop)**: Turns tactical interventions into team-wide momentum (`refund_card_energy`, `reduce_all_cd`, `grant_shield_stack`, `steal_tempo`).

### Supported `SkillMutationTag` Effects in `MatchEngine`
- `bypass_offside`: Next penetrating pass / through-ball ignores offside trap check cleanly.
- `guarantee_shot_on_target`: Immediate & next buff-window shots force high `onTargetProb` (`>= 0.92`).
- `double_duration`: Doubles buff duration (`durationMinutes * 2`) to sustain tactical supremacy.
- `refund_card_energy`: Emits `CoachMatchReward` (`energyRefund: 1`) directly into `MatchDayScreen` command hand.
- `reduce_all_cd`: Immediately subtracts `3` match minutes from all other equipped active skill cooldowns.
- `grant_shield_stack`: Adds `+1` emergency `shieldCharges` stack (max `3`) capable of blocking lethal box xG shots.
- `steal_tempo`: Drains opponent buildup fluidity (`aggression` / `passing` slowdown window) and awards temporary press speed surge.
- `counter_damage_amp`: Adds `+1` `counterCharges` stack consuming on the next counter shot for surged `xG` (`+0.12 * rankScale`).

---

## 4. 18 Fusion Legendary Aspects (`fus_{sys}_{style}`)

The 18 `fus_{sys}_{style}` outer-ring nodes (`3` defense systems × `6` tactical styles) hold built-in **Legendary Aspects**. When unlocked AND the team's active `defenseSystem` + `style` both match the fusion node, the Aspect activates automatically with zero extra loadout slot cost:

| Fusion Node | Aspect Name | Core Match Mechanics |
| :--- | :--- | :--- |
| `fus_4-back_gegenpress` | **不熄压迫核心** | Press skills/cards grant `+1` energy refund proc & boost intercept force (`tempo_burst_intercept`). |
| `fus_4-back_wing_play` | **四后卫边路双飞翼** | Wing overload activations amp flank cross accuracy and award `counterCharges` when entering wide channels. |
| `fus_4-back_counter` | **猎豹防反矩阵** | Successful defensive clears/interceptions convert into `+1` `counterCharges` stack (`+xG` & pass speed on next counter). |
| `fus_4-back_park_bus` | **钢铁四防线壁垒** | Starts match with `1` `shieldCharges` stack; `box_danger` skill triggers auto-gain `+1` shield (`max 2`) saving lethal shots. |
| `fus_4-back_balanced` | **全能中轴协奏曲** | Balanced rhythm trims all active skill cooldowns by `1` min on every 4 completed user passes (`passSeq`). |
| `fus_4-back_tiki_taka` | **四后卫传控枢纽** | Every `5` consecutive user passes awards a `nextCardDiscount` (`-1 Energy`) via Coach Reward queue. |
| `fus_3-back_gegenpress` | **三中卫狂暴前压** | High press triggers drain opponent ball retention and double press radius during active buffs. |
| `fus_3-back_wing_play` | **翼卫走廊风暴** | Wing-back surges reduce skill cooldowns on wing passes and boost cutback target quality. |
| `fus_3-back_counter` | **三卫直刺反击刃** | Defensive dispossessions immediately elevate forward pass speed (`+22%`) and prime `counterCharges`. |
| `fus_3-back_park_bus` | **三塔禁区铁闸** | Starts with `1` `shieldCharges` stack; boosts box clearance distance and goalkeeper parry recovery. |
| `fus_3-back_balanced` | **动态三后卫引擎** | Smooth transition defense-to-attack adds passive `+0.10` tactical rating & steadies familiarity checks. |
| `fus_3-back_tiki_taka` | **菱形控场万花筒** | Triangle passing sequences (`5` passes) refund skill cooldowns (`-2m`) and sharpen through-pass precision. |
| `fus_5-back_gegenpress` | **五盾绞肉反抢网** | Low-mid block traps trigger sudden midfield intercept bursts (`tempo_burst_intercept` boost) with energy steal. |
| `fus_5-back_wing_play` | **双翼齐飞弹射器** | Wing-backs launch long diagonal switches ignoring heavy midfield press and grant wing card discount. |
| `fus_5-back_counter` | **深渊蛰伏绝杀阵** | Absorbing box pressure stores up to `3` `counterCharges` stacks for explosive late fast-break finishes. |
| `fus_5-back_park_bus` | **绝对零封要塞** | Starts match with `2` `shieldCharges` stacks; emergency saves bounce dangerous shots safely wide for zero rebound. |
| `fus_5-back_balanced` | **稳健五卫巡航器** | Prevents late stamina collapse and converts drawn fouls/clearances into steady command hand tempo. |
| `fus_5-back_tiki_taka` | **后场出球大师体系** | Deep build-up chains grant pass-sequence cooldown cuts and resist opponent high-press steals. |

---

## 5. Card × Perk × Skill Three-Way Synergy Loop

1. **Elemental Affinity Link (`linkedElement`: `'press' | 'pass' | 'wing' | 'iron' | 'blitz'`)**:
   - Each Command Card passes its `element` into `MatchEngine.applyCommandCard`.
   - When an active Command Buff sharing a Skill's `linkedElement` is live during skill execution:
     - **Overdrive (`isCardBoosted = true`)**: Skill power scales by **`1.35x`**.
     - **Three-Way Reward (`CoachMatchReward`)**:
       - `press` / `blitz` combos can emit **Card Cost Discount (`nextCardDiscount: 1`)** or **Energy Refund (`+1`)**.
       - `pass` combos trigger **Used Card Refresh (`refreshUsedCard: true`)** once per trigger chain or accelerated skill CD reduction.
       - `iron` combos generate **`shieldCharges`**.
       - `wing` combos generate **`counterCharges`** + flank pace boost.
2. **Perk Cohesion Feed-Back**:
   - Squad Rogue Perks (`attack >= 2`, `defense >= 2`, `control >= 2`) feed both **+1 Skill Bonus Rank** and specialized pitch behavior (`perkSynergies` flags passed via `TeamSetup`).
3. **Zero Regression Baseline**:
   - All skill triggers, aspects, and card rewards execute strictly when `userEquippedSkills` / `userAspects` are configured (`club.isUser`), preserving unaltered baseline AI-vs-AI match physics (`npm run sim:100`).
