const lightTheme = {
  brand: {
    50: '#ebf9ec',
    100: '#d7f4da',
    200: '#a3e5a9',
    300: '#67d572',
    400: '#33c641',
    500: '#00b812',
    600: '#00930e',
    700: '#006f0b',
    800: '#005809',
    900: '#004206',
  },
  gray: {
    50: '#f9f9fb',
    100: '#f2f2f7',
    200: '#e7e7ee',
    300: '#d3d3de',
    400: '#a0a0b0',
    500: '#6e6e86',
    600: '#49495f',
    700: '#35354b',
    800: '#1f1f31',
    900: '#12121e',
  },
  green: {
    50: '#effbf2',
    100: '#dff6e5',
    200: '#b6ebc3',
    300: '#86de9c',
    400: '#5dd27a',
    500: '#34c759',
    600: '#2a9f47',
    700: '#1f7836',
    800: '#195f2b',
    900: '#134820',
  },
  blue: {
    50: '#ebf5ff',
    100: '#d7eaff',
    200: '#a3cfff',
    300: '#67b0ff',
    400: '#3395ff',
    500: '#007aff',
    600: '#0062cc',
    700: '#004a9a',
    800: '#003a7a',
    900: '#002c5c',
  },
  yellow: {
    50: '#fffbeb',
    100: '#fff7d7',
    200: '#ffeda3',
    300: '#ffe167',
    400: '#ffd633',
    500: '#ffcc00',
    600: '#cca300',
    700: '#9a7b00',
    800: '#7a6200',
    900: '#5c4a00',
  },
  red: {
    50: '#fff0ef',
    100: '#ffe0df',
    200: '#ffb8b4',
    300: '#ff8a84',
    400: '#ff6259',
    500: '#ff3b30',
    600: '#cc2f26',
    700: '#9a241d',
    800: '#7a1c17',
    900: '#5c1511',
  },
} as const;

const darkTheme = {
  brand: {
    50: '#004206',
    100: '#005809',
    200: '#006F0B',
    300: '#00930E',
    400: '#00B812',
    500: '#33C641',
    600: '#67D572',
    700: '#A3E5A9',
    800: '#D7F4DA',
    900: '#EBF9EC',
  },
  gray: {
    50: '#12121E',
    100: '#1F1F31',
    200: '#35354B',
    300: '#49495F',
    400: '#6E6E86',
    500: '#A0A0B0',
    600: '#D3D3DE',
    700: '#E7E7EE',
    800: '#F2F2F7',
    900: '#F9F9FB',
  },
  green: {
    50: '#134820',
    100: '#195F2B',
    200: '#1F7836',
    300: '#2A9F47',
    400: '#34C759',
    500: '#5DD27A',
    600: '#86DE9C',
    700: '#B6EBC3',
    800: '#DFF6E5',
    900: '#EFFBF2',
  },
  blue: {
    50: '#002C5C',
    100: '#003A7A',
    200: '#004A9A',
    300: '#0062CC',
    400: '#007AFF',
    500: '#3395FF',
    600: '#67B0FF',
    700: '#A3CFFF',
    800: '#D7EAFF',
    900: '#EBF5FF',
  },
  yellow: {
    50: '#5C4A00',
    100: '#7A6200',
    200: '#9A7B00',
    300: '#CCA300',
    400: '#FFCC00',
    500: '#FFD633',
    600: '#FFE167',
    700: '#FFEDA3',
    800: '#FFF7D7',
    900: '#FFFBEB',
  },
  red: {
    50: '#5C1511',
    100: '#7A1C17',
    200: '#9A241D',
    300: '#CC2F26',
    400: '#FF3B30',
    500: '#FF6259',
    600: '#FF8A84',
    700: '#FFB8B4',
    800: '#FFE0DF',
    900: '#FFF0EF',
  },
} as const;

const theme = {
  light: lightTheme,
  dark: darkTheme,
} as const;

export type ThemeVariant = keyof typeof theme;
export type ThemeValues = typeof theme[ThemeVariant];

const DEFAULT_THEME_VARIANT = 'light';

export const getDefaultTheme = (initial?: string): ThemeVariant => {
  if (Object.keys(theme).includes(initial ?? '')) {
    return initial as ThemeVariant;
  }

  // TODO: 系统主题判断 & 缓存判断
  return DEFAULT_THEME_VARIANT;
};

export default theme;
