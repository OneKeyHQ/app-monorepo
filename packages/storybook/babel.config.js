if (!process.env.TAMAGUI_TARGET) {
  process.env.TAMAGUI_TARGET = 'native';
}
const path = require('path');
const babelTools = require('../../development/babelTools');

module.exports = function (api) {
  api.cache(true);
  return babelTools.normalizeConfig({
    platform: babelTools.developmentConsts.platforms.app,
    config: {
      presets: ['babel-preset-expo'],
      plugins: [
        process.env.STORYBOOK_ENABLED
          ? [
              'babel-plugin-react-docgen-typescript',
              { exclude: 'node_modules' },
            ]
          : null,
        'react-native-reanimated/plugin',
        [
          require('@tamagui/babel-plugin/dist/cjs/index.native'),
          {
            components: ['tamagui'],
            config: path.join(__dirname, '../components/tamagui.config.ts'),
            importsWhitelist: [],
            logTimings: true,
            disableExtraction: process.env.NODE_ENV === 'development',
          },
        ],
      ].filter(Boolean),
    },
  });
};
