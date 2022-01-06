import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { NetworkAddView } from '@onekeyhq/kit/src/views/ManageNetworks/NetworkAddView';
import { NetworkCustomView } from '@onekeyhq/kit/src/views/ManageNetworks/NetworkCustomView';
import { NetworkListView } from '@onekeyhq/kit/src/views/ManageNetworks/NetworkListView';
import {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '@onekeyhq/kit/src/views/ManageNetworks/types';

const ManageNetworkNavigator =
  createStackNavigator<ManageNetworkRoutesParams>();

const modalRoutes = [
  {
    name: ManageNetworkModalRoutes.NetworkListViewModal,
    component: NetworkListView,
  },
  {
    name: ManageNetworkModalRoutes.NetworkAddViewModal,
    component: NetworkAddView,
  },
  {
    name: ManageNetworkModalRoutes.NetworkCustomViewModal,
    component: NetworkCustomView,
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
export { ManageNetworkModalRoutes };
export type { ManageNetworkRoutesParams };
