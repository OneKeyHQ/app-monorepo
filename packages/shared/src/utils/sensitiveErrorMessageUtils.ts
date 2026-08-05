const MAX_SANITIZED_ERROR_MESSAGE_LENGTH = 200;

// Keep diagnostic meaning while removing common credential-bearing values
// before free-text errors reach local or server logs.
export function scrubSensitiveErrorMessageText(text: string): string {
  let scrubbed = text;
  scrubbed = scrubbed.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]');
  scrubbed = scrubbed.replace(/\bBearer\s+[\w.~+/-]+=*/gi, 'Bearer [token]');
  scrubbed = scrubbed.replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1');
  scrubbed = scrubbed.replace(
    /((?:["']?(?:token|access_token|refresh_token|id_token)["']?)\s*[:=]\s*)("[^"]*"|'[^']*'|[^&,\s#}\]]+)/gi,
    (_match, prefix: string, value: string) => {
      const quote = value[0];
      return quote === '"' || quote === "'"
        ? `${prefix}${quote}[redacted]${quote}`
        : `${prefix}[redacted]`;
    },
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
