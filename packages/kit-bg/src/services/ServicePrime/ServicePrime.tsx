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
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { isRetryableSupabaseAuthError } from '@onekeyhq/shared/src/utils/supabaseAuthErrorUtils';
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
import {
  EOneKeyIdIdentityType,
  EPrimeAuthSessionSource,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  primeLoginDialogAtom,
  primePersistAtom,
  primePersistAtomInitialValue,
  primeServerMasterPasswordStatusAtom,
} from '../../states/jotai/atoms/prime';
import ServiceBase from '../ServiceBase';

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
  }> {
    const authSessionSource =
      await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
    let currentAuthToken = '';
    try {
      currentAuthToken = authSessionSource
        ? await this.backgroundApi.simpleDb.prime.getActiveAuthToken()
        : await this.backgroundApi.simpleDb.prime.getSupabaseAuthToken();
    } catch (error) {
      if (isRetryableSupabaseAuthError(error)) {
        defaultLogger.prime.subscription.onekeyIdInvalidToken({
          url: requestUrl || '',
          errorCode: errorCode || -1,
          errorMessage: `skip clearing invalid token response because local refresh failed: ${String(
            error,
          )}`,
        });
        return { cleared: false, authSessionSource };
      }
      throw error;
    }

    if (
      requestAuthToken &&
      currentAuthToken &&
      requestAuthToken !== currentAuthToken
    ) {
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: requestUrl || '',
        errorCode: errorCode || -1,
        errorMessage: `skip clearing stale invalid token response: ${
          errorMessage || ''
        }`,
      });
      return { cleared: false, authSessionSource };
    }

    if (!requestAuthToken && currentAuthToken) {
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: requestUrl || '',
        errorCode: errorCode || -1,
        errorMessage: `skip clearing invalid token response without request token: ${
          errorMessage || ''
        }`,
      });
      return { cleared: false, authSessionSource };
    }

    const sourceToClear =
      authSessionSource ?? EPrimeAuthSessionSource.LegacyEmailSupabase;
    await this.backgroundApi.simpleDb.prime.clearAuthTokens();
    if (sourceToClear === EPrimeAuthSessionSource.KeylessOAuth) {
      await this.backgroundApi.simpleDb.prime.clearKeylessAuthSession();
    } else {
      await this.backgroundApi.simpleDb.prime.clearLegacyAuthSession();
    }
    await this.setPrimePersistAtomNotLoggedIn();
    return {
      cleared: true,
      authSessionSource: sourceToClear,
    };
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
      const nextAuthSessionSource =
        authSessionSource ??
        (await this.backgroundApi.simpleDb.prime.getAuthSessionSource()) ??
        EPrimeAuthSessionSource.LegacyEmailSupabase;
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
        await this.commitAuthSessionSourceBeforeAtomUpdate({
          authSessionSource: nextAuthSessionSource,
          callerName: 'ServicePrime.apiLogin',
        });
        await this.updatePrimeAtomByServerUserInfo({
          serverUserInfo: response.data.data,
        });
      } catch (error) {
        if (this.isPrimeLoginInvalidTokenError(error)) {
          // Confirmed invalid-token rejection: drop both the cached token
          // and the auth session source.
          await this.backgroundApi.simpleDb.prime.clearAuthTokens();
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

      await this.backgroundApi.simpleDb.prime.clearAuthTokens();
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
      await this.commitAuthSessionSourceBeforeAtomUpdate({
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        callerName: 'ServicePrime.apiOAuthLogin',
      });
      await this.updatePrimeAtomByOAuthLoginResponse({
        loginResponse: data,
      });
      await this.backgroundApi.simpleDb.prime.clearLegacyAuthSession();
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

    let authSessionSource =
      await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
    if (!authSessionSource) {
      const legacyAuthToken =
        await this.backgroundApi.simpleDb.prime.getSupabaseAuthToken();
      if (legacyAuthToken) {
        authSessionSource = EPrimeAuthSessionSource.LegacyEmailSupabase;
      }
      const keylessAuthToken =
        await this.backgroundApi.simpleDb.prime.getKeylessSupabaseAuthToken();
      if (!authSessionSource && keylessAuthToken) {
        return false;
      }
      if (!authSessionSource) {
        return false;
      }
    }

    if (authSessionSource !== EPrimeAuthSessionSource.LegacyEmailSupabase) {
      return false;
    }

    const profile = await this.apiFetchOneKeyIdProfile();
    return this.isLegacyOneKeyIdAccountMissingOAuthIdentity(
      profile.onekeyAccount,
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

      await this.commitAuthSessionSourceBeforeAtomUpdate({
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        callerName: 'ServicePrime.apiBindLegacyOneKeyIdOAuth',
      });
      await this.updatePrimeAtomByOneKeyIdAccount({
        onekeyAccount: data.onekeyAccount,
      });
      await this.backgroundApi.simpleDb.prime.clearLegacyAuthSession();
      await this.cleanupLegacyKeylessSessionStorage({
        callerName: 'ServicePrime.apiBindLegacyOneKeyIdOAuth',
      });

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
    if (preserveLocalKeylessAuth) {
      await this.backgroundApi.simpleDb.prime.clearAuthTokens();
      await this.backgroundApi.simpleDb.prime.clearLegacyAuthSession();
    } else {
      await this.cleanupLegacyKeylessSessionStorage({ callerName });
      await this.backgroundApi.simpleDb.prime.clearLocalAuthSession();
    }
    await this.setPrimePersistAtomNotLoggedIn();
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

    let authToken = '';
    try {
      authToken = preserveLocalKeylessAuth
        ? await this.backgroundApi.simpleDb.prime.getSupabaseAuthToken()
        : await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    } catch (error) {
      if (!isRetryableSupabaseAuthError(error)) {
        throw error;
      }
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: `ServicePrime.apiLogout: skip server logout because auth refresh failed: ${String(
          error,
        )}`,
      });
    }
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
      await this.apiLogin({ accessToken });
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
    // Capture the token the request interceptor will attach, so invalid-token
    // cleanup can detect stale in-flight responses after a re-login.
    const requestAuthToken =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = {
      autoHandleError: false,
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
      const displayEmail =
        onekeyAccount?.displayEmail ?? serverUserInfo?.displayEmail;
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

  private isLegacyOneKeyIdAccountMissingOAuthIdentity(
    onekeyAccount: IOneKeyIdAccount,
  ) {
    const identities = onekeyAccount.identities ?? [];
    const hasLegacyEmailIdentity = identities.some(
      (identity) => identity.identityType === EOneKeyIdIdentityType.LegacyEmail,
    );
    const hasOAuthIdentity = identities.some(
      (identity) => identity.identityType === EOneKeyIdIdentityType.OAuth,
    );
    return hasLegacyEmailIdentity && !hasOAuthIdentity;
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

  @backgroundMethod()
  async apiFetchPrimeUserInfo(): Promise<{
    userInfo: IPrimeUserInfo;
    serverUserInfo: IPrimeServerUserInfo | undefined;
    primeSubscription: IPrimeSubscriptionInfo | undefined;
  }> {
    console.log('call servicePrime.apiFetchPrimeUserInfo');
    await this.loginMutex.waitForUnlock();
    const authSessionSourceBeforeFetch =
      await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
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
    let authToken = '';
    try {
      authToken = await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    } catch (error) {
      if (isRetryableSupabaseAuthError(error)) {
        defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
          reason: `ServicePrime.isLoggedIn: auth refresh failed, keep local login state: ${String(
            error,
          )}`,
        });
        return Boolean(isLoggedIn && isLoggedInOnServer);
      }
      throw error;
    }
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
    setTimeout(() => {
      void this.apiFetchPrimeUserInfo();
    });
    return result.data.code === 0;
  }
}

export default ServicePrime;
