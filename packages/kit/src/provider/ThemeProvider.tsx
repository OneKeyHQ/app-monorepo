import type { ComponentProps, FC } from 'react';
import { memo, useEffect, useState } from 'react';

import { Provider } from '@onekeyhq/components';
import type { LocaleSymbol } from '@onekeyhq/components/src/locale';
import LOCALES from '@onekeyhq/components/src/locale';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { useColorScheme } from '@onekeyhq/kit/src/hooks/useColorScheme';
import { setThemePreloadToLocalStorage } from '@onekeyhq/kit/src/store/reducers/settings';
import { defaultHapticStatus } from '@onekeyhq/shared/src/haptics';

import { useSystemLocale } from '../hooks/useSystemLocale';

import { useReduxReady } from './useReduxReady';

export function useThemeProviderVariant() {
  const {
    theme,
    locale,
    lastLocale,
    enableHaptics = defaultHapticStatus,
  } = useSettings();
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
    enableHaptics,
  };
}

const ThemeApp: FC = ({ children }) => {
  const { themeVariant, localeVariant, enableHaptics } =
    useThemeProviderVariant();
  const isReady = useReduxReady();
  useEffect(() => {
    if (isReady) {
      setThemePreloadToLocalStorage(themeVariant);
    }
  }, [isReady, themeVariant]);

  if (!isReady) {
    return null;
  }

  return (
    <Provider
      themeVariant={themeVariant}
      locale={localeVariant}
      hapticsEnabled={enableHaptics}
      reduxReady={isReady.isReady ?? false}
    >
      {children}
    </Provider>
  );
};

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
