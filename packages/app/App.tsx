/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import './shim';
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/polyfill';

import { preventAutoHideAsync } from 'expo-splash-screen';
import { LogBox } from 'react-native';

import { KitProvider } from '@onekeyhq/kit';
import { startTrace } from '@onekeyhq/shared/src/perf/perfTrace';

startTrace('js_render');

preventAutoHideAsync();
LogBox.ignoreAllLogs();

export default KitProvider;
