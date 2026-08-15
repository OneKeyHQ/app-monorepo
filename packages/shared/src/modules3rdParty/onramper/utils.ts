import type { IOnramperError } from './type';

// Structural / non-retryable failures → fall back to the web widget (S5).
// Everything else is treated as retryable (inline retry, S4).
// NOTE: 'unrecoverable' is deliberately NOT in this set. The RN wrapper stamps
// it as the DEFAULT code on any rejection whose structured code was lost at the
// native bridge (OnramperError.from), so user-fixable request errors (e.g. a
// below-minimum amount) can reach us as 'unrecoverable'. Unknown must stay
// retryable; only codes the SDK explicitly names as terminal go to the widget.
const STRUCTURAL_ERROR_CODES = new Set([
  'checkoutForbidden',
  'deviceBlocked',
  'configurationError',
  // App Attest failed on this device — retrying cannot fix it.
  'attestationFailed',
  'platformUnsupported',
]);

export function isStructuralOnramperError(
  error: IOnramperError | undefined,
): boolean {
  return Boolean(error?.code && STRUCTURAL_ERROR_CODES.has(error.code));
}
