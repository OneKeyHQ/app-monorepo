import React from 'react';

import {
  TransitionPresets,
  createStackNavigator,
} from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';

import useAutoRedirectToRoute from './hooks/useAutoRedirectToRoute';
import modalConfigList from './routes/Modal';
import { OthersRoutes } from './routes/Others';
import StackScreens, { StackRoutes } from './routes/Stack';
import Splash from './views/Splash';
import Unlock from './views/Unlock';

const ModalStack = createStackNavigator();

const ModalStackNavigator = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ModalStack.Navigator
      initialRouteName={OthersRoutes.Splash}
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
        <ModalStack.Screen name={OthersRoutes.Unlock} component={Unlock} />
        <ModalStack.Screen name={OthersRoutes.Splash} component={Splash} />
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
