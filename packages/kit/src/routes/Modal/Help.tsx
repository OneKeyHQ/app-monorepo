import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { SubmitRequest } from '@onekeyhq/kit/src/views/Help/SubmitRequest';
import {
  HelpModalRoutes,
  HelpModalRoutesParams,
} from '@onekeyhq/kit/src/views/Help/types';

const HelpNavigator = createStackNavigator<HelpModalRoutesParams>();

const modalRoutes = [
  {
    name: HelpModalRoutes.SubmitRequestModal,
    component: SubmitRequest,
  },
];

const HelpModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <HelpNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <HelpNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </HelpNavigator.Navigator>
  );
};

export default HelpModalStack;
export { HelpModalRoutes };
export type { HelpModalRoutesParams };
