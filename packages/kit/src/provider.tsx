import React, { FC, useMemo } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { Provider as ReduxProvider } from 'react-redux';

import { Provider } from '@onekeyhq/components';

import Navigator from './navigator';
import store from './store';

const NavigationApp = () => {
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        // Fixed color
        background: 'rgba(0, 0, 0, 0.4)',
      },
    }),
    [],
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
