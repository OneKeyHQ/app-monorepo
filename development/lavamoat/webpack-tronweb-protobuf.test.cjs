// cspell:ignore LavaMoat lavamoat protobuf tronweb

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const LavaMoatPlugin = require('@lavamoat/webpack');
const { JSDOM } = require('jsdom');
const webpack = require('webpack');

const {
  createTronWebProtobufRule,
  getPinnedTronWebFiles,
  transformTronWebProtobuf,
} = require('../webpack/lavamoat-tronweb-protobuf-loader.cjs');

function write(directory, file, content) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

async function compile(
  directory,
  outputDirectory,
  policyDirectory,
  generatePolicyOnly,
  useAdapter,
) {
  const compiler = webpack({
    mode: 'production',
    context: directory,
    entry: './index.js',
    output: { path: outputDirectory, filename: 'main.js' },
    optimization: { minimize: false },
    resolveLoader: { modules: [path.resolve(__dirname, '../../node_modules')] },
    module: { rules: useAdapter ? [createTronWebProtobufRule()] : [] },
    plugins: [
      new LavaMoatPlugin({
        rootDir: directory,
        policyLocation: policyDirectory,
        generatePolicyOnly,
        readableResourceIds: true,
        inlineLockdown: /^main\.js$/,
        lockdown: { errorTrapping: 'none', errorTaming: 'unsafe' },
      }),
    ],
  });
  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) =>
        error ? reject(error) : resolve(result),
      );
    });
    assert.equal(
      stats.hasErrors(),
      false,
      stats.toString({ all: false, errors: true }),
    );
  } finally {
    await new Promise((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function execute(directory) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only',
  });
  dom.window.fixtureResult = {};
  try {
    vm.runInContext(
      fs.readFileSync(path.join(directory, 'main.js'), 'utf8'),
      dom.getInternalVMContext(),
    );
    return { result: dom.window.fixtureResult };
  } catch (error) {
    return { error };
  } finally {
    dom.window.close();
  }
}

test('protected TronWeb protobuf modules keep their merge namespace local', async () => {
  const pinned = getPinnedTronWebFiles();
  assert.equal(pinned.files.length, 10);
  for (const { file, kind } of pinned.files) {
    const transformed = transformTronWebProtobuf(fs.readFileSync(file), kind);
    if (kind === 'protobuf') {
      assert.equal(
        transformed.match(/var proto = Object\.create\(null\);/g)?.length,
        1,
      );
    } else {
      assert.equal(
        transformed.match(/globalThis\.TronWebProto\.Transaction/g)?.length,
        1,
      );
      assert.equal(transformed.includes('globalThis.proto.protocol'), false);
    }
  }
  const cryptoFile = pinned.files.find(
    ({ relative }) => relative === 'lib/commonjs/utils/crypto.js',
  );
  assert.ok(cryptoFile);
  const cryptoExports = {};
  const decodedBytes = Uint8Array.from([1, 2, 3]);
  const rawBytes = Uint8Array.from([4, 5]);
  const cryptoContext = {
    exports: cryptoExports,
    module: { exports: cryptoExports },
    require(request) {
      if (request === './code.js') {
        return { base64DecodeFromString: () => decodedBytes };
      }
      if (request === 'ethereum-cryptography/secp256k1') {
        return { secp256k1: { utils: {} } };
      }
      return {};
    },
    TronWebProto: {
      Transaction: {
        deserializeBinary(bytes) {
          assert.equal(bytes, decodedBytes);
          return {
            getRawData: () => ({ serializeBinary: () => rawBytes }),
          };
        },
      },
    },
  };
  vm.runInNewContext(
    transformTronWebProtobuf(fs.readFileSync(cryptoFile.file), cryptoFile.kind),
    cryptoContext,
  );
  assert.deepEqual(
    Array.from(cryptoExports.getRowBytesFromTransactionBase64('fixture')),
    [4, 5],
  );
  assert.equal(cryptoContext.proto, undefined);

  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-tronweb-')),
  );
  try {
    fs.mkdirSync(path.join(directory, 'node_modules'), { recursive: true });
    for (const name of ['tronweb', 'google-protobuf']) {
      fs.symlinkSync(
        path.resolve(__dirname, '../../node_modules', name),
        path.join(directory, 'node_modules', name),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    }
    write(
      directory,
      'node_modules/fixture-neighbor/package.json',
      JSON.stringify({
        name: 'fixture-neighbor',
        version: '1.0.0',
        main: 'index.js',
      }),
    );
    write(
      directory,
      'node_modules/fixture-neighbor/index.js',
      'module.exports = () => typeof globalThis.proto;',
    );
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'tronweb-protobuf-fixture',
        private: true,
        dependencies: {
          'fixture-neighbor': '1.0.0',
          'google-protobuf': '3.21.4',
          tronweb: '6.1.1',
        },
      }),
    );
    write(
      directory,
      'index.js',
      `const protocol = require('./node_modules/tronweb/lib/commonjs/protocol/core/Tron_pb.cjs');
       const neighbor = require('fixture-neighbor');
       Object.assign(fixtureResult, {
         accountType: typeof protocol.AccountId,
         serializedLength: new protocol.AccountId().serializeBinary().length,
         hostProto: typeof globalThis.proto,
         neighborProto: neighbor(),
       });`,
    );

    const baselineOutput = path.join(directory, 'baseline');
    const baselinePolicy = path.join(directory, 'baseline-policy');
    await compile(directory, baselineOutput, baselinePolicy, true, false);
    const baselinePolicyJson = JSON.parse(
      fs.readFileSync(path.join(baselinePolicy, 'policy.json'), 'utf8'),
    );
    assert.equal(baselinePolicyJson.resources.tronweb.globals.proto, true);
    await compile(directory, baselineOutput, baselinePolicy, false, false);
    const baseline = execute(baselineOutput);
    assert.match(
      baseline.error?.message ?? '',
      /Cannot set properties of undefined.*Any/,
    );

    const protectedOutput = path.join(directory, 'protected');
    const protectedPolicy = path.join(directory, 'protected-policy');
    await compile(directory, protectedOutput, protectedPolicy, true, true);
    const protectedPolicyJson = JSON.parse(
      fs.readFileSync(path.join(protectedPolicy, 'policy.json'), 'utf8'),
    );
    assert.equal(
      protectedPolicyJson.resources.tronweb.globals.proto,
      undefined,
    );
    assert.equal(
      Object.keys(protectedPolicyJson.resources.tronweb.globals).some((key) =>
        key.startsWith('proto.'),
      ),
      false,
    );
    await compile(directory, protectedOutput, protectedPolicy, false, true);
    const protectedResult = execute(protectedOutput);
    assert.equal(protectedResult.error, undefined);
    assert.deepEqual(protectedResult.result, {
      accountType: 'function',
      serializedLength: 0,
      hostProto: 'undefined',
      neighborProto: 'undefined',
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
