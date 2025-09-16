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

const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach((file) => {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  });
};

class FileHashMetadataPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync(
      'FileHashMetadataPlugin',
      (compilation, callback) => {
        const outputPath = compilation.outputOptions.path;
        const destStaticPath = path.join(outputPath, 'static');
        const srcStaticPath = path.join(outputPath, '..', 'public', 'static');

        copyDir(
          path.join(srcStaticPath, 'js-sdk'),
          path.join(destStaticPath, 'js-sdk'),
        );

        copyDir(
          path.join(srcStaticPath, 'images'),
          path.join(destStaticPath, 'images'),
        );

        fs.copyFileSync(
          path.join(srcStaticPath, 'preload.js'),
          path.join(destStaticPath, 'preload.js'),
        );

        const metadata = {};

        // Get all emitted assets
        const assets = compilation.getAssets();

        assets.forEach((asset) => {
          const filePath = path.join(outputPath, asset.name);

          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const fileContent = fs.readFileSync(filePath);
              const hash = crypto
                .createHash('sha512')
                .update(fileContent)
                .digest('hex');
              metadata[asset.name] = hash;
            }
          } catch (error) {
            console.warn(`Failed to hash file ${asset.name}:`, error.message);
          }
        });

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
