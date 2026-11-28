/**
 * @fm-league/game-ui 主应用控制器
 * 统一调度全页面路由、启动加载动画、广播级斜切转场、屏幕震动、粒子系统、快捷键与双端资源加载
 */

import { ACHIEVEMENTS } from '../../core/src/Achievements';
import { LeagueManager, NewSeasonOptions } from '../../core/src/LeagueManager';
import { ArtAssetId, AssetLoader } from './AssetLoader';
import { drawBackdrop, drawRoundRect, drawText, HitRegistry, NavRailTab, ParticleSystem } from './CanvasKit';
import { ConfirmModal } from './ConfirmModal';
import { BootIntro, RouteTransition, ScreenShake } from './Motion';
import { PlatformAdapter } from './Platform';
import { PlayerModal } from './PlayerModal';
import { getOtaStatus, getRunningVersion, restartAppForUpdate } from './RuntimeInfo';
import { SaveSlotModal } from './SaveSlotModal';
import { SettingsModal } from './SettingsModal';
import { AudioMode, SoundEngine } from './SoundEngine';
import { StoryModal } from './StoryModal';
import { TextInputModal } from './TextInputModal';
import { IS_MOBILE, THEME } from './Theme';
import { TutorialOverlay } from './TutorialOverlay';
import { ClubRosterScreen } from './screens/ClubRosterScreen';
import { DraftScreen } from './screens/DraftScreen';
import { HallOfFameScreen } from './screens/HallOfFameScreen';
import { LeagueScreen } from './screens/LeagueScreen';
import { MatchDayScreen } from './screens/MatchDayScreen';
import { MetaScreen } from './screens/MetaScreen';
import { PortalScreen } from './screens/PortalScreen';
import { PostMatchReDraftScreen } from './screens/PostMatchReDraftScreen';
import { PrologueScreen } from './screens/PrologueScreen';
import { SeasonEndScreen } from './screens/SeasonEndScreen';
import { TacticsScreen } from './screens/TacticsScreen';
import { TitleScreen } from './screens/TitleScreen';

export type ActiveRoute =
  | 'title'
  | 'prologue'
  | 'meta'
  | 'roster'
  | 'hof'
  | 'cards'
  | 'draft'
  | 'portal'
  | 'league'
  | 'tactics'
  | 'match'
  | 'post_match'
  | 'season_end';

export const SAVE_KEY = 'fm_league_save_v1';

export class GameApp {
  private league: LeagueManager;
  private platform: PlatformAdapter;
  private hits = new HitRegistry();
  private route: ActiveRoute = 'title';
  private metaReturnRoute: ActiveRoute = 'title';
  private rosterReturnRoute: ActiveRoute = 'title';
  private routeCooldownMs = 0;
  private elapsedTime = 0;
  private grantCaptainHeirloomOnNextSeason = false;
  private prologueMatchMode = false;
  private prologueResumeFromMatch = false;
  private playerModal = new PlayerModal();
  private confirmModal = new ConfirmModal();
  private storyModal = new StoryModal();
  private textInputModal = new TextInputModal();
  private settingsModal = new SettingsModal();
  private saveSlotModal = new SaveSlotModal();
  private otaPromptShown = false;
  private otaCheckTimers: number[] = [];
  private tutorialOverlay = new TutorialOverlay();

  private knownAchievements = new Set<string>();
  private toast: { text: string; color: string; timer: number } | null = null;
  private particles = new ParticleSystem();
  private shake = new ScreenShake();
  private transition = new RouteTransition();
  private bootIntro: BootIntro;

  private titleScreen = new TitleScreen();
  private prologueScreen = new PrologueScreen();
  private clubRosterScreen = new ClubRosterScreen();
  private metaScreen = new MetaScreen();
  private hofScreen = new HallOfFameScreen();
  private draftScreen = new DraftScreen();
  private portalScreen = new PortalScreen();
  private leagueScreen = new LeagueScreen();
  private tacticsScreen = new TacticsScreen();
  private matchScreen = new MatchDayScreen();
  private postMatchScreen = new PostMatchReDraftScreen();
  private seasonEndScreen = new SeasonEndScreen();

  constructor(platform: PlatformAdapter) {
    this.platform = platform;
    AssetLoader.preloadAll();
    this.loadPersistedSettings();
    const saved = this.platform.loadSave(SAVE_KEY);
    if (saved) {
      try {
        this.league = LeagueManager.deserialize(saved);
      } catch {
        this.league = new LeagueManager();
      }
    } else {
      this.league = new LeagueManager();
    }
    this.knownAchievements = new Set(this.league.getState().hallOfFame?.unlockedAchievements ?? []);
    this.route = 'title';
    this.bootIntro = new BootIntro(() => {
      this.titleScreen.resetEnterAnim();
    });
    this.scheduleOtaChecks();
  }

  /**
   * OTA 检查：原生层下载是异步的，启动瞬间可能还没完成。
   * 分几次轮询，只要任一时刻发现待生效版本就提示一次；用户点「稍后」后本局不再打扰。
   */
  private scheduleOtaChecks(): void {
    for (const delay of [1200, 5000, 12000]) {
      const t = window.setTimeout(() => void this.checkOtaOnce(), delay);
      this.otaCheckTimers.push(t);
    }
  }

  private async checkOtaOnce(): Promise<void> {
    if (this.otaPromptShown || this.confirmModal.isOpen()) return;
    // 只在标题页提示，避免打断比赛/选秀流程
    if (this.route !== 'title') return;
    const status = await getOtaStatus();
    if (!status?.pendingVersion || this.otaPromptShown) return;
    if (status.pendingVersion === getRunningVersion()) return;
    this.otaPromptShown = true;
    for (const t of this.otaCheckTimers) window.clearTimeout(t);
    this.otaCheckTimers = [];
    this.confirmModal.open(
      '发现新版本',
      `新版本 ${status.pendingVersion} 已下载完成，重启后立即生效。当前进度已自动保存，是否现在重启？`,
      () => {
        this.save();
        restartAppForUpdate();
      },
      '立即重启',
      'primary'
    );
  }

  private loadPersistedSettings(): void {
    const raw = this.platform.loadSettings?.();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { audioMode?: AudioMode; bgmVolume?: number; sfxVolume?: number };
      if (typeof parsed.bgmVolume === 'number') SoundEngine.setBgmVolume(parsed.bgmVolume);
      if (typeof parsed.sfxVolume === 'number') SoundEngine.setSfxVolume(parsed.sfxVolume);
      if (parsed.audioMode === 'all' || parsed.audioMode === 'sfx_only' || parsed.audioMode === 'muted') {
        SoundEngine.setAudioMode(parsed.audioMode);
      }
    } catch {
      // ignore invalid settings
    }
  }

  private persistSettings(): void {
    this.platform.saveSettings?.(
      JSON.stringify({
        audioMode: SoundEngine.audioMode,
        bgmVolume: SoundEngine.getBgmVolume(),
        sfxVolume: SoundEngine.getSfxVolume(),
      })
    );
  }

  private reloadFromActiveSlot(): void {
    const saved = this.platform.loadSave(SAVE_KEY);
    if (saved) {
      try {
        this.league = LeagueManager.deserialize(saved);
      } catch {
        this.league = new LeagueManager();
      }
    } else {
      this.league = new LeagueManager();
    }
    this.knownAchievements = new Set(this.league.getState().hallOfFame?.unlockedAchievements ?? []);
    this.grantCaptainHeirloomOnNextSeason = false;
    this.titleScreen.resetEnterAnim();
  }

  public showToast(text: string, color: string = THEME.GOLD_LIGHT): void {
    this.toast = { text, color, timer: 2.2 };
  }

  private setRoute(next: ActiveRoute, transitionLabel = ''): void {
    if (this.route !== next) {
      SoundEngine.stopVoice();
      this.transition.trigger(() => {
        this.route = next;
        if (next === 'title') {
          this.titleScreen.resetEnterAnim();
          SoundEngine.setScene('title');
        } else if (next === 'prologue') {
          if (this.prologueResumeFromMatch) {
            this.prologueResumeFromMatch = false;
            this.prologueScreen.resumeAfterAct2Match();
          } else {
            this.prologueScreen.reset();
          }
          SoundEngine.setScene('prologue');
        } else if (next === 'season_end') {
          this.seasonEndScreen.resetIntro();
          SoundEngine.setScene('celebration');
        } else if (next !== 'match') {
          SoundEngine.setScene('portal');
        }
      }, transitionLabel);
    }
  }

  private checkNewAchievements(): void {
    const unlocked = this.league.getState().hallOfFame?.unlockedAchievements ?? [];
    for (const id of unlocked) {
      if (!this.knownAchievements.has(id)) {
        this.knownAchievements.add(id);
        const def = ACHIEVEMENTS.find(a => a.id === id);
        if (def) {
          this.showToast(`解锁成就：${def.title} (+${def.metaReward}pt)`, THEME.GOLD_LIGHT);
          this.particles.burst(640, 120, THEME.GOLD_LIGHT, 22);
        }
      }
    }
  }

  private navigateFromRail(tab: NavRailTab): void {
    const isSeasonTab = this.route === 'portal' || this.route === 'league' || this.route === 'tactics' || this.route === 'cards' || this.route === 'roster';
    if (tab === 'title') {
      this.setRoute('title');
    } else if (tab === 'cards') {
      this.tacticsScreen.setMainTab('loadout');
      this.setRoute('tactics', 'TACTICAL LOADOUT · 临场指令配装');
    } else if (tab === 'meta') {
      this.metaReturnRoute = isSeasonTab ? this.route : 'portal';
      this.setRoute('meta');
    } else if (tab === 'hof') {
      this.metaReturnRoute = isSeasonTab ? this.route : 'portal';
      this.setRoute('hof');
    } else if (tab === 'transfer_hub') {
      const tutNow = this.league.getTutorialProgress();
      if (this.route === 'portal' && !tutNow.portal_summer) {
        this.league.markTutorialStep('portal_summer');
      }
      if (this.route !== 'roster') {
        this.clubRosterScreen.setSubTab('roster');
      }
      this.rosterReturnRoute = this.route === 'roster' ? this.rosterReturnRoute : (isSeasonTab ? this.route : 'portal');
      if (this.route !== 'roster') {
        this.setRoute('roster', 'TRANSFER HUB · 引援中心');
      }
    } else {
      if (tab === 'tactics') {
        this.tacticsScreen.setMainTab('pitch');
      }
      this.setRoute(tab);
    }
  }

  private syncRouteFromPhase(): void {
    const st = this.league.getState();
    const phase = st.phase;
    if (phase === 'INIT_DRAFT') this.setRoute('draft', 'CORE PACKS · 核心开包');
    else if (phase === 'SUMMER_WINDOW') {
      this.setRoute('portal', 'SUMMER WINDOW · 季前备战门户');
    } else if (phase === 'WINTER_WINDOW') {
      this.clubRosterScreen.setSubTab('roster');
      this.rosterReturnRoute = 'portal';
      this.setRoute('roster', 'WINTER WINDOW · 冬季转会窗');
    } else if (phase === 'RE_DRAFT' || (st.pendingPostMatchReward && !st.pendingPostMatchReward.completed)) {
      this.setRoute('post_match', 'POST MATCH · 赛后补强');
    } else if (phase === 'SEASON_END') this.setRoute('season_end', 'SEASON FINALE');
    else this.setRoute('portal', 'CLUB PORTAL · 赛季门户');
  }

  private save(): void {
    this.checkNewAchievements();
    this.platform.writeSave(SAVE_KEY, this.league.serialize());
  }

  public onPointerMove(x: number, y: number): void {
    this.hits.hoverX = x;
    this.hits.hoverY = y;
    if (this.settingsModal.isOpen()) {
      this.settingsModal.onPointerMove(x, y, () => this.persistSettings());
      return;
    }
    if (this.route === 'meta') {
      this.metaScreen.onPointerMove(x, y);
    }
  }

  public onPointerDown(x: number, y: number): void {
    SoundEngine.unlock();
    this.hits.pointerDown = true;
    if (this.bootIntro.isBlocking()) {
      this.bootIntro.skip();
      return;
    }
    if (this.transition.isActive() || this.routeCooldownMs > 0) return;
    const prevRoute = this.route;
    this.hits.hoverX = x;
    this.hits.hoverY = y;
    if (this.route === 'meta' && !this.settingsModal.isOpen() && !this.saveSlotModal.isOpen() && !this.textInputModal.isOpen()) {
      this.metaScreen.onPointerDown(x, y);
    }
    this.hits.handleClick(x, y);
    if (this.route !== prevRoute) {
      this.routeCooldownMs = 150;
    }
  }

  public onPointerUp(_x: number, _y: number): void {
    this.hits.pointerDown = false;
    if (this.settingsModal.isOpen()) {
      this.settingsModal.onPointerUp();
    }
    if (this.route === 'meta') {
      this.metaScreen.onPointerUp();
    }
  }

  public onWheel(deltaY: number, x: number, y: number): boolean {
    if (this.settingsModal.isOpen() || this.saveSlotModal.isOpen() || this.textInputModal.isOpen()) {
      return true;
    }
    if (this.route === 'meta') {
      return this.metaScreen.onWheel(deltaY, x, y);
    }
    if (this.route === 'league') {
      return this.leagueScreen.onWheel(deltaY);
    }
    if (this.route === 'tactics') {
      return this.tacticsScreen.onWheel(deltaY);
    }
    if (this.route === 'hof') {
      return this.hofScreen.onWheel(deltaY);
    }
    return false;
  }

  public onPinchZoom(factor: number, x: number, y: number): void {
    if (this.settingsModal.isOpen() || this.saveSlotModal.isOpen() || this.textInputModal.isOpen()) {
      return;
    }
    if (this.route === 'meta') {
      this.metaScreen.onPinchZoom(factor, x, y);
    }
  }

  public onKeyDown(code: string, key?: string): void {
    if (this.bootIntro.isBlocking()) {
      if (code === 'Space' || code === 'Enter' || code === 'Escape') {
        this.bootIntro.skip();
      }
      return;
    }
    if (this.textInputModal.isOpen()) {
      this.textInputModal.onKeyDown(code, key);
      return;
    }
    if (code === 'F11' && this.platform.toggleFullscreen) {
      this.platform.toggleFullscreen();
      return;
    }
    if (code === 'Escape') {
      if (this.confirmModal.isOpen()) {
        this.confirmModal.close();
        return;
      }
      if (this.settingsModal.isOpen()) {
        this.settingsModal.close();
        return;
      }
      if (this.saveSlotModal.isOpen()) {
        this.saveSlotModal.close();
        return;
      }
      if (this.playerModal.isOpen()) {
        this.playerModal.close();
        return;
      }
      if (this.route === 'portal' && this.portalScreen.handleEscape()) {
        return;
      }
      if (this.route === 'tactics' && this.tacticsScreen.handleEscape()) {
        return;
      }
      if (this.route === 'meta' && this.metaScreen.handleEscape()) {
        return;
      }
    }
    if (this.route === 'match') {
      this.matchScreen.onKeyDown(code);
    } else if (this.route === 'prologue') {
      this.prologueScreen.onKeyDown(code);
    }
  }

  public needsHighFps(): boolean {
    if (!this.bootIntro.isDone() || this.transition.isActive() || this.toast !== null || this.textInputModal.isOpen()) {
      return true;
    }
    if (this.route === 'title' && this.titleScreen.isAnimating()) {
      return true;
    }
    if (this.route === 'meta' && this.metaScreen.isAnimating()) {
      return true;
    }
    return this.route === 'match' || this.route === 'prologue' || this.route === 'post_match';
  }

  public update(dtSec: number): void {
    this.elapsedTime += dtSec;
    this.bootIntro.update(dtSec);
    this.textInputModal.update(dtSec);

    if (this.routeCooldownMs > 0) {
      this.routeCooldownMs = Math.max(0, this.routeCooldownMs - dtSec * 1000);
    }
    if (this.toast) {
      this.toast.timer -= dtSec;
      if (this.toast.timer <= 0) this.toast = null;
    }
    this.particles.update(dtSec);
    this.shake.update(dtSec);
    this.transition.update(dtSec);
    if (this.route === 'title') {
      this.titleScreen.update(dtSec);
    } else if (this.route === 'portal') {
      this.portalScreen.update(dtSec);
    } else if (this.route === 'prologue') {
      this.prologueScreen.update(dtSec);
    } else if (this.route === 'meta') {
      this.metaScreen.update(dtSec);
    } else if (this.route === 'draft') {
      this.draftScreen.update(dtSec);
    } else if (this.route === 'match') {
      this.matchScreen.update(dtSec);
    } else if (this.route === 'post_match') {
      this.postMatchScreen.update(dtSec);
    } else if (this.route === 'season_end') {
      this.seasonEndScreen.update(dtSec);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    this.hits.clear();

    if (this.bootIntro.isBlocking()) {
      this.bootIntro.render(ctx, THEME.W, THEME.H);
      return;
    }

    const shakeOff = this.shake.getOffset();
    const reveal = this.transition.getContentReveal();
    ctx.save();
    if (shakeOff.x !== 0 || shakeOff.y !== 0) {
      ctx.translate(shakeOff.x, shakeOff.y);
    }

    const bgId: ArtAssetId =
      this.route === 'season_end'
        ? 'bg_season_ceremony'
        : this.route === 'title' ||
          this.route === 'portal' ||
          this.route === 'league' ||
          this.route === 'match' ||
          this.route === 'hof'
        ? 'stadium_bg'
        : this.route === 'tactics'
        ? 'bg_tactics'
        : this.route === 'draft' || this.route === 'post_match'
        ? 'bg_draft'
        : 'bg_portal';
    const brightenBg =
      this.route === 'title' ||
      this.route === 'portal' ||
      this.route === 'league' ||
      this.route === 'hof' ||
      this.route === 'season_end';
    drawBackdrop(ctx, bgId, this.elapsedTime, brightenBg);

    ctx.save();
    if (reveal.offsetY !== 0) {
      ctx.translate(0, reveal.offsetY);
    }
    if (reveal.alpha < 1) {
      ctx.globalAlpha = reveal.alpha;
    }

    if (this.route === 'title') {
      this.titleScreen.render(ctx, this.hits, this.league, {
        onContinue: () => this.syncRouteFromPhase(),
        onOpenPrologue: () => {
          this.setRoute('prologue', 'PROLOGUE · 老将归来');
        },
        onStartNewSeason: (opts: NewSeasonOptions) => {
          this.league.startNewSeason(opts);
          const stNow = this.league.getState();
          const gotHeirloom =
            this.grantCaptainHeirloomOnNextSeason ||
            (stNow.seasonNumber === 1 && !!stNow.prologueCompleted && !stNow.secretRetiredEnding);
          if (gotHeirloom) {
            this.league.grantReturningCaptainPlayer();
            this.grantCaptainHeirloomOnNextSeason = false;
          }
          this.save();
          this.setRoute('draft', 'CORE PACKS · 核心开包');
          this.showToast(
            gotHeirloom
              ? `${opts.customName || '新俱乐部'} 建队完成 · 老队长 #10 梅利纳（中轴全能 80+）游子归家压阵首季！`
              : `${opts.customName || '新俱乐部'} 建队完成，开启 3 轮核心开包！`,
            gotHeirloom ? THEME.GOLD_LIGHT : THEME.GREEN
          );
        },
        onOpenMeta: () => {
          this.metaReturnRoute = 'title';
          this.setRoute('meta');
        },
        onOpenRoster: () => {
          this.rosterReturnRoute = 'title';
          this.setRoute('roster', 'CLUB ROSTER · 俱乐部大名单');
        },
        onOpenHallOfFame: () => {
          this.metaReturnRoute = 'title';
          this.setRoute('hof');
        },
        onResetSave: () => {
          this.confirmModal.open(
            '重置全部存档',
            '将清除本地保存的赛季进度、常驻班底与天赋点数并重新开始，确认吗？',
            () => {
              this.platform.clearSave?.(SAVE_KEY);
              this.league = new LeagueManager();
              this.knownAchievements.clear();
              this.grantCaptainHeirloomOnNextSeason = false;
              this.setRoute('prologue', 'PROLOGUE · 全新生涯开启');
              this.showToast('存档已重置，从老将序章开启全新生涯！', '#38BDF8');
            },
            '确认重置'
          );
        },
        onEditName: (current, apply) => {
          this.textInputModal.open('自定义俱乐部名称', current, apply, {
            maxLen: 12,
            platform: this.platform,
          });
        },
        onOpenSettings: () => this.settingsModal.open(),
        onOpenSaveSlots: this.platform.listSaveSlots ? () => this.saveSlotModal.open() : undefined,
        onQuitApp: this.platform.quitApp
          ? () => {
              this.confirmModal.open(
                '退出游戏',
                '当前进度已自动保存，确认退出《再开一局》吗？',
                () => this.platform.quitApp!(),
                '确认退出',
                'danger'
              );
            }
          : undefined,
        activeSlotLabel: (() => {
          const id = this.platform.getActiveSlotId?.() ?? 'slot_1';
          const n = id.replace('slot_', '');
          return `存档位 ${n}`;
        })(),
        hasSavedGame: Boolean(this.platform.loadSave(SAVE_KEY)),
      });
    } else if (this.route === 'prologue') {
      this.prologueScreen.render(ctx, this.hits, {
        onEnterAct2Match: () => {
          this.prologueMatchMode = true;
          this.matchScreen.startPrologueMatch(
            this.league,
            () => {
              this.prologueMatchMode = false;
              this.prologueResumeFromMatch = true;
              this.matchScreen.dispose();
              this.setRoute('prologue', 'MIDNIGHT CALL · 更衣室未接来电');
            },
            () => {
              this.shake.trigger(8, 0.30);
              this.particles.burst(640, 140, THEME.GOLD_LIGHT, 30);
            },
            (intensity, dur) => this.shake.trigger(intensity, dur),
            (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 28)
          );
          this.setRoute('match', 'ACT II · 终场绝唱');
        },
        onAcceptHometown: () => {
          this.league.markPrologueCompleted();
          this.grantCaptainHeirloomOnNextSeason = true;
          this.save();
          this.titleScreen.openNewSeasonWizard();
          this.setRoute('title', 'HOMETOWN CLUB · 重返家乡');
          this.showToast('老队长 #10 梅利纳（80+中轴全能）已整装待发！请为家乡球队定名启程', THEME.GOLD_LIGHT);
        },
        onDeclineSecretEnding: () => {
          this.league.markSecretRetiredEnding();
          this.save();
        },
        onReturnTitle: () => {
          this.setRoute('title', 'THE END · 传奇落幕');
        },
        onSkipPrologue: () => {
          this.league.markPrologueCompleted();
          this.save();
          this.titleScreen.openNewSeasonWizard();
          this.setRoute('title', 'SHUFFLE BUILD · 快速建队');
        },
        onBurst: (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 28),
        onShake: (intensity, dur) => this.shake.trigger(intensity, dur),
      });
    } else if (this.route === 'roster') {
      const stPhase = this.league.getState().phase;
      const fromSeason = this.rosterReturnRoute !== 'title';
      this.clubRosterScreen.render(ctx, this.hits, this.league, {
        onBack: () => this.setRoute(this.rosterReturnRoute),
        onNavigate: fromSeason ? (tab) => this.navigateFromRail(tab) : undefined,
        activeRailTab: 'transfer_hub',
        onStartSeasonFromRoster: () => {
          const res = this.league.startSeasonFromRoster();
          if (res.ok) {
            this.save();
            this.setRoute('portal', 'NEW SEASON · 出征名单已确认');
            this.showToast('已将全队大名单带入新赛季，可在战术室自由轮换首发与替补！', THEME.GREEN);
          } else {
            this.showToast(res.reason || '无法开启新赛季', THEME.RED_LIGHT);
          }
        },
        onSeasonStarted: () => {
          this.save();
          this.setRoute('portal', 'SEASON KICKOFF · 新赛季开赛');
          this.showToast('26 人大名单注册完毕，新赛季正式打响！', THEME.GREEN);
          this.particles.burst(640, 220, THEME.GREEN, 26);
        },
        onWinterClosed: () => {
          this.save();
          this.setRoute('portal', 'SECOND HALF · 下半程开启');
          this.showToast('冬季转会窗已关闭，继续下半程征程！', '#38BDF8');
        },
        onInspectPlayer: (p, opts) => this.playerModal.open(p, opts),
        onSave: () => this.save(),
        onToast: (msg, col) => this.showToast(msg, col),
      });
    } else if (this.route === 'meta') {
      const fromSeason = this.metaReturnRoute !== 'title';
      this.metaScreen.render(ctx, this.hits, this.league, {
        onBack: () => this.setRoute(this.metaReturnRoute),
        onNavigate: fromSeason ? (tab) => this.navigateFromRail(tab) : undefined,
        onSave: () => {
          this.save();
          this.showToast('天赋树升级已保存', '#38BDF8');
          this.particles.burst(640, 360, '#38BDF8', 18);
        },
      });
    } else if (this.route === 'hof') {
      const fromSeason = this.metaReturnRoute !== 'title';
      this.hofScreen.render(
        ctx,
        this.hits,
        this.league,
        () => this.setRoute(this.metaReturnRoute),
        fromSeason ? (tab) => this.navigateFromRail(tab) : undefined
      );
    } else if (this.route === 'cards') {
      this.tacticsScreen.setMainTab('loadout');
      this.route = 'tactics';
    } else if (this.route === 'draft') {
      this.draftScreen.render(ctx, this.hits, this.league, {
        onDone: () => {
          this.setRoute('portal', 'SUMMER WINDOW · 季前备战门户');
          this.showToast('3 名核心球员已入队！请在门户页引导下前往引援中心凑齐 26 人大名单', THEME.GOLD_LIGHT);
          this.particles.burst(640, 220, THEME.GOLD_LIGHT, 26);
        },
        onSave: () => this.save(),
        onInspectPlayer: (p) => this.playerModal.open(p),
        onBurst: (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 16),
        onRequestAutoComplete: () => {
          this.confirmModal.open(
            '智能补齐阵容',
            '将自动花费剩余预算从候选池补齐至 26 名球员，补齐后仍可退选微调再确认开赛，确认继续吗？',
            () => {
              this.league.autoCompleteDraft();
              this.save();
              this.showToast('阵容已补齐 26 人，可退选调整或确认开赛', THEME.GREEN);
              this.particles.burst(1080, 220, THEME.GREEN, 20);
            },
            '确认补齐',
            'gold'
          );
        },
      });
      if (!this.playerModal.isOpen() && !this.confirmModal.isOpen()) {
        this.tutorialOverlay.render(ctx, this.hits, this.league, 'draft', () => this.save());
      }
    } else if (this.route === 'portal') {
      this.portalScreen.render(ctx, this.hits, this.league, {
        onNavigate: (tab) => this.navigateFromRail(tab),
        onSave: () => this.save(),
        onToast: (msg, col) => this.showToast(msg, col),
        onSeasonStarted: () => {
          this.save();
          this.showToast('26 人大名单注册完毕，新赛季正式打响！', THEME.GREEN);
          this.particles.burst(640, 220, THEME.GREEN, 26);
        },
        onBurst: (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 26),
        onShake: (intensity, dur) => this.shake.trigger(intensity, dur),
        onQuickSim: () => {
          this.confirmModal.open(
            '跳过本轮比赛',
            '将直接模拟本轮比赛结果并推进赛程，无法撤销。确认跳过吗？',
            () => {
              const res = this.league.simulateUserRound();
              if (res.ok) {
                SoundEngine.playWhistle('fulltime');
                this.save();
                this.syncRouteFromPhase();
                const g = res.userGoals ?? 0;
                const o = res.oppGoals ?? 0;
                const tag = g > o ? '取胜' : g === o ? '战平' : '惜败';
                this.showToast(`本轮快进：${g}:${o} ${tag} ${res.oppName || ''}`, g > o ? THEME.GREEN : g === o ? THEME.GOLD_LIGHT : '#FCA5A5');
              }
            },
            '确认跳过',
            'primary'
          );
        },
        onStartMatch: () => {
          this.matchScreen.start(
            this.league,
            () => {
              this.shake.trigger(7, 0.28);
              this.particles.burst(640, 140, THEME.GOLD_LIGHT, 28);
            },
            (intensity, dur) => this.shake.trigger(intensity, dur),
            (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 26)
          );
          this.setRoute('match', 'MATCH DAY · KICKOFF');
        },
      });
      if (!this.playerModal.isOpen() && !this.confirmModal.isOpen() && !this.league.getState().pendingStoryEvent) {
        const tut = this.league.getTutorialProgress();
        if (this.league.getState().phase === 'SUMMER_WINDOW') {
          if (!tut.portal_summer) {
            this.tutorialOverlay.render(ctx, this.hits, this.league, 'portal_summer', () => this.save());
          }
        } else {
          if (!tut.portal_prep) {
            this.tutorialOverlay.render(ctx, this.hits, this.league, 'portal_prep', () => this.save());
          } else if (!tut.portal_scout) {
            this.tutorialOverlay.render(ctx, this.hits, this.league, 'portal_scout', () => this.save());
          }
        }
      }
    } else if (this.route === 'league') {
      this.leagueScreen.render(ctx, this.hits, this.league, {
        onNavigate: (tab) => this.navigateFromRail(tab),
        onSave: () => this.save(),
        onStartMatch: () => {
          this.matchScreen.start(
            this.league,
            () => {
              this.shake.trigger(7, 0.28);
              this.particles.burst(640, 140, THEME.GOLD_LIGHT, 28);
            },
            (intensity, dur) => this.shake.trigger(intensity, dur),
            (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 26)
          );
          this.setRoute('match', 'MATCH DAY · KICKOFF');
        },
      });
    } else if (this.route === 'tactics') {
      this.tacticsScreen.render(ctx, this.hits, this.league, {
        onNavigate: (tab) => this.navigateFromRail(tab),
        onStartMatch: () => {
          this.matchScreen.start(
            this.league,
            () => {
              this.shake.trigger(7, 0.28);
              this.particles.burst(640, 140, THEME.GOLD_LIGHT, 28);
            },
            (intensity, dur) => this.shake.trigger(intensity, dur),
            (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 26)
          );
          this.setRoute('match', 'MATCH DAY · KICKOFF');
        },
        onSave: () => {
          this.save();
        },
        onInspectPlayer: (p) => this.playerModal.open(p),
        onOpenRoster: () => {
          this.rosterReturnRoute = 'tactics';
          this.setRoute('roster', 'CLUB ROSTER · 俱乐部大名单');
        },
      });
      if (!this.playerModal.isOpen()) {
        this.tutorialOverlay.render(ctx, this.hits, this.league, 'tactics', () => this.save());
      }
    } else if (this.route === 'match') {
      this.matchScreen.render(ctx, this.hits, this.league, (result) => {
        SoundEngine.setScene('portal');
        if (this.prologueMatchMode) {
          this.prologueMatchMode = false;
          this.prologueResumeFromMatch = true;
          this.matchScreen.dispose();
          this.setRoute('prologue', 'MIDNIGHT CALL · 更衣室未接来电');
          return;
        }
        this.league.consumePlayedCardUses(this.matchScreen.consumePlayedCardIds());
        this.league.completeCurrentRoundWithUserResult(result);
        this.postMatchScreen.setLastMatch(result);
        this.matchScreen.dispose();
        this.save();
        if (this.league.getState().phase === 'SEASON_END') {
          this.postMatchScreen.dispose();
          this.setRoute('season_end', 'SEASON FINALE');
        } else {
          this.setRoute('post_match', 'FULL TIME · 赛后复盘');
        }
      });
      if (!this.prologueMatchMode) {
        this.tutorialOverlay.render(ctx, this.hits, this.league, 'match', () => this.save());
      }
    } else if (this.route === 'post_match') {
      this.postMatchScreen.render(
        ctx,
        this.hits,
        this.league,
        () => {
          this.postMatchScreen.dispose();
          this.syncRouteFromPhase();
        },
        () => this.save(),
        {
          onBurst: (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 28),
          onShake: (intensity, dur) => this.shake.trigger(intensity, dur),
          onInspectPlayer: (p) => this.playerModal.open(p),
        }
      );
      this.tutorialOverlay.render(ctx, this.hits, this.league, 'post_match', () => this.save());
    } else if (this.route === 'season_end') {
      this.seasonEndScreen.render(ctx, this.hits, this.league, {
        onNewSeason: (carryOver = false) => {
          const curClub = this.league.getUserClub();
          this.league.startNewSeason(
            {
              clubId: curClub.id,
              customName: curClub.name,
              primaryColor: curClub.primaryColor,
              secondaryColor: curClub.secondaryColor,
              awayPrimaryColor: curClub.awayPrimaryColor,
              awaySecondaryColor: curClub.awaySecondaryColor,
              formation: curClub.formation,
              style: curClub.style,
            },
            curClub.formation,
            curClub.style,
            carryOver
          );
          this.save();
          this.syncRouteFromPhase();
          if (carryOver) {
            this.showToast('已保留常驻班底，进入新赛季夏季转会窗！', THEME.GREEN);
          } else {
            this.showToast('新赛季开启，开始 3 轮核心开包！', THEME.GOLD_LIGHT);
          }
        },
        onOpenMeta: () => {
          this.metaReturnRoute = 'season_end';
          this.setRoute('meta');
        },
        onGoTitle: () => this.setRoute('title'),
        onSave: () => this.save(),
        onToast: (msg, col) => this.showToast(msg, col),
        onBurst: (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 30),
      });
    }

    if (this.route === 'portal' && !this.playerModal.isOpen() && !this.confirmModal.isOpen()) {
      this.storyModal.render(ctx, this.hits, this.league, () => this.save());
    }

    this.playerModal.render(ctx, this.hits, {
      league: this.league,
      onSave: () => this.save(),
      onToast: (msg, col) => this.showToast(msg, col),
    });
    this.saveSlotModal.render(ctx, this.hits, {
      platform: this.platform,
      onSelectSlot: (slotId) => {
        this.platform.setActiveSlotId?.(slotId);
        this.reloadFromActiveSlot();
        const n = slotId.replace('slot_', '');
        this.showToast(`已切换至存档位 ${n}`, '#38BDF8');
      },
      onDeleteSlot: (slotId, label) => {
        this.confirmModal.open(
          `删除 ${label}`,
          `确定要永久删除 ${label} 的全部赛季与天赋数据吗？此操作不可撤销。`,
          () => {
            const active = this.platform.getActiveSlotId?.() ?? 'slot_1';
            this.platform.setActiveSlotId?.(slotId);
            this.platform.clearSave?.(SAVE_KEY);
            this.platform.setActiveSlotId?.(active);
            this.reloadFromActiveSlot();
            this.showToast(`${label} 已清空`, '#FCA5A5');
          },
          '确认删除',
          'danger'
        );
      },
    });
    this.settingsModal.render(ctx, this.hits, {
      platform: this.platform,
      onPersistSettings: () => this.persistSettings(),
      onRequestQuit: this.platform.quitApp
        ? () => {
            this.confirmModal.open(
              '退出游戏',
              '当前进度已自动保存，确认退出《再开一局》吗？',
              () => this.platform.quitApp!(),
              '确认退出',
              'danger'
            );
          }
        : undefined,
    });
    this.textInputModal.render(ctx, this.hits);
    this.confirmModal.render(ctx, this.hits);
    ctx.restore();

    this.particles.render(ctx);

    if (this.toast) {
      // 底部居中安全区 PITCH PRINT 胶囊 Toast（彻底避免遮挡任意页面顶部标题与 Tab 栏）
      const alpha = Math.min(1, this.toast.timer * 4);
      const slide = (1 - alpha) * 10;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold 13px ${THEME.FONT_FAMILY}`;
      const tw = Math.min(620, Math.max(260, ctx.measureText(this.toast.text).width + 52));
      const tx = 640 - tw / 2;
      const ty = THEME.H - 52 + slide;
      drawRoundRect(ctx, tx + 3, ty + 3, tw, 34, 6, THEME.HARD_SHADOW);
      drawRoundRect(ctx, tx, ty, tw, 34, 6, THEME.BG_DEEP, this.toast.color || THEME.BRASS, 2);
      ctx.fillStyle = this.toast.color;
      ctx.beginPath();
      ctx.arc(tx + 18, ty + 17, 4, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, this.toast.text, 640 + 8, ty + 17, {
        size: 13,
        bold: true,
        color: THEME.TX1,
        align: 'center',
      });
      ctx.restore();
    }

    this.transition.render(ctx, THEME.W, THEME.H);
    if (!this.bootIntro.isDone()) {
      this.bootIntro.render(ctx, THEME.W, THEME.H);
    }
    ctx.restore();
  }
}
