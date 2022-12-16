import { useIsVerticalLayout } from '@onekeyhq/components';
import { SubmitRequest } from '@onekeyhq/kit/src/views/Help/Request/SubmitRequest';

import createStackNavigator from './createStackNavigator';

export enum SubmitRequestRoutes {
  SubmitRequestModal = 'SubmitRequestModal',
}

export type SubmitRequestModalRoutesParams = {
  [SubmitRequestRoutes.SubmitRequestModal]: undefined;
};

const SubmitRequestNavigator =
  createStackNavigator<SubmitRequestModalRoutesParams>();

const modalRoutes = [
  {
    name: SubmitRequestRoutes.SubmitRequestModal,
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
