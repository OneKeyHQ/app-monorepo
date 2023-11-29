import { useEffect } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { RootStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import AppStateLockContainer from '../../components/AppLock/container/AppStateLockContainer';

import ModalNavigator from './Modal/ModalNavigator';
import { ERootRoutes } from './Routes';
import TabNavigator from './Tab/TabNavigator';

const rootConfig: IRootStackNavigatorConfig<ERootRoutes, any>[] = [
  {
    name: ERootRoutes.Main,
    component: TabNavigator,
    initialRoute: true,
  },
  {
    name: ERootRoutes.Modal,
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

  return (
    <AppStateLockContainer>
      <RootStackNavigator<ERootRoutes, any> config={rootConfig} />
    </AppStateLockContainer>
  );
};
