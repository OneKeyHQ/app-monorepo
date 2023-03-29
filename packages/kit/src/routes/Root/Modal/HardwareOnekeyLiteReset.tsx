import { useIsVerticalLayout } from '@onekeyhq/components';

import OnekeyLiteReset from '../../../views/Hardware/OnekeyLite/Reset';
import { OnekeyLiteResetModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

import type {
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from '../../../views/Hardware/OnekeyLite/routes';

export type OnekeyLiteResetRoutesParams = {
  [OnekeyLiteResetModalRoutes.OnekeyLiteResetModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteResetModal];
};

const OnekeyLiteResetNavigator =
  createStackNavigator<OnekeyLiteResetRoutesParams>();

const modalRoutes = [
  {
    name: OnekeyLiteResetModalRoutes.OnekeyLiteResetModal,
    component: OnekeyLiteReset,
  },
];

const OnekeyLiteResetModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <OnekeyLiteResetNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <OnekeyLiteResetNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </OnekeyLiteResetNavigator.Navigator>
  );
};

export default OnekeyLiteResetModalStack;
