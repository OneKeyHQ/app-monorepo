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

const PRIORITY_LOCALE_KEYS: ILocaleSymbol[] = [
  'en-US',
  'zh-CN',
  'zh-HK',
  'zh-TW',
  'ja-JP',
  'ko-KR',
];

const LOCALES_KEYS = [
  ...PRIORITY_LOCALE_KEYS,
  ...Object.keys(LOCALES).filter(
    (o) => !PRIORITY_LOCALE_KEYS.includes(o as ILocaleSymbol),
  ),
];

const LOCALES_OPTION = LOCALES_KEYS.map((key) => ({
  value: key as ILocaleSymbol,
  label: getLanguage(key),
}));

if (platformEnv.isExtensionBackground) {
  // debugger;
  // throw new Error('components/locale is not allowed imported from background');
}

export { LOCALES_OPTION };

export * from './type';
export * from './enum/translations';
export * from './enum/translationsMock';
