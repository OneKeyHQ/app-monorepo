import { Compilation, RuntimeGlobals } from '@rspack/core';

import type { Compiler } from '@rspack/core';

interface IRetryChunkLoadOptions {
  // delay in ms before retrying a failed chunk load
  retryDelay?: number;
  // maximum number of retries before giving up
  maxRetries?: number;
  // optional JS executed in the browser if all retries fail
  lastResortScript?: string;
}

const PLUGIN_NAME = 'RetryChunkLoadRspackPlugin';

// rspack@1.7 equivalent of webpack-retry-chunk-load-plugin (3.1.1).
//
// The npm plugin taps `compilation.mainTemplate.hooks.localVars` and uses
// `compilation.runtimeTemplate.iife()` — neither exists on rspack's
// Compilation (verified: Compilation.d.ts has no mainTemplate/runtimeTemplate,
// and @rspack/core exports no MainTemplate/RuntimeTemplate class), so the npm
// plugin throws on `apply()` under rspack. Instead we tap the supported
// `compilation.hooks.runtimeModule` SyncHook and append a wrapper that
// re-defines RuntimeGlobals.ensureChunk (`__webpack_require__.e`) to retry on
// failure — the same runtime behavior the npm plugin injected. Fail-safe: if
// the ensure-chunk runtime module is not matched, this is a no-op (equivalent
// to today's missing-feature state, never a crash).
export class RetryChunkLoadRspackPlugin {
  private readonly options: Required<
    Pick<IRetryChunkLoadOptions, 'retryDelay' | 'maxRetries'>
  > &
    Pick<IRetryChunkLoadOptions, 'lastResortScript'>;

  constructor(options: IRetryChunkLoadOptions = {}) {
    const maxRetries = Number(options.maxRetries);
    this.options = {
      retryDelay:
        typeof options.retryDelay === 'number' ? options.retryDelay : 0,
      maxRetries:
        Number.isInteger(maxRetries) && maxRetries > 0 ? maxRetries : 1,
      lastResortScript: options.lastResortScript,
    };
  }

  apply(compiler: Compiler): void {
    const { maxRetries, retryDelay, lastResortScript } = this.options;

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      // Per-compilation flag: did we match the ensure-chunk runtime module? The
      // match is a source-substring heuristic, so a future rspack runtime-
      // template change could silently stop matching — surface that at build
      // time instead of shipping without chunk-load retry.
      let matched = false;
      compilation.hooks.runtimeModule.tap(PLUGIN_NAME, (module) => {
        // Only patch the runtime module that defines __webpack_require__.e
        // (the chunk-loading "ensure chunk" runtime). Match by source so we are
        // resilient to rspack's internal module naming across versions.
        const original =
          typeof module.source?.source === 'string'
            ? module.source.source
            : module.source?.source?.toString();
        if (
          !original ||
          !original.includes(`${RuntimeGlobals.ensureChunk} =`)
        ) {
          return;
        }
        // Idempotency guard: never double-wrap.
        if (original.includes('__OK_RETRY_CHUNK_LOAD__')) {
          return;
        }

        const wrapper = `
/* __OK_RETRY_CHUNK_LOAD__ */
if (typeof ${RuntimeGlobals.require} !== "undefined") {
  var __okOldGetScript = ${RuntimeGlobals.getChunkScriptFilename};
  var __okOldEnsure = ${RuntimeGlobals.ensureChunk};
  var __okQueryMap = {};
  var __okCountMap = {};
  var __okGetRetryDelay = function() { return ${retryDelay}; };
  ${RuntimeGlobals.getChunkScriptFilename} = function (chunkId) {
    var result = __okOldGetScript(chunkId);
    return (
      result +
      (Object.prototype.hasOwnProperty.call(__okQueryMap, chunkId)
        ? "?" + __okQueryMap[chunkId]
        : "")
    );
  };
  ${RuntimeGlobals.ensureChunk} = function (chunkId) {
    var result = __okOldEnsure(chunkId);
    return result.catch(function (error) {
      var retries = Object.prototype.hasOwnProperty.call(__okCountMap, chunkId)
        ? __okCountMap[chunkId]
        : ${maxRetries};
      if (retries < 1) {
        var realSrc = __okOldGetScript(chunkId);
        error.message =
          "Loading chunk " + chunkId + " failed after ${maxRetries} retries.\\n(" + realSrc + ")";
        error.request = realSrc;
        ${lastResortScript ?? ''}
        throw error;
      }
      return new Promise(function (resolve) {
        var retryAttempt = ${maxRetries} - retries + 1;
        setTimeout(function () {
          var retryAttemptString = "&retry-attempt=" + retryAttempt;
          var cacheBust = "cache-bust=true" + retryAttemptString;
          __okQueryMap[chunkId] = cacheBust;
          __okCountMap[chunkId] = retries - 1;
          resolve(${RuntimeGlobals.ensureChunk}(chunkId));
        }, __okGetRetryDelay(retryAttempt));
      });
    });
  };
}
`;

        // Append our wrapper after the original runtime source so
        // __webpack_require__.e is already defined when we re-wrap it. rspack
        // accepts a plain string for module.source.source, so no explicit
        // RawSource is needed.
        if (module.source) {
          // eslint-disable-next-line no-param-reassign
          module.source.source = `${original}\n${wrapper}`;
          matched = true;
        }
      });

      // Surface a miss as a build WARNING (visible in rspack stats / CI output),
      // not a stray console.warn that scrolls past. Non-fatal by design: an
      // unmatched template is equivalent to today's no-retry baseline, never a
      // crash. PROCESS_ASSETS_STAGE_REPORT runs after all runtime modules are
      // processed, so `matched` is final here.
      compilation.hooks.processAssets.tap(
        { name: PLUGIN_NAME, stage: Compilation.PROCESS_ASSETS_STAGE_REPORT },
        () => {
          if (!matched) {
            compilation.warnings.push(
              new Error(
                `[${PLUGIN_NAME}] no ensure-chunk runtime module matched — chunk-load retry is NOT active. The rspack runtime template may have changed; update the match predicate.`,
              ),
            );
          }
        },
      );
    });
  }
}
