import React, { memo } from 'react';

import {
  TransitionPresets,
  createStackNavigator,
} from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';

import ModalStackNavigator from '../Modal';
import StackScreen from '../Stack';
import { RootRoutes } from '../types';

const RootStack = createStackNavigator();

const RootStackNavigator = () => {
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

export default memo(RootStackNavigator);
