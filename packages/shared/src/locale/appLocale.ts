import { isEmpty } from 'lodash';
import { createIntl, createIntlCache } from 'react-intl';

import type { ILocaleSymbol } from './type';
import type { ResolvedIntlConfig } from '@formatjs/intl';
import type { IntlShape } from 'react-intl';

export const fallbackAppLocaleIntl = createIntl({
  locale: 'en-US',
});

class AppLocale {
  constructor() {
    this.setLocale('en-US', {} as any);
  }

  cache = createIntlCache();

  intl!: IntlShape;

  private isReadyResolve!: (value: boolean) => void;

  isReady = new Promise<boolean>((resolve) => {
    this.isReadyResolve = resolve;
  });

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

    if (!isEmpty(messages)) {
      this.isReadyResolve(true);
    }
  }

  getLocale() {
    return this.intl.locale as ILocaleSymbol;
  }
}

const appLocale = new AppLocale();
export { appLocale };
