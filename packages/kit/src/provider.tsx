import React, { FC, useMemo } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { Provider, useThemeValue } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';

import Navigator from './navigator';
import store, { persistor } from './store';

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

const NavigationApp = () => {
  const [bgColor, textColor] = useThemeValue([
    'surface-subdued',
    'text-default',
  ]);
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        // Fixed color
        background: 'rgba(0, 0, 0, 0.4)',
        card: bgColor,
        text: textColor,
      },
    }),
    [bgColor, textColor],
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <Navigator />
    </NavigationContainer>
  );
};

const KitProvider: FC = () => (
  <ReduxProvider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <ThemeApp>
        <NavigationApp />
      </ThemeApp>
    </PersistGate>
  </ReduxProvider>
);

export default KitProvider;
