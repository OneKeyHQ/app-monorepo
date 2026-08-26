import { createActiveAccountFirmwareUpdateDetector } from './activeAccountFirmwareUpdateDetection';

describe('createActiveAccountFirmwareUpdateDetector', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('retries a busy detection through its throttle window and then stops', async () => {
    const detect = jest
      .fn()
      .mockResolvedValueOnce({ status: 'busy', retryAfterMs: 1000 })
      .mockResolvedValueOnce({ status: 'throttled', retryAfterMs: 5000 })
      .mockResolvedValueOnce({ status: 'finished' });
    const detector = createActiveAccountFirmwareUpdateDetector({ detect });

    detector.start();
    await Promise.resolve();
    expect(detect).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    expect(detect).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(5000);
    expect(detect).toHaveBeenCalledTimes(3);

    await jest.runOnlyPendingTimersAsync();
    expect(detect).toHaveBeenCalledTimes(3);
  });

  it('retries an initially throttled detection once without periodic polling', async () => {
    const detect = jest
      .fn()
      .mockResolvedValue({ status: 'throttled', retryAfterMs: 5000 });
    const detector = createActiveAccountFirmwareUpdateDetector({ detect });

    detector.start();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5000);

    expect(detect).toHaveBeenCalledTimes(2);
  });

  it('cancels a retry when the home route loses focus', async () => {
    const detect = jest
      .fn()
      .mockResolvedValue({ status: 'busy', retryAfterMs: 1000 });
    const detector = createActiveAccountFirmwareUpdateDetector({ detect });

    detector.start();
    await Promise.resolve();
    detector.cancel();
    await jest.advanceTimersByTimeAsync(1000);

    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('does not schedule after an in-flight detection is cancelled', async () => {
    let resolveDetection:
      | ((result: { status: 'busy'; retryAfterMs: number }) => void)
      | undefined;
    const detect = jest.fn(
      () =>
        new Promise<{ status: 'busy'; retryAfterMs: number }>((resolve) => {
          resolveDetection = resolve;
        }),
    );
    const detector = createActiveAccountFirmwareUpdateDetector({ detect });

    detector.start();
    detector.cancel();
    resolveDetection?.({ status: 'busy', retryAfterMs: 1000 });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1000);

    expect(detect).toHaveBeenCalledTimes(1);
  });
});
