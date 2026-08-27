import { getLocales } from 'expo-localization';

// expo-localization 56 dropped the `locale` constant in favour of getLocales().
// Its first entry is the user's preferred locale and `languageTag` holds the
// same BCP-47 string `locale` did, so getSystemLocale() keeps its contract.
// Read once at module load, exactly as `locale` was. getLocales() is typed as
// a non-empty tuple, so the first element always exists.
//
// On the native background runtime the expo native modules are Proxy stubs
// that resolve lowercase members to undefined (apps/mobile/background.ts), so
// `getLocales` itself — a module-scope pluck off the native module in
// expo-localization 56 — may not be a function there. Calling it unguarded
// kills the background bundle at evaluation time ("undefined is not a
// function"), which surfaces on main as "backgroundApi not found in non-ext
// env". Fall back to '' — the same contract as the jest mock — so
// getDefaultLocale() lands on en-US instead of the runtime dying.
export const locale: string =
  typeof getLocales === 'function' ? getLocales()[0].languageTag : '';
