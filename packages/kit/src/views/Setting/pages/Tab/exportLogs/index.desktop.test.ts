import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';

import { uploadLogBundle } from './index.desktop';
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
const mockedEventBus = jest.requireMock(
  '@onekeyhq/shared/src/eventBus/appEventBus',
) as {
  appEventBus: {
    emit: jest.Mock<
      void,
      [
        EAppEventBusNames.ClientLogUploadProgress,
        IAppEventBusPayload[EAppEventBusNames.ClientLogUploadProgress],
      ]
    >;
  };
};

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

  test('forwards only the active SNI upload progress event', async () => {
    mockedUploadViaIpTable.mockImplementation(async () => {
      const listener = (globalThis.desktopApi.on as jest.Mock).mock
        .calls[0][1] as (event: unknown) => void;
      listener({
        stage: ELogUploadStage.Uploading,
        requestId: 'other',
        bytesSent: 900,
        totalBytes: 1024,
      });
      listener({
        stage: ELogUploadStage.Uploading,
        requestId: 'attempt-1',
        bytesSent: 512,
        totalBytes: 1024,
      });
      return {
        route: 'sni',
        httpStatus: 200,
        body: JSON.stringify(SUCCESS_PAYLOAD),
      };
    });
    await uploadLogBundle({
      uploadToken: 'token',
      digest: desktopDigest(),
      requestId: 'attempt-1',
    });
    expect(mockedEventBus.appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.ClientLogUploadProgress,
      expect.objectContaining({ requestId: 'attempt-1', bytesSent: 512 }),
    );
    expect(mockedEventBus.appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.ClientLogUploadProgress,
      expect.objectContaining({ requestId: 'other' }),
    );
  });

  test('forwards domain upload progress when SNI is disabled', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'skipped',
      reason: 'sni_unsupported',
    });
    const progress = {
      stage: ELogUploadStage.Uploading,
      requestId: 'domain-attempt',
      bytesSent: 512,
      totalBytes: 1024,
      progressPercent: 50,
    };
    mockedUploadLoggerBundle.mockImplementationOnce(async () => {
      const listener = (globalThis.desktopApi.on as jest.Mock).mock.calls.at(
        -1,
      )?.[1] as (event: unknown) => void;
      listener(progress);
      return SUCCESS_PAYLOAD;
    });

    await expect(
      uploadLogBundle({
        uploadToken: 'token',
        digest: desktopDigest(),
        requestId: 'domain-attempt',
      }),
    ).resolves.toMatchObject({ result: { objectKey: 'logs/key' } });

    expect(mockedEventBus.appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.ClientLogUploadProgress,
      progress,
    );
    expect(mockedUploadLoggerBundle).toHaveBeenCalledWith({
      requestId: 'domain-attempt',
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
      expect.objectContaining({
        path: 'domain',
        skipReason: 'sni_unsupported',
      }),
    );
    expect(mockedLogUpload.uploadSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'domain' }),
    );
  });

  test('serializes domain uploads and tags legacy progress with the active attempt', async () => {
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'skipped',
      reason: 'sni_unsupported',
    });
    const firstReply = Promise.withResolvers<typeof SUCCESS_PAYLOAD>();
    const progress = {
      stage: ELogUploadStage.Uploading,
      progressPercent: 40,
    };
    mockedUploadLoggerBundle
      .mockImplementationOnce(async () => {
        const listener = (globalThis.desktopApi.on as jest.Mock).mock.calls.at(
          -1,
        )?.[1] as (event: unknown) => void;
        listener(progress);
        listener({ ...progress, requestId: 'other', progressPercent: 90 });
        return firstReply.promise;
      })
      .mockImplementationOnce(async () => {
        const listener = (globalThis.desktopApi.on as jest.Mock).mock.calls.at(
          -1,
        )?.[1] as (event: unknown) => void;
        listener({ ...progress, progressPercent: 70 });
        return SUCCESS_PAYLOAD;
      });

    const first = uploadLogBundle({
      uploadToken: 'first-token',
      digest: desktopDigest(),
      requestId: 'first-attempt',
    });
    const second = uploadLogBundle({
      uploadToken: 'second-token',
      digest: desktopDigest(),
      requestId: 'second-attempt',
    });
    const uploads = Promise.allSettled([first, second]);

    try {
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(mockedUploadViaIpTable).toHaveBeenCalledTimes(2);
      expect(mockedUploadLoggerBundle).toHaveBeenCalledTimes(1);
    } finally {
      firstReply.resolve(SUCCESS_PAYLOAD);
    }

    await expect(uploads).resolves.toMatchObject([
      { status: 'fulfilled' },
      { status: 'fulfilled' },
    ]);
    expect(
      mockedEventBus.appEventBus.emit.mock.calls
        .map(([, payload]) => payload)
        .filter(
          (payload) =>
            payload.stage === ELogUploadStage.Uploading &&
            typeof payload.progressPercent === 'number',
        ),
    ).toEqual([
      { ...progress, requestId: 'first-attempt' },
      { ...progress, requestId: 'second-attempt', progressPercent: 70 },
    ]);
  });

  test.each(['SNI_CONNECTION_REFUSED', 'SNI_SECURITY_POLICY_FAILED'])(
    'falls back to the domain upload after pre-write %s',
    async (errorCode) => {
      mockedUploadViaIpTable.mockResolvedValue({
        route: 'failed',
        errorCode,
        errorMessage: 'Request rejected before sending the archive',
      });
      mockedUploadLoggerBundle.mockResolvedValue(SUCCESS_PAYLOAD);

      await expect(
        uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
      ).resolves.toMatchObject({ result: { objectKey: 'logs/key' } });
      expect(mockedLogUpload.uploadStart).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'domain',
          skipReason: `sni_failed:${errorCode}`,
        }),
      );
      expect(mockedLogUpload.uploadSucceeded).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'domain', httpStatus: 200 }),
      );
    },
  );

  test('does not retry the slow domain route after an SNI timeout or ambiguous post-write failure', async () => {
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

    jest.clearAllMocks();
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'failed',
      errorCode: 'SNI_RESPONSE_FAILED',
      errorMessage: 'SNI_RESPONSE_FAILED: Protocol upgrades are not supported',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
    ).rejects.toMatchObject({ reason: 'network', retryable: false });
    expect(mockedUploadLoggerBundle).not.toHaveBeenCalled();
    expect(mockedLogUpload.uploadFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sni',
        errorCode: 'network',
        errorMessage:
          'SNI_RESPONSE_FAILED: Protocol upgrades are not supported',
      }),
    );

    jest.clearAllMocks();
    mockedUploadViaIpTable.mockResolvedValue({
      route: 'failed',
      errorCode: 'SNI_TLS_FAILED',
      errorMessage: 'SSL write error',
    });

    await expect(
      uploadLogBundle({ uploadToken: 'token', digest: desktopDigest() }),
    ).rejects.toMatchObject({ reason: 'network', retryable: false });
    expect(mockedUploadLoggerBundle).not.toHaveBeenCalled();
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

  test('times out a lost IPC reply and ignores ambiguous legacy progress during the next upload', async () => {
    jest.useFakeTimers();
    const lateReply = Promise.withResolvers<typeof SUCCESS_PAYLOAD>();
    try {
      mockedUploadViaIpTable.mockResolvedValue({
        route: 'skipped',
        reason: 'no_selected_ip',
      });
      mockedUploadLoggerBundle.mockReturnValueOnce(lateReply.promise);

      const settled = uploadLogBundle({
        uploadToken: 'token',
        digest: desktopDigest(),
      }).catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(LOG_UPLOAD_TIMEOUT_MS + 5000);
      await expect(settled).resolves.toMatchObject({ reason: 'timeout' });

      const progress = {
        stage: ELogUploadStage.Uploading,
        progressPercent: 45,
      };
      mockedUploadLoggerBundle.mockImplementationOnce(async () => {
        const listener = (globalThis.desktopApi.on as jest.Mock).mock.calls.at(
          -1,
        )?.[1] as (event: unknown) => void;
        listener(progress);
        listener({
          ...progress,
          requestId: 'next-attempt',
          progressPercent: 50,
        });
        return SUCCESS_PAYLOAD;
      });

      await uploadLogBundle({
        uploadToken: 'next-token',
        digest: desktopDigest(),
        requestId: 'next-attempt',
      });
      expect(mockedEventBus.appEventBus.emit).not.toHaveBeenCalledWith(
        EAppEventBusNames.ClientLogUploadProgress,
        expect.objectContaining({ progressPercent: 45 }),
      );
      expect(mockedEventBus.appEventBus.emit).toHaveBeenCalledWith(
        EAppEventBusNames.ClientLogUploadProgress,
        { ...progress, requestId: 'next-attempt', progressPercent: 50 },
      );
    } finally {
      lateReply.resolve(SUCCESS_PAYLOAD);
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
