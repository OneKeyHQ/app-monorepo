const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.ext,
  config: {
    presets: [
      [
        'babel-preset-expo',
        { web: { unstable_transformProfile: 'hermes-canary' } },
      ],
    ],
    plugins: [
      // FIX: Uncaught Error: Reanimated 2 failed to create a worklet, maybe you forgot to add Reanimated's babel plugin?
      'react-native-reanimated/plugin',
    ],
    sourceType: 'unambiguous',
  },
});
