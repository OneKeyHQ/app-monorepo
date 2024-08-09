import { app } from 'electron';
import { isFunction } from 'lodash';

import type {
  ETranslations,
  ILocaleJSONSymbol,
  ILocaleSymbol,
} from '@onekeyhq/shared/src/locale';
import { LOCALES } from '@onekeyhq/shared/src/locale/localeJsonMap';

let globalLocale = 'en-US' as ILocaleSymbol;
let globalMessages: Record<ETranslations, string> = {} as unknown as Record<
  ETranslations,
  string
>;
const getLocale = () => {
  const locales = Object.keys(LOCALES) as ILocaleSymbol[];
  const current = app.getLocale();

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

export const getLocaleMessages = async (locale: ILocaleSymbol) => {
  const messagesBuilder = LOCALES[locale as ILocaleJSONSymbol];
  const messages = isFunction(messagesBuilder)
    ? await messagesBuilder()
    : messagesBuilder;
  return messages as unknown as Record<ETranslations, string>;
};

export const initLocale = async () => {
  globalLocale = getLocale();
  globalMessages = await getLocaleMessages(globalLocale);
  return globalLocale;
};

export const i18nText = (key: ETranslations) => globalMessages[key];
