export function getPerpDepositErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string' || typeof code === 'number') {
      const normalizedCode = String(code).trim();
      if (normalizedCode) {
        return normalizedCode.slice(0, 64);
      }
    }
  }
  if (error instanceof Error && error.name) {
    return error.name.slice(0, 64);
  }
  return 'unknown';
}
