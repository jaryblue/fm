/**
 * @fm-league/steam - Steam / 浏览器桌面端入口
 * 支持 Retina HiDPI (`devicePixelRatio`) 高清缩放、桌面端快捷键 (Space / 1-4 / Escape)
 * 与后端 SQLite 数据库持久化。存档按 8 位口令隔离：save_key = SAVE_KEY_<口令>
 */

import { GameApp, PlatformAdapter, SAVE_KEY, THEME } from '../../../packages/game-ui/src/index';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let currentDpr = 1;
function applyHiDPI(): void {
  const dpr = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
  if (dpr !== currentDpr || canvas.width !== Math.round(THEME.W * dpr)) {
    currentDpr = dpr;
    canvas.width = Math.round(THEME.W * dpr);
    canvas.height = Math.round(THEME.H * dpr);
  }
  ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
}
applyHiDPI();
window.addEventListener('resize', applyHiDPI);

const LEGACY_SAVE_KEY = 'fm_league_steam_v1';
const GLOBAL_SAVE_KEY = SAVE_KEY; // 历史全局存档键（无口令时代），仅用于首次迁移
const memorySaveCache = new Map<string, string>();
let saveSyncTimer: number | null = null;
let lastSyncedData: string | null = null;

// 当前口令隔离后的存档键，在 boot() 中根据口令确定
let activeSaveKey = GLOBAL_SAVE_KEY;

async function syncSaveToServer(key: string, data: string): Promise<void> {
  lastSyncedData = data;
  try {
    await fetch(`/api/saves/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
      keepalive: true,
    });
  } catch {
    // 网络异常时保留内存状态，不阻塞前端帧率
  }
}

// 页面隐藏/卸载时强制同步尚未落盘的最后一笔，防止防抖窗口内刷新丢档
function flushPendingSave(): void {
  if (saveSyncTimer !== null) {
    window.clearTimeout(saveSyncTimer);
    saveSyncTimer = null;
  }
  const data = memorySaveCache.get(activeSaveKey);
  if (data && data !== lastSyncedData) {
    void syncSaveToServer(activeSaveKey, data);
  }
}

window.addEventListener('pagehide', flushPendingSave);
window.addEventListener('beforeunload', flushPendingSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPendingSave();
});

// 从服务器读取指定键，返回存档字符串或 null
async function fetchSave(key: string): Promise<string | null> {
  try {
    const resp = await fetch(`/api/saves/${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (resp.ok) {
      const json = await resp.json() as { ok?: boolean; data?: string };
      if (json.ok && typeof json.data === 'string' && json.data.length > 0) {
        return json.data;
      }
    }
  } catch {
    // ignore fetch errors on startup
  }
  return null;
}

async function hydrateFromDatabase(key: string): Promise<void> {
  // 1. 优先读当前口令自己的存档
  const own = await fetchSave(key);
  if (own) {
    memorySaveCache.set(key, own);
    lastSyncedData = own;
    return;
  }

  // 2. 兼容：当前口令首次使用，尝试迁移历史全局存档（无口令时代的数据）
  if (key !== GLOBAL_SAVE_KEY) {
    const legacyServer = await fetchSave(GLOBAL_SAVE_KEY);
    if (legacyServer) {
      memorySaveCache.set(key, legacyServer);
      await syncSaveToServer(key, legacyServer);
      // 迁移后保留全局档，不删除，避免影响其他尚未设置口令的入口
      return;
    }
  }

  // 3. 兼容：浏览器 localStorage 里的旧档（迁移到当前口令键）
  try {
    const legacy = window.localStorage.getItem(GLOBAL_SAVE_KEY) || window.localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacy) {
      memorySaveCache.set(key, legacy);
      await syncSaveToServer(key, legacy);
      window.localStorage.removeItem(GLOBAL_SAVE_KEY);
      window.localStorage.removeItem(LEGACY_SAVE_KEY);
    }
  } catch {
    // ignore legacy migration errors
  }
}

const steamPlatform: PlatformAdapter = {
  name: 'steam',
  loadSave(_key: string): string | null {
    // GameApp 内部始终用固定键，这里重定向到口令隔离的实际键
    return memorySaveCache.get(activeSaveKey) ?? null;
  },
  writeSave(_key: string, data: string): void {
    memorySaveCache.set(activeSaveKey, data);
    if (saveSyncTimer !== null) {
      window.clearTimeout(saveSyncTimer);
    }
    saveSyncTimer = window.setTimeout(() => {
      saveSyncTimer = null;
      void syncSaveToServer(activeSaveKey, data);
    }, 120);
  },
  clearSave(_key: string): void {
    memorySaveCache.delete(activeSaveKey);
    void fetch(`/api/saves/${encodeURIComponent(activeSaveKey)}`, { method: 'DELETE' }).catch(() => {});
  },
  getSafeArea() {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  },
  promptText(title: string, defaultValue: string, onDone: (val: string) => void) {
    const res = window.prompt(title, defaultValue);
    if (res !== null) {
      const trimmed = res.trim();
      if (trimmed) onDone(trimmed.slice(0, 12));
    }
  },
};

function toDesignCoord(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * THEME.W,
    y: ((clientY - rect.top) / rect.height) * THEME.H,
  };
}

// 等待 index.html 的口令门确定口令（字符串或 Promise）
async function resolveAccessCode(): Promise<string> {
  const g = globalThis as unknown as { __fmAccessCode?: string | Promise<string> };
  const value = g.__fmAccessCode;
  const code = typeof value === 'string' ? value : value ? await value : '';
  return /^[A-Z0-9]{8}$/.test(code) ? code : 'GUEST01';
}

async function boot(): Promise<void> {
  const code = await resolveAccessCode();
  activeSaveKey = `${GLOBAL_SAVE_KEY}_${code}`;
  await hydrateFromDatabase(activeSaveKey);

  const app = new GameApp(steamPlatform);

  canvas.addEventListener('pointermove', (e) => {
    const pt = toDesignCoord(e.clientX, e.clientY);
    app.onPointerMove(pt.x, pt.y);
  });

  canvas.addEventListener('pointerdown', (e) => {
    const pt = toDesignCoord(e.clientX, e.clientY);
    app.onPointerDown(pt.x, pt.y);
  });

  canvas.addEventListener('pointerup', (e) => {
    const pt = toDesignCoord(e.clientX, e.clientY);
    app.onPointerUp?.(pt.x, pt.y);
  });

  canvas.addEventListener('wheel', (e) => {
    const pt = toDesignCoord(e.clientX, e.clientY);
    if (app.onWheel?.(e.deltaY, pt.x, pt.y)) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Escape' || ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
      if (typeof (app as unknown as { onKeyDown?: (code: string) => void }).onKeyDown === 'function') {
        (app as unknown as { onKeyDown: (code: string) => void }).onKeyDown(e.code);
      }
    }
  });

  let lastTs = performance.now();
  function loop(now: number) {
    const dtSec = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;
    applyHiDPI();
    app.update(dtSec);
    app.render(ctx);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

void boot();
