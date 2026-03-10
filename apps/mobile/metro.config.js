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
const { resolve } = require('metro-resolver');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
// const { withRozeniteExpoAtlasPlugin } = require('@rozenite/expo-atlas-plugin'); // Uncomment if needed

const projectRoot = __dirname;

// Pre-calculate monorepo root for use in multiple places
const monorepoRoot = path.resolve(projectRoot, '../..');

// Get Metro's default config for the project
const defaultConfig = getDefaultConfig(projectRoot);

// Use Sentry Expo's Metro config as a base, merged with the RN default config
const sentryConfig = getSentryExpoConfig(projectRoot);
const config = mergeConfig(defaultConfig, sentryConfig);

config.projectRoot = projectRoot;

// When running under React Native Harness, set unstable_serverRoot to the monorepo root
// so Metro can resolve test files from packages/ (e.g. packages/shared/src/**/*.test.ts).
// Rewrite the Expo virtual metro entry to apps/mobile/harness-entry.js (a thin wrapper
// that require('./index.ts')). The harness resolver intercepts that require and replaces
// it with the harness runtime entry point.
if (process.env.RN_HARNESS === 'true') {
  config.server = config.server || {};
  config.server.unstable_serverRoot = monorepoRoot;
  const expoRewrite = config.server.rewriteRequestUrl || ((url) => url);
  config.server.rewriteRequestUrl = (url) => {
    // Handle Expo virtual entry first (before the general rewrite)
    if (url.includes('/.expo/.virtual-metro-entry.bundle')) {
      // oxlint-disable-next-line no-param-reassign
      url = url.replace(
        '/.expo/.virtual-metro-entry',
        '/apps/mobile/harness-entry',
      );
      return expoRewrite(url);
    }
    // The harness constructs bundle URLs relative to projectRoot (apps/mobile/),
    // but Metro resolves from unstable_serverRoot (monorepo root).
    // Prefix all .bundle requests with /apps/mobile and normalize to translate:
    //   /index.bundle              -> /apps/mobile/index.bundle
    //   /jest-harness-setup.bundle -> /apps/mobile/jest-harness-setup.bundle
    //   /../../packages/core/x.bundle -> /packages/core/x.bundle
    const bundleMatch = url.match(/^(\/[^?]*\.bundle)(.*)/);
    if (bundleMatch) {
      const normalized = path.posix.normalize(`/apps/mobile${bundleMatch[1]}`);
      // oxlint-disable-next-line no-param-reassign
      url = normalized + bundleMatch[2];
    }
    return expoRewrite(url);
  };
}

// Allow custom hot-reload and third-party extensions
config.resolver = config.resolver || {};
config.resolver.sourceExts = [
  ...(config.resolver.sourceExts || []),
  'text-js',
  'd.ts',
  'cjs', // Needed for superstruct: https://github.com/ianstormtaylor/superstruct/issues/404#issuecomment-800182972
  'min.js',
  'svgx', // For react-native-bottom-tabs SVG icons (using .svgx to avoid conflict with react-native-svg)
];

// Configure SVG transformer for .svgx files (used by react-native-bottom-tabs)
config.resolver.assetExts = (config.resolver.assetExts || []).filter(
  (ext) => ext !== 'svgx',
);
config.transformer = config.transformer || {};
config.transformer.babelTransformerPath =
  require.resolve('./svgx-transformer.js');

// Provide extra shims/polyfills for node modules
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto:
    require.resolve('@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.native.js'),
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

// Manual alias for a subpath export when package exports are disabled.
const hyperliquidSigningPath = require.resolve('@nktkas/hyperliquid/signing');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@nktkas/hyperliquid/signing') {
    return {
      type: 'sourceFile',
      filePath: hyperliquidSigningPath,
    };
  }
  return resolve(context, moduleName, platform);
};

// When running under React Native Harness, manually resolve subpath exports
// for harness and vitest packages that Metro can't handle with unstable_enablePackageExports=false.
// Also map lodash-es to lodash (matching Jest's moduleNameMapper for test compatibility).
if (process.env.RN_HARNESS === 'true') {
  const subpathPrefixes = ['@react-native-harness/', '@vitest/'];
  const prevResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Handle absolute paths from monorepo root (e.g., /packages/core/src/...)
    // These come from Harness test bundle requests after URL rewriting
    if (moduleName.startsWith('/packages/')) {
      const absolutePath = path.join(monorepoRoot, moduleName);
      // Try to resolve with platform extensions
      const extensions = [
        '',
        `.${platform}.ts`,
        `.${platform}.tsx`,
        '.ts',
        '.tsx',
        `.${platform}.js`,
        `.${platform}.jsx`,
        '.js',
        '.jsx',
      ];
      for (const ext of extensions) {
        const fullPath = absolutePath + ext;
        if (fs.existsSync(fullPath)) {
          return { type: 'sourceFile', filePath: fullPath };
        }
      }
    }
    // Handle paths that were incorrectly resolved by TsConfigResolver
    // e.g., ./apps/mobile/packages/core/src/... -> /packages/core/src/...
    if (moduleName.startsWith('./apps/mobile/packages/')) {
      const correctedPath = moduleName.replace(/^\.\/apps\/mobile\//, '');
      const absolutePath = path.join(monorepoRoot, correctedPath);
      const extensions = [
        '',
        `.${platform}.ts`,
        `.${platform}.tsx`,
        '.ts',
        '.tsx',
        `.${platform}.js`,
        `.${platform}.jsx`,
        '.js',
        '.jsx',
      ];
      for (const ext of extensions) {
        const fullPath = absolutePath + ext;
        if (fs.existsSync(fullPath)) {
          return { type: 'sourceFile', filePath: fullPath };
        }
      }
    }
    // Map lodash-es to lodash (same as Jest moduleNameMapper: '^lodash-es$': 'lodash')
    if (moduleName === 'lodash-es') {
      return prevResolveRequest(context, 'lodash', platform);
    }
    if (
      subpathPrefixes.some((prefix) => moduleName.startsWith(prefix)) &&
      moduleName.split('/').length > 2
    ) {
      try {
        const filePath = require.resolve(moduleName);
        return { type: 'sourceFile', filePath };
      } catch {
        // noop
      }
    }
    return prevResolveRequest(context, moduleName, platform);
  };
}

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
const originalRewriteRequestUrl =
  config.server && config.server.rewriteRequestUrl
    ? config.server.rewriteRequestUrl
    : (url) => url;
config.server = config.server || {};
config.server.rewriteRequestUrl = (url) =>
  originalRewriteRequestUrl(url).replace('&lazy=true', '&lazy=false');

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
    } else if (
      req.url.startsWith('/packages/components/svg/') &&
      req.url.includes('.svg')
    ) {
      req.url = req.url.replace(
        '/packages/components/svg/',
        buildRelativeDirPath('/packages/components/svg/'),
      );
      console.log(
        'metro-sever: >>>>> the svg asset path is auto fixed >>>>>',
        req.url,
      );
    }
    return middleware(req, res, next);
  };
};

config.server.enhanceMiddleware = (metroMiddleware, _metroServer) =>
  connect().use(applyFixImageAssetsMiddleware(metroMiddleware));

module.exports = withRozenite(splitCodePlugin(config, projectRoot), {
  enabled: process.env.WITH_ROZENITE === 'true',
  // enhanceMetroConfig: (config) => withRozeniteExpoAtlasPlugin(config),
  enhanceMetroConfig: (config) => config,
});
