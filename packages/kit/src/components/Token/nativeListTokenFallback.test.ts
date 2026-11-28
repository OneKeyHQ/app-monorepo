import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getNativeListTokenFallback,
  getTokenFallbackLetter,
} from './nativeListTokenFallback';

const theme = { inverseBackground: '#000000', inverseText: '#ffffff' };
const fallbackIcon = { name: 'CryptoCoinOutline', tintColor: '#999999' };

describe('getNativeListTokenFallback', () => {
  const isNative = platformEnv.isNative;

  afterEach(() => {
    platformEnv.isNative = isNative;
  });

  it('shows the symbol letter on the inverse circle on web', () => {
    platformEnv.isNative = false;
    expect(
      getNativeListTokenFallback({
        symbol: ' usdc',
        size: 40,
        theme,
        fallbackIcon,
      }),
    ).toEqual({
      fallbackText: 'U',
      fallbackTextColor: '#ffffff',
      fallbackTextSize: 22,
      fallbackTextBackgroundColor: '#000000',
    });
  });

  it('sizes the letter like the Token component', () => {
    platformEnv.isNative = false;
    expect(
      [20, 24, 32, 40].map(
        (size) =>
          getNativeListTokenFallback({
            symbol: 'eth',
            size,
            theme,
            fallbackIcon,
          }).fallbackTextSize,
      ),
    ).toEqual([11, 13, 18, 22]);
  });

  it('keeps the icon on native, without a symbol, or without inverse colors', () => {
    platformEnv.isNative = true;
    expect(
      getNativeListTokenFallback({
        symbol: 'usdc',
        size: 40,
        theme,
        fallbackIcon,
      }),
    ).toEqual({ fallbackIcon });

    platformEnv.isNative = false;
    expect(
      getNativeListTokenFallback({
        symbol: '  ',
        size: 40,
        theme,
        fallbackIcon,
      }),
    ).toEqual({ fallbackIcon });
    expect(
      getNativeListTokenFallback({
        symbol: 'usdc',
        size: 40,
        theme: {},
        fallbackIcon,
      }),
    ).toEqual({ fallbackIcon });
  });
});

describe('getTokenFallbackLetter', () => {
  it('takes the first letter or digit, skipping signs and invisible characters', () => {
    expect(getTokenFallbackLetter('$WIF')).toBe('W');
    expect(getTokenFallbackLetter('\u200bUSDT')).toBe('U');
    expect(getTokenFallbackLetter('1INCH')).toBe('1');
    expect(getTokenFallbackLetter('\u00dfeta')).toBe('\u00df');
    expect(getTokenFallbackLetter('\u{1F1FA}\u{1F1F8}')).toBeUndefined();
    expect(getTokenFallbackLetter(42)).toBeUndefined();
  });
});
