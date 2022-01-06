// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';
process.env.ASSET_PATH = '/';

const WebpackDevServer = require('webpack-dev-server');
const webpack = require('webpack');
const path = require('path');
const lodash = require('lodash');
const configs = require('../webpack.config');
const env = require('./env');
const devUtils = require('./devUtils');

function addHotReload(config) {
  const options = config.chromeExtensionBoilerplate || {};
  const excludeEntriesToHotReload = options.notHotReload || [];

  // eslint-disable-next-line no-restricted-syntax
  for (const entryName in config.entry) {
    if (excludeEntriesToHotReload.indexOf(entryName) === -1) {
      config.entry[entryName] = [
        'webpack/hot/dev-server',
        `webpack-dev-server/client?hot=true&hostname=localhost&port=${env.PORT}`,
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
    port: env.PORT,
    static: {
      directory: path.join(__dirname, '../build'),
    },
    devMiddleware: {
      publicPath: `http://localhost:${env.PORT}/`,
      writeToDisk: true,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    allowedHosts: 'all',
  },
  compiler,
);

if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept();
}

(async () => {
  await server.start();
})();
