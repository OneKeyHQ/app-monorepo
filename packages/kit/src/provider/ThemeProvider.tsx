import React, { ComponentProps, FC, memo, useEffect } from 'react';

import { Provider } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { useColorScheme } from '@onekeyhq/kit/src/hooks/useColorScheme';
import { setThemePreloadToLocalStorage } from '@onekeyhq/kit/src/store/reducers/settings';

const ThemeApp: FC = ({ children }) => {
  const colorScheme = useColorScheme();
  const { theme, locale } = useSettings();
  const themeVariant = theme === 'system' ? colorScheme ?? 'dark' : theme;

  useEffect(() => {
    setThemePreloadToLocalStorage(themeVariant);
  }, [themeVariant]);

  return (
    <Provider themeVariant={themeVariant} locale={locale}>
      {children}
    </Provider>
  );
};

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
