import { memo, useCallback, useEffect, useState } from 'react';

import { createDrawerNavigator } from '@react-navigation/drawer';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import { useThemeValue } from '@onekeyhq/components';
import { WalletSelectorMobile } from '@onekeyhq/kit/src/components/WalletSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Tab from '../Tab';
import { RootRoutes, TabRoutes } from '../types';

import type { StyleProp, ViewStyle } from 'react-native';

const DrawerStack = createDrawerNavigator();

const DrawerStackNavigator = () => {
  const drawerStyle: Partial<StyleProp<ViewStyle>> = {
    // must sync with nestedtabview
    width: '85%',
    maxWidth: 400,
    backgroundColor: useThemeValue('background-default'),
  };
  if (platformEnv.isRuntimeBrowser) {
    drawerStyle.opacity = 1;
  }
  const [key, setKey] = useState('');
  useEffect(() => {
    // recreate drawer navigator to fix OK-8412 on ios
    // no idea why it works
    setTimeout(() => setKey('drawer'), 10);
  }, []);
  const drawerContent = useCallback(
    (props) => <WalletSelectorMobile {...props} />,
    [],
  );

  return (
    <DrawerStack.Navigator
      key={key}
      useLegacyImplementation
      screenOptions={{
        headerShown: false,
        /**
         * fix drawer every render blink issue: https://github.com/react-navigation/react-navigation/issues/7515
         */
        drawerType: 'back',
        drawerStyle,
        swipeEnabled: !platformEnv.isNativeIOSPad,
        swipeEdgeWidth: 390,
      }}
      drawerContent={drawerContent}
    >
      <DrawerStack.Screen
        name={RootRoutes.Tab}
        component={Tab}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route);
          return {
            swipeEnabled:
              routeName !== TabRoutes.Discover && routeName !== TabRoutes.NFT,
          };
        }}
      />
    </DrawerStack.Navigator>
  );
};

export default memo(DrawerStackNavigator);
