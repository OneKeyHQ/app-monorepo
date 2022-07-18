/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-pluralrules/polyfill';
import '@formatjs/intl-pluralrules/locale-data/en';
import './shim';
import { AppRegistry, LogBox } from 'react-native';

import React, { FC } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import PagingViewHeader from './src/views/PagingViewHeader';
import PagingViewContrainer from './src/views/PagingViewContrainer';
import { Provider } from '@onekeyhq/kit';
import { enableFreeze } from 'react-native-screens';

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
AppRegistry.registerComponent('PagingHeaderView', () => PagingViewHeader);
AppRegistry.registerComponent(
  'PagingViewContrainer',
  () => PagingViewContrainer,
);

export default App;
