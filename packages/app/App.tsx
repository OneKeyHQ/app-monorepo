/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';

import * as SplashScreen from 'expo-splash-screen';
import { DeviceEventEmitter, LogBox } from 'react-native';

import { KitProvider } from '@onekeyhq/kit';
import { startTrace } from '@onekeyhq/shared/src/perf/perfTrace';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

startTrace('js_render');

SplashScreen.preventAutoHideAsync();
LogBox.ignoreAllLogs();

DeviceEventEmitter.addListener('native_log_info', (event: string) => {
  debugLogger.native.info(event);
});

export default KitProvider;
