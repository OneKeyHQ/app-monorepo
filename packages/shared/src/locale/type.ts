import type { LOCALES as _LOCALES } from './localeJsonMap';

export type ILocaleJSONSymbol = keyof typeof _LOCALES;
export type ILocaleSymbol = ILocaleJSONSymbol | 'system';
