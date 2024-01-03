const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.webEmbed,
  config: {
    presets: [
      [
        'babel-preset-expo',
        { web: { unstable_transformProfile: 'hermes-canary' } },
      ],
    ],
    plugins: ['react-native-reanimated/plugin'],
  },
});
