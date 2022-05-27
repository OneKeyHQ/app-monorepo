import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import Connection from '@onekeyhq/kit/src/views/DappModals/Connection';

import { useOnboardingFinished } from '../../hooks/useOnboardingFinished';
import {
  DappConnectionModalRoutes,
  DappConnectionRoutesParams,
} from '../../views/DappModals/types';

import createStackNavigator from './createStackNavigator';

const DappConnectionModalNavigator =
  createStackNavigator<DappConnectionRoutesParams>();

const modalRoutes = [
  {
    name: DappConnectionModalRoutes.ConnectionModal,
    component: Connection,
  },
];

const DappConnectionStack = () => {
  useOnboardingFinished();
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DappConnectionModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DappConnectionModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DappConnectionModalNavigator.Navigator>
  );
};

export default DappConnectionStack;
export { DappConnectionModalRoutes };
export type { DappConnectionRoutesParams };
