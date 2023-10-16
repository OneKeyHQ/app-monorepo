const fse = require('fs-extra');
// const fs = require('fs');
const lodash = require('lodash');
const childProcess = require('child_process');
const path = require('path');
// const util = require('util');
const stringify = require('json-stringify-safe');
const prettier = require('prettier');
const manifest = require('../src/manifest');

// TODO move to developmentConsts.js
const consts = {
  configName: {
    bg: 'bg',
    offscreen: 'offscreen',
    ui: 'ui',
    cs: 'cs',
  },
  entry: {
    'ui-popup': 'ui-popup',
    'ui-devtools': 'ui-devtools',
    'background': 'background',
    'offscreen': 'offscreen',
    'content-script': 'content-script',
  },
};

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
  fse.writeFileSync(
    filename,
    prettier.format(stringify(webpackConfig), { parser: 'json' }),
  );
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
  let buildTargetBrowser = process.env.EXT_CHANNEL || 'chrome';
  const argv = process.argv[process.argv.length - 1];
  if (argv === '--firefox') {
    buildTargetBrowser = 'firefox';
  }
  if (argv === '--chrome') {
    buildTargetBrowser = 'chrome';
  }
  if (argv === '--edge') {
    buildTargetBrowser = 'edge';
  }
  process.env.EXT_CHANNEL = buildTargetBrowser;
  return buildTargetBrowser;
}

function getOutputFolder() {
  // isManifestV3 ? `${buildTargetBrowser}_v3` : buildTargetBrowser,
  const buildTargetBrowser = getBuildTargetBrowser();
  return isManifestV3() ? `${buildTargetBrowser}_v3` : buildTargetBrowser;
}

function isBuildTargetBrowserChromeLike() {
  const buildTargetBrowser = getBuildTargetBrowser();
  return buildTargetBrowser === 'chrome' || buildTargetBrowser === 'edge';
}

function isBuildTargetBrowserFirefox() {
  const buildTargetBrowser = getBuildTargetBrowser();
  return buildTargetBrowser === 'firefox';
}

function cleanBrowserBuild() {
  const outputFolder = getOutputFolder();
  const cmd = `rm -rf ${path.resolve(__dirname, '../build', outputFolder)}`;
  execSync(cmd);
}

function isManifestV3() {
  const isManifestV3 = manifest.manifest_version >= 3;
  return isManifestV3;
}

function isManifestV2() {
  return !isManifestV3();
}

function addBabelLoaderPlugin({ config, isPrepend, plugins }) {
  const { rules } = config.module;
  // eslint-disable-next-line no-param-reassign
  plugins = [].concat(plugins);
  rules.forEach((rule) => {
    const uses = [].concat(rule.use || []);
    uses.forEach((use) => {
      const loader = typeof use === 'string' ? use : use.loader;
      if (
        loader === 'babel-loader' ||
        loader.includes(
          'node_modules/@expo/next-adapter/node_modules/babel-loader/lib/index.js',
        )
      ) {
        // rule.test.toString() === '/\\.+(js|jsx|mjs|ts|tsx)$/'
        const ruleTestRegex = rule.test.toString();
        use.options = use.options || {};
        use.options.plugins = use.options.plugins || [];
        const configName = config.name;
        if (isPrepend) {
          use.options.plugins = [...plugins, ...use.options.plugins];
        } else {
          use.options.plugins = [...use.options.plugins, ...plugins];
        }
      }
    });
  });
}

module.exports = {
  consts,
  execSync,
  pluginWithName,
  writePreviewWebpackConfigJson,
  cleanWebpackDebugFields,
  createMultipleEntryConfigs,
  getBuildTargetBrowser,
  getOutputFolder,
  isBuildTargetBrowserChromeLike,
  isBuildTargetBrowserFirefox,
  cleanBrowserBuild,
  isManifestV2,
  isManifestV3,
  addBabelLoaderPlugin,
};
