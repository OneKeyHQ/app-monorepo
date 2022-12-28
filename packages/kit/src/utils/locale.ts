import * as Localization from 'expo-localization';

import type { LocaleSymbol } from '@onekeyhq/components/src/locale';
import LOCALES, { LOCALES_OPTION } from '@onekeyhq/components/src/locale';

const locales = LOCALES_OPTION.map((locale) => locale.value);

export function getDefaultLocale() {
  const current = Localization.locale;
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale === current) {
      return locale as LocaleSymbol;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    const code = current.split('-')[0];
    if (code === current) {
      return locale as LocaleSymbol;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    const code = current.split('-')[0];
    if (locale.startsWith(code)) {
      return locale as LocaleSymbol;
    }
  }
  return locales[0] as LocaleSymbol;
}

export function normalize(symbol: LocaleSymbol) {
  const records: Record<LocaleSymbol, string> = {
    'system': 'en',
    'en-US': 'en',
    'zh-CN': 'zh_CN',
    'zh-HK': 'zh_HK',
    'ja-JP': 'ja_JP',
    'ko-KR': 'ko_KR',
    'bn': 'bn',
    'de': 'de',
    'es': 'es',
    'fil': 'fil',
    'fr-FR': 'fr_FR',
    'hi-IN': 'hi_IN',
    'it-IT': 'it_IT',
    'mn-MN': 'mn_MN',
    'pt': 'pt',
    'ru': 'ru',
    'th-TH': 'th_TH',
    'uk-UA': 'uk_UA',
    'vi': 'vi',
  };
  return records[symbol];
}
