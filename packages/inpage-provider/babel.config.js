const babelTools = require('../../development/babelTools');

const IS_PRD = process.env.NODE_ENV === 'production';

const browsers = IS_PRD ? undefined : ['chrome >= 63', 'firefox >= 68'];

module.exports = babelTools.normalizeConfig({
  presets: [
    // ['@expo/next-adapter/babel'],
    [
      'next/babel',
      {
        'preset-env': {
          targets: {
            browsers,
          },
        },
      },
    ],
  ],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          'react-native': './src/react-native-mock.js',
        },
      },
    ],
  ],
});
