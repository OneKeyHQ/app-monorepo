const SNI_ERROR_CODE_RE = /\b(SNI_[A-Z_]+)\b/;

export function getSniRequestErrorCode(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  if (code) return code;

  const message = error instanceof Error ? error.message : String(error);
  return SNI_ERROR_CODE_RE.exec(message)?.[1] ?? '';
}
