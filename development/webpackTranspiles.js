const webModuleTranspile = [
  'moti',
  '@gorhom',
  '@mysten/sui.js',
  'superstruct',
  '@noble/curves',
  '@polkadot',
  '@solana/web3.js',
  '@kaspa/core-lib',
  '@zondax/izari-filecoin',
];

const extModuleTranspile = [
  'react-native-animated-splash-screen',
  'moti',
  'popmotion',
  '@mysten/sui.js',
  'superstruct',
  '@noble/curves',
  '@polkadot/api',
  '@polkadot/wasm-bridge',
  '@polkadot/types-codec',
  '@polkadot/rpc-provider',
  '@polkadot/rpc-core',
  '@polkadot/types',
  '@polkadot/util-crypto',
  '@polkadot/keyring',
  '@solana/web3.js',
  '@zondax/izari-filecoin',
  '@kaspa/core-lib',
];

module.exports = {
  webModuleTranspile,
  extModuleTranspile,
};
