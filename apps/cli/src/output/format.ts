import {
  redactDisplayAddress,
  redactKeyId,
  redactSecret,
  redactSensitiveText,
} from './redact';

export type ICliOutputFormat = 'json' | 'text';

export type IFormatOptions = {
  isTTY?: boolean;
  now?: Date;
};

function normalizeFieldName(key: string): string {
  return key.replace(/[_-]/g, '').toLowerCase();
}

function isSecretField(normalizedKey: string): boolean {
  return (
    normalizedKey === 'accesstoken' ||
    normalizedKey === 'authorization' ||
    normalizedKey === 'keybase64' ||
    normalizedKey === 'ciphertextbase64' ||
    normalizedKey === 'walletid' ||
    normalizedKey === 'mnemonic' ||
    normalizedKey === 'seedphrase' ||
    normalizedKey === 'privatekey' ||
    normalizedKey === 'secret' ||
    normalizedKey === 'password'
  );
}

function sanitizeValue(key: string, value: unknown): unknown {
  const normalizedKey = normalizeFieldName(key);

  if (typeof value === 'string') {
    if (normalizedKey === 'displayaddress') {
      return redactDisplayAddress(value);
    }
    if (normalizedKey === 'keyid') {
      return redactKeyId(value);
    }
    if (isSecretField(normalizedKey)) {
      return redactSecret(value);
    }
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (typeof value === 'object' && value !== null) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return sanitizeRecord(value as Record<string, unknown>);
  }

  return value;
}

function sanitizeRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      sanitizeValue(key, value),
    ]),
  );
}

function sanitizeOutput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOutput(item));
  }
  if (typeof value === 'object' && value !== null) {
    return sanitizeRecord(value as Record<string, unknown>);
  }
  return value;
}

function shouldUseJson(
  format: ICliOutputFormat,
  options?: IFormatOptions,
): boolean {
  return format === 'json' || options?.isTTY === false;
}

function formatTimestamp(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function renderTextValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (value === null || value === undefined) {
    return '';
  }
  return JSON.stringify(value);
}

function formatDataLines(data: unknown): string[] {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return Object.entries(data as Record<string, unknown>).map(
      ([key, value]) => `${key}: ${renderTextValue(value)}`,
    );
  }
  return [`data: ${renderTextValue(data)}`];
}

export function formatOk(
  data: unknown,
  format: ICliOutputFormat,
  options: IFormatOptions = {},
): string {
  const sanitizedData = sanitizeOutput(data);
  if (shouldUseJson(format, options)) {
    return JSON.stringify({ ok: true, data: sanitizedData });
  }

  return [
    'ok: true',
    `timestamp: ${formatTimestamp(options.now ?? new Date())}`,
    ...formatDataLines(sanitizedData),
  ].join('\n');
}

export function formatError(
  code: string,
  message: string,
  format: ICliOutputFormat,
  options: IFormatOptions = {},
): string {
  const sanitizedMessage = redactSensitiveText(message);
  if (shouldUseJson(format, options)) {
    return JSON.stringify({
      ok: false,
      error: {
        code,
        message: sanitizedMessage,
      },
    });
  }

  return [
    'ok: false',
    `timestamp: ${formatTimestamp(options.now ?? new Date())}`,
    `code: ${code}`,
    `message: ${sanitizedMessage}`,
  ].join('\n');
}
