/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import React, { useCallback, useEffect } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import { Discover } from '@onekeyhq/kit/src/views/Discover/Home';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import Settings from '@onekeyhq/kit/src/views/Settings';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import Unlock from '@onekeyhq/kit/src/views/Unlock';
import Webview from '@onekeyhq/kit/src/views/Webview';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useInterval } from '../../hooks';
import { useData, useSettings, useStatus } from '../../hooks/redux';
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
  {
    name: HomeRoutes.ExploreScreen,
    component: Discover,
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
  const { dispatch } = backgroundApiProxy;
  const { appLockDuration, enableAppLock } = useSettings();
  const { lastActivity, isUnlock } = useStatus();
  const { isUnlock: isDataUnlock, isPasswordSet } = useData();

  const refresh = useCallback(() => {
    if (AppState.currentState === 'active') {
      dispatch(refreshLastActivity());
    }
  }, [dispatch]);
  useInterval(refresh, 5 * 1000);

  const onChange = useCallback(
    (state: AppStateStatus) => {
      if (appLockDuration === 0) {
        if (state === 'background') {
          dispatch(lock());
        }
        return;
      }
      if (state !== 'active') {
        return;
      }
      const idleDuration = Math.floor(
        (Date.now() - lastActivity) / (1000 * 60),
      );
      const isStale = idleDuration >= appLockDuration;
      if (isStale) {
        dispatch(lock());
      }
    },
    [dispatch, appLockDuration, lastActivity],
  );

  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }
    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      // @ts-ignore
      subscription?.remove();
    };
  }, [dispatch, onChange]);

  useEffect(() => {
    if (platformEnv.isNative) {
      return;
    }
    const idleDuration = Math.floor((Date.now() - lastActivity) / (1000 * 60));
    const isStale = idleDuration >= appLockDuration;
    if (isStale) {
      dispatch(lock());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isPasswordSet || !enableAppLock) {
    return <Dashboard />;
  }
  return isUnlock && isDataUnlock ? <Dashboard /> : <Unlock />;
};

export default MainScreen;
