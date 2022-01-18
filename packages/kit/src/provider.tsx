import React, { FC, useMemo } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import axios from 'axios';
import { createURL } from 'expo-linking';
import { useColorScheme } from 'react-native';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SWRConfig } from 'swr';

import {
  Provider,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';

import Navigator from './navigator';
import store, { persistor } from './store';

console.warn = () => {};

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
const prefix = createURL('/');

const NavigationApp = () => {
  const linking = {
    prefixes: [prefix],
  };
  const [bgColor, textColor] = useThemeValue([
    'surface-subdued',
    'text-default',
  ]);
  const isVerticalLayout = useIsVerticalLayout();
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        // Fixed color
        background: isVerticalLayout
          ? 'rgba(0, 0, 0, 0.8)'
          : 'rgba(0, 0, 0, 0.6)',
        card: bgColor,
        text: textColor,
      },
    }),
    [bgColor, textColor, isVerticalLayout],
  );

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      <Navigator />
    </NavigationContainer>
  );
};

// TODO: detect network change & APP in background mode
const KitProvider: FC = () => (
  <SWRConfig
    value={{
      fetcher: async (resource, init) => {
        const result = await axios(resource, init);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result.data;
      },
    }}
  >
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeApp>
          <NavigationApp />
        </ThemeApp>
      </PersistGate>
    </ReduxProvider>
  </SWRConfig>
);

export default KitProvider;
