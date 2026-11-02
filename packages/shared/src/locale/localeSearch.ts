import ISO6391 from 'iso-639-1';

import { ETranslations } from './enum/translations';

import type { ILocaleJSONSymbol } from './type';

const LOCALE_ENGLISH_NAMES: Record<string, string> = {
  'zh-CN': 'Chinese (Simplified)',
  'zh-HK': 'Chinese (Traditional, Hong Kong)',
  'zh-TW': 'Chinese (Traditional, Taiwan)',
  'pt-BR': 'Portuguese (Brazil)',
};

/**
 * Message id for a language's name in the active app language.
 * Translations are managed in Lokalise and bundled with the app.
 */
export const LOCALE_DISPLAY_NAME_MESSAGE_IDS = {
  bn: ETranslations.language_name_bn__desc,
  de: ETranslations.language_name_de__desc,
  en: ETranslations.language_name_en__desc,
  'en-US': ETranslations.language_name_en__desc,
  es: ETranslations.language_name_es__desc,
  'fr-FR': ETranslations.language_name_fr_fr__desc,
  'hi-IN': ETranslations.language_name_hi_in__desc,
  id: ETranslations.language_name_id__desc,
  'it-IT': ETranslations.language_name_it_it__desc,
  'ja-JP': ETranslations.language_name_ja_jp__desc,
  'ko-KR': ETranslations.language_name_ko_kr__desc,
  pt: ETranslations.language_name_pt__desc,
  'pt-BR': ETranslations.language_name_pt_br__desc,
  ru: ETranslations.language_name_ru__desc,
  'th-TH': ETranslations.language_name_th_th__desc,
  'uk-UA': ETranslations.language_name_uk_ua__desc,
  vi: ETranslations.language_name_vi__desc,
  'zh-CN': ETranslations.language_name_zh_cn__desc,
  'zh-HK': ETranslations.language_name_zh_hk__desc,
  'zh-TW': ETranslations.language_name_zh_tw__desc,
} as const satisfies Record<ILocaleJSONSymbol, ETranslations>;

export function normalizeSearchText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replaceAll('_', '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function matchesSearchQuery(
  fields: Array<string | undefined>,
  query: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }
  return fields.some((field) => {
    if (!field) {
      return false;
    }
    return normalizeSearchText(field).includes(normalizedQuery);
  });
}

export function getLocaleEnglishName(symbol: string): string {
  const englishName = LOCALE_ENGLISH_NAMES[symbol] || ISO6391.getName(symbol);
  if (englishName) {
    return englishName;
  }
  if (symbol.includes('-')) {
    const [symbolShort] = symbol.split('-');
    return ISO6391.getName(symbolShort) || symbol;
  }
  return symbol;
}

export function normalizeSelectableLocale(locale: string): string {
  return locale === 'en-US' ? 'en' : locale;
}

export function resolveLocaleDescription({
  localeValue,
  currentLocale,
  nativeName,
  translatedName,
}: {
  localeValue: string;
  currentLocale: string;
  nativeName: string;
  translatedName?: string;
}): string | undefined {
  if (
    !translatedName ||
    localeValue === currentLocale ||
    translatedName === nativeName
  ) {
    return undefined;
  }
  return translatedName;
}

export function buildLocaleSelectOption({
  value,
  label,
  currentLocale,
  translatedName,
}: {
  value: string;
  label: string;
  currentLocale: string;
  translatedName?: string;
}): {
  label: string;
  value: string;
  description?: string;
  searchKeywords: string[];
} {
  const description = resolveLocaleDescription({
    localeValue: value,
    currentLocale,
    nativeName: label,
    translatedName,
  });
  const searchKeywords = [getLocaleEnglishName(value), value];
  if (value === 'en') {
    searchKeywords.push('en-US');
  }
  // The current language hides its subtitle, but that translation still has
  // to match search when it differs from the native label.
  if (
    translatedName &&
    translatedName !== label &&
    !searchKeywords.includes(translatedName)
  ) {
    searchKeywords.push(translatedName);
  }
  return description
    ? { label, value, description, searchKeywords }
    : { label, value, searchKeywords };
}
