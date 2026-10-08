const path = require('path');

function createBaseResolveOptions({
  basePath,
  enableSentryMinimalCompat,
  extensions,
}) {
  return {
    mainFields: ['browser', 'module', 'main'],
    aliasFields: ['browser', 'module', 'main'],
    extensions,
    symlinks: true,
    alias: {
      'react-native$': 'react-native-web',
      'react-native-fast-image': path.join(
        __dirname,
        '../module-resolver/react-native-fast-image-mock',
      ),
      'react-native-keyboard-controller': path.join(
        __dirname,
        '../module-resolver/react-native-keyboard-controller-mock',
      ),
      'react-native-aes-crypto': false,
      'react-native-cloud-fs': false,
      'react-native/Libraries/Components/View/ViewStylePropTypes$':
        'react-native-web/dist/exports/View/ViewStylePropTypes',
      'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter$':
        'react-native-web/dist/vendor/react-native/NativeEventEmitter/RCTDeviceEventEmitter',
      'react-native/Libraries/vendor/emitter/EventEmitter$':
        'react-native-web/dist/vendor/react-native/emitter/EventEmitter',
      'react-native/Libraries/vendor/emitter/EventSubscriptionVendor$':
        'react-native-web/dist/vendor/react-native/emitter/EventSubscriptionVendor',
      'react-native/Libraries/EventEmitter/NativeEventEmitter$':
        'react-native-web/dist/vendor/react-native/NativeEventEmitter',
      '@react-aria/focus': path.join(
        basePath,
        '../../node_modules/@react-aria/focus/src/index.ts',
      ),
      '@react-aria/interactions': path.join(
        basePath,
        '../../node_modules/@react-aria/interactions/src/index.ts',
      ),
      '@react-aria/ssr': path.join(
        basePath,
        '../../node_modules/@react-aria/ssr/src/index.ts',
      ),
      '@react-aria/utils': path.join(
        basePath,
        '../../node_modules/@react-aria/utils/src/index.ts',
      ),
      ...(enableSentryMinimalCompat
        ? {
            '@sentry/minimal$': path.join(
              __dirname,
              '../module-resolver/sentry-minimal-compat',
            ),
          }
        : {}),
      'bn.js$': require.resolve('bn.js'),
      // algosdk's browser field value ('.': 'dist/browser/algosdk.min.js') lacks
      // the './' prefix; rspack's strict resolver fails on it, so bare 'algosdk'
      // cannot resolve. Pin the entry to the ESM build (same file kit-bg imports
      // directly), keeping a single algosdk module graph in the bundle.
      'algosdk$': require.resolve('algosdk/dist/esm/index.js'),
    },
    fallback: {
      crypto:
        require.resolve('@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.js'),
      stream: require.resolve('stream-browserify'),
      path: false,
      https: false,
      http: false,
      net: false,
      dgram: false,
      zlib: false,
      tls: false,
      child_process: false,
      process: false,
      fs: false,
      util: false,
      os: false,
      wbg: false,
      buffer: require.resolve('buffer/'),
    },
    fullySpecified: false,
  };
}

module.exports = { createBaseResolveOptions };
