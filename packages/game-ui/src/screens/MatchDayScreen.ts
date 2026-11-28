/**
 * 页面 4：Match Day 实时 2D 比赛日
 * - 10Hz 逻辑 + 60fps 插值
 * - 球员脚下体能条 + 进球高光横幅 + 中场休息复盘提示
 * - 临场 Tactical Tweaks + 临场换人面板 (最多5人)
 */

import { FORMATION_SYSTEMS, FORMATIONS, getDefenseSystem, getDynamicAnchor } from '../../../engine/src/formations';
import { MatchEngine } from '../../../engine/src/MatchEngine';
import {
  DefenseSystem,
  FormationName,
  MatchState,
  PITCH,
  SkillVfxTheme,
  TACTICAL_PRESETS,
  TacticalStyle,
  TeamSide,
} from '../../../engine/src/types';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { WEATHER_INFO } from '../../../core/src/Chronicles';
import { TacticalPresetSlot } from '../../../core/src/types';
import { CommandCard, evaluateAdjacencySynergy, evaluateCardEffectiveCost, formatCardHumanIntent, inferCardElement, STANCE_LABELS } from '../../../core/src/CommandCards';
import {
  compileDirectiveToEffect,
  V6_DIRECTIVE_ENCHANTS,
  V6_SEGMENTS,
  type V6CheckpointKey,
  type V6CompiledDirectiveEntry,
  type V6RelicId,
} from '../../../core/src/v6';
import { AssetLoader, getDirectiveAssetId, getRelicAssetId, getSkillAssetId } from '../AssetLoader';
import { drawPlayerAvatar } from '../AvatarRenderer';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawFoilShimmer,
  drawPrintCard,
  drawRoundRect,
  drawStamp,
  drawText,
  drawWrappedText,
  fitText,
  FONT,
  getCommandCardArtId,
  getCommandCardElemId,
  getHalftonePattern,
  HitRegistry,
  wrapTextLines,
} from '../CanvasKit';
import { colorDistance, drawClubCrest, isLightHex, resolveMatchKits } from '../ClubVisuals';
import { drawGameLogoEmblem, easeOutBack, easeOutCubic, MangaCutIn, StampSlam } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { IS_MOBILE, THEME } from '../Theme';
import { drawIcon, drawSkillGlyph, IconName, SkillGlyphKind } from '../VectorIcons';

const SYS_CYCLE: DefenseSystem[] = ['4-back', '3-back', '5-back'];
const STYLES_SHORT: TacticalStyle[] = ['tiki_taka', 'gegenpress', 'balanced', 'wing_play', 'counter', 'park_bus'];
const SHORT_LINE_MAP: Record<string, string> = {
  GK: '门将',
  DEF: '后卫',
  MID: '中场',
  ATT: '前锋',
  ALL: '全队',
};

export class MatchDayScreen {
  private engine: MatchEngine | null = null;
  private isPaused = false;
  private speed = 2;
  private tickAcc = 0;
  private renderPlayers = new Map<string, { x: number; y: number }>();
  private renderBall = { x: 52.5, y: 34, z: 0 };
  private userSide: TeamSide = 'home';

  // 细节增强状态
  private rightTab: 'stats' | 'subs' = 'stats';
  private selectedOutId: string | null = null;
  private selectedBenchId: string | null = null;
  private halftimeNotified = false;
  private goalBanner: { text: string; timer: number; maxTimer: number; team: TeamSide; accent: string; subTag?: string } | null = null;
  private cardBanner: { text: string; color: string; timer: number } | null = null;
  private lastEventCount = 0;
  private lastHiddenCount = 0;
  private handCards: CommandCard[] = [];
  private drawPile: CommandCard[] = [];
  private discardPile: CommandCard[] = [];
  private deckOrderIds: string[] = [];
  private lastPlayedCard: CommandCard | null = null;
  private playedCardIds: string[] = [];
  private lastPeriodicTickMinute = 0;
  private saveDrawHalf1 = false;
  private saveDrawHalf2 = false;
  private subDrawCount = 0;
  private matchPresets: TacticalPresetSlot[] = [];
  private tacticalEnergy = 2;
  private corruptedCardBoost = 0;
  private nextCardDiscount = 0;
  private usedCardIds = new Set<string>();
  private selectedCardId: string | null = null;
  private skillCutIn: {
    name: string;
    instantSummary: string;
    theme: SkillVfxTheme;
    glyphKind: SkillGlyphKind;
    rank: number;
    mutationLabel?: string;
    timer: number;
    maxTimer: number;
  } | null = null;
  private hitStopTimer = 0;
  private scoutCounterElements = new Set<string>();
  private scoutExploitLabel = '';
  private exploitBannerTimer = 0;
  private fullTimeTriggered = false;
  private fullTimeTimer = 0;
  private fullTimeDismissed = false;
  private onCelebrationBurst?: (x: number, y: number, color?: string) => void;
  private pitchTacticalVfx: Array<{
    kind: 'triangle' | 'press_ring' | 'def_wall' | 'ult_wave';
    x: number;
    y: number;
    points?: Array<{ x: number; y: number }>;
    color: string;
    timer: number;
    maxTimer: number;
  }> = [];
  private selectedPitchPlayerId: string | null = null;
  private tacticalModalOpen = false;
  private wasPausedBeforeModal = false;
  private modalSysTab: DefenseSystem = '4-back';
  private draftForm: FormationName = '4-3-3';
  private draftStyle: TacticalStyle = 'tiki_taka';
  private modalSelectedPitchId: string | null = null;
  private modalSwapMode = false;
  private benchFilter: 'ALL' | 'MATCH' | 'STAR' | 'GK' | 'DEF' | 'MID' | 'ATT' = 'ALL';
  private benchPage = 0;
  private modalBanner = '调整阵型/风格、点选场上球员换位/微调站位，或右侧换人；完成后点击保存并返回比赛';
  private onGoalCallback?: (team: TeamSide) => void;
  private onImpactCallback?: (intensity: number, dur: number) => void;
  private ballTrail: Array<{ x: number; y: number }> = [];
  // 渲染层即时反馈特效（战术目标幽灵环、球员脉冲光环、头顶属性飘字）
  private tacticGhostTimer = 0;
  private tacticSlowMoTimer = 0;
  private savedSpeedBeforeSlowMo: number | null = null;
  private goalFlashTimer = 0;
  private goalFlashSide: 'left' | 'right' | null = null;
  private tacticGhostTargets = new Map<string, { x: number; y: number }>();
  private playerPulses: Array<{ playerId: string; color: string; timer: number; maxTimer: number }> = [];
  private playerFloatTags: Array<{ playerId: string; text: string; color: string; timer: number; maxTimer: number }> = [];
  private pitchRipples: Array<{ x: number; y: number; color: string; timer: number; maxTimer: number; maxR: number }> = [];
  private storyTags = new Map<string, string>();
  private playerCaMap = new Map<string, number>();
  private elapsedSec = 0;
  private prologueWaitTimer = 0;
  private goalScorePopTimer = 0;
  private memoryHighlightTimer = 0;
  private kickoffIntroTimer = 0;
  private readonly kickoffDuration = 2.2;
  private isPrologueMode = false;
  private prologueChampionModal = false;
  private storyBeatBanner: { speaker: string; text: string; color: string; timer: number; maxTimer: number } | null = null;
  private onPrologueComplete?: () => void;

  // V6 四赛段自由拍板 (0'-20' / 21'-45' / 46'-70' / 71'-90'+) 与 2D 球场光幕状态
  private leagueRef: LeagueManager | null = null;
  private v6Checkpoints: Record<V6CheckpointKey, V6CompiledDirectiveEntry[]> = { s1: [], s2: [], s3: [], s4: [] };
  private v6TpBase = 3;
  private v6MaxCarryTp = 2;
  private v6MaxPlaysPerSegment = 2;
  private v6BonusPlayCap = 0;
  private v6Tp = 3;
  private v6CurrentSegment: V6CheckpointKey = 's1';
  private v6TriggeredCheckpoints = new Set<V6CheckpointKey>();
  private v6CheckpointPlayedCount = 0;
  private v6CheckpointUsedIds = new Set<string>();
  private v6HasEmergencyCall = false;
  private v6EmergencyUsed = false;
  private v6HairdryerReady = false;
  private v6Relics = new Set<V6RelicId>();
  private v6HoveringCard = false;
  private v6HoveredZone: 'ATT' | 'MID' | 'DEF' | null = null;
  private selectedV6CardId: string | null = null;
  private mangaCutIn = new MangaCutIn();
  private cardPlayStamp = new StampSlam();
  private lastStampedV6Id: string | null = null;
  private v6ZoneCurtains: Array<{
    zone: 'ATT' | 'MID' | 'DEF';
    tendency: 'ATK' | 'DEF';
    label: string;
    lineShift?: number;
    dualOverlap?: boolean;
    timer: number;
    maxTimer: number;
  }> = [];
  private v6ActiveCapsules: Array<{
    name: string;
    zone: 'ATT' | 'MID' | 'DEF';
    benefit: string;
    risk: string;
    endMinute: number;
  }> = [];

  public dispose(): void {
    this.engine = null;
    this.leagueRef = null;
    this.isPrologueMode = false;
    this.storyBeatBanner = null;
    this.onPrologueComplete = undefined;
    this.renderPlayers.clear();
    this.tacticGhostTargets.clear();
    this.storyTags.clear();
    this.playerCaMap.clear();
    this.ballTrail = [];
    this.playerPulses = [];
    this.playerFloatTags = [];
    this.pitchRipples = [];
    this.v6Checkpoints = { s1: [], s2: [], s3: [], s4: [] };
    this.v6TriggeredCheckpoints.clear();
    this.v6CurrentSegment = 's1';
    this.v6Tp = 0;
    this.v6CheckpointPlayedCount = 0;
    this.v6CheckpointUsedIds.clear();
    this.v6BonusPlayCap = 0;
    this.v6EmergencyUsed = false;
    this.v6HairdryerReady = false;
    this.v6Relics.clear();
    this.v6HoveringCard = false;
    this.v6HoveredZone = null;
    this.selectedV6CardId = null;
    this.lastStampedV6Id = null;
    this.mangaCutIn.dismiss();
    this.cardPlayStamp.reset();
    this.v6ZoneCurtains = [];
    this.v6ActiveCapsules = [];
    this.pitchTacticalVfx = [];
    this.usedCardIds.clear();
    this.drawPile = [];
    this.discardPile = [];
    this.playedCardIds = [];
    this.scoutCounterElements.clear();
    this.scoutExploitLabel = '';
  }

  public consumePlayedCardIds(): string[] {
    const out = [...this.playedCardIds];
    this.playedCardIds = [];
    return out;
  }

  private drawCardsFromDeck(count: number): void {
    if (this.isPrologueMode) return;
    for (let i = 0; i < count; i++) {
      if (this.handCards.length >= 4) break;
      if (this.drawPile.length === 0) {
        const baseBack = this.discardPile.filter(c => c.isBase || c.id === 'card_captain_roar');
        if (baseBack.length === 0) break;
        this.discardPile = this.discardPile.filter(c => !c.isBase && c.id !== 'card_captain_roar');
        for (let j = baseBack.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [baseBack[j], baseBack[k]] = [baseBack[k], baseBack[j]];
        }
        this.drawPile.push(...baseBack);
      }
      const next = this.drawPile.shift();
      if (next) this.handCards.push(next);
    }
  }

  private isScoutResonantCard(card: CommandCard): boolean {
    if (this.scoutCounterElements.size === 0) return false;
    const mainEl = inferCardElement(card);
    if (this.scoutCounterElements.has(mainEl)) return true;
    return (card.recipeKey ?? '').split('+').some(el => this.scoutCounterElements.has(el));
  }

  private resolveCutInGlyph(styleTag?: TacticalStyle, vfxTheme?: SkillVfxTheme): SkillGlyphKind {
    if (styleTag === 'gegenpress') return 'press';
    if (styleTag === 'tiki_taka') return 'tiki';
    if (styleTag === 'wing_play') return 'wing';
    if (styleTag === 'counter') return 'counter';
    if (styleTag === 'park_bus') return 'bus';
    if (styleTag === 'balanced') return 'balanced';
    return vfxTheme === 'att' ? 'press' : vfxTheme === 'def' ? 'bus' : 'fusion';
  }

  private getLineOfRole(role: string): 'GK' | 'DEF' | 'MID' | 'ATT' {
    if (role === 'GK') return 'GK';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(role)) return 'DEF';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(role)) return 'MID';
    return 'ATT';
  }

  private triggerTacticsFeedback(newForm?: string, newStyle?: TacticalStyle): void {
    if (!this.engine) return;
    const st = this.engine.getState();
    const form = (this.userSide === 'home' ? st.homeFormation : st.awayFormation);
    const style = (this.userSide === 'home' ? st.homeStyle : st.awayStyle);
    const dir = this.userSide === 'home' ? st.homeAttackDir : (st.homeAttackDir === 1 ? -1 : 1);
    const slots = FORMATIONS[form];
    const holder = st.ball.holderId ? st.players.find(p => p.id === st.ball.holderId) : null;
    const hasPoss = holder ? holder.team === this.userSide : (st.ball.lastTouchTeam ? st.ball.lastTouchTeam === this.userSide : null);

    this.tacticGhostTargets.clear();
    for (const p of st.players) {
      if (p.team !== this.userSide || p.redCard) continue;
      const slot = slots[p.slotIndex] || slots[0];
      const anchor = getDynamicAnchor(slot, st.ball.pos, dir, hasPoss, style, form);
      this.tacticGhostTargets.set(p.id, anchor);
      this.playerPulses.push({ playerId: p.id, color: '#38BDF8', timer: 0.9, maxTimer: 0.9 });
    }
    this.tacticGhostTimer = 1.6;
    if (!this.isPaused && this.speed >= 4) {
      if (this.savedSpeedBeforeSlowMo === null) {
        this.savedSpeedBeforeSlowMo = this.speed;
        this.speed = 1;
      }
      this.tacticSlowMoTimer = 1.5;
    }

    if (newForm) {
      this.cardBanner = { text: `阵型切换 · ${newForm} (场上目标站位已更新)`, color: '#38BDF8', timer: 1.8 };
    } else if (newStyle) {
      const pr = TACTICAL_PRESETS[newStyle];
      const lh = pr.lineHeight >= 0 ? `+${pr.lineHeight}m` : `${pr.lineHeight}m`;
      this.cardBanner = {
        text: `战术切换 · ${pr.name} (防线 ${lh} · 逼抢 ${Math.round(pr.pressIntensity * 100)}%)`,
        color: THEME.GOLD_LIGHT,
        timer: 2.0,
      };
    }
    SoundEngine.playClick();
  }

  private triggerCardFeedback(card: CommandCard): void {
    if (!this.engine) return;
    const st = this.engine.getState();
    const targetLine = card.targetLine ?? 'ALL';
    const parts: string[] = [];
    if (card.shootingDelta) parts.push(`+射${card.shootingDelta}`);
    if (card.passingDelta) parts.push(`+传${card.passingDelta}`);
    if (card.paceDelta) parts.push(`+速${card.paceDelta}`);
    if (card.defendingDelta) parts.push(`+防${card.defendingDelta}`);
    if (card.goalkeepingDelta) parts.push(`+扑${card.goalkeepingDelta}`);
    if (card.composureDelta) parts.push(`+冷${card.composureDelta}`);
    if (card.fitnessInstantDelta) parts.push(`+体${card.fitnessInstantDelta}%`);
    const tagText = parts.slice(0, 2).join(' ') || '战术强化';
    const tagColor = card.isCorrupted ? '#FCA5A5' : card.chainEffect ? '#C084FC' : THEME.GOLD_LIGHT;

    for (const p of st.players) {
      if (p.team !== this.userSide || p.redCard) continue;
      const match = targetLine === 'ALL' || this.getLineOfRole(p.role) === targetLine;
      if (match) {
        this.playerPulses.push({ playerId: p.id, color: tagColor, timer: 1.2, maxTimer: 1.2 });
        this.playerFloatTags.push({ playerId: p.id, text: tagText, color: tagColor, timer: 1.5, maxTimer: 1.5 });
      } else if (card.chainEffect?.type === 'spread_all') {
        this.playerPulses.push({ playerId: p.id, color: '#38BDF8', timer: 1.0, maxTimer: 1.0 });
        this.playerFloatTags.push({ playerId: p.id, text: '+传4 +冷4', color: '#38BDF8', timer: 1.3, maxTimer: 1.3 });
      }
    }
  }

  private advanceV6Segment(seg: V6CheckpointKey, silent = false): void {
    if (this.v6TriggeredCheckpoints.has(seg)) return;
    const isFirst = this.v6TriggeredCheckpoints.size === 0;
    this.v6TriggeredCheckpoints.add(seg);
    const carryOver = isFirst ? 0 : Math.min(this.v6MaxCarryTp, this.v6Tp);
    this.v6Tp = carryOver + this.v6TpBase;
    this.v6CurrentSegment = seg;
    this.v6CheckpointPlayedCount = 0;
    this.v6BonusPlayCap = 0;
    this.v6CheckpointUsedIds.clear();

    if (seg === 's3' && this.v6Relics.has('hairdryer') && this.engine) {
      this.v6HairdryerReady = true;
      this.engine.applyCommandCard(this.userSide, {
        id: 'relic_hairdryer_heal',
        name: '弗格森吹风机',
        durationMinutes: 2,
        targetLine: 'ALL',
        fitnessInstantDelta: 12,
      });
    }
    if (seg === 's4' && this.v6Relics.has('clutch_clock') && this.engine) {
      const stNow = this.engine.getState();
      const myScore = this.userSide === 'home' ? stNow.homeScore : stNow.awayScore;
      const oppScore = this.userSide === 'home' ? stNow.awayScore : stNow.homeScore;
      if (myScore <= oppScore) {
        this.engine.applyCommandCard(this.userSide, {
          id: 'relic_clutch_clock',
          name: '压哨绝杀时钟',
          durationMinutes: 18,
          targetLine: 'ALL',
          shootingDelta: 8,
          paceDelta: 8,
          mechanic: 'blood_frenzy',
        });
      }
    }

    if (!silent) {
      SoundEngine.playClick();
      const segInfo = V6_SEGMENTS.find(s => s.key === seg);
      const carryTxt = carryOver > 0 ? `（含上段结转 +${carryOver} TP）` : '';
      this.cardBanner = {
        text: `⚡ 进入${segInfo?.title ?? '新赛段'} (${segInfo?.range ?? ''}) · 当前可用 ${this.v6Tp} TP${carryTxt}`,
        color: '#38BDF8',
        timer: 2.5,
      };
    }
  }

  private getEffectiveV6CardCost(entry: V6CompiledDirectiveEntry): number {
    let cost = entry.effectiveTpCost;
    if (this.v6CurrentSegment === 's3' && this.v6HairdryerReady && this.v6CheckpointPlayedCount === 0) {
      cost = Math.max(0, cost - 1);
    }
    return cost;
  }

  private playV6Directive(entry: V6CompiledDirectiveEntry): void {
    if (!this.engine || !this.leagueRef) return;
    const def = entry.def;
    const effCost = this.getEffectiveV6CardCost(entry);
    const maxPlays = this.v6MaxPlaysPerSegment + this.v6BonusPlayCap;
    if (this.v6Tp < effCost || this.v6CheckpointPlayedCount >= maxPlays || this.v6CheckpointUsedIds.has(def.id)) {
      SoundEngine.playWarning();
      return;
    }
    const stNow = this.engine.getState();
    const curForm = this.userSide === 'home' ? stNow.homeFormation : stNow.awayFormation;
    const curStyle = this.userSide === 'home' ? stNow.homeStyle : stNow.awayStyle;
    const ast = this.leagueRef.getV6Astrolabe();
    const rogue = this.leagueRef.getV6SeasonRogue();
    const eff = compileDirectiveToEffect(def.id, ast, curStyle, curForm, rogue);
    if (!eff) return;

    // 暗金词条《弗格森时间》：决胜总攻段拍出正面属性翻倍
    if (entry.enchant === 'fergie_time' && this.v6CurrentSegment === 's4') {
      if ((eff.passingDelta ?? 0) > 0) eff.passingDelta! *= 2;
      if ((eff.shootingDelta ?? 0) > 0) eff.shootingDelta! *= 2;
      if ((eff.defendingDelta ?? 0) > 0) eff.defendingDelta! *= 2;
      if ((eff.paceDelta ?? 0) > 0) eff.paceDelta! *= 2;
      if ((eff.composureDelta ?? 0) > 0) eff.composureDelta! *= 2;
    }

    const res = this.engine.applyCommandCard(this.userSide, eff);
    if (!res.ok) {
      SoundEngine.playWarning();
      return;
    }
    if (this.v6CurrentSegment === 's3' && this.v6HairdryerReady && this.v6CheckpointPlayedCount === 0) {
      this.v6HairdryerReady = false;
    }
    this.v6Tp -= effCost;
    this.v6CheckpointPlayedCount += 1;
    this.v6CheckpointUsedIds.add(def.id);
    this.selectedV6CardId = null;
    this.lastStampedV6Id = def.id;
    this.cardPlayStamp.trigger();
    const zCol = def.zone === 'ATT' ? THEME.VERMILION : def.zone === 'MID' ? THEME.COBALT : '#15803D';
    this.v6ZoneCurtains.push({
      zone: def.zone,
      tendency: def.tendency,
      label: `${def.name} (${def.zone === 'ATT' ? '前场' : def.zone === 'MID' ? '中场' : '后场'}·${def.tendency === 'ATK' ? '攻' : '守'})`,
      lineShift: eff.tacticalMod?.lineShift,
      dualOverlap: eff.tacticalMod?.dualOverlap,
      timer: 2.2,
      maxTimer: 2.2,
    });
    const riskZeroed = entry.enchant === 'zero_risk' || (entry.satellites.includes('A') && def.satellites.A.removeRisk);
    this.v6ActiveCapsules.push({
      name: def.name,
      zone: def.zone,
      benefit: def.benefitSummary,
      risk: riskZeroed ? '已免疫副作用' : def.riskSummary,
      endMinute: stNow.minute + eff.durationMinutes,
    });
    if (this.v6ActiveCapsules.length > 3) this.v6ActiveCapsules.shift();
    for (const p of stNow.players) {
      if (p.team !== this.userSide || p.redCard) continue;
      if (this.getLineOfRole(p.role) === def.zone || def.zone === 'MID') {
        this.playerPulses.push({ playerId: p.id, color: zCol, timer: 1.2, maxTimer: 1.2 });
        this.playerFloatTags.push({ playerId: p.id, text: def.name.slice(0, 6), color: zCol, timer: 1.5, maxTimer: 1.5 });
      }
    }
    this.cardBanner = {
      text: `⚡ 三区指令生效 · 《${def.name}》(${eff.durationMinutes}') · 🟢${def.benefitSummary.slice(0, 20)}`,
      color: zCol,
      timer: 2.5,
    };
    SoundEngine.playCommandCard(def.route === 'gamble');
  }

  private playCommandCard(card: CommandCard): void {
    const stNow = this.engine!.getState();
    const scoutResonant = this.isScoutResonantCard(card);
    const evalCost = evaluateCardEffectiveCost(card, stNow, this.userSide, scoutResonant);
    const effCost = Math.max(0, evalCost.cost - this.nextCardDiscount);
    const mul = card.isCorrupted && this.corruptedCardBoost > 0 ? 1 + this.corruptedCardBoost : 1;
    const scalePos = (v?: number) => (v && v > 0 ? Math.round(v * mul) : v);
    const curStyleNow = stNow.teamStance?.[this.userSide] ?? (this.userSide === 'home' ? stNow.homeStyle : stNow.awayStyle);
    const adjBonus = this.lastPlayedCard && evaluateAdjacencySynergy(this.lastPlayedCard, card, curStyleNow).active ? 2 : 0;
    const res = this.engine!.applyCommandCard(this.userSide, {
      ...card,
      passingDelta: scalePos(card.passingDelta),
      shootingDelta: scalePos(card.shootingDelta),
      defendingDelta: scalePos(card.defendingDelta),
      paceDelta: scalePos(card.paceDelta),
      composureDelta: scalePos(card.composureDelta),
      goalkeepingDelta: scalePos(card.goalkeepingDelta),
      fitnessInstantDelta: scalePos(card.fitnessInstantDelta),
      durationMinutes: card.durationMinutes + (scoutResonant ? 5 : 0) + adjBonus,
      element: inferCardElement(card),
    });
    if (!res.ok) {
      SoundEngine.playWarning();
      this.cardBanner = { text: '当前还不到打出这张指挥卡的时机！', color: '#FBBF24', timer: 2.2 };
      return;
    }
    this.tacticalEnergy -= effCost;
    if (this.nextCardDiscount > 0) this.nextCardDiscount = 0;
    this.selectedCardId = null;
    if (this.isPrologueMode) {
      this.usedCardIds.add(card.id);
    } else {
      this.playedCardIds.push(card.id);
      const hIdx = this.handCards.findIndex(c => c.id === card.id);
      if (hIdx >= 0) this.handCards.splice(hIdx, 1);
      this.discardPile.push(card);
      // 若卡组顺序中下一张卡与当前卡存在连携且仍在牌库，优先置顶准备摸取
      const ordIdx = this.deckOrderIds.indexOf(card.id);
      if (ordIdx >= 0 && ordIdx + 1 < this.deckOrderIds.length) {
        const nextId = this.deckOrderIds[ordIdx + 1];
        const dpIdx = this.drawPile.findIndex(c => c.id === nextId);
        if (dpIdx > 0) {
          const [nextCard] = this.drawPile.splice(dpIdx, 1);
          if (evaluateAdjacencySynergy(card, nextCard, curStyleNow).active) {
            this.drawPile.unshift(nextCard);
          } else {
            this.drawPile.splice(dpIdx, 0, nextCard);
          }
        }
      }
    }
    this.lastPlayedCard = card;
    if (res.energyRefund) this.tacticalEnergy = Math.min(5, this.tacticalEnergy + res.energyRefund);
    this.triggerCardFeedback(card);
    const stanceTxt = card.stance ? ` · 切【${STANCE_LABELS[card.stance]}】` : '';
    this.cardBanner = {
      text: res.comboActivated
        ? `态势连击爆发！${card.name}${stanceTxt}`
        : evalCost.discounted && evalCost.reason
        ? `${evalCost.reason} · ${card.name}${stanceTxt}`
        : scoutResonant
        ? `破绽共振指挥 · ${card.name} (-1费 · 持续+5分)`
        : card.affix?.kind === 'negative'
        ? `异变代价指挥 · ${card.name} (${card.affix.name})`
        : `战术指挥生效 · ${card.name}${stanceTxt}`,
      color: res.comboActivated ? '#C084FC' : evalCost.discounted ? '#4ADE80' : card.affix?.kind === 'negative' ? '#FCA5A5' : THEME.GOLD_LIGHT,
      timer: 2.2,
    };
    SoundEngine.playCommandCard(!!card.isCorrupted);
  }

  private activatePromptSkill(): void {
    if (!this.engine) return;
    const stNow = this.engine.getState();
    if (!stNow.activeSkillPrompt || stNow.phase === 'full_time') return;
    const prm = stNow.activeSkillPrompt;
    const res = this.engine.triggerActiveSkill(this.userSide, prm.skillId);
    if (res.triggered) {
      SoundEngine.playCommandCard(false);
      this.hitStopTimer = 0.045;
      this.onImpactCallback?.(4.2, 0.18);
      this.pitchRipples.push({
        x: stNow.ball.pos.x,
        y: stNow.ball.pos.y,
        color: res.isCardBoosted ? THEME.GOLD_LIGHT : '#38BDF8',
        timer: 0.9,
        maxTimer: 0.9,
        maxR: 42,
      });

      // 球场实景战术投影 VFX（紧贴草皮画在圆点下方）
      const userPitch = stNow.players.filter(p => p.team === this.userSide && !p.redCard);
      const userDir = this.userSide === 'home' ? stNow.homeAttackDir : (stNow.homeAttackDir === 1 ? -1 : 1);
      if (res.instantAction === 'tempo_burst_intercept' || res.styleTag === 'gegenpress') {
        const oppBall = stNow.players.find(p => p.team !== this.userSide && p.hasBall);
        this.pitchTacticalVfx.push({
          kind: 'press_ring',
          x: oppBall?.pos.x ?? stNow.ball.pos.x,
          y: oppBall?.pos.y ?? stNow.ball.pos.y,
          color: '#EF4444',
          timer: 1.5,
          maxTimer: 1.5,
        });
      } else if (res.instantAction === 'clear_danger' || res.instantAction === 'GK_save_boost' || res.vfxTheme === 'def') {
        const defX = userDir === 1 ? 18 : 87;
        this.pitchTacticalVfx.push({
          kind: 'def_wall',
          x: defX,
          y: PITCH.HALF_Y,
          color: '#22D3EE',
          timer: 1.65,
          maxTimer: 1.65,
        });
      } else if (
        res.instantAction === 'force_through_ball' ||
        res.instantAction === 'instant_counter_pass' ||
        res.styleTag === 'tiki_taka' ||
        res.styleTag === 'wing_play'
      ) {
        const frontThree = [...userPitch]
          .sort((a, b) => (b.pos.x - a.pos.x) * userDir)
          .slice(0, 3)
          .map(p => ({ x: p.pos.x, y: p.pos.y }));
        this.pitchTacticalVfx.push({
          kind: 'triangle',
          x: stNow.ball.pos.x,
          y: stNow.ball.pos.y,
          points: [{ x: stNow.ball.pos.x, y: stNow.ball.pos.y }, ...frontThree].slice(0, 4),
          color: THEME.GOLD_LIGHT,
          timer: 1.6,
          maxTimer: 1.6,
        });
      } else {
        this.pitchTacticalVfx.push({
          kind: 'ult_wave',
          x: PITCH.HALF_X,
          y: PITCH.HALF_Y,
          color: res.isCardBoosted ? '#FACC15' : '#38BDF8',
          timer: 1.6,
          maxTimer: 1.6,
        });
      }

      this.skillCutIn = null;
      this.mangaCutIn.trigger({
        title: res.skillName,
        subtitle: res.instantSummary,
        tag: res.isCardBoosted ? '基因共鸣绝技' : '招牌绝技',
        accent: res.vfxTheme === 'def' ? THEME.COBALT : THEME.VERMILION,
        artId: getSkillAssetId(prm.skillId, res.styleTag),
      });
      this.cardBanner = {
        text: res.isCardBoosted
          ? `基因共鸣 · ${res.skillName} (R${res.effectiveRank}) · ${res.instantSummary}`
          : `主动技觉醒 · ${res.skillName} (R${res.effectiveRank}) · ${res.instantSummary}`,
        color: res.isCardBoosted ? THEME.GOLD_LIGHT : '#38BDF8',
        timer: 2.4,
      };
    }
  }

  public onKeyDown(code: string): void {
    if (!this.engine) return;
    if (this.kickoffIntroTimer > 0 && (code === 'Space' || code === 'Enter' || code === 'Escape')) {
      this.kickoffIntroTimer = 0;
      SoundEngine.playWhistle('kickoff');
      this.pitchRipples.push({ x: PITCH.HALF_X, y: PITCH.HALF_Y, color: '#FACC15', timer: 0.9, maxTimer: 0.9, maxR: 52 });
      return;
    }
    if (code === 'Escape') {
      if (this.tacticalModalOpen) {
        this.tacticalModalOpen = false;
        this.isPaused = this.wasPausedBeforeModal;
        return;
      }
      this.selectedCardId = null;
      this.selectedPitchPlayerId = null;
      return;
    }
    if (this.tacticalModalOpen) return;
    if (code === 'Space') this.isPaused = !this.isPaused;
    else if (code === 'Digit1') this.speed = 1;
    else if (code === 'Digit2') this.speed = 2;
    else if (code === 'Digit3') this.speed = 4;
    else if (code === 'Digit4') this.speed = 8;
    else if (code === 'KeyF') {
      this.activatePromptSkill();
    }
  }

  public startPrologueMatch(
    league: LeagueManager,
    onComplete: () => void,
    onGoal?: (team: TeamSide) => void,
    onImpact?: (intensity: number, dur: number) => void,
    onBurst?: (x: number, y: number, color?: string) => void
  ): void {
    this.userSide = 'home';
    this.engine = league.createPrologueMatchEngine();
    this.isPrologueMode = true;
    this.prologueChampionModal = false;
    this.onPrologueComplete = onComplete;
    this.isPaused = false;
    this.speed = 2;
    this.tickAcc = 0;
    this.rightTab = 'stats';
    this.selectedOutId = null;
    this.selectedBenchId = null;
    this.halftimeNotified = true;
    this.goalBanner = null;
    this.cardBanner = null;
    this.storyBeatBanner = {
      speaker: '场边 · 生死决战',
      text: "0:1 落后！唯有赢下今晚这场比赛，才能捧起超级联赛冠军奖杯！",
      color: THEME.GOLD_LIGHT,
      timer: 4.0,
      maxTimer: 4.0,
    };
    this.skillCutIn = null;
    this.hitStopTimer = 0;
    this.exploitBannerTimer = 0;
    this.fullTimeTriggered = false;
    this.fullTimeTimer = 0;
    this.fullTimeDismissed = false;
    this.pitchTacticalVfx = [];
    this.scoutCounterElements.clear();
    this.scoutExploitLabel = '';
    this.lastEventCount = 0;
    this.lastHiddenCount = 0;
    this.corruptedCardBoost = 0;
    this.tacticalEnergy = 4;
    this.nextCardDiscount = 0;
    this.usedCardIds.clear();
    this.selectedCardId = null;
    this.selectedPitchPlayerId = null;
    this.onGoalCallback = onGoal;
    this.onImpactCallback = onImpact;
    this.onCelebrationBurst = onBurst;
    this.ballTrail = [];
    this.goalFlashTimer = 0;
    this.goalFlashSide = null;
    this.tacticSlowMoTimer = 0;
    this.savedSpeedBeforeSlowMo = null;
    this.kickoffIntroTimer = 0;
    this.playerPulses = [];
    this.playerFloatTags = [];
    this.tacticalModalOpen = false;
    this.modalSelectedPitchId = null;
    this.drawPile = [];
    this.discardPile = [];
    this.handCards = [
      {
        id: 'prologue_card_wing_stance',
        catalogId: 'b_wp_1',
        name: '拉开宽度',
        tier: 0,
        gene: 'wing',
        isBase: true,
        cost: 1,
        level: 1,
        element: 'wing',
        targetLine: 'ALL',
        durationMinutes: 15,
        paceDelta: 6,
        stance: 'wing_play',
        tacticalMod: { widthScaleDelta: 0.12, crossBias: 0.15 },
        mechanic: 'wing_overload',
        summary: '切【两翼】态势 · 宽度+12% 传中+15% 边锋速+6',
      },
      {
        id: 'prologue_card_wing_combo',
        catalogId: 's_wp_1',
        name: '边路强突造角',
        tier: 2,
        gene: 'wing',
        cost: 1,
        level: 2,
        maxUses: 2,
        remainingUses: 2,
        element: 'wing',
        targetLine: 'ATT',
        durationMinutes: 12,
        paceDelta: 10,
        shootingDelta: 8,
        comboRule: { requiresStance: 'wing_play', energyRefund: 1, extraBoxCrash: 1, label: '两翼连击返1费+抢点' },
        tacticalMod: { cornerRateMul: 1.75 },
        mechanic: 'wing_overload',
        summary: '造角球×1.75 · 【两翼】连击：返1费且抢点+1人',
      },
      {
        id: 'prologue_card_captain_roar',
        catalogId: 'b_g_roar',
        name: '老队长的怒吼',
        tier: 0,
        gene: 'blitz',
        isBase: true,
        cost: 1,
        level: 3,
        element: 'blitz',
        targetLine: 'ALL',
        durationMinutes: 15,
        shootingDelta: 8,
        paceDelta: 6,
        composureDelta: 10,
        fitnessInstantDelta: 10,
        timingCondition: 'late_70_not_leading',
        timingDiscount: 1,
        mechanic: 'blood_frenzy',
        summary: '全队冷+10 射+8 速+6 回体+10% · 70\'落后0费',
      },
    ];
    this.matchPresets = league.getTacticalPresets().map(p => ({ ...p, starterIds: [...p.starterIds] }));
    this.storyTags.clear();
    this.playerCaMap.clear();
    this.renderPlayers.clear();
    const st = this.engine.getState();
    SoundEngine.setScene('match_climax', st.weather ?? 'sunny');
    for (const p of st.players) {
      this.renderPlayers.set(p.id, { x: p.pos.x, y: p.pos.y });
    }
    this.renderBall = { x: st.ball.pos.x, y: st.ball.pos.y, z: st.ball.pos.z };
  }

  public start(
    league: LeagueManager,
    onGoal?: (team: TeamSide) => void,
    onImpact?: (intensity: number, dur: number) => void,
    onBurst?: (x: number, y: number, color?: string) => void
  ): void {
    const fx = league.getUserCurrentFixture();
    this.userSide = fx && fx.awayClubId === league.getState().userClubId ? 'away' : 'home';
    this.engine = league.createUserMatchEngine();
    this.isPrologueMode = false;
    this.onPrologueComplete = undefined;
    this.isPaused = false;
    this.tickAcc = 0;
    this.rightTab = 'stats';
    this.selectedOutId = null;
    this.selectedBenchId = null;
    this.halftimeNotified = false;
    this.goalBanner = null;
    this.cardBanner = null;
    this.skillCutIn = null;
    this.hitStopTimer = 0;
    this.exploitBannerTimer = 0;
    this.fullTimeTriggered = false;
    this.fullTimeTimer = 0;
    this.fullTimeDismissed = false;
    this.pitchTacticalVfx = [];
    this.scoutCounterElements.clear();
    this.scoutExploitLabel = '';
    const intel = league.getInterMatchPrep()?.matchupIntel;
    if (intel?.spotCorrect) {
      this.scoutExploitLabel = intel.activeDebuff?.label ?? '赛前破绽击穿';
      if ((intel.chosenRewardKind ?? 'buff_debuff') === 'buff_debuff') {
        for (const el of intel.counterElements ?? []) {
          this.scoutCounterElements.add(el);
        }
      }
    }
    this.lastEventCount = 0;
    this.lastHiddenCount = 0;
    const perks = league.getUserClub().perks ?? [];
    const perkStartEnergy = perks.reduce((s, pk) => s + (pk.effect.startEnergyBonus ?? 0), 0);
    this.corruptedCardBoost = perks.reduce((s, pk) => s + (pk.effect.corruptedCardBoost ?? 0), 0);
    this.tacticalEnergy = Math.min(5, 2 + (league.getInterMatchPrep()?.nextMatchBuff?.energyBonus ?? 0) + perkStartEnergy);
    this.nextCardDiscount = 0;
    this.usedCardIds.clear();
    this.playedCardIds = [];
    this.lastPeriodicTickMinute = 0;
    this.saveDrawHalf1 = false;
    this.saveDrawHalf2 = false;
    this.subDrawCount = 0;
    this.selectedCardId = null;
    this.selectedPitchPlayerId = null;
    this.onGoalCallback = onGoal;
    this.onImpactCallback = onImpact;
    this.onCelebrationBurst = onBurst;
    this.ballTrail = [];
    this.goalFlashTimer = 0;
    this.goalFlashSide = null;
    this.tacticSlowMoTimer = 0;
    this.savedSpeedBeforeSlowMo = null;
    this.kickoffIntroTimer = this.kickoffDuration;
    this.playerPulses = [];
    this.playerFloatTags = [];
    this.tacticalModalOpen = false;
    this.modalSelectedPitchId = null;
    const fullDeck = league.getActiveMatchDeck().map(c => ({ ...c }));
    this.deckOrderIds = fullDeck.map(c => c.id);
    this.lastPlayedCard = null;
    const innateFirst = fullDeck.filter(c => c.affix?.innateOpeningHand);
    const orderedRest = fullDeck.filter(c => !c.affix?.innateOpeningHand);
    this.drawPile = [...innateFirst, ...orderedRest];
    this.discardPile = [];
    this.handCards = [];
    this.drawCardsFromDeck(3);
    this.leagueRef = league;
    const v6Cfg = league.getV6MatchRuntimeConfig();
    this.v6TpBase = v6Cfg.checkpointTpBase;
    this.v6MaxCarryTp = v6Cfg.maxCarryTp;
    this.v6MaxPlaysPerSegment = v6Cfg.maxPlaysPerSegment;
    this.v6HasEmergencyCall = v6Cfg.hasEmergencyCall;
    this.v6EmergencyUsed = false;
    this.v6HairdryerReady = false;
    this.v6Relics = new Set<V6RelicId>(v6Cfg.relics);
    this.v6Checkpoints = {
      s1: league.getV6CheckpointDirectives('s1'),
      s2: league.getV6CheckpointDirectives('s2'),
      s3: league.getV6CheckpointDirectives('s3'),
      s4: league.getV6CheckpointDirectives('s4'),
    };
    this.v6TriggeredCheckpoints.clear();
    this.v6HoveringCard = false;
    this.v6HoveredZone = null;
    this.v6ZoneCurtains = [];
    this.v6ActiveCapsules = [];
    // 开场即进入第 1 赛段 (0'-20')，0 秒即可自由拍板出牌！
    this.advanceV6Segment('s1', true);
    this.matchPresets = league.getTacticalPresets().map(p => ({ ...p, starterIds: [...p.starterIds] }));
    this.storyTags.clear();
    this.playerCaMap.clear();
    for (const pl of league.getUserClub().squad) {
      this.playerCaMap.set(pl.id, pl.ca);
      const stTag = league.getPlayerStoryTag(pl);
      if (stTag) this.storyTags.set(pl.id, stTag);
    }
    this.renderPlayers.clear();
    const st = this.engine.getState();
    SoundEngine.setScene('match', st.weather ?? 'sunny');
    for (const p of st.players) {
      this.renderPlayers.set(p.id, { x: p.pos.x, y: p.pos.y });
    }
    this.renderBall = { x: st.ball.pos.x, y: st.ball.pos.y, z: st.ball.pos.z };
  }

  public update(dtSec: number): void {
    if (!this.engine) return;
    const st = this.engine.getState();
    this.elapsedSec += dtSec;
    this.mangaCutIn.update(dtSec);
    this.cardPlayStamp.update(dtSec);
    if (this.goalScorePopTimer > 0) {
      this.goalScorePopTimer = Math.max(0, this.goalScorePopTimer - dtSec);
    }
    if (this.memoryHighlightTimer > 0) {
      this.memoryHighlightTimer = Math.max(0, this.memoryHighlightTimer - dtSec);
    }
    const isClimax = st.minute >= 75 && Math.abs(st.homeScore - st.awayScore) <= 1 && st.phase !== 'full_time';
    SoundEngine.setMatchTension(isClimax);
    if (isClimax) {
      SoundEngine.setScene('match_climax', st.weather ?? 'sunny');
    }

    if (this.goalBanner) {
      this.goalBanner.timer -= dtSec;
      if (this.goalBanner.timer <= 0) this.goalBanner = null;
    }
    if (this.cardBanner) {
      this.cardBanner.timer -= dtSec;
      if (this.cardBanner.timer <= 0) this.cardBanner = null;
    }
    if (this.skillCutIn) {
      this.skillCutIn.timer -= dtSec;
      if (this.skillCutIn.timer <= 0) this.skillCutIn = null;
    }
    if (this.exploitBannerTimer > 0) {
      this.exploitBannerTimer = Math.max(0, this.exploitBannerTimer - dtSec);
    }
    for (let i = this.pitchTacticalVfx.length - 1; i >= 0; i--) {
      this.pitchTacticalVfx[i].timer -= dtSec;
      if (this.pitchTacticalVfx[i].timer <= 0) this.pitchTacticalVfx.splice(i, 1);
    }
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dtSec);
    }
    if (this.tacticGhostTimer > 0) {
      this.tacticGhostTimer = Math.max(0, this.tacticGhostTimer - dtSec);
    }
    if (this.tacticSlowMoTimer > 0) {
      this.tacticSlowMoTimer = Math.max(0, this.tacticSlowMoTimer - dtSec);
      if (this.tacticSlowMoTimer === 0 && this.savedSpeedBeforeSlowMo !== null) {
        this.speed = this.savedSpeedBeforeSlowMo;
        this.savedSpeedBeforeSlowMo = null;
      }
    }
    for (let i = this.playerPulses.length - 1; i >= 0; i--) {
      this.playerPulses[i].timer -= dtSec;
      if (this.playerPulses[i].timer <= 0) this.playerPulses.splice(i, 1);
    }
    for (let i = this.playerFloatTags.length - 1; i >= 0; i--) {
      this.playerFloatTags[i].timer -= dtSec;
      if (this.playerFloatTags[i].timer <= 0) this.playerFloatTags.splice(i, 1);
    }
    if (this.storyBeatBanner) {
      this.storyBeatBanner.timer -= dtSec;
      if (this.storyBeatBanner.timer <= 0) this.storyBeatBanner = null;
    }
    if (st.unlockedHiddenTraits.length > this.lastHiddenCount) {
      const latest = st.unlockedHiddenTraits[st.unlockedHiddenTraits.length - 1];
      this.lastHiddenCount = st.unlockedHiddenTraits.length;
      if (latest) {
        this.cardBanner = {
          text: `隐藏特质觉醒 · ${latest.playerName} 解锁【${latest.trait}】`,
          color: '#38BDF8',
          timer: 2.6,
        };
      }
    }

    // V6 光幕衰减与过期双色胶囊清理
    for (let i = this.v6ZoneCurtains.length - 1; i >= 0; i--) {
      this.v6ZoneCurtains[i].timer -= dtSec;
      if (this.v6ZoneCurtains[i].timer <= 0) this.v6ZoneCurtains.splice(i, 1);
    }
    this.v6ActiveCapsules = this.v6ActiveCapsules.filter(c => st.minute < c.endMinute);

    // V6 四赛段区间自然流转 (0'-20' / 21'-45' / 46'-70' / 71'-90'+)：段内任意时刻均可出牌，绝不强制打断顺风局
    if (!this.isPrologueMode && st.phase !== 'full_time') {
      if (st.minute >= 71 && !this.v6TriggeredCheckpoints.has('s4')) {
        this.advanceV6Segment('s4');
      } else if (st.phase === 'second_half' && st.minute >= 45 && !this.v6TriggeredCheckpoints.has('s3')) {
        this.advanceV6Segment('s3');
      } else if (st.minute >= 21 && !this.v6TriggeredCheckpoints.has('s2')) {
        this.advanceV6Segment('s2');
      }
    }

    // 半场自动暂停提示一次
    if (st.phase === 'half_time' && !this.halftimeNotified) {
      this.halftimeNotified = true;
      this.isPaused = true;
    }

    if (this.kickoffIntroTimer > 0) {
      this.kickoffIntroTimer = Math.max(0, this.kickoffIntroTimer - dtSec);
      if (this.kickoffIntroTimer === 0) {
        SoundEngine.playWhistle('kickoff');
        this.pitchRipples.push({ x: PITCH.HALF_X, y: PITCH.HALF_Y, color: '#FACC15', timer: 0.9, maxTimer: 0.9, maxR: 52 });
      }
    } else if (!this.isPaused && st.phase !== 'full_time' && this.hitStopTimer <= 0) {
      const tutState = this.isPrologueMode ? this.engine.getPrologueTutorialState() : null;
      const isWaitingPrologue = !!(this.isPrologueMode && (tutState?.waitingForSub || tutState?.waitingForCard || st.activeSkillPrompt));
      this.prologueWaitTimer = isWaitingPrologue ? this.prologueWaitTimer + dtSec : 0;
      const effSpeed = st.activeSkillPrompt ? 0.25 : (tutState?.waitingForSub || tutState?.waitingForCard) ? 0.55 : this.v6HoveringCard ? 0.25 : this.speed;
      this.tickAcc += dtSec * 10 * effSpeed;
      let steps = 0;
      while (this.tickAcc >= 1 && steps < 20) {
        this.engine.step();
        this.tickAcc -= 1;
        steps++;
      }
    }

    if (st.phase === 'full_time') {
      if (!this.fullTimeTriggered) {
        this.fullTimeTriggered = true;
        this.fullTimeTimer = 0;
        const myG = this.userSide === 'home' ? st.homeScore : st.awayScore;
        const opG = this.userSide === 'home' ? st.awayScore : st.homeScore;
        if (myG > opG) {
          SoundEngine.playFanfare();
          this.onCelebrationBurst?.(440, 260, THEME.GOLD_LIGHT);
          this.onCelebrationBurst?.(840, 260, THEME.GREEN);
        }
      } else {
        this.fullTimeTimer += dtSec;
      }
    }

    const coachRewards = this.engine.consumeCoachRewards();
    for (const rw of coachRewards) {
      if (rw.energyRefund) this.tacticalEnergy = Math.min(5, this.tacticalEnergy + rw.energyRefund);
      if (rw.nextCardDiscount) this.nextCardDiscount = Math.min(2, this.nextCardDiscount + rw.nextCardDiscount);
      if (rw.refreshUsedCard && this.usedCardIds.size > 0) {
        const firstUsed = this.usedCardIds.values().next().value;
        if (firstUsed) this.usedCardIds.delete(firstUsed);
      }
      this.cardBanner = { text: rw.bannerText, color: rw.tone || THEME.GOLD_LIGHT, timer: 2.4 };
    }
    const callouts = this.engine.consumeTacticalCallouts();
    for (const tc of callouts) {
      if (this.playerFloatTags.some(ft => ft.playerId === tc.playerId && ft.timer > 0.7)) continue;
      const col =
        tc.kind === 'trait' ? '#FACC15' :
        tc.kind === 'chemistry' ? '#38BDF8' :
        tc.kind === 'scout' ? '#F87171' : '#4ADE80';
      this.playerFloatTags.push({
        playerId: tc.playerId,
        text: tc.label,
        color: col,
        timer: 1.45,
        maxTimer: 1.45,
      });
    }

    if (this.goalFlashTimer > 0) {
      this.goalFlashTimer = Math.max(0, this.goalFlashTimer - dtSec);
    }
    for (let i = this.pitchRipples.length - 1; i >= 0; i--) {
      this.pitchRipples[i].timer -= dtSec;
      if (this.pitchRipples[i].timer <= 0) this.pitchRipples.splice(i, 1);
    }

    // 检查新事件触发高光横幅、绝杀慢放、造越位返还能量与 WebAudio 比赛音效
    if (st.events.length > this.lastEventCount) {
      const delta = st.events.length - this.lastEventCount;
      for (let i = this.lastEventCount; i < st.events.length; i++) {
        const ev = st.events[i];
        if (ev.type === 'commentary' && ev.team === this.userSide && ev.text.includes('造越位陷阱成功')) {
          this.tacticalEnergy = Math.min(5, this.tacticalEnergy + 1);
          this.cardBanner = { text: ev.text, color: '#38BDF8', timer: 2.0 };
        }
        if (ev.type === 'goal') {
          const prefix =
            ev.narrativeTag === 'HATTRICK' ? '帽子戏法 · ' :
            ev.narrativeTag === 'LATE_WINNER' ? '读秒绝杀 · ' :
            ev.narrativeTag === 'BRACE' ? '梅开二度 · ' : 'GOAL · ';
          const isMem =
            ev.narrativeTag === 'LATE_WINNER' ||
            ev.narrativeTag === 'HATTRICK' ||
            (ev.minute >= 85 && Math.abs(st.homeScore - st.awayScore) <= 1);
          if (isMem) {
            this.memoryHighlightTimer = 2.8;
          }
          const hasExploit = ev.team === this.userSide && !!this.scoutExploitLabel;
          if (hasExploit) {
            this.exploitBannerTimer = 2.6;
          }
          const subTag = isMem
            ? '载入赛季记忆'
            : hasExploit
            ? `破绽击穿·${this.scoutExploitLabel}`
            : undefined;
          this.goalBanner = {
            text: `${prefix}${ev.playerName} (${ev.minute}')`,
            timer: 2.8,
            maxTimer: 2.8,
            team: ev.team,
            accent: '#FACC15',
            subTag,
          };
          this.goalFlashTimer = 1.4;
          this.goalScorePopTimer = 0.65;
          this.goalFlashSide = ev.pos.x > PITCH.HALF_X ? 'right' : 'left';
          this.pitchRipples.push({ x: ev.pos.x, y: ev.pos.y, color: THEME.LIME, timer: 0.9, maxTimer: 0.9, maxR: 38 });
          if (ev.team === this.userSide) {
            this.mangaCutIn.trigger({
              title: 'GOAL!!',
              subtitle: `${ev.playerName} (${ev.minute}')`,
              tag: prefix.replace(' · ', '') || '破门得分',
              accent: THEME.VERMILION,
            });
          }
          if (!this.isPrologueMode && ev.team !== this.userSide && this.v6Relics.has('comeback_gene')) {
            const myNow = this.userSide === 'home' ? st.homeScore : st.awayScore;
            const oppNow = this.userSide === 'home' ? st.awayScore : st.homeScore;
            if (myNow < oppNow) {
              this.v6Tp += 1;
              this.cardBanner = {
                text: '⚡ 圣物《逆转基因》触发 · 丢球落后额外获得 +1 TP 且绝技冷却缩减！',
                color: '#C084FC',
                timer: 2.6,
              };
            }
          }
          if (ev.minute >= 80 && Math.abs(st.homeScore - st.awayScore) <= 1 && !this.isPaused && this.speed >= 4) {
            if (this.savedSpeedBeforeSlowMo === null) {
              this.savedSpeedBeforeSlowMo = this.speed;
              this.speed = 1;
            }
            this.tacticSlowMoTimer = 1.4;
          }
          this.onGoalCallback?.(ev.team);
          if (this.isPrologueMode) {
            if (ev.team === 'home') {
              if (st.homeScore === 1) {
                this.storyBeatBanner = {
                  speaker: '场边 · #19 陈小宇',
                  text: '小宇破门后冲向替补席握拳！看台退场的球迷停下了脚步——希望还在！',
                  color: '#38BDF8',
                  timer: 3.6,
                  maxTimer: 3.6,
                };
              } else if (st.homeScore === 2) {
                this.storyBeatBanner = {
                  speaker: '场边 · 替补席',
                  text: '陈小宇梅开二度后小腿抽筋倒地！#10 梅利纳一把撕开了左膝冰袋……',
                  color: '#FBBF24',
                  timer: 3.8,
                  maxTimer: 3.8,
                };
              } else if (st.homeScore === 3) {
                this.storyBeatBanner = {
                  speaker: '解说席 · 绝平!!',
                  text: '左膝在颤抖，脚感却滚烫——世界波直挂死角！3:3 扳平！！',
                  color: THEME.GOLD_LIGHT,
                  timer: 3.6,
                  maxTimer: 3.6,
                };
                this.onCelebrationBurst?.(640, 240, THEME.GOLD_LIGHT);
              } else if (st.homeScore >= 4) {
                this.storyBeatBanner = {
                  speaker: '绝杀夺冠!!',
                  text: '职业生涯第 612 场最后一脚触球——读秒绝杀！！超级联赛冠军属于曙光竞技！！',
                  color: '#FEF08A',
                  timer: 4.8,
                  maxTimer: 4.8,
                };
                this.onCelebrationBurst?.(500, 220, THEME.GOLD_LIGHT);
                this.onCelebrationBurst?.(780, 220, THEME.GREEN);
              }
            } else {
              if (st.awayScore === 2) {
                this.storyBeatBanner = {
                  speaker: '解说席 · 危机',
                  text: '刚刚燃起的希望遭遇当头一棒！铁幕联反击得手反超 1:2！',
                  color: '#FCA5A5',
                  timer: 3.2,
                  maxTimer: 3.2,
                };
              } else if (st.awayScore >= 3) {
                this.storyBeatBanner = {
                  speaker: '解说席 · 绝境',
                  text: '年轻防线连续失守，1:3 陷入绝境！只剩二十多分钟了！',
                  color: '#EF4444',
                  timer: 3.6,
                  maxTimer: 3.6,
                };
              }
            }
          }
        } else if (ev.type === 'substitution' && this.isPrologueMode && (ev.playerName.includes('梅利纳') || ev.playerName.includes('林锋'))) {
          this.storyBeatBanner = {
            speaker: '#10 梅利纳(老队长)',
            text: '「老板，最后十分钟，交给我。」全场八万人起立高呼老队长的名字！',
            color: THEME.GOLD_LIGHT,
            timer: 3.8,
            maxTimer: 3.8,
          };
          this.onCelebrationBurst?.(640, 320, THEME.GOLD_LIGHT);
        } else if (ev.type === 'substitution' && !this.isPrologueMode && ev.team === this.userSide) {
          if (st.minute >= 45 && this.v6Relics.has('super_bench')) {
            this.v6Tp += 1;
            this.cardBanner = {
              text: '⚡ 圣物《超级替补席》触发 · 下半场换人立即获得 +1 TP 并提速！',
              color: '#4ADE80',
              timer: 2.2,
            };
          }
        } else if (ev.type === 'shot') {
          this.pitchRipples.push({ x: ev.pos.x, y: ev.pos.y, color: '#FDE047', timer: 0.45, maxTimer: 0.45, maxR: 16 });
          this.onImpactCallback?.(2.0, 0.10);
        } else if (ev.type === 'miss' && (ev.text.includes('门柱') || ev.text.includes('横梁') || ev.text.includes('门框'))) {
          this.cardBanner = {
            text: `击中门框！${ev.playerName} (${ev.minute}') 险些破门`,
            color: '#FBBF24',
            timer: 2.0,
          };
        } else if (ev.type === 'save') {
          // V6 由引擎原子总线钩子统一处理门将扑救事件
          this.pitchRipples.push({ x: ev.pos.x, y: ev.pos.y, color: '#38BDF8', timer: 0.55, maxTimer: 0.55, maxR: 22 });
          this.onImpactCallback?.(3.2, 0.14);
          if (ev.level === 'important' || ev.level === 'critical' || (ev.xG ?? 0) >= 0.25 || ev.text.includes('神扑') || ev.text.includes('点球')) {
            this.goalBanner = {
              text: `神扑救险 · ${ev.playerName} (${ev.minute}')`,
              timer: 2.3,
              maxTimer: 2.3,
              team: ev.team,
              accent: '#38BDF8',
            };
          }
        } else if (ev.type === 'injury') {
          this.goalBanner = {
            text: `伤退离场 · ${ev.playerName} (${ev.minute}')`,
            timer: 2.5,
            maxTimer: 2.5,
            team: ev.team,
            accent: '#FBBF24',
          };
        } else if (ev.type === 'foul' || ev.type === 'yellow_card' || ev.type === 'red_card') {
          this.pitchRipples.push({
            x: ev.pos.x,
            y: ev.pos.y,
            color: ev.type === 'red_card' ? '#EF4444' : '#FBBF24',
            timer: 0.55,
            maxTimer: 0.55,
            maxR: 18,
          });
          if (ev.type === 'red_card') {
            this.onImpactCallback?.(4.5, 0.22);
            this.goalBanner = {
              text: `红牌罚下 · ${ev.playerName} (${ev.minute}')`,
              timer: 2.8,
              maxTimer: 2.8,
              team: ev.team,
              accent: '#F87171',
            };
          }
        }
        if (delta <= 6) {
          if (ev.type === 'goal') {
            SoundEngine.playGoalCheer();
            SoundEngine.pulseCrowd(1.0, 2.2);
            const goalVo =
              ev.narrativeTag === 'HATTRICK'
                ? 'vo_goal_hattrick'
                : ev.narrativeTag === 'LATE_WINNER'
                ? 'vo_goal_late'
                : ev.narrativeTag === 'BRACE'
                ? 'vo_goal_brace'
                : 'vo_goal';
            SoundEngine.playVoice(goalVo, 3500);
          } else if (ev.type === 'shot') {
            SoundEngine.playShot();
            SoundEngine.pulseCrowd(0.55, 0.9);
          } else if (ev.type === 'save') {
            SoundEngine.playSave();
            SoundEngine.pulseCrowd(0.7, 1.1);
            SoundEngine.playVoice('vo_save', 5000);
          } else if (ev.type === 'substitution') {
            SoundEngine.playSub();
          } else if ((ev.type === 'tackle' || ev.type === 'interception') && this.speed <= 4) {
            SoundEngine.playTackle();
          } else if (ev.type === 'foul') SoundEngine.playWhistle('foul');
          else if (ev.type === 'yellow_card') {
            SoundEngine.playCard();
            SoundEngine.playVoice('vo_foul_yellow', 6000);
          } else if (ev.type === 'red_card') {
            SoundEngine.playCard();
            SoundEngine.pulseCrowd(0.8, 1.4);
            SoundEngine.playVoice('vo_card_red', 4000);
          } else if (ev.type === 'kickoff') {
            SoundEngine.playWhistle('kickoff');
            SoundEngine.playVoice('vo_kickoff', 10000);
          } else if (ev.type === 'halftime') SoundEngine.playWhistle('halftime');
          else if (ev.type === 'fulltime') {
            SoundEngine.playWhistle('fulltime');
            SoundEngine.stopCrowdAmbience();
          }
        }
      }
      if (delta > 6 && st.phase === 'full_time') {
        SoundEngine.playWhistle('fulltime');
        SoundEngine.stopCrowdAmbience();
      }
      this.lastEventCount = st.events.length;
    }

    // 60fps 平滑插值
    const lerp = 0.30;
    for (const p of st.players) {
      const cur = this.renderPlayers.get(p.id) || { x: p.pos.x, y: p.pos.y };
      cur.x += (p.pos.x - cur.x) * lerp;
      cur.y += (p.pos.y - cur.y) * lerp;
      this.renderPlayers.set(p.id, cur);
    }
    this.renderBall.x += (st.ball.pos.x - this.renderBall.x) * 0.45;
    this.renderBall.y += (st.ball.pos.y - this.renderBall.y) * 0.45;
    this.renderBall.z += (st.ball.pos.z - this.renderBall.z) * 0.45;
    if (st.ball.mode === 'shot' || st.ball.mode === 'pass') {
      this.ballTrail.push({ x: this.renderBall.x, y: this.renderBall.y });
      if (this.ballTrail.length > 8) this.ballTrail.shift();
    } else if (this.ballTrail.length > 0) {
      this.ballTrail.shift();
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    league: LeagueManager,
    onMatchFinished: (result: MatchState) => void
  ): void {
    if (!this.engine) return;
    const st = this.engine.getState();

    const clubs = league.getState().clubs;
    const homeClub = clubs.find(c => c.name === st.homeName) || { id: 'club_star', primaryColor: THEME.RED, secondaryColor: '#FFFFFF' };
    const awayClub = clubs.find(c => c.name === st.awayName) || { id: 'club_iron', primaryColor: THEME.BLUE, secondaryColor: '#FFFFFF' };
    const { homeKit, awayKit } = resolveMatchKits(homeClub, awayClub);

    // 1. 顶部 PITCH PRINT 转播级记分牌（硬墨线框 + 暖纸中心比分牌 + 荧光绿分钟）
    drawChamferPanel(ctx, 16, 12, 1248, 60, 8, THEME.BG_DEEP, THEME.INK_LINE, 2.5);
    const phaseText =
      st.phase === 'first_half' ? '上半场' :
      st.phase === 'half_time' ? '中场休息' :
      st.phase === 'second_half' ? '下半场' : '全场结束';

    // 直播状态脉冲点
    ctx.save();
    const isLive = st.phase !== 'full_time' && !this.isPaused;
    ctx.fillStyle = st.phase === 'full_time' ? THEME.TX3 : this.isPaused ? THEME.BRASS : THEME.LIME;
    ctx.globalAlpha = isLive ? 0.6 + 0.4 * Math.sin(this.elapsedSec * 5) : 0.95;
    ctx.beginPath();
    ctx.arc(30, 42, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawText(ctx, `${phaseText}  ${st.minute}'`, 42, 42, { size: 15.5, bold: true, color: THEME.LIME, mono: true, rawSize: true });
    const wInfo = WEATHER_INFO[st.weather ?? 'sunny'];
    drawBadge(ctx, 164, 30, 70, 24, wInfo.label, THEME.BG_CARD_DARK, wInfo.color);

    // 统一电视转播角标（队色条 + 队徽 + 队名 + 暖纸大比分牌）
    drawRoundRect(ctx, 244, 18, 514, 48, 6, THEME.BG_PANEL, THEME.INK_LINE, 2);
    ctx.fillStyle = homeKit.primary;
    ctx.fillRect(247, 23, 5, 38);
    drawClubCrest(ctx, 268, 42, 14, homeClub);
    const homeLabel = fitText(ctx, st.homeName + (this.userSide === 'home' ? ' (我)' : ''), 144, 15, true, true);
    drawText(ctx, homeLabel, 430, 42, {
      size: 15,
      bold: true,
      align: 'right',
      color: this.userSide === 'home' ? THEME.LIME : THEME.TX1,
      rawSize: true,
    });

    const scorePop = this.goalScorePopTimer > 0 ? 1 + 0.14 * Math.sin((this.goalScorePopTimer / 0.65) * Math.PI) : 1;
    ctx.save();
    ctx.translate(501, 42);
    ctx.scale(scorePop, scorePop);
    ctx.translate(-501, -42);
    drawPrintCard(ctx, 439, 17, 124, 50, {
      paper: true,
      radius: 6,
      shadowOffset: 3,
      strokeColor: this.goalScorePopTimer > 0 ? THEME.VERMILION : THEME.INK_LINE,
      lineWidth: 2.5,
    });
    drawText(ctx, `${st.homeScore} : ${st.awayScore}`, 501, 42, {
      size: 32,
      bold: true,
      italic: true,
      align: 'center',
      color: this.goalScorePopTimer > 0 ? THEME.VERMILION : THEME.PAPER_INK,
      mono: true,
      rawSize: true,
    });
    ctx.restore();

    const awayLabel = fitText(ctx, st.awayName + (this.userSide === 'away' ? ' (我)' : ''), 142, 15, true, true);
    drawText(ctx, awayLabel, 574, 42, {
      size: 15,
      bold: true,
      align: 'left',
      color: this.userSide === 'away' ? THEME.LIME : THEME.TX1,
      rawSize: true,
    });
    drawClubCrest(ctx, 734, 42, 14, awayClub);
    ctx.fillStyle = awayKit.primary;
    ctx.fillRect(751, 23, 5, 38);

    drawButton(ctx, hits, 768, 20, 92, 44, SoundEngine.getAudioModeLabel(), () => {
      SoundEngine.cycleAudioMode();
    }, { variant: 'ghost', fontSize: 12.5, icon: SoundEngine.muted ? 'sound_off' : 'sound_on' });

    if (st.phase === 'full_time') {
      drawButton(ctx, hits, 1018, 20, 234, 44, this.isPrologueMode ? '捧起超级联赛冠军奖杯 ▶' : '比赛结束 · 进入复盘 ▶', () => {
        if (this.isPrologueMode) {
          this.prologueChampionModal = true;
          this.fullTimeDismissed = false;
          SoundEngine.playFanfare();
          this.onCelebrationBurst?.(640, 220, THEME.GOLD_LIGHT);
        } else {
          onMatchFinished(st);
        }
      }, { variant: 'gold', fontSize: 14 });
    } else {
      if (this.isPrologueMode) {
        drawButton(ctx, hits, 868, 20, 76, 44, this.isPaused ? '继续' : '暂停', () => {
          this.isPaused = !this.isPaused;
        }, { variant: this.isPaused ? 'lime' : 'ghost', fontSize: 13.5 });
        drawBadge(ctx, 954, 28, 158, 28, '2x 序章教学实况', THEME.BG_PITCH_ALT, THEME.LIME);
      } else {
        // 紧凑一体式播控胶囊（播放/暂停 | 倍速循环，热区 >= 44px）
        const capX = 872;
        const capY = 20;
        const capW = 176;
        const capH = 44;
        drawRoundRect(ctx, capX + 3, capY + 3, capW, capH, 8, THEME.HARD_SHADOW);
        drawRoundRect(ctx, capX, capY, capW, capH, 8, THEME.BG_CARD_DARK, THEME.INK_LINE, 2.5);
        const hovPause = hits.isHovered(capX, capY, 88, capH);
        const hovSpd = hits.isHovered(capX + 88, capY, 88, capH);
        drawText(ctx, this.isPaused ? '▶ 继续' : '⏸ 暂停', capX + 44, capY + 22, {
          size: 13,
          bold: true,
          color: this.isPaused ? THEME.LIME : hovPause ? THEME.TX1 : THEME.PAPER_CREAM,
          align: 'center',
          rawSize: true,
        });
        ctx.fillStyle = THEME.INK_LINE;
        ctx.fillRect(capX + 88, capY + 6, 2, capH - 12);
        drawText(ctx, `⏩ ${this.speed}x ▾`, capX + 132, capY + 22, {
          size: 13.5,
          bold: true,
          color: hovSpd ? THEME.TX1 : THEME.BRASS,
          align: 'center',
          mono: true,
          rawSize: true,
        });
        hits.addTouchTarget(capX, capY, 88, capH, () => {
          SoundEngine.playClick();
          this.isPaused = !this.isPaused;
        });
        hits.addTouchTarget(capX + 88, capY, 88, capH, () => {
          SoundEngine.playClick();
          const speeds = [1, 2, 4, 8];
          const curIdx = speeds.indexOf(this.speed);
          this.speed = speeds[(curIdx + 1) % speeds.length];
        });

        drawButton(ctx, hits, 1058, 20, 194, 44, '快速完赛', () => {
          this.engine!.simulateMatch();
        }, { variant: 'primary', icon: 'play', fontSize: 14 });
      }
    }

    // 2. 左侧文字直播（最新 8~10 条，>= 14px 正文，>= 22px 行高，零重叠）
    drawChamferPanel(ctx, 16, 84, 234, 622, 8, THEME.BG_DEEP, THEME.INK_LINE, 2.5);
    ctx.save();
    ctx.fillStyle = st.phase === 'full_time' ? THEME.TX3 : THEME.VERMILION;
    ctx.globalAlpha = st.phase === 'full_time' ? 0.65 : 0.65 + 0.35 * Math.sin(this.elapsedSec * 4.5);
    ctx.beginPath();
    ctx.arc(32, 107, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawText(ctx, '实时文字直播', 44, 107, { size: 15, bold: true, color: THEME.BRASS, rawSize: true });

    const events = st.events.filter(e => e.type !== 'pass').slice(-9).reverse();
    const commLineH = 22;
    let cy = 128;
    for (const ev of events) {
      const isGoal = ev.type === 'goal';
      const isSub = ev.type === 'substitution';
      const isRed = ev.type === 'red_card';
      const isYellow = ev.type === 'yellow_card';
      const isShot = ev.type === 'shot';
      const isSave = ev.type === 'save';
      const isMomentum = ev.narrativeTag === 'MOMENTUM';
      const isLull = ev.narrativeTag === 'LULL';
      const isHighlighted = isGoal || isRed || isYellow || isSub || isMomentum;

      const textCol =
        isGoal ? THEME.LIME :
        isRed ? '#FCA5A5' :
        isYellow ? '#FDE047' :
        isMomentum ? '#7DD3FC' :
        isSub ? THEME.LIME :
        isShot || isSave ? THEME.TX1 :
        isLull ? THEME.TX3 : THEME.TX2;

      const accentCol =
        isGoal ? THEME.BRASS :
        isRed ? THEME.VERMILION :
        isYellow ? '#FACC15' :
        isSub ? THEME.LIME :
        isMomentum ? '#38BDF8' :
        isShot ? '#FDE047' :
        isSave ? '#38BDF8' :
        isLull ? THEME.TX3 :
        ev.team === 'home' ? homeKit.primary : awayKit.primary;

      const wrapX = isHighlighted ? 70 : 58;
      const wrapW = isHighlighted ? 168 : 180;
      const lines = wrapTextLines(ctx, ev.text, wrapW, 14, isGoal || isMomentum, 3, true);
      const boxH = Math.max(32, lines.length * commLineH + 12);
      if (cy + boxH > 698) break;

      if (isGoal) {
        drawRoundRect(ctx, 22, cy, 222, boxH, 6, THEME.BG_PITCH_ALT, THEME.BRASS, 2);
        ctx.fillStyle = THEME.BRASS;
        ctx.fillRect(23, cy + 4, 4, boxH - 8);
      } else if (isRed || isYellow) {
        drawRoundRect(ctx, 22, cy, 222, boxH, 5, THEME.BG_CARD_DARK, accentCol, 1.5);
        ctx.fillStyle = accentCol;
        ctx.fillRect(23, cy + 4, 4, boxH - 8);
      } else if (isSub) {
        drawRoundRect(ctx, 22, cy, 222, boxH, 5, THEME.BG_CARD_DARK, THEME.LIME, 1.5);
        ctx.fillStyle = THEME.LIME;
        ctx.fillRect(23, cy + 4, 4, boxH - 8);
      } else if (isMomentum) {
        drawRoundRect(ctx, 22, cy, 222, boxH, 5, THEME.BG_CARD_DARK, '#38BDF8', 1.5);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(23, cy + 4, 4, boxH - 8);
      }

      drawText(ctx, `${ev.minute}'`, 29, cy + 14, {
        size: 12,
        bold: true,
        color: accentCol,
        mono: true,
        rawSize: true,
      });

      if (isGoal) {
        drawIcon(ctx, 'ball', 60, cy + 14, 12, THEME.BRASS);
      } else if (isRed || isYellow) {
        drawRoundRect(ctx, 55, cy + 7, 8, 12, 1.5, isRed ? THEME.VERMILION : '#FACC15', THEME.INK_LINE, 1);
      } else if (isSub) {
        drawIcon(ctx, 'refresh', 60, cy + 14, 12, THEME.LIME);
      } else if (isMomentum) {
        drawIcon(ctx, 'bolt', 60, cy + 14, 12, '#38BDF8');
      }

      ctx.font = `${isGoal || isMomentum ? 'bold ' : ''}14px ${THEME.FONT_FAMILY}`;
      ctx.fillStyle = textCol;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (let li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], wrapX, cy + 6 + li * commLineH);
      }

      cy += boxH + 6;
    }

    // 3. 中央 2D 球场（深松石草皮条纹 + 粉笔白线 + 磁性战术棋子）
    const PITCH_RECT = { x: 266, y: 84, w: 748, h: 454 };
    const toScreen = (px: number, py: number) => ({
      x: PITCH_RECT.x + (px / PITCH.LENGTH) * PITCH_RECT.w,
      y: PITCH_RECT.y + (py / PITCH.WIDTH) * PITCH_RECT.h,
    });
    const toPitch = (sx: number, sy: number) => ({
      x: Math.max(3, Math.min(PITCH.LENGTH - 3, ((sx - PITCH_RECT.x) / PITCH_RECT.w) * PITCH.LENGTH)),
      y: Math.max(3, Math.min(PITCH.WIDTH - 3, ((sy - PITCH_RECT.y) / PITCH_RECT.h) * PITCH.WIDTH)),
    });

    if (this.selectedPitchPlayerId && st.phase !== 'full_time') {
      hits.add(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h, () => {
        const pt = toPitch(hits.hoverX, hits.hoverY);
        const selP = st.players.find(pl => pl.id === this.selectedPitchPlayerId);
        if (selP && this.engine!.setPlayerPitchTarget(this.userSide, selP.id, pt.x, pt.y)) {
          this.cardBanner = {
            text: `站位微调 · ${selP.name} (${selP.role}) 移动至新战术位置`,
            color: '#38BDF8',
            timer: 1.8,
          };
          SoundEngine.playClick();
        }
        this.selectedPitchPlayerId = null;
      });
    }

    drawChamferPanel(ctx, PITCH_RECT.x - 8, PITCH_RECT.y - 6, PITCH_RECT.w + 16, PITCH_RECT.h + 12, 8, THEME.BG_DEEP, THEME.INK_LINE, 2.5);
    const sw = PITCH_RECT.w / 10;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? THEME.BG_PITCH : THEME.BG_PITCH_ALT;
      ctx.fillRect(PITCH_RECT.x + i * sw, PITCH_RECT.y, sw, PITCH_RECT.h);
    }
    const pitchHt = getHalftonePattern(ctx, true);
    if (pitchHt) {
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = pitchHt;
      ctx.fillRect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(244, 239, 228, 0.72)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
    ctx.beginPath();
    ctx.moveTo(PITCH_RECT.x + PITCH_RECT.w / 2, PITCH_RECT.y);
    ctx.lineTo(PITCH_RECT.x + PITCH_RECT.w / 2, PITCH_RECT.y + PITCH_RECT.h);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(PITCH_RECT.x + PITCH_RECT.w / 2, PITCH_RECT.y + PITCH_RECT.h / 2, (9.15 / PITCH.LENGTH) * PITCH_RECT.w, 0, Math.PI * 2);
    ctx.stroke();

    const boxW = (16.5 / PITCH.LENGTH) * PITCH_RECT.w;
    const boxH = (40.32 / PITCH.WIDTH) * PITCH_RECT.h;
    const sixW = (5.5 / PITCH.LENGTH) * PITCH_RECT.w;
    const sixH = (18.32 / PITCH.WIDTH) * PITCH_RECT.h;
    const goalH = (7.32 / PITCH.WIDTH) * PITCH_RECT.h;
    ctx.strokeRect(PITCH_RECT.x, PITCH_RECT.y + (PITCH_RECT.h - boxH) / 2, boxW, boxH);
    ctx.strokeRect(PITCH_RECT.x + PITCH_RECT.w - boxW, PITCH_RECT.y + (PITCH_RECT.h - boxH) / 2, boxW, boxH);
    ctx.strokeRect(PITCH_RECT.x, PITCH_RECT.y + (PITCH_RECT.h - sixH) / 2, sixW, sixH);
    ctx.strokeRect(PITCH_RECT.x + PITCH_RECT.w - sixW, PITCH_RECT.y + (PITCH_RECT.h - sixH) / 2, sixW, sixH);

    // 球门框与细球网纹理
    const goalTop = PITCH_RECT.y + (PITCH_RECT.h - goalH) / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(PITCH_RECT.x - 6, goalTop, 6, goalH);
    ctx.fillRect(PITCH_RECT.x + PITCH_RECT.w, goalTop, 6, goalH);
    ctx.strokeRect(PITCH_RECT.x - 6, goalTop, 6, goalH);
    ctx.strokeRect(PITCH_RECT.x + PITCH_RECT.w, goalTop, 6, goalH);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 0.7;
    for (let ny = goalTop + 4; ny < goalTop + goalH; ny += 5) {
      ctx.beginPath();
      ctx.moveTo(PITCH_RECT.x - 6, ny);
      ctx.lineTo(PITCH_RECT.x, ny);
      ctx.moveTo(PITCH_RECT.x + PITCH_RECT.w, ny);
      ctx.lineTo(PITCH_RECT.x + PITCH_RECT.w + 6, ny);
      ctx.stroke();
    }
    ctx.restore();

    if (this.goalFlashTimer > 0 && this.goalFlashSide) {
      const gx = this.goalFlashSide === 'left' ? PITCH_RECT.x - 3 : PITCH_RECT.x + PITCH_RECT.w + 3;
      const gy = PITCH_RECT.y + PITCH_RECT.h / 2;
      const p = 1 - this.goalFlashTimer / 1.4;
      const alpha = Math.max(0, 1 - p);
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(this.goalFlashSide === 'left' ? PITCH_RECT.x - 6 : PITCH_RECT.x + PITCH_RECT.w, gy - goalH / 2, 6, goalH);
      ctx.beginPath();
      ctx.arc(gx, gy, 12 + p * 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const rp of this.pitchRipples) {
      const sp = toScreen(rp.x, rp.y);
      const prog = 1 - rp.timer / rp.maxTimer;
      const alpha = Math.max(0, 1 - prog);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = rp.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4 + prog * rp.maxR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const penSpotL = PITCH_RECT.x + (11 / PITCH.LENGTH) * PITCH_RECT.w;
    const penSpotR = PITCH_RECT.x + PITCH_RECT.w - (11 / PITCH.LENGTH) * PITCH_RECT.w;
    const arcR = (9.15 / PITCH.LENGTH) * PITCH_RECT.w;
    ctx.beginPath();
    ctx.arc(penSpotL, PITCH_RECT.y + PITCH_RECT.h / 2, arcR, -0.92, 0.92);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(penSpotR, PITCH_RECT.y + PITCH_RECT.h / 2, arcR, Math.PI - 0.92, Math.PI + 0.92);
    ctx.stroke();

    // 足球轨迹残影
    if (this.ballTrail.length > 1) {
      for (let ti = 0; ti < this.ballTrail.length; ti++) {
        const tp = toScreen(this.ballTrail[ti].x, this.ballTrail[ti].y);
        const alpha = ((ti + 1) / this.ballTrail.length) * 0.35;
        ctx.fillStyle = `rgba(250, 204, 21, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 2 + (ti / this.ballTrail.length) * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const pickGkColors = (homeHex: string, awayHex: string): [string, string] => {
      const candidates = ['#FACC15', '#E2E8F0', '#A855F7', '#EC4899', '#14B8A6'];
      const safe = candidates.filter(c => colorDistance(c, homeHex) > 160 && colorDistance(c, awayHex) > 160);
      if (safe.length >= 2) return [safe[0], safe[1]];
      const ranked = [...candidates].sort(
        (a, b) => Math.min(colorDistance(b, homeHex), colorDistance(b, awayHex)) - Math.min(colorDistance(a, homeHex), colorDistance(a, awayHex))
      );
      return [ranked[0], ranked[1] ?? ranked[0]];
    };
    const [homeGkColor, awayGkColor] = pickGkColors(homeKit.primary, awayKit.primary);

    // 战术切换幽灵站位环与虚线位移指引（1.6s 淡出）
    if (this.tacticGhostTimer > 0) {
      const alpha = Math.min(1, this.tacticGhostTimer / 0.8) * 0.65;
      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      for (const p of st.players) {
        if (p.team !== this.userSide || p.redCard) continue;
        const target = this.tacticGhostTargets.get(p.id);
        if (!target) continue;
        const rp = this.renderPlayers.get(p.id) || p.pos;
        const sp = toScreen(rp.x, rp.y);
        const tp = toScreen(target.x, target.y);
        if (Math.hypot(tp.x - sp.x, tp.y - sp.y) > 8) {
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(tp.x, tp.y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // V6 2D 球场三区战术光幕预览 & 2秒拍板光幕+阵型线箭头（紧贴草皮在圆点下方）
    if (!this.isPrologueMode) {
      const uDir = this.userSide === 'home' ? st.homeAttackDir : (st.homeAttackDir === 1 ? -1 : 1);
      const getZoneRect = (z: 'ATT' | 'MID' | 'DEF') => {
        const thirdW = PITCH_RECT.w / 3;
        if (z === 'MID') return { x: PITCH_RECT.x + thirdW, w: thirdW };
        const isRight = (z === 'ATT' && uDir === 1) || (z === 'DEF' && uDir === -1);
        return { x: isRight ? PITCH_RECT.x + thirdW * 2 : PITCH_RECT.x, w: thirdW };
      };
      if (this.v6HoveredZone) {
        const zr = getZoneRect(this.v6HoveredZone);
        const hCol = this.v6HoveredZone === 'ATT' ? 'rgba(244,63,94,0.16)' : this.v6HoveredZone === 'MID' ? 'rgba(56,189,248,0.16)' : 'rgba(34,197,94,0.16)';
        const bCol = this.v6HoveredZone === 'ATT' ? '#F43F5E' : this.v6HoveredZone === 'MID' ? '#38BDF8' : '#22C55E';
        ctx.save();
        ctx.fillStyle = hCol;
        ctx.fillRect(zr.x, PITCH_RECT.y, zr.w, PITCH_RECT.h);
        ctx.strokeStyle = bCol;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(zr.x + 2, PITCH_RECT.y + 2, zr.w - 4, PITCH_RECT.h - 4);
        ctx.restore();
      }
      for (const cur of this.v6ZoneCurtains) {
        const zr = getZoneRect(cur.zone);
        const p = Math.max(0, Math.min(1, cur.timer / cur.maxTimer));
        const baseCol = cur.tendency === 'ATK' ? '#F43F5E' : '#22C55E';
        ctx.save();
        ctx.globalAlpha = Math.min(1, p * 1.3);
        ctx.fillStyle = cur.tendency === 'ATK' ? 'rgba(244, 63, 94, 0.22)' : 'rgba(34, 197, 94, 0.22)';
        ctx.fillRect(zr.x, PITCH_RECT.y, zr.w, PITCH_RECT.h);
        ctx.strokeStyle = baseCol;
        ctx.lineWidth = 2.6;
        ctx.strokeRect(zr.x + 2, PITCH_RECT.y + 2, zr.w - 4, PITCH_RECT.h - 4);
        if (cur.lineShift && cur.lineShift !== 0) {
          const arrowDir = cur.lineShift > 0 ? uDir : -uDir;
          const lineX = zr.x + zr.w * 0.5;
          ctx.strokeStyle = '#FEF08A';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(lineX, PITCH_RECT.y + 30);
          ctx.lineTo(lineX, PITCH_RECT.y + PITCH_RECT.h - 30);
          ctx.stroke();
          ctx.setLineDash([]);
          for (let ay = PITCH_RECT.y + 90; ay <= PITCH_RECT.y + PITCH_RECT.h - 90; ay += 95) {
            const tipX = lineX + arrowDir * 28;
            ctx.beginPath();
            ctx.moveTo(lineX, ay);
            ctx.lineTo(tipX, ay);
            ctx.lineTo(tipX - arrowDir * 8, ay - 6);
            ctx.moveTo(tipX, ay);
            ctx.lineTo(tipX - arrowDir * 8, ay + 6);
            ctx.stroke();
          }
        }
        if (cur.dualOverlap) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.4;
          [PITCH_RECT.y + 36, PITCH_RECT.y + PITCH_RECT.h - 36].forEach(wy => {
            const sx = zr.x + (uDir === 1 ? 16 : zr.w - 16);
            const ex = zr.x + (uDir === 1 ? zr.w - 16 : 16);
            ctx.beginPath();
            ctx.moveTo(sx, wy);
            ctx.lineTo(ex, wy);
            ctx.stroke();
          });
        }
        const curBadgeW = Math.min(zr.w - 10, 236);
        drawBadge(ctx, zr.x + (zr.w - curBadgeW) / 2, PITCH_RECT.y + 38, curBadgeW, 26, cur.label, THEME.BG_DEEP, THEME.LIME);
        ctx.restore();
      }
    }

    // 球场实景战术投影 VFX（始终置于 FM 球员圆点下方，绝不遮挡圆点）
    for (const vfx of this.pitchTacticalVfx) {
      const p = Math.max(0, Math.min(1, vfx.timer / vfx.maxTimer));
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 1.45);
      if (vfx.kind === 'triangle' && vfx.points && vfx.points.length >= 2) {
        const sPts = vfx.points.map(pt => toScreen(pt.x, pt.y));
        ctx.strokeStyle = vfx.color;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([8, 5]);
        ctx.lineDashOffset = -(1 - p) * 60;
        ctx.beginPath();
        ctx.moveTo(sPts[0].x, sPts[0].y);
        for (let i = 1; i < sPts.length; i++) ctx.lineTo(sPts[i].x, sPts[i].y);
        if (sPts.length >= 3) ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
        ctx.fill();
      } else if (vfx.kind === 'press_ring') {
        const sc = toScreen(vfx.x, vfx.y);
        const rad = 18 + p * 54;
        ctx.strokeStyle = vfx.color;
        ctx.lineWidth = 2.6;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, Math.max(12, rad * 0.56), 0, Math.PI * 2);
        ctx.stroke();
      } else if (vfx.kind === 'def_wall') {
        const sc = toScreen(vfx.x, PITCH.HALF_Y);
        const wallH = 110;
        ctx.strokeStyle = THEME.INK_LINE;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y - wallH / 2);
        ctx.lineTo(sc.x, sc.y + wallH / 2);
        ctx.stroke();
        ctx.strokeStyle = vfx.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y - wallH / 2);
        ctx.lineTo(sc.x, sc.y + wallH / 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
        ctx.fillRect(sc.x - 10, sc.y - wallH / 2, 20, wallH);
      } else if (vfx.kind === 'ult_wave') {
        const sc = toScreen(vfx.x, vfx.y);
        const waveR = 30 + (1 - p) * 260;
        ctx.strokeStyle = vfx.color;
        ctx.lineWidth = 3 * p;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, waveR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    const activeUserBuffs = (st.activeBuffs || []).filter(b => b.team === this.userSide);

    // 标准 FM 圆点双通道渲染：Pass 1 画圆点/光环/体能条，Pass 2 做位置标签碰撞避让
    const pitchEntries = st.players
      .filter(p => !p.redCard)
      .map(p => {
        const rp = this.renderPlayers.get(p.id) || p.pos;
        return { p, sp: toScreen(rp.x, rp.y) };
      });

    const drawOrder = [...pitchEntries].sort((a, b) => {
      const pa = (this.selectedPitchPlayerId === a.p.id ? 2 : 0) + (a.p.hasBall ? 1 : 0);
      const pb = (this.selectedPitchPlayerId === b.p.id ? 2 : 0) + (b.p.hasBall ? 1 : 0);
      if (pa !== pb) return pa - pb;
      return a.sp.y - b.sp.y;
    });

    for (const { p, sp } of drawOrder) {
      const isPitchSel = this.selectedPitchPlayerId === p.id;
      if (isPitchSel) {
        ctx.save();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (p.team === this.userSide && activeUserBuffs.length > 0) {
        const pLine = this.getLineOfRole(p.role);
        const buffed = activeUserBuffs.some(b => {
          const tl = b.effect.targetLine ?? 'ALL';
          return tl === 'ALL' || tl === pLine;
        });
        if (buffed) {
          ctx.save();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 14.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (p.hasBall) {
        const pulseR = 14 + Math.sin(this.elapsedSec * 7) * 1.4;
        const halo = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 20);
        halo.addColorStop(0, 'rgba(250, 204, 21, 0.34)');
        halo.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = THEME.GOLD_LIGHT;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      const teamKit = p.team === 'home' ? homeKit : awayKit;
      const kitColor = p.role === 'GK' ? (p.team === 'home' ? homeGkColor : awayGkColor) : teamKit.primary;
      const trimColor = p.role === 'GK' ? teamKit.primary : teamKit.secondary;
      const isLightKit = isLightHex(kitColor);
      const dotR = p.role === 'GK' ? 14.5 : 13.5;

      // 磁性战术棋子硬偏移阴影
      ctx.fillStyle = THEME.HARD_SHADOW;
      ctx.beginPath();
      ctx.arc(sp.x + 3, sp.y + 3, dotR, 0, Math.PI * 2);
      ctx.fill();

      // 磁性棋子主体 + 粗墨线描边 + 内部队色圈
      ctx.fillStyle = kitColor;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, dotR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, dotR - 2.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sp.x, sp.y, dotR, 0, Math.PI * 2);
      ctx.strokeStyle = THEME.INK_LINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 朝向小三角与高速冲刺尾迹
      const speedMag = Math.hypot(p.vel.x, p.vel.y);
      const ang = speedMag > 0.4
        ? Math.atan2(p.vel.y, p.vel.x)
        : Math.atan2(st.ball.pos.y - p.pos.y, st.ball.pos.x - p.pos.x);
      if (speedMag > 4.2) {
        ctx.save();
        ctx.strokeStyle = trimColor;
        ctx.globalAlpha = Math.min(0.45, (speedMag - 4.2) * 0.12);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sp.x - Math.cos(ang) * (dotR + 2), sp.y - Math.sin(ang) * (dotR + 2));
        ctx.lineTo(sp.x - Math.cos(ang) * (dotR + 10), sp.y - Math.sin(ang) * (dotR + 10));
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.fillStyle = trimColor;
      ctx.beginPath();
      ctx.moveTo(sp.x + Math.cos(ang) * (dotR + 4), sp.y + Math.sin(ang) * (dotR + 4));
      ctx.lineTo(sp.x + Math.cos(ang + 0.35) * (dotR - 0.5), sp.y + Math.sin(ang + 0.35) * (dotR - 0.5));
      ctx.lineTo(sp.x + Math.cos(ang - 0.35) * (dotR - 0.5), sp.y + Math.sin(ang - 0.35) * (dotR - 0.5));
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      drawText(ctx, String(p.shirtNumber), sp.x, sp.y + 0.5, {
        size: 12,
        bold: true,
        align: 'center',
        color: isLightKit ? '#141916' : '#F4EFE4',
        rawSize: true,
      });

      if (p.yellowCards > 0) {
        drawRoundRect(ctx, sp.x + 9, sp.y - 14, 7, 10, 1.5, '#FACC15', THEME.INK_LINE, 1);
      }
      if (p.isCaptain) {
        drawRoundRect(ctx, sp.x + 8, sp.y + 3, 14, 14, 3, THEME.BRASS, THEME.INK_LINE, 1);
        drawText(ctx, 'C', sp.x + 15, sp.y + 10, { size: 12, bold: true, color: THEME.PAPER_INK, align: 'center', rawSize: true });
      }
      if (p.subbedIn) {
        drawText(ctx, '↑', sp.x - 14, sp.y - 9, { size: 12, bold: true, color: THEME.LIME, align: 'center', rawSize: true });
      }

      const fitRatio = Math.max(0, Math.min(1, p.fitness / 100));
      const fitColor = fitRatio > 0.65 ? THEME.LIME : fitRatio > 0.42 ? THEME.BRASS : THEME.VERMILION;
      const barW = 26;
      const barH = 4;
      const barY = sp.y - 20;
      ctx.fillStyle = THEME.HARD_SHADOW;
      ctx.fillRect(sp.x - barW / 2, barY, barW, barH);
      ctx.fillStyle = fitColor;
      ctx.fillRect(sp.x - barW / 2, barY, barW * fitRatio, barH);

      if (p.team === this.userSide && st.phase !== 'full_time') {
        hits.addTouchTarget(sp.x - 22, sp.y - 22, 44, 44, () => {
          SoundEngine.playClick();
          if (!this.selectedPitchPlayerId) {
            this.selectedPitchPlayerId = p.id;
          } else if (this.selectedPitchPlayerId === p.id) {
            this.selectedPitchPlayerId = null;
          } else {
            const prevP = st.players.find(x => x.id === this.selectedPitchPlayerId);
            if (prevP && this.engine!.swapPlayerSlots(this.userSide, prevP.id, p.id)) {
              this.cardBanner = {
                text: `场上换位 · ${prevP.name} ⇄ ${p.name} (${p.role} / ${prevP.role})`,
                color: '#38BDF8',
                timer: 2.0,
              };
            }
            this.selectedPitchPlayerId = null;
          }
        });
      }
    }

    // Pass 2：位置标签碰撞避让（>= 12px 可读字号）
    type LabelBox = { x: number; y: number; w: number; h: number };
    const rectsOverlap = (a: LabelBox, b: LabelBox) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const occHalfW = 16;
    const occupiedRects: LabelBox[] = pitchEntries.map(({ sp }) => ({
      x: sp.x - occHalfW,
      y: sp.y - 21,
      w: occHalfW * 2,
      h: 36,
    }));
    const labelOrder = [...pitchEntries].sort((a, b) => {
      const rank = (pl: typeof a.p) =>
        this.selectedPitchPlayerId === pl.id ? 3 : pl.hasBall ? 2 : pl.team === this.userSide ? 1 : 0;
      return rank(b.p) - rank(a.p);
    });
    const minLX = PITCH_RECT.x + 2;
    const maxLX = PITCH_RECT.x + PITCH_RECT.w - 2;
    const minLY = PITCH_RECT.y + 2;
    const maxLY = PITCH_RECT.y + PITCH_RECT.h - 2;
    for (const { p, sp } of labelOrder) {
      ctx.font = `bold 12px ${THEME.FONT_FAMILY}`;
      const lw = Math.max(30, Math.ceil(ctx.measureText(p.role).width) + 10);
      const lh = 17;
      const candidates = [
        { cx: sp.x, cy: sp.y + 23 },
        { cx: sp.x, cy: sp.y - 28 },
        { cx: sp.x + 18 + lw / 2, cy: sp.y + 1 },
        { cx: sp.x - 18 - lw / 2, cy: sp.y + 1 },
      ];
      let chosen: LabelBox | null = null;
      let chosenCenter: { cx: number; cy: number } | null = null;
      for (const cand of candidates) {
        const box: LabelBox = { x: cand.cx - lw / 2, y: cand.cy - lh / 2, w: lw, h: lh };
        if (box.x < minLX || box.x + box.w > maxLX || box.y < minLY || box.y + box.h > maxLY) continue;
        if (!occupiedRects.some(o => rectsOverlap(box, o))) {
          chosen = box;
          chosenCenter = cand;
          break;
        }
      }
      const isPriority = p.hasBall || this.selectedPitchPlayerId === p.id;
      if (!chosen && isPriority) {
        const cx = Math.max(minLX + lw / 2, Math.min(maxLX - lw / 2, sp.x));
        const cy = Math.max(minLY + lh / 2, Math.min(maxLY - lh / 2, sp.y + 20));
        chosen = { x: cx - lw / 2, y: cy - lh / 2, w: lw, h: lh };
        chosenCenter = { cx, cy };
      }
      if (chosen && chosenCenter) {
        occupiedRects.push(chosen);
        drawRoundRect(ctx, chosen.x, chosen.y, chosen.w, chosen.h, 3, THEME.BG_DEEP, THEME.INK_LINE, 1);
        drawText(ctx, p.role, chosenCenter.cx, chosenCenter.cy, {
          size: 12,
          rawSize: true,
          bold: isPriority,
          color: p.customOffset ? '#38BDF8' : p.hasBall ? THEME.LIME : THEME.PAPER_CREAM,
          align: 'center',
        });
      }
    }

    // 脉冲波纹与头顶属性飘字渲染
    for (const pulse of this.playerPulses) {
      const rp = this.renderPlayers.get(pulse.playerId);
      if (!rp) continue;
      const sp = toScreen(rp.x, rp.y);
      const progress = 1 - pulse.timer / pulse.maxTimer;
      const radius = 12 + progress * 18;
      const alpha = Math.max(0, 1 - progress);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = pulse.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const ft of this.playerFloatTags) {
      const rp = this.renderPlayers.get(ft.playerId);
      if (!rp) continue;
      const sp = toScreen(rp.x, rp.y);
      const progress = 1 - ft.timer / ft.maxTimer;
      const liftY = progress * 22;
      const alpha = Math.max(0, Math.min(1, ft.timer / 0.5));
      ctx.save();
      ctx.globalAlpha = alpha;
      drawText(ctx, ft.text, sp.x, sp.y - 24 - liftY, {
        size: 12,
        bold: true,
        color: ft.color,
        align: 'center',
        rawSize: true,
      });
      ctx.restore();
    }

    if (this.selectedPitchPlayerId) {
      const selP = st.players.find(pl => pl.id === this.selectedPitchPlayerId);
      if (selP) {
        drawRoundRect(ctx, 380, 506, 520, 28, 6, THEME.BG_DEEP, '#38BDF8', 1.5);
        drawText(ctx, `已选【${selP.name} · ${selP.role}】点击队友立即换位，或点击球场微调站位 (ESC取消)`, 640, 520, {
          size: 12,
          bold: true,
          color: '#7DD3FC',
          align: 'center',
          rawSize: true,
        });
      }
    }

    // 序章场上叙事微标记（#19 陈小宇抽筋警告 + #10 林锋老队长金色光环）
    if (this.isPrologueMode) {
      for (const { p, sp } of pitchEntries) {
        if (p.team === this.userSide && p.id === 'prologue_st_19' && p.fitness <= 35) {
          const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSec * 9);
          ctx.save();
          ctx.globalAlpha = pulse;
          drawBadge(ctx, sp.x - 18, sp.y - 34, 36, 14, '抽筋!', '#7F1D1D', '#FCA5A5');
          ctx.restore();
        } else if (p.id === 'prologue_vet_10' || p.name.includes('梅利纳') || p.name.includes('林锋')) {
          ctx.save();
          const auraR = 17 + Math.sin(this.elapsedSec * 5) * 2.5;
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.82)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, auraR, 0, Math.PI * 2);
          ctx.stroke();
          drawBadge(ctx, sp.x - 26, sp.y - 34, 52, 14, '#10 梅利纳', '#78350F', THEME.GOLD_LIGHT);
          ctx.restore();
        }
      }
    }

    // 足球与 Z 阴影
    const sb = toScreen(this.renderBall.x, this.renderBall.y);
    const zLift = Math.max(0, Math.min(18, this.renderBall.z * 3.5));
    const ballRadius = Math.max(2, 5 + zLift * 0.12);
    const shadowAlpha = Math.max(0.18, 0.48 - zLift * 0.015);
    const shadowRx = 5.5 + zLift * 0.12;
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(sb.x, sb.y + 2, shadowRx, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(sb.x, sb.y - zLift, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sb.x - ballRadius * 0.3, sb.y - zLift - ballRadius * 0.3, Math.max(1.1, ballRadius * 0.28), 0, Math.PI * 2);
    ctx.fill();

    // 2D 球场转播级天气光学氛围层（序章强制雨夜决战氛围）
    const weatherKind = this.isPrologueMode ? 'rain' : (st.weather ?? 'sunny');
    const wt = this.elapsedSec;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
    ctx.clip();
    if (weatherKind === 'rain') {
      const rVig = ctx.createRadialGradient(
        PITCH_RECT.x + PITCH_RECT.w / 2,
        PITCH_RECT.y + PITCH_RECT.h / 2,
        PITCH_RECT.w * 0.25,
        PITCH_RECT.x + PITCH_RECT.w / 2,
        PITCH_RECT.y + PITCH_RECT.h / 2,
        PITCH_RECT.w * 0.72
      );
      rVig.addColorStop(0, 'rgba(15, 23, 42, 0.08)');
      rVig.addColorStop(1, 'rgba(8, 15, 32, 0.28)');
      ctx.fillStyle = rVig;
      ctx.fillRect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.14)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 28; i++) {
        const rx = PITCH_RECT.x + ((i * 89 + wt * 460) % (PITCH_RECT.w + 80)) - 40;
        const ry = PITCH_RECT.y + ((i * 67 + wt * 920) % (PITCH_RECT.h + 80)) - 40;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 18, ry + 42);
        ctx.stroke();
      }
    } else if (weatherKind === 'wind') {
      for (let i = 0; i < 3; i++) {
        const bandX = PITCH_RECT.x + ((wt * (240 + i * 55) + i * 280) % (PITCH_RECT.w + 360)) - 220;
        const bandY = PITCH_RECT.y + 70 + i * 150;
        const wGrad = ctx.createLinearGradient(bandX, bandY, bandX + 220, bandY);
        wGrad.addColorStop(0, 'rgba(226, 232, 240, 0)');
        wGrad.addColorStop(0.5, 'rgba(226, 232, 240, 0.055)');
        wGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
        ctx.fillStyle = wGrad;
        ctx.fillRect(bandX, bandY, 220, 36);
      }
    } else if (weatherKind === 'heat') {
      const pulse = 0.12 + 0.04 * Math.sin(wt * 1.6);
      const hGrad = ctx.createRadialGradient(
        PITCH_RECT.x + PITCH_RECT.w / 2,
        PITCH_RECT.y + PITCH_RECT.h / 2,
        PITCH_RECT.w * 0.28,
        PITCH_RECT.x + PITCH_RECT.w / 2,
        PITCH_RECT.y + PITCH_RECT.h / 2,
        PITCH_RECT.w * 0.72
      );
      hGrad.addColorStop(0, 'rgba(251, 191, 36, 0.02)');
      hGrad.addColorStop(1, `rgba(245, 158, 11, ${pulse.toFixed(2)})`);
      ctx.fillStyle = hGrad;
      ctx.fillRect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
    } else {
      const sGrad = ctx.createLinearGradient(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.x + PITCH_RECT.w * 0.6, PITCH_RECT.y + PITCH_RECT.h);
      sGrad.addColorStop(0, 'rgba(254, 240, 138, 0.09)');
      sGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.03)');
      sGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = sGrad;
      ctx.fillRect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
    }
    ctx.restore();

    // 重要事件贴顶半透明转播条（S级：进球/红牌/神扑/伤退；A级：指挥卡/门框/特质觉醒/主动技结算）
    const drawTranslucentBroadcastBar = (x: number, y: number, w: number, h: number, accent: string, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const bgGrad = ctx.createLinearGradient(x, y, x + w, y);
      bgGrad.addColorStop(0, 'rgba(10, 26, 20, 0.16)');
      bgGrad.addColorStop(0.18, 'rgba(10, 26, 20, 0.90)');
      bgGrad.addColorStop(0.82, 'rgba(10, 26, 20, 0.90)');
      bgGrad.addColorStop(1, 'rgba(10, 26, 20, 0.16)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(x, y, w, h);

      const lineGrad = ctx.createLinearGradient(x, y, x + w, y);
      lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
      lineGrad.addColorStop(0.15, accent);
      lineGrad.addColorStop(0.85, accent);
      lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.stroke();
      ctx.restore();
    };

    if (!this.tacticalModalOpen && st.phase !== 'full_time') {
      if (this.goalBanner) {
        const gb = this.goalBanner;
        const age = gb.maxTimer - gb.timer;
        const slide = age < 0.20 ? (1 - Math.pow(1 - age / 0.20, 3)) : 1;
        const fade = Math.min(1, gb.timer / 0.35, age / 0.15);
        const bx = 370;
        const by = 78 - (1 - slide) * 12;
        const bw = 540;
        const bh = 40;
        const actorClub = gb.team === 'home' ? homeClub : awayClub;

        drawTranslucentBroadcastBar(bx, by, bw, bh, gb.accent, fade);
        ctx.save();
        ctx.globalAlpha = fade;
        drawClubCrest(ctx, bx + 42, by + bh / 2, 13, actorClub);
        const hasSubTag = !!gb.subTag;
        const textX = hasSubTag ? bx + bw / 2 - 42 : 646;
        drawText(ctx, gb.text, textX, by + bh / 2, {
          size: 16,
          bold: true,
          italic: true,
          color: gb.accent === '#FACC15' ? '#FEF08A' : gb.accent,
          align: 'center',
        });
        if (gb.subTag) {
          const tagBg = gb.subTag.includes('破绽') ? '#14532D' : '#78350F';
          const tagCol = gb.subTag.includes('破绽') ? '#4ADE80' : '#FEF08A';
          drawBadge(ctx, bx + bw - 148, by + 9, 128, 22, gb.subTag, tagBg, tagCol);
        }
        ctx.restore();
      } else if (this.cardBanner) {
        const fade = Math.min(1, this.cardBanner.timer / 0.3);
        drawTranslucentBroadcastBar(380, 80, 520, 32, this.cardBanner.color, fade);
        ctx.save();
        ctx.globalAlpha = fade;
        drawText(ctx, this.cardBanner.text, 640, 96, {
          size: 12.5,
          bold: true,
          color: this.cardBanner.color,
          align: 'center',
        });
        ctx.restore();
      } else if (st.skillResolution) {
        const sr = st.skillResolution;
        const col = sr.isPositive ? THEME.GREEN : THEME.GOLD_LIGHT;
        drawTranslucentBroadcastBar(340, 80, 600, 32, col, 0.95);
        drawText(ctx, `⚡ 【${sr.skillName}】${sr.outcomeText}`, 640, 96, { size: 12.5, bold: true, color: col, align: 'center' });
      }
    }

    // 序章 0.25x 子弹时间英雄聚光灯（暗角聚焦 #10 梅利纳）
    if (this.isPrologueMode && st.activeSkillPrompt && st.phase !== 'full_time') {
      const vet = st.players.find(p => p.team === this.userSide && p.shirtNumber === 10)
        ?? st.players.find(p => p.team === this.userSide && p.hasBall);
      if (vet) {
        const vp = this.renderPlayers.get(vet.id) ?? vet.pos;
        const vs = toScreen(vp.x, vp.y);
        ctx.save();
        ctx.beginPath();
        ctx.rect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
        ctx.clip();
        const spot = ctx.createRadialGradient(vs.x, vs.y, 18, vs.x, vs.y, 155);
        spot.addColorStop(0, 'rgba(250, 204, 21, 0.16)');
        spot.addColorStop(0.42, 'rgba(8, 13, 24, 0.08)');
        spot.addColorStop(1, 'rgba(4, 8, 18, 0.56)');
        ctx.fillStyle = spot;
        ctx.fillRect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
        ctx.restore();
      }
    }

    // 序章电影级场边剧情字幕条（不与 Goal/Card 横幅同时堆叠）
    if (this.isPrologueMode && this.storyBeatBanner && !this.goalBanner && !this.cardBanner && st.phase !== 'full_time') {
      const sbData = this.storyBeatBanner;
      const age = sbData.maxTimer - sbData.timer;
      const alpha = Math.min(1, age / 0.25, sbData.timer / 0.35);
      const by = 80;
      const bx = 294;
      const bw = 692;
      const bh = 48;
      const spkImg = (sbData.speaker.includes('梅利纳') || sbData.speaker.includes('林锋')) ? AssetLoader.get('portrait_linfeng') : sbData.speaker.includes('陈小宇') ? AssetLoader.get('portrait_xiaoyu') : null;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      drawChamferPanel(ctx, bx, by, bw, bh, 10, 'rgba(7, 11, 22, 0.94)', sbData.color, 1.8, sbData.color);
      let contentX = bx + 12;
      if (spkImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bx + 8, by + 6, 36, 36, 6);
        ctx.clip();
        ctx.drawImage(spkImg, bx + 8, by + 6, 36, 36);
        ctx.restore();
        contentX = bx + 52;
      }
      drawBadge(ctx, contentX, by + 13, 128, 22, sbData.speaker, '#0F172A', sbData.color);
      drawText(ctx, fitText(ctx, sbData.text, bx + bw - contentX - 144, 12.5, true), contentX + 136, by + 24, {
        size: 12.5,
        bold: true,
        color: THEME.TX1,
      });
      ctx.restore();
    }

    // 中场休息浮层提示
    if (st.phase === 'half_time' && this.isPaused) {
      drawRoundRect(ctx, 390, 240, 500, 152, 12, 'rgba(8,12,20,0.94)', THEME.GOLD, 1.5);
      drawText(ctx, `中场休息 · ${st.homeScore} : ${st.awayScore}`, 640, 274, {
        size: 20,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
      const tiredPlayer = st.players
        .filter(p => p.team === this.userSide && !p.redCard && p.role !== 'GK')
        .sort((a, b) => a.fitness - b.fitness)[0];
      const availSubs = (this.userSide === 'home' ? st.homeSubs : st.awaySubs).filter(s => s.role !== 'GK');
      const subsUsedNow = this.userSide === 'home' ? st.homeSubsUsed : st.awaySubsUsed;
      drawText(
        ctx,
        tiredPlayer
          ? `体能最低：${tiredPlayer.name} (${Math.round(tiredPlayer.fitness)}%)，可快捷换人或调整战术`
          : '可在右侧切至“临场换人”或调整下方阵型战术，准备好后开始下半场',
        640,
        306,
        { size: 12, color: THEME.TX2, align: 'center' }
      );
      if (tiredPlayer && availSubs.length > 0 && subsUsedNow < 5) {
        const bestSub = availSubs[0];
        drawButton(ctx, hits, 416, 338, 240, 36, `换下 ${tiredPlayer.name.slice(0, 4)} → ${bestSub.name.slice(0, 4)}`, () => {
          this.engine!.substitute(this.userSide, tiredPlayer.id, bestSub.id);
        }, { variant: 'primary', fontSize: 12, icon: 'refresh' });
        drawButton(ctx, hits, 672, 338, 192, 36, '开始下半场 ▶', () => {
          this.isPaused = false;
        }, { variant: 'gold', fontSize: 13 });
      } else {
        drawButton(ctx, hits, 550, 338, 180, 36, '开始下半场 ▶', () => {
          this.isPaused = false;
        }, { variant: 'gold' });
      }
    }

    // 场上生效中的三区双刃剑指令胶囊（与进球/拍板/绝技横幅互斥，杜绝双条重叠）
    if (!this.isPrologueMode && this.v6ActiveCapsules.length > 0 && !this.goalBanner && !this.cardBanner && !st.skillResolution) {
      this.v6ActiveCapsules.slice(0, 2).forEach((cap, ci) => {
        const bx = 274 + ci * 368;
        const rem = Math.max(1, cap.endMinute - st.minute);
        const zCol = cap.zone === 'ATT' ? THEME.VERMILION : cap.zone === 'MID' ? THEME.COBALT : THEME.LIME;
        drawRoundRect(ctx, bx, 89, 360, 26, 6, THEME.BG_DEEP, THEME.INK_LINE, 1.6);
        ctx.fillStyle = zCol;
        ctx.fillRect(bx + 2, 92, 4, 20);
        drawText(ctx, `${cap.name} ${rem}'`, bx + 12, 102, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
        drawText(ctx, fitText(ctx, `+${cap.benefit}`, 120, 12), bx + 114, 102, { size: 12, bold: true, color: THEME.LIME });
        drawText(ctx, fitText(ctx, `-${cap.risk}`, 112, 12), bx + 240, 102, { size: 12, color: '#FCA5A5' });
      });
    } else if (!this.goalBanner && !this.cardBanner && !st.skillResolution) {
      const userBuffs = (st.activeBuffs || []).filter(b => b.team === this.userSide);
      userBuffs.slice(0, 2).forEach((bf, bi) => {
        const bx = 278 + bi * 194;
        drawRoundRect(ctx, bx, 92, 186, 24, 5, 'rgba(14,22,40,0.85)', THEME.GOLD_LIGHT);
        drawIcon(ctx, 'card', bx + 14, 104, 12, THEME.GOLD_LIGHT);
        drawText(ctx, `${bf.name} (${Math.max(1, bf.endMinute - st.minute)}')`, bx + 100, 104, {
          size: 12,
          bold: true,
          color: THEME.GOLD_LIGHT,
          align: 'center',
        });
      });
    }

    // 右上球场边角：已装备赛季圣物模切贴纸条 & 传奇融合威能 HUD（有顶部转播条时自动避让）
    if (!this.isPrologueMode && this.v6Relics.size > 0 && !this.goalBanner && !this.cardBanner && !st.skillResolution) {
      const activeRelicList = Array.from(this.v6Relics).slice(0, 5);
      const rStartX = 1004 - activeRelicList.length * 32;
      activeRelicList.forEach((rId, ri) => {
        const rArt = getRelicAssetId(rId);
        const rImg = rArt ? AssetLoader.get(rArt) : null;
        if (rImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.translate(rStartX + ri * 32 + 14, 102);
          ctx.rotate((ri % 2 === 0 ? -2 : 2) * Math.PI / 180);
          ctx.drawImage(rImg, -14, -14, 28, 28);
          ctx.restore();
        }
      });
    }
    const aspCount = st.activeAspects?.length ?? 0;
    const aspStacks = st.aspectStacks;
    if (!this.goalBanner && !this.cardBanner && !st.skillResolution && (aspCount > 0 || (aspStacks?.shieldCharges ?? 0) > 0 || (aspStacks?.counterCharges ?? 0) > 0)) {
      let ax = 672;
      if (aspCount > 0) {
        drawBadge(ctx, ax, 92, 92, 24, `★ 威能 ×${aspCount}`, 'rgba(120, 53, 15, 0.88)', THEME.GOLD_LIGHT);
        ax += 98;
      }
      if ((aspStacks?.shieldCharges ?? 0) > 0) {
        drawBadge(ctx, ax, 92, 92, 24, `护盾 ×${aspStacks!.shieldCharges}`, 'rgba(6, 78, 59, 0.90)', '#34D399');
        ax += 98;
      }
      if ((aspStacks?.counterCharges ?? 0) > 0) {
        drawBadge(ctx, ax, 92, 92, 24, `反击 ×${aspStacks!.counterCharges}`, 'rgba(124, 45, 18, 0.90)', '#FB923C');
      }
    }

    // 主动技释放 Cut-In VFX 暗黑转播横幅（碳纤斜切框 + 左侧雕纹底座 + 中央高对比文字区）
    if (this.skillCutIn) {
      const cut = this.skillCutIn;
      const enterP = Math.min(1, (cut.maxTimer - cut.timer) / 0.18);
      const fadeOutP = Math.min(1, cut.timer / 0.28);
      const alpha = Math.max(0, Math.min(1, easeOutCubic(enterP) * fadeOutP));
      const slideX = (1 - easeOutCubic(enterP)) * -90;
      const cx0 = 270 + slideX;
      const cy0 = 182;
      const cw0 = 740;
      const ch0 = 86;
      const c1 = cut.theme === 'att' ? '#EF4444' : cut.theme === 'def' ? '#10B981' : '#F59E0B';
      const c2 = cut.theme === 'att' ? '#F59E0B' : cut.theme === 'def' ? '#22D3EE' : '#FDE047';
      const cutArtId = this.isPrologueMode
        ? 'fx_prologue_last_dance'
        : cut.theme === 'att' ? 'fx_skill_cutin_att' : cut.theme === 'def' ? 'fx_skill_cutin_def' : 'fx_skill_cutin_ult';
      const cutArt = AssetLoader.get(cutArtId) ?? AssetLoader.get('fx_skill_cutin_ult');
      ctx.save();
      ctx.globalAlpha = alpha;
      drawChamferPanel(ctx, cx0, cy0, cw0, ch0, 10, 'rgba(8, 12, 22, 0.94)', c1, 1.8, c2);

      if (cutArt && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx0 + 2, cy0 + 2, cw0 - 4, ch0 - 4);
        ctx.clip();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = alpha * 0.84;
        const sweepOff = ((cut.maxTimer - cut.timer) * 44) % 56;
        ctx.drawImage(cutArt, cx0 - 20 + sweepOff, cy0 - 18, cw0 + 40, ch0 + 36);
        ctx.restore();
      }

      // 中央深暗文字可读底带，保证高速斜切光芒下文字依然锐利
      const centerGrad = ctx.createLinearGradient(cx0, cy0, cx0 + cw0, cy0);
      centerGrad.addColorStop(0, 'rgba(8, 12, 22, 0.08)');
      centerGrad.addColorStop(0.24, 'rgba(8, 12, 22, 0.72)');
      centerGrad.addColorStop(0.76, 'rgba(8, 12, 22, 0.72)');
      centerGrad.addColorStop(1, 'rgba(8, 12, 22, 0.08)');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(cx0 + 4, cy0 + 4, cw0 - 8, ch0 - 8);

      // 上下金属导轨
      const lineGrad = ctx.createLinearGradient(cx0, cy0, cx0 + cw0, cy0);
      lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
      lineGrad.addColorStop(0.18, c1);
      lineGrad.addColorStop(0.82, c2);
      lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx0, cy0 + 2);
      ctx.lineTo(cx0 + cw0, cy0 + 2);
      ctx.moveTo(cx0, cy0 + ch0 - 2);
      ctx.lineTo(cx0 + cw0, cy0 + ch0 - 2);
      ctx.stroke();

      // 左侧高清雕纹圆形徽章槽位
      const badgeCx = cx0 + 54;
      const badgeCy = cy0 + ch0 / 2;
      drawRoundRect(ctx, badgeCx - 27, badgeCy - 27, 54, 54, 27, '#090E1C', c2, 2);
      drawRoundRect(ctx, badgeCx - 22, badgeCy - 22, 44, 44, 22, 'rgba(15, 23, 42, 0.9)', c1, 1);
      drawSkillGlyph(ctx, cut.glyphKind, badgeCx, badgeCy, 34, '#FEF08A', c2);

      // 文字主体区（居中偏向右侧避开左徽章）
      const textCx = cx0 + cw0 / 2 + 18;
      drawText(ctx, `${cut.name}   R${cut.rank}${cut.mutationLabel ? ` · ${cut.mutationLabel}` : ''}`, textCx, cy0 + 29, {
        size: 19.5,
        bold: true,
        italic: true,
        color: c2,
        align: 'center',
      });
      drawText(ctx, cut.instantSummary, textCx, cy0 + 58, {
        size: 13.5,
        bold: true,
        color: '#FEF08A',
        align: 'center',
      });
      ctx.restore();
    }

    // 0.25x 子弹时间主动技免费触发横幅
    if (st.activeSkillPrompt && st.phase !== 'full_time') {
      const prm = st.activeSkillPrompt;
      const remTicks = Math.max(0, prm.expiresTick - st.tick);
      const ratio = Math.max(0.05, Math.min(1, remTicks / 12));
      const bx = 328;
      const by = 462;
      const bw = 624;
      const bh = 80;
      if (this.isPrologueMode) {
        const skTip = '90\' 平局拿不到冠军！点击【立即释放 (F)】轰出绝杀球，4:3 逆转捧杯！';
        drawChamferPanel(ctx, 326, 404, 628, 48, 8, 'rgba(8, 15, 32, 0.96)', THEME.GOLD_LIGHT, 2);
        drawBadge(ctx, 338, 417, 84, 22, '绝杀时刻', '#78350F', THEME.GOLD_LIGHT);
        drawText(ctx, skTip, 432, 428, { size: 12, bold: true, color: '#FEF08A' });
      }
      drawPrintCard(ctx, bx, by, bw, bh, { paper: false, radius: 10, shadowOffset: 5, topBandColor: prm.isCardBoosted ? THEME.BRASS : THEME.COBALT, strokeColor: THEME.INK_LINE, lineWidth: 2.5 });
      const prmSkImg = AssetLoader.get(getSkillAssetId(prm.skillId));
      const skOffX = prmSkImg ? 56 : 0;
      if (prmSkImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.translate(bx + 36, by + 38);
        ctx.rotate(-2 * Math.PI / 180);
        ctx.drawImage(prmSkImg, -26, -26, 52, 52);
        ctx.restore();
      }
      drawBadge(ctx, bx + 12 + skOffX, by + 10, 94, 20, '0.25x 子弹时间', THEME.BG_DEEP, THEME.LIME);
      let tagX = bx + 112 + skOffX;
      drawBadge(ctx, tagX, by + 10, 34, 20, `R${prm.effectiveRank ?? 1}`, THEME.BG_PANEL, THEME.GOLD_LIGHT);
      tagX += 40;
      if (prm.mutationLabel) {
        drawBadge(ctx, tagX, by + 10, 86, 20, prm.mutationLabel.slice(0, 7), '#065F46', '#6EE7B7');
        tagX += 92;
      } else {
        drawBadge(ctx, tagX, by + 10, 54, 20, '免费释放', '#14532D', THEME.LIME);
        tagX += 60;
      }
      if (prm.isCardBoosted) {
        drawBadge(ctx, tagX, by + 10, 78, 20, '基因过载!', '#78350F', THEME.GOLD_LIGHT);
        tagX += 84;
      }
      const maxNameW = Math.max(60, bx + bw - 204 - tagX);
      drawText(ctx, fitText(ctx, prm.name, maxNameW, 14, true), tagX, by + 20, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
      drawText(ctx, fitText(ctx, `瞬发效果：${prm.instantLabel ?? prm.situationLabel}`, bw - 216 - skOffX, 12, true), bx + 14 + skOffX, by + 40, { size: 12, bold: true, color: THEME.PAPER_CREAM });
      drawText(ctx, fitText(ctx, `${prm.situationLabel} · ${prm.powerLabel}`, bw - 216 - skOffX, 12, false), bx + 14 + skOffX, by + 56, { size: 12, color: THEME.TX2 });

      drawRoundRect(ctx, bx + 14, by + 69, bw - 28, 4, 2, THEME.BG_DEEP);
      drawRoundRect(ctx, bx + 14, by + 69, Math.round((bw - 28) * ratio), 4, 2, prm.isCardBoosted ? THEME.BRASS : THEME.LIME);

      drawButton(ctx, hits, bx + bw - 196, by + 18, 122, 38, '立即释放 (F)', () => {
        this.activatePromptSkill();
      }, { variant: 'gold', fontSize: 12, icon: 'bolt' });
      drawButton(ctx, hits, bx + bw - 68, by + 18, 54, 38, '跳过', () => {
        this.engine!.dismissActiveSkillPrompt();
      }, { variant: 'ghost', fontSize: 12 });
    }

    // 4. 底部栏 (y: 548..706, h: 158)：PITCH PRINT 战术预置区 + 扇形暖纸手牌槽
    const leftBottomW = this.isPrologueMode ? 342 : 218;
    drawChamferPanel(ctx, 266, 548, leftBottomW, 158, 8, THEME.BG_DEEP, THEME.INK_LINE, 2.5);
    const curForm = this.userSide === 'home' ? st.homeFormation : st.awayFormation;
    const curStyle = this.userSide === 'home' ? st.homeStyle : st.awayStyle;
    if (this.isPrologueMode) {
      drawBadge(ctx, 278, 560, 86, 22, '决战目标', THEME.BG_PITCH_ALT, THEME.BRASS);
      drawText(ctx, `${curForm} · ${TACTICAL_PRESETS[curStyle].name}`, 596, 571, { size: 12, color: THEME.LIME, align: 'right', rawSize: true });
      drawText(ctx, '唯有赢下今晚决战，才能捧起超级联赛冠军奖杯', 278, 602, { size: 13, bold: true, color: THEME.TX1, rawSize: true });
      const stageHint = st.homeScore < 1
        ? '观察右侧手牌时机 · 抓准空当打响反攻'
        : st.awayScore >= 3 && st.homeScore < 2
        ? '1:3 绝境！准备打出【绝地总攻】搏命一击'
        : st.homeScore === 2
        ? '留意 #19 陈小宇体能 · 随时准备换上老队长'
        : st.homeScore === 3
        ? '3:3 平局无法夺冠！等待最后绝杀机会'
        : '保持领先优势，守住冠军奖杯！';
      drawRoundRect(ctx, 278, 628, 318, 56, 6, THEME.BG_CARD_DARK, THEME.INK_LINE, 2);
      drawText(ctx, stageHint, 437, 656, { size: 13, bold: true, color: THEME.BRASS, align: 'center', rawSize: true });
    } else {
      const presetHdr = fitText(ctx, `${curForm}·${TACTICAL_PRESETS[curStyle].name}`, 118, 12.5, true, true);
      drawText(ctx, presetHdr, 276, 566, { size: 12.5, rawSize: true, bold: true, color: THEME.BRASS });
      if (st.phase !== 'full_time') {
        drawButton(ctx, hits, 400, 552, 78, 34, '微调', () => {
          this.openTacticalModal(st);
        }, { variant: 'primary', fontSize: 12, icon: 'gear' });
      }

      this.matchPresets.slice(0, 4).forEach((pr, pi) => {
        const col = pi % 2;
        const row = Math.floor(pi / 2);
        const bx = 274 + col * 102;
        const by = 594 + row * 54;
        const isAct = curForm === pr.formation && curStyle === pr.style;
        const label = `${pi + 1}.${pr.name.slice(0, 3)}`;
        drawButton(ctx, hits, bx, by, 98, 46, label, () => {
          this.engine!.setTactics(this.userSide, pr.formation, pr.style);
          this.triggerTacticsFeedback(pr.formation, pr.style);
          this.cardBanner = { text: `预案切换 · ${pr.name} (${pr.formation} · ${TACTICAL_PRESETS[pr.style].name})`, color: '#38BDF8', timer: 2.0 };
        }, { active: isAct, variant: isAct ? 'primary' : 'ghost', fontSize: 12.5 });
      });
    }

    const prologueTut = this.isPrologueMode ? this.engine.getPrologueTutorialState() : null;
    const targetPrologueCardId = prologueTut?.waitingForCard === 1
      ? 'prologue_card_wing_stance'
      : prologueTut?.waitingForCard === 2
      ? 'prologue_card_wing_combo'
      : null;
    const firstPlayableCard = targetPrologueCardId
      ? this.handCards.find(c => c.id === targetPrologueCardId && !this.usedCardIds.has(c.id)) ?? null
      : null;
    const firstPlayableCardId = firstPlayableCard?.id ?? null;
    if (prologueTut?.waitingForCard && st.phase !== 'full_time') {
      const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSec * 6);
      const cardBadge = prologueTut.waitingForCard === 1 ? '场外指挥' : '绝境反扑';
      drawChamferPanel(ctx, 326, 444, 628, 52, 10, 'rgba(8, 15, 32, 0.96)', THEME.GOLD_LIGHT, 2.2);
      drawBadge(ctx, 340, 459, 86, 22, cardBadge, '#78350F', THEME.GOLD_LIGHT);
      const tipMsg = prologueTut.waitingForCard === 1
        ? `0:1 落后！点击下方【${firstPlayableCard?.name ?? '拉开宽度'}】撕开防线！`
        : `1:3 陷入绝境！打出【${firstPlayableCard?.name ?? '边路强突造角'}】搏命反扑！`;
      drawText(ctx, tipMsg, 438, 470, { size: 12.5, bold: true, color: '#FEF08A' });
      ctx.save();
      ctx.globalAlpha = pulse;
      const waitHint = this.prologueWaitTimer >= 25
        ? '⏱ 比赛正等待你出牌：请点击下方闪烁的金色手牌继续'
        : '▼ 直接点击下方高亮进攻手牌即可打出';
      drawText(ctx, waitHint, 715, 550, { size: 12, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
      ctx.restore();
    }

    // 竖版实体教练手牌槽：正式比赛采用 V6 四赛段 暖纸扇形手牌 + 两段式防误触拍桌出牌
    this.v6HoveredZone = null;
    this.v6HoveringCard = false;
    const cmdBackImg = AssetLoader.get('command_card_back');
    const handBoxX = this.isPrologueMode ? 616 : 492;
    const handBoxW = this.isPrologueMode ? 398 : 522;
    drawChamferPanel(ctx, handBoxX, 548, handBoxW, 158, 8, THEME.BG_DEEP, THEME.INK_LINE, 2.5);
    const curStance = st.teamStance?.[this.userSide] ?? curStyle;
    if (!this.isPrologueMode) {
      const curSeg = this.v6CurrentSegment;
      const segInfo = V6_SEGMENTS.find(s => s.key === curSeg) ?? V6_SEGMENTS[0];
      const cpCards = this.v6Checkpoints[curSeg] ?? [];
      const maxPlays = this.v6MaxPlaysPerSegment + this.v6BonusPlayCap;

      // 顶部四赛段进度胶囊 + 实时 TP 水晶数（加宽防 71'-90' 截断）
      V6_SEGMENTS.forEach((seg, si) => {
        const isCur = seg.key === curSeg;
        const isPast = this.v6TriggeredCheckpoints.has(seg.key) && !isCur;
        const sx = 498 + si * 62;
        const segTxt = seg.shortLabel.replace('+', '');
        drawBadge(
          ctx,
          sx,
          554,
          59,
          22,
          segTxt,
          isCur ? THEME.BRASS : isPast ? THEME.BG_CARD_DARK : THEME.BG_PANEL,
          isCur ? THEME.PAPER_INK : isPast ? THEME.TX3 : THEME.TX2
        );
      });
      drawText(ctx, `TP ${this.v6Tp} · 本段${this.v6CheckpointPlayedCount}/${maxPlays}`, 752, 565, {
        size: 13,
        rawSize: true,
        bold: true,
        color: this.v6Tp > 0 ? THEME.LIME : THEME.TX2,
        mono: true,
      });
      if (this.v6HasEmergencyCall && !this.v6EmergencyUsed && st.phase !== 'full_time') {
        drawButton(ctx, hits, 916, 551, 90, 28, '爆发+2TP', () => {
          this.v6EmergencyUsed = true;
          this.v6Tp += 2;
          this.v6BonusPlayCap += 1;
          SoundEngine.playRewardChime();
          this.cardBanner = {
            text: `⚡ 宗师印【应急拍板】发动 · 立即补充 +2 TP 且本段可多拍 1 张牌！`,
            color: THEME.BRASS,
            timer: 2.5,
          };
        }, { variant: 'gold', fontSize: 12 });
      }

      let hoverV6: { entry: V6CompiledDirectiveEntry; x: number; y: number; effCost: number; canPlay: boolean } | null = null;
      const fanAngles = [-2.2, -0.7, 0.7, 2.2];
      const fanArcY = [3, 0, 0, 3];
      cpCards.slice(0, 4).forEach((entry, ci) => {
        const { def } = entry;
        const effCost = this.getEffectiveV6CardCost(entry);
        const cx = 500 + ci * 128;
        const cy = 582 + (fanArcY[ci] ?? 0);
        const cw = 120;
        const ch = 118;
        const used = this.v6CheckpointUsedIds.has(def.id);
        const playCapFull = this.v6CheckpointPlayedCount >= maxPlays;
        const canPlay = !used && !playCapFull && st.phase !== 'full_time' && this.v6Tp >= effCost;
        const isSel = this.selectedV6CardId === def.id && canPlay;
        const isHov = hits.isHovered(cx, cy - 24, cw, ch + 24);
        if (isSel || isHov) {
          this.v6HoveredZone = def.zone;
          if (!used && st.phase !== 'full_time') this.v6HoveringCard = true;
          hoverV6 = { entry, x: cx, y: cy, effCost, canPlay };
        }
        const zCol = def.zone === 'ATT' ? THEME.VERMILION : def.zone === 'MID' ? THEME.COBALT : '#15803D';
        const liftY = isSel ? -24 : isHov && canPlay ? -10 : isHov ? -4 : 0;
        const cyL = cy + liftY;
        const isSignature = def.source === 'fusion' || def.source === 'formation';

        ctx.save();
        const tiltDeg = isSel ? 0 : (fanAngles[ci] ?? 0);
        ctx.translate(cx + cw / 2, cyL + ch / 2);
        ctx.rotate((tiltDeg * Math.PI) / 180);
        ctx.translate(-(cx + cw / 2), -(cyL + ch / 2));

        if (used) {
          drawPrintCard(ctx, cx, cyL, cw, ch, { paper: false, radius: 7, shadowOffset: 2, strokeColor: THEME.INK_LINE, lineWidth: 2 });
        } else {
          drawPrintCard(ctx, cx, cyL, cw, ch, {
            paper: true,
            topBandColor: isSignature ? THEME.BRASS : zCol,
            radius: 7,
            shadowOffset: isSel ? 6 : 4,
            strokeColor: isSel ? THEME.LIME : THEME.INK_LINE,
            lineWidth: isSel ? 3 : 2.5,
          });
          if (isSignature) {
            ctx.fillStyle = 'rgba(216, 168, 66, 0.22)';
            ctx.fillRect(cx + 3, cyL + 7, cw - 6, ch - 10);
          }
        }

        // 已拍板卡片压暗底层内容，确保橡胶印章清晰利落不发糊
        ctx.save();
        if (used) ctx.globalAlpha = 0.24;
        const isDisc = effCost < def.tpCost;
        drawBadge(
          ctx,
          cx + 6,
          cyL + 10,
          52,
          20,
          `${def.zone === 'ATT' ? '前' : def.zone === 'MID' ? '中' : '后'}·${def.tendency === 'ATK' ? '攻' : '守'}`,
          used ? THEME.BG_DEEP : THEME.BG_PANEL,
          used ? THEME.TX3 : THEME.LIME
        );
        drawBadge(
          ctx,
          cx + cw - 48,
          cyL + 10,
          42,
          20,
          `${effCost}TP`,
          used ? THEME.BG_DEEP : isDisc ? '#15803D' : canPlay ? THEME.VERMILION : THEME.PAPER_WARM,
          used ? THEME.TX3 : canPlay ? THEME.PAPER_CREAM : THEME.PAPER_MUTED
        );

        // 嵌入 16 张临场指令方形漫画剪报画窗（1.5px #111412 细墨线框，完整方形裁切不遮挡标题与 TP 角标）
        const dirArtImg = AssetLoader.get(getDirectiveAssetId({ source: def.source, style: def.style, system: def.defenseSystem, tendency: def.tendency, zone: def.zone }));
        if (dirArtImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cx + 6, cyL + 34, 34, 34, 3);
          ctx.clip();
          ctx.drawImage(dirArtImg, cx + 6, cyL + 34, 34, 34);
          ctx.restore();
          drawRoundRect(ctx, cx + 6, cyL + 34, 34, 34, 3, undefined, THEME.INK_LINE, 1.5);
        }
        // 卡片主标题（>= 12.5px 墨字，避开方形画窗）
        const dirTitleX = dirArtImg ? cx + 44 : cx + 8;
        const dirTitleW = dirArtImg ? cw - 50 : cw - 16;
        drawWrappedText(ctx, def.name, dirTitleX, cyL + 34, dirTitleW, 17, {
          size: 12.5,
          rawSize: true,
          bold: true,
          color: used ? THEME.TX3 : THEME.PAPER_INK,
          maxLines: 2,
        });

        // 卫星星级 / 暗金词条标识
        const satCount = entry.satellites.length;
        const enchInfo = entry.enchant ? V6_DIRECTIVE_ENCHANTS[entry.enchant] : null;
        if (enchInfo) {
          drawBadge(ctx, cx + 8, cyL + 74, cw - 16, 19, `✦${enchInfo.shortTag}`, THEME.VIOLET, THEME.PAPER_CREAM);
        } else if (satCount > 0) {
          drawBadge(ctx, cx + 10, cyL + 74, cw - 20, 19, `${'★'.repeat(satCount)}${entry.isOverclocked ? '超频' : '改造'}`, THEME.BRASS, THEME.PAPER_INK);
        } else {
          const routeTag = def.source === 'fusion' ? '招牌王牌' : def.source === 'formation' ? '阵型专属' : def.route === 'gamble' ? '高赔豪赌' : '稳健指令';
          drawText(ctx, routeTag, cx + cw / 2, cyL + 83, {
            size: 12,
            rawSize: true,
            bold: true,
            color: used ? THEME.TX3 : THEME.PAPER_MUTED,
            align: 'center',
          });
        }

        // 底部清晰操作态提示
        const statusTxt = used
          ? '本段已执行'
          : isSel
          ? '再点拍板!'
          : playCapFull
          ? '本段满额'
          : canPlay
          ? '点选预览'
          : `需 ${effCost} TP`;
        drawText(ctx, statusTxt, cx + cw / 2, cyL + 104, {
          size: 12,
          rawSize: true,
          bold: true,
          color: used ? THEME.TX3 : isSel ? THEME.VERMILION : canPlay ? THEME.PAPER_INK : THEME.PAPER_MUTED,
          align: 'center',
        });
        ctx.restore();

        if (used) {
          const stTf = this.lastStampedV6Id === def.id ? this.cardPlayStamp.getTransform() : { scale: 1, alpha: 0.96 };
          ctx.save();
          ctx.globalAlpha = Math.max(0.2, stTf.alpha);
          drawStamp(ctx, '已拍板', cx + cw / 2, cyL + ch / 2 + 4, THEME.VERMILION, -10, stTf.scale * 0.88);
          ctx.restore();
        }
        ctx.restore();

        if (canPlay) {
          hits.addTouchTarget(cx, cy - 24, cw, ch + 24, () => {
            if (this.selectedV6CardId === def.id) {
              this.playV6Directive(entry);
            } else {
              SoundEngine.playClick();
              this.selectedV6CardId = def.id;
            }
          });
        }
      });

      // 抽出预览大号高清战术详情浮窗（暖纸卡 + 确认拍板按钮）
      if (hoverV6) {
        const { entry, x, effCost, canPlay } = hoverV6 as {
          entry: V6CompiledDirectiveEntry;
          x: number;
          y: number;
          effCost: number;
          canPlay: boolean;
        };
        const { def, effect } = entry;
        const zCol = def.zone === 'ATT' ? THEME.VERMILION : def.zone === 'MID' ? THEME.COBALT : '#15803D';
        const fw = 388;
        const fh = entry.enchant || entry.satellites.length > 0 ? 142 : 122;
        const tx = Math.min(626, Math.max(492, x - 90));
        const ty = 542 - fh;
        drawPrintCard(ctx, tx, ty, fw, fh, { paper: true, topBandColor: zCol, radius: 8, shadowOffset: 5 });
        drawBadge(
          ctx,
          tx + 12,
          ty + 14,
          72,
          22,
          `${def.zone === 'ATT' ? '前场' : def.zone === 'MID' ? '中场' : '后场'}·${def.tendency === 'ATK' ? '攻' : '守'}`,
          THEME.BG_PANEL,
          THEME.LIME
        );
        drawText(ctx, `《${def.name}》`, tx + 90, ty + 25, { size: 15, bold: true, color: THEME.PAPER_INK, rawSize: true });
        drawText(ctx, `${effCost}TP · ${effect.durationMinutes}'`, tx + fw - 14, ty + 25, {
          size: 13,
          bold: true,
          color: effCost < def.tpCost ? '#15803D' : THEME.PAPER_INK,
          align: 'right',
          mono: true,
          rawSize: true,
        });
        const hoverDirImg = AssetLoader.get(getDirectiveAssetId({ source: def.source, style: def.style, system: def.defenseSystem, tendency: def.tendency, zone: def.zone }));
        const hOx = hoverDirImg ? 64 : 0;
        if (hoverDirImg && typeof ctx.drawImage === 'function') {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(tx + 12, ty + 42, 54, 54, 4);
          ctx.clip();
          ctx.drawImage(hoverDirImg, tx + 12, ty + 42, 54, 54);
          ctx.restore();
          drawRoundRect(ctx, tx + 12, ty + 42, 54, 54, 4, undefined, THEME.INK_LINE, 1.5);
        }
        drawText(ctx, fitText(ctx, `收益：${def.benefitSummary}`, fw - 28 - hOx, 13.5, true, true), tx + 14 + hOx, ty + 54, {
          size: 13.5,
          bold: true,
          color: '#15803D',
          rawSize: true,
        });
        const riskZeroed = entry.enchant === 'zero_risk' || (entry.satellites.includes('A') && def.satellites.A.removeRisk);
        drawText(
          ctx,
          fitText(ctx, riskZeroed ? '代价：已被卫星/词条免疫清除' : `代价：${def.riskSummary}`, fw - 28 - hOx, 13, false, true),
          tx + 14 + hOx,
          ty + 78,
          { size: 13, color: riskZeroed ? THEME.COBALT : THEME.VERMILION, rawSize: true }
        );
        if (entry.enchant || entry.satellites.length > 0) {
          const enchTxt = entry.enchant ? `✦${V6_DIRECTIVE_ENCHANTS[entry.enchant].name}` : '';
          const satTxt = entry.satellites.length > 0 ? `★卫星${entry.satellites.join('+')}` : '';
          drawText(ctx, fitText(ctx, [enchTxt, satTxt].filter(Boolean).join(' · '), fw - 140, 12, true, true), tx + 14, ty + 102, {
            size: 12,
            bold: true,
            color: THEME.VIOLET,
            rawSize: true,
          });
        }
        if (this.selectedV6CardId === def.id && canPlay) {
          drawButton(ctx, hits, tx + fw - 118, ty + fh - 46, 106, 38, '确认拍板', () => {
            this.playV6Directive(entry);
          }, { variant: 'primary', fontSize: 13 });
        } else {
          drawText(ctx, `${segInfo.title} · 0.25x 预览中`, tx + fw - 14, ty + fh - 16, {
            size: 12,
            color: THEME.PAPER_MUTED,
            align: 'right',
            rawSize: true,
          });
        }
      }
    } else {
    if (this.isPrologueMode) {
      drawText(ctx, '教练手牌 · 悬停预览', 628, 574, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    } else {
      drawBadge(ctx, 624, 565, 76, 18, `态势:${STANCE_LABELS[curStance]}`, '#0C4A6E', '#7DD3FC');
      drawText(ctx, `牌库 ${this.drawPile.length} · 弃 ${this.discardPile.length}`, 706, 574, { size: 12, bold: true, color: '#94A3B8', mono: true });
    }
    if (this.nextCardDiscount > 0) {
      drawBadge(ctx, 792, 565, 68, 18, `下卡-${this.nextCardDiscount}费`, '#065F46', '#6EE7B7');
    }
    // 能量宝石显示 (最多5格)
    for (let ei = 0; ei < 5; ei++) {
      const lit = ei < this.tacticalEnergy;
      ctx.fillStyle = lit ? THEME.GOLD_LIGHT : '#1E293B';
      ctx.beginPath();
      ctx.arc(876 + ei * 14, 574, 4.2, 0, Math.PI * 2);
      ctx.fill();
      if (lit) {
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    drawText(ctx, `能量 ${this.tacticalEnergy}`, 1004, 574, { size: 12, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });

    let previewCard: { card: CommandCard; x: number; y: number; canPlay: boolean; effCost: number } | null = null;
    if (this.handCards.length === 0 && !this.isPrologueMode) {
      drawText(ctx, '手牌已打空 · 每 15 分钟/中场/关键事件自动补牌', 815, 646, { size: 12, color: THEME.TX3, align: 'center' });
    }
    this.handCards.slice(0, 4).forEach((card, ci) => {
      const cx = 625 + ci * 97;
      const cy = 596;
      const cw = 90;
      const ch = 100;
      const used = this.usedCardIds.has(card.id);
      const scoutRes = this.isScoutResonantCard(card);
      const evalCost = evaluateCardEffectiveCost(card, st, this.userSide, scoutRes);
      const effCost = Math.max(0, evalCost.cost - this.nextCardDiscount);
      const isComboReady = !!card.comboRule && (card.comboRule.anyStance || curStance === card.comboRule.requiresStance || !!card.affix?.anyStanceCombo);
      const isTimingZero = !used && evalCost.discounted && effCost === 0;
      const isTutTarget = firstPlayableCardId === card.id;
      const prologueLocked = this.isPrologueMode && !used && !isTutTarget;
      const canPlay = !used && st.phase !== 'full_time' && this.tacticalEnergy >= effCost && !prologueLocked;
      const isSelected = this.selectedCardId === card.id;
      const isHovered = hits.isHovered(cx, cy - 8, cw, ch + 8);
      if (isSelected || (isHovered && !used && !this.selectedCardId && !st.activeSkillPrompt)) {
        previewCard = { card, x: cx, y: cy, canPlay, effCost };
      }
      const lift = isSelected || isTutTarget ? -10 : (isHovered && canPlay) ? -8 : (isHovered && !used) ? -4 : 0;
      const cyL = cy + lift;
      const tier = card.tier ?? (card.isBase ? 0 : 1);
      const borderCol = isSelected
        ? THEME.GREEN
        : isTutTarget
        ? '#FACC15'
        : used || !canPlay
        ? THEME.BORDER
        : isTimingZero
        ? '#4ADE80'
        : isComboReady
        ? '#C084FC'
        : card.affix?.kind === 'negative'
        ? THEME.RED_LIGHT
        : tier >= 3
        ? THEME.GOLD_LIGHT
        : tier === 2
        ? '#C084FC'
        : tier === 1
        ? '#38BDF8'
        : '#94A3B8';
      const cardBg = used ? '#0B111E' : isSelected ? '#172E4E' : (isHovered && canPlay) ? '#1B2D4F' : THEME.BG_CARD;

      ctx.save();
      drawPrintCard(ctx, cx, cyL, cw, ch, {
        paper: !used,
        topBandColor: isSelected ? THEME.LIME : borderCol,
        radius: 7,
        shadowOffset: isSelected ? 5 : 3,
        strokeColor: isSelected ? THEME.LIME : THEME.INK_LINE,
        lineWidth: isSelected ? 3 : 2.2,
      });
      ctx.restore();

      // 卡面插画窗口
      const artImg = AssetLoader.get(getCommandCardArtId(card)) ?? cmdBackImg;
      if (artImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx + 3, cyL + 3, cw - 6, 48);
        ctx.clip();
        ctx.globalAlpha = used ? 0.20 : canPlay ? 0.92 : 0.45;
        ctx.drawImage(artImg, cx + 3, cyL + 3, cw - 6, 48);
        const fadeG = ctx.createLinearGradient(cx, cyL + 26, cx, cyL + 51);
        fadeG.addColorStop(0, 'rgba(11, 17, 30, 0)');
        fadeG.addColorStop(1, 'rgba(11, 17, 30, 0.95)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = fadeG;
        ctx.fillRect(cx + 3, cyL + 26, cw - 6, 25);
        ctx.restore();
      }

      // 费用宝石 + 时机/连击徽标 + 基因徽记
      const isDiscounted = !used && effCost < card.cost;
      drawBadge(
        ctx,
        cx + 5,
        cyL + 5,
        24,
        16,
        `E${effCost}`,
        isDiscounted ? '#065F46' : canPlay ? '#0C4A6E' : '#1E293B',
        isDiscounted ? '#6EE7B7' : canPlay ? THEME.GOLD_LIGHT : THEME.TX3
      );
      if (isTimingZero) {
        drawBadge(ctx, cx + 31, cyL + 5, 34, 16, '时机0', '#14532D', '#4ADE80');
      } else if (isComboReady) {
        drawBadge(ctx, cx + 31, cyL + 5, 34, 16, '连击!', '#581C87', '#E9D5FF');
      } else if (scoutRes && !used) {
        drawBadge(ctx, cx + 31, cyL + 5, 34, 16, '减费', '#78350F', THEME.GOLD_LIGHT);
      }
      const elemId = getCommandCardElemId(card);
      const elemImg = AssetLoader.get(`elem_${elemId}`);
      if (elemImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.globalAlpha = used ? 0.3 : 1;
        ctx.drawImage(elemImg, cx + cw - 21, cyL + 5, 16, 16);
        ctx.restore();
      }

      const cardTitle = fitText(ctx, card.name, cw - 8, 10.5, true);
      drawText(ctx, cardTitle, cx + cw / 2, cyL + 59, {
        size: 12,
        bold: true,
        color: used ? THEME.TX3 : card.affix?.kind === 'negative' ? '#FCA5A5' : THEME.TX1,
        align: 'center',
      });
      const shortLine = SHORT_LINE_MAP[card.targetLine ?? 'ALL'] ?? '全队';
      const usesTag = card.isBase || card.id === 'card_captain_roar' ? '常备' : card.remainingUses !== undefined ? `剩${card.remainingUses}次` : `${card.durationMinutes}分`;
      drawText(ctx, scoutRes ? `破绽共振 +5分` : `${usesTag}·${shortLine}`, cx + cw / 2, cyL + 74, {
        size: 12,
        color: used ? THEME.TX3 : scoutRes ? THEME.GOLD_LIGHT : '#93C5FD',
        align: 'center',
      });
      const roleHint = card.stance
        ? (card.stance === curStance ? `强化·${STANCE_LABELS[card.stance]}` : `起手·切${STANCE_LABELS[card.stance]}`)
        : card.comboRule?.requiresStance && !isComboReady
        ? `先切${STANCE_LABELS[card.comboRule.requiresStance]}再打`
        : '点选预览';
      const footText = used ? '已打出' : prologueLocked ? '等待时机' : isTutTarget ? '点击打出!' : isSelected ? '再点打出' : !canPlay ? '能量不足' : isTimingZero ? '0费白嫖!' : isComboReady ? '连击! 可出' : roleHint;
      const footCol = used ? THEME.TX3 : prologueLocked ? '#FBBF24' : (isTutTarget || isSelected || isTimingZero) ? THEME.GREEN : isComboReady ? '#E9D5FF' : !canPlay ? '#F87171' : card.stance ? '#7DD3FC' : card.comboRule?.requiresStance ? '#94A3B8' : THEME.GOLD_LIGHT;
      drawText(ctx, footText, cx + cw / 2, cyL + 89, {
        size: 12,
        bold: true,
        color: footCol,
        align: 'center',
      });

      if (used) {
        ctx.fillStyle = 'rgba(8, 12, 20, 0.45)';
        ctx.fillRect(cx + 2, cyL + 2, cw - 4, ch - 4);
      }

      if (isTutTarget) {
        ctx.save();
        const glowAlpha = 0.55 + 0.45 * Math.sin(this.elapsedSec * 7);
        ctx.strokeStyle = `rgba(250, 204, 21, ${glowAlpha.toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - 3, cyL - 3, cw + 6, ch + 6);
        ctx.restore();
      }

      if (canPlay) {
        hits.add(cx, cy - 8, cw, ch + 8, () => {
          if (isTutTarget || this.selectedCardId === card.id) {
            this.playCommandCard(card);
          } else {
            this.selectedCardId = card.id;
          }
        });
      } else if (prologueLocked && st.phase !== 'full_time') {
        hits.add(cx, cy - 8, cw, ch + 8, () => {
          SoundEngine.playWarning();
          this.cardBanner = {
            text: '还不到时机！先观察场上局势，等教学高亮提示亮起再打出这张进攻卡！',
            color: '#FBBF24',
            timer: 2.4,
          };
        });
      }
    });

    if (previewCard) {
      const { card, x, y, canPlay, effCost } = previewCard as { card: CommandCard; x: number; y: number; canPlay: boolean; effCost: number };
      const lift = this.selectedCardId === card.id ? -10 : -8;
      const tx = Math.min(720, Math.max(616, x - 95));
      const ty = y + lift - 94;
      drawChamferPanel(ctx, tx, ty, 290, 86, 8, 'rgba(8,12,20,0.97)', this.selectedCardId === card.id ? THEME.GREEN : THEME.GOLD_LIGHT, 1.5);
      const popArt = AssetLoader.get(getCommandCardArtId(card)) ?? cmdBackImg;
      if (popArt && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(tx + 2, ty + 2, 286, 82);
        ctx.clip();
        ctx.globalAlpha = 0.22;
        ctx.drawImage(popArt, tx, ty - 14, 290, 114);
        ctx.restore();
      }
      const pElemImg = AssetLoader.get(`elem_${getCommandCardElemId(card)}`);
      if (pElemImg && typeof ctx.drawImage === 'function') {
        ctx.drawImage(pElemImg, tx + 10, ty + 10, 22, 22);
      }
      const costDesc = effCost < card.cost ? `能量 ${effCost} 原${card.cost}` : `能量 ${effCost}`;
      drawText(ctx, `Lv.${card.level ?? 1} ${card.name} (${costDesc})`, tx + (pElemImg ? 36 : 12), ty + 20, {
        size: 12.5,
        bold: true,
        color: card.isCorrupted ? '#FCA5A5' : THEME.GOLD_LIGHT,
      });
      drawWrappedText(ctx, `${formatCardHumanIntent(card)}（${card.summary}）`, tx + 12, ty + 36, 266, 14.5, {
        size: 12,
        color: THEME.TX1,
        maxLines: 2,
      });
      if (this.selectedCardId === card.id && canPlay) {
        drawButton(ctx, hits, tx + 188, ty + 10, 90, 24, '确认打出', () => {
          this.playCommandCard(card);
        }, { variant: 'green', fontSize: 12, icon: 'check' });
      }
    }
    }

    // 5. 右侧面板：PITCH PRINT 深松石统计与换人面板
    drawChamferPanel(ctx, 1030, 84, 234, 622, 8, THEME.BG_DEEP, THEME.INK_LINE, 2.5);
    const subsUsed = this.userSide === 'home' ? st.homeSubsUsed : st.awaySubsUsed;
    if (this.isPrologueMode) {
      const canPrologueSub = !!prologueTut?.waitingForSub;
      drawButton(
        ctx,
        hits,
        1042,
        96,
        210,
        44,
        canPrologueSub ? `换人 / 战术 (${subsUsed}/5)` : `换人 / 战术 (等待时机)`,
        () => {
          if (st.phase !== 'full_time' && canPrologueSub) this.openTacticalModal(st);
        },
        { variant: canPrologueSub ? 'gold' : 'primary', disabled: st.phase === 'full_time' || !canPrologueSub, fontSize: 13 }
      );

      drawText(ctx, '本场关键焦点', 1044, 158, { size: 14, bold: true, color: THEME.BRASS, rawSize: true });
      const chen = st.players.find(p => p.team === this.userSide && p.id === 'prologue_st_19');
      const linOnPitch = st.players.find(p => p.team === this.userSide && (p.id === 'prologue_vet_10' || p.name.includes('梅利纳') || p.name.includes('林锋')));
      const linSub = (this.userSide === 'home' ? st.homeSubs : st.awaySubs).find(p => p.id === 'prologue_vet_10' || p.name.includes('梅利纳') || p.name.includes('林锋'));
      const linObj = linOnPitch ?? linSub;
      const xiaoImg = AssetLoader.get('portrait_xiaoyu');
      const linImg = AssetLoader.get('portrait_linfeng');
      if (chen) {
        const fit = Math.round(chen.fitness);
        const isCramped = fit <= 35;
        drawRoundRect(ctx, 1042, 178, 210, 98, 6, THEME.BG_CARD_DARK, isCramped ? THEME.VERMILION : THEME.INK_LINE, 2);
        if (xiaoImg && typeof ctx.drawImage === 'function') {
          ctx.save(); ctx.beginPath(); ctx.roundRect(1050, 186, 42, 42, 6); ctx.clip(); ctx.drawImage(xiaoImg, 1050, 186, 42, 42); ctx.restore();
        }
        const cx0 = xiaoImg ? 1100 : 1052;
        drawBadge(ctx, cx0, 188, 32, 18, 'ST', THEME.BG_PANEL, THEME.TX1);
        drawText(ctx, '#19 陈小宇', cx0 + 38, 197, { size: 13, bold: true, color: THEME.TX1, rawSize: true });
        drawText(ctx, isCramped ? '抽筋!' : `体能 ${fit}%`, 1244, 219, { size: 12, bold: true, color: isCramped ? '#FCA5A5' : THEME.LIME, align: 'right', rawSize: true });
        drawText(ctx, `进球 ${chen.matchStats.goals}`, cx0, 219, { size: 12, color: '#93C5FD', rawSize: true });
        drawText(ctx, isCramped ? '拼尽全力，急需换下' : '全队头号锋线尖刀', 1052, 250, { size: 12, color: isCramped ? '#FCA5A5' : THEME.TX2, rawSize: true });
      }
      if (linObj) {
        drawRoundRect(ctx, 1042, 290, 210, 108, 6, THEME.BG_CARD_DARK, linOnPitch ? THEME.BRASS : THEME.INK_LINE, 2);
        if (linImg && typeof ctx.drawImage === 'function') {
          ctx.save(); ctx.beginPath(); ctx.roundRect(1050, 298, 44, 44, 6); ctx.clip(); ctx.drawImage(linImg, 1050, 298, 44, 44); ctx.restore();
        }
        const lx0 = linImg ? 1102 : 1052;
        drawBadge(ctx, lx0, 300, 32, 18, 'ST', THEME.BRASS, THEME.PAPER_INK);
        drawText(ctx, '#10 梅利纳', lx0 + 38, 309, { size: 13, bold: true, color: THEME.BRASS, rawSize: true });
        drawText(ctx, linOnPitch ? '已登场' : '替补待命', lx0, 331, { size: 12, bold: true, color: linOnPitch ? THEME.LIME : THEME.BRASS, rawSize: true });
        drawText(ctx, '37岁传奇老队长 · 最后一舞', 1052, 360, { size: 12, color: THEME.TX1, rawSize: true });
        drawText(ctx, linOnPitch ? '带伤出战 · 寻觅绝杀' : '替补席随时准备上场', 1052, 380, { size: 12, color: THEME.BRASS, rawSize: true });
      }
      const totShotsH = st.stats.home.shots;
      const totShotsA = st.stats.away.shots;
      drawRoundRect(ctx, 1042, 414, 210, 76, 6, THEME.BG_CARD_DARK, THEME.INK_LINE, 2);
      drawText(ctx, '简报', 1054, 430, { size: 12.5, bold: true, color: THEME.TX2, rawSize: true });
      drawText(ctx, `射门 ${totShotsH} : ${totShotsA}  |  xG ${st.stats.home.xG.toFixed(1)} : ${st.stats.away.xG.toFixed(1)}`, 1147, 460, { size: 12.5, bold: true, color: THEME.LIME, align: 'center', mono: true, rawSize: true });
    } else {
      drawButton(ctx, hits, 1042, 96, 94, 44, '实时统计', () => {
        this.rightTab = 'stats';
      }, { active: this.rightTab === 'stats', fontSize: 12.5 });
      drawButton(ctx, hits, 1142, 96, 112, 44, `换人(${subsUsed}/5)`, () => {
        if (st.phase !== 'full_time') this.openTacticalModal(st);
      }, { variant: 'primary', disabled: st.phase === 'full_time', fontSize: 12.5 });

      if (this.rightTab === 'stats') {
        const h = st.stats.home;
        const a = st.stats.away;
        const tot = h.possessionTicks + a.possessionTicks || 1;
        const hPoss = Math.round((h.possessionTicks / tot) * 100);
        const hAcc = h.passes > 0 ? Math.round((h.passesSuccess / h.passes) * 100) : 0;
        const aAcc = a.passes > 0 ? Math.round((a.passesSuccess / a.passes) * 100) : 0;

        const rows: Array<[string, string, string, number]> = [
          ['控球率', `${hPoss}%`, `${100 - hPoss}%`, hPoss / 100],
          ['射门(射正)', `${h.shots}(${h.shotsOnTarget})`, `${a.shots}(${a.shotsOnTarget})`, h.shots / Math.max(1, h.shots + a.shots)],
          ['预期进球 xG', h.xG.toFixed(2), a.xG.toFixed(2), h.xG / Math.max(0.01, h.xG + a.xG)],
          ['传球成功率', `${h.passes}(${hAcc}%)`, `${a.passes}(${aAcc}%)`, h.passes / Math.max(1, h.passes + a.passes)],
          ['抢断', `${h.tackles}`, `${a.tackles}`, h.tackles / Math.max(1, h.tackles + a.tackles)],
          ['拦截', `${h.interceptions}`, `${a.interceptions}`, h.interceptions / Math.max(1, h.interceptions + a.interceptions)],
          ['扑救', `${h.saves}`, `${a.saves}`, h.saves / Math.max(1, h.saves + a.saves)],
          ['角球', `${h.corners}`, `${a.corners}`, h.corners / Math.max(1, h.corners + a.corners)],
          ['犯规(黄牌)', `${h.fouls}(${h.yellowCards})`, `${a.fouls}(${a.yellowCards})`, h.fouls / Math.max(1, h.fouls + a.fouls)],
        ];

        let ry = 160;
        for (const [label, hv, av, ratio] of rows) {
          drawText(ctx, hv, 1046, ry, { size: 16, bold: true, mono: true, color: THEME.TX1, rawSize: true });
          drawText(ctx, av, 1248, ry, { size: 16, bold: true, align: 'right', mono: true, color: THEME.TX1, rawSize: true });
          drawText(ctx, label, 1147, ry, { size: 12.5, rawSize: true, color: THEME.TX2, align: 'center' });
          drawRoundRect(ctx, 1046, ry + 17, 202, 7, 2, THEME.BG_CARD_DARK, THEME.INK_LINE, 1);
          const r = Math.max(0.05, Math.min(0.95, isNaN(ratio) ? 0.5 : ratio));
          drawRoundRect(ctx, 1047, ry + 18, 200 * r, 5, 1, homeKit.primary);
          drawRoundRect(ctx, 1047 + 200 * r, ry + 18, 200 * (1 - r), 5, 1, awayKit.primary);
          ry += 60;
        }
      } else {
        // 临场换人面板
        drawText(ctx, '1. 点选场上球员换下', 1044, 142, { size: 12, color: THEME.GOLD_LIGHT });
        const onPitch = st.players
          .filter(p => p.team === this.userSide && !p.redCard)
          .sort((a, b) => a.fitness - b.fitness); // 体能最低排最前方便换下

        onPitch.slice(0, 11).forEach((p, i) => {
          const py = 156 + i * 28;
          const sel = this.selectedOutId === p.id;
          drawRoundRect(ctx, 1040, py, 214, 24, 4, sel ? '#3B1E24' : THEME.BG_CARD, sel ? THEME.RED_LIGHT : THEME.BORDER);
          drawBadge(ctx, 1044, py + 4, 30, 16, p.role, '#1E293B', THEME.TX2);
          drawText(ctx, p.name.slice(0, 6), 1080, py + 12, { size: 12 });
          drawText(ctx, `${Math.round(p.fitness)}%`, 1246, py + 12, {
            size: 12,
            bold: true,
            color: p.fitness < 55 ? THEME.RED_LIGHT : THEME.GREEN,
            align: 'right',
            mono: true,
          });
          hits.addTouchTarget(1040, py, 214, 24, () => {
            this.selectedOutId = p.id;
          });
        });

        drawText(ctx, this.selectedOutId ? '2. 点击替补登场' : '2. 替补席 (先选换下人)', 1044, 480, {
          size: 12,
          color: this.selectedOutId ? THEME.GREEN : THEME.TX2,
        });
        const subs = this.userSide === 'home' ? st.homeSubs : st.awaySubs;
        subs.slice(0, 5).forEach((sub, i) => {
          const sy = 494 + i * 38;
          const canSub = !!this.selectedOutId && subsUsed < 5;
          drawRoundRect(ctx, 1040, sy, 214, 32, 5, THEME.BG_CARD, canSub ? THEME.GREEN : THEME.BORDER);
          drawBadge(ctx, 1044, sy + 7, 32, 18, sub.role, '#1E293B', THEME.TX2);
          drawText(ctx, sub.name.slice(0, 6), 1082, sy + 16, { size: 12, bold: true });
          drawText(ctx, `${sub.traits?.[0] || ''}`, 1246, sy + 16, { size: 12, color: '#60A5FA', align: 'right' });
          if (canSub) {
            hits.addTouchTarget(1040, sy, 214, 32, () => {
              this.engine!.substitute(this.userSide, this.selectedOutId!, sub.id);
              this.selectedOutId = null;
            });
          }
        });
      }
    }

    if (prologueTut?.waitingForSub && st.phase !== 'full_time' && !this.tacticalModalOpen) {
      const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSec * 7);
      const subsUsedNow = this.userSide === 'home' ? st.homeSubsUsed : st.awaySubsUsed;
      ctx.save();
      drawRoundRect(ctx, 1036, 90, 222, 44, 8, 'rgba(14, 22, 40, 0.98)', THEME.GOLD_LIGHT, 2.4);
      drawButton(ctx, hits, 1042, 96, 210, 32, `换人 / 战术 (${subsUsedNow}/5)`, () => {
        if (st.phase !== 'full_time') this.openTacticalModal(st);
      }, { variant: 'gold', fontSize: 12 });
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(1036, 90, 222, 44);

      drawChamferPanel(ctx, 666, 84, 358, 54, 10, 'rgba(8, 15, 32, 0.96)', THEME.GOLD_LIGHT, 2.2);
      drawBadge(ctx, 678, 100, 72, 22, '80\' 换人', '#78350F', THEME.GOLD_LIGHT);
      drawText(ctx, '陈小宇抽筋！点右侧按钮换上老队长 ▶', 758, 111, { size: 12, bold: true, color: '#FEF08A' });
      ctx.restore();
    }

    if (this.kickoffIntroTimer > 0) {
      this.renderKickoffOverlay(ctx, hits, st, homeClub, awayClub);
    } else if (st.phase === 'full_time' && !this.fullTimeDismissed && !this.tacticalModalOpen) {
      this.renderFullTimeOverlay(ctx, hits, st, league, homeClub, awayClub, onMatchFinished);
    }

    if (this.tacticalModalOpen) {
      this.renderTacticalModal(ctx, hits, st);
    }

    if (this.mangaCutIn.isActive()) {
      this.mangaCutIn.render(ctx, THEME.W, THEME.H);
      hits.add(0, 0, THEME.W, THEME.H, () => {
        this.mangaCutIn.dismiss();
      });
    }
  }

  private openTacticalModal(st: MatchState): void {
    this.wasPausedBeforeModal = this.isPaused;
    this.isPaused = true;
    this.draftForm = this.userSide === 'home' ? st.homeFormation : st.awayFormation;
    this.draftStyle = this.userSide === 'home' ? st.homeStyle : st.awayStyle;
    this.modalSysTab = getDefenseSystem(this.draftForm);
    this.modalSelectedPitchId = null;
    this.modalSwapMode = false;
    this.selectedOutId = null;
    this.selectedBenchId = null;
    this.benchFilter = 'ALL';
    this.benchPage = 0;
    this.modalBanner = '调整阵型/风格、点选场上球员换位/微调站位，或右侧换人；完成后点击「保存并返回比赛」';
    this.tacticalModalOpen = true;
    SoundEngine.playClick();
  }

  private renderTacticalModal(ctx: CanvasRenderingContext2D, hits: HitRegistry, st: MatchState): void {
    ctx.fillStyle = 'rgba(4, 7, 14, 0.88)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const mx = 24;
    const my = 18;
    const mw = 1232;
    const mh = 684;
    drawChamferPanel(ctx, mx, my, mw, mh, 14, 'rgba(11, 17, 30, 0.98)', THEME.BORDER_GOLD, 1.6, THEME.GOLD_LIGHT);

    const modalPrologueTut = this.isPrologueMode && this.engine ? this.engine.getPrologueTutorialState() : null;
    const vetOnPitch = this.isPrologueMode && st.players.some(p => p.team === this.userSide && (p.id === 'prologue_vet_10' || p.name.includes('梅利纳') || p.name.includes('林锋')));
    const modalSubTip = modalPrologueTut?.waitingForSub
      ? !this.selectedOutId
        ? '请先点击中间球场上的【#19 陈小宇】将他换下！'
        : '再点击右侧「替补席」中的【#10 梅利纳】球员卡片完成换人！'
      : vetOnPitch
      ? '老队长已披挂上阵！点击右上角【保存并返回比赛 ▶】继续决战！'
      : this.modalBanner;

    drawText(ctx, `场内细致战术与换人调整 · 第 ${st.minute}' 分钟`, mx + 24, my + 28, { size: 19, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, modalSubTip, mx + 24, my + 52, {
      size: 12,
      bold: !!(modalPrologueTut?.waitingForSub || vetOnPitch),
      color: (modalPrologueTut?.waitingForSub || vetOnPitch) ? '#FEF08A' : '#7DD3FC',
    });

    drawButton(ctx, hits, mx + mw - 300, my + 16, 92, 34, '取消', () => {
      this.tacticalModalOpen = false;
      this.isPaused = this.wasPausedBeforeModal;
    }, { variant: 'ghost', fontSize: 12 });

    drawButton(ctx, hits, mx + mw - 196, my + 16, 174, 34, '保存并返回比赛 ▶', () => {
      const prevForm = this.userSide === 'home' ? st.homeFormation : st.awayFormation;
      const prevStyle = this.userSide === 'home' ? st.homeStyle : st.awayStyle;
      const changedForm = prevForm !== this.draftForm ? this.draftForm : undefined;
      const changedStyle = prevStyle !== this.draftStyle ? this.draftStyle : undefined;
      this.engine!.setTactics(this.userSide, this.draftForm, this.draftStyle);
      if (changedForm || changedStyle) {
        this.triggerTacticsFeedback(changedForm, changedStyle);
      }
      this.tacticalModalOpen = false;
      this.isPaused = false;
      SoundEngine.playClick();
    }, { variant: 'gold', fontSize: 12, icon: 'save' });
    if (vetOnPitch && !modalPrologueTut?.waitingForSub) {
      ctx.save();
      const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSec * 7);
      ctx.strokeStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(mx + mw - 199, my + 13, 180, 40);
      drawChamferPanel(ctx, mx + mw - 278, my + 56, 256, 36, 8, 'rgba(8, 15, 32, 0.98)', THEME.GOLD_LIGHT, 2);
      drawText(ctx, '▲ 点此保存并返回球场决战', mx + mw - 150, my + 74, {
        size: 12,
        bold: true,
        color: '#FEF08A',
        align: 'center',
      });
      ctx.restore();
    }

    drawChamferPanel(ctx, 40, 82, 304, 604, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, '1. 阵型体系 (4/3/5后卫)', 56, 102, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    SYS_CYCLE.forEach((sys, si) => {
      const lbl = sys === '4-back' ? '四后卫(8)' : sys === '3-back' ? '三后卫(4)' : '五后卫(4)';
      drawButton(ctx, hits, 56 + si * 92, 118, 86, 24, lbl, () => {
        this.modalSysTab = sys;
      }, { active: this.modalSysTab === sys, fontSize: 12 });
    });
    const sysForms = FORMATION_SYSTEMS[this.modalSysTab].formations;
    sysForms.forEach((f, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawButton(ctx, hits, 56 + col * 138, 150 + row * 28, 130, 24, f, () => {
        this.draftForm = f;
        this.modalSysTab = getDefenseSystem(f);
      }, { active: this.draftForm === f, fontSize: 12 });
    });

    drawText(ctx, '2. 战术风格', 56, 272, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    STYLES_SHORT.forEach((s, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawButton(ctx, hits, 56 + col * 138, 288 + row * 34, 130, 28, TACTICAL_PRESETS[s].name, () => {
        this.draftStyle = s;
      }, { active: this.draftStyle === s, fontSize: 12 });
    });

    const pr = TACTICAL_PRESETS[this.draftStyle];
    drawRoundRect(ctx, 56, 398, 272, 92, 8, 'rgba(11, 17, 30, 0.85)', THEME.BORDER_GOLD);
    drawText(ctx, `${this.draftForm} · ${pr.name}`, 68, 414, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `防线 ${pr.lineHeight >= 0 ? '+' : ''}${pr.lineHeight}m · 逼抢 ${Math.round(pr.pressIntensity * 100)}%`, 68, 438, { size: 12, color: '#38BDF8', mono: true });
    drawText(ctx, `节奏 ${pr.tempo.toFixed(2)}x · 直传倾角 ${Math.round(pr.directness * 100)}%`, 68, 460, { size: 12, color: THEME.GREEN, mono: true });

    drawText(ctx, '3. 快速套用赛前预案', 56, 510, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    this.matchPresets.slice(0, 4).forEach((pre, pi) => {
      const col = pi % 2;
      const row = Math.floor(pi / 2);
      drawButton(ctx, hits, 56 + col * 138, 528 + row * 40, 130, 32, `${pre.name.slice(0, 4)} (${pre.formation})`, () => {
        this.draftForm = pre.formation;
        this.draftStyle = pre.style;
        this.modalSysTab = getDefenseSystem(pre.formation);
        this.modalBanner = `已套用预案【${pre.name}】：${pre.formation} · ${TACTICAL_PRESETS[pre.style].name}`;
      }, { active: this.draftForm === pre.formation && this.draftStyle === pre.style, fontSize: 12 });
    });

    const px = 356, py = 82, pw = 514, ph = 604;
    drawChamferPanel(ctx, px, py, pw, ph, 10, '#0B1810', THEME.BORDER);
    drawText(ctx, '场上 11 人调整（点选球员后点「场上换位」互换，点空位微调）', px + 16, py + 20, { size: 12, bold: true, color: this.modalSelectedPitchId ? THEME.GREEN : THEME.GOLD_LIGHT });
    drawButton(ctx, hits, px + pw - 96, py + 8, 84, 24, '重置默认站位', () => {
      this.engine!.resetPlayerOffsets(this.userSide);
      this.modalSelectedPitchId = null;
      this.modalBanner = '已重置全队场上站位为当前阵型默认坐标';
    }, { variant: 'ghost', fontSize: 12 });

    const pitchX = px + 20, pitchY = py + 42, pitchW = pw - 40, pitchH = ph - 58;
    const modalGrassImg = AssetLoader.get('pitch_grass_top');
    if (modalGrassImg && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(pitchX, pitchY, pitchW, pitchH);
      ctx.clip();
      ctx.translate(pitchX + pitchW / 2, pitchY + pitchH / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(modalGrassImg, -pitchH / 2, -pitchW / 2, pitchH, pitchW);
      ctx.restore();
    } else {
      const stripeH = pitchH / 8;
      for (let si = 0; si < 8; si++) {
        ctx.fillStyle = si % 2 === 0 ? THEME.BG_PITCH : THEME.BG_PITCH_ALT;
        ctx.fillRect(pitchX, pitchY + si * stripeH, pitchW, stripeH);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);
    ctx.beginPath();
    ctx.moveTo(pitchX, pitchY + pitchH / 2);
    ctx.lineTo(pitchX + pitchW, pitchY + pitchH / 2);
    ctx.stroke();

    const dir = this.userSide === 'home' ? st.homeAttackDir : (st.homeAttackDir === 1 ? -1 : 1);
    const toModalPitch = (sx: number, sy: number) => {
      const relX = (1 - (sy - pitchY) / pitchH) * PITCH.LENGTH;
      const absX = dir === 1 ? relX : PITCH.LENGTH - relX;
      const absY = ((sx - pitchX) / pitchW) * PITCH.WIDTH;
      return { x: absX, y: absY };
    };

    if (this.modalSelectedPitchId) {
      hits.add(pitchX, pitchY, pitchW, pitchH, () => {
        const pt = toModalPitch(hits.hoverX, hits.hoverY);
        const selP = st.players.find(pl => pl.id === this.modalSelectedPitchId);
        if (selP && this.engine!.setPlayerPitchTarget(this.userSide, selP.id, pt.x, pt.y)) {
          this.modalBanner = `站位微调成功：${selP.name} 已移动至新战术区域`;
          SoundEngine.playClick();
        }
        this.modalSelectedPitchId = null;
      });
    }

    const slots = FORMATIONS[this.draftForm];
    const onPitch = st.players.filter(p => p.team === this.userSide && !p.redCard);
    onPitch.forEach((p) => {
      const slot = slots[p.slotIndex] || slots[0];
      const offX = p.customOffset ? p.customOffset.x : 0;
      const offY = p.customOffset ? p.customOffset.y : 0;
      const sx = pitchX + (Math.max(4, Math.min(PITCH.WIDTH - 4, slot.baseY + offY)) / PITCH.WIDTH) * pitchW;
      const sy = pitchY + (1 - Math.max(4, Math.min(PITCH.LENGTH - 4, slot.baseX + offX)) / PITCH.LENGTH) * pitchH;
      const isSel = this.modalSelectedPitchId === p.id || this.selectedOutId === p.id;
      const isTutOutPitch = !!modalPrologueTut?.waitingForSub && !this.selectedOutId && (p.id === 'prologue_st_19' || p.role === 'ST');
      const fitCol = p.fitness < 50 ? THEME.RED_LIGHT : p.fitness < 70 ? THEME.GOLD_LIGHT : THEME.GREEN;

      drawRoundRect(ctx, sx - 38, sy - 26, 76, 52, 7, isSel ? '#1E3A5F' : isTutOutPitch ? 'rgba(120, 53, 15, 0.52)' : 'rgba(14, 22, 40, 0.92)', isSel ? '#38BDF8' : isTutOutPitch ? THEME.GOLD_LIGHT : p.customOffset ? '#38BDF8' : THEME.GOLD, isSel || isTutOutPitch ? 2.2 : 1);
      drawText(ctx, `${slot.role} #${p.shirtNumber}`, sx, sy - 14, { size: 12, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
      if (p.isCaptain) {
        drawBadge(ctx, sx + 22, sy - 25, 14, 12, 'C', '#FACC15', '#080C14');
      }
      drawText(ctx, p.name.slice(0, 5), sx, sy + 1, { size: 12, bold: true, color: THEME.TX1, align: 'center' });
      drawRoundRect(ctx, sx - 26, sy + 13, 52, 5, 2, '#1E293B');
      drawRoundRect(ctx, sx - 26, sy + 13, Math.round(52 * Math.max(0.1, p.fitness / 100)), 5, 2, fitCol);
      if (isSel) {
        ctx.save();
        ctx.strokeStyle = THEME.GOLD_LIGHT;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - 41, sy - 29, 82, 58);
        ctx.restore();
      } else if (this.modalSwapMode && this.modalSelectedPitchId) {
        const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSec * 7);
        ctx.save();
        ctx.strokeStyle = `rgba(34, 197, 94, ${pulse.toFixed(2)})`;
        ctx.lineWidth = 2.2;
        ctx.strokeRect(sx - 41, sy - 29, 82, 58);
        ctx.restore();
      } else if (isTutOutPitch) {
        const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSec * 7);
        ctx.save();
        ctx.strokeStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
        ctx.lineWidth = 2.6;
        ctx.strokeRect(sx - 41, sy - 29, 82, 58);
        drawBadge(ctx, sx - 36, sy - 46, 72, 16, '点此换下', '#78350F', THEME.GOLD_LIGHT);
        ctx.restore();
      }

      hits.add(sx - 38, sy - 26, 76, 52, () => {
        SoundEngine.playClick();
        const subsUsedNow = this.userSide === 'home' ? st.homeSubsUsed : st.awaySubsUsed;
        if (this.selectedBenchId && subsUsedNow < 5) {
          const inSub = (this.userSide === 'home' ? st.homeSubs : st.awaySubs).find(x => x.id === this.selectedBenchId);
          const res = this.engine!.substitute(this.userSide, p.id, this.selectedBenchId);
          if (res.ok && inSub) {
            this.modalBanner = `换人完成：${p.name} ↓ 换上 ${inSub.name} ↑`;
          }
          this.selectedBenchId = null;
          this.selectedOutId = null;
          this.modalSelectedPitchId = null;
          this.modalSwapMode = false;
          return;
        }
        if (this.modalSwapMode && this.modalSelectedPitchId) {
          if (this.modalSelectedPitchId === p.id) {
            this.modalSwapMode = false;
          } else {
            const prevP = onPitch.find(x => x.id === this.modalSelectedPitchId);
            if (prevP && this.engine!.swapPlayerSlots(this.userSide, prevP.id, p.id)) {
              this.modalBanner = `场上换位完成：${prevP.name} ⇄ ${p.name}`;
            }
            this.modalSelectedPitchId = null;
            this.selectedOutId = null;
            this.modalSwapMode = false;
          }
          return;
        }
        if (this.modalSelectedPitchId === p.id) {
          this.modalSelectedPitchId = null;
          this.selectedOutId = null;
          this.modalSwapMode = false;
        } else {
          this.modalSelectedPitchId = p.id;
          this.selectedOutId = p.id;
          this.modalSwapMode = false;
          this.modalBanner = `已选中【${p.name}】：点浮层「换位」可与队友互换，点球场空位微调站位，或点右侧替补换下`;
        }
      });
    });

    if (this.modalSelectedPitchId) {
      const selP = onPitch.find(x => x.id === this.modalSelectedPitchId);
      if (selP) {
        const slot = slots[selP.slotIndex] || slots[0];
        const offX = selP.customOffset ? selP.customOffset.x : 0;
        const offY = selP.customOffset ? selP.customOffset.y : 0;
        const sx = pitchX + (Math.max(4, Math.min(PITCH.WIDTH - 4, slot.baseY + offY)) / PITCH.WIDTH) * pitchW;
        const sy = pitchY + (1 - Math.max(4, Math.min(PITCH.LENGTH - 4, slot.baseX + offX)) / PITCH.LENGTH) * pitchH;
        const popW = 166;
        const popH = 34;
        const popX = Math.max(pitchX + 4, Math.min(pitchX + pitchW - popW - 4, Math.round(sx - popW / 2)));
        const popY = sy + 32 + popH > pitchY + pitchH - 4 ? Math.round(sy - 32 - popH) : Math.round(sy + 32);
        drawRoundRect(ctx, popX, popY, popW, popH, 7, 'rgba(9, 15, 29, 0.96)', this.modalSwapMode ? THEME.GREEN : THEME.GOLD_LIGHT, 1.4);
        hits.add(popX, popY, popW, popH, () => {});
        drawButton(ctx, hits, popX + 5, popY + 4, 92, 26, this.modalSwapMode ? '取消换位' : '场上换位', () => {
          this.modalSwapMode = !this.modalSwapMode;
          this.modalBanner = this.modalSwapMode
            ? `换位模式【${selP.name}】：请点击场上队友完成位置互换`
            : `已选中【${selP.name}】：点球场空位微调站位，或点右侧替补换下`;
        }, { variant: this.modalSwapMode ? 'green' : 'primary', fontSize: 12 });
        drawButton(ctx, hits, popX + 102, popY + 4, 58, 26, '取消', () => {
          this.modalSelectedPitchId = null;
          this.selectedOutId = null;
          this.modalSwapMode = false;
        }, { variant: 'ghost', fontSize: 12 });
      }
    }

    const subsUsed = this.userSide === 'home' ? st.homeSubsUsed : st.awaySubsUsed;
    drawChamferPanel(ctx, 884, 82, 356, 604, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `替补席球员卡 (${subsUsed}/5 换人名额)`, 900, 102, { size: 13.5, bold: true, color: THEME.GOLD_LIGHT });
    const selectedPitchPlayer = this.selectedOutId ? onPitch.find(x => x.id === this.selectedOutId) : null;
    const selectedBenchPlayer = this.selectedBenchId
      ? (this.userSide === 'home' ? st.homeSubs : st.awaySubs).find(x => x.id === this.selectedBenchId)
      : null;
    drawText(
      ctx,
      selectedPitchPlayer
        ? `已选换下【${selectedPitchPlayer.name}】· 点击下方替补卡片上场`
        : selectedBenchPlayer
        ? `已选替补【${selectedBenchPlayer.name}】· 点击左侧首发将其换上`
        : '可先点首发再点替补，或先点替补再点首发（双向换人）',
      900,
      124,
      { size: 12, bold: !!(selectedPitchPlayer || selectedBenchPlayer), color: (selectedPitchPlayer || selectedBenchPlayer) ? THEME.GREEN : THEME.TX2 }
    );

    const allSubs = this.userSide === 'home' ? st.homeSubs : st.awaySubs;
    const outRole = selectedPitchPlayer?.role;
    const isRoleMatch = (s: typeof allSubs[0]) => !!outRole && (s.role === outRole || (s.secondaryRoles?.includes(outRole) ?? false));
    const matchBenchPos = (s: typeof allSubs[0]) => {
      if (this.benchFilter === 'ALL') return true;
      if (this.benchFilter === 'MATCH') return outRole ? isRoleMatch(s) : true;
      if (this.benchFilter === 'STAR') return !!s.isStarred;
      if (this.benchFilter === 'GK') return s.role === 'GK';
      if (this.benchFilter === 'DEF') return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(s.role);
      if (this.benchFilter === 'MID') return ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(s.role);
      return ['LW', 'RW', 'ST'].includes(s.role);
    };
    const filteredSubs = [...allSubs]
      .filter(s => matchBenchPos(s))
      .sort((a, b) => {
        if (outRole) {
          const ma = a.role === outRole ? 2 : a.secondaryRoles?.includes(outRole) ? 1 : 0;
          const mb = b.role === outRole ? 2 : b.secondaryRoles?.includes(outRole) ? 1 : 0;
          if (ma !== mb) return mb - ma;
        }
        const sa = a.isStarred ? 1 : 0;
        const sb = b.isStarred ? 1 : 0;
        if (sa !== sb) return sb - sa;
        const ga = a.role === 'GK' ? 1 : 0;
        const gb = b.role === 'GK' ? 1 : 0;
        if (ga !== gb) return ga - gb;
        return (b.fitness ?? 100) - (a.fitness ?? 100);
      });

    const bFilters: Array<['ALL' | 'MATCH' | 'STAR' | 'ATT' | 'MID' | 'DEF' | 'GK', string]> = [
      ['ALL', '全部'],
      ['MATCH', '对位'],
      ['STAR', '★常用'],
      ['ATT', '锋'],
      ['MID', '中'],
      ['DEF', '卫'],
      ['GK', '门'],
    ];
    bFilters.forEach(([fk, fl], fi) => {
      drawButton(ctx, hits, 896 + fi * 48, 142, 45, 24, fl, () => {
        this.benchFilter = fk;
        this.benchPage = 0;
      }, { active: this.benchFilter === fk, fontSize: 12 });
    });

    const bPageSize = 8;
    const bTotalPages = Math.max(1, Math.ceil(filteredSubs.length / bPageSize));
    if (this.benchPage >= bTotalPages) this.benchPage = bTotalPages - 1;
    const visibleSubs = filteredSubs.slice(this.benchPage * bPageSize, (this.benchPage + 1) * bPageSize);

    if (visibleSubs.length === 0) {
      drawRoundRect(ctx, 898, 180, 328, 110, 10, 'rgba(11, 17, 30, 0.72)', THEME.BORDER);
      drawText(ctx, '当前筛选下暂无可用替补球员', 1062, 235, { size: 12, color: THEME.TX3, align: 'center' });
    }

    visibleSubs.forEach((sub, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cw = 160;
      const ch = 92;
      const sx = 898 + col * 168;
      const sy = 178 + row * 100;
      const canSubWithPitch = !!this.selectedOutId && subsUsed < 5;
      const canSelectBench = !this.selectedOutId && subsUsed < 5;
      const isBenchSelected = this.selectedBenchId === sub.id;
      const canSub = canSubWithPitch || canSelectBench;
      const subCa = this.playerCaMap.get(sub.id);
      const subPa = sub.pa ?? subCa;
      const a = sub.attributes;
      const fitVal = Math.round(sub.fitness ?? 100);
      const fitColor = fitVal < 55 ? THEME.RED_LIGHT : fitVal < 75 ? THEME.GOLD_LIGHT : THEME.GREEN;
      const isNaturalMatch = !!outRole && sub.role === outRole;
      const isSecMatch = !!outRole && !isNaturalMatch && (sub.secondaryRoles?.includes(outRole) ?? false);
      const isTutInTarget = !!modalPrologueTut?.waitingForSub && !!this.selectedOutId && (sub.id === 'prologue_vet_10' || sub.name.includes('梅利纳') || sub.name.includes('林锋'));

      const borderCol = isBenchSelected ? THEME.GREEN : isTutInTarget ? THEME.GOLD_LIGHT : isNaturalMatch ? THEME.GREEN : isSecMatch ? '#38BDF8' : canSubWithPitch ? 'rgba(74,222,128,0.45)' : THEME.BORDER;
      const bgCol = isBenchSelected ? 'rgba(20, 83, 45, 0.50)' : isTutInTarget ? 'rgba(120, 53, 15, 0.44)' : canSubWithPitch ? 'rgba(14, 28, 46, 0.94)' : 'rgba(11, 17, 30, 0.88)';
      drawRoundRect(ctx, sx, sy, cw, ch, 8, bgCol, borderCol, isBenchSelected || isTutInTarget || isNaturalMatch ? 2.0 : canSubWithPitch ? 1.3 : 1);

      const roleW = Math.min(40, Math.max(30, sub.role.length * 7 + 8));
      drawBadge(ctx, sx + 5, sy + 5, roleW, 15, sub.role, '#1E3A5F', THEME.TX1);
      if (isNaturalMatch) {
        drawBadge(ctx, sx + 5 + roleW + 3, sy + 5, 30, 15, '对位', '#14532D', THEME.GREEN);
      } else if (isSecMatch) {
        drawBadge(ctx, sx + 5 + roleW + 3, sy + 5, 30, 15, '兼任', '#0C4A6E', '#7DD3FC');
      } else if (sub.isStarred) {
        drawBadge(ctx, sx + 5 + roleW + 3, sy + 5, 20, 15, '★', '#78350F', THEME.GOLD_LIGHT);
      }
      drawText(ctx, subCa ? `${subCa}/${subPa ?? subCa}` : `#${sub.shirtNumber}`, sx + cw - 6, sy + 12.5, {
        size: 12,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'right',
        mono: true,
      });

      const customSubPortrait = (sub.id === 'prologue_vet_10' || sub.name.includes('梅利纳') || sub.name.includes('林锋'))
        ? AssetLoader.get('portrait_linfeng')
        : (sub.id === 'prologue_st_19' || sub.name.includes('陈小宇'))
        ? AssetLoader.get('portrait_xiaoyu')
        : null;
      if (customSubPortrait && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(sx + 6, sy + 23, 28, 34, 5);
        ctx.clip();
        ctx.drawImage(customSubPortrait, sx + 6, sy + 23, 28, 34);
        ctx.restore();
      } else {
        drawPlayerAvatar(
          ctx,
          sx + 6,
          sy + 23,
          28,
          34,
          {
            id: sub.id,
            name: sub.name,
            age: 24,
            role: sub.role,
            tier: (subCa ?? 75) >= 82 ? 'S' : (subCa ?? 75) >= 72 ? 'A' : 'B',
            isCaptain: sub.shirtNumber === 10,
          },
          undefined,
          { radius: 5, showFrame: true }
        );
      }
      drawText(ctx, fitText(ctx, sub.name, cw - 46, 12, true), sx + 38, sy + 33, {
        size: 12,
        bold: true,
        color: isTutInTarget ? THEME.GOLD_LIGHT : THEME.TX1,
      });
      const secTxt = sub.secondaryRoles && sub.secondaryRoles.length > 0 ? `兼:${sub.secondaryRoles.slice(0, 2).join('/')}` : '专职';
      drawText(ctx, `${sub.isStarred ? '★' : ''}#${sub.shirtNumber} · ${secTxt}`, sx + 38, sy + 48, {
        size: 12,
        color: sub.secondaryRoles?.length ? '#7DD3FC' : THEME.TX2,
      });

      const attrLine = sub.role === 'GK'
        ? `扑${a.goalkeeping} 站${a.positioning} 冷${a.composure}`
        : `速${a.pace} 射${a.shooting} 传${a.passing} 防${a.defending}`;
      drawText(ctx, attrLine, sx + 7, sy + 64, {
        size: 12,
        color: '#93C5FD',
        mono: true,
      });

      const benchFooterLabel = isBenchSelected
        ? '已选中替补 ✓'
        : canSubWithPitch
        ? '点击换上 ▶'
        : subsUsed < 5
        ? '点击选为替补'
        : '换人已满';
      drawText(ctx, benchFooterLabel, sx + 7, sy + ch - 10, {
        size: 12,
        bold: canSubWithPitch || isBenchSelected,
        color: isBenchSelected ? THEME.GOLD_LIGHT : canSubWithPitch ? THEME.GREEN : THEME.TX3,
      });
      drawText(ctx, `体${fitVal}%`, sx + cw - 7, sy + ch - 10, {
        size: 12,
        bold: true,
        color: fitColor,
        align: 'right',
        mono: true,
      });

      if (isTutInTarget) {
        const pulse = 0.55 + 0.45 * Math.sin(this.elapsedSec * 7);
        ctx.save();
        ctx.strokeStyle = `rgba(250, 204, 21, ${pulse.toFixed(2)})`;
        ctx.lineWidth = 2.6;
        ctx.strokeRect(sx - 2, sy - 2, cw + 4, ch + 4);
        drawChamferPanel(ctx, 560, sy + 24, 326, 40, 8, 'rgba(8, 15, 32, 0.98)', THEME.GOLD_LIGHT, 2);
        drawText(ctx, '点这里派上【#10 梅利纳】 ▶', 723, sy + 44, {
          size: 12,
          bold: true,
          color: '#FEF08A',
          align: 'center',
        });
        ctx.restore();
      }
      if (canSub) {
        hits.add(sx, sy, cw, ch, () => {
          if (this.selectedOutId) {
            const outP = onPitch.find(x => x.id === this.selectedOutId);
            const res = this.engine!.substitute(this.userSide, this.selectedOutId, sub.id);
            if (res.ok) {
              this.modalBanner = `换人完成：${outP?.name || ''} ↓ 换上 ${sub.name} ↑`;
              SoundEngine.playClick();
            }
            this.selectedOutId = null;
            this.selectedBenchId = null;
            this.modalSelectedPitchId = null;
          } else {
            this.selectedBenchId = this.selectedBenchId === sub.id ? null : sub.id;
            this.modalBanner = this.selectedBenchId
              ? `已选中替补【${sub.name}】：请在中间球场点击要替换下场的首发球员！`
              : '已取消选中替补，可重新选人换人';
            SoundEngine.playClick();
          }
        });
      }
    });

    if (bTotalPages > 1) {
      drawButton(ctx, hits, 898, 650, 86, 26, '上一页', () => {
        this.benchPage = Math.max(0, this.benchPage - 1);
      }, { disabled: this.benchPage === 0, fontSize: 12 });
      drawText(ctx, `${this.benchPage + 1} / ${bTotalPages} 页`, 1062, 663, { size: 12, color: THEME.TX2, align: 'center' });
      drawButton(ctx, hits, 1140, 650, 86, 26, '下一页', () => {
        this.benchPage = Math.min(bTotalPages - 1, this.benchPage + 1);
      }, { disabled: this.benchPage >= bTotalPages - 1, fontSize: 12 });
    }
  }

  private renderKickoffOverlay(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    st: MatchState,
    homeClub: { id: string; primaryColor: string; secondaryColor: string },
    awayClub: { id: string; primaryColor: string; secondaryColor: string }
  ): void {
    const t = this.kickoffDuration - this.kickoffIntroTimer;
    const inProg = easeOutBack(Math.min(1, t / 0.48));
    const outFade = this.kickoffIntroTimer < 0.35 ? easeOutCubic(this.kickoffIntroTimer / 0.35) : 1;
    const alpha = Math.max(0, Math.min(1, outFade));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10, 26, 20, 0.80)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const cx = THEME.W / 2;
    const cy = 352;

    const wInfo = WEATHER_INFO[st.weather ?? 'sunny'];
    drawGameLogoEmblem(ctx, cx, cy - 214, 68, this.elapsedSec, 'showcase');
    drawText(ctx, 'MATCHDAY BROADCAST · 赛前入场仪式', cx, cy - 98, {
      size: 12.5,
      bold: true,
      color: THEME.GOLD_LIGHT,
      align: 'center',
      mono: true,
    });
    drawBadge(ctx, cx - 64, cy - 78, 128, 24, `${wInfo.label} · 哨响即战`, THEME.BG_DEEP, wInfo.color);

    const cardW = 360;
    const cardH = 148;
    const slideOffset = Math.round((1 - inProg) * 180);

    const hx = cx - 410 - slideOffset;
    drawPrintCard(ctx, hx, cy - 42, cardW, cardH, {
      paper: true,
      radius: 12,
      shadowOffset: 6,
      topBandColor: homeClub.primaryColor,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });
    drawClubCrest(ctx, hx + 66, cy + 32, 36, homeClub);
    drawText(ctx, this.userSide === 'home' ? '主场出战 (我方)' : '主场作战', hx + 118, cy - 4, {
      size: 12,
      bold: true,
      color: this.userSide === 'home' ? THEME.VERMILION : THEME.PAPER_MUTED,
    });
    drawText(ctx, st.homeName, hx + 118, cy + 26, { size: 22, bold: true, color: THEME.PAPER_INK });
    drawText(ctx, `${st.homeFormation} · ${TACTICAL_PRESETS[st.homeStyle].name}`, hx + 118, cy + 58, {
      size: 13,
      bold: true,
      color: THEME.PAPER_MUTED,
    });

    const ax = cx + 50 + slideOffset;
    drawPrintCard(ctx, ax, cy - 42, cardW, cardH, {
      paper: true,
      radius: 12,
      shadowOffset: 6,
      topBandColor: awayClub.primaryColor,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });
    drawClubCrest(ctx, ax + cardW - 66, cy + 32, 36, awayClub);
    drawText(ctx, this.userSide === 'away' ? '客场出战 (我方)' : '客场挑战', ax + cardW - 118, cy - 4, {
      size: 12,
      bold: true,
      color: this.userSide === 'away' ? THEME.VERMILION : THEME.PAPER_MUTED,
      align: 'right',
    });
    drawText(ctx, st.awayName, ax + cardW - 118, cy + 26, {
      size: 22,
      bold: true,
      color: THEME.PAPER_INK,
      align: 'right',
    });
    drawText(ctx, `${st.awayFormation} · ${TACTICAL_PRESETS[st.awayStyle].name}`, ax + cardW - 118, cy + 58, {
      size: 13,
      bold: true,
      color: THEME.PAPER_MUTED,
      align: 'right',
    });

    const vsScale = easeOutBack(Math.min(1, Math.max(0, (t - 0.16) / 0.4)));
    ctx.save();
    ctx.translate(cx, cy + 32);
    ctx.scale(vsScale, vsScale);
    drawRoundRect(ctx, -44, -44, 88, 88, 44, THEME.BG_DEEP, THEME.INK_LINE, 3);
    drawRoundRect(ctx, -39, -39, 78, 78, 39, THEME.BG_PANEL, THEME.LIME, 2);
    drawText(ctx, 'VS', 0, -8, { size: 26, bold: true, italic: true, color: THEME.LIME, align: 'center', mono: true });
    drawText(ctx, 'KICK OFF', 0, 20, { size: 12, bold: true, color: THEME.PAPER_CREAM, align: 'center', mono: true });
    ctx.restore();

    drawText(ctx, '点击任意位置或按 空格/回车 立即开哨', cx, cy + 168, {
      size: 12.5,
      color: THEME.TX2,
      align: 'center',
    });
    hits.add(0, 0, THEME.W, THEME.H, () => {
      this.kickoffIntroTimer = 0;
      SoundEngine.playWhistle('kickoff');
      this.pitchRipples.push({ x: PITCH.HALF_X, y: PITCH.HALF_Y, color: '#FACC15', timer: 0.9, maxTimer: 0.9, maxR: 52 });
    });
    ctx.restore();
  }

  private renderFullTimeOverlay(
    ctx: CanvasRenderingContext2D,
    hits: HitRegistry,
    st: MatchState,
    league: LeagueManager,
    homeClub: { id: string; primaryColor: string; secondaryColor: string },
    awayClub: { id: string; primaryColor: string; secondaryColor: string },
    onMatchFinished: (result: MatchState) => void
  ): void {
    if (this.isPrologueMode && this.prologueChampionModal) {
      ctx.save();
      ctx.fillStyle = 'rgba(4, 7, 14, 0.92)';
      ctx.fillRect(0, 0, THEME.W, THEME.H);
      hits.clear();
      const bgCeremony = AssetLoader.get('bg_prologue_coronation') ?? AssetLoader.get('bg_season_ceremony');
      if (bgCeremony && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.globalAlpha = 0.56;
        ctx.drawImage(bgCeremony, 0, 0, THEME.W, THEME.H);
        ctx.restore();
      }
      const mx = 210;
      const my = 68;
      const mw = 860;
      const mh = 584;
      drawChamferPanel(ctx, mx, my, mw, mh, 18, 'rgba(9, 14, 26, 0.88)', THEME.GOLD_LIGHT, 2.4, THEME.GOLD_LIGHT);
      if (bgCeremony && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(mx + 18, my + 18, mw - 36, 224, 12);
        ctx.clip();
        ctx.drawImage(bgCeremony, mx + 18, my + 10, mw - 36, 280);
        const gradC = ctx.createLinearGradient(0, my + 130, 0, my + 242);
        gradC.addColorStop(0, 'rgba(9, 14, 26, 0.12)');
        gradC.addColorStop(1, 'rgba(9, 14, 26, 0.94)');
        ctx.fillStyle = gradC;
        ctx.fillRect(mx + 18, my + 18, mw - 36, 224);
        ctx.restore();
      }
      drawFoilShimmer(ctx, mx, my, mw, mh, this.elapsedSec * 0.9, 'rgba(250, 204, 21, 0.24)');
      drawBadge(ctx, 515, my + 26, 250, 26, 'SUPER LEAGUE CHAMPIONS', 'rgba(120, 53, 15, 0.92)', THEME.GOLD_LIGHT);
      const cupImg = AssetLoader.get('trophy_grand_cup');
      if (cupImg && typeof ctx.drawImage === 'function') {
        ctx.drawImage(cupImg, 588, my + 148, 104, 104);
      } else {
        drawIcon(ctx, 'trophy', 640, my + 196, 76, THEME.GOLD_LIGHT);
      }
      drawText(ctx, '超级联赛冠军加冕 · 4:3 史诗逆转！', 640, my + 278, { size: 28, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
      drawText(ctx, '曙光竞技 4 : 3 铁幕联  |  0:1 → 1:1 → 1:3 → 4:3 绝境捧杯', 640, my + 306, { size: 15, bold: true, color: THEME.TX1, align: 'center' });
      drawRoundRect(ctx, mx + 90, my + 334, mw - 180, 94, 12, 'rgba(15, 23, 42, 0.90)', THEME.BORDER_GOLD, 1.4);
      drawText(ctx, '37岁队长 #10 梅利纳 80\' 替补登场 · 85\' 远射绝平 · 90\' 读秒绝杀', 640, my + 364, { size: 14.5, bold: true, color: '#FEF08A', align: 'center' });
      drawText(ctx, '雨夜的金色纸屑落下，你摘下浸满汗水的队长袖标，独自走回寂静的更衣室……', 640, my + 394, { size: 13, color: '#94A3B8', align: 'center' });
      drawButton(ctx, hits, 450, my + mh - 74, 380, 50, '捧杯之后 · 回到更衣室 ▶', () => {
        SoundEngine.playClick();
        this.isPrologueMode = false;
        this.prologueChampionModal = false;
        const cb = this.onPrologueComplete;
        this.onPrologueComplete = undefined;
        cb?.();
      }, { variant: 'gold', fontSize: 16 });
      ctx.restore();
      return;
    }
    const enterP = easeOutCubic(Math.min(1, this.fullTimeTimer / 0.38));
    const slideScale = 0.94 + 0.06 * easeOutBack(Math.min(1, this.fullTimeTimer / 0.45));

    ctx.save();
    ctx.fillStyle = `rgba(4, 7, 14, ${(0.78 * enterP).toFixed(2)})`;
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const myG = this.userSide === 'home' ? st.homeScore : st.awayScore;
    const opG = this.userSide === 'home' ? st.awayScore : st.homeScore;
    const isWin = myG > opG;
    const isDraw = myG === opG;

    const accentCol = isWin ? THEME.LIME : isDraw ? THEME.BRASS : THEME.VERMILION;
    const outcomeKicker = isWin ? 'FULL TIME · VICTORY' : isDraw ? 'FULL TIME · DRAW' : 'FULL TIME · DEFEAT';
    const outcomeTitle = isWin ? '终场哨响 · 胜利收入囊中！' : isDraw ? '终场哨响 · 各取一分握手言和' : '终场哨响 · 虽败犹荣整装再战';

    const userGoals = st.events.filter(e => e.type === 'goal' && e.team === this.userSide);
    const hasLateWin = isWin && userGoals.some(g => g.minute >= 85) && myG - opG <= 1;
    const narrativeTag = hasLateWin
      ? '读秒绝杀高光夜!'
      : isWin && opG === 0
      ? '铁闸零封完胜!'
      : isWin && myG - opG >= 3
      ? '火力全开大胜横扫!'
      : isDraw
      ? '焦灼鏖战 · 寸土必争'
      : '赛后复盘 · 领取补强盲盒';

    const cx = THEME.W / 2;
    const cy = THEME.H / 2;
    ctx.translate(cx, cy);
    ctx.scale(slideScale, slideScale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = Math.max(0.05, enterP);

    const mx = 216;
    const my = 96;
    const mw = 848;
    const mh = 528;
    drawPrintCard(ctx, mx, my, mw, mh, {
      paper: true,
      radius: 14,
      shadowOffset: 8,
      topBandColor: accentCol,
      strokeColor: THEME.INK_LINE,
      lineWidth: 3,
    });

    drawBadge(ctx, mx + 28, my + 24, 174, 24, outcomeKicker, THEME.BG_DEEP, accentCol);
    drawBadge(ctx, mx + mw - 202, my + 24, 174, 24, narrativeTag, THEME.PAPER_WARM, THEME.PAPER_INK);
    drawText(ctx, outcomeTitle, cx, my + 74, { size: 24, bold: true, color: THEME.PAPER_INK, align: 'center' });

    // 主客队徽与头版大比分卡
    drawPrintCard(ctx, mx + 36, my + 94, mw - 72, 152, {
      paper: false,
      radius: 10,
      shadowOffset: 4,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.5,
    });
    drawClubCrest(ctx, mx + 172, my + 138, 26, homeClub);
    drawText(ctx, fitText(ctx, st.homeName, 170, 15.5, true), mx + 172, my + 180, {
      size: 15.5,
      bold: true,
      color: this.userSide === 'home' ? THEME.LIME : THEME.TX1,
      align: 'center',
    });

    drawPrintCard(ctx, cx - 86, my + 106, 172, 68, {
      paper: true,
      radius: 8,
      shadowOffset: 3,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.2,
    });
    drawText(ctx, `${st.homeScore}  :  ${st.awayScore}`, cx, my + 140, {
      size: 34,
      bold: true,
      italic: true,
      color: THEME.PAPER_INK,
      align: 'center',
      mono: true,
    });

    drawClubCrest(ctx, mx + mw - 172, my + 138, 26, awayClub);
    drawText(ctx, fitText(ctx, st.awayName, 170, 15.5, true), mx + mw - 172, my + 180, {
      size: 15.5,
      bold: true,
      color: this.userSide === 'away' ? THEME.LIME : THEME.TX1,
      align: 'center',
    });

    const hs = st.stats.home;
    const as = st.stats.away;
    const totTicks = hs.possessionTicks + as.possessionTicks || 1;
    const hp = Math.round((hs.possessionTicks / totTicks) * 100);
    drawRoundRect(ctx, mx + 56, my + 196, mw - 112, 24, 6, THEME.BG_DEEP, THEME.INK_LINE, 1.4);
    const ftSummary = `控球 ${hp}% : ${100 - hp}%   |   射门(正) ${hs.shots}(${hs.shotsOnTarget}) : ${as.shots}(${as.shotsOnTarget})   |   xG ${hs.xG.toFixed(2)} : ${as.xG.toFixed(2)}`;
    drawText(
      ctx,
      fitText(ctx, ftSummary, mw - 128, 12, false, true),
      cx,
      my + 208,
      { size: 12, color: THEME.LIME, align: 'center', mono: true }
    );
    const ts = st.tacticalStats;
    if (ts && (ts.traitTriggers + ts.chemPasses + ts.scoutCounters) > 0) {
      drawText(
        ctx,
        `策略收益：特质触发 ${ts.traitTriggers} 次 · 默契连线 ${ts.chemPasses} 次 · 破绽压制 ${ts.scoutCounters} 次`,
        cx,
        my + 232,
        { size: 12, bold: true, color: THEME.GOLD_LIGHT, align: 'center' }
      );
    }

    // 本场我方 MVP 暖纸头版卡
    const userStarters = st.players.filter(p => p.team === this.userSide);
    const rated = userStarters.map(p => {
      const m = p.matchStats;
      const raw =
        5.9 +
        (isWin ? 0.5 : isDraw ? 0.1 : -0.1) +
        m.goals * 1.4 +
        m.assists * 0.9 +
        m.shots * 0.12 +
        m.passesSuccess * 0.035 +
        (m.tackles + m.interceptions) * 0.25 +
        m.saves * 0.45 +
        (p.role === 'GK' && opG === 0 ? 0.75 : 0);
      return { p, rating: Math.max(5.5, Math.min(9.9, Math.round(raw * 10) / 10)) };
    }).sort((a, b) => b.rating - a.rating);
    const mvpEntry = rated[0];

    drawPrintCard(ctx, mx + 36, my + 260, mw - 72, 140, {
      paper: true,
      radius: 10,
      shadowOffset: 4,
      topBandColor: THEME.BRASS,
      strokeColor: THEME.INK_LINE,
      lineWidth: 2.2,
    });
    drawBadge(ctx, mx + 54, my + 274, 152, 24, '全场最佳 · MVP', THEME.BG_DEEP, THEME.LIME);
    if (mvpEntry) {
      const mvp = mvpEntry.p;
      const userClubObj = league.getUserClub();
      const mvpDraft = userClubObj.squad.find(sq => sq.id === mvp.id);
      if (mvpDraft) {
        drawPlayerAvatar(ctx, mx + 56, my + 306, 66, 82, mvpDraft, userClubObj, { radius: 8 });
      } else {
        drawRoundRect(ctx, mx + 56, my + 306, 66, 82, 8, THEME.BG_DEEP, THEME.INK_LINE, 2);
        drawText(ctx, mvp.role, mx + 89, my + 347, { size: 18, bold: true, color: THEME.LIME, align: 'center' });
      }
      drawBadge(ctx, mx + 138, my + 314, 42, 22, mvp.role, THEME.INK_LINE, THEME.PAPER_CREAM);
      drawText(ctx, `${mvp.name} (#${mvp.shirtNumber})`, mx + 188, my + 325, { size: 20, bold: true, color: THEME.PAPER_INK });

      const statSegs: string[] = [];
      const ms = mvp.matchStats;
      if (ms.goals > 0) statSegs.push(`${ms.goals} 粒进球`);
      if (ms.assists > 0) statSegs.push(`${ms.assists} 次助攻`);
      if (mvp.role === 'GK') statSegs.push(`${ms.saves} 次扑救`);
      else statSegs.push(`成功传球 ${ms.passesSuccess}`);
      if (ms.tackles + ms.interceptions > 0) statSegs.push(`抢断拦截 ${ms.tackles + ms.interceptions}`);
      drawText(ctx, statSegs.join('  ·  '), mx + 138, my + 360, { size: 13.5, bold: true, color: THEME.PAPER_MUTED });

      drawRoundRect(ctx, mx + mw - 184, my + 294, 128, 84, 10, THEME.BG_DEEP, THEME.INK_LINE, 2);
      drawText(ctx, '全场评分', mx + mw - 120, my + 314, { size: 12, color: THEME.TX2, align: 'center' });
      drawText(ctx, mvpEntry.rating.toFixed(1), mx + mw - 120, my + 348, { size: 30, bold: true, italic: true, color: THEME.LIME, align: 'center', mono: true });
    }

    // 底部主要去向按钮
    drawButton(ctx, hits, mx + 36, my + mh - 74, 250, 48, '留在本页查看全场数据', () => {
      this.fullTimeDismissed = true;
      SoundEngine.playClick();
    }, { variant: 'ghost', fontSize: 13 });
    drawButton(ctx, hits, mx + 304, my + mh - 74, mw - 340, 48, this.isPrologueMode ? '捧起超级联赛冠军奖杯 ▶' : '查看完整复盘与开箱领奖 ▶', () => {
      SoundEngine.playClick();
      if (this.isPrologueMode) {
        this.prologueChampionModal = true;
        SoundEngine.playFanfare();
        this.onCelebrationBurst?.(640, 220, THEME.GOLD_LIGHT);
      } else {
        onMatchFinished(st);
      }
    }, { variant: 'gold', fontSize: 16 });
    ctx.restore();
  }
}
