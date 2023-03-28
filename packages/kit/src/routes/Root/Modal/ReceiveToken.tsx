import { useIsVerticalLayout } from '@onekeyhq/components';

import ReceiveToken from '../../../views/ReceiveToken';
import { ReceiveTokenModalRoutes } from '../../../views/ReceiveToken/types';

import createStackNavigator from './createStackNavigator';

import type { ReceiveTokenRoutesParams } from '../../../views/ReceiveToken/types';

const ReceiveTokenNavigator = createStackNavigator<ReceiveTokenRoutesParams>();

const modalRoutes = [
  {
    name: ReceiveTokenModalRoutes.ReceiveToken,
    component: ReceiveToken,
  },
];

const ReceiveTokenModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ReceiveTokenNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ReceiveTokenNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ReceiveTokenNavigator.Navigator>
  );
};

export default ReceiveTokenModalStack;
export type { ReceiveTokenRoutesParams };
