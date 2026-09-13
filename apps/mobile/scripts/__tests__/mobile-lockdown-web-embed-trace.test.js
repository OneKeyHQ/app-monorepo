const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const babel = require('@babel/core');

const { mobileLockdownE2EGate } = require('../../plugins/mobileLockdown');

const mockReport = jest.fn();
jest.mock('../../src/security/mobileLockdownReleaseCheck', () => ({
  writeMobileLockdownE2EReport: mockReport,
}));
const runId = 'a'.repeat(32);
const traceType = 'ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE';
const initialEnv = { ...process.env };
const initialDev = globalThis.__DEV__;
let trace;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  mockReport.mockReset();
  globalThis.__DEV__ = false;
  process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = runId;
  process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER = 'true';
  trace =
    require('../../src/security/mobileLockdownWebEmbedReleaseCheck').traceMobileLockdownWebEmbedBridge;
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  globalThis.__DEV__ = initialDev;
  for (const name of [
    'ONEKEY_MOBILE_LOCKDOWN_E2E',
    'ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER',
  ]) {
    if (initialEnv[name] === undefined) delete process.env[name];
    else process.env[name] = initialEnv[name];
  }
});
function reports() {
  return mockReport.mock.calls.map(([line]) =>
    JSON.parse(line.replace(/^\[[^\]]+\] /, '')),
  );
}
function bridgeData() {
  return { module: 'test', method: 'test1', params: [runId] };
}
function fixture() {
  const page = new EventEmitter();
  page.sendPayload = jest.fn(function (payload) {
    return payload;
  });
  const originalPageSend = page.sendPayload;
  const windowEvents = new EventEmitter();
  const documentEvents = new EventEmitter();
  const originalReceive = jest.fn(function (payload) {
    return payload;
  });
  const prototype = { receive: originalReceive };
  const host = Object.create(prototype);
  host.remoteInfo = { origin: 'onekey-web-embed://bundle' };
  host.globalOnMessageEnabled = true;
  let currentBridge = host;
  const mutation = {
    observe: jest.fn(),
    disconnect: jest.fn(),
    callback: undefined,
  };
  const context = vm.createContext({ setTimeout, clearTimeout });
  const window = {
    $onekey: { jsBridge: page },
    location: { href: 'onekey-web-embed://bundle/index.html#/webembed/api' },
    ReactNativeWebView: {
      postMessage: jest.fn((payload) =>
        host.receive(payload, { origin: host.remoteInfo.origin }),
      ),
    },
    addEventListener: (name, listener) => windowEvents.on(name, listener),
    removeEventListener: (name, listener) =>
      windowEvents.removeListener(name, listener),
  };
  Object.assign(context, {
    window,
    document: {
      documentElement: {},
      addEventListener: (name, listener) => documentEvents.on(name, listener),
      removeEventListener: (name, listener) =>
        documentEvents.removeListener(name, listener),
    },
    MutationObserver: class {
      constructor(callback) {
        mutation.callback = callback;
      }
      observe(...args) {
        mutation.observe(...args);
      }
      disconnect() {
        mutation.disconnect();
      }
    },
  });
  const view = {
    injectJavaScript: jest.fn((script) => vm.runInContext(script, context)),
  };
  host.webviewRef = { current: view };
  const snapshot = () => ({
    bridge: currentBridge,
    generation: 0,
    ready: true,
    platform: 'ios',
  });
  const start = (data = bridgeData()) =>
    trace({ runtime: 'main', callId: '1', stage: 'received', data, snapshot });
  return {
    start,
    host,
    view,
    page,
    originalPageSend,
    originalReceive,
    prototype,
    context,
    window,
    windowEvents,
    documentEvents,
    mutation,
    replaceBridge(value) {
      currentBridge = value;
    },
  };
}

// Use the actual Babel guard on both real bridge modules. The expected output
// matches their source with these complete IfStatements removed independently.
test.each([
  '../../src/backgroundThread/setupMainThreadBackgroundRunner.ts',
  '../../src/backgroundThread/setupBackgroundThreadRPCHandler.ts',
])(
  'normal Metro transformation removes all trace imports and stages: %s',
  (relative) => {
    const filename = path.resolve(__dirname, relative);
    const source = fs.readFileSync(filename, 'utf8');
    const transform = (plugins) =>
      babel.transformSync(source, {
        filename,
        babelrc: false,
        configFile: false,
        plugins: [...plugins, '@babel/plugin-transform-typescript'],
      }).code;
    const without = transform([[mobileLockdownE2EGate, { runId: '' }]]);
    expect(without).not.toMatch(
      /traceMobileLockdownWebEmbedBridge|mobileLockdownWebEmbedReleaseCheck|request-sending|response-writing|rpc-timeout/,
    );
    const enabled = transform([[mobileLockdownE2EGate, { runId }]]);
    expect(enabled).toContain('traceMobileLockdownWebEmbedBridge');
    expect(enabled).toContain('mobileLockdownWebEmbedReleaseCheck');
    const independentlyRemoved = transform([
      () => ({
        visitor: {
          IfStatement(node) {
            if (
              node
                .get('test')
                .matchesPattern('process.env.ONEKEY_MOBILE_LOCKDOWN_E2E')
            )
              node.remove();
          },
        },
      }),
    ]);
    expect(without).toBe(independentlyRemoved);
  },
);

test('passes original receiver, arguments, return identity and synchronous exceptions through main receive', () => {
  const f = fixture();
  f.start();
  const receiver = {};
  const promise = Promise.resolve('return sentinel');
  f.originalReceive.mockReturnValueOnce(promise);
  const args = [
    'unrelated private fixture',
    { origin: 'https://unrelated.invalid' },
    'extra sentinel',
  ];
  expect(Reflect.apply(f.host.receive, receiver, args)).toBe(promise);
  expect(f.originalReceive.mock.contexts.at(-1)).toBe(receiver);
  expect(f.originalReceive.mock.calls.at(-1)).toEqual(args);
  const error = new Error('private original error');
  f.originalReceive.mockImplementationOnce(() => {
    throw error;
  });
  expect(() => f.host.receive('other message')).toThrow(error);
  expect(mockReport.mock.calls.flat().join(' ')).not.toMatch(
    /private|unrelated|extra sentinel/,
  );
  expect(Object.getPrototypeOf(f.host)).toBe(f.prototype);
});

test.each([
  'bad-json',
  'wrong-nonce',
  'unknown-stage',
  'extra-field',
  'wrong-origin',
  'wrong-receiver',
  'unmatched-operation',
])(
  'keeps %s diagnostic payload on the original authenticated receive path',
  (mode) => {
    const f = fixture();
    f.start();
    const message = {
      type: traceType,
      runId,
      stage: 'expected',
      operation: 'bridge',
      round: 0,
      elapsedMs: 1,
    };
    if (mode === 'wrong-nonce') message.runId = 'b'.repeat(32);
    if (mode === 'unknown-stage') message.stage = 'private unknown fixture';
    if (mode === 'extra-field') message.privatePayload = 'private fixture';
    if (mode === 'unmatched-operation') {
      message.operation = 'reveal';
      message.round = 2;
    }
    const value = mode === 'bad-json' ? '{' : JSON.stringify(message);
    const sender = {
      origin:
        mode === 'wrong-origin'
          ? 'https://evil.invalid'
          : f.host.remoteInfo.origin,
    };
    const receiver = mode === 'wrong-receiver' ? {} : f.host;
    const before = f.originalReceive.mock.calls.length;
    Reflect.apply(f.host.receive, receiver, [value, sender]);
    expect(f.originalReceive.mock.calls.length).toBe(before + 1);
    expect(f.originalReceive.mock.calls.at(-1)).toEqual([value, sender]);
    expect(mockReport.mock.calls.flat().join(' ')).not.toContain(
      'private fixture',
    );
  },
);

test('passively receives the real request event and preserves the page send method contract', () => {
  const f = fixture();
  f.start();
  const request = {
    type: 'REQUEST',
    id: 17,
    scope: '$private',
    data: bridgeData(),
  };
  f.page.emit('message', request);
  expect(
    reports().some(
      (r) => r.runtime === 'webview' && r.stage === 'request-received',
    ),
  ).toBe(true);
  const response = JSON.stringify({
    type: 'RESPONSE',
    id: 17,
    data: 'private reply fixture',
  });
  const result = Promise.resolve('return identity');
  f.originalPageSend.mockReturnValueOnce(result);
  const receiver = {};
  expect(Reflect.apply(f.page.sendPayload, receiver, [response, 'extra'])).toBe(
    result,
  );
  expect(f.originalPageSend).toHaveBeenCalledTimes(1);
  expect(f.originalPageSend.mock.contexts[0]).toBe(receiver);
  expect(f.originalPageSend.mock.calls[0]).toEqual([response, 'extra']);
  expect(reports().some((r) => r.stage === 'reply-sent')).toBe(true);
  const failure = new Error('private send failure');
  f.originalPageSend.mockImplementationOnce(() => {
    throw failure;
  });
  f.window.__ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE__.expect(
    bridgeData(),
    'bridge',
    0,
  );
  f.page.emit('message', { ...request, id: 18 });
  expect(() =>
    f.page.sendPayload(JSON.stringify({ type: 'RESPONSE', id: 18 })),
  ).toThrow(failure);
  expect(f.originalPageSend).toHaveBeenCalledTimes(2);
  expect(reports().some((r) => r.stage === 'reply-throw')).toBe(true);
  expect(mockReport.mock.calls.flat().join(' ')).not.toMatch(
    /private reply|private send|return identity/,
  );
});

test('observes only exact same-origin lazy assets without recording their URL or event errors', () => {
  const f = fixture();
  f.start();
  const script = {
    tagName: 'SCRIPT',
    src: 'onekey-web-embed://bundle/static/js/693.462a08abb5.chunk.js',
  };
  f.mutation.callback([{ addedNodes: [script] }]);
  f.documentEvents.emit('load', { target: script });
  f.windowEvents.emit('error', {
    target: script,
    error: new Error('private resource fixture'),
  });
  f.documentEvents.emit('load', {
    target: {
      ...script,
      src: 'https://evil.invalid/static/js/693.462a08abb5.chunk.js',
    },
  });
  f.documentEvents.emit('load', {
    target: { ...script, src: `${script.src}?private` },
  });
  const entries = reports().filter((r) => r.asset);
  expect(entries.map((r) => r.stage)).toEqual([
    'script-discovered',
    'script-loaded',
    'script-error',
  ]);
  expect(entries.every((r) => r.asset === 'kaspa-sdk')).toBe(true);
  expect(mockReport.mock.calls.flat().join(' ')).not.toMatch(
    /462a08abb5|evil|resource fixture/,
  );
});

test.each([
  'frozen-host',
  'frozen-page',
  'non-writable-host',
  'missing-view',
  'base-bridge',
  'null-bridge',
])(
  '%s records observer-unavailable without changing protected or unsupported objects',
  (mode) => {
    const f = fixture();
    if (mode === 'frozen-host') Object.freeze(f.host);
    if (mode === 'frozen-page') Object.freeze(f.page);
    if (mode === 'non-writable-host')
      Object.defineProperty(f.host, 'receive', {
        value: f.originalReceive,
        writable: false,
      });
    if (mode === 'missing-view') f.host.webviewRef.current = null;
    if (mode === 'base-bridge') delete f.host.webviewRef;
    if (mode === 'null-bridge') f.replaceBridge(null);
    expect(() => f.start()).not.toThrow();
    expect(reports().some((r) => r.stage === 'observer-unavailable')).toBe(
      true,
    );
    if (mode !== 'frozen-page') expect(f.host.receive).toBe(f.originalReceive);
  },
);

test('cleans only its own instance methods, listeners and observer at 60 seconds', async () => {
  const f = fixture();
  f.start();
  const ownListener = jest.fn();
  f.page.on('message', ownListener);
  await jest.advanceTimersByTimeAsync(59_999);
  expect(f.host.receive).not.toBe(f.originalReceive);
  await jest.advanceTimersByTimeAsync(1);
  expect(f.host.receive).toBe(f.originalReceive);
  expect(Object.hasOwn(f.host, 'receive')).toBe(false);
  expect(f.page.sendPayload).toBe(f.originalPageSend);
  expect(f.page.listeners('message')).toEqual([ownListener]);
  expect(f.mutation.disconnect).toHaveBeenCalledTimes(1);
  expect(f.window.__ONEKEY_MOBILE_LOCKDOWN_BRIDGE_TRACE__).toBeUndefined();
});

test('does not overwrite replacement methods or inject cleanup into a replaced native view', async () => {
  const f = fixture();
  f.start();
  const newReceive = jest.fn();
  const newSend = jest.fn();
  f.host.receive = newReceive;
  f.page.sendPayload = newSend;
  const newView = { injectJavaScript: jest.fn() };
  f.host.webviewRef.current = newView;
  await jest.advanceTimersByTimeAsync(60_000);
  expect(f.host.receive).toBe(newReceive);
  expect(f.page.sendPayload).toBe(newSend);
  expect(newView.injectJavaScript).not.toHaveBeenCalled();
  expect(f.page.listenerCount('message')).toBe(0);
});

test('does not inject into or consume trace envelopes from a replaced view on the same bridge', () => {
  const f = fixture();
  f.start();
  const newView = { injectJavaScript: jest.fn() };
  f.host.webviewRef.current = newView;
  const envelope = JSON.stringify({
    type: traceType,
    runId,
    stage: 'expected',
    operation: 'bridge',
    round: 0,
    elapsedMs: 1,
  });
  const sender = { origin: f.host.remoteInfo.origin };
  const before = reports().length;
  expect(f.host.receive(envelope, sender)).toBe(envelope);
  expect(f.originalReceive).toHaveBeenLastCalledWith(envelope, sender);
  expect(reports()).toHaveLength(before);
  trace({
    runtime: 'main',
    callId: '2',
    stage: 'received',
    data: { module: 'test', method: 'getRuntimeSecurityState', params: [] },
  });
  expect(newView.injectJavaScript).not.toHaveBeenCalled();
  expect(reports().at(-1)).toMatchObject({
    stage: 'received',
    bridgeSame: true,
    webViewSame: false,
  });
});

test.each([
  'missing-nonce',
  'wrong-nonce',
  'development',
  'normal-assets',
  'wallet-request',
])('does not observe %s or serialize its input', (mode) => {
  const f = fixture();
  if (mode === 'missing-nonce') delete process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
  if (mode === 'wrong-nonce')
    process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = 'invalid';
  if (mode === 'development') globalThis.__DEV__ = true;
  if (mode === 'normal-assets')
    delete process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER;
  const data =
    mode === 'wallet-request'
      ? {
          module: 'secret',
          method: 'decryptAsync',
          params: ['private wallet fixture'],
        }
      : bridgeData();
  f.start(data);
  expect(mockReport).not.toHaveBeenCalled();
  expect(f.view.injectJavaScript).not.toHaveBeenCalled();
  expect(f.host.receive).toBe(f.originalReceive);
});

function publicSequence() {
  const accountAddress =
    'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9';
  const commit = {
    commitAddress: 'kaspa:fixture',
    commitScriptHex: 'abcd',
    commitScriptPubKey: 'ab',
  };
  const raw = JSON.stringify({
    id: 'f'.repeat(64),
    version: 0,
    inputs: [
      {
        transactionId: 'ab'.repeat(32),
        index: 0,
        sequence: '0',
        sigOpCount: 1,
        signatureScript: '',
        utxo: {
          address: null,
          amount: '130000000',
          scriptPublicKey: '0000ab',
          blockDaaScore: '123456',
          isCoinbase: false,
        },
      },
    ],
    outputs: [{ value: '129999000', scriptPublicKey: '0000abcd' }],
    mass: '1234',
    lockTime: '0',
    subnetworkId: '0'.repeat(40),
    gas: '0',
    payload: '',
  });
  const round = [
    [
      {
        module: 'chainKaspa',
        method: 'buildCommitTxInfo',
        params: [
          {
            accountAddress,
            transferDataString:
              '{"p":"krc-20","op":"transfer","tick":"FIXTURE","amt":"1","to":"public-fixture"}',
            isTestnet: false,
          },
        ],
      },
      commit,
    ],
    [
      {
        module: 'chainKaspa',
        method: 'createKRC20RevealTxJSON',
        params: [
          {
            accountAddress,
            isTestnet: false,
            encodedTx: {
              utxoIds: [],
              inputs: [
                {
                  address: commit.commitAddress,
                  txid: 'ab'.repeat(32),
                  scriptPubKey: 'ab',
                  blockDaaScore: 123_456,
                  vout: 0,
                  satoshis: '130000000',
                  scriptPublicKeyVersion: 0,
                },
              ],
              outputs: [],
              mass: 0,
              hasMaxSend: false,
              changeAddress: accountAddress,
              feeInfo: { price: '1', limit: '0' },
            },
          },
        ],
      },
      raw,
    ],
    [
      {
        module: 'chainKaspa',
        method: 'deserializeFromSafeJSON',
        params: [raw],
      },
      {},
    ],
  ];
  return [
    [bridgeData(), `${runId}: onekey-web-embed://bundle/index.html`],
    [{ module: 'test', method: 'getRuntimeSecurityState', params: [] }, {}],
    ...round,
    ...round,
  ];
}

test('matches every complete public request and result association across both rounds without logging them', () => {
  const sequence = publicSequence();
  sequence.forEach(([data, result], index) => {
    const callId = String(index + 1);
    trace({ runtime: 'background', callId, stage: 'sending', data });
    trace({ runtime: 'background', callId, stage: 'sent' });
    trace({
      runtime: 'background',
      callId,
      stage: 'response-received',
      result,
    });
    trace({ runtime: 'background', callId, stage: 'resolving' });
  });
  expect(
    reports()
      .filter((r) => r.stage === 'sending')
      .map((r) => [r.operation, r.round]),
  ).toEqual([
    ['bridge', 0],
    ['intrinsics', 0],
    ['commit', 1],
    ['reveal', 1],
    ['deserialize', 1],
    ['commit', 2],
    ['reveal', 2],
    ['deserialize', 2],
  ]);
  expect(reports()).toHaveLength(32);
  expect(mockReport.mock.calls.flat().join(' ')).not.toMatch(
    /signatureScript|kaspa:|130000000|public-fixture/,
  );
});

test.each([
  'address',
  'amount',
  'signature',
  'array-hole',
  'getter',
  'hidden-toJSON',
  'inherited-toJSON',
])(
  'does not register a %s mutation of a public request with the WK observer',
  (mode) => {
    const f = fixture();
    const sequence = publicSequence();
    f.start();
    trace({
      runtime: 'main',
      callId: '1',
      stage: 'request-returned',
      result: sequence[0][1],
    });
    const getter = jest.fn(() => 'private fixture');
    let index = 1;
    if (mode !== 'array-hole') {
      let targetIndex = 2;
      if (mode === 'signature') targetIndex = 4;
      else if (mode === 'amount') targetIndex = 3;
      for (; index < targetIndex; index += 1) {
        trace({
          runtime: 'main',
          callId: String(index + 1),
          stage: 'received',
          data: sequence[index][0],
        });
        trace({
          runtime: 'main',
          callId: String(index + 1),
          stage: 'request-returned',
          result: sequence[index][1],
        });
      }
    }
    const data = sequence[index][0];
    if (mode === 'address')
      data.params[0].accountAddress = 'private wallet fixture';
    if (mode === 'amount')
      data.params[0].encodedTx.inputs[0].satoshis = '130000001';
    if (mode === 'signature')
      data.params[0] = data.params[0].replace(
        '"signatureScript":""',
        '"signatureScript":"private"',
      );
    if (mode === 'array-hole') data.params = Array(1);
    if (mode === 'getter')
      Object.defineProperty(data.params[0], 'accountAddress', { get: getter });
    if (mode === 'hidden-toJSON')
      Object.defineProperty(data, 'toJSON', { value: getter });
    if (mode === 'inherited-toJSON')
      Object.setPrototypeOf(data, { toJSON: getter });
    const before = f.view.injectJavaScript.mock.calls.length;
    trace({
      runtime: 'main',
      callId: String(index + 1),
      stage: 'received',
      data,
    });
    expect(f.view.injectJavaScript.mock.calls.length).toBe(before);
    expect(getter).not.toHaveBeenCalled();
    expect(mockReport.mock.calls.flat().join(' ')).not.toContain('private');
  },
);
