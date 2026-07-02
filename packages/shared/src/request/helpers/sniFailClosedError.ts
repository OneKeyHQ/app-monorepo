const SNI_FAIL_CLOSED_ERROR_CODES = new Set([
  'SNI_INVALID_CONFIG',
  'SNI_SECURITY_POLICY_FAILED',
  'SNI_TLS_FAILED',
  'SNI_CERT_FAILED',
  'SNI_RESPONSE_FAILED',
  'SNI_RESOURCE_LIMIT',
  'SNI_CANCELLED',
]);

const SNI_FAIL_CLOSED_MESSAGE_RE =
  /\bSNI_(INVALID_CONFIG|SECURITY_POLICY_FAILED|TLS_FAILED|CERT_FAILED|RESPONSE_FAILED|RESOURCE_LIMIT|CANCELLED)\b/;

export function isSniFailClosedError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (SNI_FAIL_CLOSED_ERROR_CODES.has(code)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return SNI_FAIL_CLOSED_MESSAGE_RE.test(message);
}
