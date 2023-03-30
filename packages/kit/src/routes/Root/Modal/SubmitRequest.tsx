import { useIsVerticalLayout } from '@onekeyhq/components';

import { SubmitRequest } from '../../../views/Help/Request/SubmitRequest';
import { SubmitRequestModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

export type SubmitRequestModalRoutesParams = {
  [SubmitRequestModalRoutes.SubmitRequestModal]: undefined;
};

const SubmitRequestNavigator =
  createStackNavigator<SubmitRequestModalRoutesParams>();

const modalRoutes = [
  {
    name: SubmitRequestModalRoutes.SubmitRequestModal,
    component: SubmitRequest,
  },
];

const SubmitRequestModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <SubmitRequestNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <SubmitRequestNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </SubmitRequestNavigator.Navigator>
  );
};

export default SubmitRequestModalStack;
