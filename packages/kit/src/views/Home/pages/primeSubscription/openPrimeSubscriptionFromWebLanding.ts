export async function openPrimeSubscriptionFromWebLanding({
  openViaDeepLink,
}: {
  openViaDeepLink: () => void;
}): Promise<void> {
  const privateProvider = (
    globalThis as {
      $onekey?: {
        $private?: {
          request?: (args: { method: string }) => Promise<unknown>;
        };
      };
    }
  ).$onekey?.$private;
  if (privateProvider && typeof privateProvider.request === 'function') {
    try {
      await privateProvider.request({
        method: 'wallet_openPrimeSubscription',
      });
      return;
    } catch {
      // Older extensions do not implement wallet_openPrimeSubscription.
    }
  }
  openViaDeepLink();
}
