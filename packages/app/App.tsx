/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-pluralrules/polyfill';
import '@formatjs/intl-pluralrules/locale-data/en';
import './shim';

import * as SplashScreen from 'expo-splash-screen';
import { LogBox } from 'react-native';

import { Provider } from '@onekeyhq/kit';
import { startTraceJsRender } from '@onekeyhq/shared/src/perf/perfTrace';

startTraceJsRender();

SplashScreen.preventAutoHideAsync();
LogBox.ignoreAllLogs();

export default Provider;
