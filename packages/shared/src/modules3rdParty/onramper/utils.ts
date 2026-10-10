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

// Caps for free-form strings that ride on analytics events. Backend messages
// are short; the SDK's `info` payload is unbounded and only needed as a hint.
const LOG_MESSAGE_MAX_LENGTH = 300;
const LOG_INFO_MAX_LENGTH = 500;

function truncateForLog(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// Some OnramperSDK-internal Swift error enums do not implement LocalizedError,
// so when the SDK wraps them (e.g. `initializationFailed("SDK initialization
// failed: \(error.localizedDescription)")`) all that survives is Foundation's
// generic NSError text with the case index:
//   "The operation couldn’t be completed. (OnramperSDK.BFFRecoveryError error 1.)"
// The tables below name those indexes. They are pinned to the SDK version in
// apps/mobile/package.json (1.2.2) and ordered the way NSError numbers enum
// cases — payload cases first, then no-payload cases, each in declaration
// order — as recovered from the Swift reflection metadata in the SDK binary.
// Re-verify on every SDK bump; an unknown enum or index is left untouched.
const SDK_INTERNAL_ERROR_CASES: Record<string, readonly string[]> = {
  // SecureBFFClient recovery outcomes. `sdkSessionRejected` is the one seen
  // when the partner session the backend minted does not match the apiKey the
  // SDK was configured with (2026-10 key rotation).
  BFFRecoveryError: [
    'configurationError',
    'sdkSessionRejected',
    'userTokenRejected',
    'attestationRejected',
    'dpopProofRejected',
    'dpopNonceRequired',
    'deviceBlocked',
  ],
};

const SDK_INTERNAL_ERROR_PATTERN = /\(OnramperSDK\.(\w+) error (\d+)\.\)/g;

// Rewrites "(OnramperSDK.X error N.)" to "(OnramperSDK.X error N = caseName.)"
// for the enums listed above so device logs name the failure directly.
export function annotateOnramperSdkErrorMessage(message: string): string {
  return message.replace(
    SDK_INTERNAL_ERROR_PATTERN,
    (match, enumName: string, index: string) => {
      const caseName = SDK_INTERNAL_ERROR_CASES[enumName]?.[Number(index)];
      return caseName
        ? `(OnramperSDK.${enumName} error ${index} = ${caseName}.)`
        : match;
    },
  );
}

export function getErrorMessageForLog(error: unknown): string | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }
  const message =
    typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error);
  return message
    ? truncateForLog(
        annotateOnramperSdkErrorMessage(message),
        LOG_MESSAGE_MAX_LENGTH,
      )
    : undefined;
}

export function getErrorInfoForLog(
  info: Record<string, unknown> | undefined,
): string | undefined {
  if (!info || Object.keys(info).length === 0) {
    return undefined;
  }
  try {
    return truncateForLog(JSON.stringify(info), LOG_INFO_MAX_LENGTH);
  } catch {
    return undefined;
  }
}

// Flattens a thrown SDK rejection / `failed` event into the error fields the
// logger scene accepts.
export function getOnramperErrorFieldsForLog(
  error: IOnramperError | undefined,
) {
  return {
    errorCode: error?.code,
    errorMessage: getErrorMessageForLog(error),
    errorInfo: getErrorInfoForLog(error?.info),
  };
}

// Provider checkout URLs can carry session-bound query parameters; only the
// host is ever logged.
export function getUrlHostForLog(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url);
  return match?.[1] ?? undefined;
}
