import React, { useMemo } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createURL } from 'expo-linking';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';

import Navigator from '../navigator';

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

export default NavigationApp;
