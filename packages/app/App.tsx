/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-pluralrules/polyfill';
import '@formatjs/intl-pluralrules/locale-data/en';
import './shim';

import React, { FC } from 'react';

import 'expo-dev-client';
import { LogBox } from 'react-native';

import { Provider } from '@onekeyhq/kit';

LogBox.ignoreLogs([
  'Require cycle',
  'recommended absolute minimum',
  'Easing was renamed to EasingNode',
  'componentWillReceiveProps has been renamed',
  'Consider refactoring to remove the need for a cycle',
  'console.disableYellowBox',
  'NativeBase:',
  'style attribute preprocessor',
  'new NativeEventEmitter',
]);

console.warn = () => {};
console.disableYellowBox = true;

const App: FC = function () {
  return <Provider />;
};

export default App;
