import { useEffect, useState } from 'react';

import { RawIntlProvider } from 'react-intl';

import { appLocale } from './appLocale';

import type { ResolvedIntlConfig } from '@formatjs/intl';

export function AppIntlProvider({
  locale,
  messages,
  children,
}: {
  locale: ResolvedIntlConfig['locale'];
  messages: ResolvedIntlConfig['messages'];
  children: any;
}) {
  const [, setLocaleUpdateTs] = useState(0);
  useEffect(() => {
    appLocale.setLocale(locale, messages);
    setLocaleUpdateTs(Date.now());
  }, [locale, messages]);
  return <RawIntlProvider value={appLocale.intl}>{children}</RawIntlProvider>;
}
