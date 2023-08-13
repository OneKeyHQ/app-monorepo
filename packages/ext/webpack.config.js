require('../../development/env');

const webpack = require('webpack');
const path = require('path');
const fse = require('fs-extra');
const TerserPlugin = require('terser-webpack-plugin');
const env = require('./development/env');
const pluginsHtml = require('./development/pluginsHtml');
const pluginsCopy = require('./development/pluginsCopy');
const devUtils = require('./development/devUtils');
const codeSplit = require('./development/codeSplit');
const nextWebpack = require('./development/nextWebpack');
const packageJson = require('./package.json');
const webpackTools = require('../../development/webpackTools');
const sourcemapBuilder = require('./development/sourcemapBuilder');
const { extModuleTranspile } = require('../../development/webpackTranspiles');
const htmlLazyScript = require('./development/htmlLazyScript');
const minimizeOptions = require('./development/minimizeOptions');

const ASSET_PATH = process.env.ASSET_PATH || '/';
const IS_DEV = process.env.NODE_ENV !== 'production';
const APP_VERSION = process.env.VERSION;

// firefox chrome
const buildTargetBrowser = devUtils.getBuildTargetBrowser();

// FIX build error by withTM :
//    Module parse failed: Unexpected token (7:11)
//    You may need an appropriate loader to handle this file type
const transpileModules = [...extModuleTranspile];

const alias = {};
// if (IS_DEV) {
//   alias['react-dom'] = '@hot-loader/react-dom';
// }

const isManifestV3 = devUtils.isManifestV3();
const isManifestV2 = devUtils.isManifestV2();

function createConfig({ config }) {
  let webpackConfig = {
    // add custom config, will be deleted later
    chromeExtensionBoilerplate: {
      notHotReload: [
        // disable background webpackDevServer hotReload in manifest V3, it will cause error
        //    manifest V3 background will reload automatically after UI reloaded
        isManifestV3 ? devUtils.consts.entry.background : '',
        devUtils.consts.entry['content-script'],
        devUtils.consts.entry['ui-devtools'],
      ].filter(Boolean),
    },
    mode: IS_DEV ? 'development' : 'production', // development, production
    // mode: 'development',
    entry: {
      // DO NOT set entry here, set by multipleEntryConfigs later
    },
    output: {
      path: path.resolve(__dirname, 'build', devUtils.getOutputFolder()),
      // do not include [hash] here, as `content-script.bundle.js` filename should be stable
      filename: '[name].bundle.js',
      chunkFilename: `${config.name}.[name]-[chunkhash:6].chunk.js`,
      publicPath: ASSET_PATH,
      globalObject: 'this', // FIX: window is not defined in service-worker background
    },
    // externalsType: 'module', // 'node-commonjs'
    module: {
      rules: [
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
      // FIX ERROR: process is not defined
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
      new htmlLazyScript.HtmlLazyScriptPlugin(config),
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

  webpackConfig.experiments = config.experiments || {};
  webpackConfig.experiments.asyncWebAssembly = true;

  devUtils.cleanWebpackDebugFields(webpackConfig);

  webpackConfig.target = 'web';
  webpackConfig = webpackTools.normalizeConfig({
    platform: webpackTools.developmentConsts.platforms.ext,
    isManifestV3,
    config: webpackConfig,
    configName: config.name,
    enableAnalyzerHtmlReport: true,
    buildTargetBrowser,
  });

  if (IS_DEV) {
    // FIX: Uncaught EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'self'".
    webpackConfig.devtool = 'source-map';

    //
    // Reset sourcemap here, withExpo will change this value
    //    only inline-source-map supported in extension
    // TODO use external file sourcemap
    // webpackConfig.devtool = 'inline-source-map';
    //

    // webpackConfig.devtool = false;
    if (sourcemapBuilder.isSourcemapEnabled) {
      webpackConfig.plugins.push(sourcemapBuilder.createSourcemapBuildPlugin());
    }
    webpackConfig.experiments.lazyCompilation = false;
  } else {
    webpackConfig.performance = {
      ...config.performance,
      maxEntrypointSize: 3 * 1024 * 1024,
      maxAssetSize: 3 * 1024 * 1024,
    };
    webpackConfig.optimization = {
      ...webpackConfig.optimization,
      ...minimizeOptions.buildMinimizeOptions(),
    };
  }
  return webpackConfig;
}

// https://webpack.js.org/configuration/configuration-types/#exporting-multiple-configurations
const multipleEntryConfigs = [
  // **** ui build (always code-split)
  {
    config: {
      name: devUtils.consts.configName.ui,
      entry: {
        [devUtils.consts.entry['ui-popup']]: path.join(
          __dirname,
          'src/entry/ui-popup.tsx',
        ),
        ...(isManifestV3
          ? {}
          : {
              // [devUtils.consts.entry.background]: path.join(__dirname, 'src/entry/background.ts'),
            }),
      },
    },
    configUpdater(config) {
      if (isManifestV2) {
        codeSplit.enableCodeSplitChunks({
          config,
        });
      } else {
        codeSplit.enableCodeSplitChunks({
          config,
        });
      }
      config.plugins = [
        ...config.plugins,
        ...pluginsHtml.uiHtml,
        // ...(isManifestV3 ? [] : pluginsHtml.backgroundHtml),
      ].filter(Boolean);

      return config;
    },
  },

  // **** manifest v3 background standalone build without code-split
  (isManifestV3 || isManifestV2) && {
    config: {
      name: devUtils.consts.configName.bg,
      dependencies: IS_DEV
        ? [devUtils.consts.configName.ui]
        : [devUtils.consts.configName.ui],
      entry: {
        [devUtils.consts.entry.background]: path.join(
          __dirname,
          'src/entry/background.ts',
        ),
      },
    },
    configUpdater(config) {
      if (isManifestV2) {
        codeSplit.enableCodeSplitChunks({
          config,
        });
      } else {
        // manifest v3 background can NOT split code
        codeSplit.disableCodeSplitChunks({
          config,
        });
      }

      config.plugins = [
        ...config.plugins,
        ...pluginsHtml.backgroundHtml,
      ].filter(Boolean);
      return config;
    },
  },

  // **** manifest v3 offscreen standalone build
  isManifestV3 && {
    config: {
      name: devUtils.consts.configName.offscreen,
      entry: {
        [devUtils.consts.entry.offscreen]: path.join(
          __dirname,
          'src/entry/offscreen.ts',
        ),
      },
      dependencies: [
        devUtils.consts.configName.ui,
        devUtils.consts.configName.bg,
      ],
    },
    configUpdater(config) {
      codeSplit.enableCodeSplitChunks({
        config,
      });

      config.plugins = [...config.plugins, ...pluginsHtml.offscreenHtml].filter(
        Boolean,
      );

      return config;
    },
  },

  // **** content-script build (do NOT code-split)
  {
    config: {
      name: devUtils.consts.configName.cs,
      dependencies: isManifestV3
        ? [
            devUtils.consts.configName.ui,
            devUtils.consts.configName.bg,
            devUtils.consts.configName.offscreen,
          ]
        : [devUtils.consts.configName.ui, devUtils.consts.configName.bg],
      entry: {
        [devUtils.consts.entry['content-script']]: path.join(
          __dirname,
          'src/entry/content-script.ts',
        ),
      },
    },
    configUpdater(config) {
      // content-script can NOT split code
      codeSplit.disableCodeSplitChunks({
        config,
      });

      config.plugins = [...config.plugins, ...pluginsCopy].filter(Boolean);
      return config;
    },
  },
].filter(Boolean);

const configs = devUtils.createMultipleEntryConfigs(
  createConfig,
  multipleEntryConfigs,
);

configs.forEach(codeSplit.disabledDynamicImportChunks);

devUtils.writePreviewWebpackConfigJson(configs, 'webpack.config.preview.json');

module.exports = configs;
