// Keep this file for run testing jest *.ts files
const babelTools = require('./development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.all,
  config: {
    presets: ['babel-preset-expo'],
    plugins: [],
  },
});
