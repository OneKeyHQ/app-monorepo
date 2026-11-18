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

const originalPlatform = process.platform;
const window = { isDestroyed: () => false } as BrowserWindow;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(process, 'platform', { value: 'win32' });
});
afterEach(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
);

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
