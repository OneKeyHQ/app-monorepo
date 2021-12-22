const babelTools = require('../../development/babelTools');

module.exports = babelTools.normalizeConfig({
  presets: ['@expo/next-adapter/babel'],
  plugins: [],
});
