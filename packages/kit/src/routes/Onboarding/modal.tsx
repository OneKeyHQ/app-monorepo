/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo } from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import SetPassword from '../../views/Onboarding/SetPassword';
import TermsScreen from '../../views/Onboarding/Terms';

import { ModalRoutesParams, OnboardingModalRoutes } from './types';

const ModalStack = createStackNavigator<ModalRoutesParams>();

const OnboardingModalRoutesList = [
  { name: OnboardingModalRoutes.Terms, component: TermsScreen },
  { name: OnboardingModalRoutes.SetPassword, component: SetPassword },
];

const ModalNavigator = () => (
  <ModalStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    {OnboardingModalRoutesList.map((modal) => (
      <ModalStack.Screen
        key={modal.name}
        name={modal.name}
        component={modal.component}
      />
    ))}
  </ModalStack.Navigator>
);

export default memo(ModalNavigator);
