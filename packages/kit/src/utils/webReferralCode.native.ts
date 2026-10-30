import type { IWebReferralCodeRecord } from './webReferralCode';

export type { IWebReferralCodeRecord } from './webReferralCode';

export function subscribeWebReferralCode(_listener: () => void): () => void {
  return () => undefined;
}

export function readWebReferralCode(): IWebReferralCodeRecord | undefined {
  return undefined;
}

export function captureWebReferralCode(_value: string | undefined): void {
  // Web referral capture is unavailable in native runtimes.
}

export function clearWebReferralCodeIfMatch(
  _expected: IWebReferralCodeRecord,
): boolean {
  return false;
}

export function normalizeWebReferralPath(path: string): string {
  return path;
}
