import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type { ILogDigest } from '@onekeyhq/shared/src/logger/types';

import { LogUploadError } from './logUploadUtils';
import {
  isLogUploadRateLimitError,
  uploadLogsWithRetry,
} from './uploadLogsWithRetry';

const mockTokenApi = {
  requestUploadToken: jest.fn(async () => ({ uploadToken: 'token' })),
};

type IProgressEvent = {
  stage: ELogUploadStage;
  requestId?: string;
  bytesSent?: number;
  totalBytes?: number;
  progressPercent?: number;
};

const mockProgressHandlers = new Set<(event: IProgressEvent) => void>();
const mockUploads: {
  requestId?: string;
  resolve: (objectKey: string) => void;
  reject: (error: unknown) => void;
}[] = [];

jest.mock('.', () => ({
  uploadLogBundle: ({ requestId }: { requestId?: string }) =>
    new Promise((resolve, reject) => {
      mockUploads.push({
        requestId,
        resolve: (objectKey) => resolve({ result: { objectKey } }),
        reject,
      });
    }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceLogger: {
      requestUploadToken: (...args: unknown[]) =>
        mockTokenApi.requestUploadToken(...args),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: {
    on: (_name: string, handler: (event: IProgressEvent) => void) =>
      mockProgressHandlers.add(handler),
    off: (_name: string, handler: (event: IProgressEvent) => void) =>
      mockProgressHandlers.delete(handler),
  },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { setting: { logUpload: { attemptFailed: jest.fn() } } },
}));

const digest = { sizeBytes: 1000, sha256: 'digest' } as ILogDigest;

const emitProgress = (event: Omit<IProgressEvent, 'stage'>) =>
  mockProgressHandlers.forEach((handler) =>
    handler({ stage: ELogUploadStage.Uploading, ...event }),
  );

// Polls because p-retry waits about a second before the next attempt.
async function uploadsStarted(count: number) {
  for (let i = 0; i < 300 && mockUploads.length < count; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(mockUploads).toHaveLength(count);
}

describe('uploadLogsWithRetry progress', () => {
  beforeEach(() => {
    mockUploads.length = 0;
    mockProgressHandlers.clear();
    mockTokenApi.requestUploadToken.mockReset();
    mockTokenApi.requestUploadToken.mockResolvedValue({ uploadToken: 'token' });
  });

  it('reports only its own attempt, from the bytes sent', async () => {
    const onProgress = jest.fn();
    const done = uploadLogsWithRetry({
      state: {},
      collectDigest: async () => digest,
      onProgress,
    });
    await uploadsStarted(1);
    const { requestId } = mockUploads[0];
    expect(requestId).toEqual(expect.any(String));

    emitProgress({ requestId: 'another', bytesSent: 900, totalBytes: 1000 });
    emitProgress({ requestId });
    emitProgress({ requestId, bytesSent: 0, totalBytes: 1000 });
    emitProgress({ requestId, bytesSent: 400, totalBytes: 1000 });
    // A late, smaller report never moves the progress back.
    emitProgress({ requestId, bytesSent: 300, totalBytes: 1000 });
    // Transports stop their percent at 99; every byte out reads as 100.
    emitProgress({
      requestId,
      bytesSent: 1000,
      totalBytes: 1000,
      progressPercent: 99,
    });
    mockUploads[0].resolve('client-logs/a.zip');

    await expect(done).resolves.toBe('client-logs/a.zip');
    expect(onProgress.mock.calls).toEqual([[40], [100]]);
    expect(mockProgressHandlers.size).toBe(0);
  });

  it('starts the progress over on a retry', async () => {
    const onProgress = jest.fn();
    const done = uploadLogsWithRetry({
      state: {},
      collectDigest: async () => digest,
      onProgress,
    });
    await uploadsStarted(1);
    const first = mockUploads[0];
    emitProgress({
      requestId: first.requestId,
      bytesSent: 600,
      totalBytes: 1000,
    });
    first.reject(new LogUploadError({ reason: 'network', message: 'reset' }));

    await uploadsStarted(2);
    const second = mockUploads[1];
    expect(second.requestId).not.toBe(first.requestId);
    emitProgress({
      requestId: first.requestId,
      bytesSent: 900,
      totalBytes: 1000,
    });
    emitProgress({
      requestId: second.requestId,
      bytesSent: 200,
      totalBytes: 1000,
    });
    second.resolve('client-logs/b.zip');

    await expect(done).resolves.toBe('client-logs/b.zip');
    expect(onProgress.mock.calls).toEqual([[60], [undefined], [20]]);
  });

  it('does not request a token when cancelled while the archive is still being collected', async () => {
    let finishCollect = () => undefined as void;
    const collecting = new Promise<void>((resolve) => {
      finishCollect = resolve;
    });
    let cancelled = false;
    const done = uploadLogsWithRetry({
      state: {},
      collectDigest: async () => {
        await collecting;
        return digest;
      },
      isCancelled: () => cancelled,
    });
    cancelled = true;
    finishCollect();

    await expect(done).rejects.toThrow('Log upload cancelled');
    expect(mockTokenApi.requestUploadToken).not.toHaveBeenCalled();
    expect(mockUploads).toHaveLength(0);
  });

  it('keeps a plain 12001 payload recognizable as a rate limit', async () => {
    mockTokenApi.requestUploadToken.mockRejectedValueOnce({
      className: EOneKeyErrorClassNames.OneKeyServerApiError,
      code: 12_001,
      message: 'Rate limit exceeded',
    });
    let caught: unknown;
    try {
      await uploadLogsWithRetry({
        state: {},
        collectDigest: async () => digest,
      });
    } catch (error) {
      caught = error;
    }

    expect(isLogUploadRateLimitError(caught)).toBe(true);
    expect(mockUploads).toHaveLength(0);
  });
});
