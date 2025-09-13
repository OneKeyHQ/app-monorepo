import fs from 'fs';
import path from 'path';

import { app, dialog } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';
import { CancellationToken, autoUpdater } from 'electron-updater';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { b2t, toHumanReadable } from '@onekeyhq/desktop/app/libs/utils';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import type { IDesktopStoreUpdateSettings } from '@onekeyhq/shared/types/desktop';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import type { IDesktopApi } from './base/types';
import type { BrowserWindow } from 'electron';

const isMas = !!process.mas;

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

function buildFeedUrl(useTestFeedUrl: boolean) {
  return `${buildServiceEndpoint({
    serviceName: EServiceEndpointEnum.Utility,
    env: useTestFeedUrl ? 'test' : 'prod',
  })}/utility/v1/app-update/electron-feed-url`;
}

export interface ILatestVersion {
  version: string;
  releaseDate: string;
  isManualCheck: boolean;
  updateCancellationToken: CancellationToken | undefined;
}

if (isMas) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = logger;
}

class DesktopApiUpdate {
  desktopApi: IDesktopApi;

  isManualCheck: boolean;

  latestVersion: ILatestVersion;

  isDownloading: boolean;

  updateCancellationToken: CancellationToken | undefined;

  events: {
    onUpdateAvailable: (event: IUpdateAvailableEvent) => void;
    onUpdateNotAvailable: (event: IUpdateNotAvailableEvent) => void;
    onUpdateError: (event: IUpdateErrorEvent) => void;
    onUpdateDownloading: (event: IUpdateDownloadingEvent) => void;
    onUpdateDownloaded: (event: IUpdateDownloadedEvent) => void;
  };

  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.isManualCheck = false;
    this.latestVersion = {} as ILatestVersion;
    this.isDownloading = false;
    if (!isMas) {
      this.initAppAutoUpdateEvents();
      this.initBundleAutoUpdateEvents();
    }
  }

  getMainWindow(): BrowserWindow | undefined {
    return globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
  }

  initAppAutoUpdateEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      logger.info('auto-updater', 'Checking for update');
      this.getMainWindow()?.webContents.send(ipcMessageKeys.UPDATE_CHECKING);
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
      this.getMainWindow()?.webContents.send(
        ipcMessageKeys.UPDATE_AVAILABLE,
        this.latestVersion,
      );

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
      this.getMainWindow()?.webContents.send(
        ipcMessageKeys.UPDATE_NOT_AVAILABLE,
        this.latestVersion,
      );

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
          version: this.latestVersion.version,
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
      this.getMainWindow()?.webContents.send(
        ipcMessageKeys.UPDATE_DOWNLOADING,
        {
          ...progressObj,
        },
      );
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
        this.getMainWindow()?.webContents.send(
          ipcMessageKeys.UPDATE_DOWNLOADED,
          {
            version,
            downloadedFile,
            downloadUrl,
          },
        );
      },
    );
  }

  initBundleAutoUpdateEvents(): void {}

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

  async checkForUpdates(isManual = false): Promise<void> {
    if (isManual) {
      this.isManualCheck = true;
    }
    logger.info(
      'auto-updater',
      `Update checking request (manual: ${b2t(this.isManualCheck)})`,
    );

    const updateSettings = store.getUpdateSettings();

    const feedUrl = buildFeedUrl(updateSettings.useTestFeedUrl);
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
        this.getMainWindow()?.webContents.send(ipcMessageKeys.UPDATE_ERROR, {
          err: error,
          version: null,
          isNetworkError: false,
        });
      }
    });
  }

  async downloadUpdate(): Promise<void> {
    logger.info('auto-updater', 'Download requested', this.isDownloading);
    if (this.isDownloading) {
      return;
    }
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
    store.clearUpdateBuildNumber();
    await clearUpdateCache();
    this.updateCancellationToken = new CancellationToken();
    autoUpdater
      .downloadUpdate(this.updateCancellationToken)
      .then(() => logger.info('auto-updater', 'Update downloaded'))
      .catch((e: Error) => {
        logger.info('auto-updater', 'Update cancelled', e);
        // CancellationError
        // node_modules/electron-updater/node_modules/builder-util-runtime/out/CancellationToken.js 104L
        if (e.message === 'cancelled') {
          return;
        }
        throw e;
      })
      .finally(() => {
        this.isDownloading = false;
      });
  }

  async useTestUpdateFeedUrl(enabled = false): Promise<void> {
    logger.info('auto-updater', `updateSettings: ${enabled ? 1 : 0}`);
    store.setUpdateSettings({
      useTestFeedUrl: enabled,
    });
  }
}

export default DesktopApiUpdate;
