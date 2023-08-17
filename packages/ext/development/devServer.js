require('../../../development/env');

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';
process.env.ASSET_PATH = '/';
process.env.TRANSFORM_REGENERATOR_DISABLED = 'true';

const WebpackDevServer = require('webpack-dev-server');
const webpack = require('webpack');
const path = require('path');
const webpackTools = require('../../../development/webpackTools');
const configs = require('../webpack.config');
const devUtils = require('./devUtils');
const serverPort = require('./serverPort');
const sourcemapBuilder = require('./sourcemapBuilder');

devUtils.cleanBrowserBuild();

const port = serverPort.getDevServerPort();

function addHotReload(config) {
  const options = config.chromeExtensionBoilerplate || {};
  const excludeEntriesToHotReload = options.notHotReload || [];

  // eslint-disable-next-line no-restricted-syntax
  for (const entryName in config.entry) {
    if (excludeEntriesToHotReload.indexOf(entryName) === -1) {
      config.entry[entryName] = [
        'webpack/hot/dev-server',
        `webpack-dev-server/client?hot=true&hostname=localhost&port=${port}`,
      ].concat(config.entry[entryName]);
    }
  }

  config.plugins = [new webpack.HotModuleReplacementPlugin()].concat(
    config.plugins || [],
  );
}

[].concat(configs).forEach(addHotReload);

devUtils.writePreviewWebpackConfigJson(
  configs,
  'webpack.config.preview.devServer.json',
);

devUtils.cleanWebpackDebugFields(configs, { boilerplate: true });

const compiler = webpack(configs);
const server = new WebpackDevServer(
  {
    https: false,
    hot: false,
    client: false,
    host: 'localhost',
    port,
    static: {
      directory: path.join(__dirname, '../build'),
    },
    devMiddleware: {
      publicPath: `http://localhost:${port}/`,
      writeToDisk: true,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    allowedHosts: 'all',
    proxy: {
      ...webpackTools.createDevServerProxy(),
    },
  },
  compiler,
);

if (process.env.NODE_ENV !== 'production' && module.hot) {
  module.hot.accept();
}

(async () => {
  if (sourcemapBuilder.isSourcemapEnabled) {
    sourcemapBuilder.startServer();
  }
  await server.start();
})();
