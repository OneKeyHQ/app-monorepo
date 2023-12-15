const path = require('path');
const babelTools = require('../../development/babelTools');

if (process.env.NODE_ENV !== 'production') {
  const ip = require('ip');
  process.env.METRO_HOST_IP = ip.address();
}

module.exports = function (api) {
  api.cache(true);
  return babelTools.normalizeConfig({
    platform: babelTools.developmentConsts.platforms.app,
    config: {
      presets: ['babel-preset-expo'],
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
