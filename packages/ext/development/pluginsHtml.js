const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

function createHtmlPlugin({ name }) {
  return new HtmlWebpackPlugin({
    // MUST BE .shtml different with withExpo() builtin .html
    template: path.join(__dirname, `../src/entry/ui.shtml`),
    filename: `${name}.html`,
    chunks: [name],
    cache: false,
    hash: true,
  });
}

const uiHtml = [
  'ui-popup', // main ui
  'ui-expand-tab',
  'ui-standalone-window',
  'ui-content-script-iframe', // allow site load iframe html force service-worker update
  // 'ui-options',
  // 'ui-newtab',
  // 'ui-devtools',
  // 'ui-devtools-panel',
].map((name) => createHtmlPlugin({ name }));

const backgroundHtml = ['background'].map((name) => createHtmlPlugin({ name }));

module.exports = {
  uiHtml,
  backgroundHtml,
};
