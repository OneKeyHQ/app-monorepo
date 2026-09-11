const { EventEmitter } = require('events');

const mockReport = jest.fn();
const mockBridge = jest.fn();
const mockSecurityState = jest.fn();
const mockKaspaCommit = jest.fn();
const mockKaspaReveal = jest.fn();
const mockKaspaDeserialize = jest.fn();
let mockBus;

jest.mock('../../src/security/mobileLockdownReleaseCheck', () => ({
  writeMobileLockdownE2EReport: mockReport,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: mockBus,
  EAppEventBusNames: { LoadWebEmbedWebView: 'LoadWebEmbedWebView' },
}));
jest.mock('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy', () => ({
  default: {
    test: { test1: mockBridge, getRuntimeSecurityState: mockSecurityState },
    chainKaspa: {
      buildCommitTxInfo: mockKaspaCommit,
      createKRC20RevealTxJSON: mockKaspaReveal,
      deserializeFromSafeJSON: mockKaspaDeserialize,
    },
  },
  __esModule: true,
}));

const runId = 'a'.repeat(32);
const previousRunId = process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
const previousAssetLoader = process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER;
const previousDev = globalThis.__DEV__;

function publicTransaction() {
  return {
    version: 0,
    inputs: [
      {
        previousOutpoint: { transactionId: 'ab'.repeat(32), index: 0 },
        signatureScript: '',
        sequence: '0',
        sigOpCount: 1,
      },
    ],
    outputs: [
      {
        amount: '129999000',
        scriptPublicKey: { version: 0, scriptPublicKey: 'abcd' },
      },
    ],
    mass: '1234',
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0',
    payload: '',
  };
}

function publicRawReveal() {
  return {
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
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0',
    payload: '',
  };
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  mockBus = new EventEmitter();
  mockReport.mockReset();
  mockBridge.mockReset();
  mockSecurityState.mockReset().mockResolvedValue({
    hardenType: 'function',
    objectFrozen: true,
    arrayFrozen: true,
    functionFrozen: true,
    promiseFrozen: true,
  });
  mockKaspaCommit.mockReset().mockResolvedValue({
    commitAddress: 'kaspa:fixture',
    commitScriptHex: 'abcd',
    commitScriptPubKey: 'ab',
  });
  mockKaspaReveal
    .mockReset()
    .mockImplementation(async () => JSON.stringify(publicRawReveal()));
  mockKaspaDeserialize
    .mockReset()
    .mockImplementation(async () => publicTransaction());
  process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = runId;
  delete process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER;
  globalThis.__DEV__ = false;
});

afterEach(() => {
  jest.useRealTimers();
  globalThis.__DEV__ = previousDev;
  for (const [key, value] of [
    ['ONEKEY_MOBILE_LOCKDOWN_E2E', previousRunId],
    ['ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER', previousAssetLoader],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function startMount() {
  return require('../../src/security/mobileLockdownWebEmbedReleaseCheck').requestMobileLockdownWebEmbedMount();
}

function report() {
  expect(mockReport).toHaveBeenCalledTimes(1);
  return JSON.parse(mockReport.mock.calls[0][0].replace(/^\[[^\]]+\] /, ''));
}

test('delivers a mount request only after the delayed UI provider subscribes', async () => {
  const emit = jest.spyOn(mockBus, 'emit');
  const mount = jest.fn();
  const check = startMount();
  await jest.advanceTimersByTimeAsync(1600);
  expect(emit).not.toHaveBeenCalled();
  mockBus.on('LoadWebEmbedWebView', mount);
  await jest.advanceTimersByTimeAsync(50);
  await check;
  expect(mount).toHaveBeenCalledTimes(1);
  expect(report()).toEqual({
    runId,
    runtime: 'main',
    status: 'requested',
    providerReady: true,
  });
  expect(jest.getTimerCount()).toBe(0);
});

test('an already mounted provider does not wait for a fixed startup delay', async () => {
  const mount = jest.fn();
  mockBus.on('LoadWebEmbedWebView', mount);
  const check = startMount();
  await jest.advanceTimersByTimeAsync(0);
  await check;
  expect(mount).toHaveBeenCalledTimes(1);
  expect(report().status).toBe('requested');
  expect(jest.getTimerCount()).toBe(0);
});

test('a missing provider fails within the deadline and leaves no timer', async () => {
  const emit = jest.spyOn(mockBus, 'emit');
  const check = startMount();
  await jest.advanceTimersByTimeAsync(15_001);
  await check;
  expect(emit).not.toHaveBeenCalled();
  expect(report()).toEqual({
    runId,
    runtime: 'main',
    status: 'failed',
    providerReady: false,
  });
  expect(mockReport.mock.calls[0][1]).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('a throwing provider cannot produce a successful request or leak its payload', async () => {
  mockBus.on('LoadWebEmbedWebView', () => {
    // eslint-disable-next-line onekey/no-raw-error -- simulate a provider failure without leaking its payload
    throw new Error('private fixture payload');
  });
  const check = startMount();
  await jest.advanceTimersByTimeAsync(0);
  await check;
  expect(report().status).toBe('failed');
  expect(mockReport.mock.calls[0][0]).not.toContain('private fixture payload');
});

test.each(['missing-run', 'invalid-run', 'development'])(
  'rejects a non-Release invocation: %s',
  async (mode) => {
    if (mode === 'missing-run') delete process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
    if (mode === 'invalid-run')
      process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = 'invalid';
    if (mode === 'development') globalThis.__DEV__ = true;
    await expect(startMount()).rejects.toThrow('explicit Release test build');
    expect(mockReport).not.toHaveBeenCalled();
  },
);

test.each([
  [
    'https://appassets.androidplatform.net/web-embed/index.html#fixture',
    true,
    'bundled-https',
  ],
  [
    'https://appassets.androidplatform.net/web-embed/index.html',
    false,
    undefined,
  ],
  [
    'https://appassets.androidplatform.net.evil.invalid/web-embed/index.html',
    true,
    undefined,
  ],
  [
    'http://appassets.androidplatform.net/web-embed/index.html',
    true,
    undefined,
  ],
  [
    'https://appassets.androidplatform.net:444/web-embed/index.html',
    true,
    undefined,
  ],
  [
    'https://user@appassets.androidplatform.net/web-embed/index.html',
    true,
    undefined,
  ],
  [
    'https://appassets.androidplatform.net/web-embed/other.html',
    true,
    undefined,
  ],
  [
    'https://appassets.androidplatform.net/web-embed/index.html?remote=1',
    true,
    undefined,
  ],
  ['file:///isolated-fixture/web-embed/index.html', false, 'file'],
  ['file:///isolated-fixture/web-embed/index.html', true, undefined],
  [
    'onekey-web-embed://bundle/index.html#/webembed/api',
    true,
    'bundled-scheme',
  ],
  ['onekey-web-embed://bundle/index.html', false, undefined],
  ...[
    'onekey-web-embed://bundle/index.html?remote=1',
    'onekey-web-embed://user@bundle/index.html',
    'onekey-web-embed://bundle:0/index.html',
    'onekey-web-embed://bundle./index.html',
    'onekey-web-embed://bundle/../index.html',
    'onekey-web-embed://bundle/%69ndex.html',
    'onekey-web-embed://bundle.evil.invalid/index.html',
    'onekey-web-embed://bundle/other.html',
    'onekey-web-embed://bundle/index.html/',
    'onekey-web-embed://bundle/index.html?',
    'ONEKEY-WEB-EMBED://bundle/index.html',
  ].map((url) => [url, true, undefined]),
])(
  'accepts only the enabled packaged origin or existing file source: %s',
  async (url, enabled, source) => {
    if (enabled) process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER = 'true';
    mockBridge.mockResolvedValue(`${runId}: ${url}`);
    await require('../../src/security/mobileLockdownWebEmbedReleaseCheck').runMobileLockdownWebEmbedReleaseCheck();
    expect(report()).toMatchObject({
      status: source ? 'passed' : 'failed',
      ...(source ? { bridgeSource: source } : { stage: 'origin' }),
    });
    expect(mockSecurityState).toHaveBeenCalledTimes(source ? 1 : 0);
    expect(mockReport.mock.calls[0][0]).not.toContain(url);
  },
);

test('the iOS JS bridge requires both original document URLs and never maps an opaque origin', () => {
  const {
    getIOSWebEmbedMessageOrigin,
    IOS_WEB_EMBED_DOCUMENT_URL,
    IOS_WEB_EMBED_ORIGIN,
  } = require('@onekeyhq/shared/src/consts/webEmbedConsts');
  const valid = IOS_WEB_EMBED_DOCUMENT_URL;
  for (const invalid of [
    undefined,
    '',
    'null',
    'file:///index.html',
    `${valid}?`,
    `${valid}/`,
    `${valid}\n`,
    'onekey-web-embed://bundle:0/index.html',
    'onekey-web-embed://user@bundle/index.html',
    'onekey-web-embed://bundle/./index.html',
    'onekey-web-embed://bundle/%2e%2e/index.html',
    'onekey-web-embed://bundle/%69ndex.html',
  ]) {
    expect(
      getIOSWebEmbedMessageOrigin({ sourceUrl: valid, messageUrl: invalid }),
    ).toBeUndefined();
    expect(
      getIOSWebEmbedMessageOrigin({ sourceUrl: invalid, messageUrl: valid }),
    ).toBeUndefined();
  }
  expect(
    getIOSWebEmbedMessageOrigin({
      sourceUrl: valid,
      messageUrl: `${valid}#/webembed/api?test=1`,
    }),
  ).toBe(IOS_WEB_EMBED_ORIGIN);
});

test('private WebEmbed origin permissions are candidate- and platform-scoped', () => {
  const platformPath = '@onekeyhq/shared/src/platformEnv';
  const previous = process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER;
  try {
    for (const platform of ['ios', 'android', 'web']) {
      for (const enabled of [false, true]) {
        if (enabled) process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER = 'true';
        else delete process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER;
        jest.isolateModules(() => {
          jest.doMock(platformPath, () => ({
            __esModule: true,
            default: {
              isNativeIOS: platform === 'ios',
              isNativeAndroid: platform === 'android',
              isDev: false,
            },
          }));
          const permissions = require('@onekeyhq/kit-bg/src/apis/backgroundApiPermissions');
          for (const method of [
            'isWebEmbedApiAllowedOrigin',
            'isProviderApiPrivateAllowedOrigin',
          ]) {
            expect(permissions[method]('onekey-web-embed://bundle')).toBe(
              enabled && platform === 'ios',
            );
            expect(
              permissions[method]('https://appassets.androidplatform.net'),
            ).toBe(enabled && platform === 'android');
            for (const origin of [
              'onekey-web-embed://bundle/',
              'onekey-web-embed://bundle:0',
              'onekey-web-embed://bundle.evil.invalid',
              'onekey-web-embed://user@bundle',
              'onekey-web-embed://bundle/index.html',
            ]) {
              expect(permissions[method](origin)).toBe(false);
            }
            // Existing OTA file handling is independent of the packaged loader.
            expect(permissions[method]('null')).toBe(true);
            expect(permissions[method]('file://')).toBe(true);
          }
        });
      }
    }
  } finally {
    jest.dontMock(platformPath);
    if (previous === undefined)
      delete process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER;
    else process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER = previous;
  }
});

function startProtectedBackgroundCheck() {
  process.env.ONEKEY_MOBILE_WEB_EMBED_ASSET_LOADER = 'true';
  mockBridge.mockResolvedValue(
    `${runId}: onekey-web-embed://bundle/index.html#/webembed/api`,
  );
  return require('../../src/security/mobileLockdownWebEmbedReleaseCheck').runMobileLockdownWebEmbedReleaseCheck();
}

test('performs two sequential unsigned Kaspa operations through the existing API and reports only results', async () => {
  await startProtectedBackgroundCheck();
  expect(report()).toEqual({
    runId,
    runtime: 'background',
    status: 'passed',
    fileBridge: false,
    bridgeSource: 'bundled-scheme',
    intrinsics: true,
    kaspaUnsigned: true,
    kaspaRuns: 2,
  });
  expect(mockKaspaCommit).toHaveBeenCalledTimes(2);
  expect(mockKaspaReveal).toHaveBeenCalledTimes(2);
  expect(mockKaspaDeserialize).toHaveBeenCalledTimes(2);
  const order = [
    mockKaspaCommit.mock.invocationCallOrder[0],
    mockKaspaReveal.mock.invocationCallOrder[0],
    mockKaspaDeserialize.mock.invocationCallOrder[0],
    mockKaspaCommit.mock.invocationCallOrder[1],
    mockKaspaReveal.mock.invocationCallOrder[1],
    mockKaspaDeserialize.mock.invocationCallOrder[1],
  ];
  expect(order).toEqual(order.toSorted((left, right) => left - right));
  const commitInput = mockKaspaCommit.mock.calls[0][0];
  expect(commitInput).toEqual({
    accountAddress:
      'kaspa:qz6ey0j433zey0txecm7e4as4q44jnafqxtclxj5xfl3559lft0p78rdmumy9',
    transferDataString:
      '{"p":"krc-20","op":"transfer","tick":"FIXTURE","amt":"1","to":"public-fixture"}',
    isTestnet: false,
  });
  expect(mockKaspaReveal.mock.calls[0][0]).toMatchObject({
    accountAddress: commitInput.accountAddress,
    isTestnet: false,
    encodedTx: {
      inputs: [
        {
          address: 'kaspa:fixture',
          txid: 'ab'.repeat(32),
          scriptPubKey: 'ab',
          blockDaaScore: 123_456,
          satoshis: '130000000',
          vout: 0,
        },
      ],
      outputs: [],
      changeAddress: commitInput.accountAddress,
      feeInfo: { price: '1' },
    },
  });
  expect(mockKaspaCommit.mock.calls[1]).toEqual(mockKaspaCommit.mock.calls[0]);
  expect(mockKaspaReveal.mock.calls[1]).toEqual(mockKaspaReveal.mock.calls[0]);
  expect(mockReport.mock.calls[0][0]).not.toMatch(
    /kaspa:|signatureScript|public unsigned fixture/,
  );
  expect(jest.getTimerCount()).toBe(0);
});

test('does not invoke transaction APIs when the independent intrinsic check fails', async () => {
  mockSecurityState.mockResolvedValue({ hardenType: 'undefined' });
  await startProtectedBackgroundCheck();
  expect(report()).toMatchObject({
    status: 'failed',
    stage: 'intrinsics',
    intrinsics: false,
    kaspaUnsigned: false,
    kaspaRuns: 0,
  });
  expect(mockKaspaCommit).not.toHaveBeenCalled();
});

test.each([
  null,
  {
    commitAddress: 'kaspa:fixture',
    commitScriptHex: 'ab',
    commitScriptPubKey: 'xx',
  },
  {
    commitAddress: 'not-kaspa',
    commitScriptHex: 'ab',
    commitScriptPubKey: 'ab',
  },
  {
    commitAddress: 'kaspa:fixture',
    commitScriptHex: 'ab',
    commitScriptPubKey: 'ab',
    extra: true,
  },
])(
  'rejects a malformed commit before attempting unsigned generation: %j',
  async (commit) => {
    mockKaspaCommit.mockResolvedValue(commit);
    await startProtectedBackgroundCheck();
    expect(report()).toMatchObject({
      status: 'failed',
      stage: 'kaspa-commit-result',
      failure: 'result-invalid',
      intrinsics: true,
      kaspaUnsigned: false,
      kaspaRuns: 0,
    });
    expect(mockKaspaReveal).not.toHaveBeenCalled();
  },
);

test.each([
  [
    'signature',
    (tx) => {
      tx.inputs[0].signatureScript = 'signature fixture';
    },
  ],
  [
    'outpoint',
    (tx) => {
      tx.inputs[0].previousOutpoint.transactionId = 'cd'.repeat(32);
    },
  ],
  [
    'outpoint-index',
    (tx) => {
      tx.inputs[0].previousOutpoint.index = 1;
    },
  ],
  [
    'extra-input',
    (tx) => {
      tx.inputs.push(tx.inputs[0]);
    },
  ],
  [
    'missing-output',
    (tx) => {
      tx.outputs = [];
    },
  ],
  [
    'dust',
    (tx) => {
      tx.outputs[0].amount = '19999999';
    },
  ],
  [
    'no-fee',
    (tx) => {
      tx.outputs[0].amount = '130000000';
    },
  ],
  [
    'negative-amount',
    (tx) => {
      tx.outputs[0].amount = '-1';
    },
  ],
  [
    'decimal-amount',
    (tx) => {
      tx.outputs[0].amount = '1.5';
    },
  ],
  [
    'lock-time',
    (tx) => {
      tx.lockTime = '1';
    },
  ],
  [
    'gas',
    (tx) => {
      tx.gas = '1';
    },
  ],
  [
    'payload',
    (tx) => {
      tx.payload = 'unexpected fixture';
    },
  ],
  [
    'script',
    (tx) => {
      tx.outputs[0].scriptPublicKey.scriptPublicKey = 'not-hex';
    },
  ],
  [
    'extra-field',
    (tx) => {
      tx.extra = true;
    },
  ],
])(
  'rejects unexpected or signed transaction semantics: %s',
  async (name, mutate) => {
    const transaction = publicTransaction();
    mutate(transaction);
    mockKaspaDeserialize.mockResolvedValue(transaction);
    await startProtectedBackgroundCheck();
    expect(report()).toMatchObject({
      status: 'failed',
      stage: 'kaspa-unsigned',
      intrinsics: true,
      kaspaUnsigned: false,
      kaspaRuns: 0,
    });
    expect(mockKaspaCommit).toHaveBeenCalledTimes(1);
  },
);

test('rejects changed unsigned transaction semantics on the second complete operation', async () => {
  const changed = publicTransaction();
  changed.outputs[0].amount = '129999001';
  const changedRaw = publicRawReveal();
  changedRaw.outputs[0].value = changed.outputs[0].amount;
  mockKaspaReveal
    .mockResolvedValueOnce(JSON.stringify(publicRawReveal()))
    .mockResolvedValueOnce(JSON.stringify(changedRaw));
  mockKaspaDeserialize
    .mockResolvedValueOnce(publicTransaction())
    .mockResolvedValueOnce(changed);
  await startProtectedBackgroundCheck();
  expect(report()).toMatchObject({
    status: 'failed',
    stage: 'kaspa-repeat',
    intrinsics: true,
    kaspaUnsigned: false,
    kaspaRuns: 1,
  });
  expect(mockKaspaDeserialize).toHaveBeenCalledTimes(2);
});

test('a second reveal stall fails at the shared deadline and late completion cannot start another request', async () => {
  let releaseSecond;
  mockKaspaReveal
    .mockResolvedValueOnce(JSON.stringify(publicRawReveal()))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSecond = resolve;
        }),
    );
  const check = startProtectedBackgroundCheck();
  await jest.advanceTimersByTimeAsync(59_999);
  expect(mockKaspaReveal).toHaveBeenCalledTimes(2);
  expect(mockReport).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  await check;
  expect(report()).toMatchObject({
    status: 'failed',
    stage: 'kaspa-reveal-request',
    failure: 'total-deadline',
    elapsedMs: 60_000,
    rpcElapsedMs: 60_000,
    intrinsics: true,
    kaspaUnsigned: false,
    kaspaRuns: 1,
  });
  releaseSecond('late unsigned fixture');
  await jest.advanceTimersByTimeAsync(0);
  expect(mockKaspaDeserialize).toHaveBeenCalledTimes(1);
  expect(mockReport).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('a late bridge reply after the deadline does not start security or transaction requests', async () => {
  let releaseBridge;
  const check = startProtectedBackgroundCheck();
  mockBridge.mockImplementation(
    () =>
      new Promise((resolve) => {
        releaseBridge = resolve;
      }),
  );
  await jest.advanceTimersByTimeAsync(60_000);
  await check;
  releaseBridge(`${runId}: onekey-web-embed://bundle/index.html`);
  await jest.advanceTimersByTimeAsync(0);
  expect(report()).toMatchObject({
    status: 'failed',
    stage: 'bridge-request',
    failure: 'total-deadline',
    elapsedMs: 60_000,
    rpcElapsedMs: 60_000,
    intrinsics: false,
    kaspaUnsigned: false,
    kaspaRuns: 0,
  });
  expect(mockSecurityState).not.toHaveBeenCalled();
  expect(mockKaspaCommit).not.toHaveBeenCalled();
});

test('an SDK rejection preserves the intrinsic result without exposing the error or transaction', async () => {
  // eslint-disable-next-line onekey/no-raw-error -- simulate an SDK rejection without logging its payload
  mockKaspaReveal.mockRejectedValue(new Error('private SDK fixture payload'));
  await startProtectedBackgroundCheck();
  expect(report()).toMatchObject({
    status: 'failed',
    stage: 'kaspa-reveal-request',
    failure: 'request-rejected',
    intrinsics: true,
    kaspaUnsigned: false,
    kaspaRuns: 0,
  });
  expect(mockReport.mock.calls[0][0]).not.toContain(
    'private SDK fixture payload',
  );
  expect(mockKaspaDeserialize).not.toHaveBeenCalled();
});

test.each([
  ['commit', mockKaspaCommit, 'kaspa-commit-request'],
  ['reveal', mockKaspaReveal, 'kaspa-reveal-request'],
  ['deserialize', mockKaspaDeserialize, 'kaspa-deserialize-request'],
])(
  'separates a rejected %s request from result validation',
  async (name, api, stage) => {
    api.mockRejectedValue('private rejected fixture');
    await startProtectedBackgroundCheck();
    expect(report()).toMatchObject({
      status: 'failed',
      stage,
      failure: 'request-rejected',
      intrinsics: true,
      kaspaUnsigned: false,
      kaspaRuns: 0,
      elapsedMs: 0,
      rpcElapsedMs: 0,
    });
    expect(mockReport.mock.calls[0][0]).not.toContain(
      'private rejected fixture',
    );
    expect(jest.getTimerCount()).toBe(0);
  },
);

test('distinguishes the existing 30 second reverse RPC timeout from the total deadline', async () => {
  mockSecurityState.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              hardenType: 'function',
              objectFrozen: true,
              arrayFrozen: true,
              functionFrozen: true,
              promiseFrozen: true,
            }),
          500,
        );
      }),
  );
  mockKaspaCommit.mockImplementationOnce(
    () =>
      new Promise((resolve, reject) => {
        // eslint-disable-next-line onekey/no-raw-error -- reproduce the fixed native bridge timeout
        setTimeout(
          () => reject(new Error('WebEmbed bridge call timeout (30s)')),
          30_000,
        );
      }),
  );
  const check = startProtectedBackgroundCheck();
  await jest.advanceTimersByTimeAsync(30_499);
  expect(mockReport).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  await check;
  expect(report()).toMatchObject({
    status: 'failed',
    stage: 'kaspa-commit-request',
    failure: 'rpc-timeout',
    intrinsics: true,
    kaspaUnsigned: false,
    kaspaRuns: 0,
    elapsedMs: 30_500,
    rpcElapsedMs: 30_000,
  });
  expect(mockKaspaReveal).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test.each([
  ['primitive', () => 'WebEmbed bridge call timeout (30s)', 'request-rejected'],
  [
    'inherited',
    () => Object.create({ message: 'WebEmbed bridge call timeout (30s)' }),
    'request-rejected',
  ],
  [
    'similar message',
    () => ({ message: 'WebEmbed bridge call timeout (30s): private fixture' }),
    'request-rejected',
  ],
  [
    'accessor',
    (getter) => Object.defineProperty({}, 'message', { get: getter }),
    'request-rejected',
  ],
  [
    'throwing descriptor',
    () =>
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            // eslint-disable-next-line onekey/no-raw-error -- verify hostile error inspection cannot leak or replace the report
            throw new Error('private descriptor fixture');
          },
        },
      ),
    'unknown',
  ],
])(
  'classifies a %s rejection without evaluating or exposing arbitrary payloads',
  async (name, makeError, failure) => {
    const getter = jest.fn(() => {
      // eslint-disable-next-line onekey/no-raw-error -- verify the getter is never invoked
      throw new Error('private getter fixture');
    });
    mockKaspaCommit.mockRejectedValue(makeError(getter));
    await startProtectedBackgroundCheck();
    expect(report()).toMatchObject({
      status: 'failed',
      stage: 'kaspa-commit-request',
      failure,
      intrinsics: true,
      kaspaRuns: 0,
    });
    expect(getter).not.toHaveBeenCalled();
    expect(mockReport.mock.calls[0][0]).not.toMatch(
      /private|WebEmbed bridge call timeout/,
    );
  },
);

test.each([
  [-100, 0],
  [90_000, 60_000],
  [Number.NaN, 0],
  [Number.POSITIVE_INFINITY, 0],
])(
  'bounds elapsed diagnostics when the clock changes by %s',
  async (change, expected) => {
    let now = 1_000_000;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      mockKaspaCommit.mockImplementation(async () => {
        now += change;
        return null;
      });
      await startProtectedBackgroundCheck();
      expect(report()).toMatchObject({
        status: 'failed',
        stage: 'kaspa-commit-result',
        failure: 'result-invalid',
        elapsedMs: expected,
        rpcElapsedMs: expected,
      });
    } finally {
      clock.mockRestore();
    }
  },
);

test.each(['empty', 'undefined', 'omitted'])(
  'accepts normalized %s only with an explicit empty signature in the original SafeJSON',
  async (representation) => {
    mockKaspaDeserialize.mockImplementation(async () => {
      const transaction = publicTransaction();
      if (representation === 'undefined')
        transaction.inputs[0].signatureScript = undefined;
      if (representation === 'omitted')
        delete transaction.inputs[0].signatureScript;
      return transaction;
    });
    await startProtectedBackgroundCheck();
    expect(report()).toMatchObject({
      status: 'passed',
      intrinsics: true,
      kaspaUnsigned: true,
      kaspaRuns: 2,
    });
  },
);

test.each([
  [
    'missing-signature',
    (raw) => {
      delete raw.inputs[0].signatureScript;
    },
  ],
  [
    'signed',
    (raw) => {
      raw.inputs[0].signatureScript = 'abcd';
    },
  ],
  [
    'null-signature',
    (raw) => {
      raw.inputs[0].signatureScript = null;
    },
  ],
  [
    'wrong-outpoint',
    (raw) => {
      raw.inputs[0].transactionId = 'cd'.repeat(32);
    },
  ],
  [
    'wrong-index',
    (raw) => {
      raw.inputs[0].index = 1;
    },
  ],
  [
    'wrong-commit-script',
    (raw) => {
      raw.inputs[0].utxo.scriptPublicKey = '0000cd';
    },
  ],
  [
    'wrong-input-amount',
    (raw) => {
      raw.inputs[0].utxo.amount = '130000001';
    },
  ],
  [
    'extra-input',
    (raw) => {
      raw.inputs.push(raw.inputs[0]);
    },
  ],
  [
    'payload',
    (raw) => {
      raw.payload = 'unexpected fixture payload';
    },
  ],
])(
  'does not let an empty normalized signature hide invalid original SafeJSON: %s',
  async (name, mutate) => {
    const raw = publicRawReveal();
    mutate(raw);
    mockKaspaReveal.mockResolvedValue(JSON.stringify(raw));
    mockKaspaDeserialize.mockImplementation(async () => {
      const transaction = publicTransaction();
      delete transaction.inputs[0].signatureScript;
      return transaction;
    });
    await startProtectedBackgroundCheck();
    expect(report()).toMatchObject({
      status: 'failed',
      stage: 'kaspa-raw-unsigned',
      intrinsics: true,
      kaspaUnsigned: false,
      kaspaRuns: 0,
    });
    expect(mockKaspaDeserialize).not.toHaveBeenCalled();
  },
);

test.each([
  [
    'null-normalized-signature',
    (tx) => {
      tx.inputs[0].signatureScript = null;
    },
  ],
  [
    'different-amount',
    (tx) => {
      tx.outputs[0].amount = '129999001';
    },
  ],
  [
    'different-script',
    (tx) => {
      tx.outputs[0].scriptPublicKey.scriptPublicKey = 'abce';
    },
  ],
  [
    'different-sequence',
    (tx) => {
      tx.inputs[0].sequence = '1';
    },
  ],
  [
    'different-mass',
    (tx) => {
      tx.mass = '1235';
    },
  ],
])(
  'requires normalized fields to match the original unsigned transaction: %s',
  async (name, mutate) => {
    const transaction = publicTransaction();
    mutate(transaction);
    mockKaspaDeserialize.mockResolvedValue(transaction);
    await startProtectedBackgroundCheck();
    expect(report()).toMatchObject({
      status: 'failed',
      stage: 'kaspa-unsigned',
      intrinsics: true,
      kaspaUnsigned: false,
      kaspaRuns: 0,
    });
  },
);

test('invalid SafeJSON does not leak the returned payload or reach the deserializer', async () => {
  mockKaspaReveal.mockResolvedValue('private malformed fixture payload');
  await startProtectedBackgroundCheck();
  expect(report()).toMatchObject({
    status: 'failed',
    stage: 'kaspa-raw-unsigned',
    intrinsics: true,
    kaspaUnsigned: false,
    kaspaRuns: 0,
  });
  expect(mockKaspaDeserialize).not.toHaveBeenCalled();
  expect(mockReport.mock.calls[0][0]).not.toContain(
    'private malformed fixture payload',
  );
});
