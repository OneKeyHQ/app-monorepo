import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';
import { rootPath } from 'electron-root-path';
import { CancellationToken, autoUpdater } from 'electron-updater';
import { readCleartextMessage, readKey } from 'openpgp';

import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { ipcMessageKeys } from '../config';
import { PUBLIC_KEY } from '../constant/gpg';
import { b2t, toHumanReadable } from '../libs/utils';

import type { IDependencies } from '.';
import type { IUpdateSettings } from '../libs/store';
import type { IInstallUpdateParams, IVerifyUpdateParams } from '../preload';

const isLinux = process.platform === 'linux';

interface ILatestVersion {
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
  let updateCancellationToken: CancellationToken | undefined;
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

  const getSha256 = async (downloadUrl: string) => {
    try {
      const ascFileUrl = `${downloadUrl}.SHA256SUMS.asc`;
      const ascFile = await fetch(ascFileUrl);
      const ascFileMessage = await ascFile.text();
      logger.info('auto-updater', `signatureFileContent: ${ascFileMessage}`);

      const signedMessage = await readCleartextMessage({
        cleartextMessage: ascFileMessage,
      });
      const publicKey = await readKey({ armoredKey: PUBLIC_KEY });
      const result = await signedMessage.verify([publicKey]);
      // Get result (validity of the signature)
      const valid = await result[0].verified;
      logger.info('auto-updater', `file valid: ${String(valid)}`);
      if (valid) {
        const texts = signedMessage.getText().split(' ');
        const sha256 = texts[0];
        logger.info('auto-updater', `getSha256 from asc file: ${sha256}`);
        return sha256;
      }
    } catch (error) {
      logger.error(
        'auto-updater',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        `getSha256 Error: ${(error as any).toString()}`,
      );
      return undefined;
    }
  };

  const verifySha256 = (downloadedFile: string, sha256: string) => {
    logger.info('auto-updater', `sha256: ${sha256}`);
    const hash = crypto.createHash('sha256');
    const fileContent = fs.readFileSync(downloadedFile);
    hash.update(fileContent);
    const fileSha256 = hash.digest('hex');
    logger.info('auto-updater', `file sha256: ${fileSha256}`);
    return fileSha256 === sha256;
  };

  const sendValidError = () => {
    mainWindow.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
      err: {
        message: 'Installation package possibly compromised',
      },
      isNetworkError: false,
    });
  };

  const verifyFile = async ({
    downloadedFile = '',
    downloadUrl = '',
  }: IVerifyUpdateParams) => {
    logger.info('auto-updater', `verifyFile ${downloadedFile} ${downloadUrl}`);
    if (!downloadedFile || !downloadUrl) {
      sendValidError();
      return false;
    }
    if (!fs.existsSync(downloadedFile)) {
      logger.info('auto-updater', 'no such file');
      sendValidError();
      return false;
    }
    const sha256 = await getSha256(downloadUrl);
    if (!sha256) {
      sendValidError();
      return false;
    }

    const verified = verifySha256(downloadedFile, sha256);
    if (!verified) {
      sendValidError();
      return false;
    }

    return true;
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

    if (mainWindow.isDestroyed()) {
      void dialog
        .showMessageBox({
          type: 'error',
          buttons: ['Restart Now'],
          defaultId: 0,
          message,
        })
        .then((selection) => {
          if (selection.response === 0) {
            app.relaunch();
            app.exit();
          }
        });
    } else {
      mainWindow.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
        err: { message },
        version: latestVersion.version,
        isNetworkError: isNetworkError(err),
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
    mainWindow.webContents.send(ipcMessageKeys.UPDATE_DOWNLOADING, {
      ...progressObj,
    });
  });

  autoUpdater.on(
    'update-downloaded',
    ({ version, releaseDate, downloadedFile, files }) => {
      logger.info('auto-updater', [
        'Update downloaded:',
        `- Last version: ${version}`,
        `- Last release date: ${releaseDate}`,
        `- Downloaded file: ${downloadedFile}`,
      ]);

      const downloadUrl = files.find((file) =>
        file.url.endsWith(path.basename(downloadedFile)),
      )?.url;

      logger.info('auto-updater', [
        'Update downloaded:',
        `- Downloaded url: ${downloadUrl || ''}`,
      ]);
      mainWindow.webContents.send(ipcMessageKeys.UPDATE_DOWNLOADED, {
        version,
        downloadedFile,
        downloadUrl,
      });
    },
  );

  const clearUpdateCache = async () => {
    try {
      // @ts-ignore
      const baseCachePath = autoUpdater?.app?.baseCachePath;
      if (baseCachePath) {
        const cachePath = path.join(baseCachePath, '@onekeyhqdesktop-updater');
        logger.info('auto-updater', `cachePath: ${cachePath}`);
        const isExist = fs.existsSync(cachePath);
        if (isExist) {
          fs.rmSync(cachePath, { recursive: true, force: true });
        }
        logger.info('auto-updater', `removed: ${cachePath}`);
      }
    } catch (error) {
      logger.info('auto-updater', 'Error clearing cache: ', error);
    }
  };

  ipcMain.on(ipcMessageKeys.UPDATE_CHECK, async (_, isManual?: boolean) => {
    if (isManual) {
      isManualCheck = true;
    }
    logger.info(
      'auto-updater',
      `Update checking request (manual: ${b2t(isManualCheck)})`,
    );

    const feedUrl = `${buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Utility,
      env: updateSettings.useTestFeedUrl ? 'test' : 'prod',
    })}/utility/v1/app-update/electron-feed-url`;
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

  let isDownloading = false;
  ipcMain.on(ipcMessageKeys.UPDATE_DOWNLOAD, async () => {
    logger.info('auto-updater', 'Download requested', isDownloading);
    if (isDownloading) {
      return;
    }
    isDownloading = true;
    mainWindow.webContents.send(ipcMessageKeys.UPDATE_DOWNLOADING, {
      percent: 0,
      bytesPerSecond: 0,
      total: 0,
      transferred: 0,
    });
    if (updateCancellationToken) {
      updateCancellationToken.cancel();
    }
    await clearUpdateCache();
    updateCancellationToken = new CancellationToken();
    autoUpdater
      .downloadUpdate(updateCancellationToken)
      .then(() => logger.info('auto-updater', 'Update downloaded'))
      .catch((e: { code: string; message: string }) => {
        logger.info('auto-updater', 'Update cancelled', e);
        // CancellationError
        // node_modules/electron-updater/node_modules/builder-util-runtime/out/CancellationToken.js 104L
        if (e.message === 'cancelled') {
          return;
        }
        mainWindow.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
          err: {},
          isNetworkError: false,
        });
      })
      .finally(() => {
        isDownloading = false;
      });
  });

  ipcMain.on(
    ipcMessageKeys.UPDATE_VERIFY,
    async (_, verifyParams: IVerifyUpdateParams) => {
      const verified = await verifyFile(verifyParams);
      if (verified) {
        logger.info('auto-updater', 'update verified successfully');
        mainWindow.webContents.send(ipcMessageKeys.UPDATE_VERIFIED);
      }
    },
  );

  ipcMain.on(
    ipcMessageKeys.UPDATE_INSTALL,
    async (
      _,
      { dialog: { message, buttons }, ...verifyParams }: IInstallUpdateParams,
    ) => {
      const verified = await verifyFile(verifyParams);
      if (!verified) {
        return;
      }
      logger.info('auto-updater', 'Installation request');
      void dialog
        .showMessageBox({
          type: 'question',
          buttons,
          defaultId: 0,
          message,
        })
        .then((selection) => {
          if (selection.response === 0) {
            logger.info('auto-update', 'button[0] was clicked');
            app.removeAllListeners('window-all-closed');
            mainWindow.removeAllListeners('close');
            for (const window of BrowserWindow.getAllWindows()) {
              window.close();
              window.destroy();
            }
            autoUpdater.quitAndInstall(false);
          }
          logger.info('auto-update', 'button[1] was clicked');
        });
    },
  );

  ipcMain.on(ipcMessageKeys.UPDATE_CLEAR, async () => {
    if (updateCancellationToken) {
      updateCancellationToken.cancel();
    }
    isDownloading = false;
    await clearUpdateCache();
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
