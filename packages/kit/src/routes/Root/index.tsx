import React, { memo } from 'react';

import {
  TransitionPresets,
  createStackNavigator,
} from '@react-navigation/stack';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { useStatus } from '../../hooks/redux';
import Welcome from '../../views/Welcome';
import ModalStackNavigator from '../Modal';
import StackScreen from '../Stack';
import { RootRoutes } from '../types';

const RootStack = createStackNavigator();

const App = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();

  if (Platform.OS === 'ios') {
    KeyboardManager.setEnable(true);
    KeyboardManager.setEnableDebugging(false);
    KeyboardManager.setKeyboardDistanceFromTextField(10);
    KeyboardManager.setLayoutIfNeededOnUpdate(true);
    KeyboardManager.setEnableAutoToolbar(true);
    KeyboardManager.setToolbarDoneBarButtonItemText(
      intl.formatMessage({ id: 'action__done' }),
    );
    KeyboardManager.setToolbarPreviousNextButtonEnable(false);
    KeyboardManager.setKeyboardAppearance('default');
    KeyboardManager.setShouldPlayInputClicks(true);
  }

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
  return boardingCompleted ? <App /> : <Welcome />;
};

export default memo(RootStackNavigator);
