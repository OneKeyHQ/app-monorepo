// Keep this file for run testing jest *.ts files
const babelTools = require('./development/babelTools');

module.exports = babelTools.normalizeConfig({
  presets: ['@expo/next-adapter/babel'],
  plugins: [],
});
