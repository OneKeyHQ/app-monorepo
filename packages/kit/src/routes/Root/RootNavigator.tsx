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
];

export const RootNavigator = () => {
  const intl = useIntl();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      // 暂时关闭 IQKeyboardManager, 因为 Modal 上的 textField 会让最底层的 View 跟着键盘移动
      KeyboardManager.setEnable(false);
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
