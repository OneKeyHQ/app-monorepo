import type { FC } from 'react';
import { useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import { useIsVerticalLayout } from '@onekeyhq/components';
import {
  createStackNavigator,
  makeModalScreenOptions,
  makeOnboardingScreenOptions,
  makeRootScreenOptions,
} from '@onekeyhq/components/src/Navigation';

import { createLazyComponent } from '../../utils/createLazyComponent';
import { RootRoutes } from '../routesEnum';

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
    () => makeRootScreenOptions(isVerticalLayout),
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
    () => makeModalScreenOptions(isVerticalLayout),
    [isVerticalLayout],
  );

  const onboardingScreenOptions = useMemo(
    () => makeOnboardingScreenOptions(),
    [],
  );

  return (
    <RootNavigatorContainer>
      <RootStack.Screen name={RootRoutes.Main} component={Main} />
      <RootStack.Screen
        name={RootRoutes.Modal}
        component={ModalStackNavigator}
        // @ts-expect-error
        options={modalScreenOptions}
      />

      <RootStack.Screen
        name={RootRoutes.Onboarding}
        component={RouteOnboarding}
        // @ts-expect-error
        options={onboardingScreenOptions}
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
