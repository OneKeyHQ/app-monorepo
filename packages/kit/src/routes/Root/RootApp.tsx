import type { FC } from 'react';
import { useEffect, useMemo } from 'react';

import { TransitionPresets } from '@react-navigation/stack';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import { useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { createLazyComponent } from '../../utils/createLazyComponent';
import { RootRoutes } from '../routesEnum';

import { buildModalOpenAnimationOptions } from './Modal/buildModalStackNavigatorOptions';
import createStackNavigator from './Modal/createStackNavigator';

const ModalStackNavigator = createLazyComponent(() => import('./Modal'));
const OnLanding = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/OnLanding'),
);
const Main = createLazyComponent(() => import('./Main/index'));
const AccountRootLanding = createLazyComponent(
  () => import('./AccountRootLanding'),
);
const RouteOnboarding = createLazyComponent(
  () => import('@onekeyhq/kit/src/views/Onboarding/routes/RouteOnboarding'),
);

const RootStack = createStackNavigator();

const RootNavigatorContainer: FC = ({ children }) => {
  const isVerticalLayout = useIsVerticalLayout();
  // const boardingCompleted = useAppSelector((s) => s.status.boardingCompleted);
  // const initialRouteName = boardingCompleted
  //   ? RootRoutes.Root
  //   : RootRoutes.Onboarding;
  const initialRouteName = RootRoutes.Main;
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      ...(isVerticalLayout
        ? TransitionPresets.ScaleFromCenterAndroid
        : TransitionPresets.FadeFromBottomAndroid),
    }),
    [isVerticalLayout],
  );

  return (
    <RootStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={screenOptions}
    >
      {children}
    </RootStack.Navigator>
  );
};

export const RootApp = () => {
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

  const modalScreenOptions = useMemo(
    () => ({
      presentation: platformEnv.isNative
        ? ('modal' as const)
        : ('transparentModal' as const),
      ...buildModalOpenAnimationOptions({ isVerticalLayout }),
    }),
    [isVerticalLayout],
  );

  return (
    <RootNavigatorContainer>
      <RootStack.Screen name={RootRoutes.Main} component={Main} />
      <RootStack.Screen
        name={RootRoutes.Modal}
        component={ModalStackNavigator}
        options={modalScreenOptions}
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
      <RootStack.Screen
        name={RootRoutes.Account}
        component={AccountRootLanding}
      />
      <RootStack.Screen name={RootRoutes.OnLanding} component={OnLanding} />
      <RootStack.Screen
        name={RootRoutes.OnLandingWalletConnect}
        component={OnLanding}
      />
      {process.env.NODE_ENV !== 'production' && (
        <RootStack.Screen
          name={RootRoutes.Gallery}
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          component={require('./Gallery').default}
        />
      )}
    </RootNavigatorContainer>
  );
};
