import enUS from './en-US.json';
import { LOCALES, LOCALES_OPTION } from './Locale';

export type LocaleSymbol = keyof typeof LOCALES;
export type LocaleIds = keyof typeof enUS;

export default LOCALES;
export { LOCALES_OPTION };
