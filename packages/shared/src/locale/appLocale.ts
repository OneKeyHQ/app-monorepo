import { createIntl, createIntlCache } from 'react-intl';

import type { CustomFormats, ResolvedIntlConfig } from '@formatjs/intl';
import type { IntlShape } from 'react-intl';

class AppLocale {
  constructor() {
    this.setLocale('en-US', {} as any);
  }

  cache = createIntlCache();

  intl!: IntlShape;

  formats: CustomFormats = {
    date: {
      'default': {
        dateStyle: 'short',
        timeStyle: 'short',
        hour12: false,
      },
    },
  };

  setLocale(
    locale: ResolvedIntlConfig['locale'],
    messages: ResolvedIntlConfig['messages'],
  ) {
    this.intl = createIntl(
      {
        locale,
        messages,
        formats: this.formats,
        defaultFormats: this.formats,
      },
      this.cache,
    );
  }
}

const appLocale = new AppLocale();
export { appLocale };
