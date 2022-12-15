/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import './shim';

import * as SplashScreen from 'expo-splash-screen';
import { LogBox } from 'react-native';

import { Provider } from '@onekeyhq/kit';
import { startTrace } from '@onekeyhq/shared/src/perf/perfTrace';

startTrace('js_render');

SplashScreen.preventAutoHideAsync();
LogBox.ignoreAllLogs();

export default Provider;
