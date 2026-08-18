import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  BrowserWindow,
  app,
  dialog,
  autoUpdater as nativeUpdater,
} from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';
import {
  CancellationToken,
  type UpdateCheckResult,
  autoUpdater,
} from 'electron-updater';
import { readCleartextMessage, readKey } from 'openpgp';
import semver from 'semver';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import { PUBLIC_KEY } from '@onekeyhq/desktop/app/constant/gpg';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ElectronTranslations, i18nText } from '@onekeyhq/desktop/app/i18n';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { b2t, toHumanReadable } from '@onekeyhq/desktop/app/libs/utils';
import type { IInstallUpdateParams } from '@onekeyhq/desktop/app/preload';
import {
  clearWindowProgressBar,
  updateWindowProgressBar,
} from '@onekeyhq/desktop/app/windowProgressBar';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppUpdatePackageAvailabilityStatus,
  EAppUpdatePackageErrorCode,
  type IAppUpdatePackageAvailability,
  type IUpdateDownloadedEvent,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
import { withCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { getDownloadedFileAvailability as resolveDownloadedFileAvailability } from './appUpdatePackageAvailability';

import type { IDesktopApi } from './base/types';

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

interface IUpdaterRehydrateCandidate {
  downloadedFile: string;
  detectedAt: number;
}

interface IUpdaterRehydrateAttempt {
  downloadedFile: string;
  startedAt: number;
  networkProgressObserved: boolean;
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.disableDifferentialDownload = true;
autoUpdater.logger = logger;

const isMac = process.platform === 'darwin';
const isMas = process.mas;
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';
const isSnapStore = isLinux && process.env.SNAP;
const isFlatpakStore = isLinux && process.env.FLATPAK;
const isWindowsMsStore = isWin && process.env.DESK_CHANNEL === 'ms-store';
// `DESK_CHANNEL=appImage` is set by the AppImage CI job (see
// release-desktop-all.yml) and baked into the bundle via esbuild `define` in
// scripts/build.js. Using the dedicated channel flag avoids the ambiguity of
// reading the runtime `APPIMAGE` env var, which is both a define target and a
// runtime value set by the AppImage launcher.
const isAppImage = isLinux && process.env.DESK_CHANNEL === 'appImage';

const isStoreVersion =
  isMas || isSnapStore || isWindowsMsStore || isFlatpakStore;

class DesktopApiAppUpdate {
  desktopApi: IDesktopApi;

  isManualCheck: boolean;

  latestVersion: ILatestVersion;

  isDownloading: boolean;

  downloadedEvent: IUpdateDownloadedEvent;

  updateCancellationToken: CancellationToken | undefined;

  private updaterRehydrateCandidate: IUpdaterRehydrateCandidate | undefined;

  private activeUpdaterRehydrate: IUpdaterRehydrateAttempt | undefined;

  private failActiveUpdaterRehydrate(error: unknown): void {
    const attempt = this.activeUpdaterRehydrate;
    if (!attempt) {
      return;
    }
    logger.warn('auto-updater', [
      'Updater cache rehydrate failed:',
      `- Downloaded file: ${path.basename(attempt.downloadedFile)}`,
      `- Duration: ${Date.now() - attempt.startedAt}ms`,
      `- Error code: ${(error as NodeJS.ErrnoException)?.code || 'UNKNOWN'}`,
      '- Next action: retry with cache clear',
    ]);
    this.activeUpdaterRehydrate = undefined;
  }

  private isSkipGPGAllowed(skipGPGVerification?: boolean) {
    return (
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true' &&
      Boolean(skipGPGVerification)
    );
  }

  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.isManualCheck = false;
    this.latestVersion = {} as ILatestVersion;
    this.isDownloading = false;
    this.downloadedEvent = undefined;
    if (!isStoreVersion) {
      if (app.isReady()) {
        this.initAppAutoUpdateEvents();
      } else {
        void app.whenReady().then(() => {
          this.initAppAutoUpdateEvents();
        });
      }
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
      this.failActiveUpdaterRehydrate(err);
      this.downloadedEvent = undefined;
      this.isDownloading = false;
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
          message,
        });
        clearWindowProgressBar(this.getMainWindow());
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      if (
        this.activeUpdaterRehydrate &&
        !this.activeUpdaterRehydrate.networkProgressObserved
      ) {
        this.activeUpdaterRehydrate.networkProgressObserved = true;
        logger.info('auto-updater', [
          'Updater cache rehydrate is using network fallback:',
          `- Downloaded file: ${path.basename(
            this.activeUpdaterRehydrate.downloadedFile,
          )}`,
        ]);
      }
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
      updateWindowProgressBar(this.getMainWindow(), progressObj.percent);
    });

    autoUpdater.on(
      'update-downloaded',
      ({ version, releaseDate, downloadedFile, files }) => {
        const rehydrateAttempt = this.activeUpdaterRehydrate;
        const downloadUrl = files.find((file) =>
          file.url.endsWith(path.basename(downloadedFile)),
        )?.url;

        this.updaterRehydrateCandidate = undefined;
        this.activeUpdaterRehydrate = undefined;
        this.downloadedEvent = {
          version,
          downloadedFile,
          downloadUrl,
          isUpdaterRehydrated: Boolean(rehydrateAttempt),
        };

        if (rehydrateAttempt) {
          logger.info('auto-updater', [
            'Updater cache rehydrate prepared:',
            `- Downloaded file: ${path.basename(downloadedFile)}`,
            `- Duration: ${Date.now() - rehydrateAttempt.startedAt}ms`,
            `- Network progress observed: ${b2t(
              rehydrateAttempt.networkProgressObserved,
            )}`,
          ]);
        }

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
            isUpdaterRehydrated: Boolean(rehydrateAttempt),
          },
        );
        setTimeout(() => {
          this.isDownloading = false;
          clearWindowProgressBar(this.getMainWindow());
        }, 2500);
      },
    );
  }

  async isDownloadingPackage(): Promise<boolean> {
    return this.isDownloading;
  }

  async checkDownloadedFileExists(downloadedFile: string): Promise<boolean> {
    const availability =
      await this.getDownloadedFileAvailability(downloadedFile);
    return (
      availability.status === EAppUpdatePackageAvailabilityStatus.available
    );
  }

  async getDownloadedFileAvailability(
    downloadedFile?: string,
  ): Promise<IAppUpdatePackageAvailability> {
    // electron-updater owns the installer path in process memory. A persisted
    // renderer path is not installable after relaunch until this process emits
    // update-downloaded from a trusted feed check/cache validation cycle.
    const availability = resolveDownloadedFileAvailability(downloadedFile, {
      requireCurrentProcessPreparation: true,
      preparedDownloadedFile: this.downloadedEvent?.downloadedFile,
    });
    if (downloadedFile) {
      if (
        availability.status === EAppUpdatePackageAvailabilityStatus.notPrepared
      ) {
        if (this.updaterRehydrateCandidate?.downloadedFile !== downloadedFile) {
          this.updaterRehydrateCandidate = {
            downloadedFile,
            detectedAt: Date.now(),
          };
          logger.info('auto-updater', [
            'Updater cache rehydrate candidate detected:',
            `- Downloaded file: ${path.basename(downloadedFile)}`,
          ]);
        }
      } else {
        this.updaterRehydrateCandidate = undefined;
      }
    }
    return availability;
  }

  private async assertDownloadedFileAvailable(
    downloadedFile?: string,
    options?: { requireCurrentProcessPreparation?: boolean },
  ): Promise<string> {
    const availability =
      options?.requireCurrentProcessPreparation === false
        ? resolveDownloadedFileAvailability(downloadedFile)
        : await this.getDownloadedFileAvailability(downloadedFile);
    if (availability.status === EAppUpdatePackageAvailabilityStatus.missing) {
      throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageMissing);
    }
    if (
      availability.status === EAppUpdatePackageAvailabilityStatus.unavailable
    ) {
      throw new OneKeyLocalError(
        `${EAppUpdatePackageErrorCode.packageUnavailable}:${
          availability.errorCode || 'IO_ERROR'
        }`,
      );
    }
    if (
      availability.status === EAppUpdatePackageAvailabilityStatus.notPrepared
    ) {
      throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageNotPrepared);
    }
    if (!downloadedFile) {
      throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageMissing);
    }
    return downloadedFile;
  }

  async clearUpdateCache(): Promise<void> {
    if (this.updateCancellationToken) {
      this.updateCancellationToken.cancel();
    }
    this.isDownloading = false;
    this.updaterRehydrateCandidate = undefined;
    this.activeUpdaterRehydrate = undefined;
    this.downloadedEvent = undefined;
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
    const finalHeaders = await withCustomUAHeaders(feedUrl, requestHeaders);
    autoUpdater.setFeedURL({
      url: feedUrl,
      requestHeaders: finalHeaders,
      provider: 'generic',
    });
    autoUpdater.requestHeaders = finalHeaders;
    logger.info('auto-updater', 'request headers: ', finalHeaders);
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
    this.downloadedEvent = undefined;
    clearWindowProgressBar(this.getMainWindow());
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
    const rehydrateCandidate = this.updaterRehydrateCandidate;
    this.updaterRehydrateCandidate = undefined;
    this.activeUpdaterRehydrate = undefined;
    if (rehydrateCandidate) {
      this.activeUpdaterRehydrate = {
        downloadedFile: rehydrateCandidate.downloadedFile,
        startedAt: Date.now(),
        networkProgressObserved: false,
      };
      logger.info('auto-updater', [
        'Updater cache rehydrate started:',
        `- Downloaded file: ${path.basename(
          rehydrateCandidate.downloadedFile,
        )}`,
        `- Candidate age: ${Date.now() - rehydrateCandidate.detectedAt}ms`,
      ]);
    } else {
      await clearUpdateCache();
    }
    this.updateCancellationToken = new CancellationToken();

    try {
      logger.info('auto-updater', 'Download update');
      await autoUpdater.downloadUpdate(this.updateCancellationToken);
      logger.info('auto-updater', 'Download update success');
    } catch (e) {
      this.failActiveUpdaterRehydrate(e);
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

    await this.assertDownloadedFileAvailable(downloadedFile);

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
      return true;
    }
    return false;
  }

  async downloadASC(params: IInstallUpdateParams): Promise<boolean> {
    if (this.isSkipGPGAllowed(params?.skipGPGVerification)) {
      logger.info('auto-updater', 'downloadASC skipped by skipGPGVerification');
      return true;
    }
    logger.info('auto-updater', 'Download ASC requested', params);
    const valid = await this.downloadAndVerifyASC(params);
    return valid;
  }

  async getSha256AndVerifyASC(params: IInstallUpdateParams): Promise<boolean> {
    if (this.isSkipGPGAllowed(params?.skipGPGVerification)) {
      logger.info(
        'auto-updater',
        'getSha256AndVerifyASC skipped by skipGPGVerification',
      );
      return true;
    }
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
        ElectronTranslations.update_signature_verification_failed_alert_text,
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
          ? ElectronTranslations.update_signature_verification_failed_alert_text
          : ElectronTranslations.update_installation_package_possibly_compromised,
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

  async verifyASC(params?: IInstallUpdateParams): Promise<boolean> {
    if (this.isSkipGPGAllowed(params?.skipGPGVerification)) {
      logger.info('auto-updater', 'verifyASC skipped by skipGPGVerification');
      return true;
    }
    logger.info('auto-updater', 'Verify ASC requested');
    const sha256 = await this.getSha256();
    return !!sha256;
  }

  async verifyFile(
    verifyParams: IInstallUpdateParams,
    options?: { requireCurrentProcessPreparation?: boolean },
  ): Promise<boolean> {
    const { downloadedFile, downloadUrl } = verifyParams;
    if (!downloadUrl) {
      logger.info('auto-updater', 'no such file');
      return false;
    }
    const verifiedDownloadedFile = await this.assertDownloadedFileAvailable(
      downloadedFile,
      options,
    );
    if (this.isSkipGPGAllowed(verifyParams?.skipGPGVerification)) {
      logger.info('auto-updater', 'verifyFile skipped by skipGPGVerification');
      return true;
    }
    logger.info(
      'auto-updater',
      `verifyFile ${verifiedDownloadedFile} ${downloadUrl}`,
    );

    const sha256 = await this.getSha256();
    if (!sha256) {
      //   sendValidError();
      return false;
    }

    try {
      const verified = await this.verifySha256(verifiedDownloadedFile, sha256);
      if (!verified) {
        // sendValidError();
        return false;
      }
    } catch (error) {
      logger.info('auto-updater', 'verifyFile error', error);
      const errorCode = (error as NodeJS.ErrnoException)?.code;
      if (errorCode === 'ENOENT' || errorCode === 'ENOTDIR') {
        throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageMissing);
      }
      if (errorCode) {
        throw new OneKeyLocalError(
          `${EAppUpdatePackageErrorCode.packageUnavailable}:${errorCode}`,
        );
      }
      throw new OneKeyLocalError(
        ElectronTranslations.update_installation_package_possibly_compromised,
      );
    }
    return true;
  }

  async verifyPackage(verifyParams: IInstallUpdateParams): Promise<boolean> {
    const verified = await this.verifyFile(verifyParams);
    return verified;
  }

  // electron-updater's AppImageUpdater.doInstall calls unlinkSync on the path
  // stored in the runtime env, but only guards with `== null`, so an empty
  // string slips through and crashes with `ENOENT: ... unlink ''`. The env can
  // end up empty when the app is launched via a wrapper, via
  // `--appimage-extract-and-run`, or through AppImageLauncher's FUSE overlay
  // (where it points to a read-only mount).
  //
  // APPIMAGE is a runtime env var set by the AppImage launcher — unlike
  // DESK_CHANNEL it is never injected via esbuild `define`.
  private canAutoInstallAppImage(): boolean {
    const appImagePath = process.env.APPIMAGE;
    if (!appImagePath || appImagePath.trim().length === 0) {
      logger.warn(
        'auto-updater',
        'AppImage runtime env missing; falling back to manual install',
      );
      return false;
    }
    try {
      fs.accessSync(appImagePath, fs.constants.W_OK);
    } catch (error) {
      logger.warn(
        'auto-updater',
        `AppImage path not writable (${appImagePath}); falling back to manual install`,
        error,
      );
      return false;
    }
    return true;
  }

  private getCurrentProcessPreparedInstallParams(
    verifyParams: IInstallUpdateParams,
  ): IInstallUpdateParams {
    const preparedEvent = this.downloadedEvent;
    const downloadedFile = verifyParams.downloadedFile;
    const expectedVersion = verifyParams.latestVersion;
    const preparedVersion = preparedEvent?.version;
    const currentVersion = app.getVersion();
    if (
      !preparedEvent ||
      !downloadedFile ||
      !expectedVersion ||
      !preparedVersion
    ) {
      throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageNotPrepared);
    }
    const isVersionBound =
      preparedVersion === expectedVersion &&
      semver.valid(preparedVersion) !== null &&
      semver.valid(currentVersion) !== null &&
      semver.gt(preparedVersion, currentVersion);
    const isMainEventBound =
      preparedEvent?.downloadedFile === downloadedFile && isVersionBound;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const isUpdaterBound = Boolean(autoUpdater.isInstallerPath(downloadedFile));
    if (!isMainEventBound || !isUpdaterBound) {
      throw new OneKeyLocalError(EAppUpdatePackageErrorCode.packageNotPrepared);
    }
    return {
      ...verifyParams,
      latestVersion: preparedVersion,
      downloadedFile: preparedEvent.downloadedFile,
      downloadUrl: preparedEvent.downloadUrl || verifyParams.downloadUrl,
    };
  }

  async installPackage(verifyParams: IInstallUpdateParams): Promise<boolean> {
    // Keep this native main-process confirmation as an authorization boundary:
    // a compromised renderer must not be able to silently replace the app by
    // invoking the install IPC. File integrity is verified again below.
    const selection = await dialog.showMessageBox({
      type: 'question',
      buttons: [
        i18nText(ElectronTranslations.update_install_and_restart),
        i18nText(ElectronTranslations.global_later),
      ],
      defaultId: 0,
      message: i18nText(ElectronTranslations.update_new_update_downloaded),
    });
    if (selection.response !== 0) {
      return false;
    }
    const buildNumber = verifyParams.buildNumber;
    logger.info('auto-updater', 'Installation request', buildNumber);
    const installVerifyParams =
      this.getCurrentProcessPreparedInstallParams(verifyParams);
    if (!isMac) {
      // On Linux AppImage, bail out early if APPIMAGE env is unusable —
      // quitAndInstall would otherwise crash inside electron-updater with
      // `ENOENT: ... unlink ''` and leave the user stuck.
      if (isLinux && isAppImage && !this.canAutoInstallAppImage()) {
        await this.manualInstallPackage(installVerifyParams);
        return true;
      }
    }
    const verified = await this.verifyFile(installVerifyParams);
    if (!verified) {
      throw new OneKeyLocalError(
        ElectronTranslations.update_installation_not_safe_alert_text,
      );
    }
    // Rebind after async verification so a concurrent download cannot swap
    // the updater state before the synchronous install handoff.
    this.getCurrentProcessPreparedInstallParams(installVerifyParams);
    store.setUpdateBuildNumber(buildNumber);
    logger.info(
      'auto-update',
      'install confirmed in native dialog',
      buildNumber,
    );
    // https://github.com/electron-userland/electron-builder/issues/8997#issuecomment-2969507357
    /**
     * On macOS 15+ auto-update / relaunch issues:
     * - https://github.com/electron-userland/electron-builder/issues/8795
     * - https://github.com/electron-userland/electron-builder/issues/8997
     */
    if (isMac) {
      app.removeAllListeners('before-quit');
      app.removeAllListeners('window-all-closed');
      BrowserWindow.getAllWindows().forEach((win) => {
        if (win.isDestroyed()) {
          return;
        }
        win.removeAllListeners('close');
        win.close();
      });
      nativeUpdater.once('before-quit-for-update', () => {
        app.exit();
      });
      autoUpdater.quitAndInstall(false);
      return true;
    }
    autoUpdater.quitAndInstall(false);
    return true;
  }

  async manualInstallPackage(
    verifyParams: IInstallUpdateParams,
  ): Promise<void> {
    const installVerifyParams = isMac
      ? verifyParams
      : this.getCurrentProcessPreparedInstallParams(verifyParams);
    logger.info(
      'auto-updater',
      'Opening downloaded file',
      installVerifyParams.buildNumber,
      installVerifyParams,
    );
    const verified = await this.verifyFile(installVerifyParams, {
      requireCurrentProcessPreparation: false,
    });
    if (!verified) {
      throw new OneKeyLocalError(
        ElectronTranslations.update_installation_not_safe_alert_text,
      );
    }
    await this.assertDownloadedFileAvailable(
      installVerifyParams.downloadedFile,
      {
        requireCurrentProcessPreparation: false,
      },
    );
    logger.info(
      'auto-updater',
      'Manual installation request',
      installVerifyParams.buildNumber,
    );
    if (installVerifyParams.downloadedFile) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- dynamic require returns untyped
        // oxlint-disable-next-line @typescript-eslint/no-unsafe-call -- dynamic require returns untyped
        const { shell } = require('electron');
        // oxlint-disable-next-line @typescript-eslint/no-unsafe-call -- shell from dynamic require is untyped
        const openPathError = await shell.openPath(
          path.dirname(installVerifyParams.downloadedFile),
        );
        if (openPathError) {
          throw new OneKeyLocalError(
            EAppUpdatePackageErrorCode.packageUnavailable,
          );
        }
      } catch (error) {
        logger.error('auto-updater', 'Failed to open downloaded file', error);
        throw error;
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
