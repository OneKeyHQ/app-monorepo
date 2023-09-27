import { useEffect } from 'react';

import { Platform } from 'react-native';
import KeyboardManager from 'react-native-keyboard-manager';

import {
  RootModalNavigator,
  RootStackNavigator,
} from '@onekeyhq/components/src/Navigation/Navigator';

import DemoMain from './DemoMain';
import DemoRootModalStackScreenList from './DemoRootModalStackScreenList';
import { DemoRootRoutes } from './Routes';

type RootStackParamList = {
  [DemoRootRoutes.Main]: {
    itemId: number;
  };
  [DemoRootRoutes.Modal]: {
    query: string;
  };
};

function DemoModalStackScreen() {
  return <RootModalNavigator config={DemoRootModalStackScreenList} />;
}

const rootConfig = [
  {
    name: DemoRootRoutes.Main,
    component: DemoMain,
    initialRoute: true,
  },
  {
    name: DemoRootRoutes.Modal,
    component: DemoModalStackScreen,
    type: 'modal',
  },
];

export const DemoRootApp = () => {
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

  return <RootStackNavigator<RootStackParamList> config={rootConfig} />;
};
