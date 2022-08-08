import React, { useMemo } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PortalElementsContainer } from '../../../routes/PortalElementsContainer';
import ConnectHardware from '../../CreateWallet/HardwareWallet/ConnectHardware';
import ConnectWallet from '../screens/ConnectWallet';
import BehindTheScene from '../screens/CreateWallet/BehindTheScene';
import RecoveryPhrase from '../screens/CreateWallet/RecoveryPhrase';
import SetPassword from '../screens/CreateWallet/SetPassword';
import ShowRecoveryPhrase from '../screens/CreateWallet/ShowRecoveryPhrase';
import ImportWallet from '../screens/ImportWallet';
import Welcome from '../screens/Welcome';

import { EOnboardingRoutes } from './enums';
import { IOnboardingRoutesParams } from './types';

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
    name: EOnboardingRoutes.ImportWallet,
    component: ImportWallet,
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
];

export const StackNavigator =
  createNativeStackNavigator<IOnboardingRoutesParams>();

export function RouteOnboarding() {
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

  return (
    <>
      {/* <OnboardingContextProvider> should wrap to each <Layout /> */}
      <StackNavigator.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <StackNavigator.Group>{stackScreens}</StackNavigator.Group>
      </StackNavigator.Navigator>
      <PortalElementsContainer />
    </>
  );
}
