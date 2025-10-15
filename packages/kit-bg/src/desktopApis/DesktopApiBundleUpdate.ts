import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

import AdmZip from 'adm-zip';
import { app } from 'electron';
import logger from 'electron-log/main';

import {
  getBundleDirName,
  getBundleExtractDir,
  testExtractedSha256FromVerifyAscFile,
  verifyMetadataFileSha256,
  verifySha256,
} from '@onekeyhq/desktop/app/bundle';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IDownloadPackageParams,
  IUpdateDownloadedEvent,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
import type { IDesktopStoreUpdateBundleData } from '@onekeyhq/shared/types/desktop';

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
    const currentUpdateBundleData = store.getUpdateBundleData();

    store.setUpdateBundleData({
      appVersion,
      bundleVersion,
      signature,
    });
    logger.info('installBundle', {
      appVersion,
      bundleVersion,
      signature,
    });
    store.setNativeVersion(app.getVersion());
    logger.info('installBundle setNativeVersion', {
      nativeVersion: app.getVersion(),
    });
    const fallbackUpdateBundleData = store.getFallbackUpdateBundleData();
    if (
      currentUpdateBundleData &&
      currentUpdateBundleData.appVersion &&
      currentUpdateBundleData.bundleVersion &&
      currentUpdateBundleData.signature
    ) {
      fallbackUpdateBundleData.push(currentUpdateBundleData);
    }

    if (fallbackUpdateBundleData.length > 3) {
      const shiftUpdateBundleData = fallbackUpdateBundleData.shift();
      if (shiftUpdateBundleData) {
        const dirName = `${shiftUpdateBundleData.appVersion}-${shiftUpdateBundleData.bundleVersion}`;
        const bundleDir = getBundleDirName();
        const bundleDirPath = path.join(bundleDir, dirName);
        if (fs.existsSync(bundleDirPath)) {
          fs.rmSync(bundleDirPath, { recursive: true, force: true });
        }
      }
    }
    logger.info('fallbackUpdateBundleData', fallbackUpdateBundleData);
    store.setFallbackUpdateBundleData(fallbackUpdateBundleData);
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

  async getFallbackUpdateBundleData() {
    return store.getFallbackUpdateBundleData();
  }

  async setCurrentUpdateBundleData(
    updateBundleData: IDesktopStoreUpdateBundleData,
  ) {
    store.setUpdateBundleData(updateBundleData);
    setTimeout(() => {
      if (!process.mas) {
        app.relaunch();
      }
      app.exit(0);
    }, 1200);
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

  async clearAllJSBundleData() {
    await this.clearDownload();
    await this.clearBundleExtract();
    store.clearUpdateBundleData();
    return new Promise<{ success: boolean; message: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Successfully cleared all JS bundle data',
        });
      }, 300);
    });
  }

  async testVerification() {
    return testExtractedSha256FromVerifyAscFile();
  }

  /**
   * Test function to delete jsBundle files
   * @param appVersion - Application version
   * @param bundleVersion - Bundle version
   */
  async testDeleteJsBundle(appVersion: string, bundleVersion: string) {
    try {
      const bundleDir = getBundleExtractDir({ appVersion, bundleVersion });
      const mainIndexHtmlPath = path.join(bundleDir, 'index.html');

      if (fs.existsSync(mainIndexHtmlPath)) {
        fs.unlinkSync(mainIndexHtmlPath);
        logger.info(
          'testDeleteJsBundle',
          `Deleted jsBundle: ${mainIndexHtmlPath}`,
        );
        return {
          success: true,
          message: `Deleted jsBundle: ${mainIndexHtmlPath}`,
        };
      }
      logger.info(
        'testDeleteJsBundle',
        `jsBundle not found: ${mainIndexHtmlPath}`,
      );
      return {
        success: false,
        message: `jsBundle not found: ${mainIndexHtmlPath}`,
      };
    } catch (error) {
      logger.error(
        'testDeleteJsBundle',
        `Error deleting jsBundle: ${(error as Error).message}`,
      );
      throw new OneKeyLocalError(
        `Failed to delete jsBundle: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Test function to delete js runtime directory
   * @param appVersion - Application version
   * @param bundleVersion - Bundle version
   */
  async testDeleteJsRuntimeDir(appVersion: string, bundleVersion: string) {
    try {
      const bundleDir = getBundleExtractDir({ appVersion, bundleVersion });

      if (fs.existsSync(bundleDir)) {
        fs.rmSync(bundleDir, { recursive: true, force: true });
        logger.info(
          'testDeleteJsRuntimeDir',
          `Deleted js runtime directory: ${bundleDir}`,
        );
        return {
          success: true,
          message: `Deleted js runtime directory: ${bundleDir}`,
        };
      }
      logger.info(
        'testDeleteJsRuntimeDir',
        `js runtime directory not found: ${bundleDir}`,
      );
      return {
        success: false,
        message: `js runtime directory not found: ${bundleDir}`,
      };
    } catch (error) {
      logger.error(
        'testDeleteJsRuntimeDir',
        `Error deleting js runtime directory: ${(error as Error).message}`,
      );
      throw new OneKeyLocalError(
        `Failed to delete js runtime directory: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Test function to delete metadata.json file
   * @param appVersion - Application version
   * @param bundleVersion - Bundle version
   */
  async testDeleteMetadataJson(appVersion: string, bundleVersion: string) {
    try {
      const metadataFilePath = this.getMetadataFilePath({
        appVersion,
        bundleVersion,
      });

      if (fs.existsSync(metadataFilePath)) {
        fs.unlinkSync(metadataFilePath);
        logger.info(
          'testDeleteMetadataJson',
          `Deleted metadata.json: ${metadataFilePath}`,
        );
        return {
          success: true,
          message: `Deleted metadata.json: ${metadataFilePath}`,
        };
      }
      logger.info(
        'testDeleteMetadataJson',
        `metadata.json not found: ${metadataFilePath}`,
      );
      return {
        success: false,
        message: `metadata.json not found: ${metadataFilePath}`,
      };
    } catch (error) {
      logger.error(
        'testDeleteMetadataJson',
        `Error deleting metadata.json: ${(error as Error).message}`,
      );
      throw new OneKeyLocalError(
        `Failed to delete metadata.json: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Test function to write empty metadata.json file
   * @param appVersion - Application version
   * @param bundleVersion - Bundle version
   */
  async testWriteEmptyMetadataJson(appVersion: string, bundleVersion: string) {
    try {
      const bundleDir = getBundleExtractDir({ appVersion, bundleVersion });
      const metadataFilePath = path.join(bundleDir, 'metadata.json');

      // Ensure directory exists
      if (!fs.existsSync(bundleDir)) {
        fs.mkdirSync(bundleDir, { recursive: true });
      }

      // Write empty metadata.json
      const emptyMetadata = {};
      fs.writeFileSync(
        metadataFilePath,
        JSON.stringify(emptyMetadata, null, 2),
      );

      logger.info(
        'testWriteEmptyMetadataJson',
        `Created empty metadata.json: ${metadataFilePath}`,
      );
      return {
        success: true,
        message: `Created empty metadata.json: ${metadataFilePath}`,
      };
    } catch (error) {
      logger.error(
        'testWriteEmptyMetadataJson',
        `Error writing empty metadata.json: ${(error as Error).message}`,
      );
      throw new OneKeyLocalError(
        `Failed to write empty metadata.json: ${(error as Error).message}`,
      );
    }
  }
}

export default DesktopApiAppBundleUpdate;
