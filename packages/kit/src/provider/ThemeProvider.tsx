import type { ComponentProps, FC } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';

import { Provider } from '@onekeyhq/components';
import type { LocaleSymbol } from '@onekeyhq/components/src/locale';
import LOCALES from '@onekeyhq/components/src/locale';
import { useAppSelector, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { useColorScheme } from '@onekeyhq/kit/src/hooks/useColorScheme';
import {
  setLeftSidebarCollapsed,
  setThemePreloadToLocalStorage,
} from '@onekeyhq/kit/src/store/reducers/settings';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useReduxReady } from '../hooks/useReduxReady';
import { useSystemLocale } from '../hooks/useSystemLocale';

export function useThemeProviderVariant() {
  const { theme, locale, lastLocale } = useSettings();
  const systemLocale = useSystemLocale();
  const colorScheme = useColorScheme();
  const themeVariant = theme === 'system' ? colorScheme ?? 'dark' : theme;
  const currentVariant = (
    locale === 'system' ? systemLocale : locale
  ) as LocaleSymbol;
  const cachedLocale = LOCALES[currentVariant];
  const localeReady = typeof cachedLocale === 'object';
  const [localeVariant, setLocaleVariant] = useState(() => {
    if (localeReady) {
      return currentVariant;
    }
    if (typeof LOCALES[lastLocale] !== 'function') {
      return lastLocale;
    }
    return 'en-US';
  });

  useEffect(() => {
    if (!localeReady) {
      if (typeof cachedLocale === 'function') {
        cachedLocale().then((module) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          LOCALES[currentVariant] = module.default;
          setLocaleVariant(currentVariant);
        });
      }
    }
  }, [cachedLocale, currentVariant, localeReady, localeVariant]);

  return {
    themeVariant,
    localeVariant: localeReady ? currentVariant : localeVariant,
  };
}

const ThemeApp: FC = ({ children }) => {
  const { themeVariant, localeVariant } = useThemeProviderVariant();
  const { isReady } = useReduxReady();
  const leftSidebarCollapsed = useAppSelector(
    (s) => s.settings.leftSidebarCollapsed,
  );
  useEffect(() => {
    if (isReady) {
      setThemePreloadToLocalStorage(themeVariant);
    }
  }, [isReady, themeVariant]);

  const setCollapsed = useCallback((value: boolean) => {
    backgroundApiProxy.dispatch(setLeftSidebarCollapsed(value));
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <Provider
      themeVariant={themeVariant}
      locale={localeVariant}
      reduxReady={isReady ?? false}
      leftSidebarCollapsed={!!leftSidebarCollapsed}
      setLeftSidebarCollapsed={setCollapsed}
    >
      {children}
    </Provider>
  );
};

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
