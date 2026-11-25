import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LeadingVisual } from '@onekeyfe/react-native-native-list';

type INativeListTokenVisual = Extract<LeadingVisual, { kind: 'token' }>;

export type INativeListTokenFallbackTheme = {
  inverseBackground?: string;
  inverseText?: string;
};

export type INativeListTokenFallback = Pick<
  INativeListTokenVisual,
  | 'fallbackIcon'
  | 'fallbackText'
  | 'fallbackTextColor'
  | 'fallbackTextSize'
  | 'fallbackTextBackgroundColor'
>;

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * The letter a token's fallback shows: the first letter or digit of its
 * symbol, upper-cased while that stays one character. A symbol with none
 * ('$', emoji, invisible characters) keeps the coin icon.
 */
export function getTokenFallbackLetter(symbol: unknown): string | undefined {
  if (typeof symbol !== 'string') return undefined;
  const letter = Array.from(symbol).find((char) => LETTER_OR_DIGIT.test(char));
  if (!letter) return undefined;
  const upper = letter.toUpperCase();
  return Array.from(upper).length === 1 ? upper : letter;
}

/**
 * The leading fallback of a native-list token row, matching the `Token`
 * component: a missing or broken logo shows the symbol's first letter on an
 * inverse circle. Web engine only: the iOS/Android renderers draw fallback
 * text at a fixed 13pt on the grey placeholder, so they keep the icon.
 */
export function getNativeListTokenFallback({
  symbol,
  size,
  theme,
  fallbackIcon,
}: {
  symbol: string | undefined;
  size: number;
  theme: INativeListTokenFallbackTheme;
  fallbackIcon: INativeListTokenVisual['fallbackIcon'];
}): INativeListTokenFallback {
  const letter = platformEnv.isNative
    ? undefined
    : getTokenFallbackLetter(symbol);
  if (!letter || !theme.inverseBackground || !theme.inverseText) {
    return { fallbackIcon };
  }
  return {
    fallbackText: letter,
    fallbackTextColor: theme.inverseText,
    // Same ~55% of the circle as TOKEN_SIZE_MAP's fallbackLetterSize (40 → 22).
    fallbackTextSize: Math.round(size * 0.55),
    fallbackTextBackgroundColor: theme.inverseBackground,
  };
}
