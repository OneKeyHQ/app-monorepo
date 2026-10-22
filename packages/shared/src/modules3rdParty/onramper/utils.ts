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

// Context keys of an SDK log record (SDK 1.3 log sink) that may be persisted,
// each with the strict shape its value must have: identifiers, single tokens,
// small numbers, route templates and hosts. Anything else — unknown keys, free
// text, formatted card or phone numbers — is dropped, because the SDK's
// redaction of provider strings is best-effort and the device log is
// exportable. Session / token material is deliberately not listed.
const SDK_LOG_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;
const SDK_LOG_TOKEN_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/;
const SDK_LOG_NUMBER_PATTERN = /^-?\d{1,7}$/;
const SDK_LOG_ROUTE_PATTERN = /^\/[A-Za-z0-9_/.{}:-]{0,119}$/;
const SDK_LOG_HOST_PATTERN = /^[A-Za-z0-9.-]{1,120}$/;
// An unformatted card or phone number fits the identifier shape; nine or more
// consecutive digits never occur in the ids above.
const SDK_LOG_DIGIT_RUN_PATTERN = /\d{9,}/;
const SDK_LOG_CONTEXT_FORMATS: Record<string, RegExp> = {
  transactionId: SDK_LOG_ID_PATTERN,
  checkoutId: SDK_LOG_ID_PATTERN,
  headlessCheckoutId: SDK_LOG_ID_PATTERN,
  intentId: SDK_LOG_ID_PATTERN,
  onrampTransactionId: SDK_LOG_ID_PATTERN,
  supportCode: SDK_LOG_ID_PATTERN,
  code: SDK_LOG_ID_PATTERN,
  errorCode: SDK_LOG_ID_PATTERN,
  status: SDK_LOG_TOKEN_PATTERN,
  state: SDK_LOG_TOKEN_PATTERN,
  event: SDK_LOG_TOKEN_PATTERN,
  provider: SDK_LOG_TOKEN_PATTERN,
  onramp: SDK_LOG_TOKEN_PATTERN,
  ramp: SDK_LOG_TOKEN_PATTERN,
  paymentType: SDK_LOG_TOKEN_PATTERN,
  paymentMethod: SDK_LOG_TOKEN_PATTERN,
  renderType: SDK_LOG_TOKEN_PATTERN,
  method: SDK_LOG_TOKEN_PATTERN,
  environment: SDK_LOG_TOKEN_PATTERN,
  platform: SDK_LOG_TOKEN_PATTERN,
  sdkVersion: SDK_LOG_TOKEN_PATTERN,
  statusCode: SDK_LOG_NUMBER_PATTERN,
  httpStatus: SDK_LOG_NUMBER_PATTERN,
  durationMs: SDK_LOG_NUMBER_PATTERN,
  elapsedMs: SDK_LOG_NUMBER_PATTERN,
  attempt: SDK_LOG_NUMBER_PATTERN,
  retries: SDK_LOG_NUMBER_PATTERN,
  path: SDK_LOG_ROUTE_PATTERN,
  route: SDK_LOG_ROUTE_PATTERN,
  host: SDK_LOG_HOST_PATTERN,
};

function isAllowedSdkLogValue(key: string, value: string): boolean {
  const format = SDK_LOG_CONTEXT_FORMATS[key];
  return (
    Boolean(format) &&
    format.test(value) &&
    !SDK_LOG_DIGIT_RUN_PATTERN.test(value)
  );
}

export type ISanitizedOnramperLogRecord = {
  level: string;
  category: string;
  event: string;
  message?: string;
  context?: Record<string, string>;
};

// Reduces an SDK log record to what may be written to the device log: the
// level / category / event enums, the format-checked context above, and the
// free-form message only when the caller asks (dev builds).
export function sanitizeOnramperLogRecord(
  record: IOnramperLogRecord,
  { keepMessage }: { keepMessage: boolean },
): ISanitizedOnramperLogRecord {
  const context: Record<string, string> = {};
  Object.entries(record.context ?? {}).forEach(([key, raw]) => {
    const value = String(raw ?? '');
    if (isAllowedSdkLogValue(key, value)) {
      context[key] = value;
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
