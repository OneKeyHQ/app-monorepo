const fs = require('fs');
const os = require('os');
const path = require('path');

const { AppUpdater } = require('electron-updater/out/AppUpdater');
const { BaseUpdater } = require('electron-updater/out/BaseUpdater');

describe('electron-updater runtime patch', () => {
  test('resets cached update-check state before a retry', async () => {
    const getOrCreateStagingUserId = jest.fn().mockResolvedValue('staging-id');
    const previousStagingPromise = {};
    const updater = {
      checkForUpdatesPromise: null,
      clientPromise: Promise.resolve({}),
      downloadPromise: null,
      getOrCreateStagingUserId,
      stagingUserIdPromise: previousStagingPromise,
      updateInfoAndProvider: {},
      _logger: { info: jest.fn() },
    };

    expect(AppUpdater.prototype.resetForRetry.call(updater)).toBe(true);
    expect(updater.clientPromise).toBeNull();
    expect(updater.stagingUserIdPromise).not.toBe(previousStagingPromise);
    expect(updater.updateInfoAndProvider).toBeNull();
    await expect(updater.stagingUserIdPromise.value).resolves.toBe(
      'staging-id',
    );
    expect(getOrCreateStagingUserId).toHaveBeenCalledTimes(1);
  });

  test('does not reset updater state while a check is active', () => {
    const clientPromise = Promise.resolve({});
    const stagingUserIdPromise = {};
    const updateInfoAndProvider = {};
    const updater = {
      checkForUpdatesPromise: Promise.resolve(null),
      clientPromise,
      downloadPromise: null,
      stagingUserIdPromise,
      updateInfoAndProvider,
      _logger: { info: jest.fn() },
    };

    expect(AppUpdater.prototype.resetForRetry.call(updater)).toBe(false);
    expect(updater.clientPromise).toBe(clientPromise);
    expect(updater.stagingUserIdPromise).toBe(stagingUserIdPromise);
    expect(updater.updateInfoAndProvider).toBe(updateInfoAndProvider);
  });

  test('rebuilds a rejected staging ID cache so the next check succeeds', async () => {
    const failure = new Error('staging ID failed');
    const getOrCreateStagingUserId = jest
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('staging-id');
    const updater = {
      checkForUpdatesPromise: null,
      clientPromise: null,
      doCheckForUpdates: jest.fn(() => updater.stagingUserIdPromise.value),
      downloadPromise: null,
      emit: jest.fn(),
      getOrCreateStagingUserId,
      isUpdaterActive: jest.fn().mockReturnValue(true),
      resetForRetry: AppUpdater.prototype.resetForRetry,
      stagingUserIdPromise: null,
      updateInfoAndProvider: null,
      _logger: { info: jest.fn() },
    };
    AppUpdater.prototype.resetForRetry.call(updater);

    await expect(
      AppUpdater.prototype.checkForUpdates.call(updater),
    ).rejects.toBe(failure);
    expect(updater.emit).toHaveBeenCalledWith(
      'error',
      failure,
      expect.stringContaining('Cannot check for updates'),
    );
    expect(updater.checkForUpdatesPromise).toBeNull();

    await expect(
      AppUpdater.prototype.checkForUpdates.call(updater),
    ).resolves.toBe('staging-id');
    expect(getOrCreateStagingUserId).toHaveBeenCalledTimes(2);
  });

  test('rehydrates the persisted installer metadata after an app restart', async () => {
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'electron-updater-test-'),
    );
    const downloadedFileInfo = {
      fileName: 'OneKey-Wallet-9906.17.0-win-x64.exe',
      sha512: 'sha512-value',
      isAdminRightsRequired: false,
    };
    const downloadedUpdateHelper = {
      cacheDirForPendingUpdate: cacheDir,
      updateFile: jest.fn(),
      updateDownloadedFileInfo: jest.fn(),
    };
    const updater = {
      downloadedUpdateHelper,
      _logger: { info: jest.fn() },
    };

    try {
      fs.writeFileSync(
        path.join(cacheDir, 'update-info.json'),
        JSON.stringify(downloadedFileInfo),
      );

      await BaseUpdater.prototype.updateInstallerPath.call(
        updater,
        'C:\\Users\\asus\\AppData\\Local\\OneKey\\pending\\installer.exe',
      );

      expect(downloadedUpdateHelper.updateFile).toHaveBeenCalledWith(
        'C:\\Users\\asus\\AppData\\Local\\OneKey\\pending\\installer.exe',
      );
      expect(
        downloadedUpdateHelper.updateDownloadedFileInfo,
      ).toHaveBeenCalledWith(downloadedFileInfo);
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});
