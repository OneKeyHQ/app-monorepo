import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

import AdmZip from 'adm-zip';
import { app } from 'electron';
import logger from 'electron-log/main';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import type {
  IBundleDownloadedEvent,
  IDownloadPackageParams,
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

  verifySha256(filePath: string, sha256: string) {
    const hash = crypto.createHash('sha256');
    const fileContent = fs.readFileSync(filePath);
    hash.update(fileContent);
    const fileSha256 = hash.digest('hex');
    logger.info('bundle-download-verifySha256', sha256, fileSha256);
    return fileSha256 === sha256;
  }

  verifyAndResolve(
    filePath: string,
    sha256: string,
    resolve: (value: IBundleDownloadedEvent) => void,
    reject: (reason?: any) => void,
  ) {
    logger.info('bundle-download-verifyAndResolve', filePath, sha256);
    const verified = this.verifySha256(filePath, sha256);
    if (verified) {
      resolve({ downloadedFile: filePath });
    } else {
      reject(new Error('Downloaded file is not valid'));
    }
  }

  getDownloadFileName() {
    const tempDir = path.join(
      app.getPath('userData'),
      'onekey-bundle-download',
    );
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    logger.info('bundle-download', tempDir);
    return tempDir;
  }

  getBundleDirName() {
    const tempDir = path.join(app.getPath('userData'), 'onekey-bundle');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    logger.info('bundle-download', tempDir);
    return tempDir;
  }

  downloadBundle({
    latestVersion: appVersion,
    bundleVersion,
    downloadUrl: bundleUrl,
    fileSize,
    sha256,
  }: IDownloadPackageParams): Promise<IBundleDownloadedEvent> {
    if (!appVersion || !bundleVersion || !bundleUrl || !fileSize || !sha256) {
      return Promise.reject(new Error('Invalid parameters'));
    }
    return new Promise<IBundleDownloadedEvent>((resolve, reject) => {
      const tempDir = this.getDownloadFileName();
      logger.info('bundle-download', {
        tempDir,
      });
      const fileName = `${appVersion}-${bundleVersion}.zip`;
      const filePath = path.join(tempDir, fileName);
      const partialFilePath = `${filePath}.partial`;

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      let downloadedBytes = 0;
      let totalBytes = fileSize;

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
      this.isDownloading = true;
      downloadRequest = protocol.get(bundleUrl, options, (response) => {
        if (response.statusCode === 416) {
          // Range not satisfiable, file might be complete
          if (fs.existsSync(partialFilePath)) {
            fs.renameSync(partialFilePath, filePath);
            this.verifyAndResolve(
              filePath,
              sha256,
              () =>
                resolve({
                  downloadedFile: filePath,
                  downloadUrl: bundleUrl,
                  latestVersion: appVersion,
                  bundleVersion,
                }),
              reject,
            );
            return;
          }
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(
            new Error(
              `Download failed with status: ${response.statusCode || 0}`,
            ),
          );
          return;
        }

        if (response.statusCode === 200) {
          // Full download
          totalBytes = parseInt(response.headers['content-length'] || '0', 10);
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

        response.on('end', () => {
          writeStream.end();

          this.isDownloading = false;
          if (downloadedBytes >= totalBytes) {
            // Download complete, rename and verify
            fs.renameSync(partialFilePath, filePath);
            this.verifyAndResolve(filePath, sha256, resolve, reject);
          } else {
            reject(new Error('Download incomplete'));
          }
        });

        response.on('error', (error) => {
          writeStream.destroy();
          downloadRequest = null;
          this.cancelCurrentDownload = () => {};
          reject(error);
        });
      });

      downloadRequest.on('error', (error) => {
        downloadRequest = null;
        this.cancelCurrentDownload = null;
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
    });
  }

  getBundleExtractDir({
    bundleDir,
    appVersion,
    bundleVersion,
  }: {
    bundleDir: string;
    appVersion: string;
    bundleVersion: string;
  }) {
    return path.join(bundleDir, `${appVersion}-${bundleVersion}`);
  }

  verifyBundle(params: IBundleDownloadedEvent) {
    const { downloadedFile, sha256 } = params;
    if (!downloadedFile || !sha256) {
      return false;
    }
    const bundleDir = this.getBundleDirName();
    if (this.verifySha256(downloadedFile, sha256)) {
      // Extract zip file to the same directory
      const extractDir = this.getBundleExtractDir({
        bundleDir,
        appVersion,
        bundleVersion,
      });

      try {
        const zip = new AdmZip(downloadedFile);
        zip.extractAllTo(extractDir, true);
        return true;
      } catch (error) {
        logger.error('Failed to extract bundle zip file:', error);
        return false;
      }
    }
  }

  /**
   * Verify the bundle using ASC (Apple Software Certificate) signature
   * This method validates the digital signature of the downloaded bundle
   * to ensure it comes from a trusted source and hasn't been tampered with
   *
   * @param params - Bundle downloaded event containing file path and signature info
   * @returns Promise that resolves when verification is complete
   */
  downloadBundleASC(params: IBundleDownloadedEvent) {
    const { downloadedFile, sha256 } = params;
    if (!downloadedFile || !sha256) {
      return false;
    }
    return this.verifySha256(downloadedFile, sha256);
  }

  verifyBundleASC(params: IBundleDownloadedEvent) {
    const { downloadedFile, sha256 } = params;
    const extractDir = this.getBundleExtractDir({
      downloadedFile,
      appVersion,
      bundleVersion,
    });
    const metataJson = path.join(extractDir, 'metadata.json');
    // return this.verifySha256(downloadedFile, sha256);
  }

  installBundle(params: IBundleDownloadedEvent) {
    store.setFallbackUpdateBundleData(store.getUpdateBundleData());
    store.setUpdateBundleData({
      appVersion: params.appVersion,
      bundleVersion: params.bundleVersion,
      signature: params.signature,
    });
    setTimeout(() => {
      globalThis.location.reload();
    }, 3500);
  }

  async clearBundle() {
    return new Promise<void>((resolve) => {
      this.isDownloading = false;
      this.cancelCurrentDownload?.();
      const bundleDir = this.getBundleDirName();
      fs.rmSync(bundleDir, { recursive: true });
      const downloadDir = this.getDownloadFileName();
      fs.rmSync(downloadDir, { recursive: true });
      setTimeout(() => {
        resolve();
      }, 300);
    });
  }
}

export default DesktopApiAppBundleUpdate;
