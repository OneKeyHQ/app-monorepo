const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.webEmbed,
  config: {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  },
});
