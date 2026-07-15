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
  // write (login commits, bind switches, legacy self-heal). Destructive
  // cleanups that decide on a pre-await snapshot (keyless session teardown,
  // bg->main invalid-token events) compare it before acting: a source-only
  // recheck cannot distinguish "the same KeylessOAuth login I decided to
  // clear" from "a FRESH KeylessOAuth login committed while I awaited", but
  // the generation can. Clears intentionally do NOT bump: gating only needs
  // to detect commits, and a redundant clear is idempotent.
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
      await this.setAuthSessionSource(
        EPrimeAuthSessionSource.LegacyEmailSupabase,
      );
      return EPrimeAuthSessionSource.LegacyEmailSupabase;
    }
    return undefined;
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
