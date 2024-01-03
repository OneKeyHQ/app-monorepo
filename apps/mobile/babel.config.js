const path = require('path');
const babelTools = require('../../development/babelTools');

module.exports = function (api) {
  api.cache(true);
  return babelTools.normalizeConfig({
    platform: babelTools.developmentConsts.platforms.app,
    config: {
      presets: [
        [
          'babel-preset-expo',
          { native: { unstable_transformProfile: 'hermes-stable' } },
        ],
      ],
      plugins: [
        [
          require('@tamagui/babel-plugin/dist/cjs/index.native'),
          {
            components: ['tamagui'],
            config: path.join(
              __dirname,
              '../../packages/components/tamagui.config.ts',
            ),
            importsWhitelist: [],
            logTimings: true,
            disableExtraction: process.env.NODE_ENV === 'development',
            experimentalFlattenThemesOnNative: true,
          },
        ],
        [
          'react-native-reanimated/plugin',
          {
            globals: ['__scanCodes'],
          },
        ],
      ],
    },
  });
};
