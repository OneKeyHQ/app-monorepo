const babelTools = require('../../development/babelTools');

module.exports = function (api) {
  api.cache(true);
  return babelTools.normalizeConfig({
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@onekeyhq/connect': './src/public/static/connect/index.js',
          },
        },
      ],
    ],
  });
};
