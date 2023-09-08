const { developmentConsts } = require('../babelTools');
const {
  DEFAULT_RESOLVE_EXTENSIONS,
  EXT_CHANNEL,
  TARGET_BROWSER,
} = require('./constant');

exports.createtResolveExtensions = function ({ platform, configName }) {
  return [
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
    ...DEFAULT_RESOLVE_EXTENSIONS,
  ];
};
