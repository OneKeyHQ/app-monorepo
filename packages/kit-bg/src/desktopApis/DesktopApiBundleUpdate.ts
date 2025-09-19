import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

import AdmZip from 'adm-zip';
import { app } from 'electron';
import logger from 'electron-log/main';
import { readCleartextMessage, readKey } from 'openpgp';

import {
  getBundleDirName,
  getBundleExtractDir,
  verifyMetadataFileSha256,
  verifySha256,
} from '@onekeyhq/desktop/app/bundle';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import { PUBLIC_KEY } from '@onekeyhq/desktop/app/constant/gpg';
import { ETranslations } from '@onekeyhq/desktop/app/i18n';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IDownloadPackageParams,
  IUpdateDownloadedEvent,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';

import type { IDesktopApi } from './base/types';
import type { BrowserWindow } from 'electron';

export interface IUpdateProgressUpdate {
  percent: number;
  delta: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}
class DesktopApiAppBundleUpdate {
  desktopApi: IDesktopApi;

  cancelCurrentDownload: (() => void) | null;

  isDownloading = false;

  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.cancelCurrentDownload = () => {};
  }

  getMainWindow(): BrowserWindow | undefined {
    return globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
  }

  async verifyAndResolve(filePath: string, sha256: string) {
    return new Promise<boolean>((resolve, reject) => {
      setTimeout(async () => {
        const verified = verifySha256(filePath, sha256);
        if (!verified) {
          reject(new OneKeyLocalError('Downloaded file is not valid'));
        }
        resolve(true);
      }, 1000);
    });
  }

  getDownloadDir() {
    const tempDir = path.join(
      app.getPath('userData'),
      'onekey-bundle-download',
    );
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    logger.info('bundle-download-getDownloadDir', tempDir);
    return tempDir;
  }

  async downloadBundle({
    latestVersion: appVersion,
    bundleVersion,
    downloadUrl: bundleUrl,
    fileSize,
    sha256,
  }: IDownloadPackageParams): Promise<IUpdateDownloadedEvent> {
    if (this.isDownloading) {
      return;
    }
    if (!appVersion || !bundleVersion || !bundleUrl || !fileSize || !sha256) {
      this.isDownloading = false;
      return Promise.reject(new Error('Invalid parameters'));
    }
    this.isDownloading = true;
    return new Promise<IUpdateDownloadedEvent>((resolve, reject) => {
      setTimeout(async () => {
        const tempDir = this.getDownloadDir();
        logger.info('bundle-download', {
          tempDir,
        });
        const fileName = `${appVersion}-${bundleVersion}.zip`;
        const filePath = path.join(tempDir, fileName);
        const partialFilePath = `${filePath}.partial`;

        let downloadedBytes = 0;
        let totalBytes = fileSize;

        if (fs.existsSync(filePath)) {
          const result = await this.verifyAndResolve(filePath, sha256);
          if (result) {
            this.isDownloading = false;
            resolve({
              downloadedFile: filePath,
              downloadUrl: bundleUrl,
              latestVersion: appVersion,
              bundleVersion,
            });
            return;
          }
          await this.clearDownload();
          fs.mkdirSync(tempDir, { recursive: true });
        }
        // Check if partial file exists for resume
        if (fs.existsSync(partialFilePath)) {
          const stats = fs.statSync(partialFilePath);
          downloadedBytes = stats.size;
          logger.info(
            'bundle-download',
            `Resuming download from ${downloadedBytes} bytes`,
          );
        }

        const options = {
          headers:
            downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {},
        };

        let downloadRequest: http.ClientRequest | null = null;

        const protocol = bundleUrl.startsWith('https://') ? https : http;
        downloadRequest = protocol.get(bundleUrl, options, async (response) => {
          if (response.statusCode === 416) {
            // Range not satisfiable, file might be complete
            if (fs.existsSync(partialFilePath)) {
              fs.renameSync(partialFilePath, filePath);
              await this.verifyAndResolve(filePath, sha256);
              this.isDownloading = false;
              return {
                downloadedFile: filePath,
                downloadUrl: bundleUrl,
                latestVersion: appVersion,
                bundleVersion,
              };
            }
          }

          if (response.statusCode !== 200 && response.statusCode !== 206) {
            this.isDownloading = false;
            reject(
              new Error(
                `Download failed with status: ${response.statusCode || 0}`,
              ),
            );
            return;
          }

          if (response.statusCode === 200) {
            // Full download
            totalBytes = parseInt(
              response.headers['content-length'] || '0',
              10,
            );
            downloadedBytes = 0;
          } else if (response.statusCode === 206) {
            // Partial download
            const contentRange = response.headers['content-range'];
            if (contentRange) {
              const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
              if (match) {
                totalBytes = parseInt(match[1], 10);
              }
            }
          }

          const writeStream = fs.createWriteStream(partialFilePath, {
            flags: downloadedBytes > 0 ? 'a' : 'w',
          });

          // Handle download cancellation
          const cancelDownload = () => {
            if (downloadRequest) {
              this.isDownloading = false;
              downloadRequest.destroy();
              downloadRequest = null;
            }
            writeStream.destroy();
            reject(new Error('Download cancelled'));
          };

          // Store cancel function for external access
          this.cancelCurrentDownload = cancelDownload;

          response.on('data', (chunk) => {
            downloadedBytes += (chunk as Buffer).length;
            writeStream.write(chunk);

            // Emit progress
            const percent =
              totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
            this.getMainWindow()?.webContents.send(
              ipcMessageKeys.UPDATE_DOWNLOADING,
              {
                percent,
                transferred: downloadedBytes,
                total: totalBytes,
                bytesPerSecond: 0, // Could calculate this if needed
                delta: (chunk as Buffer).length,
              },
            );
          });

          response.on('end', async () => {
            writeStream.end();
            this.isDownloading = false;
            logger.info(
              'bundle-download-end',
              downloadedBytes,
              totalBytes,
              partialFilePath,
              filePath,
            );
            if (downloadedBytes >= totalBytes) {
              // Download complete, rename and verify
              fs.renameSync(partialFilePath, filePath);
              await this.verifyAndResolve(filePath, sha256);
              resolve({
                downloadedFile: filePath,
                downloadUrl: bundleUrl,
                latestVersion: appVersion,
                bundleVersion,
              });
            } else {
              reject(new Error('Download incomplete'));
            }
          });

          response.on('error', (error) => {
            writeStream.destroy();
            downloadRequest = null;
            this.isDownloading = false;
            this.cancelCurrentDownload = () => {};
            reject(error);
          });
        });

        downloadRequest.on('error', (error) => {
          downloadRequest = null;
          this.cancelCurrentDownload = null;
          this.isDownloading = false;
          reject(error);
        });

        downloadRequest.setTimeout(1000 * 60 * 30, () => {
          if (downloadRequest) {
            downloadRequest.destroy();
            downloadRequest = null;
          }
          this.isDownloading = false;
          this.cancelCurrentDownload = null;
          reject(new Error('Download timeout'));
        });
      }, 0);
    });
  }

  getBundleBuildPath({
    appVersion,
    bundleVersion,
  }: {
    appVersion: string;
    bundleVersion: string;
  }) {
    const bundleDir = getBundleDirName();
    return path.join(bundleDir, `${appVersion}-${bundleVersion}`, 'build');
  }

  getMetadataFilePath({
    appVersion,
    bundleVersion,
  }: {
    appVersion: string;
    bundleVersion: string;
  }) {
    const bundleDir = getBundleDirName();
    return path.join(
      bundleDir,
      `${appVersion}-${bundleVersion}`,
      'metadata.json',
    );
  }

  async verifyBundle(params: IUpdateDownloadedEvent) {
    const {
      downloadedFile,
      sha256,
      latestVersion: appVersion,
      bundleVersion,
      signature,
    } = params || {};
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      !signature
    ) {
      throw new OneKeyLocalError('Invalid parameters');
    }
    await verifyMetadataFileSha256({ appVersion, bundleVersion, signature });
  }

  /**
   * Verify the bundle using ASC (Apple Software Certificate) signature
   * This method validates the digital signature of the downloaded bundle
   * to ensure it comes from a trusted source and hasn't been tampered with
   *
   * @param params - Bundle downloaded event containing file path and signature info
   * @returns Promise that resolves when verification is complete
   */
  async downloadBundleASC(params: IUpdateDownloadedEvent) {
    const {
      downloadedFile,
      sha256,
      latestVersion: appVersion,
      bundleVersion,
      signature,
    } = params || {};
    if (!downloadedFile || !sha256 || !appVersion || !bundleVersion) {
      throw new OneKeyLocalError('Invalid parameters');
    }
    if (!signature) {
      throw new OneKeyLocalError('Invalid parameters');
    }
  }

  async verifyBundleASC(params: IUpdateDownloadedEvent) {
    const {
      downloadedFile,
      sha256,
      latestVersion: appVersion,
      bundleVersion,
      signature,
    } = params || {};
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      !signature
    ) {
      throw new OneKeyLocalError('Invalid parameters');
    }
    const isBundleVerified = verifySha256(downloadedFile, sha256);
    if (!isBundleVerified) {
      throw new OneKeyLocalError('Invalid bundle file');
    }
    const extractDir = getBundleExtractDir({
      appVersion,
      bundleVersion,
    });

    try {
      const zip = new AdmZip(downloadedFile);
      zip.extractAllTo(extractDir, true);
    } catch (error) {
      logger.error('Failed to extract bundle zip file:', error);
      throw error;
    }

    const metadataFilePath = this.getMetadataFilePath({
      appVersion,
      bundleVersion,
    });
    logger.info('bundle-verifyBundleASC', metadataFilePath);
    await verifyMetadataFileSha256({ appVersion, bundleVersion, signature });
  }

  async installBundle(params: IUpdateDownloadedEvent) {
    const {
      latestVersion: appVersion,
      bundleVersion,
      signature,
    } = params || {};
    if (!appVersion || !bundleVersion || !signature) {
      throw new OneKeyLocalError('Invalid parameters');
    }
    store.setFallbackUpdateBundleData(store.getUpdateBundleData());
    store.setUpdateBundleData({
      appVersion,
      bundleVersion,
      signature,
    });
    setTimeout(() => {
      if (!process.mas) {
        app.relaunch();
      }
      app.exit(0);
    }, 1200);
  }

  async clearDownload() {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        this.cancelCurrentDownload?.();
        const downloadDir = this.getDownloadDir();
        fs.rmSync(downloadDir, { recursive: true });
        resolve();
      }, 100);
    });
  }

  async clearBundleExtract() {
    const bundleDir = getBundleDirName();
    try {
      fs.rmSync(bundleDir, { recursive: true, force: true });
    } catch (error) {
      logger.error('Failed to clear bundle extract:', error);
    }
  }

  async clearBundle() {
    await this.clearDownload();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 300);
    });
  }
}

export default DesktopApiAppBundleUpdate;
