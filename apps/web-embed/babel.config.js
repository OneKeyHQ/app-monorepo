const babelTools = require('../../development/babelTools');

const {
  CHROMIUM_BASELINE_TARGET,
} = require('./scripts/browser-compat-baseline');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.webEmbed,
  config: {
    targets: { chrome: CHROMIUM_BASELINE_TARGET, safari: '15.5' },
    presets: [
      [
        'babel-preset-expo',
        { web: { unstable_transformProfile: 'hermes-canary' } },
      ],
    ],
    plugins: [
      'react-native-worklets/plugin',
      '@babel/plugin-transform-logical-assignment-operators',
    ],
  },
});
