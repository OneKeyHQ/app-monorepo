import * as nodePath from 'path';

import SniNodeClient, {
  SniRequestError,
} from '@onekeyfe/react-native-sni-connect/node';
import { session } from 'electron';
import logger from 'electron-log/main';
import ipaddr from 'ipaddr.js';

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

function rejectSpecialPurposeIpv6(ip: string): void {
  if (typeof ip !== 'string' || !ipaddr.IPv6.isValid(ip)) return;
  const address = ipaddr.IPv6.parse(ip);
  // Preserve Electron's original range policy while the SDK handles mapped IPv4.
  if (!address.isIPv4MappedAddress() && address.range() !== 'unicast') {
    throw new SniRequestError('SNI_INVALID_CONFIG', 'Forbidden IP range', true);
  }
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
    rejectSpecialPurposeIpv6(config.ip);
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
    rejectSpecialPurposeIpv6(config.ip);
    try {
      return await this.client.uploadFile(config);
    } catch (error) {
      // SDK 6.8.0-16 uses a policy error even when a response has arrived.
      if (
        error instanceof SniRequestError &&
        error.code === 'SNI_SECURITY_POLICY_FAILED' &&
        error.message ===
          'SNI_SECURITY_POLICY_FAILED: Protocol upgrades are not supported'
      ) {
        throw new SniRequestError(
          'SNI_RESPONSE_FAILED',
          'Protocol upgrades are not supported',
          true,
        );
      }
      throw error;
    }
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
    rejectSpecialPurposeIpv6(ip);
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
