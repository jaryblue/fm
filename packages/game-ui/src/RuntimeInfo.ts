/**
 * 运行时版本与 OTA 状态桥接
 * - 版本号来自构建期注入的 ota-native.js（随 bundle 一起热更）
 * - OTA 待生效状态来自原生层：桌面端 electronBridge IPC，安卓端 AndroidOtaBridge
 */

declare const window: Window & {
  __FM_NATIVE_HASH__?: string;
  __FM_NATIVE_VERSION__?: string;
  electronBridge?: {
    getOtaStatus?: () => Promise<OtaStatus>;
    restartApp?: () => void;
  };
  AndroidOtaBridge?: {
    getOtaStatus: () => string; // JSON string of OtaStatus
    restartApp: () => void;
  };
};

export interface OtaStatus {
  /** 是否有已经下载完成、等待下次启动生效的更新 */
  pendingVersion: string | null;
  /** 当前正在运行的 bundle 版本 */
  activeVersion: string | null;
}

/** 当前运行的 bundle 版本号（构建期注入，热更后自动更新） */
export function getRunningVersion(): string {
  const v = window.__FM_NATIVE_VERSION__;
  if (v) return v;
  const h = window.__FM_NATIVE_HASH__;
  return h ? `dev+${h}` : 'dev';
}

/** 读取 OTA 状态；不支持或失败时返回 null，不阻塞游戏 */
export async function getOtaStatus(): Promise<OtaStatus | null> {
  try {
    if (window.electronBridge?.getOtaStatus) {
      return await window.electronBridge.getOtaStatus();
    }
    if (window.AndroidOtaBridge) {
      const raw = window.AndroidOtaBridge.getOtaStatus();
      return raw ? (JSON.parse(raw) as OtaStatus) : null;
    }
  } catch {
    // 桥接异常一律视为无更新，绝不阻塞启动
  }
  return null;
}

/** 重启应用以应用已下载的更新 */
export function restartAppForUpdate(): void {
  try {
    if (window.electronBridge?.restartApp) {
      window.electronBridge.restartApp();
      return;
    }
    if (window.AndroidOtaBridge) {
      window.AndroidOtaBridge.restartApp();
    }
  } catch {
    // 重启失败时用户仍可手动重启
  }
}
