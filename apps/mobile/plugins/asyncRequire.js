const asyncRequire = require('metro-runtime/src/modules/asyncRequire');
const chunkModuleIdToHashMap = require('./chunkModuleIdToHashMap');

const fetchModule = async (hash) => {
  const response = await fetch(
    `http://${global.$$metroHostIP}:8081/async-thunks?hash=${hash}`,
  );
  if (response.status !== 200) {
    throw new Error('fetch module error');
  } else {
    const text = await response.text();
    return text;
  }
};

global.installedChunks = global.installedChunks || {};

const requireEnsure = async (chunkId) => {
  const { hash } = chunkModuleIdToHashMap[chunkId];
  const { installedChunks } = global;
  const promises = [];
  let installedChunkData = installedChunks[chunkId];
  if (installedChunkData !== 0) {
    if (installedChunkData) {
      promises.push(installedChunkData[2]);
    } else {
      const promise = new Promise((resolve, reject) => {
        installedChunks[chunkId] = [resolve, reject];
        installedChunkData = installedChunks[chunkId];
      });
      promises.push((installedChunkData[2] = promise));
      const text = await fetchModule(hash);
      const [resolve, reject] = installedChunks[chunkId];
      // eslint-disable-next-line no-new-func
      Function(`"use strict"; ${text}`)();
      resolve();
    }
  }
  return Promise.all(promises);
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
