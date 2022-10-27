import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { ChangeModal } from '../../views/Revoke/ChangeModal';
import { ShareModal } from '../../views/Revoke/ShareModal';
import { RevokeRoutes, RevokeRoutesParams } from '../../views/Revoke/types';

import createStackNavigator from './createStackNavigator';

const RevokeNavigator = createStackNavigator<RevokeRoutesParams>();

const modalRoutes = [
  {
    name: RevokeRoutes.ShareModal,
    component: ShareModal,
  },
  {
    name: RevokeRoutes.ChangeAllowance,
    component: ChangeModal,
  },
];

const RevokeModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <RevokeNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <RevokeNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </RevokeNavigator.Navigator>
  );
};

export default RevokeModalStack;
export { RevokeRoutes };
export type { RevokeRoutesParams };
