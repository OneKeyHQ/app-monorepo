import { pickInviteCodeFromReferrerValue } from '@onekeyhq/shared/src/referralCode/installReferrerUtils';

const STORAGE_KEY = 'onekey_web_referral_code_v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type IWebReferralCodeRecord = {
  code: string;
  capturedAt: number;
};

const listeners = new Set<() => void>();
let fallbackRecord: IWebReferralCodeRecord | undefined;
let storageFailed = false;

function getStorage(): Storage | undefined {
  if (storageFailed) {
    return undefined;
  }
  try {
    return globalThis.sessionStorage;
  } catch {
    storageFailed = true;
    return undefined;
  }
}

function isRecord(value: unknown): value is IWebReferralCodeRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<IWebReferralCodeRecord>;
  return (
    typeof record.code === 'string' &&
    pickInviteCodeFromReferrerValue(record.code) === record.code &&
    typeof record.capturedAt === 'number' &&
    Number.isFinite(record.capturedAt) &&
    record.capturedAt > 0
  );
}

function sameRecord(
  a: IWebReferralCodeRecord | undefined,
  b: IWebReferralCodeRecord | undefined,
): boolean {
  return a?.code === b?.code && a?.capturedAt === b?.capturedAt;
}

function notify() {
  queueMicrotask(() => {
    listeners.forEach((listener) => listener());
  });
}

export function subscribeWebReferralCode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readWebReferralCode(): IWebReferralCodeRecord | undefined {
  const storage = getStorage();
  let record: unknown = fallbackRecord;
  let raw: string | null | undefined;
  if (storage) {
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      storageFailed = true;
    }
    if (raw !== undefined) {
      try {
        record = raw ? (JSON.parse(raw) as unknown) : undefined;
      } catch {
        record = undefined;
      }
    }
  }
  if (!isRecord(record) || Date.now() - record.capturedAt > TTL_MS) {
    if (raw) {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        storageFailed = true;
      }
    }
    fallbackRecord = undefined;
    return undefined;
  }
  fallbackRecord = record;
  return record;
}

export function captureWebReferralCode(value: string | undefined): void {
  const code = pickInviteCodeFromReferrerValue(value);
  if (!code) {
    return;
  }
  const previous = readWebReferralCode();
  if (previous?.code === code) {
    return;
  }
  const record = { code, capturedAt: Date.now() };
  fallbackRecord = record;
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    storageFailed = true;
  }
  notify();
}

export function clearWebReferralCodeIfMatch(
  expected: IWebReferralCodeRecord,
): boolean {
  if (!sameRecord(readWebReferralCode(), expected)) {
    return false;
  }
  fallbackRecord = undefined;
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    storageFailed = true;
  }
  notify();
  return true;
}
