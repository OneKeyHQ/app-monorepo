import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ManageTokens from '@onekeyhq/kit/src/views/ManageTokens';

export enum ManageTokenModalRoutes {
  ManageTokensModal = 'ManageTokensModal',
}

export type ManageTokenRoutesParams = {
  [ManageTokenModalRoutes.ManageTokensModal]: undefined;
};

const ManageTokenNavigator = createStackNavigator<ManageTokenRoutesParams>();

const modalRoutes = [
  {
    name: ManageTokenModalRoutes.ManageTokensModal,
    component: ManageTokens,
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
