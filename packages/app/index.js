/* eslint-disable import/first */
if (process.env.NODE_ENV !== 'production') {
  const { Platform, NativeModules } = require('react-native');
  const RCTAsyncStorage =
    NativeModules.RNC_AsyncSQLiteDBStorage || NativeModules.RNCAsyncStorage;
  let rrt;
  try {
    window.RCTAsyncStorage = RCTAsyncStorage;
    rrt = JSON.parse(RCTAsyncStorage.getValueForKey('rrt'));
    // eslint-disable-next-line no-empty
  } catch {}
  console.log('__RRT__', typeof rrt, rrt, rrt === '1');
  if (rrt === '1') {
    const manufacturer = Platform.constants.Brand
      ? `${Platform.constants.Brand} (${Platform.constants.Manufacturer})`
      : '';
    const fingerprint = Platform.constants.Fingerprint
      ? `-${Platform.constants.Fingerprint}`
      : '';
    global.REMPL_TITLE = `${manufacturer}${Platform.OS}_${Platform.Version}${fingerprint}`;
    require('react-render-tracker');
  }
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
