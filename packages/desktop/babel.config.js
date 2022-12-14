const babelTools = require('../../development/babelTools');
const packageJson = require('./package.json');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.desktop,
  config: {
    targets: {
      electron: packageJson.devDependencies.electron,
    },
    presets: ['babel-preset-expo'],
    plugins: [
      // FIX: Uncaught Error: Reanimated 2 failed to create a worklet, maybe you forgot to add Reanimated's babel plugin?
      'react-native-reanimated/plugin',
    ],
  },
});
