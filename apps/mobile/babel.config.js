const path = require('path');
const babelTools = require('../../development/babelTools');

console.log('process.env.TAMAGUI_TARGET: ', process.env.TAMAGUI_TARGET);
if (process.env.TAMAGUI_TARGET !== 'native') {
  process.env.TAMAGUI_TARGET = 'native';
  console.log(
    'fixed: process.env.TAMAGUI_TARGET: ',
    process.env.TAMAGUI_TARGET,
  );
}

module.exports = function (api) {
  api.cache(true);
  return babelTools.normalizeConfig({
    platform: babelTools.developmentConsts.platforms.app,
    config: {
      presets: [
        [
          'babel-preset-expo',
          {
            native: {
              unstable_transformProfile: 'hermes-stable',
            },
            unstable_transformImportMeta: true,
          },
        ],
      ],
      plugins: [
        // eslint-disable-next-line spellcheck/spell-checker
        // fix Reanimated error: [Reanimated] Tried to synchronously call a non-worklet function on the UI thread.
        //  in react-native-gesture-handler
        require('@babel/plugin-transform-shorthand-properties'),
        [
          require('@tamagui/babel-plugin/dist/cjs/index.native'),
          {
            components: ['tamagui'],
            config: path.join(
              __dirname,
              '../../packages/components/tamagui.config.ts',
            ),
            importsWhitelist: [],
            logTimings: false,
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
