import path from 'path';

import { InjectManifest } from '@aaroon/workbox-rspack-plugin';
import { rspack } from '@rspack/core';
import { merge } from 'webpack-merge';

import { nodeEnv } from './constant';
import { createBaseConfig } from './rspack.base.config';
import { createDevelopmentConfig } from './rspack.development.config';
import { createProductionConfig } from './rspack.prod.config';

import type { RspackOptions, RspackPluginInstance } from '@rspack/core';

interface IWebConfigOptions {
  basePath: string;
  platform?: string;
}

export function createWebConfig({
  basePath,
  platform = 'web',
}: IWebConfigOptions): RspackOptions {
  const baseConfig = createBaseConfig({ platform, basePath });

  switch (nodeEnv) {
    case 'production':
      return merge(baseConfig, createProductionConfig({ platform, basePath }), {
        output: {
          crossOriginLoading: 'anonymous',
        },
        plugins: (platform === 'web'
          ? [
              // (C1) SRI — native rspack plugin (NOT webpack-subresource-integrity,
              //   which is incompatible with rspack's Rust pipeline).
              //   htmlPlugin:'html-webpack-plugin' is REQUIRED because the base
              //   config uses the JS html-webpack-plugin, not native HtmlRspackPlugin.
              //   MUST come BEFORE InjectManifest so the SW precache manifest
              //   hashes the SRI-final assets.
              new rspack.SubresourceIntegrityPlugin({
                hashFuncNames: ['sha384'],
                htmlPlugin: 'html-webpack-plugin',
                enabled: 'auto',
              }),
              // (C2) PWA precache — rspack-native workbox InjectManifest port.
              //   apps/web/index.js registers /service-worker.js; without this
              //   the file 404s and offline precache silently breaks. Exclude
              //   list mirrors webpack EXCEPT asset-manifest.json (that file is
              //   intentionally dropped under rspack — it has zero consumers).
              new InjectManifest({
                swSrc: path.join(basePath, 'src/service-worker.js'),
                swDest: 'service-worker.js',
                exclude: [/\.map$/, /LICENSE/, /index\.html$/],
              }),
            ]
          : []) as unknown as RspackPluginInstance[],
      });
    case 'development':
    default:
      return merge(baseConfig, createDevelopmentConfig({ basePath }));
  }
}

export default createWebConfig;
