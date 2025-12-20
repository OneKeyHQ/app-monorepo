import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';

function convertToRevenuecatLocale({
  locale,
}: {
  locale: ILocaleJSONSymbol;
}): string {
  // Mapping from OneKey locale to RevenueCat supported locale
  // RevenueCat supported languages: https://www.revenuecat.com/docs/web/web-billing/localization#supported-languages
  const localeMap: Record<ILocaleJSONSymbol, string> = {
    'bn': 'en', // Bengali -> English (not supported)
    'de': 'de', // German -> German
    'en': 'en', // English -> English
    'en-US': 'en', // English (US) -> English
    'es': 'es', // Spanish -> Spanish
    'fr-FR': 'fr', // French (France) -> French
    'hi-IN': 'hi', // Hindi (India) -> Hindi
    'id': 'id', // Indonesian -> Indonesian
    'it-IT': 'it', // Italian (Italy) -> Italian
    'ja-JP': 'ja', // Japanese (Japan) -> Japanese
    'ko-KR': 'ko', // Korean (Korea) -> Korean
    'pt': 'pt', // Portuguese -> Portuguese
    'pt-BR': 'pt', // Portuguese (Brazil) -> Portuguese
    'ru': 'ru', // Russian -> Russian
    'th-TH': 'th', // Thai (Thailand) -> Thai
    'uk-UA': 'uk', // Ukrainian (Ukraine) -> Ukrainian
    'vi': 'vi', // Vietnamese -> Vietnamese
    'zh-CN': 'zh_Hans', // Chinese (Simplified) -> Chinese Simplified
    'zh-HK': 'zh_Hant', // Chinese (Hong Kong) -> Chinese Traditional
    'zh-TW': 'zh_Hant', // Chinese (Taiwan) -> Chinese Traditional
  };

  return localeMap[locale] || 'en'; // Fallback to English for unsupported locales
}

export default { convertToRevenuecatLocale };
