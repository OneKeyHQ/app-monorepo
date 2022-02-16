import React from 'react';

import {
  TransitionPresets,
  createStackNavigator,
} from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';

import ModalScreen from './modal';
import StackScreen from './stack';
import {
  OnboardingModalRoutes,
  OnboardingRoutes,
  OnboardingRoutesParams,
} from './types';

const OnboardingNavigator = createStackNavigator();

const OnboardingScreen = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <OnboardingNavigator.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
        ...(isVerticalLayout
          ? TransitionPresets.ModalPresentationIOS
          : TransitionPresets.ModalFadeTransition),
      }}
    >
      <OnboardingNavigator.Screen
        name={OnboardingRoutes.Stack}
        component={StackScreen}
      />
      <OnboardingNavigator.Screen
        name={OnboardingRoutes.Modal}
        component={ModalScreen}
      />
    </OnboardingNavigator.Navigator>
  );
};

export default OnboardingScreen;
export { OnboardingRoutes, OnboardingModalRoutes };
export type { OnboardingRoutesParams };
