// A browser that cannot hold the runtime database (outdated WebView, or no
// usable origin). Retrying cannot help; only updating the WebView can.
export const LOCAL_WALLET_STORAGE_UNSUPPORTED_CODE = 'STORAGE_UNSUPPORTED';

// Zcash errors carry `code` (or `payload.code` after a carrier hop); Monero
// errors carry it as JSON in `message`.
export function readLocalWalletErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const record = error as {
    code?: unknown;
    payload?: { code?: unknown } | null;
    message?: unknown;
  };
  if (typeof record.payload?.code === 'string') return record.payload.code;
  if (typeof record.code === 'string') return record.code;
  if (typeof record.message !== 'string') return undefined;
  try {
    const parsed = JSON.parse(record.message) as { code?: unknown } | null;
    return typeof parsed?.code === 'string' ? parsed.code : undefined;
  } catch {
    return undefined;
  }
}

export function isLocalWalletStorageUnsupportedError(error: unknown): boolean {
  return (
    readLocalWalletErrorCode(error) === LOCAL_WALLET_STORAGE_UNSUPPORTED_CODE
  );
}
