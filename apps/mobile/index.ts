/* eslint-disable import/first */
/* eslint-disable import/order */

const { initSentry } = require('@onekeyhq/shared/src/modules3rdParty/sentry');

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
initSentry();

import { I18nManager } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

I18nManager.allowRTL(true);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

registerRootComponent(App);
