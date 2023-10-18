// Keep this file for run testing jest *.ts files
const babelTools = require('./development/babelTools');

module.exports = babelTools.normalizeConfig({
  platform: babelTools.developmentConsts.platforms.all,
  config: {
    presets: ['babel-preset-expo'],
    plugins: [
      // support: await import()
      //      You need to run with a version of node that supports ES Modules in the VM API. See https://jestjs.io/docs/ecmascript-modules
      'babel-plugin-transform-dynamic-imports-to-static-imports',
      // 'babel-plugin-dynamic-import-node'
    ],
  },
});
