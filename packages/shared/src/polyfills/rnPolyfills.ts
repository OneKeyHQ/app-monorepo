// **** copy from node_modules/@walletconnect-v2/react-native-compat/index.js

// Polyfill TextEncode / TextDecode
// eslint-disable-next-line import/order
import 'fast-text-encoding';

// Polyfill crypto.getRandomvalues
import 'react-native-get-random-values';

// Polyfill Buffer
if (typeof Buffer === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  global.Buffer = require('buffer').Buffer;
}
