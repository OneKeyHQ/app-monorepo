require('./env');

const webpack = require('webpack');
const lodash = require('lodash');
const notifier = require('node-notifier');
const { getPathsAsync } = require('@expo/webpack-config/env');
const path = require('path');
const fs = require('fs');

const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const devUtils = require('@onekeyhq/ext/development/devUtils');
const developmentConsts = require('./developmentConsts');
const indexHtmlParameter = require('./indexHtmlParameter');

const { PUBLIC_URL } = process.env;

class BuildDoneNotifyPlugin {
  apply(compiler) {
    compiler.hooks.done.tap(
      'BuildDoneNotifyPlugin',
      (compilation, callback) => {
        const msg = `OneKey Build at ${new Date().toLocaleTimeString()}`;
        setTimeout(() => {
          console.log('\u001b[33m'); // yellow color
          console.log('===================================');
          console.log(msg);
          console.log('===================================');
          console.log('\u001b[0m'); // reset color
        }, 300);
        notifier.notify(msg);
      },
    );
  }
}

function createDefaultResolveExtensions() {
  return [
    '.web.ts',
    '.web.tsx',
    '.web.mjs',
    '.web.js',
    '.web.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.js',
    '.jsx',
    '.json',
    '.wasm',
    '.d.ts',
  ];
}

function createDevServerProxy() {
  return {
    '/nexa_ws': {
      target: 'wss://testnet-explorer.nexa.org:30004',
      changeOrigin: true,
      ws: true,
    },
  };
}

async function modifyExpoEnv({ env, platform }) {
  const locations = await getPathsAsync(env.projectRoot);

  // packages/shared/src/web/index.html.ejs
  const indexHtmlFile = path.resolve(
    __dirname,
    '../packages/shared/src/web/index.html',
  );
  locations.template.indexHtml = indexHtmlFile;
  locations.template.indexHtmlTemplateParameters =
    indexHtmlParameter.createEjsParams({
      filename: 'index.html',
      platform,
    });

  const newEnv = {
    ...env,
    // https://github.com/expo/expo-cli/issues/1977
    locations: {
      ...locations,
    },
  };

  return newEnv;
}

function normalizeConfig({
  platform,
  config,
  env,
  configName,
  enableAnalyzerHtmlReport,
  buildTargetBrowser, // firefox or chrome, for extension build
}) {
  const isDev = process.env.NODE_ENV !== 'production';
  let resolveExtensions = createDefaultResolveExtensions();
  if (platform) {
    if (PUBLIC_URL) config.output.publicPath = PUBLIC_URL;
    if (platform === 'web' && !isDev)
      config.output.crossOriginLoading = 'anonymous'; // Required for subresource integrity to work
    config.output.filename = '[name].bundle.js';

    config.plugins = [
      ...config.plugins,
      new webpack.ProgressPlugin(),
      platform !== 'ext' ? new DuplicatePackageCheckerPlugin() : null,
      isDev ? new BuildDoneNotifyPlugin() : null,
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new webpack.DefinePlugin({
        // TODO use babelTools `transform-inline-environment-variables` instead
        'process.env.ONEKEY_BUILD_TYPE': JSON.stringify(platform),
        'process.env.EXT_INJECT_RELOAD_BUTTON': JSON.stringify(
          process.env.EXT_INJECT_RELOAD_BUTTON,
        ),
        'process.env.PUBLIC_URL': PUBLIC_URL,
      }),
      isDev ? new ReactRefreshWebpackPlugin({ overlay: false }) : null,
      platform === 'web' && !isDev ? new SubresourceIntegrityPlugin() : null,
    ].filter(Boolean);

    // add devServer proxy
    if (config.devServer) {
      config.devServer.proxy = {
        ...config.devServer.proxy,
        ...createDevServerProxy(),
      };
    }

    if (config.devServer) {
      config.devServer.onBeforeSetupMiddleware = (devServer) => {
        devServer.app.get(
          '/react-render-tracker@0.7.3/dist/react-render-tracker.js',
          (req, res) => {
            const sendResponse = (text) => {
              res.setHeader(
                'Cache-Control',
                'no-store, no-cache, must-revalidate, proxy-revalidate',
              );
              res.setHeader('Age', '0');
              res.setHeader('Expires', '0');
              res.setHeader('Content-Type', 'text/javascript');
              res.write(text);
              res.end();
            };
            if (
              req.headers &&
              req.headers.cookie &&
              req.headers.cookie.includes('rrt=1')
            ) {
              // read node_modules/react-render-tracker/dist/react-render-tracker.js content
              const filePath = path.join(
                __dirname,
                '../node_modules/react-render-tracker/dist/react-render-tracker.js',
              );
              fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                  console.error(err);
                  res.status(500).send(`Error reading file:  ${filePath}`);
                  return;
                }
                sendResponse(data);
              });
            } else {
              const logScript = `console.log('react-render-tracker is disabled')`;
              sendResponse(logScript);
            }
          },
        );
      };
    }

    if (process.env.ENABLE_ANALYZER) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin(
          enableAnalyzerHtmlReport
            ? {
                analyzerMode: 'static',
                reportFilename: `report${
                  configName ? `-${configName}` : ''
                }.html`,
                openAnalyzer: false,
              }
            : {
                analyzerMode: 'disabled',
                generateStatsFile: true,
                statsOptions: {
                  reasons: false,
                  warnings: false,
                  errors: false,
                  optimizationBailout: false,
                  usedExports: false,
                  providedExports: false,
                  source: false,
                  ids: false,
                  children: false,
                  chunks: false,
                  modules: !!process.env.ANALYSE_MODULE,
                },
              },
        ),
      );
    }

    resolveExtensions = [
      // .chrome-ext.ts, .firefox-ext.ts
      ...(buildTargetBrowser
        ? ['.ts', '.tsx', '.js', '.jsx'].map(
            (ext) => `.${buildTargetBrowser}-${platform}${ext}`,
          )
        : []),
      // .ext-bg-v3.ts
      ...(configName && platform === 'ext' && developmentConsts.isManifestV3
        ? ['.ts', '.tsx', '.js', '.jsx'].map(
            (ext) => `.${platform}-${configName}-v3${ext}`,
          )
        : []),
      // .ext-ui.ts, .ext-bg.ts
      ...(configName
        ? ['.ts', '.tsx', '.js', '.jsx'].map(
            (ext) => `.${platform}-${configName}${ext}`,
          )
        : []),
      // .ext.ts, .web.ts, .android.ts, .ios.ts, .native.ts
      ...['.ts', '.tsx', '.js', '.jsx'].map((ext) => `.${platform}${ext}`),
      ...resolveExtensions,
    ];
  }

  let useImportMetaLoader =
    platform !== 'ext' ||
    (platform === 'ext' && !developmentConsts.isManifestV3) ||
    (platform === 'ext' &&
      developmentConsts.isManifestV3 &&
      configName === devUtils.consts.configName.offscreen);
  useImportMetaLoader = true;
  // reference window at node_modules/@open-wc/webpack-import-meta-loader/webpack-import-meta-loader.js
  if (useImportMetaLoader) {
    // https://polkadot.js.org/docs/usage/FAQ#on-webpack-4-i-have-a-parse-error-on-importmetaurl
    config.module.rules.push({
      test: /@polkadot/,
      // test: /[\s\S]*node_modules[/\\]@polkadot[\s\S]*.c?js$/,
      loader: require.resolve('@open-wc/webpack-import-meta-loader'),
      // loader: require('./libs/@open-wc/webpack-import-meta-loader'),
    });
  }

  // support mjs
  config.module.rules.push({
    test: /\.mjs$/,
    include: /node_modules/,
    type: 'javascript/auto',
  });

  // support ejs
  config.module.rules.push({
    test: /\.ejs$/i,
    use: ['html-loader', 'template-ejs-loader'],
  });

  const normalizeModuleRule = (rule) => {
    if (!rule) {
      return;
    }
    if (
      rule.loader &&
      rule.loader.indexOf('file-loader') >= 0 &&
      rule.exclude
    ) {
      rule.exclude.push(/\.wasm$/);
      rule.exclude.push(/\.cjs$/);
      rule.exclude.push(
        /\.custom-file-loader-exclude-extensions-from-webpack-tools$/,
      );
    }
    if (rule.test && rule.test.toString() === '/\\.(mjs|[jt]sx?)$/') {
      // add *.cjs support
      // /\.(cjs|mjs|[jt]sx?)$/
      rule.test = /\.(cjs|mjs|[jt]sx?)$/;
    }
    if (rule.test && rule.test.toString() === '/\\.+(js|jsx|mjs|ts|tsx)$/') {
      // add *.cjs support
      // /\.+(cjs|js|jsx|mjs|ts|tsx)$/
      rule.test = /\.+(cjs|js|jsx|mjs|ts|tsx)$/;
    }
  };

  // let file-loader skip handle wasm files
  config.module.rules.forEach((rule) => {
    normalizeModuleRule(rule);
    (rule.oneOf || []).forEach((oneOf) => {
      normalizeModuleRule(oneOf);
    });
  });

  config.resolve.extensions = lodash
    .uniq(config.resolve.extensions.concat(resolveExtensions))
    .sort((a, b) => {
      // ".ext-ui.ts"  ".ext.ts"
      if (a.includes(platform) && b.includes(platform)) {
        return 0;
      }
      // sort platform specific extensions to the beginning
      return a.includes(platform) ? -1 : 0;
    });
  config.resolve.alias = {
    ...config.resolve.alias,
    // '@solana/buffer-layout-utils':
    // '@solana/buffer-layout-utils/lib/cjs/index.js',
    // '@solana/spl-token': '@solana/spl-token/lib/cjs/index.js',
    // 'aptos': 'aptos/dist/index.js',
    // 'framer-motion': 'framer-motion/dist/framer-motion',
    // '@mysten/sui.js': '@mysten/sui.js/dist/index.js',
    // '@ipld/dag-cbor': '@ipld/dag-cbor/dist/index.min.js',
    // 'ws': 'ws/browser.js',
  };

  config.resolve.fallback = {
    ...config.resolve.fallback,
    'crypto': require.resolve(
      '@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.js',
    ),
    'stream': require.resolve('stream-browserify'),
    'path': false,
    'https': false,
    'http': false,
    'net': false,
    'zlib': false,
    'tls': false,
    'child_process': false,
    'process': false,
    'fs': false,
    'util': false,
    'os': false,
    'buffer': require.resolve('buffer/'),
  };

  // Why? do not change original config directly
  // - Production build do not need sourcemap
  // - Ext do not need devtool sourcemap, use SourceMapDevToolPlugin instead.
  // - building slow
  // config.devtool = 'cheap-module-source-map';
  config.optimization ??= {};
  config.optimization.splitChunks ??= {};
  config.optimization.splitChunks = {
    chunks: 'all',
    minSize: 100 * 1024,
    maxSize: 4 * 1024 * 1024,
    hidePathInfo: true,
    automaticNameDelimiter: '.',
    name: false, // reduce module duplication across chunks
    maxInitialRequests: 20, // reduce module duplication across chunks
    maxAsyncRequests: 50000, // reduce module duplication across chunks
    cacheGroups: {
      // kit_assets: {
      //   test: /\/kit\/assets/,
      //   name: 'kit_assets',
      //   chunks: 'all',
      // },
      // kit_routes: {
      //   test: /\/kit\/src\/routes/,
      //   name: 'kit_routes',
      //   chunks: 'all',
      // },
      // lodash: {
      //   test: /\/node_modules\/lodash/,
      //   name: 'lodash',
      //   chunks: 'all',
      // },
    },
    ...config.optimization.splitChunks,
  };

  return config;
}

module.exports = {
  developmentConsts,
  normalizeConfig,
  modifyExpoEnv,
  createDevServerProxy,
};
