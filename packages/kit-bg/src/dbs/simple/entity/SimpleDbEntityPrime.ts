import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  clearAuthSessionBySessionSource,
  clearSupabaseStorageCache,
  getAuthTokenBySessionSource,
} from '../../../services/ServicePrime/primeAuthSessionAccess';
import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

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
    switchOAuthProvider?: EOAuthSocialLoginProvider;
    allowUnknownKeylessSessionIdentity?: boolean;
  };
  oneKeyId?: {
    onekeyUserId: string;
    source: EPrimeAuthSessionSource;
    sessionCommitId: string;
    sessionTokenSub?: string;
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
    return rawData.identityLifecycleRevision ?? 0;
  }

  async getKeylessOAuthSessionPersistenceJournal(): Promise<
    IKeylessOAuthSessionPersistenceJournal | undefined
  > {
    const rawData = await this.getRawData();
    return rawData?.keylessOAuthSessionPersistenceJournal;
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
  async markOneKeyIdOAuthBindPromptShown({
    onekeyUserId,
  }: {
    onekeyUserId: string;
  }) {
    if (!onekeyUserId) {
      return;
    }
    await this.setRawData((rawData) => ({
      ...rawData,
      localKeylessUpgradeBindPromptShownAtByUserId: {
        ...rawData?.localKeylessUpgradeBindPromptShownAtByUserId,
        [onekeyUserId]: Date.now(),
      },
    }));
  }

  async clearLegacyAuthSession() {
    await clearAuthSessionBySessionSource(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
  }
}
