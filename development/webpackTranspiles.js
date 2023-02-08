const webModuleTranspile = [
  'moti',
  '@gorhom',
  '@mysten/sui.js',
  '@polkadot',
  'superstruct',
];

const extModuleTranspile = [
  'react-native-animated-splash-screen',
  'moti',
  'popmotion',
  '@mysten/sui.js',
  'superstruct',
  '@polkadot/api',
  '@polkadot/wasm-bridge',
  '@polkadot/types-codec',
  '@polkadot/rpc-provider',
  '@polkadot/types',
  '@polkadot/util-crypto',
  '@polkadot/keyring',
];

module.exports = {
  webModuleTranspile,
  extModuleTranspile,
};
