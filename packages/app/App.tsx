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

// 直接隐藏，后续去掉原生的splash-screen
SplashScreen.hideAsync();
LogBox.ignoreAllLogs();

const App: FC = function () {
  return <Provider />;
};

export default App;
