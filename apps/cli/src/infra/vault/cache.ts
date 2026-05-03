import {
  ABSOLUTE_MAX_TTL_MS,
  REFRESH_THRESHOLD_MS,
  SLIDING_TTL_MS,
} from './constants';

import type { IVaultCacheEntry } from './types';

export type IVaultAddressCacheKey = `${string}:address:${string}`;

export type ICacheDecision =
  | { kind: 'hit-no-write'; entry: IVaultCacheEntry }
  | { kind: 'hit-refresh'; nextEntry: IVaultCacheEntry }
  | {
      kind: 'miss';
      reason: 'absolute' | 'clock-back' | 'expired' | 'not-found';
    };

export function createVaultAddressCacheKey(
  walletId: string,
  keyId: string,
): IVaultAddressCacheKey {
  return `${walletId}:address:${keyId}`;
}

export function decideCacheAction(
  cached: IVaultCacheEntry | null | undefined,
  now: number,
): ICacheDecision {
  if (!cached) {
    return { kind: 'miss', reason: 'not-found' };
  }

  if (now < cached.issuedAt) {
    return { kind: 'miss', reason: 'clock-back' };
  }

  const absoluteExpiresAt = cached.issuedAt + ABSOLUTE_MAX_TTL_MS;
  if (now >= absoluteExpiresAt) {
    return { kind: 'miss', reason: 'absolute' };
  }

  if (now >= cached.expiresAt) {
    return { kind: 'miss', reason: 'expired' };
  }

  if (cached.expiresAt - now > REFRESH_THRESHOLD_MS) {
    return { kind: 'hit-no-write', entry: cached };
  }

  const proposedExpiresAt = Math.min(now + SLIDING_TTL_MS, absoluteExpiresAt);

  if (proposedExpiresAt <= now) {
    return { kind: 'miss', reason: 'expired' };
  }

  if (proposedExpiresAt <= cached.expiresAt) {
    return { kind: 'hit-no-write', entry: cached };
  }

  return {
    kind: 'hit-refresh',
    nextEntry: {
      ...cached,
      expiresAt: proposedExpiresAt,
    },
  };
}
