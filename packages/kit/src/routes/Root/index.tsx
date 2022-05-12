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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { updateVersionAndBuildNumber } from '@onekeyhq/kit/src/store/reducers/settings';
import { setAuthenticationType } from '@onekeyhq/kit/src/store/reducers/status';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { AppLock } from '../../components/AppLock';
import { useAppSelector } from '../../hooks/redux';
import Welcome from '../../views/Welcome';
import ModalStackNavigator from '../Modal';
import StackScreen from '../Stack';
import { RootRoutes } from '../types';

const RootNativeStack = createNativeStackNavigator();
const RootStack = createStackNavigator();

const RootNavigatorContainer: FC = ({ children }) => {
  const isVerticalLayout = useIsVerticalLayout();
  const boardingCompleted = useAppSelector((s) => s.status.boardingCompleted);
  const initialRouteName = boardingCompleted
    ? RootRoutes.Root
    : RootRoutes.Welcome;
  if (platformEnv.isNative) {
    return (
      <RootNativeStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
        }}
      >
        {children}
      </RootNativeStack.Navigator>
    );
  }

  return (
    <RootStack.Navigator
      initialRouteName={initialRouteName}
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

  return (
    <RootNavigatorContainer>
      <RootStack.Screen name={RootRoutes.Root} component={StackScreen} />
      <RootStack.Screen name={RootRoutes.Welcome} component={Welcome} />
      <RootStack.Screen
        name={RootRoutes.Modal}
        component={ModalStackNavigator}
      />
    </RootNavigatorContainer>
  );
};

const RootStackNavigator = () => {
  const { version, buildNumber } = useSettings();
  const { dispatch } = backgroundApiProxy;

  const hasVersionSet = !!process.env.VERSION && !!process.env.BUILD_NUMBER;
  const versionChanged =
    process.env.VERSION !== version || process.env.BUILD_NUMBER !== buildNumber;
  /**
   * previous version number is stored at user local redux store
   * new version number is passed by process.env.VERSION
   *
   * compare two version number, get the log diff and store new user version code here.
   */
  // settings.version -> process.env.VERSION
  useEffect(() => {
    if (hasVersionSet && versionChanged && process.env.VERSION)
      dispatch(
        updateVersionAndBuildNumber({
          version: process.env.VERSION,
          buildNumber: process.env.BUILD_NUMBER,
        }),
      );
  }, [dispatch, hasVersionSet, versionChanged]);

  useEffect(() => {
    if (platformEnv.isNative) {
      LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => {
        // OPPO phone return [1,2]
        // iphone 11 return [2]
        // The fingerprint identification is preferred (android)
        if (
          types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          dispatch(setAuthenticationType('FINGERPRINT'));
        } else if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          dispatch(setAuthenticationType('FACIAL'));
        }
      });
    }
  }, [dispatch]);

  return (
    <AppLock>
      <App />
    </AppLock>
  );
};

export default memo(RootStackNavigator);
