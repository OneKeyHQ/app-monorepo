import ISO6391 from 'iso-639-1';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LOCALES as _LOCALES, enUS } from './localeJsonMap';

export type ILocaleSymbol = keyof typeof _LOCALES | 'system';
export type ILocaleIds = keyof typeof enUS;
export const LOCALES = _LOCALES as Record<
  ILocaleSymbol,
  Record<keyof typeof enUS, string> | (() => Promise<any>)
>;

const defaultLanguage: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-HK': '繁體中文',
  'fil': 'Filipino',
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
