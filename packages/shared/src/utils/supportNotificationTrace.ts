import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';

// OK-66809: temporary diagnostic trace for the "support replied" notification
// click path. A QA build needs the exact delivery shape to tell apart:
//   1. the server never delivered a usable conversationId,
//   2. the client fell back to the hosted support page (no native SDK),
//   3. the client received an id that Intercom refused to open.
//
// Lines go through `defaultLogger.notification.common.supportNotificationTrace`
// (JS layer), so they land in the local log files and are included in
// Settings -> Export Logs. `conversationId` is not sensitive and is logged
// verbatim so the id can be compared with the Intercom conversation.
//
// Privacy contract: never log JWTs, tokens, passwords, mnemonics, seeds,
// signatures, emails, cookies or authorization headers. Those keys are
// redacted defensively even if a payload carries them by mistake.
//
// TODO(OK-66809): remove this file and its call sites after the delivery issue
// is confirmed on the QA build.
export const SUPPORT_NOTIFICATION_TRACE_ENABLED = true;

const MAX_LOGGED_STRING_LENGTH = 512;
const MAX_LOGGED_ARRAY_ITEMS = 20;
const MAX_LOGGED_KEYS = 24;
const MAX_LOGGED_DEPTH = 4;

const SENSITIVE_KEY_PATTERN =
  /token|jwt|secret|password|passphrase|mnemonic|seed|private|authorization|cookie|signature|email/i;

const REDACTED = '[redacted]';

// Accepts the shapes the backend may use for a conversation id: a JSON string
// or a JSON number. Returns undefined for anything else so the caller can tell
// "absent" from "malformed".
export function normalizeSupportConversationId(
  value: unknown,
): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function safeKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).slice(0, MAX_LOGGED_KEYS);
}

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > MAX_LOGGED_STRING_LENGTH
      ? `${value.slice(0, MAX_LOGGED_STRING_LENGTH)}…`
      : value;
  }
  if (depth >= MAX_LOGGED_DEPTH) {
    return Array.isArray(value) ? `[array:${value.length}]` : '[object]';
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_LOGGED_ARRAY_ITEMS)
      .map((item) => sanitizeLogValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_LOGGED_KEYS)
      .forEach(([key, item]) => {
        result[key] = SENSITIVE_KEY_PATTERN.test(key)
          ? REDACTED
          : sanitizeLogValue(item, depth + 1);
      });
    return result;
  }
  return typeof value;
}

export type ISupportPayloadSummary = {
  hasPayload: boolean;
  payloadLength?: number;
  parseOk: boolean;
  topLevelKeys?: string[];
  action?: string;
  hasData: boolean;
  dataKeys?: string[];
  conversationId?: string;
  conversationIdSource?: 'data' | 'payload';
  conversationIdType?: 'string' | 'number' | 'other';
  // Redacted copy of the decoded payload, kept to diagnose shape mismatches.
  payload?: unknown;
};

export function describeSupportPayload(
  payload: string | undefined,
): ISupportPayloadSummary {
  const summary: ISupportPayloadSummary = {
    hasPayload: !!payload,
    parseOk: false,
    hasData: false,
  };
  if (!payload) {
    return summary;
  }
  summary.payloadLength = payload.length;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return summary;
  }
  if (!isRecord(parsed)) {
    return summary;
  }
  summary.parseOk = true;
  summary.topLevelKeys = safeKeys(parsed);
  if (typeof parsed.action === 'string') {
    summary.action = parsed.action;
  }
  const { data } = parsed;
  const candidates: { source: 'data' | 'payload'; value: unknown }[] = [];
  if (isRecord(data)) {
    summary.hasData = true;
    summary.dataKeys = safeKeys(data);
    candidates.push({ source: 'data', value: data.conversationId });
  }
  // Some payloads put the id next to `action` instead of inside `data`.
  candidates.push({ source: 'payload', value: parsed.conversationId });
  const found = candidates.find(({ value }) => value !== undefined);
  if (found) {
    summary.conversationIdSource = found.source;
    if (typeof found.value === 'string') {
      summary.conversationIdType = 'string';
    } else if (typeof found.value === 'number') {
      summary.conversationIdType = 'number';
    } else {
      summary.conversationIdType = 'other';
    }
    summary.conversationId = normalizeSupportConversationId(found.value);
  }
  summary.payload = sanitizeLogValue(parsed);
  return summary;
}

export function summarizeSupportParams(
  params: Record<string, unknown> | undefined,
): unknown {
  if (!isRecord(params)) {
    return undefined;
  }
  return sanitizeLogValue(params);
}

export function traceSupportNotification(
  phase: string,
  detail: Record<string, unknown> = {},
) {
  if (!SUPPORT_NOTIFICATION_TRACE_ENABLED) {
    return;
  }
  try {
    const { platform, runtime } = getSupportNotificationRuntimeInfo();
    defaultLogger.notification.common.supportNotificationTrace(phase, {
      ...(sanitizeLogValue(detail) as Record<string, unknown>),
      platform,
      runtime,
    });
  } catch {
    // Diagnostics must never affect the click path.
  }
}

function getSupportNotificationRuntimeInfo(): {
  platform: string;
  runtime: string;
} {
  let platform = 'unknown';
  if (platformEnv.isExtension) {
    platform = platformEnv.isExtensionBackground ? 'ext-bg' : 'ext-ui';
  } else if (platformEnv.isNativeIOS) {
    platform = 'ios';
  } else if (platformEnv.isNativeAndroid) {
    platform = 'android';
  } else if (platformEnv.isDesktop) {
    platform = 'desktop';
  } else if (platformEnv.isWeb) {
    platform = 'web';
  }

  let runtime = 'single';
  if (platformEnv.isNativeBackgroundThread) {
    runtime = 'bg';
  } else if (platformEnv.isNativeMainThread) {
    runtime = 'main';
  }
  return { platform, runtime };
}
