const fs = require('fs');
const { createRequire } = require('module');
const path = require('path');
const vm = require('vm');

const babel = require('@babel/core');

const trackerFile = path.join(
  __dirname,
  'nativePromiseRejectionTracker.native.ts',
);

function createRuntime({
  hermes = true,
  missingTracker = false,
  prepare = true,
  enabled = true,
} = {}) {
  // SES must never reach host/Jest objects: every initial global lives in this VM.
  const context = vm.createContext({});
  vm.runInContext(
    `
    globalThis.global = globalThis;
    globalThis.__DEV__ = false;
    globalThis.events = [];
    globalThis.console = { log(){}, warn(){ events.push('warning'); }, error(){} };
    globalThis.process = { env: {}, nextTick(){} };
    globalThis.setTimeout = () => 1;
    globalThis.clearTimeout = () => {};
    globalThis.ErrorUtils = {
      handler(){ events.push('initial'); },
      getGlobalHandler(){ return this.handler; },
      setGlobalHandler(handler){ this.handler = handler; }
    };
  `,
    context,
  );
  const adapter = createRequire(
    require.resolve('@lavamoat/react-native-lockdown/package.json'),
  );
  for (const filename of [
    adapter.resolve('ses/hermes'),
    adapter.resolve('@lavamoat/react-native-lockdown/repair'),
  ]) {
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context);
  }
  vm.runInContext('globalThis.originalPromise = Promise;', context);
  if (!enabled) context.process.env.ONEKEY_MOBILE_LOCKDOWN = 'false';
  if (hermes) {
    vm.runInContext(
      `globalThis.HermesInternal = {
      hasPromise(){ return true; },
      enablePromiseRejectionTracker(options){
        globalThis.tracking = options;
        events.push('install-tracker');
      }
    };`,
      context,
    );
    if (missingTracker)
      vm.runInContext(
        'delete HermesInternal.enablePromiseRejectionTracker;',
        context,
      );
  }
  // Load the real RN polyfill and npm Promise implementation in the same heap.
  // Only source text crosses the VM boundary; module exports are created inside.
  context.readModule = (specifier, parent) => {
    if (specifier === 'domain')
      return { filename: 'domain', code: 'module.exports = { active: null };' };
    const filename = createRequire(parent).resolve(specifier);
    const { code } = babel.transformFileSync(filename, {
      babelrc: false,
      configFile: false,
      ...(filename.endsWith('.ts')
        ? {
            plugins: [
              '@babel/plugin-transform-typescript',
              '@babel/plugin-transform-modules-commonjs',
            ],
          }
        : { presets: [require.resolve('@react-native/babel-preset')] }),
    });
    return { filename, code };
  };
  vm.runInContext(
    `
    globalThis.cache = {};
    globalThis.load = (specifier, parent) => {
      const { filename, code } = readModule(specifier, parent);
      if (cache[filename]) return cache[filename].exports;
      const module = { exports: {} };
      cache[filename] = module;
      Function('require', 'module', 'exports', code)(
        (name) => load(name, filename), module, module.exports
      );
      return module.exports;
    };
  `,
    context,
  );
  context.filename = trackerFile;
  vm.runInContext(
    'globalThis.trackerModule = load(filename, filename); globalThis.tracker = trackerModule.default;',
    context,
  );
  if (prepare && !missingTracker)
    vm.runInContext(
      'trackerModule.prepareNativePromiseRejectionTracker();',
      context,
    );
  if (enabled) vm.runInContext('hardenIntrinsics();', context);
  return (code) => vm.runInContext(code, context);
}

test('Hermes subscriptions preserve the repaired Promise and report native rejections', () => {
  const run = createRuntime();
  run(`tracker.setErrorTracker(() => events.push('app'));
    tracking.onUnhandled(3, new Error('fixture'));
  `);
  expect(run('Promise === originalPromise')).toBe(true);
  expect(run('Object.isFrozen(Promise.prototype)')).toBe(true);
  expect(run('Object.isFrozen(Promise)')).toBe(true);
  expect(run('tracking.allRejections')).toBe(true);
  expect(run('JSON.stringify(events)')).toBe(
    JSON.stringify(['install-tracker', 'warning', 'app']),
  );
  expect(
    run(
      `Object.keys(cache).some((filename) => filename.includes('/promise/'))`,
    ),
  ).toBe(false);
});

test('SDK rejection observers and app replacement/removal remain independent', () => {
  const run = createRuntime();
  run(`
    trackerModule.setNativePromiseRejectionTrackingOptions({allRejections: true, onUnhandled(){ events.push('sentry'); }, onHandled(){ events.push('handled'); }});
    tracker.setErrorTracker(() => events.push('old-app'));
    const appChain = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, fatal) => { events.push('late-sdk'); appChain(error, fatal); });
    tracker.setErrorTracker(() => events.push('new-app'));
    tracking.onUnhandled(4, new Error('fixture'));
  `);
  expect(run('JSON.stringify(events)')).toBe(
    JSON.stringify(['install-tracker', 'sentry', 'warning', 'new-app']),
  );
  run(
    `events.length = 0; tracker.setErrorTracker(() => {}); tracking.onUnhandled(5, new Error('fixture'));`,
  );
  expect(run('JSON.stringify(events)')).toBe(
    JSON.stringify(['sentry', 'warning']),
  );
  run(
    `events.length = 0; ErrorUtils.getGlobalHandler()(new Error('fixture'), false);`,
  );
  expect(run('JSON.stringify(events)')).toBe(
    JSON.stringify(['late-sdk', 'initial']),
  );
  expect(
    run('Promise === originalPromise && Object.isFrozen(Promise.prototype)'),
  ).toBe(true);
});

test('app listener still receives errors when the previous global handler throws', () => {
  const run = createRuntime();
  run(
    `ErrorUtils.setGlobalHandler(() => { throw new Error('handler fixture'); }); tracker.setErrorTracker(() => events.push('app'));`,
  );
  expect(() =>
    run(`ErrorUtils.getGlobalHandler()(new Error('fixture'), false)`),
  ).toThrow('handler fixture');
  expect(run('events.at(-1)')).toBe('app');
});

test('a Hermes runtime missing its tracking API fails without replacing Promise', () => {
  const run = createRuntime({ missingTracker: true });
  expect(() =>
    run('trackerModule.prepareNativePromiseRejectionTracker();'),
  ).toThrow('before lockdown');
  expect(() => run('tracker.setErrorTracker(() => {});')).toThrow(
    'not prepared',
  );
  expect(
    run('Promise === originalPromise && Object.isFrozen(Promise.prototype)'),
  ).toBe(true);
  expect(run('events.length')).toBe(0);
});

test.each([{ hermes: false }, { hermes: true, enabled: false }])(
  'rollback/non-Hermes retains the npm Promise fallback: %j',
  (options) => {
    const run = createRuntime(options);
    run(
      `tracker.setErrorTracker(() => events.push('app')); globalThis.fallbackPromise = Promise; tracker.getUnhandledPromiseRejectionTracker()('1', new Error('fixture'));`,
    );
    expect(run('Promise === originalPromise')).toBe(false);
    expect(
      run(
        `Object.keys(cache).some((filename) => filename.endsWith('/promise/setimmediate/es6-extensions.js'))`,
      ),
    ).toBe(true);
    expect(run('typeof Promise.withResolvers')).toBe('function');
    expect(run('JSON.stringify(events)')).toBe(
      JSON.stringify(['warning', 'app']),
    );
  },
);

test('observer changes do not re-register native hooks or accept unsupported filters', () => {
  const run = createRuntime();
  run(`trackerModule.setNativePromiseRejectionTrackingOptions({allRejections: true, onUnhandled(){events.push('old-sdk')}});
    trackerModule.setNativePromiseRejectionTrackingOptions({allRejections: true, onUnhandled(){events.push('new-sdk')}, onHandled(){events.push('handled')}});
    tracking.onUnhandled(7, new Error('fixture')); tracking.onHandled(7);
  `);
  expect(run('JSON.stringify(events)')).toBe(
    JSON.stringify(['install-tracker', 'new-sdk', 'handled']),
  );
  for (const options of [
    '{allRejections:false}',
    '{allRejections:true,whitelist:[]}',
    '{allRejections:true,onUnhandled:1}',
  ]) {
    expect(() =>
      run(
        `trackerModule.setNativePromiseRejectionTrackingOptions(${options});`,
      ),
    ).toThrow('Unsupported');
  }
});

test.each([
  { value: '1n', sdkFirst: true },
  { value: '1n', sdkFirst: false },
  {
    value: 'Object.assign({}, { get self(){ return this; } })',
    sdkFirst: true,
  },
  {
    value: 'Object.assign({}, { get self(){ return this; } })',
    sdkFirst: false,
  },
])(
  'non-Error rejection survives the real formatter and observer order: %j',
  ({ value, sdkFirst }) => {
    const run = createRuntime();
    run(`
    globalThis.rejection = ${value};
    if (typeof rejection === 'object') rejection.self = rejection;
    globalThis.delivered = [];
    const installSdk = () => trackerModule.setNativePromiseRejectionTrackingOptions({allRejections:true, onUnhandled(id, error){ events.push('sdk'); delivered.push(error); }});
    const installApp = () => tracker.setErrorTracker((error) => { events.push('app'); delivered.push(error); });
    ${sdkFirst ? 'installSdk(); installApp();' : 'installApp(); installSdk();'}
    tracking.onUnhandled(1, rejection);
  `);
    expect(run('JSON.stringify(events)')).toBe(
      JSON.stringify(['install-tracker', 'sdk', 'warning', 'app']),
    );
    expect(
      run(
        'delivered.length === 2 && delivered.every((error) => error === rejection)',
      ),
    ).toBe(true);
  },
);

test('formatter failure uses a fixed message without retrying arbitrary serialization', () => {
  const run = createRuntime();
  run(`
    globalThis.rejection = { toJSON(){ throw new Error('private fixture payload'); } };
    globalThis.warning = '';
    console.warn = (message) => { warning = message; };
    tracker.setErrorTracker((error) => { globalThis.delivered = error; });
    tracking.onUnhandled(1, rejection);
  `);
  expect(run('warning')).toContain('[Unable to format promise rejection]');
  expect(run('warning')).not.toContain('private fixture payload');
  expect(run('delivered === rejection')).toBe(true);
});

test('console failure does not stop SDK and application rejection delivery', () => {
  const run = createRuntime();
  run(`
    globalThis.rejection = 1n;
    globalThis.delivered = [];
    trackerModule.setNativePromiseRejectionTrackingOptions({allRejections:true, onUnhandled(id, error){ delivered.push(error); }});
    tracker.setErrorTracker((error) => { delivered.push(error); });
    console.warn = () => { throw new Error('console fixture'); };
  `);
  expect(() => run('tracking.onUnhandled(1, rejection);')).toThrow(
    'console fixture',
  );
  expect(
    run(
      'delivered.length === 2 && delivered.every((error) => error === rejection)',
    ),
  ).toBe(true);
});
