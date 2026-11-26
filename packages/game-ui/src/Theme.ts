/**
 * FM27 风格 1280×720 设计系统常量
 */

export const IS_MOBILE =
  typeof window !== 'undefined' &&
  (Boolean(window.matchMedia?.('(pointer: coarse)').matches) ||
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''));

export const THEME = {
  W: 1280,
  H: 720,

  // 色彩系统
  BG_DEEP: '#080C14',
  BG_MID: '#0B111E',
  BG_PANEL: '#0E1628',
  BG_CARD: '#131E36',
  BG_CARD_HOVER: '#1B2A4A',
  BG_PITCH: '#113A21',
  BG_PITCH_ALT: '#144226',

  GOLD: '#D4A843',
  GOLD_LIGHT: '#FACC15',
  GOLD_HOT: '#FEF08A',
  FLAME: '#F97316',
  FLAME_LIGHT: '#FB923C',
  RED: '#DC2626',
  RED_LIGHT: '#F87171',
  BLUE: '#2563EB',
  BLUE_LIGHT: '#60A5FA',
  GREEN: '#22C55E',
  PURPLE: '#A855F7',

  TX1: '#F1F5F9',
  TX2: '#94A3B8',
  TX3: '#64748B',

  BORDER: 'rgba(255,255,255,0.08)',
  BORDER_GOLD: 'rgba(212,168,67,0.55)',

  FONT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
  DISPLAY_FONT_CN: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", sans-serif',
  DISPLAY_FONT_NUM: '"Impact", "Arial Black", "DIN Alternate", "Helvetica Neue", sans-serif',
} as const;
