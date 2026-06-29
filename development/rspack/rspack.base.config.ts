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
}

const baseResolve = ({
  platform,
  configName,
  basePath,
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
    algosdk: false,
  },
  fullySpecified: false,
});

// Builds the full DefinePlugin map = webpack `transform-inline-environment-variables`
// (env vars) + `transform-define` (platformEnv.* booleans) + the original
// explicit/build-derived keys. Collapsing all three into one map; overlapping
// keys are resolved by spread order — `explicitDefines` is spread LAST so the
// pinned build-derived values win (parity with the previous hand-written map:
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
  // (3) explicit / build-derived (win last) + EXPO_OS (web only, parity with
  //     babel-preset-expo which sets process.env.EXPO_OS).
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
    ...(platform === 'web'
      ? { 'process.env.EXPO_OS': JSON.stringify('web') }
      : {}),
  };
  return { ...envDefines, ...explicitDefines };
}

const buildBasePlugins: (
  platform: string,
) => (RspackPluginInstance | false | null | undefined)[] = (platform) => [
  new rspack.DefinePlugin(buildDefineMap(platform)),
  new rspack.ProvidePlugin({
    Buffer: ['buffer', 'Buffer'],
    process: require.resolve('process/browser'),
  }),
  isDev && new BuildDoneNotifyPlugin(),
];

const buildBaseExperiments: (
  basePath: string,
  configName?: string,
) => RspackOptions['experiments'] = (basePath, configName) => ({
  cache: {
    type: 'persistent',
    storage: {
      type: 'filesystem',
      // Use separate cache directories for each config to avoid conflicts
      // in multi-config builds (ext has 5 parallel configs)
      directory: path.join(
        basePath,
        'node_modules/.cache/rspack',
        configName || 'default',
      ),
    },
  },
  asyncWebAssembly: true,
  incremental: true,
});

const basePerformance: RspackOptions['performance'] = {
  maxAssetSize: 600_000,
  maxEntrypointSize: 600_000,
};

interface IBaseConfigOptions {
  platform: string;
  basePath: string;
  configName?: string;
}

export function createBaseConfig({
  platform,
  basePath,
  configName,
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
    target: ['web'],
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
    // Build logs stay quiet ('errors-warnings'), but `--json` reuses this same
    // stats config, and 'errors-warnings' (all:false) omits assets/chunks — so
    // the bundle-size diff CI job would see an empty stats.json. The `stats:web`
    // script sets RSPACK_FULL_STATS=1 to emit a full preset for the JSON path.
    stats: process.env.RSPACK_FULL_STATS === '1' ? 'normal' : 'errors-warnings',
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
          WEB_PUBLIC_URL: publicUrl || '/',
          WEB_TITLE: platform,
          NO_SCRIPT:
            '<form action="" style="background-color:#fff;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;"><div style="font-size:18px;font-family:Helvetica,sans-serif;line-height:24px;margin:10%;width:80%;"> <p>Oh no! It looks like JavaScript is not enabled in your browser.</p> <p style="margin:20px 0;"> <button type="submit" style="background-color: #4630EB; border-radius: 100px; border: none; box-shadow: none; color: #fff; cursor: pointer; font-weight: bold; line-height: 20px; padding: 6px 16px;">Reload</button> </p> </div> </form>',
          ROOT_ID: 'root',
        },
      }) as unknown as RspackPluginInstance,
      ...buildBasePlugins(platform).filter(Boolean),
    ],
    module: {
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
          test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/, /\.svg$/],
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
          include: [/react-native-reanimated/],
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
                  targets: 'defaults',
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
                  targets: 'defaults',
                },
                // lodash cherry-pick, mirrors babel-plugin-import in the webpack
                // chain (`import { x } from 'lodash'` -> `import x from 'lodash/x'`).
                // camelToDashComponentName:false mirrors camel2DashComponentName:false.
                rspackExperiments: {
                  import: [
                    {
                      libraryName: 'lodash',
                      customName: 'lodash/{{ member }}',
                      camelToDashComponentName: false,
                      transformToDefaultImport: true,
                    },
                  ],
                },
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
        {
          test: /(@?react-(navigation|native)).*\.(ts|js)x?$/,

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
                  targets: 'defaults',
                },
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        {
          test: [
            /(@?expo-*).*\.(c|m)?(ts|js)x?$/,
            /(@?set-interval-async).*\.(c|m)?(ts|js)x?$/,
            /(@?react-aria).*\.(c|m)?(ts|js)x?$/,
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
                  targets: 'defaults',
                },
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        {
          test: /@onekeyfe[\\/]bitcoinforksjs-lib.*\.(ts|js)x?$/,
          resolve: { fullySpecified: false },
        },
        {
          test: /lru-cache.*\.(ts|js)x?$/,
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
                  targets: 'defaults',
                },
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        {
          test: /\.(css)$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                sourceMap: true,
                modules: { mode: 'global' },
              },
            },
          ],
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
    resolve: baseResolve({ platform, configName, basePath }),
    resolveLoader: {
      alias: {
        'worker-loader': require.resolve('worker-rspack-loader'),
      },
    },
    lazyCompilation: false,
    experiments: buildBaseExperiments(basePath, configName),
    performance: basePerformance,
    optimization: {
      splitChunks: {
        cacheGroups: {
          icons: {
            test: (module: Module): boolean => {
              const iconTestRegex =
                /[\\/]packages[\\/]components[\\/]src[\\/]primitives[\\/]Icon[\\/]react[\\/]/;
              const resource = module.nameForCondition?.();
              return Boolean(resource && iconTestRegex.test(resource));
            },
            name: 'icons',
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
