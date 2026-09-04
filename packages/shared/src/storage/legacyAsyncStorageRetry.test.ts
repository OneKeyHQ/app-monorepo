/* eslint-disable onekey/no-raw-error */

import timerUtils from '../utils/timerUtils';

import { retryLegacyAsyncStorageOperation } from './legacyAsyncStorageRetry';

jest.mock('../utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: jest.fn(async (_delayMs: number) => undefined) },
}));

const mockWait = timerUtils.wait as jest.MockedFunction<typeof timerUtils.wait>;

describe('retryLegacyAsyncStorageOperation', () => {
  beforeEach(() => {
    mockWait.mockClear();
  });

  it('returns immediately when the initial operation succeeds', async () => {
    const operation = jest.fn(async () => 'ok');

    await expect(
      retryLegacyAsyncStorageOperation({ operation }),
    ).resolves.toEqual({ attemptCount: 1, ok: true, value: 'ok' });
    expect(mockWait).not.toHaveBeenCalled();
  });

  it('uses 50ms, 500ms, and 1000ms backoff before succeeding', async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('attempt 1'))
      .mockRejectedValueOnce(new Error('attempt 2'))
      .mockRejectedValueOnce(new Error('attempt 3'))
      .mockResolvedValueOnce('ok');

    await expect(
      retryLegacyAsyncStorageOperation({ operation }),
    ).resolves.toEqual({ attemptCount: 4, ok: true, value: 'ok' });
    expect(mockWait.mock.calls).toEqual([[50], [500], [1000]]);
  });

  it('returns a failure after all three retries are exhausted', async () => {
    const error = new Error('persistent failure');
    const operation = jest.fn(async () => Promise.reject(error));

    await expect(
      retryLegacyAsyncStorageOperation({ operation }),
    ).resolves.toEqual({ attemptCount: 4, error, ok: false });
    expect(operation).toHaveBeenCalledTimes(4);
    expect(mockWait.mock.calls).toEqual([[50], [500], [1000]]);
  });
});
