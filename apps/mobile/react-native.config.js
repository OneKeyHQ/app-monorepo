module.exports = {
  reactNativePath: '../../node_modules/react-native',
  dependencies: {
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
    '@onekeyfe/react-native-app-update': {
      platforms: {
        android: {
          dependencyConfiguration: 'prodImplementation',
        },
      },
    },
  },
};
