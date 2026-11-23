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
  TACTICAL_PRESETS,
  TacticalStyle,
  TeamSide,
} from '../../../engine/src/types';
import { LeagueManager } from '../../../core/src/LeagueManager';
import { WEATHER_INFO } from '../../../core/src/Chronicles';
import { TacticalPresetSlot } from '../../../core/src/types';
import { CommandCard, ElementId } from '../../../core/src/CommandCards';
import { ArtAssetId, AssetLoader } from '../AssetLoader';
import {
  drawBadge,
  drawButton,
  drawChamferPanel,
  drawRoundRect,
  drawText,
  drawWrappedText,
  HitRegistry,
} from '../CanvasKit';
import { drawClubCrest } from '../ClubVisuals';
import { drawGameLogoEmblem, easeOutBack, easeOutCubic } from '../Motion';
import { SoundEngine } from '../SoundEngine';
import { THEME } from '../Theme';

const SYS_CYCLE: DefenseSystem[] = ['4-back', '3-back', '5-back'];
const STYLES_SHORT: TacticalStyle[] = ['tiki_taka', 'gegenpress', 'balanced', 'wing_play', 'counter', 'park_bus'];

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
  private halftimeNotified = false;
  private goalBanner: { text: string; timer: number; team: TeamSide } | null = null;
  private cardBanner: { text: string; color: string; timer: number } | null = null;
  private lastEventCount = 0;
  private lastHiddenCount = 0;
  private handCards: CommandCard[] = [];
  private matchPresets: TacticalPresetSlot[] = [];
  private tacticalEnergy = 3;
  private usedCardIds = new Set<string>();
  private selectedCardId: string | null = null;
  private selectedPitchPlayerId: string | null = null;
  private tacticalModalOpen = false;
  private wasPausedBeforeModal = false;
  private modalSysTab: DefenseSystem = '4-back';
  private draftForm: FormationName = '4-3-3';
  private draftStyle: TacticalStyle = 'tiki_taka';
  private modalSelectedPitchId: string | null = null;
  private benchFilter: 'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT' = 'ALL';
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
  private goalScorePopTimer = 0;
  private memoryHighlightTimer = 0;
  private kickoffIntroTimer = 0;
  private readonly kickoffDuration = 2.2;

  public dispose(): void {
    this.engine = null;
    this.renderPlayers.clear();
    this.tacticGhostTargets.clear();
    this.storyTags.clear();
    this.playerCaMap.clear();
    this.ballTrail = [];
    this.playerPulses = [];
    this.playerFloatTags = [];
    this.pitchRipples = [];
    this.usedCardIds.clear();
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
      const stNow = this.engine.getState();
      if (stNow.activeSkillPrompt && stNow.phase !== 'full_time') {
        const prm = stNow.activeSkillPrompt;
        const res = this.engine.triggerActiveSkill(this.userSide, prm.skillId);
        if (res.ok) {
          SoundEngine.playCommandCard(false);
          this.cardBanner = {
            text: res.boosted
              ? `⚡ 卡牌共振技能释放 · ${prm.name} (+35%威力)`
              : `⚡ 子弹时间技能释放 · ${prm.name}`,
            color: res.boosted ? THEME.GOLD_LIGHT : '#38BDF8',
            timer: 2.2,
          };
        }
      }
    }
  }

  public start(
    league: LeagueManager,
    onGoal?: (team: TeamSide) => void,
    onImpact?: (intensity: number, dur: number) => void
  ): void {
    const fx = league.getUserCurrentFixture();
    this.userSide = fx && fx.awayClubId === league.getState().userClubId ? 'away' : 'home';
    this.engine = league.createUserMatchEngine();
    this.isPaused = false;
    this.tickAcc = 0;
    this.rightTab = 'stats';
    this.selectedOutId = null;
    this.halftimeNotified = false;
    this.goalBanner = null;
    this.cardBanner = null;
    this.lastEventCount = 0;
    this.lastHiddenCount = 0;
    this.tacticalEnergy = 3 + (league.getInterMatchPrep()?.nextMatchBuff?.energyBonus ?? 0);
    this.usedCardIds.clear();
    this.selectedCardId = null;
    this.selectedPitchPlayerId = null;
    this.onGoalCallback = onGoal;
    this.onImpactCallback = onImpact;
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
    this.handCards = league.getMatchLoadout();
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
    if (this.goalScorePopTimer > 0) {
      this.goalScorePopTimer = Math.max(0, this.goalScorePopTimer - dtSec);
    }
    if (this.memoryHighlightTimer > 0) {
      this.memoryHighlightTimer = Math.max(0, this.memoryHighlightTimer - dtSec);
    }
    SoundEngine.setMatchTension(
      st.minute >= 75 && Math.abs(st.homeScore - st.awayScore) <= 1 && st.phase !== 'full_time'
    );

    if (this.goalBanner) {
      this.goalBanner.timer -= dtSec;
      if (this.goalBanner.timer <= 0) this.goalBanner = null;
    }
    if (this.cardBanner) {
      this.cardBanner.timer -= dtSec;
      if (this.cardBanner.timer <= 0) this.cardBanner = null;
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

    // 半场自动暂停提示一次，并额外恢复 +1 点战术能量
    if (st.phase === 'half_time' && !this.halftimeNotified) {
      this.halftimeNotified = true;
      this.isPaused = true;
      this.tacticalEnergy = Math.min(4, this.tacticalEnergy + 1);
    }

    if (this.kickoffIntroTimer > 0) {
      this.kickoffIntroTimer = Math.max(0, this.kickoffIntroTimer - dtSec);
      if (this.kickoffIntroTimer === 0) {
        SoundEngine.playWhistle('kickoff');
        this.pitchRipples.push({ x: PITCH.HALF_X, y: PITCH.HALF_Y, color: '#FACC15', timer: 0.9, maxTimer: 0.9, maxR: 52 });
      }
    } else if (!this.isPaused && st.phase !== 'full_time') {
      const effSpeed = st.activeSkillPrompt ? 0.25 : this.speed;
      this.tickAcc += dtSec * 10 * effSpeed;
      let steps = 0;
      while (this.tickAcc >= 1 && steps < 20) {
        this.engine.step();
        this.tickAcc -= 1;
        steps++;
      }
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
          this.goalBanner = {
            text: `${prefix}${ev.playerName} (${ev.minute}')`,
            timer: 3.2,
            team: ev.team,
          };
          this.goalFlashTimer = 1.4;
          this.goalScorePopTimer = 0.65;
          if (
            ev.narrativeTag === 'LATE_WINNER' ||
            ev.narrativeTag === 'HATTRICK' ||
            (ev.minute >= 85 && Math.abs(st.homeScore - st.awayScore) <= 1)
          ) {
            this.memoryHighlightTimer = 2.8;
          }
          this.goalFlashSide = ev.pos.x > PITCH.HALF_X ? 'right' : 'left';
          this.pitchRipples.push({ x: ev.pos.x, y: ev.pos.y, color: '#FACC15', timer: 0.9, maxTimer: 0.9, maxR: 38 });
          if (ev.minute >= 80 && Math.abs(st.homeScore - st.awayScore) <= 1 && !this.isPaused && this.speed >= 4) {
            if (this.savedSpeedBeforeSlowMo === null) {
              this.savedSpeedBeforeSlowMo = this.speed;
              this.speed = 1;
            }
            this.tacticSlowMoTimer = 1.4;
          }
          this.onGoalCallback?.(ev.team);
        } else if (ev.type === 'shot') {
          this.pitchRipples.push({ x: ev.pos.x, y: ev.pos.y, color: '#FDE047', timer: 0.45, maxTimer: 0.45, maxR: 16 });
          this.onImpactCallback?.(2.0, 0.10);
        } else if (ev.type === 'save') {
          this.pitchRipples.push({ x: ev.pos.x, y: ev.pos.y, color: '#38BDF8', timer: 0.55, maxTimer: 0.55, maxR: 22 });
          this.onImpactCallback?.(3.2, 0.14);
        } else if (ev.type === 'foul' || ev.type === 'yellow_card' || ev.type === 'red_card') {
          this.pitchRipples.push({
            x: ev.pos.x,
            y: ev.pos.y,
            color: ev.type === 'red_card' ? '#EF4444' : '#FBBF24',
            timer: 0.55,
            maxTimer: 0.55,
            maxR: 18,
          });
          if (ev.type === 'red_card') this.onImpactCallback?.(4.5, 0.22);
        }
        if (delta <= 6) {
          if (ev.type === 'goal') SoundEngine.playGoalCheer();
          else if (ev.type === 'shot') SoundEngine.playShot();
          else if (ev.type === 'save') SoundEngine.playSave();
          else if (ev.type === 'foul') SoundEngine.playWhistle('foul');
          else if (ev.type === 'yellow_card' || ev.type === 'red_card') SoundEngine.playCard();
          else if (ev.type === 'kickoff') SoundEngine.playWhistle('kickoff');
          else if (ev.type === 'halftime') SoundEngine.playWhistle('halftime');
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

    // 1. 顶部记分板与控制按钮
    drawRoundRect(ctx, 16, 14, 1248, 56, 10, 'rgba(11, 17, 30, 0.86)', THEME.BORDER);
    const phaseText =
      st.phase === 'first_half' ? '上半场' :
      st.phase === 'half_time' ? '中场休息' :
      st.phase === 'second_half' ? '下半场' : '全场结束';
    drawText(ctx, `${phaseText}  ${st.minute}'`, 34, 42, { size: 15, bold: true, color: THEME.GOLD_LIGHT, mono: true });
    const wInfo = WEATHER_INFO[st.weather ?? 'sunny'];
    drawBadge(ctx, 146, 32, 68, 20, wInfo.label, '#0F172A', wInfo.color);

    drawClubCrest(ctx, 272, 42, 13, homeClub);
    drawText(ctx, st.homeName + (this.userSide === 'home' ? ' (我)' : ''), 446, 42, {
      size: 16,
      bold: true,
      align: 'right',
      color: this.userSide === 'home' ? THEME.GOLD_LIGHT : THEME.TX1,
    });
    const scorePop = this.goalScorePopTimer > 0 ? 1 + 0.14 * Math.sin((this.goalScorePopTimer / 0.65) * Math.PI) : 1;
    ctx.save();
    ctx.translate(520, 42);
    ctx.scale(scorePop, scorePop);
    ctx.translate(-520, -42);
    if (this.goalScorePopTimer > 0) {
      ctx.shadowColor = 'rgba(250, 204, 21, 0.75)';
      ctx.shadowBlur = 14;
    }
    drawRoundRect(ctx, 462, 22, 116, 40, 8, THEME.BG_CARD, this.goalScorePopTimer > 0 ? THEME.GOLD_LIGHT : THEME.GOLD);
    drawText(ctx, `${st.homeScore} : ${st.awayScore}`, 520, 43, {
      size: 22,
      bold: true,
      align: 'center',
      color: this.goalScorePopTimer > 0 ? THEME.GOLD_LIGHT : THEME.TX1,
      mono: true,
    });
    ctx.restore();
    drawText(ctx, st.awayName + (this.userSide === 'away' ? ' (我)' : ''), 594, 42, {
      size: 16,
      bold: true,
      align: 'left',
      color: this.userSide === 'away' ? THEME.GOLD_LIGHT : THEME.TX1,
    });
    drawClubCrest(ctx, 742, 42, 13, awayClub);

    drawButton(ctx, hits, 764, 24, 86, 36, SoundEngine.getAudioModeLabel(), () => {
      SoundEngine.cycleAudioMode();
    }, { variant: 'ghost', fontSize: 11, icon: SoundEngine.muted ? 'sound_off' : 'sound_on' });

    if (st.phase === 'full_time') {
      drawButton(ctx, hits, 1060, 24, 190, 36, '比赛结束 · 进入复盘 ▶', () => {
        onMatchFinished(st);
      }, { variant: 'gold' });
    } else {
      drawButton(ctx, hits, 860, 24, 72, 36, this.isPaused ? '继续' : '暂停', () => {
        this.isPaused = !this.isPaused;
      }, { variant: this.isPaused ? 'green' : 'ghost' });

      [1, 2, 4, 8].forEach((sp, i) => {
        drawButton(ctx, hits, 940 + i * 44, 24, 38, 36, `${sp}x`, () => {
          this.speed = sp;
        }, { active: this.speed === sp });
      });

      drawButton(ctx, hits, 1126, 24, 124, 36, '快速完赛 ⏭', () => {
        this.engine!.simulateMatch();
      }, { variant: 'primary' });
    }

    // 2. 左侧文字直播
    drawRoundRect(ctx, 16, 84, 234, 620, 10, 'rgba(11, 17, 30, 0.86)', THEME.BORDER);
    drawText(ctx, '实时文字直播', 32, 108, { size: 14, bold: true, color: THEME.GOLD_LIGHT });
    const events = st.events.filter(e => e.type !== 'pass').slice(-18).reverse();
    let cy = 132;
    for (const ev of events) {
      const isGoal = ev.type === 'goal';
      const isSub = ev.type === 'substitution';
      const isCard = ev.type === 'yellow_card' || ev.type === 'red_card';
      const isMomentum = ev.narrativeTag === 'MOMENTUM';
      const isLull = ev.narrativeTag === 'LULL';

      const lineColor =
        isGoal ? '#FEF08A' :
        ev.type === 'red_card' ? '#FCA5A5' :
        ev.type === 'yellow_card' ? '#FDE047' :
        isMomentum ? '#7DD3FC' :
        isSub ? THEME.GREEN :
        isLull ? THEME.TX3 : THEME.TX1;

      const minColor =
        isGoal ? THEME.GOLD_LIGHT :
        isCard ? '#FBBF24' :
        isSub ? THEME.GREEN :
        isLull ? THEME.TX3 :
        ev.team === 'home' ? '#FCA5A5' : '#93C5FD';

      if (isGoal) {
        drawRoundRect(ctx, 22, cy - 4, 222, 42, 6, 'rgba(212,168,67,0.18)', 'rgba(212,168,67,0.45)');
      } else if (isMomentum) {
        drawRoundRect(ctx, 22, cy - 4, 222, 34, 6, 'rgba(56,189,248,0.12)');
      }

      drawText(ctx, `${ev.minute}'`, 28, cy + 7, {
        size: 11,
        bold: true,
        color: minColor,
        mono: true,
      });
      const lineCount = drawWrappedText(ctx, ev.text, 56, cy, 184, 14, {
        size: 11,
        bold: isGoal || isMomentum,
        color: lineColor,
        maxLines: 3,
      });
      cy += Math.max(24, lineCount * 14 + 10);
      if (cy > 682) break;
    }

    // 3. 中央 2D 球场
    const PITCH_RECT = { x: 266, y: 88, w: 748, h: 484 };
    const toScreen = (px: number, py: number) => ({
      x: PITCH_RECT.x + (px / PITCH.LENGTH) * PITCH_RECT.w,
      y: PITCH_RECT.y + (py / PITCH.WIDTH) * PITCH_RECT.h,
    });
    const toPitch = (sx: number, sy: number) => ({
      x: Math.max(3, Math.min(PITCH.LENGTH - 3, ((sx - PITCH_RECT.x) / PITCH_RECT.w) * PITCH.LENGTH)),
      y: Math.max(3, Math.min(PITCH.WIDTH - 3, ((sy - PITCH_RECT.y) / PITCH_RECT.h) * PITCH.WIDTH)),
    });

    // 若已选中我方球员，先注册球场空白区域点击（用于微调站位），后注册的球员圆点优先响应换位
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

    drawRoundRect(ctx, PITCH_RECT.x - 8, PITCH_RECT.y - 8, PITCH_RECT.w + 16, PITCH_RECT.h + 16, 12, '#0B1810', THEME.BORDER);
    const sw = PITCH_RECT.w / 10;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? THEME.BG_PITCH : THEME.BG_PITCH_ALT;
      ctx.fillRect(PITCH_RECT.x + i * sw, PITCH_RECT.y, sw, PITCH_RECT.h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.5;
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
    // 球门框线与禁区弧顶（进球时触发金色门框闪光与球网波纹）
    ctx.strokeRect(PITCH_RECT.x - 6, PITCH_RECT.y + (PITCH_RECT.h - goalH) / 2, 6, goalH);
    ctx.strokeRect(PITCH_RECT.x + PITCH_RECT.w, PITCH_RECT.y + (PITCH_RECT.h - goalH) / 2, 6, goalH);
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
    // 射门/扑救/犯规事件场上波纹反馈
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
      const hexToRgb = (h: string) => {
        const clean = h.replace('#', '');
        if (clean.length !== 6) return [128, 128, 128];
        return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
      };
      const dist = (a: string, b: string) => {
        const [r1, g1, b1] = hexToRgb(a);
        const [r2, g2, b2] = hexToRgb(b);
        return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
      };
      const candidates = ['#FACC15', '#E2E8F0', '#A855F7', '#EC4899', '#10B981'];
      const safe = candidates.filter(c => dist(c, homeHex) > 120 && dist(c, awayHex) > 120);
      const pool = safe.length >= 2 ? safe : candidates;
      return [pool[0], pool[1] ?? pool[0]];
    };
    const [homeGkColor, awayGkColor] = pickGkColors(homeClub.primaryColor, awayClub.primaryColor);

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

    const activeUserBuffs = (st.activeBuffs || []).filter(b => b.team === this.userSide);

    // 球员绘制（含脚下迷你体能条、黄牌、替补标记、Buff 光环、脉冲与飘字）
    for (const p of st.players) {
      if (p.redCard) continue;
      const rp = this.renderPlayers.get(p.id) || p.pos;
      const sp = toScreen(rp.x, rp.y);
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
      // 持续指挥卡 Buff 常驻微光环
      if (p.team === this.userSide && activeUserBuffs.length > 0) {
        const pLine = this.getLineOfRole(p.role);
        const buffed = activeUserBuffs.some(b => {
          const tl = b.effect.targetLine ?? 'ALL';
          return tl === 'ALL' || tl === pLine;
        });
        if (buffed) {
          ctx.save();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 14.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (p.hasBall) {
        ctx.strokeStyle = THEME.GOLD_LIGHT;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 13.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      const teamPrimary = p.team === 'home' ? homeClub.primaryColor : awayClub.primaryColor;
      const teamSecondary = p.team === 'home' ? homeClub.secondaryColor : awayClub.secondaryColor;
      const kitColor = p.role === 'GK' ? (p.team === 'home' ? homeGkColor : awayGkColor) : teamPrimary;
      const trimColor = p.role === 'GK' ? teamPrimary : teamSecondary;
      const isLightKit = kitColor === '#FACC15' || kitColor === '#E2E8F0';
      // 球员脚下柔和地面投影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + 8, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 球衣底色与双色竖条纹/肩章区分
      ctx.save();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = kitColor;
      ctx.fillRect(sp.x - 10, sp.y - 10, 20, 20);
      ctx.fillStyle = trimColor;
      ctx.globalAlpha = 0.85;
      if (p.team === 'home') {
        ctx.fillRect(sp.x - 2.2, sp.y - 10, 4.4, 20);
      } else {
        ctx.fillRect(sp.x - 10, sp.y - 10, 4.5, 9);
        ctx.fillRect(sp.x + 5.5, sp.y - 10, 4.5, 9);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = p.role === 'GK' ? 2.6 : 1.6;
      ctx.stroke();
      // 球员朝向小箭头（速度方向，静止时朝向足球）
      const speedMag = Math.hypot(p.vel.x, p.vel.y);
      const ang = speedMag > 0.4
        ? Math.atan2(p.vel.y, p.vel.x)
        : Math.atan2(st.ball.pos.y - p.pos.y, st.ball.pos.x - p.pos.x);
      ctx.save();
      ctx.fillStyle = trimColor;
      ctx.beginPath();
      ctx.moveTo(sp.x + Math.cos(ang) * 13.5, sp.y + Math.sin(ang) * 13.5);
      ctx.lineTo(sp.x + Math.cos(ang + 0.35) * 9.5, sp.y + Math.sin(ang + 0.35) * 9.5);
      ctx.lineTo(sp.x + Math.cos(ang - 0.35) * 9.5, sp.y + Math.sin(ang - 0.35) * 9.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawText(ctx, String(p.shirtNumber), sp.x, sp.y + 0.5, {
        size: 9,
        bold: true,
        align: 'center',
        color: isLightKit ? '#0F172A' : '#FFFFFF',
      });
      drawText(ctx, p.role, sp.x, sp.y + 16, { size: 9, color: p.customOffset ? '#38BDF8' : 'rgba(241,245,249,0.85)', align: 'center' });

      if (p.yellowCards > 0) {
        drawRoundRect(ctx, sp.x + 8, sp.y - 12, 6, 8, 1, '#FACC15', '#080C14', 0.8);
      }
      if (p.isCaptain) {
        drawRoundRect(ctx, sp.x + 7, sp.y + 3, 10, 10, 2, '#FACC15', '#080C14', 0.8);
        drawText(ctx, 'C', sp.x + 12, sp.y + 8, { size: 7.5, bold: true, color: '#080C14', align: 'center' });
      }
      if (p.subbedIn) {
        drawText(ctx, '↑', sp.x - 12, sp.y - 8, { size: 10, bold: true, color: THEME.GREEN, align: 'center' });
      }

      // 体能条
      const fitRatio = Math.max(0, Math.min(1, p.fitness / 100));
      const fitColor = fitRatio > 0.65 ? THEME.GREEN : fitRatio > 0.42 ? THEME.GOLD_LIGHT : THEME.RED_LIGHT;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sp.x - 10, sp.y - 16, 20, 3);
      ctx.fillStyle = fitColor;
      ctx.fillRect(sp.x - 10, sp.y - 16, 20 * fitRatio, 3);

      // 点击我方场上球员：选中 -> 再点队友换位，或点球场空白处微调站位
      if (p.team === this.userSide && st.phase !== 'full_time') {
        hits.add(sp.x - 14, sp.y - 14, 28, 28, () => {
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

    // 脉冲波纹与头顶属性飘字渲染（不挡视线，自动消散）
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
      drawText(ctx, ft.text, sp.x, sp.y - 22 - liftY, {
        size: 10,
        bold: true,
        color: ft.color,
        align: 'center',
      });
      ctx.restore();
    }

    if (this.selectedPitchPlayerId) {
      const selP = st.players.find(pl => pl.id === this.selectedPitchPlayerId);
      if (selP) {
        drawRoundRect(ctx, 380, 540, 520, 26, 6, 'rgba(8,12,20,0.9)', '#38BDF8', 1.2);
        drawText(ctx, `已选【${selP.name} · ${selP.role}】点击队友立即换位，或点击球场微调站位 (ESC取消)`, 640, 553, {
          size: 11,
          bold: true,
          color: '#7DD3FC',
          align: 'center',
        });
      }
    }

    // 足球与 Z 阴影
    const sb = toScreen(this.renderBall.x, this.renderBall.y);
    const zLift = Math.max(0, Math.min(18, this.renderBall.z * 3.5));
    const ballRadius = Math.max(2, 5 + zLift * 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(sb.x, sb.y + 2, 5.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sb.x, sb.y - zLift, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 2D 球场转播级天气光学氛围层（纯光影渐变 + 细长高速雨丝，零噪点）
    const weatherKind = st.weather ?? 'sunny';
    const wt = this.elapsedSec;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
    ctx.clip();
    if (weatherKind === 'rain') {
      // 夜间湿冷蓝调压暗 + 四角微暗晕影
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
      // 极细极淡高速斜向长雨丝
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
      // 极淡大尺度长气流光带横掠球场（无扭动短线）
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
      // 柔和琥珀暖阳边缘晕影 + 微弱暖光呼吸（零噪点）
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
      // sunny: 球场左上角柔和斜向暖阳丁达尔光束
      const sGrad = ctx.createLinearGradient(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.x + PITCH_RECT.w * 0.6, PITCH_RECT.y + PITCH_RECT.h);
      sGrad.addColorStop(0, 'rgba(254, 240, 138, 0.09)');
      sGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.03)');
      sGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = sGrad;
      ctx.fillRect(PITCH_RECT.x, PITCH_RECT.y, PITCH_RECT.w, PITCH_RECT.h);
    }
    ctx.restore();

    // 进球高光横幅 & 指挥卡连锁/隐藏词条觉醒广播条
    if (this.goalBanner) {
      drawRoundRect(ctx, 430, 102, 420, 44, 10, 'rgba(14,22,40,0.92)', THEME.GOLD_LIGHT, 2);
      drawText(ctx, this.goalBanner.text, 640, 124, {
        size: 18,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
      if (this.memoryHighlightTimer > 0) {
        drawBadge(ctx, 560, 152, 160, 22, '★ 载入赛季记忆', '#78350F', '#FEF08A');
      }
    } else if (this.cardBanner) {
      drawRoundRect(ctx, 390, 102, 500, 38, 10, 'rgba(14,22,40,0.92)', this.cardBanner.color, 1.8);
      drawText(ctx, this.cardBanner.text, 640, 121, {
        size: 14,
        bold: true,
        color: this.cardBanner.color,
        align: 'center',
      });
    }

    // 中场休息浮层提示（含体能最低球员一键快捷换人）
    if (st.phase === 'half_time' && this.isPaused) {
      drawRoundRect(ctx, 390, 246, 500, 152, 12, 'rgba(8,12,20,0.94)', THEME.GOLD, 1.5);
      drawText(ctx, `中场休息 · ${st.homeScore} : ${st.awayScore}`, 640, 280, {
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
        312,
        { size: 12, color: THEME.TX2, align: 'center' }
      );
      if (tiredPlayer && availSubs.length > 0 && subsUsedNow < 5) {
        const bestSub = availSubs[0];
        drawButton(ctx, hits, 416, 344, 240, 36, `换下 ${tiredPlayer.name.slice(0, 4)} → ${bestSub.name.slice(0, 4)}`, () => {
          this.engine!.substitute(this.userSide, tiredPlayer.id, bestSub.id);
        }, { variant: 'primary', fontSize: 11, icon: 'refresh' });
        drawButton(ctx, hits, 672, 344, 192, 36, '开始下半场 ▶', () => {
          this.isPaused = false;
        }, { variant: 'gold', fontSize: 13 });
      } else {
        drawButton(ctx, hits, 550, 344, 180, 36, '开始下半场 ▶', () => {
          this.isPaused = false;
        }, { variant: 'gold' });
      }
    }

    // 场上生效中的指挥卡倒计时标签
    const userBuffs = (st.activeBuffs || []).filter(b => b.team === this.userSide);
    userBuffs.slice(0, 2).forEach((bf, bi) => {
      const bx = 278 + bi * 194;
      drawRoundRect(ctx, bx, 96, 186, 24, 5, 'rgba(14,22,40,0.85)', THEME.GOLD_LIGHT);
      drawText(ctx, `🃏 ${bf.name} (${Math.max(1, bf.endMinute - st.minute)}')`, bx + 93, 108, {
        size: 11,
        bold: true,
        color: THEME.GOLD_LIGHT,
        align: 'center',
      });
    });

    // 0.25x 子弹时间主动技免费触发横幅
    if (st.activeSkillPrompt && st.phase !== 'full_time') {
      const prm = st.activeSkillPrompt;
      const remTicks = Math.max(0, prm.expiresTick - st.tick);
      const ratio = Math.max(0.05, Math.min(1, remTicks / 12));
      const bx = 328;
      const by = 486;
      const bw = 624;
      const bh = 74;
      drawChamferPanel(ctx, bx, by, bw, bh, 10, 'rgba(8, 15, 32, 0.95)', prm.isCardBoosted ? THEME.GOLD_LIGHT : '#38BDF8', 2);
      drawBadge(ctx, bx + 12, by + 10, 96, 20, '⚡ 0.25x 子弹时间', '#0C4A6E', '#7DD3FC');
      drawBadge(ctx, bx + 114, by + 10, 68, 20, '免费点按', '#14532D', THEME.GREEN);
      if (prm.isCardBoosted) {
        drawBadge(ctx, bx + 188, by + 10, 118, 20, '卡牌共振 +35%威力', '#78350F', THEME.GOLD_LIGHT);
      }
      drawText(ctx, prm.name, bx + (prm.isCardBoosted ? 314 : 192), by + 20, { size: 15, bold: true, color: THEME.GOLD_LIGHT });
      drawText(ctx, `${prm.situationLabel} · ${prm.powerLabel}`, bx + 14, by + 46, { size: 11, color: THEME.TX1 });

      drawRoundRect(ctx, bx + 14, by + 62, bw - 28, 4, 2, '#1E293B');
      drawRoundRect(ctx, bx + 14, by + 62, Math.round((bw - 28) * ratio), 4, 2, prm.isCardBoosted ? THEME.GOLD_LIGHT : '#38BDF8');

      drawButton(ctx, hits, bx + bw - 196, by + 16, 122, 36, '⚡ 立即释放 (F)', () => {
        const res = this.engine!.triggerActiveSkill(this.userSide, prm.skillId);
        if (res.ok) {
          SoundEngine.playCommandCard(false);
          this.cardBanner = {
            text: res.boosted
              ? `⚡ 卡牌共振技能释放 · ${prm.name} (+35%威力)`
              : `⚡ 子弹时间技能释放 · ${prm.name}`,
            color: res.boosted ? THEME.GOLD_LIGHT : '#38BDF8',
            timer: 2.2,
          };
        }
      }, { variant: 'gold', fontSize: 11.5 });
      drawButton(ctx, hits, bx + bw - 68, by + 16, 54, 36, '跳过', () => {
        this.engine!.dismissActiveSkillPrompt();
      }, { variant: 'ghost', fontSize: 11 });
    }

    // 4. 底部栏：左侧 4 套预置战术快捷控场 + 右侧 4 张教练指挥手牌
    drawRoundRect(ctx, 266, 592, 412, 112, 10, 'rgba(11, 17, 30, 0.86)', THEME.BORDER);
    const curForm = this.userSide === 'home' ? st.homeFormation : st.awayFormation;
    const curStyle = this.userSide === 'home' ? st.homeStyle : st.awayStyle;
    drawText(ctx, `预置战术 (${curForm} · ${TACTICAL_PRESETS[curStyle].name})`, 280, 610, { size: 11, bold: true, color: THEME.GOLD_LIGHT });
    if (st.phase !== 'full_time') {
      drawButton(ctx, hits, 576, 597, 92, 22, '细致调整 ⚙', () => {
        this.openTacticalModal(st);
      }, { variant: 'primary', fontSize: 10 });
    }

    this.matchPresets.slice(0, 4).forEach((pr, pi) => {
      const col = pi % 2;
      const row = Math.floor(pi / 2);
      const bx = 278 + col * 196;
      const by = 626 + row * 37;
      const isAct = curForm === pr.formation && curStyle === pr.style;
      const label = `${pi + 1}.${pr.name.slice(0, 4)} (${pr.formation}·${TACTICAL_PRESETS[pr.style].name.slice(0, 2)})`;
      drawButton(ctx, hits, bx, by, 188, 32, label, () => {
        this.engine!.setTactics(this.userSide, pr.formation, pr.style);
        this.triggerTacticsFeedback(pr.formation, pr.style);
        this.cardBanner = { text: `预案切换 · ${pr.name} (${pr.formation} · ${TACTICAL_PRESETS[pr.style].name})`, color: '#38BDF8', timer: 2.0 };
      }, { active: isAct, variant: isAct ? 'primary' : 'ghost', fontSize: 10 });
    });

    // 教练指挥手牌区（触屏点击预览 + 二次点击或确认打出）
    const cmdBackImg = AssetLoader.get('command_card_back');
    drawRoundRect(ctx, 686, 592, 328, 112, 10, 'rgba(11, 17, 30, 0.86)', THEME.BORDER_GOLD);
    drawText(ctx, `教练手牌 (能量 ${this.tacticalEnergy}) · 点选预览`, 700, 611, { size: 11, bold: true, color: THEME.GOLD_LIGHT });
    let previewCard: { card: CommandCard; x: number; y: number; canPlay: boolean } | null = null;
    this.handCards.slice(0, 4).forEach((card, ci) => {
      const col = ci % 2;
      const row = Math.floor(ci / 2);
      const cx = 698 + col * 154;
      const cy = 626 + row * 37;
      const used = this.usedCardIds.has(card.id);
      const canPlay = !used && st.phase !== 'full_time' && this.tacticalEnergy >= card.cost;
      const isSelected = this.selectedCardId === card.id;
      const isHovered = hits.isHovered(cx, cy, 148, 32);
      if (isSelected || (isHovered && !this.selectedCardId)) {
        previewCard = { card, x: cx, y: cy, canPlay };
      }
      const lift = (isSelected || (isHovered && canPlay)) ? -3 : 0;
      drawRoundRect(
        ctx,
        cx,
        cy + lift,
        148,
        32,
        6,
        used ? '#111827' : isSelected ? '#243B68' : isHovered ? '#1F2F52' : THEME.BG_CARD,
        isSelected ? THEME.GREEN : canPlay ? (isHovered ? THEME.GOLD_LIGHT : THEME.GOLD) : THEME.BORDER,
        isSelected || isHovered ? 1.8 : 1
      );
      if (!used && cmdBackImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx + 2, cy + lift + 2, 144, 28);
        ctx.clip();
        ctx.globalAlpha = canPlay ? 0.34 : 0.14;
        ctx.drawImage(cmdBackImg, cx, cy + lift - 10, 148, 52);
        ctx.restore();
      }
      if (!used) {
        drawRoundRect(ctx, cx + 1, cy + lift + 4, 3, 24, 1, isSelected ? THEME.GREEN : canPlay ? THEME.GOLD_LIGHT : '#475569');
      }
      drawBadge(ctx, cx + 7, cy + lift + 7, 25, 18, `E${card.cost}`, canPlay ? '#1E3A5F' : '#1E293B', canPlay ? THEME.GOLD_LIGHT : THEME.TX3);
      drawText(ctx, card.name.slice(0, 6), cx + 37, cy + lift + 11, { size: 10, bold: true, color: used ? THEME.TX3 : THEME.TX1 });
      drawText(ctx, used ? '已打出' : isSelected ? '再点打出' : card.summary.slice(0, 10), cx + 37, cy + lift + 23, {
        size: 9,
        color: used ? THEME.TX3 : isSelected ? THEME.GOLD_LIGHT : THEME.GREEN,
      });
      if (canPlay) {
        hits.add(cx, cy, 148, 32, () => {
          if (this.selectedCardId === card.id) {
            this.tacticalEnergy -= card.cost;
            this.usedCardIds.add(card.id);
            this.selectedCardId = null;
            const res = this.engine!.applyCommandCard(this.userSide, card);
            if (res.energyRefund) this.tacticalEnergy += res.energyRefund;
            this.triggerCardFeedback(card);
            this.cardBanner = {
              text: card.chainEffect
                ? `指挥卡连锁触发 · ${card.name} (${card.chainEffect.label})`
                : card.isCorrupted
                ? `双刃剑指挥 · ${card.name} 生效（伴随反噬）`
                : `战术指挥生效 · ${card.name}`,
              color: card.isCorrupted ? '#FCA5A5' : card.chainEffect ? '#C084FC' : THEME.GOLD_LIGHT,
              timer: 2.2,
            };
            SoundEngine.playCommandCard(!!card.isCorrupted);
          } else {
            this.selectedCardId = card.id;
          }
        });
      }
    });

    if (previewCard) {
      const { card, x, y, canPlay } = previewCard as { card: CommandCard; x: number; y: number; canPlay: boolean };
      const tx = Math.min(716, Math.max(270, x - 40));
      const ty = y - 92;
      drawRoundRect(ctx, tx, ty, 290, 84, 8, 'rgba(8,12,20,0.96)', this.selectedCardId === card.id ? THEME.GREEN : THEME.GOLD_LIGHT, 1.5);
      if (cmdBackImg && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(tx + 2, ty + 2, 286, 80);
        ctx.clip();
        ctx.globalAlpha = 0.22;
        ctx.drawImage(cmdBackImg, tx, ty - 20, 290, 120);
        ctx.restore();
      }
      const pElem = (card.recipeKey?.split('+')[0] as ElementId | undefined)
        ?? (card.id.includes('press') ? 'press' : 'pass');
      const pElemImg = AssetLoader.get(`elem_${pElem}`);
      if (pElemImg && typeof ctx.drawImage === 'function') {
        ctx.drawImage(pElemImg, tx + 10, ty + 10, 22, 22);
      }
      drawText(ctx, `Lv.${card.level ?? 1} ${card.name}  (能量 ${card.cost})`, tx + (pElemImg ? 36 : 12), ty + 20, {
        size: 13,
        bold: true,
        color: card.isCorrupted ? '#FCA5A5' : THEME.GOLD_LIGHT,
      });
      drawWrappedText(ctx, card.summary, tx + 12, ty + 38, 266, 16, {
        size: 11,
        color: THEME.TX1,
        maxLines: 2,
      });
      if (this.selectedCardId === card.id && canPlay) {
        drawButton(ctx, hits, tx + 188, ty + 10, 90, 24, '确认打出', () => {
          this.tacticalEnergy -= card.cost;
          this.usedCardIds.add(card.id);
          this.selectedCardId = null;
          const res = this.engine!.applyCommandCard(this.userSide, card);
          if (res.energyRefund) this.tacticalEnergy += res.energyRefund;
          this.triggerCardFeedback(card);
          this.cardBanner = {
            text: card.chainEffect
              ? `指挥卡连锁触发 · ${card.name} (${card.chainEffect.label})`
              : card.isCorrupted
              ? `双刃剑指挥 · ${card.name} 生效（伴随反噬）`
              : `战术指挥生效 · ${card.name}`,
            color: card.isCorrupted ? '#FCA5A5' : card.chainEffect ? '#C084FC' : THEME.GOLD_LIGHT,
            timer: 2.2,
          };
          SoundEngine.playCommandCard(!!card.isCorrupted);
        }, { variant: 'green', fontSize: 10, icon: 'check' });
      }
    }

    // 5. 右侧面板：实时统计 + 换人/战术调整独立页入口
    drawRoundRect(ctx, 1030, 84, 234, 620, 10, 'rgba(11, 17, 30, 0.86)', THEME.BORDER);
    const subsUsed = this.userSide === 'home' ? st.homeSubsUsed : st.awaySubsUsed;
    drawButton(ctx, hits, 1042, 96, 92, 28, '实时统计', () => {
      this.rightTab = 'stats';
    }, { active: this.rightTab === 'stats', fontSize: 11 });
    drawButton(ctx, hits, 1140, 96, 114, 28, `换人/战术 (${subsUsed}/5)`, () => {
      if (st.phase !== 'full_time') this.openTacticalModal(st);
    }, { variant: 'gold', disabled: st.phase === 'full_time', fontSize: 10 });

    if (this.rightTab === 'stats') {
      const h = st.stats.home;
      const a = st.stats.away;
      const tot = h.possessionTicks + a.possessionTicks || 1;
      const hPoss = Math.round((h.possessionTicks / tot) * 100);
      const hAcc = h.passes > 0 ? Math.round((h.passesSuccess / h.passes) * 100) : 0;
      const aAcc = a.passes > 0 ? Math.round((a.passesSuccess / a.passes) * 100) : 0;

      const rows: Array<[string, string, string, number]> = [
        ['控球率', `${hPoss}%`, `${100 - hPoss}%`, hPoss / 100],
        ['射门 (射正)', `${h.shots} (${h.shotsOnTarget})`, `${a.shots} (${a.shotsOnTarget})`, h.shots / Math.max(1, h.shots + a.shots)],
        ['预期进球 xG', h.xG.toFixed(2), a.xG.toFixed(2), h.xG / Math.max(0.01, h.xG + a.xG)],
        ['传球 (成功率)', `${h.passes} (${hAcc}%)`, `${a.passes} (${aAcc}%)`, h.passes / Math.max(1, h.passes + a.passes)],
        ['抢断', `${h.tackles}`, `${a.tackles}`, h.tackles / Math.max(1, h.tackles + a.tackles)],
        ['拦截', `${h.interceptions}`, `${a.interceptions}`, h.interceptions / Math.max(1, h.interceptions + a.interceptions)],
        ['扑救', `${h.saves}`, `${a.saves}`, h.saves / Math.max(1, h.saves + a.saves)],
        ['角球', `${h.corners}`, `${a.corners}`, h.corners / Math.max(1, h.corners + a.corners)],
        ['犯规 (黄牌)', `${h.fouls} (${h.yellowCards})`, `${a.fouls} (${a.yellowCards})`, h.fouls / Math.max(1, h.fouls + a.fouls)],
      ];

      let ry = 152;
      for (const [label, hv, av, ratio] of rows) {
        drawText(ctx, hv, 1046, ry, { size: 12, bold: true, mono: true });
        drawText(ctx, av, 1248, ry, { size: 12, bold: true, align: 'right', mono: true });
        drawText(ctx, label, 1147, ry, { size: 11, color: THEME.TX2, align: 'center' });
        drawRoundRect(ctx, 1046, ry + 11, 202, 5, 2, '#1E293B');
        const r = Math.max(0.05, Math.min(0.95, isNaN(ratio) ? 0.5 : ratio));
        drawRoundRect(ctx, 1046, ry + 11, 202 * r, 5, 2, THEME.RED);
        drawRoundRect(ctx, 1046 + 202 * r, ry + 11, 202 * (1 - r), 5, 2, THEME.BLUE);
        ry += 58;
      }
    } else {
      // 临场换人面板
      drawText(ctx, '1. 点选场上球员换下', 1044, 142, { size: 11, color: THEME.GOLD_LIGHT });
      const onPitch = st.players
        .filter(p => p.team === this.userSide && !p.redCard)
        .sort((a, b) => a.fitness - b.fitness); // 体能最低排最前方便换下

      onPitch.slice(0, 11).forEach((p, i) => {
        const py = 156 + i * 28;
        const sel = this.selectedOutId === p.id;
        drawRoundRect(ctx, 1040, py, 214, 24, 4, sel ? '#3B1E24' : THEME.BG_CARD, sel ? THEME.RED_LIGHT : THEME.BORDER);
        drawBadge(ctx, 1044, py + 4, 30, 16, p.role, '#1E293B', THEME.TX2);
        drawText(ctx, p.name.slice(0, 6), 1080, py + 12, { size: 11 });
        drawText(ctx, `${Math.round(p.fitness)}%`, 1246, py + 12, {
          size: 11,
          bold: true,
          color: p.fitness < 55 ? THEME.RED_LIGHT : THEME.GREEN,
          align: 'right',
          mono: true,
        });
        hits.add(1040, py, 214, 24, () => {
          this.selectedOutId = p.id;
        });
      });

      drawText(ctx, this.selectedOutId ? '2. 点击替补登场' : '2. 替补席 (先选换下人)', 1044, 480, {
        size: 11,
        color: this.selectedOutId ? THEME.GREEN : THEME.TX2,
      });
      const subs = this.userSide === 'home' ? st.homeSubs : st.awaySubs;
      subs.slice(0, 5).forEach((sub, i) => {
        const sy = 494 + i * 38;
        const canSub = !!this.selectedOutId && subsUsed < 5;
        drawRoundRect(ctx, 1040, sy, 214, 32, 5, THEME.BG_CARD, canSub ? THEME.GREEN : THEME.BORDER);
        drawBadge(ctx, 1044, sy + 7, 32, 18, sub.role, '#1E293B', THEME.TX2);
        drawText(ctx, sub.name.slice(0, 6), 1082, sy + 16, { size: 11, bold: true });
        drawText(ctx, `${sub.traits?.[0] || ''}`, 1246, sy + 16, { size: 10, color: '#60A5FA', align: 'right' });
        if (canSub) {
          hits.add(1040, sy, 214, 32, () => {
            this.engine!.substitute(this.userSide, this.selectedOutId!, sub.id);
            this.selectedOutId = null;
          });
        }
      });
    }

    if (this.kickoffIntroTimer > 0) {
      this.renderKickoffOverlay(ctx, hits, st, homeClub, awayClub);
    }

    if (this.tacticalModalOpen) {
      this.renderTacticalModal(ctx, hits, st);
    }
  }

  private openTacticalModal(st: MatchState): void {
    this.wasPausedBeforeModal = this.isPaused;
    this.isPaused = true;
    this.draftForm = this.userSide === 'home' ? st.homeFormation : st.awayFormation;
    this.draftStyle = this.userSide === 'home' ? st.homeStyle : st.awayStyle;
    this.modalSysTab = getDefenseSystem(this.draftForm);
    this.modalSelectedPitchId = null;
    this.selectedOutId = null;
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

    drawText(ctx, `场内细致战术与换人调整 · 第 ${st.minute}' 分钟`, mx + 24, my + 28, { size: 19, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, this.modalBanner, mx + 24, my + 52, { size: 11, color: '#7DD3FC' });

    drawButton(ctx, hits, mx + mw - 300, my + 16, 92, 34, '取消', () => {
      this.tacticalModalOpen = false;
      this.isPaused = this.wasPausedBeforeModal;
    }, { variant: 'ghost', fontSize: 12 });

    drawButton(ctx, hits, mx + mw - 196, my + 16, 174, 34, '💾 保存并返回比赛 ▶', () => {
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
    }, { variant: 'gold', fontSize: 12 });

    drawChamferPanel(ctx, 40, 82, 304, 604, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, '1. 阵型体系 (4/3/5后卫)', 56, 102, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    SYS_CYCLE.forEach((sys, si) => {
      const lbl = sys === '4-back' ? '四后卫(8)' : sys === '3-back' ? '三后卫(4)' : '五后卫(4)';
      drawButton(ctx, hits, 56 + si * 92, 118, 86, 24, lbl, () => {
        this.modalSysTab = sys;
      }, { active: this.modalSysTab === sys, fontSize: 10 });
    });
    const sysForms = FORMATION_SYSTEMS[this.modalSysTab].formations;
    sysForms.forEach((f, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawButton(ctx, hits, 56 + col * 138, 150 + row * 28, 130, 24, f, () => {
        this.draftForm = f;
        this.modalSysTab = getDefenseSystem(f);
      }, { active: this.draftForm === f, fontSize: 11 });
    });

    drawText(ctx, '2. 战术风格', 56, 272, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    STYLES_SHORT.forEach((s, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawButton(ctx, hits, 56 + col * 138, 288 + row * 34, 130, 28, TACTICAL_PRESETS[s].name, () => {
        this.draftStyle = s;
      }, { active: this.draftStyle === s, fontSize: 11 });
    });

    const pr = TACTICAL_PRESETS[this.draftStyle];
    drawRoundRect(ctx, 56, 398, 272, 92, 8, 'rgba(11, 17, 30, 0.85)', THEME.BORDER_GOLD);
    drawText(ctx, `${this.draftForm} · ${pr.name}`, 68, 414, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, `防线 ${pr.lineHeight >= 0 ? '+' : ''}${pr.lineHeight}m · 逼抢 ${Math.round(pr.pressIntensity * 100)}%`, 68, 438, { size: 11, color: '#38BDF8', mono: true });
    drawText(ctx, `节奏 ${pr.tempo.toFixed(2)}x · 直传倾角 ${Math.round(pr.directness * 100)}%`, 68, 460, { size: 11, color: THEME.GREEN, mono: true });

    drawText(ctx, '3. 快速套用赛前预案', 56, 510, { size: 12, bold: true, color: THEME.GOLD_LIGHT });
    this.matchPresets.slice(0, 4).forEach((pre, pi) => {
      const col = pi % 2;
      const row = Math.floor(pi / 2);
      drawButton(ctx, hits, 56 + col * 138, 528 + row * 40, 130, 32, `${pre.name.slice(0, 4)} (${pre.formation})`, () => {
        this.draftForm = pre.formation;
        this.draftStyle = pre.style;
        this.modalSysTab = getDefenseSystem(pre.formation);
        this.modalBanner = `已套用预案【${pre.name}】：${pre.formation} · ${TACTICAL_PRESETS[pre.style].name}`;
      }, { active: this.draftForm === pre.formation && this.draftStyle === pre.style, fontSize: 10 });
    });

    const px = 356, py = 82, pw = 514, ph = 604;
    drawChamferPanel(ctx, px, py, pw, ph, 10, '#0B1810', THEME.BORDER);
    drawText(ctx, '场上 11 人换位 & 站位微调（点两人互换，点空位微调）', px + 16, py + 20, { size: 11, bold: true, color: this.modalSelectedPitchId ? THEME.GREEN : THEME.GOLD_LIGHT });
    drawButton(ctx, hits, px + pw - 96, py + 8, 84, 24, '重置默认站位', () => {
      this.engine!.resetPlayerOffsets(this.userSide);
      this.modalSelectedPitchId = null;
      this.modalBanner = '已重置全队场上站位为当前阵型默认坐标';
    }, { variant: 'ghost', fontSize: 10 });

    const pitchX = px + 20, pitchY = py + 42, pitchW = pw - 40, pitchH = ph - 58;
    const stripeH = pitchH / 8;
    for (let si = 0; si < 8; si++) {
      ctx.fillStyle = si % 2 === 0 ? THEME.BG_PITCH : THEME.BG_PITCH_ALT;
      ctx.fillRect(pitchX, pitchY + si * stripeH, pitchW, stripeH);
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
      const fitCol = p.fitness < 50 ? THEME.RED_LIGHT : p.fitness < 70 ? THEME.GOLD_LIGHT : THEME.GREEN;

      drawRoundRect(ctx, sx - 38, sy - 26, 76, 52, 7, isSel ? '#1E3A5F' : 'rgba(14, 22, 40, 0.92)', isSel ? '#38BDF8' : p.customOffset ? '#38BDF8' : THEME.GOLD, isSel ? 2 : 1);
      drawText(ctx, `${slot.role} #${p.shirtNumber}`, sx, sy - 14, { size: 9, bold: true, color: THEME.GOLD_LIGHT, align: 'center' });
      if (p.isCaptain) {
        drawBadge(ctx, sx + 22, sy - 25, 14, 12, 'C', '#FACC15', '#080C14');
      }
      drawText(ctx, p.name.slice(0, 5), sx, sy + 1, { size: 11, bold: true, color: THEME.TX1, align: 'center' });
      drawRoundRect(ctx, sx - 26, sy + 13, 52, 5, 2, '#1E293B');
      drawRoundRect(ctx, sx - 26, sy + 13, Math.round(52 * Math.max(0.1, p.fitness / 100)), 5, 2, fitCol);

      hits.add(sx - 38, sy - 26, 76, 52, () => {
        SoundEngine.playClick();
        if (!this.modalSelectedPitchId) {
          this.modalSelectedPitchId = p.id;
          this.selectedOutId = p.id;
          this.modalBanner = `已选中【${p.name}】：点另一队友换位，点球场空位微调站位，或点右侧替补直接换下！`;
        } else if (this.modalSelectedPitchId === p.id) {
          this.modalSelectedPitchId = null;
          this.selectedOutId = null;
        } else {
          const prevP = onPitch.find(x => x.id === this.modalSelectedPitchId);
          if (prevP && this.engine!.swapPlayerSlots(this.userSide, prevP.id, p.id)) {
            this.modalBanner = `场上换位完成：${prevP.name} ⇄ ${p.name}`;
          }
          this.modalSelectedPitchId = null;
          this.selectedOutId = null;
        }
      });
    });

    const subsUsed = this.userSide === 'home' ? st.homeSubsUsed : st.awaySubsUsed;
    drawChamferPanel(ctx, 884, 82, 356, 604, 10, THEME.BG_CARD, THEME.BORDER);
    drawText(ctx, `临场换人 (已用 ${subsUsed}/5 名额)`, 900, 102, { size: 13, bold: true, color: THEME.GOLD_LIGHT });
    drawText(ctx, '1. 点选体能不足的场上球员换下', 900, 122, { size: 10, color: THEME.TX2 });

    const sortedPitch = [...onPitch].sort((a, b) => a.fitness - b.fitness);
    sortedPitch.slice(0, 11).forEach((p, i) => {
      const ry = 134 + i * 22;
      const sel = this.selectedOutId === p.id;
      const pTag = this.storyTags.get(p.id);
      const pCa = this.playerCaMap.get(p.id);
      drawRoundRect(ctx, 898, ry, 328, 20, 4, sel ? '#3B1E24' : 'rgba(11, 17, 30, 0.85)', sel ? THEME.RED_LIGHT : THEME.BORDER);
      drawBadge(ctx, 902, ry + 2, 32, 16, p.role, '#1E293B', THEME.TX2);
      drawText(ctx, `${p.name.slice(0, 5)}`, 938, ry + 10, { size: 10.5, bold: sel, color: THEME.TX1 });
      if (p.isCaptain) {
        drawBadge(ctx, 996, ry + 2, 18, 16, 'C', '#FACC15', '#080C14');
      }
      if (pTag) {
        drawBadge(ctx, p.isCaptain ? 1018 : 996, ry + 2, 48, 16, pTag, '#312E81', '#C4B5FD');
      }
      drawText(ctx, `${pCa ? 'CA' + pCa + ' · ' : ''}体${Math.round(p.fitness)}%`, 1220, ry + 10, { size: 10, bold: true, color: p.fitness < 55 ? THEME.RED_LIGHT : p.fitness < 72 ? THEME.GOLD_LIGHT : THEME.GREEN, align: 'right', mono: true });
      hits.add(898, ry, 328, 20, () => {
        SoundEngine.playClick();
        this.selectedOutId = sel ? null : p.id;
        this.modalSelectedPitchId = this.selectedOutId;
      });
    });

    const allSubs = this.userSide === 'home' ? st.homeSubs : st.awaySubs;
    const matchBenchPos = (role: string) => {
      if (this.benchFilter === 'ALL') return true;
      if (this.benchFilter === 'GK') return role === 'GK';
      if (this.benchFilter === 'DEF') return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(role);
      if (this.benchFilter === 'MID') return ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(role);
      return ['LW', 'RW', 'ST'].includes(role);
    };
    const filteredSubs = [...allSubs]
      .filter(s => matchBenchPos(s.role))
      .sort((a, b) => {
        const ga = a.role === 'GK' ? 1 : 0;
        const gb = b.role === 'GK' ? 1 : 0;
        if (ga !== gb) return ga - gb;
        return (b.fitness ?? 100) - (a.fitness ?? 100);
      });

    drawText(ctx, this.selectedOutId ? `2. 点击替补登场 (${filteredSubs.length}人) ▶` : `2. 替补席 (共${allSubs.length}人 · 点选过滤)`, 900, 392, { size: 11, bold: !!this.selectedOutId, color: this.selectedOutId ? THEME.GREEN : THEME.GOLD_LIGHT });

    const bFilters: Array<['ALL' | 'ATT' | 'MID' | 'DEF' | 'GK', string]> = [['ALL', `全部(${allSubs.length})`], ['ATT', '前锋'], ['MID', '中场'], ['DEF', '后卫'], ['GK', '门将']];
    bFilters.forEach(([fk, fl], fi) => {
      drawButton(ctx, hits, 898 + fi * 66, 406, 62, 22, fl, () => {
        this.benchFilter = fk;
        this.benchPage = 0;
      }, { active: this.benchFilter === fk, fontSize: 9.5 });
    });

    const bPageSize = 5;
    const bTotalPages = Math.max(1, Math.ceil(filteredSubs.length / bPageSize));
    if (this.benchPage >= bTotalPages) this.benchPage = bTotalPages - 1;
    const visibleSubs = filteredSubs.slice(this.benchPage * bPageSize, (this.benchPage + 1) * bPageSize);

    visibleSubs.forEach((sub, i) => {
      const sy = 432 + i * 43;
      const canSub = !!this.selectedOutId && subsUsed < 5;
      const subTag = this.storyTags.get(sub.id);
      const subCa = this.playerCaMap.get(sub.id);
      const a = sub.attributes;
      const attrLine = sub.role === 'GK'
        ? `扑${a.goalkeeping} 站${a.positioning} 冷${a.composure}`
        : `速${a.pace} 射${a.shooting} 传${a.passing} 防${a.defending}`;
      drawRoundRect(ctx, 898, sy, 328, 39, 6, 'rgba(11, 17, 30, 0.88)', canSub ? THEME.GREEN : THEME.BORDER, canSub ? 1.4 : 1);
      drawBadge(ctx, 904, sy + 4, 32, 16, sub.role, '#1E3A5F', THEME.TX1);
      drawText(ctx, `${sub.name.slice(0, 5)} #${sub.shirtNumber}`, 940, sy + 12, { size: 11, bold: true, color: THEME.TX1 });
      if (subTag) {
        drawBadge(ctx, 1022, sy + 4, 48, 16, subTag, '#312E81', '#C4B5FD');
      }
      drawText(ctx, `${subCa ? 'CA' + subCa + ' ' : ''}体${Math.round(sub.fitness ?? 100)}%`, 1218, sy + 12, { size: 10.5, bold: true, color: THEME.GOLD_LIGHT, align: 'right', mono: true });
      drawText(ctx, `${attrLine} · ${sub.traits?.[0] || '均衡'}`, 904, sy + 29, { size: 9.5, color: '#7DD3FC', mono: true });
      if (canSub) {
        hits.add(898, sy, 328, 36, () => {
          const outP = onPitch.find(x => x.id === this.selectedOutId);
          const res = this.engine!.substitute(this.userSide, this.selectedOutId!, sub.id);
          if (res.ok) {
            this.modalBanner = `换人完成：${outP?.name || ''} ↓ 换上 ${sub.name} ↑`;
            SoundEngine.playClick();
          }
          this.selectedOutId = null;
          this.modalSelectedPitchId = null;
        });
      }
    });

    if (bTotalPages > 1) {
      drawButton(ctx, hits, 898, 650, 86, 26, '上一页', () => {
        this.benchPage = Math.max(0, this.benchPage - 1);
      }, { disabled: this.benchPage === 0, fontSize: 10 });
      drawText(ctx, `${this.benchPage + 1} / ${bTotalPages} 页`, 1062, 663, { size: 10.5, color: THEME.TX2, align: 'center' });
      drawButton(ctx, hits, 1140, 650, 86, 26, '下一页', () => {
        this.benchPage = Math.min(bTotalPages - 1, this.benchPage + 1);
      }, { disabled: this.benchPage >= bTotalPages - 1, fontSize: 10 });
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
    ctx.fillStyle = 'rgba(4, 7, 14, 0.72)';
    ctx.fillRect(0, 0, THEME.W, THEME.H);
    hits.clear();

    const cx = THEME.W / 2;
    const cy = 342;

    const wInfo = WEATHER_INFO[st.weather ?? 'sunny'];
    drawGameLogoEmblem(ctx, cx, cy - 156, 86, this.elapsedSec, 'showcase');
    drawText(ctx, 'MATCHDAY BROADCAST · 赛前入场仪式', cx, cy - 102, {
      size: 12,
      bold: true,
      color: THEME.GOLD_LIGHT,
      align: 'center',
      mono: true,
    });
    drawBadge(ctx, cx - 54, cy - 86, 108, 22, `${wInfo.label} · 哨响即战`, '#0F172A', wInfo.color);

    const cardW = 360;
    const cardH = 148;
    const slideOffset = Math.round((1 - inProg) * 180);

    const hx = cx - 410 - slideOffset;
    drawChamferPanel(ctx, hx, cy - 48, cardW, cardH, 12, 'rgba(14, 22, 40, 0.95)', homeClub.primaryColor, 2, homeClub.primaryColor);
    drawClubCrest(ctx, hx + 66, cy + 26, 36, homeClub);
    drawText(ctx, this.userSide === 'home' ? '主场出战 (我方)' : '主场作战', hx + 118, cy - 10, {
      size: 11,
      bold: true,
      color: this.userSide === 'home' ? THEME.GOLD_LIGHT : THEME.TX2,
    });
    drawText(ctx, st.homeName, hx + 118, cy + 20, { size: 22, bold: true, color: THEME.TX1 });
    drawText(ctx, `${st.homeFormation} · ${TACTICAL_PRESETS[st.homeStyle].name}`, hx + 118, cy + 52, {
      size: 13,
      color: '#7DD3FC',
    });

    const ax = cx + 50 + slideOffset;
    drawChamferPanel(ctx, ax, cy - 48, cardW, cardH, 12, 'rgba(14, 22, 40, 0.95)', awayClub.primaryColor, 2, awayClub.primaryColor);
    drawClubCrest(ctx, ax + cardW - 66, cy + 26, 36, awayClub);
    drawText(ctx, this.userSide === 'away' ? '客场出战 (我方)' : '客场挑战', ax + cardW - 118, cy - 10, {
      size: 11,
      bold: true,
      color: this.userSide === 'away' ? THEME.GOLD_LIGHT : THEME.TX2,
      align: 'right',
    });
    drawText(ctx, st.awayName, ax + cardW - 118, cy + 20, {
      size: 22,
      bold: true,
      color: THEME.TX1,
      align: 'right',
    });
    drawText(ctx, `${st.awayFormation} · ${TACTICAL_PRESETS[st.awayStyle].name}`, ax + cardW - 118, cy + 52, {
      size: 13,
      color: '#7DD3FC',
      align: 'right',
    });

    const vsScale = easeOutBack(Math.min(1, Math.max(0, (t - 0.16) / 0.4)));
    ctx.save();
    ctx.translate(cx, cy + 26);
    ctx.scale(vsScale, vsScale);
    drawRoundRect(ctx, -44, -44, 88, 88, 44, '#0B111E', THEME.FLAME, 3);
    drawRoundRect(ctx, -40, -40, 80, 80, 40, '#0B111E', THEME.GOLD_LIGHT, 1.5);
    drawText(ctx, 'VS', 0, -8, { size: 26, bold: true, italic: true, color: THEME.GOLD_LIGHT, align: 'center', mono: true });
    drawText(ctx, 'KICK OFF', 0, 20, { size: 9.5, bold: true, color: THEME.FLAME_LIGHT, align: 'center', mono: true });
    ctx.restore();

    drawText(ctx, '点击任意位置或按 空格/回车 立即开哨', cx, cy + 144, {
      size: 12,
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
}
