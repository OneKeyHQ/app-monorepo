import type { IOnramperError, IOnramperLogRecord } from './type';

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
// The tables below name those indexes. They were recovered from the Swift
// reflection metadata of the 1.2.2 SDK binary and ordered the way NSError
// numbers enum cases — payload cases first, then no-payload cases, each in
// declaration order. Not re-verified against 1.3.x (which also stops
// reducing most errors to this text, see realClient.native.ts); an unknown
// enum or index is left untouched, so a stale table can only miss a name.
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
  // Cap the free-form SDK text first, then annotate: the appended case names
  // come from our own table and are bounded, so they must not be what the cap
  // cuts off. A marker that is itself split by the cap stays unannotated.
  return message
    ? annotateOnramperSdkErrorMessage(
        truncateForLog(message, LOG_MESSAGE_MAX_LENGTH),
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
    supportCode: error?.supportCode,
  };
}

// Context keys of an SDK log record (SDK 1.3 log sink) that may be persisted:
// identifiers, codes and timings only. The SDK redacts provider messages on a
// best-effort basis, and the device log is exportable (support bundles), so
// every other key — and the free-form message outside dev builds — is dropped
// before the record is written. Session / token material is deliberately not
// listed.
const SDK_LOG_CONTEXT_ALLOWED_KEYS = new Set([
  'transactionId',
  'checkoutId',
  'headlessCheckoutId',
  'intentId',
  'onrampTransactionId',
  'supportCode',
  'code',
  'errorCode',
  'status',
  'statusCode',
  'httpStatus',
  'state',
  'event',
  'provider',
  'onramp',
  'ramp',
  'paymentType',
  'paymentMethod',
  'renderType',
  'durationMs',
  'elapsedMs',
  'attempt',
  'retries',
  'path',
  'route',
  'method',
  'host',
  'environment',
  'sdkVersion',
  'platform',
]);
const SDK_LOG_VALUE_MAX_LENGTH = 120;
// An allowed key can still carry a personal value by mistake (an email in an
// id slot, a phone or card number in a code slot): drop anything that looks
// like one rather than persist it.
const SDK_LOG_PERSONAL_VALUE_PATTERN = /@|\d{9,}/;

export type ISanitizedOnramperLogRecord = {
  level: string;
  category: string;
  event: string;
  message?: string;
  context?: Record<string, string>;
};

// Reduces an SDK log record to what may be written to the device log. The
// message is kept only when the caller asks (dev builds); production keeps
// the structured fields, which are enough to rebuild a checkout timeline.
export function sanitizeOnramperLogRecord(
  record: IOnramperLogRecord,
  { keepMessage }: { keepMessage: boolean },
): ISanitizedOnramperLogRecord {
  const context: Record<string, string> = {};
  Object.entries(record.context ?? {}).forEach(([key, raw]) => {
    const value = String(raw ?? '');
    if (
      SDK_LOG_CONTEXT_ALLOWED_KEYS.has(key) &&
      value &&
      !SDK_LOG_PERSONAL_VALUE_PATTERN.test(value)
    ) {
      context[key] = truncateForLog(value, SDK_LOG_VALUE_MAX_LENGTH);
    }
  });
  const sanitized: ISanitizedOnramperLogRecord = {
    level: record.level,
    category: record.category,
    event: record.event,
  };
  if (keepMessage && record.message) {
    sanitized.message = truncateForLog(record.message, LOG_MESSAGE_MAX_LENGTH);
  }
  if (Object.keys(context).length > 0) {
    sanitized.context = context;
  }
  return sanitized;
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
