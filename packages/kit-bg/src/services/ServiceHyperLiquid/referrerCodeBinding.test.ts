import { scheduleReferrerCodeBinding } from './referrerCodeBinding';

function createCache() {
  return {
    referrerCodeSetDone: {} as Record<string, boolean>,
    referrerCodeSetInFlight: {} as Record<string, Promise<void>>,
  };
}

function createParams({
  cache = createCache(),
  getReferralCode = jest.fn().mockResolvedValue('ONEKEY'),
  setReferrerCode = jest.fn().mockResolvedValue(undefined),
  onFailure = jest.fn(),
}: {
  cache?: ReturnType<typeof createCache>;
  getReferralCode?: jest.Mock<Promise<string>>;
  setReferrerCode?: jest.Mock<Promise<unknown>>;
  onFailure?: jest.Mock<void>;
} = {}) {
  return {
    cache,
    cacheKey: 'user-agent-name',
    getReferralCode,
    setReferrerCode,
    onFailure,
  };
}

describe('deferred Hyperliquid referrer binding', () => {
  it('treats the exact SDK already-set response as complete', async () => {
    const error = Object.assign(new Error('Referrer already set'), {
      name: 'ApiRequestError',
      response: { status: 'err', response: 'Referrer already set' },
    });
    const params = createParams({
      setReferrerCode: jest.fn().mockRejectedValue(error),
    });

    await scheduleReferrerCodeBinding(params);

    expect(params.cache.referrerCodeSetDone[params.cacheKey]).toBe(true);
    expect(params.onFailure).not.toHaveBeenCalled();
    expect(scheduleReferrerCodeBinding(params)).toBeUndefined();
    expect(params.setReferrerCode).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight request and marks a successful binding complete', async () => {
    let finishRequest: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    const params = createParams({
      setReferrerCode: jest.fn().mockReturnValue(pending),
    });

    const first = scheduleReferrerCodeBinding(params);
    const second = scheduleReferrerCodeBinding(params);
    expect(second).toBe(first);
    await Promise.resolve();
    await Promise.resolve();
    expect(params.getReferralCode).toHaveBeenCalledTimes(1);
    expect(params.setReferrerCode).toHaveBeenCalledTimes(1);

    finishRequest?.();
    await first;
    expect(params.cache.referrerCodeSetDone[params.cacheKey]).toBe(true);
    expect(
      params.cache.referrerCodeSetInFlight[params.cacheKey],
    ).toBeUndefined();
    expect(params.onFailure).not.toHaveBeenCalled();
  });

  it('logs real failures and allows the next status check to retry', async () => {
    const error = new Error('Network unavailable');
    const params = createParams({
      setReferrerCode: jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined),
    });

    await scheduleReferrerCodeBinding(params);
    expect(params.cache.referrerCodeSetDone[params.cacheKey]).toBeUndefined();
    expect(
      params.cache.referrerCodeSetInFlight[params.cacheKey],
    ).toBeUndefined();
    expect(params.onFailure).toHaveBeenCalledWith(error);

    await scheduleReferrerCodeBinding(params);
    expect(params.setReferrerCode).toHaveBeenCalledTimes(2);
    expect(params.cache.referrerCodeSetDone[params.cacheKey]).toBe(true);
  });

  it('handles a referral-code read failure without marking the binding complete', async () => {
    const error = new Error('Config unavailable');
    const params = createParams({
      getReferralCode: jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('ONEKEY'),
    });

    await scheduleReferrerCodeBinding(params);
    expect(params.onFailure).toHaveBeenCalledWith(error);
    expect(params.setReferrerCode).not.toHaveBeenCalled();
    expect(params.cache.referrerCodeSetDone[params.cacheKey]).toBeUndefined();

    await scheduleReferrerCodeBinding(params);
    expect(params.setReferrerCode).toHaveBeenCalledTimes(1);
    expect(params.cache.referrerCodeSetDone[params.cacheKey]).toBe(true);
  });

  it('does not swallow an unrelated error with the same message', async () => {
    const error = new Error('Referrer already set');
    const params = createParams({
      setReferrerCode: jest.fn().mockRejectedValue(error),
    });

    await scheduleReferrerCodeBinding(params);

    expect(params.onFailure).toHaveBeenCalledWith(error);
    expect(params.cache.referrerCodeSetDone[params.cacheKey]).toBeUndefined();
  });

  it('does not let an old request mark a reset cache complete', async () => {
    let finishRequest: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    const params = createParams({
      setReferrerCode: jest.fn().mockReturnValue(pending),
    });

    const oldRequest = scheduleReferrerCodeBinding(params);
    params.cache.referrerCodeSetDone = {};
    params.cache.referrerCodeSetInFlight = {};
    finishRequest?.();
    await oldRequest;

    expect(params.cache.referrerCodeSetDone[params.cacheKey]).toBeUndefined();
  });
});
