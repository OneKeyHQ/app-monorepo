import React, { memo } from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useThemeValue } from '@onekeyhq/components';

import WebviewScreen from '../../views/Webview';
import WelcomeScreen from '../../views/Welcome';

import { OnboardingStackRoutes, StackRoutesParams } from './types';

const ModalStack = createStackNavigator<StackRoutesParams>();

const StackNavigator = () => {
  const [bgColor, textColor, borderBottomColor] = useThemeValue([
    'surface-subdued',
    'text-default',
    'border-subdued',
  ]);
  return (
    <ModalStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ModalStack.Group>
        <ModalStack.Screen
          name={OnboardingStackRoutes.Welcome}
          component={WelcomeScreen}
        />
      </ModalStack.Group>
      <ModalStack.Group
        screenOptions={{
          headerShown: true,
          headerBackTitleVisible: false,
          headerBackTitle: '',
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: bgColor,
            borderBottomColor,
            shadowColor: borderBottomColor,
          },
          headerTintColor: textColor,
        }}
      >
        <ModalStack.Screen
          name={OnboardingStackRoutes.Webview}
          component={WebviewScreen}
        />
      </ModalStack.Group>
    </ModalStack.Navigator>
  );
};

export default memo(StackNavigator);
