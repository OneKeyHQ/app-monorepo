import type { ILocaleSymbol } from './type';

function toHyperLiquidWebDappLocale(locale: ILocaleSymbol): string {
  // "en-US"
  // "fr-FR"
  // "zh-CN"
  // "ko-KR"
  if (locale === 'en' || locale.startsWith('en-')) {
    return 'en-US';
  }
  if (locale.startsWith('fr-')) {
    return 'fr-FR';
  }
  if (locale.startsWith('zh-')) {
    return 'zh-CN';
  }
  if (locale.startsWith('ko-')) {
    return 'ko-KR';
  }
  return 'en-US';
  // return locale;
}

export default {
  toHyperLiquidWebDappLocale,
};
