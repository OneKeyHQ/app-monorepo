import fs from 'fs';
import os from 'os';
import path from 'path';

import { EAppUpdatePackageAvailabilityStatus } from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';

const mockUpdaterHandlers = new Map<string, (...args: unknown[]) => void>();
const mockDownloadUpdate = jest.fn<Promise<string[]>, [unknown]>();
const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};
const mockOpenPath = jest.fn();
const mockAutoUpdater = {
  app: { baseCachePath: '' },
  autoDownload: false,
  autoInstallOnAppQuit: false,
  checkForUpdates: jest.fn(),
  disableDifferentialDownload: false,
  downloadUpdate: mockDownloadUpdate,
  forceDevUpdateConfig: false,
  logger: mockLogger,
  on: jest.fn((event: string, handler: (...args: unknown[]) => void): void => {
    mockUpdaterHandlers.set(event, handler);
  }),
  quitAndInstall: jest.fn(),
  requestHeaders: {},
  setFeedURL: jest.fn(),
};

jest.mock('electron-updater', () => ({
  CancellationToken: class {
    cancel = jest.fn();
  },
  autoUpdater: mockAutoUpdater,
}));

jest.mock('electron', () => ({
  BrowserWindow: { getAllWindows: jest.fn(() => []) },
  app: {
    exit: jest.fn(),
    isReady: jest.fn(() => true),
    relaunch: jest.fn(),
    whenReady: jest.fn(async () => undefined),
  },
  autoUpdater: { once: jest.fn() },
  dialog: { showMessageBox: jest.fn() },
  shell: { openPath: mockOpenPath },
}));

jest.mock('electron-is-dev', () => ({ __esModule: true, default: false }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('openpgp', () => ({
  readCleartextMessage: jest.fn(),
  readKey: jest.fn(),
}));
jest.mock('@onekeyhq/desktop/app/config', () => ({
  ipcMessageKeys: new Proxy({}, { get: () => 'ipc-key' }),
}));
jest.mock('@onekeyhq/desktop/app/constant/gpg', () => ({ PUBLIC_KEY: '' }));
jest.mock('@onekeyhq/desktop/app/i18n', () => ({
  ElectronTranslations: new Proxy({}, { get: (_, key) => String(key) }),
  i18nText: (key: string) => key,
}));
jest.mock(
  '@onekeyhq/desktop/app/libs/store',
  () => new Proxy({}, { get: () => jest.fn() }),
);
jest.mock('@onekeyhq/desktop/app/libs/utils', () => ({
  b2t: (value: boolean) => String(value),
  toHumanReadable: (value: number) => String(value),
}));
jest.mock('@onekeyhq/desktop/app/windowProgressBar', () => ({
  clearWindowProgressBar: jest.fn(),
  updateWindowProgressBar: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  buildServiceEndpoint: jest.fn(() => 'https://example.com'),
}));
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest.fn(
    async (_url: string, headers: Record<string, string>) => headers,
  ),
}));

let DesktopApiAppUpdate: typeof import('./DesktopApiAppUpdate').default;
let originalPlatformDescriptor: PropertyDescriptor | undefined;
let originalSkipGPGVerification: string | undefined;
let tempDir: string;

const mainWindow = {
  isDestroyed: jest.fn(() => false),
  webContents: { send: jest.fn() },
};

function emitUpdaterEvent(event: string, payload: unknown) {
  mockUpdaterHandlers.get(event)?.(payload);
}

function createCachedPackage() {
  const cacheDir = path.join(tempDir, '@onekeyhqdesktop-updater', 'pending');
  fs.mkdirSync(cacheDir, { recursive: true });
  const downloadedFile = path.join(cacheDir, 'app.zip');
  fs.writeFileSync(downloadedFile, 'cached package');
  return downloadedFile;
}

beforeAll(async () => {
  originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
    process,
    'platform',
  );
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  ({ default: DesktopApiAppUpdate } = await import('./DesktopApiAppUpdate'));
});

afterAll(() => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(process, 'platform', originalPlatformDescriptor);
  }
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUpdaterHandlers.clear();
  mockDownloadUpdate.mockReset();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-app-update-'));
  mockAutoUpdater.app.baseCachePath = tempDir;
  originalSkipGPGVerification = process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  (
    globalThis as unknown as {
      $desktopMainAppFunctions: {
        getSafelyMainWindow: () => typeof mainWindow;
      };
    }
  ).$desktopMainAppFunctions = {
    getSafelyMainWindow: () => mainWindow,
  };
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  if (originalSkipGPGVerification === undefined) {
    delete process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION;
  } else {
    process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION =
      originalSkipGPGVerification;
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('DesktopApiAppUpdate macOS cache rehydrate', () => {
  test('preserves a valid unprepared package for one rehydrate attempt', async () => {
    const downloadedFile = createCachedPackage();
    const api = new DesktopApiAppUpdate({ desktopApi: {} as never });
    const availability =
      await api.getDownloadedFileAvailability(downloadedFile);
    const removeSpy = jest.spyOn(fs, 'rmSync');
    mockDownloadUpdate.mockImplementationOnce(async () => {
      emitUpdaterEvent('update-downloaded', {
        downloadedFile,
        files: [{ url: 'https://example.com/app.zip' }],
        releaseDate: '2026-08-12',
        version: '6.0.0',
      });
      return [downloadedFile];
    });

    expect(availability).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.notPrepared,
    });

    await api.downloadUpdate();

    expect(removeSpy).not.toHaveBeenCalled();
    expect(api.downloadedEvent?.downloadedFile).toBe(downloadedFile);
    expect(api.downloadedEvent?.isUpdaterRehydrated).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'auto-updater',
      expect.arrayContaining(['Mac updater cache rehydrate prepared:']),
    );
  });

  test('uses the normal cache-clearing download after rehydrate fails', async () => {
    const downloadedFile = createCachedPackage();
    const cachePath = path.join(tempDir, '@onekeyhqdesktop-updater');
    const api = new DesktopApiAppUpdate({ desktopApi: {} as never });
    await api.getDownloadedFileAvailability(downloadedFile);
    const removeSpy = jest.spyOn(fs, 'rmSync');
    const rehydrateError = Object.assign(new Error('cache read failed'), {
      code: 'EIO',
    });
    mockDownloadUpdate.mockRejectedValueOnce(rehydrateError);

    await expect(api.downloadUpdate()).rejects.toBe(rehydrateError);
    expect(removeSpy).not.toHaveBeenCalled();

    mockDownloadUpdate.mockResolvedValueOnce([]);
    await api.downloadUpdate();

    expect(removeSpy).toHaveBeenCalledWith(cachePath, {
      recursive: true,
      force: true,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'auto-updater',
      expect.arrayContaining([
        'Mac updater cache rehydrate failed:',
        '- Error code: EIO',
        '- Next action: retry with cache clear',
      ]),
    );
  });

  test('logs when cache validation falls back to a network download', async () => {
    const downloadedFile = createCachedPackage();
    const api = new DesktopApiAppUpdate({ desktopApi: {} as never });
    await api.getDownloadedFileAvailability(downloadedFile);
    mockDownloadUpdate.mockImplementationOnce(async () => {
      emitUpdaterEvent('download-progress', {
        bytesPerSecond: 1,
        delta: 1,
        percent: 1,
        total: 100,
        transferred: 1,
      });
      emitUpdaterEvent('update-downloaded', {
        downloadedFile,
        files: [{ url: 'https://example.com/app.zip' }],
        releaseDate: '2026-08-12',
        version: '6.0.0',
      });
      return [downloadedFile];
    });

    await api.downloadUpdate();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'auto-updater',
      expect.arrayContaining([
        'Mac updater cache rehydrate is using network fallback:',
      ]),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'auto-updater',
      expect.arrayContaining(['- Network progress observed: true']),
    );
  });

  test('keeps the candidate when metadata checking fails before rehydrate starts', async () => {
    const downloadedFile = createCachedPackage();
    const api = new DesktopApiAppUpdate({ desktopApi: {} as never });
    await api.getDownloadedFileAvailability(downloadedFile);
    emitUpdaterEvent('error', new Error('net::ERR_CONNECTION_RESET'));
    const removeSpy = jest.spyOn(fs, 'rmSync');
    mockDownloadUpdate.mockResolvedValueOnce([]);

    await api.downloadUpdate();

    expect(removeSpy).not.toHaveBeenCalled();
  });

  test('manual install can open a valid package without MacUpdater preparation', async () => {
    const downloadedFile = createCachedPackage();
    const api = new DesktopApiAppUpdate({ desktopApi: {} as never });
    process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION = 'true';
    mockOpenPath.mockResolvedValueOnce('');

    await expect(
      api.manualInstallPackage({
        buildNumber: '1',
        downloadedFile,
        downloadUrl: 'https://example.com/app.zip',
        skipGPGVerification: true,
      }),
    ).resolves.toBeUndefined();

    expect(mockOpenPath).toHaveBeenCalledWith(path.dirname(downloadedFile));
  });
});
