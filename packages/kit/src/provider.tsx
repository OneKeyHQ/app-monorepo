import React, { FC, useMemo } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { Provider as ReduxProvider } from 'react-redux';

import { Provider, useThemeValue } from '@onekeyhq/components';

import Navigator from './navigator';
import store from './store';

const NavigationApp = () => {
  const backdropColor = useThemeValue('backdrop');
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: backdropColor,
      },
    }),
    [backdropColor],
  );
  return (
    <NavigationContainer theme={navigationTheme}>
      <Navigator />
    </NavigationContainer>
  );
};

const KitProvider: FC = () => (
  <Provider>
    <ReduxProvider store={store}>
      <NavigationApp />
    </ReduxProvider>
  </Provider>
);

export default KitProvider;
