import * as nodePath from 'path';

import SniNodeClient from '@onekeyfe/react-native-sni-connect/node';
import { session } from 'electron';
import logger from 'electron-log/main';

import { EDesktopIpcChannel } from '@onekeyhq/shared/src/consts/desktopIpcChannels';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type {
  ISniRequestConfig,
  ISniRequestDebugSnapshot,
  ISniResponse,
  ISniUploadFileConfig,
} from '@onekeyhq/shared/src/request/types/ipTable';

import type { IDesktopApi } from './instance/IDesktopApi';
import type { SniNodeUploadValidationOptions } from '@onekeyfe/react-native-sni-connect/node';

// Only the main-process log archive directory (logs_zip next to the log
// directory) may be uploaded; userData, raw logs, and temp are off-limits.
function getUploadFileRoots(): string[] {
  try {
    return [
      nodePath.join(
        nodePath.dirname(
          nodePath.dirname(logger.transports.file.getFile().path),
        ),
        'logs_zip',
      ),
    ];
  } catch {
    // The logger file transport may be disabled.
    return [];
  }
}

function getUploadValidationOptions(
  desktopApi?: IDesktopApi,
): SniNodeUploadValidationOptions {
  return {
    getAllowedUploadRoots: getUploadFileRoots,
    verifyUploadFile: (realPath, sizeBytes) =>
      typeof desktopApi?.dev?._isCollectedLoggerArchive !== 'function' ||
      desktopApi.dev._isCollectedLoggerArchive(realPath, sizeBytes),
  };
}

class DesktopApiSniRequest {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.client = new SniNodeClient({
      ...getUploadValidationOptions(desktopApi),
      logger: {
        info: (message) => logger.info(message),
        warn: (message) => logger.warn(message),
        error: (message) => logger.error(message),
      },
      logPrefix: '[DesktopApiSniRequest]',
      resolveProxy: (url) => session.defaultSession.resolveProxy(url),
      onUploadProgress: ({
        requestId,
        bytesSent,
        totalBytes,
        progressPercent,
      }) => {
        const mainWindow =
          globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            EDesktopIpcChannel.CLIENT_LOG_UPLOAD_PROGRESS,
            {
              stage: ELogUploadStage.Uploading,
              requestId,
              bytesSent,
              totalBytes,
              progressPercent,
            },
          );
        }
      },
    });
  }

  desktopApi: IDesktopApi;

  private readonly client: SniNodeClient;

  async isProxyActiveForUrl(url: string): Promise<boolean> {
    return this.client.isProxyActiveForUrl(url);
  }

  async request(config: ISniRequestConfig): Promise<ISniResponse> {
    if (
      config.body === null &&
      typeof config.method === 'string' &&
      ['POST', 'PUT', 'PATCH'].includes(config.method.trim().toUpperCase())
    ) {
      return this.client.request({ ...config, body: '' });
    }
    return this.client.request(config);
  }

  /**
   * Stream a local file in app-owned storage as the request body over the
   * same pinned destination, admission, timeout and cancel rules as request().
   */
  async uploadFile(config: ISniUploadFileConfig): Promise<ISniResponse> {
    return this.client.uploadFile(config);
  }

  async cancelRequest(requestId: string): Promise<{ success: boolean }> {
    return this.client.cancelRequest(requestId);
  }

  async getDebugSnapshot({
    hostname,
    ip,
  }: Pick<
    ISniRequestConfig,
    'hostname' | 'ip'
  >): Promise<ISniRequestDebugSnapshot> {
    return this.client.getDebugSnapshot({ hostname, ip });
  }

  async cancelAllRequests(): Promise<{ success: boolean }> {
    return this.client.cancelAllRequests();
  }

  async clearDNSCache(): Promise<{ success: boolean }> {
    return this.client.clearDNSCache();
  }

  async isSupported(): Promise<boolean> {
    return this.client.isSupported();
  }
}

export default DesktopApiSniRequest;
