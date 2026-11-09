const isMacCatalystBuild = process.env.ONEKEY_MAC_CATALYST === '1';

// These bundled or transitive native binaries lack Mac Catalyst slices.
const macCatalystExcludedDependencies = [
  '@onekeyfe/react-native-lite-card',
  '@onekeyfe/react-native-sni-connect',
  '@onramper/onramper-react-native',
  '@phantom/react-native-juicebox-sdk',
  '@shopify/react-native-skia',
  '@walletconnect/react-native-compat',
  'jcore-react-native',
  'jpush-react-native',
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
}

module.exports = {
  reactNativePath: '../../node_modules/react-native',
  dependencies,
};
