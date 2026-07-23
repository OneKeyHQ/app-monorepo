import {
  WALLET_PROFILE_ANALYTICS_CHECK_INTERVAL_MS,
  WALLET_PROFILE_ANALYTICS_INITIAL_DELAY_MS,
  scheduleWalletProfileAnalyticsChecks,
} from './walletProfileAnalyticsScheduler';

describe('scheduleWalletProfileAnalyticsChecks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('checks after the startup delay and then every 60 minutes', async () => {
    const check = jest.fn(() => Promise.resolve());

    scheduleWalletProfileAnalyticsChecks(check);

    await jest.advanceTimersByTimeAsync(
      WALLET_PROFILE_ANALYTICS_INITIAL_DELAY_MS - 1,
    );
    expect(check).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(
      WALLET_PROFILE_ANALYTICS_CHECK_INTERVAL_MS,
    );
    expect(check).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(
      WALLET_PROFILE_ANALYTICS_CHECK_INTERVAL_MS,
    );
    expect(check).toHaveBeenCalledTimes(3);
  });
});
