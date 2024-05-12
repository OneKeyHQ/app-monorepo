/* eslint-disable import/first */
/* eslint-disable import/order */
const {
  markJsBundleLoadedTime,
} = require('@onekeyhq/shared/src/modules3rdParty/metrics');

markJsBundleLoadedTime();

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

registerRootComponent(App);
