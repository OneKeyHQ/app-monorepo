/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
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
import { lock, refreshLastActivity } from '../../store/reducers/status';
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

const Dashboard = () => {
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
  const dispatch = useAppDispatch();
  const [, setState] = useState(0);
  const { appLockDuration, enableAppLock } = useSettings();
  const { lastActivity, isUnlock, passwordCompleted } = useStatus();

  const idleDuration = Math.floor((Date.now() - lastActivity) / (1000 * 60));
  const isKeepAlive = idleDuration < appLockDuration;

  const onRun = useCallback(
    (state: AppStateStatus) => {
      if (state === 'background') {
        dispatch(refreshLastActivity());
        if (appLockDuration === 0) {
          dispatch(lock());
        }
      } else if (state === 'active') {
        setState((v) => v + 1);
      }
    },
    [dispatch, appLockDuration, setState],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onRun);
    return () => {
      // @ts-ignore
      subscription?.remove();
    };
  }, [dispatch, onRun]);

  if (!passwordCompleted || !enableAppLock) {
    return <Dashboard />;
  }

  if (appLockDuration === 0) {
    return isUnlock ? <Dashboard /> : <Unlock />;
  }

  return isKeepAlive ? <Dashboard /> : <Unlock />;
};

export default MainScreen;
