// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
const chunkModuleIdToHashMap = require('__CHUNK_MODULE_ID_TO_HASH_MAP__');
const asyncRequire = require('metro-runtime/src/modules/asyncRequire');
const { NativeModules } = require('react-native');

const { createWrappedAsyncRequire } = require('./asyncRequireCore');

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
  // eslint-disable-next-line no-undef
  syncRequire: (id) => require(id),
});

module.exports = wrapAsyncRequire;
