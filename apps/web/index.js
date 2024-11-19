/* eslint-disable import/first */
/* eslint-disable import/order */
const {
  markJsBundleLoadedTime,
} = require('@onekeyhq/shared/src/modules3rdParty/metrics');

markJsBundleLoadedTime();

import '@onekeyhq/shared/src/polyfills';
import { registerRootComponent } from 'expo';

import App from './App';

import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';

initSentry();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(withSentryHOC(App));
