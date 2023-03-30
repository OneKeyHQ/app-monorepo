import { useIsVerticalLayout } from '@onekeyhq/components';

import { TokenSelector } from '../../../views/BulkSender/TokenSelector';
import { BulkSenderRoutes } from '../../../views/BulkSender/types';

import createStackNavigator from './createStackNavigator';

import type { BulkSenderRoutesParams } from '../../../views/BulkSender/types';

const BulkSenderNavigator = createStackNavigator<BulkSenderRoutesParams>();

const modalRoutes = [
  {
    name: BulkSenderRoutes.TokenSelector,
    component: TokenSelector,
  },
];

const BulkSenderModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <BulkSenderNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <BulkSenderNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </BulkSenderNavigator.Navigator>
  );
};

export default BulkSenderModalStack;
export type { BulkSenderRoutesParams };
