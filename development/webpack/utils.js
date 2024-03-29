const uniq = require('lodash/uniq');
const { developmentConsts } = require('../babelTools');
const { EXT_CHANNEL, TARGET_BROWSER } = require('./constant');

exports.createResolveExtensions = function ({ platform, configName }) {
  return uniq([
    // .chrome-ext.ts, .firefox-ext.ts
    ...(EXT_CHANNEL && TARGET_BROWSER
      ? ['.ts', '.tsx', '.js', '.jsx'].map(
          (ext) => `.${TARGET_BROWSER}-${platform}${ext}`,
        )
      : []),
    // .ext-bg-v3.ts
    ...(configName && platform === 'ext' && developmentConsts.isManifestV3
      ? ['.ts', '.tsx', '.js', '.jsx'].map(
          (ext) => `.${platform}-${configName}-v3${ext}`,
        )
      : []),
    // .ext-ui.ts, .ext-bg.ts
    ...(configName
      ? ['.ts', '.tsx', '.js', '.jsx'].map(
          (ext) => `.${platform}-${configName}${ext}`,
        )
      : []),
    // .ext.ts, .web.ts, .desktop.ts, .android.ts, .ios.ts, .native.ts
    ...['.ts', '.tsx', '.js', '.jsx'].map((ext) => `.${platform}${ext}`),
    '.web.ts',
    '.web.tsx',
    '.web.mjs',
    '.web.js',
    '.web.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.js',
    '.jsx',
    '.json',
    '.wasm',
    '.d.ts',
  ]);
};
