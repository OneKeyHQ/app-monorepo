import React, { useMemo } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createURL } from 'expo-linking';

import { useThemeValue } from '@onekeyhq/components';

import Navigator, { navigationRef } from '../navigator';

const prefix = createURL('/');

const NavigationApp = () => {
  const linking = {
    prefixes: [prefix],
  };

  const [bgColor, textColor] = useThemeValue([
    'surface-subdued',
    'text-default',
    'background-default',
  ]);

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: 'transparent',
        card: bgColor,
        text: textColor,
      },
    }),
    [bgColor, textColor],
  );

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={linking}
      // linking={['ios', 'android'].includes(Platform.OS) ? linking : undefined}
    >
      <Navigator />
    </NavigationContainer>
  );
};

export default NavigationApp;
