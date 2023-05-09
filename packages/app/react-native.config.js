module.exports = {
  dependencies: {
    'react-native-flipper': {
      // disable flipper in CI environment
      platforms: process.env.CI ? { ios: null, android: null } : {},
    },
    '@react-native-community/google-signin': {
      platforms: {
        ios: null,
      },
    },
  },
};
