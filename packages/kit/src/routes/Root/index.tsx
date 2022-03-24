import React, { FC, memo, useEffect } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  TransitionPresets,
  createStackNavigator,
} from '@react-navigation/stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import { useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useStatus } from '../../hooks/redux';
import { setSupportFaceId } from '../../store/reducers/status';
import ModalStackNavigator from '../Modal';
import OnboardingScreen from '../Onboarding';
import StackScreen from '../Stack';
import { RootRoutes } from '../types';

const RootNativeStack = createNativeStackNavigator();
const RootStack = createStackNavigator();

const Container: FC = ({ children }) => {
  const isVerticalLayout = useIsVerticalLayout();
  if (platformEnv.isNative)
    return (
      <RootNativeStack.Navigator
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
        }}
      >
        {children}
      </RootNativeStack.Navigator>
    );
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
      {children}
    </RootStack.Navigator>
  );
};

const App = () => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;

  useEffect(() => {
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
  }, [intl]);

  useEffect(() => {
    if (platformEnv.isNative) {
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
    <Container>
      <RootStack.Screen name={RootRoutes.Root} component={StackScreen} />
      <RootStack.Screen
        name={RootRoutes.Modal}
        component={ModalStackNavigator}
      />
    </Container>
  );
};

const RootStackNavigator = () => {
  const { boardingCompleted } = useStatus();
  return boardingCompleted ? <App /> : <OnboardingScreen />;
};

export default memo(RootStackNavigator);
