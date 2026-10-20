export const LOCALES = {};
export const LOCALES_OPTION = [];
export const s = (size: number) => size;
export const fs = (size: number) => size;
// Mirrors the Provider brandFont module with the open-source fallback faces so
// tests do not depend on which source `yarn fonts:sync` installed.
export const BRAND_FONT_NATIVE_FAMILY = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;
export const BRAND_FONT_WEB_FAMILY = 'OneKeySans';
export const BRAND_FONT_SOURCE = 'fallback';
