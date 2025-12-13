/**
 * Metro configuration for React Native
 * https://github.com/facebook/metro
 *
 * This config extends '@react-native/metro-config' to support React Native >=0.73
 * For details see: https://github.com/react-native-community/template/blob/main/template/metro.config.js
 */
const connect = require('connect');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withRozenite } = require('@rozenite/metro');
const path = require('path');
const fs = require('fs-extra');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
// const { withRozeniteExpoAtlasPlugin } = require('@rozenite/expo-atlas-plugin'); // Uncomment if needed

const projectRoot = __dirname;

// Get Metro's default config for the project
const defaultConfig = getDefaultConfig(projectRoot);

// Use Sentry Expo's Metro config as a base, merged with the RN default config
const sentryConfig = getSentryExpoConfig(projectRoot);
const config = mergeConfig(defaultConfig, sentryConfig);

config.projectRoot = projectRoot;

// Allow custom hot-reload and third-party extensions
config.resolver = config.resolver || {};
config.resolver.sourceExts = [
  ...(config.resolver.sourceExts || []),
  'text-js',
  'd.ts',
  'cjs', // Needed for superstruct: https://github.com/ianstormtaylor/superstruct/issues/404#issuecomment-800182972
  'min.js',
];

// Provide extra shims/polyfills for node modules
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
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

// Fix for Metro resolver with "subpath exports"
config.resolver.unstable_enablePackageExports = false;

// ---- Optional monorepo setup for Yarn workspaces (commented) ----
// const workspaceRoot = path.resolve(projectRoot, '../..');
// config.watchFolders = [workspaceRoot];
// config.resolver.nodeModulesPaths = [
//   path.resolve(projectRoot, 'node_modules'),
//   path.resolve(workspaceRoot, 'node_modules'),
// ];
// config.resolver.disableHierarchicalLookup = true;
// ---------------------------------------------------------------

// Ensure cache directories exist
const fileMapCacheDirectoryPath = path.resolve(
  projectRoot,
  'node_modules',
  '.cache/file-map-cache',
);
fs.ensureDirSync(fileMapCacheDirectoryPath);
const cacheStoreDirectoryPath = path.resolve(
  projectRoot,
  'node_modules',
  '.cache/metro-cache',
);
fs.ensureDirSync(cacheStoreDirectoryPath);

config.fileMapCacheDirectory = fileMapCacheDirectoryPath;
config.cacheStores = ({ FileStore }) => [
  new FileStore({
    root: cacheStoreDirectoryPath,
  }),
];

// Patch for lazy compilation instability: always set lazy=false in bundle requests
const orignalRewriteRequestUrl =
  config.server && config.server.rewriteRequestUrl
    ? config.server.rewriteRequestUrl
    : (url) => url;
config.server = config.server || {};
config.server.rewriteRequestUrl = (url) =>
  orignalRewriteRequestUrl(url).replace('&lazy=true', '&lazy=false');

// Apply split code plugin, then wrap with Rozenite plugin
const splitCodePlugin = require('./plugins');

const GET_TOP_DIR_SYMBOL = 'relative_dir_symbol';
const buildRelativeDirPath = (url, depth = 2) => {
  const symbols = Array.from({ length: depth }, () => GET_TOP_DIR_SYMBOL).join(
    '/',
  );
  return `/assets/${symbols}${url}`;
};

const AssetsPaths = [
  '/packages/shared/src/assets/',
  '/packages/components/src/hocs/Provider/fonts/',
  '/node_modules/@expo-google-fonts',
  '/packages/kit/assets',
];

const applyFixImageAssetsMiddleware = (middleware) => {
  return (req, res, next) => {
    console.log('metro-sever: >>>>>', req.url);
    // Android asset path fix
    const prefixPath = AssetsPaths.find((path) => req.url.startsWith(path));
    if (prefixPath) {
      req.url = req.url.replace(prefixPath, buildRelativeDirPath(prefixPath));
      console.log(
        'metro-sever: >>>>> the asset path is auto fixed >>>>>',
        req.url,
      );
    } else if (req.url.startsWith('/assets/')) {
      // iOS asset path fix
      req.url = req.url.replaceAll('../', `${GET_TOP_DIR_SYMBOL}/`);
      console.log(
        'metro-sever: >>>>> the asset path is auto fixed >>>>>',
        req.url,
      );
    }
    return middleware(req, res, next);
  };
};

const outputChunkDir = path.resolve(projectRoot, 'dist/chunks');
config.server.enhanceMiddleware = (metroMiddleware, metroServer) =>
  connect().use(applyFixImageAssetsMiddleware(metroMiddleware));

module.exports = withRozenite(splitCodePlugin(config, projectRoot), {
  enabled: process.env.WITH_ROZENITE === 'true',
  // enhanceMetroConfig: (config) => withRozeniteExpoAtlasPlugin(config),
  enhanceMetroConfig: (config) => config,
});
