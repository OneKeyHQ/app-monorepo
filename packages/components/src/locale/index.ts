import enUS from './en-US.json';
import zhCN from './zh-CN.json';

const LOCALES = {
  'zh-CN': zhCN,
  'en-US': enUS,
} as const;

export type LocaleSymbol = keyof typeof LOCALES;

export default LOCALES;
