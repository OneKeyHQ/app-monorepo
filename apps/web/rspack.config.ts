/* eslint-disable import/no-relative-packages */
import '../../development/env';
import { createWebConfig } from '../../development/rspack/rspack.web.config';

import { getKeylessEntry } from './src/keylessDeletion/entry';

import type { IncomingMessage, ServerResponse } from 'node:http';

const config = createWebConfig({ basePath: __dirname });
const devServerConfig = config.devServer;

if (devServerConfig) {
  config.devServer = {
    ...devServerConfig,
    setupMiddlewares(middlewares, server) {
      return [
        {
          name: 'keyless-deletion-page-headers',
          middleware(
            request: IncomingMessage,
            response: ServerResponse,
            next: () => void,
          ) {
            if (
              getKeylessEntry(new URL(request.url ?? '/', 'http://localhost'))
            ) {
              response.setHeader('Cache-Control', 'no-store');
              response.setHeader('Referrer-Policy', 'no-referrer');
            }
            next();
          },
        },
        ...(devServerConfig.setupMiddlewares?.(middlewares, server) ??
          middlewares),
      ];
    },
  };
}

export default config;
