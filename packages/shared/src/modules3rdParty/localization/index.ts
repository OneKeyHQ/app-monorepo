import { getLocales } from 'expo-localization';

// expo-localization 56 dropped the `locale` constant in favour of getLocales().
// Its first entry is the user's preferred locale and `languageTag` holds the
// same BCP-47 string `locale` did, so getSystemLocale() keeps its contract.
// Read once at module load, exactly as `locale` was. getLocales() is typed as
// a non-empty tuple, so the first element always exists.
export const locale: string = getLocales()[0].languageTag;
