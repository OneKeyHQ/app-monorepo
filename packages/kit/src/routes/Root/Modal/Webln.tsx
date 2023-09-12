import { useIsVerticalLayout } from '@onekeyhq/components';

import { WeblnModalRoutes } from '../../../views/LightningNetwork/Webln/types';
import MakeInvoice from '../../../views/LightningNetwork/Webln/WeblnMakeInvoice';
import VerifyMessage from '../../../views/LightningNetwork/Webln/WeblnVerifyMessage';

import createStackNavigator from './createStackNavigator';

import type { WeblnRoutesParams } from '../../../views/LightningNetwork/Webln/types';

const WeblnNavigator = createStackNavigator<WeblnRoutesParams>();

const modalRoutes = [
  {
    name: WeblnModalRoutes.MakeInvoice,
    component: MakeInvoice,
  },
  {
    name: WeblnModalRoutes.VerifyMessage,
    component: VerifyMessage,
  },
];

const WeblnModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <WeblnNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <WeblnNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </WeblnNavigator.Navigator>
  );
};

export default WeblnModalStack;
export type { WeblnRoutesParams };
