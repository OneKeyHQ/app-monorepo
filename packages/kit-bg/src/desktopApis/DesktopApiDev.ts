import { createHash } from 'crypto';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';

import AdmZip from 'adm-zip';
import { shell } from 'electron';
import logger from 'electron-log/main';
import fetch from 'node-fetch';

import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import * as store from '@onekeyhq/desktop/app/libs/store';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type { IDesktopMainProcessDevOnlyApiParams } from '@onekeyhq/shared/types/desktop';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiDev {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async callDevOnlyApi(
    params: IDesktopMainProcessDevOnlyApiParams,
  ): Promise<any> {
    if (process.env.NODE_ENV !== 'production') {
      const { module, method, params: apiParams } = params;
      console.log('call APP_DEV_ONLY_API::', module, method, apiParams);
      if (module === 'shell') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return (shell as any)[method](...apiParams);
      }
    }
    return undefined;
  }

  async openLoggerFile(): Promise<void> {
    await shell.openPath(path.dirname(logger.transports.file.getFile().path));
  }

  async exportLoggerZip(params: {
    fileBaseName: string;
  }): Promise<{ filePath: string }> {
    const digest = await this.collectLoggerDigest(params);
    const mainWindow = this.desktopApi.appUpdate.getMainWindow() ?? undefined;
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new OneKeyLocalError('No active window for download');
    }
    // Use pathToFileURL to properly handle Windows backslashes, spaces, and special chars
    const fileUrl = pathToFileURL(digest.filePath).href;
    mainWindow.webContents.downloadURL(fileUrl);
    return { filePath: digest.filePath };
  }

  async collectLoggerDigest(params: { fileBaseName: string }): Promise<{
    filePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  }> {
    if (!params.fileBaseName) {
      throw new OneKeyLocalError('fileBaseName is required');
    }
    const baseName = params.fileBaseName;
    const logFilePath = logger.transports.file.getFile().path;
    const logDir = path.dirname(logFilePath);
    const logFiles = await fsPromises.readdir(logDir);

    const zipName = `${baseName}.zip`;
    // Store zips in logs_zip/ next to log directory, matching native behavior
    const zipDir = path.join(path.dirname(logDir), 'logs_zip');
    await fsPromises.mkdir(zipDir, { recursive: true });

    const zipPath = path.join(zipDir, zipName);

    // Clean up stale zip files (older than 1 hour) to avoid removing
    // archives that a concurrent upload/download flow may still be using
    const ONE_HOUR_MS = 60 * 60 * 1000;
    try {
      const existingZips = await fsPromises.readdir(zipDir);
      for (const oldZip of existingZips) {
        if (oldZip.endsWith('.zip') && oldZip !== zipName) {
          try {
            const stat = await fsPromises.stat(path.join(zipDir, oldZip));
            if (Date.now() - stat.mtimeMs > ONE_HOUR_MS) {
              await fsPromises.unlink(path.join(zipDir, oldZip));
            }
          } catch {
            // ignore individual cleanup errors
          }
        }
      }
    } catch {
      // ignore cleanup errors
    }

    const zip = new AdmZip();
    logFiles
      .filter((fileName) => fileName.endsWith('.log'))
      .forEach((fileName) => {
        zip.addLocalFile(path.join(logDir, fileName), '', fileName);
      });
    zip.writeZip(zipPath);

    const fileBuffer = await fsPromises.readFile(zipPath);
    const sizeBytes = fileBuffer.length;
    const sha256Hex = createHash('sha256').update(fileBuffer).digest('hex');

    return {
      filePath: zipPath,
      fileName: zipName,
      mimeType: 'application/zip',
      sizeBytes,
      sha256: sha256Hex,
    };
  }

  async uploadLoggerBundle(params: {
    uploadUrl: string;
    filePath: string;
    headers: Record<string, string>;
    sizeBytes?: number;
  }): Promise<any> {
    const { uploadUrl, filePath, headers, sizeBytes } = params;
    if (!uploadUrl || !filePath) {
      throw new OneKeyLocalError('uploadUrl and filePath are required');
    }
    const reqHeaders: Record<string, string> = { ...headers };
    if (sizeBytes !== undefined && !('content-length' in reqHeaders)) {
      reqHeaders['content-length'] = String(sizeBytes);
    }

    logger.info('[client-log-upload] url:', uploadUrl);
    logger.info('[client-log-upload] filePath:', filePath);
    logger.info('[client-log-upload] sizeBytes:', sizeBytes);
    logger.info('[client-log-upload] headers:', JSON.stringify(reqHeaders));

    const curlParts = [`curl -X POST '${uploadUrl}'`];
    Object.entries(reqHeaders).forEach(([key, value]) => {
      curlParts.push(`-H '${key}: ${value}'`);
    });
    curlParts.push(`--data-binary '@${filePath}'`);
    logger.info('[client-log-upload] curl command:', curlParts.join(' \\\n  '));

    const totalBytes =
      typeof sizeBytes === 'number' && sizeBytes > 0
        ? sizeBytes
        : ((await fsPromises.stat(filePath)).size ?? 0);
    const sendProgress = ({
      stage,
      progressPercent,
      message,
    }: {
      stage: ELogUploadStage;
      progressPercent?: number;
      message?: string;
    }) => {
      try {
        const mainWindow =
          this.desktopApi.appUpdate.getMainWindow() ?? undefined;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            ipcMessageKeys.CLIENT_LOG_UPLOAD_PROGRESS,
            {
              stage,
              progressPercent,
              message,
            },
          );
        }
      } catch (error) {
        logger.warn('[client-log-upload] failed to send progress', error);
      }
    };

    sendProgress({ stage: ELogUploadStage.Uploading, progressPercent: 0 });

    let uploadedBytes = 0;
    const fileStream = fs.createReadStream(filePath);
    if (totalBytes > 0) {
      fileStream.on('data', (chunk) => {
        uploadedBytes += chunk.length;
        const percent = Math.min(
          100,
          Math.round((uploadedBytes / totalBytes) * 100),
        );
        sendProgress({
          stage: ELogUploadStage.Uploading,
          progressPercent: percent,
        });
      });
    }
    fileStream.on('error', (streamError) => {
      sendProgress({
        stage: ELogUploadStage.Error,
        message:
          streamError instanceof Error
            ? streamError.message
            : String(streamError),
      });
    });

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: fileStream as unknown as any,
      });
      const text = await response.text();
      try {
        const parsed = JSON.parse(text) as Record<string, any>;
        if (typeof parsed.code === 'number') {
          if (parsed.code === 0) {
            sendProgress({
              stage: ELogUploadStage.Success,
              progressPercent: 100,
            });
          } else {
            sendProgress({
              stage: ELogUploadStage.Error,
              message:
                (parsed?.data as { message?: string } | undefined)?.message ||
                parsed.message,
            });
          }
        } else {
          sendProgress({
            stage: ELogUploadStage.Success,
            progressPercent: 100,
          });
        }
        return parsed;
      } catch (_error) {
        sendProgress({
          stage: ELogUploadStage.Error,
          message: text,
        });
        return {
          code: response.status,
          message: text,
        };
      }
    } catch (error) {
      sendProgress({
        stage: ELogUploadStage.Error,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // NativeLogger-compatible methods (aligned with react-native-native-logger)
  // -----------------------------------------------------------------------

  getLogDirectory(): string {
    return path.dirname(logger.transports.file.getFile().path);
  }

  async getLogFilePaths(): Promise<string[]> {
    const logDir = this.getLogDirectory();
    const files = await fsPromises.readdir(logDir);
    return files.filter((f) => f.endsWith('.log')).toSorted();
  }

  async deleteLogFiles(): Promise<void> {
    const logDir = this.getLogDirectory();
    const files = await fsPromises.readdir(logDir);
    const logFiles = files.filter((f) => f.endsWith('.log'));
    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      try {
        if (file === 'app-latest.log') {
          // Truncate active log file instead of deleting (matches native behavior)
          await fsPromises.writeFile(filePath, '');
        } else {
          await fsPromises.unlink(filePath);
        }
      } catch {
        // ignore individual file errors
      }
    }
  }

  async changeDevTools(isOpen: boolean): Promise<void> {
    store.setDevTools(isOpen);
    globalThis.$desktopMainAppFunctions?.refreshMenu?.();
  }

  // not working, use globalThis.desktopApi.testCrash(); instead
  // async testCrash(): Promise<void> {}
}

export default DesktopApiDev;
