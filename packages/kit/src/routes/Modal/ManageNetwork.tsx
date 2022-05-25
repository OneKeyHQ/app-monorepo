import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { AddNetwork } from '@onekeyhq/kit/src/views/ManageNetworks/AddNetwork';
import { CustomNetwork } from '@onekeyhq/kit/src/views/ManageNetworks/CustomNetwork';
import { Listing } from '@onekeyhq/kit/src/views/ManageNetworks/Listing';
import { PresetNetwork } from '@onekeyhq/kit/src/views/ManageNetworks/PresetNetwork';
import {
  ManageNetworkRoutes,
  ManageNetworkRoutesParams,
} from '@onekeyhq/kit/src/views/ManageNetworks/types';

import { AddNetworkConfirm } from '../../views/ManageNetworks/AddNetwork/AddNetworkConfirm';

import createStackNavigator from './createStackNavigator';

const ManageNetworkNavigator =
  createStackNavigator<ManageNetworkRoutesParams>();

const modalRoutes = [
  {
    name: ManageNetworkRoutes.Listing,
    component: Listing,
  },
  {
    name: ManageNetworkRoutes.AddNetwork,
    component: AddNetwork,
  },
  {
    name: ManageNetworkRoutes.CustomNetwork,
    component: CustomNetwork,
  },
  {
    name: ManageNetworkRoutes.PresetNetwork,
    component: PresetNetwork,
  },
  {
    name: ManageNetworkRoutes.AddNetworkConfirm,
    component: AddNetworkConfirm,
  },
];

const ManageNetworkModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManageNetworkNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ManageNetworkNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManageNetworkNavigator.Navigator>
  );
};

export default ManageNetworkModalStack;
export { ManageNetworkRoutes };
export type { ManageNetworkRoutesParams };
