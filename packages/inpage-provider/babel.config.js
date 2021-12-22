const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  presets: [
    ['@expo/next-adapter/babel'],
    // [
    //   '@babel/preset-env',
    //   // {
    //   //   'targets': {
    //   //     'browsers': 'last 2 versions',
    //   //   },
    //   //   'modules': false,
    //   //   'loose': false,
    //   // },
    // ],
    // '@babel/preset-react',
    // '@babel/preset-typescript',
  ],
  plugins: [],
});
