/* eslint-disable @typescript-eslint/no-var-requires */
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const RemovePlugin = require('remove-files-webpack-plugin');

const path = require('path');

const SRC = 'node_modules/@onekeyhq/connect';
const DATA_SRC = `${SRC}/data`;

// iframe is not in npm, so we have its template here
const HTML_SRC = path.resolve(__dirname, 'iframe.html');

const DIST = path.resolve(__dirname, '../../app/src/public/static', 'connect');

module.exports = {
  mode: 'production',
  entry: {
    index: `./node_modules/@onekeyhq/connect/lib/index.js`,
  },
  output: {
    filename: '[name].js',
    path: DIST,
    publicPath: './',
    library: 'OneKeyConnect',
    libraryTarget: 'umd',
    libraryExport: 'default',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: ['babel-loader'],
      },
    ],
  },
  externals: {
    'react-native-threads': 'commonjs react-native-threads',
    'whatwg-fetch': 'commonjs whatwg-fetch',
  },
  resolve: {
    modules: [SRC, 'node_modules'],
  },
  performance: {
    hints: false,
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/.blake2b$/, './blake2b.js'),
    new webpack.NormalModuleReplacementPlugin(
      /env\/node$/,
      './env/react-native',
    ),
    new webpack.NormalModuleReplacementPlugin(
      /env\/node\/workers$/,
      '../env/react-native/workers',
    ),
    new webpack.NormalModuleReplacementPlugin(
      /env\/node\/networkUtils$/,
      '../env/react-native/networkUtils',
    ),

    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.NamedModulesPlugin(),
    new webpack.IgnorePlugin(/\/iconv-loader$/),
    new webpack.IgnorePlugin(/\/shared-connection-worker$/),
  ],
  optimization: {
    minimize: false,
  },

  // ignoring Node.js import in fastxpub (hd-wallet)
  node: {
    __dirname: false,
    fs: 'empty',
    path: 'empty',
    net: 'empty',
    tls: 'empty',
    child_process: 'empty',
  },
};
