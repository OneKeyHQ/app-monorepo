/**
 * Metro configuration for React Native
 * https://github.com/facebook/metro
 *
 * This config extends '@react-native/metro-config' to support React Native >=0.73
 * For details see: https://github.com/react-native-community/template/blob/main/template/metro.config.js
 */
const path = require('path');

// This must run before Metro dependencies load the Babel/environment config.
// oxlint-disable-next-line import-js/order
const devVendorConfig = require('./dev-vendor.config');

if (process.env.ONEKEY_DEV_VENDOR === 'true') {
  devVendorConfig.applyTransformationEnvironment(process.env);
}

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withRozenite } = require('@rozenite/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const {
  withStorybook,
} = require('@storybook/react-native/metro/withStorybook');
const fs = require('fs-extra');
const { resolve } = require('metro-resolver');

const buildTimeEnv = require('@onekeyhq/shared/src/buildTimeEnv');

const splitCodePlugin = require('./plugins');
const {
  applyDevVendorConfig,
  isDevVendorEnabled,
} = require('./plugins/devVendor');
const {
  getThirdPartyMMKVImportError,
} = require('./scripts/native-storage-metro-policy');
// const { withRozeniteExpoAtlasPlugin } = require('@rozenite/expo-atlas-plugin'); // Uncomment if needed

const projectRoot = __dirname;

// Pre-calculate monorepo root for use in multiple places
const monorepoRoot = path.resolve(projectRoot, '../..');

// Get Metro's default config for the project
const defaultConfig = getDefaultConfig(projectRoot);

// Use Sentry Expo's Metro config as a base, merged with the RN default config
const sentryConfig = getSentryExpoConfig(projectRoot);
const config = mergeConfig(defaultConfig, sentryConfig);

// Expo CLI normally injects this polyfill around Metro. Our native release and
// union builders call Metro directly, so include it in the shared config too.
const originalGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (options) =>
  Array.from(
    new Set([
      ...originalGetPolyfills(options),
      require.resolve('expo/virtual/streams.js'),
    ]),
  );

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
config.resolver.assetExts = Array.from(
  new Set([
    ...(config.resolver.assetExts || []).filter((ext) => ext !== 'svgx'),
    'txt',
  ]),
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

// OneKey HWK SDK sub-path aliases. With
// `unstable_enablePackageExports=false` above, Metro can't read the `exports`
// map in the SDK packages, so each sub-path consumer apps import (e.g.
// `@onekeyfe/hwk-adapter-core/errors`) needs an explicit redirect. We
// `require.resolve` here in Node-land where the `exports` map IS honored, so
// the target file path is correct.
//
// When the SDK adds new sub-paths (or `unstable_enablePackageExports` becomes
// safe to enable globally), append/remove entries from this array.
const HWK_SUBPATH_ALIASES = [
  '@onekeyfe/hwk-adapter-core/errors',
  '@onekeyfe/hwk-adapter-core/ui-events',
  '@onekeyfe/hwk-trezor-connector-webusb/constants',
];
const hwkSubpathAliasMap = new Map(
  HWK_SUBPATH_ALIASES.map((spec) => [spec, require.resolve(spec)]),
);

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
// react-native-purchases statically imports its browser implementation, which
// otherwise pulls the full purchases-js runtime into native bundles even
// though the linked RNPurchases module is always selected on iOS and Android.
const revenueCatBrowserMappingsStub = path.resolve(
  projectRoot,
  'shims/revenueCatBrowserMappings.js',
);
// Aptos SDK 1.39 statically imports an unused script composer whose generated
// WASM byte array expands to more than 11 MB in Hermes bytecode.
const aptosScriptComposerNativeStub = path.resolve(
  monorepoRoot,
  'node_modules/@aptos-labs/script-composer-pack/dist/react-native.js',
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
  if (
    (platform === 'ios' || platform === 'android') &&
    moduleName === '@aptos-labs/script-composer-pack'
  ) {
    return {
      type: 'sourceFile',
      filePath: aptosScriptComposerNativeStub,
    };
  }
  if (
    (platform === 'ios' || platform === 'android') &&
    moduleName === '@revenuecat/purchases-js-hybrid-mappings'
  ) {
    return {
      type: 'sourceFile',
      filePath: revenueCatBrowserMappingsStub,
    };
  }
  if (moduleName === '@nktkas/hyperliquid/signing') {
    return {
      type: 'sourceFile',
      filePath: hyperliquidSigningPath,
    };
  }
  // OneKey HWK SDK sub-path resolution (see HWK_SUBPATH_ALIASES above).
  const hwkAliasPath = hwkSubpathAliasMap.get(moduleName);
  if (hwkAliasPath) {
    return {
      type: 'sourceFile',
      filePath: hwkAliasPath,
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
    const normalizedOriginModulePath = context.originModulePath?.replaceAll(
      '\\',
      '/',
    );
    const isLocalSecretEnvelopeNativeMmkvStorage =
      normalizedOriginModulePath?.includes(
        '/packages/kit-bg/src/dbs/local/localSecretEnvelope/mmkvProfileKeyStorage.native.',
      );
    // Most harness tests use an in-memory MMKV facade because appStorage is
    // mocked. The native LSE storage adapter is the deliberate exception: its
    // restart suite must exercise the real JSI-backed persistent MMKV instance.
    if (
      moduleName === 'react-native-mmkv' &&
      !isLocalSecretEnvelopeNativeMmkvStorage
    ) {
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

// Metro does not include environment variables read by Babel plugins in its
// transform cache key. Keep bundles compiled with different runtime layouts
// in separate cache namespaces.
config.cacheVersion = `${config.cacheVersion || 'default'}:native-bg-${
  buildTimeEnv.enableNativeBackgroundThread ? 'enabled' : 'disabled'
}`;
if (isDevVendorEnabled()) {
  config.cacheVersion = `${config.cacheVersion}:dev-vendor-v1`;
}

if (buildTimeEnv.isDev && buildTimeEnv.enableNativeBackgroundThread) {
  const configuredMaxWorkers = Number.parseInt(
    process.env.NATIVE_DEV_METRO_MAX_WORKERS || '',
    10,
  );
  // Native development builds the main and background graphs concurrently.
  // Cap the transform pool so a full refresh does not exhaust host memory.
  config.maxWorkers =
    Number.isInteger(configuredMaxWorkers) && configuredMaxWorkers > 0
      ? configuredMaxWorkers
      : 2;
}

const getMetroRuntimeTarget = (context) =>
  context.customResolverOptions?.runtimeTarget ||
  process.env.METRO_RUNTIME_TARGET ||
  'main';

// Native storage ownership is enforced at bundle resolution as well as at
// runtime. This redirects application and third-party AsyncStorage imports to
// the compatible bg proxy without patching dependencies. Deep imports are
// rejected because they could bypass the adapter. MMKV itself resolves to a
// throwing guard in main bundles.
{
  const previousResolveRequest = config.resolver.resolveRequest;
  const asyncStorageAdapter = path.resolve(
    monorepoRoot,
    'packages/shared/src/storage/instance/nativeAsyncStorageInstance.ts',
  );
  const mmkvMainGuard = path.resolve(
    projectRoot,
    'shims/reactNativeMMKVMainGuard.js',
  );
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const thirdPartyMMKVImportError = getThirdPartyMMKVImportError({
      moduleName,
      originModulePath: context.originModulePath,
    });
    if (thirdPartyMMKVImportError) {
      // eslint-disable-next-line onekey/no-raw-error -- Metro config runs in Node before app error classes are available.
      throw new Error(thirdPartyMMKVImportError);
    }
    if (moduleName === '@react-native-async-storage/async-storage') {
      return { type: 'sourceFile', filePath: asyncStorageAdapter };
    }
    if (moduleName.startsWith('@react-native-async-storage/async-storage/')) {
      // eslint-disable-next-line onekey/no-raw-error -- Metro config runs in Node before app error classes are available.
      throw new Error(
        `AsyncStorage deep import bypasses the native bg proxy: ${moduleName}`,
      );
    }
    if (
      moduleName === 'react-native-mmkv' &&
      getMetroRuntimeTarget(context) !== 'background' &&
      process.env.RN_HARNESS !== 'true'
    ) {
      return { type: 'sourceFile', filePath: mmkvMainGuard };
    }
    if (
      moduleName.startsWith('react-native-mmkv/') &&
      getMetroRuntimeTarget(context) !== 'background' &&
      process.env.RN_HARNESS !== 'true'
    ) {
      // eslint-disable-next-line onekey/no-raw-error -- Metro config runs in Node before app error classes are available.
      throw new Error(
        `MMKV deep import bypasses the native main-runtime guard: ${moduleName}`,
      );
    }
    return previousResolveRequest(context, moduleName, platform);
  };
}

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
const cacheStoreDirectoryPath = path.resolve(
  projectRoot,
  'node_modules',
  '.cache/metro-cache',
);
fs.ensureDirSync(cacheStoreDirectoryPath);

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

  if (
    isDevVendorEnabled() &&
    !rewrittenUrl.includes('dev=false') &&
    !rewrittenUrl.includes('resolver.devVendor=') &&
    /\.(?:bundle|map)(?:\?|$)/.test(rewrittenUrl)
  ) {
    rewrittenUrl = `${rewrittenUrl}${
      rewrittenUrl.includes('?') ? '&' : '?'
    }resolver.devVendor=true`;
  }
  if (
    isDevVendorEnabled() &&
    !rewrittenUrl.includes('dev=false') &&
    !rewrittenUrl.includes('unstable_transformProfile=') &&
    /\.(?:bundle|map)(?:\?|$)/.test(rewrittenUrl)
  ) {
    rewrittenUrl = `${rewrittenUrl}${
      rewrittenUrl.includes('?') ? '&' : '?'
    }unstable_transformProfile=hermes-stable`;
  }

  return rewrittenUrl;
};

// Apply split code plugin, then wrap with Rozenite plugin
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

const DEV_SESSION_WEB_EMBED_PREFIX = '/onekey-dev-session/web-embed/';
const DEV_SESSION_WEB_EMBED_ROOT = path.join(
  monorepoRoot,
  'apps/web-embed/web-build',
);
const DEV_SESSION_WEB_EMBED_CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
]);

const serveDevSessionWebEmbed = (req, res, next) => {
  if (
    !process.env.ONEKEY_DEV_SESSION_ID ||
    !req.url.startsWith(DEV_SESSION_WEB_EMBED_PREFIX)
  ) {
    return next();
  }
  let relativePath;
  try {
    relativePath = decodeURIComponent(
      req.url.slice(DEV_SESSION_WEB_EMBED_PREFIX.length).split('?', 1)[0],
    );
  } catch {
    res.statusCode = 400;
    res.end('Invalid web-embed path.');
    return undefined;
  }
  const filePath = path.resolve(DEV_SESSION_WEB_EMBED_ROOT, relativePath);
  if (
    !relativePath ||
    !filePath.startsWith(`${DEV_SESSION_WEB_EMBED_ROOT}${path.sep}`) ||
    !fs.existsSync(filePath) ||
    !fs.statSync(filePath).isFile()
  ) {
    res.statusCode = 404;
    res.end('Web-embed asset not found.');
    return undefined;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Content-Type',
    DEV_SESSION_WEB_EMBED_CONTENT_TYPES.get(path.extname(filePath)) ||
      'application/octet-stream',
  );
  fs.createReadStream(filePath).pipe(res);
  return undefined;
};

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

config.server.enhanceMiddleware = (metroMiddleware, _metroServer) => {
  const assetMiddleware = applyFixImageAssetsMiddleware(metroMiddleware);
  return (req, res, next) =>
    serveDevSessionWebEmbed(req, res, () => assetMiddleware(req, res, next));
};

// STORYBOOK_ENABLED gates the app entry via babel env inlining, which Metro's
// transform-cache key cannot see — flipping modes would serve stale transforms
// (e.g. the wallet entry inside storybook mode). Namespace the cache per mode
// so both stay correct and cached without `--clear` on every switch.
config.cacheVersion = [
  config.cacheVersion,
  process.env.STORYBOOK_ENABLED === 'true' ? 'storybook' : 'app',
]
  .filter(Boolean)
  .join('-');

const metroConfigWithPlugins = applyDevVendorConfig(
  splitCodePlugin(config, projectRoot),
  projectRoot,
);

module.exports = withRozenite(
  // On-device Storybook workbench. When STORYBOOK_ENABLED is unset the wrapper
  // strips every storybook module from the bundle via its resolver, so normal
  // and production builds are unaffected.
  withStorybook(metroConfigWithPlugins, {
    enabled: process.env.STORYBOOK_ENABLED === 'true',
    configPath: path.resolve(projectRoot, './.rnstorybook'),
    // Explicit localhost keeps the generated storybook.requires.ts stable —
    // 'auto' would embed this machine's LAN IP. The iOS simulator reaches the
    // host's localhost directly.
    websockets: { host: 'localhost', port: 7007 },
  }),
  {
    enabled: process.env.WITH_ROZENITE === 'true',
    // enhanceMetroConfig: (cfg) => withRozeniteExpoAtlasPlugin(cfg),
    enhanceMetroConfig: (cfg) => cfg,
  },
);
