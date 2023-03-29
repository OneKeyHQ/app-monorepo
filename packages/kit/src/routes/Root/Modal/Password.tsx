import { useIsVerticalLayout } from '@onekeyhq/components';

import { Password } from '../../../views/Password';
import { PasswordRoutes } from '../../../views/Password/types';

import createStackNavigator from './createStackNavigator';

import type { PasswordRoutesParams } from '../../../views/Password/types';

const PasswordNavigator = createStackNavigator<PasswordRoutesParams>();

const modalRoutes = [
  {
    name: PasswordRoutes.PasswordRoutes,
    component: Password,
  },
];

const PasswordModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <PasswordNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <PasswordNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </PasswordNavigator.Navigator>
  );
};

export type { PasswordRoutesParams };
export default PasswordModalStack;
