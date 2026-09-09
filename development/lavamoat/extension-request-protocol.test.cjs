// cspell:ignore LavaMoat lavamoat onekeyhq onekey ONEKEY memoizee
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const { build, transformSync } = require('esbuild');

const {
  startBrowser,
  interceptTargets,
  installRejectionObserver,
} = require('../../apps/ext/scripts/smoke-lavamoat.cjs');
const { key } = require('../../apps/ext/src/manifest/shared');

const { LavaMoatError } = require('./error.cjs');
const { javascriptLiteral } = require('./javascript-literal.cjs');
const repo = path.resolve(__dirname, '../..');
const req = createRequire(path.join(repo, 'package.json'));
const endpointFile = fs.realpathSync(
  path.join(repo, 'packages/kit-bg/src/endpoints/index.ts'),
);
const source = fs.readFileSync(endpointFile, 'utf8');
const protocolGuard = `    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }
    const whitelist = await getEndpointDomainWhitelist();
    return whitelist.includes(parsedUrl.host);`;
assert.equal(
  source.split(protocolGuard).length,
  2,
  'The production endpoint check must reject non-HTTP destinations before reading settings',
);
const originalSource = source.replace(
  protocolGuard,
  `    const whitelist = await getEndpointDomainWhitelist();
    return whitelist.includes(new URL(url).host);`,
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function setup(dev = false) {
  let resolve, reject;
  let reads = 0;
  const ready = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  const settings = {
    enabled: true,
    settings: {
      customApiEndpoints: [
        {
          enabled: true,
          serviceModule: 'wallet',
          api: 'https://custom.example:9443',
        },
      ],
    },
  };
  const endpoints = {
    wallet: 'https://wallet.onekeycn.com',
    custom: 'https://allow.example:9443',
    notifications: 'wss://socket.onekeycn.com',
  };
  const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
  const module = { exports: {} };
  const modules = {
    'lodash': req('lodash'),
    '@onekeyhq/shared/src/config/endpointsMap': {
      getEndpointsMap: async () => {
        reads += 1;
        await ready;
        return endpoints;
      },
    },
    '@onekeyhq/shared/src/platformEnv': {
      __esModule: true,
      default: { isDev: dev, isWebEmbed: false },
    },
    '@onekeyhq/shared/src/errors': { OneKeyError: Error },
    '@onekeyhq/shared/src/errors/utils/errorUtils': {
      __esModule: true,
      default: { autoPrintErrorIgnore() {} },
    },
    '../states/jotai/atoms/devSettings': {
      devSettingsPersistAtom: {
        get: async () => {
          await ready;
          return settings;
        },
      },
    },
  };
  const context = vm.createContext({
    module,
    exports: module.exports,
    URL,
    require: (p) => {
      assert.ok(Object.hasOwn(modules, p), p);
      return modules[p];
    },
  });
  vm.runInContext(code, context);
  return {
    check: module.exports.checkIsOneKeyDomain,
    resolve: () => resolve(true),
    reject: () => reject(new LavaMoatError('Expected configuration failure')),
    reads: () => reads,
  };
}
const nonHttp = [
  'chrome-extension://wallet.onekeycn.com/asset.bin',
  'file://wallet.onekeycn.com/asset.bin',
  'blob:https://wallet.onekeycn.com/1',
  'data:text/plain,public',
  'ftp://wallet.onekeycn.com/file',
  'ws://wallet.onekeycn.com/socket',
  'wss://wallet.onekeycn.com/socket',
  'about:blank',
  'not a URL',
];
for (const url of nonHttp)
  test(`non-HTTP or invalid URL is false without configuration: ${url.split(':')[0]}`, async () => {
    const p = setup();
    const result = await Promise.race([
      p.check(url),
      new Promise((r) => setTimeout(() => r('blocked'), 30)),
    ]);
    assert.equal(result, false);
    assert.equal(p.reads(), 0);
  });
for (const [url, expected] of [
  ['https://wallet.onekeycn.com/path', true],
  ['http://wallet.onekeycn.com/path', true],
  ['HTTPS://WALLET.ONEKEYCN.COM/path', true],
  ['https://wallet.onekeycn.com:443/path', true],
  ['https://wallet.onekeycn.com.evil.invalid/path', false],
  ['https://other.invalid/path', false],
  ['https://wallet.onekeycn.com:8443/path', false],
  ['https://allow.example:9443/path', true],
  ['https://allow.example/path', false],
  ['https://socket.onekeycn.com/path', true],
])
  test(`HTTP preserves deferred exact-host rules: ${url}`, async () => {
    const p = setup();
    let settled = false;
    const pending = p.check(url).then((v) => {
      settled = true;
      return v;
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(settled, false);
    assert.equal(p.reads(), 1);
    p.resolve();
    assert.equal(await pending, expected);
  });
test('HTTP configuration rejection keeps the original false/error catch', async () => {
  const p = setup();
  const pending = p.check('https://wallet.onekeycn.com');
  p.reject();
  assert.equal(await pending, false);
});
test('development custom endpoints retain their actual host and port', async () => {
  const p = setup(true);
  p.resolve();
  assert.equal(await p.check('https://custom.example:9443/path'), true);
  assert.equal(await p.check('https://wallet.onekeycn.com/path'), false);
  assert.equal(await p.check('https://custom.example/path'), false);
  assert.equal(await p.check('ftp://custom.example:9443/path'), false);
});

// Preserve the real atom, storage and request modules. Ancillary platform/logging
// modules are explicit fixtures; native/secure branches throw if reached. No
// atom values, IndexedDB methods or ready promises are supplied or resolved.
async function compile(directory, mode) {
  const runtimeSource = mode === 'original' ? originalSource : source;
  const stubs = new Map();
  const add = (p, s) => stubs.set(fs.realpathSync(path.join(repo, p)), s);
  add(
    'packages/shared/src/platformEnv.ts',
    `export default {isExtension:true,isExtensionOffscreen:true,isExtensionUi:false,isExtensionBackground:false,isDev:false,isJest:false,isNative:false,isNativeMainThread:false,isNativeBackgroundThread:false,isManifestV3:true,isRuntimeBrowser:true,isWebEmbed:false,isWeb:false,version:'6.6.0'};`,
  );
  add(
    'packages/shared/src/errors/index.ts',
    `export class OneKeyLocalError extends Error {}; export class OneKeyError extends Error {}; export class SystemDiskFullError extends Error {}; export class OneKeyErrorClassNames {};`,
  );
  add(
    'packages/shared/src/errors/utils/errorUtils.ts',
    `export default {autoPrintErrorIgnore(){},logCurrentCallStack(){}};`,
  );
  add(
    'packages/shared/src/modules3rdParty/react-native-file-logger/index.ts',
    `export const NativeLogger={write(){}};export const LogLevel={Info:1};`,
  );
  add(
    'packages/shared/src/utils/cacheUtils.ts',
    `import memoizee from 'memoizee'; export {memoizee}; export default {memoizee};`,
  );
  add(
    'packages/shared/src/utils/coldStartCacheSnapshotUtils.ts',
    `export const parseColdStartSnapshotRaw=()=>{throw Error('Unused cold cache')}; export const prepareColdStartSnapshotForWrite=parseColdStartSnapshotRaw;`,
  );
  add(
    'packages/shared/src/utils/swrCacheUtils.ts',
    `export const swrCacheUtils={};`,
  );
  add(
    'packages/shared/src/utils/debug/dbPerfMonitor.ts',
    `export default {logAppStorageCall(){}};`,
  );
  add(
    'packages/shared/src/utils/resetUtils.ts',
    `export default {checkNotInResetting(){},getIsResetting(){return false}};`,
  );
  add(
    'packages/shared/src/storageChecker/storageChecker.ts',
    `export default {checkIfDiskIsFullSync(){},isConnectionClosingError(){return false},handleDiskFullError(e){throw e}};`,
  );
  add(
    'packages/shared/src/eventBus/appEventBus.ts',
    `export const appEventBus={emit(){}};export const EAppEventBusNames={};`,
  );
  // These branches are never used in the isolated non-native storage read.
  add(
    'packages/shared/src/storage/instance/secureStorageInstance.ts',
    `export default new Proxy({}, {get(){throw Error('Secure storage is outside this fixture')}});`,
  );
  add(
    'packages/shared/src/storage/instance/syncStorageInstance.ts',
    `export const syncStorage=new Proxy({}, {get(){throw Error('Sync storage is outside this fixture')}});`,
  );
  add(
    'packages/shared/src/travelMode/controlStorage.ts',
    `export default new Proxy({}, {get(){throw Error('Native control storage is outside this fixture')}});`,
  );
  add(
    'packages/shared/src/travelMode/TravelModeManager.ts',
    `export class TravelModeManager {constructor(){throw Error('Native travel mode is outside this fixture')}}`,
  );
  add(
    'packages/shared/src/travelMode/pushControl.ts',
    `export const setTravelModePushSuppressed=()=>{throw Error('Native push is outside this fixture')};`,
  );
  add(
    'packages/shared/src/request/Interceptor.ts',
    `export const HEADER_REQUEST_ID_KEY='x-onekey-request-id'; export const getRequestHeaders=()=>{throw Error('Private assets must not request OneKey headers')};`,
  );
  add(
    'packages/shared/src/logger/logger.ts',
    `export const defaultLogger={app:{network:{start(){throw Error('Unused network logging')},end(){throw Error('Unused network logging')},error(){throw Error('Unexpected network error')}}}};`,
  );
  add(
    'packages/shared/src/logger/scopes/app/scenes/networkFilter.ts',
    `export const isEnableLogNetwork=()=>false;`,
  );
  add(
    'packages/shared/src/utils/systemTimeUtils.ts',
    `export default {handleServerResponseDate(){}};`,
  );
  const seen = new Set();
  const resolved = new Map();
  const plugin = {
    name: 'bounded-real-atom-source',
    setup(b) {
      b.onResolve({ filter: /.*/ }, async (a) => {
        if (a.pluginData?.resolved) return;
        const r = await b.resolve(a.path, {
          kind: a.kind,
          resolveDir: a.resolveDir,
          pluginData: { resolved: true },
        });
        if (r.errors?.length) return r;
        const f = r.path;
        if (stubs.has(f)) return { path: f, namespace: 'fixture-stub' };
        return r;
      });
      b.onLoad({ filter: /.*/, namespace: 'fixture-stub' }, (a) => ({
        contents: stubs.get(a.path),
        loader: 'ts',
        resolveDir: path.dirname(a.path),
      }));
      b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (a) => {
        seen.add(a.path);
        if (seen.size > 512)
          throw new LavaMoatError('Bounded graph exceeded 512 modules');
        if (a.path.includes('/@tamagui/'))
          throw new LavaMoatError('Unexpected Tamagui dependency');
        const moduleSource =
          a.path === endpointFile
            ? runtimeSource
            : fs.readFileSync(a.path, 'utf8');
        resolved.set(a.path, moduleSource);
        let loader = 'js';
        if (a.path.endsWith('.tsx')) loader = 'tsx';
        else if (a.path.endsWith('.ts')) loader = 'ts';
        return { contents: moduleSource, loader };
      });
    },
  };
  const modulePath = (relative) => javascriptLiteral(path.join(repo, relative));
  const entry = `import ${modulePath('packages/shared/src/request/fetchInterceptor')};
import {devSettingsPersistAtom} from ${modulePath('packages/kit-bg/src/states/jotai/atoms/devSettings')};
import {globalJotaiStorageReadyHandler,onekeyJotaiStorage} from ${modulePath('packages/kit-bg/src/states/jotai/jotaiStorage')};
import {checkIsOneKeyDomain} from ${modulePath('packages/kit-bg/src/endpoints')};
import requestHelper from ${modulePath('packages/shared/src/request/requestHelper')};
requestHelper.overrideMethods({checkIsOneKeyDomain,getDevSettingsPersistAtom:()=>devSettingsPersistAtom.get(),getSettingsPersistAtom(){throw Error('Not used')},getSettingsValuePersistAtom(){throw Error('Not used')},getIpTableConfig:()=>Promise.resolve(null)});
globalThis.__probe={ready:()=>globalJotaiStorageReadyHandler.isReady,atom:()=>devSettingsPersistAtom.get(),storage:()=>onekeyJotaiStorage.getItem('g_states_v5:devSettingsPersistAtom',null),check:checkIsOneKeyDomain,fetchAsset:()=>fetch(chrome.runtime.getURL('asset.bin')).then(r=>r.text())};
`;

  const result = await build({
    stdin: {
      contents: entry,
      resolveDir: repo,
      sourcefile: 'fixture-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    outfile: path.join(directory, `${mode}.js`),
    absWorkingDir: repo,
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.HARDWARE_SDK_CONNECT_SRC': '""',
    },
    resolveExtensions: [
      '.ext.ts',
      '.web.ts',
      '.ts',
      '.tsx',
      '.mjs',
      '.js',
      '.json',
    ],
    alias: { 'react-native': 'react-native-web' },
    plugins: [plugin],
    metafile: true,
    logLevel: 'silent',
  });
  for (const required of [
    'packages/kit-bg/src/states/jotai/atoms/devSettings.ts',
    'packages/kit-bg/src/states/jotai/jotaiStorage.ts',
    'packages/kit-bg/src/states/jotai/utils/index.ts',
    'packages/kit-bg/src/states/jotai/utils/JotaiCrossAtom.ts',
    'packages/kit-bg/src/states/jotai/utils/wrapAtomPro.ts',
    'packages/shared/src/storage/appStorage.ext.ts',
    'packages/shared/src/storage/WebStorage.ts',
    'packages/shared/src/IndexedDBPromised/IndexedDBPromised.ts',
    'packages/shared/src/request/fetchInterceptor.ts',
  ]) {
    const physical = fs.realpathSync(path.join(repo, required));
    assert.equal(stubs.has(physical), false, required);
    assert.equal(seen.has(physical), true, required);
  }
  return { modules: seen.size, inputs: Object.keys(result.metafile.inputs) };
}

async function evaluate(s, expression) {
  const r = await s.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails)
    throw new LavaMoatError(
      r.exceptionDetails.exception?.description || r.exceptionDetails.text,
    );
  return r.result.value;
}

async function browserRun(directory) {
  const id = createHash('sha256')
    .update(Buffer.from(key, 'base64'))
    .digest('hex')
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (d) => String.fromCharCode(97 + parseInt(d, 16)));
  const origin = `chrome-extension://${id}`;
  const ext = path.join(directory, 'extension');
  fs.mkdirSync(ext, { recursive: true });
  const bytes = Buffer.from('fixed-public-private-asset');
  fs.writeFileSync(path.join(ext, 'asset.bin'), bytes);
  for (const name of ['original', 'candidate']) {
    const code = fs.readFileSync(path.join(directory, `${name}.js`));
    fs.writeFileSync(path.join(ext, `${name}.js`), code);
    const sri = createHash('sha384').update(code).digest('base64');
    fs.writeFileSync(
      path.join(ext, `${name}.html`),
      `<!doctype html><html><head><meta charset="utf-8"><script defer src="${name}.js" integrity="sha384-${sri}" crossorigin="anonymous"></script></head><body></body></html>`,
    );
  }
  fs.writeFileSync(
    path.join(ext, 'background.js'),
    'chrome.runtime.onMessage.addListener(()=>{});globalThis.__fixtureApiReady=Boolean(chrome.offscreen&&chrome.runtime.getContexts);',
  );
  fs.writeFileSync(
    path.join(ext, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'Bounded actual atom readiness probe',
      version: '1.0.0',
      key,
      permissions: ['offscreen'],
      background: { service_worker: 'background.js' },
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self'",
      },
    }),
  );
  const errors = [];
  const network = [];
  const report = {
    scope:
      'Actual Jotai/store/IndexedDB and request interceptor in native Offscreen; no policy/full-App claim',
    runs: [],
    errors,
  };
  let browser;
  let watchdog;
  const timeout = new Promise((_, reject) => {
    watchdog = setTimeout(
      () => reject(new LavaMoatError('Bounded Offscreen readiness watchdog')),
      60_000,
    );
  });
  try {
    await Promise.race([
      (async () => {
        browser = await startBrowser(
          fs.mkdtempSync(path.join(directory, 'profile-')),
          process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
        );
        const targets = await interceptTargets(
          browser,
          origin,
          async (s, t, beforeNavigation) => {
            s.on('Runtime.exceptionThrown', (e) =>
              errors.push({
                type: 'exception',
                description:
                  e.exceptionDetails.exception?.description ||
                  e.exceptionDetails.text,
              }),
            );
            s.on('Runtime.bindingCalled', (e) => {
              if (e.name === '__onekeySmokeRejection') {
                const x = JSON.parse(e.payload);
                if (x.type !== 'observer') errors.push(x);
              }
            });
            await s.send('Runtime.enable');
            await installRejectionObserver(s, !beforeNavigation);
            await s.send('Network.enable');
            s.on('Network.responseReceived', (e) => {
              if (e.response.url === `${origin}/asset.bin`)
                network.push(e.response.status);
            });
          },
          (t, d) => errors.push({ type: 'target', detail: d }),
        );
        await browser.cdp.send('Extensions.loadUnpacked', { path: ext });
        let bg;
        for (let i = 0; i < 200; i += 1) {
          const { targetInfos } = await browser.cdp.send('Target.getTargets');
          const t = targetInfos.find(
            (item) => item.url === `${origin}/background.js`,
          );
          if (t && targets.has(t.targetId)) {
            bg = await targets.get(t.targetId);
            if (await evaluate(bg, 'globalThis.__fixtureApiReady===true'))
              break;
            bg = undefined;
          }
          await delay(25);
        }
        assert.ok(bg);
        for (const mode of ['original', 'candidate']) {
          await evaluate(
            bg,
            `chrome.offscreen.createDocument({url:'${mode}.html',reasons:['DOM_PARSER'],justification:'Observe real atom readiness in an isolated fixture'})`,
          );
          let s;
          for (let i = 0; i < 200; i += 1) {
            const { targetInfos } = await browser.cdp.send('Target.getTargets');
            const t = targetInfos.find(
              (item) => item.url === `${origin}/${mode}.html`,
            );
            if (t && targets.has(t.targetId)) {
              s = await targets.get(t.targetId);
              if (await evaluate(s, 'Boolean(globalThis.__probe)')) break;
            }
            s = undefined;
            await delay(25);
          }
          assert.ok(s, JSON.stringify(errors));
          const contexts = await evaluate(
            bg,
            "chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})",
          );
          assert.equal(contexts.length, 1);
          assert.equal(contexts[0].documentUrl, `${origin}/${mode}.html`);
          const result = await evaluate(
            s,
            `(async()=>{const p=globalThis.__probe;const storage=await p.storage();let atomSettled=false,httpSettled=false,fetchSettled=false,fetchValue,fetchError;p.atom().then(()=>{atomSettled=true},()=>{atomSettled=true});p.check('https://wallet.onekeycn.com/wallet/v1/health').then(()=>{httpSettled=true},()=>{httpSettled=true});p.fetchAsset().then(v=>{fetchSettled=true;fetchValue=v},e=>{fetchSettled=true;fetchError=e.message});await new Promise(r=>setTimeout(r,600));return {storageIsEmpty:storage===null,ready:p.ready(),atomSettled,httpSettled,fetchSettled,fetchValue,fetchError};})()`,
          );
          assert.equal(result.storageIsEmpty, true);
          assert.equal(result.ready, false);
          assert.equal(result.atomSettled, false);
          assert.equal(result.httpSettled, false);
          assert.equal(result.fetchSettled, mode === 'candidate');
          if (mode === 'candidate') {
            assert.equal(result.fetchValue, bytes.toString());
            assert.equal(result.fetchError, undefined);
          }
          report.runs.push({ mode, ...result });
          await evaluate(bg, 'chrome.offscreen.closeDocument()');
        }
        assert.deepEqual(network, [200]);
        assert.deepEqual(errors, []);
        report.network = network;
        report.pass = true;
      })(),
      timeout,
    ]);
    return report;
  } finally {
    clearTimeout(watchdog);
    if (browser) await browser.close();
  }
}

test(
  'real MV3 Offscreen storage remains unready while only non-HTTP packaged fetch proceeds',
  { timeout: 90_000 },
  async () => {
    const directory = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-request-protocol-')),
    );
    try {
      const original = await compile(directory, 'original');
      const candidate = await compile(directory, 'candidate');
      assert.ok(original.modules <= 512 && candidate.modules <= 512);
      await browserRun(directory);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
