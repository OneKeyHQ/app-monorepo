// cspell:ignore LavaMoat lavamoat kaspa sompi KRC kasplex getrandom wbindgen

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const LavaMoatPlugin = require('@lavamoat/webpack');
const { chromium } = require('playwright-core');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

const kaspaLoader = require('../webpack/lavamoat-ext-kaspa-loader.cjs');
const compatibility = require('../webpack/lavamoat-kaspa-compatibility.cjs');
const { getLavaMoatWasmPaths } = require('../webpack/lavamoat-wasm-loader.cjs');

const { LavaMoatError } = require('./error.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const esbuild = createRequire(path.join(repoRoot, 'apps/cli/package.json'))(
  'esbuild',
);
const { ASSET_PATH, WASM_SHA256, WASM_BYTE_LENGTH } = kaspaLoader;
const pinned = kaspaLoader.getPinnedPaths();
const address =
  'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9';

function write(directory, file, value) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function transform(overrides = {}, source = fs.readFileSync(pinned.source)) {
  return kaspaLoader.call(
    {
      resourcePath: pinned.source,
      resourceQuery: '',
      resourceFragment: '',
      _module: { rawRequest: pinned.source },
      addDependency() {},
      ...overrides,
    },
    source,
  );
}

test('extension Kaspa adapter pins physical source and byte-identical WASM without rewriting SDK initialization', () => {
  const original = compatibility.transformKaspaCompatibility(
    fs.readFileSync(pinned.source),
  );
  const adapted = transform();
  const bodyStart = original.indexOf(
    'async function __wbg_load(module, imports) {',
  );
  const comments = original.indexOf('  // if (typeof Response', bodyStart);
  assert.equal(adapted.slice(0, bodyStart), original.slice(0, bodyStart));
  assert.equal(
    adapted.slice(adapted.indexOf('  // if (typeof Response', bodyStart)),
    original.slice(comments),
  );
  assert.ok(!adapted.includes('require("./kaspa_bg.wasm.js")'));
  assert.ok(adapted.includes('new URL("kaspa_bg.wasm.bin", import.meta.url)'));
  const base64 = fs
    .readFileSync(pinned.base64, 'utf8')
    .match(/toUint8Array\('([A-Za-z0-9+/=]+)'\)/)[1];
  const binary = fs.readFileSync(pinned.binary);
  assert.deepEqual(Buffer.from(base64, 'base64'), binary);
  assert.equal(binary.length, WASM_BYTE_LENGTH);
  assert.equal(digest(binary), WASM_SHA256);
  const [sourceRule, binaryRule] = kaspaLoader.createExtensionKaspaRules();
  for (const rule of [sourceRule, binaryRule]) {
    assert.equal(rule.realResource(`${pinned.source}.forged.js`), false);
  }
  assert.equal(sourceRule.realResource(pinned.source), true);
  assert.equal(binaryRule.realResource(pinned.binary), true);
  assert.equal(binaryRule.generator.filename, ASSET_PATH);
  for (const overrides of [
    { resourcePath: `${pinned.source}.forged.js` },
    { resourceQuery: '?untrusted=1' },
    { resourceFragment: '#untrusted' },
    { _module: { rawRequest: `${pinned.source}!=!third-party.js` } },
    { _module: { rawRequest: `!!${__filename}!${pinned.source}` } },
    { _module: {} },
  ])
    assert.throws(() => transform(overrides), /unchanged physical resource/);
  assert.throws(
    () => transform({}, Buffer.from(`${original}\n`)),
    /modified source/,
  );
});

test('real webpack rules reject forged Kaspa requests and keep foreign physical modules outside the adapter', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-kaspa-scope-')),
  );
  try {
    write(
      directory,
      'node_modules/@onekeyfe/kaspa-wasm/package.json',
      JSON.stringify({
        name: '@onekeyfe/kaspa-wasm',
        version: '1.0.2',
        main: 'kaspa.js.untrusted.js',
      }),
    );
    const foreign = path.join(
      directory,
      'node_modules/@onekeyfe/kaspa-wasm/kaspa.js.untrusted.js',
    );
    write(
      directory,
      'node_modules/@onekeyfe/kaspa-wasm/kaspa.js.untrusted.js',
      `module.exports='physical-foreign-module';`,
    );
    const requests = [
      [`${pinned.source}?untrusted`, true],
      [`${pinned.source}#untrusted`, true],
      [`${pinned.binary}?untrusted`, true],
      [`${pinned.binary}#untrusted`, true],
      [
        `${require.resolve('../webpack/lavamoat-ext-kaspa-loader.cjs')}!${
          foreign
        }`,
        true,
      ],
      [
        `${
          pinned.source
        }!=!${require.resolve('../webpack/lavamoat-ext-kaspa-loader.cjs')}!${
          foreign
        }`,
        true,
      ],
      [
        `${require.resolve('../webpack/lavamoat-kaspa-compatibility.cjs')}!${foreign}`,
        true,
      ],
      [
        `${pinned.source}!=!${require.resolve('../webpack/lavamoat-kaspa-compatibility.cjs')}!${foreign}`,
        true,
      ],
      [`${pinned.source}!=!${foreign}`, false],
      [foreign, false],
    ];
    for (const common of [false, true]) {
      for (const [request, denied] of requests.filter(
        ([candidate]) => !common || !candidate.includes(pinned.binary),
      )) {
        write(
          directory,
          'index.js',
          `module.exports=require(${JSON.stringify(request)});`,
        );
        const compiler = webpack({
          mode: 'production',
          context: directory,
          entry: './index.js',
          output: {
            path: path.join(directory, 'out'),
            filename: 'main.js',
            library: { type: 'commonjs2' },
          },
          optimization: { minimize: false },
          module: {
            rules: common
              ? [compatibility.createKaspaCompatibilityRule()]
              : kaspaLoader.createExtensionKaspaRules(),
          },
        });
        let stats;
        try {
          stats = await new Promise((resolve, reject) =>
            compiler.run((error, result) =>
              error ? reject(error) : resolve(result),
            ),
          );
        } finally {
          await new Promise((resolve, reject) =>
            compiler.close((error) => (error ? reject(error) : resolve())),
          );
        }
        assert.equal(
          stats.hasErrors(),
          denied,
          stats.toString({ all: false, errors: true }),
        );
        if (denied)
          assert.match(
            stats.toString({ all: false, errors: true }),
            /unchanged physical resource/,
          );
        else {
          const context = vm.createContext({ module: { exports: {} } });
          vm.runInContext(
            fs.readFileSync(path.join(directory, 'out/main.js'), 'utf8'),
            context,
          );
          assert.equal(context.module.exports, 'physical-foreign-module');
        }
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('pinned non-crypto scheduling glue accepts only reviewed bodies and compartment receivers', async () => {
  const bodies = [
    '\n            if (!this.requestAnimationFrame){\n                if (this.setImmediate)\n                    this.requestAnimationFrame = (callback)=>setImmediate(callback)\n                else\n                    this.requestAnimationFrame = (callback)=>setTimeout(callback, 0)\n            }\n        ',
    '\n                let resolve, reject;\n                const p = new Promise((resolve_, reject_) => {\n                    resolve = resolve_;\n                    reject = reject_;\n                });\n                p.resolve = resolve;\n                p.reject = reject;\n                return p;\n            ',
    'return this',
  ].map((body) => body.replaceAll('\\n', '\n'));
  const binary = fs.readFileSync(pinned.binary);
  for (const body of bodies) assert.ok(binary.includes(Buffer.from(body)));
  assert.deepEqual(
    bodies.map((body) => body.length),
    [298, 309, 11],
  );
  const context = vm.createContext({});
  vm.runInContext(
    `'use strict'; globalThis.requestAnimationFrame=()=>1; globalThis.factory=(${compatibility.createKaspaStaticFunction.toString()});`,
    context,
  );
  const factory = vm.runInContext('factory', context);
  const global = vm.runInContext('globalThis', context);
  assert.equal(factory(bodies[0])(), undefined);
  assert.equal(factory(bodies[2])(), global);
  assert.equal(factory(bodies[2]).call(null), global);
  assert.equal(factory(bodies[2])().fixtureHostSecret, undefined);
  for (const body of bodies) {
    const callback = factory(body);
    assert.throws(
      () => callback.call({}),
      /Unsupported Kaspa generated function receiver/,
    );
    assert.throws(
      () => callback.call(1),
      /Unsupported Kaspa generated function receiver/,
    );
  }
  const pending = factory(bodies[1])();
  assert.equal(
    Object.getPrototypeOf(pending),
    vm.runInContext('Promise.prototype', context),
  );
  pending.resolve('public-result');
  assert.equal(await pending, 'public-result');
  const rejected = factory(bodies[1])();
  const expected = new Error('synthetic-rejection');
  const check = assert.rejects(rejected, (error) => error === expected);
  rejected.reject(expected);
  await check;
  for (const body of [
    '',
    'return globalThis',
    'fetch("https://example.invalid")',
    `${bodies[0]} `,
  ])
    assert.throws(
      () => factory(body),
      /Unsupported Kaspa generated function body/,
    );
  vm.runInContext(
    'delete globalThis.requestAnimationFrame; Object.freeze(globalThis.Object.prototype);',
    context,
  );
  assert.throws(
    () => factory(bodies[0]),
    /requires an existing requestAnimationFrame/,
  );
  assert.equal(
    vm.runInContext('typeof requestAnimationFrame', context),
    'undefined',
  );
});

function oneKeyWrapper() {
  const directory = path.join(
    repoRoot,
    'packages/core/src/chains/kaspa/sdkKaspa',
  );
  const transpile = (file) =>
    esbuild.transformSync(fs.readFileSync(file, 'utf8'), {
      loader: 'ts',
      format: 'cjs',
      target: 'es2022',
      supported: { 'dynamic-import': false },
    }).code;
  const constants = transpile(path.join(directory, 'constant.ts'));
  const opcodes = transpile(path.join(directory, 'types/sdk.ts'));
  const wrapper = transpile(path.join(directory, 'sdk/kaspaWebSdk.ts'));
  // The public commit/reveal methods execute the actual OneKey source. Signing,
  // hardware and unrelated script parsers are unavailable in this fixture.
  return `const constants = (() => { const module={exports:{}}; const exports=module.exports; ${constants}; return module.exports; })();
    const opcodes = (() => { const module={exports:{}}; const exports=module.exports; ${opcodes}; return module.exports; })();
    const wrapper = ((require) => { const module={exports:{}}; const exports=module.exports; ${wrapper}; return module.exports.default; })(request => {
      if(request==='@onekeyfe/kaspa-wasm') return sdk;
      if(request==='../constant') return constants;
      if(request==='../types') return opcodes;
      if(request==='@onekeyhq/shared/src/errors') return {OneKeyLocalError: class extends Error {}};
      if(request==='@onekeyfe/kaspa-core-lib') return {Script: undefined};
      if(request==='../publickey') return {EKaspaSignType: {}};
      if(request==='../transaction') return {SignatureType: {}};
      throw Error('Unknown fixture import: '+request);
    });`;
}

function entrySource() {
  return `import * as sdk from '@onekeyfe/kaspa-wasm';
    import { Buffer } from 'buffer';
    import denied from 'denied-kaspa-neighbor';
    ${oneKeyWrapper()}
    const fixture = { sdk, denied,
      async parity() {
        document.kaspaStage="initialize"; const initialized = await sdk.default(); document.kaspaStage="wrapper"; sdk.initConsolePanicHook();
        const api = await wrapper.getKaspaApi();
        document.kaspaStage="commit"; const commit = await api.buildCommitTxInfo({accountAddress:${JSON.stringify(address)}, transferDataString:'{"p":"krc-20","op":"transfer","tick":"FIXTURE","amt":"1","to":"public-fixture"}', isTestnet:false});
        document.kaspaStage="reveal"; const reveal = await api.createKRC20RevealTxJSON({accountAddress:${JSON.stringify(address)},isTestnet:false,encodedTx:{inputs:[{address:commit.commitAddress,txid:'ab'.repeat(32),scriptPubKey:commit.commitScriptPubKey,blockDaaScore:123456n}],changeAddress:${JSON.stringify(address)},feeInfo:{price:'1'}}});
        document.kaspaStage="result"; const script = new sdk.ScriptBuilder().addI64(7n).addData(new Uint8Array([1,2,3]));
        const result = { exports:Object.keys(sdk).sort(), version:sdk.version(), units:sdk.kaspaToSompi('1.25').toString(), formatted:sdk.sompiToKaspaString(125000000n), script:script.toString(), commit, reveal:JSON.parse(reveal), cached:initialized===await sdk.default() && initialized===sdk.initSync({get module(){throw Error('Cached input touched')}}), module:sdk.default.__wbindgen_wasm_module instanceof WebAssembly.Module, denied:denied() };
        script.free(); return result;
      }
    };
    if(typeof document!=='undefined'){document.defaultView.fixtureHostSecret='synthetic-host-only';document.kaspaErrors=[];addEventListener('error',event=>document.kaspaErrors.push(event.message));document.kaspaFixture=fixture;
    chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
      if(message.fixtureKaspa==='parity'){document.kaspaFixture.parity().then(result=>sendResponse({result}),error=>sendResponse({error:String(error)}));return true;}
      if(message.fixtureKaspa==='security'){sendResponse({raf:typeof requestAnimationFrame,frozen:Object.isFrozen(Object.prototype),url:location.href,stage:document.kaspaStage,visibility:document.visibilityState,errors:document.kaspaErrors});}
    });
    }else{
      addEventListener('message',async({data})=>{
        try{const bytes=await fetch(${JSON.stringify(ASSET_PATH)}).then(response=>response.arrayBuffer());
          const initialized=sdk.initSync({module:data.compiled?new WebAssembly.Module(bytes):bytes});
          const cached=await sdk.default({get module_or_path(){throw Error('Cached input touched')}});
          postMessage({version:sdk.version(),cached:initialized===cached&&initialized===sdk.initSync(null),module:sdk.default.__wbindgen_wasm_module instanceof WebAssembly.Module,frozen:Object.isFrozen(Object.prototype)});
        }catch(error){postMessage({error:String(error)});}
      });
    }`;
}

async function compile(
  directory,
  adapted,
  generatePolicyOnly,
  entry = './index.js',
  { worker = false, outputName } = {},
) {
  const output = path.join(
    directory,
    outputName ?? (adapted ? 'adapted' : 'original'),
  );
  const compiler = webpack({
    mode: 'production',
    context: directory,
    entry,
    target: worker ? 'webworker' : 'web',
    devtool: false,
    output: {
      path: output,
      filename: 'main.js',
      publicPath: '',
      assetModuleFilename: ASSET_PATH,
    },
    resolve: {
      modules: [
        path.join(directory, 'node_modules'),
        path.join(repoRoot, 'node_modules'),
      ],
      fallback: { fs: false, path: false },
    },
    module: {
      rules: [
        {
          realResource: (resource) => getLavaMoatWasmPaths().includes(resource),
          type: 'asset/resource',
          use: [require.resolve('../webpack/lavamoat-wasm-loader.cjs')],
        },
        ...(adapted
          ? kaspaLoader.createExtensionKaspaRules()
          : [compatibility.createKaspaCompatibilityRule()]),
      ],
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: false,
          extractComments: false,
          terserOptions: {
            compress: false,
            mangle: false,
            format: { ascii_only: true },
          },
        }),
      ],
    },
    plugins: [
      new LavaMoatPlugin({
        rootDir: directory,
        policyLocation: path.join(
          directory,
          adapted ? 'policy-adapted' : 'policy-original',
        ),
        generatePolicyOnly,
        readableResourceIds: true,
        inlineLockdown: /^main\.js$/,
        lockdown: {
          evalTaming: 'no-eval',
          errorTrapping: 'none',
          errorTaming: 'unsafe',
        },
      }),
    ],
  });
  try {
    const stats = await new Promise((resolve, reject) =>
      compiler.run((error, result) =>
        error ? reject(error) : resolve(result),
      ),
    );
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

function finalizeFixture(output, name) {
  write(
    output,
    'manifest.json',
    JSON.stringify({
      manifest_version: 3,
      name: name,
      version: '1.0.0',
      permissions: ['offscreen'],
      host_permissions: [],
      content_security_policy: {
        extension_pages:
          "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
      },
      background: { service_worker: 'background.js' },
    }),
  );
  write(
    output,
    'background.js',
    'chrome.runtime.onMessage.addListener(()=>{});',
  );
  write(
    output,
    'index.html',
    `<!doctype html><html><head><meta charset="utf-8"><script src="main.js" integrity="sha384-${createHash(
      'sha384',
    )
      .update(fs.readFileSync(path.join(output, 'main.js')))
      .digest(
        'base64',
      )}" crossorigin="anonymous"></script></head><body>Kaspa public API fixture</body></html>`,
  );
}

async function prepare(directory) {
  write(
    directory,
    'package.json',
    JSON.stringify({
      name: 'extension-kaspa-fixture',
      private: true,
      dependencies: {
        '@onekeyfe/kaspa-wasm': '1.0.2',
        buffer: '6.0.3',
        'denied-kaspa-neighbor': '1.0.0',
      },
    }),
  );
  write(
    directory,
    'node_modules/denied-kaspa-neighbor/package.json',
    JSON.stringify({
      name: 'denied-kaspa-neighbor',
      version: '1.0.0',
      main: 'index.js',
    }),
  );
  write(
    directory,
    'node_modules/denied-kaspa-neighbor/index.js',
    `const factory=(${compatibility.createKaspaStaticFunction.toString()});module.exports=()=>{const virtualGlobal=factory('return this')();return {fetch:typeof fetch,chrome:typeof chrome,crypto:typeof crypto,WebAssembly:typeof WebAssembly,secret:typeof fixtureHostSecret,getterSecret:typeof virtualGlobal.fixtureHostSecret,getterDocument:typeof virtualGlobal.document};};`,
  );
  for (const name of ['@onekeyfe/kaspa-wasm', 'buffer']) {
    const destination = path.join(directory, 'node_modules', name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.symlinkSync(
      path.dirname(require.resolve(`${name}/package.json`)),
      destination,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }
  write(directory, 'index.js', entrySource());
  let originalGlobals;
  for (const adapted of [false, true]) {
    const stats = await compile(directory, adapted, true);
    const modules = new Set(
      [...stats.compilation.modules]
        .map((module) => module.resource)
        .filter(Boolean),
    );
    assert.equal(modules.has(pinned.base64), !adapted);
    assert.ok(modules.has(pinned.binary));
    const policyPath = path.join(
      directory,
      adapted ? 'policy-adapted' : 'policy-original',
      'policy.json',
    );
    const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    const keys = Object.keys(policy.resources);
    const sdkKey = keys.find(
      (key) =>
        key === '@onekeyfe/kaspa-wasm' || key.endsWith('>@onekeyfe/kaspa-wasm'),
    );
    assert.ok(sdkKey, JSON.stringify(keys));
    const globals = policy.resources[sdkKey].globals;
    if (!adapted) originalGlobals = new Set(Object.keys(globals));
    else {
      const baselineGlobals = originalGlobals;
      assert.deepEqual(
        Object.keys(globals)
          .filter((key) => {
            const segments = key.split('.');
            return !segments.some((_, index) =>
              baselineGlobals.has(segments.slice(0, index + 1).join('.')),
            );
          })
          .toSorted(),
        [
          'chrome.runtime.getURL',
          'chrome.runtime.id',
          'crypto.subtle.digest',
        ].toSorted(),
      );
    }
    // The existing Rust getrandom import reads crypto through a dynamic host
    // object. Use the real browser RNG in both versions; never stub entropy.
    globals['crypto.getRandomValues'] = true;
    globals['location.protocol'] = true;
    if (adapted)
      for (const permission of [
        'chrome.runtime.id',
        'chrome.runtime.getURL',
        'crypto.subtle.digest',
      ])
        assert.equal(globals[permission], true);
    // The generated neighboring package requests these globals; enforcement
    // intentionally omits them to prove it cannot borrow the SDK's authority.
    policy.resources['denied-kaspa-neighbor'] = {};
    fs.writeFileSync(policyPath, JSON.stringify(policy));
    await compile(directory, adapted, false);
    const output = path.join(directory, adapted ? 'adapted' : 'original');
    assert.equal(
      digest(fs.readFileSync(path.join(output, ASSET_PATH))),
      WASM_SHA256,
    );
    assert.deepEqual(fs.readdirSync(path.join(output, 'static/wasm')), [
      path.basename(ASSET_PATH),
    ]);
    if (adapted) {
      await compile(directory, true, false, './index.js', {
        worker: true,
        outputName: 'sync-worker',
      });
      fs.copyFileSync(
        path.join(directory, 'sync-worker/main.js'),
        path.join(output, 'sync-worker.js'),
      );
    }
    finalizeFixture(
      output,
      adapted ? 'Adapted Kaspa fixture' : 'Original Kaspa fixture',
    );
  }
  const policyPath = path.join(directory, 'policy-adapted/policy.json');
  const approved = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  for (const name of ['without-rng', 'without-location', 'without-raf']) {
    const negative = structuredClone(approved);
    const resource = negative.resources['@onekeyfe/kaspa-wasm'];
    if (name === 'without-rng')
      delete resource.globals['crypto.getRandomValues'];
    else delete resource.globals['location.protocol'];
    if (name === 'without-raf') delete resource.globals.requestAnimationFrame;
    fs.writeFileSync(policyPath, JSON.stringify(negative));
    await compile(directory, true, false, './index.js', { outputName: name });
    finalizeFixture(path.join(directory, name), `Negative Kaspa:${name}`);
  }
  fs.writeFileSync(policyPath, JSON.stringify(approved));
}

async function read(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  assert.ok(
    !response.exceptionDetails,
    JSON.stringify(response.exceptionDetails),
  );
  return response.result.value;
}

async function verifyInitialization(browser, baseUrl, outputDirectory) {
  const binPath = path.join(outputDirectory, ASSET_PATH);
  const original = fs.readFileSync(binPath);
  const open = async (responseMode) => {
    const page = await browser.newPage();
    await page.addInitScript(
      ({ mode }) => {
        const probe = { calls: [], instantiations: 0 };
        Object.defineProperty(document, 'kaspaIO', { value: probe });
        const nativeFetch = globalThis.fetch;
        globalThis.fetch = async function (...args) {
          probe.calls.push({ url: String(args[0]), options: args[1] });
          const response = await Reflect.apply(nativeFetch, globalThis, args);
          if (!mode) return response;
          return {
            status: mode === 'status' ? 201 : response.status,
            redirected: mode === 'redirect',
            url: mode === 'url' ? 'https://other.invalid/file' : response.url,
            arrayBuffer: () => response.arrayBuffer(),
          };
        };
        const instantiate = WebAssembly.instantiate;
        WebAssembly.instantiate = function (...args) {
          probe.instantiations += 1;
          return Reflect.apply(instantiate, WebAssembly, args);
        };
      },
      { mode: responseMode },
    );
    const cdp = await browser.newCDPSession(page);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl);
    assert.equal(await read(cdp, 'typeof document.kaspaFixture'), 'object');
    return { page, cdp, errors };
  };
  for (const mode of [
    'missing',
    'short',
    'tamper',
    'status',
    'redirect',
    'url',
  ]) {
    const { page, cdp, errors } = await open(
      ['status', 'redirect', 'url'].includes(mode) ? mode : undefined,
    );
    try {
      if (mode === 'missing') fs.unlinkSync(binPath);
      if (mode === 'short') fs.writeFileSync(binPath, original.subarray(0, -1));
      if (mode === 'tamper') {
        const corrupt = Buffer.from(original);
        corrupt[corrupt.length - 1] ^= 1;
        fs.writeFileSync(binPath, corrupt);
      }
      const failure = await read(
        cdp,
        'document.kaspaFixture.sdk.default({}).then(()=>({ok:true}),error=>({error:error.message,initialized:document.kaspaFixture.sdk.default.__wbindgen_wasm_module!==undefined}))',
      );
      assert.equal(failure.initialized, false);
      const expectedFailures = {
        short: /size mismatch/,
        tamper: /integrity mismatch/,
        missing: /Failed to fetch|NetworkError/,
      };
      assert.match(failure.error, expectedFailures[mode] ?? /Failed to read/);
      assert.equal(
        await read(cdp, 'document.kaspaIO.instantiations'),
        0,
        'Rejected data must never reach WASM instantiation',
      );
      fs.writeFileSync(binPath, original);
      if (['missing', 'short', 'tamper'].includes(mode)) {
        assert.equal(
          await read(
            cdp,
            'document.kaspaFixture.sdk.default({}).then(()=>document.kaspaFixture.sdk.version())',
          ),
          '0.15.2',
        );
        assert.equal(await read(cdp, 'document.kaspaIO.instantiations'), 1);
      }
      assert.deepEqual(errors, []);
    } finally {
      fs.writeFileSync(binPath, original);
      await page.close();
    }
  }
  const inputs = [
    ['undefined', 1],
    ['{}', 0],
    ['new URL("https://ignored.invalid/bin")', 1],
    ['new Request("https://ignored.invalid/bin")', 1],
    ['new Response("ignored")', 1],
    ['new Uint8Array([0])', 1],
    ['Promise.resolve("ignored")', 1],
    ['{module_or_path:"https://ignored.invalid/bin"}', 0],
  ];
  for (const [expression, warnings] of inputs) {
    const { page, cdp, errors } = await open();
    const received = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') received.push(message.text());
    });
    try {
      assert.equal(
        await read(
          cdp,
          `document.kaspaFixture.sdk.default(${expression}).then(()=>document.kaspaFixture.sdk.version())`,
        ),
        '0.15.2',
      );
      const calls = await read(cdp, 'document.kaspaIO.calls');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, new URL(ASSET_PATH, baseUrl).href);
      assert.deepEqual(calls[0].options, {
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
      });
      assert.equal(received.length, warnings);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  for (const compiled of [false, true]) {
    const { page, cdp, errors } = await open();
    try {
      const response = await read(
        cdp,
        `new Promise((resolve,reject)=>{const worker=new Worker('sync-worker.js');worker.onmessage=event=>{worker.terminate();resolve(event.data);};worker.onerror=error=>{worker.terminate();reject(error.message);};worker.postMessage({compiled:${compiled}});})`,
      );
      assert.deepEqual(response, {
        version: '0.15.2',
        cached: true,
        module: true,
        frozen: true,
      });
      assert.equal((await read(cdp, 'document.kaspaIO.calls')).length, 0);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }

  {
    const { page, cdp, errors } = await open();
    try {
      for (const expression of [
        'null',
        '{get module_or_path(){throw Error("synthetic getter")}}',
      ]) {
        const failed = await read(
          cdp,
          `document.kaspaFixture.sdk.default(${expression}).then(()=>false,()=>true)`,
        );
        assert.equal(failed, true);
      }
      assert.equal((await read(cdp, 'document.kaspaIO.calls')).length, 0);
      assert.equal(
        await read(
          cdp,
          'Promise.all([document.kaspaFixture.sdk.default({}),document.kaspaFixture.sdk.default({})]).then(async ([first,second])=>first!==second&&[first,second].includes(await document.kaspaFixture.sdk.default(null)))',
        ),
        true,
      );
      assert.equal(
        (await read(cdp, 'document.kaspaIO.calls')).length,
        2,
        'Concurrent initialization is deliberately not coalesced',
      );
      assert.equal(await read(cdp, 'document.kaspaIO.instantiations'), 2);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
}

test(
  'real MV3 Kaspa initialization preserves public SDK and OneKey commit/reveal behavior using verified packaged WASM',
  { timeout: 180_000 },
  async (t) => {
    const directory = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-kaspa-')),
    );
    let browser;
    try {
      await prepare(directory);
      const executablePath = [
        process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
        chromium.executablePath(),
      ]
        .filter(Boolean)
        .find((file) => fs.existsSync(file));
      assert.ok(
        executablePath,
        'Install Chromium for the extension Kaspa fixture',
      );
      const paths = [
        'original',
        'adapted',
        'without-rng',
        'without-location',
        'without-raf',
      ].map((name) => path.join(directory, name));
      browser = await chromium.launchPersistentContext(
        path.join(directory, 'profile'),
        {
          executablePath,
          channel: 'chromium',
          headless: true,
          args: [
            `--disable-extensions-except=${paths.join(',')}`,
            `--load-extension=${paths.join(',')}`,
          ],
        },
      );
      const workers = [];
      for (let attempt = 0; attempt < 100; attempt += 1) {
        workers.splice(0, workers.length, ...browser.serviceWorkers());
        if (workers.length === 5) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(workers.length, 5);
      const outputs = {};
      const workerNames = new Map(
        await Promise.all(
          workers.map(async (worker) => [
            worker,
            await worker.evaluate(() => chrome.runtime.getManifest().name),
          ]),
        ),
      );
      workers.sort((left, right) =>
        workerNames.get(left).localeCompare(workerNames.get(right)),
      );
      for (const worker of workers.filter(
        (item) => !workerNames.get(item).startsWith('Negative'),
      )) {
        const name = await worker.evaluate(() =>
          chrome.runtime.getManifest().name.startsWith('Adapted')
            ? 'adapted'
            : 'original',
        );
        if (name === 'adapted')
          await verifyInitialization(
            browser,
            new URL('index.html', worker.url()).href,
            path.join(directory, 'adapted'),
          );
        if (name === 'adapted') {
          const external = await browser.newPage();
          try {
            await external.goto('about:blank');
            assert.equal(
              await external.evaluate(
                (url) =>
                  fetch(url).then(
                    () => true,
                    () => false,
                  ),
                new URL(ASSET_PATH, worker.url()).href,
              ),
              false,
            );
          } finally {
            await external.close();
          }
        }
        const page = await browser.newPage();
        const errors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(error.stack));
        const cdp = await browser.newCDPSession(page);
        await cdp.send('Runtime.enable');
        cdp.on('Runtime.exceptionThrown', (event) =>
          errors.push(JSON.stringify(event.exceptionDetails)),
        );
        await page.goto(new URL('index.html', worker.url()).href);
        assert.equal(
          await read(cdp, 'typeof document.kaspaFixture'),
          'object',
          `${name}: ${JSON.stringify(errors)}`,
        );
        const pending = read(cdp, 'document.kaspaFixture.parity()');
        let deadline;
        try {
          outputs[name] = await Promise.race([
            pending,
            new Promise((resolve, reject) => {
              deadline = setTimeout(
                () => reject(new Error('Kaspa parity timed out')),
                15_000,
              );
            }),
          ]);
        } catch (error) {
          throw new LavaMoatError(
            `${name}: ${await read(cdp, 'document.kaspaStage')} ${JSON.stringify(errors)} ${error.message}`,
            { cause: error },
          );
        } finally {
          clearTimeout(deadline);
        }
        assert.deepEqual(errors, []);
        await page.close();
        await worker.evaluate(() =>
          chrome.offscreen.createDocument({
            url: 'index.html',
            reasons: ['WORKERS'],
            justification:
              'Verify the public Kaspa WASM API in its actual offscreen runtime',
          }),
        );
        try {
          const contexts = await worker.evaluate(() =>
            chrome.runtime.getContexts({
              contextTypes: ['OFFSCREEN_DOCUMENT'],
            }),
          );
          assert.equal(contexts.length, 1);
          assert.equal(
            contexts[0].documentUrl,
            new URL('index.html', worker.url()).href,
          );
          const security = await worker.evaluate(() =>
            chrome.runtime.sendMessage({ fixtureKaspa: 'security' }),
          );
          assert.equal(security.raf, 'function');
          assert.equal(security.frozen, true);
          for (let attempt = 0; attempt < 2; attempt += 1) {
            let offscreenDeadline;
            try {
              const response = await Promise.race([
                worker.evaluate(() =>
                  chrome.runtime.sendMessage({ fixtureKaspa: 'parity' }),
                ),
                new Promise((resolve, reject) => {
                  offscreenDeadline = setTimeout(
                    () =>
                      reject(
                        new Error(
                          `${name} actual offscreen Kaspa reveal ${
                            attempt
                          } timed out`,
                        ),
                      ),
                    15_000,
                  );
                }),
              ]);
              assert.deepEqual(response, { result: outputs[name] });
            } catch (error) {
              const securityState = await worker.evaluate(() =>
                chrome.runtime.sendMessage({ fixtureKaspa: 'security' }),
              );
              throw new LavaMoatError(
                `${error.message} ${JSON.stringify(securityState)}`,
                { cause: error },
              );
            } finally {
              clearTimeout(offscreenDeadline);
            }
          }
        } finally {
          await worker.evaluate(() => chrome.offscreen.closeDocument());
        }
      }
      for (const worker of workers.filter((item) =>
        workerNames.get(item).startsWith('Negative'),
      )) {
        const name = workerNames.get(worker).split(':')[1];
        await worker.evaluate(() =>
          chrome.offscreen.createDocument({
            url: 'index.html',
            reasons: ['WORKERS'],
            justification:
              'Verify that missing SDK capabilities cannot silently pass the public API',
          }),
        );
        try {
          if (name === 'without-location') {
            const first = await worker.evaluate(() =>
              chrome.runtime.sendMessage({ fixtureKaspa: 'parity' }),
            );
            assert.deepEqual(first, { result: outputs.adapted });
          }
          let outcome;
          void worker
            .evaluate(() =>
              chrome.runtime.sendMessage({ fixtureKaspa: 'parity' }),
            )
            .then(
              (result) => {
                outcome = result;
              },
              (error) => {
                outcome = { closed: error.message };
              },
            );
          let security;
          for (let attempt = 0; attempt < 100; attempt += 1) {
            security = await worker.evaluate(() =>
              chrome.runtime.sendMessage({ fixtureKaspa: 'security' }),
            );
            if (
              name === 'without-location'
                ? security.stage === 'reveal'
                : security.errors.length > 0
            )
              break;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          assert.equal(security.stage, 'reveal');
          if (name === 'without-location') {
            await new Promise((resolve) => setTimeout(resolve, 500));
            assert.deepEqual(security.errors, []);
          } else
            assert.ok(
              security.errors.some((error) =>
                name === 'without-rng'
                  ? error.includes('unreachable')
                  : error.includes(
                      'requires an existing requestAnimationFrame',
                    ),
              ),
              JSON.stringify(security),
            );
          assert.equal(
            outcome,
            undefined,
            'The real WASM API must not report success without required capabilities',
          );
          t.diagnostic(
            JSON.stringify({
              negative: name,
              stage: security.stage,
              errors: security.errors,
              completed: false,
            }),
          );
        } finally {
          await worker.evaluate(() => chrome.offscreen.closeDocument());
        }
      }
      t.diagnostic(
        JSON.stringify({
          commit: outputs.adapted.commit,
          reveal: outputs.adapted.reveal,
          offscreenReveals: 4,
        }),
      );
      assert.deepEqual(outputs.adapted, outputs.original);
      assert.equal(outputs.adapted.units, '125000000');
      assert.equal(outputs.adapted.cached, true);
      assert.equal(outputs.adapted.module, true);
      assert.deepEqual(outputs.adapted.denied, {
        fetch: 'undefined',
        chrome: 'undefined',
        crypto: 'undefined',
        WebAssembly: 'undefined',
        secret: 'undefined',
        getterSecret: 'undefined',
        getterDocument: 'undefined',
      });
      assert.ok(outputs.adapted.commit.commitAddress.startsWith('kaspa:'));
      assert.ok(outputs.adapted.reveal);
    } finally {
      await browser?.close();
      if (process.env.ONEKEY_KASPA_KEEP_FIXTURE !== '1')
        fs.rmSync(directory, { recursive: true, force: true });
      else process.stderr.write(`Kaspa fixture: ${directory}\n`);
    }
  },
);
