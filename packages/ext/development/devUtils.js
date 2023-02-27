const fse = require('fs-extra');
const fs = require('fs');
const lodash = require('lodash');
const childProcess = require('child_process');
const path = require('path');
const util = require('util');
const replicator = require('console-feed/lib/Transform');

function execSync(cmd) {
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
  try {
    fse.writeJsonSync(filename, webpackConfig, { spaces: 2 });
  } catch (error) {
    console.error(error);
    console.log(
      '>>>>>>>> Fallback to console-feed replicator.Encode() <<<<<<<<<',
    );
    fse.writeJsonSync(filename, replicator.Encode(webpackConfig), {
      spaces: 2,
    });
  } finally {
    // noop
  }
  // fs.writeFileSync(filename, util.inspect(webpackConfig), {
  //   encoding: 'utf-8',
  // });
}

function createMultipleEntryConfigs(createConfig, multipleEntryConfigs) {
  const configs = multipleEntryConfigs.map(({ config, configUpdater }) => {
    const webpackConfig = createConfig({ config });
    const configMerged = lodash.merge(webpackConfig, config);
    return configUpdater(configMerged);
  });
  return configs;
}
// firefox chrome edge
function getBuildTargetBrowser() {
  console.log('getBuildTargetBrowser: process.argv', process.argv);
  let buildTargetBrowser = process.env.EXT_CHANNEL || 'chrome';
  const argv = process.argv[process.argv.length - 1];
  if (argv === '--firefox') {
    buildTargetBrowser = 'firefox';
  }
  if (argv === '--chrome') {
    buildTargetBrowser = 'chrome';
  }
  // if (argv === '--edge') {
  //   buildTargetBrowser = 'edge';
  // }
  process.env.EXT_CHANNEL = buildTargetBrowser;
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
