import { HardwareErrorCode, createHwkError } from '@onekeyfe/hwk-adapter-core';
import { THIRD_PARTY_BLE_CHANNELS } from '@onekeyfe/hwk-desktop-noble-ble';

import { createTrezorBlePairingIpcMain } from './trezorBlePairing';

import type { IpcMainLike } from '@onekeyfe/hwk-desktop-noble-ble';
import type { BrowserWindow } from 'electron';

const mockPair = jest.fn<Promise<string>, unknown[]>();
const mockPairAvailable = jest.fn(() => true);
const mockDecide = jest.fn<boolean, unknown[]>(() => true);
jest.mock('./BlePair', () => ({
  ensureDevicePaired: (...args: unknown[]) => mockPair(...args),
  decideActivePairing: (...args: unknown[]) => mockDecide(...args),
  isBlePairAvailable: () => mockPairAvailable(),
  startRawAdvertisementWatch: jest.fn(),
}));
jest.mock('./trezorBleFlags', () => ({
  trezorBleFlags: { pairKeepLink: false, rawWatch: false },
}));
jest.mock('../i18n', () => ({ ElectronTranslations: {}, i18nText: jest.fn() }));
jest.mock('electron', () => ({ dialog: { showMessageBox: jest.fn() } }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@onekeyfe/hwk-trezor-adapter', () => ({
  isTrezorBleServiceUuid: () => false,
  isTrezorSafe7BleName: (name: string) => name.startsWith('Trezor'),
}));

const flush = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
function setup() {
  const handlers = new Map<string, Parameters<IpcMainLike['handle']>[1]>();
  const base: IpcMainLike = {
    handle: (channel, callback) => {
      handlers.set(channel, callback);
    },
    removeHandler: (channel) => {
      handlers.delete(channel);
    },
  };
  const wrapper = createTrezorBlePairingIpcMain(base, {} as BrowserWindow);
  const connect = jest.fn(async () => ({ id: 'connected' }));
  wrapper.handle(THIRD_PARTY_BLE_CHANNELS.scan, async () => [
    { id: 'first', name: 'Trezor Safe 7', address: 'first-address' },
    { id: 'second', name: 'Trezor Safe 7', address: 'second-address' },
    { id: 'nano', name: 'Nano X 1234', address: 'nano-address' },
  ]);
  wrapper.handle(THIRD_PARTY_BLE_CHANNELS.connect, connect);
  wrapper.handle(THIRD_PARTY_BLE_CHANNELS.cancelPairing, async () => undefined);
  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)?.({}, ...args);
  return { invoke, connect };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPairAvailable.mockReturnValue(true);
});

it.each([
  ['trezor', 'ledger'],
  ['ledger', 'trezor'],
] as const)(
  'only cancels the matching %s Windows pairing and never proceeds after late success',
  async (vendor, otherVendor) => {
    let finish!: () => void;
    mockPair.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = () => resolve('already-paired');
        }),
    );
    const { invoke, connect } = setup();
    await invoke(THIRD_PARTY_BLE_CHANNELS.scan);
    const pending = invoke(THIRD_PARTY_BLE_CHANNELS.connect, 'first', {
      vendor,
    });
    await flush();
    await invoke(THIRD_PARTY_BLE_CHANNELS.cancelPairing, {
      vendor: otherVendor,
      id: 'first',
    });
    await invoke(THIRD_PARTY_BLE_CHANNELS.cancelPairing, {
      vendor,
      id: 'second',
    });
    expect(mockDecide).not.toHaveBeenCalled();
    await invoke(THIRD_PARTY_BLE_CHANNELS.cancelPairing, {
      vendor,
      id: 'first',
    });
    expect(mockDecide).toHaveBeenCalledTimes(1);
    finish();
    await expect(pending).rejects.toMatchObject({
      code: HardwareErrorCode.BlePairingCancelled,
    });
    expect(connect).not.toHaveBeenCalled();
  },
);

it('does not open a queued pairing after that connection was cancelled', async () => {
  let finish!: () => void;
  mockPair.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = () => resolve('already-paired');
      }),
  );
  const { invoke, connect } = setup();
  await invoke(THIRD_PARTY_BLE_CHANNELS.scan);
  const first = invoke(THIRD_PARTY_BLE_CHANNELS.connect, 'first', {
    vendor: 'trezor',
  });
  const second = invoke(THIRD_PARTY_BLE_CHANNELS.connect, 'second', {
    vendor: 'trezor',
  });
  await flush();
  await invoke(THIRD_PARTY_BLE_CHANNELS.cancelPairing, {
    vendor: 'trezor',
    id: 'second',
  });
  expect(mockDecide).not.toHaveBeenCalled();
  finish();
  await expect(first).resolves.toEqual({ id: 'connected' });
  await expect(second).rejects.toMatchObject({
    code: HardwareErrorCode.BlePairingCancelled,
  });
  expect(mockPair).toHaveBeenCalledTimes(1);
  expect(connect).toHaveBeenCalledTimes(1);
});

it.each([
  ['trezor', false],
  ['ledger', false],
  ['keystone', true],
] as const)(
  'passes %s through when OS pairing does not apply (available=%s)',
  async (vendor, available) => {
    mockPairAvailable.mockReturnValue(available);
    const { invoke, connect } = setup();
    await invoke(THIRD_PARTY_BLE_CHANNELS.scan);
    await expect(
      invoke(THIRD_PARTY_BLE_CHANNELS.connect, 'first', { vendor }),
    ).resolves.toEqual({ id: 'connected' });
    expect(mockPair).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
  },
);

it('pairs a Ledger at the OS level before noble connects', async () => {
  mockPair.mockResolvedValue('already-paired');
  const { invoke, connect } = setup();
  await invoke(THIRD_PARTY_BLE_CHANNELS.scan, { vendor: 'ledger' });
  await expect(
    invoke(THIRD_PARTY_BLE_CHANNELS.connect, 'nano', { vendor: 'ledger' }),
  ).resolves.toEqual({ id: 'connected' });
  expect(mockPair).toHaveBeenCalledTimes(1);
  expect(mockPair.mock.calls[0][0]).toBe('nano-address');
  expect(mockPair.mock.invocationCallOrder[0]).toBeLessThan(
    connect.mock.invocationCallOrder[0],
  );
});

it('retries the first Ledger connect once after a fresh bond', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  try {
    mockPair.mockResolvedValue('paired');
    const { invoke, connect } = setup();
    connect.mockRejectedValueOnce(new Error('link still held'));
    await invoke(THIRD_PARTY_BLE_CHANNELS.scan, { vendor: 'ledger' });
    const pending = invoke(THIRD_PARTY_BLE_CHANNELS.connect, 'nano', {
      vendor: 'ledger',
    });
    await flush();
    await jest.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toEqual({ id: 'connected' });
    expect(connect).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

// What the SDK's BLE host throws when Windows reports the GATT unreachable.
const unreachableAfter = (msSinceLink: number) =>
  createHwkError({
    code: HardwareErrorCode.BleConnectFailed,
    message: 'BLE connect failed',
    params: { phase: 'connect', gattUnreachable: true, msSinceLink },
  });

it('reports a lost bond when a bonded Ledger drops the link as it forms', async () => {
  mockPair.mockResolvedValue('already-paired');
  const { invoke, connect } = setup();
  connect.mockRejectedValueOnce(unreachableAfter(80));
  await invoke(THIRD_PARTY_BLE_CHANNELS.scan, { vendor: 'ledger' });
  await expect(
    invoke(THIRD_PARTY_BLE_CHANNELS.connect, 'nano', { vendor: 'ledger' }),
  ).rejects.toMatchObject({
    code: HardwareErrorCode.BleBondInvalid,
    params: { phase: 'connect', msSinceLink: 80 },
  });
  expect(connect).toHaveBeenCalledTimes(1);
});

it.each([
  [
    'a Ledger losing the link seconds in',
    'ledger',
    'nano',
    'already-paired',
    5000,
  ],
  [
    'a bonded Trezor dropping the link at once',
    'trezor',
    'first',
    'already-paired',
    80,
  ],
  ['a Ledger the OS was not bonded to before', 'ledger', 'nano', 'skipped', 80],
] as const)(
  'leaves %s as the host reported it',
  async (_name, vendor, id, pairOutcome, msSinceLink) => {
    mockPairAvailable.mockReturnValue(pairOutcome !== 'skipped');
    mockPair.mockResolvedValue(pairOutcome);
    const { invoke, connect } = setup();
    const hostError = unreachableAfter(msSinceLink);
    connect.mockRejectedValueOnce(hostError);
    await invoke(THIRD_PARTY_BLE_CHANNELS.scan, { vendor });
    await expect(
      invoke(THIRD_PARTY_BLE_CHANNELS.connect, id, { vendor }),
    ).rejects.toBe(hostError);
  },
);

it('does not retry a fresh bond once the host timed the connect out', async () => {
  mockPair.mockResolvedValue('paired');
  const { invoke, connect } = setup();
  const timedOut = createHwkError({
    code: HardwareErrorCode.DeviceNotFound,
    message: 'connect timed out after 31000ms',
    params: { phase: 'connect', timedOut: true },
  });
  connect.mockRejectedValueOnce(timedOut);
  await invoke(THIRD_PARTY_BLE_CHANNELS.scan, { vendor: 'ledger' });
  await expect(
    invoke(THIRD_PARTY_BLE_CHANNELS.connect, 'nano', { vendor: 'ledger' }),
  ).rejects.toBe(timedOut);
  expect(connect).toHaveBeenCalledTimes(1);
});
