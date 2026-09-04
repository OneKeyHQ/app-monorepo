import { Semaphore } from 'async-mutex';
import { isEqual } from 'lodash';

import {
  decryptRevealableSeed,
  decryptStringAsync,
  generateMnemonic,
  revealEntropyToMnemonic,
} from '@onekeyhq/core/src/secret';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { EAppCryptoAesEncryptionMode } from '@onekeyhq/shared/src/appCrypto/consts';
import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EOAuthSocialLoginProvider,
  KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_KEY,
  KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX,
  KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX_V2,
  KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD,
  KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD_V2_PREFIX,
  KEYLESS_BACKEND_SHARE_PAYLOAD_OWNER_V2_PASSWORD_FIXED_UUID,
  KEYLESS_BACKEND_SHARE_PAYLOAD_OWNER_V2_PASSWORD_PREFIX,
  KEYLESS_ENCRYPTION_ITERATIONS,
  KEYLESS_MNEMONIC_GCM_AAD,
  KEYLESS_SUPABASE_PROJECT_URL,
  KEYLESS_SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import {
  IncorrectPinError,
  KeylessDataCorruptedError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  IKeylessBackendShare,
  IKeylessCreateWithOneKeyIdPrepareResult,
  IKeylessJuiceboxShare,
  IKeylessOAuthAccessTokenRefreshResult,
  ILocalKeylessWalletOAuthInspection,
  IOneKeyIdLoginWithLocalKeylessPrepareResult,
  ISupabaseJWTPayload,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import {
  EKeylessCreateWithOneKeyIdPrepareStatus,
  EKeylessOAuthAccessTokenRefreshStatus,
  ELocalKeylessWalletOAuthState,
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import keylessWalletUtils from '@onekeyhq/shared/src/keylessWallet/keylessWalletUtils';
import shamirUtils from '@onekeyhq/shared/src/keylessWallet/shamirUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IKeylessRealmOperation,
  IKeylessRealmTokenDiagnosticContext,
} from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/keyless';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingV2OneKeyIDLoginMode } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import { getSanitizedErrorLogText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { isRetryableSupabaseAuthError } from '@onekeyhq/shared/src/utils/supabaseAuthErrorUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import localDb from '../../dbs/local/localDb';
import {
  keylessBackendShareV2MigrationPersistAtom,
  keylessPinConfirmStatusAtom,
} from '../../states/jotai/atoms';
import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import {
  EAppCryptoSharedEncryptScene,
  encryptStringAsyncWithFormat,
} from '../../utils/secretEncryptFormat';
import { getMalformedKeylessWalletDataError } from '../ServiceAccount/keylessWalletRemovalCapability';
import ServiceBase from '../ServiceBase';
import { getSupabaseClientBySessionSource } from '../ServicePrime/primeAuthSessionAccess';

import { KeylessPassiveMigrationNetworkError } from './keylessPassiveMigrationErrors';
import { buildKeylessLocalEncryptionKeyWithPassword } from './utils/keylessLocalEncryptionKey';
import keylessMnemonicPasswordStorage from './utils/keylessMnemonicPasswordStorage';
import keylessStorageUtils from './utils/keylessStorageUtils';

import type { JuiceboxClient } from './utils/JuiceboxClient';
import type {
  IDBWallet,
  IKeylessWalletDetailsInfo,
} from '../../dbs/local/types';

function loadKeylessOAuthAccessTokenUtils() {
  return import('./utils/keylessOAuthAccessToken');
}

function logMaskedKeylessError(stage: string, error: unknown) {
  defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
    reason: `${stage}: ${getSanitizedErrorLogText(error)}`,
  });
}

const juiceboxClientDiagnosticContextCache = new Map<
  string,
  IKeylessRealmTokenDiagnosticContext
>();

const juiceboxClientCache = new cacheUtils.LRUCache<string, JuiceboxClient>({
  max: 100,
  ttl: timerUtils.getTimeDurationMs({ minute: 8 }),
  // Expired entries are purged by cache access while the operation mutex is
  // held. A background timer must not dispose an in-flight SDK client.
  ttlAutopurge: false,
  dispose: (client, token, reason) => {
    const diagnosticContext = juiceboxClientDiagnosticContextCache.get(token);
    if (diagnosticContext) {
      defaultLogger.wallet.keyless.juiceboxClientCacheDisposed({
        ...diagnosticContext,
        reason,
      });
      juiceboxClientDiagnosticContextCache.delete(token);
    }
    // Best-effort cleanup: clear any cached realm tokens when the client is evicted.
    try {
      client.dispose();
    } catch {
      // ignore
    }
  },
});

// The realm-token endpoint consumes each Supabase access token once. Keep a
// process-local tombstone beyond the Juicebox client lifetime so clearing or
// evicting a client can never make the same access token look reusable.
type IRealmAccessTokenExchangeTombstone = 'confirmed' | 'presumed';

const KEYLESS_BACKEND_SHARE_PASSIVE_MIGRATION_INTERVAL_MS =
  timerUtils.getTimeDurationMs({ hour: 24 });

type IKeylessBackendShareCanonicalFormat = 'v1' | 'v2';

type IKeylessBackendShareMeta = {
  backendShare: string;
  hashId: string;
  revision: number;
  canonicalFormat: IKeylessBackendShareCanonicalFormat;
};

type IKeylessBackendShareReadResult = IKeylessBackendShareMeta & {
  backendShareData: IKeylessBackendShare | null;
  ownerId?: string;
  ownerProvider?: EOAuthSocialLoginProvider;
};

type IKeylessBackendShareOwnerIdCandidate = {
  ownerId: string;
  provider: EOAuthSocialLoginProvider;
};

type IKeylessBackendShareV2MigrationResult = {
  migrated: boolean;
  checked: boolean;
  skipped: boolean;
  reason?:
    | 'already_succeeded'
    | 'backend_share_missing'
    | 'canonical_format_v2'
    | 'local_keyless_wallet_missing'
    | 'mnemonic_mismatch'
    | 'mnemonic_password_missing'
    | 'network_unavailable'
    | 'owner_id_missing'
    | 'owner_id_mismatch'
    | 'password_not_cached'
    | 'passive_throttled'
    | 'provider_missing'
    | 'token_identity_mismatch'
    | 'token_missing'
    | 'token_provider_mismatch'
    | 'upgrade_failed';
};

type IKeylessBackendShareV2MigrationSource = 'restore' | 'resetPin';

type IKeylessAccessTokenWithoutPromptResult = {
  accessToken: string;
  refreshToken?: string;
};

type IKeylessCredentialReadyForOneKeyIdBindResult =
  | { status: 'noLocalKeyless'; hasLocalKeylessWallet: false }
  | { status: 'ready'; hasLocalKeylessWallet: true }
  | { status: 'requiresPasscode'; hasLocalKeylessWallet: true }
  | {
      status: 'retryableIndeterminate';
      hasLocalKeylessWallet: true;
    };

type ILegacyKeylessOAuthMigrationResult =
  | { status: 'migrated'; accessToken: string }
  | { status: 'identityMismatch' }
  | { status: 'unavailable' };

type IContinueOneKeyIdLoginWithLocalKeylessResult =
  | {
      status: 'ready';
      accessToken: string;
      provider: EOAuthSocialLoginProvider;
      walletId: string;
    }
  | {
      status: 'retryable' | 'needOAuthLogin';
      provider: EOAuthSocialLoginProvider;
      walletId: string;
    };

type IKeylessWalletCreatedOnServerInfo = {
  isCreated: boolean;
  baseRevision: number;
};

type IKeylessBackendShareUploadParams = {
  token: string;
  lockId: string;
  hashId: string;
  ownerId: string;
  baseRevision: number;
  encryptedMnemonic: string;
  backendShare: string;
  juiceboxShareX: number;
  keylessBackendShareV1Mirror: string;
};

type IKeylessBackendShareCreationLock = {
  hashId: string;
  lockId: string;
  expiresAt: number;
};

type IKeylessBackendShareCreationLockResponse = {
  hashId?: string;
  lockId?: string;
  expire_time?: number;
  expiresAt?: number;
};

type IKeylessBackendShareV2MigrationIdentity = {
  ownerId: string;
  keylessProvider: string;
  socialUserIdHash: string;
};
@backgroundClass()
class ServiceKeylessWallet extends ServiceBase {
  /**
   * Keyless payload crypto runs outside IndexedDB transaction callbacks. Keep
   * callers outside those callbacks before selecting the async WebCrypto KDF.
   */
  private getKeylessNonDbKdfParams() {
    return getPbkdf2KdfParamsForNonDbTx();
  }

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  updatePinConfirmStatusMutex = new Semaphore(1);

  // Juicebox SDK authentication is process-global: every client instance
  // replaces globalThis.JuiceboxGetAuthToken. Keep client lookup/exchange,
  // provider binding, and the complete SDK operation in one critical section
  // so another identity cannot dispose the active client or replace its token
  // provider while register/recover/rate-limit work is still in flight.
  private juiceboxOperationMutex = new Semaphore(1);

  // Serializes EVERY consumer of the legacy per-owner encrypted keyless
  // OAuth refresh-token blob (pre-OneKey-ID-unification builds). The blob
  // holds a SINGLE-USE rotating GoTrue refresh token, and two concurrent
  // paths consume it without any other coordination:
  //   1. interactive: migrateLegacyKeylessOAuthSessionForLocalWallet
  //   2. passive:     refreshLegacyAccessTokenForKeylessBackendShareV2MigrationPassive
  //      (via tryMigrateLocalExistingKeylessBackendShareToV2, which fires
  //      from ServicePassword.setCachedPassword — i.e. the interactive
  //      path's own successful password prompt triggers the passive path,
  //      so the two race BY CONSTRUCTION).
  // If both POST the refresh grant with the same stored token, the second
  // exchange lands outside GoTrue's short reuse window and revokes the whole
  // token family (including the winner's freshly persisted session → a
  // spurious OneKey ID logout ~1h later), and the loser's
  // definitive-rejection handler can delete a blob the winner just refilled
  // with a valid rotated token. Every read-blob → HTTP exchange →
  // save-rotated-token / delete-blob sequence must therefore run while
  // holding this semaphore — as must every OTHER blob reader/writer:
  // updateKeylessDataPasscode (re-encrypting the blob during a passcode
  // change must not interleave with a decrypt/save using the other
  // passcode) and the cleanup sweeps (cleanupKeylessWalletStorage /
  // cleanupLocalKeylessOAuthTokens — an in-flight exchange must not save a
  // rotated token back after the sweep and resurrect a retired credential).
  legacyKeylessOAuthTokenExchangeMutex = new Semaphore(1);

  private legacyKeylessOAuthIdentityMismatchOwnerIds = new Set<string>();

  private passiveBackendShareV2MigrationPromise:
    | Promise<IKeylessBackendShareV2MigrationResult>
    | undefined;

  private async buildKeylessRealmTokenDiagnosticContext(params: {
    operation: IKeylessRealmOperation;
    token: string;
  }): Promise<IKeylessRealmTokenDiagnosticContext> {
    const { buildKeylessRealmTokenDiagnosticContext } =
      await loadKeylessOAuthAccessTokenUtils();
    return buildKeylessRealmTokenDiagnosticContext(params);
  }

  private async getJuiceboxClientFromCacheInsideOperationLock(
    token: string,
    operation: IKeylessRealmOperation,
  ): Promise<JuiceboxClient> {
    if (platformEnv.isNativeIOSMacCatalyst) {
      throw new OneKeyLocalError(
        'Keyless wallets are unavailable on Mac Catalyst',
      );
    }
    const diagnosticContext =
      await this.buildKeylessRealmTokenDiagnosticContext({
        operation,
        token,
      });
    let client = juiceboxClientCache.get(token);
    defaultLogger.wallet.keyless.juiceboxClientCacheAccess({
      ...diagnosticContext,
      cacheEntryCount: [...juiceboxClientCache.keys()].length,
      cacheHit: !!client,
    });
    if (!client) {
      const exchangeTombstone =
        await this.getRealmAccessTokenExchangeTombstone(token);
      if (exchangeTombstone) {
        throw new OneKeyLocalError(
          exchangeTombstone === 'confirmed'
            ? 'The OAuth access token was already used for a realm-token exchange. Refresh or reauthenticate before retrying.'
            : 'The previous realm-token exchange result is unknown. Refresh or reauthenticate before retrying.',
        );
      }
      // Mark before the request: an ambiguous network failure may still
      // have consumed the access token on the server.
      await this.setRealmAccessTokenExchangeTombstone(token, 'presumed');
      juiceboxClientCache.clear();
      const { JuiceboxClient: JuiceboxClientRuntime } =
        await import('./utils/JuiceboxClient');
      const newClient = new JuiceboxClientRuntime();
      await newClient.exchangeToken(token, diagnosticContext);
      await this.setRealmAccessTokenExchangeTombstone(token, 'confirmed');
      juiceboxClientDiagnosticContextCache.set(token, diagnosticContext);
      juiceboxClientCache.set(token, newClient);
      client = newClient;
    } else {
      juiceboxClientDiagnosticContextCache.set(token, diagnosticContext);
    }
    return client;
  }

  private async runJuiceboxOperation<T>({
    token,
    operation,
    run,
  }: {
    token: string;
    operation: IKeylessRealmOperation;
    run: (client: JuiceboxClient) => Promise<T>;
  }): Promise<T> {
    return this.juiceboxOperationMutex.runExclusive(async () => {
      const client = await this.getJuiceboxClientFromCacheInsideOperationLock(
        token,
        operation,
      );
      client.setAsGlobalAuthTokenProvider();
      return run(client);
    });
  }

  private async runCachedJuiceboxOperation<T>({
    token,
    run,
  }: {
    token: string;
    run: (client: JuiceboxClient) => Promise<T>;
  }): Promise<T | null> {
    return this.juiceboxOperationMutex.runExclusive(async () => {
      const client = juiceboxClientCache.get(token);
      if (!client) {
        return null;
      }
      client.setAsGlobalAuthTokenProvider();
      return run(client);
    });
  }

  private async getRealmAccessTokenExchangeTombstone(
    token: string,
  ): Promise<IRealmAccessTokenExchangeTombstone | undefined> {
    const { getRealmAccessTokenExchangeTombstone } =
      await loadKeylessOAuthAccessTokenUtils();
    return getRealmAccessTokenExchangeTombstone(token);
  }

  private async setRealmAccessTokenExchangeTombstone(
    token: string,
    tombstone: IRealmAccessTokenExchangeTombstone,
  ): Promise<void> {
    const { setRealmAccessTokenExchangeTombstone } =
      await loadKeylessOAuthAccessTokenUtils();
    return setRealmAccessTokenExchangeTombstone(token, tombstone);
  }

  /**
   * Recover missing share using mnemonicPassword (base64) as the secret.
   * This is used for Reset PIN flow where we have:
   * - mnemonicPassword (stored locally)
   * - backendShare (from server)
   * And we need to recover juiceboxShare to upload with new PIN.
   */
  @backgroundMethod()
  async recoverMissingShareFromSecret(params: {
    secretBase64: string; // mnemonicPassword
    shareBase64: string; // backendShare
    missingX: number; // x-coordinate of juiceboxShare
  }): Promise<string> {
    const { secretBase64, shareBase64, missingX } = params;
    return shamirUtils.recoverMissingShareFromSecret({
      secretBase64,
      shareBase64,
      missingX,
    });
  }

  private async decryptKeylessMnemonic(params: {
    encryptedMnemonic: string;
    mnemonicPassword: string;
  }): Promise<string> {
    const { encryptedMnemonic, mnemonicPassword } = params;
    return decryptStringAsync({
      data: encryptedMnemonic,
      dataEncoding: 'hex',
      resultEncoding: 'utf-8',
      password: mnemonicPassword,
      allowRawPassword: true,
      iterations: KEYLESS_ENCRYPTION_ITERATIONS,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: KEYLESS_MNEMONIC_GCM_AAD,
      ...this.getKeylessNonDbKdfParams(),
    });
  }

  /**
   * Encrypt keyless wallet mnemonic using mnemonicPassword.
   * Uses consistent encryption parameters: GCM mode, 600k iterations, KEYLESS_MNEMONIC_GCM_AAD.
   */
  private async encryptKeylessMnemonic(params: {
    mnemonic: string;
    mnemonicPassword: string;
  }): Promise<string> {
    const { mnemonic, mnemonicPassword } = params;
    return encryptStringAsyncWithFormat({
      data: mnemonic,
      dataEncoding: 'utf-8',
      password: mnemonicPassword,
      allowRawPassword: true,
      iterations: KEYLESS_ENCRYPTION_ITERATIONS,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: KEYLESS_MNEMONIC_GCM_AAD,
      sharedScene: EAppCryptoSharedEncryptScene.keylessMnemonic,
      ...this.getKeylessNonDbKdfParams(),
    });
  }

  private buildKeylessSocialUserIdFromToken(params: { token: string }): string {
    const { token } = params;
    const decodedToken = stringUtils.decodeJWT(token) as ISupabaseJWTPayload;
    const socialUserId = decodedToken?.user_metadata?.sub || '';
    if (socialUserId) {
      return socialUserId;
    }
    throw new OneKeyLocalError('Social user ID not found');
  }

  async buildKeylessOwnerIdFromSocialToken(params: {
    token: string;
    hashId: string; // return from server
    providerOverride?: EOAuthSocialLoginProvider;
  }): Promise<string> {
    const { token, hashId, providerOverride } = params;
    const socialUserId = this.buildKeylessSocialUserIdFromToken({ token });
    const provider =
      providerOverride ?? this.buildKeylessProviderFromSocialToken({ token });
    const devSettings = await devSettingsPersistAtom.get();
    const isTestEndpointEnabled = Boolean(
      devSettings.enabled && devSettings.settings?.enableTestEndpoint,
    );
    // Append a discriminator to isolate test endpoint users from production users.
    // Keep the legacy raw format when the switch is off to avoid changing prod ownerId.
    // IMPORTANT: Do not change these discriminator strings after release,
    // otherwise existing users' ownerId will change and break keyless flows.
    const raw = [
      provider,
      socialUserId,
      isTestEndpointEnabled ? 'test_endpoint' : 'prod_endpoint',
      hashId,
      'ADD725FB-9FF5-490E-A458-6EBD4053FAE2',
    ].join('--');

    const hashBytes = await appCrypto.hash.sha256(
      bufferUtils.toBuffer(raw, 'utf-8'),
    );
    return bufferUtils.bytesToHex(hashBytes);
  }

  /**
   * Reads the sticky provider used by legacy clients when generating ownerId.
   * Do not use this as the current OAuth provider; use user_metadata.iss via
   * buildKeylessProviderFromSocialToken instead.
   */
  private getLegacyStickyProviderFromAppMetadata(params: {
    token: string;
  }): EOAuthSocialLoginProvider | undefined {
    const { token } = params;
    const decodedToken = stringUtils.decodeJWT(token) as ISupabaseJWTPayload;
    const provider = decodedToken?.app_metadata
      ?.provider as EOAuthSocialLoginProvider;
    if (
      provider === EOAuthSocialLoginProvider.Google ||
      provider === EOAuthSocialLoginProvider.Apple
    ) {
      return provider;
    }
    return undefined;
  }

  private getAlternativeKeylessProvider(
    provider: EOAuthSocialLoginProvider,
  ): EOAuthSocialLoginProvider {
    return provider === EOAuthSocialLoginProvider.Google
      ? EOAuthSocialLoginProvider.Apple
      : EOAuthSocialLoginProvider.Google;
  }

  buildKeylessProviderFromSocialToken(params: {
    token: string;
    skipFixedProvider?: boolean;
  }): EOAuthSocialLoginProvider {
    const { token, skipFixedProvider } = params;
    const decodedToken = stringUtils.decodeJWT(token) as ISupabaseJWTPayload;
    const socialUserId = this.buildKeylessSocialUserIdFromToken({ token });
    if (
      socialUserId &&
      this.fixedKeylessProviderMap[socialUserId] &&
      !skipFixedProvider
    ) {
      return this.fixedKeylessProviderMap[socialUserId];
    }

    /*
    export enum Issuer {
      GOOGLE = 'https://accounts.google.com',
      APPLE = 'https://appleid.apple.com',
    } 
    */
    // "user_metadata": {
    //    "iss": "https://accounts.google.com",
    //    "iss": "https://appleid.apple.com",
    const issuer = decodedToken?.user_metadata?.iss || '';
    if (issuer === 'https://accounts.google.com') {
      return EOAuthSocialLoginProvider.Google;
    }
    if (issuer === 'https://appleid.apple.com') {
      return EOAuthSocialLoginProvider.Apple;
    }

    throw new OneKeyLocalError(`Unsupported OAuth provider: ${issuer}`);
  }

  @backgroundMethod()
  @toastIfError()
  async apiGetKeylessSameEmailAccountStatus(params: {
    token: string;
  }): Promise<{
    isSameEmailAccountAtOldVersion: boolean;
    currentProvider: EOAuthSocialLoginProvider;
    retryProvider?: EOAuthSocialLoginProvider;
  }> {
    const { token } = params;
    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<{
        hasWrongProviders: boolean;
      }>
    >('/prime/v1/keyless-wallet/hasWrongProviders', {
      token,
    });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    if (!isSuccess) {
      throw new OneKeyLocalError(
        'Failed to get keyless same email account status',
      );
    }

    const wrongProvidersData = res?.data?.data;
    const isSameEmailAccountAtOldVersion =
      wrongProvidersData?.hasWrongProviders ?? false;

    const actualProvider = this.buildKeylessProviderFromSocialToken({
      token,
      skipFixedProvider: true,
    });
    const initProvider = this.getLegacyStickyProviderFromAppMetadata({ token });

    let currentProvider = actualProvider;

    if (
      initProvider &&
      actualProvider !== initProvider &&
      isSameEmailAccountAtOldVersion
    ) {
      currentProvider = initProvider;
    }
    const retryProvider = isSameEmailAccountAtOldVersion
      ? this.getAlternativeKeylessProvider(currentProvider)
      : undefined;

    return {
      isSameEmailAccountAtOldVersion,
      currentProvider,
      retryProvider,
    };
  }

  private isKeylessBackendShareCanonicalFormat(
    format: unknown,
  ): format is IKeylessBackendShareCanonicalFormat {
    return format === 'v1' || format === 'v2';
  }

  private assertKeylessBackendSharePayload(
    payload: unknown,
  ): IKeylessBackendShare {
    const data = payload as Partial<IKeylessBackendShare> | undefined;
    if (
      data &&
      typeof data.encryptedMnemonic === 'string' &&
      data.encryptedMnemonic.length > 0 &&
      typeof data.backendShare === 'string' &&
      data.backendShare.length > 0 &&
      typeof data.juiceboxShareX === 'number' &&
      Number.isFinite(data.juiceboxShareX)
    ) {
      return {
        encryptedMnemonic: data.encryptedMnemonic,
        backendShare: data.backendShare,
        juiceboxShareX: data.juiceboxShareX,
      };
    }
    throw new OneKeyLocalError('Invalid keyless backend share payload');
  }

  private getKeylessBackendSharePayloadV2Aad(params: {
    hashId: string;
  }): string {
    const { hashId } = params;
    if (!hashId) {
      throw new OneKeyLocalError('Hash ID not found');
    }
    return `${KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD_V2_PREFIX}:${hashId}`;
  }

  private async buildKeylessBackendShareOwnerIdCandidates(params: {
    token: string;
    hashId: string;
    providerOverride?: EOAuthSocialLoginProvider;
  }): Promise<IKeylessBackendShareOwnerIdCandidate[]> {
    const { token, hashId, providerOverride } = params;
    const primaryProvider =
      providerOverride ?? this.buildKeylessProviderFromSocialToken({ token });
    const candidateProviders = [
      primaryProvider,
      this.getAlternativeKeylessProvider(primaryProvider),
    ];
    const uniqueProviders = Array.from(new Set(candidateProviders));

    return Promise.all(
      uniqueProviders.map(async (provider) => ({
        provider,
        ownerId: await this.buildKeylessOwnerIdFromSocialToken({
          token,
          hashId,
          providerOverride: provider,
        }),
      })),
    );
  }

  private async decryptKeylessBackendSharePayloadV1(params: {
    backendShare: string;
  }): Promise<IKeylessBackendShare> {
    const { backendShare } = params;
    if (
      !backendShare.startsWith(KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX)
    ) {
      throw new OneKeyLocalError(
        'Keyless backend share payload format mismatch',
      );
    }

    const encryptedPayload = backendShare.slice(
      KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX.length,
    );
    const decryptedJson = await decryptStringAsync({
      data: encryptedPayload,
      dataEncoding: 'hex',
      resultEncoding: 'utf-8',
      password: KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_KEY,
      allowRawPassword: true,
      iterations: KEYLESS_ENCRYPTION_ITERATIONS,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD,
      ...this.getKeylessNonDbKdfParams(),
    });

    return this.assertKeylessBackendSharePayload(JSON.parse(decryptedJson));
  }

  private async encryptKeylessBackendSharePayloadV1(params: {
    backendShareData: IKeylessBackendShare;
  }): Promise<string> {
    const { backendShareData } = params;
    const jsonPayload = stringUtils.stableStringify(
      this.assertKeylessBackendSharePayload(backendShareData),
    );
    const encryptedPayload = await encryptStringAsyncWithFormat({
      data: jsonPayload,
      dataEncoding: 'utf-8',
      password: KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_KEY,
      allowRawPassword: true,
      iterations: KEYLESS_ENCRYPTION_ITERATIONS,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD,
      sharedScene: EAppCryptoSharedEncryptScene.keylessBackendSharePayload,
      ...this.getKeylessNonDbKdfParams(),
    });

    return `${KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX}${encryptedPayload}`;
  }

  private buildKeylessBackendSharePayloadV2Password(params: {
    ownerId: string;
  }): string {
    const password = `${KEYLESS_BACKEND_SHARE_PAYLOAD_OWNER_V2_PASSWORD_PREFIX}${params.ownerId}`;
    return `${password}:${KEYLESS_BACKEND_SHARE_PAYLOAD_OWNER_V2_PASSWORD_FIXED_UUID}`;
  }

  private async decryptKeylessBackendSharePayloadV2(params: {
    token: string;
    hashId: string;
    backendShare: string;
    providerOverride?: EOAuthSocialLoginProvider;
  }): Promise<{
    backendShareData: IKeylessBackendShare;
    ownerId: string;
    ownerProvider: EOAuthSocialLoginProvider;
  }> {
    const { token, hashId, backendShare, providerOverride } = params;
    if (
      !backendShare.startsWith(
        KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX_V2,
      )
    ) {
      throw new OneKeyLocalError(
        'Keyless backend share payload format mismatch',
      );
    }

    const encryptedPayload = backendShare.slice(
      KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX_V2.length,
    );
    const candidates = await this.buildKeylessBackendShareOwnerIdCandidates({
      token,
      hashId,
      providerOverride,
    });
    const aad = this.getKeylessBackendSharePayloadV2Aad({ hashId });

    for (const candidate of candidates) {
      try {
        const decryptedJson = await decryptStringAsync({
          data: encryptedPayload,
          dataEncoding: 'hex',
          resultEncoding: 'utf-8',
          password: this.buildKeylessBackendSharePayloadV2Password({
            ownerId: candidate.ownerId,
          }),
          allowRawPassword: true,
          iterations: KEYLESS_ENCRYPTION_ITERATIONS,
          mode: EAppCryptoAesEncryptionMode.gcm,
          aad,
          ...this.getKeylessNonDbKdfParams(),
        });
        return {
          backendShareData: this.assertKeylessBackendSharePayload(
            JSON.parse(decryptedJson),
          ),
          ownerId: candidate.ownerId,
          ownerProvider: candidate.provider,
        };
      } catch {
        // Try the next deterministic ownerId candidate.
      }
    }

    throw new OneKeyLocalError('Failed to decrypt keyless backend share');
  }

  private async encryptKeylessBackendSharePayloadV2(params: {
    hashId: string;
    ownerId: string;
    backendShareData: IKeylessBackendShare;
  }): Promise<string> {
    const { hashId, ownerId, backendShareData } = params;
    const jsonPayload = stringUtils.stableStringify(
      this.assertKeylessBackendSharePayload(backendShareData),
    );
    const encryptedPayload = await encryptStringAsyncWithFormat({
      data: jsonPayload,
      dataEncoding: 'utf-8',
      password: this.buildKeylessBackendSharePayloadV2Password({ ownerId }),
      allowRawPassword: true,
      iterations: KEYLESS_ENCRYPTION_ITERATIONS,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: this.getKeylessBackendSharePayloadV2Aad({ hashId }),
      sharedScene: EAppCryptoSharedEncryptScene.keylessBackendSharePayload,
      ...this.getKeylessNonDbKdfParams(),
    });

    return `${KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX_V2}${encryptedPayload}`;
  }

  private async apiGetKeylessBackendShareMeta(params: {
    token: string;
  }): Promise<IKeylessBackendShareMeta> {
    const { token } = params;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<
        | {
            backendShare: string;
            hashId: string;
            revision: number;
            canonicalFormat: IKeylessBackendShareCanonicalFormat;
          }
        | ''
      >
    >('/prime/v1/keyless-wallet/getKeylessBackendShareV2', {
      token,
    });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    const responseData = res?.data?.data;

    if (isSuccess && responseData === '') {
      return {
        backendShare: '',
        hashId: '',
        revision: 0,
        canonicalFormat: 'v1',
      };
    }

    const responseDataObj =
      responseData && typeof responseData === 'object'
        ? responseData
        : undefined;
    const backendShareStr = responseDataObj?.backendShare;
    const hashId = responseDataObj?.hashId;
    const revision = responseDataObj?.revision ?? 0;
    const canonicalFormat = responseDataObj?.canonicalFormat ?? 'v1';

    // {"code":0,"message":"success","data":""}
    if (isSuccess && backendShareStr === '') {
      return {
        backendShare: '',
        hashId: hashId || '',
        revision,
        canonicalFormat: this.isKeylessBackendShareCanonicalFormat(
          canonicalFormat,
        )
          ? canonicalFormat
          : 'v1',
      };
    }

    if (isSuccess && backendShareStr) {
      if (!hashId) {
        throw new OneKeyLocalError('Hash ID not found');
      }
      if (!this.isKeylessBackendShareCanonicalFormat(canonicalFormat)) {
        throw new OneKeyLocalError(
          'Unsupported keyless backend share canonical format',
        );
      }
      if (typeof revision !== 'number' || !Number.isFinite(revision)) {
        throw new OneKeyLocalError('Invalid keyless backend share revision');
      }
      return {
        backendShare: backendShareStr,
        hashId,
        revision,
        canonicalFormat,
      };
    }
    throw new OneKeyLocalError('Failed to get keyless backend share');
  }

  private async apiGetKeylessBackendShare(params: {
    token: string;
  }): Promise<IKeylessBackendShareReadResult> {
    const { token } = params;
    const meta = await this.apiGetKeylessBackendShareMeta({ token });

    if (meta.backendShare === '') {
      return {
        ...meta,
        backendShareData: null,
      };
    }

    try {
      if (meta.canonicalFormat === 'v1') {
        return {
          ...meta,
          backendShareData: await this.decryptKeylessBackendSharePayloadV1({
            backendShare: meta.backendShare,
          }),
        };
      }

      const result = await this.decryptKeylessBackendSharePayloadV2({
        token,
        hashId: meta.hashId,
        backendShare: meta.backendShare,
      });
      return {
        ...meta,
        backendShareData: result.backendShareData,
        ownerId: result.ownerId,
        ownerProvider: result.ownerProvider,
      };
    } catch (error) {
      logMaskedKeylessError(
        'ServiceKeylessWallet backend-share decryption failed and was replaced with a generic error',
        error,
      );
      throw new OneKeyLocalError('Failed to decrypt keyless backend share');
    }
  }

  private async getKeylessWalletCreatedOnServerInfo(params: {
    token: string;
  }): Promise<IKeylessWalletCreatedOnServerInfo> {
    const { token } = params;
    const backendShareMeta = await this.apiGetKeylessBackendShareMeta({
      token,
    });
    // apiGetKeylessBackendShareMeta already validates revision and throws when
    // it is not a finite number, so no fallback is needed here.
    return {
      isCreated: backendShareMeta.backendShare !== '',
      baseRevision: backendShareMeta.revision,
    };
  }

  private async apiAcquireCreationLock(params: {
    token: string;
  }): Promise<IKeylessBackendShareCreationLock> {
    const { token } = params;
    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<IKeylessBackendShareCreationLockResponse>
    >('/prime/v1/keyless-wallet/acquireCreationLock', {
      token,
    });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    const lockData = res?.data?.data;
    const expiresAt = lockData?.expiresAt ?? lockData?.expire_time;

    if (
      isSuccess &&
      lockData?.hashId &&
      lockData.lockId &&
      typeof expiresAt === 'number' &&
      Number.isFinite(expiresAt)
    ) {
      return {
        hashId: lockData.hashId,
        lockId: lockData.lockId,
        expiresAt,
      };
    }

    throw new OneKeyLocalError('Failed to acquire creation lock');
  }

  private async apiReleaseCreationLock(params: {
    token: string;
    lockId: string;
  }): Promise<void> {
    const { token, lockId } = params;
    const client = await this.getClient(EServiceEndpointEnum.Prime);
    await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/keyless-wallet/releaseCreationLock',
      { token, lockId },
    );
    // Idempotent design: silently succeed if lock doesn't exist or has expired
  }

  private isKeylessBackendShareWriteMessage(params: {
    error: unknown;
    messages: string[];
  }): boolean {
    const { error, messages } = params;
    const plainError = errorUtils.toPlainErrorObject(error);
    const data = plainError?.data as
      | {
          message?: string;
          data?: {
            message?: string;
          };
        }
      | undefined;
    const rawMessage =
      data?.message || data?.data?.message || plainError.message;
    const message = typeof rawMessage === 'string' ? rawMessage : '';
    if (!message) {
      return false;
    }
    // Match exact codes or codes followed by `:` context, e.g.
    // `revision_conflict` and `revision_conflict: actual=5 expected=3`.
    return messages.some(
      (candidate) =>
        message === candidate || message.startsWith(`${candidate}:`),
    );
  }

  private async withKeylessBackendShareWriteLock<T>(
    token: string,
    fn: (lock: {
      lockId: string;
      hashId: string;
      expiresAt: number;
    }) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const lock = await this.apiAcquireCreationLock({ token });
      try {
        return await fn(lock);
      } catch (error) {
        lastError = error;
        const shouldRetry =
          attempt === 0 &&
          this.isKeylessBackendShareWriteMessage({
            error,
            messages: ['lock_invalid'],
          });
        if (!shouldRetry) {
          throw error;
        }
      } finally {
        await this.apiReleaseCreationLock({
          token,
          lockId: lock.lockId,
        }).catch((error) => {
          logMaskedKeylessError(
            'ServiceKeylessWallet creation lock release failed',
            error,
          );
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new OneKeyLocalError('Failed to acquire creation lock');
  }

  @backgroundMethod()
  @toastIfError()
  async apiResetKeylessBackendShare(params: {
    token: string;
  }): Promise<{ ok: boolean }> {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError('Dev settings is not enabled');
    }
    if (!devSettings.settings?.allowDeleteKeylessKey) {
      throw new OneKeyLocalError('Keyless wallet reset is not allowed');
    }
    const { token } = params;
    const client = await this.getClient(EServiceEndpointEnum.Prime);
    // /prime/v1/keyless-wallet/resetKeylessBackendShare
    const res = await client.post<IApiClientResponse<{ ok: undefined }>>(
      '/prime/v1/keyless-wallet/resetKeylessBackendShare',
      {
        token,
      },
    );

    void this.apiGetPinConfirmStatus({ token });

    if (res?.data?.code === 0 && res?.data?.message === 'success') {
      return { ok: true };
    }

    throw new OneKeyLocalError('Failed to reset keyless backend share');
  }

  private async uploadKeylessBackendShare(
    params: IKeylessBackendShareUploadParams,
  ): Promise<IKeylessBackendShare> {
    const {
      token,
      lockId,
      hashId,
      ownerId,
      baseRevision,
      encryptedMnemonic,
      backendShare,
      juiceboxShareX,
      keylessBackendShareV1Mirror,
    } = params;
    const backendShareData: IKeylessBackendShare = {
      encryptedMnemonic,
      backendShare,
      juiceboxShareX,
    };

    const encryptedPayloadWithPrefix =
      await this.encryptKeylessBackendSharePayloadV2({
        hashId,
        ownerId,
        backendShareData,
      });
    const readBackResult = await this.decryptKeylessBackendSharePayloadV2({
      token,
      hashId,
      backendShare: encryptedPayloadWithPrefix,
    });
    if (!isEqual(readBackResult.backendShareData, backendShareData)) {
      throw new OneKeyLocalError(
        'Keyless backend share v2 verification mismatch',
      );
    }
    const mirrorBackendShareData =
      await this.decryptKeylessBackendSharePayloadV1({
        backendShare: keylessBackendShareV1Mirror,
      });
    if (!isEqual(mirrorBackendShareData, backendShareData)) {
      throw new OneKeyLocalError(
        'Keyless backend share v1 mirror verification mismatch',
      );
    }

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<{
        ok: boolean;
        revision: number;
        hashId: string;
      }>
    >('/prime/v1/keyless-wallet/createKeylessBackendShareV2', {
      token,
      lockId,
      baseRevision,
      keylessBackendShareV2: encryptedPayloadWithPrefix,
      keylessBackendShareV1Mirror,
    });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    const uploadData = res?.data?.data;
    if (
      isSuccess &&
      uploadData?.ok === true &&
      uploadData.hashId === hashId &&
      typeof uploadData.revision === 'number' &&
      Number.isFinite(uploadData.revision) &&
      uploadData.revision > baseRevision
    ) {
      return backendShareData;
    }

    throw new OneKeyLocalError('Failed to upload keyless backend share');
  }

  private async migrateKeylessBackendShareToV2(params: {
    token: string;
    ownerId: string;
    expectedBackendShareData?: IKeylessBackendShare;
    expectedHashId?: string;
  }): Promise<void> {
    const { token, ownerId, expectedBackendShareData, expectedHashId } = params;
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.withKeylessBackendShareWriteLock(
          token,
          async ({ lockId }) => {
            const current = await this.apiGetKeylessBackendShare({ token });
            if (!current.backendShareData) {
              if (expectedBackendShareData) {
                throw new OneKeyLocalError(
                  'Keyless backend share changed before migration',
                );
              }
              return;
            }
            if (
              expectedBackendShareData &&
              (!isEqual(current.backendShareData, expectedBackendShareData) ||
                (expectedHashId && current.hashId !== expectedHashId))
            ) {
              throw new OneKeyLocalError(
                'Keyless backend share changed before migration',
              );
            }
            if (
              current.canonicalFormat === 'v2' &&
              current.ownerId === ownerId
            ) {
              return;
            }
            const keylessBackendShareV1Mirror =
              current.canonicalFormat === 'v1'
                ? current.backendShare
                : await this.encryptKeylessBackendSharePayloadV1({
                    backendShareData: current.backendShareData,
                  });
            await this.uploadKeylessBackendShare({
              token,
              lockId,
              hashId: current.hashId,
              ownerId,
              baseRevision: current.revision,
              encryptedMnemonic: current.backendShareData.encryptedMnemonic,
              backendShare: current.backendShareData.backendShare,
              juiceboxShareX: current.backendShareData.juiceboxShareX,
              keylessBackendShareV1Mirror,
            });
          },
        );
        return;
      } catch (error) {
        lastError = error;
        const shouldRetry = this.isKeylessBackendShareWriteMessage({
          error,
          messages: ['revision_conflict', 'unexpected_base_revision'],
        });
        if (!shouldRetry) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new OneKeyLocalError('Failed to migrate keyless backend share to v2');
  }

  private scheduleKeylessBackendShareV2Migration(params: {
    source: IKeylessBackendShareV2MigrationSource;
    token: string;
    ownerId: string;
    expectedBackendShareData?: IKeylessBackendShare;
    expectedHashId?: string;
  }) {
    const { source, token, ownerId, expectedBackendShareData, expectedHashId } =
      params;

    setTimeout(() => {
      void this.migrateKeylessBackendShareToV2({
        token,
        ownerId,
        expectedBackendShareData,
        expectedHashId,
      }).catch(() => {
        if (source === 'restore') {
          defaultLogger.wallet.keyless.restoreKeylessBackendShareV2MigrationFailed();
          return;
        }
        defaultLogger.wallet.keyless.resetKeylessBackendShareV2MigrationFailed();
      });
    }, 0);
  }

  private async doKeylessOAuthTokensRepresentSameIdentity(params: {
    previousAccessToken: string;
    refreshedAccessToken: string;
  }): Promise<boolean> {
    const { doKeylessOAuthTokensRepresentSameIdentity } =
      await loadKeylessOAuthAccessTokenUtils();
    return doKeylessOAuthTokensRepresentSameIdentity(params);
  }

  private async isDefinitiveSupabaseRefreshTokenRejectionError(
    error: unknown,
  ): Promise<boolean> {
    const { isDefinitiveSupabaseRefreshTokenRejectionError } =
      await loadKeylessOAuthAccessTokenUtils();
    return isDefinitiveSupabaseRefreshTokenRejectionError(error);
  }

  private async refreshKeylessOAuthAccessTokenForRealmExchange(params: {
    operation: Extract<
      IKeylessRealmOperation,
      'createOrRestore' | 'resetOrVerifyPin'
    >;
    previousAccessToken: string;
    validateRefreshedAccessToken: (
      refreshedAccessToken: string,
    ) => Promise<boolean>;
  }): Promise<IKeylessOAuthAccessTokenRefreshResult> {
    const { refreshKeylessOAuthAccessTokenForRealmExchange } =
      await loadKeylessOAuthAccessTokenUtils();
    return refreshKeylessOAuthAccessTokenForRealmExchange({
      ...params,
      buildDiagnosticContext: (diagnosticParams) =>
        this.buildKeylessRealmTokenDiagnosticContext(diagnosticParams),
      hasRealmAccessTokenExchangeTombstone: async (token) =>
        Boolean(await this.getRealmAccessTokenExchangeTombstone(token)),
    });
  }

  private async getActiveKeylessOAuthAccessToken(params?: {
    throwOnSessionRefreshError?: boolean;
  }): Promise<string | null> {
    const { getActiveKeylessOAuthAccessToken } =
      await loadKeylessOAuthAccessTokenUtils();
    return getActiveKeylessOAuthAccessToken(params);
  }

  private async getActiveKeylessOAuthAccessTokenMatchingLocalWallet(params?: {
    keylessWallet?: IDBWallet;
  }): Promise<string | null> {
    const token = await this.getActiveKeylessOAuthAccessToken();
    if (!token) {
      return null;
    }
    let keylessWallet = params?.keylessWallet;
    if (!keylessWallet) {
      try {
        keylessWallet =
          await this.backgroundApi.serviceAccount.getKeylessWallet();
      } catch (error) {
        logMaskedKeylessError(
          'ServiceKeylessWallet local Keyless wallet lookup failed while matching OAuth session',
          error,
        );
        return null;
      }
    }
    if (!keylessWallet) {
      return null;
    }
    const mismatchReason =
      await this.validateKeylessAccessTokenMatchesLocalWallet({
        token,
        keylessWallet,
      });
    return mismatchReason ? null : token;
  }

  // Passive V2 migration internal helper — together with its caller below,
  // this is the ONLY non-interactive consumer of the legacy per-owner
  // encrypted OAuth refresh token (pre-OneKey-ID-unification builds). It
  // decrypts the blob with the already-cached password (never an interactive
  // prompt) and exchanges it directly over HTTP, so the refreshed session is
  // used in-memory only and is NEVER written to the global Supabase client.
  // On a successful exchange it persists the rotated refresh token back to
  // the blob BEFORE returning (the exchange consumes the stored single-use
  // token, so the save must not depend on anything the caller does next).
  // Transient failures (fetch throw / 5xx / 408 / 429 / json-parse / any
  // non-OK response without a parseable GoTrue rejection body) become
  // `KeylessPassiveMigrationNetworkError` so the migration loop rolls back
  // the 24h throttle. Only a definitive rejection (e.g. invalid_grant on a
  // revoked / expired refresh token) or a blob that no longer decrypts
  // removes the dead blob and fails the attempt normally (throttle consumed).
  // Decide whether a non-OK GoTrue refresh response DEFINITIVELY rejects the
  // refresh token (only then is it safe to delete the encrypted blob), as
  // opposed to an intermediary error page (corporate proxy / Cloudflare bot
  // challenge / CDN HTML) that must be treated as transient. Older GoTrue
  // returns `{ error, error_description }`, newer versions
  // `{ code, error_code, msg }` — accept the union. An unparseable (non-JSON)
  // body is never a GoTrue verdict. Note: reading the body consumes it.
  private async isDefinitiveGoTrueRefreshTokenRejection(
    response: Response,
  ): Promise<boolean> {
    const { isDefinitiveGoTrueRefreshTokenRejection } =
      await loadKeylessOAuthAccessTokenUtils();
    return isDefinitiveGoTrueRefreshTokenRejection(response);
  }

  private async refreshLegacyAccessTokenForKeylessBackendShareV2MigrationPassive(params: {
    ownerId: string;
    password: string;
  }): Promise<IKeylessAccessTokenWithoutPromptResult | null> {
    const { ownerId, password } = params;
    if (!(await this.hasLegacyKeylessOAuthRefreshToken({ ownerId }))) {
      return null;
    }

    let refreshToken: string | null = null;
    try {
      refreshToken = await this.getLegacyKeylessOAuthRefreshToken({
        ownerId,
        password,
      });
    } catch (error) {
      if (this.isKeylessDataCorruptedError(error)) {
        // The legacy blob can no longer be decrypted (e.g. it was left stale
        // by a passcode change on an old build). It is unrecoverable and
        // would fail again on every retry, so drop it and fail normally.
        await this.removeLegacyKeylessOAuthTokens({ ownerId });
        return null;
      }
      throw error;
    }
    if (!refreshToken) {
      return null;
    }

    const refreshUrl = `${KEYLESS_SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=refresh_token`;
    let response: Response;
    try {
      response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // oxlint-disable-next-line @cspell/spellchecker
          apikey: KEYLESS_SUPABASE_PUBLIC_API_KEY,
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });
    } catch (error) {
      // Fetch threw (offline / DNS / TLS / abort). Surface as a network
      // error so the migration loop does not consume its 24h throttle window.
      throw new KeylessPassiveMigrationNetworkError(error);
    }

    // Transient HTTP failures must NOT consume the 24h throttle:
    //   5xx — auth server unreachable or misbehaving
    //   408 — request timeout
    //   429 — rate limited (Supabase auth limits per IP / per refresh-token)
    if (
      response.status >= 500 ||
      response.status === 408 ||
      response.status === 429
    ) {
      throw new KeylessPassiveMigrationNetworkError();
    }
    if (!response.ok) {
      if (await this.isDefinitiveGoTrueRefreshTokenRejection(response)) {
        // GoTrue definitively rejected the refresh token (revoked / expired /
        // already rotated elsewhere). The blob is dead and would fail on
        // every retry, so drop it and let the attempt fail normally
        // (throttle consumed).
        await this.removeLegacyKeylessOAuthTokens({ ownerId });
        return null;
      }
      // Any other non-OK response (proxy / CDN challenge page, unparseable
      // body) is not a GoTrue verdict on the token — keep the blob and treat
      // it as transient so the 24h throttle is not consumed.
      throw new KeylessPassiveMigrationNetworkError();
    }

    let refreshResult: { access_token?: string; refresh_token?: string };
    try {
      refreshResult = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
    } catch (error) {
      throw new KeylessPassiveMigrationNetworkError(error);
    }

    // The exchange above already consumed the single-use rotating token
    // stored in the blob. Persist the rotated replacement IMMEDIATELY —
    // before returning to the caller and thus before ANY later step
    // (wallet-identity validation, Prime API calls) can fail or the process
    // can be killed. The rotated token is an identity-equivalent replacement
    // of what the blob already held, so this save must never be gated on any
    // later validation verdict: a blob stranded with the consumed token
    // would hit a definitive GoTrue rejection on the next attempt and be
    // deleted, permanently destroying the legacy credential over a
    // non-definitive failure.
    if (refreshResult?.refresh_token) {
      await this.saveLegacyKeylessOAuthRefreshToken({
        ownerId,
        refreshToken: refreshResult.refresh_token,
        password,
      });
    }

    if (!refreshResult?.access_token || !refreshResult?.refresh_token) {
      return null;
    }

    return {
      accessToken: refreshResult.access_token,
      refreshToken: refreshResult.refresh_token,
    };
  }

  // Passive V2 migration uses the same global Keyless OAuth session as
  // OneKey ID. Narrow exception: when the global session yields no matching
  // token (e.g. a pre-OneKey-ID-unification build was upgraded and only the
  // legacy per-owner encrypted refresh token exists), it falls back to that
  // legacy blob via the non-interactive refresh helper above. The legacy
  // token is NOT a general login credential — no other flow may consume it
  // non-interactively, and the refreshed session is never persisted to the
  // global Supabase client from this passive path.
  private async getAccessTokenForKeylessBackendShareV2MigrationPassive(params: {
    keylessWallet: IDBWallet;
    ownerId: string;
    password: string;
  }): Promise<IKeylessAccessTokenWithoutPromptResult | null> {
    const accessToken =
      await this.getActiveKeylessOAuthAccessTokenMatchingLocalWallet({
        keylessWallet: params.keylessWallet,
      });
    if (accessToken) {
      return { accessToken };
    }
    return this.refreshLegacyAccessTokenForKeylessBackendShareV2MigrationPassive(
      {
        ownerId: params.ownerId,
        password: params.password,
      },
    );
  }

  private async setKeylessBackendShareV2MigrationRecord(params: {
    walletId: string;
    identity: IKeylessBackendShareV2MigrationIdentity;
    patch: {
      lastPassiveAttemptAt?: number;
      lastPassiveFailedAt?: number;
      succeededAt?: number;
    };
  }): Promise<void> {
    const { walletId, identity, patch } = params;
    await keylessBackendShareV2MigrationPersistAtom.set((prev) => {
      const prevByWalletId = prev?.byWalletId ?? {};
      return {
        byWalletId: {
          ...prevByWalletId,
          [walletId]: {
            ...prevByWalletId[walletId],
            ...identity,
            ...patch,
          },
        },
      };
    });
  }

  private isKeylessBackendShareV2MigrationRecordMatch(params: {
    record:
      | {
          ownerId?: string;
          keylessProvider?: string;
          socialUserIdHash?: string;
        }
      | undefined;
    identity: IKeylessBackendShareV2MigrationIdentity;
  }): boolean {
    const { record, identity } = params;
    return (
      record?.ownerId === identity.ownerId &&
      record?.keylessProvider === identity.keylessProvider &&
      record?.socialUserIdHash === identity.socialUserIdHash
    );
  }

  // Treat fetch / 5xx / timeout failures from any step of the passive
  // migration (token refresh, Prime API reads, Prime API writes) as a
  // network-class error. Rolling back the throttle here means the next
  // natural trigger retries without waiting 24h, regardless of whether the
  // failure happened in the refresh helper or in a subsequent Prime call.
  private isKeylessPassiveMigrationNetworkLikeError(error: unknown): boolean {
    if (error instanceof KeylessPassiveMigrationNetworkError) {
      return true;
    }
    if (isRetryableSupabaseAuthError(error)) {
      return true;
    }
    // Shared classifier for axios / HTTP-status / connection errors — the
    // main runtime uses the same one (useKeylessWallet), so both runtimes
    // classify a bridged error identically.
    return isTransientNetworkLikeError(error);
  }

  private async restoreKeylessBackendShareV2MigrationRecord(params: {
    walletId: string;
    previousRecord:
      | {
          ownerId?: string;
          keylessProvider?: string;
          socialUserIdHash?: string;
          lastPassiveAttemptAt?: number;
          lastPassiveFailedAt?: number;
          succeededAt?: number;
        }
      | undefined;
  }): Promise<void> {
    const { walletId, previousRecord } = params;
    await keylessBackendShareV2MigrationPersistAtom.set((prev) => {
      const prevByWalletId = prev?.byWalletId ?? {};
      const nextByWalletId = { ...prevByWalletId };
      if (previousRecord) {
        nextByWalletId[walletId] = previousRecord;
      } else {
        delete nextByWalletId[walletId];
      }
      return { byWalletId: nextByWalletId };
    });
  }

  private async markKeylessBackendShareV2PassiveAttempt(params: {
    walletId: string;
    identity: IKeylessBackendShareV2MigrationIdentity;
    time: number;
  }): Promise<void> {
    await this.setKeylessBackendShareV2MigrationRecord({
      walletId: params.walletId,
      identity: params.identity,
      patch: {
        lastPassiveAttemptAt: params.time,
        succeededAt: undefined,
      },
    });
  }

  private async markKeylessBackendShareV2MigrationSucceeded(params: {
    walletId: string;
    identity: IKeylessBackendShareV2MigrationIdentity;
    time: number;
  }): Promise<void> {
    await this.setKeylessBackendShareV2MigrationRecord({
      walletId: params.walletId,
      identity: params.identity,
      patch: {
        succeededAt: params.time,
        lastPassiveAttemptAt: params.time,
        lastPassiveFailedAt: undefined,
      },
    });
  }

  private async markKeylessBackendShareV2MigrationFailed(params: {
    walletId: string;
    identity: IKeylessBackendShareV2MigrationIdentity;
    time: number;
  }): Promise<void> {
    await this.setKeylessBackendShareV2MigrationRecord({
      walletId: params.walletId,
      identity: params.identity,
      patch: {
        lastPassiveAttemptAt: params.time,
        lastPassiveFailedAt: params.time,
        succeededAt: undefined,
      },
    });
  }

  private async getLocalKeylessMnemonic(params: {
    walletId: string;
    password: string;
  }): Promise<string> {
    const { walletId, password } = params;
    const credential = await localDb.getCredentialInner({
      credentialId: walletId,
    });
    const rs = await decryptRevealableSeed({
      rs: credential.credential,
      password,
    });
    return revealEntropyToMnemonic(rs.entropyWithLangPrefixed);
  }

  private async getMnemonicPasswordForLocalKeylessWallet(params: {
    ownerId: string;
    password: string;
  }): Promise<string | null> {
    const { ownerId, password } = params;
    return keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorage({
      ownerId,
      password,
      backgroundApi: this.backgroundApi,
    });
  }

  private async validateKeylessAccessTokenMatchesLocalWallet(params: {
    token: string;
    keylessWallet: IDBWallet;
  }): Promise<IKeylessBackendShareV2MigrationResult['reason'] | undefined> {
    const { token, keylessWallet } = params;
    const keylessDetailsInfo = keylessWallet.keylessDetailsInfo;
    if (!keylessDetailsInfo?.socialUserIdHash) {
      return 'token_identity_mismatch';
    }

    try {
      const socialUserIdHash = await accountUtils.hashKeylessSocialUserId({
        socialUserId: this.buildKeylessSocialUserIdFromToken({ token }),
      });
      if (socialUserIdHash !== keylessDetailsInfo.socialUserIdHash) {
        return 'token_identity_mismatch';
      }

      // Compare the token's issuer-derived provider strictly against the
      // local wallet's stored provider. Same-email both-providers wallets
      // (whose local `keylessProvider` was rewritten by `fixedKeylessProviderMap`
      // to the alternative provider) intentionally fall through to
      // `token_provider_mismatch` here: passive migration must NOT auto-migrate
      // this case. The user must first complete the manual same-email
      // reconciliation flow; the subsequent restore/reset flow then performs
      // the v1 -> v2 migration under user-driven context.
      const tokenProvider = this.buildKeylessProviderFromSocialToken({
        token,
        skipFixedProvider: true,
      });
      if (tokenProvider !== keylessDetailsInfo.keylessProvider) {
        return 'token_provider_mismatch';
      }
      return undefined;
    } catch (error) {
      logMaskedKeylessError(
        'ServiceKeylessWallet access token identity validation failed and was treated as identity mismatch',
        error,
      );
      return 'token_identity_mismatch';
    }
  }

  private async validateKeylessBackendShareMatchesLocalWallet(params: {
    backendShareData: IKeylessBackendShare;
    keylessWallet: IDBWallet;
    ownerId: string;
    password: string;
  }): Promise<IKeylessBackendShareV2MigrationResult['reason'] | undefined> {
    const { backendShareData, keylessWallet, ownerId, password } = params;
    const mnemonicPassword =
      await this.getMnemonicPasswordForLocalKeylessWallet({
        ownerId,
        password,
      });
    if (!mnemonicPassword) {
      return 'mnemonic_password_missing';
    }

    const decryptedMnemonic = await this.decryptKeylessMnemonic({
      encryptedMnemonic: backendShareData.encryptedMnemonic,
      mnemonicPassword,
    });
    const localMnemonic = await this.getLocalKeylessMnemonic({
      walletId: keylessWallet.id,
      password,
    });

    if (decryptedMnemonic !== localMnemonic) {
      return 'mnemonic_mismatch';
    }
    return undefined;
  }

  private async migrateLocalExistingKeylessBackendShareToV2Passive(): Promise<IKeylessBackendShareV2MigrationResult> {
    const keylessWallet =
      await this.backgroundApi.serviceAccount.getKeylessWallet();
    if (!keylessWallet) {
      return {
        migrated: false,
        checked: false,
        skipped: true,
        reason: 'local_keyless_wallet_missing',
      };
    }

    const ownerId = keylessWallet.keylessDetailsInfo?.keylessOwnerId;
    if (!ownerId) {
      return {
        migrated: false,
        checked: false,
        skipped: true,
        reason: 'owner_id_missing',
      };
    }

    const provider = keylessWallet.keylessDetailsInfo?.keylessProvider;
    if (!provider) {
      return {
        migrated: false,
        checked: false,
        skipped: true,
        reason: 'provider_missing',
      };
    }

    const socialUserIdHash = keylessWallet.keylessDetailsInfo?.socialUserIdHash;
    if (!socialUserIdHash) {
      return {
        migrated: false,
        checked: false,
        skipped: true,
        reason: 'token_identity_mismatch',
      };
    }

    const migrationIdentity: IKeylessBackendShareV2MigrationIdentity = {
      ownerId,
      keylessProvider: provider,
      socialUserIdHash,
    };

    const migrationPersist =
      await keylessBackendShareV2MigrationPersistAtom.get();
    const migrationRecord =
      migrationPersist?.byWalletId?.[keylessWallet.id] ?? {};
    const isMigrationRecordMatched =
      this.isKeylessBackendShareV2MigrationRecordMatch({
        record: migrationRecord,
        identity: migrationIdentity,
      });
    if (isMigrationRecordMatched && migrationRecord.succeededAt) {
      return {
        migrated: false,
        checked: false,
        skipped: true,
        reason: 'already_succeeded',
      };
    }

    const now = Date.now();
    if (
      isMigrationRecordMatched &&
      migrationRecord.lastPassiveAttemptAt &&
      now - migrationRecord.lastPassiveAttemptAt <
        KEYLESS_BACKEND_SHARE_PASSIVE_MIGRATION_INTERVAL_MS
    ) {
      return {
        migrated: false,
        checked: false,
        skipped: true,
        reason: 'passive_throttled',
      };
    }

    const password =
      await this.backgroundApi.servicePassword.getCachedPassword();
    if (!password) {
      return {
        migrated: false,
        checked: false,
        skipped: true,
        reason: 'password_not_cached',
      };
    }

    // Capture the previous record so we can roll back the throttle write if
    // the migration fails with a network-class error.
    const previousMigrationRecord = isMigrationRecordMatched
      ? { ...migrationRecord }
      : undefined;

    await this.markKeylessBackendShareV2PassiveAttempt({
      walletId: keylessWallet.id,
      identity: migrationIdentity,
      time: now,
    });

    try {
      // Legacy-blob race guard (fast-yield instead of queueing): when the
      // exchange lock is already held, the interactive OneKey ID login flow
      // is consuming/rotating the legacy refresh-token blob right now — and
      // this passive run was very likely triggered by that flow's own
      // password prompt (promptPasswordVerify → setCachedPassword →
      // tryMigrateLocalExistingKeylessBackendShareToV2). Queueing behind it
      // would re-exchange a single-use token the interactive path is about
      // to rotate or remove, so treat the contention exactly like a
      // transient network failure: the thrown error rolls back the 24h
      // throttle in the catch below WITHOUT touching the blob, and a later
      // natural trigger retries cleanly.
      if (this.legacyKeylessOAuthTokenExchangeMutex.isLocked()) {
        throw new KeylessPassiveMigrationNetworkError();
      }
      // Hold the lock across the WHOLE passive attempt — read-blob → HTTP
      // refresh exchange → in-memory token usage → save-rotated-token — so
      // a concurrent interactive migration can never exchange the same
      // single-use token, nor delete a blob this run is about to refill
      // with the rotated token. The blob-presence check itself runs inside
      // the lock (refreshLegacyAccessTokenForKeylessBackendShareV2MigrationPassive
      // re-checks it and returns null gracefully if the blob is gone).
      return await this.legacyKeylessOAuthTokenExchangeMutex.runExclusive(
        async () => {
          const tokenInfo =
            await this.getAccessTokenForKeylessBackendShareV2MigrationPassive({
              keylessWallet,
              ownerId,
              password,
            });
          if (!tokenInfo) {
            await this.markKeylessBackendShareV2MigrationFailed({
              walletId: keylessWallet.id,
              identity: migrationIdentity,
              time: now,
            });
            return {
              migrated: false,
              checked: false,
              skipped: true,
              reason: 'token_missing',
            };
          }
          const token = tokenInfo.accessToken;

          // NOTE: when the token came from the legacy blob, the refresh
          // helper has ALREADY persisted the rotated refresh token back
          // (immediately after the exchange, inside the same exchange lock).
          // Nothing below — neither this validation nor any Prime API step —
          // may be a precondition for that save: the exchange consumed the
          // single-use stored token, so a save gated on later steps would
          // strand the blob with a consumed token on any non-definitive
          // failure, and the next attempt's definitive GoTrue rejection
          // would delete the credential for good.
          const tokenValidationError =
            await this.validateKeylessAccessTokenMatchesLocalWallet({
              token,
              keylessWallet,
            });
          if (tokenValidationError) {
            await this.markKeylessBackendShareV2MigrationFailed({
              walletId: keylessWallet.id,
              identity: migrationIdentity,
              time: now,
            });
            return {
              migrated: false,
              checked: false,
              skipped: true,
              reason: tokenValidationError,
            };
          }

          const current = await this.apiGetKeylessBackendShareMeta({ token });
          if (!current.backendShare) {
            await this.markKeylessBackendShareV2MigrationFailed({
              walletId: keylessWallet.id,
              identity: migrationIdentity,
              time: now,
            });
            return {
              migrated: false,
              checked: true,
              skipped: true,
              reason: 'backend_share_missing',
            };
          }

          const expectedOwnerId = await this.buildKeylessOwnerIdFromSocialToken(
            {
              token,
              hashId: current.hashId,
              providerOverride: provider,
            },
          );
          if (expectedOwnerId !== ownerId) {
            await this.markKeylessBackendShareV2MigrationFailed({
              walletId: keylessWallet.id,
              identity: migrationIdentity,
              time: now,
            });
            return {
              migrated: false,
              checked: true,
              skipped: true,
              reason: 'owner_id_mismatch',
            };
          }

          if (current.canonicalFormat === 'v2') {
            const readResult = await this.apiGetKeylessBackendShare({ token });
            if (
              !readResult.backendShareData ||
              readResult.ownerId !== ownerId
            ) {
              await this.markKeylessBackendShareV2MigrationFailed({
                walletId: keylessWallet.id,
                identity: migrationIdentity,
                time: now,
              });
              return {
                migrated: false,
                checked: true,
                skipped: true,
                reason: 'owner_id_mismatch',
              };
            }
            const validationError =
              await this.validateKeylessBackendShareMatchesLocalWallet({
                backendShareData: readResult.backendShareData,
                keylessWallet,
                ownerId,
                password,
              });
            if (validationError) {
              await this.markKeylessBackendShareV2MigrationFailed({
                walletId: keylessWallet.id,
                identity: migrationIdentity,
                time: now,
              });
              return {
                migrated: false,
                checked: true,
                skipped: true,
                reason: validationError,
              };
            }

            await this.markKeylessBackendShareV2MigrationSucceeded({
              walletId: keylessWallet.id,
              identity: migrationIdentity,
              time: now,
            });
            return {
              migrated: false,
              checked: true,
              skipped: true,
              reason: 'canonical_format_v2',
            };
          }

          const backendShareData =
            await this.decryptKeylessBackendSharePayloadV1({
              backendShare: current.backendShare,
            });
          const validationError =
            await this.validateKeylessBackendShareMatchesLocalWallet({
              backendShareData,
              keylessWallet,
              ownerId,
              password,
            });
          if (validationError) {
            await this.markKeylessBackendShareV2MigrationFailed({
              walletId: keylessWallet.id,
              identity: migrationIdentity,
              time: now,
            });
            return {
              migrated: false,
              checked: true,
              skipped: true,
              reason: validationError,
            };
          }

          await this.migrateKeylessBackendShareToV2({
            token,
            ownerId,
            expectedHashId: current.hashId,
            expectedBackendShareData: backendShareData,
          });
          await this.markKeylessBackendShareV2MigrationSucceeded({
            walletId: keylessWallet.id,
            identity: migrationIdentity,
            time: now,
          });
          return {
            migrated: true,
            checked: true,
            skipped: false,
          };
        },
      );
    } catch (error) {
      logMaskedKeylessError(
        'ServiceKeylessWallet passive backend-share migration failed and was downgraded to a result status',
        error,
      );
      if (this.isKeylessPassiveMigrationNetworkLikeError(error)) {
        // Roll back the throttle write so the next natural trigger (app
        // launch / password cache) retries without delay once the network
        // recovers. No `lastPassiveFailedAt` is set for network failures.
        // Covers both the refresh-helper path (which throws
        // `KeylessPassiveMigrationNetworkError`) and the cached-token path
        // (where Prime API calls fail with AxiosNetworkError / 5xx /
        // timeout on a flaky connection).
        await this.restoreKeylessBackendShareV2MigrationRecord({
          walletId: keylessWallet.id,
          previousRecord: previousMigrationRecord,
        });
        return {
          migrated: false,
          checked: false,
          skipped: true,
          reason: 'network_unavailable',
        };
      }
      await this.markKeylessBackendShareV2MigrationFailed({
        walletId: keylessWallet.id,
        identity: migrationIdentity,
        time: now,
      });
      return {
        migrated: false,
        checked: true,
        skipped: false,
        reason: 'upgrade_failed',
      };
    }
  }

  @backgroundMethod()
  async tryMigrateLocalExistingKeylessBackendShareToV2(): Promise<IKeylessBackendShareV2MigrationResult> {
    if (this.passiveBackendShareV2MigrationPromise) {
      return this.passiveBackendShareV2MigrationPromise;
    }

    const migrationPromise =
      this.migrateLocalExistingKeylessBackendShareToV2Passive();
    this.passiveBackendShareV2MigrationPromise = migrationPromise;
    try {
      return await migrationPromise;
    } finally {
      if (this.passiveBackendShareV2MigrationPromise === migrationPromise) {
        this.passiveBackendShareV2MigrationPromise = undefined;
      }
    }
  }

  private async apiGetKeylessJuiceboxShare(params: {
    ownerId: string;
    token: string;
    pin: string;
  }): Promise<IKeylessJuiceboxShare> {
    const { ownerId, token, pin } = params;

    if (!token) {
      throw new OneKeyLocalError(
        'GetKeylessJuiceboxShare ERROR: Missing token',
      );
    }

    if (!pin) {
      throw new OneKeyLocalError('GetKeylessJuiceboxShare ERROR: Missing pin');
    }

    if (!ownerId) {
      throw new OneKeyLocalError(
        'GetKeylessJuiceboxShare ERROR: Missing ownerId',
      );
    }

    return this.runJuiceboxOperation({
      token,
      operation: 'recover',
      run: async (juiceboxClient) => {
        try {
          const secret = await juiceboxClient.recover({
            pin,
            // userInfo: `${ownerId}::::hello-world`,
            userInfo: ownerId,
          });

          const parts = secret.split('--');
          const backendShareXStr = parts.pop();
          if (!backendShareXStr) {
            throw new OneKeyLocalError(
              'Failed to get keyless juicebox share: backendShareXStr is empty',
            );
          }
          const backendShareX = parseInt(backendShareXStr || '0', 10);
          const juiceboxShare = parts.join('');
          if (!juiceboxShare) {
            throw new OneKeyLocalError(
              'Failed to get keyless juicebox share: juiceboxShare is empty',
            );
          }
          return {
            ownerId,
            pin,
            juiceboxShare,
            backendShareX,
          };
        } catch (_error) {
          console.error(_error);
          throw _error;
        }
      },
    });
  }

  @backgroundMethod()
  @toastIfError()
  async apiVerifyKeylessJuiceboxPin(params: {
    token: string;
    pin: string;
    mode?: EOnboardingV2OneKeyIDLoginMode;
    dangerousRetryByFixedProvider: boolean;
    providerOverride?: EOAuthSocialLoginProvider;
  }): Promise<{ pinConfirmStatusUpdated: boolean }> {
    const { token, pin, mode, dangerousRetryByFixedProvider } = params;
    let providerOverride = params.providerOverride;
    if (dangerousRetryByFixedProvider) {
      providerOverride = undefined;
    }
    const { hashId } = await this.apiGetKeylessBackendShare({
      token,
    });
    defaultLogger.wallet.keyless.verifyKeylessBackendShareRetrieved();
    const currentSocialProvider = this.buildKeylessProviderFromSocialToken({
      token,
      skipFixedProvider: !!providerOverride,
    });
    let socialProvider: EOAuthSocialLoginProvider =
      providerOverride ?? this.buildKeylessProviderFromSocialToken({ token });
    let ownerId = await this.buildKeylessOwnerIdFromSocialToken({
      token,
      hashId,
      providerOverride: socialProvider,
    });
    const socialUserId: string = this.buildKeylessSocialUserIdFromToken({
      token,
    });
    if (
      !providerOverride &&
      dangerousRetryByFixedProvider &&
      !this.fixedKeylessProviderMap[socialUserId]
    ) {
      const providerOnCreate = this.getLegacyStickyProviderFromAppMetadata({
        token,
      });
      if (providerOnCreate) {
        const alternativeProvider =
          this.getAlternativeKeylessProvider(providerOnCreate);
        if (alternativeProvider !== socialProvider) {
          socialProvider = alternativeProvider;
          ownerId = await this.buildKeylessOwnerIdFromSocialToken({
            token,
            hashId,
            providerOverride: socialProvider,
          });
        }
      }
    }
    defaultLogger.wallet.keyless.verifyKeylessOwnerIdGenerated();

    if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly) {
      const keylessWallet =
        await this.backgroundApi.serviceAccount.getKeylessWallet();

      const walletOwnerId = keylessWallet?.keylessDetailsInfo?.keylessOwnerId;
      if (!walletOwnerId) {
        throw new OneKeyLocalError('Local keyless wallet not found.');
      }
      if (walletOwnerId !== ownerId) {
        throw new OneKeyLocalError(
          'The local keyless wallet does not match the server record. Please check that you are using the correct account.',
        );
      }
      defaultLogger.wallet.keyless.verifyKeylessWalletValidated();
    }

    try {
      await this.apiGetKeylessJuiceboxShare({
        ownerId,
        token,
        pin,
      });
      if (
        providerOverride &&
        socialProvider !== currentSocialProvider &&
        !this.fixedKeylessProviderMap[socialUserId]
      ) {
        this.fixedKeylessProviderMap[socialUserId] = socialProvider;
      }
      if (
        dangerousRetryByFixedProvider &&
        !this.fixedKeylessProviderMap[socialUserId]
      ) {
        this.fixedKeylessProviderMap[socialUserId] = socialProvider;
      }
    } catch (error) {
      const isPinErrorByInstance = error instanceof IncorrectPinError;
      const isPinErrorByClassName = errorUtils.isErrorByClassName({
        error,
        className: EOneKeyErrorClassNames.IncorrectPinError,
      });
      const isPinError = isPinErrorByInstance || isPinErrorByClassName;
      if (
        !providerOverride &&
        isPinError &&
        dangerousRetryByFixedProvider &&
        !this.fixedKeylessProviderMap[socialUserId]
      ) {
        this.fixedKeylessProviderMap[socialUserId] =
          this.getAlternativeKeylessProvider(socialProvider);
        void this.backgroundApi.serviceApp.showDialogLoading({
          title:
            'Provider fixed done, please try again, do not refresh the page or exit the app.',
          showExitButton: true,
        });
        throw new OneKeyLocalError(
          'Provider fixed done, please try again, do not refresh the page or exit the app.',
        );
      }
      throw error;
    }
    defaultLogger.wallet.keyless.verifyKeylessJuiceboxShareRetrieved();

    const pinConfirmStatusUpdated =
      await this.updatePinConfirmStatusAfterSuccessfulPin({ token });
    if (pinConfirmStatusUpdated) {
      defaultLogger.wallet.keyless.verifyKeylessPinConfirmStatusUpdated();
    }
    return { pinConfirmStatusUpdated };
  }

  @backgroundMethod()
  @toastIfError()
  async apiUploadKeylessJuiceboxShare(params: {
    token: string;
    pin: string;
    ownerId: string;
    juiceboxShare: string;
    backendShareX: number;
  }): Promise<IKeylessJuiceboxShare> {
    const { token, pin, ownerId, juiceboxShare, backendShareX } = params;
    // TODO: Replace with real API call
    // exchange juicebox token from onekey auth server
    // upload juicebox share to juicebox network
    // For now, save to mock cache
    const juiceboxShareData: IKeylessJuiceboxShare = {
      ownerId,
      pin,
      juiceboxShare,
      backendShareX,
    };

    await this.runJuiceboxOperation({
      token,
      operation: 'register',
      run: async (juiceboxClient) => {
        try {
          const secret = `${juiceboxShare}--${backendShareX}`;
          await juiceboxClient.register({
            pin,
            secret,
            userInfo: ownerId,
          });
        } catch (e) {
          console.error(e);
          throw e;
        }
      },
    });

    return juiceboxShareData;
  }

  /**
   * Reset PIN for keyless wallet.
   * This method:
   * 1. Gets ownerId from social login token
   * 2. Gets backendShare from server
   * 3. Gets mnemonicPassword from secure storage
   * 4. Recovers juiceboxShare using mnemonicPassword + backendShare
   * 5. Uploads juiceboxShare with new PIN
   */
  @backgroundMethod()
  @toastIfError()
  async resetKeylessWalletPin(params: {
    token: string | undefined;
    newPin: string | undefined;
  }) {
    const { token, newPin } = params;
    if (!token) {
      throw new OneKeyLocalError('social login token is required');
    }
    if (!newPin) {
      throw new OneKeyLocalError('new PIN is required');
    }

    // Get password first to avoid multiple prompts
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();

    // 2. Get backendShare from server
    const backendShareResult = await this.apiGetKeylessBackendShare({ token });
    const { backendShareData, hashId } = backendShareResult;
    if (!backendShareData) {
      throw new OneKeyLocalError('Backend share not found');
    }
    defaultLogger.wallet.keyless.resetKeylessBackendShareRetrieved();

    this.fixedKeylessProviderMap = {};

    // 1. Get ownerId from token
    const socialProvider = this.buildKeylessProviderFromSocialToken({
      token,
      skipFixedProvider: true,
    });
    const targetOwnerId = await this.buildKeylessOwnerIdFromSocialToken({
      token,
      hashId,
      providerOverride: socialProvider,
    });
    defaultLogger.wallet.keyless.resetKeylessOwnerIdGenerated();

    // 3. Get mnemonicPassword from secure storage
    let mnemonicPasswordSourceOwnerId = targetOwnerId;
    let mnemonicPassword =
      await keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorage({
        ownerId: mnemonicPasswordSourceOwnerId,
        password,
        backgroundApi: this.backgroundApi,
      });
    if (!mnemonicPassword) {
      const fallbackProvider =
        this.getAlternativeKeylessProvider(socialProvider);
      mnemonicPasswordSourceOwnerId =
        await this.buildKeylessOwnerIdFromSocialToken({
          token,
          hashId,
          providerOverride: fallbackProvider,
        });
      mnemonicPassword =
        await keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorage({
          ownerId: mnemonicPasswordSourceOwnerId,
          password,
          backgroundApi: this.backgroundApi,
        });
    }
    if (!mnemonicPassword) {
      defaultLogger.wallet.keyless.dataCorruptedError({
        reason:
          'getMnemonicPasswordFromStorage: mnemonicPassword not found in secure storage',
      });
      throw new KeylessDataCorruptedError();
    }
    defaultLogger.wallet.keyless.resetKeylessMnemonicPasswordRetrieved();

    // 3.1. Verify mnemonicPassword can decrypt backendShareData and matches local keyless wallet
    const decryptedMnemonic = await this.decryptKeylessMnemonic({
      encryptedMnemonic: backendShareData.encryptedMnemonic,
      mnemonicPassword,
    });
    if (!decryptedMnemonic) {
      throw new OneKeyLocalError(
        'Mnemonic password does not match backend share data. Please verify your credentials.',
      );
    }
    defaultLogger.wallet.keyless.resetKeylessMnemonicVerified();

    // 3.2. Verify decrypted mnemonic matches local keyless wallet mnemonic
    const keylessWallet =
      await this.backgroundApi.serviceAccount.getKeylessWallet();
    if (!keylessWallet) {
      throw new OneKeyLocalError('Keyless wallet not found.');
    }

    const credential = await localDb.getCredentialInner({
      credentialId: keylessWallet.id,
    });
    defaultLogger.wallet.keyless.resetKeylessCredentialVerified();

    const rs = await decryptRevealableSeed({
      rs: credential.credential,
      password,
    });
    const localMnemonic = revealEntropyToMnemonic(rs.entropyWithLangPrefixed);
    if (localMnemonic !== decryptedMnemonic) {
      throw new OneKeyLocalError(
        'Decrypted mnemonic does not match local keyless wallet. Please verify your credentials.',
      );
    }
    defaultLogger.wallet.keyless.resetKeylessMnemonicDecrypted();

    // 4. Get x-coordinates from stored data
    // juiceboxShareX is stored in backendShareData for recovery
    const backendShareX = keylessWalletUtils.getShareXCoordinate(
      backendShareData.backendShare,
    );

    // 5. Recover juiceboxShare using recoverMissingShareFromSecret
    const juiceboxShare = await this.recoverMissingShareFromSecret({
      secretBase64: mnemonicPassword,
      shareBase64: backendShareData.backendShare,
      missingX: backendShareData.juiceboxShareX,
    });
    defaultLogger.wallet.keyless.resetKeylessJuiceboxShareRecovered();

    // 6. Upload juiceboxShare with new PIN
    await this.apiUploadKeylessJuiceboxShare({
      token,
      juiceboxShare,
      pin: newPin,
      backendShareX,
      ownerId: targetOwnerId,
    });
    defaultLogger.wallet.keyless.resetKeylessJuiceboxShareUploaded({
      backendShareX,
    });

    // Only a v2 backend share carries an ownerId. A v1 share has no ownerId
    // (apiGetKeylessBackendShare leaves it undefined), so it must NOT be
    // treated as an owner change: doing so would force the blocking rewrite
    // path and let a routine v1 -> v2 upgrade reject reset PIN on a transient
    // failure. v1 is handled by the best-effort upgrade scheduled below.
    const shouldRewriteKeylessBackendShareOwner =
      backendShareResult.canonicalFormat === 'v2' &&
      backendShareResult.ownerId !== undefined &&
      backendShareResult.ownerId !== targetOwnerId;
    const shouldUpgradeKeylessBackendShareFormat =
      backendShareResult.canonicalFormat === 'v1';

    if (shouldRewriteKeylessBackendShareOwner) {
      // The juicebox share has already been re-uploaded under targetOwnerId
      // above, so rewriting the backend share owner is a consistency
      // requirement. Run it before persisting any local state (tokens /
      // mnemonic password / keylessDetailsInfo) and before resetting
      // pin-confirm status: if it fails we throw here, leaving local state
      // still pointing at the previous owner instead of committing a mixed
      // local(new owner)/server(old owner) state that passive migration cannot
      // reconcile (it only handles v1 -> v2, not a v2 owner mismatch). Revision
      // conflicts are still retried inside migrateKeylessBackendShareToV2.
      await this.migrateKeylessBackendShareToV2({
        token,
        ownerId: targetOwnerId,
        expectedHashId: backendShareResult.hashId,
        expectedBackendShareData: backendShareData,
      });
    }

    if (mnemonicPasswordSourceOwnerId !== targetOwnerId) {
      await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorage({
        ownerId: targetOwnerId,
        mnemonicPassword,
        password,
        backgroundApi: this.backgroundApi,
      });
    }

    const socialUserIdHash = await accountUtils.hashKeylessSocialUserId({
      socialUserId: this.buildKeylessSocialUserIdFromToken({ token }),
    });
    const shouldUpdateKeylessDetailsInfo =
      keylessWallet.keylessDetailsInfo?.keylessOwnerId !== targetOwnerId ||
      keylessWallet.keylessDetailsInfo?.keylessProvider !== socialProvider ||
      keylessWallet.keylessDetailsInfo?.socialUserIdHash !== socialUserIdHash;
    if (shouldUpdateKeylessDetailsInfo) {
      const nextKeylessDetailsInfo: IKeylessWalletDetailsInfo = {
        ...keylessWallet.keylessDetailsInfo,
        keylessOwnerId: targetOwnerId,
        keylessProvider: socialProvider,
        socialUserIdHash,
      };
      await localDb.updateKeylessWalletDetailsInfo({
        walletId: keylessWallet.id,
        keylessDetailsInfo: nextKeylessDetailsInfo,
      });
    }

    await this.apiResetPinConfirmStatus({ token });
    defaultLogger.wallet.keyless.resetKeylessPinConfirmStatusUpdated();

    this.fixedKeylessProviderMap = {};
    if (
      !shouldRewriteKeylessBackendShareOwner &&
      shouldUpgradeKeylessBackendShareFormat
    ) {
      // A pure v1 -> v2 upgrade with an unchanged owner keeps both shares under
      // the same owner, so a failure is harmless and self-heals via passive
      // migration on the next launch. Keep it as background best-effort work so
      // it never blocks reset success. (The owner-change rewrite, which also
      // covers v1 -> v2, is handled blocking above before local persistence.)
      this.scheduleKeylessBackendShareV2Migration({
        source: 'resetPin',
        token,
        ownerId: targetOwnerId,
        expectedHashId: backendShareResult.hashId,
        expectedBackendShareData: backendShareData,
      });
    }
    return { success: true };
  }

  @backgroundMethod()
  @toastIfError()
  async apiMarkKeylessSameEmailResetPinSuccess(params: {
    token: string;
  }): Promise<{ success: true }> {
    const { token } = params;
    if (!token) {
      throw new OneKeyLocalError('social login token is required');
    }

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<IApiClientResponse<undefined>>(
      '/prime/v1/keyless-wallet/resetPinDone',
      {
        token,
      },
    );

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';

    if (!isSuccess) {
      throw new OneKeyLocalError(
        'Failed to mark keyless same email reset pin success',
      );
    }

    return { success: true };
  }

  @backgroundMethod()
  @toastIfError()
  async autoResetKeylessWalletPinAfterRestoreForSameEmailAccount(params: {
    token: string;
    pin: string;
  }): Promise<{ success: boolean; skipped: boolean }> {
    const { token, pin } = params;
    const { isSameEmailAccountAtOldVersion: isSameEmailAccount } =
      await this.apiGetKeylessSameEmailAccountStatus({ token });

    if (!isSameEmailAccount) {
      return {
        success: false,
        skipped: true,
      };
    }

    const refreshResult =
      await this.getFreshKeylessOAuthAccessTokenForRealmExchange();
    if (refreshResult.status !== EKeylessOAuthAccessTokenRefreshStatus.Ready) {
      throw new OneKeyLocalError(
        'Keyless OAuth reauthentication is required before the automatic PIN reset.',
      );
    }
    const realmAccessToken = refreshResult.accessToken;
    await this.resetKeylessWalletPin({
      token: realmAccessToken,
      newPin: pin,
    });
    await this.apiMarkKeylessSameEmailResetPinSuccess({
      token: realmAccessToken,
    });

    return {
      success: true,
      skipped: false,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async restoreKeylessWalletFromServer(params: {
    token: string | undefined;
    pin: string | undefined;
    pinConfirmStatusAlreadyUpdated?: boolean;
  }): Promise<{
    ownerId: string;
    mnemonic: string;
    keylessDetailsInfo: IKeylessWalletDetailsInfo;
  }> {
    const { token, pin, pinConfirmStatusAlreadyUpdated } = params;
    if (!token) {
      throw new OneKeyLocalError('social login token is required');
    }
    if (!pin) {
      throw new OneKeyLocalError('pin is required');
    }

    // Get password first to avoid multiple prompts
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();

    // Get backend share from server
    const backendShareResult = await this.apiGetKeylessBackendShare({ token });
    const { backendShareData, hashId } = backendShareResult;
    if (!backendShareData) {
      throw new OneKeyLocalError('Backend share not found');
    }
    if (!hashId) {
      throw new OneKeyLocalError('Hash ID not found');
    }
    defaultLogger.wallet.keyless.restoreKeylessBackendShareRetrieved();

    // check if keyless wallet is initialized
    const ownerId =
      backendShareResult.ownerId ??
      (await this.buildKeylessOwnerIdFromSocialToken({
        token,
        hashId,
      }));
    defaultLogger.wallet.keyless.restoreKeylessOwnerIdGenerated();

    // Get juicebox share from juicebox network
    let juiceboxShareData: IKeylessJuiceboxShare | null = null;
    juiceboxShareData = await this.apiGetKeylessJuiceboxShare({
      token,
      pin,
      ownerId,
    });
    if (!juiceboxShareData) {
      throw new OneKeyLocalError('Juicebox share not found');
    }
    defaultLogger.wallet.keyless.restoreKeylessJuiceboxShareRetrieved();

    // Combine shares to recover mnemonic password
    const mnemonicPasswordShares = [
      bufferUtils.base64ToBytes(backendShareData.backendShare),
      bufferUtils.base64ToBytes(juiceboxShareData.juiceboxShare),
    ];
    const mnemonicPasswordBytes = await shamirUtils.combine(
      mnemonicPasswordShares.map((s) => new Uint8Array(s)),
    );
    const mnemonicPassword = bufferUtils.bytesToBase64(mnemonicPasswordBytes);
    defaultLogger.wallet.keyless.restoreKeylessMnemonicPasswordRecovered();

    // Decrypt mnemonic using recovered password
    const mnemonic = await this.decryptKeylessMnemonic({
      encryptedMnemonic: backendShareData.encryptedMnemonic,
      mnemonicPassword,
    });
    defaultLogger.wallet.keyless.restoreKeylessMnemonicDecrypted();

    // Save mnemonicPassword to secure storage for Reset PIN flow
    await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorage({
      ownerId,
      mnemonicPassword,
      password,
      backgroundApi: this.backgroundApi,
    });
    defaultLogger.wallet.keyless.restoreKeylessMnemonicPasswordStored();

    if (
      !pinConfirmStatusAlreadyUpdated &&
      (await this.updatePinConfirmStatusAfterSuccessfulPin({ token }))
    ) {
      defaultLogger.wallet.keyless.restorePinConfirmStatusUpdated();
    }

    const shouldScheduleKeylessBackendShareV2Migration =
      backendShareResult.canonicalFormat === 'v1';

    const keylessProvider =
      backendShareResult.ownerProvider ??
      this.buildKeylessProviderFromSocialToken({ token });
    const encodedMnemonic =
      await this.backgroundApi.servicePassword.encodeSensitiveText({
        text: mnemonic,
      });
    const socialUserIdHash = await accountUtils.hashKeylessSocialUserId({
      socialUserId: this.buildKeylessSocialUserIdFromToken({ token }),
    });

    this.fixedKeylessProviderMap = {};
    if (shouldScheduleKeylessBackendShareV2Migration) {
      this.scheduleKeylessBackendShareV2Migration({
        source: 'restore',
        token,
        ownerId,
        expectedHashId: backendShareResult.hashId,
        expectedBackendShareData: backendShareData,
      });
    }
    return {
      ownerId,
      mnemonic: encodedMnemonic,
      keylessDetailsInfo: {
        keylessOwnerId: ownerId,
        keylessProvider,
        socialUserIdHash,
      },
    };
  }

  @backgroundMethod()
  @toastIfError()
  async clearKeylessOnboardingCache() {
    await this.juiceboxOperationMutex.runExclusive(async () => {
      juiceboxClientCache.clear();
    });
  }

  @backgroundMethod()
  @toastIfError()
  async prepareKeylessCreateWithOneKeyId({
    signInProvider,
  }: {
    signInProvider?: EOAuthSocialLoginProvider;
  } = {}): Promise<IKeylessCreateWithOneKeyIdPrepareResult> {
    const localKeylessInspection =
      await this.inspectLocalKeylessWalletForOAuthInternal();
    if (localKeylessInspection.status === ELocalKeylessWalletOAuthState.Ready) {
      return {
        status: EKeylessCreateWithOneKeyIdPrepareStatus.LocalKeylessExists,
      };
    }
    if (
      localKeylessInspection.status ===
      ELocalKeylessWalletOAuthState.DataUnavailable
    ) {
      return {
        status:
          EKeylessCreateWithOneKeyIdPrepareStatus.LocalKeylessDataUnavailable,
        walletId: localKeylessInspection.walletId,
        errorMessage: localKeylessInspection.errorMessage,
      };
    }

    const localUserInfo =
      await this.backgroundApi.servicePrime.getLocalUserInfo();
    const displayEmail = localUserInfo.displayEmail;
    // This method runs from the initial Google/Apple button click and must be
    // a local-only precheck. ServicePrime.isLoggedIn() reads the live
    // Supabase session and may refresh it over the network; the explicit
    // refresh belongs to continueKeylessCreateWithOneKeyId() after the user
    // confirms the current OneKey ID.
    const isOneKeyIdLoggedIn = Boolean(
      localUserInfo.isLoggedIn && localUserInfo.isLoggedInOnServer,
    );
    if (!isOneKeyIdLoggedIn) {
      return {
        status: EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthLogin,
        displayEmail,
      };
    }

    let authSessionSource =
      await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
    if (!authSessionSource) {
      // Flow-local interpretation, intentionally NOT persisted: a keyless
      // create can proceed on a standalone keyless session without implying
      // OneKey ID login, so an active keyless session is treated as
      // KeylessOAuth for this flow only (the resolver must never persist
      // that inference). With no tokens at all, keep the pre-existing
      // default of LegacyEmailSupabase so the user is routed to the legacy
      // OAuth bind path below.
      const keylessAuthToken =
        await this.backgroundApi.simpleDb.prime.getKeylessSupabaseAuthToken();
      authSessionSource = keylessAuthToken
        ? EPrimeAuthSessionSource.KeylessOAuth
        : EPrimeAuthSessionSource.LegacyEmailSupabase;
    }

    if (authSessionSource !== EPrimeAuthSessionSource.KeylessOAuth) {
      if (signInProvider) {
        const boundProviders =
          await this.backgroundApi.servicePrime.getBoundOAuthProvidersForCurrentOneKeyId();
        if (boundProviders.includes(signInProvider)) {
          return {
            status:
              EKeylessCreateWithOneKeyIdPrepareStatus.NeedLegacyOAuthReauth,
            displayEmail,
          };
        }
        const [boundProvider] = boundProviders;
        if (boundProvider) {
          return {
            status:
              EKeylessCreateWithOneKeyIdPrepareStatus.LegacyOAuthProviderMismatch,
            displayEmail,
            boundProvider,
          };
        }
      }
      return {
        status: EKeylessCreateWithOneKeyIdPrepareStatus.NeedLegacyOAuthBind,
        displayEmail,
      };
    }

    return {
      status: EKeylessCreateWithOneKeyIdPrepareStatus.ConfirmCurrentOneKeyId,
      displayEmail,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async continueKeylessCreateWithOneKeyId({
    signInProvider,
  }: {
    signInProvider?: EOAuthSocialLoginProvider;
  } = {}): Promise<IKeylessCreateWithOneKeyIdPrepareResult> {
    const prepareResult = await this.prepareKeylessCreateWithOneKeyId({
      signInProvider,
    });
    if (
      prepareResult.status !==
      EKeylessCreateWithOneKeyIdPrepareStatus.ConfirmCurrentOneKeyId
    ) {
      return prepareResult;
    }
    const { displayEmail } = prepareResult;
    let previousAccessToken: string | null = null;
    try {
      previousAccessToken = await this.getActiveKeylessOAuthAccessToken({
        throwOnSessionRefreshError: true,
      });
    } catch (error) {
      logMaskedKeylessError(
        'ServiceKeylessWallet current OneKey ID session refresh failed during Keyless creation preparation',
        error,
      );
      return {
        status: (await this.isDefinitiveSupabaseRefreshTokenRejectionError(
          error,
        ))
          ? EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthReauth
          : EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthRefreshRecovery,
        displayEmail,
      };
    }
    if (!previousAccessToken) {
      return {
        status: EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthReauth,
        displayEmail,
      };
    }

    const refreshResult =
      await this.refreshKeylessOAuthAccessTokenForRealmExchange({
        operation: 'createOrRestore',
        previousAccessToken,
        validateRefreshedAccessToken: async (refreshedAccessToken) =>
          this.doKeylessOAuthTokensRepresentSameIdentity({
            previousAccessToken,
            refreshedAccessToken,
          }),
      });
    if (refreshResult.status !== EKeylessOAuthAccessTokenRefreshStatus.Ready) {
      return {
        status:
          refreshResult.status ===
          EKeylessOAuthAccessTokenRefreshStatus.NeedOAuthReauth
            ? EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthReauth
            : EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthRefreshRecovery,
        displayEmail,
      };
    }
    const { accessToken } = refreshResult;

    const { isCreated } = await this.getKeylessWalletCreatedOnServerInfo({
      token: accessToken,
    });

    return {
      status: isCreated
        ? EKeylessCreateWithOneKeyIdPrepareStatus.ContinueRestore
        : EKeylessCreateWithOneKeyIdPrepareStatus.ContinueCreate,
      token: accessToken,
      displayEmail,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async createKeylessWalletToServer(params: {
    token: string | undefined;
    pin: string | undefined;
    customMnemonic?: string;
  }): Promise<{
    ownerId: string;
    mnemonic: string;
    keylessDetailsInfo: IKeylessWalletDetailsInfo;
  }> {
    const { token, pin, customMnemonic } = params;
    if (await this.backgroundApi.serviceAccount.getKeylessWallet()) {
      throw new OneKeyLocalError('Keyless wallet already exists');
    }
    if (!token) {
      throw new OneKeyLocalError('social login token is required');
    }
    if (!pin) {
      throw new OneKeyLocalError('pin is required');
    }

    // Get password first to avoid multiple prompts
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();

    return this.withKeylessBackendShareWriteLock(
      token,
      async ({ lockId, hashId }) => {
        defaultLogger.wallet.keyless.createKeylessLockAcquired({ lockId });

        // 2. Double-check if already created (check inside lock for safety)
        const { isCreated, baseRevision } =
          await this.getKeylessWalletCreatedOnServerInfo({
            token,
          });

        if (isCreated) {
          throw new OneKeyLocalError('Keyless wallet already created');
        }
        defaultLogger.wallet.keyless.createKeylessWalletNotYetCreated();

        const ownerId = await this.buildKeylessOwnerIdFromSocialToken({
          token,
          hashId,
        });
        defaultLogger.wallet.keyless.createKeylessOwnerIdGenerated();

        let mnemonic = '';
        const devSettings = await devSettingsPersistAtom.get();
        if (devSettings.enabled && customMnemonic && customMnemonic.trim()) {
          mnemonic = customMnemonic.trim();
        } else {
          mnemonic = generateMnemonic(256);
        }
        const mnemonicPasswordBytes = crypto.getRandomValues(
          new Uint8Array(32),
        );
        const mnemonicPassword = bufferUtils.bytesToBase64(
          mnemonicPasswordBytes,
        );
        const encryptedMnemonic: string = await this.encryptKeylessMnemonic({
          mnemonic,
          mnemonicPassword,
        });
        defaultLogger.wallet.keyless.createKeylessMnemonicEncrypted();

        const mnemonicPasswordShares = await shamirUtils.split(
          new Uint8Array(mnemonicPasswordBytes),
          2,
          2,
        );
        defaultLogger.wallet.keyless.createKeylessMnemonicPasswordShared();

        const [mnemonicPasswordShare1, mnemonicPasswordShare2] =
          mnemonicPasswordShares;
        const backendShare: string = bufferUtils.bytesToBase64(
          mnemonicPasswordShare1,
        );
        const juiceboxShare: string = bufferUtils.bytesToBase64(
          mnemonicPasswordShare2,
        );

        // Extract x-coordinates from shares
        const backendShareX =
          keylessWalletUtils.getShareXCoordinate(backendShare);
        const juiceboxShareX =
          keylessWalletUtils.getShareXCoordinate(juiceboxShare);

        // Save mnemonicPassword to secure storage for Reset PIN flow
        await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorage({
          ownerId,
          mnemonicPassword,
          password,
          backgroundApi: this.backgroundApi,
        });
        defaultLogger.wallet.keyless.createKeylessMnemonicPasswordStored();

        const _juiceboxShareData: IKeylessJuiceboxShare =
          await this.apiUploadKeylessJuiceboxShare({
            token,
            ownerId,
            juiceboxShare,
            pin,
            backendShareX, // Store the other share's x-coordinate for recovery
          });
        defaultLogger.wallet.keyless.createKeylessJuiceboxShareUploaded({
          juiceboxShareX,
        });

        const keylessBackendShareV1Mirror =
          await this.encryptKeylessBackendSharePayloadV1({
            backendShareData: {
              encryptedMnemonic,
              backendShare,
              juiceboxShareX,
            },
          });

        // Make sure juiceboxShare is uploaded successfully before uploading backend share
        const _backendShareData: IKeylessBackendShare =
          await this.uploadKeylessBackendShare({
            token,
            lockId,
            hashId,
            ownerId,
            baseRevision,
            encryptedMnemonic,
            backendShare,
            juiceboxShareX, // Store the other share's x-coordinate for recovery
            keylessBackendShareV1Mirror,
          });
        defaultLogger.wallet.keyless.createKeylessBackendShareUploaded({
          backendShareX,
        });

        // void this.apiUpdatePinConfirmStatus({ token });

        const keylessProvider: EOAuthSocialLoginProvider =
          this.buildKeylessProviderFromSocialToken({
            token,
          });

        const socialUserId = this.buildKeylessSocialUserIdFromToken({ token });

        this.fixedKeylessProviderMap = {};

        return {
          ownerId,
          mnemonic:
            await this.backgroundApi.servicePassword.encodeSensitiveText({
              text: mnemonic,
            }),
          keylessDetailsInfo: {
            keylessOwnerId: ownerId,
            keylessProvider,
            socialUserIdHash: await accountUtils.hashKeylessSocialUserId({
              socialUserId,
            }),
          },
        };
      },
    );
  }

  @backgroundMethod()
  @toastIfError()
  async isKeylessWalletCreatedOnServer(params: {
    token: string;
  }): Promise<boolean> {
    const { isCreated } =
      await this.getKeylessWalletCreatedOnServerInfo(params);
    return isCreated;
  }

  private async inspectLocalKeylessWalletForOAuthInternal(): Promise<
    | {
        status: ELocalKeylessWalletOAuthState.Absent;
      }
    | {
        status: ELocalKeylessWalletOAuthState.Ready;
        walletId: string;
        provider: EOAuthSocialLoginProvider;
        ownerId: string;
        keylessWallet: IDBWallet;
      }
    | {
        status: ELocalKeylessWalletOAuthState.DataUnavailable;
        walletId: string;
        errorMessage: string;
        keylessWallet: IDBWallet;
      }
  > {
    const keylessWallet =
      await this.backgroundApi.serviceAccount.getIdentityManagedKeylessWalletCandidate();
    if (!keylessWallet) {
      return { status: ELocalKeylessWalletOAuthState.Absent };
    }
    const errorMessage = getMalformedKeylessWalletDataError(keylessWallet);
    if (errorMessage) {
      return {
        status: ELocalKeylessWalletOAuthState.DataUnavailable,
        walletId: keylessWallet.id,
        errorMessage,
        keylessWallet,
      };
    }
    return {
      status: ELocalKeylessWalletOAuthState.Ready,
      walletId: keylessWallet.id,
      ownerId: keylessWallet.keylessDetailsInfo?.keylessOwnerId || '',
      provider: keylessWallet.keylessDetailsInfo
        ?.keylessProvider as EOAuthSocialLoginProvider,
      keylessWallet,
    };
  }

  @backgroundMethod()
  async inspectLocalKeylessWalletForOAuth(): Promise<ILocalKeylessWalletOAuthInspection> {
    const inspection = await this.inspectLocalKeylessWalletForOAuthInternal();
    if (inspection.status === ELocalKeylessWalletOAuthState.Absent) {
      return inspection;
    }
    if (inspection.status === ELocalKeylessWalletOAuthState.DataUnavailable) {
      return {
        status: inspection.status,
        walletId: inspection.walletId,
        errorMessage: inspection.errorMessage,
      };
    }
    return {
      status: inspection.status,
      walletId: inspection.walletId,
      provider: inspection.provider,
    };
  }

  private async getLocalKeylessLoginContext(): Promise<{
    keylessWallet: IDBWallet;
    ownerId: string;
    provider: EOAuthSocialLoginProvider;
  } | null> {
    // Do NOT swallow a transient wallet read failure into `null`.
    // `null` is a DEFINITIVE "no usable local Keyless wallet" verdict, and
    // prepareOneKeyIdLoginWithLocalKeyless maps that verdict to
    // NoLocalKeyless. Collapsing an unknown/transient storage error into that
    // verdict would enable OAuth actions without a trustworthy wallet
    // snapshot, so let the concrete read error propagate. A resolved
    // `undefined` wallet is a genuine no-wallet state and still returns null.
    const inspection = await this.inspectLocalKeylessWalletForOAuthInternal();
    if (inspection.status === ELocalKeylessWalletOAuthState.Absent) {
      return null;
    }
    if (inspection.status === ELocalKeylessWalletOAuthState.DataUnavailable) {
      throw new OneKeyLocalError(inspection.errorMessage);
    }
    return {
      keylessWallet: inspection.keylessWallet,
      ownerId: inspection.ownerId,
      provider: inspection.provider,
    };
  }

  private async hasLegacyKeylessOAuthRefreshToken(params: {
    ownerId: string;
  }): Promise<boolean> {
    const refreshTokenKey = accountUtils.buildKeylessRefreshTokenKey({
      ownerId: params.ownerId,
    });
    return Boolean(await keylessStorageUtils.storageGetItem(refreshTokenKey));
  }

  private async getLegacyKeylessOAuthRefreshToken(params: {
    ownerId: string;
    password: string;
  }): Promise<string | null> {
    const refreshTokenKey = accountUtils.buildKeylessRefreshTokenKey({
      ownerId: params.ownerId,
    });
    const encryptedPayloadBase64 =
      await keylessStorageUtils.storageGetItem(refreshTokenKey);
    if (!encryptedPayloadBase64) {
      return null;
    }
    const decryptionKey = await buildKeylessLocalEncryptionKeyWithPassword({
      password: params.password,
    });
    try {
      return await this.backgroundApi.servicePassword.decryptString({
        password: decryptionKey,
        data: encryptedPayloadBase64,
        dataEncoding: 'base64',
        resultEncoding: 'utf8',
        allowRawPassword: true,
      });
    } catch (error) {
      // Callers delete the blob on KeylessDataCorruptedError, so only a
      // DEFINITIVE wrong-key / tampered-payload verdict may map to it:
      // decryptAsync collapses every AES-stage failure (bad key, bad IV/tag,
      // truncated payload) into IncorrectPassword. Anything else (e.g. a KDF
      // or bridge failure before the AES stage) is not proof the blob is
      // dead — rethrow it raw so the attempt fails without deleting the
      // credential.
      if (
        errorUtils.isErrorByClassName({
          error,
          className: EOneKeyErrorClassNames.IncorrectPassword,
        })
      ) {
        defaultLogger.wallet.keyless.dataCorruptedError({
          reason:
            'getLegacyKeylessOAuthRefreshToken: failed to decrypt refreshToken by decryptionKey',
        });
        throw new KeylessDataCorruptedError();
      }
      throw error;
    }
  }

  private async saveLegacyKeylessOAuthRefreshToken(params: {
    ownerId: string;
    refreshToken: string;
    password: string;
  }): Promise<void> {
    this.legacyKeylessOAuthIdentityMismatchOwnerIds.delete(params.ownerId);
    const refreshTokenKey = accountUtils.buildKeylessRefreshTokenKey({
      ownerId: params.ownerId,
    });
    const encryptionKey = await buildKeylessLocalEncryptionKeyWithPassword({
      password: params.password,
    });
    const encryptedPayloadHex =
      await this.backgroundApi.servicePassword.encryptString({
        password: encryptionKey,
        data: params.refreshToken,
        dataEncoding: 'utf8',
        allowRawPassword: true,
      });
    const encryptedPayloadBase64 = bufferUtils.bytesToBase64(
      bufferUtils.hexToBytes(encryptedPayloadHex),
    );
    await keylessStorageUtils.storageSetItem(
      refreshTokenKey,
      encryptedPayloadBase64,
    );
  }

  private isKeylessDataCorruptedError(error: unknown): boolean {
    return (
      error instanceof KeylessDataCorruptedError ||
      errorUtils.isErrorByClassName({
        error,
        className: EOneKeyErrorClassNames.KeylessDataCorruptedError,
      })
    );
  }

  private async migrateLegacyKeylessOAuthSessionForLocalWallet(params: {
    keylessWallet: IDBWallet;
    ownerId: string;
    password?: string;
  }): Promise<ILegacyKeylessOAuthMigrationResult> {
    const { keylessWallet, ownerId } = params;
    if (!(await this.hasLegacyKeylessOAuthRefreshToken({ ownerId }))) {
      this.legacyKeylessOAuthIdentityMismatchOwnerIds.delete(ownerId);
      return { status: 'unavailable' };
    }
    if (this.legacyKeylessOAuthIdentityMismatchOwnerIds.has(ownerId)) {
      return { status: 'identityMismatch' };
    }

    // Verify before locking because password caching may start the competing
    // passive migration that consumes the same single-use token.
    const password =
      params.password ??
      (await this.backgroundApi.servicePassword.promptPasswordVerify())
        .password;

    // Preserve the lifecycle → legacy-token lock order by committing the
    // identity session only after this token exchange lock is released.
    const refreshedSession =
      await this.legacyKeylessOAuthTokenExchangeMutex.runExclusive(async () => {
        // Re-read under the lock because a competing migration may have
        // rotated or removed the token while this call waited.
        if (!(await this.hasLegacyKeylessOAuthRefreshToken({ ownerId }))) {
          return { status: 'unavailable' as const };
        }

        let refreshToken: string | null = null;
        try {
          refreshToken = await this.getLegacyKeylessOAuthRefreshToken({
            ownerId,
            password,
          });
        } catch (error) {
          if (this.isKeylessDataCorruptedError(error)) {
            // A legacy token that cannot be decrypted must not trap every
            // future login attempt in the migration path.
            await this.removeLegacyKeylessOAuthTokens({ ownerId });
            return { status: 'unavailable' as const };
          }
          throw error;
        }
        if (!refreshToken) {
          return { status: 'unavailable' as const };
        }

        const refreshUrl = `${KEYLESS_SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=refresh_token`;
        const response = await fetch(refreshUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // oxlint-disable-next-line @cspell/spellchecker
            apikey: KEYLESS_SUPABASE_PUBLIC_API_KEY,
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
        });
        // Keep the token after transient failures so migration can retry.
        if (
          response.status >= 500 ||
          response.status === 408 ||
          response.status === 429
        ) {
          return { status: 'unavailable' as const };
        }
        if (!response.ok) {
          if (await this.isDefinitiveGoTrueRefreshTokenRejection(response)) {
            // Drop definitively rejected tokens so the next attempt can use a
            // fresh OAuth login instead of repeating a doomed migration.
            await this.removeLegacyKeylessOAuthTokens({ ownerId });
            return { status: 'unavailable' as const };
          }
          // An unknown non-OK response is not proof that the token is invalid.
          return { status: 'unavailable' as const };
        }

        const refreshResult = (await response.json()) as {
          access_token?: string;
          refresh_token?: string;
        };
        const accessToken = refreshResult?.access_token;
        const nextRefreshToken = refreshResult?.refresh_token;

        // Persist the rotated single-use token before validation so a mismatch
        // or later session failure cannot strand a consumed credential.
        if (nextRefreshToken) {
          await this.saveLegacyKeylessOAuthRefreshToken({
            ownerId,
            refreshToken: nextRefreshToken,
            password,
          });
        }
        if (!accessToken || !nextRefreshToken) {
          return { status: 'unavailable' as const };
        }

        const mismatchReason =
          await this.validateKeylessAccessTokenMatchesLocalWallet({
            keylessWallet,
            token: accessToken,
          });
        if (mismatchReason) {
          this.legacyKeylessOAuthIdentityMismatchOwnerIds.add(ownerId);
          return { status: 'identityMismatch' as const };
        }

        return {
          status: 'migrated' as const,
          accessToken,
          refreshToken: nextRefreshToken,
        };
      });

    if (refreshedSession.status !== 'migrated') {
      return refreshedSession;
    }

    // The lifecycle commit rechecks wallet identity and cannot resurrect a
    // wallet removed after the token lock was released.
    await this.backgroundApi.servicePrime.persistMigratedKeylessOAuthSessionForWallet(
      {
        accessToken: refreshedSession.accessToken,
        refreshToken: refreshedSession.refreshToken,
        expectedWalletId: keylessWallet.id,
      },
    );

    // Delete only this attempt's rotated token, preserving any concurrent
    // replacement.
    try {
      await this.legacyKeylessOAuthTokenExchangeMutex.runExclusive(async () => {
        const currentRefreshToken =
          await this.getLegacyKeylessOAuthRefreshToken({
            ownerId,
            password,
          });
        if (currentRefreshToken === refreshedSession.refreshToken) {
          await this.removeLegacyKeylessOAuthTokens({ ownerId });
        }
      });
    } catch (error) {
      defaultLogger.wallet.keyless.prepareOneKeyIdLoginWithLocalKeylessFailed({
        error: `post-persist legacy token cleanup failed: ${String(error)}`,
      });
    }
    return {
      status: 'migrated',
      accessToken: refreshedSession.accessToken,
    };
  }

  /**
   * Make the Keyless credential side of a legacy OneKey ID + Keyless upgrade
   * ready before any bind reminder is shown. A valid modern Keyless session
   * is reused. A pre-unification encrypted refresh-token blob is exchanged
   * with the already-cached wallet password and installed into the dedicated
   * Keyless session slot without changing the active OneKey ID auth source.
   * A locked credential still allows the reminder; its button continues the
   * migration interactively and prompts for the passcode. Unknown/transient
   * outcomes keep the blob and defer the reminder.
   */
  @backgroundMethod()
  async ensureKeylessCredentialReadyForOneKeyIdBind(): Promise<IKeylessCredentialReadyForOneKeyIdBindResult> {
    const inspection = await this.inspectLocalKeylessWalletForOAuthInternal();
    if (inspection.status === ELocalKeylessWalletOAuthState.Absent) {
      return {
        status: 'noLocalKeyless',
        hasLocalKeylessWallet: false,
      };
    }
    if (inspection.status === ELocalKeylessWalletOAuthState.DataUnavailable) {
      return {
        status: 'retryableIndeterminate',
        hasLocalKeylessWallet: true,
      };
    }

    try {
      const activeAccessToken =
        await this.getActiveKeylessOAuthAccessTokenMatchingLocalWallet({
          keylessWallet: inspection.keylessWallet,
        });
      if (activeAccessToken) {
        return { status: 'ready', hasLocalKeylessWallet: true };
      }

      const hasLegacyRefreshToken =
        await this.hasLegacyKeylessOAuthRefreshToken({
          ownerId: inspection.ownerId,
        });
      if (!hasLegacyRefreshToken) {
        return { status: 'ready', hasLocalKeylessWallet: true };
      }

      const password =
        await this.backgroundApi.servicePassword.getCachedPassword();
      if (!password) {
        return {
          status: 'requiresPasscode',
          hasLocalKeylessWallet: true,
        };
      }

      const migration =
        await this.migrateLegacyKeylessOAuthSessionForLocalWallet({
          keylessWallet: inspection.keylessWallet,
          ownerId: inspection.ownerId,
          password,
        });
      if (migration.status !== 'unavailable') {
        return { status: 'ready', hasLocalKeylessWallet: true };
      }

      // A transient exchange keeps the rotated blob for a later retry. A
      // definitive rejection/corruption removes it, after which the bind UI
      // may continue with a fresh OAuth sign-in.
      return (await this.hasLegacyKeylessOAuthRefreshToken({
        ownerId: inspection.ownerId,
      }))
        ? {
            status: 'retryableIndeterminate',
            hasLocalKeylessWallet: true,
          }
        : { status: 'ready', hasLocalKeylessWallet: true };
    } catch (error) {
      defaultLogger.wallet.keyless.prepareOneKeyIdLoginWithLocalKeylessFailed({
        error: `credential upgrade before OneKey ID bind failed: ${String(
          error,
        )}`,
      });
      return {
        status: 'retryableIndeterminate',
        hasLocalKeylessWallet: true,
      };
    }
  }

  @backgroundMethod()
  async prepareOneKeyIdLoginWithLocalKeyless(): Promise<IOneKeyIdLoginWithLocalKeylessPrepareResult> {
    // A transient wallet read failure still propagates: consumers must be able
    // to distinguish "wallet existence unknown / retry" from a confirmed
    // NoLocalKeyless. A readable wallet with malformed identity fields returns
    // LocalKeylessDataUnavailable instead, allowing the UI to offer explicit,
    // confirmed removal before OAuth.
    // - claimOneKeyIdOAuthBindPrompt keys off
    //   `status !== NoLocalKeyless` to mean "wallet confirmed exists"; it
    //   relies on the throw to skip its 24h throttle and retry later, instead
    //   of prompting (and throttling) on an unconfirmed wallet.
    // - the bind dialog keeps its buttons disabled while the probe keeps
    //   throwing.
    // The login UI degrades a thrown read result to the same recovery entry and
    // retries inspection on click. A resolved `undefined` wallet is a genuine
    // no-wallet state and still maps to NoLocalKeyless below.
    const inspection = await this.inspectLocalKeylessWalletForOAuthInternal();
    if (inspection.status === ELocalKeylessWalletOAuthState.Absent) {
      return {
        status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless,
      };
    }
    if (inspection.status === ELocalKeylessWalletOAuthState.DataUnavailable) {
      return {
        status:
          EOneKeyIdLoginWithLocalKeylessPrepareStatus.LocalKeylessDataUnavailable,
        walletId: inspection.walletId,
        errorMessage: inspection.errorMessage,
      };
    }
    const context = {
      keylessWallet: inspection.keylessWallet,
      ownerId: inspection.ownerId,
      provider: inspection.provider,
    };

    // The local Keyless wallet definitely exists past this point, so a
    // transient probe failure (retryable Supabase auth error rethrown by
    // getActiveKeylessOAuthAccessToken, storage read failure) must never
    // surface as NoLocalKeyless: callers treat NoLocalKeyless as "no wallet"
    // and drop both the provider lock and the token-matches-wallet guard,
    // which would let a wrong-account OAuth session overwrite the shared
    // keyless session slot and complete a permanent server-side bind.
    // Degrade to NeedOAuthLogin with the wallet's provider instead — the
    // guards stay armed, and continueOneKeyIdLoginWithLocalKeyless can still
    // reuse the local session on the next attempt once the failure clears.
    try {
      const activeAccessToken =
        await this.getActiveKeylessOAuthAccessTokenMatchingLocalWallet({
          keylessWallet: context.keylessWallet,
        });
      if (!activeAccessToken) {
        const hasLegacyRefreshToken =
          await this.hasLegacyKeylessOAuthRefreshToken({
            ownerId: context.ownerId,
          });
        if (!hasLegacyRefreshToken) {
          return {
            status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NeedOAuthLogin,
            provider: context.provider,
            walletId: context.keylessWallet.id,
          };
        }
      }
    } catch (error) {
      defaultLogger.wallet.keyless.prepareOneKeyIdLoginWithLocalKeylessFailed({
        error: String(error),
      });
      return {
        status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NeedOAuthLogin,
        provider: context.provider,
        walletId: context.keylessWallet.id,
      };
    }

    return {
      status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.ContinueWithKeyless,
      provider: context.provider,
      walletId: context.keylessWallet.id,
    };
  }

  @backgroundMethod()
  async continueOneKeyIdLoginWithLocalKeyless(): Promise<IContinueOneKeyIdLoginWithLocalKeylessResult> {
    const context = await this.getLocalKeylessLoginContext();
    if (!context) {
      throw new OneKeyLocalError('Local Keyless wallet not found.');
    }

    let accessToken =
      await this.getActiveKeylessOAuthAccessTokenMatchingLocalWallet({
        keylessWallet: context.keylessWallet,
      });
    if (!accessToken) {
      // Anti-clobber guard (mirrors
      // getOrMigrateKeylessOAuthAccessTokenForLocalWallet): the matching
      // helper above returns null both for "slot empty" and "slot holds
      // another account's session". Read the raw active token so a
      // non-matching session that BACKS the live OneKey ID login
      // (source === KeylessOAuth) can be detected before the migration
      // below setSession()s over it — that would silently destroy the live
      // login (its refresh token rotates on use, unrecoverable) while the
      // Prime atom keeps showing the old account. Today both UI hosts
      // guarantee this cannot happen; this keeps the invariant enforced at
      // runtime for any future caller.
      const activeAccessToken = await this.getActiveKeylessOAuthAccessToken();
      if (activeAccessToken) {
        const mismatchReason =
          await this.validateKeylessAccessTokenMatchesLocalWallet({
            token: activeAccessToken,
            keylessWallet: context.keylessWallet,
          });
        if (mismatchReason) {
          const authSessionSource =
            await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
          if (authSessionSource === EPrimeAuthSessionSource.KeylessOAuth) {
            // TODO: i18n
            throw new OneKeyLocalError(
              'A different OneKey ID is currently signed in with this Keyless session. Log out first, then continue.',
            );
          }
        }
      }
      const migration =
        await this.migrateLegacyKeylessOAuthSessionForLocalWallet({
          keylessWallet: context.keylessWallet,
          ownerId: context.ownerId,
        });
      accessToken =
        migration.status === 'migrated' ? migration.accessToken : null;
      if (!accessToken) {
        if (migration.status === 'identityMismatch') {
          return {
            status: 'needOAuthLogin',
            provider: context.provider,
            walletId: context.keylessWallet.id,
          };
        }
        const hasRetryableLegacyCredential =
          await this.hasLegacyKeylessOAuthRefreshToken({
            ownerId: context.ownerId,
          });
        return {
          status: hasRetryableLegacyCredential ? 'retryable' : 'needOAuthLogin',
          provider: context.provider,
          walletId: context.keylessWallet.id,
        };
      }
    }

    return {
      status: 'ready',
      accessToken,
      provider: context.provider,
      walletId: context.keylessWallet.id,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async getActiveKeylessOAuthAccessTokenForLocalWallet(): Promise<
    string | null
  > {
    return this.getActiveKeylessOAuthAccessTokenMatchingLocalWallet();
  }

  @backgroundMethod()
  @toastIfError()
  async getFreshKeylessOAuthAccessTokenForRealmExchange({
    previousAccessToken: expectedPreviousAccessToken,
    validateLocalWallet = true,
  }: {
    previousAccessToken?: string;
    validateLocalWallet?: boolean;
  } = {}): Promise<IKeylessOAuthAccessTokenRefreshResult> {
    let previousAccessToken: string | null = null;
    try {
      const activeAccessToken = expectedPreviousAccessToken
        ? await this.getActiveKeylessOAuthAccessToken({
            throwOnSessionRefreshError: true,
          })
        : await this.getOrMigrateKeylessOAuthAccessTokenForLocalWallet({
            throwOnSessionRefreshError: true,
          });
      if (
        expectedPreviousAccessToken &&
        activeAccessToken &&
        !(await this.doKeylessOAuthTokensRepresentSameIdentity({
          previousAccessToken: expectedPreviousAccessToken,
          refreshedAccessToken: activeAccessToken,
        }))
      ) {
        return {
          status: EKeylessOAuthAccessTokenRefreshStatus.NeedRetryOrOAuthReauth,
        };
      }
      previousAccessToken = activeAccessToken;
    } catch (error) {
      logMaskedKeylessError(
        'ServiceKeylessWallet OAuth access token refresh preparation failed and was downgraded to a recovery status',
        error,
      );
      return {
        status: (await this.isDefinitiveSupabaseRefreshTokenRejectionError(
          error,
        ))
          ? EKeylessOAuthAccessTokenRefreshStatus.NeedOAuthReauth
          : EKeylessOAuthAccessTokenRefreshStatus.NeedRetryOrOAuthReauth,
      };
    }
    if (!previousAccessToken) {
      return {
        status: EKeylessOAuthAccessTokenRefreshStatus.NeedOAuthReauth,
      };
    }

    return this.refreshKeylessOAuthAccessTokenForRealmExchange({
      operation: validateLocalWallet ? 'resetOrVerifyPin' : 'createOrRestore',
      previousAccessToken,
      validateRefreshedAccessToken: async (refreshedAccessToken) => {
        if (!validateLocalWallet) {
          return this.doKeylessOAuthTokensRepresentSameIdentity({
            previousAccessToken,
            refreshedAccessToken,
          });
        }
        const { isValid } = await this.validateTokenMatchesKeylessWallet({
          token: refreshedAccessToken,
        });
        return isValid;
      },
    });
  }

  @backgroundMethod()
  @toastIfError()
  async getOrMigrateKeylessOAuthAccessTokenForLocalWallet(params?: {
    throwOnSessionRefreshError?: boolean;
  }): Promise<string | null> {
    const context = await this.getLocalKeylessLoginContext();
    if (!context) {
      return null;
    }
    // Read the raw active token first (instead of the wallet-matching
    // helper, which returns null both for "slot empty" and "slot holds
    // another account's session") so a non-matching session can be detected
    // BEFORE the legacy migration below overwrites the shared session slot.
    const activeAccessToken = await this.getActiveKeylessOAuthAccessToken({
      throwOnSessionRefreshError: params?.throwOnSessionRefreshError,
    });
    if (activeAccessToken) {
      const mismatchReason =
        await this.validateKeylessAccessTokenMatchesLocalWallet({
          token: activeAccessToken,
          keylessWallet: context.keylessWallet,
        });
      if (!mismatchReason) {
        return activeAccessToken;
      }
      const authSessionSource =
        await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
      if (authSessionSource === EPrimeAuthSessionSource.KeylessOAuth) {
        // The non-matching session backs the live OneKey ID login. Migrating
        // the legacy blob would setSession() over it and silently destroy
        // that login (its refresh token rotates on use, so it is
        // unrecoverable) while the Prime atom keeps showing the old account.
        // Return null instead: the caller routes to the explicit
        // OneKeyIDLogin page, where the account-conflict dialog resolves the
        // situation with user consent.
        return null;
      }
      // Residual non-matching session that backs nothing (source is not
      // KeylessOAuth): keep the pre-existing behavior — the legacy migration
      // below may overwrite it.
    }
    const migration = await this.migrateLegacyKeylessOAuthSessionForLocalWallet(
      {
        keylessWallet: context.keylessWallet,
        ownerId: context.ownerId,
      },
    );
    return migration.status === 'migrated' ? migration.accessToken : null;
  }

  /**
   * Detect whether persisting an incoming keyless OAuth session would
   * replace the session backing the live OneKey ID login with a DIFFERENT
   * account's session. There is a single shared keyless session slot; when
   * authSessionSource === KeylessOAuth, whatever session sits in that slot
   * IS the OneKey ID identity, so overwriting it with another user's session
   * causes cross-account token confusion (stale Prime atom + wrong tokens).
   * UI flows must call this BEFORE persistKeylessOAuthSession and resolve a
   * conflict by explicitly logging OneKey ID out (never the keyless wallet:
   * OneKey ID is recoverable by re-login, wallet assets are not).
   */
  @backgroundMethod()
  async getIncomingKeylessOAuthSessionConflictInfo(params: {
    incomingAccessToken: string;
  }): Promise<{
    hasConflict: boolean;
    currentOneKeyIdEmail: string;
  }> {
    const noConflict = { hasConflict: false, currentOneKeyIdEmail: '' };
    const authSessionSource =
      await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
    if (authSessionSource !== EPrimeAuthSessionSource.KeylessOAuth) {
      return noConflict;
    }
    const isOneKeyIdLoggedIn =
      await this.backgroundApi.servicePrime.isLoggedIn();
    if (!isOneKeyIdLoggedIn) {
      return noConflict;
    }
    // Identity comparison only needs the JWT claims, so read the slot
    // session directly (bg runtime owns token refreshes) instead of the
    // validity-buffered getActiveKeylessOAuthAccessToken(): a slot session
    // that merely needs a refresh still identifies its user.
    const client = await getSupabaseClientBySessionSource(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    const sessionResult = await client.auth.getSession();
    const slotUserId = sessionResult.data?.session?.user?.id || '';
    const decodedIncomingToken = stringUtils.decodeJWT(
      params.incomingAccessToken,
    ) as ISupabaseJWTPayload | null;
    const incomingUserId = decodedIncomingToken?.sub || '';
    if (!incomingUserId) {
      // Cannot identify the incoming token; downstream validation rejects
      // malformed tokens anyway, so don't block on it here.
      return noConflict;
    }
    if (slotUserId && slotUserId === incomingUserId) {
      return noConflict;
    }
    // Either the slot holds a different user's session, or a
    // KeylessOAuth-backed login is active but the slot identity is
    // unreadable: treat both as a conflict. The conservative path only shows
    // a dialog whose confirm logs OneKey ID out cleanly — it never risks
    // silently clobbering a live login.
    const localUserInfo =
      await this.backgroundApi.servicePrime.getLocalUserInfo();
    return {
      hasConflict: true,
      currentOneKeyIdEmail: localUserInfo?.displayEmail || '',
    };
  }

  @backgroundMethod()
  @toastIfError()
  async apiResetPinConfirmStatus(params: { token: string }): Promise<void> {
    const { token } = params;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/keyless-wallet/resetPinConfirmStatus',
      {
        token,
      },
    );

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';

    if (!isSuccess) {
      throw new OneKeyLocalError('Failed to reset pin confirm status');
    } else {
      await keylessPinConfirmStatusAtom.set(null);
    }
  }

  @backgroundMethod()
  @toastIfError()
  async apiUpdatePinConfirmStatus(params: {
    token: string;
    isCancelAction?: boolean;
  }): Promise<void> {
    const { token, isCancelAction } = params;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/keyless-wallet/updatePinConfirmStatus',
      {
        token,
        isCancelAction,
      },
    );

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';

    if (!isSuccess) {
      throw new OneKeyLocalError('Failed to update pin confirm status');
    }
  }

  private async updatePinConfirmStatusAfterSuccessfulPin(params: {
    token: string;
  }): Promise<boolean> {
    try {
      await this.updatePinConfirmStatusMutex.runExclusive(async () => {
        await this.apiUpdatePinConfirmStatus({ token: params.token });
      });
      return true;
    } catch (error) {
      logMaskedKeylessError(
        'ServiceKeylessWallet PIN confirmation status update failed after successful verification',
        error,
      );
      return false;
    }
  }

  @backgroundMethod()
  @toastIfError()
  async cancelVerifyPin(params: {
    ownerId: string | 'CURRENT_KEYLESS_WALLET';
  }): Promise<void> {
    await this.updatePinConfirmStatusMutex.runExclusive(async () => {
      let { ownerId } = params;
      if (ownerId === 'CURRENT_KEYLESS_WALLET') {
        ownerId = '';
        const wallet =
          await this.backgroundApi.serviceAccount.getKeylessWallet();
        if (wallet?.keylessDetailsInfo?.keylessOwnerId) {
          ownerId = wallet.keylessDetailsInfo.keylessOwnerId;
        }
      }
      if (!ownerId) {
        throw new OneKeyLocalError(
          'cancelVerifyPin ERROR: ownerId is required',
        );
      }
      const accessToken =
        await this.getActiveKeylessOAuthAccessTokenMatchingLocalWallet();

      if (accessToken) {
        await this.apiUpdatePinConfirmStatus({
          token: accessToken,
          isCancelAction: true,
        });
      }
    });
  }

  @backgroundMethod()
  async apiCheckAuthServerStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        timerUtils.getTimeDurationMs({ seconds: 10 }),
      );

      const healthUrl = `${KEYLESS_SUPABASE_PROJECT_URL}/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
          reason: `ServiceKeylessWallet auth server health check returned HTTP ${response.status}`,
        });
        return false;
      }

      const result = (await response.json()) as { status?: string };
      const isHealthy = result?.status === 'ok';
      if (!isHealthy) {
        defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
          reason: `ServiceKeylessWallet auth server health check returned status=${String(
            result?.status || 'missing',
          )}`,
        });
      }
      return isHealthy;
    } catch (error) {
      // Handle timeout or any other errors
      logMaskedKeylessError(
        'ServiceKeylessWallet auth server health check failed and was downgraded to unhealthy',
        error,
      );
      return false;
    }
  }

  @backgroundMethod()
  async fixKeylessWalletAvatar({
    wallet,
    accessToken,
  }: {
    wallet: IDBWallet;
    accessToken: string | null;
  }) {
    if (!accessToken) {
      return;
    }
    const socialProvider = this.buildKeylessProviderFromSocialToken({
      token: accessToken,
      skipFixedProvider: true,
    });
    if (!socialProvider) {
      return;
    }

    const keylessDetailsInfo = wallet?.keylessDetailsInfo;
    if (!keylessDetailsInfo) {
      return;
    }

    if (keylessDetailsInfo?.avatarProvider === socialProvider) {
      return;
    }

    const nextKeylessDetailsInfo: IKeylessWalletDetailsInfo = {
      ...keylessDetailsInfo,
      avatarProvider: socialProvider,
    };

    await localDb.updateKeylessWalletDetailsInfo({
      walletId: wallet.id,
      keylessDetailsInfo: nextKeylessDetailsInfo,
    });

    wallet.keylessDetailsInfo = nextKeylessDetailsInfo;
    wallet.keylessDetails = JSON.stringify(nextKeylessDetailsInfo);
  }

  @backgroundMethod()
  @toastIfError()
  async apiGetPinConfirmStatus(params: { token: string }): Promise<{
    shouldRemind: boolean;
  }> {
    // Wait for updatePinConfirmStatus mutex to complete
    await this.updatePinConfirmStatusMutex.waitForUnlock();
    const { token } = params;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<{
        need_remind: boolean;
        remind_time: number;
        confirmed_count: number;
      }>
    >('/prime/v1/keyless-wallet/getPinConfirmStatus', {
      token,
    });

    this.fixedKeylessProviderMap = {};
    const socialUserIdHash = await accountUtils.hashKeylessSocialUserId({
      socialUserId: this.buildKeylessSocialUserIdFromToken({ token }),
    });
    this.fixedKeylessProviderMap = {};
    const socialProvider = this.buildKeylessProviderFromSocialToken({ token });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    const shouldRemind = res?.data?.data?.need_remind;
    const remindTime = res?.data?.data?.remind_time;
    const confirmedCount = res?.data?.data?.confirmed_count;

    if (isSuccess) {
      await keylessPinConfirmStatusAtom.set({
        socialUserIdHash,
        socialProvider,
        needRemind: shouldRemind,
        remindTime,
        confirmedCount,
      });

      return {
        shouldRemind: !!shouldRemind,
      };
    }

    throw new OneKeyLocalError('Failed to get pin confirm status');
  }

  private async removeLegacyKeylessOAuthTokens(params: {
    ownerId: string;
  }): Promise<void> {
    const { ownerId } = params;
    this.legacyKeylessOAuthIdentityMismatchOwnerIds.delete(ownerId);
    await Promise.all([
      keylessStorageUtils.storageRemoveItem(
        accountUtils.buildKeylessRefreshTokenKey({ ownerId }),
      ),
      keylessStorageUtils.storageRemoveItem(
        accountUtils.buildKeylessTokenKey({ ownerId }),
      ),
    ]);
  }

  @backgroundMethod()
  @toastIfError()
  async clearLegacyKeylessOAuthTokenStorage(params: {
    ownerId: string;
  }): Promise<{ success: boolean }> {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError('Dev settings is not enabled');
    }

    await this.legacyKeylessOAuthTokenExchangeMutex.runExclusive(async () => {
      await this.removeLegacyKeylessOAuthTokens({
        ownerId: params.ownerId,
      });
    });

    return { success: true };
  }

  /**
   * This method intentionally has no @backgroundMethod decorator. The BG
   * identity-exit coordinator owns any related session or OneKey ID cleanup.
   */
  async cleanupKeylessWalletCredentialStorage(params: {
    ownerId: string;
  }): Promise<void> {
    const { ownerId } = params;
    if (!ownerId) {
      return;
    }

    // Delete under the legacy-blob exchange lock: an in-flight passive
    // attempt that already exchanged the blob token would otherwise persist
    // the rotated token back AFTER this delete, resurrecting a credential
    // the user just removed with the wallet.
    await this.legacyKeylessOAuthTokenExchangeMutex.runExclusive(async () => {
      await keylessMnemonicPasswordStorage.removeMnemonicPasswordFromStorage({
        ownerId,
      });

      await this.removeLegacyKeylessOAuthTokens({ ownerId });
    });
  }

  @backgroundMethod()
  async cleanupLocalKeylessOAuthTokens(): Promise<void> {
    const wallets = await this.getAllKeylessWallets();
    const ownerIds = new Set(
      wallets
        .map((wallet) => wallet.keylessDetailsInfo?.keylessOwnerId)
        .filter((ownerId): ownerId is string => Boolean(ownerId)),
    );

    // Delete under the legacy-blob exchange lock so an in-flight passive
    // attempt cannot save a rotated token back after this sweep and
    // resurrect a blob the successful OneKey ID login/bind/logout above
    // decided to retire.
    await this.legacyKeylessOAuthTokenExchangeMutex.runExclusive(async () => {
      await Promise.all(
        Array.from(ownerIds).map((ownerId) =>
          this.removeLegacyKeylessOAuthTokens({ ownerId }),
        ),
      );
    });
  }

  fixedKeylessProviderMap: {
    [socialUserId: string]: EOAuthSocialLoginProvider;
  } = {};

  /**
   * Validate that the social user ID from the token matches the keyless wallet's social user ID.
   * Used during KeylessResetPin and KeylessVerifyPinOnly flows to ensure the logged-in user
   * owns the local keyless wallet.
   */
  @backgroundMethod()
  @toastIfError()
  async validateTokenMatchesKeylessWallet(params: {
    token: string;
    skipFixProvider?: boolean;
  }): Promise<{
    isValid: boolean;
  }> {
    const { token, skipFixProvider } = params;
    const socialUserId = this.buildKeylessSocialUserIdFromToken({ token });
    if (!socialUserId) {
      throw new OneKeyLocalError('Social user ID is required');
    }
    const socialUserIdHash = await accountUtils.hashKeylessSocialUserId({
      socialUserId,
    });
    if (!socialUserIdHash) {
      throw new OneKeyLocalError('Social user ID hash is required');
    }

    const socialProvider = this.buildKeylessProviderFromSocialToken({
      token,
    });
    if (!socialProvider) {
      throw new OneKeyLocalError('Social provider is required');
    }

    const keylessWallet =
      await this.backgroundApi.serviceAccount.getKeylessWallet();

    const walletSocialUserIdHash =
      keylessWallet?.keylessDetailsInfo?.socialUserIdHash || '';
    const walletSocialProvider =
      keylessWallet?.keylessDetailsInfo?.keylessProvider || '';

    if (!walletSocialUserIdHash) {
      throw new OneKeyLocalError(
        'Keyless wallet social user ID hash is required',
      );
    }
    if (!walletSocialProvider) {
      throw new OneKeyLocalError('Keyless wallet social provider is required');
    }

    if (
      !skipFixProvider &&
      socialUserId &&
      walletSocialProvider &&
      socialUserIdHash === walletSocialUserIdHash &&
      socialProvider !== walletSocialProvider
    ) {
      // fix provider
      this.fixedKeylessProviderMap[socialUserId] = walletSocialProvider;
      return this.validateTokenMatchesKeylessWallet({
        token,
        skipFixProvider: true,
      });
    }
    return {
      isValid:
        socialUserIdHash === walletSocialUserIdHash &&
        socialProvider === walletSocialProvider,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async apiGetCachedKeylessRateLimitStatus(params: { token: string }): Promise<{
    isRateLimited: boolean;
    retryAfterSeconds: number;
    guessesRemaining: number;
  } | null> {
    return this.runCachedJuiceboxOperation({
      token: params.token,
      run: (client) => client.checkRateLimitStatus(),
    });
  }

  @backgroundMethod()
  @toastIfError()
  async apiCheckRateLimitStatus(params: { token: string }): Promise<{
    isRateLimited: boolean;
    retryAfterSeconds: number;
    guessesRemaining: number;
  }> {
    const { token } = params;
    return this.runJuiceboxOperation({
      token,
      operation: 'rateLimitCheck',
      run: (client) => client.checkRateLimitStatus(),
    });
  }

  private async getAllKeylessWallets(): Promise<IDBWallet[]> {
    const { wallets } = await this.backgroundApi.serviceAccount.getAllWallets({
      refillWalletInfo: true,
    });
    return wallets.filter((w) => w.isKeyless);
  }

  @backgroundMethod()
  async updateKeylessDataPasscode(params: {
    oldPassword: string;
    newPassword: string;
  }): Promise<{
    rollback: () => Promise<void>;
  }> {
    const { oldPassword, newPassword } = params;

    const keylessWallets = await this.getAllKeylessWallets();

    if (keylessWallets.length === 0) {
      return { rollback: async () => {} };
    }

    const backupData: Array<{
      ownerId: string;
      mnemonicPassword: string | null;
      legacyOAuthRefreshToken: string | null;
    }> = [];

    // Hold the legacy-blob exchange lock across the whole read → re-encrypt
    // sweep: a concurrent passive migration (fired by setCachedPassword)
    // otherwise races the passcode change on the same blob — reading an
    // old-passcode blob with the new passcode (a spurious corrupted verdict
    // that deletes a healthy credential) or refilling a re-encrypted blob
    // with an old-passcode payload. The passive path fast-yields while this
    // lock is held, and the interactive path queues behind it.
    await this.legacyKeylessOAuthTokenExchangeMutex.runExclusive(async () => {
      for (const wallet of keylessWallets) {
        const ownerId = wallet.keylessDetailsInfo?.keylessOwnerId;
        // eslint-disable-next-line no-continue
        if (!ownerId) continue;

        const mnemonicPassword =
          await keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorageWithPassword(
            {
              ownerId,
              password: oldPassword,
              backgroundApi: this.backgroundApi,
            },
          );

        // Legacy keyless OAuth refresh tokens are encrypted with a
        // passcode-derived key, so they must be re-encrypted with the new
        // passcode as well, otherwise they can no longer be decrypted after
        // the passcode change.
        let legacyOAuthRefreshToken: string | null = null;
        try {
          legacyOAuthRefreshToken =
            await this.getLegacyKeylessOAuthRefreshToken({
              ownerId,
              password: oldPassword,
            });
        } catch (error) {
          if (this.isKeylessDataCorruptedError(error)) {
            // The legacy blob already fails to decrypt with the current
            // passcode (e.g. left stale by an old build). It is unrecoverable,
            // so drop it instead of failing the passcode change.
            await this.removeLegacyKeylessOAuthTokens({ ownerId });
          } else {
            throw error;
          }
        }

        backupData.push({
          ownerId,
          mnemonicPassword,
          legacyOAuthRefreshToken,
        });
      }

      for (const backup of backupData) {
        if (backup.mnemonicPassword) {
          await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorageWithPassword(
            {
              ownerId: backup.ownerId,
              mnemonicPassword: backup.mnemonicPassword,
              password: newPassword,
              backgroundApi: this.backgroundApi,
            },
          );
        }

        if (backup.legacyOAuthRefreshToken) {
          await this.saveLegacyKeylessOAuthRefreshToken({
            ownerId: backup.ownerId,
            refreshToken: backup.legacyOAuthRefreshToken,
            password: newPassword,
          });
        }
      }
    });

    return {
      rollback: async () => {
        // Same lock rationale as above: the rollback runs from the passcode
        // change failure path, where rollbackPassword re-caches the OLD
        // passcode and thereby fires another passive migration.
        await this.legacyKeylessOAuthTokenExchangeMutex.runExclusive(
          async () => {
            for (const backup of backupData) {
              if (backup.mnemonicPassword) {
                await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorageWithPassword(
                  {
                    ownerId: backup.ownerId,
                    mnemonicPassword: backup.mnemonicPassword,
                    password: oldPassword,
                    backgroundApi: this.backgroundApi,
                  },
                );
              }

              if (backup.legacyOAuthRefreshToken) {
                await this.saveLegacyKeylessOAuthRefreshToken({
                  ownerId: backup.ownerId,
                  refreshToken: backup.legacyOAuthRefreshToken,
                  password: oldPassword,
                });
              }
            }
          },
        );
      },
    };
  }
}

export default ServiceKeylessWallet;
