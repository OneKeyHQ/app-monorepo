/* eslint-disable import/order */
import './jsReady';
import '@onekeyhq/shared/src/polyfills';

import { I18nManager } from 'react-native';
import { registerRootComponent } from 'expo';
import { initSentry } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import App from './App';

initSentry();

I18nManager.allowRTL(true);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

registerRootComponent(App);
