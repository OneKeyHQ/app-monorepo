import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { prepareLoggerExport } from '@onekeyhq/shared/src/logger/exportSupport';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ELogUploadStage,
  LOG_UPLOAD_TIMEOUT_ERROR_CODE,
} from '@onekeyhq/shared/src/logger/types';
import type {
  ILogDigest,
  ILogUploadPath,
  ILogUploadResponse,
  ILogUploadViaIpTableResult,
} from '@onekeyhq/shared/src/logger/types';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import {
  LOG_UPLOAD_TIMEOUT_MS,
  LogUploadError,
  isSniTimeoutErrorCode,
  withLogUploadTimeout,
} from './logUploadUtils';
import { buildDefaultFileBaseName } from './utils';

const LOG_ARCHIVE_MIME_TYPE = 'application/zip';

export const collectLogDigest = async (
  fileBaseName?: string,
): Promise<ILogDigest> => {
  const baseName = fileBaseName ?? buildDefaultFileBaseName();
  defaultLogger.setting.device.logDeviceInfo();
  try {
    const connectionInfo =
      await backgroundApiProxy.serviceIpTable.getConnectionInfo();
    defaultLogger.ipTable.request.info({
      info: `[IpTable] Connection info: type=${connectionInfo.type}, domain=${
        connectionInfo.domain
      }, ip=${connectionInfo.ip ?? 'N/A'}, sniSupported=${String(
        connectionInfo.sniSupported,
      )}`,
    });
  } catch (error) {
    defaultLogger.ipTable.request.warn({
      info: `[IpTable] Failed to get connection info: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    });
  }
  await waitAsync(100);
  await prepareLoggerExport();
  const result = await globalThis.desktopApiProxy.dev.collectLoggerDigest({
    fileBaseName: baseName,
  });
  if (!result || !result.filePath) {
    throw new OneKeyLocalError('Failed to collect desktop log files');
  }
  return {
    sizeBytes: result.sizeBytes,
    sha256: result.sha256,
    bundle: {
      type: 'file',
      fileName: result.fileName ?? `${baseName}.zip`,
      mimeType: result.mimeType ?? LOG_ARCHIVE_MIME_TYPE,
      filePath: result.filePath,
    },
  };
};

export const disposeLogDigest = async (_digest: ILogDigest) => {};

export const exportLogs = async (fileBaseName?: string) => {
  const baseName = fileBaseName ?? buildDefaultFileBaseName();
  defaultLogger.setting.device.logDeviceInfo();
  try {
    const connectionInfo =
      await backgroundApiProxy.serviceIpTable.getConnectionInfo();
    defaultLogger.ipTable.request.info({
      info: `[IpTable] Connection info: type=${connectionInfo.type}, domain=${
        connectionInfo.domain
      }, ip=${connectionInfo.ip ?? 'N/A'}, sniSupported=${String(
        connectionInfo.sniSupported,
      )}`,
    });
  } catch (error) {
    defaultLogger.ipTable.request.warn({
      info: `[IpTable] Failed to get connection info: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    });
  }
  await waitAsync(50);
  await prepareLoggerExport();
  await globalThis.desktopApiProxy.dev.exportLoggerZip({
    fileBaseName: baseName,
  });
};

type IDesktopUploadPayload = {
  code?: unknown;
  message?: string;
  data?: unknown;
};

const getHostnameForLog = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getErrorCode = (error: unknown) => {
  if (error instanceof LogUploadError) return error.reason;
  const code = (error as { code?: unknown } | undefined)?.code;
  return code === undefined ? undefined : String(code);
};

/**
 * The domain upload streams the archive from the main process through the OS
 * resolver; in mainland China that route can crawl, so it is the fallback.
 */
const uploadViaDomain = async ({
  uploadUrl,
  headers,
  digest,
  filePath,
}: {
  uploadUrl: string;
  headers: Record<string, string>;
  digest: ILogDigest;
  filePath: string;
}): Promise<IDesktopUploadPayload> => {
  const removeProgressListener =
    typeof globalThis.desktopApi?.on === 'function'
      ? globalThis.desktopApi.on(
          ipcMessageKeys.CLIENT_LOG_UPLOAD_PROGRESS,
          (payload: {
            stage: ELogUploadStage;
            progressPercent?: number;
            retry?: number;
            message?: string;
          }) => {
            // Final states are emitted once by uploadLogBundle.
            if (payload.stage === ELogUploadStage.Uploading) {
              appEventBus.emit(
                EAppEventBusNames.ClientLogUploadProgress,
                payload,
              );
            }
          },
        )
      : undefined;
  try {
    // The main process aborts at LOG_UPLOAD_TIMEOUT_MS; the margin only
    // guards a lost IPC reply.
    const response = (await withLogUploadTimeout(
      globalThis.desktopApiProxy.dev.uploadLoggerBundle({
        uploadUrl,
        filePath,
        headers,
        sizeBytes: digest.sizeBytes,
        timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
      }),
      LOG_UPLOAD_TIMEOUT_MS + 5000,
    )) as unknown;
    if (!response || typeof response !== 'object') {
      throw new OneKeyLocalError('Upload failed: invalid response');
    }
    return response as IDesktopUploadPayload;
  } catch (error) {
    // Error classes do not survive IPC; recover the timeout from its code.
    if (getErrorMessage(error).includes(LOG_UPLOAD_TIMEOUT_ERROR_CODE)) {
      throw new LogUploadError({
        reason: 'timeout',
        message: `Log upload timed out after ${LOG_UPLOAD_TIMEOUT_MS}ms`,
      });
    }
    throw error;
  } finally {
    removeProgressListener?.();
  }
};

export const uploadLogBundle = async ({
  uploadToken,
  digest,
}: {
  uploadToken: string;
  digest: ILogDigest;
}): Promise<{ digest: ILogDigest; result: ILogUploadResponse }> => {
  if (!uploadToken) {
    throw new OneKeyLocalError('Upload token is required');
  }
  if (!digest || !digest.bundle || digest.sizeBytes <= 0) {
    throw new OneKeyLocalError('Log bundle is empty');
  }
  if (digest.bundle.type !== 'file') {
    throw new OneKeyLocalError('Desktop upload expects a file bundle');
  }
  const { filePath } = digest.bundle;
  const mimeType = digest.bundle.mimeType ?? LOG_ARCHIVE_MIME_TYPE;

  const endpointInfo = await backgroundApiProxy.serviceApp.getEndpointInfo({
    name: EServiceEndpointEnum.Wallet,
  });
  const baseUrl = endpointInfo.endpoint.replace(/\/$/, '');
  const uploadUrl = `${baseUrl}/wallet/v1/client/log`;
  const hostname = getHostnameForLog(uploadUrl);

  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Uploading,
    progressPercent: 0,
  });

  const startedAt = Date.now();
  let path: ILogUploadPath = 'sni';
  const failWith = (error: unknown, httpStatus?: number): never => {
    defaultLogger.setting.logUpload.uploadFailed({
      path,
      hostname,
      sizeBytes: digest.sizeBytes,
      elapsedMs: Date.now() - startedAt,
      httpStatus,
      errorCode: getErrorCode(error),
      errorMessage: getErrorMessage(error),
    });
    appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
      stage: ELogUploadStage.Error,
      message: getErrorMessage(error),
    });
    throw error;
  };

  let payload: IDesktopUploadPayload | undefined;
  let httpStatus: number | undefined;
  try {
    defaultLogger.setting.logUpload.uploadStart({
      path: 'sni',
      hostname,
      sizeBytes: digest.sizeBytes,
      timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
    });
    // The main-process transport enforces this timeout; the margin only
    // guards a lost IPC reply.
    const sniResult: ILogUploadViaIpTableResult = await withLogUploadTimeout(
      backgroundApiProxy.serviceLogger.uploadLogFileViaIpTable({
        uploadToken,
        filePath,
        mimeType,
        sizeBytes: digest.sizeBytes,
        timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
      }),
      LOG_UPLOAD_TIMEOUT_MS + 5000,
    );
    if (sniResult.route === 'sni') {
      httpStatus = sniResult.httpStatus;
      try {
        payload = JSON.parse(sniResult.body) as IDesktopUploadPayload;
      } catch {
        payload = undefined;
      }
      if (!payload || typeof payload !== 'object') {
        throw new LogUploadError({
          reason: 'http',
          httpStatus,
          message: `Upload failed: invalid response (HTTP ${httpStatus})`,
        });
      }
    } else if (
      sniResult.route === 'failed' &&
      isSniTimeoutErrorCode(sniResult.errorCode)
    ) {
      // The whole budget is spent; a domain retry would double the wait.
      throw new LogUploadError({
        reason: 'timeout',
        message: `Log upload timed out after ${LOG_UPLOAD_TIMEOUT_MS}ms`,
      });
    } else {
      path = 'domain';
      defaultLogger.setting.logUpload.uploadStart({
        path,
        hostname,
        sizeBytes: digest.sizeBytes,
        timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
        skipReason:
          sniResult.route === 'skipped'
            ? sniResult.reason
            : `sni_failed:${sniResult.errorCode}`,
      });
      const headers = await getRequestHeaders();
      headers.authorization = `Bearer ${uploadToken}`;
      headers['content-type'] = mimeType;
      headers['content-length'] = String(digest.sizeBytes);
      payload = await uploadViaDomain({
        uploadUrl,
        headers,
        digest,
        filePath,
      });
    }
  } catch (error) {
    return failWith(error, httpStatus);
  }

  if (typeof payload.code === 'number' && payload.code !== 0) {
    const message =
      (payload.data as { message?: string } | undefined)?.message ||
      payload.message ||
      'Upload failed';
    return failWith(
      new OneKeyServerApiError({
        message,
        code: payload.code,
        data: payload,
      }),
      httpStatus,
    );
  }

  if (!payload.data) {
    return failWith(
      new OneKeyLocalError('Upload failed: missing response data'),
      httpStatus,
    );
  }

  defaultLogger.setting.logUpload.uploadSucceeded({
    path,
    hostname,
    sizeBytes: digest.sizeBytes,
    elapsedMs: Date.now() - startedAt,
    httpStatus,
  });
  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Success,
    progressPercent: 100,
  });

  return {
    digest,
    result: payload.data as ILogUploadResponse,
  };
};
