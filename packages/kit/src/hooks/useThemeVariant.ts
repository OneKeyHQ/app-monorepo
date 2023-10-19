import { useEffect, useState } from 'react';

import type { LocaleSymbol } from '@onekeyhq/components/src/locale';
import LOCALES from '@onekeyhq/components/src/locale';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';

import { themeProviderSelector } from '../store/selectors/theme';

import { useColorScheme } from './useColorScheme';
import { useSystemLocale } from './useSystemLocale';

export function useThemeProviderVariant() {
  const { theme, locale, lastLocale } = useAppSelector(themeProviderSelector);
  const systemLocale = useSystemLocale();
  const colorScheme = useColorScheme();
  const themeVariant = theme === 'system' ? colorScheme ?? 'dark' : theme;
  const currentVariant = (
    locale === 'system' ? systemLocale : locale
  ) as LocaleSymbol;
  const cachedLocale = LOCALES[currentVariant];
  const localeReady = typeof cachedLocale === 'object';
  const [localeVariant, setLocaleVariant] = useState(() => {
    if (localeReady) {
      return currentVariant;
    }
    if (typeof LOCALES[lastLocale] !== 'function') {
      return lastLocale;
    }
    return 'en-US';
  });

  useEffect(() => {
    if (!localeReady) {
      if (typeof cachedLocale === 'function') {
        cachedLocale().then((module) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          LOCALES[currentVariant] = module.default;
          setLocaleVariant(currentVariant);
        });
      }
    }
  }, [cachedLocale, currentVariant, localeReady, localeVariant]);

  return {
    themeVariant,
    localeVariant: localeReady ? currentVariant : localeVariant,
  };
}
