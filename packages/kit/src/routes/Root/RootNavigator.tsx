import { useEffect } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import type { RootStackNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootStackNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import ModalNavigator from './Modal/ModalNavigator';
import { RootRoutes } from './Routes';
import TabNavigator from './Tab/TabNavigator';

const rootConfig: RootStackNavigatorConfig<RootRoutes, any>[] = [
  {
    name: RootRoutes.Main,
    component: TabNavigator,
    initialRoute: true,
  },
  {
    name: RootRoutes.Modal,
    component: ModalNavigator,
    type: 'modal',
  },
  {
    name: RootRoutes.Gallery,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    component: require('../Gallery').default,
    disable: process.env.NODE_ENV === 'production',
  },
];

export const RootNavigator = () => {
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

  return <RootStackNavigator<RootRoutes, any> config={rootConfig} />;
};
