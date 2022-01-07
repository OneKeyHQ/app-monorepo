const fse = require('fs-extra');
const lodash = require('lodash');
const childProcess = require('child_process');
const path = require('path');

function execSync(cmd) {
  console.log('execSyncCmd: \n    ', cmd);
  childProcess.execSync(cmd);
}

function pluginWithName(plugin) {
  plugin.__pluginName__ = plugin.constructor.name;
  return plugin;
}

function cleanWebpackDebugFields(config, { boilerplate = false } = {}) {
  const doClean = (webpackConfig) => {
    webpackConfig?.module?.rules?.forEach((rule) => delete rule.__ruleName__);

    // keep __pluginName__
    // webpackConfig?.plugins?.forEach((plugin) => delete plugin.__pluginName__);

    if (boilerplate) {
      // DO NOT delete chromeExtensionBoilerplate, devServer needs it
      delete webpackConfig.chromeExtensionBoilerplate;
    }
  };
  [].concat(config).forEach(doClean);
}

function addPluginName(config) {
  config.plugins = config.plugins || [];
  config.plugins.forEach(pluginWithName);
}

function writePreviewWebpackConfigJson(webpackConfig, filename) {
  [].concat(webpackConfig).forEach(addPluginName);

  // eslint-disable-next-line no-extend-native
  RegExp.prototype.toJSON = RegExp.prototype.toString;
  // eslint-disable-next-line no-extend-native
  Function.prototype.toJSON = function () {
    // return `[ Function ${this.name}() ] ${this.toString()} `;
    return `[ Function ${this.name}() ]`;
  };
  fse.writeJsonSync(filename, webpackConfig, { spaces: 2 });
}

function createMultipleEntryConfigs(createConfig, multipleEntryConfigs) {
  const configs = multipleEntryConfigs.map(({ config, configUpdater }) => {
    const webpackConfig = createConfig();
    const configMerged = lodash.merge(webpackConfig, config);
    return configUpdater(configMerged);
  });
  return configs;
}

function getBuildTargetBrowser() {
  console.log('getBuildTargetBrowser: process.argv', process.argv);
  const buildTargetBrowser =
    process.argv[process.argv.length - 1] === '--firefox'
      ? 'firefox'
      : process.env.EXT_BUILD_BROWSER || 'chrome';
  process.env.EXT_BUILD_BROWSER = buildTargetBrowser;
  return buildTargetBrowser;
}

function cleanBrowserBuild() {
  const buildTargetBrowser = getBuildTargetBrowser();
  const cmd = `rm -rf ${path.resolve(
    __dirname,
    '../build',
    buildTargetBrowser,
  )}`;
  execSync(cmd);
}

module.exports = {
  execSync,
  pluginWithName,
  writePreviewWebpackConfigJson,
  cleanWebpackDebugFields,
  createMultipleEntryConfigs,
  getBuildTargetBrowser,
  cleanBrowserBuild,
};
