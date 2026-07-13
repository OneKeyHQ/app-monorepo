const DAY_MS = 24 * 60 * 60 * 1000;

export const REFERRAL_BIND_WINDOW_DAYS = 14;

const LEGACY_WALLET_CREATED_AT_FALLBACK_DAYS = REFERRAL_BIND_WINDOW_DAYS + 1;

function normalizeDateInput(now?: Date | number) {
  if (now instanceof Date) {
    return now.getTime();
  }
  return now ?? Date.now();
}

export function buildWalletCreatedAtISOString({
  now,
}: {
  now?: Date | number;
} = {}) {
  return new Date(normalizeDateInput(now)).toISOString();
}

export function buildLegacyWalletCreatedAtFallback({
  now,
}: {
  now?: Date | number;
} = {}) {
  return buildWalletCreatedAtISOString({
    now:
      normalizeDateInput(now) - DAY_MS * LEGACY_WALLET_CREATED_AT_FALLBACK_DAYS,
  });
}

export function resolveWalletCreatedAtForCreationRecord({
  cachedWalletCreatedAt,
  deviceCreatedAt,
  now,
}: {
  cachedWalletCreatedAt?: string;
  deviceCreatedAt?: number;
  now?: Date | number;
}) {
  if (cachedWalletCreatedAt) {
    return cachedWalletCreatedAt;
  }

  if (typeof deviceCreatedAt === 'number' && Number.isFinite(deviceCreatedAt)) {
    return buildWalletCreatedAtISOString({
      now: deviceCreatedAt,
    });
  }

  // Legacy HD wallets have no reliable local creation timestamp. Use a
  // conservative expired fallback so migration does not reopen a fresh bind
  // window after upgrade.
  return buildLegacyWalletCreatedAtFallback({ now });
}
