import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { loadLocaleMessages } from './localeLoaders';
import { LOCALES_KEYS } from './localeOptions';
import systemLocaleUtils from './systemLocale';

import type { ILocaleJSONSymbol, ILocaleSymbol } from './type';

const getDefaultLocaleFunc = () => {
  const locales = LOCALES_KEYS;
  const current = systemLocaleUtils.getSystemLocale();

  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale === current) {
      return locale;
    }
  }
  const code = current.split('-')[0];
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (code === locale) {
      return locale;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale.startsWith(`${code}-`)) {
      return locale;
    }
  }
  return 'en-US' as ILocaleSymbol;
};

export const getDefaultLocale = memoizee(getDefaultLocaleFunc);

export const getLocaleMessages = async (locale: ILocaleSymbol) => {
  const messages = await loadLocaleMessages(locale as ILocaleJSONSymbol);
  return messages;
};
