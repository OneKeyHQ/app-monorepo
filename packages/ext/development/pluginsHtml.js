const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

function createHtmlPlugin({ folder, name }) {
  return new HtmlWebpackPlugin({
    // MUST BE .shtml different with withExpo() builtin .html
    template: path.join(__dirname, `../src/entry/ui.shtml`),
    filename: `${name}.html`,
    chunks: [name],
    cache: false,
    hash: true,
  });
}

const pluginsHtml = [
  'ui-popup',
  // 'ui-options',
  // 'ui-newtab',
  // 'ui-devtools',
  // 'ui-devtools-panel',
].map((name) => createHtmlPlugin({ name }));

module.exports = pluginsHtml;
