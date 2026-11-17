const INTERCOM_LANGUAGE_OVERRIDES: Record<string, string> = {
  bn: 'bn',
  de: 'de',
  en: 'en',
  'en-us': 'en',
  es: 'es',
  fr: 'fr',
  'fr-fr': 'fr',
  hi: 'hi',
  'hi-in': 'hi',
  id: 'id',
  it: 'it',
  'it-it': 'it',
  ja: 'ja',
  'ja-jp': 'ja',
  ko: 'ko',
  'ko-kr': 'ko',
  pt: 'pt',
  'pt-br': 'pt-BR',
  ru: 'ru',
  th: 'th',
  'th-th': 'th',
  uk: 'uk',
  'uk-ua': 'uk',
  vi: 'vi',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-hk': 'zh-TW',
  'zh-hant': 'zh-TW',
  'zh-tw': 'zh-TW',
};

export const toIntercomLanguageOverride = (
  locale: string | null | undefined,
): string => {
  const normalizedLocale = locale?.trim().replace(/_/g, '-');

  if (
    !normalizedLocale ||
    ['null', 'undefined'].includes(normalizedLocale.toLowerCase())
  ) {
    return 'en';
  }

  const localeKey = normalizedLocale.toLowerCase();
  const languageKey = localeKey.split('-')[0];

  return (
    INTERCOM_LANGUAGE_OVERRIDES[localeKey] ??
    INTERCOM_LANGUAGE_OVERRIDES[languageKey] ??
    'en'
  );
};
