import {
  CLOUD_SYNC_UPLOAD_BATCH_INTERVAL_MS,
  waitForCloudSyncUploadBatch,
} from './cloudSyncUploadPacing';

describe('Cloud upload chunk pacing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
  });
  afterEach(() => jest.useRealTimers());

  test('first chunk is immediate and creates no timer', async () => {
    await waitForCloudSyncUploadBatch({ previousBatchStartedAt: undefined });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('counts network time toward the minimum interval', async () => {
    jest.setSystemTime(1080);
    const done = jest.fn();
    const work = waitForCloudSyncUploadBatch({
      previousBatchStartedAt: 1000,
    }).then(done);
    await jest.advanceTimersByTimeAsync(119);
    expect(done).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await work;
    expect(done).toHaveBeenCalledTimes(1);
  });

  test('slow requests need no extra delay', async () => {
    jest.setSystemTime(1300);
    await waitForCloudSyncUploadBatch({ previousBatchStartedAt: 1000 });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('aborts a pending wait promptly and removes its timer', async () => {
    const controller = new AbortController();
    const work = waitForCloudSyncUploadBatch({
      previousBatchStartedAt: 1000,
      signal: controller.signal,
    });
    const rejection = work.catch((error: unknown) => error);
    controller.abort();
    await expect(rejection).resolves.toMatchObject({
      message: expect.stringContaining('cancelled'),
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('an already cancelled first chunk cannot proceed', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      waitForCloudSyncUploadBatch({
        previousBatchStartedAt: undefined,
        signal: controller.signal,
      }),
    ).rejects.toThrow('cancelled');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('backwards clock changes do not extend the maximum wait', async () => {
    const done = jest.fn();
    const work = waitForCloudSyncUploadBatch({
      previousBatchStartedAt: 10_000,
    }).then(done);
    await jest.advanceTimersByTimeAsync(CLOUD_SYNC_UPLOAD_BATCH_INTERVAL_MS);
    await work;
    expect(done).toHaveBeenCalledTimes(1);
  });
});
