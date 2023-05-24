const developmentConsts = require('./developmentConsts');

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
  '@onekeyhq',
  'timeout-signal',
];

const substrateModules = ['@substrate/txwrapper-core'];

const polkadotModules = [
  '@polkadot/api',
  '@polkadot/wasm-bridge',
  '@polkadot/types-codec',
  '@polkadot/rpc-provider',
  '@polkadot/rpc-core',
  '@polkadot/types',
  '@polkadot/util',
  '@polkadot/util-crypto',
  '@polkadot/keyring',
];

const extModuleTranspile = [
  ...substrateModules,
  ...polkadotModules,
  '@onekeyhq/blockchain-libs',
  '@onekeyhq/components',
  '@onekeyhq/kit',
  '@onekeyhq/kit-bg',
  '@onekeyhq/shared',
  '@onekeyhq/engine',
  '@onekeyhq/app',
  'react-native-animated-splash-screen',
  'moti',
  'popmotion',
  '@mysten/sui.js',
  'superstruct',
  'timeout-signal',
  '@noble/curves',
  '@solana/web3.js',
  '@zondax/izari-filecoin',
  '@kaspa/core-lib',
  ...(developmentConsts.isManifestV3
    ? [
        // '@blitslabs/filecoin-js-signer'
      ]
    : []),
];

module.exports = {
  webModuleTranspile,
  extModuleTranspile,
};
