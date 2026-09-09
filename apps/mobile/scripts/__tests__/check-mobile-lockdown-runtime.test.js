const crypto = require('crypto');
const { once } = require('events');
const fs = require('fs');
const { createRequire } = require('module');
const path = require('path');

const {
  connectInspector,
  selectTargets,
  validateRunReport,
  validateRuntimeIdentity,
  validateRuntimeResults: validateRuntimeResultsWithReceipt,
} = require('../check-mobile-lockdown-runtime');

const WebSocket = createRequire(
  require.resolve('@react-native/dev-middleware/package.json'),
)('ws');
const repoRoot = fs.realpathSync(path.resolve(__dirname, '../../../..'));
const worktreeId = crypto
  .createHash('sha256')
  .update(repoRoot)
  .digest('hex')
  .slice(0, 12);
const fingerprint = 'a'.repeat(64);
const origin = 'http://127.0.0.1:8082';
const title = 'so.onekey.wallet (Isolated Lockdown Test)';

function report() {
  return {
    status: 'running',
    worktreeId,
    deviceId: 'isolated-test-device',
    platform: 'ios',
    metroPort: 8082,
    metroBindHost: '127.0.0.1',
    metroUrl: origin,
    sessionId: `wk-${worktreeId}-dev-111111111111-2222222222222222`,
    session: { status: 'injected', worktreeId, expiresAtEpochMs: 1000 },
    shell: { status: 'ready', signing: 'verified-archive' },
    vendor: { status: 'ready' },
  };
}

function target(id) {
  return {
    id,
    title,
    reactNative: { logicalDeviceId: 'isolated-device' },
    webSocketDebuggerUrl: `ws://127.0.0.1:8082/inspector/debug?device=isolated-device&page=${id}`,
  };
}

function runtime(runtimeName) {
  const bundleUrl = new URL(`${origin}/fixture.bundle`);
  Object.entries({
    platform: 'ios',
    'resolver.devVendorNative': 'true',
    'resolver.devSessionId': report().sessionId,
    'resolver.runtimeTarget': runtimeName,
    'resolver.devVendorFingerprint': fingerprint,
  }).forEach(([key, value]) => bundleUrl.searchParams.set(key, value));
  return {
    snapshot: {
      fullBundleUrl: bundleUrl.href,
      state: {
        runtime: runtimeName,
        enabled: true,
        lockdownApplied: true,
        evalTaming: 'unsafe-eval',
      },
      stateFrozen: true,
      binding: { configurable: false, writable: false },
      frozen: [true, true, true, true],
      hardenType: 'function',
      tamperBlocked: true,
      vendorFingerprint: fingerprint,
    },
    asyncDelivery: { promise: true, timer: true, nextTick: true },
    logBox: { disabled: false, tracing: false, logs: [] },
  };
}

function validateRuntimeResults(results, expectedFingerprint) {
  return validateRuntimeResultsWithReceipt(
    results,
    expectedFingerprint,
    report(),
  );
}

describe('mobile lockdown runtime acceptance', () => {
  test('accepts only a running, injected, unexpired session for this worktree and device', () => {
    expect(
      validateRunReport(report(), {
        device: 'isolated-test-device',
        repoRoot,
        now: 1,
      }),
    ).toBe(origin);
    for (const changed of [
      { worktreeId: 'different' },
      { deviceId: 'another-device' },
      { status: 'finished' },
      { metroBindHost: '0.0.0.0' },
      { metroBindHost: undefined },
      { platform: 'web' },
      { metroPort: 0 },
      { metroPort: 65_536 },
      { session: { ...report().session, expiresAtEpochMs: 0 } },
      { session: { ...report().session, status: 'pending' } },
      { session: { ...report().session, worktreeId: 'different' } },
      { shell: { status: 'ready', signing: 'unverified' } },
      { vendor: { status: 'pending' } },
    ]) {
      expect(() =>
        validateRunReport(
          { ...report(), ...changed },
          { device: 'isolated-test-device', repoRoot, now: 1 },
        ),
      ).toThrow();
    }
  });

  test('does not select other devices or redirect the inspector to another Metro', () => {
    expect(
      selectTargets(
        [target('1'), target('2'), { ...target('3'), title: 'another app' }],
        { title, origin },
      ),
    ).toHaveLength(2);
    for (const targets of [
      [target('1')],
      [target('1'), target('1')],
      [target('1'), target('2'), target('3')],
      [
        target('1'),
        { ...target('2'), reactNative: { logicalDeviceId: 'another-device' } },
      ],
      [
        target('1'),
        {
          ...target('2'),
          webSocketDebuggerUrl: 'ws://127.0.0.1:8081/inspector/debug',
        },
      ],
      [
        target('1'),
        {
          ...target('2'),
          webSocketDebuggerUrl: 'ws://example.com:8082/inspector/debug',
        },
      ],
      [
        target('1'),
        { ...target('2'), webSocketDebuggerUrl: 'ws://127.0.0.1:8082/reload' },
      ],
      [
        target('1'),
        {
          ...target('2'),
          webSocketDebuggerUrl:
            'ws://user:password@127.0.0.1:8082/inspector/debug',
        },
      ],
    ])
      expect(() => selectTargets(targets, { title, origin })).toThrow();
  });

  test('requires independent main/background heaps, current artifacts, and every integrity property', () => {
    expect(() =>
      validateRuntimeResults(
        [runtime('main'), runtime('background')],
        fingerprint,
      ),
    ).not.toThrow();
    expect(() =>
      validateRuntimeResults([runtime('main'), runtime('main')], fingerprint),
    ).toThrow('runtime identities');
    expect(() =>
      validateRuntimeResults([runtime('main')], fingerprint),
    ).toThrow('Both native');
    for (const changed of [
      { vendorFingerprint: 'stale' },
      { stateFrozen: false },
      { binding: { writable: true, configurable: false } },
      { frozen: [true, false, true, true] },
      { frozen: [true, true, true, false] },
      { hardenType: 'undefined' },
      { tamperBlocked: false },
      { state: { ...runtime('background').snapshot.state, enabled: false } },
      {
        state: {
          ...runtime('background').snapshot.state,
          lockdownApplied: false,
        },
      },
    ]) {
      const background = runtime('background');
      background.snapshot = { ...background.snapshot, ...changed };
      expect(() =>
        validateRuntimeResults([runtime('main'), background], fingerprint),
      ).toThrow();
    }
  });

  test('checks the live private session before async probes or application logs', () => {
    const snapshot = runtime('main').snapshot;
    expect(() =>
      validateRuntimeIdentity(snapshot, report(), fingerprint),
    ).not.toThrow();
    for (const [key, value] of [
      ['resolver.devSessionId', 'another-session'],
      ['resolver.runtimeTarget', 'background'],
      ['resolver.devVendorNative', 'false'],
      ['resolver.devVendorFingerprint', 'stale'],
      ['platform', 'android'],
    ]) {
      const bundleUrl = new URL(snapshot.fullBundleUrl);
      bundleUrl.searchParams.set(key, value);
      expect(() =>
        validateRuntimeIdentity(
          { ...snapshot, fullBundleUrl: bundleUrl.href },
          report(),
          fingerprint,
        ),
      ).toThrow();
    }
    const wrongOrigin = new URL(snapshot.fullBundleUrl);
    wrongOrigin.port = '8081';
    expect(() =>
      validateRuntimeIdentity(
        { ...snapshot, fullBundleUrl: wrongOrigin.href },
        report(),
        fingerprint,
      ),
    ).toThrow('wrong device-visible Metro origin');
  });

  test.each(['promise', 'timer', 'nextTick'])(
    'rejects missed %s delivery in background even when main succeeds',
    (kind) => {
      const background = runtime('background');
      background.asyncDelivery[kind] = false;
      expect(() =>
        validateRuntimeResults([runtime('main'), background], fingerprint),
      ).toThrow('background: async delivery failed');
    },
  );

  test('does not treat disabled error observation or caught application errors as a pass', () => {
    const main = runtime('main');
    main.logBox.disabled = true;
    expect(() =>
      validateRuntimeResults([main, runtime('background')], fingerprint),
    ).toThrow('observation is disabled');
    main.logBox.disabled = false;
    main.logBox.tracing = true;
    expect(() =>
      validateRuntimeResults([main, runtime('background')], fingerprint),
    ).toThrow('tracing suppresses');
    main.logBox.tracing = false;
    for (const level of ['error', 'fatal', 'syntax']) {
      main.logBox.logs = [
        { level, message: 'caught application failure', count: 1, stack: [] },
      ];
      expect(() =>
        validateRuntimeResults([main, runtime('background')], fingerprint),
      ).toThrow('application LogBox errors remain');
    }
  });
});

describe('real inspector transport', () => {
  let server;
  afterEach(async () => {
    if (server) {
      for (const client of server.clients) client.terminate();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function startServer(onConnection) {
    server = new WebSocket.Server({ host: '127.0.0.1', port: 0 });
    server.on('connection', onConnection);
    await once(server, 'listening');
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    return {
      origin: localOrigin,
      webSocketDebuggerUrl: `${localOrigin.replace('http:', 'ws:')}/inspector/debug`,
    };
  }

  test('uses the required local Origin and matches CDP response IDs without Runtime.enable', async () => {
    let observedOrigin;
    const local = await startServer((socket, request) => {
      observedOrigin = request.headers.origin;
      socket.on('message', (raw) => {
        const message = JSON.parse(String(raw));
        expect(message.method).toBe('Runtime.evaluate');
        socket.send(
          JSON.stringify({
            id: 999,
            result: { result: { value: 'wrong response' } },
          }),
        );
        socket.send(
          JSON.stringify({
            id: message.id,
            result: { result: { value: { runtime: 'main' } } },
          }),
        );
      });
    });
    const client = await connectInspector(local, { origin: local.origin });
    try {
      expect(await client.evaluate('fixed diagnostic expression')).toEqual({
        runtime: 'main',
      });
      expect(observedOrigin).toBe(local.origin);
    } finally {
      client.close();
    }
  });

  test('propagates a native evaluation exception instead of accepting an empty result', async () => {
    const local = await startServer((socket) =>
      socket.on('message', (raw) => {
        socket.send(
          JSON.stringify({
            id: JSON.parse(String(raw)).id,
            result: { exceptionDetails: { text: 'Runtime failed' } },
          }),
        );
      }),
    );
    const client = await connectInspector(local, { origin: local.origin });
    try {
      await expect(
        client.evaluate('fixed diagnostic expression'),
      ).rejects.toThrow('Runtime diagnostic threw');
    } finally {
      client.close();
    }
  });

  test('fails promptly when the runtime disconnects during a diagnostic', async () => {
    const local = await startServer((socket) =>
      socket.on('message', () => socket.close()),
    );
    const client = await connectInspector(local, { origin: local.origin });
    try {
      await expect(
        client.evaluate('fixed diagnostic expression'),
      ).rejects.toThrow('disconnected');
    } finally {
      client.close();
    }
  });

  test('bounds an unresponsive inspector', async () => {
    const local = await startServer(() => {});
    const client = await connectInspector(local, {
      origin: local.origin,
      timeoutMs: 100,
    });
    try {
      await expect(
        client.evaluate('fixed diagnostic expression'),
      ).rejects.toThrow('evaluation timed out');
    } finally {
      client.close();
    }
  });
});
