import ISO6391 from 'iso-639-1';

import { LOCALE_KEYS } from './localeLoaders';

import type { ILocaleSymbol } from './type';

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
  'en',
  'en-US',
  'zh-CN',
  'zh-HK',
  'zh-TW',
  'ja-JP',
  'ko-KR',
];

export const LOCALES_KEYS = [
  ...PRIORITY_LOCALE_KEYS,
  ...LOCALE_KEYS.filter(
    (o) => !PRIORITY_LOCALE_KEYS.includes(o as ILocaleSymbol),
  ),
];

export const LOCALES_OPTION = LOCALES_KEYS.map((key) => ({
  value: key,
  label: getLanguage(key),
}));
