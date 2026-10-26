import { createUploadTask } from 'expo-file-system/legacy';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';

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
const mockedCreateUploadTask = createUploadTask as jest.Mock;
const mockedLogUpload = defaultLogger.setting.logUpload as unknown as {
  uploadStart: jest.Mock;
  uploadSucceeded: jest.Mock;
  uploadFailed: jest.Mock;
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

  test('falls back to the domain upload task when SNI is skipped', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'skipped',
      reason: 'no_selected_ip',
    });
    mockedCreateUploadTask.mockReturnValue({
      uploadAsync: jest.fn(async () => ({ status: 200, body: SUCCESS_BODY })),
      cancelAsync: jest.fn(),
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: nativeDigest() }),
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
        skipReason: 'no_selected_ip',
      }),
    );
    expect(mockedLogUpload.uploadSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'upload_task' }),
    );
  });

  test('does not retry the slow domain route after an SNI timeout', async () => {
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
