// cspell:ignore LavaMoat lavamoat lockdown Lockdown

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const { loadCanonicalNameMap } = require('@lavamoat/aa');
const LavaMoatPlugin = require('@lavamoat/webpack');
const webpack = require('webpack');

const pluginRequire = createRequire(require.resolve('@lavamoat/webpack'));
const { generateIdentifierLookup } = pluginRequire('./buildtime/aa.js');

function write(root, relative, source) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

function fixture(root) {
  const names = ['missing-a', 'missing-b', 'explicit-empty', 'importer'];
  write(
    root,
    'package.json',
    JSON.stringify({
      name: 'identifier-fixture-root',
      private: true,
      dependencies: Object.fromEntries(names.map((name) => [name, '1.0.0'])),
    }),
  );
  for (const name of names) {
    write(
      root,
      `node_modules/${name}/package.json`,
      JSON.stringify({
        name,
        version: '1.0.0',
        ...(name === 'importer' || name === 'missing-a'
          ? { dependencies: { 'missing-a': '1.0.0', 'missing-b': '1.0.0' } }
          : {}),
      }),
    );
  }
  write(
    root,
    'node_modules/missing-a/index.js',
    `
    exports.setMarker = () => { globalThis.fixtureOwnerMarker = 'public-owner-a'; };
    exports.readMarker = () => globalThis.fixtureOwnerMarker;
    exports.importB = () => require('missing-b').publicId;
    exports.ambient = () => [typeof fetch, typeof hostSecret];
  `,
  );
  write(
    root,
    'node_modules/missing-b/index.js',
    `
    exports.publicId = 'public-owner-b';
    exports.readMarker = () => globalThis.fixtureOwnerMarker;
    exports.ambient = () => [typeof fetch, typeof hostSecret];
  `,
  );
  write(
    root,
    'node_modules/explicit-empty/index.js',
    `
    exports.readMarker = () => globalThis.fixtureOwnerMarker;
    exports.ambient = () => [typeof fetch, typeof hostSecret];
  `,
  );
  write(
    root,
    'node_modules/importer/index.js',
    `
    exports.allowed = () => require('missing-a');
    exports.denied = () => require('missing-b');
  `,
  );
  write(
    root,
    'index.js',
    `
    const a = require('missing-a');
    const b = require('missing-b');
    const empty = require('explicit-empty');
    const importer = require('importer');
    a.setMarker();
    function denied(callback) {
      try { callback(); return false; }
      catch (error) { return /Policy does not allow importing/.test(error.message); }
    }
    Object.assign(fixtureResult, {
      ownMarker: a.readMarker(), neighborMarker: b.readMarker(), emptyMarker: empty.readMarker(),
      ownImportDenied: denied(() => a.importB()),
      allowedImport: importer.allowed() === a,
      otherImportDenied: denied(() => importer.denied()),
      ambient: [a.ambient(), b.ambient(), empty.ambient()],
      frozen: [Object.prototype, Array.prototype, Function.prototype].every(Object.isFrozen),
    });
  `,
  );
  return names;
}

async function compile(configuration) {
  const compiler = webpack(configuration);
  try {
    return await new Promise((resolve, reject) => {
      compiler.run((error, result) =>
        error ? reject(error) : resolve(result),
      );
    });
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('numeric identifiers cover real owners and edge-only targets without adding permissions', async () => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-identifiers-')),
  );
  try {
    const names = fixture(root);
    const canonicalNameMap = await loadCanonicalNameMap({
      rootDir: root,
      includeDevDeps: false,
    });
    const paths = [
      { path: path.join(root, 'index.js'), moduleId: 0 },
      ...names.map((name, index) => ({
        path: path.join(root, 'node_modules', name, 'index.js'),
        moduleId: index + 1,
      })),
    ];
    const policy = {
      resources: {
        '$root$': {},
        'explicit-empty': {},
        importer: {
          packages: {
            'missing-a': true,
            'edge-only-allowed': true,
            'edge-only-denied': false,
          },
        },
      },
    };
    const before = structuredClone(policy);
    const options = {
      paths,
      canonicalNameMap,
      contextModules: [],
      externals: {},
      policy,
    };
    const numeric = generateIdentifierLookup({
      ...options,
      readableResourceIds: false,
    });
    const allNames = [
      '$root$',
      ...names,
      'edge-only-allowed',
      'edge-only-denied',
    ];
    const ids = allNames.map((name) =>
      numeric.policyIdentifierToResourceId(name),
    );
    assert.equal(new Set(ids).size, allNames.length);
    assert.equal(numeric.root, '0');
    assert.equal(numeric.identifiersForModuleIds.length, names.length + 1);
    assert.ok(!ids.includes('undefined'));
    for (const name of ['never-mapped', 'toString', '__proto__']) {
      assert.throws(
        () => numeric.policyIdentifierToResourceId(name),
        /Unknown resource identifier/,
      );
    }
    assert.equal(
      numeric.pathToResourceId(path.join(root, 'index.js')),
      numeric.root,
    );
    for (const [index, name] of names.entries()) {
      assert.equal(
        numeric.pathToResourceId(paths[index + 1].path),
        numeric.policyIdentifierToResourceId(name),
      );
    }
    const translated = numeric.getTranslatedPolicy();
    assert.equal(
      Object.keys(translated.resources).length,
      Object.keys(policy.resources).length,
    );
    for (const name of [
      'missing-a',
      'missing-b',
      'edge-only-allowed',
      'edge-only-denied',
    ]) {
      assert.equal(
        translated.resources[numeric.policyIdentifierToResourceId(name)],
        undefined,
      );
    }
    const importerPolicy =
      translated.resources[numeric.policyIdentifierToResourceId('importer')];
    assert.equal(
      importerPolicy.packages[
        numeric.policyIdentifierToResourceId('missing-a')
      ],
      true,
    );
    assert.equal(
      importerPolicy.packages[
        numeric.policyIdentifierToResourceId('edge-only-allowed')
      ],
      true,
    );
    assert.equal(
      importerPolicy.packages[
        numeric.policyIdentifierToResourceId('edge-only-denied')
      ],
      false,
    );
    const reordered = generateIdentifierLookup({
      ...options,
      paths: paths.toReversed(),
      policy: {
        resources: Object.fromEntries(
          Object.entries(policy.resources).toReversed(),
        ),
      },
      readableResourceIds: false,
    });
    for (const name of allNames) {
      assert.equal(
        reordered.policyIdentifierToResourceId(name),
        numeric.policyIdentifierToResourceId(name),
      );
    }
    const readable = generateIdentifierLookup({
      ...options,
      readableResourceIds: true,
    });
    assert.deepEqual(readable.getTranslatedPolicy(), policy);
    assert.deepEqual(policy, before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('real webpack keeps omitted resource compartments and package denials in readable and numeric modes', async () => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-identifiers-runtime-')),
  );
  const hostBefore = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
  ].map(Object.isFrozen);
  try {
    fixture(root);
    const policy = {
      resources: {
        'explicit-empty': {},
        importer: { packages: { 'missing-a': true } },
      },
    };
    const before = structuredClone(policy);
    for (const readableResourceIds of [true, false]) {
      const output = path.join(
        root,
        readableResourceIds ? 'readable' : 'numeric',
      );
      const stats = await compile({
        mode: 'production',
        context: root,
        entry: './index.js',
        output: {
          path: output,
          filename: 'main.js',
          publicPath: '',
          globalObject: 'globalThis',
        },
        optimization: { minimize: false, concatenateModules: false },
        plugins: [
          new LavaMoatPlugin({
            rootDir: root,
            policyLocation: root,
            policy,
            readableResourceIds,
            inlineLockdown: /^main\.js$/,
            lockdown: { errorTrapping: 'none', reporting: 'none' },
          }),
        ],
      });
      assert.equal(
        stats.hasErrors(),
        false,
        stats.toString({ all: false, errors: true }),
      );
      const source = fs.readFileSync(path.join(output, 'main.js'), 'utf8');
      const ses = fs.readFileSync(pluginRequire.resolve('ses'), 'utf8');
      assert.equal(source.split(ses).length - 1, 1);
      const context = vm.createContext({});
      // All host fixtures belong to this VM. Never freeze Node's shared objects.
      vm.runInContext(
        "globalThis.fixtureResult={};globalThis.hostSecret='public-host-marker';globalThis.fetch=()=>{throw Error('No network fixture');};",
        context,
      );
      vm.runInContext(source, context, { timeout: 10_000 });
      const result = JSON.parse(
        vm.runInContext('JSON.stringify(fixtureResult)', context),
      );
      assert.equal(result.ownMarker, 'public-owner-a');
      assert.equal(
        result.neighborMarker,
        undefined,
        `neighbor must stay isolated in readable=${readableResourceIds}`,
      );
      assert.equal(result.emptyMarker, undefined);
      assert.equal(result.ownImportDenied, true);
      assert.equal(result.allowedImport, true);
      assert.equal(result.otherImportDenied, true);
      assert.deepEqual(
        result.ambient,
        Array.from({ length: 3 }, () => ['undefined', 'undefined']),
      );
      assert.equal(result.frozen, true);
      assert.deepEqual(policy, before);
    }
    assert.deepEqual(
      [Object.prototype, Array.prototype, Function.prototype].map(
        Object.isFrozen,
      ),
      hostBefore,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
