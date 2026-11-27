// cspell:ignore LavaMoat lavamoat kaspa wbg

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { LavaMoatError } = require('../lavamoat/error.cjs');

const PACKAGE_VERSION = '1.0.2';
const SOURCE_SHA256 =
  'c83b5c15eae317518f85de2d57a4200524f5e1c3beff790379108dd253a1ddc6';
const BASE64_SHA256 =
  '85e5a548bee4e76b9ab41a73452470cb37501a1b6d8f44fcb945ad282ffbbc5e';
const WASM_SHA256 =
  '97cbf561d387aad9c9f98a7b64645607f05199c3c814386c9f4c06354b9246b3';
const WASM_BYTE_LENGTH = 11_524_998;
function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function getPinnedPaths() {
  const manifest = fs.realpathSync(
    require.resolve('@onekeyfe/kaspa-wasm/package.json'),
  );
  const directory = path.dirname(manifest);
  return {
    manifest,
    source: path.join(directory, 'kaspa.js'),
    base64: path.join(directory, 'kaspa_bg.wasm.js'),
    binary: path.join(directory, 'kaspa_bg.wasm.bin'),
  };
}

function verifyPinnedPackage(context) {
  const files = getPinnedPaths();
  for (const file of Object.values(files)) {
    if (fs.realpathSync(file) !== file) {
      throw new LavaMoatError(
        'Packaged Kaspa sources must not be symbolic links',
      );
    }
    context?.addDependency(file);
  }
  const manifest = JSON.parse(fs.readFileSync(files.manifest, 'utf8'));
  if (
    manifest.name !== '@onekeyfe/kaspa-wasm' ||
    manifest.version !== PACKAGE_VERSION ||
    manifest.module !== 'kaspa.js' ||
    digest(fs.readFileSync(files.source)) !== SOURCE_SHA256 ||
    digest(fs.readFileSync(files.base64)) !== BASE64_SHA256
  ) {
    throw new LavaMoatError(
      'Packaged Kaspa source changed; review the pinned adapter',
    );
  }
  const bytes = fs.readFileSync(files.binary);
  if (bytes.length !== WASM_BYTE_LENGTH || digest(bytes) !== WASM_SHA256) {
    throw new LavaMoatError(
      'Packaged Kaspa binary changed; review the pinned adapter',
    );
  }
  const encoded = fs
    .readFileSync(files.base64, 'utf8')
    .match(/toUint8Array\('([A-Za-z0-9+/=]+)'\)/);
  if (!encoded || !Buffer.from(encoded[1], 'base64').equals(bytes)) {
    throw new LavaMoatError('Packaged Kaspa binary and embedded bytes differ');
  }
  return files;
}

const ORIGINAL_FUNCTION =
  '    const ret = new Function(getStringFromWasm0(arg0, arg1));';

// This function is serialized into the package's own compartment. It must not
// close over build-time values or return the build/renderer host's global object.
function createKaspaStaticFunction(body) {
  'use strict';
  const raf =
    '\n            if (!this.requestAnimationFrame){\n                if (this.setImmediate)\n                    this.requestAnimationFrame = (callback)=>setImmediate(callback)\n                else\n                    this.requestAnimationFrame = (callback)=>setTimeout(callback, 0)\n            }\n        ';
  const deferred =
    '\n                let resolve, reject;\n                const p = new Promise((resolve_, reject_) => {\n                    resolve = resolve_;\n                    reject = reject_;\n                });\n                p.resolve = resolve;\n                p.reject = reject;\n                return p;\n            ';
  // Every call site in this pinned WASM invokes the generated function with
  // undefined. Sloppy Function code used the creation realm's global; static
  // strict code must explicitly use this dependency's virtual global instead.
  function assertReceiver(receiver) {
    if (receiver !== undefined && receiver !== null) {
      throw new TypeError('Unsupported Kaspa generated function receiver');
    }
  }
  if (body === raf) {
    // The upstream WASM discards call0 errors. Reject unsupported environments
    // at construction as well, before its guarded invocation can swallow them.
    if (typeof requestAnimationFrame !== 'function') {
      throw new TypeError('Kaspa requires an existing requestAnimationFrame');
    }
    return function () {
      assertReceiver(this);
      // All supported browser targets already supply RAF. Installing a fallback
      // would require a new mutable global grant, which is deliberately absent.
      if (typeof requestAnimationFrame !== 'function') {
        throw new TypeError('Kaspa requires an existing requestAnimationFrame');
      }
    };
  }
  if (body === deferred) {
    return function () {
      assertReceiver(this);
      let resolve;
      let reject;
      const promise = new Promise((resolveValue, rejectValue) => {
        resolve = resolveValue;
        reject = rejectValue;
      });
      promise.resolve = resolve;
      promise.reject = reject;
      return promise;
    };
  }
  if (body === 'return this') {
    return function () {
      assertReceiver(this);
      return globalThis;
    };
  }
  throw new TypeError('Unsupported Kaspa generated function body');
}

function transformKaspaCompatibility(source) {
  if (
    !Buffer.isBuffer(source) ||
    createHash('sha256').update(source).digest('hex') !== SOURCE_SHA256
  ) {
    throw new LavaMoatError(
      'Kaspa compatibility requires the pinned original source',
    );
  }
  const original = source.toString('utf8');
  if (original.split(ORIGINAL_FUNCTION).length !== 2) {
    throw new LavaMoatError('Kaspa generated function structure changed');
  }
  return original.replace(
    ORIGINAL_FUNCTION,
    `    const ret = (${createKaspaStaticFunction.toString()})(getStringFromWasm0(arg0, arg1));`,
  );
}

function createKaspaCompatibilityRule() {
  const files = verifyPinnedPackage();
  return {
    realResource: (resource) => resource === files.source,
    enforce: 'pre',
    use: [{ loader: __filename }],
  };
}

function kaspaCompatibilityLoader(source) {
  const files = getPinnedPaths();
  if (
    this.resourcePath !== files.source ||
    fs.realpathSync(this.resourcePath) !== files.source ||
    this.resourceQuery ||
    this.resourceFragment ||
    typeof this._module?.rawRequest !== 'string' ||
    this._module.rawRequest.includes('!')
  ) {
    throw new LavaMoatError(
      'Kaspa compatibility requires its unchanged physical resource',
    );
  }
  verifyPinnedPackage(this);
  return transformKaspaCompatibility(source);
}

module.exports = kaspaCompatibilityLoader;
module.exports.raw = true;
module.exports.createKaspaCompatibilityRule = createKaspaCompatibilityRule;
module.exports.transformKaspaCompatibility = transformKaspaCompatibility;
module.exports.createKaspaStaticFunction = createKaspaStaticFunction;

module.exports.getPinnedPaths = getPinnedPaths;
module.exports.verifyPinnedPackage = verifyPinnedPackage;
module.exports.SOURCE_SHA256 = SOURCE_SHA256;
module.exports.WASM_SHA256 = WASM_SHA256;
module.exports.WASM_BYTE_LENGTH = WASM_BYTE_LENGTH;
