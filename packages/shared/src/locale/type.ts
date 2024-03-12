import type { LOCALES as _LOCALES, enUS } from './localeJsonMap';

export type ILocaleSymbol = keyof typeof _LOCALES | 'system';
export type ILocaleIds = keyof typeof enUS;
