import React, { ComponentProps, FC, memo, useEffect } from 'react';

import { Provider } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { useColorScheme } from '@onekeyhq/kit/src/hooks/useColorScheme';
import { setThemePreloadToLocalStorage } from '@onekeyhq/kit/src/store/reducers/settings';
import { defaultHapticStatus } from '@onekeyhq/shared/src/haptics';

import { useSystemLocale } from '../hooks/useSystemLocale';

export function useThemeProviderVariant() {
  const { theme, locale, enableHaptics = defaultHapticStatus } = useSettings();

  const systemLocale = useSystemLocale();
  const colorScheme = useColorScheme();

  const themeVariant = theme === 'system' ? colorScheme ?? 'dark' : theme;
  const localeVariant = locale === 'system' ? systemLocale : locale;
  return {
    themeVariant,
    localeVariant,
    enableHaptics,
  };
}

const ThemeApp: FC = ({ children }) => {
  const { themeVariant, localeVariant, enableHaptics } =
    useThemeProviderVariant();

  useEffect(() => {
    setThemePreloadToLocalStorage(themeVariant);
  }, [themeVariant]);

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
