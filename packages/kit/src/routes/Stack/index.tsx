import React, { useEffect, useMemo } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { RootSiblingParent } from 'react-native-root-siblings';

import { Box, useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import { setMainScreenDom } from '@onekeyhq/components/src/utils/SelectAutoHide';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  available,
  enable,
} from '@onekeyhq/kit/src/store/reducers/autoUpdater';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import AddressBook from '@onekeyhq/kit/src/views/AddressBook/Listing';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { Discover } from '@onekeyhq/kit/src/views/Discover/Home';
import FullTokenList from '@onekeyhq/kit/src/views/FullTokenList/FullTokenList';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import VolumeHaptic from '@onekeyhq/kit/src/views/Me/GenaralSection/VolumeHaptic';
import CloudBackup from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup';
import CloudBackupDetails from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/BackupDetails';
import CloudBackupPreviousBackups from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/PreviousBackups';
import Protected from '@onekeyhq/kit/src/views/Protected';
import PushNotification from '@onekeyhq/kit/src/views/PushNotification';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import TransactionHistory from '@onekeyhq/kit/src/views/TransactionHistory';
import UpdateAlert from '@onekeyhq/kit/src/views/Update/Alert';
import Webview from '@onekeyhq/kit/src/views/Webview';

import { RouteOnboarding } from '../../views/Onboarding/routes/RouteOnboarding';
import SwapHistory from '../../views/Swap/History';
import Dev from '../Dev';
import Drawer from '../Drawer';
import { HomeRoutes, HomeRoutesParams } from '../types';

import renderCustomSubStackHeader from './Header';

export const stackScreenList = [
  {
    name: HomeRoutes.FullTokenListScreen,
    component: FullTokenList,
  },
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
    name: HomeRoutes.Protected,
    component: Protected,
  },
  {
    name: HomeRoutes.AddressBook,
    component: AddressBook,
  },
  {
    name: HomeRoutes.SwapHistory,
    component: SwapHistory,
  },
  {
    name: HomeRoutes.VolumeHaptic,
    component: VolumeHaptic,
  },
  {
    name: HomeRoutes.CloudBackup,
    component: CloudBackup,
  },
  {
    name: HomeRoutes.CloudBackupPreviousBackups,
    component: CloudBackupPreviousBackups,
  },
  {
    name: HomeRoutes.CloudBackupDetails,
    component: CloudBackupDetails,
  },
  {
    name: HomeRoutes.PushNotification,
    component: PushNotification,
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

    return stackScreenList.map(({ name, component: Component }) => (
      <StackNavigator.Screen key={name} name={name}>
        {(props) => (
          <RootSiblingParent>
            {/* @ts-ignore */}
            <Component {...props} />
          </RootSiblingParent>
        )}
      </StackNavigator.Screen>
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
        <StackNavigator.Screen
          name={HomeRoutes.HomeOnboarding}
          component={RouteOnboarding}
        />
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
