// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
const chunkModuleIdToHashMap = require('__CHUNK_MODULE_ID_TO_HASH_MAP__');
const asyncRequire = require('metro-runtime/src/modules/asyncRequire');
const { NativeModules } = require('react-native');

const { createWrappedAsyncRequire } = require('__ASYNC_REQUIRE_CORE__');

const fetchHttpModule = async (hash) => {
  const url = `http://__METRO_HOST_IP__:8081/async-thunks?hash=${hash}`;
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`fetch module error: ${url}}`);
  } else {
    const text = await response.text();
    // eslint-disable-next-line no-new-func
    Function(`"use strict"; ${text}`)();
  }
};

const { Bundle } = NativeModules;
const fetchNativeModule = (hash) =>
  new Promise((resolve) => {
    const { pendingChunks } = global;
    pendingChunks[hash] = pendingChunks[hash] || [];
    pendingChunks[hash].push(resolve);
    Bundle.executeSourceCode(hash);
  });

global.installedChunks = global.installedChunks || {};

const fetchModule =
  '__NODE_ENV__' !== 'production' ? fetchHttpModule : fetchNativeModule;

const requireEnsure = async (chunkId) => {
  const hash = chunkModuleIdToHashMap[chunkId];
  const { installedChunks } = global;
  if (!installedChunks[chunkId]) {
    await fetchModule(hash);
    installedChunks[chunkId] = true;
  }
};

const wrapAsyncRequire = createWrappedAsyncRequire({
  chunkModuleIdToHashMap,
  requireEnsure,
  asyncRequire,
  // Match Metro's asyncRequire return shape exactly — it resolves with
  // `require.importAll(moduleID)`, which wraps non-ESModule (CJS, JSON)
  // exports as `{...keys, default: exports}`. Using plain `require` here
  // drops that `default` key and breaks any consumer of a dynamically
  // imported JSON/CJS module (e.g. locale JSON in AppIntlProvider).
  // eslint-disable-next-line no-undef
  syncRequire: (id) => require.importAll(id),
});

module.exports = wrapAsyncRequire;
