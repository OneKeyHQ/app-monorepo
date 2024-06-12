import ISO6391 from 'iso-639-1';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LOCALES as _LOCALES } from './localeJsonMap';

import type { ETranslations } from './enum/translations';
import type { ILocaleSymbol } from './type';

export const LOCALES = _LOCALES as unknown as Record<
  ILocaleSymbol,
  Record<ETranslations, string> | (() => Promise<Record<ETranslations, string>>)
>;

const defaultLanguage: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-HK': '繁體中文（香港）',
  'zh-TW': '繁體中文（臺灣）',
  'pt-BR': 'Português(Brasil)',
};

const getLanguage = (symbol: string): string => {
  let languageName: string | undefined =
    defaultLanguage[symbol] ||
    ISO6391.getNativeName(symbol) ||
    ISO6391.getName(symbol);

  if (!languageName && symbol.indexOf('-') !== -1) {
    const [symbolShort] = symbol.split('-');
    languageName =
      ISO6391.getNativeName(symbolShort) || ISO6391.getName(symbolShort);
  }

  return languageName || symbol;
};

const LOCALES_OPTION = Object.keys(LOCALES).map((key) => ({
  value: key,
  label: getLanguage(key),
}));

if (platformEnv.isExtensionBackground) {
  // debugger;
  // throw new Error('components/locale is not allowed imported from background');
}

export { LOCALES_OPTION };

export * from './type';

export * from './enum/translations';
