import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  clearAllSupabaseAuthSessions,
  clearAuthSessionBySessionSource,
  clearSupabaseStorageCache,
  getAuthTokenBySessionSource,
} from '../../../services/ServicePrime/primeAuthSessionAccess';
import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

const LOCAL_KEYLESS_UPGRADE_BIND_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface ISimpleDBPrime {
  // Deprecated token copy. Supabase/OAuth session storage is the source of truth.
  authToken?: string;
  authSessionSource?: EPrimeAuthSessionSource;
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
  // Per-user throttle timestamp for the local-keyless upgrade bind prompt.
  // Written by ServicePrime.checkAndMarkShouldShowLocalKeylessUpgradeBindPrompt
  // for every completed check outcome (dialog about to show, bind not
  // required, or no local keyless wallet) — not only when the dialog is
  // actually displayed — so the expensive check pipeline runs at most once
  // per throttle window.
  localKeylessUpgradeBindPromptShownAtByUserId?: Record<string, number>;
}

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
  private async persistMigratedLegacyAuthSessionSourceIfUnset(): Promise<EPrimeAuthSessionSource> {
    const persisted = await this.setRawData((rawData) => {
      if (rawData?.authSessionSource) {
        return rawData;
      }
      return {
        ...rawData,
        authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
      };
    });
    clearSupabaseStorageCache();
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
  async setAuthSessionSource(authSessionSource: EPrimeAuthSessionSource) {
    await this.setRawData((rawData) => ({
      ...rawData,
      authSessionSource,
      // Every source commit advances the generation so pre-await snapshots
      // held by in-flight destructive cleanups become detectably stale.
      authStateGeneration: (rawData?.authStateGeneration ?? 0) + 1,
    }));
    clearSupabaseStorageCache();
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

  @backgroundMethod()
  async clearAuthTokens() {
    await this.setRawData((rawData) => ({
      ...rawData,
      authToken: '',
      authSessionSource: undefined,
    }));
    clearSupabaseStorageCache();
  }

  @backgroundMethod()
  async hasShownLocalKeylessUpgradeBindPrompt({
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
    const elapsed = Date.now() - shownAt;
    // A future shownAt (device clock was ahead, then corrected) yields a
    // negative elapsed; treat it as not throttled instead of extending the
    // throttle past the future timestamp.
    if (elapsed < 0) {
      return false;
    }
    return elapsed < LOCAL_KEYLESS_UPGRADE_BIND_PROMPT_INTERVAL_MS;
  }

  @backgroundMethod()
  async markLocalKeylessUpgradeBindPromptShown({
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

  @backgroundMethod()
  async clearLegacyAuthSession() {
    await clearAuthSessionBySessionSource(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
  }

  @backgroundMethod()
  async clearKeylessAuthSession() {
    await clearAuthSessionBySessionSource(EPrimeAuthSessionSource.KeylessOAuth);
  }

  @backgroundMethod()
  async clearLocalAuthSession() {
    await this.clearAuthTokens();
    await clearAllSupabaseAuthSessions();
  }
}
