import { EventEmitter } from 'events';

import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { decideActivePairing, ensureDevicePaired } from './BlePair';

class FakeHelper extends EventEmitter {
  stdout = new EventEmitter();

  stderr = new EventEmitter();

  stdin = { write: jest.fn((_data: string, done?: () => void) => done?.()) };

  kill = jest.fn();

  report(event: Record<string, unknown>) {
    this.stdout.emit('data', Buffer.from(`${JSON.stringify(event)}\n`));
  }
}

let helper: FakeHelper;
jest.mock('child_process', () => ({ spawn: () => helper }));
jest.mock('electron', () => ({ app: { isPackaged: true } }));
jest.mock('electron-is-dev', () => false);
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn() },
}));
jest.mock('../resoucePath', () => ({
  getAppStaticResourcesPath: () => '/resources',
}));

const pair = () => ensureDevicePaired('AA:BB:CC:DD:EE:FF', jest.fn());

beforeEach(() => {
  helper = new FakeHelper();
});

afterEach(() => jest.useRealTimers());

it('reports the Windows pairing status a failed ceremony returned', async () => {
  const pairing = pair();
  helper.report({
    type: 'error',
    message: 'pairing failed with status DevicePairingResultStatus(19)',
  });
  helper.emit('exit', 1);
  await expect(pairing).rejects.toMatchObject({
    code: HardwareErrorCode.BlePairingTimeout,
    params: { phase: 'pairing', pairingStatus: 19 },
  });
});

it('keeps a decline from our dialog over the failure the helper reports after it', async () => {
  const pairing = pair();
  expect(decideActivePairing('cancel')).toBe(true);
  expect(helper.stdin.write).toHaveBeenCalledWith(
    'cancel\n',
    expect.any(Function),
  );
  helper.report({
    type: 'error',
    message: 'pairing failed with status DevicePairingResultStatus(16)',
  });
  helper.emit('exit', 1);
  await expect(pairing).rejects.toMatchObject({
    code: HardwareErrorCode.BlePairingCancelled,
  });
});

it('reports a pairing nobody answered as timed out', async () => {
  jest.useFakeTimers();
  const failure = pair().catch((error: unknown) => error);
  jest.advanceTimersByTime(60_000);
  expect(helper.stdin.write).toHaveBeenCalledWith(
    'cancel\n',
    expect.any(Function),
  );
  helper.emit('exit', 1);
  expect(await failure).toMatchObject({
    code: HardwareErrorCode.BlePairingTimeout,
    params: { phase: 'pairing', timedOut: true },
  });
});

it('ends unanswered numeric comparison when the device drops the link', async () => {
  jest.useFakeTimers();
  const failure = pair().catch((error: unknown) => error);
  helper.report({ type: 'pairing', pin: 'test-code' });
  jest.advanceTimersByTime(30_000);
  helper.report({ type: 'link', connected: false });
  expect(helper.stdin.write).toHaveBeenCalledWith(
    'cancel\n',
    expect.any(Function),
  );
  // A late click must neither accept the expired request nor replace its cause.
  decideActivePairing('confirm');
  expect(helper.stdin.write).toHaveBeenCalledTimes(1);
  helper.emit('exit', 0);
  expect(await failure).toMatchObject({
    code: HardwareErrorCode.BlePairingTimeout,
    params: { phase: 'pairing', deviceDisconnected: true },
  });
});

it.each([
  [
    'device disconnect',
    () => helper.report({ type: 'link', connected: false }),
  ],
  ['deadline', () => jest.advanceTimersByTime(60_000)],
  ['cancel', () => decideActivePairing('cancel')],
  [
    'Windows failure',
    () =>
      helper.report({
        type: 'error',
        message: 'pairing failed with status DevicePairingResultStatus(19)',
      }),
  ],
] as const)(
  'closes the prompt on %s before the helper exits and ignores late PIN events',
  async (_reason, expire) => {
    jest.useFakeTimers();
    const onPin = jest.fn<void, [string, AbortSignal]>();
    let settled = false;
    const failure = ensureDevicePaired('AA:BB:CC:DD:EE:FF', onPin)
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true;
      });
    helper.report({ type: 'pairing', pin: 'test-code' });
    const signal = onPin.mock.calls[0][1];
    expect(signal.aborted).toBe(false);
    expire();
    await Promise.resolve();
    expect(signal.aborted).toBe(true);
    expect(settled).toBe(false);
    helper.report({ type: 'pairing', pin: 'late-code' });
    expect(onPin).toHaveBeenCalledTimes(1);
    helper.emit('exit', 1);
    await failure;
  },
);

it('does not treat a link transition after host confirmation as an unanswered timeout', async () => {
  const pairing = pair();
  helper.report({ type: 'pairing', pin: 'test-code' });
  decideActivePairing('confirm');
  helper.report({ type: 'link', connected: false });
  helper.report({ type: 'paired' });
  helper.emit('exit', 0);
  await expect(pairing).resolves.toBe('paired');
});

it('lets the user confirm Trezor after a transient link change recovers', async () => {
  jest.useFakeTimers();
  const onPin = jest.fn<void, [string, AbortSignal]>();
  const pairing = ensureDevicePaired(
    'AA:BB:CC:DD:EE:FF',
    onPin,
    false,
    undefined,
    { disconnectGraceMs: 1000 },
  );
  helper.report({ type: 'pairing', pin: 'test-code' });
  jest.advanceTimersByTime(64);
  helper.report({ type: 'link', connected: false });
  expect(onPin.mock.calls[0][1].aborted).toBe(false);
  expect(helper.stdin.write).not.toHaveBeenCalled();
  jest.advanceTimersByTime(500);
  helper.report({ type: 'link', connected: true });
  jest.advanceTimersByTime(4000);
  decideActivePairing('confirm');
  expect(helper.stdin.write).toHaveBeenCalledWith(
    'confirm\n',
    expect.any(Function),
  );
  helper.report({ type: 'pairing-result', status: 0 });
  expect(onPin.mock.calls[0][1].aborted).toBe(true);
  helper.report({ type: 'paired' });
  helper.emit('exit', 0);
  await expect(pairing).resolves.toBe('paired');
});

it('replays device refusal without waiting for the 60-second host deadline', async () => {
  jest.useFakeTimers();
  const onPin = jest.fn<void, [string, AbortSignal]>();
  const failure = ensureDevicePaired(
    'AA:BB:CC:DD:EE:FF',
    onPin,
    false,
    undefined,
    { disconnectGraceMs: 1000 },
  ).catch((error: unknown) => error);
  // 1123: link at +672ms, PIN at +1152ms, refusal/drop at +3012ms.
  jest.advanceTimersByTime(672);
  helper.report({ type: 'link', connected: true });
  jest.advanceTimersByTime(480);
  helper.report({ type: 'pairing', pin: 'test-code' });
  jest.advanceTimersByTime(1860);
  helper.report({ type: 'link', connected: false });
  const signal = onPin.mock.calls[0][1];
  jest.advanceTimersByTime(999);
  expect(signal.aborted).toBe(false);
  // Repeated offline events must not extend the recovery window.
  helper.report({ type: 'link', connected: false });
  jest.advanceTimersByTime(1);
  expect(signal.aborted).toBe(true);
  expect(helper.stdin.write.mock.calls).toEqual([
    ['cancel\n', expect.any(Function)],
  ]);
  decideActivePairing('confirm');
  expect(helper.stdin.write).toHaveBeenCalledTimes(1);
  // Even a stuck Windows cleanup is bounded; the prompt is already closed.
  jest.advanceTimersByTime(5000);
  expect(helper.kill).toHaveBeenCalledTimes(1);
  helper.report({ type: 'pairing-result', status: 17 });
  helper.emit('exit', 1);
  expect(await failure).toMatchObject({
    code: HardwareErrorCode.BlePairingTimeout,
    params: { phase: 'pairing', deviceDisconnected: true },
  });
  jest.advanceTimersByTime(60_000);
  expect(helper.stdin.write).toHaveBeenCalledTimes(1);
  expect(helper.kill).toHaveBeenCalledTimes(1);
});

it('does not let an offline event before the PIN cancel a later confirmation', async () => {
  jest.useFakeTimers();
  const onPin = jest.fn<void, [string, AbortSignal]>();
  const pairing = ensureDevicePaired(
    'AA:BB:CC:DD:EE:FF',
    onPin,
    false,
    undefined,
    { disconnectGraceMs: 1000 },
  );
  helper.report({ type: 'link', connected: false });
  helper.report({ type: 'pairing', pin: 'test-code' });
  jest.advanceTimersByTime(2000);
  expect(onPin.mock.calls[0][1].aborted).toBe(false);
  expect(helper.stdin.write).not.toHaveBeenCalled();
  decideActivePairing('confirm');
  helper.report({ type: 'paired' });
  helper.emit('exit', 0);
  await expect(pairing).resolves.toBe('paired');
});

it.each(['confirm', 'cancel'] as const)(
  'clears a pending disconnect deadline when the host answers %s',
  async (decision) => {
    jest.useFakeTimers();
    const pairing = ensureDevicePaired(
      'AA:BB:CC:DD:EE:FF',
      jest.fn(),
      false,
      undefined,
      { disconnectGraceMs: 1000 },
    );
    const failure = pairing.catch((error: unknown) => error);
    helper.report({ type: 'pairing', pin: 'test-code' });
    helper.report({ type: 'link', connected: false });
    jest.advanceTimersByTime(500);
    decideActivePairing(decision);
    jest.advanceTimersByTime(1000);
    expect(helper.stdin.write.mock.calls).toEqual([
      [`${decision}\n`, expect.any(Function)],
    ]);
    helper.report({ type: 'paired' });
    helper.emit('exit', 0);
    if (decision === 'confirm') {
      await expect(pairing).resolves.toBe('paired');
    } else {
      expect(await failure).toMatchObject({
        code: HardwareErrorCode.BlePairingCancelled,
      });
    }
  },
);

it.each([0, 3])(
  'clears a pending disconnect deadline on successful Windows result %s',
  async (status) => {
    jest.useFakeTimers();
    const pairing = ensureDevicePaired(
      'AA:BB:CC:DD:EE:FF',
      jest.fn(),
      false,
      undefined,
      { disconnectGraceMs: 1000 },
    );
    helper.report({ type: 'pairing', pin: 'test-code' });
    helper.report({ type: 'link', connected: false });
    helper.report({ type: 'pairing-result', status });
    // A late link callback during native cleanup cannot restart the deadline.
    helper.report({ type: 'link', connected: false });
    jest.advanceTimersByTime(2000);
    expect(helper.stdin.write).not.toHaveBeenCalled();
    helper.report({ type: status === 0 ? 'paired' : 'already-paired' });
    helper.emit('exit', 0);
    await expect(pairing).resolves.toBe(
      status === 0 ? 'paired' : 'already-paired',
    );
  },
);

it('closes Trezor on the authoritative WinRT failure before helper cleanup exits', async () => {
  jest.useFakeTimers();
  const onPin = jest.fn<void, [string, AbortSignal]>();
  let settled = false;
  const failure = ensureDevicePaired(
    'AA:BB:CC:DD:EE:FF',
    onPin,
    false,
    undefined,
    { disconnectGraceMs: 1000 },
  )
    .catch((error: unknown) => error)
    .finally(() => {
      settled = true;
    });
  helper.report({ type: 'pairing', pin: 'test-code' });
  helper.report({ type: 'link', connected: false });
  helper.report({ type: 'pairing-result', status: 19 });
  jest.advanceTimersByTime(2000);
  await Promise.resolve();
  expect(onPin.mock.calls[0][1].aborted).toBe(true);
  expect(settled).toBe(false);
  decideActivePairing('confirm');
  expect(helper.stdin.write).not.toHaveBeenCalled();
  helper.report({ type: 'error', message: 'cleanup failed later' });
  helper.emit('exit', 1);
  expect(await failure).toMatchObject({ params: { pairingStatus: 19 } });
});

it('expires a Ledger confirmation after 30 seconds even without a Windows disconnect event', async () => {
  jest.useFakeTimers();
  const onPin = jest.fn<void, [string, AbortSignal]>();
  const failure = ensureDevicePaired(
    'AA:BB:CC:DD:EE:FF',
    onPin,
    false,
    undefined,
    { confirmationTimeoutMs: 30_000 },
  ).catch((error: unknown) => error);
  jest.advanceTimersByTime(5000);
  helper.report({ type: 'pairing', pin: 'test-code' });
  const signal = onPin.mock.calls[0][1];
  jest.advanceTimersByTime(29_999);
  expect(signal.aborted).toBe(false);
  jest.advanceTimersByTime(1);
  expect(signal.aborted).toBe(true);
  expect(helper.stdin.write).toHaveBeenCalledTimes(1);
  decideActivePairing('confirm');
  decideActivePairing('cancel');
  expect(helper.stdin.write).toHaveBeenCalledTimes(1);
  helper.emit('exit', 1);
  expect(await failure).toMatchObject({
    code: HardwareErrorCode.BlePairingTimeout,
    params: { phase: 'pairing', confirmationTimedOut: true },
  });
});

it('stops the confirmation deadline once the host confirms', async () => {
  jest.useFakeTimers();
  const pairing = ensureDevicePaired(
    'AA:BB:CC:DD:EE:FF',
    jest.fn(),
    false,
    undefined,
    { confirmationTimeoutMs: 30_000 },
  );
  helper.report({ type: 'pairing', pin: 'test-code' });
  jest.advanceTimersByTime(29_000);
  decideActivePairing('confirm');
  jest.advanceTimersByTime(2000);
  expect(helper.stdin.write).toHaveBeenCalledTimes(1);
  helper.report({ type: 'paired' });
  helper.emit('exit', 0);
  await expect(pairing).resolves.toBe('paired');
});

it('closes a successful WinRT prompt without timing out while the helper cleans up', async () => {
  jest.useFakeTimers();
  const onPin = jest.fn<void, [string, AbortSignal]>();
  const pairing = ensureDevicePaired(
    'AA:BB:CC:DD:EE:FF',
    onPin,
    false,
    undefined,
    { confirmationTimeoutMs: 30_000 },
  );
  helper.report({ type: 'pairing', pin: 'test-code' });
  helper.report({ type: 'pairing-result', status: 0 });
  expect(onPin.mock.calls[0][1].aborted).toBe(true);
  jest.advanceTimersByTime(30_000);
  expect(helper.stdin.write).not.toHaveBeenCalled();
  helper.report({ type: 'paired' });
  helper.emit('exit', 0);
  await expect(pairing).resolves.toBe('paired');
});

it.each([
  [
    'a helper that cannot start',
    () => helper.emit('error', new Error('spawn ENOENT')),
  ],
  [
    'a failure before any pairing result',
    () => {
      helper.report({
        type: 'error',
        message: 'device reports CanPair = false',
      });
      helper.emit('exit', 1);
    },
  ],
  ['a helper that dies without a word', () => helper.emit('exit', 3)],
])('reports %s as a connect failure', async (_name, fail) => {
  const pairing = pair();
  fail();
  await expect(pairing).rejects.toMatchObject({
    code: HardwareErrorCode.BleConnectFailed,
  });
});

it('reports a helper that exits cleanly without pairing as a failed pairing', async () => {
  const pairing = pair();
  helper.emit('exit', 0);
  await expect(pairing).rejects.toMatchObject({
    code: HardwareErrorCode.BlePairingTimeout,
    message: 'BLE pairing did not complete',
  });
});

it('resolves once the helper reports the bond', async () => {
  const pairing = pair();
  helper.report({ type: 'paired' });
  helper.emit('exit', 0);
  await expect(pairing).resolves.toBe('paired');
});
