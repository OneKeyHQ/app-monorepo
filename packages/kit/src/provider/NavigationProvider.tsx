import React, { useMemo } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createURL } from 'expo-linking';

import { useThemeValue } from '@onekeyhq/components';
import Toast from '@onekeyhq/components/src/Toast/Custom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Navigator, { navigationRef } from '../navigator';

const prefix = createURL('/');

const NavigationApp = () => {
  const linking = {
    prefixes: [prefix],
  };

  const [bgColor, textColor, bgDefault] = useThemeValue([
    'surface-subdued',
    'text-default',
    'background-default',
  ]);

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: platformEnv.isNative ? bgDefault : 'transparent',
        card: bgColor,
        text: textColor,
      },
    }),
    [bgColor, textColor, bgDefault],
  );

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        linking={platformEnv.isNative ? linking : undefined}
      >
        <Navigator />
      </NavigationContainer>
      <Toast bottomOffset={60} />
    </>
  );
};

NavigationApp.displayName = 'NavigationApp';

export default NavigationApp;
