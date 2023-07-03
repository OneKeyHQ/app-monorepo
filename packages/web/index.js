import { registerRootComponent } from 'expo';

import App from './App';

const fixPatches = () => {
  // fix BN.prototype.toBuffer is missing in Web Platform
  const BN = require('bn.js');

  BN.prototype.toBuffer = function toBuffer(endian, length) {
    return this.toArrayLike(Buffer, endian, length);
  };
};
fixPatches();
// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
