const path = require('path');
const { merge, mergeWithRules, CustomizeRule } = require('webpack-merge');

const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const crypto = require('crypto');
const fs = require('fs');
const baseConfig = require('./webpack.base.config');
const analyzerConfig = require('./webpack.analyzer.config');
const developmentConfig = require('./webpack.development.config');
const productionConfig = require('./webpack.prod.config');
const { NODE_ENV, ENABLE_ANALYZER } = require('./constant');
const babelTools = require('../babelTools');

// Plugin to generate metadata.json with SHA512 hashes of all output files
const BUILD_BUNDLE_UPDATE = process.env.BUILD_BUNDLE_UPDATE === 'true';

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
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
class FileHashMetadataPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync(
      'FileHashMetadataPlugin',
      (compilation, callback) => {
        const outputPath = compilation.outputOptions.path;
        const destStaticPath = path.join(outputPath, 'static');
        const srcStaticPath = path.join(outputPath, '..', 'public', 'static');

        copyRecursiveSync(
          path.join(srcStaticPath, 'js-sdk'),
          path.join(destStaticPath, 'js-sdk'),
        );

        copyRecursiveSync(
          path.join(srcStaticPath, 'images'),
          path.join(destStaticPath, 'images'),
        );

        fs.copyFileSync(
          path.join(srcStaticPath, 'preload.js'),
          path.join(destStaticPath, 'preload.js'),
        );

        const metadata = {};

        const isIgnoreFile = (filePath) => {
          return (
            filePath.endsWith('.DS_Store') ||
            filePath.endsWith('.js.LICENSE.txt') ||
            filePath.endsWith('.js.map')
          );
        };

        // Get all emitted assets
        function hashFile(filePath, relativePath) {
          try {
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
              // Skip .DS_Store files
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
                // Skip .DS_Store files
                if (!isIgnoreFile(file)) {
                  const fullPath = path.join(filePath, file);
                  const relPath = path.join(relativePath, file);
                  hashFile(fullPath, relPath);
                }
              });
            }
          } catch (error) {
            console.warn(`Failed to hash path ${filePath}:`, error.message);
          }
        }

        // Hash all emitted assets first
        const assets = compilation.getAssets();
        assets.forEach((asset) => {
          const filePath = path.join(outputPath, asset.name);
          hashFile(filePath, asset.name);
        });

        // Then recursively hash all files in output directory
        hashFile(outputPath, '');

        // Write metadata.json
        const metadataPath = path.join(outputPath, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        callback();
      },
    );
  }
}

module.exports = ({
  basePath,
  platform = babelTools.developmentConsts.platforms.desktop,
}) => {
  const configs = ENABLE_ANALYZER
    ? [analyzerConfig({ configName: platform })]
    : [];

  // Renderer process externals - only exclude packages that shouldn't be bundled
  const commonDesktopConfig = {
    externals: {
      // Exclude the entire BLE transport package to prevent Node.js modules from leaking to renderer
      '@onekeyfe/hd-transport-electron':
        'commonjs @onekeyfe/hd-transport-electron',
      '@stoprocent/noble': 'commonjs @stoprocent/noble',
      '@stoprocent/bluetooth-hci-socket':
        'commonjs @stoprocent/bluetooth-hci-socket',
    },
  };

  switch (NODE_ENV) {
    case 'production': {
      return merge(
        baseConfig({ platform, basePath }),
        productionConfig({ platform, basePath }),
        ...configs,
        commonDesktopConfig,
        {
          output: {
            crossOriginLoading: 'anonymous',
          },
          plugins: [
            new SubresourceIntegrityPlugin(),
            BUILD_BUNDLE_UPDATE ? new FileHashMetadataPlugin() : undefined,
          ].filter(Boolean),
        },
      );
    }
    case 'development':
    default: {
      return merge(
        baseConfig({ platform, basePath }),
        developmentConfig({ platform, basePath }),
        ...configs,
        commonDesktopConfig,
        {
          // development/webpack/webpack.development.config.js 10L
          // Electron 30.x doesn't support cheap-module-source-map
          devtool: 'eval-source-map',
          devServer: {
            open: false,
          },
        },
      );
    }
  }
};
