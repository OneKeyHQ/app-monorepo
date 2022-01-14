const path = require('path');
const config = require('./webpack.config');

const IS_PRD = process.env.NODE_ENV === 'production';

console.log('============ , IS_PRD', IS_PRD, process.env.NODE_ENV);

module.exports = {
  ...config,
  // Fix: "Uncaught ReferenceError: global is not defined", and "Can't resolve 'fs'".
  // node: { global: true, fs: 'empty' },
  // resolve: {
  //   fallback: {
  //     fs: false,
  //   },
  // },

  devtool: IS_PRD ? undefined : 'inline-source-map',
  target: 'electron-preload', // web, electron-preload, electron-renderer, node12.18.2
  entry: {
    injectedDesktop: './src/injected/injectedDesktop.tsx',
    injectedNative: './src/injected/injectedNative.tsx',
    injectedExtension: './src/injected/injectedExtension.tsx',
  },
  output: {
    // Fix: "Uncaught ReferenceError: exports is not defined".
    // Fix: JIRA window.require('...') error
    libraryTarget: 'umd',
    // Fix: "Uncaught ReferenceError: global is not defined"
    globalObject: 'window',
    path: path.resolve(__dirname, 'src/injected-autogen'),
    filename: '[name].text.js',
  },
};
