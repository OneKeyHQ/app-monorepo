import { LOCALES_OPTION } from '.';

import { isFunction } from 'lodash';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { LOCALES } from './localeJsonMap';
import systemLocaleUtils from './systemLocale';

import type { ETranslations } from '.';
import type { ILocaleJSONSymbol, ILocaleSymbol } from './type';

const getDefaultLocaleFunc = () => {
  const locales = LOCALES_OPTION.map((locale) => locale.value);
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
  const messagesBuilder = LOCALES[locale as ILocaleJSONSymbol];
  const messages: Record<ETranslations, string> = isFunction(messagesBuilder)
    ? await messagesBuilder()
    : messagesBuilder;
  return messages;
};
