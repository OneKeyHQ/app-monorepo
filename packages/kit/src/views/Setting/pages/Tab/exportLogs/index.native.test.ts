import { createUploadTask } from 'expo-file-system/legacy';

import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';
import {
  createApiAvailabilityTiming,
  reportApiAvailabilityError,
  reportApiAvailabilityResponse,
} from '@onekeyhq/shared/src/request/availabilityMetrics';

import { uploadLogBundle } from './index.native';
import { LOG_UPLOAD_TIMEOUT_MS } from './logUploadUtils';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      getEndpointInfo: jest.fn(async () => ({
        endpoint: 'https://wallet.example.com',
      })),
    },
    serviceLogger: { uploadLogFileViaIpTable: jest.fn() },
    serviceIpTable: { getConnectionInfo: jest.fn() },
  },
}));
jest.mock('expo-file-system/legacy', () => ({
  createUploadTask: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: {
      logUpload: {
        uploadStart: jest.fn(),
        uploadSucceeded: jest.fn(),
        uploadFailed: jest.fn(),
      },
      device: { logDeviceInfo: jest.fn() },
    },
    ipTable: { request: { info: jest.fn(), warn: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/logger/exportSupport', () => ({}));
jest.mock('@onekeyhq/shared/src/logger/utils', () => ({}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({ NativeLogger: {} }),
);
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/request/availabilityMetrics', () => ({
  createApiAvailabilityTiming: jest.fn(),
  reportApiAvailabilityError: jest.fn(),
  reportApiAvailabilityResponse: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest.fn(async (_url: string, headers: unknown) => ({
    ...(headers as Record<string, string>),
  })),
}));
jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  getRequestHeaders: jest.fn(async () => ({ 'x-onekey-request-id': 'id' })),
}));
jest.mock('./utils', () => ({}));

const mockedUploadViaIpTable = (
  jest.requireMock(
    '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  ) as {
    default: { serviceLogger: { uploadLogFileViaIpTable: jest.Mock } };
  }
).default.serviceLogger.uploadLogFileViaIpTable;
const { appEventBus } = jest.requireMock(
  '@onekeyhq/shared/src/eventBus/appEventBus',
) as { appEventBus: { emit: jest.Mock } };
const mockedCreateUploadTask = createUploadTask as jest.Mock;
const mockedLogUpload = defaultLogger.setting.logUpload as unknown as {
  uploadStart: jest.Mock;
  uploadSucceeded: jest.Mock;
  uploadFailed: jest.Mock;
};

const AVAILABILITY_TIMING = {
  startedAt: 0,
  service: 'wallet',
  routeGroup: '/wallet/v1/client/log',
};
const SUCCESS_BODY = JSON.stringify({
  code: 0,
  data: { objectKey: 'logs/key', uploadedBytes: 1024, durationMs: 1 },
});

function nativeDigest(): ILogDigest {
  return {
    sizeBytes: 1024,
    sha256: 'synthetic-sha',
    bundle: {
      type: 'file',
      fileName: 'OneKeyLogs.zip',
      mimeType: 'application/zip',
      filePath: 'file:///cache/logs_zip/OneKeyLogs.zip',
    },
  };
}

describe('native log upload transport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(createApiAvailabilityTiming)
      .mockReturnValue(AVAILABILITY_TIMING);
  });

  test('uploads over the SNI route without touching the domain route', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'sni',
      httpStatus: 200,
      body: SUCCESS_BODY,
      ipHash: 'hash',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: nativeDigest() }),
    ).resolves.toMatchObject({ result: { objectKey: 'logs/key' } });

    expect(mockedUploadViaIpTable).toHaveBeenCalledWith({
      uploadToken: 'token',
      filePath: 'file:///cache/logs_zip/OneKeyLogs.zip',
      mimeType: 'application/zip',
      sizeBytes: 1024,
      timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
    });
    expect(mockedCreateUploadTask).not.toHaveBeenCalled();
    expect(mockedLogUpload.uploadSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sni',
        hostname: 'wallet.example.com',
        httpStatus: 200,
        sizeBytes: 1024,
      }),
    );
  });

  test('reports byte progress from the domain upload task when SNI is disabled', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'skipped',
      reason: 'sni_unsupported',
    });
    mockedCreateUploadTask.mockImplementationOnce(
      (...args: Parameters<typeof createUploadTask>) => ({
        uploadAsync: jest.fn(async () => {
          args[3]?.({ totalBytesSent: 512, totalBytesExpectedToSend: 1024 });
          return { status: 200, body: SUCCESS_BODY };
        }),
        cancelAsync: jest.fn(),
      }),
    );

    await expect(
      uploadLogBundle({
        uploadToken: 'token',
        digest: nativeDigest(),
        requestId: 'domain-upload',
      }),
    ).resolves.toMatchObject({ result: { objectKey: 'logs/key' } });

    expect(mockedCreateUploadTask).toHaveBeenCalledWith(
      'https://wallet.example.com/wallet/v1/client/log',
      'file:///cache/logs_zip/OneKeyLogs.zip',
      expect.objectContaining({
        httpMethod: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer token',
          'content-type': 'application/zip',
        }),
      }),
      expect.any(Function),
    );
    expect(mockedLogUpload.uploadStart).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'upload_task',
        skipReason: 'sni_unsupported',
      }),
    );
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.ClientLogUploadProgress,
      {
        stage: ELogUploadStage.Uploading,
        requestId: 'domain-upload',
        bytesSent: 512,
        totalBytes: 1024,
        progressPercent: 50,
      },
    );
    expect(mockedLogUpload.uploadSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'upload_task' }),
    );
  });

  test('reports multipart upload bytes when the native upload task fails before sending', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'skipped',
      reason: 'sni_unsupported',
    });
    mockedCreateUploadTask.mockReturnValueOnce({
      uploadAsync: jest.fn().mockRejectedValue(new Error('Task unavailable')),
      cancelAsync: jest.fn(),
    });
    const request = {
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      upload: {
        onprogress: null as ((event: Partial<ProgressEvent>) => void) | null,
      },
      onload: null as (() => void) | null,
      status: 200,
      responseText: SUCCESS_BODY,
      send: jest.fn(() => {
        request.upload.onprogress?.({
          lengthComputable: true,
          loaded: 600,
          total: 1200,
        });
        request.onload?.();
      }),
    };
    const previousRequest = globalThis.XMLHttpRequest;
    globalThis.XMLHttpRequest = jest.fn(
      () => request,
    ) as unknown as typeof XMLHttpRequest;
    const append = jest
      .spyOn(FormData.prototype, 'append')
      .mockImplementation(() => undefined);
    try {
      await expect(
        uploadLogBundle({
          uploadToken: 'token',
          digest: nativeDigest(),
          requestId: 'multipart-upload',
        }),
      ).resolves.toMatchObject({ result: { objectKey: 'logs/key' } });
      expect(request.send).toHaveBeenCalledTimes(1);
      expect(createApiAvailabilityTiming).toHaveBeenCalledWith({
        url: 'https://wallet.example.com/wallet/v1/client/log',
      });
      expect(reportApiAvailabilityResponse).toHaveBeenCalledTimes(1);
      expect(reportApiAvailabilityResponse).toHaveBeenCalledWith({
        timing: AVAILABILITY_TIMING,
        httpStatus: 200,
      });
      expect(reportApiAvailabilityError).not.toHaveBeenCalled();
      expect(appEventBus.emit).toHaveBeenCalledWith(
        EAppEventBusNames.ClientLogUploadProgress,
        {
          stage: ELogUploadStage.Uploading,
          requestId: 'multipart-upload',
          bytesSent: 600,
          totalBytes: 1200,
          progressPercent: 50,
        },
      );
      expect(request.upload.onprogress).toBeNull();
    } finally {
      append.mockRestore();
      globalThis.XMLHttpRequest = previousRequest;
    }
  });

  test.each([
    {
      event: 'error',
      reason: 'network',
      error: { message: 'Network request failed' },
    },
    { event: 'abort', reason: 'network', error: { name: 'AbortError' } },
    { event: 'timeout', reason: 'timeout', error: { name: 'TimeoutError' } },
  ])(
    'reports XHR $event through the availability classifier once',
    async ({ event, reason, error }) => {
      if (event === 'timeout') jest.useFakeTimers();
      mockedUploadViaIpTable.mockResolvedValue({
        route: 'skipped',
        reason: 'sni_unsupported',
      });
      mockedCreateUploadTask.mockReturnValueOnce({
        uploadAsync: jest.fn().mockRejectedValue(new Error('Task unavailable')),
        cancelAsync: jest.fn(),
      });
      const request = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        upload: { onprogress: null },
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        send: jest.fn<void, []>(),
        abort: jest.fn<void, []>(),
      };
      request.send.mockImplementation(() => {
        if (event === 'error') request.onerror?.();
        if (event === 'abort') request.onabort?.();
      });
      request.abort.mockImplementation(() => {
        request.onabort?.();
      });
      const previousRequest = globalThis.XMLHttpRequest;
      globalThis.XMLHttpRequest = jest.fn(
        () => request,
      ) as unknown as typeof XMLHttpRequest;
      const append = jest
        .spyOn(FormData.prototype, 'append')
        .mockImplementation(() => undefined);
      try {
        const settled = uploadLogBundle({
          uploadToken: 'token',
          digest: nativeDigest(),
        }).catch((failure: unknown) => failure);
        if (event === 'timeout') {
          await jest.advanceTimersByTimeAsync(LOG_UPLOAD_TIMEOUT_MS);
          expect(request.abort).toHaveBeenCalledTimes(1);
        }
        await expect(settled).resolves.toMatchObject({ reason });
        expect(reportApiAvailabilityError).toHaveBeenCalledTimes(1);
        expect(reportApiAvailabilityError).toHaveBeenCalledWith(
          AVAILABILITY_TIMING,
          expect.objectContaining(error),
        );
        expect(reportApiAvailabilityResponse).not.toHaveBeenCalled();
      } finally {
        append.mockRestore();
        globalThis.XMLHttpRequest = previousRequest;
        if (event === 'timeout') jest.useRealTimers();
      }
    },
  );

  test('does not retry the slow domain route after an SNI timeout or ambiguous post-write failure', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'failed',
      errorCode: 'SNI_REQUEST_TIMEOUT',
      errorMessage: 'Request timeout',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: nativeDigest() }),
    ).rejects.toMatchObject({ reason: 'timeout' });
    expect(mockedCreateUploadTask).not.toHaveBeenCalled();
    expect(mockedLogUpload.uploadFailed).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sni', errorCode: 'timeout' }),
    );

    jest.clearAllMocks();
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'failed',
      errorCode: 'SNI_RESPONSE_FAILED',
      errorMessage: 'Socket closed after write to 93.184.216.34',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: nativeDigest() }),
    ).rejects.toMatchObject({ reason: 'network', retryable: false });
    expect(mockedCreateUploadTask).not.toHaveBeenCalled();
    expect(mockedLogUpload.uploadFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sni',
        errorCode: 'network',
        errorMessage: 'Socket closed after write to <ip>',
      }),
    );

    jest.clearAllMocks();
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'failed',
      errorCode: 'SNI_TLS_FAILED',
      errorMessage: 'SSLException during body write',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: nativeDigest() }),
    ).rejects.toMatchObject({ reason: 'network', retryable: false });
    expect(mockedCreateUploadTask).not.toHaveBeenCalled();
  });

  test('cancels a stalled domain upload at the timeout', async () => {
    jest.useFakeTimers();
    try {
      mockedUploadViaIpTable.mockResolvedValue({
        route: 'skipped',
        reason: 'upload_unsupported',
      });
      const cancelAsync = jest.fn(async () => undefined);
      mockedCreateUploadTask.mockReturnValue({
        uploadAsync: jest.fn(() => new Promise<never>(() => undefined)),
        cancelAsync,
      });

      const settled = uploadLogBundle({
        uploadToken: 'token',
        digest: nativeDigest(),
      }).catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(LOG_UPLOAD_TIMEOUT_MS);
      await expect(settled).resolves.toMatchObject({ reason: 'timeout' });
      expect(cancelAsync).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('surfaces server business errors such as rate limiting', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'sni',
      httpStatus: 200,
      body: JSON.stringify({ code: 12_001, message: 'limited' }),
      ipHash: 'hash',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: nativeDigest() }),
    ).rejects.toMatchObject({ code: 12_001 });
  });
});
