/**
 * PITCH PRINT v1.0 移动端唯一大字舒展版 1280×720 设计系统常量
 * 70% 深松柏绿战术底 (#0A1A14 / #112920) · 20% 暖象牙实体档案卡 (#F4EFE4) · 10% 高能信号色 (#E03A2E / #C8F230 / #D8A842)
 */

export const IS_MOBILE =
  typeof window !== 'undefined' &&
  (Boolean(window.matchMedia?.('(pointer: coarse)').matches) ||
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''));

export const THEME = {
  W: 1280,
  H: 720,

  // L0 战术底 (70%)
  BG_DEEP: '#0A1A14',
  BG_MID: '#0E231B',
  BG_PANEL: '#112920',
  BG_CARD: '#16231D',
  BG_CARD_DARK: '#16231D',
  BG_CARD_HOVER: '#1E3128',
  BG_PITCH: '#112920',
  BG_PITCH_ALT: '#163529',

  // L1 暖纸档案卡 (20%) & 墨线硬影
  PAPER_CREAM: '#F4EFE4',
  PAPER_WARM: '#E7DEC9',
  PAPER_INK: '#141916',
  PAPER_MUTED: '#556159',
  INK_LINE: '#111412',
  HARD_SHADOW: '#07100C',

  // L2 信号色 (10%) & 语义别名
  GOLD: '#D8A842',
  GOLD_LIGHT: '#E7C266',
  GOLD_HOT: '#FEF08A',
  BRASS: '#D8A842',

  FLAME: '#E03A2E',
  FLAME_LIGHT: '#F25C50',
  RED: '#E03A2E',
  RED_LIGHT: '#F87171',
  VERMILION: '#E03A2E',

  BLUE: '#2B6BE6',
  BLUE_LIGHT: '#60A5FA',
  COBALT: '#2B6BE6',

  GREEN: '#C8F230',
  LIME: '#C8F230',

  PURPLE: '#7C3AED',
  VIOLET: '#7C3AED',

  // 深底文字色
  TX1: '#F4EFE4',
  TX2: '#9AB0A3',
  TX3: '#6E8578',

  BORDER: 'rgba(17,20,18,0.85)',
  BORDER_GOLD: 'rgba(216,168,66,0.55)',

  FONT_FAMILY: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
  NUM_FONT_FAMILY: '"DIN Alternate", "SF Pro Display", "Segoe UI", -apple-system, "PingFang SC", sans-serif',
  DISPLAY_FONT_CN: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", sans-serif',
  DISPLAY_FONT_NUM: '"DIN Alternate", "Impact", "Arial Black", "Helvetica Neue", sans-serif',
} as const;
