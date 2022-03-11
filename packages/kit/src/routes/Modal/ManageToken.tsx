import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { AddToken, CustomToken, Listing } from '../../views/ManageTokens';
import {
  ManageTokenRoutes,
  ManageTokenRoutesParams,
} from '../../views/ManageTokens/types';

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
    name: ManageTokenRoutes.CustomToken,
    component: CustomToken,
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
