import path from 'path';

import { merge } from 'webpack-merge';

import { nodeEnv, publicUrl } from './constant';
import { createBaseConfig } from './rspack.base.config';
import { createDevelopmentConfig } from './rspack.development.config';
import { createProductionConfig } from './rspack.prod.config';

import type { RspackOptions } from '@rspack/core';

interface IWebEmbedConfigOptions {
  basePath: string;
  platform?: string;
}

export function createWebEmbedConfig({
  basePath,
  platform = 'web-embed',
}: IWebEmbedConfigOptions): RspackOptions {
  const baseConfig = createBaseConfig({
    platform,
    basePath,
    target: ['web', 'es2017'],
    swcTargets: {
      chrome: '67',
      safari: '15.5',
    },
    enableImportMetaCompat: true,
    enableSentryMinimalCompat: true,
    removeFirstPartyConsole: true,
    transpileDependencies: [
      /node_modules[\\/]@sentry(-internal)?[\\/]/,
      /node_modules[\\/]@onekeyfe[\\/]kaspa-wasm/,
      /node_modules[\\/]@revenuecat[\\/]purchases-js/,
      /node_modules[\\/]onekey-zcash-(runtime|keys)/,
    ],
  });
  const entryConfig: RspackOptions = {
    entry: {
      sentry: path.join(basePath, 'sentry.js'),
      main: path.join(basePath, 'index.js'),
    },
  };

  switch (nodeEnv) {
    case 'production':
      return merge(
        baseConfig,
        createProductionConfig({
          platform,
          basePath,
        }),
        {
          optimization: {
            splitChunks: false,
            // The Zcash wasm glue and its emitted asset URL reference
            // each other's hashed URLs; RealContentHashPlugin panics on the
            // circular hash dependency. Module-graph hashing keeps filenames
            // unique per build, which is enough for app-bundled assets.
            realContentHash: false,
          },
          output: {
            publicPath: publicUrl || './',
            path: path.join(basePath, 'web-build'),
            assetModuleFilename:
              'static/media/web-embed.[name].[contenthash][ext]',
            uniqueName: 'web',
            filename: 'web-embed.[contenthash:10].js',
          },
        },
        entryConfig,
      );
    case 'development':
    default:
      return merge(
        baseConfig,
        createDevelopmentConfig({ basePath }),
        {
          output: {
            publicPath: '',
          },
        },
        entryConfig,
      );
  }
}

export default createWebEmbedConfig;
