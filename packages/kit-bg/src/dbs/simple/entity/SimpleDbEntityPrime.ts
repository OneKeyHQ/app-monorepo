/* cspell:ignore Infini infini INFINI */
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  buildPrimeInfiniPaymentCacheKey,
  getPrimeInfiniPaymentAssetKey,
  hasPrimeInfiniPaymentProgressSnapshot,
  isPrimeInfiniPaymentCacheKeyForContext,
  isPrimeInfiniPaymentClosedUnpaidSnapshot,
  isPrimeInfiniPaymentForAssetSnapshot,
  isPrimeInfiniPaymentObsoleteBeforeBroadcastSnapshot,
  isPrimeInfiniPaymentPreBroadcastSnapshotSendable,
  isPrimeInfiniPaymentTransferClaimForSession,
  isSamePrimeInfiniNetworkAddress,
  isSamePrimeInfiniPaymentAssetIdentity,
  isSamePrimeInfiniPaymentCacheKey,
  isSamePrimeInfiniPaymentTransferSnapshot,
  isValidPrimeInfiniPaymentContract,
  mergePrimeInfiniPaymentProgressSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import {
  createPrimeInfiniPaymentValidationError,
  getPrimeInfiniPaymentValidationFailure,
  toPrimeInfiniPaymentPersistenceError,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IExplicitLocalOneKeyIdLogoutProjection } from '@onekeyhq/shared/types/prime/identityExitTypes';
import {
  EPrimeAuthSessionSource,
  type IPrimeInfiniPayment,
  type IPrimeInfiniPaymentCacheIdentity,
  type IPrimeInfiniPaymentCacheKey,
  type IPrimeInfiniPaymentFlowContext,
  type IPrimeInfiniPaymentTransferClaim,
  type IPrimeInfiniPendingPaymentSession,
  type IPrimeInfiniPendingPaymentSessionInput,
  type IPrimeInfiniPurchaseStatusSnapshot,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  clearAuthSessionBySessionSource,
  clearSupabaseStorageCache,
  getAuthTokenBySessionSource,
} from '../../../services/ServicePrime/primeAuthSessionAccess';
import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Upper bound on how long an unsent pending session may block the purchase
// entry when every server-side release path stays unreachable (for example the
// invoice endpoint failing on that paymentId). It is the worst-case lockout, so
// it must stay short; sessions with reachable escapes are released long before
// this, and an unsent invoice commits no funds.
const INFINI_UNSENT_PAYMENT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// A transfer that was broadcast (or shows recorded progress) can settle long
// after it left this device — low fee, chain congestion, a server outage.
// Expiring its session on the short bound would let the entry gate report no
// pending payment and admit a second purchase while the first transfer can
// still arrive, so sent sessions only age out here; the choice screen releases
// them earlier with the user's explicit consent, and this never locks the user
// out on its own. Tombstones and the superseded archive share this bound
// because they fence the same in-flight risk.
const INFINI_SENT_PAYMENT_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const INFINI_PENDING_PAYMENT_SESSION_MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const INFINI_PAYMENT_CACHE_TOMBSTONE_LIMIT = 20;
const INFINI_SUPERSEDED_PAYMENT_SESSION_LIMIT = 10;

// How often the analytics identity link may be re-reported per user from
// this device. Keeps onekeyIdIdentityLinked volume bounded while still
// re-asserting the link periodically (server-side $identify is idempotent).
const IDENTITY_LINK_REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IDENTITY_LINK_REPORTED_USERS_LIMIT = 5;

// Re-assert cadence for the membership user-profile attributes. Unchanged
// values are re-sent after this TTL so a lost server-side property
// self-heals; value changes always report immediately.
const PRIME_PROFILE_REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isAnalyticsReportDue({
  reportedAt,
  now,
  ttlMs,
}: {
  reportedAt: number | undefined;
  now: number;
  ttlMs: number;
}): boolean {
  return (
    !reportedAt ||
    !Number.isFinite(reportedAt) ||
    reportedAt > now ||
    now - reportedAt >= ttlMs
  );
}

type IPrimeInfiniPaymentCacheTombstone = IPrimeInfiniPaymentCacheKey & {
  retiredAt: number;
};

type IPrimeInfiniSupersededPaymentSession =
  IPrimeInfiniPendingPaymentSession & {
    supersededAt: number;
    supersededReason: 'user-forced-replacement';
  };

export interface ISimpleDBPrime {
  // Deprecated token copy. Supabase/OAuth session storage is the source of truth.
  authToken?: string;
  authSessionSource?: EPrimeAuthSessionSource;
  oneKeyIdAuthState?: 'loggedIn' | 'loggedOut';
  authSessionCommitIdBySource?: Partial<
    Record<EPrimeAuthSessionSource, string>
  >;
  keylessSessionCommitIdByWalletId?: Record<string, string>;
  identityExitOperationJournal?: Record<string, IIdentityExitJournalEntry>;
  keylessOAuthSessionPersistenceJournal?: IKeylessOAuthSessionPersistenceJournal;
  // Monotonic auth-state commit epoch, bumped on every setAuthSessionSource
  // write (login commits, bind switches). Destructive cleanups that decide
  // on a pre-await snapshot (keyless session teardown, bg->main
  // invalid-token events) compare it before acting: a source-only recheck
  // cannot distinguish "the same KeylessOAuth login I decided to clear" from
  // "a FRESH KeylessOAuth login committed while I awaited", but the
  // generation can. Clears and the legacy self-heal migration intentionally
  // do NOT bump: gating only needs to detect fresh login commits, a
  // redundant clear is idempotent, and the self-heal merely recovers the
  // source of an ALREADY-established login (never a new commit) — letting
  // its lockless write advance the epoch would let it defeat an in-flight
  // invalid-token teardown of that same session.
  authStateGeneration?: number;
  // Monotonic revision for the complete local identity lifecycle. Unlike
  // authStateGeneration, this also advances for Keyless wallet/session
  // mutations coordinated by background services.
  identityLifecycleRevision?: number;
  // Per-user marker for the optional OAuth sign-in-method reminder. The
  // historical field name is retained for persisted-data compatibility;
  // any finite timestamp now means the reminder has been consumed forever.
  localKeylessUpgradeBindPromptShownAtByUserId?: Record<string, number>;
  // A completed passive legacy-Keyless credential upgrade is reusable only
  // while the complete identity lifecycle stays unchanged. Any OneKey ID,
  // Keyless wallet, or Keyless OAuth session mutation advances the revision
  // and makes the cached completion stale.
  localKeylessCredentialUpgradeCompletedRevisionByUserId?: Record<
    string,
    number
  >;
  oneKeyIdOAuthBindPromptClaimByUserId?: Record<
    string,
    { claimId: string; expiresAt: number }
  >;
  infiniPendingPaymentSessionByUserId?: Record<
    string,
    IPrimeInfiniPendingPaymentSession
  >;
  infiniPaymentCacheTombstonesByUserId?: Record<
    string,
    IPrimeInfiniPaymentCacheTombstone[]
  >;
  infiniSupersededPaymentSessionsByUserId?: Record<
    string,
    IPrimeInfiniSupersededPaymentSession[]
  >;
  identityLinkReportedAtByUserId?: Record<string, number>;
  analyticsPrimeProfileReport?: {
    isOneKeyIdLoggedIn: boolean;
    isPrimeActive: boolean;
    reportedAt: number;
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalFiniteNumber(value: unknown) {
  return (
    value === undefined || (typeof value === 'number' && Number.isFinite(value))
  );
}

function isValidInfiniPaymentCacheIdentity(
  identity: IPrimeInfiniPaymentCacheIdentity | undefined,
): identity is IPrimeInfiniPaymentCacheIdentity {
  return Boolean(
    identity &&
    isNonEmptyString(identity.paymentId) &&
    isNonEmptyString(identity.networkId) &&
    (identity.contractAddress === '' ||
      isNonEmptyString(identity.contractAddress)),
  );
}

function isValidInfiniPaymentCacheKey(
  cacheKey: IPrimeInfiniPaymentCacheKey | undefined,
): cacheKey is IPrimeInfiniPaymentCacheKey {
  return Boolean(
    isValidInfiniPaymentCacheIdentity(cacheKey) &&
    cacheKey &&
    isNonEmptyString(cacheKey.bindingId) &&
    isNonEmptyString(cacheKey.onekeyUserId) &&
    (cacheKey.plan === 'monthly' || cacheKey.plan === 'yearly') &&
    isNonEmptyString(cacheKey.payerAccountId) &&
    isNonEmptyString(cacheKey.payerAddress),
  );
}

function getActiveInfiniPaymentCacheTombstones({
  rawData,
  onekeyUserId,
  now,
}: {
  rawData: ISimpleDBPrime | null | undefined;
  onekeyUserId: string;
  now: number;
}) {
  return (
    rawData?.infiniPaymentCacheTombstonesByUserId?.[onekeyUserId] ?? []
  ).filter((tombstone) => {
    const age = now - tombstone.retiredAt;
    return (
      isValidInfiniPaymentCacheKey(tombstone) &&
      Number.isFinite(tombstone.retiredAt) &&
      age >= -INFINI_PENDING_PAYMENT_SESSION_MAX_CLOCK_SKEW_MS &&
      age <= INFINI_SENT_PAYMENT_SESSION_MAX_AGE_MS
    );
  });
}

function retireInfiniPaymentCache({
  rawData,
  onekeyUserId,
  paymentCacheKey,
  now,
}: {
  rawData: ISimpleDBPrime | null | undefined;
  onekeyUserId: string;
  paymentCacheKey: IPrimeInfiniPaymentCacheKey;
  now: number;
}): ISimpleDBPrime {
  const tombstones = getActiveInfiniPaymentCacheTombstones({
    rawData,
    onekeyUserId,
    now,
  });
  const nextTombstones = [
    ...tombstones.filter(
      (tombstone) =>
        !isSamePrimeInfiniPaymentCacheKey(tombstone, paymentCacheKey),
    ),
    {
      ...paymentCacheKey,
      retiredAt: now,
    },
  ].slice(-INFINI_PAYMENT_CACHE_TOMBSTONE_LIMIT);
  return {
    ...rawData,
    infiniPaymentCacheTombstonesByUserId: {
      ...rawData?.infiniPaymentCacheTombstonesByUserId,
      [onekeyUserId]: nextTombstones,
    },
  };
}

function getInfiniPaymentCacheKey(
  session: IPrimeInfiniPendingPaymentSession | undefined,
): IPrimeInfiniPaymentCacheKey | undefined {
  const cacheKey = session?.paymentCacheKey;
  if (!isValidInfiniPaymentCacheKey(cacheKey)) {
    return undefined;
  }
  return cacheKey;
}

function getActiveInfiniSupersededPaymentSessions({
  rawData,
  onekeyUserId,
  now,
}: {
  rawData: ISimpleDBPrime | null | undefined;
  onekeyUserId: string;
  now: number;
}) {
  return (
    rawData?.infiniSupersededPaymentSessionsByUserId?.[onekeyUserId] ?? []
  ).filter((session) => {
    const age = now - session.supersededAt;
    return (
      session.supersededReason === 'user-forced-replacement' &&
      Number.isFinite(session.supersededAt) &&
      age >= -INFINI_PENDING_PAYMENT_SESSION_MAX_CLOCK_SKEW_MS &&
      age <= INFINI_SENT_PAYMENT_SESSION_MAX_AGE_MS &&
      isValidInfiniPendingPaymentSession(session, {
        onekeyUserId,
        now,
      })
    );
  });
}

function isValidInfiniPendingPaymentSession(
  session: IPrimeInfiniPendingPaymentSession | undefined,
  {
    onekeyUserId,
    now,
  }: {
    onekeyUserId: string;
    now: number;
  },
): boolean {
  if (
    !session ||
    session.schemaVersion !== 2 ||
    session.baseline?.onekeyUserId !== onekeyUserId ||
    !isNonEmptyString(session.asset?.key) ||
    !isNonEmptyString(session.asset?.chain) ||
    !isNonEmptyString(session.asset?.token) ||
    !isNonEmptyString(session.asset?.networkId) ||
    !isValidPrimeInfiniPaymentContract(session.asset) ||
    !isNonEmptyString(session.payment?.paymentId) ||
    !isNonEmptyString(session.payment?.address) ||
    !isNonEmptyString(session.payment?.chain) ||
    !isNonEmptyString(session.payment?.token) ||
    !isNonEmptyString(session.payment?.amountDue) ||
    !isNonEmptyString(session.payerAccountId) ||
    !isNonEmptyString(session.payerAddress) ||
    !isValidInfiniPaymentCacheKey(session.paymentCacheKey) ||
    !Number.isFinite(session.payment?.expiresAt) ||
    !Number.isFinite(session.updatedAt) ||
    !isOptionalFiniteNumber(session.createdAt) ||
    !isOptionalFiniteNumber(session.lastValidatedAt) ||
    !isOptionalFiniteNumber(session.localRetentionDeadline) ||
    !isOptionalFiniteNumber(session.baseline.primeExpiresAt) ||
    !isOptionalFiniteNumber(session.baseline.infiniPeriodEnd) ||
    (session.baseline.infiniSubscriptionId !== undefined &&
      session.baseline.infiniSubscriptionId !== null &&
      !isNonEmptyString(session.baseline.infiniSubscriptionId)) ||
    (session.plan !== 'monthly' && session.plan !== 'yearly') ||
    (session.selectedSubscriptionPeriod !== 'P1M' &&
      session.selectedSubscriptionPeriod !== 'P1Y') ||
    typeof session.baseline.wasPrimeActive !== 'boolean' ||
    typeof session.sendStarted !== 'boolean' ||
    session.paymentCacheKey.paymentId !== session.payment.paymentId ||
    session.paymentCacheKey.networkId !== session.asset.networkId ||
    !isSamePrimeInfiniPaymentAssetIdentity(
      session.paymentCacheKey,
      session.asset,
    ) ||
    session.paymentCacheKey.onekeyUserId !== onekeyUserId ||
    session.paymentCacheKey.plan !== session.plan ||
    session.paymentCacheKey.payerAccountId !== session.payerAccountId ||
    !isSamePrimeInfiniNetworkAddress({
      networkId: session.asset.networkId,
      first: session.paymentCacheKey.payerAddress,
      second: session.payerAddress,
    }) ||
    !isPrimeInfiniPaymentCacheKeyForContext({
      cacheKey: session.paymentCacheKey,
      payment: session.payment,
      asset: session.asset,
      onekeyUserId,
      plan: session.plan,
      payerAccountId: session.payerAccountId,
      payerAddress: session.payerAddress,
    }) ||
    !isPrimeInfiniPaymentForAssetSnapshot({
      payment: session.payment,
      asset: session.asset,
    }) ||
    session.asset.key !== getPrimeInfiniPaymentAssetKey(session.asset) ||
    (session.plan === 'monthly' &&
      session.selectedSubscriptionPeriod !== 'P1M') ||
    (session.plan === 'yearly' && session.selectedSubscriptionPeriod !== 'P1Y')
  ) {
    return false;
  }
  const age = now - session.updatedAt;
  const lifecycle = getInfiniPaymentSessionLifecycle(session);
  if (
    lifecycle.createdAt >
      session.updatedAt + INFINI_PENDING_PAYMENT_SESSION_MAX_CLOCK_SKEW_MS ||
    lifecycle.lastValidatedAt >
      now + INFINI_PENDING_PAYMENT_SESSION_MAX_CLOCK_SKEW_MS ||
    lifecycle.localRetentionDeadline < lifecycle.createdAt ||
    lifecycle.localRetentionDeadline >
      lifecycle.createdAt + INFINI_UNSENT_PAYMENT_SESSION_MAX_AGE_MS
  ) {
    return false;
  }
  // Sent sessions fence funds that may still be in flight, so they age out on
  // the long bound; only an unsent invoice may expire on the short one.
  const isTracking =
    session.sendStarted ||
    hasPrimeInfiniPaymentProgressSnapshot(session.payment);
  return (
    age >= -INFINI_PENDING_PAYMENT_SESSION_MAX_CLOCK_SKEW_MS &&
    (isTracking
      ? age <= INFINI_SENT_PAYMENT_SESSION_MAX_AGE_MS
      : now < lifecycle.localRetentionDeadline)
  );
}

function getInfiniPaymentSessionLifecycle(
  session: IPrimeInfiniPendingPaymentSession,
) {
  const createdAt = session.createdAt ?? session.updatedAt;
  return {
    createdAt,
    lastValidatedAt: session.lastValidatedAt ?? session.updatedAt,
    localRetentionDeadline:
      session.localRetentionDeadline ??
      createdAt + INFINI_UNSENT_PAYMENT_SESSION_MAX_AGE_MS,
  };
}

export type IIdentityExitJournalEntry = {
  operationId: string;
  planId: string;
  intentType:
    | 'logoutOneKeyId'
    | 'switchOneKeyIdAccount'
    | 'removeKeyless'
    | 'switchOAuth'
    | 'recoverMalformedKeyless'
    | 'remoteOneKeyIdLogout'
    | 'missingOneKeyIdSessionReconciliation'
    | 'invalidKeylessSessionReconciliation'
    | 'deleteOneKeyIdAccount'
    | 'appReset';
  status:
    | 'executing'
    | 'serverDeletePrepared'
    | 'serverDeletePending'
    | 'serverDeleteOutcomeUnknown'
    | 'serverDeleteRejected'
    | 'serverDeleted'
    | 'walletRemoved'
    | 'localStateCommitted'
    | 'completed';
  startedAt: number;
  updatedAt: number;
  expectedLifecycleRevision: number;
  committedLifecycleRevision?: number;
  serverDeleteOutcome?: 'confirmed' | 'rejected' | 'unknown';
  target: {
    logoutOneKeyId: boolean;
    removeKeyless: boolean;
    clearKeylessSession?: boolean;
    clearAllIdentityAuth?: boolean;
    explicitLocalOneKeyIdLogout?: boolean;
    explicitLocalKeylessRemoval?: boolean;
    switchOAuthProvider?: EOAuthSocialLoginProvider;
    allowUnknownKeylessSessionIdentity?: boolean;
  };
  explicitLocalOneKeyIdLogoutProjection?: IExplicitLocalOneKeyIdLogoutProjection;
  oneKeyId?: {
    onekeyUserId: string;
    source: EPrimeAuthSessionSource;
    sessionCommitId: string;
    sessionTokenSub?: string;
    allowSourceLessPreUpgrade?: boolean;
  };
  keyless?: {
    walletId: string;
    ownerId?: string;
    provider?: EOAuthSocialLoginProvider;
    socialUserIdHash?: string;
    malformedDataError?: string;
    sessionCommitId?: string;
    sessionTokenSub?: string;
    walletSessionCommitId?: string | null;
  };
  completed?: {
    oneKeyIdLoggedOut: boolean;
    removedWalletId?: string;
    oauthHandoff?: string;
    oauthProvider?: EOAuthSocialLoginProvider;
    oauthHandoffExpiresAt?: number;
    oauthExpectedLifecycleRevision?: number;
    oauthHandoffConsumedAt?: number;
  };
  remoteDeviceLogout?: {
    messageId: string;
    acknowledgedAt?: number;
    presentationHandledAt?: number;
    presentationHandledClaimId?: string;
    presentationClaim?: {
      claimId: string;
      expiresAt: number;
    };
    tombstoneExpiresAt?: number;
  };
};

export type IRemoteOneKeyIdLogoutPresentationClaimResult =
  | {
      status: 'claimed';
      claimId: string;
      expiresAt: number;
    }
  | {
      status: 'claimedByOther';
      retryAfterMs: number;
    }
  | {
      status: 'handled' | 'unavailable';
    };

export type IClaimRemoteOneKeyIdLogoutPresentationParams = {
  operationId: string;
  messageId: string;
  claimId: string;
  expiresAt: number;
  now: number;
};

export type ICompleteRemoteOneKeyIdLogoutPresentationParams = {
  operationId: string;
  messageId: string;
  claimId: string;
  presentationHandledAt: number;
  tombstoneExpiresAt: number;
};

export type IUpdateRemoteOneKeyIdLogoutJournalDeliveryParams = {
  operationId: string;
  messageId: string;
  acknowledgedAt?: number;
  presentationHandledAt?: number;
  tombstoneExpiresAt?: number;
};

export type IKeylessOAuthSessionPersistenceJournal = {
  operationId: string;
  status: 'prepared';
  startedAt: number;
  updatedAt: number;
  expectedLifecycleRevision: number;
  sessionCommitId: string;
  sessionTokenSub: string;
  // Supabase `session_id` is a non-secret logical-session identifier: token
  // refreshes preserve it, while a new sign-in for the same subject changes
  // it. Recovery needs both fields so an older same-account slot cannot be
  // mistaken for the session whose setSession was recorded.
  supabaseSessionId: string;
  walletId?: string;
  previousSessionCommitId?: string;
  previousWalletSessionCommitId?: string;
};

export type IKeylessOAuthSessionPersistenceJournalPreparation = Omit<
  IKeylessOAuthSessionPersistenceJournal,
  | 'expectedLifecycleRevision'
  | 'previousSessionCommitId'
  | 'previousWalletSessionCommitId'
>;

export type IKeylessOAuthSessionIdentity = Pick<
  IKeylessOAuthSessionPersistenceJournal,
  'sessionTokenSub' | 'supabaseSessionId'
>;

/**
 * Persisted Prime/OneKey ID markers (authSessionSource, throttle
 * timestamps). Live Supabase SDK session access (token reads that may hit
 * the network, signOut, per-source client branching) lives in
 * `primeAuthSessionAccess`; the token/session methods below are thin
 * delegating wrappers kept for the existing bridge entry points
 * (`backgroundApiProxy.simpleDb.prime.*`).
 */
export class SimpleDbEntityPrime extends SimpleDbEntityBase<ISimpleDBPrime> {
  entityName = 'prime';

  override enableCache = true;

  // Tombstone + monotonic epoch: deleting an unreadable record is not
  // equivalent to "never written". getRawData() null lets
  // persistMigratedLegacyAuthSessionSourceIfUnset rebuild loggedIn from a
  // leftover Supabase session, and authStateGeneration rolls back to 0.
  protected override readonly enableUnreadableRecordSelfHeal = false;

  @backgroundMethod()
  async getActiveAuthToken(): Promise<string> {
    const authSessionSource = await this.getEffectiveAuthSessionSource();
    if (authSessionSource) {
      return getAuthTokenBySessionSource(authSessionSource);
    }
    // Only the legacy migration fallback (inside the resolver) may recover a
    // source-less session. A standalone Keyless OAuth session must not imply
    // OneKey ID login.
    return '';
  }

  @backgroundMethod()
  async getSupabaseAuthToken(): Promise<string> {
    return getAuthTokenBySessionSource(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
  }

  @backgroundMethod()
  async getKeylessSupabaseAuthToken(): Promise<string> {
    return getAuthTokenBySessionSource(EPrimeAuthSessionSource.KeylessOAuth);
  }

  @backgroundMethod()
  async getAuthSessionSource(): Promise<EPrimeAuthSessionSource | undefined> {
    const rawData = await this.getRawData();
    return rawData?.authSessionSource;
  }

  /**
   * Resolve the effective auth session source, including the legacy-migration
   * fallback for sessions persisted before authSessionSource existed:
   * - persisted source exists -> return it;
   * - else if a legacy Supabase token exists -> the user is a
   *   pre-OAuth-upgrade legacy email login: return LegacyEmailSupabase and
   *   persist it back (self-healing, one-time) so every later read is
   *   definitive;
   * - else -> undefined.
   *
   * HARD SAFETY RULE: NEVER infer or persist KeylessOAuth here. A keyless
   * session with no persisted source means "Keyless wallet only, NOT logged
   * into OneKey ID" — persisting KeylessOAuth would fabricate a OneKey ID
   * login.
   */
  @backgroundMethod()
  async getEffectiveAuthSessionSource(): Promise<
    EPrimeAuthSessionSource | undefined
  > {
    const rawData = await this.getRawData();
    if (rawData?.oneKeyIdAuthState === 'loggedOut') {
      return undefined;
    }
    const persistedSource = await this.getAuthSessionSource();
    if (persistedSource) {
      return persistedSource;
    }
    const legacyAuthToken = await this.getSupabaseAuthToken();
    if (legacyAuthToken) {
      // Self-heal via a compare-and-set (see
      // persistMigratedLegacyAuthSessionSourceIfUnset): the source read
      // above and this write straddle a network-capable getSession(), so a
      // KeylessOAuth login can commit in between — never clobber it, and
      // never advance the auth-state generation for a migration write.
      return this.persistMigratedLegacyAuthSessionSourceIfUnset();
    }
    return undefined;
  }

  /**
   * Self-heal writer for the legacy-migration fallback, hardened against the
   * lockless read -> network getSession() -> write window in
   * getEffectiveAuthSessionSource:
   *
   * - Compare-and-set INSIDE the setRawData entity mutex (its builder reads
   *   the freshest rawData under the same lock that serializes
   *   setAuthSessionSource): if a source was committed while we resolved the
   *   legacy session — e.g. a concurrent KeylessOAuth login — keep the
   *   committed source and never overwrite it with Legacy. Returning the
   *   committed source keeps callers on the real active realm instead of a
   *   clobbered Legacy value that would strand the fresh keyless session (a
   *   wiped/overwritten KeylessOAuth source is never re-inferred).
   * - NEVER bump authStateGeneration: self-heal recovers the source of an
   *   ALREADY-established (pre-OAuth-upgrade) login, not a new login commit.
   *   The generation gate must trip ONLY on fresh commits; letting this
   *   lockless write advance it would let a self-heal landing in an
   *   invalid-token teardown's window falsely mark the epoch as changed and
   *   skip the gated session-slot removal + server revocation.
   */
  private async persistMigratedLegacyAuthSessionSourceIfUnset(): Promise<
    EPrimeAuthSessionSource | undefined
  > {
    const persisted = await this.setRawData((rawData) => {
      if (rawData?.oneKeyIdAuthState === 'loggedOut') {
        return rawData;
      }
      if (rawData?.authSessionSource) {
        return rawData;
      }
      return {
        ...rawData,
        authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
        oneKeyIdAuthState: 'loggedIn' as const,
        authSessionCommitIdBySource: {
          ...rawData?.authSessionCommitIdBySource,
          [EPrimeAuthSessionSource.LegacyEmailSupabase]:
            rawData?.authSessionCommitIdBySource?.[
              EPrimeAuthSessionSource.LegacyEmailSupabase
            ] || stringUtils.generateUUID(),
        },
      };
    });
    clearSupabaseStorageCache();
    if (persisted?.oneKeyIdAuthState === 'loggedOut') {
      return undefined;
    }
    return (
      persisted?.authSessionSource ??
      EPrimeAuthSessionSource.LegacyEmailSupabase
    );
  }

  /**
   * Current auth-state commit generation (see the ISimpleDBPrime field doc).
   * Defaults to 0 for pre-upgrade data.
   */
  @backgroundMethod()
  async getAuthStateGeneration(): Promise<number> {
    const rawData = await this.getRawData();
    return rawData?.authStateGeneration ?? 0;
  }

  @backgroundMethod()
  async getIdentityLifecycleRevision(): Promise<number> {
    const rawData = await this.getRawData();
    return rawData?.identityLifecycleRevision ?? 0;
  }

  @backgroundMethod()
  async bumpIdentityLifecycleRevision(): Promise<number> {
    const rawData = await this.setRawData((data) => ({
      ...data,
      identityLifecycleRevision: (data?.identityLifecycleRevision ?? 0) + 1,
    }));
    return rawData?.identityLifecycleRevision ?? 0;
  }

  async isIdentityLinkDue({
    onekeyUserId,
    now,
  }: {
    onekeyUserId: string;
    now: number;
  }): Promise<boolean> {
    const rawData = await this.getRawData();
    return isAnalyticsReportDue({
      reportedAt: rawData?.identityLinkReportedAtByUserId?.[onekeyUserId],
      now,
      ttlMs: IDENTITY_LINK_REPORT_TTL_MS,
    });
  }

  async recordIdentityLinkReported({
    onekeyUserId,
    now,
  }: {
    onekeyUserId: string;
    now: number;
  }): Promise<void> {
    await this.setRawData((data) => {
      const reportedAtByUserId = {
        ...data?.identityLinkReportedAtByUserId,
        [onekeyUserId]: now,
      };
      const prunedEntries = Object.entries(reportedAtByUserId)
        .toSorted(([, a], [, b]) => b - a)
        .slice(0, IDENTITY_LINK_REPORTED_USERS_LIMIT);
      return {
        ...data,
        identityLinkReportedAtByUserId: Object.fromEntries(prunedEntries),
      };
    });
  }

  async isPrimeProfileDue({
    isOneKeyIdLoggedIn,
    isPrimeActive,
    now,
  }: {
    isOneKeyIdLoggedIn: boolean;
    isPrimeActive: boolean;
    now: number;
  }): Promise<boolean> {
    const rawData = await this.getRawData();
    const prev = rawData?.analyticsPrimeProfileReport;
    return (
      !prev ||
      prev.isOneKeyIdLoggedIn !== isOneKeyIdLoggedIn ||
      prev.isPrimeActive !== isPrimeActive ||
      isAnalyticsReportDue({
        reportedAt: prev.reportedAt,
        now,
        ttlMs: PRIME_PROFILE_REPORT_TTL_MS,
      })
    );
  }

  async recordPrimeProfileReported({
    isOneKeyIdLoggedIn,
    isPrimeActive,
    now,
  }: {
    isOneKeyIdLoggedIn: boolean;
    isPrimeActive: boolean;
    now: number;
  }): Promise<void> {
    await this.setRawData((data) => ({
      ...data,
      analyticsPrimeProfileReport: {
        isOneKeyIdLoggedIn,
        isPrimeActive,
        reportedAt: now,
      },
    }));
  }

  async getKeylessOAuthSessionPersistenceJournal(): Promise<
    IKeylessOAuthSessionPersistenceJournal | undefined
  > {
    const rawData = await this.getRawData();
    return rawData?.keylessOAuthSessionPersistenceJournal;
  }

  async hasPendingIdentityLifecycleRecovery(): Promise<boolean> {
    const rawData = await this.getRawData();
    return Boolean(
      rawData?.keylessOAuthSessionPersistenceJournal ||
      Object.keys(rawData?.identityExitOperationJournal ?? {}).length,
    );
  }

  async setKeylessOAuthSessionPersistenceJournal(
    preparation: IKeylessOAuthSessionPersistenceJournalPreparation,
  ): Promise<IKeylessOAuthSessionPersistenceJournal> {
    const { setKeylessOAuthSessionPersistenceJournal } =
      await import('./keylessOAuthSessionPersistenceJournal');
    return setKeylessOAuthSessionPersistenceJournal(this, preparation);
  }

  async commitKeylessOAuthSessionPersistenceMetadata({
    operationId,
    persistedSessionIdentity,
    allowRevisionRebase = false,
  }: {
    operationId: string;
    persistedSessionIdentity: IKeylessOAuthSessionIdentity;
    allowRevisionRebase?: boolean;
  }): Promise<
    | { status: 'committed'; identityLifecycleRevision: number }
    | {
        status: 'revisionChanged' | 'sessionIdentityChanged' | 'stateChanged';
      }
  > {
    const { commitKeylessOAuthSessionPersistenceMetadata } =
      await import('./keylessOAuthSessionPersistenceJournal');
    return commitKeylessOAuthSessionPersistenceMetadata(this, {
      operationId,
      persistedSessionIdentity,
      allowRevisionRebase,
    });
  }

  async removeKeylessOAuthSessionPersistenceJournal({
    operationId,
  }: {
    operationId: string;
  }): Promise<boolean> {
    const { removeKeylessOAuthSessionPersistenceJournal } =
      await import('./keylessOAuthSessionPersistenceJournal');
    return removeKeylessOAuthSessionPersistenceJournal(this, { operationId });
  }

  @backgroundMethod()
  async getIdentityExitOperationJournal(): Promise<
    Record<string, IIdentityExitJournalEntry>
  > {
    const rawData = await this.getRawData();
    return { ...rawData?.identityExitOperationJournal };
  }

  @backgroundMethod()
  async setIdentityExitJournalEntry(
    entry: IIdentityExitJournalEntry,
  ): Promise<void> {
    const { setIdentityExitJournalEntry } =
      await import('./identityExitJournal');
    await setIdentityExitJournalEntry(this, entry);
  }

  @backgroundMethod()
  async ensureIdentityExitJournalEntry(
    entry: IIdentityExitJournalEntry,
  ): Promise<{ created: boolean; entry: IIdentityExitJournalEntry }> {
    let result = {
      created: false,
      entry,
    };
    await this.setRawData((rawData) => {
      const existingEntry =
        rawData?.identityExitOperationJournal?.[entry.operationId];
      if (existingEntry) {
        result = {
          created: false,
          entry: existingEntry,
        };
        return { ...rawData };
      }
      result = {
        created: true,
        entry,
      };
      return {
        ...rawData,
        identityExitOperationJournal: {
          ...rawData?.identityExitOperationJournal,
          [entry.operationId]: entry,
        },
      };
    });
    return result;
  }

  @backgroundMethod()
  async updateRemoteOneKeyIdLogoutJournalDelivery(
    params: IUpdateRemoteOneKeyIdLogoutJournalDeliveryParams,
  ): Promise<IIdentityExitJournalEntry | undefined> {
    const { updateRemoteOneKeyIdLogoutJournalDelivery } =
      await import('./identityExitJournal');
    return updateRemoteOneKeyIdLogoutJournalDelivery(this, params);
  }

  async tryClaimRemoteOneKeyIdLogoutPresentation(
    params: IClaimRemoteOneKeyIdLogoutPresentationParams,
  ): Promise<IRemoteOneKeyIdLogoutPresentationClaimResult> {
    const { tryClaimRemoteOneKeyIdLogoutPresentation } =
      await import('./identityExitJournal');
    return tryClaimRemoteOneKeyIdLogoutPresentation(this, params);
  }

  async completeRemoteOneKeyIdLogoutPresentation(
    params: ICompleteRemoteOneKeyIdLogoutPresentationParams,
  ): Promise<IIdentityExitJournalEntry | undefined> {
    const { completeRemoteOneKeyIdLogoutPresentation } =
      await import('./identityExitJournal');
    return completeRemoteOneKeyIdLogoutPresentation(this, params);
  }

  async removeIdentityExitJournalEntry({
    operationId,
    expectedUpdatedAt,
  }: {
    operationId: string;
    expectedUpdatedAt: number;
  }): Promise<boolean> {
    let removed = false;
    await this.setRawData((rawData) => {
      const journal = rawData?.identityExitOperationJournal;
      const entry = journal?.[operationId];
      if (!entry || entry.updatedAt !== expectedUpdatedAt) {
        return { ...rawData };
      }
      const nextJournal = { ...journal };
      delete nextJournal[operationId];
      removed = true;
      return {
        ...rawData,
        identityExitOperationJournal: nextJournal,
      };
    });
    return removed;
  }

  @backgroundMethod()
  async consumeIdentityExitOAuthHandoff({
    operationId,
    handoff,
    consumedAt,
  }: {
    operationId: string;
    handoff: string;
    consumedAt: number;
  }): Promise<boolean> {
    let consumed = false;
    await this.setRawData((rawData) => {
      const entry = rawData?.identityExitOperationJournal?.[operationId];
      if (
        entry?.status !== 'completed' ||
        entry.completed?.oauthHandoff !== handoff
      ) {
        return { ...rawData };
      }
      const nextJournal = {
        ...rawData?.identityExitOperationJournal,
      };
      delete nextJournal[operationId];
      if (
        entry.completed.oauthHandoffConsumedAt ||
        !entry.completed.oauthHandoffExpiresAt ||
        entry.completed.oauthHandoffExpiresAt <= consumedAt
      ) {
        return {
          ...rawData,
          identityExitOperationJournal: nextJournal,
        };
      }
      consumed = true;
      return {
        ...rawData,
        identityExitOperationJournal: nextJournal,
      };
    });
    return consumed;
  }

  @backgroundMethod()
  async getOneKeyIdAuthState(): Promise<'loggedIn' | 'loggedOut' | undefined> {
    const rawData = await this.getRawData();
    return rawData?.oneKeyIdAuthState;
  }

  @backgroundMethod()
  async getAuthSessionCommitId(
    authSessionSource: EPrimeAuthSessionSource,
  ): Promise<string | undefined> {
    const rawData = await this.getRawData();
    return rawData?.authSessionCommitIdBySource?.[authSessionSource];
  }

  async backfillAuthSessionCommitIdForMigration({
    authSessionSource,
    expectedActiveAuthSessionSource,
    preferredSessionCommitId,
  }: {
    authSessionSource: EPrimeAuthSessionSource;
    expectedActiveAuthSessionSource: EPrimeAuthSessionSource | undefined;
    preferredSessionCommitId?: string;
  }): Promise<string | undefined> {
    const generatedCommitId =
      preferredSessionCommitId || stringUtils.generateUUID();
    let resolvedCommitId: string | undefined;
    await this.setRawData((rawData) => {
      if (rawData?.authSessionSource !== expectedActiveAuthSessionSource) {
        return { ...rawData };
      }
      const existingCommitId =
        rawData?.authSessionCommitIdBySource?.[authSessionSource];
      if (existingCommitId) {
        resolvedCommitId = existingCommitId;
        return { ...rawData };
      }
      resolvedCommitId = generatedCommitId;
      return {
        ...rawData,
        authSessionCommitIdBySource: {
          ...rawData?.authSessionCommitIdBySource,
          [authSessionSource]: generatedCommitId,
        },
      };
    });
    return resolvedCommitId;
  }

  @backgroundMethod()
  async setAuthSessionCommitId({
    authSessionSource,
    sessionCommitId,
  }: {
    authSessionSource: EPrimeAuthSessionSource;
    sessionCommitId: string;
  }): Promise<void> {
    if (!sessionCommitId) {
      throw new OneKeyLocalError('sessionCommitId is required');
    }
    await this.setRawData((rawData) => ({
      ...rawData,
      authSessionCommitIdBySource: {
        ...rawData?.authSessionCommitIdBySource,
        [authSessionSource]: sessionCommitId,
      },
    }));
  }

  @backgroundMethod()
  async clearAuthSessionCommitIdIfMatches({
    authSessionSource,
    expectedSessionCommitId,
  }: {
    authSessionSource: EPrimeAuthSessionSource;
    expectedSessionCommitId: string;
  }): Promise<boolean> {
    let cleared = false;
    await this.setRawData((rawData) => {
      if (
        rawData?.authSessionCommitIdBySource?.[authSessionSource] !==
        expectedSessionCommitId
      ) {
        return { ...rawData };
      }
      const authSessionCommitIdBySource = {
        ...rawData.authSessionCommitIdBySource,
      };
      delete authSessionCommitIdBySource[authSessionSource];
      cleared = true;
      return { ...rawData, authSessionCommitIdBySource };
    });
    return cleared;
  }

  @backgroundMethod()
  async getKeylessSessionCommitId({
    walletId,
  }: {
    walletId: string;
  }): Promise<string | undefined> {
    const rawData = await this.getRawData();
    return rawData?.keylessSessionCommitIdByWalletId?.[walletId];
  }

  @backgroundMethod()
  async setKeylessSessionCommitId({
    walletId,
    sessionCommitId,
  }: {
    walletId: string;
    sessionCommitId: string;
  }): Promise<void> {
    if (!walletId || !sessionCommitId) {
      throw new OneKeyLocalError('walletId and sessionCommitId are required');
    }
    await this.setRawData((rawData) => ({
      ...rawData,
      keylessSessionCommitIdByWalletId: {
        ...rawData?.keylessSessionCommitIdByWalletId,
        [walletId]: sessionCommitId,
      },
    }));
  }

  @backgroundMethod()
  async clearKeylessSessionCommitIdIfMatches({
    walletId,
    expectedSessionCommitId,
  }: {
    walletId: string;
    expectedSessionCommitId?: string;
  }): Promise<boolean> {
    let cleared = false;
    await this.setRawData((rawData) => {
      const current = rawData?.keylessSessionCommitIdByWalletId?.[walletId];
      if (
        !current ||
        (expectedSessionCommitId && current !== expectedSessionCommitId)
      ) {
        return { ...rawData };
      }
      const keylessSessionCommitIdByWalletId = {
        ...rawData.keylessSessionCommitIdByWalletId,
      };
      delete keylessSessionCommitIdByWalletId[walletId];
      cleared = true;
      return { ...rawData, keylessSessionCommitIdByWalletId };
    });
    return cleared;
  }

  @backgroundMethod()
  async setAuthSessionSourceWithCommitId({
    authSessionSource,
    sessionCommitId,
  }: {
    authSessionSource: EPrimeAuthSessionSource;
    sessionCommitId: string;
  }): Promise<void> {
    if (!sessionCommitId) {
      throw new OneKeyLocalError('sessionCommitId is required');
    }
    await this.setRawData((rawData) => ({
      ...rawData,
      authSessionSource,
      oneKeyIdAuthState: 'loggedIn' as const,
      authSessionCommitIdBySource: {
        ...rawData?.authSessionCommitIdBySource,
        [authSessionSource]: sessionCommitId,
      },
      authStateGeneration: (rawData?.authStateGeneration ?? 0) + 1,
    }));
    clearSupabaseStorageCache();
  }

  @backgroundMethod()
  async setAuthSessionSource(authSessionSource: EPrimeAuthSessionSource) {
    await this.setAuthSessionSourceWithCommitId({
      authSessionSource,
      sessionCommitId: stringUtils.generateUUID(),
    });
  }

  @backgroundMethod()
  async clearCachedAuthToken() {
    // Clear only the deprecated cached token copy; keep authSessionSource so
    // the active Supabase/OAuth session stays resolvable.
    await this.setRawData((rawData) => ({
      ...rawData,
      authToken: '',
    }));
    clearSupabaseStorageCache();
  }

  async clearAuthTokens() {
    await this.setRawData((rawData) => {
      const authSessionCommitIdBySource = {
        ...rawData?.authSessionCommitIdBySource,
      };
      if (rawData?.authSessionSource) {
        delete authSessionCommitIdBySource[rawData.authSessionSource];
      }
      return {
        ...rawData,
        authToken: '',
        authSessionSource: undefined,
        oneKeyIdAuthState: 'loggedOut' as const,
        authSessionCommitIdBySource,
      };
    });
    clearSupabaseStorageCache();
  }

  async markOneKeyIdLoggedOutPreservingSessions() {
    await this.setRawData((rawData) => ({
      ...rawData,
      authToken: '',
      authSessionSource: undefined,
      oneKeyIdAuthState: 'loggedOut' as const,
    }));
    clearSupabaseStorageCache();
  }

  async clearAllIdentityAuthMetadataAndBumpRevision(): Promise<number> {
    const next = await this.setRawData((rawData) => ({
      ...rawData,
      authToken: '',
      authSessionSource: undefined,
      oneKeyIdAuthState: 'loggedOut' as const,
      authSessionCommitIdBySource: {},
      keylessSessionCommitIdByWalletId: {},
      keylessOAuthSessionPersistenceJournal: undefined,
      identityLifecycleRevision: (rawData?.identityLifecycleRevision ?? 0) + 1,
    }));
    clearSupabaseStorageCache();
    return next?.identityLifecycleRevision ?? 1;
  }

  async isAllIdentityAuthMetadataCleared(): Promise<boolean> {
    const rawData = await this.getRawData();
    return Boolean(
      rawData?.authSessionSource === undefined &&
      rawData?.oneKeyIdAuthState === 'loggedOut' &&
      Object.keys(rawData?.authSessionCommitIdBySource || {}).length === 0 &&
      Object.keys(rawData?.keylessSessionCommitIdByWalletId || {}).length ===
        0 &&
      rawData?.keylessOAuthSessionPersistenceJournal === undefined,
    );
  }

  @backgroundMethod()
  async hasShownOneKeyIdOAuthBindPrompt({
    onekeyUserId,
  }: {
    onekeyUserId: string;
  }): Promise<boolean> {
    if (!onekeyUserId) {
      return false;
    }
    const rawData = await this.getRawData();
    const shownAt =
      rawData?.localKeylessUpgradeBindPromptShownAtByUserId?.[onekeyUserId];
    if (typeof shownAt !== 'number' || !Number.isFinite(shownAt)) {
      return false;
    }
    return true;
  }

  @backgroundMethod()
  async getOneKeyIdOAuthBindPromptUpgradeState({
    onekeyUserId,
  }: {
    onekeyUserId: string;
  }): Promise<{
    hasShown: boolean;
    credentialUpgradeCompleted: boolean;
    identityLifecycleRevision?: number;
  }> {
    if (!onekeyUserId) {
      return {
        hasShown: false,
        credentialUpgradeCompleted: false,
      };
    }
    const rawData = await this.getRawData();
    const shownAt =
      rawData?.localKeylessUpgradeBindPromptShownAtByUserId?.[onekeyUserId];
    const currentRevision = rawData?.identityLifecycleRevision ?? 0;
    const completedRevision =
      rawData?.localKeylessCredentialUpgradeCompletedRevisionByUserId?.[
        onekeyUserId
      ];
    const identityLifecycleRevision =
      typeof currentRevision === 'number' && Number.isFinite(currentRevision)
        ? currentRevision
        : undefined;
    return {
      hasShown: typeof shownAt === 'number' && Number.isFinite(shownAt),
      credentialUpgradeCompleted:
        identityLifecycleRevision !== undefined &&
        typeof completedRevision === 'number' &&
        Number.isFinite(completedRevision) &&
        completedRevision === identityLifecycleRevision,
      identityLifecycleRevision,
    };
  }

  @backgroundMethod()
  async markOneKeyIdKeylessCredentialUpgradeCompleted({
    onekeyUserId,
    expectedIdentityLifecycleRevision,
  }: {
    onekeyUserId: string;
    expectedIdentityLifecycleRevision: number;
  }): Promise<boolean> {
    if (!onekeyUserId || !Number.isFinite(expectedIdentityLifecycleRevision)) {
      return false;
    }
    let marked = false;
    await this.setRawData((rawData) => {
      const currentRevision = rawData?.identityLifecycleRevision ?? 0;
      if (
        typeof currentRevision !== 'number' ||
        !Number.isFinite(currentRevision) ||
        currentRevision !== expectedIdentityLifecycleRevision
      ) {
        return { ...rawData };
      }
      marked = true;
      return {
        ...rawData,
        localKeylessCredentialUpgradeCompletedRevisionByUserId: {
          ...rawData?.localKeylessCredentialUpgradeCompletedRevisionByUserId,
          [onekeyUserId]: currentRevision,
        },
      };
    });
    return marked;
  }

  @backgroundMethod()
  async markOneKeyIdOAuthBindPromptShown({
    onekeyUserId,
  }: {
    onekeyUserId: string;
  }) {
    if (!onekeyUserId) {
      return;
    }
    await this.setRawData((rawData) => {
      const claims = {
        ...rawData?.oneKeyIdOAuthBindPromptClaimByUserId,
      };
      delete claims[onekeyUserId];
      return {
        ...rawData,
        localKeylessUpgradeBindPromptShownAtByUserId: {
          ...rawData?.localKeylessUpgradeBindPromptShownAtByUserId,
          [onekeyUserId]: Date.now(),
        },
        oneKeyIdOAuthBindPromptClaimByUserId: claims,
      };
    });
  }

  async tryClaimOneKeyIdOAuthBindPrompt({
    onekeyUserId,
    claimId,
    expiresAt,
    now,
  }: {
    onekeyUserId: string;
    claimId: string;
    expiresAt: number;
    now: number;
  }): Promise<boolean> {
    if (!onekeyUserId || !claimId || expiresAt <= now) {
      return false;
    }
    let claimed = false;
    await this.setRawData((rawData) => {
      const shownAt =
        rawData?.localKeylessUpgradeBindPromptShownAtByUserId?.[onekeyUserId];
      if (typeof shownAt === 'number' && Number.isFinite(shownAt)) {
        return { ...rawData };
      }
      const currentClaim =
        rawData?.oneKeyIdOAuthBindPromptClaimByUserId?.[onekeyUserId];
      if (currentClaim && currentClaim.expiresAt > now) {
        return { ...rawData };
      }
      claimed = true;
      return {
        ...rawData,
        oneKeyIdOAuthBindPromptClaimByUserId: {
          ...rawData?.oneKeyIdOAuthBindPromptClaimByUserId,
          [onekeyUserId]: { claimId, expiresAt },
        },
      };
    });
    return claimed;
  }

  async completeOneKeyIdOAuthBindPromptClaim({
    onekeyUserId,
    claimId,
    shownAt,
  }: {
    onekeyUserId: string;
    claimId: string;
    shownAt: number;
  }): Promise<boolean> {
    let completed = false;
    await this.setRawData((rawData) => {
      const currentClaim =
        rawData?.oneKeyIdOAuthBindPromptClaimByUserId?.[onekeyUserId];
      if (currentClaim?.claimId !== claimId) {
        return { ...rawData };
      }
      const claims = {
        ...rawData?.oneKeyIdOAuthBindPromptClaimByUserId,
      };
      delete claims[onekeyUserId];
      completed = true;
      return {
        ...rawData,
        localKeylessUpgradeBindPromptShownAtByUserId: {
          ...rawData?.localKeylessUpgradeBindPromptShownAtByUserId,
          [onekeyUserId]: shownAt,
        },
        oneKeyIdOAuthBindPromptClaimByUserId: claims,
      };
    });
    return completed;
  }

  async releaseOneKeyIdOAuthBindPromptClaim({
    onekeyUserId,
    claimId,
  }: {
    onekeyUserId: string;
    claimId: string;
  }): Promise<boolean> {
    let released = false;
    await this.setRawData((rawData) => {
      const currentClaim =
        rawData?.oneKeyIdOAuthBindPromptClaimByUserId?.[onekeyUserId];
      if (currentClaim?.claimId !== claimId) {
        return { ...rawData };
      }
      const claims = {
        ...rawData?.oneKeyIdOAuthBindPromptClaimByUserId,
      };
      delete claims[onekeyUserId];
      released = true;
      return {
        ...rawData,
        oneKeyIdOAuthBindPromptClaimByUserId: claims,
      };
    });
    return released;
  }

  @backgroundMethod()
  async resetOneKeyIdOAuthBindPromptShown({
    onekeyUserId,
  }: {
    onekeyUserId: string;
  }) {
    if (!onekeyUserId) {
      return;
    }
    await this.setRawData((rawData) => {
      const shownAtByUserId = {
        ...rawData?.localKeylessUpgradeBindPromptShownAtByUserId,
      };
      const claims = {
        ...rawData?.oneKeyIdOAuthBindPromptClaimByUserId,
      };
      const credentialUpgradeCompletedRevisionByUserId = {
        ...rawData?.localKeylessCredentialUpgradeCompletedRevisionByUserId,
      };
      delete shownAtByUserId[onekeyUserId];
      delete claims[onekeyUserId];
      delete credentialUpgradeCompletedRevisionByUserId[onekeyUserId];
      return {
        ...rawData,
        localKeylessUpgradeBindPromptShownAtByUserId: shownAtByUserId,
        oneKeyIdOAuthBindPromptClaimByUserId: claims,
        localKeylessCredentialUpgradeCompletedRevisionByUserId:
          credentialUpgradeCompletedRevisionByUserId,
      };
    });
  }

  @backgroundMethod()
  async getInfiniPendingPaymentSession({
    onekeyUserId,
    flowContext,
  }: {
    onekeyUserId: string;
    flowContext?: IPrimeInfiniPaymentFlowContext;
  }): Promise<IPrimeInfiniPendingPaymentSession | undefined> {
    if (!onekeyUserId) {
      return undefined;
    }
    const rawData = await this.getRawData();
    const session =
      rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
    const now = Date.now();
    const isValidSession = isValidInfiniPendingPaymentSession(session, {
      onekeyUserId,
      now,
    });
    const validatedSession = isValidSession ? session : undefined;
    const hasPaymentProgress = validatedSession
      ? hasPrimeInfiniPaymentProgressSnapshot(validatedSession.payment)
      : false;
    if (flowContext) {
      let status: 'restored' | 'succeeded' | 'blocked' = 'succeeded';
      if (session) {
        status = isValidSession ? 'restored' : 'blocked';
      }
      defaultLogger.prime.subscription.primeCryptoPaymentFlow({
        ...flowContext,
        stage: 'sessionLoad',
        paymentSource: 'localPendingSession',
        status,
        reason:
          session && !isValidSession
            ? 'invalidOrExpiredLocalSession'
            : undefined,
        paymentId: validatedSession?.payment.paymentId,
        sessionAgeMs: validatedSession
          ? now - (validatedSession.createdAt ?? validatedSession.updatedAt)
          : undefined,
        remainingMs: validatedSession
          ? validatedSession.payment.expiresAt - now
          : undefined,
        sendStarted: validatedSession?.sendStarted,
        hasPaymentProgress,
        sessionMode:
          validatedSession?.sendStarted || hasPaymentProgress
            ? 'tracking'
            : 'quote',
      });
    }
    if (validatedSession) {
      return validatedSession;
    }
    if (session) {
      await this.setRawData((latestRawData) => {
        const latestSession =
          latestRawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
        if (
          latestSession?.payment?.paymentId !== session.payment?.paymentId ||
          latestSession?.updatedAt !== session.updatedAt
        ) {
          return latestRawData ?? {};
        }
        const nextSessions = {
          ...latestRawData?.infiniPendingPaymentSessionByUserId,
        };
        delete nextSessions[onekeyUserId];
        const nextRawData: ISimpleDBPrime = {
          ...latestRawData,
          infiniPendingPaymentSessionByUserId: nextSessions,
        };
        const paymentCacheKey = getInfiniPaymentCacheKey(latestSession);
        return paymentCacheKey
          ? retireInfiniPaymentCache({
              rawData: nextRawData,
              onekeyUserId,
              paymentCacheKey,
              now: Date.now(),
            })
          : nextRawData;
      });
    }
    return undefined;
  }

  @backgroundMethod()
  async recordInfiniPaymentValidation({
    onekeyUserId,
    payment,
    flowId,
  }: {
    onekeyUserId: string;
    payment: IPrimeInfiniPayment;
    flowId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const current =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      const now = Date.now();
      if (
        !current ||
        !isValidInfiniPendingPaymentSession(current, { onekeyUserId, now }) ||
        !isSamePrimeInfiniPaymentTransferSnapshot({
          first: current.payment,
          second: payment,
          networkId: current.asset.networkId,
        }) ||
        !isPrimeInfiniPaymentForAssetSnapshot({ payment, asset: current.asset })
      ) {
        return rawData ?? {};
      }
      return {
        ...rawData,
        infiniPendingPaymentSessionByUserId: {
          ...rawData?.infiniPendingPaymentSessionByUserId,
          [onekeyUserId]: {
            ...current,
            ...getInfiniPaymentSessionLifecycle(current),
            lastValidatedAt: now,
            flowId,
          },
        },
      };
    }).catch(() => {
      this.clearRawDataCache();
      throw createPrimeInfiniPaymentValidationError('localPersistenceFailed');
    });
  }

  @backgroundMethod()
  async setInfiniPendingPaymentSession({
    onekeyUserId,
    session,
  }: {
    onekeyUserId: string;
    session: IPrimeInfiniPendingPaymentSessionInput;
  }): Promise<IPrimeInfiniPendingPaymentSession> {
    if (!onekeyUserId || session.baseline.onekeyUserId !== onekeyUserId) {
      throw new OneKeyLocalError({
        message: 'Invalid OneKey ID for Infini payment session',
        autoToast: false,
      });
    }
    let persistedSession: IPrimeInfiniPendingPaymentSession | undefined;
    await this.setRawData((rawData) => {
      const now = Date.now();
      const isRetiredPayment = getActiveInfiniPaymentCacheTombstones({
        rawData,
        onekeyUserId,
        now,
      }).some((tombstone) =>
        isSamePrimeInfiniPaymentCacheKey(tombstone, session.paymentCacheKey),
      );
      if (isRetiredPayment) {
        throw new OneKeyLocalError({
          message: 'Infini payment cache is retired',
          autoToast: false,
        });
      }
      const currentSession =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      const isCurrentSessionValid = isValidInfiniPendingPaymentSession(
        currentSession,
        { onekeyUserId, now },
      );
      if (
        isCurrentSessionValid &&
        currentSession &&
        currentSession.payment.paymentId !== session.payment.paymentId
      ) {
        throw new OneKeyLocalError({
          message: 'Another Infini payment session is already active',
          autoToast: false,
        });
      }
      if (
        isCurrentSessionValid &&
        currentSession &&
        !isSamePrimeInfiniPaymentAssetIdentity(
          currentSession.asset,
          session.asset,
        )
      ) {
        throw new OneKeyLocalError({
          message: 'Infini payment asset identity changed',
          data: { paymentValidationFailure: 'assetMismatch' },
          autoToast: false,
        });
      }
      if (
        isCurrentSessionValid &&
        currentSession &&
        !isSamePrimeInfiniPaymentCacheKey(
          currentSession.paymentCacheKey,
          session.paymentCacheKey,
        )
      ) {
        throw new OneKeyLocalError({
          message: 'Infini payment cache identity changed',
          autoToast: false,
        });
      }
      if (
        isCurrentSessionValid &&
        currentSession &&
        !isSamePrimeInfiniPaymentTransferSnapshot({
          first: currentSession.payment,
          second: session.payment,
          networkId: currentSession.asset.networkId,
        })
      ) {
        throw new OneKeyLocalError({
          message: 'Infini payment transfer snapshot changed',
          data: { paymentValidationFailure: 'transferSnapshotChanged' },
          autoToast: false,
        });
      }
      const nextPayment =
        isCurrentSessionValid && currentSession
          ? mergePrimeInfiniPaymentProgressSnapshot({
              previous: currentSession.payment,
              latest: session.payment,
            })
          : session.payment;
      const nextSession: IPrimeInfiniPendingPaymentSession = {
        ...session,
        schemaVersion: 2,
        ...(currentSession?.payment?.paymentId === session.payment.paymentId
          ? getInfiniPaymentSessionLifecycle(currentSession)
          : {
              createdAt: now,
              localRetentionDeadline:
                now + INFINI_UNSENT_PAYMENT_SESSION_MAX_AGE_MS,
            }),
        lastValidatedAt: now,
        flowId:
          currentSession?.payment?.paymentId === session.payment.paymentId
            ? (session.flowId ?? currentSession.flowId)
            : session.flowId,
        payment: nextPayment,
        sendStarted: Boolean(
          session.sendStarted ||
          hasPrimeInfiniPaymentProgressSnapshot(nextPayment) ||
          (isCurrentSessionValid &&
            currentSession &&
            (currentSession.sendStarted ||
              hasPrimeInfiniPaymentProgressSnapshot(currentSession.payment))),
        ),
        updatedAt: now,
      };
      if (
        !isValidInfiniPendingPaymentSession(nextSession, {
          onekeyUserId,
          now: nextSession.updatedAt,
        })
      ) {
        throw new OneKeyLocalError({
          message: 'Invalid Infini payment session',
          autoToast: false,
        });
      }
      persistedSession = nextSession;
      return {
        ...rawData,
        infiniPendingPaymentSessionByUserId: {
          ...rawData?.infiniPendingPaymentSessionByUserId,
          [onekeyUserId]: persistedSession,
        },
      };
    }).catch((error: unknown) => {
      this.clearRawDataCache();
      throw toPrimeInfiniPaymentPersistenceError(error);
    });
    if (!persistedSession) {
      throw new OneKeyLocalError({
        message: 'Infini payment session was not persisted',
        autoToast: false,
      });
    }
    return persistedSession;
  }

  @backgroundMethod()
  async rebindUnsentInfiniPendingPaymentSession({
    onekeyUserId,
    expectedPaymentCacheIdentity,
    latestPayment,
    nextBindingId,
    payerAccountId,
    payerAddress,
  }: {
    onekeyUserId: string;
    expectedPaymentCacheIdentity: IPrimeInfiniPaymentCacheKey;
    latestPayment: IPrimeInfiniPayment;
    nextBindingId: string;
    payerAccountId: string;
    payerAddress: string;
  }): Promise<IPrimeInfiniPendingPaymentSession | undefined> {
    if (
      !onekeyUserId ||
      !isValidInfiniPaymentCacheKey(expectedPaymentCacheIdentity) ||
      !isNonEmptyString(nextBindingId) ||
      !isNonEmptyString(payerAccountId) ||
      !isNonEmptyString(payerAddress)
    ) {
      return undefined;
    }
    let reboundSession: IPrimeInfiniPendingPaymentSession | undefined;
    await this.setRawData((rawData) => {
      const now = Date.now();
      const currentSession =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      if (
        !currentSession ||
        !isValidInfiniPendingPaymentSession(currentSession, {
          onekeyUserId,
          now,
        }) ||
        !isSamePrimeInfiniPaymentCacheKey(
          expectedPaymentCacheIdentity,
          currentSession.paymentCacheKey,
        ) ||
        currentSession.sendStarted ||
        !isSamePrimeInfiniPaymentTransferSnapshot({
          first: currentSession.payment,
          second: latestPayment,
          networkId: currentSession.asset.networkId,
        }) ||
        !isPrimeInfiniPaymentForAssetSnapshot({
          payment: latestPayment,
          asset: currentSession.asset,
        })
      ) {
        return rawData ?? {};
      }
      const paymentWithDurableProgress =
        mergePrimeInfiniPaymentProgressSnapshot({
          previous: currentSession.payment,
          latest: latestPayment,
        });
      if (hasPrimeInfiniPaymentProgressSnapshot(paymentWithDurableProgress)) {
        return rawData ?? {};
      }
      const paymentCacheKey = buildPrimeInfiniPaymentCacheKey({
        bindingId: nextBindingId,
        payment: paymentWithDurableProgress,
        asset: currentSession.asset,
        onekeyUserId,
        plan: currentSession.plan,
        payerAccountId,
        payerAddress,
      });
      const nextSession: IPrimeInfiniPendingPaymentSession = {
        ...currentSession,
        ...getInfiniPaymentSessionLifecycle(currentSession),
        lastValidatedAt: now,
        payerAccountId,
        payerAddress: paymentCacheKey.payerAddress,
        paymentCacheKey,
        payment: paymentWithDurableProgress,
        updatedAt: now,
      };
      if (
        !isValidInfiniPendingPaymentSession(nextSession, {
          onekeyUserId,
          now,
        })
      ) {
        return rawData ?? {};
      }
      reboundSession = nextSession;
      const rawDataWithRetiredBinding = retireInfiniPaymentCache({
        rawData,
        onekeyUserId,
        paymentCacheKey: currentSession.paymentCacheKey,
        now,
      });
      return {
        ...rawDataWithRetiredBinding,
        infiniPendingPaymentSessionByUserId: {
          ...rawDataWithRetiredBinding.infiniPendingPaymentSessionByUserId,
          [onekeyUserId]: nextSession,
        },
      };
    });
    return reboundSession;
  }

  @backgroundMethod()
  async supersedeInfiniPendingPaymentSession({
    onekeyUserId,
    expectedPaymentCacheIdentity,
    latestPayment,
  }: {
    onekeyUserId: string;
    expectedPaymentCacheIdentity: IPrimeInfiniPaymentCacheKey;
    latestPayment: IPrimeInfiniPayment;
  }): Promise<IPrimeInfiniPendingPaymentSession | undefined> {
    if (
      !onekeyUserId ||
      !isValidInfiniPaymentCacheKey(expectedPaymentCacheIdentity)
    ) {
      return undefined;
    }
    let supersededSession: IPrimeInfiniSupersededPaymentSession | undefined;
    await this.setRawData((rawData) => {
      const now = Date.now();
      const existingSupersededSession =
        getActiveInfiniSupersededPaymentSessions({
          rawData,
          onekeyUserId,
          now,
        }).find((session) =>
          isSamePrimeInfiniPaymentCacheKey(
            expectedPaymentCacheIdentity,
            session.paymentCacheKey,
          ),
        );
      const currentSession =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      if (!currentSession && existingSupersededSession) {
        supersededSession = existingSupersededSession;
        return rawData ?? {};
      }
      if (
        !currentSession ||
        !isValidInfiniPendingPaymentSession(currentSession, {
          onekeyUserId,
          now,
        }) ||
        !isSamePrimeInfiniPaymentCacheKey(
          expectedPaymentCacheIdentity,
          currentSession.paymentCacheKey,
        ) ||
        !isSamePrimeInfiniPaymentTransferSnapshot({
          first: currentSession.payment,
          second: latestPayment,
          networkId: currentSession.asset.networkId,
        }) ||
        !isPrimeInfiniPaymentForAssetSnapshot({
          payment: latestPayment,
          asset: currentSession.asset,
        })
      ) {
        return rawData ?? {};
      }
      const paymentWithDurableProgress =
        mergePrimeInfiniPaymentProgressSnapshot({
          previous: currentSession.payment,
          latest: latestPayment,
        });
      const nextSupersededSession: IPrimeInfiniSupersededPaymentSession = {
        ...currentSession,
        payment: paymentWithDurableProgress,
        sendStarted:
          currentSession.sendStarted ||
          hasPrimeInfiniPaymentProgressSnapshot(paymentWithDurableProgress),
        updatedAt: now,
        supersededAt: now,
        supersededReason: 'user-forced-replacement',
      };
      if (
        !isValidInfiniPendingPaymentSession(nextSupersededSession, {
          onekeyUserId,
          now,
        })
      ) {
        return rawData ?? {};
      }
      supersededSession = nextSupersededSession;
      const nextSessions = {
        ...rawData?.infiniPendingPaymentSessionByUserId,
      };
      delete nextSessions[onekeyUserId];
      const rawDataWithRetiredBinding = retireInfiniPaymentCache({
        rawData: {
          ...rawData,
          infiniPendingPaymentSessionByUserId: nextSessions,
        },
        onekeyUserId,
        paymentCacheKey: currentSession.paymentCacheKey,
        now,
      });
      const activeSupersededSessions = getActiveInfiniSupersededPaymentSessions(
        {
          rawData: rawDataWithRetiredBinding,
          onekeyUserId,
          now,
        },
      );
      return {
        ...rawDataWithRetiredBinding,
        infiniSupersededPaymentSessionsByUserId: {
          ...rawDataWithRetiredBinding.infiniSupersededPaymentSessionsByUserId,
          [onekeyUserId]: [
            ...activeSupersededSessions.filter(
              (session) =>
                !isSamePrimeInfiniPaymentCacheKey(
                  currentSession.paymentCacheKey,
                  session.paymentCacheKey,
                ),
            ),
            nextSupersededSession,
          ].slice(-INFINI_SUPERSEDED_PAYMENT_SESSION_LIMIT),
        },
      };
    });
    return supersededSession;
  }

  @backgroundMethod()
  async clearInfiniPendingPaymentSession({
    onekeyUserId,
    expectedPaymentCacheIdentity,
  }: {
    onekeyUserId: string;
    expectedPaymentCacheIdentity?: IPrimeInfiniPaymentCacheKey;
  }): Promise<boolean> {
    if (!onekeyUserId) {
      return false;
    }
    let didClear = false;
    await this.setRawData((rawData) => {
      const currentSession =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      const currentCacheKey = getInfiniPaymentCacheKey(currentSession);
      const cacheKeyToRetire = expectedPaymentCacheIdentity ?? currentCacheKey;
      const currentMatchesExpected =
        !expectedPaymentCacheIdentity ||
        Boolean(
          currentSession &&
          isSamePrimeInfiniPaymentCacheKey(
            expectedPaymentCacheIdentity,
            currentSession.paymentCacheKey,
          ),
        );
      let nextRawData = rawData ?? {};
      if (!currentSession) {
        didClear = true;
      } else if (currentMatchesExpected) {
        const nextSessions = {
          ...rawData?.infiniPendingPaymentSessionByUserId,
        };
        delete nextSessions[onekeyUserId];
        didClear = true;
        nextRawData = {
          ...rawData,
          infiniPendingPaymentSessionByUserId: nextSessions,
        };
      }
      return cacheKeyToRetire && isValidInfiniPaymentCacheKey(cacheKeyToRetire)
        ? retireInfiniPaymentCache({
            rawData: nextRawData,
            onekeyUserId,
            paymentCacheKey: cacheKeyToRetire,
            now: Date.now(),
          })
        : nextRawData;
    });
    return didClear;
  }

  @backgroundMethod()
  async discardUnsentInfiniPendingPaymentSession({
    onekeyUserId,
    expectedPaymentCacheIdentity,
  }: {
    onekeyUserId: string;
    expectedPaymentCacheIdentity: IPrimeInfiniPaymentCacheKey;
  }): Promise<boolean> {
    if (
      !onekeyUserId ||
      !isValidInfiniPaymentCacheKey(expectedPaymentCacheIdentity)
    ) {
      return false;
    }
    let didDiscard = false;
    await this.setRawData((rawData) => {
      const retireExpectedPayment = (nextRawData: ISimpleDBPrime) =>
        retireInfiniPaymentCache({
          rawData: nextRawData,
          onekeyUserId,
          paymentCacheKey: expectedPaymentCacheIdentity,
          now: Date.now(),
        });
      const currentSession =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      if (!currentSession) {
        didDiscard = true;
        return retireExpectedPayment(rawData ?? {});
      }
      if (
        !isSamePrimeInfiniPaymentCacheKey(
          expectedPaymentCacheIdentity,
          currentSession.paymentCacheKey,
        )
      ) {
        return retireExpectedPayment(rawData ?? {});
      }
      if (currentSession.sendStarted) {
        return rawData ?? {};
      }
      const nextSessions = {
        ...rawData?.infiniPendingPaymentSessionByUserId,
      };
      delete nextSessions[onekeyUserId];
      didDiscard = true;
      return retireExpectedPayment({
        ...rawData,
        infiniPendingPaymentSessionByUserId: nextSessions,
      });
    });
    return didDiscard;
  }

  // Releases a session whose invoice the server has closed with nothing
  // collected, including one that already claimed sendStarted. That claim is
  // set before broadcast and is never cleared except on purchase completion, so
  // a transaction that reverted or ran out of gas would otherwise pin the
  // session for its whole TTL and block every purchase channel behind the
  // payment-entry guard. The progress merge runs against the stored session so
  // a transient zero-progress snapshot cannot release a payment that is
  // actually moving, and a tombstone is retired alongside it so a stale writer
  // cannot resurrect the session.
  @backgroundMethod()
  async discardTerminalInfiniPendingPaymentSession({
    onekeyUserId,
    expectedPaymentCacheIdentity,
    expectedUpdatedAt,
    expectedSendStarted,
    latestPayment,
  }: {
    onekeyUserId: string;
    expectedPaymentCacheIdentity: IPrimeInfiniPaymentCacheKey;
    expectedUpdatedAt: number;
    expectedSendStarted: boolean;
    latestPayment: IPrimeInfiniPayment;
  }): Promise<boolean> {
    if (
      !onekeyUserId ||
      !isValidInfiniPaymentCacheKey(expectedPaymentCacheIdentity)
    ) {
      return false;
    }
    let didDiscard = false;
    await this.setRawData((rawData) => {
      const now = Date.now();
      const currentSession =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      if (!currentSession) {
        // Nothing left to release, which is the state the caller asked for.
        // Reporting failure here would make the caller re-persist a session for
        // an invoice the server already closed. Matches the idempotent success
        // of discardUnsentInfiniPendingPaymentSession, tombstone included.
        didDiscard = true;
        return retireInfiniPaymentCache({
          rawData: rawData ?? {},
          onekeyUserId,
          paymentCacheKey: expectedPaymentCacheIdentity,
          now,
        });
      }
      if (
        !isValidInfiniPendingPaymentSession(currentSession, {
          onekeyUserId,
          now,
        }) ||
        !isSamePrimeInfiniPaymentCacheKey(
          expectedPaymentCacheIdentity,
          currentSession.paymentCacheKey,
        ) ||
        currentSession.payment.paymentId !== latestPayment.paymentId ||
        // Matching payment ids are not enough. A response carrying different
        // transfer terms under the same id would have the merge adopt those
        // terms and the delete then release a session whose original transfer
        // can still settle. The progress latch already refuses that, and this
        // deletes rather than marks, so it cannot be the looser of the two.
        !isSamePrimeInfiniPaymentTransferSnapshot({
          first: currentSession.payment,
          second: latestPayment,
          networkId: currentSession.asset.networkId,
        }) ||
        !isPrimeInfiniPaymentForAssetSnapshot({
          payment: latestPayment,
          asset: currentSession.asset,
        }) ||
        // The stored session must still be the exact revision the caller
        // inspected. Another window can claim the same invoice while the
        // terminal snapshot is in flight, and deleting that fresh claim would
        // let the entry gate report no pending payment while the broadcast it
        // already authorized is still on its way.
        currentSession.updatedAt !== expectedUpdatedAt ||
        currentSession.sendStarted !== expectedSendStarted
      ) {
        return rawData ?? {};
      }
      const paymentWithDurableProgress =
        mergePrimeInfiniPaymentProgressSnapshot({
          previous: currentSession.payment,
          latest: latestPayment,
        });
      if (
        !isPrimeInfiniPaymentClosedUnpaidSnapshot(paymentWithDurableProgress)
      ) {
        return rawData ?? {};
      }
      const nextSessions = {
        ...rawData?.infiniPendingPaymentSessionByUserId,
      };
      delete nextSessions[onekeyUserId];
      didDiscard = true;
      return retireInfiniPaymentCache({
        rawData: {
          ...rawData,
          infiniPendingPaymentSessionByUserId: nextSessions,
        },
        onekeyUserId,
        paymentCacheKey: expectedPaymentCacheIdentity,
        now,
      });
    });
    return didDiscard;
  }

  // The payment-entry guard is the first place that observes server-side
  // progress for a session that was never marked locally. Latch that progress
  // durably here: a later snapshot that transiently reports zero progress must
  // not make the session replaceable again and let a second invoice be
  // created. Writes only on new information so the session TTL is not
  // refreshed by every read.
  @backgroundMethod()
  async latchInfiniPendingPaymentSessionProgress({
    onekeyUserId,
    paymentCacheKey,
    latestPayment,
  }: {
    onekeyUserId: string;
    paymentCacheKey: IPrimeInfiniPaymentCacheKey;
    latestPayment: IPrimeInfiniPayment;
  }): Promise<IPrimeInfiniPendingPaymentSession | undefined> {
    if (!onekeyUserId || !isValidInfiniPaymentCacheKey(paymentCacheKey)) {
      return undefined;
    }
    let latchedSession: IPrimeInfiniPendingPaymentSession | undefined;
    await this.setRawData((rawData) => {
      const now = Date.now();
      const currentSession =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      if (
        !currentSession ||
        !isValidInfiniPendingPaymentSession(currentSession, {
          onekeyUserId,
          now,
        }) ||
        !isSamePrimeInfiniPaymentCacheKey(
          paymentCacheKey,
          currentSession.paymentCacheKey,
        ) ||
        !isSamePrimeInfiniPaymentTransferSnapshot({
          first: currentSession.payment,
          second: latestPayment,
          networkId: currentSession.asset.networkId,
        }) ||
        !isPrimeInfiniPaymentForAssetSnapshot({
          payment: latestPayment,
          asset: currentSession.asset,
        })
      ) {
        return rawData ?? {};
      }
      const paymentWithDurableProgress =
        mergePrimeInfiniPaymentProgressSnapshot({
          previous: currentSession.payment,
          latest: latestPayment,
        });
      const sendStarted =
        currentSession.sendStarted ||
        hasPrimeInfiniPaymentProgressSnapshot(paymentWithDurableProgress);
      const hasNewDurableProgress =
        sendStarted !== currentSession.sendStarted ||
        paymentWithDurableProgress.amountConfirmed !==
          currentSession.payment.amountConfirmed ||
        paymentWithDurableProgress.amountConfirming !==
          currentSession.payment.amountConfirming;
      if (!hasNewDurableProgress) {
        latchedSession = currentSession;
        return rawData ?? {};
      }
      latchedSession = {
        ...currentSession,
        ...getInfiniPaymentSessionLifecycle(currentSession),
        lastValidatedAt: now,
        payment: paymentWithDurableProgress,
        sendStarted,
        updatedAt: now,
      };
      return {
        ...rawData,
        infiniPendingPaymentSessionByUserId: {
          ...rawData?.infiniPendingPaymentSessionByUserId,
          [onekeyUserId]: latchedSession,
        },
      };
    });
    return latchedSession;
  }

  @backgroundMethod()
  async markInfiniPendingPaymentSessionSendStarted({
    onekeyUserId,
    paymentCacheKey,
    transferClaim,
    latestPayment,
    purchaseStatusSnapshot,
  }: {
    onekeyUserId: string;
    paymentCacheKey: IPrimeInfiniPaymentCacheKey;
    transferClaim: IPrimeInfiniPaymentTransferClaim;
    latestPayment: IPrimeInfiniPayment;
    purchaseStatusSnapshot: IPrimeInfiniPurchaseStatusSnapshot;
  }): Promise<IPrimeInfiniPendingPaymentSession> {
    let markedSession: IPrimeInfiniPendingPaymentSession | undefined;
    await this.setRawData((rawData) => {
      const now = Date.now();
      const currentSession =
        rawData?.infiniPendingPaymentSessionByUserId?.[onekeyUserId];
      const isCurrentSessionValid = isValidInfiniPendingPaymentSession(
        currentSession,
        { onekeyUserId, now },
      );
      const validationFailure =
        isCurrentSessionValid && currentSession
          ? getPrimeInfiniPaymentValidationFailure({
              payment: latestPayment,
              previousPayment: currentSession.payment,
              asset: currentSession.asset,
              now,
            })
          : undefined;
      const paymentWithDurableProgress =
        isCurrentSessionValid && currentSession
          ? mergePrimeInfiniPaymentProgressSnapshot({
              previous: currentSession.payment,
              latest: latestPayment,
            })
          : latestPayment;
      if (
        !currentSession ||
        !isCurrentSessionValid ||
        !isSamePrimeInfiniPaymentCacheKey(
          paymentCacheKey,
          currentSession.paymentCacheKey,
        ) ||
        purchaseStatusSnapshot.onekeyUserId !== onekeyUserId ||
        isPrimeInfiniPaymentObsoleteBeforeBroadcastSnapshot({
          baseline: currentSession.baseline,
          purchaseStatusSnapshot,
        }) ||
        !isSamePrimeInfiniPaymentTransferSnapshot({
          first: currentSession.payment,
          second: latestPayment,
          networkId: currentSession.asset.networkId,
        }) ||
        !isPrimeInfiniPaymentForAssetSnapshot({
          payment: latestPayment,
          asset: currentSession.asset,
        }) ||
        !isPrimeInfiniPaymentPreBroadcastSnapshotSendable({
          payment: paymentWithDurableProgress,
          paymentCacheKey: currentSession.paymentCacheKey,
          transferClaim,
          now,
        }) ||
        !isPrimeInfiniPaymentTransferClaimForSession({
          session: currentSession,
          transferClaim,
        }) ||
        currentSession.sendStarted
      ) {
        throw new OneKeyLocalError({
          message: 'Infini payment session is unavailable before broadcast',
          data: validationFailure
            ? { paymentValidationFailure: validationFailure }
            : undefined,
          autoToast: false,
        });
      }
      markedSession = {
        ...currentSession,
        ...getInfiniPaymentSessionLifecycle(currentSession),
        lastValidatedAt: now,
        payment: paymentWithDurableProgress,
        sendStarted: true,
        updatedAt: now,
      };
      return {
        ...rawData,
        infiniPendingPaymentSessionByUserId: {
          ...rawData?.infiniPendingPaymentSessionByUserId,
          [onekeyUserId]: markedSession,
        },
      };
    }).catch((error: unknown) => {
      this.clearRawDataCache();
      if (!markedSession) {
        throw error;
      }
      throw toPrimeInfiniPaymentPersistenceError(error);
    });
    if (!markedSession) {
      throw new OneKeyLocalError({
        message: 'Infini payment session was not marked before broadcast',
        autoToast: false,
      });
    }
    return markedSession;
  }

  @backgroundMethod()
  async clearLegacyAuthSession() {
    await clearAuthSessionBySessionSource(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
  }
}
