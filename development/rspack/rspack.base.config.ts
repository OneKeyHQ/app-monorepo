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

const IS_EAS_BUILD = !!process.env.EAS_BUILD;

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
    'react-native-restart': path.join(
      __dirname,
      '../module-resolver/react-native-restart-mock',
    ),
    'react-native-fast-image': path.join(
      __dirname,
      '../module-resolver/react-native-fast-image-mock',
    ),
    'react-native-keyboard-controller': path.join(
      __dirname,
      '../module-resolver/react-native-keyboard-controller-mock',
    ),
    'react-native-aes-crypto': false,
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

const buildBasePlugins: (
  platform: string,
) => (RspackPluginInstance | false | null | undefined)[] = (platform) => [
  new rspack.DefinePlugin({
    __DEV__: isDev,
    'process.env.ONEKEY_PROXY': JSON.stringify(onekeyProxy),
    'process.env.ONEKEY_PLATFORM': JSON.stringify(platform),
    'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    'process.env.TAMAGUI_TARGET': JSON.stringify('web'),
    'process.env.PERF_MONITOR_ENABLED': JSON.stringify(
      process.env.PERF_MONITOR_ENABLED || '',
    ),
    'process.env.VERSION': JSON.stringify(process.env.VERSION),
    'process.env.BUNDLE_VERSION': JSON.stringify(process.env.BUNDLE_VERSION),
    'process.env.BUILD_NUMBER': JSON.stringify(process.env.BUILD_NUMBER),
  }),
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
    stats: 'errors-warnings',
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
        {
          test: /\.wasm$/,
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
                  ['@babel/plugin-proposal-decorators', { legacy: true }],
                  ['@babel/plugin-transform-class-properties', { loose: true }],
                  'react-native-worklets/plugin',
                ],
              },
            },
          ],
          resolve: { fullySpecified: false },
        },
        {
          test: /(@?react-(navigation|native)).*\.(ts|js)x?$/,
          exclude: [/react-native-logs/],
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
            /react-router/,
            /turbo-stream/,
            /(@?react-aria).*\.(c|m)?(ts|js)x?$/,
          ],
          exclude: [/react-native-logs/],
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
