// cspell:ignore LavaMoat lavamoat noncharacter noncharacters

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash, webcrypto } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { TextDecoder } = require('node:util');
const vm = require('node:vm');

const { chromium } = require('playwright-core');
const webpack = require('webpack');

const localeLoader = require('../webpack/lavamoat-ext-locales-loader.cjs');
const workerLoader = require('../webpack/lavamoat-ext-worker-loader.cjs');

const { LavaMoatError } = require('./error.cjs');
const { javascriptLiteral } = require('./javascript-literal.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const acorn = createRequire(require.resolve('webpack'))('acorn');
const esbuild = createRequire(path.join(repoRoot, 'apps/cli/package.json'))(
  'esbuild',
);

function platformEnvFixtureSource(buildFlags) {
  const fixtureFlags = {
    isJest: false,
    isDev: false,
    isProduction: true,
    isWeb: false,
    isWebEmbed: false,
    isDesktop: false,
    isExtension: false,
    isNative: false,
    isExtChrome: false,
    isExtFirefox: false,
    isExtEdge: false,
    isE2E: false,
    enableNativeBackgroundThread: false,
    ...buildFlags,
  };
  const { code } = esbuild.transformSync(
    fs.readFileSync(
      path.join(repoRoot, 'packages/shared/src/platformEnv.ts'),
      'utf8',
    ),
    { loader: 'ts', format: 'cjs', target: 'es2022' },
  );
  // Execute the actual detection module. Only its five imported environment
  // inputs are synthetic; the DOM and worker globals in MV3 are browser-owned.
  return `const environment = (function(require) {
    const module = {exports:{}}; const exports = module.exports;
    ${code}
    return module.exports.default;
  })(request => {
    if (request === 'react-native') return {Platform:{OS:${javascriptLiteral(buildFlags.nativeOS || 'web')},Version:26}};
    if (request === './androidNativeEnv') return {ANDROID_CHANNEL:'google'};
    if (request === './appGlobals') return {};
    if (request === './utils/devModeUtils') return {isWebInDappMode:()=>false};
    if (request === './buildTimeEnv.js') return ${javascriptLiteral(fixtureFlags)};
    throw Error('Unexpected platform fixture dependency: '+request);
  });
  module.exports = { environment, windowType: typeof window, documentType: typeof document };
  `;
}

function prepareLocaleFixture(directory) {
  const packagePath = path.join(directory, 'node_modules/locale-fixture');
  write(
    packagePath,
    'package.json',
    JSON.stringify({
      name: 'locale-fixture',
      version: '1.0.0',
      main: 'src/locale/localeLoaders.ts',
    }),
  );
  for (const file of ['localeLoaders.ts', 'packagedLocale.ts']) {
    write(
      packagePath,
      `src/locale/${file}`,
      fs.readFileSync(
        path.join(repoRoot, 'packages/shared/src/locale', file),
        'utf8',
      ),
    );
  }
  fs.cpSync(
    path.join(repoRoot, 'packages/shared/src/locale/json'),
    path.join(packagePath, 'src/locale/json'),
    { recursive: true },
  );
  // Only the error constructor is synthetic; both locale implementation files
  // and every language's JSON bytes are the actual shipped repository sources.
  write(
    packagePath,
    'src/errors/index.ts',
    'export class OneKeyLocalError extends Error {}',
  );
  return path.join(packagePath, 'src/locale/localeLoaders.ts');
}

function transformLocaleFixture(sourcePath, overrides = {}) {
  const assets = new Map();
  const context = {
    resourcePath: sourcePath,
    resourceQuery: '',
    _module: { rawRequest: sourcePath },
    getOptions: () => ({ expectedPath: sourcePath }),
    addDependency() {},
    addContextDependency() {},
    emitFile: (file, bytes) => assets.set(file, bytes),
    ...overrides,
  };
  const source = localeLoader.call(
    context,
    fs.readFileSync(sourcePath, 'utf8'),
  );
  return { source, assets };
}

test('packaged locale generation binds the physical loader and preserves verified data, caching and retries', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-locales-')),
  );
  try {
    const sourcePath = prepareLocaleFixture(directory);
    const englishFile = path.join(path.dirname(sourcePath), 'json/en_US.json');
    const english = JSON.parse(fs.readFileSync(englishFile, 'utf8'));
    english.default = 'literal-default-message';
    Object.defineProperty(english, '__proto__', {
      value: 'literal-prototype-message',
      enumerable: true,
    });
    fs.writeFileSync(englishFile, JSON.stringify(english));
    const { source, assets } = transformLocaleFixture(sourcePath);
    assert.equal(assets.size, 19);
    assert.ok(!source.includes("import('./json/"));
    const rule = localeLoader.createExtensionLocaleRule(sourcePath);
    assert.equal(rule.realResource(sourcePath), true);
    assert.equal(rule.realResource(`${sourcePath}.untrusted.js`), false);
    for (const overrides of [
      { resourcePath: `${sourcePath}.untrusted.js` },
      { resourceQuery: '?untrusted=1' },
      { _module: { rawRequest: `fake.ts!=!${sourcePath}` } },
    ])
      assert.throws(
        () => transformLocaleFixture(sourcePath, overrides),
        /unchanged physical/,
      );
    const original = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(
      sourcePath,
      original.replace(
        "import('./json/bn.json')",
        "import('./json/' + 'bn.json')",
      ),
    );
    assert.throws(
      () => transformLocaleFixture(sourcePath),
      /Locale import structure changed/,
    );
    fs.writeFileSync(sourcePath, original);
    const id = 'a'.repeat(32);
    let requests = 0;
    let failure = 'status';
    const context = vm.createContext({
      chrome: {
        runtime: { id, getURL: (file) => `chrome-extension://${id}/${file}` },
      },
      crypto: webcrypto,
      TextDecoder,
      fetch: async (url, options) => {
        requests += 1;
        assert.equal(options.redirect, 'error');
        assert.equal(options.credentials, 'omit');
        assert.ok(url.startsWith(`chrome-extension://${id}/static/locales/`));
        const bytes = Buffer.from(
          assets.get(url.slice(`chrome-extension://${id}/`.length)),
        );
        if (failure === 'network')
          throw new LavaMoatError('Synthetic failed request');
        if (failure === 'hash') bytes[bytes.length - 2] ^= 1;
        return {
          ok: failure !== 'status',
          redirected: failure === 'redirect',
          url,
          arrayBuffer: async () =>
            bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.length,
            ),
        };
      },
    });
    const evaluate = (code, requireModule) => {
      context.module = { exports: {} };
      context.exports = context.module.exports;
      context.require = requireModule;
      vm.runInContext(
        esbuild.transformSync(code, {
          loader: 'ts',
          format: 'cjs',
          target: 'es2022',
        }).code,
        context,
      );
      return context.module.exports;
    };
    const runtime = evaluate(
      fs.readFileSync(
        path.join(path.dirname(sourcePath), 'packagedLocale.ts'),
        'utf8',
      ),
      () => ({ OneKeyLocalError: Error }),
    );
    const locale = evaluate(source, () => runtime);
    for (const type of ['status', 'network', 'redirect', 'hash']) {
      failure = type;
      await assert.rejects(locale.loadLocaleMessages('en-US'));
    }
    failure = '';
    const pending = locale.loadLocaleMessages('en-US');
    assert.equal(locale.loadLocaleMessages('en-US'), pending);
    const aliasPending = locale.loadLocaleMessages('en');
    const messages = await pending;
    assert.equal(await aliasPending, messages);
    const expected = JSON.parse(
      fs.readFileSync(
        path.join(path.dirname(sourcePath), 'json/en_US.json'),
        'utf8',
      ),
    );
    assert.equal(messages['global.confirm'], expected['global.confirm']);
    assert.equal(messages.default, 'literal-default-message');
    assert.equal(
      Object.getOwnPropertyDescriptor(messages, '__proto__').value,
      'literal-prototype-message',
    );
    assert.equal(requests, 5);
    assert.equal(await locale.loadLocaleMessages('en-US'), messages);
    assert.equal(requests, 5);
    locale.__clearLocaleMessagesCacheForTests();
    assert.equal(await locale.loadLocaleMessages('en-US'), messages);
    assert.equal(await locale.loadLocaleMessages('en'), messages);
    assert.equal(requests, 5);
    assert.equal(locale.LOCALE_KEYS.length, 20);
    await assert.rejects(
      runtime.createPackagedLocaleLoader({})(
        'https://example.invalid/locale.json',
      ),
      /Unknown packaged locale/,
    );
    assert.throws(
      () =>
        runtime.createPackagedLocaleLoader({
          'en_US.json': {
            path: '../private.json',
            sha256: '0'.repeat(64),
            byteLength: 1,
          },
        }),
      /Invalid packaged locale index/,
    );
    assert.equal(requests, 5);
    // JSON's special-looking keys remain own data properties, without merging.
    const dangerous = Buffer.from(
      '{"__proto__":"plain-data","constructor":"literal"}',
    );
    const hash = createHash('sha256').update(dangerous).digest('hex');
    const assetPath = `static/locales/fixture.${hash}.json`;
    assets.set(assetPath, dangerous);
    const value = await runtime.createPackagedLocaleLoader({
      'fixture.json': {
        path: assetPath,
        sha256: hash,
        byteLength: dangerous.length,
      },
    })('fixture.json');
    assert.equal(Object.hasOwn(value, '__proto__'), true);
    assert.equal(
      Object.getOwnPropertyDescriptor(value, '__proto__').value,
      'plain-data',
    );
    assert.equal(value.constructor, 'literal');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

// Extract the shipped SDK environment checks without executing wallet code.
function sdkEnvironmentSource(filename) {
  const source = fs.readFileSync(path.join(repoRoot, filename), 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest' });
  const environments = [];
  const extensions = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'getEnv')
      environments.push(source.slice(node.init.start, node.init.end));
    if (
      node.type === 'VariableDeclarator' &&
      node.id?.name === 'initialSettings'
    ) {
      for (const property of node.init.properties || [])
        if (property.key?.name === 'extension')
          extensions.push(
            source.slice(property.value.start, property.value.end),
          );
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  assert.equal(environments.length, 1);
  assert.equal(extensions.length, 1);
  return `(() => { var _a; const getEnv = ${environments[0]}; return { env: getEnv(), extension: ${extensions[0]} }; })()`;
}

function write(directory, file, source) {
  const filename = path.join(directory, file);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, source);
}

async function compile(config) {
  const compiler = webpack(config);
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
    return stats;
  } finally {
    await new Promise((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('packaged worker URLs use the extension root and reject unreviewed factories', () => {
  const { workerGenerator } = require('worker-loader/dist/utils');
  for (const name of ['pages', 'background', 'content-script']) {
    const filename = `${name}.0123456789.worker.js`;
    const source = workerGenerator({}, filename, '', {});
    const context = { getOptions: () => ({ name }) };
    const transformed = workerLoader.call(context, source);
    const urls = [];
    vm.runInNewContext(
      `${transformed.replace('export default ', '')}new Worker_fn();`,
      {
        Worker: class {
          constructor(url) {
            urls.push(url);
          }
        },
      },
    );
    assert.deepEqual(urls, [`/${filename}`]);
    for (const invalid of [
      source.replace(filename, `../${filename}`),
      source.replace(filename, `https://example.invalid/${filename}`),
      source.replace(filename, `blob:${filename}`),
      source.replace(filename, 'unknown.0123456789.worker.js'),
      `${source}void 0;`,
      workerGenerator({}, filename, '', { worker: 'SharedWorker' }),
      workerGenerator({}, filename, '', { esModule: false }),
      workerGenerator({}, filename, '', {
        worker: { type: 'Worker', options: { type: 'module' } },
      }),
    ])
      assert.throws(() => workerLoader.call(context, invalid), LavaMoatError);
    assert.throws(
      () =>
        workerLoader.call({ getOptions: () => ({ name: 'unknown' }) }, source),
      LavaMoatError,
    );
    assert.throws(
      () =>
        workerLoader.call(
          {
            getOptions: () => ({
              name: name === 'pages' ? 'background' : 'pages',
            }),
          },
          source,
        ),
      LavaMoatError,
    );
  }
});

test('extension configurations preserve MV3 CSP, isolate entries, and protect releases with an explicit Rspack rollback', () => {
  execFileSync(
    process.execPath,
    [
      '-e',
      `
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const create = require('./development/webpack/webpack.ext.config');
    const configs = create({basePath:path.resolve('apps/ext')});
    assert.deepEqual(configs.map(c=>c.name), ['pages','background','content-script']);
    for (const config of configs) {
      const plugin = config.plugins.find(p=>p.constructor.name==='LavaMoatPlugin');
      assert.equal(plugin.options.lockdown.evalTaming, 'no-eval');
      assert.equal(plugin.options.readableResourceIds, false);
      assert.ok(plugin.options.policyLocation.endsWith('ext/mv3/'+config.name));
      assert.equal(config.devtool, false);
      assert.equal(config.output.publicPath, '/');
      assert.equal(config.optimization.minimizer[0].options.parallel, 1);
      assert.equal(config.module.rules.filter(rule => rule.use?.some?.(use => use.loader?.endsWith('lavamoat-ext-locales-loader.cjs'))).length, config.name === 'content-script' ? 0 : 1);
      assert.equal(config.module.rules.filter(rule => rule.use?.some?.(use => use.loader?.endsWith('lavamoat-ext-kaspa-loader.cjs'))).length, config.name === 'pages' ? 2 : 0);
      const excluded = config.optimization.minimizer[0].options.exclude;
      for (const filename of ['injected.js', 'preload-html-head.js', 'ui-popup-boot.js']) assert.ok(excluded.test(filename));
      for (const filename of ['other.js', 'pages.injected.js', 'subdir/injected.js', 'background.bundle.js']) assert.ok(!excluded.test(filename));
      assert.ok(config.resolve.alias['@sentry/minimal$'].endsWith('sentry-minimal-compat'));
      assert.ok(config.resolve.alias['react-native-keyboard-controller'].endsWith('react-native-keyboard-controller-mock'));
      assert.equal(config.resolve.alias['algosdk$'], require.resolve('algosdk/dist/esm/index.js'));
      assert.equal(config.resolve.fullySpecified, false);
      assert.ok(config.output.path.includes('build/.lavamoat/chrome_v3/'));
      if (config.name !== 'pages') {
        assert.equal(config.optimization.runtimeChunk, false);
        assert.equal(config.optimization.splitChunks, false);
        assert.equal(config.output.chunkLoading, false);
        assert.equal(config.output.asyncChunks, false);
        assert.ok(plugin.options.inlineLockdown.test(config.name+'.bundle.js'));
        assert.ok(!plugin.options.inlineLockdown.test('other-'+config.name+'.bundle.js'));
      } else {
        assert.equal(config.output.crossOriginLoading, 'anonymous');
        assert.ok(config.plugins.some(plugin => plugin.constructor.name === 'SubresourceIntegrityPlugin'));
        assert.equal(config.optimization.removeAvailableModules, true);
        assert.equal(config.optimization.splitChunks.minSize, 20_000);
        assert.equal(config.optimization.splitChunks.maxAsyncRequests, 40);
        assert.equal(config.optimization.splitChunks.cacheGroups.default.minChunks, 2);
        assert.equal(config.optimization.splitChunks.cacheGroups.defaultVendors.reuseExistingChunk, true);
      }
    }
    const manifest = require('./apps/ext/src/manifest');
    assert.equal(manifest.manifest_version,3);
    assert.ok(!manifest.content_security_policy.extension_pages.includes("'unsafe-eval'"));
    assert.ok(!manifest.content_security_policy.extension_pages.includes("'unsafe-inline'"));
    assert.equal(manifest.background.service_worker,'background.bundle.js');
    assert.ok(manifest.content_scripts.some(c=>c.world==='MAIN' && c.js[0]==='injected.js'));
    const scripts = require('./apps/ext/package.json').scripts;
    assert.equal(scripts['build:v3'], 'yarn clean && yarn build:lavamoat:pages && yarn build:lavamoat:background && yarn build:lavamoat:content-script && yarn lavamoat:finalize:production');
    assert.equal(scripts['build:all:v3'], 'yarn build:v3 && node ./scripts/zip.js');
    assert.ok(scripts['build:v3:unprotected'].includes('rspack build'));
    assert.ok(!scripts['build:v3:unprotected'].includes('ONEKEY_LAVAMOAT'));
    assert.equal(scripts['build:all:v3:unprotected'], 'yarn build:v3:unprotected && node ./scripts/zip.js');
    assert.equal(scripts['lavamoat:finalize:production'], 'node ./scripts/finalize-production-assets.js --lavamoat --production-output && node ./scripts/check-build-output.js --lavamoat --production-output');
  `,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        EXT_MANIFEST_V3: '1',
        EXT_CHANNEL: 'chrome',
        ONEKEY_LAVAMOAT: '1',
        ONEKEY_LAVAMOAT_GENERATE_POLICY: '0',
        VERSION: '1.0.0',
      },
      stdio: 'pipe',
    },
  );
});

async function verifyProtectedExtension(contentScript) {
  const fixtureRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-extension-')),
  );
  const directory = path.join(fixtureRoot, 'apps/ext');
  fs.mkdirSync(directory, { recursive: true });
  const environment = [
    'NODE_ENV',
    'EXT_MANIFEST_V3',
    'EXT_CHANNEL',
    'ONEKEY_LAVAMOAT',
    'ONEKEY_LAVAMOAT_GENERATE_POLICY',
    'VERSION',
  ];
  const previous = Object.fromEntries(
    environment.map((name) => [name, process.env[name]]),
  );
  Object.assign(process.env, {
    NODE_ENV: 'production',
    EXT_MANIFEST_V3: '1',
    EXT_CHANNEL: 'chrome',
    ONEKEY_LAVAMOAT: '1',
    ONEKEY_LAVAMOAT_GENERATE_POLICY: '0',
    VERSION: '1.0.0',
  });
  let browser;
  let server;
  try {
    const create = require('../webpack/webpack.ext.config');
    const manifest = require('../../apps/ext/src/manifest');
    write(
      directory,
      'src/manifest/index.js',
      `module.exports = ${javascriptLiteral(manifest)};`,
    );
    for (const file of [
      'ui-popup-boot.html',
      'ui-popup-boot.js',
      'preload-html-head.js',
      'ui-oauth-callback.html',
      'img/icon-48.png',
      'img/icon-128.png',
      'img/icon-128-disable.png',
    ]) {
      // Use the real icons so Chromium validates the unchanged manifest.
      let source = '';
      if (file.endsWith('.png')) {
        source = fs.readFileSync(
          path.join(repoRoot, 'apps/ext/src/assets', file),
        );
      } else if (file.endsWith('.js')) {
        // Nonempty formatting makes a second minification observable.
        source = '/* Preserve this trusted copy verbatim. */\nvoid 0;\n';
      }
      write(directory, `src/assets/${file}`, source);
    }
    write(
      directory,
      'src/entry/injected.js',
      'globalThis.fixtureMainIntrinsicsMutable = !Object.isFrozen(Object.prototype);',
    );
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'extension-policy-fixture',
        private: true,
        dependencies: {
          'declared-reader': '1.0.0',
          'denied-reader': '1.0.0',
          'unapproved-dependency': '1.0.0',
          'chrome-writer': '1.0.0',
          'sdk-detector': '1.0.0',
          'browser-detector': '1.0.0',
          'locale-fixture': '1.0.0',
          'runtime-detector': '1.0.0',
          'worker-owner': '1.0.0',
        },
      }),
    );
    for (const name of [
      'declared-reader',
      'denied-reader',
      'unapproved-dependency',
      'chrome-writer',
      'sdk-detector',
      'browser-detector',
      'runtime-detector',
      'worker-owner',
    ]) {
      write(
        directory,
        `node_modules/${name}/package.json`,
        JSON.stringify({
          name,
          version: '1.0.0',
          main: 'index.js',
          dependencies:
            name === 'declared-reader'
              ? { 'unapproved-dependency': '1.0.0' }
              : {},
        }),
      );
    }
    write(
      directory,
      'node_modules/declared-reader/index.js',
      `
      module.exports = () => {
        let dependencyDenied = false;
        try { require('unapproved-dependency'); } catch { dependencyDenied = true; }
        return { id: chrome.runtime.id, url: chrome.runtime.getURL('fixture'),
          storage: typeof chrome.storage, secret: typeof fixtureHostSecret, dependencyDenied, noncharacter: '\\ufffe' };
      };
    `,
    );
    write(
      directory,
      'node_modules/denied-reader/index.js',
      `
      module.exports = () => {
        let evalDenied = false;
        try { Function('return globalThis')(); } catch { evalDenied = true; }
        return { chrome: typeof chrome, fetch: typeof fetch, secret: typeof fixtureHostSecret,
          evalDenied, prototypeMutable: Reflect.set(Object.prototype, 'fixtureMutation', true) };
      };
    `,
    );
    write(
      directory,
      'node_modules/unapproved-dependency/index.js',
      "module.exports = 'unapproved-marker';",
    );
    const deniedChrome = `({ storage: typeof chrome.storage, tabs: typeof chrome.tabs, connect: typeof chrome.runtime.connect, addListener: typeof chrome.runtime.onConnect?.addListener, fixtureSecret: typeof chrome.fixtureSecret })`;
    write(
      directory,
      'node_modules/chrome-writer/index.js',
      `const original = chrome; module.exports = () => { chrome = { ...original, fixtureSecret: 'synthetic-chrome-write-only-marker' }; };`,
    );
    const sdkChecks = [
      'node_modules/@onekeyfe/hd-core/dist/index.js',
      'node_modules/@onekeyfe/hd-web-sdk/build/onekey-js-sdk.js',
    ].map(sdkEnvironmentSource);
    write(
      directory,
      'node_modules/sdk-detector/index.js',
      `module.exports = () => ({ checks: [${sdkChecks.join(',')}], denied: ${deniedChrome}, hasListeners: typeof chrome.runtime.onConnect.hasListeners });`,
    );
    const chromeCheck = fs.readFileSync(
      path.join(
        repoRoot,
        'node_modules/react-virtualized/dist/es/Grid/utils/maxElementSize.js',
      ),
      'utf8',
    );
    const chartSource = fs.readFileSync(
      path.join(
        repoRoot,
        'node_modules/lightweight-charts/dist/lightweight-charts.production.mjs',
      ),
      'utf8',
    );
    const chartCheck = /void 0!==window\.chrome/.exec(chartSource);
    assert.ok(
      chartCheck,
      'The reviewed shipped chart Chromium check must remain explicit',
    );
    write(
      directory,
      'node_modules/browser-detector/index.js',
      `${chromeCheck}\nexport const result = () => ({ maxElementSize: getMaxElementSize(), chartIsChrome: ${chartCheck[0]}, denied: ${deniedChrome}, onConnect: typeof chrome.runtime.onConnect });`,
    );
    const rootSecret = `globalThis.fixtureHostSecret='synthetic-root-only-marker';`;
    write(
      directory,
      'node_modules/runtime-detector/index.js',
      platformEnvFixtureSource({
        isExtension: true,
        isExtChrome: true,
        isProduction: true,
      }),
    );
    const localeSource = prepareLocaleFixture(directory);
    const fakeLocaleSource = path.join(path.dirname(localeSource), 'fake.ts');
    fs.writeFileSync(
      fakeLocaleSource,
      'export default "physical-resource-not-shim";',
    );
    const forgedLocaleRequest = `${localeSource}!=!${fakeLocaleSource}`;
    const englishBytes = fs.readFileSync(
      path.join(path.dirname(localeSource), 'json/en_US.json'),
    );
    const englishAsset = `static/locales/en_US.${createHash('sha256').update(englishBytes).digest('hex')}.json`;
    write(
      directory,
      'locale-transpile-loader.cjs',
      `module.exports = function(source) { return require(${javascriptLiteral(require.resolve('esbuild', { paths: [path.join(repoRoot, 'apps/cli')] }))}).transformSync(source, {loader:'ts',target:'es2022'}).code; };`,
    );
    const bridgeModule = path.join(
      repoRoot,
      'node_modules/@onekeyfe/extension-bridge-hosted/dist/bridgeSetup/contentScript.js',
    );
    const collect = `(require('chrome-writer')(), {runtime:require('runtime-detector'),allowed:require('declared-reader')(),denied:require('denied-reader')(),sdkEnvironment:require('sdk-detector')(),browserEnvironment:require('browser-detector').result(),frozen:Object.isFrozen(Object.prototype)})`;
    const pageLocales = `const locale=require('locale-fixture');if(require(${javascriptLiteral(forgedLocaleRequest)}).default!=='physical-resource-not-shim')throw Error('Forged resource selected packaged locale loader');document.addEventListener('fixture-page-locale',()=>{Promise.resolve().then(async()=>{const request=JSON.parse(document.documentElement.getAttribute('data-fixture-locale-request'));if(request.identity){const [english,alias]=await Promise.all([locale.loadLocaleMessages('en-US'),locale.loadLocaleMessages('en')]);locale.__clearLocaleMessagesCacheForTests();const [again,aliasAgain]=await Promise.all([locale.loadLocaleMessages('en-US'),locale.loadLocaleMessages('en')]);return {ok:true,same:english===alias&&english===again&&english===aliasAgain};}const messages=await locale.loadLocaleMessages(request.locale);return {ok:true,value:messages['global.confirm']};}).catch(error=>({ok:false,error:error.message})).then(result=>{document.documentElement.setAttribute('data-fixture-locale-result',JSON.stringify(result));document.dispatchEvent(new Event('fixture-page-locale-ready'));});});`;
    write(
      directory,
      'node_modules/worker-owner/echo.worker.js',
      `onmessage=({data})=>postMessage({echo:data,url:location.href,harden:typeof harden,objectFrozen:Object.isFrozen(Object.prototype)});`,
    );
    write(
      directory,
      'node_modules/worker-owner/index.js',
      `import EchoWorker from './echo.worker.js';export const start=()=>new EchoWorker();`,
    );
    const pageWorker = `const packagedWorker=require('worker-owner').start();try{result.worker=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Packaged worker did not reply')),5000);packagedWorker.onmessage=({data})=>{clearTimeout(timer);resolve(data);};packagedWorker.onerror=()=>{clearTimeout(timer);reject(Error('Packaged worker failed'));};packagedWorker.postMessage('fixture-worker-message');});}finally{packagedWorker.terminate();}`;
    const pageEntry = ` ${rootSecret}${pageLocales}const result=${collect};import(/* webpackChunkName: "fixture-deep-lazy" */ './fixture-lazy.js').then(async module=>{result.lazy=module.default();${pageWorker}return chrome.runtime.sendMessage({fixture:'background'});}).then(background=>{const output=document.createElement('pre');output.id='fixture-result';output.textContent=JSON.stringify({result,background});document.body.appendChild(output);});`;
    write(
      directory,
      'src/entry/fixture-lazy.js',
      "module.exports=()=>({denied:require('denied-reader')(),remoteCode:'https://browser.sentry-cdn.com'});",
    );
    for (const file of ['ui-popup.tsx', 'ui-passkey.tsx', 'offscreen.ts'])
      write(directory, `src/entry/${file}`, pageEntry);
    write(
      directory,
      'src/entry/background.ts',
      ` ${rootSecret}const locale = require('locale-fixture');if(require(${javascriptLiteral(forgedLocaleRequest)}).default!=='physical-resource-not-shim')throw Error('Forged resource selected packaged locale loader');chrome.runtime.onConnect.addListener(port=>port.onMessage.addListener(message=>{if(message.fixtureBridgePing)port.postMessage({fixtureBridgePong:message.fixtureBridgePing});}));const result=${collect};chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{if(message.fixture==='background')sendResponse(result);if(message.fixture==='locale-identity'){Promise.all([locale.loadLocaleMessages('en-US'),locale.loadLocaleMessages('en')]).then(async ([english,alias])=>{locale.__clearLocaleMessagesCacheForTests();const [englishAgain,aliasAgain]=await Promise.all([locale.loadLocaleMessages('en-US'),locale.loadLocaleMessages('en')]);sendResponse({same:english===alias&&english===englishAgain&&english===aliasAgain});},error=>sendResponse({error:error.message}));return true;}if(message.fixture==='locale'){Promise.resolve().then(()=>locale.loadLocaleMessages(message.locale)).then(messages=>sendResponse({ok:true,value:messages['global.confirm']}),error=>sendResponse({ok:false,error:error.message}));return true;}});`,
    );
    write(
      directory,
      'src/entry/content-script.ts',
      ` ${rootSecret}require(${javascriptLiteral(bridgeModule)}).default.setupMessagePort();const result=${collect};function report(){document.documentElement.setAttribute('data-fixture-content',JSON.stringify(result));fetch(chrome.runtime.getURL(${javascriptLiteral(englishAsset)})).then(()=>document.documentElement.setAttribute('data-fixture-private-locale','accessible'),()=>document.documentElement.setAttribute('data-fixture-private-locale','denied'));}if(document.documentElement)report();else document.addEventListener('DOMContentLoaded',report,{once:true});`,
    );

    process.env.ONEKEY_LAVAMOAT_GENERATE_POLICY = '1';
    const generationConfigs = create({ basePath: directory });
    process.env.ONEKEY_LAVAMOAT_GENERATE_POLICY = '0';
    const configs = create({ basePath: directory });
    const prepare = (config) => {
      config.optimization.minimize = false;
      // Fixture sources are plain JavaScript; retain actual entry/runtime,
      // HTML/copy and LavaMoat plugins without compiling the application graph.
      config.module.rules = config.module.rules.filter((rule) =>
        rule.use?.some?.((use) => use.loader === 'worker-loader'),
      );
      if (config.name === 'background' || config.name === 'pages') {
        config.module.rules.push(
          {
            test: /\.ts$/,
            include: path.dirname(path.dirname(localeSource)),
            use: [path.join(directory, 'locale-transpile-loader.cjs')],
          },
          localeLoader.createExtensionLocaleRule(localeSource),
        );
      }
      config.resolveLoader = { modules: [path.join(repoRoot, 'node_modules')] };
      const plugin = config.plugins.find(
        (item) => item.constructor.name === 'LavaMoatPlugin',
      );
      plugin.options.policyLocation = path.join(
        directory,
        'policies',
        config.name,
      );
      return plugin;
    };
    for (const [index, config] of generationConfigs.entries()) {
      const plugin = prepare(config);
      const stats = await compile(config);
      const policy = JSON.parse(
        fs.readFileSync(
          path.join(plugin.options.policyLocation, 'policy.json'),
          'utf8',
        ),
      );
      if (config.name === 'pages') {
        assert.deepEqual(policy.resources['worker-owner'].globals, {
          Worker: true,
        });
      }
      if (config.name === 'background' || config.name === 'pages') {
        assert.equal(policy.resources['locale-fixture'].globals.fetch, true);
        assert.equal(
          policy.resources['locale-fixture'].globals['crypto.subtle.digest'],
          true,
        );
        assert.ok(
          ![...stats.compilation.modules].some((module) =>
            module.resource?.startsWith(
              path.join(path.dirname(localeSource), 'json') + path.sep,
            ),
          ),
          'Language JSON data must not remain JavaScript modules',
        );
      }
      assert.equal(
        policy.resources['declared-reader'].globals['chrome.runtime.id'],
        true,
      );
      assert.equal(
        policy.resources['declared-reader'].packages['unapproved-dependency'],
        true,
      );
      write(
        plugin.options.policyLocation,
        'policy-override.json',
        JSON.stringify({
          resources: {
            'declared-reader': {
              packages: { 'unapproved-dependency': false },
              globals: { 'chrome.storage': false, fixtureHostSecret: false },
            },
            'chrome-writer': { globals: { chrome: 'write' } },
            'sdk-detector': {
              globals: {
                chrome: false,
                'chrome.runtime.id': true,
                'chrome.runtime.onConnect.hasListeners': true,
              },
            },
            'browser-detector': {
              globals: { chrome: false, 'chrome.runtime.id': true },
            },
            'denied-reader': {
              globals: {
                chrome: false,
                fetch: false,
                fixtureHostSecret: false,
              },
            },
          },
        }),
      );
      prepare(configs[index]);
      configs[index].optimization.minimize = true;
      const enforcedStats = await compile(configs[index]);
      if (config.name === 'pages') {
        const runtimeChunk = [...enforcedStats.compilation.chunks].find(
          (chunk) => chunk.hasRuntime(),
        );
        const runtimeFile = [...runtimeChunk.files].find((file) =>
          file.endsWith('.js'),
        );
        const runtimeSource = fs.readFileSync(
          path.join(config.output.path, runtimeFile),
          'utf8',
        );
        const lazyChunks = [...enforcedStats.compilation.chunks].filter(
          (chunk) => !chunk.canBeInitial(),
        );
        assert.ok(
          lazyChunks.length > 0,
          'The actual extension configuration must load a lazy protected chunk',
        );
        for (const chunk of lazyChunks)
          for (const file of [...chunk.files].filter((candidate) =>
            candidate.endsWith('.js'),
          )) {
            const integrity = `sha384-${createHash('sha384')
              .update(fs.readFileSync(path.join(config.output.path, file)))
              .digest('base64')}`;
            assert.ok(
              runtimeSource.includes(integrity),
              'Lazy SRI must match final postprocessed bytes',
            );
          }
        const { parse: parseHtml } = createRequire(require.resolve('jsdom'))(
          'parse5',
        );
        for (const file of fs
          .readdirSync(config.output.path)
          .filter(
            (candidate) =>
              candidate.endsWith('.html') &&
              candidate !== 'ui-popup-boot.html' &&
              candidate !== 'ui-oauth-callback.html',
          )) {
          const scripts = [];
          const visit = (node) => {
            if (node.tagName === 'script')
              scripts.push(
                Object.fromEntries(
                  node.attrs.map(({ name, value }) => [name, value]),
                ),
              );
            node.childNodes?.forEach(visit);
          };
          visit(
            parseHtml(
              fs.readFileSync(path.join(config.output.path, file), 'utf8'),
            ),
          );
          const entries = scripts.filter(
            (script) =>
              script.src && !script.src.startsWith('/preload-html-head.js'),
          );
          assert.ok(entries.length >= 2);
          assert.equal(entries[0].src, `/${runtimeFile}`);
          for (const script of entries) {
            assert.equal(script.crossorigin, 'anonymous');
            assert.equal(
              script.integrity,
              `sha384-${createHash('sha384')
                .update(
                  fs.readFileSync(
                    path.join(config.output.path, script.src.slice(1)),
                  ),
                )
                .digest('base64')}`,
            );
          }
        }
      }
    }
    const outputRoot = path.join(directory, 'extension');
    fs.mkdirSync(outputRoot);
    const pageLocalesDirectory = path.join(
      configs.find((config) => config.name === 'pages').output.path,
      'static/locales',
    );
    const backgroundLocalesDirectory = path.join(
      configs.find((config) => config.name === 'background').output.path,
      'static/locales',
    );
    const localeAssets = fs.readdirSync(pageLocalesDirectory).toSorted();
    assert.equal(localeAssets.length, 19);
    assert.deepEqual(
      localeAssets,
      fs.readdirSync(backgroundLocalesDirectory).toSorted(),
    );
    for (const asset of localeAssets)
      assert.deepEqual(
        fs.readFileSync(path.join(pageLocalesDirectory, asset)),
        fs.readFileSync(path.join(backgroundLocalesDirectory, asset)),
        'Finalization must naturally deduplicate exact page/background locale bytes',
      );
    for (const config of configs)
      fs.cpSync(config.output.path, outputRoot, { recursive: true });
    const packagedEnglish = path.join(outputRoot, englishAsset);
    assert.deepEqual(fs.readFileSync(packagedEnglish), englishBytes);
    assert.equal(
      fs.readdirSync(path.join(outputRoot, 'static/locales')).length,
      19,
    );
    assert.ok(
      !manifest.web_accessible_resources.some(({ resources }) =>
        resources.some(
          (resource) => resource.includes('locales') || resource === '*',
        ),
      ),
    );
    const corrupted = Buffer.from(englishBytes);
    corrupted[corrupted.length - 2] ^= 1;
    fs.writeFileSync(packagedEnglish, corrupted);
    if (contentScript) {
      // Only the content script is the application artifact in this mode. The
      // packaged background is an echo fixture, not a wallet/background proof.
      fs.copyFileSync(
        contentScript,
        path.join(outputRoot, 'content-script.bundle.js'),
      );
    }
    for (const [asset, source] of [
      ['injected.js', 'src/entry/injected.js'],
      ['preload-html-head.js', 'src/assets/preload-html-head.js'],
      ['ui-popup-boot.js', 'src/assets/ui-popup-boot.js'],
    ]) {
      assert.deepEqual(
        fs.readFileSync(path.join(outputRoot, asset)),
        fs.readFileSync(path.join(directory, source)),
        `Trusted copied script must remain byte-identical: ${asset}`,
      );
    }
    assert.ok(
      fs.existsSync(path.join(outputRoot, 'ui-popup.html')),
      'The packaged popup must exist',
    );
    const packagedWorkers = fs
      .readdirSync(outputRoot)
      .filter((file) => /^pages\.[a-f0-9]{10}\.worker\.js$/.test(file));
    assert.equal(packagedWorkers.length, 1);
    const publicKeyHash = createHash('sha256')
      .update(Buffer.from(manifest.key, 'base64'))
      .digest('hex')
      .slice(0, 32);
    const extensionId = publicKeyHash
      .split('')
      .map((nibble) => String.fromCharCode(97 + Number.parseInt(nibble, 16)))
      .join('');
    const bridgeMessage = (value) =>
      JSON.stringify({
        channel: 'onekey@JS_BRIDGE_MESSAGE_EXT_CHANNEL',
        direction: 'onekey@JS_BRIDGE_MESSAGE_DIRECTION-INPAGE_TO_HOST',
        payload: { fixtureBridgePing: value },
      });
    server = http.createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      if (request.url === '/child') {
        response.end(
          `<!doctype html><html><body><script>parent.postMessage(${bridgeMessage('foreign-window')}, '*');parent.postMessage({fixtureForeignSent:true}, '*');</script></body></html>`,
        );
      } else {
        response.end(
          `<!doctype html><html><body>Unprivileged host page<script>globalThis.fixtureBridgeReplies=[];addEventListener('message',event=>{if(event.data?.payload?.fixtureBridgePong)fixtureBridgeReplies.push(event.data.payload.fixtureBridgePong);if(event.data?.fixtureForeignSent)postMessage(${bridgeMessage('after-foreign')}, '*')});postMessage(${bridgeMessage('same-window')}, '*');dispatchEvent(new MessageEvent('message',{data:${bridgeMessage('missing-source')}}));</script><iframe src="/child"></iframe></body></html>`,
        );
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const executablePath = [
      process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
      chromium.executablePath(),
    ]
      .filter(Boolean)
      .find((file) => fs.existsSync(file));
    assert.ok(
      executablePath,
      'Install Chromium for the protected extension fixture',
    );
    browser = await chromium.launchPersistentContext(
      path.join(directory, 'profile'),
      {
        executablePath,
        channel: 'chromium',
        headless: true,
        args: [
          `--disable-extensions-except=${outputRoot}`,
          `--load-extension=${outputRoot}`,
        ],
      },
    );
    const matchesWorker = (worker) =>
      worker.url() === `chrome-extension://${extensionId}/background.bundle.js`;
    const worker =
      browser.serviceWorkers().find(matchesWorker) ||
      (await browser.waitForEvent('serviceworker', {
        predicate: matchesWorker,
        timeout: 30_000,
      }));
    assert.ok(matchesWorker(worker));
    const page = await browser.newPage();
    const cdp = await browser.newCDPSession(page);
    const errors = [];
    cdp.on('Runtime.exceptionThrown', (event) =>
      errors.push(
        event.exceptionDetails.exception?.description ||
          event.exceptionDetails.text,
      ),
    );
    await cdp.send('Runtime.enable');
    const read = async (expression) => {
      const response = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      assert.equal(response.exceptionDetails, undefined);
      return response.result.value;
    };
    const verify = (result) => {
      assert.equal(result.frozen, true);
      assert.deepEqual(result.allowed, {
        id: extensionId,
        url: `chrome-extension://${extensionId}/fixture`,
        storage: 'undefined',
        secret: 'undefined',
        dependencyDenied: true,
        noncharacter: '\ufffe',
      });
      const expectedDeniedChrome = {
        storage: 'undefined',
        tabs: 'undefined',
        connect: 'undefined',
        addListener: 'undefined',
        fixtureSecret: 'undefined',
      };
      assert.deepEqual(result.sdkEnvironment, {
        checks: [
          { env: 'webextension', extension: extensionId },
          { env: 'webextension', extension: extensionId },
        ],
        denied: expectedDeniedChrome,
        hasListeners: 'function',
      });
      assert.deepEqual(result.browserEnvironment, {
        maxElementSize: 16_777_100,
        chartIsChrome: true,
        denied: expectedDeniedChrome,
        onConnect: 'undefined',
      });
      assert.deepEqual(result.denied, {
        chrome: 'undefined',
        fetch: 'undefined',
        secret: 'undefined',
        evalDenied: true,
        prototypeMutable: false,
      });
    };
    for (const filename of [
      'ui-popup.html',
      'ui-passkey.html',
      'offscreen.html',
    ]) {
      await page.goto(`chrome-extension://${extensionId}/${filename}`);
      // CDP reads avoid Playwright's injected eval-based UtilityScript. CSP
      // remains enforced and all test results are produced by packaged scripts.
      let result;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        result = await read(
          'document.getElementById("fixture-result")?.textContent',
        );
        if (result) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(result, `No protected startup result in ${filename}`);
      const parsed = JSON.parse(result);
      verify(parsed.result);
      verify(parsed.background);
      assert.deepEqual(parsed.result.lazy, {
        denied: parsed.result.denied,
        remoteCode: '',
      });
      assert.deepEqual(
        parsed.result.worker,
        {
          echo: 'fixture-worker-message',
          url: `chrome-extension://${extensionId}/${packagedWorkers[0]}`,
          harden: 'undefined',
          objectFrozen: false,
        },
        'A packaged Worker exchanges a real message in its separate, unprotected heap',
      );
      assert.equal(parsed.result.runtime.environment.isRuntimeBrowser, true);
      assert.equal(parsed.result.runtime.environment.runtimeRole, 'main');
      assert.equal(parsed.background.runtime.windowType, 'object');
      assert.equal(parsed.background.runtime.documentType, 'undefined');
      assert.equal(
        parsed.background.runtime.environment.isRuntimeBrowser,
        false,
      );
      assert.equal(
        parsed.background.runtime.environment
          .isExtensionBackgroundServiceWorker,
        true,
      );
      assert.equal(
        parsed.background.runtime.environment.runtimeRole,
        'background',
      );
    }
    let pageEnglishRequests = 0;
    page.on('request', (request) => {
      if (request.url() === `chrome-extension://${extensionId}/${englishAsset}`)
        pageEnglishRequests += 1;
    });
    const pageLocale = (request) =>
      read(
        `new Promise(resolve=>{document.addEventListener('fixture-page-locale-ready',()=>resolve(JSON.parse(document.documentElement.getAttribute('data-fixture-locale-result'))),{once:true});document.documentElement.setAttribute('data-fixture-locale-request',${javascriptLiteral(JSON.stringify(request))});document.dispatchEvent(new Event('fixture-page-locale'));})`,
      );
    const loadEnglish =
      'chrome.runtime.sendMessage({fixture:"locale",locale:"en-US"})';
    const corruptResult = await read(loadEnglish);
    assert.equal(corruptResult.ok, false);
    assert.match(corruptResult.error, /integrity mismatch/);
    const corruptPageResult = await pageLocale({ locale: 'en-US' });
    assert.equal(corruptPageResult.ok, false);
    assert.match(corruptPageResult.error, /integrity mismatch/);
    fs.writeFileSync(packagedEnglish, englishBytes);
    assert.deepEqual(await read(loadEnglish), {
      ok: true,
      value: JSON.parse(englishBytes.toString('utf8'))['global.confirm'],
    });
    assert.deepEqual(await pageLocale({ locale: 'en-US' }), {
      ok: true,
      value: JSON.parse(englishBytes.toString('utf8'))['global.confirm'],
    });
    for (const [locale, file] of [
      ['bn', 'bn'],
      ['de', 'de'],
      ['en', 'en_US'],
      ['es', 'es'],
      ['fr-FR', 'fr_FR'],
      ['hi-IN', 'hi_IN'],
      ['id', 'id'],
      ['it-IT', 'it_IT'],
      ['ja-JP', 'ja_JP'],
      ['ko-KR', 'ko_KR'],
      ['pt', 'pt'],
      ['pt-BR', 'pt_BR'],
      ['ru', 'ru'],
      ['th-TH', 'th_TH'],
      ['uk-UA', 'uk_UA'],
      ['vi', 'vi'],
      ['zh-CN', 'zh_CN'],
      ['zh-HK', 'zh_HK'],
      ['zh-TW', 'zh_TW'],
    ]) {
      const expected = JSON.parse(
        fs.readFileSync(
          path.join(path.dirname(localeSource), `json/${file}.json`),
          'utf8',
        ),
      );
      assert.deepEqual(
        await read(
          `chrome.runtime.sendMessage(${javascriptLiteral({ fixture: 'locale', locale })})`,
        ),
        { ok: true, value: expected['global.confirm'] },
      );
      assert.deepEqual(await pageLocale({ locale }), {
        ok: true,
        value: expected['global.confirm'],
      });
    }
    assert.deepEqual(await pageLocale({ identity: true }), {
      ok: true,
      same: true,
    });
    assert.equal(
      pageEnglishRequests,
      2,
      'Page aliases and cache resets reuse one verified object; only failed and successful loads fetch',
    );
    assert.deepEqual(
      await read("chrome.runtime.sendMessage({fixture:'locale-identity'})"),
      { same: true },
    );
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const content = await read(
      'document.documentElement.getAttribute("data-fixture-content")',
    );
    if (!contentScript) {
      assert.ok(
        content,
        'The isolated content script must start under its actual MV3 manifest',
      );
      verify(JSON.parse(content));
      const { environment: contentEnvironment } = JSON.parse(content).runtime;
      assert.equal(contentEnvironment.isRuntimeBrowser, true);
      assert.equal(contentEnvironment.isExtensionUi, false);
      assert.equal(contentEnvironment.isExtensionBackground, false);
      assert.equal(contentEnvironment.runtimeRole, 'standalone');
      let privateRead;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        privateRead = await read(
          'document.documentElement.getAttribute("data-fixture-private-locale")',
        );
        if (privateRead) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(privateRead, 'denied');
    }
    assert.equal(await read('globalThis.fixtureMainIntrinsicsMutable'), true);
    assert.equal(await read('Object.isFrozen(Object.prototype)'), false);
    let replies;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      replies = await read('globalThis.fixtureBridgeReplies');
      if (replies?.includes('after-foreign')) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.deepEqual(errors, [], 'Protected extension scripts must not throw');
    assert.deepEqual(
      replies,
      ['same-window', 'after-foreign'],
      'The shipped bridge must forward same-window messages and reject foreign-window messages',
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    for (const name of environment) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test('protected MV3 pages, service worker and isolated content scripts enforce declared permissions without changing the page realm', () =>
  verifyProtectedExtension());

if (process.env.ONEKEY_LAVAMOAT_TEST_CONTENT_SCRIPT) {
  test('the exact production content script starts and routes native messages with a fixture background', () =>
    verifyProtectedExtension(
      fs.realpathSync(process.env.ONEKEY_LAVAMOAT_TEST_CONTENT_SCRIPT),
    ));
}

test('protected finalization requires all compilers and preserves normal extension artifacts', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-ext-finalize-'),
  );
  try {
    write(
      directory,
      'scripts/finalize-production-assets.js',
      fs.readFileSync(
        path.join(repoRoot, 'apps/ext/scripts/finalize-production-assets.js'),
      ),
    );
    const staging = 'build/.lavamoat/chrome_v3';
    write(directory, 'build/chrome_v3/normal.txt', 'normal-build');
    write(
      directory,
      'build/lavamoat/chrome_v3/previous.txt',
      'previous-protected-build',
    );
    const finalize = (args = [], keepStaging = true) =>
      execFileSync(
        process.execPath,
        [
          path.join(directory, 'scripts/finalize-production-assets.js'),
          '--lavamoat',
          '--browser=chrome',
          ...args,
        ],
        {
          stdio: 'pipe',
          env: {
            ...process.env,
            EXT_KEEP_RSPACK_STAGING: keepStaging ? '1' : '0',
          },
        },
      );
    write(
      directory,
      `${staging}/pages/ui-popup.html`,
      '<html>Protected page</html>',
    );
    write(
      directory,
      `${staging}/background/background.bundle.js`,
      'protected background',
    );
    assert.throws(finalize, /Missing extension compiler output/);
    assert.equal(
      fs.readFileSync(
        path.join(directory, 'build/lavamoat/chrome_v3/previous.txt'),
        'utf8',
      ),
      'previous-protected-build',
    );
    write(
      directory,
      `${staging}/content-script/content-script.bundle.js`,
      'protected content script',
    );
    write(
      directory,
      `${staging}/content-script/ui-popup.html`,
      '<html>Conflicting page</html>',
    );
    assert.throws(finalize, /Conflicting compiler output/);
    fs.unlinkSync(
      path.join(directory, staging, 'content-script/ui-popup.html'),
    );
    finalize();
    assert.deepEqual(
      fs
        .readdirSync(path.join(directory, 'build/lavamoat/chrome_v3'))
        .toSorted(),
      ['background.bundle.js', 'content-script.bundle.js', 'ui-popup.html'],
    );
    assert.equal(
      fs.readFileSync(
        path.join(directory, 'build/chrome_v3/normal.txt'),
        'utf8',
      ),
      'normal-build',
    );
    finalize(['--production-output'], false);
    const expectedFiles = [
      'background.bundle.js',
      'content-script.bundle.js',
      'ui-popup.html',
    ];
    for (const output of ['build/chrome_v3', 'build/lavamoat/chrome_v3']) {
      assert.deepEqual(
        fs.readdirSync(path.join(directory, output)).toSorted(),
        expectedFiles,
      );
    }
    assert.equal(fs.existsSync(path.join(directory, staging)), false);
    // The unchanged Rspack finalizer still supports an explicit full rollback.
    for (const compiler of ['pages', 'background', 'content-script']) {
      write(
        directory,
        `build/.rspack/chrome_v3/${compiler}/${compiler}.txt`,
        `normal ${compiler}`,
      );
    }
    execFileSync(
      process.execPath,
      [path.join(directory, 'scripts/finalize-production-assets.js')],
      { stdio: 'pipe' },
    );
    assert.deepEqual(
      fs.readdirSync(path.join(directory, 'build/chrome_v3')).toSorted(),
      ['background.txt', 'content-script.txt', 'pages.txt'],
    );
    assert.deepEqual(
      fs
        .readdirSync(path.join(directory, 'build/lavamoat/chrome_v3'))
        .toSorted(),
      expectedFiles,
    );
    for (const script of [
      'finalize-production-assets.js',
      'check-build-output.js',
    ]) {
      write(
        directory,
        `scripts/${script}`,
        fs.readFileSync(path.join(repoRoot, 'apps/ext/scripts', script)),
      );
      assert.throws(
        () =>
          execFileSync(
            process.execPath,
            [path.join(directory, 'scripts', script), '--production-output'],
            { stdio: 'pipe' },
          ),
        /requires --lavamoat/,
      );
    }
    // Distinct missing references prove the checker inspects the selected output.
    for (const [output, reference] of [
      ['build/chrome_v3', 'production-entry.js'],
      ['build/lavamoat/chrome_v3', 'isolated-entry.js'],
    ]) {
      write(
        directory,
        `${output}/manifest.json`,
        JSON.stringify({
          manifest_version: 3,
          background: { service_worker: reference },
        }),
      );
    }
    const check = (args) =>
      execFileSync(
        process.execPath,
        [path.join(directory, 'scripts/check-build-output.js'), ...args],
        { stdio: 'pipe' },
      );
    assert.throws(
      () => check(['--lavamoat']),
      /missing asset: isolated-entry.js/,
    );
    assert.throws(
      () => check(['--lavamoat', '--production-output']),
      /missing asset: production-entry.js/,
    );
    assert.throws(() => check([]), /missing asset: production-entry.js/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('extension global shims install missing aliases before and after lockdown without patching intrinsics', () => {
  const shim = fs.readFileSync(
    path.join(repoRoot, 'packages/shared/src/polyfills/globalShim.js'),
    'utf8',
  );
  const ses = fs.readFileSync(require.resolve('ses'), 'utf8');
  for (const file of [
    'polyfillsExtContentScript.ts',
    'polyfillsPlatform.ext.ts',
  ]) {
    const source = fs.readFileSync(
      path.join(repoRoot, 'packages/shared/src/polyfills', file),
      'utf8',
    );
    assert.equal(source.match(/import ['"]([^'"]+)['"]/)[1], './globalShim');
    assert.ok(!source.includes("import 'core-js/es7/global'"));
    assert.ok(!source.includes("import 'globalthis'"));
  }
  for (const protectedRuntime of [false, true]) {
    // All intrinsics are allocated in this VM realm; no host functions are
    // exposed to lockdown or accidentally frozen by the regression fixture.
    const context = vm.createContext({});
    if (protectedRuntime) {
      vm.runInContext(ses, context);
      vm.runInContext(
        "lockdown({evalTaming:'no-eval',errorTrapping:'none',unhandledRejectionTrapping:'none'})",
        context,
      );
    }
    vm.runInContext(
      'var fixtureRoot=this; var originalToString=Function.prototype.toString; this.self=this; delete this.global; delete this.globalThis;',
      context,
    );
    vm.runInContext(shim, context);
    assert.equal(
      vm.runInContext(
        'globalThis === fixtureRoot && global === globalThis && Function.prototype.toString === originalToString',
        context,
      ),
      true,
    );
    assert.equal(
      vm.runInContext('Object.isFrozen(Function.prototype)', context),
      protectedRuntime,
    );
  }
  assert.equal(Object.isFrozen(Function.prototype), false);
});

// Removing a child definition must use the intersection of every parent path,
// including separate entry pages that share a runtime filename but not a heap.
test('removing available parent modules preserves independent entries, deep lazy loading and policy denial', async () => {
  const HtmlWebpackPlugin = require('html-webpack-plugin');
  const {
    SubresourceIntegrityPlugin,
  } = require('webpack-subresource-integrity');
  const {
    createLavaMoatWebpackPlugin,
    createLavaMoatWebpackValidationPlugin,
  } = require('../webpack/lavamoat');
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-parent-chunks-')),
  );
  const previous = process.env.ONEKEY_LAVAMOAT;
  process.env.ONEKEY_LAVAMOAT = '1';
  let browser;
  let server;
  let servedRoot;
  try {
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'parent-chunks-root',
        dependencies: {
          'always-shared': '1.0.0',
          'sometimes-shared': '1.0.0',
          'unapproved-package': '1.0.0',
        },
      }),
    );
    for (const name of [
      'always-shared',
      'sometimes-shared',
      'unapproved-package',
    ]) {
      write(
        directory,
        `node_modules/${name}/package.json`,
        JSON.stringify({ name, version: '1.0.0' }),
      );
      write(
        directory,
        `node_modules/${name}/index.js`,
        name === 'unapproved-package'
          ? 'module.exports = "must remain denied";'
          : `module.exports = () => {let denied=false;try{require('unapproved-package')}catch(error){denied=/^Policy does not allow importing [0-9]+ from [0-9]+$/.test(error.message)}return {allowed:fixtureAllowed,secret:typeof fixtureSecret,fetch:typeof fetch,denied};};`,
      );
    }
    write(
      directory,
      'policy.json',
      JSON.stringify({
        resources: {
          'always-shared': { globals: { fixtureAllowed: true } },
          'sometimes-shared': { globals: { fixtureAllowed: true } },
          'unapproved-package': {},
        },
      }),
    );
    for (const entry of ['a', 'b'])
      write(
        directory,
        `${entry}.js`,
        `document.documentElement.dataset.initial=JSON.stringify(require('always-shared')());${entry === 'a' ? "document.documentElement.dataset.partialInitial=JSON.stringify(require('sometimes-shared')());" : ''}document.addEventListener('fixture-load-deep',()=>import('./first.js').then(m=>m.default()).then(result=>{document.documentElement.dataset.deep=JSON.stringify(result);document.dispatchEvent(new Event('fixture-deep-ready'));}));`,
      );
    write(
      directory,
      'first.js',
      "module.exports = () => import('./second.js').then(m=>m.default());",
    );
    write(
      directory,
      'second.js',
      "module.exports = () => ({always:require('always-shared')(),sometimes:require('sometimes-shared')()});",
    );
    const results = [];
    for (const removeAvailableModules of [false, true]) {
      const plugin = createLavaMoatWebpackPlugin({
        basePath: directory,
        target: 'ext',
        readableResourceIds: false,
      });
      plugin.options.policyLocation = directory;
      const output = path.join(directory, String(removeAvailableModules));
      const stats = await compile({
        mode: 'production',
        context: directory,
        entry: { a: './a.js', b: './b.js' },
        target: ['web', 'es2022'],
        output: {
          path: output,
          filename: '[name].[contenthash:10].bundle.js',
          chunkFilename: '[name].[contenthash:10].chunk.js',
          publicPath: '/',
          crossOriginLoading: 'anonymous',
        },
        optimization: {
          minimize: false,
          removeAvailableModules,
          runtimeChunk: { name: 'lavamoat-runtime' },
          splitChunks: {
            chunks: 'all',
            minSize: 102_400,
            maxSize: 4_194_304,
            maxInitialRequests: 20,
            maxAsyncRequests: 40,
            cacheGroups: {
              defaultVendors: {
                test: /[\\/]node_modules[\\/]/,
                priority: -10,
                reuseExistingChunk: true,
              },
              default: {
                minChunks: 2,
                priority: -20,
                reuseExistingChunk: true,
              },
            },
          },
        },
        plugins: [
          {
            apply(compiler) {
              compiler.hooks.compilation.tap(
                'ParentDefinitionFixture',
                (compilation) => {
                  let inserted = false;
                  compilation.hooks.optimizeChunks.tap(
                    { name: 'ParentDefinitionFixture', stage: -100 },
                    () => {
                      if (inserted) return;
                      inserted = true;
                      // Basic graphs already remove this during graph construction.
                      // Model the redundant definition an earlier chunk transform
                      // can leave, without changing its source, module ID, or owner.
                      const modules = [...compilation.modules];
                      const shared = modules.find(
                        (module) =>
                          module.resource ===
                          path.join(
                            directory,
                            'node_modules/always-shared/index.js',
                          ),
                      );
                      const lazy = modules.find(
                        (module) =>
                          module.resource === path.join(directory, 'second.js'),
                      );
                      const chunks = [
                        ...compilation.chunkGraph.getModuleChunksIterable(lazy),
                      ];
                      assert.equal(chunks.length, 1);
                      compilation.chunkGraph.connectChunkAndModule(
                        chunks[0],
                        shared,
                      );
                    },
                  );
                },
              );
            },
          },
          ...['a', 'b'].map(
            (entry) =>
              new HtmlWebpackPlugin({
                filename: `${entry}.html`,
                chunks: [entry],
                templateContent:
                  '<!doctype html><html><head><link rel="icon" href="data:,"></head><body></body></html>',
              }),
          ),
          new SubresourceIntegrityPlugin({ hashFuncNames: ['sha384'] }),
          plugin,
          createLavaMoatWebpackValidationPlugin(),
        ],
      });
      const counts = {};
      for (const module of stats.compilation.modules)
        for (const name of ['always-shared', 'sometimes-shared'])
          if (
            module.resource ===
            path.join(directory, 'node_modules', name, 'index.js')
          )
            counts[name] = [
              ...stats.compilation.chunkGraph.getModuleChunksIterable(module),
            ].length;
      const ses = fs.readFileSync(
        createRequire(require.resolve('@lavamoat/webpack')).resolve('ses'),
        'utf8',
      );
      const runtime = fs
        .readdirSync(output)
        .filter((file) =>
          /^lavamoat-runtime\.[a-f0-9]+\.bundle\.js$/.test(file),
        );
      assert.equal(runtime.length, 1);
      for (const file of fs
        .readdirSync(output)
        .filter((candidate) => candidate.endsWith('.js')))
        assert.equal(
          fs.readFileSync(path.join(output, file), 'utf8').split(ses).length -
            1,
          file === runtime[0] ? 1 : 0,
        );
      for (const entry of ['a', 'b']) {
        const html = fs.readFileSync(
          path.join(output, `${entry}.html`),
          'utf8',
        );
        const { parse } = createRequire(require.resolve('jsdom'))('parse5');
        const scripts = [];
        const visit = (node) => {
          if (node.tagName === 'script')
            scripts.push(
              Object.fromEntries(
                node.attrs.map(({ name, value }) => [name, value]),
              ),
            );
          node.childNodes?.forEach(visit);
        };
        visit(parse(html));
        assert.equal(scripts[0].src, `/${runtime[0]}`);
        for (const script of scripts)
          assert.equal(
            script.integrity,
            `sha384-${createHash('sha384')
              .update(fs.readFileSync(path.join(output, script.src.slice(1))))
              .digest('base64')}`,
          );
      }
      results.push({ output, counts });
    }
    assert.ok(
      results[0].counts['always-shared'] > results[1].counts['always-shared'],
    );
    assert.ok(
      results[1].counts['sometimes-shared'] >= 2,
      'A module missing from entry b must remain in their common lazy descendant',
    );
    server = http.createServer((request, response) => {
      const filename = path.join(
        servedRoot,
        new URL(request.url, 'http://localhost').pathname,
      );
      response.setHeader(
        'Content-Security-Policy',
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
      );
      response.setHeader(
        'Content-Type',
        filename.endsWith('.html')
          ? 'text/html; charset=utf-8'
          : 'application/javascript; charset=utf-8',
      );
      if (fs.existsSync(filename)) response.end(fs.readFileSync(filename));
      else response.writeHead(404).end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
      channel: 'chromium',
      headless: true,
      ...(process.env.ONEKEY_LAVAMOAT_TEST_CHROME
        ? { executablePath: process.env.ONEKEY_LAVAMOAT_TEST_CHROME }
        : {}),
    });
    const expected = {
      allowed: 'allowed',
      secret: 'undefined',
      fetch: 'undefined',
      denied: true,
    };
    for (const result of results)
      for (const entry of ['a', 'b']) {
        servedRoot = result.output;
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          await page.addInitScript(() => {
            globalThis.fixtureAllowed = 'allowed';
            globalThis.fixtureSecret = 'host-only';
          });
          const cdp = await context.newCDPSession(page);
          await cdp.send('Runtime.enable');
          const errors = [];
          page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
          });
          cdp.on('Runtime.exceptionThrown', (event) =>
            errors.push(event.exceptionDetails),
          );
          cdp.on('Runtime.consoleAPICalled', (event) => {
            if (event.type === 'error')
              errors.push(
                event.args.map((arg) => arg.description ?? arg.value),
              );
          });
          await page.goto(
            `http://127.0.0.1:${server.address().port}/${entry}.html`,
          );
          const read = async (expression) => {
            const value = await cdp.send('Runtime.evaluate', {
              expression,
              awaitPromise: true,
              returnByValue: true,
            });
            assert.equal(value.exceptionDetails, undefined);
            return value.result.value;
          };
          assert.deepEqual(
            await read('JSON.parse(document.documentElement.dataset.initial)'),
            expected,
            JSON.stringify(errors),
          );
          assert.deepEqual(
            await read(
              `new Promise(resolve=>{document.addEventListener('fixture-deep-ready',()=>resolve(JSON.parse(document.documentElement.dataset.deep)),{once:true});document.dispatchEvent(new Event('fixture-load-deep'));})`,
            ),
            {
              always: expected,
              sometimes: expected,
            },
          );
          assert.equal(await read('Object.isFrozen(Object.prototype)'), true);
          assert.equal(
            await read(
              '(()=>{try{eval("1");return false}catch{return true}})()',
            ),
            true,
          );
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      }
  } finally {
    if (previous === undefined) delete process.env.ONEKEY_LAVAMOAT;
    else process.env.ONEKEY_LAVAMOAT = previous;
    await browser?.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('platform detection distinguishes DOM documents, worker aliases, Node and both native roles', () => {
  const cases = [
    {
      name: 'undefined document',
      document: 'undefined',
      flags: { isExtension: true },
      browser: false,
      role: 'standalone',
    },
    {
      name: 'null document',
      document: 'null',
      flags: { isExtension: true },
      browser: false,
      role: 'standalone',
    },
    {
      name: 'ordinary object',
      document: '{}',
      flags: { isExtension: true },
      browser: false,
      role: 'standalone',
    },
    {
      name: 'popup Document',
      document: '{nodeType:9}',
      flags: { isExtension: true },
      pathname: '/ui-popup.html',
      browser: true,
      role: 'main',
    },
    {
      name: 'offscreen Document',
      document: '{nodeType:9}',
      flags: { isExtension: true },
      pathname: '/offscreen.html',
      browser: true,
      role: 'main',
    },
    {
      name: 'content Document',
      document: '{nodeType:9}',
      flags: { isExtension: true },
      browser: true,
      role: 'standalone',
    },
    {
      name: 'MV2 background Document',
      document: '{nodeType:9}',
      flags: { isExtension: true },
      pathname: '/background.html',
      browser: true,
      role: 'background',
    },
    {
      name: 'MV3 worker with virtual window',
      document: 'undefined',
      flags: { isExtension: true },
      worker: true,
      browser: false,
      role: 'background',
    },
    {
      name: 'Web Document',
      document: '{nodeType:9}',
      flags: { isWeb: true },
      browser: true,
      role: 'standalone',
    },
    {
      name: 'Desktop Document',
      document: '{nodeType:9}',
      flags: { isDesktop: true },
      browser: true,
      role: 'standalone',
    },
    {
      name: 'WebEmbed Document',
      document: '{nodeType:9}',
      flags: { isWebEmbed: true },
      browser: true,
      role: 'main',
    },
    {
      name: 'CLI Node with virtual window',
      document: 'undefined',
      flags: {},
      browser: false,
      role: 'standalone',
    },
    ...['ios', 'android'].flatMap((nativeOS) =>
      ['main', 'background'].map((runtimeKind) => ({
        name: `${nativeOS} ${runtimeKind} heap`,
        document: '{nodeType:9}',
        flags: { isNative: true, nativeOS, enableNativeBackgroundThread: true },
        runtimeKind,
        browser: false,
        role: runtimeKind,
      })),
    ),
    {
      name: 'native single-runtime development',
      document: 'undefined',
      flags: { isNative: true, nativeOS: 'ios' },
      runtimeKind: 'main',
      browser: false,
      role: 'standalone',
    },
  ];
  for (const scenario of cases) {
    // Independent realms model native main/bg initialization without sharing
    // global markers. No host constructors, DOM objects or native resources
    // enter them; this does not substitute for the separate Hermes heap tests.
    const context = vm.createContext();
    const result = JSON.parse(
      vm.runInContext(
        `
      globalThis.window = globalThis;
      globalThis.document = ${scenario.document};
      globalThis.navigator = {userAgent:'Fixture',vendor:'',platform:'',maxTouchPoints:0};
      globalThis.location = {pathname:${javascriptLiteral(scenario.pathname || '/dapp')}};
      globalThis.chrome = {runtime:{getManifest:()=>({manifest_version:3,name:'Fixture'})}};
      globalThis.process = {env:{}};
      globalThis.__ONEKEY_RUNTIME_KIND__ = ${javascriptLiteral(scenario.runtimeKind)};
      ${scenario.worker ? 'globalThis.ServiceWorker=class ServiceWorker{};globalThis.serviceWorker=new ServiceWorker();' : ''}
      const module = {exports:{}};
      ${platformEnvFixtureSource(scenario.flags)}
      JSON.stringify(module.exports.environment);
    `,
        context,
      ),
    );
    assert.equal(result.isRuntimeBrowser, scenario.browser, scenario.name);
    assert.equal(result.runtimeRole, scenario.role, scenario.name);
    assert.equal(
      result.isExtensionBackgroundServiceWorker,
      Boolean(scenario.worker),
      scenario.name,
    );
    if (scenario.flags.isNative) {
      assert.equal(
        result.nativeRuntimeKind,
        scenario.runtimeKind,
        scenario.name,
      );
      assert.equal(
        result.isNativeMainThread,
        scenario.runtimeKind === 'main',
        scenario.name,
      );
      assert.equal(
        result.isNativeBackgroundThread,
        scenario.runtimeKind === 'background',
        scenario.name,
      );
    }
  }
});

test('shared SVG extraction removes real below-threshold copies across independent page entries', async () => {
  const HtmlWebpackPlugin = require('html-webpack-plugin');
  const TerserPlugin = require('terser-webpack-plugin');
  const {
    SubresourceIntegrityPlugin,
  } = require('webpack-subresource-integrity');
  const { svgRuntimeCacheGroup } = require('../webpack/webpack.ext.config');
  const {
    createLavaMoatWebpackPlugin,
    createLavaMoatWebpackValidationPlugin,
  } = require('../webpack/lavamoat');
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-svg-chunks-')),
  );
  const previous = process.env.ONEKEY_LAVAMOAT;
  process.env.ONEKEY_LAVAMOAT = '1';
  let browser;
  let server;
  let servedRoot;
  try {
    const packages = [
      'react-native-svg',
      'react-native-web',
      '@react-native/assets-registry',
      'unapproved-package',
    ];
    write(
      directory,
      'package.json',
      JSON.stringify({
        name: 'svg-chunks-fixture',
        dependencies: Object.fromEntries(
          packages.map((name) => [name, '1.0.0']),
        ),
      }),
    );
    for (const name of packages)
      write(
        directory,
        `node_modules/${name}/package.json`,
        JSON.stringify({ name, version: '1.0.0', main: 'index.js' }),
      );
    write(
      directory,
      'node_modules/unapproved-package/index.js',
      'module.exports="denied";',
    );
    write(
      directory,
      'node_modules/react-native-web/dist/vendor/react-native/PooledClass/index.js',
      'module.exports=()=>"pool";',
    );
    write(
      directory,
      'node_modules/react-native-web/dist/exports/Touchable/index.js',
      'module.exports=()=>require("../../vendor/react-native/PooledClass")();',
    );
    write(
      directory,
      'node_modules/@react-native/assets-registry/index.js',
      'module.exports=()=>"assets";',
    );
    write(
      directory,
      'node_modules/react-native-svg/index.js',
      `let calls=0; module.exports=()=>{let denied=false;try{require('unapproved-package')}catch(error){denied=/^Policy does not allow importing/.test(error.message)}return {calls:++calls,touch:require('react-native-web/dist/exports/Touchable')(),assets:require('@react-native/assets-registry')(),denied,fetchType:typeof fetch,secretType:typeof fixtureHostSecret,frozen:Object.isFrozen(Object.prototype)};};`,
    );
    write(
      directory,
      'policy.json',
      JSON.stringify({
        resources: {
          'react-native-svg': {
            packages: {
              'react-native-web': true,
              '@react-native/assets-registry': true,
            },
          },
          'react-native-web': {},
          '@react-native/assets-registry': {},
          'unapproved-package': {},
        },
      }),
    );
    const imports = [];
    for (let index = 0; index < 8; index += 1) {
      const name = `packages/components/src/primitives/Icon/react/fixture-${index}.js`;
      write(
        directory,
        name,
        'module.exports=()=>require("react-native-svg")();',
      );
      imports.push(`import('./${name}')`);
    }
    for (const entry of ['popup', 'passkey'])
      write(
        directory,
        `${entry}.js`,
        `require('unapproved-package');${entry === 'popup' ? "require('react-native-svg')();" : ''}document.addEventListener('fixture-load-icons',()=>Promise.all([${imports.join(',')}]).then(modules=>{document.documentElement.dataset.icons=JSON.stringify(modules.map(m=>m.default()));document.dispatchEvent(new Event('fixture-icons-ready'));}));`,
      );
    const compiled = [];
    for (const extract of [false, true]) {
      const plugin = createLavaMoatWebpackPlugin({
        basePath: directory,
        target: 'ext',
        readableResourceIds: false,
      });
      plugin.options.policyLocation = directory;
      const output = path.join(directory, String(extract));
      const stats = await compile({
        mode: 'production',
        context: directory,
        entry: { popup: './popup.js', passkey: './passkey.js' },
        output: {
          path: output,
          filename: '[name].[contenthash:10].bundle.js',
          chunkFilename: '[name].[contenthash:10].chunk.js',
          publicPath: '/',
          crossOriginLoading: 'anonymous',
        },
        optimization: {
          removeAvailableModules: true,
          runtimeChunk: { name: 'lavamoat-runtime' },
          minimizer: [
            new TerserPlugin({
              parallel: 1,
              terserOptions: { keep_classnames: true, keep_fnames: true },
            }),
          ],
          splitChunks: {
            chunks: 'all',
            minSize: 102_400,
            maxSize: 4_194_304,
            maxInitialRequests: 20,
            maxAsyncRequests: 40,
            cacheGroups: {
              icons: {
                test: /[\\/]packages[\\/]components[\\/]src[\\/]primitives[\\/]Icon[\\/]react[\\/]/,
                name: 'icons',
                chunks: 'async',
                enforce: true,
                priority: 30,
                reuseExistingChunk: true,
              },
              ...(extract ? { svgRuntime: svgRuntimeCacheGroup } : {}),
            },
          },
        },
        plugins: [
          ...['popup', 'passkey'].map(
            (entry) =>
              new HtmlWebpackPlugin({
                filename: `${entry}.html`,
                chunks: [entry],
                templateContent:
                  '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body></body></html>',
              }),
          ),
          new SubresourceIntegrityPlugin({ hashFuncNames: ['sha384'] }),
          plugin,
          createLavaMoatWebpackValidationPlugin(),
        ],
      });
      const runtimeModules = [...stats.compilation.modules].filter(
        (module) =>
          module.resource && svgRuntimeCacheGroup.test.test(module.resource),
      );
      assert.equal(runtimeModules.length, 4);
      for (const module of runtimeModules)
        assert.equal(
          stats.compilation.chunkGraph.getNumberOfModuleChunks(module),
          extract ? 1 : 9,
          module.resource,
        );
      const runtimeFiles = fs
        .readdirSync(output)
        .filter((file) =>
          /^lavamoat-runtime\.[a-f0-9]+\.bundle\.js$/.test(file),
        );
      assert.equal(runtimeFiles.length, 1);
      const ses = fs.readFileSync(
        createRequire(require.resolve('@lavamoat/webpack')).resolve('ses'),
        'utf8',
      );
      for (const file of fs
        .readdirSync(output)
        .filter((candidate) => candidate.endsWith('.js')))
        assert.equal(
          fs.readFileSync(path.join(output, file), 'utf8').split(ses).length -
            1,
          file === runtimeFiles[0] ? 1 : 0,
        );
      for (const entry of ['popup', 'passkey']) {
        const { parse } = createRequire(require.resolve('jsdom'))('parse5');
        const scripts = [];
        const visit = (node) => {
          if (node.tagName === 'script')
            scripts.push(
              Object.fromEntries(
                node.attrs.map(({ name, value }) => [name, value]),
              ),
            );
          node.childNodes?.forEach(visit);
        };
        visit(
          parse(fs.readFileSync(path.join(output, `${entry}.html`), 'utf8')),
        );
        assert.equal(scripts[0].src, `/${runtimeFiles[0]}`);
        for (const script of scripts) {
          assert.equal(script.crossorigin, 'anonymous');
          assert.equal(
            script.integrity,
            `sha384-${createHash('sha384')
              .update(fs.readFileSync(path.join(output, script.src.slice(1))))
              .digest('base64')}`,
          );
        }
      }
      compiled.push({ output, chunks: stats.compilation.chunks.size });
    }
    assert.equal(
      compiled[0].chunks - compiled[1].chunks,
      7,
      'Eight redundant dependency chunks must become one shared chunk without deleting an icon or package module',
    );
    server = http.createServer((request, response) => {
      const filename = path.join(
        servedRoot,
        new URL(request.url, 'http://localhost').pathname,
      );
      response.setHeader(
        'Content-Type',
        filename.endsWith('.html')
          ? 'text/html; charset=utf-8'
          : 'application/javascript; charset=utf-8',
      );
      response.setHeader(
        'Content-Security-Policy',
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
      );
      if (fs.existsSync(filename)) response.end(fs.readFileSync(filename));
      else response.writeHead(404).end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
      channel: 'chromium',
      headless: true,
      ...(process.env.ONEKEY_LAVAMOAT_TEST_CHROME
        ? { executablePath: process.env.ONEKEY_LAVAMOAT_TEST_CHROME }
        : {}),
    });
    for (const result of compiled)
      for (const entry of ['popup', 'passkey']) {
        servedRoot = result.output;
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          const errors = [];
          const lazyRequests = new Set();
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
          });
          page.on('request', (request) => {
            if (request.url().endsWith('.chunk.js'))
              lazyRequests.add(request.url());
          });
          await page.addInitScript(() => {
            globalThis.fixtureHostSecret = 'host-only';
          });
          const cdp = await context.newCDPSession(page);
          await cdp.send('Runtime.enable');
          await page.goto(
            `http://127.0.0.1:${server.address().port}/${entry}.html`,
          );
          assert.deepEqual(errors, []);
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const response = await cdp.send('Runtime.evaluate', {
              expression: `new Promise(resolve=>{document.addEventListener('fixture-icons-ready',()=>resolve(JSON.parse(document.documentElement.dataset.icons)),{once:true});document.dispatchEvent(new Event('fixture-load-icons'));})`,
              awaitPromise: true,
              returnByValue: true,
            });
            assert.equal(response.exceptionDetails, undefined);
            assert.deepEqual(
              response.result.value,
              Array.from({ length: 8 }, (_, index) => ({
                calls: attempt * 8 + index + (entry === 'popup' ? 2 : 1),
                touch: 'pool',
                assets: 'assets',
                denied: true,
                fetchType: 'undefined',
                secretType: 'undefined',
                frozen: true,
              })),
            );
          }
          assert.ok(
            lazyRequests.size > 0,
            'The browser must load real lazy scripts',
          );
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      }
  } finally {
    await browser?.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    if (previous === undefined) delete process.env.ONEKEY_LAVAMOAT;
    else process.env.ONEKEY_LAVAMOAT = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
