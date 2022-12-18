import type { FC } from 'react';
import { memo, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
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
import { AppLock } from '@onekeyhq/kit/src/components/AppLock';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { updateVersionAndBuildNumber } from '@onekeyhq/kit/src/store/reducers/settings';
import { setAuthenticationType } from '@onekeyhq/kit/src/store/reducers/status';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { createLazyComponent } from '../../utils/createLazyComponent';
import { buildModalOpenAnimationOptions } from '../Modal/buildModalStackNavigatorOptions';
import { UpdateFeatureModalRoutes } from '../Modal/UpdateFeature';
import { ModalRoutes, RootRoutes } from '../types';

import type { UpdateFeatureRoutesParams } from '../Modal/UpdateFeature';
import type { ModalScreenProps } from '../types';

const ModalStackNavigator = createLazyComponent(() => import('../Modal'));
const OnLanding = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/OnLanding'),
);
const StackScreen = createLazyComponent(() => import('../Stack'));
const AccountRootLanding = createLazyComponent(
  () => import('./AccountRootLanding'),
);
const RouteOnboarding = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Onboarding/routes/RouteOnboarding'),
);

const RootNativeStack = createNativeStackNavigator();
const RootStack = createStackNavigator();

const RootNavigatorContainer: FC = ({ children }) => {
  const isVerticalLayout = useIsVerticalLayout();
  // const boardingCompleted = useAppSelector((s) => s.status.boardingCompleted);
  // const initialRouteName = boardingCompleted
  //   ? RootRoutes.Root
  //   : RootRoutes.Onboarding;
  const initialRouteName = RootRoutes.Root;
  if (platformEnv.isNative) {
    return (
      <RootNativeStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          presentation: platformEnv.isNativeAndroid
            ? 'transparentModal'
            : 'modal',
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
          ? TransitionPresets.ScaleFromCenterAndroid
          : TransitionPresets.FadeFromBottomAndroid),
      }}
    >
      {children}
    </RootStack.Navigator>
  );
};

const App = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
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
      <RootStack.Screen
        name={RootRoutes.Account}
        component={AccountRootLanding}
      />
      <RootStack.Screen
        name={RootRoutes.Onboarding}
        component={RouteOnboarding}
        /*
        presentation issues:
        - containedModal: cannot close new opened Modal
        - card: cannot prevent gesture back (iOS)
        - fullScreenModal: cannot use OverlayContainer some cases
         */
        options={{
          // node_modules/@react-navigation/native-stack/src/types.tsx
          // @ts-expect-error
          presentation: 'fullScreenModal', // containedModal card fullScreenModal
          animation: 'fade',
        }}
      />
      <RootStack.Screen name={RootRoutes.OnLanding} component={OnLanding} />
      <RootStack.Screen
        name={RootRoutes.OnLandingWalletConnect}
        component={OnLanding}
      />
      <RootStack.Screen
        options={{
          ...buildModalOpenAnimationOptions({ isVerticalLayout }),
        }}
        name={RootRoutes.Modal}
        component={ModalStackNavigator}
      />
    </RootNavigatorContainer>
  );
};

type NavigationProps = ModalScreenProps<UpdateFeatureRoutesParams>;

const RootStackNavigator = () => {
  const { version, buildNumber } = useSettings();
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps['navigation']>();

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
    if (hasVersionSet && versionChanged && process.env.VERSION) {
      const newVersion = process.env.VERSION;
      if (!platformEnv.isWeb) {
        appUpdates.getChangeLog(version, newVersion).then((changeLog) => {
          if (!changeLog) return; // no change log
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.UpdateFeature,
            params: {
              screen: UpdateFeatureModalRoutes.UpdateFeatureModal,
              params: {
                changeLog,
                newVersion,
              },
            },
          });
        });
      }

      dispatch(
        updateVersionAndBuildNumber({
          version: newVersion,
          buildNumber: process.env.BUILD_NUMBER,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
