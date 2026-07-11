const fs = require('fs');
const os = require('os');
const path = require('path');

const { BaseUpdater } = require('electron-updater/out/BaseUpdater');

describe('electron-updater runtime patch', () => {
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
