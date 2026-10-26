const path = require('path');

const isMacCatalystBuild = process.env.ONEKEY_MAC_CATALYST === '1';

const macCatalystExcludedDependencies = [
  '@onekeyfe/react-native-cloud-kit-module',
  '@onekeyfe/react-native-lite-card',
  '@onekeyfe/react-native-sni-connect',
  '@onramper/onramper-react-native',
  '@phantom/react-native-juicebox-sdk',
  '@shopify/react-native-skia',
  '@walletconnect/react-native-compat',
  'expo-camera',
  'jcore-react-native',
  'jpush-react-native',
  'react-native-network-info',
];

const dependencies = {
  '@react-native-google-signin/google-signin': {
    platforms: {
      // ios: null,
    },
  },
  'react-native-check-biometric-auth-changed': {
    platforms: {
      android: null,
    },
  },
};

if (isMacCatalystBuild) {
  macCatalystExcludedDependencies.forEach((dependency) => {
    dependencies[dependency] = {
      platforms: {
        ios: null,
      },
    };
  });
  // React Native code generation matches the published name instead of its Yarn alias.
  dependencies['@onekeyfe/react-native-network-info'] = {
    root: path.dirname(
      require.resolve('react-native-network-info/package.json'),
    ),
    platforms: { ios: null },
  };
}

module.exports = {
  reactNativePath: '../../node_modules/react-native',
  dependencies,
};
