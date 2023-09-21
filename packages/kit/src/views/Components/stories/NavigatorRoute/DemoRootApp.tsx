import type { FC } from 'react';
import { useEffect, useMemo } from 'react';

import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import {
  createStackNavigator,
  makeModalScreenOptions,
  makeRootScreenOptions,
} from '@onekeyhq/components/src/Navigation';
import useIsVerticalLayout from '@onekeyhq/components/src/Provider/hooks/useIsVerticalLayout';

import DemoMain from './DemoMain';
import DemoModalStackNavigator from './DemoRootModalStack';
import { DemoRootRoutes } from './Modal/types';

const RootStack = createStackNavigator();

const RootNavigatorContainer: FC = ({ children }) => {
  const isVerticalLayout = useIsVerticalLayout();
  const initialRouteName = DemoRootRoutes.Main;
  const screenOptions = useMemo(
    () => makeRootScreenOptions({ isVerticalLayout }),
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

export const DemoRootApp = () => {
  // const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  useEffect(() => {
    if (Platform.OS === 'ios') {
      KeyboardManager.setEnable(true);
      KeyboardManager.setEnableDebugging(false);
      KeyboardManager.setKeyboardDistanceFromTextField(10);
      KeyboardManager.setLayoutIfNeededOnUpdate(true);
      KeyboardManager.setEnableAutoToolbar(true);
      // KeyboardManager.setToolbarDoneBarButtonItemText(
      //   intl.formatMessage({ id: 'action__done' }),
      // );
      KeyboardManager.setToolbarPreviousNextButtonEnable(false);
      KeyboardManager.setKeyboardAppearance('default');
      KeyboardManager.setShouldPlayInputClicks(true);
    }
  }, []);

  const modalScreenOptions = useMemo(
    () => makeModalScreenOptions({ isVerticalLayout }),
    [isVerticalLayout],
  );

  return (
    <RootNavigatorContainer>
      <RootStack.Screen name={DemoRootRoutes.Main} component={DemoMain} />
      <RootStack.Screen
        name={DemoRootRoutes.Modal}
        component={DemoModalStackNavigator}
        // @ts-expect-error
        options={modalScreenOptions}
      />
    </RootNavigatorContainer>
  );
};
