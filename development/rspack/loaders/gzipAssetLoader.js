// Gzip-compresses an asset for builds that ship it compressed. The code that
// loads the asset decompresses it; for the Breez SDK Spark wasm in the
// extension, see packages/kit-bg/src/services/ServiceLightningSpark/sdk/sparkNetwork.ts.
const zlib = require('zlib');

module.exports = function gzipAssetLoader(source) {
  return zlib.gzipSync(source, { level: zlib.constants.Z_BEST_COMPRESSION });
};

module.exports.raw = true;
