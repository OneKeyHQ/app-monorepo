import { useIsVerticalLayout } from '@onekeyhq/components';

import ReceiveInvoice from '../../../views/LightningNetwork/Receive';
import CreateInvoice from '../../../views/LightningNetwork/Receive/CreateInvoice';
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
  {
    name: ReceiveTokenModalRoutes.CreateInvoice,
    component: CreateInvoice,
  },
  {
    name: ReceiveTokenModalRoutes.ReceiveInvoice,
    component: ReceiveInvoice,
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
