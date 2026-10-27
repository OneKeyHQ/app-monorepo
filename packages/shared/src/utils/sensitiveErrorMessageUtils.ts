import {
  getDesktopIpcCallContext,
  isUnwrappedIpcError,
} from '../errors/utils/electronIpcError';

const MAX_SANITIZED_ERROR_MESSAGE_LENGTH = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type IOneKeyIdAuthFailureLogSource =
  | 'sessionPersist'
  | 'fallbackToast'
  | 'throwSite';

// Which hop of a OneKey ID login failed: the identity provider (Google /
// Apple) or the Supabase auth service. Omitted when the hop is not known.
export type IOneKeyIdAuthFailureStep = 'provider' | 'auth';

// What started the failing work: a user action (login, OAuth, OTP, bind) or
// a passive check (provider mount, session read, background prompt check).
// Passive failures are not login attempts and must not count as such.
export type IOneKeyIdAuthFailureTrigger = 'interactive' | 'passive';

export type IOneKeyIdAuthFailureCategory =
  | 'alreadyLoggedIn'
  | 'inconsistentAuthState'
  | 'authStateChanged'
  | 'sessionPersistence'
  | 'invalidToken'
  | 'oauth'
  | 'otp'
  | 'unknown';

// Keep diagnostic meaning while removing common credential-bearing values
// before free-text errors reach local or server logs.
export function scrubSensitiveErrorMessageText(text: string): string {
  let scrubbed = text;
  scrubbed = scrubbed.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]');
  scrubbed = scrubbed.replace(/\bBearer\s+[\w.~+/-]+=*/gi, 'Bearer [token]');
  scrubbed = scrubbed.replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1');
  scrubbed = scrubbed.replace(
    /((?:["']?(?:token|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?id|authorization|cookie|set-cookie|api[_-]?key|secret|password)["']?)\s*[:=]\s*)("[^"]*"|'[^']*'|[^&,\s#}\]]+)/gi,
    (_match, prefix: string, value: string) => {
      const quote = value[0];
      return quote === '"' || quote === "'"
        ? `${prefix}${quote}[redacted]${quote}`
        : `${prefix}[redacted]`;
    },
  );
  scrubbed = scrubbed.replace(
    /\b(?=[a-z0-9_~+-]{24,}\b)(?=[a-z0-9_~+-]*[a-z])(?=[a-z0-9_~+-]*\d)[a-z0-9_~+-]+\b/gi,
    (value) => (UUID_PATTERN.test(value) ? value : '[credential]'),
  );
  scrubbed = scrubbed.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
  if (scrubbed.length > MAX_SANITIZED_ERROR_MESSAGE_LENGTH) {
    scrubbed = `${scrubbed.slice(0, MAX_SANITIZED_ERROR_MESSAGE_LENGTH)}...`;
  }
  return scrubbed;
}

const MAX_AUTH_FAILURE_SITE_LENGTH = 120;

// Call sites write a reason as `<where it failed>: <error details>`, or put
// the sanitized `name=... message=...` details right after the location;
// the location must be code-authored text. Only that location is sent to
// the server: error details can echo user input (OTP codes, PINs, recovery
// words) that no scrubber reliably recognizes, so they stay in local logs.
// A reason without that delimiter yields no location (fails closed). Digit
// runs are masked in case a location interpolates a value.
export function getOneKeyIdAuthFailureSite(reason: string): string | undefined {
  const detailsStart = reason.search(/:\s|(?:^|\s)name=/);
  if (detailsStart < 0) {
    return undefined;
  }
  const site = scrubSensitiveErrorMessageText(
    reason.slice(0, detailsStart).replace(/\d{4,}/g, '#'),
  ).trim();
  if (!site) {
    return undefined;
  }
  return site.length > MAX_AUTH_FAILURE_SITE_LENGTH
    ? `${site.slice(0, MAX_AUTH_FAILURE_SITE_LENGTH)}...`
    : site;
}

export function getSanitizedErrorLogText(error: unknown): string {
  const safeError = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    httpStatusCode?: unknown;
    requestId?: unknown;
    cause?: {
      message?: unknown;
    };
  };
  return `name=${scrubSensitiveErrorMessageText(
    String(safeError?.name || ''),
  )} message=${scrubSensitiveErrorMessageText(
    String(safeError?.message || error || 'unknown'),
  )} code=${scrubSensitiveErrorMessageText(
    String(safeError?.code || ''),
  )} status=${scrubSensitiveErrorMessageText(
    String(safeError?.status || safeError?.httpStatusCode || ''),
  )} requestId=${scrubSensitiveErrorMessageText(
    String(safeError?.requestId || ''),
  )} cause=${scrubSensitiveErrorMessageText(
    String(safeError?.cause?.message || ''),
  )}`;
}

function getOneKeyIdAuthFailureCategory(
  reason: string,
): IOneKeyIdAuthFailureCategory {
  const normalizedReason = reason.toLowerCase();
  if (normalizedReason.includes('already logged in')) {
    return 'alreadyLoggedIn';
  }
  if (
    normalizedReason.includes('projection is inconsistent') ||
    normalizedReason.includes('auth state is inconsistent')
  ) {
    return 'inconsistentAuthState';
  }
  if (normalizedReason.includes('state changed')) {
    return 'authStateChanged';
  }
  if (normalizedReason.includes('persist')) {
    return 'sessionPersistence';
  }
  if (normalizedReason.includes('invalid token')) {
    return 'invalidToken';
  }
  if (normalizedReason.includes('oauth')) {
    return 'oauth';
  }
  if (normalizedReason.includes('otp')) {
    return 'otp';
  }
  return 'unknown';
}

function getLastSafeLabeledValue({
  reason,
  label,
}: {
  reason: string;
  label: 'name' | 'code' | 'status' | 'requestId';
}): string | undefined {
  const matches = Array.from(
    reason.matchAll(new RegExp(`(?:^|\\s)${label}=([^\\s]+)`, 'gi')),
  );
  const value = matches[matches.length - 1]?.[1];
  if (!value || !/^[a-z0-9_.-]{1,128}$/i.test(value)) {
    return undefined;
  }
  return value;
}

export type IOneKeyIdAuthFailureServerParams = {
  source: IOneKeyIdAuthFailureLogSource;
  step?: IOneKeyIdAuthFailureStep;
  category: IOneKeyIdAuthFailureCategory;
  errorName?: string;
  errorCode?: string;
  httpStatusCode?: number;
  requestId?: string;
  // Desktop API call that rejected, read from the error object (never from
  // the reason text). Absent for non-IPC failures.
  ipcModule?: string;
  ipcMethod?: string;
  // The failure crossed Desktop API IPC but its call context was lost.
  ipcContextMissing?: true;
};

// Structured fields shared by the OneKey ID auth failure server events; each
// event decides separately whether it also sends the scrubbed reason.
// `error`, when given, is only read for its Desktop API IPC call context.
export function getOneKeyIdAuthFailureServerParams({
  reason,
  source,
  step,
  error,
}: {
  reason: string;
  source: IOneKeyIdAuthFailureLogSource;
  step?: IOneKeyIdAuthFailureStep;
  error?: unknown;
}): IOneKeyIdAuthFailureServerParams {
  const status = getLastSafeLabeledValue({
    reason,
    label: 'status',
  });
  const parsedStatus = status && /^\d{3}$/.test(status) ? Number(status) : null;
  const errorName = getLastSafeLabeledValue({
    reason,
    label: 'name',
  });
  const params: IOneKeyIdAuthFailureServerParams = {
    source,
    step,
    category: getOneKeyIdAuthFailureCategory(reason),
    errorName,
    errorCode: getLastSafeLabeledValue({
      reason,
      label: 'code',
    }),
    httpStatusCode: parsedStatus ?? undefined,
    requestId: getLastSafeLabeledValue({
      reason,
      label: 'requestId',
    }),
  };
  const ipcCallContext = getDesktopIpcCallContext(error);
  if (ipcCallContext) {
    params.ipcModule = ipcCallContext.ipcModule;
    params.ipcMethod = ipcCallContext.ipcMethod;
  } else if (isUnwrappedIpcError(error) || errorName === 'UnwrappedIpcError') {
    params.ipcContextMissing = true;
  }
  return params;
}

/** Swap telemetry emits fixed categories only, never matched error text. */
export function getSwapErrorMessage(error: unknown): string {
  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    message = error.message;
  }
  if (message === 'Empty build response') return 'Empty build response';
  if (
    /insufficient|余额不足|checkLatestFromTokenBalance|checkLatestNativeTokenBalance|checkOtherFee|checkQuoteBalances/i.test(
      message,
    )
  ) {
    return 'Insufficient balance';
  }
  if (/reject|cancel/i.test(message)) return 'Transaction rejected';
  if (/timeout|timed out/i.test(message)) return 'Request timed out';
  if (/network|rpc|fetch|connection|service unavailable/i.test(message)) {
    return 'Network error';
  }
  return 'Unknown error';
}
