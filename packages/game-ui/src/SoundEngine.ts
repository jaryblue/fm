/**
 * 零外部音频文件依赖的 WebAudio 程序化摇滚 BGM 与音效合成引擎
 * - 菜单/备战 (menu)：118 BPM 复古硬摇滚（强力五度和弦闷音切分 + 蓝调五声音阶滑音主音 + 随机变奏）
 * - 比赛日 (match)：146 BPM 热血日系动漫摇滚（王道进行/疾走音阶 + 八度跳跃贝斯 + 动机变奏主旋律 + 双踩高潮）
 * - 25ms 前瞻步进音序器 + 电子管过载箱体滤波 + 母带动态压缩，确保音色饱满且节拍零抖动
 */

import {
  EXTERNAL_BGM_FILES,
  EXTERNAL_SFX_FILES,
  EXTERNAL_VOICE_FILES,
  ExternalBgmId,
  ExternalSfxId,
  VoiceAssetId,
} from './AudioManifest';

export type BgmScene =
  | 'title'
  | 'prologue'
  | 'portal'
  | 'menu'
  | 'match'
  | 'match_climax'
  | 'celebration';
export type WeatherAudioKind = 'sunny' | 'rain' | 'wind' | 'heat';
export type AudioMode = 'all' | 'sfx_only' | 'muted';

export type BgmStyle = 'title' | 'prologue' | 'portal' | 'celebration' | 'match' | 'match_climax';
export type RockStyle = BgmStyle;

const SCENE_TO_BGM_ID: Record<BgmScene, ExternalBgmId> = {
  title: 'bgm_title',
  menu: 'bgm_title',
  prologue: 'bgm_prologue',
  portal: 'bgm_portal',
  match: 'bgm_match_normal',
  match_climax: 'bgm_match_climax',
  celebration: 'bgm_celebration',
};

interface RockProgression {
  roots: number[];       // 4 小节根音频率 (Hz)
  scaleOffsets: number[]; // 主音音阶半音偏移
}

// 复古硬摇滚和弦进行池（118 BPM，经典体育场硬摇滚）
const HARD_ROCK_PROGRESSIONS: RockProgression[] = [
  // E5 -> G5 -> A5 -> D5
  { roots: [82.41, 98.00, 110.00, 73.42], scaleOffsets: [0, 3, 5, 7, 10, 12, 15] },
  // A5 -> C5 -> D5 -> G5
  { roots: [110.00, 130.81, 146.83, 98.00], scaleOffsets: [0, 3, 5, 6, 7, 10, 12] },
  // D5 -> C5 -> G5 -> A5
  { roots: [73.42, 65.41, 98.00, 110.00], scaleOffsets: [0, 2, 3, 5, 7, 10, 12] },
];

// 热血日系动漫摇滚进行池（146 BPM，王道进行 + 疾走上行）
const ANIME_ROCK_BRIGHT: RockProgression[] = [
  // 王道进行 F5 -> G5 -> E5 -> A5
  { roots: [87.31, 98.00, 82.41, 110.00], scaleOffsets: [0, 2, 4, 7, 9, 12, 14, 16] },
  // 热血上行 F5 -> G5 -> A5 -> C5
  { roots: [87.31, 98.00, 110.00, 130.81], scaleOffsets: [0, 2, 4, 5, 7, 9, 12, 14] },
  // 疾走冲刺 D5 -> E5 -> F5 -> G5
  { roots: [73.42, 82.41, 87.31, 98.00], scaleOffsets: [0, 2, 3, 5, 7, 10, 12, 14] },
];

// 雨夜/强风比赛日偏暗涌的日系金属/疾走小调进行
const ANIME_ROCK_STORMY: RockProgression[] = [
  // E5 -> C5 -> D5 -> B4
  { roots: [82.41, 65.41, 73.42, 61.74], scaleOffsets: [0, 2, 3, 5, 7, 8, 10, 12] },
  // A5 -> F5 -> G5 -> E5
  { roots: [110.00, 87.31, 98.00, 82.41], scaleOffsets: [0, 2, 3, 5, 7, 8, 12, 15] },
];

// 序章雨夜告别：78 BPM 温暖忧郁电钢/弦乐进行
const PROLOGUE_PROGRESSIONS: RockProgression[] = [
  { roots: [110.00, 87.31, 130.81, 98.00], scaleOffsets: [0, 2, 3, 5, 7, 8, 10, 12] },
  { roots: [82.41, 65.41, 98.00, 73.42], scaleOffsets: [0, 2, 3, 5, 7, 10, 12, 14] },
];

// 门户/战术室备战：104 BPM 现代战术律动
const PORTAL_PROGRESSIONS: RockProgression[] = [
  { roots: [73.42, 87.31, 98.00, 82.41], scaleOffsets: [0, 2, 3, 5, 7, 10, 12, 14] },
  { roots: [82.41, 98.00, 110.00, 98.00], scaleOffsets: [0, 3, 5, 7, 10, 12, 15] },
];

// 赛季夺冠/庆典：128 BPM 明亮大调进行
const CELEBRATION_PROGRESSIONS: RockProgression[] = [
  { roots: [130.81, 98.00, 110.00, 87.31], scaleOffsets: [0, 2, 4, 7, 9, 12, 14, 16] },
];

class SoundEngineImpl {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private crowdSrc: AudioBufferSourceNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdDecayTimer: ReturnType<typeof setTimeout> | null = null;
  private weatherSrc: AudioBufferSourceNode | null = null;
  private weatherGain: GainNode | null = null;
  private weatherLfo: OscillatorNode | null = null;
  private lastTackleAt = 0;

  // 摇滚引擎总线与音序器状态
  private masterBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private decodedCache = new Map<string, AudioBuffer>();
  private loadingCache = new Map<string, Promise<AudioBuffer | null>>();
  private extBgmSrc: AudioBufferSourceNode | null = null;
  private extBgmGain: GainNode | null = null;
  private extBgmId: ExternalBgmId | null = null;
  private extBgmSeq = 0;
  private voiceSrc: AudioBufferSourceNode | null = null;
  private voiceCooldown = new Map<VoiceAssetId, number>();

  private rockDriveCurve: Float32Array | null = null;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private stepIndex = 0; // 0..63 (4小节 * 16步)
  private activeProg: RockProgression = HARD_ROCK_PROGRESSIONS[0];
  private riffPattern: number[] = []; // 每步强度: 0=休止, 1=闷音, 2=重击扫弦
  private leadMotif: Array<number | null> = []; // 16步主音旋律动机（音阶索引或 null）
  private fillStyle = 0; // 0..2 随机过门风格

  private currentScene: BgmScene = 'title';
  private currentWeather: WeatherAudioKind = 'sunny';
  private highTension = false;
  private bgmVolume = 0.78;
  private sfxVolume = 0.88;
  private bgmDucked = false;
  public audioMode: AudioMode = 'all';

  constructor() {
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopBgm();
          this.stopVoice();
          this.stopCrowdAmbience();
          this.stopWeatherAmbience();
          if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {});
          }
        } else if (!this.muted) {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
          if (this.audioMode === 'all' && !this.bgmTimer && !this.extBgmSrc) {
            this.startBgmLoop();
          }
          if (this.currentScene === 'match' || this.currentScene === 'match_climax') {
            this.startCrowdAmbience();
            this.startWeatherAmbience(this.currentWeather);
          }
        }
      });
    }
  }

  public get muted(): boolean {
    return this.audioMode === 'muted';
  }

  public getAudioModeLabel(): string {
    if (this.audioMode === 'sfx_only') return '仅音效';
    if (this.audioMode === 'muted') return '静音';
    return '全开';
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    try {
      const g = globalThis as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = g.AudioContext || g.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private getMasterBus(ctx: AudioContext): AudioNode {
    if (this.masterBus) return this.masterBus;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-16, ctx.currentTime);
    comp.knee.setValueAtTime(12, ctx.currentTime);
    comp.ratio.setValueAtTime(4, ctx.currentTime);
    comp.attack.setValueAtTime(0.004, ctx.currentTime);
    comp.release.setValueAtTime(0.18, ctx.currentTime);

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.88, ctx.currentTime);
    bus.connect(comp).connect(ctx.destination);
    this.masterBus = bus;
    return bus;
  }

  private getBgmBus(ctx: AudioContext): GainNode {
    if (this.bgmBus) return this.bgmBus;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.68 * this.bgmVolume, ctx.currentTime);
    g.connect(this.getMasterBus(ctx));
    this.bgmBus = g;
    return g;
  }

  private getSfxBus(ctx: AudioContext): GainNode {
    if (this.sfxBus) return this.sfxBus;
    const g = ctx.createGain();
    g.gain.setValueAtTime(this.sfxVolume, ctx.currentTime);
    g.connect(this.getMasterBus(ctx));
    this.sfxBus = g;
    return g;
  }

  private getAmbienceBus(ctx: AudioContext): GainNode {
    if (this.ambienceBus) return this.ambienceBus;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.92 * this.sfxVolume, ctx.currentTime);
    g.connect(this.getMasterBus(ctx));
    this.ambienceBus = g;
    return g;
  }

  private getVoiceBus(ctx: AudioContext): GainNode {
    if (this.voiceBus) return this.voiceBus;
    const g = ctx.createGain();
    g.gain.setValueAtTime(this.sfxVolume, ctx.currentTime);
    g.connect(this.getMasterBus(ctx));
    this.voiceBus = g;
    return g;
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setBgmVolume(vol: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.bgmBus) {
      const base = this.bgmDucked ? 0.24 : 0.68;
      try {
        this.bgmBus.gain.setTargetAtTime(base * this.bgmVolume, this.ctx.currentTime, 0.03);
      } catch {
        this.bgmBus.gain.value = base * this.bgmVolume;
      }
    }
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.sfxBus) { try { this.sfxBus.gain.setTargetAtTime(this.sfxVolume, now, 0.03); } catch { this.sfxBus.gain.value = this.sfxVolume; } }
      if (this.ambienceBus) { try { this.ambienceBus.gain.setTargetAtTime(0.92 * this.sfxVolume, now, 0.03); } catch { this.ambienceBus.gain.value = 0.92 * this.sfxVolume; } }
      if (this.voiceBus) { try { this.voiceBus.gain.setTargetAtTime(this.sfxVolume, now, 0.03); } catch { this.voiceBus.gain.value = this.sfxVolume; } }
    }
  }

  private loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    const cached = this.decodedCache.get(url);
    if (cached) return Promise.resolve(cached);
    const pending = this.loadingCache.get(url);
    if (pending) return pending;
    const req = (async () => {
      try {
        if (typeof fetch !== 'function') return null;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const arr = await resp.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        this.decodedCache.set(url, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.loadingCache.delete(url);
      }
    })();
    this.loadingCache.set(url, req);
    return req;
  }

  private duckBgm(ctx: AudioContext, ducked: boolean): void {
    this.bgmDucked = ducked;
    const bus = this.getBgmBus(ctx);
    const target = (ducked ? 0.24 : 0.68) * this.bgmVolume;
    try {
      bus.gain.setTargetAtTime(target, ctx.currentTime, ducked ? 0.06 : 0.22);
    } catch {
      bus.gain.value = target;
    }
  }

  public stopVoice(): void {
    try {
      this.voiceSrc?.stop();
      this.voiceSrc?.disconnect();
    } catch {
      // ignore
    }
    this.voiceSrc = null;
    if (this.ctx) this.duckBgm(this.ctx, false);
  }

  public playVoice(id: VoiceAssetId, cooldownMs = 2800): boolean {
    if (this.muted) return false;
    const url = EXTERNAL_VOICE_FILES[id];
    if (!url) return false;
    const nowMs = Date.now();
    const last = this.voiceCooldown.get(id) ?? 0;
    if (nowMs - last < cooldownMs) return false;
    const ctx = this.ensureContext();
    if (!ctx) return false;
    this.voiceCooldown.set(id, nowMs);

    void this.loadBuffer(ctx, url).then((buf) => {
      if (!buf || this.muted) return;
      this.stopVoice();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.getVoiceBus(ctx));
      this.duckBgm(ctx, true);
      src.onended = () => {
        if (this.voiceSrc === src) {
          this.voiceSrc = null;
          this.duckBgm(ctx, false);
        }
      };
      src.start();
      this.voiceSrc = src;
    });
    return true;
  }

  public playExternalSfx(id: ExternalSfxId, volume = 0.85): boolean {
    if (this.muted) return false;
    const url = EXTERNAL_SFX_FILES[id];
    if (!url) return false;
    const ctx = this.ensureContext();
    if (!ctx) return false;
    void this.loadBuffer(ctx, url).then((buf) => {
      if (!buf || this.muted) return;
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      src.buffer = buf;
      src.connect(gain).connect(this.getSfxBus(ctx));
      src.start();
    });
    return true;
  }

  private getDistortionCurve(amount = 22): Float32Array {
    if (this.rockDriveCurve) return this.rockDriveCurve;
    const samples = 1024;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // 柔和电子管饱和曲线（避免刺耳数码削波）
      curve[i] = Math.tanh(x * (1 + amount * 0.14));
    }
    this.rockDriveCurve = curve;
    return curve;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && this.audioMode === 'all' && !this.bgmTimer && !this.extBgmSrc) {
      this.setScene(this.currentScene, this.currentWeather);
    }
  }

  public setAudioMode(mode: AudioMode): void {
    this.audioMode = mode;
    if (mode === 'muted') {
      this.stopBgm();
      this.stopVoice();
      this.stopCrowdAmbience();
      this.stopWeatherAmbience();
    } else if (mode === 'sfx_only') {
      this.stopBgm();
    } else {
      this.setScene(this.currentScene, this.currentWeather);
    }
  }

  public cycleAudioMode(): AudioMode {
    if (this.audioMode === 'all') {
      this.setAudioMode('sfx_only');
      this.playClick();
    } else if (this.audioMode === 'sfx_only') {
      this.setAudioMode('muted');
    } else {
      this.setAudioMode('all');
      this.playClick();
    }
    return this.audioMode;
  }

  public toggleMute(): boolean {
    this.cycleAudioMode();
    return this.muted;
  }

  public setMatchTension(high: boolean): void {
    this.highTension = high;
  }

  public setScene(scene: BgmScene, weather?: WeatherAudioKind): void {
    const nextWeather = weather ?? this.currentWeather;
    const changed = this.currentScene !== scene || this.currentWeather !== nextWeather;
    this.currentScene = scene;
    this.currentWeather = nextWeather;
    const isMatchScene = scene === 'match' || scene === 'match_climax';
    if (!isMatchScene) this.highTension = false;
    else if (scene === 'match_climax') this.highTension = true;

    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.audioMode === 'all') {
      if (changed || (!this.bgmTimer && !this.extBgmSrc)) {
        this.rollPhraseVariation(true);
        this.startBgmLoop();
      }
    } else {
      this.stopBgm();
    }
    if (isMatchScene) {
      this.startCrowdAmbience();
      this.startWeatherAmbience(nextWeather);
    } else {
      this.stopCrowdAmbience();
      this.stopWeatherAmbience();
    }
  }

  private getActiveStyle(): BgmStyle {
    if (this.currentScene === 'match_climax') return 'match_climax';
    if (this.currentScene === 'match') return 'match';
    if (this.currentScene === 'prologue') return 'prologue';
    if (this.currentScene === 'portal' || this.currentScene === 'menu') return 'portal';
    if (this.currentScene === 'celebration') return 'celebration';
    return 'title';
  }

  private rollPhraseVariation(forceFirst = false): void {
    const style = this.getActiveStyle();
    const pool =
      style === 'prologue'
        ? PROLOGUE_PROGRESSIONS
        : style === 'portal'
        ? PORTAL_PROGRESSIONS
        : style === 'celebration'
        ? CELEBRATION_PROGRESSIONS
        : style === 'title'
        ? HARD_ROCK_PROGRESSIONS
        : (this.currentWeather === 'rain' || this.currentWeather === 'wind')
        ? ANIME_ROCK_STORMY
        : ANIME_ROCK_BRIGHT;

    if (forceFirst || pool.length === 1) {
      this.activeProg = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const others = pool.filter(p => p !== this.activeProg);
      this.activeProg = others[Math.floor(Math.random() * others.length)] || pool[0];
    }

    if (style === 'prologue') {
      this.riffPattern = [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 1, 0, 0, 0];
    } else if (style === 'portal') {
      this.riffPattern = [2, 0, 1, 0, 0, 1, 2, 0, 1, 0, 1, 0, 2, 0, 1, 0];
    } else if (style === 'celebration') {
      this.riffPattern = [2, 0, 2, 1, 2, 0, 1, 1, 2, 0, 2, 1, 2, 1, 2, 0];
    } else if (style === 'title') {
      const presets = [
        [2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 2, 0],
        [2, 1, 0, 2, 0, 1, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1],
        [2, 0, 2, 0, 1, 1, 2, 0, 2, 0, 1, 1, 0, 2, 0, 1],
      ];
      this.riffPattern = presets[Math.floor(Math.random() * presets.length)];
    } else {
      const presets = [
        [2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1],
        [2, 0, 2, 1, 2, 0, 2, 1, 2, 1, 1, 2, 0, 2, 1, 2],
        [2, 1, 2, 1, 0, 2, 1, 2, 2, 1, 2, 1, 2, 1, 2, 2],
      ];
      this.riffPattern = presets[Math.floor(Math.random() * presets.length)];
    }

    const scaleLen = this.activeProg.scaleOffsets.length;
    const motif: Array<number | null> = new Array(16).fill(null);
    let cursor = Math.floor(Math.random() * Math.min(4, scaleLen));
    const isMatch = style === 'match' || style === 'match_climax';
    const density = style === 'prologue' ? 0.34 : style === 'portal' ? 0.44 : isMatch ? 0.56 : 0.45;
    for (let s = 0; s < 16; s += 2) {
      if (s === 0 || Math.random() < density) {
        motif[s] = cursor;
        const stepMove = [-2, -1, 1, 1, 2][Math.floor(Math.random() * 5)];
        cursor = Math.max(0, Math.min(scaleLen - 1, cursor + stepMove));
        if ((isMatch || style === 'celebration') && Math.random() < 0.35 && s + 1 < 16) {
          motif[s + 1] = cursor;
        }
      }
    }
    this.leadMotif = motif;
    this.fillStyle = Math.floor(Math.random() * 3);
  }

  private startProceduralBgm(ctx: AudioContext): void {
    this.stopProceduralBgm();
    this.stepIndex = 0;
    this.nextStepTime = ctx.currentTime + 0.05;

    const scheduleAheadSec = 0.16;
    const tick = () => {
      if (this.audioMode !== 'all') return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const c = this.ensureContext();
      if (!c) return;

      const style = this.getActiveStyle();
      const bpm =
        style === 'prologue'
          ? 78
          : style === 'portal'
          ? 104
          : style === 'celebration'
          ? 128
          : style === 'title'
          ? 118
          : style === 'match_climax' || this.highTension
          ? 152
          : this.currentWeather === 'rain'
          ? 138
          : 146;
      const stepDur = 60 / bpm / 4;

      if (this.nextStepTime < c.currentTime - 0.25) {
        this.nextStepTime = c.currentTime + 0.03;
      }

      while (this.nextStepTime < c.currentTime + scheduleAheadSec) {
        this.scheduleRockStep(c, this.stepIndex, this.nextStepTime, stepDur, style);
        this.nextStepTime += stepDur;
        this.stepIndex = (this.stepIndex + 1) % 64;
        if (this.stepIndex === 0) {
          this.rollPhraseVariation(false);
        }
      }
    };

    tick();
    this.bgmTimer = setInterval(tick, 60);
  }

  private startBgmLoop(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const extId = SCENE_TO_BGM_ID[this.currentScene];
    const extUrl = EXTERNAL_BGM_FILES[extId];
    if (extUrl) {
      if (this.extBgmId === extId && this.extBgmSrc) return;
      const seq = ++this.extBgmSeq;
      if (!this.decodedCache.has(extUrl) && !this.bgmTimer && !this.extBgmSrc) {
        this.startProceduralBgm(ctx);
      }
      void this.loadBuffer(ctx, extUrl).then((buf) => {
        if (!buf || seq !== this.extBgmSeq || this.audioMode !== 'all') return;
        if (typeof document !== 'undefined' && document.hidden) return;
        this.stopProceduralBgm();
        this.fadeOutExternalBgm(ctx, 0.55);

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const g = ctx.createGain();
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(1.0, now + 0.65);
        src.connect(g).connect(this.getBgmBus(ctx));
        src.start(now);
        this.extBgmSrc = src;
        this.extBgmGain = g;
        this.extBgmId = extId;
      });
      return;
    }

    this.extBgmSeq++;
    this.fadeOutExternalBgm(ctx, 0.35);
    this.startProceduralBgm(ctx);
  }

  private scheduleRockStep(
    ctx: AudioContext,
    step: number,
    time: number,
    stepDur: number,
    style: BgmStyle
  ): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const root = this.activeProg.roots[bar] ?? this.activeProg.roots[0];
    const bus = this.getBgmBus(ctx);

    try {
      if (style === 'prologue') {
        if (s === 0 || s === 8) {
          this.triggerWarmPadChord(ctx, bus, time, root * 2, stepDur * 7.2, 0.038);
          this.triggerWarmBass(ctx, bus, time, root, stepDur * 6.5, 0.065);
          this.triggerKick(ctx, bus, time, 0.055);
        }
        if (s % 4 === 2) {
          this.triggerHiHat(ctx, bus, time, 0.025, 0.008);
        }
        const motifNote = this.leadMotif[s];
        if (motifNote !== null && motifNote !== undefined) {
          const semi = this.activeProg.scaleOffsets[motifNote] ?? 0;
          const freq = 329.63 * Math.pow(2, semi / 12);
          this.triggerElectricPianoNote(ctx, bus, time, freq, stepDur * 3.2, 0.042);
        }
        return;
      }

      if (style === 'portal') {
        if (s === 0 || s === 6 || s === 8) {
          this.triggerKick(ctx, bus, time, 0.085);
        }
        if (s === 4 || s === 12) {
          this.triggerSnare(ctx, bus, time, 0.042);
        }
        if (s % 2 === 0) {
          this.triggerHiHat(ctx, bus, time, 0.024, s % 4 === 2 ? 0.014 : 0.008);
          this.triggerWarmBass(ctx, bus, time, root * (s % 4 === 2 ? 2 : 1), stepDur * 1.6, 0.072);
        }
        if (s === 0) {
          this.triggerWarmPadChord(ctx, bus, time, root * 2, stepDur * 13, 0.026);
        }
        if (s % 2 === 0) {
          const arpIdx = (s / 2) % Math.max(3, this.activeProg.scaleOffsets.length);
          const semi = this.activeProg.scaleOffsets[arpIdx] ?? 0;
          const freq = 261.63 * Math.pow(2, semi / 12);
          this.triggerSynthPluck(ctx, bus, time, freq, stepDur * 1.4, 0.026);
        }
        const motifNote = this.leadMotif[s];
        if (motifNote !== null && motifNote !== undefined && (bar === 1 || bar === 3)) {
          const semi = this.activeProg.scaleOffsets[motifNote] ?? 0;
          const freq = 440 * Math.pow(2, semi / 12);
          this.triggerElectricPianoNote(ctx, bus, time, freq, stepDur * 2.1, 0.032);
        }
        return;
      }

      if (style === 'celebration') {
        if (s === 0 || s === 4 || s === 8 || s === 12) {
          this.triggerKick(ctx, bus, time, 0.11);
        }
        if (s === 4 || s === 12 || (bar === 3 && s >= 13)) {
          this.triggerSnare(ctx, bus, time, 0.075);
        }
        if (s === 0 && (bar === 0 || bar === 2)) {
          this.triggerCrash(ctx, bus, time, 0.05);
        } else if (s % 2 === 0) {
          this.triggerHiHat(ctx, bus, time, 0.03, 0.015);
        }
        if (s % 2 === 0) {
          this.triggerRockBass(ctx, bus, time, root * (s % 4 === 2 ? 2 : 1), stepDur * 1.7, 0.078);
        }
        const riffCode = this.riffPattern[s] ?? 0;
        if (riffCode > 0) {
          this.triggerWarmPadChord(ctx, bus, time, root * 4, stepDur * 2.2, riffCode === 2 ? 0.044 : 0.026);
        }
        const motifNote = this.leadMotif[s];
        if (motifNote !== null && motifNote !== undefined) {
          const semi = this.activeProg.scaleOffsets[motifNote] ?? 0;
          const freq = 523.25 * Math.pow(2, semi / 12);
          this.triggerSynthPluck(ctx, bus, time, freq, stepDur * 2.1, 0.042);
        }
        return;
      }

      const isAnimeRock = style === 'match' || style === 'match_climax';
      const isDoubleKick = style === 'match_climax' || (isAnimeRock && this.highTension);
      const kickHit =
        !isAnimeRock
          ? s === 0 || s === 6 || s === 8 || (s === 10 && Math.random() < 0.45)
          : isDoubleKick
          ? s === 0 || s === 2 || s === 3 || s === 6 || s === 8 || s === 10 || s === 11 || s === 14
          : s === 0 || s === 3 || s === 6 || s === 8 || s === 10 || (s === 14 && bar === 3);

      if (kickHit) {
        this.triggerKick(ctx, bus, time, isAnimeRock ? 0.13 : 0.12);
      }

      const isFillBar = bar === 3 && s >= 12;
      const snareHit = isFillBar
        ? (this.fillStyle === 0 ? s % 2 === 0 : this.fillStyle === 1 ? s >= 13 : s === 12 || s === 14 || s === 15)
        : s === 4 || s === 12 || (isAnimeRock && s === 15 && bar % 2 === 1 && Math.random() < 0.55);

      if (snareHit) {
        this.triggerSnare(ctx, bus, time, isFillBar ? 0.065 : 0.085);
      }

      if (s === 0 && (bar === 0 || (this.highTension && bar === 2))) {
        this.triggerCrash(ctx, bus, time, 0.045);
      } else if (isAnimeRock || s % 2 === 0) {
        const openHat = s === 14 && bar === 1;
        this.triggerHiHat(ctx, bus, time, openHat ? 0.11 : 0.032, openHat ? 0.028 : 0.016);
      }

      if (s % 2 === 0) {
        const bassMult =
          isAnimeRock
            ? s % 4 === 2
              ? 2
              : s === 14 && bar === 3
              ? 1.5
              : 1
            : s === 14 && Math.random() < 0.4
            ? 1.5
            : 1;
        this.triggerRockBass(ctx, bus, time, root * bassMult, stepDur * 1.7, isAnimeRock ? 0.085 : 0.09);
      }

      const riffCode = this.riffPattern[s] ?? 0;
      if (riffCode > 0) {
        const isPalmMute = riffCode === 1;
        const gDur = isPalmMute ? stepDur * 0.78 : stepDur * 2.1;
        const cabCut =
          !isAnimeRock
            ? isPalmMute ? 1250 : 2250
            : this.currentWeather === 'rain'
            ? isPalmMute ? 1350 : 2150
            : isPalmMute ? 1600 : this.highTension ? 3000 : 2650;
        this.triggerPowerChord(
          ctx,
          bus,
          time,
          root * 2,
          gDur,
          cabCut,
          isPalmMute ? 0.034 : 0.048
        );
      }

      const motifNote = this.leadMotif[s];
      if (motifNote !== null && motifNote !== undefined && (bar === 0 || bar === 1 || bar === 3 || Math.random() < 0.65)) {
        const mutate = bar === 1 && Math.random() < 0.35 ? 1 : bar === 3 && s >= 8 ? 2 : 0;
        const idx = Math.min(this.activeProg.scaleOffsets.length - 1, motifNote + mutate);
        const semi = this.activeProg.scaleOffsets[idx];
        const baseLead = isAnimeRock ? 440 : 329.63;
        const freq = baseLead * Math.pow(2, semi / 12);
        const bend = !isAnimeRock && s % 4 === 0 && Math.random() < 0.45;
        this.triggerLeadGuitar(ctx, bus, time, freq, stepDur * 1.85, bend, isAnimeRock ? 0.036 : 0.032);
      }
    } catch {
      // ignore audio scheduling errors
    }
  }

  private triggerWarmPadChord(ctx: AudioContext, dest: AudioNode, time: number, rootFreq: number, dur: number, vol: number): void {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + Math.min(0.08, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1150, time);
    lp.connect(g).connect(dest);
    let ended = 0;
    [1, 1.2, 1.498].forEach((mult) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(rootFreq * mult, time);
      osc.connect(lp);
      osc.onended = () => {
        osc.disconnect();
        ended++;
        if (ended === 3) {
          lp.disconnect();
          g.disconnect();
        }
      };
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  private triggerWarmBass(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number, vol: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(360, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(lp).connect(g).connect(dest);
    osc.onended = () => {
      osc.disconnect();
      lp.disconnect();
      g.disconnect();
    };
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private triggerElectricPianoNote(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number, vol: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    const overtone = ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, time);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.25, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + Math.min(0.18, dur * 0.5));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g).connect(dest);
    overtone.connect(og).connect(g);
    osc.onended = () => {
      osc.disconnect();
      overtone.disconnect();
      og.disconnect();
      g.disconnect();
    };
    osc.start(time);
    overtone.start(time);
    osc.stop(time + dur + 0.02);
    overtone.stop(time + dur + 0.02);
  }

  private triggerSynthPluck(ctx: AudioContext, dest: AudioNode, time: number, freq: number, dur: number, vol: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, time);
    lp.frequency.exponentialRampToValueAtTime(480, time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(lp).connect(g).connect(dest);
    osc.onended = () => {
      osc.disconnect();
      lp.disconnect();
      g.disconnect();
    };
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private triggerKick(ctx: AudioContext, dest: AudioNode, time: number, vol: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(128, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.085);
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    osc.connect(g).connect(dest);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private triggerSnare(ctx: AudioContext, dest: AudioNode, time: number, vol: number): void {
    // 噪声响弦
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1900, time);
    bp.Q.setValueAtTime(0.8, time);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    src.connect(bp).connect(ng).connect(dest);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      ng.disconnect();
    };
    src.start(time);
    src.stop(time + 0.14);

    // 鼓腔基频
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(115, time + 0.06);
    og.gain.setValueAtTime(vol * 0.75, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(og).connect(dest);
    osc.onended = () => {
      osc.disconnect();
      og.disconnect();
    };
    osc.start(time);
    osc.stop(time + 0.09);
  }

  private triggerHiHat(ctx: AudioContext, dest: AudioNode, time: number, dur: number, vol: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6800, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(hp).connect(g).connect(dest);
    src.onended = () => {
      src.disconnect();
      hp.disconnect();
      g.disconnect();
    };
    src.start(time);
    src.stop(time + dur + 0.01);
  }

  private triggerCrash(ctx: AudioContext, dest: AudioNode, time: number, vol: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(4200, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
    src.connect(hp).connect(g).connect(dest);
    src.onended = () => {
      src.disconnect();
      hp.disconnect();
      g.disconnect();
    };
    src.start(time);
    src.stop(time + 0.58);
  }

  private triggerRockBass(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    freq: number,
    dur: number,
    vol: number
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, time);
    lp.frequency.exponentialRampToValueAtTime(220, time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(lp).connect(g).connect(dest);
    osc.onended = () => {
      osc.disconnect();
      lp.disconnect();
      g.disconnect();
    };
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private triggerPowerChord(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    rootFreq: number,
    dur: number,
    cutoff: number,
    vol: number
  ): void {
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(20) as Float32Array<ArrayBuffer>;
    const cab = ctx.createBiquadFilter();
    cab.type = 'lowpass';
    cab.frequency.setValueAtTime(cutoff, time);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    shaper.connect(cab).connect(g).connect(dest);

    let ended = 0;
    // 强力五度和弦：Root + 5th + Octave
    [1, 1.498, 2].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(rootFreq * mult, time);
      osc.detune.setValueAtTime(i === 1 ? -5 : i === 2 ? 5 : 0, time);
      osc.connect(shaper);
      osc.onended = () => {
        osc.disconnect();
        ended++;
        if (ended === 3) {
          shaper.disconnect();
          cab.disconnect();
          g.disconnect();
        }
      };
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  private triggerLeadGuitar(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    freq: number,
    dur: number,
    bendUp: boolean,
    vol: number
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    if (bendUp) {
      osc.frequency.setValueAtTime(freq * 0.94, time);
      osc.frequency.exponentialRampToValueAtTime(freq, time + 0.06);
    } else {
      osc.frequency.setValueAtTime(freq, time);
    }

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(14) as Float32Array<ArrayBuffer>;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1650, time);
    bp.Q.setValueAtTime(0.9, time);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(shaper).connect(bp).connect(g).connect(dest);
    osc.onended = () => {
      osc.disconnect();
      shaper.disconnect();
      bp.disconnect();
      g.disconnect();
    };
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private stopProceduralBgm(): void {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private fadeOutExternalBgm(ctx: AudioContext | null, fadeSec = 0.35): void {
    const oldSrc = this.extBgmSrc;
    const oldGain = this.extBgmGain;
    this.extBgmSrc = null;
    this.extBgmGain = null;
    this.extBgmId = null;
    if (!oldSrc) return;
    try {
      if (ctx && oldGain) {
        const now = ctx.currentTime;
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);
        oldGain.gain.linearRampToValueAtTime(0.001, now + fadeSec);
        oldSrc.stop(now + fadeSec + 0.03);
      } else {
        oldSrc.stop();
        oldSrc.disconnect();
        oldGain?.disconnect();
      }
    } catch {
      // ignore
    }
  }

  private stopBgm(): void {
    this.extBgmSeq++;
    this.stopProceduralBgm();
    this.fadeOutExternalBgm(this.ctx, 0.15);
  }

  private startWeatherAmbience(weather: WeatherAudioKind): void {
    this.stopWeatherAmbience();
    if (weather === 'sunny') return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      if (weather === 'rain') {
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2400, ctx.currentTime);
        gain.gain.setValueAtTime(0.016, ctx.currentTime);
      } else if (weather === 'wind') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(420, ctx.currentTime);
        filter.Q.setValueAtTime(3.2, ctx.currentTime);
        gain.gain.setValueAtTime(0.022, ctx.currentTime);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(0.22, ctx.currentTime);
        lfoGain.gain.setValueAtTime(220, ctx.currentTime);
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();
        this.weatherLfo = lfo;
      } else {
        // heat: 低频闷热空气嗡鸣
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, ctx.currentTime);
        gain.gain.setValueAtTime(0.014, ctx.currentTime);
      }

      src.connect(filter).connect(gain).connect(this.getAmbienceBus(ctx));
      src.start();
      this.weatherSrc = src;
      this.weatherGain = gain;
    } catch {
      // ignore
    }
  }

  private stopWeatherAmbience(): void {
    try {
      this.weatherLfo?.stop();
      this.weatherLfo?.disconnect();
      this.weatherSrc?.stop();
      this.weatherSrc?.disconnect();
      this.weatherGain?.disconnect();
    } catch {
      // ignore
    }
    this.weatherLfo = null;
    this.weatherSrc = null;
    this.weatherGain = null;
  }

  public startCrowdAmbience(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.crowdSrc) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(340, ctx.currentTime);
      filter.Q.setValueAtTime(0.7, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.016, ctx.currentTime);
      src.connect(filter).connect(gain).connect(this.getAmbienceBus(ctx));
      src.start();
      this.crowdSrc = src;
      this.crowdFilter = filter;
      this.crowdGain = gain;
    } catch {
      // ignore audio errors
    }
  }

  public pulseCrowd(intensity = 0.6, durationSec = 1.1): void {
    if (this.muted || !this.crowdGain || !this.crowdFilter) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const clamped = Math.max(0.1, Math.min(1.0, intensity));
    const targetGain = 0.016 + clamped * 0.048;
    const targetFreq = 340 + clamped * 620;
    try {
      const now = ctx.currentTime;
      this.crowdGain.gain.setTargetAtTime(targetGain, now, 0.08);
      this.crowdFilter.frequency.setTargetAtTime(targetFreq, now, 0.09);
      if (this.crowdDecayTimer) clearTimeout(this.crowdDecayTimer);
      this.crowdDecayTimer = setTimeout(() => {
        if (!this.crowdGain || !this.crowdFilter || !this.ctx) return;
        const t = this.ctx.currentTime;
        this.crowdGain.gain.setTargetAtTime(this.highTension ? 0.024 : 0.016, t, 0.45);
        this.crowdFilter.frequency.setTargetAtTime(this.highTension ? 460 : 340, t, 0.45);
      }, Math.round(durationSec * 1000));
    } catch {
      // ignore
    }
  }

  public stopCrowdAmbience(): void {
    if (this.crowdDecayTimer) {
      clearTimeout(this.crowdDecayTimer);
      this.crowdDecayTimer = null;
    }
    try {
      this.crowdSrc?.stop();
      this.crowdSrc?.disconnect();
      this.crowdFilter?.disconnect();
      this.crowdGain?.disconnect();
    } catch {
      // ignore
    }
    this.crowdSrc = null;
    this.crowdFilter = null;
    this.crowdGain = null;
  }

  public playRewardChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.055;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.045);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain).connect(this.getSfxBus(ctx));
    osc.start(now);
    osc.stop(now + 0.055);
  }

  private playSingleWhistle(ctx: AudioContext, startTime: number, duration: number): void {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(2680, startTime);
    osc2.frequency.setValueAtTime(2765, startTime);

    lfo.frequency.setValueAtTime(36, startTime);
    lfoGain.gain.setValueAtTime(75, startTime);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.075, startTime + 0.02);
    gain.gain.setValueAtTime(0.075, startTime + duration - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.getSfxBus(ctx));

    osc1.start(startTime);
    osc2.start(startTime);
    lfo.start(startTime);
    osc1.stop(startTime + duration + 0.01);
    osc2.stop(startTime + duration + 0.01);
    lfo.stop(startTime + duration + 0.01);
  }

  public playWhistle(kind: 'kickoff' | 'halftime' | 'fulltime' | 'foul'): void {
    const extKey: ExternalSfxId = kind === 'foul' ? 'sfx_whistle_short' : 'sfx_whistle_long';
    if (this.playExternalSfx(extKey, kind === 'fulltime' ? 0.9 : 0.75)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (kind === 'kickoff' || kind === 'foul') {
      this.playSingleWhistle(ctx, now, kind === 'foul' ? 0.16 : 0.24);
    } else if (kind === 'halftime') {
      this.playSingleWhistle(ctx, now, 0.16);
      this.playSingleWhistle(ctx, now + 0.24, 0.32);
    } else {
      this.playSingleWhistle(ctx, now, 0.14);
      this.playSingleWhistle(ctx, now + 0.20, 0.14);
      this.playSingleWhistle(ctx, now + 0.40, 0.42);
    }
  }

  public playShot(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.09);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain).connect(this.getSfxBus(ctx));
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playSave(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    src.connect(filter).connect(gain).connect(this.getSfxBus(ctx));
    src.start(now);
    src.stop(now + 0.1);
  }

  public playCard(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.setValueAtTime(620, now + 0.08);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(this.getSfxBus(ctx));
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playGoalCheer(): void {
    this.playExternalSfx('sfx_goal_roar', 0.85);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. 球场欢呼声浪（带通滤波噪声包络）
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.linearRampToValueAtTime(1150, now + 0.35);
    filter.Q.setValueAtTime(0.9, now);

    const crowdGain = ctx.createGain();
    crowdGain.gain.setValueAtTime(0.001, now);
    crowdGain.gain.linearRampToValueAtTime(0.14, now + 0.18);
    crowdGain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
    src.connect(filter).connect(crowdGain).connect(this.getSfxBus(ctx));
    src.start(now);
    src.stop(now + 1.4);

    // 2. 进球提示音大三和弦
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = now + idx * 0.06;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playSub(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 587.33].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.055;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.055, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  public playCommandCard(corrupted = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = corrupted ? [392, 466.16, 311.13] : [440, 554.37, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.04;
      osc.type = corrupted ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(corrupted ? 0.045 : 0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  public playCraftSuccess(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.045;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.055, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playBreakthrough(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587.33, 739.99, 880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.04;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.065, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playWarning(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [240, 185].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.08;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  public playFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    seq.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.08;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.44);
    });
  }

  public playChronicleChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.085;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.065, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  public playPackRip(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2800, now + 0.28);
    filter.Q.setValueAtTime(1.4, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    src.connect(filter).connect(gain).connect(this.getSfxBus(ctx));
    src.start(now);
    src.stop(now + 0.36);

    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.26);
    oGain.gain.setValueAtTime(0.05, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(oGain).connect(this.getSfxBus(ctx));
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playCardFlip(rarity: 'common' | 'rare' | 'epic' = 'common'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs =
      rarity === 'epic'
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
        : rarity === 'rare'
        ? [440, 554.37, 659.25, 880]
        : [392, 523.25];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.035;
      osc.type = rarity === 'epic' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(rarity === 'epic' ? 0.065 : 0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (rarity === 'epic' ? 0.36 : 0.18));
      osc.connect(gain).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  /** 八卦星盘双环旋转：石盘/黄铜齿轮摩擦 + 棘轮卡位声 + 奇点对齐星辉共鸣 */
  public playAstrolabeRotate(ring: 'outer' | 'inner' = 'outer'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const isOuter = ring === 'outer';

    // 1. 齿轮石盘滑动摩擦（带通噪声扫频）
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isOuter ? 240 : 420, now);
    bp.frequency.exponentialRampToValueAtTime(isOuter ? 620 : 980, now + 0.16);
    bp.Q.setValueAtTime(2.6, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(isOuter ? 0.11 : 0.09, now + 0.04);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    noise.connect(bp).connect(nGain).connect(this.getSfxBus(ctx));
    noise.start(now);
    noise.stop(now + 0.24);

    // 2. 齿轮棘轮分段咔哒声（3 连微棘齿 + 最终落锁重击）
    const ticks = [0.03, 0.09, 0.16];
    ticks.forEach((dt, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = now + dt;
      osc.type = idx === 2 ? 'triangle' : 'square';
      const baseF = isOuter ? 160 + idx * 45 : 240 + idx * 65;
      osc.frequency.setValueAtTime(baseF, t);
      osc.frequency.exponentialRampToValueAtTime(58, t + (idx === 2 ? 0.09 : 0.04));
      g.gain.setValueAtTime(idx === 2 ? 0.095 : 0.035, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (idx === 2 ? 0.11 : 0.045));
      osc.connect(g).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.12);
    });

    // 3. 奇点对齐星辉泛音（卡位瞬间响起）
    const chord = isOuter ? [523.25, 783.99, 1046.5] : [587.33, 880.0, 1174.66];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = now + 0.17 + i * 0.025;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.042, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(g).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  /** 八卦星盘落锁共鸣（厚重低频钟鸣 + 金色和弦） */
  public playAstrolabeLock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bass = ctx.createOscillator();
    const bGain = ctx.createGain();
    bass.type = 'triangle';
    bass.frequency.setValueAtTime(130.81, now);
    bass.frequency.exponentialRampToValueAtTime(65.41, now + 0.45);
    bGain.gain.setValueAtTime(0.14, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    bass.connect(bGain).connect(this.getSfxBus(ctx));
    bass.start(now);
    bass.stop(now + 0.58);

    [392.0, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t = now + 0.04 + i * 0.04;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
      osc.connect(g).connect(this.getSfxBus(ctx));
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  /** 比赛微音效：抢断/拦截的草皮碰撞声（带冷却防刷屏） */
  public playTackle(): void {
    const nowMs = Date.now();
    if (nowMs - this.lastTackleAt < 450) return;
    this.lastTackleAt = nowMs;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(560, now);
    bp.Q.setValueAtTime(1.1, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.065, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    src.connect(bp).connect(g).connect(this.getSfxBus(ctx));
    src.start(now);
    src.stop(now + 0.095);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.06);
    og.gain.setValueAtTime(0.07, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(og).connect(this.getSfxBus(ctx));
    osc.start(now);
    osc.stop(now + 0.07);
  }
}

export const SoundEngine = new SoundEngineImpl();
