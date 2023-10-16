const developmentConsts = require('./developmentConsts');

const sharedTranspile = [];

const taprootModules = [
  '@cmdcode/buff-utils',
  '@cmdcode/tapscript',
  '@cmdcode/tapscript/dist/main.cjs',
  '@cmdcode/crypto-utils',
  '@cmdcode/crypto-utils/dist/main.cjs',
];

const walletConnectModules = [
  '@walletconnect/time',
  '@walletconnect/utils',
  '@walletconnect/window-getters',
  '@walletconnect/window-metadata',
  '@walletconnect/relay-api',
  '@walletconnect/core',
  '@walletconnect-v2/utils',
  '@walletconnect-v2/core',
  '@walletconnect-v2/core/node_modules/@walletconnect/utils',
  '@walletconnect/auth-client',
  '@walletconnect/auth-client/node_modules/@walletconnect/utils',
  '@walletconnect/auth-client/node_modules/@walletconnect/core',
  '@walletconnect/sign-client',
  '@walletconnect/sign-client/node_modules/@walletconnect/utils',
  '@walletconnect/sign-client/node_modules/@walletconnect/core',
  '@stablelib/chacha20poly1305',
  '@stablelib/hkdf',
  '@stablelib/random',
  '@stablelib/sha256',
  '@stablelib/x25519',
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

const webModuleTranspile = [
  ...sharedTranspile,
  ...walletConnectModules,
  ...taprootModules,
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

const extModuleTranspile = [
  ...sharedTranspile,
  ...substrateModules,
  ...polkadotModules,
  ...walletConnectModules,
  ...taprootModules,
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
