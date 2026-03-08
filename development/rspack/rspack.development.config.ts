import { rspack } from '@rspack/core';
import ReactRefreshPlugin from '@rspack/plugin-react-refresh';

import { webPort } from './constant';

import type { RspackOptions, RspackPluginInstance } from '@rspack/core';

interface IDevConfigOptions {
  basePath: string;
}

export function createDevelopmentConfig({
  basePath: _basePath,
}: IDevConfigOptions): RspackOptions {
  return {
    mode: 'development',
    devtool: 'cheap-module-source-map',
    plugins: [
      new rspack.HotModuleReplacementPlugin(),
      new ReactRefreshPlugin({
        overlay: false,
      }) as unknown as RspackPluginInstance,
      new rspack.DefinePlugin({
        __CURRENT_FILE_PATH__: JSON.stringify(
          '__CURRENT_FILE_PATH__--rspack-dev',
        ),
      }),
    ],
    devServer: {
      open: true,
      hot: true,
      historyApiFallback: true,
      port: parseInt(webPort, 10),
      allowedHosts: 'all',
      compress: true,
      client: {
        overlay: false,
      },
      // setupMiddlewares: (middlewares, devServer) => {
      //   if (!devServer.app) return middlewares;

      //   // proxy all requests with x-onekey-dev-proxy header
      //   devServer.app.use((request, response, next) => {
      //     const target = request.headers['x-onekey-dev-proxy'];
      //     if (target && typeof target === 'string') {
      //       const proxyMiddleware: RequestHandler = createProxyMiddleware({
      //         target,
      //         changeOrigin: true,
      //         ws: false,
      //         logLevel: 'silent',
      //       });
      //       console.log(
      //         `[X-OneKey-Dev-Proxy] ${request.method} ${request.originalUrl} -> ${target}`,
      //       );
      //       return proxyMiddleware(request, response, next);
      //     }
      //     next();
      //   });

      //   // proxy react-render-tracker
      //   devServer.app.get(
      //     '/react-render-tracker@0.7.3/dist/react-render-tracker.js',
      //     (req, res) => {
      //       const sendResponse = (text: string) => {
      //         res.setHeader(
      //           'Cache-Control',
      //           'no-store, no-cache, must-revalidate, proxy-revalidate',
      //         );
      //         res.setHeader('Age', '0');
      //         res.setHeader('Expires', '0');
      //         res.setHeader('Content-Type', 'text/javascript');
      //         res.write(text);
      //         res.end();
      //       };
      //       const filePath = path.join(
      //         __dirname,
      //         '../../node_modules/react-render-tracker/dist/react-render-tracker.js',
      //       );
      //       fs.readFile(filePath, 'utf8', (err, data) => {
      //         if (err) {
      //           console.error(err);
      //           res.status(500).send(`Error reading file:  ${filePath}`);
      //           return;
      //         }
      //         sendResponse(data);
      //       });
      //     },
      //   );

      //   return middlewares;
      // },
    } as RspackOptions['devServer'],
    cache: true,
  };
}
