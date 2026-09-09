export const WALLET_PROFILE_ANALYTICS_INITIAL_DELAY_MS = 30 * 1000;
export const WALLET_PROFILE_ANALYTICS_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function scheduleWalletProfileAnalyticsChecks(
  check: () => Promise<void>,
) {
  setTimeout(() => {
    void check();
    setInterval(() => {
      void check();
    }, WALLET_PROFILE_ANALYTICS_CHECK_INTERVAL_MS);
  }, WALLET_PROFILE_ANALYTICS_INITIAL_DELAY_MS);
}
