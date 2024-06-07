import type { LOCALES as _LOCALES } from './localeJsonMap';

type ILocaleJSONSymbol = keyof typeof _LOCALES;
export type ILocaleSymbol = ILocaleJSONSymbol | 'system';
