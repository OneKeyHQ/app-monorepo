const MAX_SANITIZED_ERROR_MESSAGE_LENGTH = 200;

export type IOneKeyIdAuthFailureLogSource =
  | 'sessionPersist'
  | 'fallbackToast'
  | 'throwSite';

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
    /\b(?=[a-z0-9_~+/-]{24,}\b)(?=[a-z0-9_~+/-]*[a-z])(?=[a-z0-9_~+/-]*\d)[a-z0-9_~+/-]+\b/gi,
    '[credential]',
  );
  scrubbed = scrubbed.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
  if (scrubbed.length > MAX_SANITIZED_ERROR_MESSAGE_LENGTH) {
    scrubbed = `${scrubbed.slice(0, MAX_SANITIZED_ERROR_MESSAGE_LENGTH)}...`;
  }
  return scrubbed;
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

// Server telemetry uses only this strict allowlist. The scrubbed free-form
// reason stays in local logs and never becomes a server event property.
export function getOneKeyIdAuthFailureServerParams({
  reason,
  source,
}: {
  reason: string;
  source: IOneKeyIdAuthFailureLogSource;
}): {
  source: IOneKeyIdAuthFailureLogSource;
  category: IOneKeyIdAuthFailureCategory;
  errorName?: string;
  errorCode?: string;
  httpStatusCode?: number;
  requestId?: string;
} {
  const status = getLastSafeLabeledValue({
    reason,
    label: 'status',
  });
  const parsedStatus = status && /^\d{3}$/.test(status) ? Number(status) : null;
  return {
    source,
    category: getOneKeyIdAuthFailureCategory(reason),
    errorName: getLastSafeLabeledValue({
      reason,
      label: 'name',
    }),
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
}
