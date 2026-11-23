/**
 * 跨平台适配接口（Steam 桌面壳 / 微信小游戏壳各自实现）
 */

export interface SafeAreaInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlatformAdapter {
  name: 'steam' | 'wechat' | 'web';
  loadSave(key: string): string | null;
  writeSave(key: string, data: string): void;
  clearSave?(key: string): void;
  getSafeArea(): SafeAreaInsets;
  promptText?(title: string, defaultValue: string, onDone: (value: string) => void): void;
}
