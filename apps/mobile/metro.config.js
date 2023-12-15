/* eslint-disable spellcheck/spell-checker */
// Learn more https://docs.expo.dev/guides/monorepos
const { getDefaultConfig } = require('expo/metro-config');
// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
// const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;

// hot-reload file type
// cjs is needed for superstruct: https://github.com/ianstormtaylor/superstruct/issues/404#issuecomment-800182972
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'text-js',
  'd.ts',
  'cjs',
  'min.js',
];
// https://www.npmjs.com/package/node-libs-react-native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve(
    '@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.native.js',
  ),
  fs: require.resolve('react-native-level-fs'),
  path: require.resolve('path-browserify'),
  stream: require.resolve('readable-stream'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  net: require.resolve('react-native-tcp-socket'),
  tls: require.resolve('react-native-tcp-socket'),
  zlib: require.resolve('browserify-zlib'),
};

const splitCodePlugin = require('./plugins');

module.exports = splitCodePlugin(config, projectRoot);
