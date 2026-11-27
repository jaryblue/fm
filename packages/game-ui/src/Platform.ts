/**
 * 跨平台适配接口（Steam 桌面壳 / 浏览器 / 微信小游戏壳各自实现）
 */

export interface SafeAreaInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SaveSlotSnapshot {
  slotId: string;
  raw: string | null;
}

export interface PlatformAdapter {
  name: 'steam' | 'wechat' | 'web';
  isDesktop?: boolean;
  loadSave(key: string): string | null;
  writeSave(key: string, data: string): void;
  clearSave?(key: string): void;
  getSafeArea(): SafeAreaInsets;
  promptText?(title: string, defaultValue: string, onDone: (value: string) => void): void;

  // 多存档槽位
  getActiveSlotId?(): string;
  setActiveSlotId?(slotId: string): void;
  listSaveSlots?(): SaveSlotSnapshot[];

  // 桌面端窗口与设置持久化
  isFullscreen?(): boolean;
  toggleFullscreen?(): void;
  quitApp?(): void;
  loadSettings?(): string | null;
  saveSettings?(data: string): void;
  bindImeInput?(
    initialValue: string,
    maxLen: number,
    onChange: (val: string) => void,
    onSubmit: () => void,
    onCancel: () => void
  ): () => void;
}
