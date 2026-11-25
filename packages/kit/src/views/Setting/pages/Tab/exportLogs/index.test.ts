import { uploadLogBundle } from '.';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import {
  BROWSER_LOG_MAX_BYTES,
  ELogUploadStage,
} from '@onekeyhq/shared/src/logger/types';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';

import type { AxiosRequestConfig } from 'axios';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceApp: { getEndpointInfo: jest.fn() } },
}));
jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: { getClient: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));
jest.mock('@onekeyhq/shared/src/appCrypto', () => ({}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/exportSupport', () => ({}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/bufferUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/promiseUtils', () => ({}));
jest.mock('./collectBrowserLogDigest', () => ({}));
jest.mock('./utils', () => ({}));

function bundle(size: number): ILogDigest {
  return {
    sizeBytes: size,
    sha256: 'synthetic-test-digest',
    bundle: {
      type: 'blob',
      blob: new Blob([new Uint8Array(size)], { type: 'application/zip' }),
      fileName: 'test.zip',
      mimeType: 'application/zip',
    },
  };
}

describe('browser log upload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('tags interleaved byte progress with the originating upload attempt', async () => {
    const { appEventBus } = jest.requireMock(
      '@onekeyhq/shared/src/eventBus/appEventBus',
    ) as { appEventBus: { emit: jest.Mock } };
    const observers: NonNullable<AxiosRequestConfig['onUploadProgress']>[] = [];
    let onBothStarted = () => {};
    let finishUploads = () => {};
    const bothStarted = new Promise<void>((resolve) => {
      onBothStarted = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      finishUploads = resolve;
    });
    const post = jest.fn(
      async (_url: string, _data: Blob, config: AxiosRequestConfig) => {
        if (config.onUploadProgress) {
          observers.push(config.onUploadProgress);
        }
        if (observers.length === 2) onBothStarted();
        await pending;
        return { data: { data: { objectKey: 'synthetic-test' } } };
      },
    );
    jest
      .mocked(appApiClient.getClient)
      .mockResolvedValue({ post } as unknown as Awaited<
        ReturnType<typeof appApiClient.getClient>
      >);

    const options = { uploadToken: 'test-token', digest: bundle(1024) };
    const uploads = [
      uploadLogBundle({ ...options, requestId: 'panel' }),
      uploadLogBundle({ ...options, requestId: 'popup' }),
    ];
    await bothStarted;
    observers[0]({ loaded: 256, bytes: 256, lengthComputable: false });
    observers[1]({
      loaded: 1024,
      total: 1024,
      bytes: 1024,
      lengthComputable: true,
    });
    observers[0]({
      loaded: 512,
      total: 1024,
      bytes: 256,
      lengthComputable: true,
    });
    finishUploads();
    await Promise.all(uploads);

    expect(appEventBus.emit).toHaveBeenNthCalledWith(
      3,
      EAppEventBusNames.ClientLogUploadProgress,
      {
        stage: ELogUploadStage.Uploading,
        requestId: 'panel',
        bytesSent: 256,
        totalBytes: 1024,
        progressPercent: 25,
      },
    );
    expect(appEventBus.emit).toHaveBeenNthCalledWith(
      4,
      EAppEventBusNames.ClientLogUploadProgress,
      {
        stage: ELogUploadStage.Uploading,
        requestId: 'popup',
        bytesSent: 1024,
        totalBytes: 1024,
        progressPercent: 99,
      },
    );
    expect(appEventBus.emit).toHaveBeenNthCalledWith(
      5,
      EAppEventBusNames.ClientLogUploadProgress,
      {
        stage: ELogUploadStage.Uploading,
        requestId: 'panel',
        bytesSent: 512,
        totalBytes: 1024,
        progressPercent: 50,
      },
    );
  });

  it.each([BROWSER_LOG_MAX_BYTES, BROWSER_LOG_MAX_BYTES + 1024])(
    'uploads %i bytes unchanged even when packaging exceeds the retention budget',
    async (sizeBytes) => {
      const post = jest.fn().mockResolvedValue({
        data: {
          data: {
            objectKey: 'synthetic-test',
            uploadedBytes: sizeBytes,
            durationMs: 1,
          },
        },
      });
      jest
        .mocked(appApiClient.getClient)
        .mockResolvedValue({ post } as unknown as Awaited<
          ReturnType<typeof appApiClient.getClient>
        >);
      const digest = bundle(sizeBytes);
      await uploadLogBundle({ uploadToken: 'test-token', digest });
      expect(post).toHaveBeenCalledWith(
        '/wallet/v1/client/log',
        digest.bundle.type === 'blob' ? digest.bundle.blob : undefined,
        expect.any(Object),
      );
    },
  );
});
