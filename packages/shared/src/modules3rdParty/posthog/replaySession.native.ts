// Session Replay session id, owned by JS (iOS / Android, `main` runtime only).
//
// Storage: one record in the app-settings MMKV (`onekey-app-setting`), which is
// a process-wide native instance written by `bg`; `main` reads the file
// directly until its mirror is bootstrapped and forwards writes to `bg`. Each
// runtime would hold its own copy, but only `main` imports this module.
//
// The native SDKs run in React Native mode (non-empty sdkVersion), so they
// keep the id passed in and never rotate it themselves. Rotation happens here:
// after 30 minutes in the background (or since the last persisted foreground
// time on cold start), after 24 hours, or when the clock went backwards.
// Time spent in the foreground never counts as idle.

import appStorage from '../../storage/appStorage';
import { EAppSyncStorageKeys } from '../../storage/syncStorageKeys';

export const REPLAY_SESSION_IDLE_MS = 30 * 60 * 1000;
export const REPLAY_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type IReplaySessionRecord = {
  sid: string;
  // Last time the app was known to be in the foreground (epoch ms).
  at: number;
};

const UUID_V7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let record: IReplaySessionRecord | undefined;
let inBackground = false;
// When the app last left the foreground, until a foreground touch consumes it.
let idleSince: number | undefined;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

// Lowercase UUIDv7: 48-bit ms timestamp, then random bits. The bucket used for
// sampling comes from the last 32 bits, which are random.
export function generateReplaySessionId(nowMs: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let timestamp = Math.max(0, Math.floor(nowMs));
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }
  // eslint-disable-next-line no-bitwise
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // eslint-disable-next-line no-bitwise
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getReplaySessionStartMs(sessionId: string): number | undefined {
  if (!UUID_V7_RE.test(sessionId)) {
    return undefined;
  }
  const value = Number.parseInt(
    `${sessionId.slice(0, 8)}${sessionId.slice(9, 13)}`,
    16,
  );
  return Number.isFinite(value) ? value : undefined;
}

function isReusable(
  sessionId: string,
  lastActiveAt: number,
  now: number,
): boolean {
  const startedAt = getReplaySessionStartMs(sessionId);
  if (startedAt === undefined || !Number.isFinite(lastActiveAt)) {
    return false;
  }
  if (now < lastActiveAt || now < startedAt) {
    return false;
  }
  return (
    now - lastActiveAt < REPLAY_SESSION_IDLE_MS &&
    now - startedAt < REPLAY_SESSION_MAX_AGE_MS
  );
}

function readStoredRecord(): IReplaySessionRecord | undefined {
  try {
    const stored = appStorage.syncStorage.getObject<
      Partial<IReplaySessionRecord>
    >(EAppSyncStorageKeys.onekey_replay_session_v1);
    if (
      stored &&
      typeof stored.sid === 'string' &&
      typeof stored.at === 'number'
    ) {
      return { sid: stored.sid, at: stored.at };
    }
  } catch {
    // Unreadable storage only costs a new session.
  }
  return undefined;
}

function persistRecord(): void {
  if (!record) {
    return;
  }
  try {
    // Best effort: a write lost to a reset or Travel Mode only costs a new
    // session on the next cold start.
    void Promise.resolve(
      appStorage.syncStorage.setObject(
        EAppSyncStorageKeys.onekey_replay_session_v1,
        { sid: record.sid, at: record.at },
      ),
    ).catch(() => undefined);
  } catch {
    // See above.
  }
}

function startNewSession(now: number): IReplaySessionRecord {
  const next = { sid: generateReplaySessionId(now), at: now };
  record = next;
  persistRecord();
  return next;
}

export function getReplaySessionId(): string | undefined {
  return record?.sid;
}

// Activity (first evaluation, navigation, foreground). Loads the persisted
// session on first use in this JS context and rotates it when it went idle or
// expired. Writes storage only when the id changes.
export function touchReplaySession(now: number = Date.now()): {
  sessionId: string;
  previousSessionId: string | undefined;
} {
  const current = record;
  if (!current) {
    const stored = readStoredRecord();
    let loaded: IReplaySessionRecord;
    if (stored && isReusable(stored.sid, stored.at, now)) {
      loaded = { sid: stored.sid, at: now };
      record = loaded;
    } else {
      loaded = startNewSession(now);
    }
    idleSince = undefined;
    return { sessionId: loaded.sid, previousSessionId: undefined };
  }
  const lastActiveAt = idleSince ?? now;
  if (!inBackground) {
    idleSince = undefined;
  }
  if (isReusable(current.sid, lastActiveAt, now)) {
    current.at = now;
    return { sessionId: current.sid, previousSessionId: current.sid };
  }
  const next = startNewSession(now);
  return { sessionId: next.sid, previousSessionId: current.sid };
}

// AppState 'background': remember when the foreground ended and persist it,
// so a cold start within the idle window resumes the same session.
export function markReplaySessionBackground(now: number = Date.now()): void {
  inBackground = true;
  idleSince ??= now;
  if (!record) {
    return;
  }
  record.at = now;
  persistRecord();
}

// AppState 'active'. The next touch measures idle time from the background
// transition, then clears it.
export function markReplaySessionForeground(): void {
  inBackground = false;
}
