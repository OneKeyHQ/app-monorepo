import React, { FC } from 'react';

import { Provider } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';

import { useColorScheme } from '../hooks/useColorScheme';

const ThemeApp: FC = ({ children }) => {
  const colorScheme = useColorScheme();
  const { theme, locale } = useSettings();
  const themeVariant = theme === 'system' ? colorScheme ?? 'dark' : theme;
  return (
    <Provider themeVariant={themeVariant} locale={locale}>
      {children}
    </Provider>
  );
};

export default ThemeApp;
