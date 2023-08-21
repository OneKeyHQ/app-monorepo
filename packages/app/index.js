/* eslint-disable import/first */
if (process.env.NODE_ENV !== 'production') {
  // react-render-tracker needs to be loaded before render initialization.
  const { appSetting } = require('@onekeyhq/shared/src/storage/appSetting');
  const rrt = appSetting.getBoolean('rrt');
  if (rrt) {
    const { Platform } = require('react-native');
    const manufacturer = Platform.constants.Brand
      ? `${Platform.constants.Brand} (${Platform.constants.Manufacturer})`
      : '';
    const fingerprint = Platform.constants.Fingerprint
      ? `-${Platform.constants.Fingerprint}`
      : '';
    global.REMPL_TITLE = `${manufacturer}${Platform.OS}_${Platform.Version}${fingerprint}`;
    require('react-render-tracker');
  }

  require('@onekeyhq/shared/src/modules3rdParty/react-native-metrix').markJsBundleLoadedTime();
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
