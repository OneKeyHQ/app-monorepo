const SNI_ERROR_CODE_RE = /\b(SNI_[A-Z_]+)\b/;

export function getSniRequestErrorCode(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  if (SNI_ERROR_CODE_RE.test(code)) {
    return code;
  }

  const message = error instanceof Error ? error.message : String(error);
  const matchedSniCode = SNI_ERROR_CODE_RE.exec(message)?.[1];
  if (matchedSniCode) {
    return matchedSniCode;
  }

  const combined = `${code} ${message}`;
  if (/\bECONNREFUSED\b/i.test(combined)) {
    return 'SNI_CONNECTION_REFUSED';
  }
  if (/\b(?:ENOTFOUND|EAI_AGAIN)\b/i.test(combined)) {
    return 'SNI_DNS_FAILED';
  }
  if (/\b(?:ENETUNREACH|EHOSTUNREACH)\b/i.test(combined)) {
    return 'SNI_NETWORK_UNREACHABLE';
  }

  return code;
}
