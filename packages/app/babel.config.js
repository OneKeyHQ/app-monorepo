const babelTools = require('../../development/babelTools');

module.exports = function (api) {
  api.cache(true);
  return babelTools.normalizeConfig({
    platform: babelTools.developmentConsts.platforms.app,
    config: {
      presets: ['babel-preset-expo'],
      plugins: ['react-native-reanimated/plugin'],
    },
  });
};
