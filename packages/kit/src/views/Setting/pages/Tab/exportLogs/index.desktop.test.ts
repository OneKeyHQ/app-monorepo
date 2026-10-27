import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';

import { uploadLogBundle } from './index.desktop';
import { LOG_UPLOAD_TIMEOUT_MS } from './logUploadUtils';

jest.mock('@onekeyhq/desktop/app/config', () => ({
  ipcMessageKeys: { CLIENT_LOG_UPLOAD_PROGRESS: 'client-log-upload-progress' },
}));
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
const mockedLogUpload = defaultLogger.setting.logUpload as unknown as {
  uploadStart: jest.Mock;
  uploadSucceeded: jest.Mock;
  uploadFailed: jest.Mock;
};
const mockedUploadLoggerBundle = jest.fn();

const SUCCESS_PAYLOAD = {
  code: 0,
  data: { objectKey: 'logs/key', uploadedBytes: 1024, durationMs: 1 },
};
const ARCHIVE_PATH = '/Users/test/Library/Logs/logs_zip/OneKeyLogs.zip';

function desktopDigest(): ILogDigest {
  return {
    sizeBytes: 1024,
    sha256: 'synthetic-sha',
    bundle: {
      type: 'file',
      fileName: 'OneKeyLogs.zip',
      mimeType: 'application/zip',
      filePath: ARCHIVE_PATH,
    },
  };
}

describe('desktop log upload transport', () => {
  const previousDesktopApiProxy = globalThis.desktopApiProxy;
  const previousDesktopApi = globalThis.desktopApi;

  beforeAll(() => {
    globalThis.desktopApiProxy = {
      dev: { uploadLoggerBundle: mockedUploadLoggerBundle },
    } as unknown as typeof globalThis.desktopApiProxy;
    globalThis.desktopApi = {
      on: jest.fn(() => jest.fn()),
    } as unknown as typeof globalThis.desktopApi;
  });

  afterAll(() => {
    globalThis.desktopApiProxy = previousDesktopApiProxy;
    globalThis.desktopApi = previousDesktopApi;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uploads over the SNI route without touching the domain route', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'sni',
      httpStatus: 200,
      body: JSON.stringify(SUCCESS_PAYLOAD),
      ipHash: 'hash',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
    ).resolves.toMatchObject({ result: { objectKey: 'logs/key' } });

    expect(mockedUploadViaIpTable).toHaveBeenCalledWith({
      uploadToken: 'token',
      filePath: ARCHIVE_PATH,
      mimeType: 'application/zip',
      sizeBytes: 1024,
      timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
    });
    expect(mockedUploadLoggerBundle).not.toHaveBeenCalled();
    expect(mockedLogUpload.uploadSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sni',
        hostname: 'wallet.example.com',
        httpStatus: 200,
        sizeBytes: 1024,
      }),
    );
  });

  test('falls back to the domain upload with a timeout when SNI is skipped', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'skipped',
      reason: 'no_selected_ip',
    });
    mockedUploadLoggerBundle.mockResolvedValue(SUCCESS_PAYLOAD);

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
    ).resolves.toMatchObject({ result: { objectKey: 'logs/key' } });

    expect(mockedUploadLoggerBundle).toHaveBeenCalledWith({
      uploadUrl: 'https://wallet.example.com/wallet/v1/client/log',
      filePath: ARCHIVE_PATH,
      headers: expect.objectContaining({
        authorization: 'Bearer token',
        'content-type': 'application/zip',
      }),
      sizeBytes: 1024,
      timeoutMs: LOG_UPLOAD_TIMEOUT_MS,
    });
    expect(mockedLogUpload.uploadStart).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'domain', skipReason: 'no_selected_ip' }),
    );
    expect(mockedLogUpload.uploadSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'domain' }),
    );
  });

  test('falls back to the domain upload after a non-timeout SNI failure', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'failed',
      errorCode: 'SNI_TLS_FAILED',
      errorMessage: 'handshake failed',
    });
    mockedUploadLoggerBundle.mockResolvedValue(SUCCESS_PAYLOAD);

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
    ).resolves.toMatchObject({ result: { objectKey: 'logs/key' } });
    expect(mockedLogUpload.uploadStart).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'domain',
        skipReason: 'sni_failed:SNI_TLS_FAILED',
      }),
    );
  });

  test('does not retry the slow domain route after an SNI timeout', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'failed',
      errorCode: 'SNI_TIMEOUT',
      errorMessage: 'SNI request timeout',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
    ).rejects.toMatchObject({ reason: 'timeout' });
    expect(mockedUploadLoggerBundle).not.toHaveBeenCalled();
    expect(mockedLogUpload.uploadFailed).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sni', errorCode: 'timeout' }),
    );
  });

  test('maps a main-process domain timeout to a terminal timeout error', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'skipped',
      reason: 'proxy_active',
    });
    mockedUploadLoggerBundle.mockRejectedValue(
      new Error('LOG_UPLOAD_TIMEOUT: Log upload timed out after 90000ms'),
    );

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
    ).rejects.toMatchObject({ reason: 'timeout' });
    expect(mockedLogUpload.uploadFailed).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'domain', errorCode: 'timeout' }),
    );
  });

  test('never hangs past the timeout when the IPC reply is lost', async () => {
    jest.useFakeTimers();
    try {
      mockedUploadViaIpTable.mockResolvedValue({
        route: 'skipped',
        reason: 'no_selected_ip',
      });
      mockedUploadLoggerBundle.mockReturnValue(
        new Promise<never>(() => undefined),
      );

      const settled = uploadLogBundle({
        uploadToken: 'token',
        digest: desktopDigest(),
      }).catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(LOG_UPLOAD_TIMEOUT_MS + 5000);
      await expect(settled).resolves.toMatchObject({ reason: 'timeout' });
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
      uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
    ).rejects.toMatchObject({ code: 12_001 });
    expect(mockedUploadLoggerBundle).not.toHaveBeenCalled();
  });

  test('never logs the upload token', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'skipped',
      reason: 'no_selected_ip',
    });
    mockedUploadLoggerBundle.mockResolvedValue(SUCCESS_PAYLOAD);

    await uploadLogBundle({
      uploadToken: 'secret-token',
      digest: desktopDigest(),
    });
    const logged = JSON.stringify([
      mockedLogUpload.uploadStart.mock.calls,
      mockedLogUpload.uploadSucceeded.mock.calls,
      mockedLogUpload.uploadFailed.mock.calls,
    ]);
    expect(logged).not.toContain('secret-token');
  });
});
