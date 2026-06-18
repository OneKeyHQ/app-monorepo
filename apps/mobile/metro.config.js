/**
 * Metro configuration for React Native
 * https://github.com/facebook/metro
 *
 * This config extends '@react-native/metro-config' to support React Native >=0.73
 * For details see: https://github.com/react-native-community/template/blob/main/template/metro.config.js
 */
const path = require('path');

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withRozenite } = require('@rozenite/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const connect = require('connect');
const fs = require('fs-extra');
const { resolve } = require('metro-resolver');
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
config.watchFolders = Array.from(
  new Set([...(config.watchFolders || []), monorepoRoot]),
);
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = Array.from(
  new Set([
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
    ...(config.resolver.nodeModulesPaths || []),
  ]),
);

// When running under React Native Harness, set unstable_serverRoot to the monorepo root
// so Metro can resolve test files from packages/ (e.g. packages/shared/src/**/*.test.ts).
// Rewrite app entry bundle requests to apps/mobile/harness-entry.js (a thin wrapper
// that require('./index.ts')). The harness config must still keep entryPoint='./index.ts'
// so the harness resolver can replace that require with the runtime entry point.
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
      let bundlePath = bundleMatch[1];
      if (bundlePath === '/index.bundle') {
        bundlePath = '/harness-entry.bundle';
      }
      const normalized = path.posix.normalize(`/apps/mobile${bundlePath}`);
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
// @mysten/sui 2.x only exposes package exports; Metro package exports are disabled above.
const MYSTEN_SUI_SUBPATH_PREFIX = '@mysten/sui/';
// In production builds, redirect Developer/router to an empty stub so that
// Gallery pages and all their background-only transitive dependencies
// (core/chains, kit-bg/vaults, qr-wallet-sdk, bitcoinjs-lib, etc.) are
// completely excluded from the Metro graph — they never appear in any bundle,
// segment, or manifest.
const devRouterStub = path.resolve(
  monorepoRoot,
  'packages/kit/src/views/Developer/router.empty.ts',
);

// Ledger DMK packages only declare `exports` (no `main`). With
// unstable_enablePackageExports=false above, Metro can't find the entry
// for the bare specifier. Resolve each to its CJS entry directly.
const LEDGER_CJS_ENTRY_PACKAGES = [
  '@ledgerhq/device-management-kit',
  '@ledgerhq/device-signer-kit-ethereum',
  '@ledgerhq/device-signer-kit-solana',
  '@ledgerhq/device-transport-kit-react-native-ble',
  '@ledgerhq/context-module',
  '@ledgerhq/signer-utils',
];
// Ledger DMK packages restrict `exports` and do not expose `./package.json`,
// so `require.resolve('<pkg>/package.json')` throws ERR_PACKAGE_PATH_NOT_EXPORTED.
// Resolve via the filesystem layout in node_modules instead.
const ledgerCjsByPackage = new Map(
  LEDGER_CJS_ENTRY_PACKAGES.map((pkg) => {
    const pkgRoot = path.join(monorepoRoot, 'node_modules', pkg);
    return [pkg, path.join(pkgRoot, 'lib/cjs/index.js')];
  }),
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@nktkas/hyperliquid/signing') {
    return {
      type: 'sourceFile',
      filePath: hyperliquidSigningPath,
    };
  }
  if (
    moduleName.startsWith(MYSTEN_SUI_SUBPATH_PREFIX) &&
    moduleName.split('/').length > 2
  ) {
    try {
      const filePath = require.resolve(moduleName, { paths: [monorepoRoot] });
      return { type: 'sourceFile', filePath };
    } catch {
      // noop
    }
  }
  // Strip Developer/Gallery from production union builds
  if (
    (process.env.UNION_BUILD === 'true' ||
      process.env.SPLIT_BUNDLE_SEGMENTS === 'true') &&
    context.originModulePath &&
    (moduleName.includes('/Developer/router') ||
      moduleName.includes('/Developer/pages/Gallery'))
  ) {
    return {
      type: 'sourceFile',
      filePath: devRouterStub,
    };
  }
  // Deduplicate lodash: redirect lodash-es → lodash (CJS).
  // Both versions co-exist in common (640 + 241 = 881 modules).
  // CJS lodash is already required by project code and @onekeyfe/hd-core,
  // so aliasing lodash-es to lodash eliminates ~640 redundant modules.
  if (moduleName === 'lodash-es' || moduleName.startsWith('lodash-es/')) {
    const cjsName = moduleName.replace('lodash-es', 'lodash');
    return resolve(context, cjsName, platform);
  }
  const ledgerCjs = ledgerCjsByPackage.get(moduleName);
  if (ledgerCjs) {
    return {
      type: 'sourceFile',
      filePath: ledgerCjs,
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
    // Replace react-native-mmkv with an in-memory mock during harness tests.
    // MMKV's createMMKV() calls into JSI synchronously; after an app restart
    // in the harness the JSI bridge may hang. Tests mock appStorage anyway.
    if (moduleName === 'react-native-mmkv') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(projectRoot, 'harness/mmkvMock.js'),
      };
    }
    // Replace Testing Library with a lightweight shim that uses
    // react-test-renderer. The DOM/native packages import platform-specific
    // internals that are not suitable for the on-device Hermes harness, while
    // hook-focused tests only need renderHook/act/waitFor.
    if (
      moduleName === '@testing-library/react-native' ||
      moduleName === '@testing-library/react'
    ) {
      return {
        type: 'sourceFile',
        filePath: path.resolve(
          projectRoot,
          'harness/testing-library-react-native-shim.tsx',
        ),
      };
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

const buildTimeEnv = require('@onekeyhq/shared/src/buildTimeEnv');
const getMetroRuntimeTarget = (context) =>
  context.customResolverOptions?.runtimeTarget ||
  process.env.METRO_RUNTIME_TARGET ||
  'main';

// --- Native background thread: prefer `.native-ui` in the main runtime ---
// In native background-thread mode, main-thread JS should prefer the
// `backgroundApiInit.native-ui.*` variant, then fall back to Metro's normal
// resolution for `backgroundApiInit` (`.native.*` -> plain source files).
//
// Runtime target is resolved per Metro request first, then from the build-time
// env for release bundle builds.
if (buildTimeEnv.enableNativeBackgroundThread) {
  const prevResolveRequestForNativeUi = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const runtimeTarget = getMetroRuntimeTarget(context);
    const isMainRuntime = runtimeTarget === 'main';

    if (
      isMainRuntime &&
      moduleName === './backgroundApiInit' &&
      context.originModulePath &&
      context.originModulePath.includes(
        'background/instance/backgroundApiProxy',
      )
    ) {
      try {
        return prevResolveRequestForNativeUi(
          context,
          './backgroundApiInit.native-ui',
          platform,
        );
      } catch {
        // Fall through to Metro's default priority:
        // `.native.*` -> plain source file.
      }
    }
    return prevResolveRequestForNativeUi(context, moduleName, platform);
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
config.server.rewriteRequestUrl = (url) => {
  let rewrittenUrl = originalRewriteRequestUrl(url).replace(
    '&lazy=true',
    '&lazy=false',
  );

  if (rewrittenUrl.startsWith('/background.bundle')) {
    rewrittenUrl = rewrittenUrl.replace(
      '/background.bundle',
      '/apps/mobile/background.bundle',
    );
  }

  if (
    buildTimeEnv.enableNativeBackgroundThread &&
    !rewrittenUrl.includes('resolver.runtimeTarget=')
  ) {
    const runtimeTarget = rewrittenUrl.startsWith(
      '/apps/mobile/background.bundle',
    )
      ? 'background'
      : 'main';
    rewrittenUrl = `${rewrittenUrl}${
      rewrittenUrl.includes('?') ? '&' : '?'
    }resolver.runtimeTarget=${runtimeTarget}`;
  }

  return rewrittenUrl;
};

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
    const prefixPath = AssetsPaths.find((p) => req.url.startsWith(p));
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
  // enhanceMetroConfig: (cfg) => withRozeniteExpoAtlasPlugin(cfg),
  enhanceMetroConfig: (cfg) => cfg,
});
