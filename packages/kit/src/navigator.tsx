import React from 'react';

import {
  TransitionPresets,
  createStackNavigator,
} from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';

import useAutoRedirectToRoute from './hooks/useAutoRedirectToRoute';
import modalConfigList from './routes/Modal';
import { OthersRoutesScreen } from './routes/Others';
import { OthersRoutes } from './routes/Others/enum';
import StackScreens, { StackRoutes } from './routes/Stack';

const ModalStack = createStackNavigator();

const ModalStackNavigator = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ModalStack.Navigator
      initialRouteName={OthersRoutes.Unlock}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        presentation: 'transparentModal',
        ...(isVerticalLayout
          ? TransitionPresets.ModalPresentationIOS
          : TransitionPresets.ModalFadeTransition),
      }}
    >
      <ModalStack.Group
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          presentation: 'transparentModal',
          ...TransitionPresets.ModalFadeTransition,
        }}
      >
        {OthersRoutesScreen.map((config) => (
          <ModalStack.Screen
            key={config.name}
            name={config.name}
            component={config.component}
          />
        ))}
      </ModalStack.Group>
      <ModalStack.Screen name={StackRoutes.Home} component={StackScreens} />
      {modalConfigList.map((modal) => (
        <ModalStack.Screen
          key={modal.name}
          name={modal.name}
          component={modal.component}
        />
      ))}
    </ModalStack.Navigator>
  );
};

const Navigator = () => {
  useAutoRedirectToRoute();
  return <ModalStackNavigator />;
};

export default Navigator;
