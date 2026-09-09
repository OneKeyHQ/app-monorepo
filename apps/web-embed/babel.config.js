const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.webEmbed,
  config: {
    targets: { chrome: '67', safari: '15.5' },
    presets: [
      [
        'babel-preset-expo',
        { web: { unstable_transformProfile: 'hermes-canary' } },
      ],
    ],
    plugins: ['react-native-worklets/plugin'],
  },
});
