import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { AddCustomToken } from '@onekeyhq/kit/src/views/ManageTokens/AddCustomToken';
import { AddToken } from '@onekeyhq/kit/src/views/ManageTokens/AddToken';
import { ListTokens } from '@onekeyhq/kit/src/views/ManageTokens/ListTokens';
import {
  ManageTokenModalRoutes,
  ManageTokenRoutesParams,
} from '@onekeyhq/kit/src/views/ManageTokens/types';

const ManageTokenNavigator = createStackNavigator<ManageTokenRoutesParams>();

const modalRoutes = [
  {
    name: ManageTokenModalRoutes.ListTokensModal,
    component: ListTokens,
  },
  {
    name: ManageTokenModalRoutes.AddTokenModal,
    component: AddToken,
  },
  {
    name: ManageTokenModalRoutes.AddCustomTokenModal,
    component: AddCustomToken,
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
export { ManageTokenModalRoutes };
export type { ManageTokenRoutesParams };
