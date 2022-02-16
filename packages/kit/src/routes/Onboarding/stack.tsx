/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo } from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';

import WelcomeScreen from '../../views/Onboarding/Welcome';

import { OnboardingStackRoutes } from './types';

export type ModalRoutesParams = {
  [OnboardingStackRoutes.Welcome]: undefined;
};
const ModalStack = createStackNavigator<ModalRoutesParams>();

const OnboardingStackRoutesList = [
  { name: OnboardingStackRoutes.Welcome, component: WelcomeScreen },
];

const StackNavigator = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ModalStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {OnboardingStackRoutesList.map((stack) => (
        <ModalStack.Screen
          key={stack.name}
          name={stack.name}
          component={stack.component}
        />
      ))}
    </ModalStack.Navigator>
  );
};

export default memo(StackNavigator);
