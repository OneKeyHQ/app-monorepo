import { useEffect, useMemo } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RouteKeytag } from '@onekeyhq/kit/src/views/KeyTag/Routes/RouteKeytag';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import ConnectHardware from '../../CreateWallet/HardwareWallet/ConnectHardware';
import BTCExternalWallet from '../screens/BTCExternalWallet';
import ConnectWallet from '../screens/ConnectWallet';
import BehindTheScene from '../screens/CreateWallet/BehindTheScene';
import RecoveryPhrase from '../screens/CreateWallet/RecoveryPhrase';
import SetPassword from '../screens/CreateWallet/SetPassword';
import ShowRecoveryPhrase from '../screens/CreateWallet/ShowRecoveryPhrase';
import ImportWallet from '../screens/ImportWallet';
import RecoveryWallet from '../screens/ImportWallet/RecoveryWallet';
import Migration from '../screens/Migration/ConnectServer';
import PreviewImportData from '../screens/Migration/PreviewImportData';
import BackupDetails from '../screens/RestoreFromCloud/BackupDetails';
import BackupsList from '../screens/RestoreFromCloud/BackupsList';
import ThirdPartyWallet from '../screens/ThirdPartyWallet';
import Welcome from '../screens/Welcome';

import { EOnboardingRoutes } from './enums';

import type { IOnboardingRoutesParams } from './types';

export const stackScreenList = [
  {
    name: EOnboardingRoutes.Welcome,
    component: Welcome,
  },
  {
    name: EOnboardingRoutes.ConnectWallet,
    component: ConnectWallet,
  },
  {
    name: EOnboardingRoutes.ConnectHardwareModal,
    component: ConnectHardware,
  },
  {
    name: EOnboardingRoutes.ThirdPartyWallet,
    component: ThirdPartyWallet,
  },
  {
    name: EOnboardingRoutes.BTCExternalWallet,
    component: BTCExternalWallet,
  },
  {
    name: EOnboardingRoutes.ImportWallet,
    component: ImportWallet,
  },
  {
    name: EOnboardingRoutes.RecoveryWallet,
    component: RecoveryWallet,
  },
  {
    name: EOnboardingRoutes.SetPassword,
    component: SetPassword,
  },
  {
    name: EOnboardingRoutes.RecoveryPhrase,
    component: RecoveryPhrase,
  },
  {
    name: EOnboardingRoutes.ShowRecoveryPhrase,
    component: ShowRecoveryPhrase,
  },
  {
    name: EOnboardingRoutes.BehindTheScene,
    component: BehindTheScene,
  },
  {
    name: EOnboardingRoutes.RestoreFromCloud,
    component: BackupsList,
  },
  {
    name: EOnboardingRoutes.CloudBackupDetails,
    component: BackupDetails,
  },
  {
    name: EOnboardingRoutes.KeyTag,
    component: RouteKeytag,
  },
  {
    name: EOnboardingRoutes.Migration,
    component: Migration,
  },
  {
    name: EOnboardingRoutes.MigrationPreview,
    component: PreviewImportData,
  },
];

export const StackNavigator =
  createNativeStackNavigator<IOnboardingRoutesParams>();

export default function RouteOnboarding() {
  const stackScreens = useMemo(
    () =>
      stackScreenList.map((stack) => (
        <StackNavigator.Screen
          key={stack.name}
          name={stack.name}
          component={stack.component}
        />
      )),
    [],
  );

  useEffect(() => {
    backgroundApiProxy.serviceOnboarding.checkOnboardingStatus();
    return () => {
      backgroundApiProxy.serviceOnboarding.checkOnboardingStatus();
    };
  }, []);

  return (
    <StackNavigator.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <StackNavigator.Group>{stackScreens}</StackNavigator.Group>
    </StackNavigator.Navigator>
  );
}
