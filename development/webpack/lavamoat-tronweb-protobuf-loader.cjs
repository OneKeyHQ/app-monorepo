// cspell:ignore LavaMoat lavamoat protobuf tronweb

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { LavaMoatError } = require('../lavamoat/error.cjs');

const PACKAGE_VERSION = '6.1.1';
const SOURCE_PINS = {
  'protocol/core/Tron_pb.cjs':
    '74a8fff0b74ad8eccbb96ef8e393cf4bccad8d81ec76e19f48555996dc80499f',
  'protocol/core/contract/account_contract_pb.cjs':
    '5cae2fb9766d71602638a4ae6ba72d0a1ef6082cb58c040f7f3668a7d93a864a',
  'protocol/core/contract/balance_contract_pb.cjs':
    '6cf15a4cd5ef18dcc8be4d2372048024b04d8981dbddcc8b371816bec197b500',
  'protocol/core/contract/smart_contract_pb.cjs':
    '1777bcc946b8769a6be452f7c9bd22b6fecb874d92bfbeead07d894b3a3ff3a6',
  'utils/crypto.js': {
    commonjs:
      '1f339c6825ceacc048dc9a891311d1e4909a42f21c065177aafc0d165a88880e',
    esm: '74349a357fb7aa60e5d79f3e0cdc2a2dac0e619eb6121d98b1884a8c58ccc753',
  },
};
const DECLARATION = 'var goog = jspb;';
const EXTEND_PATTERN = /goog\.object\.extend\(proto,\s*[a-zA-Z0-9_]+\);/g;
const CRYPTO_PATTERN =
  /globalThis\.proto\.protocol\.Transaction\.deserializeBinary/g;

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function getPinnedTronWebFiles() {
  const entry = fs.realpathSync(require.resolve('tronweb'));
  const root = path.resolve(path.dirname(entry), '../..');
  const manifest = path.join(root, 'package.json');
  const files = Object.entries(SOURCE_PINS).flatMap(([relative, pin]) =>
    ['commonjs', 'esm'].map((format) => ({
      file: path.join(root, 'lib', format, relative),
      kind: relative === 'utils/crypto.js' ? 'crypto' : 'protobuf',
      relative: `lib/${format}/${relative}`,
      sha256: typeof pin === 'string' ? pin : pin[format],
    })),
  );
  return { entry, files, manifest, root };
}

function verifyPinnedTronWeb(context) {
  const pinned = getPinnedTronWebFiles();
  for (const file of [
    pinned.entry,
    pinned.manifest,
    ...pinned.files.map(({ file: sourceFile }) => sourceFile),
  ]) {
    if (fs.realpathSync(file) !== file) {
      throw new LavaMoatError(
        'Protected TronWeb protobuf sources must not be symbolic links',
      );
    }
    context?.addDependency(file);
  }
  const manifest = JSON.parse(fs.readFileSync(pinned.manifest, 'utf8'));
  if (
    manifest.name !== 'tronweb' ||
    manifest.version !== PACKAGE_VERSION ||
    manifest.main !== './lib/commonjs/index.js' ||
    manifest.module !== './lib/esm/index.js'
  ) {
    throw new LavaMoatError(
      'TronWeb package changed; review the protobuf namespace adapter',
    );
  }
  for (const { file, sha256 } of pinned.files) {
    if (digest(fs.readFileSync(file)) !== sha256) {
      throw new LavaMoatError(
        'TronWeb protobuf source changed; review the namespace adapter',
      );
    }
  }
  return pinned;
}

function transformTronWebProtobuf(source, kind = 'protobuf') {
  if (!Buffer.isBuffer(source)) {
    throw new LavaMoatError('TronWeb protobuf adapter requires raw source');
  }
  const original = source.toString('utf8');
  if (kind === 'crypto') {
    if ([...original.matchAll(CRYPTO_PATTERN)].length !== 1) {
      throw new LavaMoatError(
        'TronWeb crypto namespace structure changed; review the adapter',
      );
    }
    // The generated protobuf package exposes its classes through the local
    // TronWeb namespace. Avoid the stale ambient global used by this helper.
    return original.replace(
      CRYPTO_PATTERN,
      'globalThis.TronWebProto.Transaction.deserializeBinary',
    );
  }
  if (
    original.split(DECLARATION).length !== 2 ||
    [...original.matchAll(EXTEND_PATTERN)].length !== 1 ||
    /\b(?:const|let|var)\s+proto\b/.test(original)
  ) {
    throw new LavaMoatError(
      'TronWeb protobuf namespace structure changed; review the adapter',
    );
  }
  // JsPbCodeGenerator assumes every generated module shares one ambient
  // `proto` object. LavaMoat isolates dependency globals, so retain that
  // temporary merge namespace inside this module instead of the host realm.
  return original.replace(
    DECLARATION,
    `${DECLARATION}\nvar proto = Object.create(null);`,
  );
}

function createTronWebProtobufRule() {
  const { files } = verifyPinnedTronWeb();
  const allowed = new Set(files.map(({ file }) => file));
  return {
    realResource: (resource) => allowed.has(resource),
    enforce: 'pre',
    use: [{ loader: __filename }],
  };
}

function tronWebProtobufLoader(source) {
  const pinned = verifyPinnedTronWeb(this);
  const selected = pinned.files.find(({ file }) => file === this.resourcePath);
  if (
    !selected ||
    fs.realpathSync(this.resourcePath) !== this.resourcePath ||
    this.resourceQuery ||
    this.resourceFragment ||
    !this._module ||
    this._module.matchResource ||
    typeof this._module.rawRequest !== 'string' ||
    this._module.rawRequest.includes('!') ||
    !Buffer.isBuffer(source) ||
    digest(source) !== selected.sha256
  ) {
    throw new LavaMoatError(
      'Protected TronWeb protobuf requires an unchanged physical source',
    );
  }
  return transformTronWebProtobuf(source, selected.kind);
}

module.exports = tronWebProtobufLoader;
module.exports.raw = true;
module.exports.createTronWebProtobufRule = createTronWebProtobufRule;
module.exports.getPinnedTronWebFiles = getPinnedTronWebFiles;
module.exports.transformTronWebProtobuf = transformTronWebProtobuf;
module.exports.verifyPinnedTronWeb = verifyPinnedTronWeb;
module.exports.PACKAGE_VERSION = PACKAGE_VERSION;
module.exports.SOURCE_PINS = SOURCE_PINS;
