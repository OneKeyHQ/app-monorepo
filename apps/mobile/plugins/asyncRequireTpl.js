const asyncRequire = require('metro-runtime/src/modules/asyncRequire');
const chunkModuleIdToHashMap = require('__CHUNK_MODULE_ID_TO_HASH_MAP__');
const { NativeModules } = require('react-native');

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
const fetchNativeModule = (hash) => {
  Bundle.executeSourceCode(hash);
  return new Promise((resolve) => {
    const { pendingChunks } = global;
    pendingChunks[hash] = pendingChunks[hash] || [];
    pendingChunks[hash].push(resolve);
  });
};

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

const wrapAsyncRequire = async (moduleId) => {
  const hashMap = chunkModuleIdToHashMap[moduleId];
  if (!hashMap) {
    await Promise.resolve();
  } else if (Array.isArray(hashMap)) {
    // TODO the reserved
    await Promise.all(hashMap.map((v) => requireEnsure(v)));
  } else {
    await requireEnsure(moduleId);
  }
  return asyncRequire(moduleId);
};

module.exports = wrapAsyncRequire;
