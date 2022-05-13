import React, { useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

import { Box, useThemeValue } from '@onekeyhq/components';
import { setMainScreenDom } from '@onekeyhq/components/src/utils/SelectAutoHide';
import { useCheckVersion, useDevSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  UpdateFeatureModalRoutes,
  UpdateFeatureRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/UpdateFeature';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import {
  addUsedVersionHistory,
  newFeatureAlert,
  setCurrentVersionFeature,
  setUpdateActivationHint,
} from '@onekeyhq/kit/src/store/reducers/checkVersion';
import Debug from '@onekeyhq/kit/src/views/Debug';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { Discover } from '@onekeyhq/kit/src/views/Discover/Home';
import FaceID from '@onekeyhq/kit/src/views/FaceID';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import TransactionHistory from '@onekeyhq/kit/src/views/TransactionHistory';
import Webview from '@onekeyhq/kit/src/views/Webview';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import appUpdates from '../../utils/updates/AppUpdates';
import { VersionInfo } from '../../utils/updates/type';
import UpdateAlert from '../../views/Update/Alert';
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
    <>
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

      {/* TODO Waiting notification component */}
      <UpdateAlert />
    </>
  );
};

type NavigationProps = ModalScreenProps<UpdateFeatureRoutesParams>;

function MainScreen() {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { dispatch } = backgroundApiProxy;
  const version = useCheckVersion();
  const devSettings = useDevSettings();

  const autoCheckUpdate = () => {
    let appUpdatePromise: Promise<VersionInfo | undefined> | undefined;
    if (devSettings.debugMode && devSettings.testVersionUpdate) {
      appUpdatePromise = appUpdates.debugCheckAppUpdate();
    } else {
      appUpdatePromise = appUpdates.checkAppUpdate();
    }

    appUpdatePromise
      .then((versionInfo) => {
        if (versionInfo) {
          dispatch(setCurrentVersionFeature(versionInfo));
          dispatch(setUpdateActivationHint(true));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const currentVersion = process.env.VERSION ?? '';

    // Record the versions used
    dispatch(addUsedVersionHistory(currentVersion));

    if (
      !platformEnv.isBrowser &&
      // App should not be used for the first time
      version.usedVersionHistory.length > 1 &&
      // The latest version is not used
      !version.usedVersionHistory[0]?.reminded
    ) {
      dispatch(newFeatureAlert());
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.UpdateFeature,
        params: {
          screen: UpdateFeatureModalRoutes.UpdateFeatureModal,
        },
      });
    }

    autoCheckUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box ref={setMainScreenDom} w="full" h="full">
      <Dashboard />
      <UpdateAlert />
    </Box>
  );
}

export default MainScreen;
