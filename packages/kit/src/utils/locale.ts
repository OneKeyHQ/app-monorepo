import * as Localization from 'expo-localization';

import { LOCALES_OPTION } from '@onekeyhq/components/src/locale';

const locales = LOCALES_OPTION.map((locale) => locale.value);

export function getDefaultLocale() {
  const current = Localization.locale;
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    if (locale === current) {
      return locale;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    const code = current.split('-')[0];
    if (code === current) {
      return locale;
    }
  }
  for (let i = 0; i < locales.length; i += 1) {
    const locale = locales[i];
    const code = current.split('-')[0];
    if (locale.startsWith(code)) {
      return locale;
    }
  }
  return locales[0];
}
