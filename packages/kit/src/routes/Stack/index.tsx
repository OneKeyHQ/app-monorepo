import React, { useEffect, useMemo } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

import { Box, useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import { setMainScreenDom } from '@onekeyhq/components/src/utils/SelectAutoHide';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  available,
  enable,
} from '@onekeyhq/kit/src/store/reducers/autoUpdater';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { Discover } from '@onekeyhq/kit/src/views/Discover/Home';
import FaceID from '@onekeyhq/kit/src/views/FaceID';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import TransactionHistory from '@onekeyhq/kit/src/views/TransactionHistory';
import UpdateAlert from '@onekeyhq/kit/src/views/Update/Alert';
import Webview from '@onekeyhq/kit/src/views/Webview';

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
  {
    name: HomeRoutes.FaceId,
    component: FaceID,
  },
];

export const StackNavigator = createNativeStackNavigator<HomeRoutesParams>();

const Dashboard = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const [bgColor, textColor, borderBottomColor] = useThemeValue([
    'background-default',
    'text-default',
    'border-subdued',
  ]);

  const stackScreens = useMemo(() => {
    if (!isVerticalLayout) {
      return null;
    }

    return stackScreenList.map((stack) => (
      <StackNavigator.Screen
        key={stack.name}
        name={stack.name}
        component={stack.component}
      />
    ));
  }, [isVerticalLayout]);

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
            borderBottomWidth: 0,
            shadowColor: borderBottomColor,
          },
          header:
            Platform.OS === 'ios' ? renderCustomSubStackHeader : undefined,
          headerTintColor: textColor,
        }}
      >
        {stackScreens}
      </StackNavigator.Group>
    </StackNavigator.Navigator>
  );
};

function MainScreen() {
  const { dispatch } = backgroundApiProxy;

  const autoCheckUpdate = () => {
    appUpdates
      .checkAppUpdate()
      .then((versionInfo) => {
        if (versionInfo) {
          dispatch(enable());
          dispatch(available(versionInfo));
        }
      })
      .catch(() => {
        // TODO sentry collect error
      });
  };

  useEffect(() => {
    autoCheckUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box ref={setMainScreenDom} w="full" h="full">
      <Dashboard />

      {/* TODO Waiting notification component */}
      <UpdateAlert />
    </Box>
  );
}

export default MainScreen;
