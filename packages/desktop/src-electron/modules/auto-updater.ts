/* eslint-disable no-undef */

import { app, ipcMain } from 'electron';
import { autoUpdater, CancellationToken } from 'electron-updater';

const units = ['B', 'KB', 'MB', 'GB', 'TB'];

const preReleaseFlag = app.commandLine.hasSwitch('pre-release');

type UpdateInfo = {
  version: string;
  releaseDate: string;
  isManualCheck?: boolean;
  downloadedFile?: string;
};

type UpdateProgress = {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
};

export const toHumanReadable = (bytes: number): string => {
  let size = Math.abs(bytes);
  let i = 0;
  while (size >= 1024 && i <= units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(1)} ${units[i]}`;
};

export const b2t = (bool: boolean) => (bool ? 'Yes' : 'No');

function isNetworkError(errorObject: Error) {
  return (
    errorObject.message === 'net::ERR_INTERNET_DISCONNECTED' ||
    errorObject.message === 'net::ERR_PROXY_CONNECTION_FAILED' ||
    errorObject.message === 'net::ERR_CONNECTION_RESET' ||
    errorObject.message === 'net::ERR_CONNECTION_CLOSE' ||
    errorObject.message === 'net::ERR_NAME_NOT_RESOLVED' ||
    errorObject.message === 'net::ERR_CONNECTION_TIMED_OUT'
  );
}

const init = ({ mainWindow, store }: Dependencies) => {
  const { logger } = global;

  // Enable feature on FE once it's ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('update/enable');
  });

  let isManualCheck = false;
  let latestVersion = {};
  let updateCancellationToken: CancellationToken;
  const updateSettings = store.getUpdateSettings();

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = preReleaseFlag;
  autoUpdater.logger = null;

  logger.info(
    'auto-updater',
    `Is looking for pre-releases? (${b2t(preReleaseFlag)})`,
  );

  if (updateSettings.skipVersion) {
    logger.debug(
      'auto-updater',
      `Set to skip version ${updateSettings.skipVersion}`,
    );
    mainWindow.webContents.send('update/skip', updateSettings.skipVersion);
  }

  const setSkipVersion = (version: string) => {
    updateSettings.skipVersion = version;
    store.setUpdateSettings(updateSettings);
  };

  autoUpdater.on('checking-for-update', () => {
    logger.info('auto-updater', 'Checking for update');
    mainWindow.webContents.send('update/checking');
  });

  autoUpdater.on('update-available', ({ version, releaseDate }: UpdateInfo) => {
    const shouldSkip = updateSettings.skipVersion === version;
    if (shouldSkip) {
      logger.warn('auto-updater', [
        'Update is available but was skipped:',
        `- Update version: ${version}`,
        `- Skip version: ${updateSettings.skipVersion}`,
      ]);
      return;
    }

    logger.warn('auto-updater', [
      'Update is available:',
      `- Update version: ${version}`,
      `- Release date: ${releaseDate}`,
      `- Manual check: ${b2t(isManualCheck)}`,
    ]);

    latestVersion = { version, releaseDate, isManualCheck };
    mainWindow.webContents.send(
      `update/${shouldSkip ? 'skip' : 'available'}`,
      latestVersion,
    );

    // Reset manual check flag
    isManualCheck = false;
  });

  autoUpdater.on(
    'update-not-available',
    ({ version, releaseDate }: UpdateInfo) => {
      logger.info('auto-updater', [
        'No new update is available:',
        `- Last version: ${version}`,
        `- Last release date: ${releaseDate}`,
        `- Manual check: ${b2t(isManualCheck)}`,
      ]);

      latestVersion = { version, releaseDate, isManualCheck };
      mainWindow.webContents.send('update/not-available', latestVersion);

      // Reset manual check flag
      isManualCheck = false;
    },
  );

  autoUpdater.on('error', (err: Error) => {
    logger.error('auto-updater', `An error happened: ${err.toString()}`);
    mainWindow.webContents.send('update/error', err);
  });

  autoUpdater.on('download-progress', (progressObj: UpdateProgress) => {
    logger.debug(
      'auto-updater',
      `Downloading ${progressObj.percent}% (${toHumanReadable(
        progressObj.transferred,
      )}/${toHumanReadable(progressObj.total)})`,
    );
    mainWindow.webContents.send('update/downloading', { ...progressObj });
  });

  autoUpdater.on(
    'update-downloaded',
    ({ version, releaseDate, downloadedFile }: UpdateInfo) => {
      logger.info('auto-updater', [
        'Update downloaded:',
        `- Last version: ${version}`,
        `- Last release date: ${releaseDate}`,
        `- Downloaded file: ${downloadedFile ?? ''}`,
      ]);
      mainWindow.webContents.send('update/downloaded', {
        version,
        releaseDate,
        downloadedFile,
      });
    },
  );

  ipcMain.on('update/check', (_, isManual?: boolean) => {
    if (isManual) {
      isManualCheck = true;
      setSkipVersion('');
    }

    logger.info(
      'auto-updater',
      `Update checking request (manual: ${b2t(isManualCheck)})`,
    );

    // autoUpdater.setFeedURL(SS_PREFIX);
    autoUpdater.checkForUpdates().catch((error: Error) => {
      if (isNetworkError(error)) {
        logger.info('auto-updater', `Check for update network error`);
      } else {
        logger.info(
          'auto-updater',
          `Unknown Error: ${
            error == null ? 'unknown' : (error.stack || error).toString()
          }`,
        );
      }
    });
  });
  ipcMain.on('update/download', () => {
    logger.info('auto-updater', 'Download requested');
    mainWindow.webContents.send('update/downloading', {
      percent: 0,
      bytesPerSecond: 0,
      total: 0,
      transferred: 0,
    });
    updateCancellationToken = new CancellationToken();
    autoUpdater
      .downloadUpdate(updateCancellationToken)
      .then(() => {
        logger.info('auto-updater', 'Update downloaded');
      })
      .catch(() => {
        logger.info('auto-updater', 'Update cancelled');
      });
  });
  ipcMain.on('update/install', () => {
    logger.info('auto-updater', 'Installation request');

    // Removing listeners & closing window (https://github.com/electron-userland/electron-builder/issues/1604)
    app.removeAllListeners('window-all-closed');
    mainWindow.removeAllListeners('close');
    mainWindow.close();

    autoUpdater.quitAndInstall();
  });
  ipcMain.on('update/cancel', () => {
    logger.info('auto-updater', 'Cancel update request');
    mainWindow.webContents.send('update/available', latestVersion);
    updateCancellationToken.cancel();
  });
  ipcMain.on('update/skip', (_, version: string) => {
    logger.info('auto-updater', `Skip version (${version}) request`);
    mainWindow.webContents.send('update/skip', version);
    setSkipVersion(version);
  });
};

export default init;
