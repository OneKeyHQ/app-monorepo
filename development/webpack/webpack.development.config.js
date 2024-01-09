const path = require('path');
const webpack = require('webpack');
const fs = require('fs');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { WEB_PORT } = require('./constant');

module.exports = ({ basePath }) => ({
  mode: 'development',
  devtool: 'cheap-module-source-map',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new ReactRefreshWebpackPlugin({ overlay: false }),
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
      // proxy all requests with x-proxy header
      devServer.app.use((req, res, next) => {
        const target = req.headers['x-proxy'];
        if (target) {
          const proxyMiddleware = createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: false,
            logLevel: 'debug',
          });
          return proxyMiddleware(req, res, next);
        }
        next();
      });

      // proxy react-render-tracker
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
              '../../node_modules/react-render-tracker/dist/react-render-tracker.js',
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
