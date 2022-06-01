const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.desktop,
  config: {
    presets: ['babel-preset-expo'], // ~9.1.0
    // "metro-react-native-babel-preset": "~0.67.0"
    plugins: [
      // FIX: Uncaught Error: Reanimated 2 failed to create a worklet, maybe you forgot to add Reanimated's babel plugin?
      'react-native-reanimated/plugin',
    ],
  },
});
