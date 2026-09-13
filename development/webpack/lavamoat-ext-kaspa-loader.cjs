// cspell:ignore LavaMoat lavamoat kaspa wbg

const { createHash } = require('node:crypto');
const fs = require('node:fs');

const { LavaMoatError } = require('../lavamoat/error.cjs');

const {
  transformKaspaCompatibility,
  getPinnedPaths,
  verifyPinnedPackage,
  SOURCE_SHA256,
  WASM_SHA256,
  WASM_BYTE_LENGTH,
} = require('./lavamoat-kaspa-compatibility.cjs');
const ASSET_PATH = `static/wasm/kaspa_bg.${WASM_SHA256}.wasm.bin`;
const ORIGINAL_LOAD = `  const loadWebAssembly = require("./kaspa_bg.wasm.js");
  const bytes = loadWebAssembly();
  return await WebAssembly.instantiate(bytes.buffer, imports);`;

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function createExtensionKaspaRules() {
  const files = verifyPinnedPackage();
  return [
    {
      realResource: (resource) => resource === files.source,
      enforce: 'pre',
      use: [{ loader: __filename }],
    },
    {
      realResource: (resource) => resource === files.binary,
      type: 'asset/resource',
      generator: { filename: ASSET_PATH },
      use: [{ loader: __filename }],
    },
  ];
}

function extensionKaspaLoader(source) {
  const files = getPinnedPaths();
  const rawRequest = this._module?.rawRequest;
  if (
    ![files.source, files.binary].includes(this.resourcePath) ||
    fs.realpathSync(this.resourcePath) !== this.resourcePath ||
    this.resourceQuery ||
    this.resourceFragment ||
    typeof rawRequest !== 'string' ||
    rawRequest.includes('!') ||
    !Buffer.isBuffer(source)
  ) {
    throw new LavaMoatError(
      'Packaged Kaspa requires its unchanged physical resource',
    );
  }
  verifyPinnedPackage(this);
  const expectedDigest =
    this.resourcePath === files.source ? SOURCE_SHA256 : WASM_SHA256;
  if (digest(source) !== expectedDigest) {
    throw new LavaMoatError('Packaged Kaspa loader received modified source');
  }
  if (this.resourcePath === files.binary) return source;

  const original = transformKaspaCompatibility(source);
  if (original.split(ORIGINAL_LOAD).length !== 2) {
    throw new LavaMoatError('Packaged Kaspa initialization structure changed');
  }
  // Only the async byte source changes. Keep argument handling, initSync,
  // finalization and concurrent initialization semantics in the pinned SDK.
  return original.replace(
    ORIGINAL_LOAD,
    `  const id = chrome.runtime.id;
  const assetPath = ${JSON.stringify(ASSET_PATH)};
  const expectedUrl = "chrome-extension://" + id + "/" + assetPath;
  const assetUrl = new URL("kaspa_bg.wasm.bin", import.meta.url);
  if (!/^[a-p]{32}$/.test(id) || assetUrl.href !== expectedUrl ||
      chrome.runtime.getURL(assetPath) !== expectedUrl) {
    throw new Error("Packaged Kaspa URL does not belong to this extension");
  }
  const response = await fetch(expectedUrl, {
    credentials: "omit", redirect: "error", cache: "no-store"
  });
  if (response.status !== 200 || response.redirected || response.url !== expectedUrl) {
    throw new Error("Failed to read packaged Kaspa binary");
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== ${WASM_BYTE_LENGTH}) {
    throw new Error("Packaged Kaspa binary size mismatch");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0")).join("");
  if (hash !== ${JSON.stringify(WASM_SHA256)}) {
    throw new Error("Packaged Kaspa binary integrity mismatch");
  }
  return await WebAssembly.instantiate(bytes, imports);`,
  );
}

module.exports = extensionKaspaLoader;
module.exports.raw = true;
module.exports.createExtensionKaspaRules = createExtensionKaspaRules;
module.exports.getPinnedPaths = getPinnedPaths;
module.exports.ASSET_PATH = ASSET_PATH;
module.exports.WASM_SHA256 = WASM_SHA256;
module.exports.WASM_BYTE_LENGTH = WASM_BYTE_LENGTH;
