import { createIntl, createIntlCache } from 'react-intl';

import type { ILocaleSymbol } from '@onekeyhq/components';

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

  getLocale() {
    return this.intl.locale as ILocaleSymbol;
  }
}

const appLocale = new AppLocale();
export { appLocale };
