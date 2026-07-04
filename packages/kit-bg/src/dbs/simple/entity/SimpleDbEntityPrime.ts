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
  // Last auto prompt display time. The upgrade bind prompt is throttled per user.
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

  @backgroundMethod()
  async setAuthSessionSource(authSessionSource: EPrimeAuthSessionSource) {
    await this.setRawData((rawData) => ({
      ...rawData,
      authSessionSource,
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
