import React, { useMemo } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createURL } from 'expo-linking';

import { useThemeValue } from '@onekeyhq/components';

import Navigator from '../navigator';

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
    <NavigationContainer theme={navigationTheme} linking={linking}>
      <Navigator />
    </NavigationContainer>
  );
};

export default NavigationApp;
