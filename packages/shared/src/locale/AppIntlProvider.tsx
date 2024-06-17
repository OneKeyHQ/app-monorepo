import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';

import { RawIntlProvider } from 'react-intl';

import { appLocale } from './appLocale';

import type { ILocaleSymbol } from './type';
import type { ResolvedIntlConfig } from '@formatjs/intl';

export function AppIntlProvider({
  locale,
  messages,
  children,
  onLocaleChange,
}: PropsWithChildren<{
  locale: ResolvedIntlConfig['locale'];
  messages: ResolvedIntlConfig['messages'];
  onLocaleChange: (locale: ILocaleSymbol) => void;
}>) {
  const [, setLocaleUpdateTs] = useState(0);
  useEffect(() => {
    appLocale.setLocale(locale, messages);
    setLocaleUpdateTs(Date.now());
    onLocaleChange(locale as ILocaleSymbol);
  }, [locale, messages, onLocaleChange]);
  return <RawIntlProvider value={appLocale.intl}>{children}</RawIntlProvider>;
}
