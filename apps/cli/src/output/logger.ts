import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  redactDisplayAddress,
  redactKeyId,
  redactSecret,
  redactSensitiveText,
} from './redact';

type ILogLevel = 'info' | 'warn' | 'error' | 'debug';
type ILogFields = Record<string, unknown>;

const EVENT_NAME_REGEX = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

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
    normalizedKey === 'token' ||
    normalizedKey === 'password'
  );
}

function isDebugEnabled(): boolean {
  const debug = process.env.DEBUG;
  if (!debug) {
    return false;
  }
  return debug.split(/[,\s]+/).some((entry) => entry === 'onekey:vault');
}

function sanitizeValue(
  key: string,
  value: unknown,
  seen: WeakSet<object>,
): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

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
    return value.map((item) => sanitizeValue(key, item, seen));
  }

  if (typeof value === 'object' && value !== null) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([childKey, childValue]) => [
          childKey,
          sanitizeValue(childKey, childValue, seen),
        ],
      ),
    );
  }

  return value;
}

function sanitizeFields(fields: ILogFields = {}): ILogFields {
  const seen = new WeakSet<object>();
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      sanitizeValue(key, value, seen),
    ]),
  );
}

function assertValidEventName(event: string): void {
  if (!EVENT_NAME_REGEX.test(event)) {
    throw new OneKeyLocalError(`Invalid logger event name: ${event}`);
  }
}

function writeLog(level: ILogLevel, event: string, fields?: ILogFields): void {
  if (level === 'debug' && !isDebugEnabled()) {
    return;
  }
  assertValidEventName(event);
  process.stderr.write(
    `${JSON.stringify({
      level,
      event,
      fields: sanitizeFields(fields),
    })}\n`,
  );
}

export const logger = {
  info(event: string, fields?: ILogFields): void {
    writeLog('info', event, fields);
  },
  warn(event: string, fields?: ILogFields): void {
    writeLog('warn', event, fields);
  },
  error(event: string, fields?: ILogFields): void {
    writeLog('error', event, fields);
  },
  debug(event: string, fields?: ILogFields): void {
    writeLog('debug', event, fields);
  },
};

export type { ILogFields, ILogLevel };
