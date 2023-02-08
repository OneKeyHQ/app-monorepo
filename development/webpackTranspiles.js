const webModuleTranspile = ['moti', '@gorhom', '@mysten/sui.js', '@polkadot'];

const extModuleTranspile = [
  'react-native-animated-splash-screen',
  'moti',
  'popmotion',
  '@mysten/sui.js',
  '@polkadot/api',
  '@polkadot/wasm-bridge',
  '@polkadot/types-codec',
  '@polkadot/rpc-provider',
  '@polkadot/rpc-core',
  '@polkadot/types',
  '@polkadot/util-crypto',
  '@polkadot/keyring',
];

module.exports = {
  webModuleTranspile,
  extModuleTranspile,
};
