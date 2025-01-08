/* eslint-disable import/first */
/* eslint-disable import/order */
const {
  markJsBundleLoadedTime,
} = require('@onekeyhq/shared/src/modules3rdParty/metrics');

const { initSentry } = require('@onekeyhq/shared/src/modules3rdParty/sentry');

markJsBundleLoadedTime();
initSentry();

import { I18nManager } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

I18nManager.allowRTL(true);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

registerRootComponent(App);
