import { shouldPolyfill as shouldPolyfillGetcanonicallocales } from '@formatjs/intl-getcanonicallocales/should-polyfill';
import { shouldPolyfill as shouldPolyfillLocale } from '@formatjs/intl-locale/should-polyfill';
import { shouldPolyfill as shouldPolyfillPluralrules } from '@formatjs/intl-pluralrules/should-polyfill';

if (shouldPolyfillGetcanonicallocales()) {
  require('@formatjs/intl-getcanonicallocales/polyfill');
}
if (shouldPolyfillLocale()) {
  require('@formatjs/intl-locale/polyfill');
}
if (shouldPolyfillPluralrules()) {
  require('@formatjs/intl-pluralrules/polyfill');
  require('@formatjs/intl-pluralrules/locale-data/en');
}
