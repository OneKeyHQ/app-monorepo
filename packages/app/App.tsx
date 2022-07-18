/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-pluralrules/polyfill';
import '@formatjs/intl-pluralrules/locale-data/en';
import './shim';
import { AppRegistry, LogBox } from 'react-native';

import React, { FC, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
// import PagingViewHeader from './src/views/PagingViewHeader';
import PagingViewContrainer from './src/views/PagingViewContrainer';
import { Provider } from '@onekeyhq/kit';
import { enableFreeze } from 'react-native-screens';
import AccountInfo from '@onekeyhq/kit/src/views/Wallet/AccountInfo';

import { BasicProvider } from '@onekeyhq/kit/src/provider';
import { RootNavContainerRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import { NavigationContext } from '@react-navigation/core';
// github.com/software-mansion/react-native-screens#experimental-support-for-react-freeze
// It uses the React Suspense mechanism to prevent
// parts of the component tree from rendering,
// while keeping its state untouched.
enableFreeze(true);

SplashScreen.preventAutoHideAsync();
LogBox.ignoreAllLogs();

const App: FC = function () {
  return <Provider />;
};

function NativeHeader() {
  const [navigationRef, setNavigationRef] =
    React.useState<RootNavContainerRef | null>(null);
  useEffect(() => {
    function checkNavRef() {
      if (global.$navigationRef.current) {
        setNavigationRef(global.$navigationRef.current);
      } else {
        setTimeout(checkNavRef, 500);
      }
    }
    checkNavRef();
  }, []);
  if (!navigationRef) {
    return null;
  }

  return (
    <BasicProvider>
      <NavigationContext.Provider
        // @ts-ignore
        value={navigationRef}
      >
        <AccountInfo />
      </NavigationContext.Provider>
    </BasicProvider>
  );
}
AppRegistry.registerComponent('PagingHeaderView', () => NativeHeader);
AppRegistry.registerComponent(
  'PagingViewContrainer',
  () => PagingViewContrainer,
);

export default App;
