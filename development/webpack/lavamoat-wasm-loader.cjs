// cspell:ignore LavaMoat lavamoat kaspa zbar

const fs = require('fs');

const { LavaMoatError } = require('../lavamoat/error.cjs');

let allowedPaths;

function getLavaMoatWasmPaths() {
  allowedPaths ||= Object.freeze(
    [
      require.resolve('@onekeyfe/kaspa-wasm/kaspa_bg.wasm.bin'),
      require.resolve('zbar.wasm/dist/zbar.wasm.bin'),
    ].map((file) => fs.realpathSync(file)),
  );
  return allowedPaths;
}

function lavaMoatWasmLoader(source) {
  // An explicit loader admits an otherwise blocked dependency asset in
  // @lavamoat/webpack. Check the real resource again here so an inline loader
  // request or forged matchResource cannot expand the configured allowlist.
  if (!getLavaMoatWasmPaths().includes(fs.realpathSync(this.resourcePath))) {
    throw new LavaMoatError(
      `LavaMoat WASM loader rejected an unapproved resource: ${this.resourcePath}`,
    );
  }
  if (!Buffer.isBuffer(source)) {
    throw new LavaMoatError(
      'LavaMoat WASM loader requires unchanged binary input.',
    );
  }
  return source;
}

module.exports = lavaMoatWasmLoader;
module.exports.raw = true;
module.exports.getLavaMoatWasmPaths = getLavaMoatWasmPaths;
