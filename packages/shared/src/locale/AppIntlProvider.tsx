import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { RawIntlProvider } from 'react-intl';

import { appLocale } from './appLocale';
import { loadLocaleMessages } from './localeLoaders';

import type { ILocaleJSONSymbol, ILocaleSymbol } from './type';
import type { ResolvedIntlConfig } from '@formatjs/intl';

export function AppIntlProvider({
  locale,
  children,
  onLocaleChange,
}: PropsWithChildren<{
  locale: ResolvedIntlConfig['locale'];
  onLocaleChange?: (locale: ILocaleSymbol) => void;
}>) {
  const [localeUpdateTs, setLocaleUpdateTs] = useState(0);

  const updateAppLocaleMessage = useCallback(
    (localeString: string, messages: Record<string, string>) => {
      appLocale.setLocale(localeString, messages);
      setLocaleUpdateTs(Date.now());
      onLocaleChange?.(locale as ILocaleSymbol);
    },
    [locale, onLocaleChange],
  );

  useEffect(() => {
    let cancelled = false;
    void loadLocaleMessages(locale as ILocaleJSONSymbol).then((messages) => {
      if (cancelled) {
        return;
      }
      updateAppLocaleMessage(locale, messages);
    });
    return () => {
      cancelled = true;
    };
  }, [locale, onLocaleChange, updateAppLocaleMessage]);
  return localeUpdateTs ? (
    <RawIntlProvider value={appLocale.intl}>{children as any}</RawIntlProvider>
  ) : null;
}
