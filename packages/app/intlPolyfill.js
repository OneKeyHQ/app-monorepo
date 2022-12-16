import { shouldPolyfill as shouldPolyfillGetcanonicallocales } from '@formatjs/intl-getcanonicallocales/should-polyfill';
import { shouldPolyfill as shouldPolyfillLocale } from '@formatjs/intl-locale/should-polyfill';
import { shouldPolyfill as shouldPolyfillPluralrules } from '@formatjs/intl-pluralrules/should-polyfill';

(async () => {
  if (shouldPolyfillGetcanonicallocales()) {
    await import('@formatjs/intl-getcanonicallocales/polyfill');
  }
  if (shouldPolyfillLocale()) {
    await import('@formatjs/intl-locale/polyfill');
  }
  if (shouldPolyfillPluralrules()) {
    await import('@formatjs/intl-pluralrules/polyfill');
    await import('@formatjs/intl-pluralrules/locale-data/en');
  }
})();
