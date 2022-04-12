const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.web,
  config: {
    presets: ['@expo/next-adapter/babel'],
    plugins: ['react-native-reanimated/plugin'],
  },
});
