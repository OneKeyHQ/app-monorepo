import ISO6391 from 'iso-639-1';

import type { ILocaleJSONSymbol } from './type';

const LOCALE_ENGLISH_NAMES: Record<string, string> = {
  'zh-CN': 'Chinese (Simplified)',
  'zh-HK': 'Chinese (Traditional, Hong Kong)',
  'zh-TW': 'Chinese (Traditional, Taiwan)',
  'pt-BR': 'Portuguese (Brazil)',
};

/**
 * Message id for a language's name in the active app language.
 * Keys are added in Lokalise; until a key is generated, the subtitle is omitted.
 */
export const LOCALE_DISPLAY_NAME_MESSAGE_IDS = {
  bn: 'global.language_name_bn',
  de: 'global.language_name_de',
  en: 'global.language_name_en',
  'en-US': 'global.language_name_en',
  es: 'global.language_name_es',
  'fr-FR': 'global.language_name_fr_fr',
  'hi-IN': 'global.language_name_hi_in',
  id: 'global.language_name_id',
  'it-IT': 'global.language_name_it_it',
  'ja-JP': 'global.language_name_ja_jp',
  'ko-KR': 'global.language_name_ko_kr',
  pt: 'global.language_name_pt',
  'pt-BR': 'global.language_name_pt_br',
  ru: 'global.language_name_ru',
  'th-TH': 'global.language_name_th_th',
  'uk-UA': 'global.language_name_uk_ua',
  vi: 'global.language_name_vi',
  'zh-CN': 'global.language_name_zh_cn',
  'zh-HK': 'global.language_name_zh_hk',
  'zh-TW': 'global.language_name_zh_tw',
} as const satisfies Record<ILocaleJSONSymbol, string>;

export function normalizeSearchText(text: string): string {
  return text
    .trim()
    .toLowerCase()
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
