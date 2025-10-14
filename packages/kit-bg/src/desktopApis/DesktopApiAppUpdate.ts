import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { BrowserWindow, app, dialog } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';
import { CancellationToken, autoUpdater } from 'electron-updater';
import { readCleartextMessage, readKey } from 'openpgp';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import { PUBLIC_KEY } from '@onekeyhq/desktop/app/constant/gpg';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ETranslations, i18nText } from '@onekeyhq/desktop/app/i18n';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { b2t, toHumanReadable } from '@onekeyhq/desktop/app/libs/utils';
import type { IInstallUpdateParams } from '@onekeyhq/desktop/app/preload';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IUpdateDownloadedEvent } from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import type { IDesktopApi } from './base/types';
import type { UpdateCheckResult } from 'electron-updater';

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

async function clearUpdateCache() {
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
}

function buildFeedUrl(useTestFeedUrl: boolean, latestVersion: string) {
  return `${buildServiceEndpoint({
    serviceName: EServiceEndpointEnum.Utility,
    env: useTestFeedUrl ? 'test' : 'prod',
  })}/utility/v1/app-update/electron-feed-url?version=${latestVersion}`;
}

export interface ILatestVersion {
  version: string;
  releaseDate: string;
  isManualCheck?: boolean;
}

export interface IUpdateProgressUpdate {
  percent: number;
  delta: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.disableDifferentialDownload = true;
autoUpdater.logger = logger;

const isMas = process.mas;
const isSnapStore = process.platform === 'linux' && process.env.SNAP;
const isWindowsMsStore =
  process.platform === 'win32' && process.env.DESK_CHANNEL === 'ms-store';

const isStoreVersion = isMas || isSnapStore || isWindowsMsStore;

class DesktopApiAppUpdate {
  desktopApi: IDesktopApi;

  isManualCheck: boolean;

  latestVersion: ILatestVersion;

  isDownloading: boolean;

  downloadedEvent: IUpdateDownloadedEvent;

  updateCancellationToken: CancellationToken | undefined;

  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.isManualCheck = false;
    this.latestVersion = {} as ILatestVersion;
    this.isDownloading = false;
    this.downloadedEvent = {} as IUpdateDownloadedEvent;
    if (!isStoreVersion) {
      void app.whenReady().then(() => {
        this.initAppAutoUpdateEvents();
      });
    }
    if (isDev) {
      Object.defineProperty(app, 'isPackaged', {
        get() {
          return true;
        },
      });
      autoUpdater.forceDevUpdateConfig = true;
    }
  }

  getMainWindow(): BrowserWindow | undefined {
    return globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
  }

  initAppAutoUpdateEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      logger.info('auto-updater', 'Checking for update');
    });

    autoUpdater.on('update-download-fileInfo', (fileInfo) => {
      logger.info('update-download-fileInfo', fileInfo.info.url);
      this.getMainWindow()?.webContents.send(
        ipcMessageKeys.UPDATE_DOWNLOAD_FILE_INFO,
        fileInfo.info.url,
      );
    });

    autoUpdater.on('update-available', ({ version, releaseDate }) => {
      logger.warn('auto-updater', [
        'Update is available:',
        `- Update version: ${version}`,
        `- Release date: ${releaseDate}`,
        `- Manual check: ${b2t(this.isManualCheck)}`,
      ]);

      this.latestVersion = {
        version,
        releaseDate,
        isManualCheck: this.isManualCheck,
      };
      //   this.getMainWindow()?.webContents.send(
      //     ipcMessageKeys.UPDATE_AVAILABLE,
      //     this.latestVersion,
      //   );

      // Reset manual check flag
      this.isManualCheck = false;
    });

    autoUpdater.on('update-not-available', (data) => {
      const { version, releaseDate } = data;
      logger.info('auto-updater', [
        'No new update is available:',
        `- Last version: ${version}`,
        `- Last release date: ${releaseDate}`,
        `- Manual check: ${b2t(this.isManualCheck)}`,
      ]);

      this.latestVersion = {
        version,
        releaseDate,
        isManualCheck: this.isManualCheck,
      };
      //   this.getMainWindow()?.webContents.send(
      //     ipcMessageKeys.UPDATE_NOT_AVAILABLE,
      //     this.latestVersion,
      //   );

      // Reset manual check flag
      this.isManualCheck = false;
    });

    autoUpdater.on('error', (err) => {
      logger.error('auto-updater', `An error happened: ${err.toString()}`);
      const mainWindow = this.getMainWindow();
      if (!mainWindow) {
        return;
      }
      const isNetwork = isNetworkError(err);
      const message = isNetwork
        ? 'Network exception, please check your internet connection.'
        : err.message;

      this.isDownloading = false;
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
          message,
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
      this.getMainWindow()?.webContents.send(
        ipcMessageKeys.UPDATE_DOWNLOADING,
        {
          percent: progressObj.percent,
          delta: progressObj.delta,
          bytesPerSecond: progressObj.bytesPerSecond,
          total: progressObj.total,
          transferred: progressObj.transferred,
        },
      );
    });

    autoUpdater.on(
      'update-downloaded',
      ({ version, releaseDate, downloadedFile, files }) => {
        const downloadUrl = files.find((file) =>
          file.url.endsWith(path.basename(downloadedFile)),
        )?.url;

        logger.info('auto-updater', [
          'Update downloaded:',
          `- Last version: ${version}`,
          `- Last release date: ${releaseDate}`,
          `- Downloaded file: ${downloadedFile}`,
          `- Downloaded url: ${downloadUrl || ''}`,
        ]);
        this.getMainWindow()?.webContents.send(
          ipcMessageKeys.UPDATE_DOWNLOADED,
          {
            version,
            downloadedFile,
            downloadUrl,
          },
        );
        setTimeout(() => {
          this.isDownloading = false;
        }, 2500);
      },
    );
  }

  async isDownloadingPackage(): Promise<boolean> {
    return this.isDownloading;
  }

  async checkDownloadedFileExists(downloadedFile: string): Promise<boolean> {
    return fs.existsSync(downloadedFile);
  }

  async clearUpdateCache(): Promise<void> {
    if (this.updateCancellationToken) {
      this.updateCancellationToken.cancel();
    }
    this.isDownloading = false;
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
  }

  async clearUpdateSettings(): Promise<void> {
    logger.info('auto-update', 'clear update settings');
    store.clearUpdateSettings();
  }

  async checkForUpdates(
    isManual = false,
    requestHeaders = {},
    latestVersion: string,
  ): Promise<UpdateCheckResult['updateInfo'] | null> {
    if (isManual) {
      this.isManualCheck = true;
    }

    logger.info('auto-updater', 'latestVersion is ', latestVersion);
    if (!latestVersion) {
      return null;
    }
    logger.info(
      'auto-updater',
      `Update checking request (manual: ${b2t(this.isManualCheck)})`,
    );

    const updateSettings = store.getUpdateSettings();

    const feedUrl = buildFeedUrl(updateSettings.useTestFeedUrl, latestVersion);
    autoUpdater.setFeedURL({
      url: feedUrl,
      requestHeaders,
      provider: 'generic',
    });
    autoUpdater.requestHeaders = requestHeaders;
    logger.info('auto-updater', 'request headers: ', requestHeaders);
    logger.info('current feed url: ', feedUrl);
    try {
      const result = await autoUpdater.checkForUpdates();
      logger.info('auto-updater', 'checkForUpdates result: =>>>> ', result);
      if (result) {
        return result.updateInfo;
      }
      return null;
    } catch (error) {
      if (isNetworkError(error as Error)) {
        logger.info('auto-updater', `Check for update network error`);
      } else {
        logger.info('auto-updater', `Unknown Error: ${String(error)}`);
      }
      throw error;
    }
  }

  async downloadUpdate(): Promise<void> {
    logger.info('auto-updater', 'Download requested', this.isDownloading);
    if (this.isDownloading) {
      return;
    }
    store.setUpdateBuildNumber('');
    logger.info(
      'auto-updater',
      'Update build number: ',
      store.getUpdateBuildNumber(),
    );
    this.isDownloading = true;
    const mainWindow = this.getMainWindow();
    if (!mainWindow) {
      return;
    }
    mainWindow.webContents.send(ipcMessageKeys.UPDATE_DOWNLOADING, {
      percent: 0,
      bytesPerSecond: 0,
      total: 0,
      transferred: 0,
    });
    if (this.updateCancellationToken) {
      this.updateCancellationToken.cancel();
    }
    await clearUpdateCache();
    this.updateCancellationToken = new CancellationToken();

    try {
      logger.info('auto-updater', 'Download update');
      await autoUpdater.downloadUpdate(this.updateCancellationToken);
      logger.info('auto-updater', 'Download update success');
    } catch (e) {
      this.isDownloading = false;
      logger.info('auto-updater', 'Update cancelled', e);
      // CancellationError
      // node_modules/electron-updater/node_modules/builder-util-runtime/out/CancellationToken.js 104L
      if ((e as Error).message !== 'cancelled') {
        throw e;
      }
    }
  }

  async downloadAndVerifyASC(params: IInstallUpdateParams): Promise<boolean> {
    const { downloadedFile, downloadUrl } = params;
    store.clearASCFile();
    logger.info(
      'auto-updater',
      'Download ASC requested',
      downloadedFile,
      downloadUrl,
    );

    if (!downloadedFile || !fs.existsSync(downloadedFile)) {
      logger.info('auto-updater', 'no such file');
      throw new OneKeyLocalError('NOT_FOUND_FILE');
    }

    if (downloadUrl) {
      try {
        const ascFileUrl = `${downloadUrl}.SHA256SUMS.asc`;
        const ascFileResponse = await fetch(ascFileUrl);

        if (!ascFileResponse.ok) {
          logger.error(
            'auto-updater',
            `Failed to fetch ASC file: ${ascFileResponse.status} ${ascFileResponse.statusText}`,
          );
          throw new OneKeyLocalError('FAILED_TO_FETCH_ASC_FILE');
        }

        const ascFileMessage = await ascFileResponse.text();
        if (ascFileMessage.length === 0) {
          throw new OneKeyLocalError('FAILED_TO_FETCH_ASC_FILE');
        }
        store.setASCFile(ascFileMessage);
      } catch (error) {
        logger.error('auto-updater', 'Failed to fetch ASC file', error);
        throw error;
      }
    }
    return true;
  }

  async downloadASC(params: IInstallUpdateParams): Promise<boolean> {
    logger.info('auto-updater', 'Download ASC requested', params);
    const valid = await this.downloadAndVerifyASC(params);
    return valid;
  }

  async getSha256AndVerifyASC(params: IInstallUpdateParams): Promise<boolean> {
    logger.info('auto-updater', 'Get SHA256 and Verify ASC requested', params);
    const valid = await this.downloadAndVerifyASC(params);
    return valid;
  }

  async getSha256(): Promise<string> {
    try {
      const ascFileMessage = store.getASCFile();
      if (!ascFileMessage) {
        return '';
      }
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
      throw new OneKeyLocalError(
        ETranslations.update_signature_verification_failed_alert_text,
      );
    } catch (error) {
      logger.error(
        'auto-updater',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        `getSha256 Error: ${(error as any).toString()}`,
      );
      const { message } = error as { message: string };

      const lowerCaseMessage = message.toLowerCase();
      const isInValid =
        lowerCaseMessage.includes('signed digest did not match') ||
        lowerCaseMessage.includes('misformed armored text') ||
        lowerCaseMessage.includes('ascii armor integrity check failed');
      throw new OneKeyLocalError(
        isInValid
          ? ETranslations.update_signature_verification_failed_alert_text
          : ETranslations.update_installation_package_possibly_compromised,
      );
    }
  }

  async verifySha256(downloadedFile: string, sha256: string): Promise<boolean> {
    logger.info('auto-updater', `sha256: ${sha256}`);
    const hash = crypto.createHash('sha256');
    const fileContent = fs.readFileSync(downloadedFile);
    hash.update(fileContent);
    const fileSha256 = hash.digest('hex');
    logger.info('auto-updater', `file sha256: ${fileSha256}`);
    return fileSha256 === sha256;
  }

  async verifyASC(): Promise<boolean> {
    logger.info('auto-updater', 'Verify ASC requested');
    const sha256 = await this.getSha256();
    return !!sha256;
  }

  async verifyFile(verifyParams: IInstallUpdateParams): Promise<boolean> {
    const { downloadedFile, downloadUrl } = verifyParams;
    if (!downloadedFile || !downloadUrl) {
      logger.info('auto-updater', 'no such file');
      return false;
    }
    logger.info('auto-updater', `verifyFile ${downloadedFile} ${downloadUrl}`);

    const sha256 = await this.getSha256();
    if (!sha256) {
      //   sendValidError();
      return false;
    }

    try {
      const verified = await this.verifySha256(downloadedFile, sha256);
      if (!verified) {
        // sendValidError();
        return false;
      }
    } catch (error) {
      logger.info('auto-updater', 'verifyFile error', error);
      throw new OneKeyLocalError(
        ETranslations.update_installation_package_possibly_compromised,
      );
    }

    return true;
  }

  async verifyPackage(verifyParams: IInstallUpdateParams): Promise<boolean> {
    const verified = await this.verifyFile(verifyParams);
    return verified;
  }

  async installPackage(verifyParams: IInstallUpdateParams): Promise<void> {
    const verified = await this.verifyFile(verifyParams);
    if (!verified) {
      return;
    }
    const buildNumber = verifyParams.buildNumber;
    logger.info('auto-updater', 'Installation request', buildNumber);
    void dialog
      .showMessageBox({
        type: 'question',
        buttons: [
          i18nText(ETranslations.update_install_and_restart),
          i18nText(ETranslations.global_later),
        ],
        defaultId: 0,
        message: i18nText(ETranslations.update_new_update_downloaded),
      })
      .then((selection) => {
        if (selection.response === 0) {
          store.setUpdateBuildNumber(buildNumber);
          logger.info('auto-update', 'button[0] was clicked', buildNumber);
          app.removeAllListeners('window-all-closed');
          this.getMainWindow()?.removeAllListeners('close');
          for (const window of BrowserWindow.getAllWindows()) {
            window.close();
            window.destroy();
          }
          autoUpdater.quitAndInstall(false);
        }
        logger.info('auto-update', 'button[1] was clicked');
      });
  }

  async manualInstallPackage(
    verifyParams: IInstallUpdateParams,
  ): Promise<void> {
    logger.info(
      'auto-updater',
      'Opening downloaded file',
      verifyParams.buildNumber,
      verifyParams,
    );
    const verified = await this.verifyFile(verifyParams);
    if (!verified) {
      return;
    }
    logger.info(
      'auto-updater',
      'Manual installation request',
      verifyParams.buildNumber,
    );
    if (verifyParams.downloadedFile) {
      try {
        const { shell } = require('electron');
        await shell.openPath(path.dirname(verifyParams.downloadedFile));
      } catch (error) {
        logger.error('auto-updater', 'Failed to open downloaded file', error);
      }
    } else {
      logger.warn('auto-updater', 'No downloaded file to open');
    }
  }

  async useTestUpdateFeedUrl(enabled = false): Promise<void> {
    logger.info('auto-updater', `updateSettings: ${enabled ? 1 : 0}`);
    store.setUpdateSettings({
      useTestFeedUrl: enabled,
    });
  }

  async getPreviousUpdateBuildNumber(): Promise<string> {
    const previousBuildNumber = store.getUpdateBuildNumber() || '';
    logger.info('auto-updater', 'Update build number: ', previousBuildNumber);
    return previousBuildNumber;
  }
}

export default DesktopApiAppUpdate;
