import keylessWebTabUrlPatternsConfig from './keylessWebTabUrlPatternsJson.json';

export const KEYLESS_WEB_TAB_URL_PATTERNS = [
  ...keylessWebTabUrlPatternsConfig.basePatterns,
  ...(process.env.NODE_ENV !== 'production'
    ? keylessWebTabUrlPatternsConfig.localDevPatterns
    : []),
];

export const KEYLESS_WEB_TAB_WHITE_LIST_ORIGIN =
  KEYLESS_WEB_TAB_URL_PATTERNS.reduce<string[]>((acc, pattern) => {
    try {
      acc.push(new URL(pattern.replace(/\/\*$/, '/')).origin);
    } catch {
      // Ignore invalid URL patterns.
    }
    return acc;
  }, []);
