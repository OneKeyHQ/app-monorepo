const { RuntimeGlobals } = require('webpack');

const PLUGIN_NAME = 'RetryChunkLoadWebpackPlugin';

class RetryChunkLoadWebpackPlugin {
  constructor(options = {}) {
    this.options = { ...options };
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      const { mainTemplate, runtimeTemplate } = compilation;
      const maxRetriesOption = Number(this.options.maxRetries);
      const maxRetries =
        Number.isInteger(maxRetriesOption) && maxRetriesOption > 0
          ? maxRetriesOption
          : 1;
      const getCacheBustString = () =>
        this.options.cacheBust
          ? `(${this.options.cacheBust})();`
          : '"cache-bust=true"';

      mainTemplate.hooks.localVars.tap(
        { name: PLUGIN_NAME, stage: 1 },
        (source, chunk) => {
          if (
            this.options.chunks &&
            !this.options.chunks.includes(chunk.name)
          ) {
            return source;
          }
          const getRetryDelay =
            typeof this.options.retryDelay === 'string'
              ? this.options.retryDelay
              : `function() { return ${this.options.retryDelay || 0}; }`;
          const retryRuntime = runtimeTemplate.iife(
            '',
            `
if (typeof ${RuntimeGlobals.require} !== 'undefined') {
  var oldGetScript = ${RuntimeGlobals.getChunkScriptFilename};
  var oldLoadScript = ${RuntimeGlobals.ensureChunk};
  var queryMap = {};
  var countMap = {};
  var getRetryDelay = ${getRetryDelay};
  ${RuntimeGlobals.getChunkScriptFilename} = function (chunkId) {
    var result = oldGetScript(chunkId);
    return result + (Object.prototype.hasOwnProperty.call(queryMap, chunkId)
      ? '?' + queryMap[chunkId]
      : '');
  };
  ${RuntimeGlobals.ensureChunk} = function (chunkId) {
    var result = oldLoadScript(chunkId);
    return result.catch(function (error) {
      var retries = Object.prototype.hasOwnProperty.call(countMap, chunkId)
        ? countMap[chunkId]
        : ${maxRetries};
      if (retries < 1) {
        var realSrc = oldGetScript(chunkId);
        error.message = 'Loading chunk ' + chunkId +
          ' failed after ${maxRetries} retries.\\n(' + realSrc + ')';
        error.request = realSrc;
        ${this.options.lastResortScript || ''}
        throw error;
      }
      return new Promise(function (resolve) {
        var retryAttempt = ${maxRetries} - retries + 1;
        setTimeout(function () {
          var retryAttemptString = '&retry-attempt=' + retryAttempt;
          var cacheBust = ${getCacheBustString()} + retryAttemptString;
          queryMap[chunkId] = cacheBust;
          countMap[chunkId] = retries - 1;
          resolve(${RuntimeGlobals.ensureChunk}(chunkId));
        }, getRetryDelay(retryAttempt));
      });
    });
  };
}`,
          );
          return `${source}\n${retryRuntime}`;
        },
      );
    });
  }
}

module.exports = { RetryChunkLoadWebpackPlugin };
