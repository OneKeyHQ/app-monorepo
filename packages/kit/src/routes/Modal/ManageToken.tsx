import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import {
  AddToken,
  CustomToken,
  Listing,
  VerifiedToken,
  ViewTokenModal,
} from '../../views/ManageTokens';
import ActivateTokenAuthModal from '../../views/ManageTokens/ActivateTokenAuthModal';
import {
  ManageTokenRoutes,
  ManageTokenRoutesParams,
} from '../../views/ManageTokens/types';
import { PriceAlertAddModal } from '../../views/PushNotification/PriceAlertAddModal';
import { PriceAlertListModal } from '../../views/PushNotification/PriceAlertListModal';

import createStackNavigator from './createStackNavigator';

const ManageTokenNavigator = createStackNavigator<ManageTokenRoutesParams>();

const modalRoutes = [
  {
    name: ManageTokenRoutes.Listing,
    component: Listing,
  },
  {
    name: ManageTokenRoutes.AddToken,
    component: AddToken,
  },
  {
    name: ManageTokenRoutes.ActivateToken,
    component: ActivateTokenAuthModal,
  },
  {
    name: ManageTokenRoutes.ViewToken,
    component: ViewTokenModal,
  },
  {
    name: ManageTokenRoutes.CustomToken,
    component: CustomToken,
  },
  {
    name: ManageTokenRoutes.VerifiedToken,
    component: VerifiedToken,
  },
  {
    name: ManageTokenRoutes.PriceAlertList,
    component: PriceAlertListModal,
  },
  {
    name: ManageTokenRoutes.PriceAlertAdd,
    component: PriceAlertAddModal,
  },
];

const ManageTokenModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManageTokenNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ManageTokenNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManageTokenNavigator.Navigator>
  );
};

export default ManageTokenModalStack;
export { ManageTokenRoutes };
export type { ManageTokenRoutesParams };
