const babelTools = require('../../development/babelTools');

module.exports = function (api) {
  // ios, android
  console.log(
    'process.env.npm_lifecycle_event >>>>> ',
    process.env.npm_lifecycle_event,
  );

  api.cache(true);
  return babelTools.normalizeConfig({
    platform: babelTools.developmentConsts.platforms.app,
    config: {
      presets: ['babel-preset-expo'],
      plugins: ['react-native-reanimated/plugin'],
    },
  });
};
