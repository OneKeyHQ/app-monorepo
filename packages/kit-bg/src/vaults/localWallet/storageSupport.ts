// Both runtimes report a browser that cannot hold their database (an outdated
// WebView, or a page with no usable origin) with this code. Retrying cannot
// help; only updating the WebView can.
export const LOCAL_WALLET_STORAGE_UNSUPPORTED_CODE = 'STORAGE_UNSUPPORTED';

// Zcash errors carry `code` (or `payload.code` after a carrier hop); Monero
// errors carry it as JSON in `message`.
export function isLocalWalletStorageUnsupportedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const record = error as {
    code?: unknown;
    payload?: { code?: unknown } | null;
    message?: unknown;
  };
  if (
    record.code === LOCAL_WALLET_STORAGE_UNSUPPORTED_CODE ||
    record.payload?.code === LOCAL_WALLET_STORAGE_UNSUPPORTED_CODE
  ) {
    return true;
  }
  if (typeof record.message !== 'string') return false;
  try {
    const parsed = JSON.parse(record.message) as { code?: unknown } | null;
    return parsed?.code === LOCAL_WALLET_STORAGE_UNSUPPORTED_CODE;
  } catch {
    return false;
  }
}
