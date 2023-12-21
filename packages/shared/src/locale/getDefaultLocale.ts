import { locale as LocalizationLocale } from 'expo-localization';

import type { ILocaleSymbol } from '@onekeyhq/components/src/locale';
import { LOCALES_OPTION } from '@onekeyhq/components/src/locale';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

const getDefaultLocaleFunc = () => {
  const locales = LOCALES_OPTION.map((locale) => locale.value);
  const current = LocalizationLocale;
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale === current) {
      return locale as ILocaleSymbol;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    const code = current.split('-')[0];
    if (code === current) {
      return locale as ILocaleSymbol;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    const code = current.split('-')[0];
    if (locale.startsWith(code)) {
      return locale as ILocaleSymbol;
    }
  }
  return locales[0] as ILocaleSymbol;
};

export const getDefaultLocale = memoizee(getDefaultLocaleFunc);
