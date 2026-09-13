const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  inspectReleaseArtifacts,
  validateReleaseRecords,
} = require('../check-mobile-lockdown-release');

const mockWrite = jest.fn();
const mockIntegrity = jest.fn();
const mockMarker = jest.fn();
const mockFileBridge = jest.fn();
const mockWebEmbedState = jest.fn();
const mockKaspaCommit = jest.fn();
const mockKaspaReveal = jest.fn();
const mockKaspaDeserialize = jest.fn();
let mockLoaded;
let mockSegments;
const segmentKey = 'seg:apps.mobile.src.security.mobileLockdownReleaseMarker';
const runId = 'a'.repeat(32);

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Info: 1, Error: 3 },
    NativeLogger: { write: mockWrite },
  }),
);
jest.mock('../../src/security/mobileLockdownReleaseProbe', () => ({
  captureMobileLockdownIntegrity: mockIntegrity,
}));
jest.mock('../../src/splitBundle/installProdBundleLoader', () => ({
  isSegmentLoaded: () => mockLoaded,
}));
jest.mock('../../src/splitBundle/segmentManifest', () => ({
  getSegmentManifest: () => ({ segments: mockSegments }),
  getSegmentEntry: (key) => mockSegments[key],
}));
jest.mock('../../src/security/mobileLockdownReleaseMarker', () => {
  mockLoaded = true;
  return { readMobileLockdownReleaseMarker: mockMarker };
});
jest.mock('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy', () => ({
  default: {
    test: { test1: mockFileBridge, getRuntimeSecurityState: mockWebEmbedState },
    chainKaspa: {
      buildCommitTxInfo: mockKaspaCommit,
      createKRC20RevealTxJSON: mockKaspaReveal,
      deserializeFromSafeJSON: mockKaspaDeserialize,
    },
  },
  __esModule: true,
}));

describe('Release artifact and native log acceptance', () => {
  let directory;
  beforeEach(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-lockdown-release-test-'),
    );
    for (const file of [
      'common.bundle',
      'main.jsbundle.hbc',
      'background.bundle',
    ]) {
      fs.writeFileSync(
        path.join(directory, file),
        Buffer.concat([
          Buffer.from('c61fbc03c103191f', 'hex'),
          Buffer.from('fixture'),
        ]),
      );
    }
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('rejects missing, non-Hermes or probe-bearing default artifacts', () => {
    expect(inspectReleaseArtifacts(directory)).toHaveLength(3);
    fs.appendFileSync(
      path.join(directory, 'common.bundle'),
      'MobileLockdownE2E',
    );
    expect(() => inspectReleaseArtifacts(directory)).toThrow('contains E2E');
    fs.writeFileSync(path.join(directory, 'common.bundle'), 'not bytecode');
    expect(() => inspectReleaseArtifacts(directory)).toThrow(
      'real Hermes bytecode',
    );
    fs.rmSync(path.join(directory, 'common.bundle'));
    expect(() => inspectReleaseArtifacts(directory)).toThrow(
      'Missing native Release',
    );
  });

  function record(runtime) {
    return {
      runtime,
      runId,
      platform: 'android',
      status: 'passed',
      sourceKind: 'builtin',
      nativeVersion: '1.0',
      version: '1.0',
      bundleVersion: '1',
      buildNumber: '1',
      integrity: {
        runtime,
        enabled: true,
        lockdownApplied: true,
        evalTaming: 'unsafe-eval',
        stateFrozen: true,
        bindingImmutable: true,
        objectFrozen: true,
        arrayFrozen: true,
        functionFrozen: true,
        promiseFrozen: true,
        hardenPresent: true,
        tamperBlocked: true,
      },
      asyncDelivery: { promise: true, timer: true, nextTick: true },
      segment: { loaded: true, sha256Prefix: 'b'.repeat(16) },
    };
  }
  const options = {
    runId,
    platform: 'android',
    artifacts: [
      {
        file: 'segments/mobileLockdownReleaseMarker.seg.hbc',
        sha256: 'b'.repeat(64),
      },
    ],
  };
  function log(
    records = [record('main'), record('background')],
    webEmbed = {
      runId,
      runtime: 'background',
      status: 'passed',
      fileBridge: false,
      bridgeSource: 'bundled-https',
      intrinsics: true,
      kaspaUnsigned: true,
      kaspaRuns: 2,
    },
  ) {
    return [
      ...records.map((value) => `[MobileLockdownE2E] ${JSON.stringify(value)}`),
      `[MobileLockdownWebEmbedMountE2E] ${JSON.stringify({ runId, runtime: 'main', status: 'requested', providerReady: true })}`,
      `[MobileLockdownWebEmbedE2E] ${JSON.stringify(webEmbed)}`,
    ].join('\n');
  }

  test('requires an artifact containing the exact test run ID', () => {
    expect(() => inspectReleaseArtifacts(directory, runId)).toThrow(
      'expected E2E run ID',
    );
    fs.appendFileSync(path.join(directory, 'common.bundle'), runId);
    expect(
      inspectReleaseArtifacts(directory, runId).some(
        (value) => value.containsRunId,
      ),
    ).toBe(true);
  });

  test('requires both actual heaps, every integrity property and protected file WebEmbed', () => {
    expect(validateReleaseRecords(log(), options).runtimes).toHaveLength(2);
    for (const change of [
      { runtime: 'main' },
      { runId: 'c'.repeat(32) },
      { platform: 'ios' },
      { status: 'failed' },
      { sourceKind: 'ota' },
      { nativeVersion: 'wrong' },
      { buildNumber: 'wrong' },
      { asyncDelivery: { promise: true, timer: true, nextTick: false } },
      { segment: { loaded: false, sha256Prefix: 'b'.repeat(16) } },
      { segment: { loaded: true, sha256Prefix: 'c'.repeat(16) } },
    ]) {
      expect(() =>
        validateReleaseRecords(
          log([record('main'), { ...record('background'), ...change }]),
          options,
        ),
      ).toThrow();
    }
    for (const key of Object.keys(record('main').integrity)) {
      const changed = record('main');
      changed.integrity[key] = false;
      expect(() =>
        validateReleaseRecords(log([changed, record('background')]), options),
      ).toThrow();
    }
    expect(() =>
      validateReleaseRecords(
        log(undefined, { runId, status: 'failed' }),
        options,
      ),
    ).toThrow('Protected native packaged WebEmbed');
  });

  test('rejects missing UI readiness and the wrong native resource scheme', () => {
    expect(() =>
      validateReleaseRecords(
        log()
          .split('\n')
          .filter((line) => !line.includes('MountE2E'))
          .join('\n'),
        options,
      ),
    ).toThrow('readiness');
    expect(() =>
      validateReleaseRecords(
        log().replace('"providerReady":true', '"providerReady":false'),
        options,
      ),
    ).toThrow('readiness');
    expect(() =>
      validateReleaseRecords(
        log(undefined, {
          runId,
          runtime: 'background',
          status: 'passed',
          fileBridge: true,
          bridgeSource: 'file',
          intrinsics: true,
          kaspaUnsigned: true,
          kaspaRuns: 2,
        }),
        options,
      ),
    ).toThrow('native packaged WebEmbed');
    const iosLog = log(
      [record('main'), record('background')].map((value) => ({
        ...value,
        platform: 'ios',
      })),
      {
        runId,
        runtime: 'background',
        status: 'passed',
        fileBridge: false,
        bridgeSource: 'bundled-scheme',
        intrinsics: true,
        kaspaUnsigned: true,
        kaspaRuns: 2,
      },
    );
    expect(
      validateReleaseRecords(iosLog, { ...options, platform: 'ios' }).webEmbed
        .bridgeSource,
    ).toBe('bundled-scheme');
    for (const wrongSource of ['file', 'bundled-https']) {
      expect(() =>
        validateReleaseRecords(iosLog.replace('bundled-scheme', wrongSource), {
          ...options,
          platform: 'ios',
        }),
      ).toThrow('native packaged WebEmbed');
    }
  });

  test('requires both complete unsigned Kaspa operations in addition to intrinsic protection', () => {
    for (const change of [
      ['"kaspaUnsigned":true', '"kaspaUnsigned":false'],
      ['"kaspaRuns":2', '"kaspaRuns":1'],
      ['"kaspaRuns":2', '"kaspaRuns":0'],
      ['"kaspaRuns":2', '"kaspaRuns":3'],
      [',"kaspaUnsigned":true', ''],
    ]) {
      expect(() =>
        validateReleaseRecords(log().replace(...change), options),
      ).toThrow('Protected native packaged WebEmbed');
    }
  });

  test('does not accept a successful probe alongside application crashes', () => {
    for (const error of [
      '[JSError] FATAL',
      'FATAL EXCEPTION: main',
      'Fatal signal 11',
      'JavascriptException',
      'Unhandled promise rejection',
    ]) {
      expect(() =>
        validateReleaseRecords(`${log()}\n${error}`, options),
      ).toThrow('Native application errors remain');
    }
  });
});

describe('native Release lockdown E2E', () => {
  const oldRunId = process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
  const oldDev = globalThis.__DEV__;
  const oldNativeLoggingHook = Object.getOwnPropertyDescriptor(
    globalThis,
    'nativeLoggingHook',
  );
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    mockWrite.mockReset();
    mockIntegrity
      .mockReset()
      .mockImplementation((runtime) => ({ runtime, enabled: true }));
    mockMarker.mockReset().mockReturnValue({
      marker: 'onekey-mobile-lockdown-release-segment-v1',
      arrayFrozen: true,
      promiseFrozen: true,
    });
    mockFileBridge
      .mockReset()
      .mockResolvedValue(`${runId}: file:///isolated-test/index.html`);
    mockWebEmbedState.mockReset().mockResolvedValue({
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
    mockKaspaReveal.mockReset().mockResolvedValue(
      JSON.stringify({
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
      }),
    );
    mockKaspaDeserialize.mockReset().mockResolvedValue({
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
    });
    mockLoaded = false;
    mockSegments = {
      [segmentKey]: { key: segmentKey, sha256: 'b'.repeat(64) },
    };
    process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = runId;
    globalThis.__DEV__ = false;
    globalThis.nativeLoggingHook = jest.fn();
  });
  afterEach(() => {
    jest.useRealTimers();
    if (oldRunId === undefined) delete process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
    else process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = oldRunId;
    globalThis.__DEV__ = oldDev;
    if (oldNativeLoggingHook)
      Object.defineProperty(
        globalThis,
        'nativeLoggingHook',
        oldNativeLoggingHook,
      );
    else delete globalThis.nativeLoggingHook;
  });
  function start(
    runtime = 'main',
    context = { nativeVersion: '1.0', sourceKind: 'builtin' },
  ) {
    return require('../../src/security/mobileLockdownReleaseCheck').runMobileLockdownReleaseCheck(
      runtime,
      {
        getRuntimeBundleContext: () => Promise.resolve(context),
      },
    );
  }
  function reports() {
    return mockWrite.mock.calls.map(([, line]) =>
      JSON.parse(line.slice('[MobileLockdownE2E] '.length)),
    );
  }

  test.each(['main', 'background'])(
    'records %s only after async delivery and actual lazy-module execution',
    async (runtime) => {
      const check = start(runtime);
      expect(reports()).toEqual([]);
      await jest.advanceTimersByTimeAsync(20);
      await check;
      expect(reports()).toEqual([
        expect.objectContaining({
          runtime,
          runId,
          platform: 'android',
          status: 'passed',
          sourceKind: 'builtin',
          asyncDelivery: { promise: true, timer: true, nextTick: true },
          segment: {
            key: segmentKey,
            sha256Prefix: 'b'.repeat(16),
            loaded: true,
          },
        }),
      ]);
      expect(mockMarker).toHaveBeenCalledTimes(1);
      expect(globalThis.nativeLoggingHook).toHaveBeenCalledWith(
        mockWrite.mock.calls[0][1],
        1,
      );
      await expect(start(runtime)).rejects.toThrow('already started');
    },
  );

  test.each(['missing', 'debug', 'invalid'])(
    'rejects an unintended %s build before probing',
    async (mode) => {
      if (mode === 'missing') delete process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
      if (mode === 'debug') globalThis.__DEV__ = true;
      if (mode === 'invalid') process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = 'true';
      await expect(start()).rejects.toThrow('explicit Release test build');
      expect(mockIntegrity).not.toHaveBeenCalled();
      expect(mockWrite).not.toHaveBeenCalled();
    },
  );

  test('rejects integrity failure without logging application error payloads', async () => {
    mockIntegrity.mockImplementation(() => {
      // eslint-disable-next-line onekey/no-raw-error -- intentionally simulate a failing diagnostic without app infrastructure
      throw new Error('private fixture payload');
    });
    await start();
    expect(reports()).toEqual([
      expect.objectContaining({ status: 'failed', stage: 'integrity' }),
    ]);
    expect(JSON.stringify(mockWrite.mock.calls)).not.toContain(
      'private fixture',
    );
  });

  test.each(['missing', 'preloaded', 'bad-hash', 'mutable', 'mutable-promise'])(
    'rejects a %s native segment',
    async (mode) => {
      if (mode === 'missing') mockSegments = {};
      if (mode === 'preloaded') mockLoaded = true;
      if (mode === 'bad-hash') mockSegments[segmentKey].sha256 = 'invalid';
      if (mode === 'mutable')
        mockMarker.mockReturnValue({
          marker: 'onekey-mobile-lockdown-release-segment-v1',
          arrayFrozen: false,
          promiseFrozen: true,
        });
      if (mode === 'mutable-promise')
        mockMarker.mockReturnValue({
          marker: 'onekey-mobile-lockdown-release-segment-v1',
          arrayFrozen: true,
          promiseFrozen: false,
        });
      const check = start();
      await jest.advanceTimersByTimeAsync(20);
      await check;
      expect(reports()).toEqual([
        expect.objectContaining({
          status: 'failed',
          stage: {
            missing: 'segment-discovery',
            preloaded: 'segment-initial-state',
            'bad-hash': 'segment-metadata',
            mutable: 'segment-array',
            'mutable-promise': 'segment-promise',
          }[mode],
        }),
      ]);
    },
  );

  test.each(['SPLIT_BUNDLE_EVAL_ERROR', 'private fixture code'])(
    'records only allowlisted native codes: %s',
    async (code) => {
      mockMarker.mockImplementation(() => {
        // eslint-disable-next-line onekey/no-raw-error -- simulate native rejection without logging its payload
        throw Object.assign(new Error('private fixture payload'), { code });
      });
      const check = start();
      await jest.advanceTimersByTimeAsync(20);
      await check;
      expect(reports()[0]).toMatchObject({
        status: 'failed',
        stage: 'segment-evaluation',
      });
      expect(reports()[0].code).toBe(
        code === 'SPLIT_BUNDLE_EVAL_ERROR' ? code : undefined,
      );
      expect(JSON.stringify(mockWrite.mock.calls)).not.toContain(
        'private fixture',
      );
    },
  );

  test('rejects an OTA source instead of reporting a pass', async () => {
    const check = start('main', { nativeVersion: '1.0', sourceKind: 'ota' });
    await jest.advanceTimersByTimeAsync(20);
    await check;
    expect(reports()[0]).toMatchObject({
      status: 'failed',
      stage: 'native-context',
    });
  });

  test('times out when async delivery stalls', async () => {
    const nextTick = jest
      .spyOn(process, 'nextTick')
      .mockImplementation(() => undefined);
    try {
      const check = start();
      await jest.advanceTimersByTimeAsync(15_001);
      await check;
      expect(reports()).toEqual([
        expect.objectContaining({ status: 'failed', stage: 'async' }),
      ]);
    } finally {
      nextTick.mockRestore();
    }
  });

  test.each(['protected', 'mutable', 'http', 'wrong-id'])(
    'requires real protected file WebEmbed: %s',
    async (mode) => {
      if (mode === 'mutable')
        mockWebEmbedState.mockResolvedValue({
          hardenType: 'undefined',
          objectFrozen: false,
          arrayFrozen: false,
          functionFrozen: false,
          promiseFrozen: false,
        });
      if (mode === 'http')
        mockFileBridge.mockResolvedValue(
          `${runId}: http://127.0.0.1/index.html`,
        );
      if (mode === 'wrong-id')
        mockFileBridge.mockResolvedValue(
          'wrong: file:///isolated-test/index.html',
        );
      await require('../../src/security/mobileLockdownWebEmbedReleaseCheck').runMobileLockdownWebEmbedReleaseCheck();
      const line = mockWrite.mock.calls[0][1];
      expect(line).not.toContain('isolated-test');
      expect(
        JSON.parse(line.slice('[MobileLockdownWebEmbedE2E] '.length)),
      ).toMatchObject({
        runId,
        runtime: 'background',
        status: mode === 'protected' ? 'passed' : 'failed',
      });
    },
  );

  test('bounds a WebEmbed bridge that never becomes ready', async () => {
    mockFileBridge.mockReturnValue(new Promise(() => {}));
    const check =
      require('../../src/security/mobileLockdownWebEmbedReleaseCheck').runMobileLockdownWebEmbedReleaseCheck();
    await jest.advanceTimersByTimeAsync(60_001);
    await check;
    expect(mockWrite.mock.calls[0][1]).toContain('"status":"failed"');
  });
});
