import { createIntl, createIntlCache } from 'react-intl';

import type { ResolvedIntlConfig } from '@formatjs/intl';
import type { IntlShape } from 'react-intl';

class AppLocale {
  constructor() {
    this.setLocale('en-US', {} as any);
  }

  cache = createIntlCache();

  intl!: IntlShape;

  setLocale(
    locale: ResolvedIntlConfig['locale'],
    messages: ResolvedIntlConfig['messages'],
  ) {
    this.intl = createIntl(
      {
        locale,
        messages,
      },
      this.cache,
    );
  }
}

const appLocale = new AppLocale();
export { appLocale };
