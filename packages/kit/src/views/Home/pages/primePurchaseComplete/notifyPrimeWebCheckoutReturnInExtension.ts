const EXTENSION_RETURN_TIMEOUT_MS = 2000;

// Web pages cannot navigate to chrome-extension:// pages, so the hosted
// checkout return is relayed through the extension's private provider.
// Returns false when no extension is installed, it predates the method, it
// has no pending checkout for the signed-in user, or it does not answer in
// time, so the caller can fall back to the app scheme.
export async function notifyPrimeWebCheckoutReturnInExtension(): Promise<boolean> {
  const privateProvider = globalThis.$onekey?.$private;
  if (typeof privateProvider?.request !== 'function') {
    return false;
  }
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      privateProvider.request({ method: 'wallet_primeWebCheckoutReturn' }),
      new Promise<undefined>((resolve) => {
        timerId = setTimeout(resolve, EXTENSION_RETURN_TIMEOUT_MS);
      }),
    ]);
    return (result as { handled?: unknown } | undefined)?.handled === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timerId);
  }
}
