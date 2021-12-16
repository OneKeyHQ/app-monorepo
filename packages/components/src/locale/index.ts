import enUS from './en-US.json';
import zhCN from './zh-CN.json';

const LOCALES = {
  'zh-CN': zhCN,
  'en-US': enUS,
} as const;

export type LocaleSymbol = keyof typeof LOCALES;

const DEFAULT_LOCALE = 'en-US';

export const getDefaultLocale = (l?: string): LocaleSymbol => {
  if (!Object.keys(LOCALES).includes(l ?? '')) return DEFAULT_LOCALE;
  return l as LocaleSymbol;
};

export default LOCALES;
