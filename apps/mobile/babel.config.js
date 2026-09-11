const path = require('path');

const babelTools = require('../../development/babelTools');

const {
  getMobileLockdownE2ERunId,
  getMobileLockdownWebEmbedCandidateEnabled,
  isMobileLockdownEnabled,
  mobileLockdownE2EGate,
} = require('./plugins/mobileLockdown');

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
      // These Metro polyfills execute before require() is available. Babel
      // helpers would break startup and can invalidate SES's security assumptions.
      ignore: [
        /[\\/]ses[\\/]dist[\\/]ses(?:-hermes)?\.cjs$/,
        /[\\/]react-native-lockdown[\\/]src[\\/]repair\.js$/,
      ],
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
      overrides: [
        {
          test: /@ledgerhq[\\/]device-signer-kit-ethereum[\\/]lib[\\/]cjs[\\/]internal[\\/]app-binder[\\/]task[\\/]ProvideEIP712ContextTask\.js$/,
          plugins: ['@babel/plugin-transform-classes'],
        },
      ],
      plugins: [
        [mobileLockdownE2EGate, { runId: getMobileLockdownE2ERunId() }],
        [
          'transform-define',
          {
            'process.env.ONEKEY_MOBILE_LOCKDOWN': String(
              isMobileLockdownEnabled(),
            ),
            'process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER':
              getMobileLockdownWebEmbedCandidateEnabled(),
            'process.env.ONEKEY_MOBILE_LOCKDOWN_E2E':
              getMobileLockdownE2ERunId(),
          },
          'mobile-lockdown-mode',
        ],
        // Strip jest.mock() calls when bundling for react-native-harness
        process.env.RN_HARNESS === 'true' &&
          require.resolve('./babel-plugin-jest-compat.js'),
        // fix Reanimated error: [Reanimated] Tried to synchronously call a non-worklet function on the UI thread.
        //  in react-native-gesture-handler
        require('@babel/plugin-transform-shorthand-properties'),
        [
          require('@tamagui/babel-plugin').default,
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
          'react-native-worklets/plugin',
          {
            globals: ['__scanCodes'],
          },
        ],
      ],
    },
  });
};
