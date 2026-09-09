// cspell:ignore LavaMoat lavamoat lockdown onekeyhq ONEKEY

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const LavaMoatPlugin = require('@lavamoat/webpack');
const { transformSync, buildSync } = require('esbuild');
const webpack = require('webpack');

const {
  startBrowser,
  interceptTargets,
  installRejectionObserver,
} = require('../../apps/ext/scripts/smoke-lavamoat.cjs');
const { key } = require('../../apps/ext/src/manifest/shared');

const { LavaMoatError } = require('./error.cjs');
const { javascriptLiteral } = require('./javascript-literal.cjs');

const repo = path.resolve(__dirname, '../..');
const rootRequire = createRequire(path.join(repo, 'package.json'));
const write = (file, bytes) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
};
const readSource = (file) => fs.readFileSync(path.join(repo, file), 'utf8');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = {
  entry: 'apps/ext/src/entry/ui-passkey.tsx',
  helper: 'packages/kit-bg/src/init/updateInterceptorRequestHelper.ts',
  request: 'packages/shared/src/request/requestHelper.ts',
  interceptor: 'packages/shared/src/request/fetchInterceptor.ts',
  endpoints: 'packages/kit-bg/src/endpoints/index.ts',
  endpointsMap: 'packages/shared/src/config/endpointsMap.ts',
  appConfig: 'packages/shared/src/config/appConfig.ts',
  endpointTypes: 'packages/shared/types/endpoint.ts',
  locale: 'packages/shared/src/locale/packagedLocale.ts',
};
const sources = Object.fromEntries(
  Object.entries(sourceFiles).map(([name, file]) => [name, readSource(file)]),
);
const helperRequest =
  '@onekeyhq/kit-bg/src/init/updateInterceptorRequestHelper';
const initialization = `  const { updateInterceptorRequestHelper } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@onekeyhq/kit-bg/src/init/updateInterceptorRequestHelper') as typeof import('@onekeyhq/kit-bg/src/init/updateInterceptorRequestHelper');
  updateInterceptorRequestHelper();

`;
assert.equal(
  sources.entry.split(initialization).length,
  2,
  'The production Passkey entry must initialize its request helper',
);
const candidate = sources.entry;
const original = candidate.replace(initialization, '');
const offscreenCandidate = readSource('apps/ext/src/entry/offscreen.ts');
assert.equal(
  offscreenCandidate.split(initialization).length,
  2,
  'The production Offscreen entry must initialize its request helper',
);
const offscreenOriginal = offscreenCandidate.replace(initialization, '');

// Exercise the real entry control flow without starting UI, timers or WebAuthn.
function entryContract(source, label) {
  const state = { events: [], closed: 0, cleared: 0, delay: 0 };
  let interval,
    focus,
    now = 100;
  const compiled = transformSync(source, {
    loader: 'tsx',
    format: 'cjs',
    target: 'es2022',
  }).code;
  const context = vm.createContext({
    module: { exports: {} },
    console: { log() {} },
    Date: { now: () => now },
    window: {
      addEventListener: (event, callback) => {
        assert.equal(event, 'focus');
        focus = callback;
      },
    },
    setInterval: (callback, delay) => {
      interval = callback;
      state.delay = delay;
      return 'own-timer';
    },
    clearInterval: (timer) => {
      assert.equal(timer, 'own-timer');
      state.cleared += 1;
    },
    require: (request) => {
      if (request === '@onekeyhq/shared/src/polyfills') {
        state.events.push('polyfills');
        return {};
      }
      if (request === '@onekeyhq/shared/src/performance/init') {
        state.events.push('performance');
        return {};
      }
      if (request === '@onekeyhq/shared/src/security/sesHarden')
        return {
          maybeLockdownOneKeyRuntime: ({ runtime }) =>
            state.events.push(`lockdown:${runtime}`),
        };
      if (request === '../ui/uiJsBridge')
        return { default: { init: () => state.events.push('bridge') } };
      if (request === '../closePasskeyWIndow')
        return { closeWindow: () => (state.closed += 1) };
      if (request === '@onekeyhq/shared/src/security/sesHarden/runtimeCheck')
        return {
          installSesHardenRuntimeCheckMessageHandler: (runtime) =>
            state.events.push(`handler:${runtime}`),
        };
      if (request === helperRequest)
        return {
          updateInterceptorRequestHelper: () => state.events.push('helper'),
        };
      if (request === '../ui/renderPassKeyPage')
        return { default: () => state.events.push('render') };
      throw new LavaMoatError(
        `Unexpected entry contract dependency: ${request}`,
      );
    },
  });
  vm.runInContext(compiled, context, { timeout: 1000 });
  assert.deepEqual(state.events, [
    'polyfills',
    'performance',
    'bridge',
    'lockdown:ext-passkey',
    'handler:ext-passkey',
    ...(label === 'candidate' ? ['helper'] : []),
    'render',
  ]);
  assert.equal(state.delay, 10);
  now = 100 + 5 * 60 * 1000 - 1;
  interval();
  focus();
  assert.equal(state.closed, 0);
  now += 1;
  interval();
  focus();
  assert.equal(state.closed, 2);
  assert.equal(state.cleared, 1);
  return state;
}
test('Passkey initializes requests after its early bridge and hardening without changing close behavior', () => {
  entryContract(original, 'original');
  entryContract(candidate, 'candidate');
});

test('Offscreen initializes requests after bridge hardening and retains keep-alive and port recovery', () => {
  for (const label of ['original', 'candidate']) {
    const source =
      label === 'original' ? offscreenOriginal : offscreenCandidate;
    const state = { events: [], reloads: 0, cleared: 0, delay: 0 };
    const bridge = { portToBg: {} };
    let interval;
    const context = vm.createContext({
      module: { exports: {} },
      location: {
        reload() {
          state.reloads += 1;
        },
      },
      setInterval(callback, delayMs) {
        interval = callback;
        state.delay = delayMs;
        return 'offscreen-timer';
      },
      clearInterval(timer) {
        assert.equal(timer, 'offscreen-timer');
        state.cleared += 1;
      },
      require(request) {
        if (request === '@onekeyhq/shared/src/polyfills') {
          state.events.push('polyfills');
          return {};
        }
        if (request === '@onekeyhq/shared/src/security/sesHarden')
          return {
            maybeLockdownOneKeyRuntime: ({ runtime }) =>
              state.events.push(`lockdown:${runtime}`),
          };
        if (request === '../offscreen/offscreenSetup')
          return {
            offscreenSetup() {
              state.events.push('bridge');
              return bridge;
            },
          };
        if (request === '@onekeyhq/shared/src/security/sesHarden/runtimeCheck')
          return {
            installSesHardenRuntimeCheckMessageHandler: (runtime) =>
              state.events.push(`handler:${runtime}`),
          };
        if (request === helperRequest)
          return {
            updateInterceptorRequestHelper: () => state.events.push('helper'),
          };
        if (request === '../background/keepAlive')
          return {
            startKeepAlivePolling: () => state.events.push('keep-alive'),
          };
        if (request === '@onekeyhq/shared/src/utils/timerUtils')
          return {
            default: { getTimeDurationMs: ({ seconds }) => seconds * 1000 },
          };
        throw new LavaMoatError(
          `Unexpected Offscreen fixture dependency: ${request}`,
        );
      },
    });
    vm.runInContext(
      transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' })
        .code,
      context,
      { timeout: 1000 },
    );
    assert.deepEqual(state.events, [
      'polyfills',
      'bridge',
      'lockdown:ext-offscreen',
      'handler:ext-offscreen',
      ...(label === 'candidate' ? ['helper'] : []),
      'keep-alive',
    ]);
    assert.equal(state.delay, 5000);
    interval();
    assert.equal(state.reloads, 0);
    assert.equal(state.cleared, 0);
    bridge.portToBg = null;
    interval();
    assert.equal(state.reloads, 1);
    assert.equal(state.cleared, 1);
  }
});

const imports = {
  '../offscreen/offscreenSetup': 'offscreenSetup',
  '../background/keepAlive': 'keepAlive',
  '@onekeyhq/shared/src/utils/timerUtils': 'timerUtils',
  '@onekeyhq/shared/src/request/requestHelper': 'request',
  './requestHelper': 'request',
  '../request/requestHelper': 'request',
  '../endpoints': 'endpoints',
  '@onekeyhq/shared/src/config/endpointsMap': 'endpointsMap',
  './appConfig': 'appConfig',
  '@onekeyhq/shared/types/endpoint': 'endpointTypes',
  '@onekeyhq/shared/src/errors': 'errors',
  '../errors': 'errors',
  '../states/jotai/atoms/devSettings': 'devSettings',
  '../states/jotai/atoms/settings': 'settings',
  '@onekeyhq/shared/src/platformEnv': 'platform',
  '../platformEnv': 'platform',
  '@onekeyhq/shared/src/errors/utils/errorUtils': 'errorUtils',
  '../logger/logger': 'logger',
  '../logger/scopes/app/scenes/networkFilter': 'networkFilter',
  '../utils/systemTimeUtils': 'systemTime',
  './Interceptor': 'headers',
  'lodash': 'lodash',
  '@onekeyfe/hd-core/package.json': 'sdkVersion',
  '@onekeyhq/shared/src/polyfills': 'polyfills',
  '@onekeyhq/shared/src/performance/init': 'empty',
  '@onekeyhq/shared/src/security/sesHarden': 'harden',
  '@onekeyhq/shared/src/security/sesHarden/runtimeCheck': 'runtimeCheck',
  '../ui/uiJsBridge': 'bridge',
  '../closePasskeyWIndow': 'close',
  '../ui/renderPassKeyPage': 'render',
  [helperRequest]: 'helper',
};
const english = fs.readFileSync(
  path.join(repo, 'packages/shared/src/locale/json/en_US.json'),
);
const englishHash = hash(english);
const assetPath = `static/locales/en_US.${englishHash}.json`;
const localeIndex = {
  'en_US.json': {
    path: assetPath,
    sha256: englishHash,
    byteLength: english.length,
  },
};
// Only environment, UI/bridge, atom values and ancillary logging/headers/time
// dependencies are fixtures. The real first-party request, endpoint and locale
// implementations run as the trusted root: this is an initialization regression,
// not evidence of full App readiness or a replacement for owner-isolation tests.
const stubs = {
  offscreenSetup: 'exports.offscreenSetup=()=>({portToBg:{}});',
  keepAlive: 'exports.startKeepAlivePolling=()=>{};',
  timerUtils: 'exports.default={getTimeDurationMs:({seconds})=>seconds*1000};',
  errors:
    'exports.OneKeyLocalError=class OneKeyLocalError extends Error{};exports.OneKeyError=class OneKeyError extends Error{};',
  devSettings:
    'exports.devSettingsPersistAtom={get:async()=>({enabled:false,settings:{}})};',
  settings:
    'exports.settingsPersistAtom={get:async()=>({})};exports.settingsValuePersistAtom={get:async()=>({})};',
  platform: 'exports.default={isDev:false,isWebEmbed:false};',
  errorUtils: 'exports.default={autoPrintErrorIgnore(error){throw error}};',
  logger:
    'exports.defaultLogger={app:{network:{start(){throw Error("Unexpected request log")},end(){throw Error("Unexpected request log")},error(){}}}};',
  networkFilter: 'exports.isEnableLogNetwork=()=>false;',
  systemTime: 'exports.default={handleServerResponseDate:async()=>{}};',
  headers:
    'exports.HEADER_REQUEST_ID_KEY="test-request-id";exports.getRequestHeaders=async()=>{throw Error("Private locale must not acquire OneKey request headers")};',
  lodash:
    'exports.forEach=(value,callback)=>Object.entries(value).forEach(([key,item])=>callback(item,key));exports.filter=(value,callback)=>value.filter(callback);exports.isNil=value=>value==null;exports.isString=value=>typeof value==="string";',
  sdkVersion: JSON.stringify({
    version: rootRequire('@onekeyfe/hd-core/package.json').version,
  }),
  polyfills: 'require("./interceptor.js");',
  empty: '',
  harden:
    'exports.maybeLockdownOneKeyRuntime=()=>{if(!Object.isFrozen(Object.prototype))throw Error("LavaMoat did not harden host")};',
  runtimeCheck: 'exports.installSesHardenRuntimeCheckMessageHandler=()=>{};',
  bridge: 'exports.default={init(){}};',
  close:
    'exports.closeWindow=()=>{document.documentElement.dataset.closed="true"};',
  // This renderer is a fixture, not the Passkey UI. It calls the actual locale
  // implementation through the application's actual normalized fetch chain.
  render: `
    const request=require('./request.js').default;
    const endpoints=require('./endpoints.js');
    const create=require('./locale.js').createPackagedLocaleLoader;
    const index=${javascriptLiteral(localeIndex)};
    let load=create(index);
    function run() {
      const pending=load('en_US.json');
      const samePending=pending===load('en_US.json');
      pending.then(async messages=>{
        const after=await load('en_US.json');
        return {ok:true,value:messages['global.confirm'],samePending,
          sameMessages:messages===after,
          helperIdentity:request.checkIsOneKeyDomain===endpoints.checkIsOneKeyDomain,
          ipTablePreserved:(await request.getIpTableConfig()).tag==='existing',
          privateDomain:await endpoints.checkIsOneKeyDomain(chrome.runtime.getURL(${javascriptLiteral(assetPath)})),
          validDomain:await endpoints.checkIsOneKeyDomain('https://wallet.onekeycn.com/wallet/v1/health'),
          spoofDomain:await endpoints.checkIsOneKeyDomain('https://wallet.onekeycn.com.evil.invalid/'),
          harden:typeof harden,
          frozen:[Object.prototype,Array.prototype,Function.prototype].map(Object.isFrozen),
          noEval:(()=>{try{Function('return 1')();return false}catch{return true}})()};
      },error=>({ok:false,error:error.message})).then(result=>{
        document.documentElement.setAttribute('data-result',JSON.stringify(result));
      });
    }
    exports.default=()=>{
      document.addEventListener('fixture-locale-retry',run);
      document.addEventListener('fixture-locale-reset',()=>{load=create(index);run();});
      run();
    };
  `,
};
async function compile(directory, label, kind) {
  const graph = path.join(directory, `${kind}-${label}`, 'graph');
  const output = path.join(directory, `${kind}-${label}`, 'artifact');
  const graphWrite = (file, data) => write(path.join(graph, file), data);
  graphWrite(
    'package.json',
    JSON.stringify({
      name: 'passkey-request-initialization-fixture',
      private: true,
    }),
  );
  for (const [name, source] of Object.entries(sources)) {
    let actual = source;
    if (name === 'entry') {
      actual = label === 'original' ? original : candidate;
      if (kind === 'offscreen')
        actual = label === 'original' ? offscreenOriginal : offscreenCandidate;
    }
    const transformed = transformSync(actual, {
      loader: name === 'entry' ? 'tsx' : 'ts',
      format: 'cjs',
      target: 'es2022',
    }).code;
    const mapped = transformed.replace(
      /require\("([^"\n]+)"\)/g,
      (whole, request) => {
        assert.ok(
          Object.hasOwn(imports, request),
          `Unexpected actual source dependency: ${name} ${request}`,
        );
        return `require(${javascriptLiteral(`./${imports[request]}${imports[request] === 'sdkVersion' ? '.json' : '.js'}`)})`;
      },
    );
    graphWrite(`${name}.js`, mapped);
  }
  for (const [name, source] of Object.entries(stubs))
    graphWrite(
      name + (name === 'sdkVersion' ? '.json' : '.js'),
      (['platform', 'errorUtils', 'systemTime'].includes(name)
        ? 'Object.defineProperty(exports,"__esModule",{value:true});'
        : '') + source,
    );
  graphWrite(
    'boot.js',
    `const request=require('./request.js').default;request.getIpTableConfig=async()=>({tag:'existing'});require('./entry.js');${kind === 'offscreen' ? "require('./render.js').default();" : ''}`,
  );
  graphWrite('policy.json', JSON.stringify({ resources: {} }));
  const compiler = webpack({
    mode: 'production',
    target: 'web',
    context: graph,
    entry: './boot.js',
    devtool: false,
    output: { path: output, filename: 'entry.js', publicPath: '' },
    optimization: { minimize: false, splitChunks: false, runtimeChunk: false },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.HARDWARE_SDK_CONNECT_SRC': JSON.stringify(''),
      }),
      new LavaMoatPlugin({
        rootDir: graph,
        policyLocation: graph,
        readableResourceIds: true,
        inlineLockdown: /^entry\.js$/,
        lockdown: {
          evalTaming: 'no-eval',
          errorTrapping: 'none',
          errorTaming: 'unsafe',
        },
        staticShims_experimental: [path.join(directory, 'shim.js')],
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
  } finally {
    await new Promise((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve())),
    );
  }
  write(path.join(output, assetPath), english);
  write(
    path.join(output, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'Passkey request initialization fixture',
      version: '1.0.0',
      key,
      ...(kind === 'offscreen'
        ? {
            permissions: ['offscreen'],
            background: { service_worker: 'create-offscreen.js' },
          }
        : {}),
      content_security_policy: {
        extension_pages:
          "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      },
    }),
  );
  if (kind === 'offscreen')
    write(
      path.join(output, 'create-offscreen.js'),
      `chrome.runtime.__fixtureOffscreenCreated=chrome.offscreen.createDocument({url:'ui-passkey.html',reasons:['DOM_PARSER'],justification:'Exercise the real isolated Offscreen request initialization'});`,
    );
  const sri = createHash('sha384')
    .update(fs.readFileSync(path.join(output, 'entry.js')))
    .digest('base64');
  write(
    path.join(output, 'ui-passkey.html'),
    `<!doctype html><html><head><meta charset="utf-8"><script defer src="entry.js" integrity="sha384-${sri}" crossorigin="anonymous"></script></head><body></body></html>`,
  );
  return output;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function browserRun(directory, label, kind, output) {
  const id = hash(Buffer.from(key, 'base64'))
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (digit) =>
      String.fromCharCode(97 + Number.parseInt(digit, 16)),
    );
  const origin = `chrome-extension://${id}`;
  const browser = await startBrowser(
    fs.mkdtempSync(path.join(directory, `${kind}-${label}`, 'profile-')),
    process.env.ONEKEY_LAVAMOAT_TEST_CHROME,
  );
  const errors = [],
    observers = [],
    network = [];
  try {
    const targets = await interceptTargets(
      browser,
      origin,
      async (session, target, beforeNavigation) => {
        session.on('Runtime.exceptionThrown', (event) =>
          errors.push({
            text:
              event.exceptionDetails.exception?.description ||
              event.exceptionDetails.text,
            url: event.exceptionDetails.url,
            line: event.exceptionDetails.lineNumber,
            column: event.exceptionDetails.columnNumber,
          }),
        );
        session.on('Runtime.bindingCalled', (event) => {
          if (event.name === '__onekeySmokeRejection')
            observers.push(JSON.parse(event.payload));
        });
        await session.send('Runtime.enable');
        await installRejectionObserver(session, !beforeNavigation);
        await session.send('Network.enable');
        session.on('Network.responseReceived', (event) => {
          if (event.response.url === `${origin}/${assetPath}`)
            network.push({
              status: event.response.status,
              url: event.response.url,
            });
        });
      },
      (target, detail) => errors.push({ target, detail }),
    );
    await browser.cdp.send('Extensions.loadUnpacked', { path: output });
    let session;
    if (kind === 'offscreen') {
      let lastTargets = [];
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const { targetInfos } = await browser.cdp.send('Target.getTargets');
        lastTargets = targetInfos
          .filter((item) => item.url.startsWith(origin))
          .map(({ type, url }) => ({ type, url }));
        const target = targetInfos.find(
          (item) => item.url === `${origin}/ui-passkey.html`,
        );
        if (target && targets.has(target.targetId)) {
          session = await targets.get(target.targetId);
          const background = targetInfos.find(
            (item) => item.url === `${origin}/create-offscreen.js`,
          );
          assert.ok(background && targets.has(background.targetId));
          const worker = await targets.get(background.targetId);
          // The native target can appear before createDocument has finished.
          // Await the real API promise before checking its registered context.
          const contexts = await worker.send('Runtime.evaluate', {
            expression:
              "chrome.runtime.__fixtureOffscreenCreated.then(()=>chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']}))",
            returnByValue: true,
            awaitPromise: true,
          });
          assert.equal(contexts.exceptionDetails, undefined);
          assert.equal(contexts.result.value.length, 1);
          assert.equal(
            contexts.result.value[0].contextType,
            'OFFSCREEN_DOCUMENT',
          );
          assert.equal(
            contexts.result.value[0].documentUrl,
            `${origin}/ui-passkey.html`,
          );
          assert.equal(
            targetInfos.filter(
              (item) => item.url === `${origin}/ui-passkey.html`,
            ).length,
            1,
          );
          break;
        }
        await delay(25);
      }
      assert.ok(
        session,
        `The browser must create a real Offscreen document: ${JSON.stringify({ lastTargets, errors, observers })}`,
      );
    } else {
      const { targetId } = await browser.cdp.send('Target.createTarget', {
        url: 'about:blank',
      });
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (targets.has(targetId)) {
          session = await targets.get(targetId);
          break;
        }
        await delay(20);
      }
      assert.ok(session);
      await session.send('Page.navigate', {
        url: `${origin}/ui-passkey.html?devSesCheck=idle`,
      });
    }
    const readResult = async () => {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const response = await session.send('Runtime.evaluate', {
          expression: "document.documentElement?.getAttribute('data-result')",
          returnByValue: true,
        });
        assert.equal(response.exceptionDetails, undefined);
        if (response.result.value) return JSON.parse(response.result.value);
        await delay(25);
      }
      throw new LavaMoatError(
        `Actual entry did not finish request outcome: ${JSON.stringify(
          errors,
        )}`,
      );
    };
    const rerun = async (reset) => {
      const response = await session.send('Runtime.evaluate', {
        expression: `document.documentElement.removeAttribute('data-result');document.dispatchEvent(new Event(${javascriptLiteral(reset ? 'fixture-locale-reset' : 'fixture-locale-retry')}));`,
      });
      assert.equal(response.exceptionDetails, undefined);
      return readResult();
    };
    const result = await readResult();
    assert.deepEqual(errors, []);
    assert.ok(observers.length > 0);
    assert.ok(
      observers.every(
        (item) => item.type === 'observer' && item.installedBeforeLockdown,
      ),
    );
    if (label === 'original') {
      assert.equal(result.ok, false);
      assert.match(
        result.error,
        /Not implemented, please call overrideMethods/,
      );
      assert.deepEqual(network, []);
    } else {
      assert.equal(result.ok, true);
      assert.equal(result.value, JSON.parse(english)['global.confirm']);
      for (const field of [
        'samePending',
        'sameMessages',
        'helperIdentity',
        'ipTablePreserved',
        'validDomain',
        'noEval',
      ])
        assert.equal(result[field], true, field);
      assert.equal(result.privateDomain, false);
      assert.equal(result.spoofDomain, false);
      assert.deepEqual(result.frozen, [true, true, true]);
      assert.equal(result.harden, 'function');
      assert.deepEqual(
        network.map((item) => item.status),
        [200],
      );
    }
    if (label === 'candidate') {
      const file = path.join(output, assetPath);
      try {
        // A successful promise remains cached even if its backing file later
        // changes; it cannot silently replace verified messages with new data.
        fs.writeFileSync(file, english.subarray(0, english.length - 1));
        const cached = await rerun(false);
        assert.equal(cached.ok, true);
        assert.equal(cached.sameMessages, true);
        assert.equal(network.length, 1);

        for (const corruption of ['length', 'sha256']) {
          const damaged = Buffer.from(english);
          damaged[0] ^= 1;
          fs.writeFileSync(
            file,
            corruption === 'length'
              ? english.subarray(0, english.length - 1)
              : damaged,
          );
          const count = network.length;
          const failed = await rerun(true);
          assert.equal(failed.ok, false);
          assert.match(
            failed.error,
            corruption === 'length'
              ? /Packaged locale size mismatch/
              : /Packaged locale integrity mismatch/,
          );
          assert.equal(network.length, count + 1);
          fs.writeFileSync(file, english);
          // Retry the same loader instance. No cache reset may conceal failure
          // retention or replace the source of the integrity check.
          const recovered = await rerun(false);
          assert.equal(recovered.ok, true);
          assert.equal(recovered.value, JSON.parse(english)['global.confirm']);
          assert.equal(recovered.samePending, true);
          assert.equal(recovered.sameMessages, true);
          assert.equal(network.length, count + 2);
        }
        assert.deepEqual(
          network.map((item) => item.status),
          [200, 200, 200, 200, 200],
        );
      } finally {
        fs.writeFileSync(file, english);
      }
    }
    assert.deepEqual(errors, []);
    assert.ok(
      observers.every(
        (item) => item.type === 'observer' && item.installedBeforeLockdown,
      ),
    );
  } finally {
    await browser.close();
  }
}
for (const kind of ['passkey', 'offscreen']) {
  test(
    `actual MV3 ${kind} initialization preserves private locale integrity, retries, cache and domain rules`,
    { timeout: 120_000 },
    async () => {
      const directory = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-passkey-request-')),
      );
      try {
        buildSync({
          entryPoints: [
            path.join(repo, 'development/webpack/lavamoat-shims.js'),
          ],
          bundle: true,
          platform: 'browser',
          outfile: path.join(directory, 'shim.js'),
          logLevel: 'silent',
        });
        for (const label of ['original', 'candidate']) {
          const output = await compile(directory, label, kind);
          await browserRun(directory, label, kind, output);
        }
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    },
  );
}
