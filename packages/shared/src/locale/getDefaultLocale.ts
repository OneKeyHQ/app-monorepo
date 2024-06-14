import { LOCALES_OPTION } from '.';

import { locale as LocalizationLocale } from 'expo-localization';
import { isFunction } from 'lodash';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { LOCALES } from './localeJsonMap';

import type { ETranslations } from '.';
import type { ILocaleJSONSymbol, ILocaleSymbol } from './type';

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

export const getLocaleMessages = async (locale: ILocaleSymbol) => {
  const messagesBuilder = LOCALES[locale as ILocaleJSONSymbol];
  const messages: Record<ETranslations, string> = isFunction(messagesBuilder)
    ? await messagesBuilder()
    : messagesBuilder;
  return messages;
};
