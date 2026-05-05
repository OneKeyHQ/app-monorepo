import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';

import AdmZip from 'adm-zip';
import { app } from 'electron';
import logger from 'electron-log/main';

import {
  calculateSHA256,
  checkFileSha512,
  getBundleDirName,
  getBundleExtractDir,
  testExtractedSha256FromVerifyAscFile,
  verifyMetadataFileSha256,
  verifySha256,
} from '@onekeyhq/desktop/app/bundle';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import {
  clearWindowProgressBar,
  updateWindowProgressBar,
} from '@onekeyhq/desktop/app/windowProgressBar';
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

  private isSkipGPGAllowed(skipGPGVerification?: boolean) {
    return (
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true' &&
      Boolean(skipGPGVerification)
    );
  }

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
          return;
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
      logger.info('bundle-download', 'Download already in progress, skipping');
      return;
    }
    clearWindowProgressBar(this.getMainWindow());
    if (!appVersion || !bundleVersion || !bundleUrl || !fileSize || !sha256) {
      logger.error('bundle-download', 'Invalid parameters', {
        appVersion,
        bundleVersion,
        bundleUrl,
        fileSize,
        sha256,
      });
      this.isDownloading = false;
      return Promise.reject(new Error('Invalid parameters'));
    }
    if (!bundleUrl.startsWith('https://')) {
      logger.error('bundle-download', `Non-HTTPS URL rejected: ${bundleUrl}`);
      this.isDownloading = false;
      return Promise.reject(new Error('Bundle download URL must use HTTPS'));
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
        // Prevent double resolve/reject when multiple error handlers fire
        let settled = false;
        const safeResolve = (value: IUpdateDownloadedEvent) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const safeReject = (error: unknown) => {
          if (settled) return;
          settled = true;
          reject(error);
        };

        if (fs.existsSync(filePath)) {
          try {
            const result = await this.verifyAndResolve(filePath, sha256);
            if (result) {
              this.isDownloading = false;
              safeResolve({
                downloadedFile: filePath,
                downloadUrl: bundleUrl,
                latestVersion: appVersion,
                bundleVersion,
              });
              return;
            }
          } catch (e) {
            logger.error(
              'bundle-download',
              'Cached file verification failed, re-downloading',
              e,
            );
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

        const makeDownloadRequest = (
          url: string,
          reqOptions: typeof options,
          redirectCount = 0,
        ) => {
          const reqProtocol = url.startsWith('https://') ? https : http;
          downloadRequest = reqProtocol.get(
            url,
            reqOptions,
            async (response) => {
              // Handle redirects (301, 302, 307, 308)
              if (
                response.statusCode &&
                [301, 302, 307, 308].includes(response.statusCode) &&
                response.headers.location
              ) {
                response.resume();
                if (redirectCount >= 5) {
                  logger.error('bundle-download', 'Too many redirects (>5)');
                  this.isDownloading = false;
                  safeReject(new Error('Too many redirects'));
                  return;
                }
                const rawRedirectUrl = response.headers.location;
                const resolvedRedirectUrl = new URL(
                  rawRedirectUrl,
                  url,
                ).toString();
                if (!resolvedRedirectUrl.startsWith('https://')) {
                  logger.error(
                    'bundle-download',
                    `Redirect to non-HTTPS URL rejected: ${resolvedRedirectUrl}`,
                  );
                  this.isDownloading = false;
                  safeReject(
                    new Error('Redirect to non-HTTPS URL is not allowed'),
                  );
                  return;
                }
                makeDownloadRequest(
                  resolvedRedirectUrl,
                  reqOptions,
                  redirectCount + 1,
                );
                return;
              }

              if (response.statusCode === 416) {
                // Range not satisfiable, file might be complete
                if (fs.existsSync(partialFilePath)) {
                  try {
                    fs.renameSync(partialFilePath, filePath);
                    await this.verifyAndResolve(filePath, sha256);
                    this.isDownloading = false;
                    safeResolve({
                      downloadedFile: filePath,
                      downloadUrl: bundleUrl,
                      latestVersion: appVersion,
                      bundleVersion,
                    });
                  } catch (error) {
                    this.isDownloading = false;
                    safeReject(error);
                  }
                  return;
                }
                logger.error(
                  'bundle-download',
                  'HTTP 416 with no partial file to resume',
                );
                this.isDownloading = false;
                safeReject(new Error('Download failed with status: 416'));
                return;
              }

              if (response.statusCode !== 200 && response.statusCode !== 206) {
                logger.error(
                  'bundle-download',
                  `Unexpected HTTP status: ${response.statusCode || 0}`,
                );
                this.isDownloading = false;
                safeReject(
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
                safeReject(new Error('Download cancelled'));
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
                    bytesPerSecond: 0,
                    delta: (chunk as Buffer).length,
                  },
                );
                updateWindowProgressBar(this.getMainWindow(), percent);
              });

              response.on('end', () => {
                writeStream.end();
              });

              writeStream.on('finish', async () => {
                this.isDownloading = false;
                logger.info(
                  'bundle-download-end',
                  downloadedBytes,
                  totalBytes,
                  partialFilePath,
                  filePath,
                );
                if (downloadedBytes >= totalBytes) {
                  try {
                    // Download complete, rename and verify
                    fs.renameSync(partialFilePath, filePath);
                    await this.verifyAndResolve(filePath, sha256);
                    safeResolve({
                      downloadedFile: filePath,
                      downloadUrl: bundleUrl,
                      latestVersion: appVersion,
                      bundleVersion,
                    });
                  } catch (error) {
                    safeReject(error);
                  }
                } else {
                  logger.error(
                    'bundle-download',
                    `Download incomplete: ${downloadedBytes}/${totalBytes} bytes`,
                  );
                  safeReject(new Error('Download incomplete'));
                }
                clearWindowProgressBar(this.getMainWindow());
              });

              writeStream.on('error', (error) => {
                logger.error('bundle-download writeStream error:', error);
                if (downloadRequest) {
                  downloadRequest.destroy();
                  downloadRequest = null;
                }
                this.isDownloading = false;
                this.cancelCurrentDownload = () => {};
                safeReject(error);
                clearWindowProgressBar(this.getMainWindow());
              });

              response.on('error', (error) => {
                logger.error(
                  'bundle-download',
                  'Response stream error:',
                  error,
                );
                writeStream.destroy();
                downloadRequest = null;
                this.isDownloading = false;
                this.cancelCurrentDownload = () => {};
                safeReject(error);
                clearWindowProgressBar(this.getMainWindow());
              });
            },
          );

          downloadRequest.on('error', (error) => {
            logger.error('bundle-download', 'Request error:', error);
            downloadRequest = null;
            this.cancelCurrentDownload = null;
            this.isDownloading = false;
            safeReject(error);
          });

          downloadRequest.setTimeout(1000 * 60 * 30, () => {
            logger.error('bundle-download', 'Download timed out (30min)');
            if (downloadRequest) {
              downloadRequest.destroy();
              downloadRequest = null;
            }
            this.isDownloading = false;
            this.cancelCurrentDownload = null;
            safeReject(new Error('Download timeout'));
          });
        };

        makeDownloadRequest(bundleUrl, options);
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
      skipGPGVerification,
    } = params || {};
    const allowSkipGPG = this.isSkipGPGAllowed(skipGPGVerification);
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      (!signature && !allowSkipGPG)
    ) {
      throw new OneKeyLocalError('Invalid parameters');
    }
    if (!allowSkipGPG) {
      await verifyMetadataFileSha256({
        appVersion,
        bundleVersion,
        signature: signature!,
      });
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
  async downloadBundleASC(params: IUpdateDownloadedEvent) {
    const {
      downloadedFile,
      sha256,
      latestVersion: appVersion,
      bundleVersion,
      signature,
      skipGPGVerification,
    } = params || {};
    const allowSkipGPG = this.isSkipGPGAllowed(skipGPGVerification);
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      (!signature && !allowSkipGPG)
    ) {
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
      skipGPGVerification,
    } = params || {};
    const allowSkipGPG = this.isSkipGPGAllowed(skipGPGVerification);
    if (
      !downloadedFile ||
      !sha256 ||
      !appVersion ||
      !bundleVersion ||
      (!signature && !allowSkipGPG)
    ) {
      logger.error('bundle-verifyASC', 'Invalid parameters', {
        downloadedFile,
        sha256,
        appVersion,
        bundleVersion,
        hasSignature: !!signature,
        skipGPGVerification,
        allowSkipGPG,
      });
      throw new OneKeyLocalError('Invalid parameters');
    }
    if (!allowSkipGPG) {
      const isBundleVerified = verifySha256(downloadedFile, sha256);
      if (!isBundleVerified) {
        logger.error(
          'bundle-verifyASC',
          `SHA256 verification failed for ${downloadedFile}`,
        );
        throw new OneKeyLocalError('Invalid bundle file');
      }
    }
    const extractDir = getBundleExtractDir({
      appVersion,
      bundleVersion,
    });

    try {
      const zip = new AdmZip(downloadedFile);
      const resolvedExtractDir = path.resolve(extractDir);
      // Validate all zip entries for path traversal before extraction
      for (const entry of zip.getEntries()) {
        const entryPath = path.resolve(resolvedExtractDir, entry.entryName);
        if (
          !entryPath.startsWith(resolvedExtractDir + path.sep) &&
          entryPath !== resolvedExtractDir
        ) {
          logger.error(
            'bundle-verifyASC',
            `Path traversal detected in zip entry: ${entry.entryName}`,
          );
          throw new OneKeyLocalError(
            `Path traversal detected in zip entry: ${entry.entryName}`,
          );
        }
      }
      zip.extractAllTo(extractDir, true);
    } catch (error) {
      logger.error('Failed to extract bundle zip file:', error);
      // Cleanup partially extracted directory
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
      throw error;
    }

    try {
      const metadataFilePath = this.getMetadataFilePath({
        appVersion,
        bundleVersion,
      });
      logger.info('bundle-verifyBundleASC', metadataFilePath, allowSkipGPG);
      if (!allowSkipGPG) {
        await verifyMetadataFileSha256({
          appVersion,
          bundleVersion,
          signature: signature!,
        });
      }

      // Verify all extracted files against metadata SHA256 hashes
      if (!fs.existsSync(metadataFilePath)) {
        throw new OneKeyLocalError('metadata.json not found after extraction');
      }
      const metadataContent = fs.readFileSync(metadataFilePath, 'utf8');
      const metadata = JSON.parse(metadataContent) as Record<string, string>;
      this.verifyAllExtractedFiles(extractDir, metadata, extractDir);
    } catch (error) {
      // Cleanup extracted directory on verification failure
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  private verifyAllExtractedFiles(
    dirPath: string,
    metadata: Record<string, string>,
    baseDir: string,
  ) {
    const verifiedFiles = new Set<string>();
    this.walkAndVerifyFiles(dirPath, metadata, baseDir, verifiedFiles);

    // Security: Verify completeness — every file in metadata must exist on disk
    const metadataKeys = Object.keys(metadata);
    for (const key of metadataKeys) {
      if (!verifiedFiles.has(key)) {
        logger.error(
          'bundle-verify',
          `File listed in metadata but missing on disk: ${key}`,
        );
        throw new OneKeyLocalError(
          `File ${key} listed in metadata but missing on disk`,
        );
      }
    }
  }

  private walkAndVerifyFiles(
    dirPath: string,
    metadata: Record<string, string>,
    baseDir: string,
    verifiedFiles: Set<string>,
  ) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      // Security: Reject symbolic links to prevent symlink attacks
      if (entry.isSymbolicLink()) {
        logger.error('bundle-verify', `Symbolic link detected: ${entry.name}`);
        throw new OneKeyLocalError(`Symbolic link detected: ${entry.name}`);
      }
      if (entry.isDirectory()) {
        this.walkAndVerifyFiles(fullPath, metadata, baseDir, verifiedFiles);
      } else if (entry.name !== 'metadata.json' && entry.name !== '.DS_Store') {
        // Strict contract: only files under "build/" are allowed to be hashed
        // by metadata. Any extra root-level file is treated as verification failure.
        const relativePath = path
          .relative(path.join(baseDir, 'build'), fullPath)
          .split(path.sep)
          .join('/');
        const expectedSha512 = metadata[relativePath];
        if (!expectedSha512) {
          logger.error(
            'bundle-verify',
            `File on disk not found in metadata: ${relativePath}`,
          );
          throw new OneKeyLocalError(
            `File ${relativePath} not found in metadata`,
          );
        }
        const isSha512Matched = checkFileSha512(fullPath, expectedSha512);
        if (!isSha512Matched) {
          logger.error('bundle-verify', `SHA512 mismatch for ${relativePath}`);
          throw new OneKeyLocalError(
            `SHA512 mismatch for file ${relativePath}`,
          );
        }
        verifiedFiles.add(relativePath);
      }
    }
  }

  async isBundleExists(
    appVersion: string,
    bundleVersion: string,
  ): Promise<boolean> {
    const extractDir = getBundleExtractDir({ appVersion, bundleVersion });
    return fs.existsSync(extractDir);
  }

  async listLocalBundles(): Promise<
    { appVersion: string; bundleVersion: string }[]
  > {
    const bundleDir = getBundleDirName();
    if (!fs.existsSync(bundleDir)) {
      return [];
    }
    const entries = fs.readdirSync(bundleDir, { withFileTypes: true });
    const results: { appVersion: string; bundleVersion: string }[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const lastDash = entry.name.lastIndexOf('-');
        if (lastDash > 0) {
          const appVersion = entry.name.substring(0, lastDash);
          const bundleVersion = entry.name.substring(lastDash + 1);
          if (appVersion && bundleVersion) {
            results.push({ appVersion, bundleVersion });
          }
        }
      }
    }
    return results;
  }

  async verifyExtractedBundle(
    appVersion: string,
    bundleVersion: string,
  ): Promise<void> {
    const extractDir = getBundleExtractDir({ appVersion, bundleVersion });
    if (!fs.existsSync(extractDir)) {
      logger.error(
        'bundle-verify',
        `verifyExtractedBundle: directory not found: ${extractDir}`,
      );
      throw new OneKeyLocalError('Bundle directory not found');
    }
    const metadataFilePath = path.join(extractDir, 'metadata.json');
    if (!fs.existsSync(metadataFilePath)) {
      logger.error(
        'bundle-verify',
        `verifyExtractedBundle: metadata.json not found in ${extractDir}`,
      );
      throw new OneKeyLocalError('metadata.json not found');
    }
    const metadataContent = fs.readFileSync(metadataFilePath, 'utf8');
    const metadata = JSON.parse(metadataContent) as Record<string, string>;
    this.verifyAllExtractedFiles(extractDir, metadata, extractDir);
  }

  async installBundle(params: IUpdateDownloadedEvent) {
    const {
      latestVersion: appVersion,
      bundleVersion,
      signature,
      skipGPGVerification,
    } = params || {};
    const allowSkipGPG = this.isSkipGPGAllowed(skipGPGVerification);
    if (!appVersion || !bundleVersion || (!signature && !allowSkipGPG)) {
      logger.error('bundle-install', 'Invalid parameters', {
        appVersion,
        bundleVersion,
        hasSignature: !!signature,
        allowSkipGPG,
      });
      throw new OneKeyLocalError('Invalid parameters');
    }
    const currentUpdateBundleData = store.getUpdateBundleData();

    // Security: Verify bundle directory exists before updating store
    const extractDir = getBundleExtractDir({ appVersion, bundleVersion });
    if (!fs.existsSync(extractDir)) {
      logger.error(
        'bundle-install',
        `Bundle directory not found: ${appVersion}-${bundleVersion}`,
      );
      throw new OneKeyLocalError(
        `Bundle directory not found: ${appVersion}-${bundleVersion}`,
      );
    }

    store.setUpdateBundleData({
      appVersion,
      bundleVersion,
      signature: signature ?? '',
    });
    logger.info('installBundle', {
      appVersion,
      bundleVersion,
      signature,
    });
    store.setNativeVersion(app.getVersion());
    const buildNumber = process.env.BUILD_NUMBER ?? '';
    store.setNativeBuildNumber(buildNumber);
    logger.info('installBundle setNativeVersion', {
      nativeVersion: app.getVersion(),
      buildNumber,
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
    // Destroy window first to ensure renderer process is fully terminated
    // before relaunch, preventing webview custom element double registration
    this.getMainWindow()?.destroy();
    if (!process.mas) {
      app.relaunch();
    }
    app.exit(0);
  }

  async clearDownload() {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        this.cancelCurrentDownload?.();
        const downloadDir = this.getDownloadDir();
        fs.rmSync(downloadDir, { recursive: true, force: true });
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
    if (updateBundleData.appVersion && updateBundleData.bundleVersion) {
      // Destroy window first to ensure renderer process is fully terminated
      // before relaunch, preventing webview custom element double registration
      this.getMainWindow()?.destroy();
      if (!process.mas) {
        app.relaunch();
      }
      app.exit(0);
    }
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
    await this.clearBundleExtract();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 300);
    });
  }

  async resetToBuiltInBundle() {
    store.clearUpdateBundleData();
    logger.info(
      'resetToBuiltInBundle: cleared update bundle data, app will use built-in bundle on next restart',
    );
  }

  async restart() {
    this.getMainWindow()?.destroy();
    if (!process.mas) {
      app.relaunch();
    }
    app.exit(0);
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

  async testSkipVerification() {
    const skipGPGVerification = true;
    return Promise.resolve(this.isSkipGPGAllowed(skipGPGVerification));
  }

  async isSkipGpgVerificationAllowed() {
    return Promise.resolve(
      process.env.ONEKEY_ALLOW_SKIP_GPG_VERIFICATION === 'true',
    );
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

  async getNativeAppVersion() {
    return app.getVersion();
  }

  async getNativeBuildNumber(): Promise<string> {
    const buildNumber = process.env.BUILD_NUMBER;
    return typeof buildNumber === 'string' ? buildNumber : '';
  }

  async getBuiltinBundleVersion(): Promise<string> {
    const bundleVersion = process.env.BUNDLE_VERSION;
    return typeof bundleVersion === 'string' ? bundleVersion : '';
  }

  async getJsBundlePath() {
    return (
      globalThis.$desktopMainAppFunctions?.getBundleIndexHtmlPath?.() || ''
    );
  }

  async getSha256FromFilePath(filePath: string) {
    return calculateSHA256(filePath);
  }
}

export default DesktopApiAppBundleUpdate;
