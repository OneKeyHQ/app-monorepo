import ISO6391 from 'iso-639-1';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import enUS from './en-US.json';

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

// eslint-disable-next-line @typescript-eslint/naming-convention
const _LOCALES = {
  'en-US': enUS,
  'zh-CN': () => import('./zh-CN.json'),
  'zh-HK': () => import('./zh_HK.json'),
  'ja-JP': () => import('./ja_JP.json'),
  'ko-KR': () => import('./ko_KR.json'),
  'bn': () => import('./bn.json'),
  'de': () => import('./de.json'),
  'es': () => import('./es.json'),
  'fil': () => import('./fil.json'),
  'fr-FR': () => import('./fr_FR.json'),
  'hi-IN': () => import('./hi_IN.json'),
  'it-IT': () => import('./it_IT.json'),
  'mn-MN': () => import('./mn_MN.json'),
  'pt': () => import('./pt.json'),
  'ru': () => import('./ru.json'),
  'th-TH': () => import('./th_TH.json'),
  'uk-UA': () => import('./uk_UA.json'),
  'vi': () => import('./vi.json'),
};
export type LocaleSymbol = keyof typeof _LOCALES | 'system';
export type LocaleIds = keyof typeof enUS;

const LOCALES = _LOCALES as Record<
  LocaleSymbol,
  Record<keyof typeof enUS, string> | (() => Promise<any>)
>;

if (process.env.NODE_ENV !== 'production') {
  // Check if i18n keys are complete
  const keyLength = Object.keys(enUS).length;
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const key in LOCALES) {
    // @ts-ignore
    const data = LOCALES[key];
    if (typeof data === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      data().then((module: { default: any }) => {
        if (Object.keys(module.default).length !== keyLength) {
          throw new Error(
            `Locale ${key} has different keys with en-US, please check it.`,
          );
        }
      });
    }
  }
}

const LOCALES_OPTION = Object.keys(LOCALES).map((key) => ({
  value: key,
  label: getLanguage(key),
}));

if (platformEnv.isExtensionBackground) {
  // debugger;
  // throw new Error('components/locale is not allowed imported from background');
}

export default LOCALES;
export { LOCALES_OPTION };
