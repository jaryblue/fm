/**
 * @fm-league/steam - Steam 桌面端 / 浏览器桌面入口
 * - 支持 Retina HiDPI (`devicePixelRatio`) 16:9 等比缩放
 * - 移除浏览器口令门与 window.prompt，接入 Canvas 内置输入法桥接
 * - 支持 3 档多存档槽位：Electron 桌面端直存 userData/saves/*.json，浏览器端回退 localStorage
 */

import { GameApp, PlatformAdapter, SAVE_KEY, SaveSlotSnapshot, THEME } from '../../../packages/game-ui/src/index';
import { IS_MOBILE } from '../../../packages/game-ui/src/Theme';

interface ElectronBridge {
  isDesktop: boolean;
  loadSaveSync(slotId: string): string | null;
  writeSave(slotId: string, data: string): void;
  deleteSave(slotId: string): void;
  loadSettingsSync(): string | null;
  saveSettings(data: string): void;
  isFullscreenSync(): boolean;
  toggleFullscreen(): void;
  quitApp(): void;
}

const gWin = globalThis as unknown as { electronBridge?: ElectronBridge };
const bridge = gWin.electronBridge;

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let currentDpr = 1;
function applyHiDPI(): void {
  const dprCap = IS_MOBILE ? 1.25 : 2.0;
  const dpr = Math.min(dprCap, Math.max(1, window.devicePixelRatio || 1));
  if (dpr !== currentDpr || canvas.width !== Math.round(THEME.W * dpr)) {
    currentDpr = dpr;
    canvas.width = Math.round(THEME.W * dpr);
    canvas.height = Math.round(THEME.H * dpr);
  }
  ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
}
applyHiDPI();
window.addEventListener('resize', applyHiDPI);

const SLOT_IDS = ['slot_1', 'slot_2', 'slot_3'] as const;
const ACTIVE_SLOT_KEY = 'fm_league_active_slot';
const SETTINGS_KEY = 'fm_league_settings_v1';

function slotStorageKey(slotId: string): string {
  return `${SAVE_KEY}_${slotId}`;
}

function readSlotRaw(slotId: string): string | null {
  if (bridge) {
    try {
      return bridge.loadSaveSync(slotId);
    } catch {
      return null;
    }
  }
  try {
    return window.localStorage.getItem(slotStorageKey(slotId));
  } catch {
    return null;
  }
}

function writeSlotRaw(slotId: string, data: string): void {
  if (bridge) {
    try {
      bridge.writeSave(slotId, data);
    } catch {
      // ignore
    }
  }
  try {
    window.localStorage.setItem(slotStorageKey(slotId), data);
  } catch {
    // ignore storage quota errors
  }
}

function deleteSlotRaw(slotId: string): void {
  if (bridge) {
    try {
      bridge.deleteSave(slotId);
    } catch {
      // ignore
    }
  }
  try {
    window.localStorage.removeItem(slotStorageKey(slotId));
  } catch {
    // ignore
  }
}

let activeSlotId = 'slot_1';
try {
  const savedSlot = window.localStorage.getItem(ACTIVE_SLOT_KEY);
  if (savedSlot && (SLOT_IDS as readonly string[]).includes(savedSlot)) {
    activeSlotId = savedSlot;
  }
} catch {
  // ignore
}

// 兼容迁移旧版单槽位存档 (fm_league_save_v1) 到 slot_1
try {
  const legacy = window.localStorage.getItem(SAVE_KEY);
  if (legacy && !readSlotRaw('slot_1')) {
    writeSlotRaw('slot_1', legacy);
  }
} catch {
  // ignore
}

let imeActive = false;

const steamPlatform: PlatformAdapter = {
  name: 'steam',
  isDesktop: !!bridge?.isDesktop,
  loadSave(_key: string): string | null {
    return readSlotRaw(activeSlotId);
  },
  writeSave(_key: string, data: string): void {
    writeSlotRaw(activeSlotId, data);
  },
  clearSave(_key: string): void {
    deleteSlotRaw(activeSlotId);
  },
  getSafeArea() {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  },
  getActiveSlotId(): string {
    return activeSlotId;
  },
  setActiveSlotId(slotId: string): void {
    if ((SLOT_IDS as readonly string[]).includes(slotId)) {
      activeSlotId = slotId;
      try {
        window.localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
      } catch {
        // ignore
      }
    }
  },
  listSaveSlots(): SaveSlotSnapshot[] {
    return SLOT_IDS.map(slotId => ({ slotId, raw: readSlotRaw(slotId) }));
  },
  isFullscreen(): boolean {
    if (bridge) {
      try {
        return bridge.isFullscreenSync();
      } catch {
        return false;
      }
    }
    return !!document.fullscreenElement;
  },
  toggleFullscreen(): void {
    if (bridge) {
      bridge.toggleFullscreen();
      return;
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  },
  quitApp: bridge ? () => bridge.quitApp() : undefined,
  loadSettings(): string | null {
    if (bridge) {
      try {
        const s = bridge.loadSettingsSync();
        if (s) return s;
      } catch {
        // ignore
      }
    }
    try {
      return window.localStorage.getItem(SETTINGS_KEY);
    } catch {
      return null;
    }
  },
  saveSettings(data: string): void {
    if (bridge) {
      try {
        bridge.saveSettings(data);
      } catch {
        // ignore
      }
    }
    try {
      window.localStorage.setItem(SETTINGS_KEY, data);
    } catch {
      // ignore
    }
  },
  bindImeInput(initialValue, maxLen, onChange, onSubmit, onCancel) {
    const el = document.getElementById('imeBridge') as HTMLInputElement | null;
    if (!el) return () => {};
    imeActive = true;
    el.value = initialValue;
    el.maxLength = maxLen;
    let composing = false;

    const handleInput = () => {
      if (composing) return;
      onChange(el.value.slice(0, maxLen));
    };
    const handleCompStart = () => {
      composing = true;
    };
    const handleCompEnd = () => {
      composing = false;
      onChange(el.value.slice(0, maxLen));
    };
    const handleKey = (e: KeyboardEvent) => {
      if (composing) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    el.addEventListener('input', handleInput);
    el.addEventListener('compositionstart', handleCompStart);
    el.addEventListener('compositionend', handleCompEnd);
    el.addEventListener('keydown', handleKey);
    window.setTimeout(() => el.focus(), 10);

    return () => {
      imeActive = false;
      el.removeEventListener('input', handleInput);
      el.removeEventListener('compositionstart', handleCompStart);
      el.removeEventListener('compositionend', handleCompEnd);
      el.removeEventListener('keydown', handleKey);
      el.blur();
    };
  },
};

function toDesignCoord(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * THEME.W,
    y: ((clientY - rect.top) / rect.height) * THEME.H,
  };
}

function boot(): void {
  const app = new GameApp(steamPlatform);

  let lastInteractionMs = performance.now();
  const markActive = () => {
    lastInteractionMs = performance.now();
  };

  const activePointers = new Map<number, { x: number; y: number }>();
  let lastPinchDist = 0;

  const getPinchMetrics = () => {
    const pts = Array.from(activePointers.values());
    if (pts.length < 2) return null;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return {
      dist: Math.hypot(dx, dy),
      cx: (pts[0].x + pts[1].x) * 0.5,
      cy: (pts[0].y + pts[1].y) * 0.5,
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    markActive();
    const pt = toDesignCoord(e.clientX, e.clientY);
    activePointers.set(e.pointerId, pt);
    if (activePointers.size === 2) {
      const m = getPinchMetrics();
      lastPinchDist = m ? m.dist : 0;
      app.onPointerUp?.(pt.x, pt.y);
      return;
    }
    if (activePointers.size === 1) {
      app.onPointerDown(pt.x, pt.y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    markActive();
    const pt = toDesignCoord(e.clientX, e.clientY);
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, pt);
    }
    if (activePointers.size >= 2) {
      const m = getPinchMetrics();
      if (m && lastPinchDist > 4 && m.dist > 4) {
        const factor = m.dist / lastPinchDist;
        if (Math.abs(factor - 1) > 0.005) {
          app.onPinchZoom?.(factor, m.cx, m.cy);
          lastPinchDist = m.dist;
        }
      }
      return;
    }
    app.onPointerMove(pt.x, pt.y);
  });

  const handlePointerEnd = (e: PointerEvent) => {
    markActive();
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      lastPinchDist = 0;
    }
    const pt = toDesignCoord(e.clientX, e.clientY);
    app.onPointerUp?.(pt.x, pt.y);
  };

  canvas.addEventListener('pointerup', handlePointerEnd);
  canvas.addEventListener('pointercancel', handlePointerEnd);

  canvas.addEventListener('wheel', (e) => {
    markActive();
    const pt = toDesignCoord(e.clientX, e.clientY);
    if (app.onWheel?.(e.deltaY, pt.x, pt.y)) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    markActive();
    if (imeActive) return;
    if (e.code === 'F11') {
      e.preventDefault();
    }
    app.onKeyDown(e.code, e.key);
  });

  let lastRenderTs = performance.now();
  function loop(now: number) {
    const highFps = app.needsHighFps() || (now - lastInteractionMs) < 750;
    const minFrameMs = highFps ? (IS_MOBILE ? 16 : 0) : (IS_MOBILE ? 80 : 33);
    const elapsedMs = now - lastRenderTs;
    if (elapsedMs < minFrameMs) {
      requestAnimationFrame(loop);
      return;
    }
    const dtSec = Math.min(0.05, elapsedMs / 1000);
    lastRenderTs = now;
    app.update(dtSec);
    app.render(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

boot();
