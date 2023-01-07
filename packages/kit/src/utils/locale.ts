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
