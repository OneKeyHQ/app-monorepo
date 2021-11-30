const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

function createHtmlPlugin({ folder, name }) {
  return new HtmlWebpackPlugin({
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

console.log(pluginsHtml);

module.exports = pluginsHtml;
