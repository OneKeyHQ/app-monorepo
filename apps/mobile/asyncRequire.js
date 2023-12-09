const asyncRequire = require('metro-runtime/src/modules/asyncRequire');
// runtime as small as possible
const chunkModuleIdToHashMap = require('./chunkModuleIdToHashMap');

/**
 * load additional a single chunk
 * @param { string } chunkId
 * @returns
 */
const requireEnsure = (chunkId) => {
  // stores loaded and loading chunk
  // undefined = chunk not loaded, null = chunk preloaded/prefetched
  // [resolve, reject, promise] = chunk loading, 0 = chunk loaded
  const installedChunks = (global.installedChunks =
    global.installedChunks ||
    {
      // 'buz.ios.bundle': 0 // [chunkId]: [state]
    });
  const promises = [];
  let installedChunkData = installedChunks[chunkId];
  if (installedChunkData !== 0) {
    // chunkId load is not complete
    if (installedChunkData) {
      // [] loading
      promises.push(installedChunkData[2]);
    } else {
      // undefined not loaded
      const promise = new Promise((resolve, reject) => {
        installedChunkData = installedChunks[chunkId] = [resolve, reject];
      });
      promises.push((installedChunkData[2] = promise));
      const error = new Error(); // create errors before stack expansion so that useful stack traces can be obtained later
      //   const resourceUri = urlJoin(
      //     global.<%= options.globalInlayVarName %>.publicPath,
      //     '<%= options.relativeChunkDir %>',
      //     chunkModuleIdToHashMap[chunkId]['hash'] + '<%= options.fileSuffix %>'
      //   )
      const resourceUri = '';
      // eslint-disable-next-line prefer-const
      let timeoutId;
      const onComplete = ({ code, data, msg }) => {
        // fetch success or failure | js timeout
        clearTimeout(timeoutId);
        const state = installedChunks[chunkId];
        if (state === undefined) return; // js timeout but fetch give the results
        const [resolve, reject] = state;
        if (code !== 200) {
          // failure
          error.message = msg;
          error.type = error.name = 'ChunkLoadError';
          error.request = resourceUri;
          installedChunks[chunkId] = undefined;
          return reject(error);
        }
        // successful
        // compared eval(data) Faster and safer https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
        Function(`"use strict"; ${data}`)();
        installedChunks[chunkId] = 0;
        resolve();
      };
      // timeout handling
      const timeoutTime = 120000;
      timeoutId = setTimeout(
        onComplete.bind(null, {
          code: 0,
          msg: `load chunk：${chunkId} failure（timeout：${timeoutTime}）`,
        }),
        timeoutTime,
      );

      fetch(resourceUri)
        .then((res) => {
          if (res.status === 200) {
            res
              .text()
              .then((res) => {
                onComplete({ code: 200, data: res });
              })
              .catch((err) => {
                onComplete({ code: 0, msg: err.message });
              });
          } else {
            onComplete({ code: res.status, msg: res.statusText });
          }
        })
        .catch((err) => {
          onComplete({ code: 0, msg: err.message });
        });
    }
  }
  return Promise.all(promises);
};

const wrapAsyncRequire = async (moduleId) => {
  const hashMap = chunkModuleIdToHashMap[moduleId];
  if (!hashMap) {
    // a module is knocked down into the main package, But there are places for asynchrony
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
