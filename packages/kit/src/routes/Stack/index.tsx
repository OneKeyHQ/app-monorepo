import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

import { Box, useThemeValue } from '@onekeyhq/components';
import { setMainScreenDom } from '@onekeyhq/components/src/utils/SelectAutoHide';
import Debug from '@onekeyhq/kit/src/views/Debug';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { Discover } from '@onekeyhq/kit/src/views/Discover/Home';
import FaceID from '@onekeyhq/kit/src/views/FaceID';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import TransactionHistory from '@onekeyhq/kit/src/views/TransactionHistory';
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
    name: HomeRoutes.DebugScreen,
    component: Debug,
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

function MainScreen() {
  return (
    <Box ref={setMainScreenDom} w="full" h="full">
      <Dashboard />
    </Box>
  );
}

export default MainScreen;
