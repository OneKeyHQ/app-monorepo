import { defaultLogger } from '../../logger/logger';
import platformEnv from '../../platformEnv';
import { stableStringify } from '../stringUtils';

import type { IEventBusPayloadShowToast } from '../../eventBus/appEventBus';

const TOAST_TRACE_PREFIX = '[TOAST-TRACE]';
const MAX_TEXT_LENGTH = 240;
const MAX_STACK_LINES = 8;
const TRACE_TEXT_KEYWORDS = [
  'axiosnetworkerror',
  'econnaborted',
  'etimedout',
  'network error',
  'network request failed',
  'timeout',
];
const TRACE_ERROR_CODES = new Set(['-99999', 'ECONNABORTED', 'ETIMEDOUT']);

function isToastTraceEnabled() {
  return !platformEnv.isJest;
}

function compactText(value: string) {
  const compacted = value.replace(/\s+/g, ' ').trim();
  if (compacted.length <= MAX_TEXT_LENGTH) {
    return compacted;
  }
  return `${compacted.slice(0, MAX_TEXT_LENGTH)}...`;
}

function compactStack(value: string) {
  return value
    .split('\n')
    .slice(0, MAX_STACK_LINES)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' | ');
}

function sanitizeValue(key: string, value: unknown) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === 'string') {
    if (key === 'requestId') {
      return value ? `...${value.slice(-12)}` : value;
    }
    if (key.toLowerCase().includes('stack')) {
      return compactStack(value);
    }
    return compactText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return '[object]';
}

function hasTraceSignalValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return TRACE_ERROR_CODES.has(String(value));
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  return (
    TRACE_ERROR_CODES.has(value) ||
    TRACE_TEXT_KEYWORDS.some((keyword) => normalizedValue.includes(keyword))
  );
}

export function shouldLogToastTracePayload(payload: Record<string, unknown>) {
  return [
    payload.title,
    payload.message,
    payload.errorCode,
    payload.errorName,
    payload.errorClassName,
    payload.errorStack,
  ].some(hasTraceSignalValue);
}

function sanitizePayload(payload: Record<string, unknown>) {
  return Object.entries(payload).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const sanitized = sanitizeValue(key, value);
      if (sanitized !== undefined) {
        acc[key] = sanitized;
      }
      return acc;
    },
    {},
  );
}

export function buildToastTracePayload(
  payload: Partial<IEventBusPayloadShowToast>,
  extra?: Record<string, unknown>,
) {
  return {
    runtimeRole: platformEnv.runtimeRole,
    nativeRuntimeKind: platformEnv.nativeRuntimeKind,
    method: payload.method,
    title: payload.title,
    message: payload.message,
    errorCode: payload.errorCode,
    errorName: payload.errorName,
    errorClassName: payload.errorClassName,
    httpStatusCode: payload.httpStatusCode,
    toastId: payload.toastId,
    requestId: payload.requestId,
    ...extra,
  };
}

export function getToastTraceStack() {
  if (!isToastTraceEnabled()) {
    return undefined;
  }
  return new Error().stack;
}

export function logToastTrace(label: string, payload: Record<string, unknown>) {
  if (!isToastTraceEnabled() || !shouldLogToastTracePayload(payload)) {
    return;
  }

  const sanitizedPayload = sanitizePayload(payload);
  const info = `${TOAST_TRACE_PREFIX} ${label} ${stableStringify(
    sanitizedPayload,
    undefined,
    undefined,
    {
      depthLimit: 2,
      edgesLimit: 30,
    },
  )}`;

  defaultLogger.app.toastTrace.info({ info });

  if (platformEnv.isDev) {
    console.log(info);
  }
}
