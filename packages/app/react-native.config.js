module.exports = {
  reactNativePath: '../../node_modules/react-native',
  dependencies: {
    'react-native-flipper': {
      // disable flipper in CI environment
      platforms: process.env.CI ? { ios: null, android: null } : {},
    },
    '@react-native-google-signin/google-signin': {
      platforms: {
        ios: null,
      },
    },
    'react-native-v8': {
      platforms: {
        ios: null,
      },
    },
    '@react-native-community/slider': {
      platforms: {
        ios: null,
      },
    },
  },
};
