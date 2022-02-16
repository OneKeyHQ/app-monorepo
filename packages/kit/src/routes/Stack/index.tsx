/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { useCallback, useEffect, useState } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppState, Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import Settings from '@onekeyhq/kit/src/views/Settings';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import Unlock from '@onekeyhq/kit/src/views/Unlock';
import Webview from '@onekeyhq/kit/src/views/Webview';

import { useSettings, useStatus } from '../../hooks/redux';
import Dev from '../Dev';
import Drawer from '../Drawer';
import { HomeRoutes, HomeRoutesParams } from '../types';

import renderCustomSubStackHeader from './Header';

export const stackScreenList = [
  {
    name: HomeRoutes.ScreenTokenDetail,
    component: TokenDetail,
  },
  {
    name: HomeRoutes.SettingsScreen,
    component: Settings,
  },
  {
    name: HomeRoutes.SettingsWebviewScreen,
    component: Webview,
  },
  {
    name: HomeRoutes.ScreenOnekeyLiteDetail,
    component: OnekeyLiteDetail,
  },
];

export const StackNavigator = createNativeStackNavigator<HomeRoutesParams>();

const StackScreen = () => {
  const [bgColor, textColor] = useThemeValue([
    'surface-subdued',
    'text-default',
  ]);

  return (
    <StackNavigator.Navigator>
      <StackNavigator.Group screenOptions={{ headerShown: false }}>
        <StackNavigator.Screen
          name={HomeRoutes.InitialTab}
          component={Drawer}
        />
        <StackNavigator.Screen name={HomeRoutes.Dev} component={Dev} />
      </StackNavigator.Group>
      <StackNavigator.Group
        screenOptions={{
          headerBackTitle: '',
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: bgColor,
          },
          header:
            Platform.OS === 'ios' ? renderCustomSubStackHeader : undefined,
          headerTintColor: textColor,
        }}
      >
        {stackScreenList.map((stack) => (
          <StackNavigator.Screen
            key={stack.name}
            name={stack.name}
            component={stack.component}
          />
        ))}
      </StackNavigator.Group>
    </StackNavigator.Navigator>
  );
};

const MainScreen = () => {
  const [, setCount] = useState(0);
  const { appLockDuration, enableAppLock } = useSettings();
  const onChange = useCallback(() => setCount((prev) => prev + 1), []);
  useEffect(() => {
    AppState.addEventListener('change', onChange);
    return () => {
      AppState.removeEventListener('change', onChange);
    };
  }, [onChange]);
  const { lastLoginAt } = useStatus();
  const duration = (Date.now() - lastLoginAt) / (1000 * 60);
  const isUnlock = enableAppLock && duration > appLockDuration;
  return isUnlock ? <Unlock /> : <StackScreen />;
};

export default MainScreen;
