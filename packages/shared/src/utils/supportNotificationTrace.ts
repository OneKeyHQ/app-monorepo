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
// Privacy contract: this is an explicit allowlist. Only key names, an action
// name, the conversation id, msgId, and booleans/counts are logged. The
// payload itself, `extras.params` values and any other field are never
// serialized, so unrecognized fields (phone, address, email...) cannot leak
// into exported logs even if the server or a third party adds them.
//
// TODO(OK-66809): remove this file and its call sites after the delivery issue
// is confirmed on the QA build.
export const SUPPORT_NOTIFICATION_TRACE_ENABLED = true;

const MAX_LOGGED_STRING_LENGTH = 512;
const MAX_LOGGED_KEY_NAME_LENGTH = 120;
const MAX_LOGGED_KEYS = 24;

export type ISupportTraceValue =
  | string
  | number
  | boolean
  | undefined
  | ReadonlyArray<string>;
export type ISupportTraceDetail = Record<string, ISupportTraceValue>;

// Accepts the shapes the backend may use for a conversation id: a JSON string
// or a JSON number. Only safe integers are accepted: a number beyond
// Number.MAX_SAFE_INTEGER has already lost precision, so opening it would
// target the wrong conversation (or none).
export function normalizeSupportConversationId(
  value: unknown,
): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function safeKeyNames(value: Record<string, unknown>): string[] {
  return Object.keys(value)
    .slice(0, MAX_LOGGED_KEYS)
    .map((key) =>
      key.length > MAX_LOGGED_KEY_NAME_LENGTH
        ? `${key.slice(0, MAX_LOGGED_KEY_NAME_LENGTH)}…`
        : key,
    );
}

function safeScalarText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > MAX_LOGGED_STRING_LENGTH
    ? `${trimmed.slice(0, MAX_LOGGED_STRING_LENGTH)}…`
    : trimmed;
}

export type ISupportPayloadSummary = {
  hasPayload: boolean;
  payloadLength?: number;
  parseOk: boolean;
  action?: string;
  hasData: boolean;
  topLevelKeys?: string[];
  dataKeys?: string[];
  conversationId?: string;
  payloadConversationIdSource?: 'data' | 'payload';
  conversationIdType?: 'string' | 'number' | 'other';
};

// Allowlist-only view of `extras.payload`: the decoded payload is parsed only
// to extract the shape/action/conversation id. Values are never returned.
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
  summary.topLevelKeys = safeKeyNames(parsed);
  summary.action = safeScalarText(parsed.action);
  const { data } = parsed;
  const candidates: { source: 'data' | 'payload'; value: unknown }[] = [];
  if (isRecord(data)) {
    summary.hasData = true;
    summary.dataKeys = safeKeyNames(data);
    candidates.push({ source: 'data', value: data.conversationId });
  }
  // Some payloads put the id next to `action` instead of inside `data`.
  candidates.push({ source: 'payload', value: parsed.conversationId });
  const found = candidates.find(({ value }) => value !== undefined);
  if (found) {
    summary.payloadConversationIdSource = found.source;
    if (typeof found.value === 'string') {
      summary.conversationIdType = 'string';
    } else if (
      typeof found.value === 'number' &&
      Number.isSafeInteger(found.value)
    ) {
      summary.conversationIdType = 'number';
    } else {
      summary.conversationIdType = 'other';
    }
    summary.conversationId = normalizeSupportConversationId(found.value);
  }
  return summary;
}

// Allowlist-only view of `extras.params`: only routing ids are kept; every
// other field (accountId, address, networkId, ...) is omitted on purpose.
export function pickSupportParams(
  params: Record<string, unknown> | undefined,
): {
  paramsConversationId?: string;
  msgId?: string;
} {
  if (!isRecord(params)) {
    return {};
  }
  const result: { paramsConversationId?: string; msgId?: string } = {};
  const conversationId = normalizeSupportConversationId(params.conversationId);
  if (conversationId !== undefined) {
    result.paramsConversationId = conversationId;
  }
  const msgId = safeScalarText(params.msgId);
  if (msgId !== undefined) {
    result.msgId = msgId;
  }
  return result;
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

function toSafeTraceValue(value: ISupportTraceValue): ISupportTraceValue {
  if (typeof value === 'string') {
    return value.length > MAX_LOGGED_STRING_LENGTH
      ? `${value.slice(0, MAX_LOGGED_STRING_LENGTH)}…`
      : value;
  }
  if (Array.isArray(value)) {
    const items = value as readonly string[];
    return items
      .slice(0, MAX_LOGGED_KEYS)
      .map((item) =>
        item.length > MAX_LOGGED_KEY_NAME_LENGTH
          ? `${item.slice(0, MAX_LOGGED_KEY_NAME_LENGTH)}…`
          : item,
      );
  }
  return value;
}

export function traceSupportNotification(
  phase: string,
  detail: ISupportTraceDetail = {},
) {
  if (!SUPPORT_NOTIFICATION_TRACE_ENABLED) {
    return;
  }
  try {
    const { platform, runtime } = getSupportNotificationRuntimeInfo();
    const normalizedDetail: ISupportTraceDetail = {};
    Object.entries(detail).forEach(([key, value]) => {
      if (key.length > MAX_LOGGED_KEY_NAME_LENGTH) {
        return;
      }
      normalizedDetail[key] = toSafeTraceValue(value);
    });
    defaultLogger.notification.common.supportNotificationTrace(phase, {
      ...normalizedDetail,
      platform,
      runtime,
    });
  } catch {
    // Diagnostics must never affect the click path.
  }
}
