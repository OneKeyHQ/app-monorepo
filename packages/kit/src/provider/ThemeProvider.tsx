import type { ComponentProps, FC } from 'react';
import { memo, useEffect, useState } from 'react';

import { Provider } from '@onekeyhq/components';
import type { LocaleSymbol } from '@onekeyhq/components/src/locale';
import LOCALES from '@onekeyhq/components/src/locale';
import { useAppSelector, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { useColorScheme } from '@onekeyhq/kit/src/hooks/useColorScheme';
import { setThemePreloadToLocalStorage } from '@onekeyhq/kit/src/store/reducers/settings';
import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import { defaultHapticStatus } from '@onekeyhq/shared/src/haptics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useSystemLocale } from '../hooks/useSystemLocale';
import store from '../store';
import { setIsReduxReady } from '../store/reducers/data';

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

function useReduxSyncReady() {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    (async () => {
      await waitForDataLoaded({
        logName: 'WaitBackgroundReady @ ThemeApp',
        wait: 300,
        data: async () => {
          const result = await backgroundApiProxy.getState();
          if (result && result.bootstrapped) {
            if (platformEnv.isExtensionUi) {
              store.dispatch({
                // TODO use consts
                type: 'REPLACE_WHOLE_STATE',
                payload: result.state,
                $isDispatchFromBackground: true,
              });
            }
            setTimeout(() => {
              store.dispatch({
                ...setIsReduxReady(),
                $isDispatchFromBackground: true,
              });
            });
            return true;
          }
          return false;
        },
      });
      setIsReady(true);
    })();
  }, []);
  return {
    isReady,
  };
}

const ThemeApp: FC = ({ children }) => {
  const { themeVariant, localeVariant, enableHaptics } =
    useThemeProviderVariant();
  const isReduxReady = useAppSelector((s) => s.data.isReduxReady);
  const { isReady } = useReduxSyncReady();
  useEffect(() => {
    if (isReduxReady && isReady) {
      setThemePreloadToLocalStorage(themeVariant);
    }
  }, [isReady, isReduxReady, themeVariant]);

  if (!isReduxReady || !isReady) {
    return null;
  }

  return (
    <Provider
      themeVariant={themeVariant}
      locale={localeVariant}
      hapticsEnabled={enableHaptics}
    >
      {children}
    </Provider>
  );
};

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
