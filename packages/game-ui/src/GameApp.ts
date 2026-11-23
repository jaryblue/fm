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
import { SoundEngine } from './SoundEngine';
import { StoryModal } from './StoryModal';
import { THEME } from './Theme';
import { TutorialOverlay } from './TutorialOverlay';
import { CardCraftScreen } from './screens/CardCraftScreen';
import { ClubRosterScreen } from './screens/ClubRosterScreen';
import { DraftScreen } from './screens/DraftScreen';
import { HallOfFameScreen } from './screens/HallOfFameScreen';
import { MatchDayScreen } from './screens/MatchDayScreen';
import { MetaScreen } from './screens/MetaScreen';
import { PortalScreen } from './screens/PortalScreen';
import { PostMatchReDraftScreen } from './screens/PostMatchReDraftScreen';
import { SeasonEndScreen } from './screens/SeasonEndScreen';
import { TacticsScreen } from './screens/TacticsScreen';
import { TitleScreen } from './screens/TitleScreen';

export type ActiveRoute =
  | 'title'
  | 'meta'
  | 'roster'
  | 'hof'
  | 'cards'
  | 'draft'
  | 'portal'
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
  private playerModal = new PlayerModal();
  private confirmModal = new ConfirmModal();
  private storyModal = new StoryModal();
  private tutorialOverlay = new TutorialOverlay();

  private knownAchievements = new Set<string>();
  private toast: { text: string; color: string; timer: number } | null = null;
  private particles = new ParticleSystem();
  private shake = new ScreenShake();
  private transition = new RouteTransition();
  private bootIntro: BootIntro;

  private titleScreen = new TitleScreen();
  private clubRosterScreen = new ClubRosterScreen();
  private metaScreen = new MetaScreen();
  private hofScreen = new HallOfFameScreen();
  private cardCraftScreen = new CardCraftScreen();
  private draftScreen = new DraftScreen();
  private portalScreen = new PortalScreen();
  private tacticsScreen = new TacticsScreen();
  private matchScreen = new MatchDayScreen();
  private postMatchScreen = new PostMatchReDraftScreen();
  private seasonEndScreen = new SeasonEndScreen();

  constructor(platform: PlatformAdapter) {
    this.platform = platform;
    AssetLoader.preloadAll();
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
    this.knownAchievements = new Set(this.league.getState().hallOfFame.unlockedAchievements);
    this.route = 'title';
    this.bootIntro = new BootIntro(() => {
      this.titleScreen.resetEnterAnim();
    });
  }

  public showToast(text: string, color: string = THEME.GOLD_LIGHT): void {
    this.toast = { text, color, timer: 2.2 };
  }

  private setRoute(next: ActiveRoute, transitionLabel = ''): void {
    if (this.route !== next) {
      this.transition.trigger(() => {
        this.route = next;
        if (next === 'title') {
          this.titleScreen.resetEnterAnim();
        } else if (next === 'season_end') {
          this.seasonEndScreen.resetIntro();
        }
      }, transitionLabel);
    }
  }

  private checkNewAchievements(): void {
    const unlocked = this.league.getState().hallOfFame.unlockedAchievements;
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
    if (tab === 'title') {
      this.setRoute('title');
    } else if (tab === 'meta') {
      this.metaReturnRoute = this.route === 'portal' || this.route === 'tactics' || this.route === 'cards' ? this.route : 'portal';
      this.setRoute('meta');
    } else if (tab === 'hof') {
      this.metaReturnRoute = this.route === 'portal' || this.route === 'tactics' || this.route === 'cards' ? this.route : 'portal';
      this.setRoute('hof');
    } else {
      this.setRoute(tab);
    }
  }

  private syncRouteFromPhase(): void {
    const phase = this.league.getState().phase;
    if (phase === 'INIT_DRAFT') this.setRoute('draft', 'SHUFFLE DRAFT · 选秀建队');
    else if (phase === 'RE_DRAFT') this.setRoute('post_match', 'POST MATCH · 赛后补强');
    else if (phase === 'SEASON_END') this.setRoute('season_end', 'SEASON FINALE');
    else this.setRoute('portal', 'CLUB PORTAL · 赛季门户');
  }

  private save(): void {
    this.checkNewAchievements();
    this.platform.writeSave(SAVE_KEY, this.league.serialize());
  }

  public onPointerMove(x: number, y: number): void {
    this.hits.hoverX = x;
    this.hits.hoverY = y;
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
    if (this.route === 'meta') {
      this.metaScreen.onPointerDown(x, y);
    }
    this.hits.handleClick(x, y);
    if (this.route !== prevRoute) {
      this.routeCooldownMs = 150;
    }
  }

  public onPointerUp(_x: number, _y: number): void {
    this.hits.pointerDown = false;
    if (this.route === 'meta') {
      this.metaScreen.onPointerUp();
    }
  }

  public onWheel(deltaY: number, x: number, y: number): boolean {
    if (this.route === 'meta') {
      return this.metaScreen.onWheel(deltaY, x, y);
    }
    if (this.route === 'portal') {
      return this.portalScreen.onWheel(deltaY);
    }
    if (this.route === 'tactics') {
      return this.tacticsScreen.onWheel(deltaY);
    }
    return false;
  }

  public onKeyDown(code: string): void {
    if (this.bootIntro.isBlocking()) {
      if (code === 'Space' || code === 'Enter' || code === 'Escape') {
        this.bootIntro.skip();
      }
      return;
    }
    if (code === 'Escape') {
      if (this.playerModal.isOpen()) {
        this.playerModal.close();
        return;
      }
      if (this.confirmModal.isOpen()) {
        this.confirmModal.close();
        return;
      }
      if (this.route === 'portal' && this.portalScreen.handleEscape()) {
        return;
      }
      if (this.route === 'tactics' && this.tacticsScreen.handleEscape()) {
        return;
      }
    }
    if (this.route === 'match') {
      this.matchScreen.onKeyDown(code);
    }
  }

  public update(dtSec: number): void {
    this.elapsedTime += dtSec;
    this.bootIntro.update(dtSec);

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
    } else if (this.route === 'meta') {
      this.metaScreen.update(dtSec);
    } else if (this.route === 'cards') {
      this.cardCraftScreen.update(dtSec);
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
      this.route === 'title' ||
      this.route === 'portal' ||
      this.route === 'match' ||
      this.route === 'hof' ||
      this.route === 'season_end'
        ? 'stadium_bg'
        : this.route === 'draft' || this.route === 'post_match'
        ? 'bg_draft'
        : 'bg_portal';
    const brightenBg =
      this.route === 'title' ||
      this.route === 'portal' ||
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
        onStartNewSeason: (opts: NewSeasonOptions) => {
          this.league.startNewSeason(opts);
          this.save();
          this.setRoute('draft', 'SHUFFLE DRAFT · 选秀建队');
          this.showToast(`${opts.customName || '新俱乐部'} 建队完成，开始选秀`, THEME.GREEN);
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
              this.showToast('存档已重置，欢迎开启全新生涯！', '#38BDF8');
            },
            '确认重置'
          );
        },
        onEditName: this.platform.promptText
          ? (current, apply) => {
              this.platform.promptText!('请输入俱乐部名称（最多 12 字）', current, apply);
            }
          : undefined,
      });
    } else if (this.route === 'roster') {
      this.clubRosterScreen.render(ctx, this.hits, this.league, {
        onBack: () => this.setRoute(this.rosterReturnRoute),
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
      this.cardCraftScreen.render(ctx, this.hits, this.league, {
        onNavigate: (tab) => this.navigateFromRail(tab),
        onSave: () => {
          this.save();
          this.showToast('教练指挥卡组已更新', THEME.GOLD_LIGHT);
        },
        onBurst: (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 24),
      });
      this.tutorialOverlay.render(ctx, this.hits, this.league, 'cards', () => this.save());
    } else if (this.route === 'draft') {
      this.draftScreen.render(ctx, this.hits, this.league, {
        onDone: () => {
          this.setRoute('portal', 'CLUB PORTAL · 赛季开启');
          this.showToast('26 人大名单组建完成', THEME.GREEN);
          this.particles.burst(640, 220, THEME.GREEN, 26);
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
            '确认补齐'
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
        onQuickSim: () => {
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
        onStartMatch: () => {
          this.matchScreen.start(
            this.league,
            () => {
              this.shake.trigger(7, 0.28);
              this.particles.burst(640, 140, THEME.GOLD_LIGHT, 28);
            },
            (intensity, dur) => this.shake.trigger(intensity, dur)
          );
          this.setRoute('match', 'MATCH DAY · KICKOFF');
        },
      });
      if (!this.playerModal.isOpen() && !this.confirmModal.isOpen() && !this.league.getState().pendingStoryEvent) {
        const tut = this.league.getTutorialProgress();
        if (!tut.portal_prep) {
          this.tutorialOverlay.render(ctx, this.hits, this.league, 'portal_prep', () => this.save());
        } else if (!tut.portal_scout) {
          this.tutorialOverlay.render(ctx, this.hits, this.league, 'portal_scout', () => this.save());
        }
      }
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
            (intensity, dur) => this.shake.trigger(intensity, dur)
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
        SoundEngine.setScene('menu');
        this.league.completeCurrentRoundWithUserResult(result);
        this.postMatchScreen.setLastMatch(result);
        this.save();
        if (this.league.getState().phase === 'SEASON_END') {
          this.setRoute('season_end', 'SEASON FINALE');
        } else {
          this.setRoute('post_match', 'FULL TIME · 赛后复盘');
        }
      });
      this.tutorialOverlay.render(ctx, this.hits, this.league, 'match', () => this.save());
    } else if (this.route === 'post_match') {
      this.postMatchScreen.render(
        ctx,
        this.hits,
        this.league,
        () => {
          this.syncRouteFromPhase();
        },
        () => this.save(),
        {
          onBurst: (bx, by, col) => this.particles.burst(bx, by, col || THEME.GOLD_LIGHT, 28),
          onShake: (intensity, dur) => this.shake.trigger(intensity, dur),
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
              formation: curClub.formation,
              style: curClub.style,
            },
            curClub.formation,
            curClub.style,
            carryOver
          );
          this.save();
          if (carryOver) {
            this.setRoute('portal', 'NEW SEASON · 保留班底');
            this.showToast('已保留常驻班底，开启新赛季！', THEME.GREEN);
          } else {
            this.setRoute('draft', 'SHUFFLE DRAFT · 新赛季');
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

    this.playerModal.render(ctx, this.hits);
    this.confirmModal.render(ctx, this.hits);
    ctx.restore();

    this.particles.render(ctx);

    if (this.toast) {
      const alpha = Math.min(1, this.toast.timer * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawRoundRect(ctx, 410, 78, 460, 36, 18, 'rgba(14,22,40,0.95)', this.toast.color, 1.4);
      drawText(ctx, this.toast.text, 640, 96, {
        size: 13,
        bold: true,
        color: this.toast.color,
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
