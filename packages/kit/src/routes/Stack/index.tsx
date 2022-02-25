/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { useCallback, useEffect, useState } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import Settings from '@onekeyhq/kit/src/views/Settings';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import Unlock from '@onekeyhq/kit/src/views/Unlock';
import Webview from '@onekeyhq/kit/src/views/Webview';

import { useAppDispatch, useSettings, useStatus } from '../../hooks/redux';
import { logout } from '../../store/reducers/status';
import { LockDuration } from '../../utils/constant';
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
  const [bgColor, textColor, borderBottomColor] = useThemeValue([
    'surface-subdued',
    'text-default',
    'border-subdued',
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
            // @ts-expect-error
            borderBottomColor,
            shadowColor: borderBottomColor,
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
  const [, setValue] = useState(0);
  const dispatch = useAppDispatch();
  const { appLockDuration, enableAppLock } = useSettings();
  const onRefresh = useCallback(() => {
    setValue((prev) => prev + 1);
  }, []);
  useEffect(() => {
    AppState.addEventListener('change', onRefresh);
    const timer = setInterval(onRefresh, 10 * 1000);
    return () => {
      AppState.removeEventListener('change', onRefresh);
      clearInterval(timer);
    };
  }, [onRefresh]);
  const onLogout = useCallback(
    (state: AppStateStatus) => {
      if (state === 'background' && appLockDuration === LockDuration.None) {
        dispatch(logout());
      }
    },
    [dispatch, appLockDuration],
  );
  useEffect(() => {
    AppState.addEventListener('change', onLogout);
    return () => {
      AppState.removeEventListener('change', onLogout);
    };
  }, [dispatch, onLogout]);
  const { loginAt, isLogin, initialized } = useStatus();
  if (!initialized) {
    return <StackScreen />;
  }
  const idleDuration = (Date.now() - loginAt) / (1000 * 60);
  const isLock = enableAppLock && idleDuration > appLockDuration;
  return isLock || !isLogin ? <Unlock /> : <StackScreen />;
};

export default MainScreen;
