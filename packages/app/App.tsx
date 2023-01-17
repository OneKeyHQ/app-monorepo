/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import './shim';
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/polyfill';

import * as SplashScreen from 'expo-splash-screen';
import { LogBox } from 'react-native';

import { Provider } from '@onekeyhq/kit';
import { startTrace } from '@onekeyhq/shared/src/perf/perfTrace';

startTrace('js_render');

SplashScreen.preventAutoHideAsync();
LogBox.ignoreAllLogs();

export default Provider;
