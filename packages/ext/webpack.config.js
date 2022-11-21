const webpack = require('webpack');
const path = require('path');
const fse = require('fs-extra');
const TerserPlugin = require('terser-webpack-plugin');
const env = require('./development/env');
const pluginsHtml = require('./development/pluginsHtml');
const pluginsCopy = require('./development/pluginsCopy');
const devUtils = require('./development/devUtils');
const nextWebpack = require('./development/nextWebpack');
const packageJson = require('./package.json');
const webpackTools = require('../../development/webpackTools');
const sourcemapServer = require('./development/sourcemapServer');
const manifest = require('./src/manifest/index');

const ASSET_PATH = process.env.ASSET_PATH || '/';
const IS_DEV = process.env.NODE_ENV !== 'production';

const buildTargetBrowser = devUtils.getBuildTargetBrowser();

sourcemapServer.start();

// FIX build error by withTM :
//    Module parse failed: Unexpected token (7:11)
//    You may need an appropriate loader to handle this file type
const transpileModules = [
  '@onekeyhq/components',
  '@onekeyhq/kit',
  '@onekeyhq/shared',
  '@onekeyhq/engine',
  '@onekeyhq/app',
  'react-native-animated-splash-screen',
  'moti',
  'popmotion',
  // '@mysten/sui.js',
];

// load the secrets
const secretsPath = path.join(__dirname, `secrets.${env.NODE_ENV}.js`);
const secrets = fse.existsSync(secretsPath) ? secretsPath : false;

const alias = {
  'react-dom': '@hot-loader/react-dom',
  // 'secrets': secrets,
};

const fileExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'eot',
  'otf',
  'svg',
  'ttf',
  'woff',
  'woff2',
];

const resolveExtensions = fileExtensions
  .map((extension) => `.${extension}`)
  .concat(['.js', '.jsx', '.ts', '.tsx', '.d.ts', '.css']);

function createConfig() {
  let webpackConfig = {
    // add custom config, will be deleted later
    chromeExtensionBoilerplate: {
      notHotReload: [
        // disable background webpackDevServer hotReload in manifest V3, it will cause error
        //    manifest V3 background will reload automatically after UI reloaded
        manifest.manifest_version >= 3 ? 'background' : '',
        'content-script',
        'ui-devtools',
      ].filter(Boolean),
    },
    mode: IS_DEV ? 'development' : 'production', // development, production
    // mode: 'development',
    entry: {
      // DO NOT set entry here, set by multipleEntryConfigs later
    },
    output: {
      path: path.resolve(__dirname, 'build', buildTargetBrowser),
      filename: '[name].bundle.js',
      publicPath: ASSET_PATH,
      globalObject: 'this', // FIX: window is not defined in service-worker background
    },
    // externalsType: 'module', // 'node-commonjs'
    module: {
      rules: [
        {
          __ruleName__: 'shtml-rule',
          // project/html-loader
          test: /\.(shtml)$/i, // MUST BE .shtml different with withExpo() builtin .html
          use: { loader: 'html-loader' },
          exclude: /node_modules/,
        },
        {
          __ruleName__: 'css-rule',
          // project/css-loader
          // look for .css or .scss files
          test: /\.(css)$/i,
          // in the `src` directory
          use: [
            {
              loader: 'style-loader',
            },
            {
              loader: 'css-loader',
            },
          ],
        },
        {
          test: /\.bin$/i,
          use: [
            {
              loader: 'file-loader',
            },
          ],
        },
        // {
        //   test: /\.(png|jpg|jpeg|gif|webp|ico|bmp|svg)$/i,
        //   loader: 'next-image-loader',
        //   issuer: { not: /\.(css|scss|sass)(\.webpack\[javascript\/auto\])?$/ },
        //   // dependency: { not: [Array] },
        //   options: { isServer: false, isDev: true, assetPrefix: '' },
        // },
      ],
    },
    resolve: {
      alias,
      extensions: [
        // move to: ./development/resolveExtension.js
      ],
    },
    plugins: [
      new webpack.ProgressPlugin(),
      // expose and write the allowed env vars on the compiled bundle
      new webpack.EnvironmentPlugin(['NODE_ENV']),
      new webpack.DefinePlugin({
        'process.env.VERSION': JSON.stringify(packageJson.version),
      }),
      // FIX ERROR: process is not defined
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
    ],
    infrastructureLogging: {
      level: 'info',
    },
    optimization: {},
  };

  webpackConfig = nextWebpack(webpackConfig, {
    transpileModules,
    debug: false,
    projectRoot: __dirname,
  });

  if (IS_DEV) {
    // FIX: Uncaught EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'self'".
    webpackConfig.devtool = 'cheap-module-source-map';
    //
    // Reset sourcemap here, withExpo will change this value
    //    only inline-source-map supported in extension
    // TODO use external file sourcemap
    // webpackConfig.devtool = 'inline-source-map';
    //

    webpackConfig.devtool = false;
    webpackConfig.plugins.push(
      new webpack.SourceMapDevToolPlugin({
        append: `\n//# sourceMappingURL=http://127.0.0.1:${sourcemapServer.port}/[url]`,
        filename: '[file].map',
        // TODO eval is NOT support in Ext.
        //      sourcemap building is very very very SLOW
        module: true,
        columns: true,
      }),
    );
  } else {
    webpackConfig.optimization = {
      ...webpackConfig.optimization,
      minimize: true,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            compress: {
              drop_console: true,
            },
          },
        }),
      ],
    };
  }

  devUtils.cleanWebpackDebugFields(webpackConfig);

  webpackConfig = webpackTools.normalizeConfig({
    platform: webpackTools.developmentConsts.platforms.ext,
    config: webpackConfig,
  });

  return webpackConfig;
}

function enableCodeSplitChunks({ config, name }) {
  config.optimization.splitChunks = {
    chunks: 'all',
    minSize: 0, // 2000000
    maxSize: 4000000,
    // auto-gen chunk file name by module name or just increasing number
    name: name ? `vendors-${name}` : true,
    hidePathInfo: true, // ._m => d0ae3f07    .. => 493df0b3
    automaticNameDelimiter: `.`, // ~ => .
    automaticNameMaxLength: 15, // limit max length of auto-gen chunk file name
  };
}

// https://webpack.js.org/configuration/configuration-types/#exporting-multiple-configurations
const multipleEntryConfigs = [
  // ui build (always code-split)
  {
    config: {
      name: 'ui',
      entry: {
        'ui-popup': path.join(__dirname, 'src/entry/ui-popup.tsx'),
        'ui-expand-tab': path.join(__dirname, 'src/entry/ui-expand-tab.tsx'),
        'ui-standalone-window': path.join(
          __dirname,
          'src/entry/ui-standalone-window.tsx',
        ),
        // 'ui-options': path.join(__dirname, 'src/entry/ui-options.ts'),
        // 'ui-newtab': path.join(__dirname, 'src/entry/ui-newtab.ts'),
        'ui-devtools': path.join(__dirname, 'src/entry/ui-devtools.ts'),
        'ui-devtools-panel': path.join(
          __dirname,
          'src/entry/ui-devtools-panel.tsx',
        ),
      },
    },
    configUpdater(config) {
      enableCodeSplitChunks({ config, name: 'ui' });
      config.plugins = [...config.plugins, ...pluginsHtml.uiHtml];
      return config;
    },
  },
  // background build (code-split ONLY manifest v2)
  {
    config: {
      name: 'bg',
      dependencies: ['ui'],
      entry: {
        'background': path.join(__dirname, 'src/entry/background.ts'),
      },
    },
    configUpdater(config) {
      // background code split only works in manifest v2
      if (manifest.manifest_version < 3) {
        enableCodeSplitChunks({ config, name: 'bg' });
      }
      config.plugins = [...config.plugins, ...pluginsHtml.backgroundHtml];
      return config;
    },
  },
  // content-script build (do NOT code-split)
  {
    config: {
      name: 'cs',
      dependencies: ['ui', 'bg'],
      entry: {
        'content-script': path.join(__dirname, 'src/entry/content-script.ts'),
      },
    },
    configUpdater(config) {
      config.plugins = [...config.plugins, ...pluginsCopy];
      return config;
    },
  },
];

const configs = devUtils.createMultipleEntryConfigs(
  createConfig,
  multipleEntryConfigs,
);

devUtils.writePreviewWebpackConfigJson(configs, 'webpack.config.preview.json');

module.exports = configs;
