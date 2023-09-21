import { createAnimations } from '@tamagui/animations-moti';
import { createMedia } from '@tamagui/react-native-media-driver';
import { shorthands } from '@tamagui/shorthands';
import { themes } from '@tamagui/themes';
import { createFont, createTamagui, createTokens } from 'tamagui';

import type { Variable } from '@tamagui/web/src/createVariable';

const isTamaguiNative = process.env.TAMAGUI_TARGET === 'native';
const font = createFont({
  family: isTamaguiNative
    ? 'System'
    : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  size: {
    heading5xl: 40,
    heading4xl: 32,
    heading3xl: 28,
    heading2xl: 24,
    headingXl: 20,
    headingLg: 18,
    headingMd: 16,
    headingSm: 14,
    headingXs: 12,
    bodyLg: 16,
    bodyLgMedium: 16,
    bodyLgUnderline: 16,
    bodyMd: 14,
    bodyMdMedium: 14,
    bodyMdunderline: 14,
    bodySm: 12,
    bodySmMedium: 12,
    bodyLgMono: 16,
    bodyMdMono: 14,
  },
  lineHeight: {
    heading5xl: 48,
    heading4xl: 40,
    heading3xl: 36,
    heading2xl: 32,
    headingXl: 28,
    headingLg: 28,
    headingMd: 24,
    headingSm: 20,
    headingXs: 16,
    bodyLg: 24,
    bodyLgMedium: 24,
    bodyLgUnderline: 24,
    bodyMd: 20,
    bodyMdMedium: 20,
    bodyMdunderline: 20,
    bodySm: 16,
    bodySmMedium: 16,
    bodyLgMono: 24,
    bodyMdMono: 20,
  },
  weight: {
    heading5xl: '700',
    heading4xl: '600',
    heading3xl: '600',
    heading2xl: '600',
    headingXl: '600',
    headingLg: '600',
    headingMd: '600',
    headingSm: '600',
    headingXs: '600',
    bodyLg: '400',
    bodyLgMedium: '500',
    bodyLgUnderline: '400',
    bodyMd: '400',
    bodyMdMedium: '500',
    bodyMdunderline: '400',
    bodySm: '400',
    bodySmMedium: '500',
    bodyLgMono: '400',
    bodyMdMono: '400',
  },
});

const animations = createAnimations({
  fast: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  medium: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  slow: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
});

const lightColors = {
  bg: '#ffffff',
  bgActive: '#0000001b',
  bgApp: '#ffffff',
  bgBackdrop: '#00000044',
  bgCaution: '#ffe30139',
  bgCautionStrong: '#fadc00d2',
  bgCautionSubdued: '#ffdd011f',
  bgCritical: '#ff010110',
  bgCriticalStrong: '#db0007b7',
  bgCriticalStrongActive: '#bb0007d5',
  bgCriticalStrongHover: '#cd0008c2',
  bgCriticalSubdued: '#ff050508',
  bgDisabled: '#0000000e',
  bgHover: '#00000014',
  bgInfo: '#0280ff12',
  bgInfoStrong: '#0091ff',
  bgInfoSubdued: '#0582ff0a',
  bgInverse: '#000000df',
  bgInverseActive: '#ffffff22',
  bgInverseHover: '#ffffff1b',
  bgPrimary: '#000000df',
  bgPrimaryActive: '#0000007f',
  bgPrimaryHover: '#0000009b',
  bgStrong: '#0000000e',
  bgSubdued: '#00000006',
  bgSuccess: '#02ba3c16',
  bgSuccessStrong: '#008f4acf',
  bgSuccessSubdued: '#00c43b0d',
  border: '#00000022',
  borderActive: '#000000df',
  borderCaution: '#be980091',
  borderCautionSubdued: '#d7b7007a',
  borderCritical: '#d9000351',
  borderCriticalActive: '#db0007b7',
  borderCriticalHover: '#d100036f',
  borderCriticalSubdued: '#e4010139',
  borderDisabled: '#0000000e',
  borderHover: '#00000044',
  borderInfo: '#0077df69',
  borderInfoSubdued: '#0179e648',
  borderInverse: '#4a4a4a',
  borderStrong: '#0000002b',
  borderSubdued: '#0000001b',
  borderSuccess: '#008c3d6d',
  borderSuccessSubdued: '#0193374b',
  focusRing: '#00000044',
  focusRingCritical: '#D100036F',
  icon: '#0000009b',
  iconActive: '#000000df',
  iconCaution: '#5e4200d7',
  iconCritical: '#bb0007d5',
  iconDisabled: '#00000044',
  iconHover: '#000000df',
  iconInfo: '#0061c9f4',
  iconInverse: '#fcfcfc',
  iconOnBrightColor: '#202020',
  iconOnColor: '#ffffff',
  iconStrong: '#000000df',
  iconSubdued: '#00000072',
  iconSuccess: '#006b3be7',
  text: '#000000df',
  textCaution: '#5e4200d7',
  textCautionStrong: '#2e2000e0',
  textCritical: '#bb0007d5',
  textCriticalStrong: '#55000de8',
  textDisabled: '#00000072',
  textInfo: '#0061c9f4',
  textInfoStrong: '#002459ee',
  textInteractive: '#005c11d8',
  textInteractiveHover: '#003108e9',
  textInverse: '#FFFFFFEC',
  textInverseSubdued: '#FFFFFFA9',
  textOnBrightColor: '#202020',
  textOnColor: '#ffffff',
  textPlaceholder: '#00000072',
  textSubdued: '#0000009b',
  textSuccess: '#006b3be7',
  textSuccessStrong: '#002616e6',
  transparent: '#AAAAAA00',
  caution1: '#abab0506',
  caution10: '#f9d800ef',
  caution11: '#5e4200d7',
  caution12: '#2e2000e0',
  caution2: '#ffdd011f',
  caution3: '#ffe30139',
  caution4: '#f6d90050',
  caution5: '#ebcb0164',
  caution6: '#d7b7007a',
  caution7: '#be980091',
  caution8: '#b58b00ba',
  caution9: '#fadc00d2',
  critical1: '#ff050503',
  critical10: '#cd0008c2',
  critical11: '#bb0007d5',
  critical12: '#55000de8',
  critical2: '#ff050508',
  critical3: '#ff010110',
  critical4: '#ff00001a',
  critical5: '#f2000027',
  critical6: '#e4010139',
  critical7: '#d9000351',
  critical8: '#d100036f',
  critical9: '#db0007b7',
  info1: '#0582ff04',
  info10: '#007deaf7',
  info11: '#0061c9f4',
  info12: '#002459ee',
  info2: '#0582ff0a',
  info3: '#0280ff12',
  info4: '#017dfa31',
  info5: '#0183fa31',
  info6: '#0179e648',
  info7: '#0077df69',
  info8: '#0082e6a1',
  info9: '#0091ff',
  neutral1: '#00000003',
  neutral10: '#0000007f',
  neutral11: '#0000009b',
  neutral12: '#000000df',
  neutral2: '#00000006',
  neutral3: '#0000000e',
  neutral4: '#00000014',
  neutral5: '#0000001b',
  neutral6: '#00000022',
  neutral7: '#0000002b',
  neutral8: '#00000044',
  neutral9: '#00000072',
  primary1: '#00000003',
  primary10: '#0000007f',
  primary11: '#0000009b',
  primary12: '#000000df',
  primary2: '#00000006',
  primary3: '#0000000e',
  primary4: '#00000014',
  primary5: '#0000001b',
  primary6: '#00000022',
  primary7: '#0000002b',
  primary8: '#00000044',
  primary9: '#00000072',
  success1: '#05c04304',
  success10: '#008347d6',
  success11: '#006b3be7',
  success12: '#002616e6',
  success2: '#00c43b0d',
  success3: '#02ba3c16',
  success4: '#01a63622',
  success5: '#009b3733',
  success6: '#0193374b',
  success7: '#008c3d6d',
  success8: '#00934da4',
  success9: '#008f4acf',
};

const darkColors: typeof lightColors = {
  bg: '#1b1b1b',
  bgActive: '#ffffff22',
  bgApp: '#0f0f0f',
  bgBackdrop: '#0000009b',
  bgCaution: '#fe980016',
  bgCautionStrong: '#ffe62dfb',
  bgCautionSubdued: '#fb47000b',
  bgCritical: '#fe1f3927',
  bgCriticalStrong: '#ff4e54e2',
  bgCriticalStrongActive: '#ff858a',
  bgCriticalStrongHover: '#ff6b6df1',
  bgCriticalSubdued: '#fe001913',
  bgDisabled: '#ffffff12',
  bgHover: '#ffffff1b',
  bgInfo: '#0066ff2b',
  bgInfoStrong: '#0091ff',
  bgInfoSubdued: '#0037ff17',
  bgInverse: '#ffffffec',
  bgInverseActive: '#0000001b',
  bgInverseHover: '#00000014',
  bgPrimary: '#ffffffec',
  bgPrimaryActive: '#ffffff74',
  bgPrimaryHover: '#ffffffa9',
  bgStrong: '#ffffff12',
  bgSubdued: '#ffffff03',
  bgSuccess: '#00fc7a12',
  bgSuccessStrong: '#3fffa29b',
  bgSuccessSubdued: '#00fb0006',
  border: '#ffffff2b',
  borderActive: '#ffffffec',
  borderCaution: '#fecd1b51',
  borderCautionSubdued: '#fec40536',
  borderCritical: '#ff223880',
  borderCriticalActive: '#ff4e54e2',
  borderCriticalHover: '#ff1f28ce',
  borderCriticalSubdued: '#ff263c5a',
  borderDisabled: '#ffffff12',
  borderHover: '#ffffff50',
  borderInfo: '#0780ff8b',
  borderInfoSubdued: '#087dff60',
  borderInverse: '#d4d4d4',
  borderStrong: '#ffffff37',
  borderSubdued: '#ffffff22',
  borderSuccess: '#2ffe9e4e',
  borderSuccessSubdued: '#1dfea033',
  focusRing: '#ffffff50',
  focusRingCritical: '#FF1F28CE',
  icon: '#ffffffa9',
  iconActive: '#ffffffec',
  iconCaution: '#ffee33',
  iconCritical: '#ff858a',
  iconDisabled: '#ffffff50',
  iconHover: '#ffffffec',
  iconInfo: '#6bc1ff',
  iconInverse: '#181818',
  iconOnBrightColor: '#202020',
  iconOnColor: '#ffffff',
  iconStrong: '#ffffffec',
  iconSubdued: '#ffffff5f',
  iconSuccess: '#45ffa6d2',
  text: '#ffffffec',
  textCaution: '#ffee33',
  textCautionStrong: '#fff6ad',
  textCritical: '#ff858a',
  textCriticalStrong: '#ffd1d9',
  textDisabled: '#ffffff5f',
  textInfo: '#6bc1ff',
  textInfoStrong: '#c2e5ff',
  textInteractive: '#51ff62dc',
  textInteractiveHover: '#d0ffccf4',
  textInverse: '#000000DF',
  textInverseSubdued: '#0000009B',
  textOnBrightColor: '#202020',
  textOnColor: '#ffffff',
  textPlaceholder: '#ffffff5f',
  textSubdued: '#ffffffa9',
  textSuccess: '#45ffa6d2',
  textSuccessStrong: '#bbffd6f0',
  transparent: '#AAAAAA00',
  caution1: '#f6000005',
  caution10: '#ffec5cfc',
  caution11: '#ffee33',
  caution12: '#fff6ad',
  caution2: '#fb47000b',
  caution3: '#fe980016',
  caution4: '#feae001f',
  caution5: '#feba0029',
  caution6: '#fec40536',
  caution7: '#fecd1b51',
  caution8: '#ffde2f84',
  caution9: '#ffe62dfb',
  critical1: '#fa000008',
  critical10: '#ff6b6df1',
  critical11: '#ff858a',
  critical12: '#ffd1d9',
  critical2: '#fe001913',
  critical3: '#fe1f3927',
  critical4: '#ff213e35',
  critical5: '#fe273d44',
  critical6: '#ff263c5a',
  critical7: '#ff223880',
  critical8: '#ff1f28ce',
  critical9: '#ff4e54e2',
  info1: '#0000fc09',
  info10: '#3cabff',
  info11: '#6bc1ff',
  info12: '#c2e5ff',
  info2: '#0037ff17',
  info3: '#0066ff2b',
  info4: '#006efe3a',
  info5: '#0375ff49',
  info6: '#087dff60',
  info7: '#0780ff8b',
  info8: '#1183ffdf',
  info9: '#0091ff',
  neutral1: '#ffffff',
  neutral10: '#ffffff74',
  neutral11: '#ffffffa9',
  neutral12: '#ffffffec',
  neutral2: '#ffffff03',
  neutral3: '#ffffff12',
  neutral4: '#ffffff1b',
  neutral5: '#ffffff22',
  neutral6: '#ffffff2b',
  neutral7: '#ffffff37',
  neutral8: '#ffffff50',
  neutral9: '#ffffff5f',
  primary1: '#ffffff',
  primary10: '#ffffff74',
  primary11: '#ffffffa9',
  primary12: '#ffffffec',
  primary2: '#ffffff03',
  primary3: '#ffffff12',
  primary4: '#ffffff1b',
  primary5: '#ffffff22',
  primary6: '#ffffff2b',
  primary7: '#ffffff37',
  primary8: '#ffffff50',
  primary9: '#ffffff5f',
  success1: '#00e00001',
  success10: '#42ffa4b2',
  success11: '#45ffa6d2',
  success12: '#bbffd6f0',
  success2: '#00fb0006',
  success3: '#00fc7a12',
  success4: '#00fd8f1c',
  success5: '#11fe9326',
  success6: '#1dfea033',
  success7: '#2ffe9e4e',
  success8: '#40ffa380',
  success9: '#3fffa29b',
};

function postfixObjKeys<
  A extends { [key: string]: Variable<string> | string },
  B extends string,
>(
  obj: A,
  postfix: B,
): {
  [Key in `${keyof A extends string ? keyof A : never}${B}`]:
    | Variable<string>
    | string;
} {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [`${k}${postfix}`, v]),
  ) as any;
}
const mergedTokens = createTokens({
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
  size: {
    0: 0,
    px: 1,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    4.5: 18,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    true: 44,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    28: 112,
    32: 128,
    36: 144,
    40: 160,
    44: 176,
    48: 192,
    52: 208,
    56: 224,
    60: 240,
    64: 256,
    72: 288,
    80: 320,
    96: 384,
  },
  radius: {
    0: 0,
    1: 4,
    2: 8,
    true: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    full: 9999,
  },
  space: {
    0: 0,
    px: 1,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    true: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
    24: 96,
    28: 112,
    32: 128,
    '-px': -1,
    '-0.5': 2,
    '-1': -4,
    '-1.5': -6,
    '-2': -8,
    '-2.5': -10,
    '-3': -12,
    '-3.5': -14,
    '-4': -16,
    '-5': -20,
    '-6': -24,
    '-8': -32,
    '-10': -40,
    '-12': -48,
    '-16': -64,
    '-20': -80,
    '-24': -96,
    '-28': -112,
    '-32': -128,
  },
  color: {
    ...postfixObjKeys(lightColors, 'Light'),
    ...postfixObjKeys(darkColors, 'Dark'),
  },
});

const config = createTamagui({
  animations,

  defaultTheme: 'light',

  shouldAddPrefersColorThemes: false,

  themeClassNameOnRoot: false,

  shorthands,

  fonts: {
    body: font,
  },

  themes: {
    light: {
      ...themes.light,
      ...lightColors,
      'background-default': mergedTokens.color.bgLight,
    },
    dark: {
      ...themes.dark,
      ...darkColors,
      'background-default': mergedTokens.color.bgDark,
    },
  },

  tokens: mergedTokens,

  media: createMedia({
    xs: { minWidth: 0 },
    sm: { minWidth: 640 },
    md: { minWidth: 768 },
    lg: { minWidth: 1024 },
    xl: { minWidth: 1280 },
    '2xl': { minWidth: 1536 },
    short: { maxHeight: 820 },
    tall: { minHeight: 820 },
    hoverNone: { hover: 'none' },
    pointerCoarse: { pointer: 'coarse' },
  }),
});

export type AppConfig = typeof config;

declare module 'tamagui' {
  // or '@tamagui/core'
  // overrides TamaguiCustomConfig so your custom types
  // work everywhere you import `tamagui`

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
