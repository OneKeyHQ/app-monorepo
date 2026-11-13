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
