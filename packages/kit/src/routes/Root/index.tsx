import React, { memo, useEffect } from 'react';

import {
  TransitionPresets,
  createStackNavigator,
} from '@react-navigation/stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useStatus } from '../../hooks/redux';
import { setSupportFaceId } from '../../store/reducers/status';
import ModalStackNavigator from '../Modal';
import OnboardingScreen from '../Onboarding';
import StackScreen from '../Stack';
import { RootRoutes } from '../types';

const RootStack = createStackNavigator();

const App = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;

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

  useEffect(() => {
    if (['ios', 'android'].includes(Platform.OS)) {
      LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => {
        if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          ) ||
          types.includes(LocalAuthentication.AuthenticationType.IRIS)
        ) {
          dispatch(setSupportFaceId());
        }
      });
    }
  }, [dispatch]);

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
