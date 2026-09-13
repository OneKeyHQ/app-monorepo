// cspell:ignore LavaMoat lavamoat

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { LavaMoatError } = require('../lavamoat/error.cjs');

const sourcePath = path.resolve(
  __dirname,
  '../../packages/shared/src/security/sesHarden/loadSes.ts',
);
const sourceSha256 =
  'c60cd05c6ee917b6bcd3b9b852c518d00ad409d6d79d50aac95aba2dade40d6c';

function createProtectedWebSesRule() {
  return {
    // Match physical identity, not a loader-controlled matchResource alias.
    realResource: (resource) => resource === sourcePath,
    enforce: 'pre',
    use: [__filename],
  };
}

function protectedWebSesLoader(source) {
  if (
    this.resourcePath !== sourcePath ||
    fs.realpathSync(this.resourcePath) !== sourcePath ||
    this.resourceQuery ||
    this.resourceFragment ||
    !this._module ||
    this._module.matchResource ||
    typeof this._module.rawRequest !== 'string' ||
    this._module.rawRequest.includes('!') ||
    createHash('sha256').update(source).digest('hex') !== sourceSha256
  ) {
    throw new LavaMoatError(
      'Protected Web requires the unchanged physical SES fallback loader',
    );
  }
  this.addDependency(sourcePath);
  // The trusted LavaMoat prelude already locks this realm before any module
  // runs. Keep the fallback fail-closed without bundling another SES version.
  // These checks use SES intrinsics already available in each compartment.
  return `export default function loadSes() {
    if (typeof harden !== 'function' || typeof lockdown !== 'function' ||
        !Object.isFrozen(Object.prototype) || !Object.isFrozen(Array.prototype) ||
        !Object.isFrozen(Function.prototype)) {
      throw new Error('Protected Web requires the existing LavaMoat SES prelude');
    }
  }`;
}

module.exports = protectedWebSesLoader;
module.exports.createProtectedWebSesRule = createProtectedWebSesRule;
