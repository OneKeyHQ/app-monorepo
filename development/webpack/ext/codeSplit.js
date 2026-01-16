// firefox chrome
const devUtils = require('./devUtils');

let chunkIndex = 800;

function enableCodeSplitChunks({ config }) {
  const { name } = config;
  let maxSizeMb = 4;
  const isFirefox = devUtils.isBuildTargetBrowserFirefox();
  const isChrome = devUtils.isBuildTargetBrowserChromeLike();
  if (isFirefox) {
    maxSizeMb = 1;
  }
  config.optimization.splitChunks = {
    // merge webpackTools.normalizeConfig() splitChunks config
    ...config.optimization.splitChunks,
    chunks: isFirefox ? 'all' : 'all', // all, async, and initial
    minSize: 100 * 1024, // 100k
    maxSize: maxSizeMb * 1024 * 1024, // limit to max 2MB to ignore firefox lint error

    // auto-gen chunk file name by module name or just increasing number
    name: (module, chunks, cacheGroupKey, p1, p2, p3) => {
      chunkIndex += 1;
      const returnName = name ? `vendors-${name}-${chunkIndex}` : false;
      // return returnName;

      // **** reduce module duplication across chunks
      return false;
    },

    hidePathInfo: true, // ._m => d0ae3f07    .. => 493df0b3
    automaticNameDelimiter: `.`, // ~ => .
    // automaticNameMaxLength: 15, // limit max length of auto-gen chunk file name
    // maxAsyncRequests: 5, // for each additional load no more than 5 files at a time
    // maxInitialRequests: 3, // each entrypoint should not request more then 3 js files
    // cacheGroups: {
    //   vendors: {
    //     test: /[\\/]node_modules[\\/]/,
    //     priority: -10,
    //     enforce: true, // separate vendor from our code
    //   },
    //   default: {
    //     minChunks: 2,
    //     priority: -20,
    //     reuseExistingChunk: true,
    //   },
    // },
  };
  if (isChrome) {
    // memory leak issue
    // config.optimization.splitChunks = undefined;
  }
}

function disableCodeSplitChunks({ config }) {
  const { name } = config;
  config.optimization = config.optimization || {};
  delete config.optimization.splitChunks;
  config.output.asyncChunks = false;
}

function disabledDynamicImportChunks(config) {
  const configName = config.name;
  if (
    (devUtils.isManifestV3() && configName === devUtils.consts.configName.bg) ||
    configName === devUtils.consts.configName.cs
  ) {
    devUtils.addBabelLoaderPlugin({
      config,
      isPrepend: true,
      plugins: [
        // 'babel-plugin-dynamic-import-webpack' ,// TODO not working
        // 'babel-plugin-transform-dynamic-imports-to-static-imports',
      ],
    });
  }
}

module.exports = {
  enableCodeSplitChunks,
  disableCodeSplitChunks,
  disabledDynamicImportChunks,
};
