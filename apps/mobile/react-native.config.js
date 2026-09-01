const isMacCatalystBuild = process.env.ONEKEY_MAC_CATALYST === '1';

const macCatalystExcludedDependencies = [
  '@onekeyfe/react-native-cloud-kit-module',
  '@onekeyfe/react-native-lite-card',
  '@phantom/react-native-juicebox-sdk',
  '@shopify/react-native-skia',
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
}

module.exports = {
  reactNativePath: '../../node_modules/react-native',
  dependencies,
};
