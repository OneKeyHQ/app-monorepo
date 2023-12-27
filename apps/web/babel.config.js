const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.web,
  config: {
    presets: [
      [
        'babel-preset-expo',
        { web: { unstable_transformProfile: 'hermes-stable' } },
      ],
    ],
    plugins: ['react-native-reanimated/plugin'],
  },
});
