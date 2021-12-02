const fse = require('fs-extra');

function pluginWithName(plugin) {
  plugin.__pluginName__ = plugin.constructor.name;
  return plugin;
}

function cleanWebpackDebugFields(webpackConfig) {
  webpackConfig?.module?.rules?.forEach((rule) => delete rule.__ruleName__);
  delete webpackConfig.chromeExtensionBoilerplate;
}

function writePreviewWebpackConfigJson(webpackConfig, filename) {
  webpackConfig.plugins = webpackConfig.plugins || [];
  webpackConfig.plugins.forEach(pluginWithName);

  // eslint-disable-next-line no-extend-native
  RegExp.prototype.toJSON = RegExp.prototype.toString;
  // eslint-disable-next-line no-extend-native
  Function.prototype.toJSON = function () {
    // return `[ Function ${this.name}() ] ${this.toString()} `;
    return `[ Function ${this.name}() ]`;
  };
  fse.writeJsonSync(filename, webpackConfig, { spaces: 2 });
  cleanWebpackDebugFields(webpackConfig);
}

module.exports = {
  pluginWithName,
  writePreviewWebpackConfigJson,
  cleanWebpackDebugFields,
};
