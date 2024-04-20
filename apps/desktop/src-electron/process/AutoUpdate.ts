import checkDiskSpace from 'check-disk-space';
import { BrowserWindow, app, ipcMain } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log';
import { rootPath } from 'electron-root-path';
import { CancellationToken, autoUpdater } from 'electron-updater';

import { ipcMessageKeys } from '../config';
import { b2t, toHumanReadable } from '../libs/utils';

import type { IDependencies } from '.';
import type { IUpdateSettings } from '../libs/store';

interface ILatestVersion {
  version: string;
  releaseDate: string;
  isManualCheck: boolean;
}

const PROD_FEEDURL = 'https://web.onekey-asset.com/app-monorepo/assets/';
const TEST_FEEDURL = 'https://web.onekey-asset.com/app-monorepo/pre-release/';

function isNetworkError(errorObject: Error) {
  return (
    errorObject.message === 'net::ERR_NETWORK_CHANGED' ||
    errorObject.message === 'net::ERR_INTERNET_DISCONNECTED' ||
    errorObject.message === 'net::ERR_PROXY_CONNECTION_FAILED' ||
    errorObject.message === 'net::ERR_CONNECTION_RESET' ||
    errorObject.message === 'net::ERR_CONNECTION_CLOSE' ||
    errorObject.message === 'net::ERR_NAME_NOT_RESOLVED' ||
    errorObject.message === 'net::ERR_CONNECTION_TIMED_OUT' ||
    errorObject.message === 'net::ERR_CONNECTION_CLOSED'
  );
}

const init = ({ mainWindow, store }: IDependencies) => {
  // Enable feature on FE once it's ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('update/enable');
  });

  let isManualCheck = false;
  let latestVersion: ILatestVersion = {} as ILatestVersion;
  let updateCancellationToken: CancellationToken;
  const updateSettings = store.getUpdateSettings();

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = logger;

  logger.info(
    'auto-updater',
    `updateSettings: ${JSON.stringify(updateSettings)}`,
  );

  const setUseTestFeedUrl = (useTestFeedUrl: boolean) => {
    updateSettings.useTestFeedUrl = useTestFeedUrl;
    store.setUpdateSettings(updateSettings);
  };

  autoUpdater.on('checking-for-update', () => {
    logger.info('auto-updater', 'Checking for update');
    mainWindow.webContents.send(ipcMessageKeys.UPDATE_CHECKING);
  });

  autoUpdater.on('update-available', ({ version, releaseDate }) => {
    logger.warn('auto-updater', [
      'Update is available:',
      `- Update version: ${version}`,
      `- Release date: ${releaseDate}`,
      `- Manual check: ${b2t(isManualCheck)}`,
    ]);

    latestVersion = { version, releaseDate, isManualCheck };
    mainWindow.webContents.send(ipcMessageKeys.UPDATE_AVAILABLE, latestVersion);

    // Reset manual check flag
    isManualCheck = false;
  });

  autoUpdater.on('update-not-available', (data) => {
    const { version, releaseDate } = data;
    logger.info('auto-updater', [
      'No new update is available:',
      `- Last version: ${version}`,
      `- Last release date: ${releaseDate}`,
      `- Manual check: ${b2t(isManualCheck)}`,
    ]);

    latestVersion = { version, releaseDate, isManualCheck };
    mainWindow.webContents.send(
      ipcMessageKeys.UPDATE_NOT_AVAILABLE,
      latestVersion,
    );

    // Reset manual check flag
    isManualCheck = false;
  });

  autoUpdater.on('error', (err) => {
    logger.error('auto-updater', `An error happened: ${err.toString()}`);
    const isNetwork = isNetworkError(err);
    let message = isNetwork
      ? 'Network exception, please check your internet connection.'
      : err.message;
    if (err.message.includes('sha512 checksum mismatch')) {
      message = 'Installation package possibly compromised';
    }

    mainWindow.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
      err: { message },
      version: latestVersion.version,
      isNetworkError: isNetworkError(err),
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.debug(
      'auto-updater',
      `Downloading ${progressObj.percent}% (${toHumanReadable(
        progressObj.transferred,
      )}/${toHumanReadable(progressObj.total)})`,
    );
    mainWindow.webContents.send(ipcMessageKeys.UPDATE_DOWNLOADING, {
      ...progressObj,
    });
  });

  autoUpdater.on(
    'update-downloaded',
    ({ version, releaseDate, downloadedFile }) => {
      logger.info('auto-updater', [
        'Update downloaded:',
        `- Last version: ${version}`,
        `- Last release date: ${releaseDate}`,
        `- Downloaded file: ${downloadedFile}`,
      ]);
      mainWindow.webContents.send(ipcMessageKeys.UPDATE_DOWNLOADED, {
        version,
        releaseDate,
        downloadedFile,
      });
    },
  );

  ipcMain.on(ipcMessageKeys.UPDATE_CHECK, async (_, isManual?: boolean) => {
    if (isManual) {
      isManualCheck = true;
    }
    logger.info(
      'auto-updater',
      `Update checking request (manual: ${b2t(isManualCheck)})`,
    );

    const { free } = await checkDiskSpace(rootPath);
    logger.info('check-free-space', `${free} ${rootPath}`);
    if (free < 1024 * 1024 * 300) {
      mainWindow.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
        err: {
          message: 'Insufficient disk space, please clear and retry.',
        },
        isNetworkError: false,
      });
      return;
    }
    const feedUrl = updateSettings.useTestFeedUrl ? TEST_FEEDURL : PROD_FEEDURL;
    autoUpdater.setFeedURL(feedUrl);
    logger.info('current feed url: ', feedUrl);
    if (isDev) {
      Object.defineProperty(app, 'isPackaged', {
        get() {
          return true;
        },
      });
    }
    autoUpdater.checkForUpdates().catch((error) => {
      if (isNetworkError(error)) {
        logger.info('auto-updater', `Check for update network error`);
      } else {
        logger.info(
          'auto-updater',
          `Unknown Error: ${
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            error == null ? 'unknown' : (error?.stack || error)?.toString()
          }`,
        );
        mainWindow.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
          err: error,
          version: null,
          isNetworkError: false,
        });
      }
    });
  });

  ipcMain.on(ipcMessageKeys.UPDATE_DOWNLOAD, () => {
    logger.info('auto-updater', 'Download requested');
    mainWindow.webContents.send(ipcMessageKeys.UPDATE_DOWNLOADING, {
      percent: 0,
      bytesPerSecond: 0,
      total: 0,
      transferred: 0,
    });
    updateCancellationToken = new CancellationToken();
    autoUpdater
      .downloadUpdate(updateCancellationToken)
      .then(() => logger.info('auto-updater', 'Update downloaded'))
      .catch(() => {
        logger.info('auto-updater', 'Update cancelled');
        mainWindow.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
          err: {},
          isNetworkError: false,
        });
      });
  });

  ipcMain.on(ipcMessageKeys.UPDATE_INSTALL, () => {
    logger.info('auto-updater', 'Installation request');

    // Removing listeners & closing window (https://github.com/electron-userland/electron-builder/issues/1604)
    setImmediate(() => {
      app.removeAllListeners('window-all-closed');
      mainWindow.removeAllListeners('close');
      for (const window of BrowserWindow.getAllWindows()) {
        window.close();
        window.destroy();
      }
      setTimeout(() => autoUpdater.quitAndInstall(false), 1000);
    });
  });

  ipcMain.on(ipcMessageKeys.UPDATE_SETTINGS, (_, settings: IUpdateSettings) => {
    logger.info('auto-update', 'Set setting: ', JSON.stringify(settings));
    setUseTestFeedUrl((settings ?? {}).useTestFeedUrl ?? false);
  });

  ipcMain.on(ipcMessageKeys.UPDATE_CLEAR_SETTINGS, () => {
    logger.info('auto-update', 'clear update settings');
    store.clear();
  });
};

export default init;
