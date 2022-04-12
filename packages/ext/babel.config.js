const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.ext,
  config: {
    presets: ['@expo/next-adapter/babel'],
    plugins: [
      // FIX: Uncaught Error: Reanimated 2 failed to create a worklet, maybe you forgot to add Reanimated's babel plugin?
      'react-native-reanimated/plugin',
    ],
  },
});
