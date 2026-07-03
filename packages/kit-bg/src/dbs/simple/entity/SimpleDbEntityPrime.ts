import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import {
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import { isRetryableSupabaseAuthError } from '@onekeyhq/shared/src/utils/supabaseAuthErrorUtils';
import {
  getKeylessSupabaseClient,
  getSupabaseClient,
} from '@onekeyhq/shared/src/utils/supabaseClientUtils';
import {
  EPrimeAuthSessionSource,
  type IPrimeAuthSessionSourcePersisted,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type { SupabaseClient } from '@supabase/supabase-js';

const LOCAL_KEYLESS_UPGRADE_BIND_PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface ISimpleDBPrime {
  // Deprecated token copy. Supabase/OAuth session storage is the source of truth.
  authToken?: string;
  authSessionSource?: IPrimeAuthSessionSourcePersisted;
  // Last auto prompt display time. The upgrade bind prompt is throttled per user.
  localKeylessUpgradeBindPromptShownAtByUserId?: Record<string, number>;
}

export class SimpleDbEntityPrime extends SimpleDbEntityBase<ISimpleDBPrime> {
  entityName = 'prime';

  override enableCache = true;

  private async getSupabaseSdkAuthToken(
    client: SupabaseClient,
  ): Promise<string> {
    const session = await client.auth.getSession();
    if (session.error) {
      if (isRetryableSupabaseAuthError(session.error)) {
        throw session.error;
      }
      return '';
    }
    return session.data.session?.access_token || '';
  }

  private async getAuthTokenBySessionSource(
    authSessionSource: EPrimeAuthSessionSource,
  ): Promise<string> {
    if (authSessionSource === EPrimeAuthSessionSource.KeylessOAuth) {
      return this.getSupabaseSdkAuthToken(getKeylessSupabaseClient().client);
    }
    return this.getSupabaseSdkAuthToken(getSupabaseClient().client);
  }

  private async clearSupabaseAuthSessionBySource(
    authSessionSource: EPrimeAuthSessionSource,
  ) {
    const client =
      authSessionSource === EPrimeAuthSessionSource.KeylessOAuth
        ? getKeylessSupabaseClient().client
        : getSupabaseClient().client;
    const sessionKey =
      authSessionSource === EPrimeAuthSessionSource.KeylessOAuth
        ? getKeylessSupabaseAuthSessionKey()
        : getSupabaseAuthSessionKey();
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      // Local storage is cleared below even if the SDK session is already invalid.
    }
    await supabaseStorageInstance.removeItem(sessionKey);
    supabaseStorageInstance.clearCache();
  }

  private normalizeAuthSessionSource(
    authSessionSource: IPrimeAuthSessionSourcePersisted | undefined,
  ): EPrimeAuthSessionSource | undefined {
    if (authSessionSource === 'legacy_supabase') {
      return EPrimeAuthSessionSource.LegacyEmailSupabase;
    }
    return authSessionSource;
  }

  @backgroundMethod()
  async getActiveAuthToken(): Promise<string> {
    const authSessionSource = await this.getEffectiveAuthSessionSource();
    if (authSessionSource) {
      return this.getAuthTokenBySessionSource(authSessionSource);
    }
    // Only the legacy migration fallback (inside the resolver) may recover a
    // source-less session. A standalone Keyless OAuth session must not imply
    // OneKey ID login.
    return '';
  }

  @backgroundMethod()
  async getSupabaseAuthToken(): Promise<string> {
    return this.getAuthTokenBySessionSource(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
  }

  @backgroundMethod()
  async getKeylessSupabaseAuthToken(): Promise<string> {
    return this.getAuthTokenBySessionSource(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
  }

  @backgroundMethod()
  async getAuthSessionSource(): Promise<EPrimeAuthSessionSource | undefined> {
    const rawData = await this.getRawData();
    const authSessionSource = this.normalizeAuthSessionSource(
      rawData?.authSessionSource,
    );
    if (
      rawData?.authSessionSource &&
      authSessionSource &&
      rawData.authSessionSource !== authSessionSource
    ) {
      await this.setRawData({
        ...rawData,
        authSessionSource,
      });
      supabaseStorageInstance.clearCache();
    }
    return authSessionSource;
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
    supabaseStorageInstance.clearCache();
  }

  @backgroundMethod()
  async clearCachedAuthToken() {
    // Clear only the deprecated cached token copy; keep authSessionSource so
    // the active Supabase/OAuth session stays resolvable.
    await this.setRawData((rawData) => ({
      ...rawData,
      authToken: '',
    }));
    supabaseStorageInstance.clearCache();
  }

  @backgroundMethod()
  async clearAuthTokens() {
    await this.setRawData((rawData) => ({
      ...rawData,
      authToken: '',
      authSessionSource: undefined,
    }));
    supabaseStorageInstance.clearCache();
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
    await this.clearSupabaseAuthSessionBySource(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
  }

  @backgroundMethod()
  async clearKeylessAuthSession() {
    await this.clearSupabaseAuthSessionBySource(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
  }

  @backgroundMethod()
  async clearLocalAuthSession() {
    await this.clearAuthTokens();
    await this.clearLegacyAuthSession();
    await this.clearKeylessAuthSession();
    try {
      const sessionKeys = [
        getSupabaseAuthSessionKey(),
        getKeylessSupabaseAuthSessionKey(),
      ];
      await Promise.all(
        sessionKeys.flatMap((sessionKey) => [
          supabaseStorageInstance.removeItem(sessionKey),
          supabaseStorageInstance.removeItem(`${sessionKey}-user`),
          supabaseStorageInstance.removeItem(`${sessionKey}-code-verifier`),
        ]),
      );
    } catch {
      // The fallback clear below handles cached keys seen by this runtime.
    }
    try {
      await supabaseStorageInstance.clear();
    } catch {
      // Cache clearing below keeps the runtime from reusing a stale token.
    }
    supabaseStorageInstance.clearCache();
  }
}
