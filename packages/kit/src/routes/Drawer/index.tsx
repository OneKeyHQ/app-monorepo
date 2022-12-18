import { memo, useEffect, useState } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import { useThemeValue } from '@onekeyhq/components';
import { WalletSelectorMobile } from '@onekeyhq/kit/src/components/WalletSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Tab from '../Tab';
import { RootRoutes, TabRoutes } from '../types';

import type { StyleProp, ViewStyle } from 'react-native';

const DrawerStack = createDrawerNavigator();

const tabsDisabledSwipe: string[] = [
  TabRoutes.Discover,
  TabRoutes.NFT,
  TabRoutes.Market,
];

const DrawerStackNavigator = () => {
  const isWeb = !platformEnv.isNative;
  const drawerStyle: Partial<StyleProp<ViewStyle>> = {
    width: '85%',
    maxWidth: 400,
    backgroundColor: useThemeValue('background-default'),
  };
  if (isWeb) {
    drawerStyle.opacity = 1;
  }
  const [key, setKey] = useState('');
  useEffect(() => {
    // recreate drawer navigator to fix OK-8412 on ios
    // no idea why it works
    setTimeout(() => setKey('drawer'), 10);
  }, []);

  return (
    <DrawerStack.Navigator
      useLegacyImplementation
      key={key}
      screenOptions={{
        headerShown: false,
        /**
         * fix drawer every render blink issue: https://github.com/react-navigation/react-navigation/issues/7515
         */
        drawerType: 'back',
        swipeEdgeWidth: 390,
        drawerStyle,
        swipeEnabled: !platformEnv.isNativeIOSPad,
      }}
      // eslint-disable-next-line react/no-unstable-nested-components
      drawerContent={(props) => <WalletSelectorMobile {...props} />}
    >
      <DrawerStack.Screen
        name={RootRoutes.Tab}
        component={Tab}
        options={({ route }) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const routeName = getFocusedRouteNameFromRoute(route)!;
          return {
            swipeEnabled: !tabsDisabledSwipe.includes(routeName),
          };
        }}
      />
    </DrawerStack.Navigator>
  );
};

export default memo(DrawerStackNavigator);
