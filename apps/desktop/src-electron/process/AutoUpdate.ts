import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import checkDiskSpace from 'check-disk-space';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log';
import { rootPath } from 'electron-root-path';
import { CancellationToken, autoUpdater } from 'electron-updater';
import { readCleartextMessage, readKey } from 'openpgp';

import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { ipcMessageKeys } from '../config';
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

const signingKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
P2Q5dClenjjjVA==
=F0np
-----END PGP PUBLIC KEY BLOCK-----
`;
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

  const getSha256 = async (downloadUrl: string) => {
    if (!signingKey) {
      return undefined;
    }
    try {
      const ascFileUrl = `${downloadUrl}.SHA256SUMS.asc`;
      const ascFile = await fetch(ascFileUrl);
      const ascFileMessage = await ascFile.text();
      logger.info('auto-updater', `signatureFileContent: ${ascFileMessage}`);

      const signedMessage = await readCleartextMessage({
        cleartextMessage: ascFileMessage,
      });
      const publicKey = await readKey({ armoredKey: signingKey });
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

  ipcMain.on(ipcMessageKeys.UPDATE_CHECK, async (_, isManual?: boolean) => {
    if (isManual) {
      isManualCheck = true;
    }
    logger.info(
      'auto-updater',
      `Update checking request (manual: ${b2t(isManualCheck)})`,
    );

    // fix the issue where the remaining space inside the read-only image is 0
    //  after loading AppImage from a read-only partition in Linux.
    const { free } = await checkDiskSpace(isLinux ? '/' : rootPath);
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
