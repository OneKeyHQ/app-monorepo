const babelTools = require('../../development/babelTools');

process.env.TAMAGUI_TARGET = 'native';

module.exports = function (api) {
  api.cache(true);
  return babelTools.normalizeConfig({
    platform: babelTools.developmentConsts.platforms.app,
    config: {
      presets: ['babel-preset-expo'],
      plugins: [
        [
          'react-native-reanimated/plugin',
          {
            globals: ['__scanCodes'],
          },
        ],
        [
          '@tamagui/babel-plugin',
          {
            components: ['tamagui'],
            config: './tamagui.config.ts',
            importsWhitelist: ['constants.js', 'colors.js'],
            logTimings: true,
            disableExtraction: process.env.NODE_ENV === 'development',
          },
        ],
      ],
    },
  });
};
