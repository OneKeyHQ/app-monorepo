import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { RawIntlProvider } from 'react-intl';

import { appLocale } from './appLocale';
import { LOCALES } from './localeJsonMap';

import type { ETranslations } from './enum/translations';
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
    const data = LOCALES[locale as ILocaleJSONSymbol];
    if (typeof data === 'function') {
      void data().then((module) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (LOCALES as any)[locale as ILocaleJSONSymbol] = module;
        updateAppLocaleMessage(
          locale,
          module as unknown as Record<string, string>,
        );
      });
    } else {
      updateAppLocaleMessage(locale, data);
    }
  }, [locale, onLocaleChange, updateAppLocaleMessage]);
  return localeUpdateTs ? (
    <RawIntlProvider value={appLocale.intl}>{children}</RawIntlProvider>
  ) : null;
}
