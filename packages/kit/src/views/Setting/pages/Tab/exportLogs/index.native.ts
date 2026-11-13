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
  type ILogDigest,
  type ILogUploadPath,
  type ILogUploadResponse,
  type ILogUploadViaIpTableResult,
} from '@onekeyhq/shared/src/logger/types';
import utils from '@onekeyhq/shared/src/logger/utils';
import { NativeLogger } from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { withCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import { sanitizeSniDiagnosticText } from '@onekeyhq/shared/src/request/helpers/sniLogRedaction';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';

import {
  LOG_UPLOAD_TIMEOUT_MS,
  LogUploadError,
  isSniPreWriteUploadErrorCode,
  isSniTimeoutErrorCode,
  markUploadErrorRequestNotSent,
  withLogUploadTimeout,
} from './logUploadUtils';
import { buildDefaultFileBaseName } from './utils';

const IP_TABLE_CONNECTION_INFO_TIMEOUT_MS = 300;

const getShareModule = async () => {
  if (!platformEnv.isNative) return null;
  return (await import('@onekeyhq/shared/src/modules3rdParty/expo-sharing'))
    .default;
};

const logIpTableConnectionInfo = async () => {
  try {
    const connectionInfo = await Promise.race([
      backgroundApiProxy.serviceIpTable.getConnectionInfo(),
      waitAsync(IP_TABLE_CONNECTION_INFO_TIMEOUT_MS).then(() => null),
    ]);
    if (!connectionInfo) {
      defaultLogger.ipTable.request.warn({
        info: `[IpTable] Skipped connection info after ${IP_TABLE_CONNECTION_INFO_TIMEOUT_MS}ms timeout`,
      });
      return;
    }
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
};

const prepareNativeLogExport = async () => {
  defaultLogger.setting.device.logDeviceInfo();
  await logIpTableConnectionInfo();
  await prepareLoggerExport();
  // Flush the shared native logger explicitly instead of relying on a delay.
  // Both native JS runtimes write to this same native logger instance.
  await NativeLogger.getLogFilePaths();
};

export const exportLogs = async (filename: string) => {
  await prepareNativeLogExport();
  const logFilePath = await utils.getLogFilePath(filename);
  console.log('logFilePath', logFilePath);
  const Share = await getShareModule();
  if (!Share) return;
  await Share.shareAsync(logFilePath, {
    dialogTitle: 'OneKey Logs',
    mimeType: 'application/zip',
    UTI: 'public.zip-archive',
  }).catch(() => {
    /** ignore */
  });
};

export const collectLogDigest = async (
  fileBaseName?: string,
): Promise<ILogDigest> => {
  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Collecting,
    progressPercent: 0,
  });
  const baseName = fileBaseName ?? buildDefaultFileBaseName();
  await prepareNativeLogExport();

  const filePath = await utils.getLogFilePath(baseName);
  if (!filePath) {
    throw new OneKeyLocalError('Failed to generate native log archive');
  }

  const normalizedPath = filePath.startsWith('file://')
    ? filePath.replace('file://', '')
    : filePath;

  const RNFS = (
    await import('@onekeyhq/shared/src/modules3rdParty/react-native-fs')
  ).default;
  if (!RNFS) {
    throw new OneKeyLocalError('RNFS is not available');
  }
  const stat = await RNFS.stat(normalizedPath);
  const sizeBytes = Number(stat.size ?? 0);
  // Keep prior "empty string on failure" semantics for ILogDigest consumers.
  let sha256 = '';
  try {
    sha256 = await RNFS.hash(normalizedPath, 'sha256');
  } catch {
    sha256 = '';
  }
  return {
    sizeBytes,
    sha256,
    bundle: {
      type: 'file',
      fileName: `${baseName}.zip`,
      mimeType: 'application/zip',
      filePath,
    },
  };
};

// Native archives stay available for deferred readers and are removed by the
// next launch's background idle cleanup.
export const disposeLogDigest = async (_digest: ILogDigest) => {};

type ILogUploadHttpResult = {
  path: ILogUploadPath;
  httpStatus: number;
  text: string;
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

const emitUploadProgress = (
  sentBytes: number,
  totalBytes: number,
  requestId?: string,
) => {
  if (totalBytes <= 0) return;
  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Uploading,
    requestId,
    bytesSent: sentBytes,
    totalBytes,
    progressPercent: Math.min(99, Math.floor((sentBytes / totalBytes) * 100)),
  });
};

/**
 * The domain upload goes through the OS resolver. In mainland China that
 * route can crawl at a few KB/s, which is why the SNI route is tried first.
 */
const uploadViaUploadTask = async ({
  uploadUrl,
  headers,
  digest,
  filePath,
  mimeType,
  timeoutMs,
  onSentBytes,
  onPathChange,
  requestId,
}: {
  uploadUrl: string;
  headers: Record<string, string>;
  digest: ILogDigest;
  filePath: string;
  mimeType: string;
  timeoutMs: number;
  onSentBytes: (sentBytes: number) => void;
  onPathChange?: (path: ILogUploadPath) => void;
  requestId?: string;
}): Promise<ILogUploadHttpResult> => {
  let fileSystemModule: typeof import('expo-file-system/legacy') | undefined;
  try {
    fileSystemModule = await import('expo-file-system/legacy');
  } catch (_error) {
    fileSystemModule = undefined;
  }

  let uploadTaskError: unknown;
  let taskSentBytes = 0;
  let taskClosed = false;
  if (fileSystemModule?.createUploadTask) {
    try {
      const uploadTask = fileSystemModule.createUploadTask(
        uploadUrl,
        filePath,
        {
          headers: { ...headers, 'content-type': mimeType },
          httpMethod: 'POST',
          uploadType: fileSystemModule.FileSystemUploadType.BINARY_CONTENT,
        },
        (progress) => {
          if (taskClosed) return;
          const total =
            typeof progress.totalBytesExpectedToSend === 'number' &&
            progress.totalBytesExpectedToSend > 0
              ? progress.totalBytesExpectedToSend
              : digest.sizeBytes;
          taskSentBytes = progress.totalBytesSent;
          onSentBytes(progress.totalBytesSent);
          emitUploadProgress(progress.totalBytesSent, total, requestId);
        },
      );
      const result = await withLogUploadTimeout(
        uploadTask.uploadAsync(),
        timeoutMs,
        () => {
          void uploadTask.cancelAsync().catch(() => undefined);
        },
      ).finally(() => {
        taskClosed = true;
      });
      if (!result) {
        throw new OneKeyLocalError('Upload cancelled');
      }
      return {
        path: 'upload_task',
        httpStatus: result.status ?? 0,
        text: result.body ?? '',
      };
    } catch (error) {
      // A timed-out upload already spent the whole budget; do not start
      // another full upload on the same slow route.
      if (error instanceof LogUploadError && error.reason === 'timeout') {
        throw error;
      }
      if (taskSentBytes > 0) {
        throw new LogUploadError({
          reason: 'network',
          retryable: false,
          message: getErrorMessage(error),
        });
      }
      uploadTaskError = error;
    }
  } else {
    uploadTaskError = new OneKeyLocalError('Upload task is not available');
  }

  onSentBytes(0);
  onPathChange?.('fetch_fallback');
  defaultLogger.setting.logUpload.uploadStart({
    path: 'fetch_fallback',
    hostname: getHostnameForLog(uploadUrl),
    sizeBytes: digest.sizeBytes,
    timeoutMs,
    skipReason: sanitizeSniDiagnosticText(
      `upload_task_failed:${getErrorMessage(uploadTaskError)}`,
    ),
  });

  const form = new FormData();
  form.append('file', {
    uri: filePath,
    name: digest.bundle.fileName,
    type: mimeType,
  } as any);
  const fallbackHeaders = { ...headers };
  delete fallbackHeaders['content-type'];
  delete fallbackHeaders['Content-Type'];

  const abortController = new AbortController();
  try {
    return await withLogUploadTimeout(
      (async () => {
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: fallbackHeaders,
          body: form,
          signal: abortController.signal,
        });
        return {
          path: 'fetch_fallback' as const,
          httpStatus: response.status,
          text: await response.text(),
        };
      })(),
      timeoutMs,
      () => abortController.abort(),
    );
  } catch (error) {
    if (error instanceof LogUploadError) {
      throw error;
    }
    throw new LogUploadError({
      reason: 'network',
      message: getErrorMessage(error),
    });
  }
};

export const uploadLogBundle = async ({
  uploadToken,
  digest,
  requestId,
}: {
  uploadToken: string;
  digest: ILogDigest;
  requestId?: string;
}): Promise<{ digest: ILogDigest; result: ILogUploadResponse }> => {
  if (!uploadToken) {
    throw markUploadErrorRequestNotSent(
      new OneKeyLocalError('Upload token is required'),
    );
  }
  if (!digest || !digest.bundle || digest.sizeBytes <= 0) {
    throw markUploadErrorRequestNotSent(
      new OneKeyLocalError('Log bundle is empty'),
    );
  }
  if (digest.bundle.type !== 'file') {
    throw markUploadErrorRequestNotSent(
      new OneKeyLocalError('Native upload expects a file bundle'),
    );
  }
  const { filePath } = digest.bundle;
  const mimeType = digest.bundle.mimeType ?? 'application/octet-stream';

  let endpointInfo: Awaited<
    ReturnType<typeof backgroundApiProxy.serviceApp.getEndpointInfo>
  >;
  try {
    endpointInfo = await backgroundApiProxy.serviceApp.getEndpointInfo({
      name: EServiceEndpointEnum.Wallet,
    });
  } catch (error) {
    throw markUploadErrorRequestNotSent(error);
  }
  const uploadUrl = `${endpointInfo.endpoint.replace(
    /\/$/,
    '',
  )}/wallet/v1/client/log`;
  const hostname = getHostnameForLog(uploadUrl);

  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Uploading,
    requestId,
  });

  const startedAt = Date.now();
  let path: ILogUploadPath = 'sni';
  let sentBytes = 0;
  let requestSent = false;
  const logFailure = (
    error: unknown,
    httpStatus?: number,
    serverCode?: number,
  ) => {
    defaultLogger.setting.logUpload.uploadFailed({
      path,
      hostname,
      sizeBytes: digest.sizeBytes,
      elapsedMs: Date.now() - startedAt,
      httpStatus,
      serverCode,
      sentBytes,
      errorCode:
        error instanceof LogUploadError
          ? error.reason
          : (error as { code?: unknown } | undefined)?.code?.toString(),
      errorMessage: sanitizeSniDiagnosticText(getErrorMessage(error)),
    });
  };
  const failWith = (
    error: unknown,
    httpStatus?: number,
    serverCode?: number,
  ): never => {
    logFailure(error, httpStatus, serverCode);
    appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
      stage: ELogUploadStage.Error,
      requestId,
      message: getErrorMessage(error),
    });
    if (!requestSent) {
      markUploadErrorRequestNotSent(error);
    }
    throw error;
  };

  let httpResult: ILogUploadHttpResult | undefined;
  try {
    defaultLogger.setting.logUpload.uploadStart({
      path: 'sni',
      hostname,
      sizeBytes: digest.sizeBytes,
      timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
    });
    // The bg transport enforces this timeout; the extra margin only guards a
    // lost bridge reply.
    let sniResult: ILogUploadViaIpTableResult;
    try {
      sniResult = await withLogUploadTimeout(
        backgroundApiProxy.serviceLogger.uploadLogFileViaIpTable({
          ...(requestId ? { requestId } : {}),
          uploadToken,
          filePath,
          mimeType,
          sizeBytes: digest.sizeBytes,
          timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
        }),
        LOG_UPLOAD_TIMEOUT_MS + 5000,
      );
    } catch (error) {
      requestSent = true;
      throw error;
    }
    if (sniResult.route === 'sni') {
      requestSent = true;
      sentBytes = digest.sizeBytes;
      httpResult = {
        path: 'sni',
        httpStatus: sniResult.httpStatus,
        text: sniResult.body,
      };
    } else if (
      sniResult.route === 'failed' &&
      isSniTimeoutErrorCode(sniResult.errorCode)
    ) {
      requestSent = true;
      throw new LogUploadError({
        reason: 'timeout',
        message: `Log upload timed out after ${LOG_UPLOAD_TIMEOUT_MS}ms`,
      });
    } else if (
      sniResult.route === 'failed' &&
      !isSniPreWriteUploadErrorCode(sniResult.errorCode)
    ) {
      requestSent = true;
      // Once the archive may have been written to the SNI socket, do not
      // immediately replay a second POST over the domain or via outer retry.
      throw new LogUploadError({
        reason: 'network',
        retryable: false,
        message:
          sniResult.errorMessage ||
          `SNI upload failed (${sniResult.errorCode})`,
      });
    } else {
      // Skipped (no pinned IP, proxy, old native binary) or failed before
      // any request bytes were sent: the domain route is safe to try.
      defaultLogger.setting.logUpload.uploadStart({
        path: 'upload_task',
        hostname,
        sizeBytes: digest.sizeBytes,
        timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
        skipReason: sanitizeSniDiagnosticText(
          sniResult.route === 'skipped'
            ? sniResult.reason
            : `sni_failed:${sniResult.errorCode}`,
        ),
      });
    }

    if (!httpResult) {
      path = 'upload_task';
      const headers = await withCustomUAHeaders(uploadUrl, {
        ...(await getRequestHeaders()),
        authorization: `Bearer ${uploadToken}`,
      });
      delete headers['content-length'];
      delete headers['Content-Length'];
      requestSent = true;
      httpResult = await uploadViaUploadTask({
        uploadUrl,
        headers,
        digest,
        filePath,
        mimeType,
        timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
        onSentBytes: (bytes) => {
          sentBytes = bytes;
        },
        onPathChange: (nextPath) => {
          path = nextPath;
        },
        requestId,
      });
      path = httpResult.path;
    }
  } catch (error) {
    return failWith(error);
  }

  const { httpStatus, text } = httpResult;

  type IServerPayload =
    | IApiClientResponse<ILogUploadResponse>
    | {
        code: number;
        message?: string;
        data?: { message?: string };
      };
  let payload: IServerPayload | undefined;
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch (_error) {
    payload = undefined;
  }

  if (!payload || typeof payload !== 'object') {
    return failWith(
      new LogUploadError({
        reason: 'http',
        httpStatus,
        message: `Upload failed: invalid response (HTTP ${httpStatus})`,
      }),
      httpStatus,
    );
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
        httpStatusCode: httpStatus,
        data: payload,
      }),
      httpStatus,
      payload.code,
    );
  }

  if (!payload.data || httpStatus < 200 || httpStatus >= 300) {
    return failWith(
      new LogUploadError({
        reason: 'http',
        httpStatus,
        message:
          payload.message ||
          `Upload failed: missing response data (HTTP ${httpStatus})`,
      }),
      httpStatus,
    );
  }

  defaultLogger.setting.logUpload.uploadSucceeded({
    path,
    hostname,
    sizeBytes: digest.sizeBytes,
    elapsedMs: Date.now() - startedAt,
    httpStatus,
    sentBytes,
  });
  appEventBus.emit(EAppEventBusNames.ClientLogUploadProgress, {
    stage: ELogUploadStage.Success,
    requestId,
    progressPercent: 100,
  });

  return {
    digest,
    result: payload.data as ILogUploadResponse,
  };
};
