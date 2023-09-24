import { useCallback, useMemo } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';

// import { setMainScreenDom } from '@onekeyhq/components/src/utils/SelectAutoHide';
import { Stack } from '@onekeyhq/components';
import { getDrawerWidth } from '@onekeyhq/components/src/CollapsibleTabView/NativeNestedTabView/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DemoMainRoutes } from './Routes';
import Tab from './Tab/DemoTabNavigator';

import type { StyleProp, ViewStyle } from 'react-native';

const DrawerStack = createDrawerNavigator();

const DemoDrawerStackNavigator = () => {
  const screenOptions = useMemo(() => {
    const drawerStyle: Partial<StyleProp<ViewStyle>> = {
      width: getDrawerWidth(),
    };

    if (platformEnv.isRuntimeBrowser) {
      drawerStyle.opacity = 1;
    }
    return {
      headerShown: false,
      /**
       * fix drawer every render blink issue: https://github.com/react-navigation/react-navigation/issues/7515
       */
      drawerType: 'back',
      drawerStyle,
      swipeEnabled: false,
    } as const;
  }, []);

  const drawerContent = useCallback(
    // (props) => <WalletSelectorMobile {...props} />,
    (props) => <Stack {...props} />,
    [],
  );

  return (
    <DrawerStack.Navigator
      screenOptions={screenOptions}
      drawerContent={drawerContent}
    >
      <DrawerStack.Screen name={DemoMainRoutes.Tab} component={Tab} />
    </DrawerStack.Navigator>
  );
};

function DemoMainScreen() {
  return (
    <Stack w="100%" h="100%">
      <DemoDrawerStackNavigator />
    </Stack>
  );
}

export default DemoMainScreen;
