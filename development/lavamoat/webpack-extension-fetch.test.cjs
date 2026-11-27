// cspell:ignore LavaMoat lavamoat

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const LavaMoatPlugin = require('@lavamoat/webpack');
const { buildSync } = require('esbuild');
const webpack = require('webpack');

const {
  startBrowser,
  interceptTargets,
  installRejectionObserver,
} = require('../../apps/ext/scripts/smoke-lavamoat.cjs');
const { key } = require('../../apps/ext/src/manifest/shared');

const { LavaMoatError } = require('./error.cjs');

const repo = path.resolve(__dirname, '../..');
const shimPath = path.join(repo, 'development/webpack/lavamoat-shims.js');
const shimSource = fs.readFileSync(shimPath, 'utf8');
const lookup = `let holder = globalThis;
  let descriptor;
  while (holder !== null && holder !== Object.prototype) {
    descriptor = Reflect.getOwnPropertyDescriptor(holder, name);
    if (descriptor) break;
    holder = Reflect.getPrototypeOf(holder);
  }`;

const write = (file, source) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
};
const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
async function deadline(promise, label, milliseconds = 15_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new LavaMoatError(`${label} timed out`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('the named native binding shim preserves data flags and rejects accessors, nonwritable values and Object.prototype', () => {
  const marker = "for (const name of ['fetch', 'requestAnimationFrame'])";
  assert.ok(shimSource.includes(marker));
  // Execute the actual descriptor-binding loop in fresh realms. Browser
  // polyfills and Symbol metadata initialization have independent coverage.
  const loop = shimSource.slice(shimSource.indexOf(marker));
  const cases = [
    [
      'own data flags',
      `const target={};const fn=function(){return this===target;};Object.defineProperty(target,'fetch',{value:fn,writable:true,enumerable:false,configurable:false});apply(target);const d=Object.getOwnPropertyDescriptor(target,'fetch');return {bound:d.value.call({}),changed:d.value!==fn,writable:d.writable,enumerable:d.enumerable,configurable:d.configurable};`,
      {
        bound: true,
        changed: true,
        writable: true,
        enumerable: false,
        configurable: false,
      },
    ],
    [
      'inherited data shadows without prototype mutation',
      `const proto=Object.create(null);const target=Object.create(proto);const fn=function(){return this===target;};Object.defineProperty(proto,'fetch',{value:fn,writable:true,enumerable:false,configurable:true});apply(target);const d=Object.getOwnPropertyDescriptor(target,'fetch');return {bound:d.value.call({}),prototypeUnchanged:proto.fetch===fn,writable:d.writable,enumerable:d.enumerable,configurable:d.configurable};`,
      {
        bound: true,
        prototypeUnchanged: true,
        writable: true,
        enumerable: false,
        configurable: true,
      },
    ],
    [
      'own accessor stops prototype traversal',
      `let reads=0;const proto={fetch(){throw Error('Not reached');}};const target=Object.create(proto);const get=()=>{reads++;throw Error('Must not invoke getter');};Object.defineProperty(target,'fetch',{get,configurable:true});apply(target);const d=Object.getOwnPropertyDescriptor(target,'fetch');return {reads,sameGetter:d.get===get,data:'value' in d};`,
      { reads: 0, sameGetter: true, data: false },
    ],
    [
      'ancestor accessor remains untouched',
      `let reads=0;const proto={};const get=()=>{reads++;throw Error('Must not invoke getter');};Object.defineProperty(proto,'fetch',{get,configurable:true});const target=Object.create(proto);apply(target);return {reads,own:Object.hasOwn(target,'fetch'),sameGetter:Object.getOwnPropertyDescriptor(proto,'fetch').get===get};`,
      { reads: 0, own: false, sameGetter: true },
    ],
    [
      'own nonwritable value stops prototype traversal',
      `const fn=function(){};const target=Object.create({fetch(){}});Object.defineProperty(target,'fetch',{value:fn,writable:false});apply(target);return {same:target.fetch===fn,writable:Object.getOwnPropertyDescriptor(target,'fetch').writable};`,
      { same: true, writable: false },
    ],
    [
      'ancestor nonwritable value stays inherited',
      `const proto={};const fn=function(){};Object.defineProperty(proto,'fetch',{value:fn,writable:false});const target=Object.create(proto);apply(target);return {same:target.fetch===fn,own:Object.hasOwn(target,'fetch')};`,
      { same: true, own: false },
    ],
    [
      'Object.prototype excluded',
      `const fn=function(){};Object.defineProperty(Object.prototype,'fetch',{value:fn,writable:true,configurable:true});const target={};apply(target);return {own:Object.hasOwn(target,'fetch'),same:target.fetch===fn};`,
      { own: false, same: true },
    ],
    [
      'other names and nonfunctions untouched',
      `const fn=function(){};const target={fetch:42,otherHostApi:fn};apply(target);return {fetch:target.fetch,otherSame:target.otherHostApi===fn,rafCreated:Object.hasOwn(target,'requestAnimationFrame')};`,
      { fetch: 42, otherSame: true, rafCreated: false },
    ],
    [
      'only named RAF uses same descriptor rule',
      `const target={};const fn=function(){return this===target;};Object.defineProperty(target,'requestAnimationFrame',{value:fn,writable:true,enumerable:true,configurable:true});apply(target);const d=Object.getOwnPropertyDescriptor(target,'requestAnimationFrame');return {bound:d.value.call({}),changed:d.value!==fn,writable:d.writable,enumerable:d.enumerable,configurable:d.configurable};`,
      {
        bound: true,
        changed: true,
        writable: true,
        enumerable: true,
        configurable: true,
      },
    ],
  ];
  for (const [name, source, expected] of cases) {
    const actual = vm.runInNewContext(
      `function apply(globalThis) {${loop}};(()=>{${source}})()`,
    );
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, name);
  }
});

test('actual protected MV3 workers bind inherited native fetch while preserving write propagation and receiver confinement', async () => {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-worker-fetch-')),
  );
  const graph = path.join(directory, 'graph');
  try {
    assert.ok(shimSource.includes(lookup));
    const ownOnlySource = shimSource.replace(
      lookup,
      'const descriptor = Reflect.getOwnPropertyDescriptor(globalThis, name);',
    );
    for (const [label, contents] of [
      ['own-only', ownOnlySource],
      ['production', shimSource],
    ]) {
      const result = buildSync({
        stdin: { contents, resolveDir: path.dirname(shimPath) },
        bundle: true,
        platform: 'browser',
        format: 'iife',
        target: 'es2017',
        write: false,
        logLevel: 'silent',
      });
      write(
        path.join(directory, `${label}.shim.js`),
        result.outputFiles[0].contents,
      );
    }
    const dependencies = Object.fromEntries(
      ['host-writer', 'host-reader', 'host-denied'].map((name) => [
        name,
        '1.0.0',
      ]),
    );
    write(
      path.join(graph, 'package.json'),
      JSON.stringify({
        name: 'native-worker-fetch-fixture',
        private: true,
        dependencies,
      }),
    );
    for (const name of Object.keys(dependencies)) {
      write(
        path.join(graph, 'node_modules', name, 'package.json'),
        JSON.stringify({ name, version: '1.0.0', main: 'index.js' }),
      );
    }
    write(
      path.join(graph, 'node_modules/host-writer/index.js'),
      `
      const initial=fetch;let last,generation=0;
      module.exports={
        replace(){const n=++generation;globalThis.fetch=function(...args){last=this;return Reflect.apply(initial,this,args).then(async response=>({status:response.status,body:await response.json(),generation:n}));};},
        request(url,receiver=globalThis){return Reflect.apply(globalThis.fetch,receiver,[url]);},
        leak(){return{secret:typeof last?.fixtureHostSecret,chrome:typeof last?.chrome,XMLHttpRequest:typeof last?.XMLHttpRequest};},
        matches(value){return last===value;}
      };`,
    );
    write(
      path.join(graph, 'node_modules/host-reader/index.js'),
      `
      module.exports={request(url,receiver=globalThis){return Reflect.apply(fetch,receiver,[url]);},canWrite(){return Reflect.set(globalThis,'fetch',()=>42);}};`,
    );
    write(
      path.join(graph, 'node_modules/host-denied/index.js'),
      `
      module.exports=()=>({fetch:typeof fetch,chrome:typeof chrome,secret:typeof fixtureHostSecret});`,
    );
    // The test's trusted root exposes observations through its own Chrome API
    // object. No dependency receives Chrome, host markers, or a root receiver.
    write(
      path.join(graph, 'entry.js'),
      `
      const writer=require('host-writer'),reader=require('host-reader');
      chrome.runtime.__fetchFixture={writer,reader,denied:require('host-denied'),writerRoot:()=>writer.matches(globalThis),frozen:[Object.prototype,Function.prototype,Array.prototype].map(Object.isFrozen),harden:typeof harden};writer.replace();`,
    );
    write(
      path.join(graph, 'policy.json'),
      JSON.stringify({
        resources: {
          'host-writer': { globals: { fetch: 'write' } },
          'host-reader': { globals: { fetch: true } },
          'host-denied': {},
        },
      }),
    );
    const id = createHash('sha256')
      .update(Buffer.from(key, 'base64'))
      .digest('hex')
      .slice(0, 32)
      .replace(/[0-9a-f]/g, (digit) =>
        String.fromCharCode(97 + Number.parseInt(digit, 16)),
      );
    const origin = `chrome-extension://${id}`;
    const descriptorProbe = `(()=>{const result={own:Object.hasOwn(globalThis,'fetch'),chain:[]};let h=globalThis;for(let level=0;h&&level<8;level++,h=Reflect.getPrototypeOf(h)){const d=Reflect.getOwnPropertyDescriptor(h,'fetch');if(d){result.chain.push({level,value:typeof d.value,writable:d.writable,enumerable:d.enumerable,configurable:d.configurable,get:typeof d.get,set:typeof d.set});break;}}return result;})()`;
    for (const label of ['own-only', 'production']) {
      const output = path.join(directory, label);
      const compiler = webpack({
        mode: 'production',
        target: 'webworker',
        context: graph,
        entry: './entry.js',
        devtool: false,
        optimization: {
          minimize: false,
          splitChunks: false,
          runtimeChunk: false,
        },
        output: { path: output, filename: 'background.bundle.js' },
        plugins: [
          new LavaMoatPlugin({
            rootDir: graph,
            policyLocation: graph,
            readableResourceIds: true,
            inlineLockdown: /^background\.bundle\.js$/,
            lockdown: {
              evalTaming: 'no-eval',
              errorTrapping: 'none',
              errorTaming: 'unsafe',
            },
            staticShims_experimental: [
              path.join(directory, `${label}.shim.js`),
            ],
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
        const bytes = fs.readFileSync(
          path.join(output, 'background.bundle.js'),
          'utf8',
        );
        for (const owner of Object.keys(dependencies))
          assert.ok(bytes.includes(`._LM_(${JSON.stringify(owner)}`));
      } finally {
        await new Promise((resolve, reject) =>
          compiler.close((error) => (error ? reject(error) : resolve())),
        );
      }
      write(
        path.join(output, 'manifest.json'),
        JSON.stringify({
          manifest_version: 3,
          name: 'Native Worker Fetch Fixture',
          version: '1.0.0',
          key,
          background: { service_worker: 'background.bundle.js' },
          content_security_policy: {
            extension_pages:
              "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
          },
        }),
      );
      write(path.join(output, 'health.json'), JSON.stringify({ ok: true }));
      let browser;
      try {
        const errors = [];
        const network = [];
        const observers = [];
        let before;
        browser = await startBrowser(
          path.join(directory, `${label}-profile`),
          process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
        );
        const targets = await interceptTargets(
          browser,
          origin,
          async (session, targetLabel, beforeNavigation) => {
            session.on('Runtime.exceptionThrown', (event) =>
              errors.push(
                event.exceptionDetails.exception?.description ||
                  event.exceptionDetails.text,
              ),
            );
            session.on('Runtime.bindingCalled', (event) => {
              if (event.name === '__onekeySmokeRejection')
                observers.push(JSON.parse(event.payload));
            });
            await session.send('Runtime.enable');
            await installRejectionObserver(session, !beforeNavigation);
            if (!targetLabel.startsWith('service_worker:')) return;
            await session.send('Network.enable');
            session.on('Network.responseReceived', (event) => {
              if (event.response.url === `${origin}/health.json`)
                network.push(event.response.status);
            });
            const response = await session.send('Runtime.evaluate', {
              expression: descriptorProbe,
              returnByValue: true,
            });
            assert.equal(response.exceptionDetails, undefined);
            before = response.result.value;
            await session.send('Runtime.evaluate', {
              expression:
                "globalThis.fixtureHostSecret='fixed-host-only-marker'",
              returnByValue: true,
            });
          },
          (targetLabel, detail) => errors.push({ targetLabel, detail }),
        );
        await deadline(
          browser.cdp.send('Extensions.loadUnpacked', { path: output }),
          'Extension loading',
        );
        let session;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const { targetInfos } = await deadline(
            browser.cdp.send('Target.getTargets'),
            'Target discovery',
          );
          const target = targetInfos.find(
            (item) => item.url === `${origin}/background.bundle.js`,
          );
          if (target && targets.has(target.targetId)) {
            session = await deadline(
              targets.get(target.targetId),
              'Worker observation',
            );
            break;
          }
          await delay(50);
        }
        assert.ok(session);
        const read = async (expression) => {
          const response = await deadline(
            session.send('Runtime.evaluate', {
              expression,
              returnByValue: true,
              awaitPromise: true,
            }),
            'Native observation',
          );
          assert.equal(
            response.exceptionDetails,
            undefined,
            response.exceptionDetails?.exception?.description,
          );
          return response.result.value;
        };
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          ready = await read('Boolean(chrome.runtime?.__fetchFixture)');
          if (ready) break;
          await delay(50);
        }
        assert.equal(
          ready,
          true,
          'The real protected worker must finish its entry',
        );
        const after = await read(descriptorProbe);
        const calls = await read(`(async()=>{
          const f=chrome.runtime.__fetchFixture;const url=chrome.runtime.getURL('health.json');
          const outcomes={frozen:f.frozen,harden:f.harden,denied:f.denied(),readerCanWrite:f.reader.canWrite(),noEval:(()=>{try{Function('return globalThis')();return false}catch{return true}})()};
          for(const who of ['writer','reader']){try{outcomes[who]=await f[who].request(url);}catch(e){outcomes[who]={error:e.message};}}
          const explicit={fixed:'safe-reader'};try{outcomes.explicit=await f.reader.request(url,explicit);outcomes.explicitThis=f.writer.matches(explicit);}catch(e){outcomes.explicit={error:e.message};}
          outcomes.leak=f.writer.leak();outcomes.writerRoot=f.writerRoot();f.writer.replace();
          try{outcomes.replacement=await f.reader.request(url);}catch(e){outcomes.replacement={error:e.message};}return outcomes;
        })()`);
        assert.deepEqual(errors, []);
        assert.ok(observers.length > 0);
        assert.ok(
          observers.every(
            (item) => item.type === 'observer' && item.installedBeforeLockdown,
          ),
        );
        assert.equal(
          before.own,
          false,
          'Chromium WorkerGlobalScope supplies inherited fetch',
        );
        assert.deepEqual(before.chain, [
          {
            level: 2,
            value: 'function',
            writable: true,
            enumerable: true,
            configurable: true,
            get: 'undefined',
            set: 'undefined',
          },
        ]);
        assert.deepEqual(calls.frozen, [true, true, true]);
        assert.equal(calls.harden, 'function');
        assert.equal(calls.noEval, true);
        assert.deepEqual(calls.denied, {
          fetch: 'undefined',
          chrome: 'undefined',
          secret: 'undefined',
        });
        assert.equal(calls.readerCanWrite, false);
        assert.deepEqual(calls.leak, {
          secret: 'undefined',
          chrome: 'undefined',
          XMLHttpRequest: 'undefined',
        });
        assert.equal(calls.writerRoot, false);
        if (label === 'own-only') {
          assert.deepEqual(after, before);
          for (const kind of ['writer', 'reader', 'explicit', 'replacement'])
            assert.match(calls[kind].error, /Illegal invocation/);
          assert.deepEqual(
            network,
            [],
            'The original defect prevents native network delivery',
          );
        } else {
          assert.deepEqual(after, {
            own: true,
            chain: [{ ...before.chain[0], level: 0 }],
          });
          for (const kind of ['writer', 'reader', 'explicit', 'replacement']) {
            assert.equal(calls[kind].status, 200);
            assert.deepEqual(calls[kind].body, { ok: true });
          }
          assert.equal(calls.replacement.generation, 2);
          assert.equal(calls.explicitThis, true);
          assert.deepEqual(network, [200, 200, 200, 200]);
        }
      } finally {
        await browser?.close();
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    assert.equal(
      fs.readFileSync(shimPath, 'utf8'),
      shimSource,
      'Production shim source must not change during the fixture',
    );
  }
});
