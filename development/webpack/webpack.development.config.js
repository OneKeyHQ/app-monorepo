const path = require('path');

const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const { createProxyMiddleware } = require('http-proxy-middleware');
const webpack = require('webpack');

const { WEB_PORT } = require('./constant');

module.exports = ({ basePath }) => ({
  mode: 'development',
  devtool: 'cheap-module-source-map',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new ReactRefreshWebpackPlugin({ overlay: false }),
    new webpack.DefinePlugin({
      // Inject the current file's resource path into a global variable
      __CURRENT_FILE_PATH__: webpack.DefinePlugin.runtimeValue(
        (info) => JSON.stringify(info.module.resource),
        [], // No file dependencies needed for this case
      ),
    }),
  ],
  devServer: {
    open: true,
    hot: true,
    historyApiFallback: true,
    port: WEB_PORT,
    allowedHosts: ['all'],
    compress: true,
    client: {
      overlay: false,
    },
    onBeforeSetupMiddleware: (devServer) => {
      // proxy all requests with x-onekey-dev-proxy header
      devServer.app.use((request, response, next) => {
        const target = request.headers['x-onekey-dev-proxy'];
        if (target) {
          const proxyMiddleware = createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: false,
            logLevel: 'silent',
          });
          console.log(
            `[X-OneKey-Dev-Proxy] ${request.method} ${request.originalUrl} -> ${target}`,
          );
          return proxyMiddleware(request, response, next);
        }
        next();
      });
    },
  },
  cache: {
    type: 'filesystem',
    allowCollectingMemory: true,
    store: 'pack',
    buildDependencies: {
      defaultWebpack: [
        path.join(basePath, 'package.json'),
        path.join(basePath, '../../package.json'),
      ],
      config: [__filename],
      tsconfig: [
        path.join(basePath, 'tsconfig.json'),
        path.join(basePath, '../../tsconfig.json'),
      ],
    },
    cacheDirectory: path.join(basePath, 'node_modules/.cache/web'),
  },
});
