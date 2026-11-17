import { EventEmitter } from 'events';

import { NobleBleHandler } from '@onekeyfe/hwk-desktop-noble-ble';

import { createWindowsBlePairingOptions } from './windowsBlePairing';

import type {
  BrowserWindow,
  MessageBoxOptions,
  MessageBoxReturnValue,
} from 'electron';

const mockShowMessageBox = jest.fn<
  Promise<MessageBoxReturnValue>,
  [BrowserWindow, MessageBoxOptions]
>();
let mockHelper: EventEmitter;
jest.mock('child_process', () => ({ spawn: () => mockHelper }));
jest.mock('electron', () => ({
  app: { isPackaged: true },
  dialog: {
    showMessageBox: (...args: Parameters<typeof mockShowMessageBox>) =>
      mockShowMessageBox(...args),
  },
}));
jest.mock('electron-is-dev', () => true);
jest.mock('../i18n', () => ({ ElectronTranslations: {}, i18nText: jest.fn() }));
jest.mock('../resoucePath', () => ({
  getAppStaticResourcesPath: () => '/resources',
}));

const mockApp = jest.requireMock('electron').app as { isPackaged: boolean };
const originalPlatform = process.platform;
const window = { isDestroyed: () => false } as BrowserWindow;
beforeEach(() => {
  jest.clearAllMocks();
  mockApp.isPackaged = true;
  Object.defineProperty(process, 'platform', { value: 'win32' });
});
afterEach(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
);

it.each(['darwin', 'linux'])(
  'leaves %s pairing with the platform SDK',
  (platform) => {
    Object.defineProperty(process, 'platform', { value: platform });
    expect(createWindowsBlePairingOptions(window)).toBeUndefined();
  },
);

it('uses the packaged executable outside ASAR and the per-architecture dev executable', () => {
  expect(createWindowsBlePairingOptions(window)?.helperPath).toBe(
    '/resources/bin/ble-pair/onekey-ble-pair.exe',
  );
  mockApp.isPackaged = false;
  expect(createWindowsBlePairingOptions(window)?.helperPath).toBe(
    `/resources/bin/ble-pair/win-${process.arch}/onekey-ble-pair.exe`,
  );
});

it.each([
  [0, 'confirm'],
  [1, 'cancel'],
] as const)(
  'passes dialog response %s back to the SDK as %s',
  async (response, decision) => {
    mockShowMessageBox.mockResolvedValue({ response, checkboxChecked: false });
    const signal = new AbortController().signal;
    const result = await createWindowsBlePairingOptions(
      window,
    )?.onPairingRequest({
      id: 'selected',
      vendor: 'trezor',
      pin: 'comparison-fixture',
      signal,
    });
    expect(result).toBe(decision);
    expect(mockShowMessageBox).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        signal,
        cancelId: 1,
        message: 'comparison-fixture',
      }),
    );
  },
);

it('binds dialog lifetime to the SDK signal and rejects a late confirmation', async () => {
  let answer!: (result: { response: number }) => void;
  mockShowMessageBox.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = ({ response }) =>
          resolve({ response, checkboxChecked: false });
      }),
  );
  const controller = new AbortController();
  const result = createWindowsBlePairingOptions(window)?.onPairingRequest({
    id: 'selected',
    vendor: 'ledger',
    pin: 'comparison-fixture',
    signal: controller.signal,
  });
  controller.abort();
  expect(mockShowMessageBox.mock.calls[0][1].signal?.aborted).toBe(true);
  answer({ response: 0 });
  await expect(result).resolves.toBe('cancel');
});

it('does not open a dialog for an expired request or destroyed window', async () => {
  const controller = new AbortController();
  controller.abort();
  const request = {
    id: 'selected',
    vendor: 'ledger',
    pin: 'comparison-fixture',
    signal: controller.signal,
  };
  await expect(
    createWindowsBlePairingOptions(window)?.onPairingRequest(request),
  ).resolves.toBe('cancel');
  const destroyed = { isDestroyed: () => true } as BrowserWindow;
  await expect(
    createWindowsBlePairingOptions(destroyed)?.onPairingRequest({
      ...request,
      signal: new AbortController().signal,
    }),
  ).resolves.toBe('cancel');
  expect(mockShowMessageBox).not.toHaveBeenCalled();
});

it('closes the App dialog when the installed SDK observes a Ledger disconnection', async () => {
  jest.useFakeTimers({ doNotFake: ['performance', 'setImmediate'] });
  const helper = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: Object.assign(new EventEmitter(), { write: jest.fn() }),
    kill: jest.fn(),
  });
  mockHelper = helper;
  const peripheral = Object.assign(new EventEmitter(), {
    id: 'nano',
    address: 'AA:BB:CC:DD:EE:FF',
    advertisement: { serviceUuids: ['13d63400-2c97-0004-0000-4c6564676572'] },
    rssi: -50,
    state: 'disconnected',
    connectAsync: jest.fn(async () => undefined),
    disconnectAsync: jest.fn(async () => undefined),
    discoverSomeServicesAndCharacteristicsAsync: jest.fn(async () => ({
      characteristics: [],
    })),
  });
  const noble = Object.assign(new EventEmitter(), {
    state: 'poweredOn',
    startScanningAsync: jest.fn(async () => {
      noble.emit('discover', peripheral);
    }),
    stopScanningAsync: jest.fn(async () => undefined),
  });
  const handler = new NobleBleHandler({
    nobleFactory: () => noble,
    windowsPairing: createWindowsBlePairingOptions(window),
  });
  let answer!: (result: { response: number }) => void;
  mockShowMessageBox.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = ({ response }) =>
          resolve({ response, checkboxChecked: false });
      }),
  );
  const flush = () =>
    new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  try {
    await handler.scan({ vendor: 'ledger' });
    const result = handler
      .connect('nano', {
        vendor: 'ledger',
        serviceUuid: '13d63400-2c97-0004-0000-4c6564676572',
        writeUuid: '13d63400-2c97-0004-0002-4c6564676572',
        notifyUuid: '13d63400-2c97-0004-0001-4c6564676572',
        write: { mode: 'raw', maxLength: 255 },
      })
      .catch((error: unknown) => error);
    await flush();
    helper.stdout.emit(
      'data',
      Buffer.from('{"type":"pairing","pin":"comparison-fixture"}\n'),
    );
    await flush();
    const signal = mockShowMessageBox.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    helper.stdout.emit(
      'data',
      Buffer.from('{"type":"link","connected":false}\n'),
    );
    expect(signal.aborted).toBe(true);
    answer({ response: 0 });
    await flush();
    expect(helper.stdin.write).toHaveBeenCalledTimes(1);
    expect(helper.stdin.write).toHaveBeenCalledWith(
      'cancel\n',
      expect.any(Function),
    );
    helper.emit('close', 1);
    expect(await result).toMatchObject({
      params: { deviceDisconnected: true },
    });
    expect(peripheral.connectAsync).not.toHaveBeenCalled();
  } finally {
    await handler.dispose();
    jest.useRealTimers();
  }
});
