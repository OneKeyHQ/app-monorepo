const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  presets: ['@expo/next-adapter/babel'],
  plugins: [
    // FIX: Uncaught Error: Reanimated 2 failed to create a worklet, maybe you forgot to add Reanimated's babel plugin?
    'react-native-reanimated/plugin',
    [
      // TODO move to root ./development/, all platforms production env console-feed module alias set
      'module-resolver',
      {
        root: ['./'],
        alias: {
          'console-feed': './src/console-feed-mock',
          // FIX FOR FIREFOX resize issue, import react-native-restart make firefox
          'react-native-restart': './src/assets/js/react-native-restart.js',
        },
      },
    ],
  ],
});
