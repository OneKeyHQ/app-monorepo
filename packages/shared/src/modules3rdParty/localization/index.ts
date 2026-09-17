import { getLocales } from 'expo-localization';

export const locale = getLocales()[0]?.languageTag ?? 'en-US';
