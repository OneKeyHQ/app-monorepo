/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-pluralrules/polyfill';
import '@formatjs/intl-pluralrules/locale-data/en';
import './shim';

import React, { FC } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { LogBox } from 'react-native';

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

export default App;
