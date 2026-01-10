import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { merge } from 'webpack-merge';

import { nodeEnv } from './constant';
import { createBaseConfig } from './rspack.base.config';
import { createDevelopmentConfig } from './rspack.development.config';
import { createProductionConfig } from './rspack.prod.config';

import type {
  Compiler,
  RspackOptions,
  RspackPluginInstance,
} from '@rspack/core';

const BUILD_BUNDLE_UPDATE = process.env.BUILD_BUNDLE_UPDATE === 'true';

function copyRecursiveSync(src: string, dest: string): void {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName),
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

class FileHashMetadataPlugin implements RspackPluginInstance {
  apply(compiler: Compiler): void {
    compiler.hooks.afterEmit.tapAsync(
      'FileHashMetadataPlugin',
      (compilation, callback) => {
        const outputPath = compilation.outputOptions.path;
        if (!outputPath) {
          callback();
          return;
        }
        const destStaticPath = path.join(outputPath, 'static');
        const srcStaticPath = path.join(outputPath, '..', 'public', 'static');

        if (!fs.existsSync(path.join(destStaticPath, 'js-sdk'))) {
          copyRecursiveSync(
            path.join(srcStaticPath, 'js-sdk'),
            path.join(destStaticPath, 'js-sdk'),
          );
        }

        if (!fs.existsSync(path.join(destStaticPath, 'images'))) {
          copyRecursiveSync(
            path.join(srcStaticPath, 'images'),
            path.join(destStaticPath, 'images'),
          );
        }

        if (!fs.existsSync(path.join(destStaticPath, 'preload.js'))) {
          fs.copyFileSync(
            path.join(srcStaticPath, 'preload.js'),
            path.join(destStaticPath, 'preload.js'),
          );
        }

        const metadata: Record<string, string> = {};

        const isIgnoreFile = (filePath: string): boolean => {
          return (
            filePath.endsWith('.DS_Store') ||
            filePath.endsWith('.js.LICENSE.txt') ||
            filePath.endsWith('.js.map')
          );
        };

        function hashFile(filePath: string, relativePath: string): void {
          try {
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
              if (isIgnoreFile(filePath)) {
                return;
              }
              const fileContent = fs.readFileSync(filePath);
              const hash = crypto
                .createHash('sha512')
                .update(fileContent)
                .digest('hex');
              metadata[relativePath] = hash;
            } else if (stats.isDirectory()) {
              const files = fs.readdirSync(filePath);
              files.forEach((file) => {
                if (!isIgnoreFile(file)) {
                  const fullPath = path.join(filePath, file);
                  const relPath = path.join(relativePath, file);
                  hashFile(fullPath, relPath);
                }
              });
            }
          } catch (error) {
            console.warn(
              `Failed to hash path ${filePath}:`,
              (error as Error).message,
            );
          }
        }

        const assets = compilation.getAssets();
        assets.forEach((asset) => {
          const filePath = path.join(outputPath, asset.name);
          hashFile(filePath, asset.name);
        });

        hashFile(outputPath, '');

        const metadataPath = path.join(outputPath, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        callback();
      },
    );
  }
}

interface IDesktopConfigOptions {
  basePath: string;
  platform?: string;
}

export function createDesktopConfig({
  basePath,
  platform = 'desktop',
}: IDesktopConfigOptions): RspackOptions {
  const baseConfig = createBaseConfig({ platform, basePath });

  const commonDesktopConfig: RspackOptions = {
    externals: {
      '@onekeyfe/hd-transport-electron':
        'commonjs @onekeyfe/hd-transport-electron',
      '@stoprocent/noble': 'commonjs @stoprocent/noble',
      '@stoprocent/bluetooth-hci-socket':
        'commonjs @stoprocent/bluetooth-hci-socket',
    },
  };

  switch (nodeEnv) {
    case 'production':
      return merge(
        baseConfig,
        createProductionConfig({ platform, basePath }),
        commonDesktopConfig,
        {
          output: {
            crossOriginLoading: 'anonymous',
          },
          plugins: [
            BUILD_BUNDLE_UPDATE ? new FileHashMetadataPlugin() : undefined,
          ].filter(Boolean),
        },
      );
    case 'development':
    default:
      return merge(
        baseConfig,
        createDevelopmentConfig({ basePath }),
        commonDesktopConfig,
        {
          devtool: 'eval-source-map',
          devServer: {
            open: false,
          },
        },
      );
  }
}

export default createDesktopConfig;
