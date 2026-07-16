import { Semaphore } from 'async-mutex';
import { chunk, cloneDeep, isString } from 'lodash';

import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID } from '@onekeyhq/shared/src/consts/primeConsts';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import {
  ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_CODE,
  ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_MESSAGE_ID,
  OneKeyErrorOneKeyIdOAuthIdentityAlreadyBound,
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyLocalError,
  OneKeyServerApiError,
  PrimeLoginDialogCancelError,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EOneKeyIdLoginWithLocalKeylessPrepareStatus } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { isLegacyOneKeyIdAccountMissingOAuthIdentity } from '@onekeyhq/shared/src/utils/oneKeyIdAccountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ETranslateEngine } from '@onekeyhq/shared/types/discovery';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IOneKeyIdAccount,
  IOneKeyIdOAuthBindResponse,
  IOneKeyIdOAuthLoginResponse,
  IOneKeyIdProfileResponse,
  IPrimeDeviceInfo,
  IPrimeServerUserInfo,
  IPrimeSubscriptionInfo,
  IPrimeUserInfo,
  IShopifyOrder,
} from '@onekeyhq/shared/types/prime/primeTypes';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  primeLoginDialogAtom,
  primePersistAtom,
  primePersistAtomInitialValue,
  primeServerMasterPasswordStatusAtom,
} from '../../states/jotai/atoms/prime';
import ServiceBase from '../ServiceBase';

import {
  readAuthTokenAllowingRetryableAuthError,
  readPersistedAccessTokenBySessionSource,
  removeAuthSessionStorageBySessionSource,
  revokeAuthSessionTokenOnServerBestEffort,
  runExclusiveOnAuthSessionSlot,
} from './primeAuthSessionAccess';

import type {
  IPrimeLoginDialogAtomData,
  IPrimeLoginDialogKeys,
  IPrimePersistAtomData,
} from '../../states/jotai/atoms/prime';

type IOneKeyIdOAuthBindErrorData = {
  code?: number;
  message?: string;
  messageId?: string;
};

type IPrimeServerUserInfoWithProfile = IPrimeServerUserInfo & {
  onekeyAccount?: IOneKeyIdAccount;
};

type ICompleteOneKeyIdProfileResponse = IPrimeServerUserInfo & {
  onekeyAccount: IOneKeyIdAccount;
};

type IPrimeApiClientResponse<T> = IApiClientResponse<T> & {
  messageId?: string;
};

class ServicePrime extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async getPrimeClient() {
    return this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
  }

  private async cleanupLegacyKeylessSessionStorage({
    callerName,
  }: {
    callerName: string;
  }) {
    try {
      await this.backgroundApi.serviceKeylessWallet.cleanupLocalKeylessOAuthTokens();
    } catch (error) {
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: `${callerName}: clear legacy keyless session storage failed: ${String(
          error,
        )}`,
      });
    }
  }

  private isOneKeyIdOAuthIdentityAlreadyBoundError(error: unknown) {
    const e = error as OneKeyError | undefined;
    const errorData = e?.data as IOneKeyIdOAuthBindErrorData | undefined;
    return (
      Number(e?.code) === ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_CODE ||
      Number(errorData?.code) === ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_CODE ||
      errorData?.messageId ===
        ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_MESSAGE_ID ||
      errorData?.message ===
        ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_MESSAGE_ID ||
      e?.message === ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_MESSAGE_ID
    );
  }

  private buildOneKeyIdOAuthIdentityAlreadyBoundError(error: unknown) {
    const e = error as OneKeyError | undefined;
    return new OneKeyErrorOneKeyIdOAuthIdentityAlreadyBound({
      data: e?.data,
      httpStatusCode: e?.httpStatusCode,
      requestId: e?.requestId,
    });
  }

  private isPrimeLoginInvalidTokenError(error: unknown) {
    if (error instanceof OneKeyErrorPrimeLoginInvalidToken) {
      return true;
    }
    const e = error as OneKeyError | undefined;
    const errorData = e?.data as { code?: number } | undefined;
    return (
      [90_002, 90_003].includes(Number(e?.code)) ||
      [90_002, 90_003].includes(Number(errorData?.code))
    );
  }

  private buildPrimeApiResponseError<T>({
    response,
    fallbackMessage,
  }: {
    response: {
      status: number;
      data: IPrimeApiClientResponse<T>;
      $requestId?: string;
    };
    fallbackMessage: string;
  }) {
    const errorCode = Number(response.data.code);
    const errorMessage = response.data.message || fallbackMessage;
    if ([90_002, 90_003].includes(errorCode)) {
      return new OneKeyErrorPrimeLoginInvalidToken({
        message: errorMessage,
        code: errorCode,
      });
    }
    return new OneKeyServerApiError({
      autoToast: false,
      disableFallbackMessage: true,
      message: errorMessage,
      code: response.data.code,
      httpStatusCode: response.status,
      data: response.data,
      requestId: response.$requestId,
    });
  }

  private getPrimeApiResponseData<T>({
    response,
    fallbackMessage,
  }: {
    response: {
      status: number;
      data: IPrimeApiClientResponse<T>;
      $requestId?: string;
    };
    fallbackMessage: string;
  }) {
    if (response.data.code !== 0) {
      throw this.buildPrimeApiResponseError({
        response,
        fallbackMessage,
      });
    }
    if (!response.data.data) {
      throw new OneKeyLocalError(fallbackMessage);
    }
    return response.data.data;
  }

  private async throwIfAllPrimeUserInfoRequestsFailedByInvalidTokenError({
    results,
    requestAuthToken,
  }: {
    results: Array<PromiseSettledResult<unknown>>;
    requestAuthToken: string;
  }) {
    if (results.some((result) => result.status === 'fulfilled')) {
      return;
    }
    const invalidTokenError = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected' &&
        result.reason instanceof OneKeyErrorPrimeLoginInvalidToken,
    )?.reason;
    if (invalidTokenError) {
      const error = invalidTokenError as OneKeyErrorPrimeLoginInvalidToken;
      if (error.$$invalidTokenHandled) {
        // HTTP-level 90002/90003: the ServiceBase response interceptor
        // already ran (or attempted — the marker means "handled or
        // attempted") handlePrimeLoginInvalidToken and emitted the event
        // for this error. Re-handling here would read the already-cleared
        // source, fall back to LegacyEmailSupabase, and fire a second
        // PrimeLoginInvalidToken event with the wrong source for
        // KeylessOAuth users — so just propagate. Errors without the
        // marker (HTTP-200 body-code 90002/90003, built by
        // buildPrimeApiResponseError, which never passes the error
        // interceptor) keep the full handling below.
        throw error;
      }
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: '',
        errorCode: Number(error.code),
        errorMessage: error.message,
      });
      // Route through the source-aware cleanup (with its stale-token guard)
      // instead of emitting a payload-less event, so only the session that
      // actually failed is cleared and local keyless auth is preserved.
      const clearResult = await this.handlePrimeLoginInvalidToken({
        requestAuthToken,
        errorCode: Number(error.code),
        errorMessage: error.message,
      });
      if (clearResult.cleared) {
        appEventBus.emit(EAppEventBusNames.PrimeLoginInvalidToken, {
          authSessionSource: clearResult.authSessionSource,
          clearedByBackground: true,
          authStateGeneration: clearResult.authStateGeneration,
        });
      }
      throw error;
    }
  }

  private mergeDefinedPrimeServerUserInfo({
    serverUserInfo,
    profile,
  }: {
    serverUserInfo: IPrimeServerUserInfo;
    profile?: IOneKeyIdProfileResponse;
  }): IPrimeServerUserInfoWithProfile {
    const definedProfileFields: Partial<IPrimeServerUserInfoWithProfile> = {};
    if (profile) {
      Object.entries(profile).forEach(([key, value]) => {
        if (value !== undefined) {
          (definedProfileFields as Record<string, unknown>)[key] = value;
        }
      });
    }
    return {
      ...serverUserInfo,
      ...definedProfileFields,
    };
  }

  private isCompletePrimeServerUserInfo(
    data: IOneKeyIdProfileResponse | undefined,
  ): data is ICompleteOneKeyIdProfileResponse {
    return Boolean(
      data?.userId &&
      Array.isArray(data.emails) &&
      typeof data.isPrime === 'boolean' &&
      typeof data.primeExpiredAt === 'number' &&
      typeof data.level === 'string' &&
      typeof data.salt === 'string' &&
      typeof data.pwdHash === 'string' &&
      typeof data.inviteCode === 'string',
    );
  }

  @backgroundMethod()
  async apiTranslate({
    texts,
    sourceLang,
    targetLang,
    engine = ETranslateEngine.standard,
    testFlag,
  }: {
    texts: string[];
    sourceLang: string;
    targetLang: string;
    engine?: ETranslateEngine;
    testFlag?: string;
  }): Promise<{ translations: Array<string | null> }> {
    const client = await this.getPrimeClient();
    // API limit: max 4 texts per translate request
    const batches = chunk(texts, 4);
    const requestConfig: Parameters<typeof client.post>[2] & {
      autoHandleError?: boolean;
    } = {
      autoHandleError: false,
    };
    const results: Array<Array<string | null>> = await Promise.all(
      batches.map(async (batch): Promise<Array<string | null>> => {
        try {
          const res = await client.post<{
            code: number;
            message: string;
            data?: {
              translations?: Array<string | null>;
            };
          }>(
            '/prime/v1/translate/dapp',
            {
              texts: batch,
              source_lang: sourceLang,
              target_lang: targetLang,
              engine,
              test_flag: testFlag,
              category: 'dapp_browser',
            },
            requestConfig,
          );

          if (res.data.code !== 0) {
            throw new OneKeyServerApiError({
              autoToast: false,
              disableFallbackMessage: true,
              message: res.data.message || 'OneKeyServer Unknown Error',
              code: res.data.code,
              httpStatusCode: res.status,
              data: res.data,
            });
          }

          const translations = res?.data?.data?.translations;

          return Array.isArray(translations) ? translations : batch;
        } catch (error) {
          const errorCode = Number((error as OneKeyError | undefined)?.code);
          if ([90_104, 90_105].includes(errorCode)) {
            throw error;
          }

          console.error('[Prime Translate] batch error:', error);
          return batch;
        }
      }),
    );
    return { translations: results.flat() };
  }

  @backgroundMethod()
  async apiDeleteAccount({
    uuid,
    emailOTP,
  }: {
    uuid: string;
    emailOTP: string;
  }) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
    const result = await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/user/delete',
      {
        uuid,
        emailOTP,
      },
    );
    return result?.data?.data;
  }

  loginMutex = new Semaphore(1);

  // Narrow mutex serializing WRITES to the shared auth-state pair
  // (persisted authSessionSource in simpleDb + primePersistAtom): the
  // login-side commit (commitAuthSessionSourceBeforeAtomUpdate + the atom
  // update that immediately follows it) versus the invalid-token cleanup
  // (handlePrimeLoginInvalidToken) and the logout clear
  // (clearOneKeyIdAuthState). Without it, the cleanup's multi-await
  // read -> guard -> clear sequence can interleave with a login commit and
  // either reset the atom right after a successful login, or wipe the
  // source while the atom still says logged-in (orphaning a KeylessOAuth
  // session — a wiped KeylessOAuth source is never re-inferred).
  //
  // Deliberately NOT loginMutex: the invalid-token response interceptor
  // fires for the login POST itself while loginMutex is held, so taking
  // loginMutex inside the cleanup handler would deadlock.
  //
  // Lock ordering: always loginMutex (outer) -> authStateWriteMutex
  // (inner). Sections holding authStateWriteMutex must never wait on
  // either mutex and must never await a OneKey-ID-client HTTP request
  // (whose response interceptor could re-enter the cleanup handler and
  // thus this mutex). Only local simpleDb/atom writes belong inside; the
  // Supabase getSession token reads used by the guards are the single
  // documented exception (they can refresh over the network, but go
  // directly to Supabase, never through the intercepted client).
  authStateWriteMutex = new Semaphore(1);

  /**
   * Guard evaluation shared by handlePrimeLoginInvalidToken's entry-time
   * pass (outside authStateWriteMutex: cheap fast-path skip plus session
   * warm-up before the lock) and its authoritative in-lock re-check
   * (against a login commit that finished while waiting for the lock).
   * Returns skip=true when clearing must NOT proceed.
   */
  private async evaluateInvalidTokenClearGuards({
    requestAuthToken,
    errorCode,
    errorMessage,
    requestUrl,
    phase,
  }: {
    requestAuthToken?: string;
    errorCode?: number;
    errorMessage?: string;
    requestUrl?: string;
    phase: '' | ' (in-lock recheck)';
  }): Promise<{
    skip: boolean;
    authSessionSource: EPrimeAuthSessionSource | undefined;
  }> {
    const authSessionSource =
      await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
    const tokenRead = await readAuthTokenAllowingRetryableAuthError(() =>
      authSessionSource
        ? this.backgroundApi.simpleDb.prime.getActiveAuthToken()
        : this.backgroundApi.simpleDb.prime.getSupabaseAuthToken(),
    );
    if (tokenRead.retryableError) {
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: requestUrl || '',
        errorCode: errorCode || -1,
        errorMessage: `skip clearing invalid token response because local refresh failed${phase}: ${String(
          tokenRead.retryableError,
        )}`,
      });
      return { skip: true, authSessionSource };
    }
    const currentAuthToken = tokenRead.token;

    if (
      requestAuthToken &&
      currentAuthToken &&
      requestAuthToken !== currentAuthToken
    ) {
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: requestUrl || '',
        errorCode: errorCode || -1,
        errorMessage: `skip clearing stale invalid token response${phase}: ${
          errorMessage || ''
        }`,
      });
      return { skip: true, authSessionSource };
    }

    if (!requestAuthToken && currentAuthToken) {
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: requestUrl || '',
        errorCode: errorCode || -1,
        errorMessage: `skip clearing invalid token response without request token${phase}: ${
          errorMessage || ''
        }`,
      });
      return { skip: true, authSessionSource };
    }

    return { skip: false, authSessionSource };
  }

  async handlePrimeLoginInvalidToken({
    requestAuthToken,
    errorCode,
    errorMessage,
    requestUrl,
  }: {
    requestAuthToken?: string;
    errorCode?: number;
    errorMessage?: string;
    requestUrl?: string;
  }): Promise<{
    cleared: boolean;
    authSessionSource?: EPrimeAuthSessionSource;
    // Auth-state commit generation observed in-lock at clear time; carried
    // into the PrimeLoginInvalidToken event so main-runtime handlers can
    // detect that a login committed after this clear and skip their stale
    // sign-outs (see the event payload doc in appEventBus).
    authStateGeneration?: number;
  }> {
    // Entry-time guard pass OUTSIDE authStateWriteMutex: skips cheaply
    // without contending on the lock, and performs the possibly-slow
    // Supabase session read (network-capable token refresh) before the
    // lock is taken, keeping the in-lock re-read fast (cached session).
    const entryGuards = await this.evaluateInvalidTokenClearGuards({
      requestAuthToken,
      errorCode,
      errorMessage,
      requestUrl,
      phase: '',
    });
    if (entryGuards.skip) {
      return {
        cleared: false,
        authSessionSource: entryGuards.authSessionSource,
      };
    }

    // Decide + write under authStateWriteMutex so the clear can never
    // interleave with a concurrent login commit. Guards are re-checked
    // inside the lock because a login may have committed a new source
    // and/or token between the entry-time reads above and lock
    // acquisition.
    const lockResult = await this.authStateWriteMutex.runExclusive(
      async (): Promise<{
        cleared: boolean;
        authSessionSource?: EPrimeAuthSessionSource;
        authStateGeneration?: number;
      }> => {
        const guards = await this.evaluateInvalidTokenClearGuards({
          requestAuthToken,
          errorCode,
          errorMessage,
          requestUrl,
          phase: ' (in-lock recheck)',
        });
        if (guards.skip) {
          return {
            cleared: false,
            authSessionSource: guards.authSessionSource,
          };
        }
        if (guards.authSessionSource !== entryGuards.authSessionSource) {
          // A login committed a different source while this handler waited
          // for the lock: the failed request belongs to the pre-login
          // session, so clearing now would wipe the fresh login.
          defaultLogger.prime.subscription.onekeyIdInvalidToken({
            url: requestUrl || '',
            errorCode: errorCode || -1,
            errorMessage: `skip clearing invalid token response because auth session source changed (in-lock recheck): ${
              errorMessage || ''
            }`,
          });
          return {
            cleared: false,
            authSessionSource: guards.authSessionSource,
          };
        }

        const sourceToClear =
          guards.authSessionSource ??
          EPrimeAuthSessionSource.LegacyEmailSupabase;
        // Read the commit generation in-lock so the emitted event carries
        // the exact auth-state epoch this clear belongs to (clears never
        // bump the generation — only login commits do).
        const authStateGeneration =
          await this.backgroundApi.simpleDb.prime.getAuthStateGeneration();
        // Write section: simpleDb + atom only — no network I/O while the
        // lock is held (clearAuthTokens is a simpleDb write plus a local
        // storage-cache clear; setPrimePersistAtomNotLoggedIn is atom +
        // local credential-cache writes).
        await this.backgroundApi.simpleDb.prime.clearAuthTokens();
        await this.setPrimePersistAtomNotLoggedIn();
        return {
          cleared: true,
          authSessionSource: sourceToClear,
          authStateGeneration,
        };
      },
    );

    if (!lockResult.cleared) {
      return lockResult;
    }

    // Per-source Supabase session clear deliberately runs OUTSIDE
    // authStateWriteMutex (auth.signOut can perform network I/O), but
    // through the generation-gated slot-queue clear: the generation
    // validation and the storage removal execute as one serial operation
    // (atomic w.r.t. login commits — see the method doc), so a login that
    // fully commits after the in-lock clear above can never have its fresh
    // session swept here.
    await this.clearAuthSessionIfGenerationStillMatches({
      authSessionSource:
        lockResult.authSessionSource ??
        EPrimeAuthSessionSource.LegacyEmailSupabase,
      expectedAuthStateGeneration: lockResult.authStateGeneration ?? 0,
      callerName: 'handlePrimeLoginInvalidToken',
    });
    return lockResult;
  }

  private async commitAuthSessionSourceBeforeAtomUpdate({
    authSessionSource,
    callerName,
  }: {
    authSessionSource: EPrimeAuthSessionSource;
    callerName: string;
  }) {
    await this.backgroundApi.simpleDb.prime.setAuthSessionSource(
      authSessionSource,
    );
    const authToken =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    if (!authToken) {
      defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
        reason: `${callerName}: auth session source committed but active token is not readable`,
      });
      await this.backgroundApi.simpleDb.prime.clearAuthTokens();
      await this.setPrimePersistAtomNotLoggedIn();
      throw new OneKeyLocalError(
        `${callerName} ERROR: Active auth token not found`,
      );
    }
    // Notify main-runtime session holders (SupabaseAuthProvider) that the
    // source changed. This must not rely on a primePersistAtom.isLoggedIn
    // flip: apiBindLegacyOneKeyIdOAuth switches LegacyEmailSupabase ->
    // KeylessOAuth while staying logged in, and bg-side setSession writes
    // (legacy keyless migration) emit no auth events in the main runtime.
    // On desktop/web (single runtime) the event is a harmless self-delivery.
    appEventBus.emit(EAppEventBusNames.PrimeAuthSessionSourceCommitted, {
      authSessionSource,
      callerName,
    });
  }

  @backgroundMethod()
  async apiLogin({
    accessToken,
    authSessionSource,
  }: {
    accessToken: string;
    authSessionSource?: EPrimeAuthSessionSource;
  }) {
    await this.loginMutex.runExclusive(async () => {
      if (!accessToken) {
        return;
      }
      // This endpoint (/prime/v1/user/login) only accepts legacy-realm
      // tokens, so the source is statically LegacyEmailSupabase. Never fall
      // back to the persisted source: a stale KeylessOAuth source would be
      // committed for a legacy-token login and getActiveAuthToken would then
      // read the wrong realm.
      const nextAuthSessionSource =
        authSessionSource ?? EPrimeAuthSessionSource.LegacyEmailSupabase;
      // Invalidation site (login): the active account/session is about to
      // change, so any user info cached before this login must not be served
      // to post-login callers.
      this.clearPrimeUserInfoCache();
      // Clear only the deprecated cached token, use the explicit request
      // header below. Keep authSessionSource so a transient login failure
      // cannot orphan a still-valid session (e.g. standalone Keyless OAuth).
      await this.backgroundApi.simpleDb.prime.clearCachedAuthToken();
      const client = await this.getPrimeClient();
      try {
        const response = await client.post<{
          data: IPrimeServerUserInfo;
        }>(
          '/prime/v1/user/login',
          {},
          {
            headers: {
              'X-Onekey-Request-Token': accessToken,
            },
          },
        );
        // Commit section (authStateWriteMutex, inner to loginMutex):
        // persist the auth session source and update the prime atom as one
        // atomic write, so the invalid-token cleanup can never observe —
        // and wipe — a half-committed login. The network POST above stays
        // outside this lock; it is held only for the few-ms local commit.
        await this.authStateWriteMutex.runExclusive(async () => {
          await this.commitAuthSessionSourceBeforeAtomUpdate({
            authSessionSource: nextAuthSessionSource,
            callerName: 'ServicePrime.apiLogin',
          });
          await this.updatePrimeAtomByServerUserInfo({
            serverUserInfo: response.data.data,
          });
        });
      } catch (error) {
        if (this.isPrimeLoginInvalidTokenError(error)) {
          // Confirmed invalid-token rejection: drop both the cached token
          // and the auth session source. Serialized like every other
          // source/token write so it cannot tear a concurrent writer.
          await this.authStateWriteMutex.runExclusive(async () => {
            // In-lock source guard (mirrors evaluateInvalidTokenClearGuards):
            // the rejected token belongs to THIS legacy-realm login attempt.
            // If the persisted source meanwhile points at a different realm
            // (a KeylessOAuth login committed concurrently, or this call
            // replayed a residual legacy token while a keyless session backs
            // the live login), clearing would wipe that session's source —
            // and a wiped KeylessOAuth source is never re-inferred.
            const persistedSource =
              await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
            if (persistedSource && persistedSource !== nextAuthSessionSource) {
              defaultLogger.prime.subscription.onekeyIdInvalidToken({
                url: '/prime/v1/user/login',
                errorCode: -1,
                errorMessage:
                  'ServicePrime.apiLogin: skip clearing auth tokens, persisted source belongs to another realm',
              });
              return;
            }
            await this.backgroundApi.simpleDb.prime.clearAuthTokens();
          });
        }
        // For any other failure (e.g. transient network error), keep the
        // persisted authSessionSource so the existing session stays usable
        // on retry.
        throw error;
      }
    });
  }

  @backgroundMethod()
  async apiOAuthLogin({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<IOneKeyIdOAuthLoginResponse> {
    return this.loginMutex.runExclusive(async () => {
      if (!accessToken) {
        throw new OneKeyLocalError('apiOAuthLogin ERROR: Invalid accessToken');
      }

      // Invalidation site (OAuth login): same as apiLogin — drop any
      // pre-login cached user info before the session changes.
      this.clearPrimeUserInfoCache();
      // Clear only the deprecated cached token (same rule as apiLogin): the
      // authSessionSource must survive a transient POST failure, because a
      // wiped KeylessOAuth source is never re-inferred (see
      // getEffectiveAuthSessionSource) and would permanently orphan a
      // still-valid keyless session. The source is committed after success.
      await this.backgroundApi.simpleDb.prime.clearCachedAuthToken();
      const client = await this.getPrimeClient();
      const result = await client.post<
        IApiClientResponse<IOneKeyIdOAuthLoginResponse>
      >(
        '/prime/v1/account/oauth/login',
        {},
        {
          headers: {
            'X-Onekey-Request-Token': accessToken,
          },
        },
      );
      const data = result?.data?.data;
      if (!data) {
        throw new OneKeyLocalError('apiOAuthLogin ERROR: Empty response data');
      }
      // Commit section (authStateWriteMutex, inner to loginMutex): source +
      // atom written as one atomic pair — see apiLogin. The POST above and
      // the legacy-session cleanup below (Supabase signOut, network-capable)
      // stay outside the lock.
      await this.authStateWriteMutex.runExclusive(async () => {
        await this.commitAuthSessionSourceBeforeAtomUpdate({
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          callerName: 'ServicePrime.apiOAuthLogin',
        });
        await this.updatePrimeAtomByOAuthLoginResponse({
          loginResponse: data,
        });
      });
      // Best-effort hygiene: the login is already committed atomically
      // above, so a failure here (e.g. transient storage error while
      // clearing the legacy slot) must not reject the whole login — the UI
      // would tear down the just-validated OAuth session and show a login
      // failure for a login that succeeded. Leftovers are re-cleaned by the
      // next login/bind/logout.
      try {
        await this.backgroundApi.simpleDb.prime.clearLegacyAuthSession();
      } catch (cleanupError) {
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason: `ServicePrime.apiOAuthLogin: post-commit legacy session cleanup failed: ${String(
            cleanupError,
          )}`,
        });
      }
      await this.cleanupLegacyKeylessSessionStorage({
        callerName: 'ServicePrime.apiOAuthLogin',
      });
      return data;
    });
  }

  @backgroundMethod()
  async apiFetchOneKeyIdProfile(): Promise<IOneKeyIdProfileResponse> {
    await this.loginMutex.waitForUnlock();
    const authToken =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    if (!authToken) {
      throw new OneKeyLocalError(
        'apiFetchOneKeyIdProfile ERROR: Active auth token not found',
      );
    }

    const client = await this.getPrimeClient();
    const result = await client.get<
      IApiClientResponse<IOneKeyIdProfileResponse>
    >('/prime/v1/account/profile');
    const data = result?.data?.data;
    if (!data?.onekeyAccount) {
      throw new OneKeyLocalError('apiFetchOneKeyIdProfile ERROR: Empty data');
    }
    return data;
  }

  @backgroundMethod()
  async isLegacyOneKeyIdOAuthBindRequired(): Promise<boolean> {
    const isLoggedIn = await this.isLoggedIn();
    if (!isLoggedIn) {
      return false;
    }

    const authSessionSource =
      await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
    if (!authSessionSource) {
      // No persisted source and no legacy token: the only remaining candidate
      // is a standalone Keyless OAuth session, which never requires the
      // legacy bind. Still probe it so retryable keyless auth errors
      // propagate as before, but only in this branch — the keyless getSession
      // can trigger a network refresh and must not run when the legacy source
      // is already resolved.
      await this.backgroundApi.simpleDb.prime.getKeylessSupabaseAuthToken();
      return false;
    }

    if (authSessionSource !== EPrimeAuthSessionSource.LegacyEmailSupabase) {
      return false;
    }

    // Fast path: consult the cached OneKey ID account before hitting the
    // network. Binding is monotonic — identities are only ever added (there
    // is no unbind flow) — so a cached "OAuth already bound" can never be
    // stale-wrong, and we can skip the profile GET entirely. The reverse
    // (cache says the OAuth identity is missing, or identities are absent)
    // must still be confirmed by the server below, to avoid nagging users
    // who bound on another device.
    // Only trust the cache when it plausibly belongs to the current login:
    // the atom-level onekeyUserId must match the cached account's own
    // onekeyUserId. (The atom is also reset on logout/user-change, so a
    // cross-user leftover should not survive here anyway.)
    const { onekeyUserId: cachedUserId, onekeyAccount: cachedAccount } =
      await primePersistAtom.get();
    if (
      cachedUserId &&
      cachedAccount?.onekeyUserId === cachedUserId &&
      (cachedAccount.identities?.length ?? 0) > 0 &&
      !isLegacyOneKeyIdAccountMissingOAuthIdentity(cachedAccount)
    ) {
      return false;
    }

    const profile = await this.apiFetchOneKeyIdProfile();
    return isLegacyOneKeyIdAccountMissingOAuthIdentity(profile.onekeyAccount);
  }

  // Dedicated mutex for the local-keyless upgrade bind prompt gate. Do NOT
  // reuse loginMutex: isLegacyOneKeyIdOAuthBindRequired() ->
  // apiFetchOneKeyIdProfile() waits for loginMutex to unlock and would
  // deadlock if the gate itself held it.
  localKeylessUpgradeBindPromptCheckMutex = new Semaphore(1);

  /**
   * Atomically decide whether the local-keyless upgrade bind prompt should
   * be auto-shown, and persist the per-user throttle timestamp for every
   * completed check (not only when the dialog is actually shown), so that:
   * - concurrent UI contexts (in the extension, popup / sidepanel / expanded
   *   tab all share this single bg runtime) cannot both get `true` and
   *   double-prompt: `runExclusive` serializes callers and the throttle mark
   *   happens before the mutex is released, closing the check-then-mark gap;
   * - the expensive pipeline (local keyless prepare + keyless getSession +
   *   network profile GET) runs at most once per throttle window even when
   *   the outcome is "no prompt needed" (no local keyless wallet, or
   *   bindRequired=false), instead of on every app start and unlock.
   *
   * Transient failures (prepare / profile fetch errors) do NOT consume the
   * throttle, so the next check retries — matching the previous UI-side
   * behavior.
   *
   * NOTE: the throttle window is consumed as soon as this method returns
   * `true`. If the calling UI context then fails to actually show the dialog
   * (e.g. the app gets locked while the result is in flight), the prompt
   * waits for the next throttle window. This is an accepted trade-off of
   * the atomic gate.
   *
   * Explicit user-triggered bind flows (after legacy email OTP login, or the
   * keyless-create bind step) intentionally bypass this gate and its
   * throttle; they show the dialog directly.
   */
  @backgroundMethod()
  async checkAndMarkShouldShowLocalKeylessUpgradeBindPrompt({
    onekeyUserId,
    trigger,
  }: {
    onekeyUserId: string;
    trigger: string;
  }): Promise<boolean> {
    if (!onekeyUserId) {
      return false;
    }
    return this.localKeylessUpgradeBindPromptCheckMutex.runExclusive(
      async () => {
        const isThrottled =
          await this.backgroundApi.simpleDb.prime.hasShownLocalKeylessUpgradeBindPrompt(
            {
              onekeyUserId,
            },
          );
        if (isThrottled) {
          return false;
        }

        let hasLocalKeylessWallet = false;
        try {
          const result =
            await this.backgroundApi.serviceKeylessWallet.prepareOneKeyIdLoginWithLocalKeyless();
          hasLocalKeylessWallet =
            result.status !==
            EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless;
        } catch (error) {
          console.error(
            `ServicePrime.checkAndMarkShouldShowLocalKeylessUpgradeBindPrompt(${trigger}): local keyless prepare failed:`,
            error,
          );
          // Transient failure: keep the throttle unset so the next check
          // retries.
          return false;
        }

        if (!hasLocalKeylessWallet) {
          // Definitive "no prompt needed" outcome: consume the throttle
          // window so the local keyless prepare does not rerun on every
          // unlock.
          await this.backgroundApi.simpleDb.prime.markLocalKeylessUpgradeBindPromptShown(
            {
              onekeyUserId,
            },
          );
          return false;
        }

        let bindRequired = false;
        try {
          bindRequired = await this.isLegacyOneKeyIdOAuthBindRequired();
        } catch (error) {
          console.error(
            `ServicePrime.checkAndMarkShouldShowLocalKeylessUpgradeBindPrompt(${trigger}): bind required check failed:`,
            error,
          );
          // Transient failure (e.g. profile GET network error): keep the
          // throttle unset so the next check retries.
          return false;
        }

        // Persist the throttle for both outcomes: bindRequired=true is about
        // to show the dialog, and bindRequired=false must not re-run the
        // network profile GET on every unlock. The mark happens inside the
        // mutex, before any concurrent caller can re-enter the throttle
        // check above.
        await this.backgroundApi.simpleDb.prime.markLocalKeylessUpgradeBindPromptShown(
          {
            onekeyUserId,
          },
        );
        return bindRequired;
      },
    );
  }

  @backgroundMethod()
  @toastIfError()
  async apiBindLegacyOneKeyIdOAuth({
    oauthAccessToken,
  }: {
    oauthAccessToken: string;
  }): Promise<IOneKeyIdOAuthBindResponse> {
    return this.loginMutex.runExclusive(async () => {
      if (!oauthAccessToken) {
        throw new OneKeyLocalError(
          'apiBindLegacyOneKeyIdOAuth ERROR: Invalid oauthAccessToken',
        );
      }

      const legacyOneKeyIdAuthToken =
        await this.backgroundApi.simpleDb.prime.getSupabaseAuthToken();
      if (!legacyOneKeyIdAuthToken) {
        throw new OneKeyLocalError(
          'apiBindLegacyOneKeyIdOAuth ERROR: Legacy auth token not found',
        );
      }

      const client = await this.getPrimeClient();
      let result: {
        data: IApiClientResponse<IOneKeyIdOAuthBindResponse>;
      };
      try {
        result = await client.post<
          IApiClientResponse<IOneKeyIdOAuthBindResponse>
        >('/prime/v1/account/identities/oauth/bind', {
          token: oauthAccessToken,
          legacyOneKeyIdAuthToken,
        });
      } catch (error) {
        if (this.isOneKeyIdOAuthIdentityAlreadyBoundError(error)) {
          throw this.buildOneKeyIdOAuthIdentityAlreadyBoundError(error);
        }
        throw error;
      }
      const data = result?.data?.data;
      if (!data?.onekeyAccount) {
        throw new OneKeyLocalError(
          'apiBindLegacyOneKeyIdOAuth ERROR: Empty response data',
        );
      }

      // Commit section (authStateWriteMutex, inner to loginMutex): source +
      // atom written as one atomic pair — see apiLogin. The bind POST above
      // and the legacy-session cleanup below (Supabase signOut,
      // network-capable) stay outside the lock.
      await this.authStateWriteMutex.runExclusive(async () => {
        await this.commitAuthSessionSourceBeforeAtomUpdate({
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          callerName: 'ServicePrime.apiBindLegacyOneKeyIdOAuth',
        });
        await this.updatePrimeAtomByOneKeyIdAccount({
          onekeyAccount: data.onekeyAccount,
        });
      });
      await this.backgroundApi.simpleDb.prime.clearLegacyAuthSession();
      await this.cleanupLegacyKeylessSessionStorage({
        callerName: 'ServicePrime.apiBindLegacyOneKeyIdOAuth',
      });

      // Invalidation site (bind): the account identity / auth session source
      // just changed on the server, so the refresh below (and any
      // focus-triggered refetch) must hit the network instead of returning a
      // pre-bind cached result.
      this.clearPrimeUserInfoCache();
      void this.apiFetchPrimeUserInfo().catch((error) => {
        defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
          reason: `ServicePrime.apiBindLegacyOneKeyIdOAuth: refresh user info failed: ${String(
            error,
          )}`,
        });
      });

      return data;
    });
  }

  /**
   * Single source of truth for the bg-side "log out of OneKey ID" local
   * cleanup policy:
   * - preserveLocalKeylessAuth: drop only the OneKey ID login state (cached
   *   auth tokens + legacy email Supabase session) and keep the local Keyless
   *   OAuth session usable;
   * - otherwise: destroy every local auth session, including the legacy
   *   Keyless OAuth token storage.
   * Always resets the Prime persist atom to the not-logged-in state.
   * Note: this only clears bg-runtime state and the shared native session
   * storage; main-runtime Supabase clients keep their own in-memory session,
   * so UI call sites must sign those out in the main runtime separately.
   */
  @backgroundMethod()
  async clearOneKeyIdAuthState({
    preserveLocalKeylessAuth,
    callerName,
  }: {
    preserveLocalKeylessAuth?: boolean;
    callerName: string;
  }) {
    // Decide + write under authStateWriteMutex: the persisted-source wipe
    // and the atom reset must be atomic with respect to a concurrent login
    // commit (see authStateWriteMutex), otherwise the interleaving could
    // leave the atom logged-in with a wiped source (orphaned session) or
    // logged-out right after a successful commit. The Supabase session
    // clears below (auth.signOut, network-capable) intentionally stay
    // OUTSIDE the lock: once the source is wiped and the atom is reset,
    // the logout decision is committed, and the session-storage sweep is
    // best-effort cleanup that must not extend the lock hold time.
    await this.authStateWriteMutex.runExclusive(async () => {
      await this.backgroundApi.simpleDb.prime.clearAuthTokens();
      await this.setPrimePersistAtomNotLoggedIn();
    });
    if (preserveLocalKeylessAuth) {
      await this.backgroundApi.simpleDb.prime.clearLegacyAuthSession();
    } else {
      await this.cleanupLegacyKeylessSessionStorage({ callerName });
      // clearLocalAuthSession repeats clearAuthTokens (idempotent) before
      // sweeping every Supabase session storage key.
      await this.backgroundApi.simpleDb.prime.clearLocalAuthSession();
    }
  }

  /**
   * Guarded "reset to logged-out only if there is really no active token",
   * for UI startup effects that observe a missing-token state. Unlike
   * clearOneKeyIdAuthState (an explicit logout decision), the clear here is
   * committed under authStateWriteMutex with an in-lock re-read, so it can
   * never interleave with a concurrent login commit and wipe a
   * just-committed authSessionSource — a wiped KeylessOAuth source is never
   * re-inferred (see getEffectiveAuthSessionSource) and would permanently
   * orphan a still-valid keyless session. Retryable auth errors (transient
   * refresh failures) skip the clear entirely: the session may still be
   * valid and must not be destroyed over a network blip.
   */
  @backgroundMethod()
  async clearOneKeyIdAuthStateIfNoActiveToken({
    callerName,
  }: {
    callerName: string;
  }): Promise<{ cleared: boolean }> {
    // Entry-time read OUTSIDE the lock: performs the possibly-slow Supabase
    // session read (network-capable token refresh) before the lock is taken,
    // keeping the in-lock re-read fast (cached session) — same pattern as
    // handlePrimeLoginInvalidToken.
    const entryRead = await readAuthTokenAllowingRetryableAuthError(() =>
      this.backgroundApi.simpleDb.prime.getActiveAuthToken(),
    );
    if (entryRead.retryableError || entryRead.token) {
      return { cleared: false };
    }
    return this.authStateWriteMutex.runExclusive(async () => {
      // In-lock re-check: a login commit may have finished between the
      // entry-time read above and lock acquisition.
      const read = await readAuthTokenAllowingRetryableAuthError(() =>
        this.backgroundApi.simpleDb.prime.getActiveAuthToken(),
      );
      if (read.retryableError || read.token) {
        defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
          reason: `${callerName}: skip no-active-token clear, a token appeared or the refresh failed (in-lock recheck)`,
        });
        return { cleared: false };
      }
      await this.backgroundApi.simpleDb.prime.clearAuthTokens();
      await this.setPrimePersistAtomNotLoggedIn();
      return { cleared: true };
    });
  }

  /**
   * Generation-gated per-realm session-slot deletion, serialized on the
   * bg-owned session slot queue (see runExclusiveOnAuthSessionSlot).
   *
   * Race-free structure:
   * 1. Slot queue (outer): no two deletions of the same realm interleave.
   * 2. authStateWriteMutex (inner): [generation validation + storage-key
   *    removal] execute atomically w.r.t. login commits — both are local
   *    writes, allowed under the lock policy. A commit that already
   *    finished bumped the generation, so the validation skips; a commit
   *    still waiting on the mutex re-reads its active token AFTER this
   *    removal and fails safe (clears + throws), so the worst racing
   *    outcome is one visibly failed login retry — never a logged-in
   *    atom/source pointing at an empty session slot.
   * 3. Server-side revocation (network-capable) runs after the gated
   *    removal, inside the slot queue but outside authStateWriteMutex,
   *    using ONLY the in-lock token snapshot. Deliberately NOT auth-js
   *    signOut: signOut RE-READS the shared slot and ends with
   *    _removeSession(), so a fresh OAuth setSession landing between the
   *    gated removal and the signOut (before its apiOAuthLogin commit
   *    bumps the generation) would be revoked server-side and deleted
   *    locally — the exact credential loss this method exists to prevent.
   */
  @backgroundMethod()
  async clearAuthSessionIfGenerationStillMatches({
    authSessionSource,
    expectedAuthStateGeneration,
    callerName,
  }: {
    authSessionSource: EPrimeAuthSessionSource;
    expectedAuthStateGeneration: number;
    callerName: string;
  }): Promise<{ cleared: boolean; generationChanged?: boolean }> {
    return runExclusiveOnAuthSessionSlot(authSessionSource, async () => {
      const lockOutcome = await this.authStateWriteMutex.runExclusive(
        async (): Promise<{
          removed: boolean;
          accessTokenToRevoke: string;
        }> => {
          const currentGeneration =
            await this.backgroundApi.simpleDb.prime.getAuthStateGeneration();
          if (currentGeneration !== expectedAuthStateGeneration) {
            defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
              reason: `${callerName}: skip session-slot clear, a login committed after the caller snapshot (generation ${expectedAuthStateGeneration} -> ${currentGeneration})`,
            });
            return { removed: false, accessTokenToRevoke: '' };
          }
          // Snapshot the slot's access token BEFORE removing it, so the
          // post-lock server revocation targets exactly the session this
          // gated deletion decided to destroy — never a later write.
          const accessTokenToRevoke =
            await readPersistedAccessTokenBySessionSource(authSessionSource);
          await removeAuthSessionStorageBySessionSource(authSessionSource);
          return { removed: true, accessTokenToRevoke };
        },
      );
      if (!lockOutcome.removed) {
        return { cleared: false, generationChanged: true };
      }
      await revokeAuthSessionTokenOnServerBestEffort({
        authSessionSource,
        accessToken: lockOutcome.accessTokenToRevoke,
      });
      return { cleared: true };
    });
  }

  /**
   * Guarded destructive clear for keyless-session teardown
   * (ServiceKeylessWallet.clearKeylessAuthSessionAndLoginState): wipes the
   * auth-state pair only when the CURRENT persisted source is still
   * KeylessOAuth. The caller's session clear can involve a slow signOut, so
   * deciding on a pre-clear source snapshot could race a login commit that
   * lands in between and wipe the fresh login; the in-lock re-read under
   * authStateWriteMutex closes that window.
   *
   * The source-only re-read cannot distinguish "the same KeylessOAuth login
   * the caller decided to tear down" from "a FRESH KeylessOAuth login that
   * committed while the caller's session clear awaited" — both read as
   * KeylessOAuth. Callers therefore pass `expectedAuthStateGeneration`
   * (snapshotted BEFORE their session clear): a fresh commit bumps the
   * generation, and the in-lock comparison skips the wipe with
   * `generationChanged: true` so the caller can also suppress its stale
   * follow-up broadcasts (e.g. KeylessAuthSessionCleared).
   */
  @backgroundMethod()
  async clearOneKeyIdAuthStateIfSourceStillKeylessOAuth({
    callerName,
    expectedAuthStateGeneration,
  }: {
    callerName: string;
    expectedAuthStateGeneration?: number;
  }): Promise<{ cleared: boolean; generationChanged?: boolean }> {
    return this.authStateWriteMutex.runExclusive(async () => {
      if (expectedAuthStateGeneration !== undefined) {
        const currentGeneration =
          await this.backgroundApi.simpleDb.prime.getAuthStateGeneration();
        if (currentGeneration !== expectedAuthStateGeneration) {
          defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
            reason: `${callerName}: skip keyless-source clear, a login committed while the caller's session clear was in flight (generation ${expectedAuthStateGeneration} -> ${currentGeneration})`,
          });
          return { cleared: false, generationChanged: true };
        }
      }
      const source =
        await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
      if (source !== EPrimeAuthSessionSource.KeylessOAuth) {
        defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
          reason: `${callerName}: skip keyless-source clear, current source is ${
            source ?? 'undefined'
          } (in-lock recheck)`,
        });
        return { cleared: false };
      }
      await this.backgroundApi.simpleDb.prime.clearAuthTokens();
      await this.setPrimePersistAtomNotLoggedIn();
      return { cleared: true };
    });
  }

  @backgroundMethod()
  async apiLogout({
    preserveLocalKeylessAuth,
  }: {
    preserveLocalKeylessAuth?: boolean;
  } = {}) {
    const currentAtomValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `ServicePrime.apiLogout: starting logout for user ${currentAtomValue.onekeyUserId}`,
    });

    const tokenRead = await readAuthTokenAllowingRetryableAuthError(() =>
      preserveLocalKeylessAuth
        ? this.backgroundApi.simpleDb.prime.getSupabaseAuthToken()
        : this.backgroundApi.simpleDb.prime.getActiveAuthToken(),
    );
    if (tokenRead.retryableError) {
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: `ServicePrime.apiLogout: skip server logout because auth refresh failed: ${String(
          tokenRead.retryableError,
        )}`,
      });
    }
    const authToken = tokenRead.token;
    if (!authToken) {
      defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
        reason:
          'ServicePrime.apiLogout: simpleDb.prime.getActiveAuthToken() is null',
      });
      await this.clearOneKeyIdAuthState({
        preserveLocalKeylessAuth,
        callerName: 'ServicePrime.apiLogout',
      });
      return;
    }
    const client = await this.getPrimeClient();
    try {
      await client.post(
        '/prime/v1/user/logout',
        {},
        {
          headers: {
            'X-Onekey-Request-Token': authToken,
          },
        },
      );
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: 'ServicePrime.apiLogout: server logout success',
      });
    } catch (e) {
      console.error(e);
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: `ServicePrime.apiLogout: server logout failed: ${String(e)}`,
      });
      const error = e as OneKeyError | undefined;
      if (error && error?.key === 'id.login_expired_description') {
        error.autoToast = false;
      }
      throw e;
    } finally {
      // Server logout is best-effort; local state must always clear so
      // the UI cannot keep rendering the previously-logged-in account.
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: 'ServicePrime.apiLogout: clearing local token and atom',
      });
      await this.clearOneKeyIdAuthState({
        preserveLocalKeylessAuth,
        callerName: 'ServicePrime.apiLogout',
      });
      const clearedAtomValue = await primePersistAtom.get();
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: `ServicePrime.apiLogout: atom cleared, isLoggedIn=${clearedAtomValue.isLoggedIn}, onekeyUserId=${clearedAtomValue.onekeyUserId}`,
      });
    }
  }

  @backgroundMethod()
  async apiLogoutPrimeUserDevice({
    instanceId,
    accessToken,
  }: {
    instanceId: string;
    accessToken: string;
  }) {
    // eslint-disable-next-line no-param-reassign
    accessToken =
      accessToken ||
      (await this.backgroundApi.simpleDb.prime.getActiveAuthToken());
    const client = await this.getPrimeClient();
    // TODO 404 not found
    await client.post(
      `/prime/v1/user/device/${instanceId}`,
      {},
      {
        headers: {
          'X-Onekey-Request-Token': accessToken,
        },
      },
    );
    if (instanceId) {
      // Re-login through the endpoint matching the active auth session
      // source: a KeylessOAuth session token belongs to the keyless Supabase
      // realm and must go to /prime/v1/account/oauth/login — posting it to
      // the legacy /prime/v1/user/login could be rejected as an invalid
      // legacy token and cascade into a full logout.
      const authSessionSource =
        await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
      if (authSessionSource === EPrimeAuthSessionSource.KeylessOAuth) {
        await this.apiOAuthLogin({ accessToken });
      } else {
        await this.apiLogin({ accessToken });
      }
      // Refresh from profile + legacy user info for accurate
      // isPrimeDeviceLimitExceeded, as the login endpoint may return stale
      // device limit data after removal.
      try {
        const serverUserInfo = await this.callApiFetchPrimeUserInfo();
        if (serverUserInfo) {
          await this.updatePrimeAtomByServerUserInfo({ serverUserInfo });
        }
      } catch (e) {
        // Log but don't fail — apiLogin already updated the atom with best-effort data
        console.error(e);
      }
    }
  }

  @backgroundMethod()
  async apiGetPrimeUserDevices({ accessToken }: { accessToken?: string } = {}) {
    const client = await this.getPrimeClient();
    // eslint-disable-next-line no-param-reassign
    accessToken =
      accessToken ||
      (await this.backgroundApi.simpleDb.prime.getActiveAuthToken());
    const result = await client.get<IApiClientResponse<IPrimeDeviceInfo[]>>(
      '/prime/v1/user/devices',
      {
        headers: {
          'X-Onekey-Request-Token': accessToken,
        },
      },
    );
    const devices = result?.data?.data;
    return devices;
  }

  @backgroundMethod()
  async callApiFetchPrimeUserInfo(): Promise<IPrimeServerUserInfoWithProfile> {
    const client = await this.getPrimeClient();
    // Snapshot the token AND pin it as the explicit request header (the
    // ServiceBase interceptor respects a pre-set header). Without pinning,
    // the interceptor would re-read the active token at send time, so a
    // refresh/re-login between this snapshot and the send would make the
    // requests carry a token different from `requestAuthToken` — and the
    // HTTP-200 body-code 90002/90003 cleanup below would compare its
    // stale-token guard against the wrong snapshot. Pinning keeps the
    // recorded, sent, and judged token identical. An empty snapshot is
    // falsy, so the interceptor falls back to the live token exactly as
    // before — matching the `!requestAuthToken` guard in
    // evaluateInvalidTokenClearGuards.
    const requestAuthToken =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = {
      autoHandleError: false,
      headers: {
        'X-Onekey-Request-Token': requestAuthToken,
      },
    };
    const profileRequest = client
      .get<
        IPrimeApiClientResponse<IOneKeyIdProfileResponse>
      >('/prime/v1/account/profile', requestConfig)
      .then((response) =>
        this.getPrimeApiResponseData({
          response,
          fallbackMessage:
            'callApiFetchPrimeUserInfo ERROR: profile empty data',
        }),
      );
    const serverUserInfoRequest = client
      .get<
        IPrimeApiClientResponse<IPrimeServerUserInfo>
      >('/prime/v1/user/info', requestConfig)
      .then((response) =>
        this.getPrimeApiResponseData({
          response,
          fallbackMessage:
            'callApiFetchPrimeUserInfo ERROR: user info empty data',
        }),
      );
    const [profileResult, serverUserInfoResult] = await Promise.allSettled([
      profileRequest,
      serverUserInfoRequest,
    ]);

    await this.throwIfAllPrimeUserInfoRequestsFailedByInvalidTokenError({
      results: [profileResult, serverUserInfoResult],
      requestAuthToken,
    });

    const profile =
      profileResult.status === 'fulfilled' ? profileResult.value : undefined;
    const serverUserInfo =
      serverUserInfoResult.status === 'fulfilled'
        ? serverUserInfoResult.value
        : undefined;

    if (serverUserInfo) {
      return this.mergeDefinedPrimeServerUserInfo({
        serverUserInfo,
        profile,
      });
    }

    if (this.isCompletePrimeServerUserInfo(profile)) {
      return profile;
    }

    if (serverUserInfoResult.status === 'rejected') {
      if (profile) {
        throw new OneKeyLocalError(
          'callApiFetchPrimeUserInfo ERROR: profile incomplete and user info unavailable',
        );
      }
      throw serverUserInfoResult.reason;
    }

    throw new OneKeyLocalError('callApiFetchPrimeUserInfo ERROR: Empty data');
  }

  @backgroundMethod()
  async apiFetchServerRandomIdInfo() {
    const client = await this.getPrimeClient();
    const result = await client.get<IApiClientResponse<{ uuid: string }>>(
      '/prime/v1/general/get-random-id',
    );
    const randomId = result?.data?.data;
    return randomId;
  }

  @backgroundMethod()
  async apiFetchPhoneOtp({ email, otp }: { email: string; otp: string }) {
    const client = await this.getPrimeClient();

    const result = await client.post<
      IApiClientResponse<{ phone: string; otp: string }>
    >('/prime/v1/general/phone-otp', {
      email,
      otp,
    });

    return result?.data?.data;
  }

  async updatePrimeAtomByServerUserInfo({
    serverUserInfo,
  }: {
    serverUserInfo: IPrimeServerUserInfo;
  }) {
    const beforeValue = await primePersistAtom.get();
    const onekeyAccount = (serverUserInfo as Partial<IOneKeyIdProfileResponse>)
      .onekeyAccount;
    const serverUserId = serverUserInfo?.userId ?? onekeyAccount?.onekeyUserId;
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `updatePrimeAtomByServerUserInfo: before update, atom isPrime=${beforeValue.primeSubscription?.isActive}, atom userId=${beforeValue.onekeyUserId}, server isPrime=${serverUserInfo?.isPrime}, server userId=${serverUserId}`,
    });

    let primeSubscription: IPrimeSubscriptionInfo | undefined;
    if (serverUserInfo.isPrime) {
      primeSubscription = {
        isActive: true,
        expiresAt: serverUserInfo.primeExpiredAt,
        willRenew: serverUserInfo.willRenew,
        subscriptions: serverUserInfo.subscriptions,
      };
    } else {
      primeSubscription = undefined;
    }

    const serverManagementUrl =
      serverUserInfo.subscriptions?.[0]?.managementUrl;

    // Sync the server KYT state into the settings cache before exposing
    // onekeyUserId, so the settings switch and intro dialog gate (both keyed by
    // onekeyUserId) read the latest interface value once the user becomes active.
    await this.backgroundApi.serviceSetting.syncKytEnabledFromServer({
      onekeyUserId: serverUserId,
      kytEnabled: serverUserInfo?.kytEnabled,
    });

    await primePersistAtom.set((v): IPrimePersistAtomData => {
      const userEmail =
        onekeyAccount?.normalizedEmail ??
        serverUserInfo?.emails?.[0] ??
        undefined;
      // Keep the previous displayEmail when neither response carries one
      // (e.g. the profile GET failed while /user/info succeeded, or the
      // endpoint omits the optional field) — mirrors the onekeyAccount
      // preservation below so a partial refresh cannot blank the UI email.
      const displayEmail =
        onekeyAccount?.displayEmail ??
        serverUserInfo?.displayEmail ??
        v.displayEmail;
      const shouldKeepExistingOneKeyAccount =
        !onekeyAccount && v.onekeyAccount?.onekeyUserId === serverUserId;
      return {
        ...v,
        avatar: serverUserInfo?.avatar,
        nickname: serverUserInfo?.nickname,
        email: userEmail, // TODO update from PrimeGlobalEffect
        displayEmail,
        onekeyUserId: serverUserId,
        onekeyAccount:
          onekeyAccount ??
          (shouldKeepExistingOneKeyAccount ? v.onekeyAccount : undefined),
        isEnablePrime: serverUserInfo?.isEnablePrime,
        isEnableSandboxPay: serverUserInfo?.isEnableSandboxPay,
        isPrimeDeviceLimitExceeded: serverUserInfo?.isPrimeDeviceLimitExceeded,
        isLoggedIn: true,
        isLoggedInOnServer: true,
        primeSubscription,
        // Fallback: use server managementUrl when local SDK hasn't set it yet
        subscriptionManageUrl: v.subscriptionManageUrl || serverManagementUrl,
        // salt: serverUserInfo.salt,
        // pwdHash: serverUserInfo.pwdHash,
      };
    });

    const afterValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `updatePrimeAtomByServerUserInfo: after update, atom isPrime=${afterValue.primeSubscription?.isActive}, atom userId=${afterValue.onekeyUserId}`,
    });

    if (serverUserInfo?.inviteCode) {
      await this.backgroundApi.serviceReferralCode.updateMyReferralCode(
        serverUserInfo.inviteCode,
      );
    }

    return {
      primeSubscription,
    };
  }

  async updatePrimeAtomByOAuthLoginResponse({
    loginResponse,
  }: {
    loginResponse: IOneKeyIdOAuthLoginResponse;
  }) {
    const { onekeyAccount } = loginResponse;
    const serverUserId = loginResponse.userId ?? onekeyAccount.onekeyUserId;
    const serverManagementUrl = loginResponse.subscriptions?.[0]?.managementUrl;

    await this.backgroundApi.serviceSetting.syncKytEnabledFromServer({
      onekeyUserId: serverUserId,
      kytEnabled: loginResponse.kytEnabled,
    });

    await primePersistAtom.set((v): IPrimePersistAtomData => {
      // Only reuse previous atom values as fallbacks when the incoming login
      // belongs to the same user, otherwise the previous account's data
      // (email/avatar/nickname/subscription) would leak into the new login.
      const isSameUser =
        Boolean(serverUserId) &&
        (v.onekeyUserId === serverUserId ||
          v.onekeyAccount?.onekeyUserId === serverUserId);
      const prevPrimeSubscription = isSameUser
        ? v.primeSubscription
        : undefined;
      let primeSubscription = prevPrimeSubscription;
      if (loginResponse.isPrime !== undefined) {
        primeSubscription = loginResponse.isPrime
          ? ({
              isActive: true,
              expiresAt:
                loginResponse.primeExpiredAt ??
                prevPrimeSubscription?.expiresAt ??
                0,
              willRenew: loginResponse.willRenew,
              subscriptions: loginResponse.subscriptions,
            } satisfies IPrimeSubscriptionInfo)
          : undefined;
      }
      const userEmail =
        onekeyAccount.normalizedEmail ??
        loginResponse.emails?.[0] ??
        (isSameUser ? v.email : undefined);
      const displayEmail = onekeyAccount.displayEmail;
      return {
        ...v,
        avatar: loginResponse.avatar ?? (isSameUser ? v.avatar : undefined),
        nickname:
          loginResponse.nickname ?? (isSameUser ? v.nickname : undefined),
        email: userEmail,
        displayEmail,
        onekeyUserId: onekeyAccount.onekeyUserId,
        onekeyAccount,
        isEnablePrime:
          loginResponse.isEnablePrime ??
          (isSameUser ? v.isEnablePrime : undefined),
        isEnableSandboxPay:
          loginResponse.isEnableSandboxPay ??
          (isSameUser ? v.isEnableSandboxPay : undefined),
        isPrimeDeviceLimitExceeded:
          loginResponse.isPrimeDeviceLimitExceeded ??
          (isSameUser ? v.isPrimeDeviceLimitExceeded : undefined),
        isLoggedIn: true,
        isLoggedInOnServer: true,
        primeSubscription,
        // Server managementUrl wins when provided; never keep the previous
        // account's url across a user change.
        subscriptionManageUrl:
          serverManagementUrl ||
          (isSameUser ? v.subscriptionManageUrl : undefined),
      };
    });

    if (loginResponse.inviteCode) {
      await this.backgroundApi.serviceReferralCode.updateMyReferralCode(
        loginResponse.inviteCode,
      );
    }
  }

  async updatePrimeAtomByOneKeyIdAccount({
    onekeyAccount,
  }: {
    onekeyAccount: IOneKeyIdAccount;
  }) {
    await primePersistAtom.set((v): IPrimePersistAtomData => {
      const userEmail = onekeyAccount.normalizedEmail ?? v.email;
      const displayEmail = onekeyAccount.displayEmail;
      return {
        ...v,
        email: userEmail,
        displayEmail,
        onekeyUserId: onekeyAccount.onekeyUserId,
        onekeyAccount,
        isLoggedIn: true,
        isLoggedInOnServer: true,
      };
    });
  }

  /**
   * Single-flight + short-TTL cache for apiFetchPrimeUserInfo.
   *
   * Why: at startup two independent PrimeGlobalEffect effects call
   * apiFetchPrimeUserInfo ~600ms apart, and OneKeyIdLegacyOAuthBindPrompt
   * re-fetches on every page focus. Each call costs 2 HTTP GETs
   * (/prime/v1/account/profile + /prime/v1/user/info) plus a full
   * primePersistAtom rewrite, so rapid duplicate calls are pure waste.
   * Deduping here (bg runtime) keeps every call site unchanged.
   *
   * TTL choice (3s): long enough to collapse the startup double-fetch and
   * rapid focus toggles, short enough not to mask genuine refreshes (e.g.
   * post-purchase refetch, websocket-triggered refresh, master-password
   * checks). Auth-state changes never rely on the TTL expiring: every
   * login / logout / bind / invalid-token / profile-update path explicitly
   * clears this cache — see clearPrimeUserInfoCache call sites.
   *
   * Rejected promises are never replayed: memoizee promise mode ("then")
   * deletes the cache entry on rejection, so an invalid-token failure (via
   * throwIfAllPrimeUserInfoRequestsFailedByInvalidTokenError) or a network
   * error is always re-fetched on the next call.
   */
  private _fetchPrimeUserInfoWithCache = memoizee(
    async () => this._fetchPrimeUserInfo(),
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 3 }),
    },
  );

  /**
   * Drop any cached (or in-flight) prime user info result so the next
   * apiFetchPrimeUserInfo call hits the network. MUST be called whenever the
   * auth session or the server-side profile changes. Clearing while a fetch
   * is in flight is safe: memoizee guards deleted-while-pending entries and
   * simply never caches their result.
   */
  private clearPrimeUserInfoCache() {
    void this._fetchPrimeUserInfoWithCache.clear();
  }

  @backgroundMethod()
  async apiFetchPrimeUserInfo(): Promise<{
    userInfo: IPrimeUserInfo;
    serverUserInfo: IPrimeServerUserInfo | undefined;
    primeSubscription: IPrimeSubscriptionInfo | undefined;
  }> {
    // Deduped: concurrent calls share a single in-flight request, and calls
    // arriving within a short TTL reuse the previous result. See
    // _fetchPrimeUserInfoWithCache for the TTL and invalidation contract.
    return this._fetchPrimeUserInfoWithCache();
  }

  private async _fetchPrimeUserInfo(): Promise<{
    userInfo: IPrimeUserInfo;
    serverUserInfo: IPrimeServerUserInfo | undefined;
    primeSubscription: IPrimeSubscriptionInfo | undefined;
  }> {
    console.log('call servicePrime.apiFetchPrimeUserInfo');
    await this.loginMutex.waitForUnlock();
    // Snapshot the RESOLVED source (not the raw persisted one): the
    // getActiveAuthToken() call below runs the self-healing resolver, which
    // persists LegacyEmailSupabase for pre-authSessionSource legacy sessions.
    // A raw before-snapshot (undefined) would then differ from the
    // after-snapshot (legacy) and falsely discard the first valid response
    // after upgrading. Resolving here persists the source up front, so the
    // raw after-snapshot stays comparable.
    const authSessionSourceBeforeFetch =
      await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
    const localUserInfoBeforeFetch = await primePersistAtom.get();
    const authToken =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    if (!authToken) {
      defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: simpleDb.prime.getActiveAuthToken() is null',
      });
      await this.setPrimePersistAtomNotLoggedIn();
      const localUserInfo = await primePersistAtom.get();

      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: '',
        errorCode: -1759,
        errorMessage:
          'servicePrime.apiFetchPrimeUserInfo: simpleDb.prime.getActiveAuthToken() No auth token',
      });
      // Do NOT emit PrimeLoginInvalidToken here: having no token is not an
      // invalid-token event, and a payload-less emit would wipe local
      // keyless sessions (e.g. keyless-only users not logged into OneKey ID).

      return {
        userInfo: localUserInfo,
        serverUserInfo: undefined,
        primeSubscription: undefined,
      };
    }
    const serverUserInfo = await this.callApiFetchPrimeUserInfo();

    // Re-check auth token after the network request returns. If the user
    // logged out while this request was in flight, the simpleDb token will
    // have been cleared. Discarding the response prevents an in-flight
    // request from writing the previous account's data back into the atom
    // after logout.
    const authTokenAfterFetch =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    const authSessionSourceAfterFetch =
      await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
    const localUserInfoAfterFetch = await primePersistAtom.get();
    if (!authTokenAfterFetch) {
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: auth token cleared during request, discarding response',
      });
      await this.setPrimePersistAtomNotLoggedIn();
      const localUserInfo = await primePersistAtom.get();
      return {
        userInfo: localUserInfo,
        serverUserInfo: undefined,
        primeSubscription: undefined,
      };
    }
    if (
      authSessionSourceAfterFetch !== authSessionSourceBeforeFetch ||
      localUserInfoAfterFetch.onekeyUserId !==
        localUserInfoBeforeFetch.onekeyUserId
    ) {
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: auth session changed during request, discarding response',
      });
      return {
        userInfo: localUserInfoAfterFetch,
        serverUserInfo: undefined,
        primeSubscription: localUserInfoAfterFetch.primeSubscription,
      };
    }

    void this.backgroundApi.servicePrimeCloudSync.showAlertDialogIfServerPasswordNotSet(
      {
        serverUserInfo,
      },
    );
    void this.backgroundApi.servicePrimeCloudSync.showAlertDialogIfServerPasswordChanged(
      {
        serverUserInfo,
      },
    );

    const { primeSubscription } = await this.updatePrimeAtomByServerUserInfo({
      serverUserInfo,
    });

    const localUserInfo = await primePersistAtom.get();

    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const isServerMasterPasswordSet = Boolean(
      serverPasswordUUID &&
      serverPasswordUUID !== RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID,
    );
    await primeServerMasterPasswordStatusAtom.set((v) => ({
      ...v,
      isServerMasterPasswordSet,
    }));

    return {
      userInfo: localUserInfo,
      serverUserInfo,
      primeSubscription,
    };
  }

  @backgroundMethod()
  async setPrimePersistAtomNotLoggedIn() {
    // Invalidation site (logged-out transitions, choke point): this method is
    // the shared final step of apiLogout -> clearOneKeyIdAuthState,
    // handlePrimeLoginInvalidToken (invalid-token cleanup), account deletion,
    // and keyless-wallet cleanup. Clearing here guarantees a logged-in result
    // cached moments earlier can never be served after the state is reset.
    this.clearPrimeUserInfoCache();
    const beforeValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `setPrimePersistAtomNotLoggedIn: before clear, isLoggedIn=${beforeValue.isLoggedIn}, onekeyUserId=${beforeValue.onekeyUserId}, isPrime=${beforeValue.primeSubscription?.isActive}`,
    });

    await primePersistAtom.set(
      (): IPrimePersistAtomData => cloneDeep(primePersistAtomInitialValue),
    );

    const afterValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `setPrimePersistAtomNotLoggedIn: after clear, isLoggedIn=${afterValue.isLoggedIn}, onekeyUserId=${afterValue.onekeyUserId}, isPrime=${afterValue.primeSubscription?.isActive}`,
    });

    await this.backgroundApi.serviceMasterPassword.clearLocalMasterPassword();
    await primeServerMasterPasswordStatusAtom.set((v) => ({
      ...v,
      isServerMasterPasswordSet: false,
    }));
  }

  @backgroundMethod()
  async isLoggedIn() {
    const { isLoggedIn, isLoggedInOnServer } = await primePersistAtom.get();
    const tokenRead = await readAuthTokenAllowingRetryableAuthError(() =>
      this.backgroundApi.simpleDb.prime.getActiveAuthToken(),
    );
    if (tokenRead.retryableError) {
      defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
        reason: `ServicePrime.isLoggedIn: auth refresh failed, keep local login state: ${String(
          tokenRead.retryableError,
        )}`,
      });
      return Boolean(isLoggedIn && isLoggedInOnServer);
    }
    const authToken = tokenRead.token;
    const result = Boolean(isLoggedIn && isLoggedInOnServer && authToken);

    if (!result) {
      // debugger;
      defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
        reason: `isLoggedIn=false ${JSON.stringify({
          isLoggedIn,
          isLoggedInOnServer,
          authTokenExists: !!authToken,
        })}`,
      });
    }
    return result;
  }

  @backgroundMethod()
  async isPrimeSubscriptionActive() {
    if (!(await this.isLoggedIn())) {
      return false;
    }
    const { primeSubscription } = await primePersistAtom.get();
    return Boolean(primeSubscription?.isActive);
  }

  @backgroundMethod()
  async apiPreparePrimeLogin(_props: { email: string }): Promise<{
    isRegistered: boolean;
    verifyUUID: string;
    captchaRequired: boolean;
    emailCodeRequired: boolean;
  }> {
    // await timerUtils.wait(600);
    // try {
    //   const client = await this.getClient(EServiceEndpointEnum.Prime);
    //   const result = await client.get<
    //     IApiClientResponse<{
    //       isRegistered: boolean;
    //       verifyUUID: string;
    //       captchaRequired: boolean;
    //       emailCodeRequired: boolean;
    //     }>
    //   >('/api/prime/check-email-registered', {
    //     params: {
    //       email,
    //     },
    //   });
    //   return result?.data?.data;
    // } catch (error) {
    //   console.error(error);
    // }

    // if (email.startsWith('1')) {
    //   return {
    //     isRegistered: true,
    //     verifyUUID: stringUtils.generateUUID(),
    //     captchaRequired: false,
    //     emailCodeRequired: false,
    //   };
    // }

    // return {
    //   isRegistered: false,
    //   verifyUUID: stringUtils.generateUUID(),
    //   captchaRequired: true,
    //   emailCodeRequired: true,
    // };

    throw new OneKeyLocalError('Deprecated, use supabase instead');
  }

  @backgroundMethod()
  async apiSendEmailVerificationCode({
    email,
    verifyUUID,
  }: {
    email: string;
    verifyUUID: string;
  }): Promise<{ success: boolean }> {
    await timerUtils.wait(600);
    try {
      const client = await this.getClient(EServiceEndpointEnum.Prime);
      const result = await client.get<IApiClientResponse<{ success: boolean }>>(
        '/api/prime/send-email-verification-code',
        {
          params: {
            email,
            verifyUUID,
          },
        },
      );
      return result?.data?.data;
    } catch (error) {
      console.error(error);
    }

    return { success: true };
  }

  @backgroundMethod()
  async apiPrimeLogin({
    email,
    password,
    emailCode,
    verifyUUID,
    isRegister,
  }: {
    email: string;
    password: string;
    emailCode: string;
    verifyUUID: string;
    isRegister: boolean;
  }) {
    await timerUtils.wait(600);
    try {
      const client = await this.getClient(EServiceEndpointEnum.Prime);
      const result = await client.post<
        IApiClientResponse<{ success: boolean }>
      >('/api/prime/login', {
        data: { email, password, emailCode, verifyUUID, isRegister },
      });
      return result?.data?.data;
    } catch (error) {
      console.error(error);
    }
    return { success: false };
  }

  @backgroundMethod()
  @toastIfError()
  async ensurePrimeLoginValidEmail(email: string) {
    if (!stringUtils.isValidEmail(email)) {
      // TODO i18n error
      throw new OneKeyLocalError('Invalid email');
    }
  }

  @backgroundMethod()
  @toastIfError()
  async startPrimeLogin() {
    const { email } = await this.promptPrimeLoginEmailDialog();

    // TODO move to UI
    const { isRegistered, verifyUUID, captchaRequired, emailCodeRequired } =
      // TODO close loading dialog and reject promise
      await this.withDialogLoading(
        {
          // title: 'Checking email',
          title: appLocale.intl.formatMessage({
            id: ETranslations.global_processing,
          }),
        },
        async () =>
          this.apiPreparePrimeLogin({
            email,
          }),
      );
    const isRegister = !isRegistered;

    const { masterPassword } = await this.promptPrimeLoginPasswordDialog({
      email,
      isRegister,
    });
    ensureSensitiveTextEncoded(masterPassword);

    if (captchaRequired) {
      // TODO captcha verify (register, or login retry 5 times)
    }

    let code = '';
    if (emailCodeRequired) {
      ({ code } = await this.promptPrimeLoginEmailCodeDialog({
        email,
        verifyUUID,
      }));
    }

    // TODO move to UI
    const { success } = await this.withDialogLoading(
      {
        // title: 'Logging in',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
      async () =>
        this.apiPrimeLogin({
          email,
          password: masterPassword,
          emailCode: code,
          verifyUUID,
          isRegister,
        }),
    );

    return {
      success,
      email,
      masterPassword,
      isRegister,
      code,
      captcha: 'mock-captcha',
      verifyUUID,
    };
  }

  @backgroundMethod()
  async promptPrimeLoginEmailDialog() {
    // eslint-disable-next-line no-async-promise-executor
    const email = await new Promise<string>(async (resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      await primeLoginDialogAtom.set((v) => ({
        ...v,
        promptPrimeLoginEmailDialog: promiseId,
      }));
    });
    await this.ensurePrimeLoginValidEmail(email);
    return { email };
  }

  @backgroundMethod()
  @toastIfError()
  async resolvePrimeLoginEmailDialog({
    promiseId,
    email,
  }: {
    promiseId: number;
    email: string;
  }) {
    if (isString(email)) {
      // eslint-disable-next-line no-param-reassign
      email = email.trim();
    }
    await this.ensurePrimeLoginValidEmail(email);
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      promptPrimeLoginEmailDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: email,
    });
  }

  @backgroundMethod()
  async promptForgetMasterPasswordDialog() {
    const result = await new Promise(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        await primeLoginDialogAtom.set((v) => ({
          ...v,
          promptForgetMasterPasswordDialog: {
            promiseId,
          },
        }));
      },
    );
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async resolveForgetMasterPasswordDialog({
    promiseId,
  }: {
    promiseId: number;
  }) {
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      promptForgetMasterPasswordDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: true,
    });
  }

  @backgroundMethod()
  async promptPrimeLoginPasswordDialog({
    email,
    isRegister,
    isVerifyMasterPassword,
    isChangeMasterPassword,
    serverUserInfo,
  }: {
    email?: string;
    isRegister: boolean;
    isVerifyMasterPassword?: boolean;
    isChangeMasterPassword?: boolean;
    serverUserInfo?: IPrimeServerUserInfo;
  }) {
    const masterPassword = await new Promise<string>(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        await primeLoginDialogAtom.set(
          (v): IPrimeLoginDialogAtomData => ({
            ...v,
            promptPrimeLoginPasswordDialog: {
              email: email || '',
              isRegister,
              isVerifyMasterPassword,
              isChangeMasterPassword,
              serverUserInfo,
              promiseId,
            },
          }),
        );
      },
    );
    ensureSensitiveTextEncoded(masterPassword);
    return { masterPassword };
  }

  @backgroundMethod()
  @toastIfError()
  async resolvePrimeLoginPasswordDialog({
    promiseId,
    password,
  }: {
    promiseId: number;
    password: string;
  }) {
    ensureSensitiveTextEncoded(password);
    await timerUtils.wait(300);
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      promptPrimeLoginPasswordDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: password,
    });
  }

  @backgroundMethod()
  async promptPrimeLoginEmailCodeDialog({
    email,
    verifyUUID,
  }: {
    email: string;
    verifyUUID: string;
  }) {
    // eslint-disable-next-line no-async-promise-executor
    const code = await new Promise<string>(async (resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      await primeLoginDialogAtom.set((v) => ({
        ...v,
        promptPrimeLoginEmailCodeDialog: {
          email,
          verifyUUID,
          promiseId,
        },
      }));
    });
    return { code };
  }

  @backgroundMethod()
  @toastIfError()
  async resolvePrimeLoginEmailCodeDialog({
    promiseId,
    code,
  }: {
    promiseId: number;
    code: string;
  }) {
    if (!code || code.length !== 6) {
      throw new OneKeyLocalError('Invalid code');
    }
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      promptPrimeLoginEmailCodeDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: code,
    });
  }

  @backgroundMethod()
  async cancelPrimeLogin({
    promiseId,
    dialogType,
  }: {
    promiseId: number;
    dialogType: IPrimeLoginDialogKeys;
  }) {
    const error = new PrimeLoginDialogCancelError();
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      [dialogType]: undefined,
    }));
    return this.backgroundApi.servicePromise.rejectCallback({
      id: promiseId,
      error,
    });
  }

  @backgroundMethod()
  async sendEmailOTP(scene: EPrimeEmailOTPScene) {
    if (!scene) {
      throw new OneKeyLocalError('sendEmailOTP ERROR: Invalid scene');
    }
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
    const result = await client.post<
      IApiClientResponse<{
        resendAt: number;
        uuid: string;
      }>
    >('/prime/v1/general/emailOTP', {
      scene,
    });
    return result?.data?.data;
  }

  @backgroundMethod()
  async apiGetCustomerJWT() {
    const client = await this.getPrimeClient();
    const result = await client.get<IApiClientResponse<{ token: string }>>(
      '/prime/v1/general/customer_jwt',
    );
    return result?.data?.data;
  }

  @backgroundMethod()
  async getLocalUserInfo() {
    return primePersistAtom.get();
  }

  @backgroundMethod()
  async apiFetchShopifyOrders(): Promise<IShopifyOrder[]> {
    const client = await this.getPrimeClient();
    const result = await client.get<IApiClientResponse<IShopifyOrder[]>>(
      '/prime/v1/user/shopify-orders',
    );
    return result?.data?.data ?? [];
  }

  @backgroundMethod()
  async updatePrimeUserProfile({
    avatar,
    nickname,
  }: {
    avatar: string;
    nickname: string;
  }) {
    const client = await this.getPrimeClient();
    const result = await client.put<IApiClientResponse<{ success: boolean }>>(
      `/prime/v1/user/info`,
      {
        avatar,
        nickname,
      },
    );
    // Invalidation site (profile update): the server-side profile just
    // changed, so the refresh below must bypass the short TTL instead of
    // returning a pre-update cached avatar/nickname.
    this.clearPrimeUserInfoCache();
    setTimeout(() => {
      void this.apiFetchPrimeUserInfo();
    });
    return result.data.code === 0;
  }
}

export default ServicePrime;
