require('./env');

const webpack = require('webpack');
const lodash = require('lodash');
const notifier = require('node-notifier');
const { getPathsAsync } = require('@expo/webpack-config/env');
const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const developmentConsts = require('./developmentConsts');
const indexHtmlParameter = require('./indexHtmlParameter');

const { PUBLIC_URL } = process.env;

class BuildDoneNotifyPlugin {
  apply(compiler) {
    compiler.hooks.done.tap(
      'BuildDoneNotifyPlugin',
      (compilation, callback) => {
        const msg = `OneKey Build at ${new Date().toLocaleTimeString()}`;
        setTimeout(() => {
          console.log('\u001b[33m'); // yellow color
          console.log('===================================');
          console.log(msg);
          console.log('===================================');
          console.log('\u001b[0m'); // reset color
        }, 300);
        notifier.notify(msg);
      },
    );
  }
}

const resolveExtensions = [
  '.web.ts',
  '.web.tsx',
  '.web.mjs',
  '.web.js',
  '.web.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.jsx',
  '.json',
  '.wasm',
  '.d.ts',
];

async function modifyExpoEnv({ env, platform }) {
  const locations = await getPathsAsync(env.projectRoot);

  // packages/shared/src/web/index.html.ejs
  const indexHtmlFile = path.resolve(
    __dirname,
    '../packages/shared/src/web/index.html',
  );
  locations.template.indexHtml = indexHtmlFile;
  locations.template.indexHtmlTemplateParameters =
    indexHtmlParameter.createEjsParams({
      filename: 'index.html',
      platform,
    });

  const newEnv = {
    ...env,
    // https://github.com/expo/expo-cli/issues/1977
    locations: {
      ...locations,
    },
  };

  return newEnv;
}

function normalizeConfig({ platform, config, env }) {
  if (platform) {
    if (PUBLIC_URL) config.output.publicPath = PUBLIC_URL;
    const isDev = process.env.NODE_ENV !== 'production';

    config.plugins = [
      ...config.plugins,
      isDev ? new BuildDoneNotifyPlugin() : null,
      new webpack.DefinePlugin({
        // TODO use babelTools `transform-inline-environment-variables` instead
        'process.env.ONEKEY_BUILD_TYPE': JSON.stringify(platform),
        'process.env.EXT_INJECT_RELOAD_BUTTON': JSON.stringify(
          process.env.EXT_INJECT_RELOAD_BUTTON,
        ),
        'process.env.PUBLIC_URL': PUBLIC_URL,
      }),
      isDev
        ? new ReactRefreshWebpackPlugin({ overlay: platform !== 'desktop' })
        : null,
    ].filter(Boolean);

    // add ext and desktop specific extentions like .desktop.tsx, .ext.tsx
    resolveExtensions.unshift(
      ...['.ts', '.tsx', '.js', '.jsx'].map((ext) => `.${platform}${ext}`),
    );
  }
  config.resolve.extensions = lodash
    .uniq(config.resolve.extensions.concat(resolveExtensions))
    // sort platform specific extensions to the beginning
    .sort((a, b) => (a.includes(platform) ? -1 : 0));
  config.resolve.alias = {
    ...config.resolve.alias,
    '@solana/buffer-layout-utils':
      '@solana/buffer-layout-utils/lib/cjs/index.js',
    '@solana/spl-token': '@solana/spl-token/lib/cjs/index.js',
    'aptos': 'aptos/dist/index.js',
    'framer-motion': 'framer-motion/dist/framer-motion',
    '@mysten/sui.js': '@mysten/sui.js/dist/index.js',
  };
  config.devtool = 'cheap-module-source-map';

  return config;
}

module.exports = {
  developmentConsts,
  resolveExtensions,
  normalizeConfig,
  modifyExpoEnv,
};
