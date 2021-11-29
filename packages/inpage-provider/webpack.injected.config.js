const path = require('path');
const config = require('./webpack.config');

const IS_DEV = process.env.NODE_ENV !== 'production';

module.exports = {
  ...config,
  // Fix: "Uncaught ReferenceError: global is not defined", and "Can't resolve 'fs'".
  // node: { global: true, fs: 'empty' },
  devtool: IS_DEV ? 'inline-source-map' : undefined,
  target: 'electron-preload', // web, electron-preload, electron-renderer, node12.18.2
  entry: {
    injectedDesktop: './src/injected/injectedDesktop.tsx',
    injectedNative: './src/injected/injectedNative.tsx',
  },
  output: {
    // libraryTarget: 'umd' // Fix: "Uncaught ReferenceError: exports is not defined".
    path: path.resolve(__dirname, 'src/injected-autogen'),
    filename: '[name].text.js',
  },
};
