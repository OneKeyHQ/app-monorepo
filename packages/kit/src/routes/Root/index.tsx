import React, { memo } from 'react';

import {
  TransitionPresets,
  createStackNavigator,
} from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { useStatus } from '../../hooks/redux';
import ModalStackNavigator from '../Modal';
import OnboardingScreen from '../Onboarding';
import StackScreen from '../Stack';
import { RootRoutes } from '../types';

const RootStack = createStackNavigator();

const App = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
        ...(isVerticalLayout
          ? TransitionPresets.ModalPresentationIOS
          : TransitionPresets.ModalFadeTransition),
      }}
    >
      <RootStack.Screen name={RootRoutes.Root} component={StackScreen} />
      <RootStack.Screen
        name={RootRoutes.Modal}
        component={ModalStackNavigator}
      />
    </RootStack.Navigator>
  );
};

const RootStackNavigator = () => {
  const { boardingCompleted } = useStatus();
  return boardingCompleted ? <App /> : <OnboardingScreen />;
};

export default memo(RootStackNavigator);
