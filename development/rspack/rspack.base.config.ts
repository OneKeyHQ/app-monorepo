import fs from 'fs';
import path from 'path';
import { exit } from 'process';

import { rspack } from '@rspack/core';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import notifier from 'node-notifier';

import { isDev, nodeEnv, onekeyProxy, publicUrl } from './constant';
import { createResolveExtensions } from './utils';

import type {
  Compiler,
  Module,
  RspackOptions,
  RspackPluginInstance,
  Stats,
} from '@rspack/core';

// Load .env / .env.version (dotenv side effect) up front so every process.env.*
// read below is populated. The webpack chain does this explicitly in
// babelTools.js; mirror it here rather than relying on the transitive require
// graph (envExposedToClient -> developmentConsts -> env) staying intact.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../env');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveCommitSha } = require('../utils/resolveCommitSha') as {
  resolveCommitSha: () => string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readOneKeyBootstrapDataCode } = require('../htmlBootstrapData') as {
  readOneKeyBootstrapDataCode: (opts: {
    basePath: string;
    isDev: boolean;
    platform: string;
  }) => string;
};

// Single source of truth for the client-exposed env vars. Mirrors the webpack
// `transform-inline-environment-variables` plugin so the same ~42 vars are
// inlined under rspack (otherwise WALLETCONNECT_PROJECT_ID / SENTRY_DSN_WEB /
// SUPABASE_* / etc. would be `undefined` at runtime).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const envExposedToClient = require('../envExposedToClient') as {
  buildEnvExposedToClientDangerously: (opts: { platform: string }) => string[];
};
// Shared platformEnv.* -> literal map (single source of truth with the babel
// chain in development/babelTools.js — see development/platformEnvDefine.js).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPlatformEnvDefineMap: buildSharedPlatformEnvDefineMap } =
  require('../platformEnvDefine') as {
    buildPlatformEnvDefineMap: (
      buildTimeEnv: IBuildTimeEnv,
    ) => Record<string, boolean>;
  };
// Single source of truth for the platformEnv.* booleans = buildTimeEnv.js.
// buildTimeEnv derives every flag from process.env.ONEKEY_PLATFORM, which is
// NOT set at rspack config-eval time (webpack works because babelTools sets it
// before requiring it). So we set it for `platform` and fresh-require, exactly
// mirroring development/babelTools.js. NOTE: platformEnv is an *imported*
// binding in source, so rspack.DefinePlugin CANNOT fold `platformEnv.isNative`
// member expressions (it only folds free globals) — these MUST be folded via
// babel-plugin-transform-define (AST-based), like the webpack chain does.
interface IBuildTimeEnv {
  isJest: boolean;
  isDev: boolean;
  isE2E: boolean;
  isProduction: boolean;
  isWeb: boolean;
  isWebEmbed: boolean;
  isDesktop: boolean;
  isExtension: boolean;
  isNative: boolean;
  isExtChrome: boolean;
  isExtFirefox: boolean;
  enableNativeBackgroundThread: boolean;
}
function loadBuildTimeEnv(platform: string): IBuildTimeEnv {
  process.env.ONEKEY_PLATFORM = platform;
  const p = require.resolve('../../packages/shared/src/buildTimeEnv');
  delete require.cache[p];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../packages/shared/src/buildTimeEnv') as IBuildTimeEnv;
}
// platformEnv.* -> literal map, built from the SAME shared source as the babel
// chain (development/platformEnvDefine.js) so native and web never diverge.
function buildPlatformEnvDefineMap(platform: string): Record<string, boolean> {
  return buildSharedPlatformEnvDefineMap(loadBuildTimeEnv(platform));
}

const IS_EAS_BUILD = !!process.env.EAS_BUILD;

const COMMIT_SHA = resolveCommitSha();

const CANVASKIT_WASM_TEST =
  /canvaskit-wasm[\\/]bin[\\/](full[\\/])?canvaskit\.wasm$/;
const ICON_MODULE_TEST =
  /[\\/]packages[\\/]components[\\/]src[\\/]primitives[\\/]Icon[\\/]react[\\/]/;

function getIconChunkName(module: Module): string {
  const resource = module.nameForCondition?.() || '';
  const normalizedResource = resource.replaceAll(path.sep, '/');
  const match = normalizedResource.match(
    /\/Icon\/react\/([^/]+)\/([^/.]+)\.[jt]sx?$/,
  );
  const category = match?.[1] || 'misc';
  const fileName = match?.[2] || 'misc';
  const prefix = fileName.slice(0, 1).toLowerCase() || 'misc';
  return `icons-${category}-${prefix}`;
}

class BuildDoneNotifyPlugin implements RspackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.done.tap('BuildDoneNotifyPlugin', (stats: Stats) => {
      if (IS_EAS_BUILD) {
        exit(0);
      } else {
        const msg = `OneKey Build at ${new Date().toLocaleTimeString()}, completed in ${
          ((stats.endTime ?? 0) - (stats.startTime ?? 0)) / 1000
        }s`;
        setTimeout(() => {
          console.log('\u001b[33m'); // yellow color
          console.log('===================================');
          console.log(msg);
          console.log('===================================');
          console.log('\u001b[0m'); // reset color
        }, 300);
        try {
          notifier.notify(msg);
        } catch {
          // ignore
        }
      }
    });
  }
}

interface IBaseResolveOptions {
  platform: string;
  configName?: string;
  basePath: string;
  enableSentryMinimalCompat: boolean;
}

const baseResolve = ({
  platform,
  configName,
  basePath,
  enableSentryMinimalCompat,
}: IBaseResolveOptions): RspackOptions['resolve'] => ({
  mainFields: ['browser', 'module', 'main'],
  aliasFields: ['browser', 'module', 'main'],
  extensions: createResolveExtensions({ platform, configName }),
  symlinks: true,
  alias: {
    'react-native$': 'react-native-web',
    'react-native-fast-image': path.join(
      __dirname,
      '../module-resolver/react-native-fast-image-mock',
    ),
    'react-native-keyboard-controller': path.join(
      __dirname,
      '../module-resolver/react-native-keyboard-controller-mock',
    ),
    'react-native-aes-crypto': false,
    'react-native-cloud-fs': false,
    'react-native/Libraries/Components/View/ViewStylePropTypes$':
      'react-native-web/dist/exports/View/ViewStylePropTypes',
    'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter$':
      'react-native-web/dist/vendor/react-native/NativeEventEmitter/RCTDeviceEventEmitter',
    'react-native/Libraries/vendor/emitter/EventEmitter$':
      'react-native-web/dist/vendor/react-native/emitter/EventEmitter',
    'react-native/Libraries/vendor/emitter/EventSubscriptionVendor$':
      'react-native-web/dist/vendor/react-native/emitter/EventSubscriptionVendor',
    'react-native/Libraries/EventEmitter/NativeEventEmitter$':
      'react-native-web/dist/vendor/react-native/NativeEventEmitter',
    '@react-aria/focus': path.join(
      basePath,
      '../../node_modules/@react-aria/focus/src/index.ts',
    ),
    '@react-aria/interactions': path.join(
      basePath,
      '../../node_modules/@react-aria/interactions/src/index.ts',
    ),
    '@react-aria/ssr': path.join(
      basePath,
      '../../node_modules/@react-aria/ssr/src/index.ts',
    ),
    '@react-aria/utils': path.join(
      basePath,
      '../../node_modules/@react-aria/utils/src/index.ts',
    ),
    ...(enableSentryMinimalCompat
      ? {
          '@sentry/minimal$': path.join(
            __dirname,
            '../module-resolver/sentry-minimal-compat',
          ),
        }
      : {}),
    'bn.js$': require.resolve('bn.js'),
    // algosdk's browser field value ('.': 'dist/browser/algosdk.min.js') lacks
    // the './' prefix; rspack's strict resolver fails on it, so bare 'algosdk'
    // cannot resolve. Pin the entry to the ESM build (same file kit-bg imports
    // directly), keeping a single algosdk module graph in the bundle.
    'algosdk$': require.resolve('algosdk/dist/esm/index.js'),
    // @walletconnect/pay (bundled into @reown/walletkit >=1.5) imports
    // 'brotli/decompress' without an extension from an ESM context; brotli
    // has no exports map, so strict fully-specified resolution fails. Pin
    // the file directly.
    'brotli/decompress$': require.resolve('brotli/decompress.js'),
  },
  fallback: {
    crypto:
      require.resolve('@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.js'),
    stream: require.resolve('stream-browserify'),
    path: false,
    https: false,
    http: false,
    net: false,
    dgram: false,
    zlib: false,
    tls: false,
    child_process: false,
    process: false,
    fs: false,
    util: false,
    os: false,
    wbg: false,
    buffer: require.resolve('buffer/'),
  },
  fullySpecified: false,
});

// Builds the full DefinePlugin map = webpack `transform-inline-environment-variables`
// (env vars) + `transform-define` (platformEnv.* booleans) + the original
// explicit/build-derived keys. Collapsing all three into one map; overlapping
// keys are resolved by spread order — `explicitDefines` is spread LAST so the
// explicit build-derived values win (parity with the previous hand-written map:
// e.g. NODE_ENV stays pinned to `nodeEnv`, not the raw process.env value).
function buildDefineMap(
  platform: string,
): ConstructorParameters<typeof rspack.DefinePlugin>[0] {
  // (1) env vars — single source of truth = envExposedToClient.js
  const envKeys = envExposedToClient.buildEnvExposedToClientDangerously({
    platform,
  });
  const envDefines: Record<string, string> = {};
  for (const key of envKeys) {
    envDefines[`process.env.${key}`] = JSON.stringify(process.env[key]);
  }
  // (2) platformEnv.* booleans are folded by babel-plugin-transform-define
  //     (see buildPlatformEnvDefineMap + the first-party babel-loader rule),
  //     NOT here: rspack.DefinePlugin does not replace member expressions on
  //     the imported `platformEnv` binding.
  // (3) explicit / build-derived (win last) + EXPO_OS (all Rspack targets use
  //     web runtime semantics, parity with babel-preset-expo).
  const explicitDefines = {
    __DEV__: isDev,
    'process.env.ONEKEY_PROXY': JSON.stringify(onekeyProxy),
    'process.env.ONEKEY_PLATFORM': JSON.stringify(platform),
    'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    'process.env.DESKTOP_E2E_MODE': JSON.stringify(
      process.env.DESKTOP_E2E_MODE || '',
    ),
    'process.env.E2E_MODE': JSON.stringify(process.env.E2E_MODE || ''),
    'process.env.TAMAGUI_TARGET': JSON.stringify('web'),
    'process.env.PERF_MONITOR_ENABLED': JSON.stringify(
      process.env.PERF_MONITOR_ENABLED || '',
    ),
    // parity with webpack base DefinePlugin (functionHitLogger thresholds)
    'process.env.PERF_FUNCTION_THRESHOLD_MS': JSON.stringify(
      process.env.PERF_FUNCTION_THRESHOLD_MS || '',
    ),
    'process.env.PERF_FUNCTION_WARN_MS': JSON.stringify(
      process.env.PERF_FUNCTION_WARN_MS || '',
    ),
    'process.env.VERSION': JSON.stringify(process.env.VERSION),
    'process.env.BUNDLE_VERSION': JSON.stringify(process.env.BUNDLE_VERSION),
    'process.env.BUILD_NUMBER': JSON.stringify(process.env.BUILD_NUMBER),
    'process.env.GITHUB_SHA': JSON.stringify(COMMIT_SHA),
    'process.env.EXPO_OS': JSON.stringify('web'),
  };
  return { ...envDefines, ...explicitDefines };
}

const buildBasePlugins: (
  platform: string,
  basePath: string,
) => (RspackPluginInstance | false | null | undefined)[] = (
  platform,
  basePath,
) => [
  new rspack.DefinePlugin(buildDefineMap(platform)),
  new rspack.ProvidePlugin({
    Buffer: ['buffer', 'Buffer'],
    process: require.resolve('process/browser'),
  }),
  !isDev &&
    platform === 'web' &&
    new rspack.NormalModuleReplacementPlugin(
      /views[\\/]Developer[\\/]router$/,
      path.join(
        basePath,
        '../../packages/kit/src/views/Developer/router.empty.ts',
      ),
    ),
  !isDev &&
    platform === 'web' &&
    new rspack.CssExtractRspackPlugin({
      filename: '[name].[contenthash:10].css',
      chunkFilename: 'static/css/[name].[contenthash:10].chunk.css',
    }),
  isDev && new BuildDoneNotifyPlugin(),
];

function buildCssLoaders(platform: string) {
  return [
    !isDev && platform === 'web'
      ? rspack.CssExtractRspackPlugin.loader
      : 'style-loader',
    {
      loader: 'css-loader',
      options: {
        importLoaders: 1,
        sourceMap: true,
        modules: { mode: 'global' },
      },
    },
  ];
}

const buildBaseExperiments: () => RspackOptions['experiments'] = () => ({
  asyncWebAssembly: true,
});

const buildBaseCache: (
  basePath: string,
  configName?: string,
) => RspackOptions['cache'] = (basePath, configName) => ({
  type: 'persistent',
  // The CLI only auto-tracks the app-level rspack.config.ts as a build
  // dependency, so edits to these imported config modules would otherwise
  // never invalidate warm persistent caches.
  buildDependencies: fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => path.join(__dirname, file)),
  storage: {
    type: 'filesystem',
    // Use separate cache directories for each compiler domain to avoid
    // persistent cache conflicts in multi-config builds.
    directory: path.join(
      basePath,
      'node_modules/.cache/rspack',
      configName || 'default',
    ),
  },
});

const basePerformance: RspackOptions['performance'] = {
  maxAssetSize: 600_000,
  maxEntrypointSize: 600_000,
};

interface IBaseConfigOptions {
  platform: string;
  basePath: string;
  configName?: string;
  target?: RspackOptions['target'];
  swcTargets?: string | Record<string, string>;
  enableImportMetaCompat?: boolean;
  enableSentryMinimalCompat?: boolean;
  transpileDependencies?: RegExp[];
  removeFirstPartyConsole?: boolean;
}

export function createBaseConfig({
  platform,
  basePath,
  configName,
  target = ['web'],
  swcTargets = 'defaults',
  enableImportMetaCompat = false,
  enableSentryMinimalCompat = false,
  transpileDependencies = [],
  removeFirstPartyConsole = false,
}: IBaseConfigOptions): RspackOptions {
  // platformEnv.* folding (mirrors webpack babel transform-define). Applied in
  // the first-party babel-loader pass below.
  const platformEnvDefineMap = buildPlatformEnvDefineMap(platform);
  // Function-level perf instrumentation, mirrors webpack babelTools.js where the
  // `rn-heartbeat` plugin is added only when PERF_MONITOR_ENABLED=1. The default
  // `build`/`start` scripts now run rspack, and the perf-ci runners
  // (development/perf-ci/run-web-perf*.js) produce the perf bundle via that
  // default build — without this the bundle ships with no __recordFunctionStart
  // / __recordFunctionEnd samples and perf sessions collect nothing.
  const enablePerfMonitor = process.env.PERF_MONITOR_ENABLED === '1';
  return {
    entry: path.join(basePath, 'index.js'),
    context: path.resolve(basePath),
    bail: false,
    target,
    watchOptions: {
      aggregateTimeout: 5,
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.expo/**',
        '**/.expo-shared/**',
        '**/web-build/**',
        '**/.#*',
      ],
    },
    // Build logs stay quiet, while JSON stats retain the module-to-chunk graph
    // needed for bundle-size audits. Rspack's `normal` preset is string-output
    // oriented and omits assets, chunks, and modules from `toJson()`.
    stats:
      process.env.RSPACK_FULL_STATS === '1'
        ? {
            all: false,
            assets: true,
            builtAt: true,
            cachedModules: true,
            chunkGroups: true,
            chunkRelations: true,
            chunks: true,
            children: true,
            entrypoints: true,
            errors: true,
            errorsCount: true,
            hash: true,
            ids: true,
            modules: true,
            outputPath: true,
            publicPath: true,
            source: false,
            timings: true,
            version: true,
            warnings: true,
            warningsCount: true,
          }
        : 'errors-warnings',
    infrastructureLogging: { debug: false, level: 'none' },
    output: {
      publicPath: publicUrl || '/',
      path: path.join(basePath, 'web-build'),
      assetModuleFilename: isDev
        ? 'static/media/[name].[ext]'
        : 'static/media/[name].[hash][ext]',
      uniqueName: 'web',
      filename: isDev
        ? '[name].bundle.js'
        : '[name].[contenthash:10].bundle.js',
      chunkFilename: isDev
        ? 'static/js/[name].chunk.js'
        : 'static/js/[name].[contenthash:10].chunk.js',
    },
    plugins: [
      new HtmlWebpackPlugin({
        title: platform,
        minify: !isDev,
        inject: true,
        filename: path.join(basePath, 'web-build/index.html'),
        template: `!!ejs-loader?esModule=false!${path.join(
          __dirname,
          '../../packages/shared/src/web/index.html',
        )}`,
        favicon: path.join(
          basePath,
          'public/static/images/icons/favicon/favicon.png',
        ),
        templateParameters: {
          filename: '',
          browser: '',
          platform,
          isDev,
          htmlHeadPreloadCode: fs.readFileSync(
            path.resolve(basePath, '../ext/src/assets/preload-html-head.js'),
            {
              encoding: 'utf-8',
            },
          ),
          onekeyBootstrapDataCode: readOneKeyBootstrapDataCode({
            basePath,
            isDev,
            platform,
          }),
          WEB_PUBLIC_URL: publicUrl || '/',
          WEB_TITLE: platform,
          NO_SCRIPT:
            '<form action="" style="background-color:#fff;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;"><div style="font-size:18px;font-family:Helvetica,sans-serif;line-height:24px;margin:10%;width:80%;"> <p>Oh no! It looks like JavaScript is not enabled in your browser.</p> <p style="margin:20px 0;"> <button type="submit" style="background-color: #4630EB; border-radius: 100px; border: none; box-shadow: none; color: #fff; cursor: pointer; font-weight: bold; line-height: 20px; padding: 6px 16px;">Reload</button> </p> </div> </form>',
          ROOT_ID: 'root',
        },
      }) as unknown as RspackPluginInstance,
      ...buildBasePlugins(platform, basePath).filter(Boolean),
    ],
    module: {
      // Webpack used strictExportPresence=false. Keep the same behavior for
      // native-only React Native exports that are guarded by platformEnv.
      parser: {
        javascript: {
          exportsPresence: false,
          importExportsPresence: false,
          reexportExportsPresence: false,
        },
      },
      rules: [
        // `.text-js` = JS source imported as a RAW STRING (default export = the
        // file contents), matching babel-plugin-inline-import in the webpack
        // chain. MUST be first so no later asset rule can claim `.text-js`.
        { test: /\.text-js$/, type: 'asset/source' },
        // cspell:ignore emscripten Skia skia's
        // Canvaskit ships a prebuilt wasm loaded at runtime by emscripten;
        // emit it as a URL asset so react-native-skia's LoadSkiaWeb can fetch
        // it via locateFile (see OrbShader.tsx). Must come before the generic
        // .wasm rule and must be excluded there — otherwise both rules match
        // and rspack tries to parse the wasm as a module.
        {
          test: CANVASKIT_WASM_TEST,
          type: 'asset/resource',
          generator: { filename: 'static/canvaskit/[name][ext]' },
        },
        {
          test: /\.wasm$/,
          exclude: CANVASKIT_WASM_TEST,
          type: 'webassembly/async',
        },
        {
          test: [/\.avif$/],
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 1000,
            },
          },
        },
        {
          test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/, /\.svg$/, /\.webp$/],
          type: 'asset',
          parser: { dataUrlCondition: { maxSize: 1000 } },
        },
        {
          test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/,
          type: 'asset/resource',
        },
        {
          test: /\.(ttf|woff|woff2|eot|otf)$/,
          type: 'asset/resource',
        },
        {
          test: /\.wasm\.bin$/,
          type: 'asset/resource',
        },
        // Reanimated files need babel-loader with worklets plugin
        {
          test: /\.(js|mjs|jsx|ts|tsx)$/,
          include: [/node_modules[\\/].*react-native-reanimated/],
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                  },
                  transform: {
                    react: {
                      runtime: 'automatic',
                      development: isDev,
                      refresh: isDev,
                    },
                  },
                  externalHelpers: true,
                  experimental: {
                    cacheRoot: path.join(basePath, 'node_modules/.cache/swc'),
                  },
                },
                isModule: 'unknown',
                env: {
                  targets: swcTargets,
                },
              },
            },
            {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-typescript'],
                plugins: ['react-native-worklets/plugin'],
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        {
          test: /\.(js|mjs|jsx|ts|tsx)$/,
          exclude: [/node_modules/],
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                    decorators: true,
                  },
                  transform: {
                    react: {
                      runtime: 'automatic',
                      development: isDev,
                      refresh: isDev,
                    },
                    legacyDecorator: true,
                    decoratorMetadata: true,
                  },
                  externalHelpers: true,
                  experimental: {
                    cacheRoot: path.join(basePath, 'node_modules/.cache/swc'),
                  },
                },
                isModule: 'unknown',
                env: {
                  targets: swcTargets,
                },
                // lodash cherry-pick, mirrors babel-plugin-import in the webpack
                // chain (`import { x } from 'lodash'` -> `import x from 'lodash/x'`).
                // camelToDashComponentName:false mirrors camel2DashComponentName:false.
                transformImport: [
                  {
                    libraryName: 'lodash',
                    customName: 'lodash/{{ member }}',
                    camelToDashComponentName: false,
                    transformToDefaultImport: true,
                  },
                ],
              },
            },
            {
              loader: 'babel-loader',
              options: {
                babelrc: false,
                configFile: false,
                presets: [
                  ['@babel/preset-typescript', { allowDeclareFields: true }],
                ],
                plugins: [
                  '@babel/plugin-syntax-jsx',
                  ...(platform === 'web'
                    ? [
                        path.join(
                          __dirname,
                          '../babel-plugins/inline-translations',
                        ),
                      ]
                    : []),
                  // Sentry component annotations (data-sentry-*) — parity with
                  // the webpack babel chain (babelTools.js, !isJest). Runs while
                  // JSX is still intact (babel-loader precedes swc here). Builds
                  // are never jest, so no isJest guard is needed.
                  ['@sentry/babel-plugin-component-annotate'],
                  // Function-level perf instrumentation (parity with webpack
                  // babelTools.js, gated on PERF_MONITOR_ENABLED=1). Must run
                  // while JSX/component structure is intact, so it lives in this
                  // babel pass (before swc) alongside the Sentry annotator.
                  ...(enablePerfMonitor
                    ? [[path.join(__dirname, '../babel-plugins/rn-heartbeat')]]
                    : []),
                  ['@babel/plugin-proposal-decorators', { legacy: true }],
                  ['@babel/plugin-transform-class-properties', { loose: true }],
                  'react-native-worklets/plugin',
                  // Keep console stripping in the first-party-only rule so
                  // dependency runtime fallbacks remain intact.
                  ...(!isDev && removeFirstPartyConsole
                    ? ['babel-plugin-transform-remove-console']
                    : []),
                  // Fold platformEnv.* to literals so platform branches are
                  // dead-code-eliminated (parity with webpack babelTools). Must
                  // be a babel plugin: rspack.DefinePlugin cannot fold member
                  // expressions on the imported `platformEnv` binding.
                  ['transform-define', platformEnvDefineMap],
                ],
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        // Vendor-transpile rules below require a node_modules segment BEFORE the
        // package-name substring on purpose: a fully unanchored regex matches
        // the absolute path, and on EAS build machines the checkout lives under
        // /Users/expo/, so a bare /(@?expo-*)/ matched EVERY first-party file
        // and chained an swc pass without decorator support ("Unexpected token
        // `@`"). Keep the substring semantics after node_modules — packages
        // like @onekeyfe/react-native-text-input (scoped, raw .ts sources)
        // rely on it to get transpiled at all.
        {
          test: /node_modules[\\/].*(@?react-(navigation|native)).*\.(ts|js)x?$/,

          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                  },
                  transform: {
                    react: {
                      runtime: 'automatic',
                      development: isDev,
                      refresh: isDev,
                    },
                  },
                  externalHelpers: true,
                  experimental: {
                    cacheRoot: path.join(basePath, 'node_modules/.cache/swc'),
                  },
                },
                isModule: 'unknown',
                env: {
                  targets: swcTargets,
                },
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        ...(transpileDependencies.length > 0
          ? [
              {
                test: /\.(c|m)?(js|jsx)$/,
                include: transpileDependencies,
                loader: 'builtin:swc-loader',
                options: {
                  jsc: {
                    parser: {
                      syntax: 'ecmascript',
                      jsx: true,
                    },
                    transform: {
                      react: {
                        runtime: 'automatic',
                        development: isDev,
                        refresh: isDev,
                      },
                    },
                    externalHelpers: true,
                    experimental: {
                      cacheRoot: path.join(basePath, 'node_modules/.cache/swc'),
                    },
                  },
                  isModule: 'unknown',
                  env: {
                    targets: swcTargets,
                  },
                },
                resolve: { fullySpecified: false },
              },
            ]
          : []),
        {
          test: [
            /node_modules[\\/].*(@?expo-*).*\.(c|m)?(ts|js)x?$/,
            /node_modules[\\/].*(@?set-interval-async).*\.(c|m)?(ts|js)x?$/,
            /node_modules[\\/].*(@?react-aria).*\.(c|m)?(ts|js)x?$/,
          ],

          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                  },
                  transform: {
                    react: {
                      runtime: 'automatic',
                      development: isDev,
                      refresh: isDev,
                    },
                  },
                  externalHelpers: true,
                  experimental: {
                    cacheRoot: path.join(basePath, 'node_modules/.cache/swc'),
                  },
                },
                isModule: 'unknown',
                env: {
                  targets: swcTargets,
                },
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        {
          test: /node_modules[\\/].*@onekeyfe[\\/]bitcoinforksjs-lib.*\.(ts|js)x?$/,
          resolve: { fullySpecified: false },
        },
        {
          test: /node_modules[\\/].*lru-cache.*\.(ts|js)x?$/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                  },
                  externalHelpers: true,
                  experimental: {
                    cacheRoot: path.join(basePath, 'node_modules/.cache/swc'),
                  },
                },
                module: {
                  type: 'es6',
                  noInterop: false,
                },
                env: {
                  targets: swcTargets,
                },
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        ...(enableImportMetaCompat
          ? [
              {
                test: /node_modules[\\/].*@polkadot/,
                loader: require.resolve('@open-wc/webpack-import-meta-loader'),
              },
            ]
          : []),
        {
          test: /\.(css)$/,
          use: buildCssLoaders(platform),
          sideEffects: true,
        },
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: 'javascript/auto',
        },
        {
          test: /\.ejs$/i,
          use: ['html-loader', 'template-ejs-loader'],
        },
        {
          test: /\.worker\.(js|ts)$/,
          use: {
            loader: 'worker-rspack-loader',
            options: {
              inline: 'fallback',
            },
          },
        },
      ],
    },
    resolve: baseResolve({
      platform,
      configName,
      basePath,
      enableSentryMinimalCompat,
    }),
    resolveLoader: {
      alias: {
        'worker-loader': require.resolve('worker-rspack-loader'),
      },
    },
    lazyCompilation: false,
    incremental: true,
    cache: buildBaseCache(basePath, configName),
    experiments: buildBaseExperiments(),
    performance: basePerformance,
    optimization: {
      splitChunks: {
        cacheGroups: {
          icons: {
            test: (module: Module): boolean => {
              const resource = module.nameForCondition?.();
              return Boolean(resource && ICON_MODULE_TEST.test(resource));
            },
            name: getIconChunkName,
            chunks: 'async',
            enforce: true,
            priority: 30,
            reuseExistingChunk: true,
          },
        },
      },
    },
  };
}
