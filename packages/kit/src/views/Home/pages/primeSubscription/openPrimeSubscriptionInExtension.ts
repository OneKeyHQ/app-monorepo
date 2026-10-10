// Returns false when no extension is installed or it predates
// wallet_openPrimeSubscription, so the caller can fall back to the app scheme.
export async function openPrimeSubscriptionInExtension(): Promise<boolean> {
  const privateProvider = globalThis.$onekey?.$private;
  if (typeof privateProvider?.request !== 'function') {
    return false;
  }
  try {
    await privateProvider.request({ method: 'wallet_openPrimeSubscription' });
    return true;
  } catch {
    return false;
  }
}
