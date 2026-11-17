export function shouldInvalidateAccountScopedData(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return true;
  }
  return (
    (payload as { isAccountDataChanged?: boolean }).isAccountDataChanged !==
    false
  );
}
