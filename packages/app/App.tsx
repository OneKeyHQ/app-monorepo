// eslint-disable-next-line import/first, import/order
import './shim';

import React, { FC } from 'react';

import 'expo-dev-client';
import { LogBox } from 'react-native';

import { Provider } from '@onekeyhq/kit';

LogBox.ignoreLogs([
  'Overwriting fontFamily style attribute preprocessor',
  'Require cycle',
  'recommended absolute minimum',
  'Easing was renamed to EasingNode',
  'componentWillReceiveProps has been renamed',
  'Consider refactoring to remove the need for a cycle',
  'console.disableYellowBox',
  'NativeBase:',
]);

console.warn = () => {};

const App: FC = function () {
  return <Provider />;
};

export default App;
