import path from 'path';

import { app, ipcMain } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log';
import { CancellationToken, autoUpdater } from 'electron-updater';

import { b2t, toHumanReadable } from '../libs/utils';

import type { Dependencies } from '.';

interface LatestVersion {
  version: string;
  releaseDate: string;
  isManualCheck: boolean;
}

function isNetworkError(errorObject: Error) {
  return (
    errorObject.message === 'net::ERR_NETWORK_CHANGED' ||
    errorObject.message === 'net::ERR_INTERNET_DISCONNECTED' ||
    errorObject.message === 'net::ERR_PROXY_CONNECTION_FAILED' ||
    errorObject.message === 'net::ERR_CONNECTION_RESET' ||
    errorObject.message === 'net::ERR_CONNECTION_CLOSE' ||
    errorObject.message === 'net::ERR_NAME_NOT_RESOLVED' ||
    errorObject.message === 'net::ERR_CONNECTION_TIMED_OUT'
  );
}

const init = ({ mainWindow }: Dependencies) => {
  // Enable feature on FE once it's ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('update/enable');
  });

  let isManualCheck = false;
  let latestVersion: LatestVersion = {} as LatestVersion;
  let updateCancellationToken: CancellationToken;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = logger;

  logger.info('auto-updater', `updateSettings: empty`);

  autoUpdater.on('checking-for-update', () => {
    logger.info('auto-updater', 'Checking for update');
    mainWindow.webContents.send('update/checking');
  });

  autoUpdater.on('update-available', ({ version, releaseDate }) => {
    logger.warn('auto-updater', [
      'Update is available:',
      `- Update version: ${version}`,
      `- Release date: ${releaseDate}`,
      `- Manual check: ${b2t(isManualCheck)}`,
    ]);

    latestVersion = { version, releaseDate, isManualCheck };
    mainWindow.webContents.send(`update/available`, latestVersion);

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
    mainWindow.webContents.send('update/not-available', latestVersion);

    // Reset manual check flag
    isManualCheck = false;
  });

  autoUpdater.on('error', (err) => {
    logger.error('auto-updater', `An error happened: ${err.toString()}`);
    if (isNetworkError(err)) {
      mainWindow.webContents.send('update/error', {
        err,
        version: latestVersion.version,
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
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
    ({ version, releaseDate, downloadedFile }) => {
      logger.info('auto-updater', [
        'Update downloaded:',
        `- Last version: ${version}`,
        `- Last release date: ${releaseDate}`,
        `- Downloaded file: ${downloadedFile}`,
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
    }
    logger.info(
      'auto-updater',
      `Update checking request (manual: ${b2t(isManualCheck)})`,
    );

    autoUpdater.setFeedURL('https://web.onekey-asset.com/app-monorepo/assets/');
    autoUpdater.checkForUpdates().catch((error) => {
      if (isNetworkError(error)) {
        logger.info('auto-updater', `Check for update network error`);
      } else {
        logger.info(
          'auto-updater',
          `Unknown Error: ${
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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
      .then(() => logger.info('auto-updater', 'Update downloaded'))
      .catch(() => logger.info('auto-updater', 'Update cancelled'));
  });

  ipcMain.on('update/install', () => {
    logger.info('auto-updater', 'Installation request');

    // Removing listeners & closing window (https://github.com/electron-userland/electron-builder/issues/1604)
    app.removeAllListeners('window-all-closed');
    mainWindow.removeAllListeners('close');
    mainWindow.close();

    autoUpdater.quitAndInstall();
  });
};

export default init;
