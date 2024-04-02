const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const lodash = require('lodash');
const indexHtmlParameter = require('../../../development/indexHtmlParameter');
const developmentConsts = require('../../../development/developmentConsts');
const devUtils = require('./devUtils');

const platform = developmentConsts.platforms.ext;

// https://github.com/facebook/create-react-app/blob/main/packages/react-dev-utils/InterpolateHtmlPlugin.js
function createHtmlPlugin({ name }) {
  const filename = `${name}.html`;
  const htmlLoader = `!!ejs-loader?esModule=false!`;
  const createParamsOptions = {
    filename,
    platform,
    browser: devUtils.getBuildTargetBrowser(),
  };
  const htmlWebpackPlugin = new HtmlWebpackPlugin({
    // MUST BE .shtml different with withExpo() builtin .html loader
    template: `${htmlLoader}${path.join(
      __dirname,
      `../../shared/src/web/index.html.ejs`,
    )}`,
    templateParameters: indexHtmlParameter.createEjsParams(createParamsOptions),
    // output filename
    filename,
    chunks: [name],
    cache: false,
    hash: true,
  });
  const interpolateHtmlPlugin = new InterpolateHtmlPlugin(
    HtmlWebpackPlugin,
    indexHtmlParameter.createInterpolateParams(createParamsOptions),
  );
  return [htmlWebpackPlugin, interpolateHtmlPlugin];
}

let uiHtml = [
  'ui-popup', // main ui
  'ui-expand-tab',
  'ui-side-panel',
  'ui-standalone-window',
  'ui-content-script-iframe', // allow site load iframe html force service-worker update
  // 'ui-options',
  // 'ui-newtab',
  // 'ui-devtools',
  // 'ui-devtools-panel',
].map((name) => createHtmlPlugin({ name }));
uiHtml = lodash.flatten(uiHtml);

let backgroundHtml = [devUtils.consts.entry.background].map((name) =>
  createHtmlPlugin({ name }),
);
backgroundHtml = lodash.flatten(backgroundHtml);

let offscreenHtml = [devUtils.consts.entry.offscreen].map((name) =>
  createHtmlPlugin({ name }),
);
offscreenHtml = lodash.flatten(offscreenHtml);

module.exports = {
  uiHtml,
  backgroundHtml,
  offscreenHtml,
};
