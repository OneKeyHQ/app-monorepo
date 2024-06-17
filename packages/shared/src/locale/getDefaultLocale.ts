import { LOCALES_OPTION } from '.';

import { isFunction } from 'lodash';

import { locale as LocalizationLocale } from '@onekeyhq/shared/src/modules3rdParty/localization';
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
  const code = current.split('-')[0];
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (code === locale) {
      return locale as ILocaleSymbol;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale.startsWith(`${code}-`)) {
      return locale as ILocaleSymbol;
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
