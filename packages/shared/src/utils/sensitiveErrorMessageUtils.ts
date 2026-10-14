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

// The free-text reason sent with onekeyIdLoginFailedReason. On top of the
// shared scrubber (credentials, URL query/hash, emails; capped at
// MAX_SANITIZED_ERROR_MESSAGE_LENGTH), drop the OS user name that keychain
// and file-store errors embed in home-directory paths.
export function getOneKeyIdAuthFailureServerReason(reason: string): string {
  return scrubSensitiveErrorMessageText(
    reason
      .replace(/(\/(?:Users|home)\/)[^/\s'"]+/g, '$1[user]')
      .replace(/([a-z]:\\+Users\\+)[^\\\s'"]+/gi, '$1[user]'),
  );
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
