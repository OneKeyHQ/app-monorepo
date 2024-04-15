const { merge, mergeWithRules, CustomizeRule } = require('webpack-merge');
const path = require('path');
const webpack = require('webpack');

const WebSocket = require('ws');
const baseConfig = require('./webpack.base.config');
const analyzerConfig = require('./webpack.analyzer.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const babelTools = require('../babelTools');
const {
  WEB_PORT,
  isManifestV3,
  isDev,
  isManifestV2,
  ENABLE_ANALYZER,
  TARGET_BROWSER,
} = require('./constant');
const devUtils = require('./ext/devUtils');
const codeSplit = require('./ext/codeSplit');
const pluginsHtml = require('./ext/pluginsHtml');
const pluginsCopy = require('./ext/pluginsCopy');
// const htmlLazyScript = require('./ext/htmlLazyScript');

const IS_DEV = isDev;

function getOutputFolder() {
  // isManifestV3 ? `${buildTargetBrowser}_v3` : buildTargetBrowser,
  const buildTargetBrowser = TARGET_BROWSER;
  return isManifestV3 ? `${buildTargetBrowser}_v3` : buildTargetBrowser;
}

// node create wesocket server via node api
const wss = new WebSocket.Server({ port: 23121 });

wss.on('connection', () => {
  console.log('New client connected');
});

const notifyUpdate = () => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send('update');
    }
  });
};

class MyPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
      compilation.hooks.finishModules.tap('MyPlugin', (modules) => {
        modules.forEach((module) => {
          if (/\/kit-bg\//.test(module.resource)) {
            console.log(module.resource);
            notifyUpdate();
          }
        });
      });
    });
  }
}

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.ext,
}) => {
  const extConfig = ({ name }) => ({
    optimization: {
      splitChunks: {
        chunks: 'all',
        minSize: 102400,
        maxSize: 4194304,
        hidePathInfo: true,
        automaticNameDelimiter: '.',
        name: false,
        maxInitialRequests: 20,
        maxAsyncRequests: 50000,
        cacheGroups: {},
      },
    },
    plugins: baseConfig.basePlugins,
    output: {
      clean: false,
      path: path.resolve(basePath, 'build', getOutputFolder()),
      // do not include [hash] here, as `content-script.bundle.js` filename should be stable
      filename: '[name].bundle.js',
      chunkFilename: `${name}.[name]-[chunkhash:6].chunk.js`,
      publicPath: '/',
      globalObject: 'this', // FIX: window is not defined in service-worker background
    },
    devServer: {
      open: false,
      devMiddleware: {
        publicPath: `http://localhost:${WEB_PORT}/`,
        writeToDisk: true,
      },
    },
  });
  const extConfigs = ({ name }) =>
    ENABLE_ANALYZER
      ? [extConfig({ name }), analyzerConfig({ configName: platform })]
      : [extConfig({ name })];

  const multipleEntryConfigs = [
    // **** ui build (always code-split)
    {
      config: {
        name: devUtils.consts.configName.ui,
        entry: {
          [devUtils.consts.entry['ui-popup']]: path.join(
            basePath,
            'src/entry/ui-popup.tsx',
          ),
          ...(isManifestV3
            ? {}
            : {
                // [devUtils.consts.entry.background]: path.join(basePath, 'src/entry/background.ts'),
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
        entry: {
          [devUtils.consts.entry.background]: path.join(
            basePath,
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
          new webpack.ProvidePlugin({
            process: 'process/browser',
          }),
          new MyPlugin(),
          // new htmlLazyScript.HtmlLazyScriptPlugin(config),
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
            basePath,
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

        config.plugins = [
          ...config.plugins,
          ...pluginsHtml.offscreenHtml,
        ].filter(Boolean);

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
            basePath,
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

  const entryConfigs = devUtils.createMultipleEntryConfigs(
    ({ config }) =>
      mergeWithRules({
        plugins: CustomizeRule.Replace,
      })(
        baseConfig({ platform, basePath, configName: config.name }),
        merge(
          IS_DEV ? developmentConfig({ platform, basePath }) : productionConfig,
          ...extConfigs({ name: config.name }),
          config,
        ),
      ),
    multipleEntryConfigs,
  );

  // remove devServer from all but the first entry
  for (let index = 1; index < entryConfigs.length; index += 1) {
    delete entryConfigs[index].devServer;
  }
  return entryConfigs;
};
