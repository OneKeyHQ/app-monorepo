/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { useCallback, useEffect } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { Box, useThemeValue } from '@onekeyhq/components';
import { setMainScreenDom } from '@onekeyhq/components/src/utils/SelectAutoHide';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { Discover } from '@onekeyhq/kit/src/views/Discover/Home';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import Settings from '@onekeyhq/kit/src/views/Settings';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import TransactionHistory from '@onekeyhq/kit/src/views/TransactionHistory';
import Unlock from '@onekeyhq/kit/src/views/Unlock';
import Webview from '@onekeyhq/kit/src/views/Webview';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useInterval } from '../../hooks';
import { useData, useSettings, useStatus } from '../../hooks/redux';
import { lock, refreshLastActivity } from '../../store/reducers/status';
import { Atom } from '../../utils/helper';
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
  {
    name: HomeRoutes.DAppListScreen,
    component: DAppList,
  },
  {
    name: HomeRoutes.TransactionHistoryScreen,
    component: TransactionHistory,
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
  const preconditon = isPasswordSet && enableAppLock;

  const refresh = useCallback(() => {
    if (AppState.currentState === 'active') {
      dispatch(refreshLastActivity());
    }
  }, [dispatch]);
  useInterval(refresh, 30 * 1000);

  const onChange = useCallback(
    (state: AppStateStatus) => {
      if (appLockDuration === 0) {
        if (Atom.AppState.isLocked()) {
          return;
        }
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
    if (platformEnv.isExtension || !preconditon) {
      return;
    }
    // AppState.addEventListener return subscription object in native env, but return empty in web env
    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      // @ts-ignore
      if (subscription) {
        // @ts-ignore
        subscription?.remove();
      } else {
        AppState.removeEventListener('change', onChange);
      }
    };
  }, [dispatch, onChange, preconditon]);

  useEffect(() => {
    if (platformEnv.isNative || !preconditon) {
      return;
    }
    const idleDuration = Math.floor((Date.now() - lastActivity) / (1000 * 60));
    const isStale = idleDuration >= appLockDuration;
    if (isStale) {
      dispatch(lock());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!preconditon) {
    return <Dashboard />;
  }
  return isUnlock && isDataUnlock ? <Dashboard /> : <Unlock />;
};

function WrappedMainScreen() {
  return (
    <Box ref={setMainScreenDom} w="full" h="full">
      <MainScreen />
    </Box>
  );
}

export default WrappedMainScreen;
