import { Dimensions } from 'react-native';

import type { SizeTokens } from '@onekeyhq/components';
import { s } from '@onekeyhq/components/src/utils/scale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type ITokenSize = 'xxl' | 'xl' | 'lg' | 'md' | 'sm' | 'xs' | 'xxs';

export const TOKEN_SIZE_MAP: Record<
  ITokenSize,
  {
    tokenImageSize: SizeTokens;
    chainImageSize: SizeTokens;
    fallbackIconSize: SizeTokens;
    tokenImageResizeWidth: number;
  }
> = {
  xxl: {
    tokenImageSize: '$14',
    chainImageSize: '$6',
    fallbackIconSize: '$9',
    tokenImageResizeWidth: s(56),
  },
  xl: {
    tokenImageSize: '$12',
    chainImageSize: '$5',
    fallbackIconSize: '$8',
    tokenImageResizeWidth: s(48),
  },
  lg: {
    tokenImageSize: '$10',
    chainImageSize: '$4',
    fallbackIconSize: '$7',
    tokenImageResizeWidth: s(40),
  },
  md: {
    tokenImageSize: '$8',
    chainImageSize: '$4',
    fallbackIconSize: '$6',
    tokenImageResizeWidth: s(32),
  },
  sm: {
    tokenImageSize: '$6',
    chainImageSize: '$3',
    fallbackIconSize: '$6',
    tokenImageResizeWidth: s(24),
  },
  xs: {
    tokenImageSize: '$5',
    chainImageSize: '$2.5',
    fallbackIconSize: '$5',
    tokenImageResizeWidth: s(20),
  },
  xxs: {
    tokenImageSize: '$4',
    chainImageSize: '$2',
    fallbackIconSize: '$4',
    tokenImageResizeWidth: s(16),
  },
};

export function getTokenImageResizeWidth(size: ITokenSize): number {
  return TOKEN_SIZE_MAP[size].tokenImageResizeWidth;
}

// Mirrors the tamagui `gtMd` breakpoint (tamagui.config.ts) that
// `TokenIconView` reads through `useMedia` to pick the home list icon size.
const GT_MD_MIN_WIDTH = 768;

/**
 * The `Token` size the home token list renders at on this device (phones
 * `lg`, tablets / desktop `md`), resolved without a hook so prewarm paths can
 * request the SAME rendition + decode thumbnail the row will ask for. A
 * prewarm at another size lands in the disk cache only; the row's first
 * paint then misses the memory cache and shows an icon skeleton (OK-63873).
 */
export function getHomeTokenListIconSize(): ITokenSize {
  let windowWidth = 0;
  try {
    windowWidth = Dimensions?.get?.('window')?.width ?? 0;
  } catch {
    // Dimensions can be unavailable before the RN runtime is ready (or in
    // node tests); fall through to the platform default below.
  }
  if (windowWidth > 0) {
    return windowWidth >= GT_MD_MIN_WIDTH ? 'md' : 'lg';
  }
  return platformEnv.isNative ? 'lg' : 'md';
}

export function getHomeTokenListImageResizeWidth(): number {
  return getTokenImageResizeWidth(getHomeTokenListIconSize());
}
