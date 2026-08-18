const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { AppUpdater } = require('electron-updater/out/AppUpdater');
const { BaseUpdater } = require('electron-updater/out/BaseUpdater');
const {
  DownloadedUpdateHelper,
} = require('electron-updater/out/DownloadedUpdateHelper');

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

  test('rehydrates a cached installer through the upstream validation path', async () => {
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'electron-updater-test-'),
    );
    const helper = new DownloadedUpdateHelper(cacheDir);
    const pendingDir = helper.cacheDirForPendingUpdate;
    const fileName = 'OneKey-Wallet-6.6.0-win-x64.exe';
    const installerPath = path.join(pendingDir, fileName);
    const installer = 'verified installer';
    const sha512 = crypto
      .createHash('sha512')
      .update(installer)
      .digest('base64');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(installerPath, installer);
    fs.writeFileSync(
      path.join(pendingDir, 'update-info.json'),
      JSON.stringify({
        fileName,
        sha512,
        isAdminRightsRequired: false,
        version: '6.6.0',
      }),
    );

    try {
      await expect(
        helper.validateDownloadedPath(
          installerPath,
          { version: '6.6.0' },
          { info: { sha512 } },
          { info: jest.fn(), warn: jest.fn() },
        ),
      ).resolves.toBe(installerPath);
      expect(helper.file).toBe(installerPath);
      expect(helper.downloadedFileInfo).toMatchObject({ version: '6.6.0' });
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  test('rejects cached metadata for a different trusted feed version', async () => {
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'electron-updater-test-'),
    );
    const helper = new DownloadedUpdateHelper(cacheDir);
    const pendingDir = helper.cacheDirForPendingUpdate;
    const fileName = 'OneKey-Wallet.exe';
    const installerPath = path.join(pendingDir, fileName);
    const sha512 = crypto
      .createHash('sha512')
      .update('same installer bytes')
      .digest('base64');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(installerPath, 'same installer bytes');
    fs.writeFileSync(
      path.join(pendingDir, 'update-info.json'),
      JSON.stringify({
        fileName,
        sha512,
        isAdminRightsRequired: false,
        version: '6.5.0',
      }),
    );

    try {
      await expect(
        helper.validateDownloadedPath(
          installerPath,
          { version: '6.6.0' },
          { info: { sha512 } },
          { info: jest.fn(), warn: jest.fn() },
        ),
      ).resolves.toBeNull();
      expect(helper.file).toBeNull();
      expect(fs.existsSync(installerPath)).toBe(false);
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  test('only accepts the updater-bound installer path', () => {
    const updater = {
      downloadedUpdateHelper: {
        file: '/tmp/OneKey-Wallet-verified.zip',
      },
    };

    expect(
      BaseUpdater.prototype.isInstallerPath.call(
        updater,
        '/tmp/OneKey-Wallet-verified.zip',
      ),
    ).toBe(true);
    expect(
      BaseUpdater.prototype.isInstallerPath.call(
        updater,
        '/tmp/OneKey-Wallet-stale.zip',
      ),
    ).toBe(false);
  });
});
