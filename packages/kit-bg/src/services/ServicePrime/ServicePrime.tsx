/* cspell:ignore Infini */
import { type AuthResponse } from '@supabase/supabase-js';
import { Semaphore } from 'async-mutex';
import BigNumber from 'bignumber.js';
import { chunk, cloneDeep, isString } from 'lodash';

import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import { analytics } from '@onekeyhq/shared/src/analytics';
import type { IAxiosResponse } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  backgroundMethod,
  checkDevOnlyPassword,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import type { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID } from '@onekeyhq/shared/src/consts/primeConsts';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import {
  ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_CODE,
  ONEKEY_ID_OAUTH_IDENTITY_ALREADY_BOUND_MESSAGE_ID,
  OneKeyErrorOneKeyIdKeylessSessionSlotReplaced,
  OneKeyErrorOneKeyIdLegacyBindStateChanged,
  OneKeyErrorOneKeyIdOAuthIdentityAlreadyBound,
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyLocalError,
  OneKeyServerApiError,
  PrimeLoginDialogCancelError,
} from '@onekeyhq/shared/src/errors';
import {
  markOneKeyIdFailureServerLogged,
  wasOneKeyIdFailureServerLogged,
} from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ISupabaseJWTPayload } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  getBoundOAuthProviders,
  getOneKeyIdOAuthProviderFromSocialLoginProvider,
  getSocialLoginProviderFromOneKeyIdOAuthProvider,
  isOneKeyIdOAuthIdentityBound,
} from '@onekeyhq/shared/src/utils/oauthProviderUtils';
import { isLegacyOneKeyIdAccountMissingOAuthIdentity } from '@onekeyhq/shared/src/utils/oneKeyIdAccountUtils';
import { getSanitizedErrorLogText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';
import { ETranslateEngine } from '@onekeyhq/shared/types/discovery';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IExplicitLocalOneKeyIdLogoutProjection,
  IIdentityExitOAuthHandoff,
  IKeylessOAuthSessionRollbackHandle,
} from '@onekeyhq/shared/types/prime/identityExitTypes';
import type {
  IOneKeyIdAccount,
  IOneKeyIdOAuthBindResponse,
  IOneKeyIdOAuthLoginResponse,
  IOneKeyIdProfileResponse,
  IPrimeDeviceInfo,
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentCreateParams,
  IPrimeInfiniPaymentOption,
  IPrimeInfiniPaymentPreBroadcastSnapshot,
  IPrimeInfiniPurchaseStatusSnapshot,
  IPrimeInfiniSubscription,
  IPrimeInfiniSubscriptionPlan,
  IPrimeRedemptionParams,
  IPrimeRedemptionResult,
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
  beginIdentityLifecycleReservation,
  endIdentityLifecycleReservation,
  getActiveIdentityLifecycleOperationId,
  identityLifecycleMutex,
  isIdentityRecoveryReady,
  markIdentityRecoveryFailed,
  markIdentityRecoveryPending,
  markIdentityRecoveryReady,
} from '../ServiceIdentityExit/identityLifecycleMutex';

import {
  buildPrimeAnalyticsProfileSnapshot,
  shouldDropStalePrimeProfileReport,
} from './primeAnalyticsProfile';
import {
  allowAuthSessionStorageWritesBySessionSource,
  clearAllSupabaseAuthSessions,
  clearSupabaseStorageLocalCache,
  getAuthTokenBySessionSource,
  getSupabaseClientBySessionSource,
  persistKeylessAuthSession,
  readAuthTokenAllowingRetryableAuthError,
  readPersistedAccessTokenBySessionSourceStrict,
  removeAuthSessionStorageBySessionSource,
  revokeAuthSessionTokenOnServerBestEffort,
  runExclusiveOnAuthSessionSlot,
} from './primeAuthSessionAccess';

import type {
  IKeylessOAuthSessionIdentity,
  IKeylessOAuthSessionPersistenceJournal,
  IKeylessOAuthSessionPersistenceJournalPreparation,
} from '../../dbs/simple/entity/SimpleDbEntityPrime';
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

function getInfiniPlanParam(plan: IPrimeInfiniSubscriptionPlan) {
  return plan === 'yearly' ? 'annual' : 'monthly';
}

function validateInfiniCheckoutUrl(checkoutUrl: unknown): string {
  if (!isString(checkoutUrl)) {
    throw new OneKeyLocalError('Invalid Infini checkout URL');
  }

  const trimmedUrl = checkoutUrl.trim();
  if (!isAllowedWebViewUrl(trimmedUrl)) {
    throw new OneKeyLocalError('Invalid Infini checkout URL');
  }

  return new URL(trimmedUrl).toString();
}

function normalizeInfiniSubscriptionResponse(
  subscription: IPrimeInfiniSubscription | undefined,
): IPrimeInfiniSubscription | undefined {
  if (!subscription) {
    return undefined;
  }
  return {
    ...subscription,
    status: typeof subscription.status === 'string' ? subscription.status : '',
  };
}

type IPrimeInfiniPaymentApiResponse = {
  paymentId?: unknown;
  address?: unknown;
  chain?: unknown;
  token?: unknown;
  amountDue?: unknown;
  payAmount?: unknown;
  payCurrency?: unknown;
  expiresAt?: unknown;
  status?: unknown;
  infiniStatus?: unknown;
  amountConfirmed?: unknown;
  amountConfirming?: unknown;
};

type IPrimeRedemptionApiResponse = {
  daysAdded?: unknown;
  primeExpiresAt?: unknown;
};

function validatePrimeRedemptionResponse(
  redemption: IPrimeRedemptionApiResponse | undefined,
): IPrimeRedemptionResult {
  if (
    !redemption ||
    !Number.isSafeInteger(redemption.daysAdded) ||
    Number(redemption.daysAdded) <= 0 ||
    !Number.isSafeInteger(redemption.primeExpiresAt) ||
    Number(redemption.primeExpiresAt) < 1_000_000_000_000 ||
    Number.isNaN(new Date(Number(redemption.primeExpiresAt)).getTime())
  ) {
    throw new OneKeyLocalError('Invalid Prime redemption response');
  }
  return {
    addedDays: Number(redemption.daysAdded),
    finalExpiresAt: Number(redemption.primeExpiresAt),
  };
}

function validateInfiniPaymentResponse(
  payment: IPrimeInfiniPaymentApiResponse | undefined,
  expectedPaymentId?: string,
): IPrimeInfiniPayment {
  const rawAmountDue =
    payment?.amountDue === undefined ? payment?.payAmount : payment.amountDue;
  const amountDue = new BigNumber(isString(rawAmountDue) ? rawAmountDue : '');
  const amountFieldsMatch =
    payment?.amountDue === undefined ||
    payment.payAmount === undefined ||
    (isString(payment.amountDue) &&
      isString(payment.payAmount) &&
      new BigNumber(payment.amountDue).eq(payment.payAmount));
  if (
    !payment ||
    !isString(payment.paymentId) ||
    !payment.paymentId ||
    !isString(payment.address) ||
    !payment.address ||
    !isString(payment.chain) ||
    !payment.chain ||
    !isString(payment.token) ||
    !payment.token ||
    !isString(rawAmountDue) ||
    !rawAmountDue ||
    !amountDue.isFinite() ||
    !amountDue.gt(0) ||
    !amountFieldsMatch ||
    typeof payment.expiresAt !== 'number' ||
    !Number.isFinite(payment.expiresAt) ||
    (payment.payCurrency !== undefined &&
      (!isString(payment.payCurrency) ||
        payment.payCurrency.trim().toUpperCase() !==
          payment.token.trim().toUpperCase())) ||
    (payment.status !== undefined && !isString(payment.status)) ||
    (payment.infiniStatus !== undefined && !isString(payment.infiniStatus)) ||
    (payment.amountConfirmed !== undefined &&
      !isString(payment.amountConfirmed)) ||
    (payment.amountConfirming !== undefined &&
      !isString(payment.amountConfirming)) ||
    (expectedPaymentId !== undefined && payment.paymentId !== expectedPaymentId)
  ) {
    throw new OneKeyLocalError('Invalid Infini payment response');
  }
  return {
    paymentId: payment.paymentId,
    address: payment.address,
    chain: payment.chain,
    token: payment.token,
    amountDue: rawAmountDue,
    expiresAt: payment.expiresAt,
    status: payment.status,
    infiniStatus: payment.infiniStatus,
    amountConfirmed: payment.amountConfirmed,
    amountConfirming: payment.amountConfirming,
  };
}

type ICompleteOneKeyIdProfileResponse = IPrimeServerUserInfo & {
  onekeyAccount: IOneKeyIdAccount;
};

type IPrimeApiClientResponse<T> = IApiClientResponse<T> & {
  messageId?: string;
};

type IKeylessOAuthSessionRollbackRecord = {
  expectedIdentityLifecycleRevision: number;
  sessionCommitId: string;
  sessionTokenSub: string;
  walletId?: string;
  expiresAt: number;
  expiryTimer?: ReturnType<typeof setTimeout>;
};

type ISourceLessOneKeyIdRecoveryResult =
  | { status: 'recovered' }
  | { status: 'retryableIndeterminate' }
  | {
      status: 'definitiveInvalid';
      repair?: {
        expectedOneKeyUserId: string;
        expectedSessionTokenSub?: string;
        expectedEmptyKeylessSessionSlot?: boolean;
      };
    };

type ILegacyOneKeyIdUpgradeRecoveryResult =
  | { status: 'notApplicable' }
  | {
      status: 'recovered';
      serverUserInfo: IPrimeServerUserInfoWithProfile;
    }
  | { status: 'retryableIndeterminate' }
  | { status: 'definitiveInvalid' };

type IOneKeyIdOAuthBindPromptClaimResult =
  | { status: 'claimed'; claimId: string }
  | { status: 'skip' }
  | { status: 'retryable' };

const ONEKEY_ID_OAUTH_BIND_PROMPT_CLAIM_TTL_MS = 60_000;

type IKeylessOAuthJwtPayload = ISupabaseJWTPayload & {
  session_id?: unknown;
};

type IKeylessOAuthSessionIdentityReadResult =
  | { status: 'ok'; identity: IKeylessOAuthSessionIdentity }
  | { status: 'missingClaim'; claim: 'session_id' | 'sub' };

function readKeylessOAuthSessionIdentity(
  accessToken: string,
): IKeylessOAuthSessionIdentityReadResult {
  const payload = stringUtils.decodeJWT(
    accessToken,
  ) as IKeylessOAuthJwtPayload | null;
  const sessionTokenSub = typeof payload?.sub === 'string' ? payload.sub : '';
  if (!sessionTokenSub) {
    return { status: 'missingClaim', claim: 'sub' };
  }
  // Never fall back to token bytes, `iat`, or subject-only matching. The
  // session_id claim is stable across refreshes and distinguishes a fresh
  // same-account session without persisting credential material.
  const supabaseSessionId =
    typeof payload?.session_id === 'string' ? payload.session_id : '';
  if (!supabaseSessionId) {
    return { status: 'missingClaim', claim: 'session_id' };
  }
  return {
    status: 'ok',
    identity: { sessionTokenSub, supabaseSessionId },
  };
}

const keylessOAuthSessionRollbackRegistry = new Map<
  IKeylessOAuthSessionRollbackHandle,
  IKeylessOAuthSessionRollbackRecord
>();
const KEYLESS_OAUTH_SESSION_ROLLBACK_TTL_MS = 5 * 60 * 1000;

function getSanitizedAuthErrorLog(error: unknown): string {
  return getSanitizedErrorLogText(error);
}

async function withIdentityNetworkTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 10_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Identity network operation timed out after ${timeoutMs}ms.`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

type IOneKeyIdAuthSnapshot = {
  expectedOneKeyUserId: string;
  requestAuthToken: string;
  authSessionSource: EPrimeAuthSessionSource;
  authStateGeneration: number;
};

class ServicePrime extends ServiceBase {
  private primeUserInfoFetchGeneration = 0;

  // Per-bg-session dedup for the analytics identity link; the persisted TTL
  // in simpleDb.prime.markIdentityLinkReported bounds volume across sessions.
  private identityLinkReportedUserIds = new Set<string>();

  // Per-bg-session snapshot of the last membership profile values handled,
  // so hot state-maintenance paths skip the persisted check entirely.
  private lastHandledPrimeProfileKey: string | undefined;

  // Serialize profile reports so a stale logged-out persist/emit cannot
  // overwrite a later login snapshot in the same session.
  private primeProfileReportChain: Promise<void> = Promise.resolve();

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /**
   * Report the analytics identity link (app instanceId <-> onekeyUserId) so
   * the analytics proxy can merge the device person with the account person
   * used by server-side subscription events. Deduplicated per user per bg
   * session, plus a persisted TTL across sessions.
   */
  private async trackOneKeyIdIdentityLinked({
    onekeyUserId,
  }: {
    onekeyUserId: string | undefined;
  }) {
    try {
      if (!onekeyUserId) {
        return;
      }
      if (this.identityLinkReportedUserIds.has(onekeyUserId)) {
        return;
      }
      this.identityLinkReportedUserIds.add(onekeyUserId);
      const { shouldReport } =
        await this.backgroundApi.simpleDb.prime.markIdentityLinkReported({
          onekeyUserId,
          now: Date.now(),
        });
      if (shouldReport) {
        defaultLogger.prime.subscription.onekeyIdIdentityLinked({
          onekeyUserId,
        });
      }
    } catch (error) {
      if (onekeyUserId) {
        this.identityLinkReportedUserIds.delete(onekeyUserId);
      }
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: `trackOneKeyIdIdentityLinked failed: ${getSanitizedAuthErrorLog(
          error,
        )}`,
      });
    }
  }

  /**
   * Report the OneKey ID / Prime membership dimensions as analytics user
   * profile attributes for EVERY user (false for never-logged-in users), so
   * any event stream can be segmented by membership without joining
   * subscription events. Value-change driven with a persisted TTL re-assert;
   * updateUserProfile is a documented direct-call exception for persistent
   * user attributes.
   */
  private enqueuePrimeProfileAnalyticsReport() {
    this.primeProfileReportChain = this.primeProfileReportChain
      .then(() => this.reportPrimeProfileToAnalytics())
      .catch(() => undefined);
  }

  private async readPrimeAnalyticsProfileSnapshot() {
    const { isLoggedIn, isLoggedInOnServer, primeSubscription } =
      await primePersistAtom.get();
    return buildPrimeAnalyticsProfileSnapshot({
      isLoggedIn,
      isLoggedInOnServer,
      isPrimeSubscriptionActive: primeSubscription?.isActive,
    });
  }

  private dropStalePrimeProfileSnapshot({
    expectedKey,
    currentKey,
  }: {
    expectedKey: string;
    currentKey: string;
  }): boolean {
    const { drop, clearLastHandled } = shouldDropStalePrimeProfileReport({
      expectedKey,
      currentKey,
      lastHandledKey: this.lastHandledPrimeProfileKey,
    });
    if (clearLastHandled) {
      this.lastHandledPrimeProfileKey = undefined;
    }
    return drop;
  }

  private async persistAndEmitPrimeProfile({
    isOneKeyIdLoggedIn,
    isPrimeActive,
    profileKey,
  }: {
    isOneKeyIdLoggedIn: boolean;
    isPrimeActive: boolean;
    profileKey: string;
  }) {
    const { shouldReport } =
      await this.backgroundApi.simpleDb.prime.markPrimeProfileReported({
        isOneKeyIdLoggedIn,
        isPrimeActive,
        now: Date.now(),
      });
    if (!shouldReport) {
      return;
    }
    const confirmed = await this.readPrimeAnalyticsProfileSnapshot();
    if (
      this.dropStalePrimeProfileSnapshot({
        expectedKey: profileKey,
        currentKey: confirmed.profileKey,
      })
    ) {
      return;
    }
    analytics.updateUserProfile({
      isOneKeyIdLoggedIn: confirmed.isOneKeyIdLoggedIn,
      isPrimeActive: confirmed.isPrimeActive,
    });
  }

  private async reportPrimeProfileToAnalytics() {
    let profileKey: string | undefined;
    try {
      const snapshot = await this.readPrimeAnalyticsProfileSnapshot();
      profileKey = snapshot.profileKey;
      if (this.lastHandledPrimeProfileKey === profileKey) {
        return;
      }
      // Mark before persist so overlapping startup/login calls skip a second
      // full-entity write. Clear on failure so this session can retry.
      this.lastHandledPrimeProfileKey = profileKey;
      const latest = await this.readPrimeAnalyticsProfileSnapshot();
      if (
        this.dropStalePrimeProfileSnapshot({
          expectedKey: profileKey,
          currentKey: latest.profileKey,
        })
      ) {
        return;
      }
      await this.persistAndEmitPrimeProfile(latest);
    } catch (error) {
      if (profileKey && this.lastHandledPrimeProfileKey === profileKey) {
        this.lastHandledPrimeProfileKey = undefined;
      }
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: `reportPrimeProfileToAnalytics failed: ${getSanitizedAuthErrorLog(
          error,
        )}`,
      });
    }
  }

  async getPrimeClient() {
    return this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
  }

  private createInfiniPurchaseUserChangedError() {
    return new OneKeyLocalError({
      message: 'Prime purchase user changed',
      autoToast: false,
    });
  }

  /**
   * Pin the OneKey ID login a user-consented, account-scoped operation was
   * started against, so every later step can prove it is still acting for
   * that account instead of whatever now occupies the shared session slots.
   *
   * The snapshot binds four things together: the consented account
   * (captured by the UI at press time), the exact active token bytes, the
   * auth session source, and the auth-state generation. `requireSource`
   * additionally pins WHICH realm the operation is allowed to run against
   * (the legacy bind must never proceed once the login flipped to
   * KeylessOAuth).
   *
   * Note the ordering: getActiveAuthToken() resolves (and self-heals) the
   * effective source first, so the getAuthSessionSource() read below is
   * definitive even for pre-authSessionSource legacy sessions — exactly the
   * accounts the legacy bind targets.
   */
  private async captureOneKeyIdAuthSnapshot({
    expectedOneKeyUserId,
    requireSource,
    insideLoginMutex,
    createStateChangedError,
  }: {
    expectedOneKeyUserId: string;
    requireSource?: EPrimeAuthSessionSource;
    // Set by callers that already hold loginMutex (the legacy bind runs its
    // whole flow inside one section). loginMutex is NOT reentrant, so the
    // wait below would deadlock against the caller's own section — and it is
    // redundant there anyway: holding the mutex already excludes the
    // in-flight login commit the wait exists to avoid reading across.
    insideLoginMutex?: boolean;
    createStateChangedError: () => Error;
  }): Promise<IOneKeyIdAuthSnapshot> {
    const initialUserInfo = await primePersistAtom.get();
    if (
      !expectedOneKeyUserId ||
      !initialUserInfo.isLoggedIn ||
      initialUserInfo.onekeyUserId !== expectedOneKeyUserId
    ) {
      throw createStateChangedError();
    }

    if (!insideLoginMutex) {
      await this.loginMutex.waitForUnlock();
    }
    const requestAuthToken =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    if (!requestAuthToken) {
      throw createStateChangedError();
    }

    return this.authStateWriteMutex.runExclusive(async () => {
      const currentUserInfo = await primePersistAtom.get();
      const authSessionSource =
        await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
      const authStateGeneration =
        await this.backgroundApi.simpleDb.prime.getAuthStateGeneration();
      if (
        !currentUserInfo.isLoggedIn ||
        currentUserInfo.onekeyUserId !== expectedOneKeyUserId ||
        !authSessionSource ||
        (requireSource && authSessionSource !== requireSource)
      ) {
        throw createStateChangedError();
      }
      const persistedSession =
        await readPersistedAccessTokenBySessionSourceStrict(authSessionSource);
      if (
        persistedSession.status !== 'ok' ||
        persistedSession.accessToken !== requestAuthToken
      ) {
        throw createStateChangedError();
      }
      return {
        expectedOneKeyUserId,
        requestAuthToken,
        authSessionSource,
        authStateGeneration,
      };
    });
  }

  private async assertOneKeyIdAuthSnapshot({
    snapshot,
    createStateChangedError,
  }: {
    snapshot: IOneKeyIdAuthSnapshot;
    createStateChangedError: () => Error;
  }) {
    await this.authStateWriteMutex.runExclusive(async () => {
      const currentUserInfo = await primePersistAtom.get();
      const authSessionSource =
        await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
      const authStateGeneration =
        await this.backgroundApi.simpleDb.prime.getAuthStateGeneration();
      if (
        !currentUserInfo.isLoggedIn ||
        currentUserInfo.onekeyUserId !== snapshot.expectedOneKeyUserId ||
        authSessionSource !== snapshot.authSessionSource ||
        authStateGeneration !== snapshot.authStateGeneration
      ) {
        throw createStateChangedError();
      }
    });
  }

  private getOneKeyIdAuthSnapshotRequestConfig(
    snapshot: IOneKeyIdAuthSnapshot,
  ) {
    return {
      headers: {
        'X-Onekey-Request-Token': snapshot.requestAuthToken,
      },
    };
  }

  private async captureInfiniPurchaseAuthSnapshot(
    expectedOneKeyUserId: string,
  ): Promise<IOneKeyIdAuthSnapshot> {
    return this.captureOneKeyIdAuthSnapshot({
      expectedOneKeyUserId,
      createStateChangedError: () =>
        this.createInfiniPurchaseUserChangedError(),
    });
  }

  private async assertInfiniPurchaseAuthSnapshot(
    snapshot: IOneKeyIdAuthSnapshot,
  ) {
    await this.assertOneKeyIdAuthSnapshot({
      snapshot,
      createStateChangedError: () =>
        this.createInfiniPurchaseUserChangedError(),
    });
  }

  private getInfiniPurchaseRequestConfig(snapshot: IOneKeyIdAuthSnapshot) {
    return this.getOneKeyIdAuthSnapshotRequestConfig(snapshot);
  }

  private async cleanupLegacyKeylessSessionStorageBestEffort({
    callerName,
  }: {
    callerName: string;
  }) {
    try {
      await this.backgroundApi.serviceKeylessWallet.cleanupLocalKeylessOAuthTokens();
    } catch (error) {
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: `${callerName}: clear legacy keyless session storage failed: ${getSanitizedAuthErrorLog(
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

          console.error(
            '[Prime Translate] batch error:',
            getSanitizedAuthErrorLog(error),
          );
          return batch;
        }
      }),
    );
    return { translations: results.flat() };
  }

  async deleteOneKeyIdAccountOnServer({
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

  loginMutex = identityLifecycleMutex;

  // Narrow mutex serializing WRITES to the shared auth-state pair
  // (persisted authSessionSource in simpleDb + primePersistAtom): the
  // login-side commit (commitAuthSessionSourceAndPrimeAtom, source +
  // slot check + atom update as one rollback-on-failure section) versus
  // the invalid-token cleanup (handlePrimeLoginInvalidToken) and the
  // logout clear (clearOneKeyIdAuthState). Without it, the cleanup's
  // multi-await read -> guard -> clear sequence can interleave with a
  // login commit and either reset the atom right after a successful
  // login, or wipe the source while the atom still says logged-in
  // (orphaning a KeylessOAuth session — a wiped KeylessOAuth source is
  // never re-inferred).
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
  // Supabase getSession token reads used by cleanup guards happen before
  // either mutex or inside the lifecycle mutex only; they never run under
  // authStateWriteMutex. The login-side commit takes no part in that
  // exception: its
  // slot check is a strict persisted-bytes read
  // (readPersistedAccessTokenBySessionSourceStrict), never getSession.
  authStateWriteMutex = new Semaphore(1);

  private sourceLessOneKeyIdRecoveryRetryTimer:
    | ReturnType<typeof setTimeout>
    | undefined;

  private sourceLessOneKeyIdRecoveryRetryAttempt = 0;

  private resetSourceLessOneKeyIdRecoveryRetry() {
    if (this.sourceLessOneKeyIdRecoveryRetryTimer) {
      clearTimeout(this.sourceLessOneKeyIdRecoveryRetryTimer);
      this.sourceLessOneKeyIdRecoveryRetryTimer = undefined;
    }
    this.sourceLessOneKeyIdRecoveryRetryAttempt = 0;
  }

  private scheduleSourceLessOneKeyIdRecoveryRetry({
    callerName,
  }: {
    callerName: string;
  }) {
    if (this.sourceLessOneKeyIdRecoveryRetryTimer) {
      return;
    }
    const delayMs = Math.min(
      timerUtils.getTimeDurationMs({ seconds: 1 }) *
        2 ** this.sourceLessOneKeyIdRecoveryRetryAttempt,
      timerUtils.getTimeDurationMs({ seconds: 30 }),
    );
    this.sourceLessOneKeyIdRecoveryRetryAttempt += 1;
    this.sourceLessOneKeyIdRecoveryRetryTimer = setTimeout(() => {
      this.sourceLessOneKeyIdRecoveryRetryTimer = undefined;
      void (async () => {
        // A committed source means another login or migration finished while
        // this source-less retry was waiting. Read the raw discriminator here:
        // getActiveAuthToken() may infer and persist a legacy source before the
        // guarded upgrade recovery has compared the server profile identity.
        const authSessionSource =
          await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
        if (authSessionSource) {
          this.resetSourceLessOneKeyIdRecoveryRetry();
          return;
        }
        await this.clearOneKeyIdAuthStateIfNoActiveToken({
          callerName: `${callerName}.sourceLessRecoveryRetry`,
        });
      })().catch((error) => {
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: 'profileValidation',
          status: 'failed',
          operationId: 'sourceLessOneKeyIdRecoveryRetry',
          reason: getSanitizedAuthErrorLog(error),
        });
        this.scheduleSourceLessOneKeyIdRecoveryRetry({ callerName });
      });
    }, delayMs);
    (
      this.sourceLessOneKeyIdRecoveryRetryTimer as ReturnType<
        typeof setTimeout
      > & { unref?: () => void }
    ).unref?.();
  }

  /**
   * Entry guard for invalid-token reconciliation. The coordinator performs
   * the authoritative token and identity recheck after the current login
   * lifecycle scope releases.
   */
  private async evaluateInvalidTokenClearGuards({
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
    skip: boolean;
    authSessionSource: EPrimeAuthSessionSource | undefined;
  }> {
    if (getActiveIdentityLifecycleOperationId()) {
      return { skip: true, authSessionSource: undefined };
    }
    const authSessionSource =
      await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
    if (!authSessionSource) {
      throw new OneKeyLocalError(
        'OneKey ID authSessionSource is unavailable during invalid-token reconciliation.',
      );
    }
    const tokenRead = await readAuthTokenAllowingRetryableAuthError(() =>
      this.backgroundApi.simpleDb.prime.getActiveAuthToken(),
    );
    if (tokenRead.retryableError) {
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: requestUrl || '',
        errorCode: errorCode || -1,
        errorMessage: `skip clearing invalid token response because local refresh failed: ${getSanitizedAuthErrorLog(
          tokenRead.retryableError,
        )}`,
      });
      return { skip: true, authSessionSource };
    }
    const currentAuthToken = tokenRead.token;

    if (
      !requestAuthToken ||
      !currentAuthToken ||
      requestAuthToken !== currentAuthToken
    ) {
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: requestUrl || '',
        errorCode: errorCode || -1,
        errorMessage: `skip clearing invalid token response without an exact active-token match: ${
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
    authStateGeneration?: number;
    identityLifecycleRevision?: number;
  }> {
    if (getActiveIdentityLifecycleOperationId()) {
      return { cleared: false };
    }
    if (!isIdentityRecoveryReady()) {
      return { cleared: false };
    }
    const entryGuards = await this.evaluateInvalidTokenClearGuards({
      requestAuthToken,
      errorCode,
      errorMessage,
      requestUrl,
    });
    if (entryGuards.skip) {
      return {
        cleared: false,
        authSessionSource: entryGuards.authSessionSource,
      };
    }
    const entryAuthSessionSource = entryGuards.authSessionSource;
    if (!entryAuthSessionSource) {
      throw new OneKeyLocalError(
        'OneKey ID authSessionSource is unavailable during invalid-token reconciliation.',
      );
    }

    const authStateGeneration =
      await this.backgroundApi.simpleDb.prime.getAuthStateGeneration();
    if (!requestAuthToken) {
      return {
        cleared: false,
        authSessionSource: entryAuthSessionSource,
        authStateGeneration,
      };
    }
    const staged =
      await this.backgroundApi.serviceIdentityExit.stageRemoteOneKeyIdLogoutReconciliation(
        { expectedAccessToken: requestAuthToken },
      );
    if (!staged.staged) {
      return {
        cleared: false,
        authSessionSource: entryAuthSessionSource,
        authStateGeneration,
      };
    }
    void (async () => {
      try {
        const receipt =
          await this.backgroundApi.serviceIdentityExit.executeIdentityExit({
            planId: staged.planId,
          });
        if (receipt.status === 'completed' && receipt.oneKeyIdLoggedOut) {
          appEventBus.emit(EAppEventBusNames.PrimeLoginInvalidToken, {
            authSessionSource: entryAuthSessionSource,
            clearedByBackground: true,
            authStateGeneration,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'unknown reconciliation error';
        defaultLogger.prime.subscription.onekeyIdInvalidToken({
          url: requestUrl || '',
          errorCode: errorCode || -1,
          errorMessage: `deferred invalid-token reconciliation failed: ${message}`,
        });
      }
    })();
    return {
      cleared: false,
      authSessionSource: entryAuthSessionSource,
      authStateGeneration,
    };
  }

  /**
   * Login-side atomic commit of the shared auth-state pair, always run
   * inside authStateWriteMutex: persist authSessionSource, verify the
   * committed source's session slot (occupancy, and for keyless callers the
   * slot identity via expectedSlotTokenSub), announce the commit, then run
   * the caller's prime-atom update. Every step is LOCAL — the slot check is a
   * strict persisted-bytes read, never the Supabase SDK's getSession()
   * (which can trigger a NETWORK token refresh or throw transient
   * sealed-storage errors), so this section obeys the authStateWriteMutex
   * lock policy. Callers do not need a token refresh here either: each one
   * just had its access token accepted by the server (the login/bind POST
   * outside the lock), so the read only has to prove the session is
   * persisted locally — steady-state token reads (with refresh) still go
   * through getActiveAuthToken outside the lock.
   *
   * Failure atomicity: ANY failure after the source write — empty/corrupt
   * slot, a transient slot-read error rethrown by the strict reader, or a
   * failed prime-atom update — rolls the whole pair back (clearAuthTokens +
   * setPrimePersistAtomNotLoggedIn) before rethrowing, so no path can exit
   * with the source committed but the atom not updated. The rollback resets
   * to logged-out even on the bind path (which stays logged in on success);
   * that mirrors the long-standing empty-slot behavior — the session slot
   * itself is untouched, so a retry can log back in.
   */
  private async commitAuthSessionSourceAndPrimeAtom({
    authSessionSource,
    callerName,
    updatePrimeAtom,
    expectedSlotTokenSub,
  }: {
    authSessionSource: EPrimeAuthSessionSource;
    callerName: string;
    // In-lock prime-atom update matching this commit (local writes only).
    updatePrimeAtom: () => Promise<void>;
    // Keyless-realm callers pass the guard-verified in-flight `sub` so the
    // identity invariant is re-asserted INSIDE the commit lock: the
    // pre-POST guard cannot cover the guard->POST->commit window, in which
    // a concurrent main-runtime persist can still replace the shared slot
    // with another account's session. Legacy-realm logins have no keyless
    // identity to compare and omit it.
    expectedSlotTokenSub?: string;
  }) {
    const persistedSessionCommitId =
      await this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
        authSessionSource,
      );
    const sessionCommitId =
      authSessionSource === EPrimeAuthSessionSource.KeylessOAuth &&
      persistedSessionCommitId
        ? persistedSessionCommitId
        : stringUtils.generateUUID();
    await this.backgroundApi.simpleDb.prime.setAuthSessionSourceWithCommitId({
      authSessionSource,
      sessionCommitId,
    });
    try {
      // Strict LOCAL read of the committed source's slot (both realms are
      // supported): an expired-but-persisted token passes — proving slot
      // occupancy (plus, for keyless, slot identity below) is all that is
      // needed here, refreshes happen later outside the lock.
      const slot =
        await readPersistedAccessTokenBySessionSourceStrict(authSessionSource);
      if (slot.status !== 'ok') {
        defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
          reason: `${callerName}: auth session source committed but the session slot is ${slot.status}`,
        });
        throw new OneKeyLocalError(
          `${callerName} ERROR: Active auth token not found`,
        );
      }
      if (expectedSlotTokenSub) {
        const slotTokenSub =
          (
            stringUtils.decodeJWT(
              slot.accessToken,
            ) as ISupabaseJWTPayload | null
          )?.sub || '';
        if (!slotTokenSub) {
          // Undecodable slot payload: identity cannot be proven and a
          // re-read yields the same bytes — definitive abort like a corrupt
          // slot (caller cleanup of an unusable slot is harmless).
          defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
            reason: `${callerName}: committed slot token payload is not decodable`,
          });
          throw new OneKeyLocalError(
            `${callerName} ERROR: Keyless OAuth session token payload is not decodable`,
          );
        }
        if (slotTokenSub !== expectedSlotTokenSub) {
          defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
            reason: `${callerName}: keyless session slot was replaced by a different account during commit`,
          });
          // Same typed error as the pre-POST guard: the slot now holds the
          // winning concurrent flow's valid session, so main-runtime
          // definitive-failure cleanup must skip its session teardown. The
          // rollback below resets only source + atom; the slot itself is
          // untouched.
          throw new OneKeyErrorOneKeyIdKeylessSessionSlotReplaced();
        }
      }
      // Notify main-runtime session holders (SupabaseAuthProvider) that the
      // source changed. This must not rely on a primePersistAtom.isLoggedIn
      // flip: apiBindLegacyOneKeyIdOAuth switches LegacyEmailSupabase ->
      // KeylessOAuth while staying logged in, and bg-side setSession writes
      // (legacy keyless migration) emit no auth events in the main runtime.
      // On desktop/web (single runtime) the event is a harmless self-delivery.
      // Emitting before the atom update preserves the pre-existing ordering;
      // the handler is a pure projection refresh that re-reads persisted
      // state, so an event followed by the rollback below is benign.
      appEventBus.emit(EAppEventBusNames.PrimeAuthSessionSourceCommitted, {
        authSessionSource,
        callerName,
      });
      await updatePrimeAtom();
      const identityLifecycleRevision =
        await this.backgroundApi.simpleDb.prime.bumpIdentityLifecycleRevision();
      appEventBus.emit(EAppEventBusNames.IdentityLifecycleCommitted, {
        revision: identityLifecycleRevision,
        oneKeyIdState: 'loggedIn',
      });
    } catch (error) {
      // Roll back to a consistent logged-out pair before rethrowing — the
      // exact rollback the empty-slot branch has always performed. Without
      // it, a throw here would escape with the source already persisted:
      // server logged in, source committed, atom still logged out.
      await this.backgroundApi.simpleDb.prime.clearAuthTokens();
      await this.setPrimePersistAtomNotLoggedIn();
      throw error;
    }
  }

  private async apiLoginWithPersistedLegacySession({
    accessToken,
    authSessionSource,
  }: {
    accessToken: string;
    authSessionSource?: EPrimeAuthSessionSource;
  }) {
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
      // atomic (local-only) write, so the invalid-token cleanup can never
      // observe — and wipe — a half-committed login, and any commit
      // failure rolls the pair back. The network POST above stays outside
      // this lock; it is held only for the few-ms local commit.
      await this.authStateWriteMutex.runExclusive(async () => {
        await this.commitAuthSessionSourceAndPrimeAtom({
          authSessionSource: nextAuthSessionSource,
          callerName: 'ServicePrime.apiLogin',
          updatePrimeAtom: async () => {
            await this.updatePrimeAtomByServerUserInfo({
              serverUserInfo: response.data.data,
            });
          },
        });
      });
    } catch (error) {
      // The invalid-token interceptor durably stages exact cleanup before
      // this lifecycle scope releases. Do not clear source metadata here or
      // the coordinator would lose the authoritative session snapshot it
      // must compare before deleting the slot. Other POST failures likewise
      // keep the existing source usable on retry.
      // A COMMIT failure has already rolled the source/atom pair back
      // inside commitAuthSessionSourceAndPrimeAtom and only needs the
      // rethrow.
      throw error;
    }
  }

  @backgroundMethod()
  async apiLogin(params: {
    accessToken: string;
    authSessionSource?: EPrimeAuthSessionSource;
  }) {
    return this.loginMutex.runExclusive(() =>
      this.apiLoginWithPersistedLegacySession(params),
    );
  }

  @backgroundMethod()
  async apiEmailOtpLogin({
    email,
    otp,
  }: {
    email: string;
    otp: string;
  }): Promise<{ success: true }> {
    try {
      return await this.loginMutex.runExclusive(async () => {
        await this.assertOneKeyIdLoggedOutForInteractiveLogin(
          'ServicePrime.apiEmailOtpLogin',
        );
        allowAuthSessionStorageWritesBySessionSource(
          EPrimeAuthSessionSource.LegacyEmailSupabase,
        );
        const client = await getSupabaseClientBySessionSource(
          EPrimeAuthSessionSource.LegacyEmailSupabase,
        );
        let response: AuthResponse | undefined;
        if (email.endsWith('@privy.io')) {
          try {
            const phoneOtpData = await this.apiFetchPhoneOtp({ email, otp });
            if (phoneOtpData?.phone && phoneOtpData?.otp) {
              response = await client.auth.verifyOtp({
                phone: phoneOtpData.phone,
                token: phoneOtpData.otp,
                type: 'sms',
              });
            }
          } catch (error) {
            defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
              reason: `ServicePrime.apiEmailOtpLogin phone OTP exchange failed before email fallback: ${getSanitizedAuthErrorLog(
                error,
              )}`,
            });
          }
        }

        response ??= await client.auth.verifyOtp({
          email,
          token: otp,
          type: 'email',
        });
        if (response.error) {
          const error = new OneKeyLocalError(response.error.message);
          defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
            reason: `ServicePrime.apiEmailOtpLogin email OTP verification failed: ${getSanitizedAuthErrorLog(
              response.error,
            )}`,
          });
          markOneKeyIdFailureServerLogged(error);
          throw error;
        }
        const accessToken = response.data.session?.access_token;
        if (!accessToken) {
          // TODO: i18n
          throw new OneKeyLocalError(
            'OneKey ID login failed: access token not found',
          );
        }
        await this.apiLoginWithPersistedLegacySession({ accessToken });
        defaultLogger.prime.subscription.onekeyIdLoginSuccess({
          method: 'email',
        });
        return { success: true };
      });
    } catch (error) {
      if (!wasOneKeyIdFailureServerLogged(error)) {
        defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
          reason: `ServicePrime.apiEmailOtpLogin failed: ${getSanitizedAuthErrorLog(
            error,
          )}`,
        });
        markOneKeyIdFailureServerLogged(error);
      }
      throw error;
    }
  }

  // Guard shared by every flow that POSTs a keyless-realm login/bind and then
  // commits KeylessOAuth: prove the shared keyless session slot actually
  // persists THIS caller's identity BEFORE any server-side state change, so
  // the server login can never succeed while the local commit fails or
  // serves another account (server logged in / client rolled back, or
  // committed local state backed by a different account's slot session).
  // Definitive bad slot states (empty / corrupt / identity mismatch) abort
  // here; a TRANSIENT storage failure is rethrown as-is instead of
  // proceeding — the slot state is unknown, so running the server mutation
  // could recreate the very split this guard prevents, while the retryable
  // error type (recognized by isTransientNetworkLikeError) keeps callers
  // from tearing down a possibly-valid just-persisted session.
  private async assertKeylessSessionPersistedBeforeLogin({
    accessToken,
    callerName,
  }: {
    // The in-flight keyless-realm access token the caller is about to POST.
    accessToken: string;
    callerName: string;
  }) {
    // Force a fresh local read: on split-runtime targets the bg storage cache
    // may still hold a pre-login empty probe (up to 30s), whose cross-runtime
    // invalidation after the UI-side persist is best-effort.
    clearSupabaseStorageLocalCache();
    const slot = await readPersistedAccessTokenBySessionSourceStrict(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    if (slot.status !== 'ok') {
      defaultLogger.prime.subscription.onekeyIdSessionPersistFailed({
        reason: `${callerName}: keyless session slot is ${slot.status}, skip server login`,
      });
      // Both states are deterministic — a corrupt slot re-reads the same
      // bytes and would fail the post-POST commit identically — so a
      // definitive abort (which lets callers clear the unusable slot) is
      // correct for both.
      throw new OneKeyLocalError(
        slot.status === 'corrupt'
          ? `${callerName} ERROR: Keyless OAuth session slot is corrupt`
          : `${callerName} ERROR: Keyless OAuth session is not persisted locally`,
      );
    }
    // Identity check, not just occupancy: the caller's persist
    // (persistKeylessOAuthSession) and this login/bind method hold SEPARATE
    // loginMutex sections, so between the two a concurrent flow (e.g. ext
    // popup vs expand tab) can still overwrite the shared slot with ANOTHER
    // account's session.
    // Occupancy alone would then let the POST proceed with account A's
    // token while the committed local state serves account B's slot.
    // Compare the JWT `sub` claims (payload decode only, no signature or
    // expiry verification — the server validates the POSTed token), NOT raw
    // token bytes: bg auto-refresh legitimately rotates tokens for the same
    // identity.
    const slotTokenSub =
      (stringUtils.decodeJWT(slot.accessToken) as ISupabaseJWTPayload | null)
        ?.sub || '';
    const inFlightTokenSub =
      (stringUtils.decodeJWT(accessToken) as ISupabaseJWTPayload | null)?.sub ||
      '';
    if (!slotTokenSub || !inFlightTokenSub) {
      // Undecodable payload on either side: identity cannot be proven, and
      // a re-read yields the same bytes — definitive abort, like a corrupt
      // slot. Never log token material, only which side failed to decode.
      defaultLogger.prime.subscription.onekeyIdSessionPersistFailed({
        reason: `${callerName}: keyless session identity is undecodable (slot sub readable: ${String(
          Boolean(slotTokenSub),
        )}, in-flight sub readable: ${String(
          Boolean(inFlightTokenSub),
        )}), skip server login`,
      });
      throw new OneKeyLocalError(
        `${callerName} ERROR: Keyless OAuth session token payload is not decodable`,
      );
    }
    if (slotTokenSub !== inFlightTokenSub) {
      defaultLogger.prime.subscription.onekeyIdSessionPersistFailed({
        reason: `${callerName}: keyless session slot was replaced by a different account, skip server login`,
      });
      // Typed error (NOT OneKeyLocalError): unlike the empty/corrupt/
      // undecodable branches above (whose slot is unusable, so caller
      // cleanup is harmless), here the slot holds the WINNING concurrent
      // flow's valid session. Main-runtime definitive-failure cleanup keys
      // off this className to skip its session teardown — wiping the slot
      // would fail BOTH concurrent logins.
      throw new OneKeyErrorOneKeyIdKeylessSessionSlotReplaced();
    }
    // Callers re-assert this identity inside the commit lock: the slot can
    // still be replaced during the server POST that runs between this guard
    // and the commit.
    return { verifiedTokenSub: inFlightTokenSub };
  }

  private async apiOAuthLoginWithPersistedSession({
    accessToken,
    callerName,
    expectedOneKeyUserId,
  }: {
    accessToken: string;
    callerName: string;
    expectedOneKeyUserId?: string;
  }): Promise<IOneKeyIdOAuthLoginResponse> {
    if (!accessToken) {
      throw new OneKeyLocalError(`${callerName} ERROR: Invalid accessToken`);
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
    // Fail fast when the shared keyless session slot is empty or holds a
    // different account's session (run AFTER the cache clear above so the
    // read cannot serve a stale pre-login probe): the POST below would
    // otherwise succeed on the server while the local commit fails or
    // serves the wrong slot, leaving the server logged in and the client
    // rolled back (or logged in as another account locally).
    const { verifiedTokenSub } =
      await this.assertKeylessSessionPersistedBeforeLogin({
        accessToken,
        callerName,
      });
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
      throw new OneKeyLocalError(`${callerName} ERROR: Empty response data`);
    }
    if (
      expectedOneKeyUserId &&
      data.onekeyAccount.onekeyUserId !== expectedOneKeyUserId
    ) {
      throw new OneKeyLocalError(
        `${callerName} ERROR: OAuth login resolved a different OneKey ID`,
      );
    }
    // Commit section (authStateWriteMutex, inner to loginMutex): source +
    // atom written as one atomic (local-only, rollback-on-failure) pair —
    // see apiLogin. The POST above and the legacy-session cleanup below
    // (Supabase signOut, network-capable) stay outside the lock.
    await this.authStateWriteMutex.runExclusive(async () => {
      await this.commitAuthSessionSourceAndPrimeAtom({
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        callerName,
        expectedSlotTokenSub: verifiedTokenSub,
        updatePrimeAtom: async () => {
          await this.updatePrimeAtomByOAuthLoginResponse({
            loginResponse: data,
          });
        },
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
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: `${callerName}: post-commit legacy session cleanup failed: ${getSanitizedAuthErrorLog(
          cleanupError,
        )}`,
      });
    }
    await this.cleanupLegacyKeylessSessionStorageBestEffort({ callerName });
    return data;
  }

  @backgroundMethod()
  @toastIfError()
  async apiOAuthLogin({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<IOneKeyIdOAuthLoginResponse> {
    return this.loginMutex.runExclusive(async () => {
      await this.assertOneKeyIdLoggedOutForInteractiveLogin(
        'ServicePrime.apiOAuthLogin',
      );
      const loginResponse = await this.apiOAuthLoginWithPersistedSession({
        accessToken,
        callerName: 'ServicePrime.apiOAuthLogin',
      });
      defaultLogger.prime.subscription.onekeyIdLoginSuccess({
        method: 'oauth',
      });
      return loginResponse;
    });
  }

  @backgroundMethod()
  async apiPromoteBoundOAuthSessionForLegacyOneKeyId({
    accessToken,
    provider,
    expectedOnekeyUserId,
  }: {
    accessToken: string;
    provider: EOAuthSocialLoginProvider;
    expectedOnekeyUserId: string;
  }): Promise<IOneKeyIdOAuthLoginResponse> {
    const callerName =
      'ServicePrime.apiPromoteBoundOAuthSessionForLegacyOneKeyId';
    return this.loginMutex.runExclusive(async () => {
      if (!accessToken) {
        throw new OneKeyLocalError(`${callerName} ERROR: Invalid accessToken`);
      }
      const createStateChangedError = () =>
        new OneKeyLocalError(
          `${callerName}: OneKey ID login changed during OAuth verification. Please try again.`,
        );
      const currentUser = await primePersistAtom.get();
      if (
        !currentUser.isLoggedIn ||
        !currentUser.isLoggedInOnServer ||
        currentUser.onekeyUserId !== expectedOnekeyUserId
      ) {
        throw createStateChangedError();
      }
      const legacyAuthSnapshot = await this.captureOneKeyIdAuthSnapshot({
        expectedOneKeyUserId: expectedOnekeyUserId,
        requireSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
        insideLoginMutex: true,
        createStateChangedError,
      });

      const client = await this.getPrimeClient();
      const profileResult = await client.get<
        IApiClientResponse<IOneKeyIdProfileResponse>
      >(
        '/prime/v1/account/profile',
        this.getOneKeyIdAuthSnapshotRequestConfig(legacyAuthSnapshot),
      );
      const account = profileResult?.data?.data?.onekeyAccount;
      if (!account) {
        throw new OneKeyLocalError(`${callerName} ERROR: Empty profile data`);
      }
      if (account.onekeyUserId !== expectedOnekeyUserId) {
        throw createStateChangedError();
      }
      if (
        !this.isOAuthAccessTokenIdentityBoundToAccount({
          account,
          oauthAccessToken: accessToken,
          provider,
        })
      ) {
        throw new OneKeyLocalError(
          `${callerName}: OAuth identity is not bound to the current OneKey ID.`,
        );
      }

      await this.assertOneKeyIdAuthSnapshot({
        snapshot: legacyAuthSnapshot,
        createStateChangedError,
      });
      return this.apiOAuthLoginWithPersistedSession({
        accessToken,
        callerName,
        expectedOneKeyUserId: expectedOnekeyUserId,
      });
    });
  }

  private async assertOneKeyIdLoggedOutForInteractiveLogin(
    callerName: string,
  ): Promise<void> {
    const incompleteLogoutRepair =
      await this.repairIncompleteLocalOneKeyIdLogoutUnderLifecycleLock();
    if (incompleteLogoutRepair === 'stateChanged') {
      const error = new OneKeyLocalError(
        `${callerName}: OneKey ID auth state changed during recovery. Please try again.`,
      );
      defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
        reason: getSanitizedAuthErrorLog(error),
      });
      markOneKeyIdFailureServerLogged(error);
      throw error;
    }
    const [user, source, authState] = await Promise.all([
      primePersistAtom.get(),
      this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource(),
      this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
    ]);
    if (user.isLoggedIn !== user.isLoggedInOnServer) {
      const error = new OneKeyLocalError(
        `${callerName}: OneKey ID login projection is inconsistent.`,
      );
      defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
        reason: getSanitizedAuthErrorLog(error),
      });
      markOneKeyIdFailureServerLogged(error);
      throw error;
    }
    if (
      user.isLoggedIn ||
      user.isLoggedInOnServer ||
      source ||
      authState === 'loggedIn'
    ) {
      const error = new OneKeyLocalError(
        `${callerName}: OneKey ID is already logged in. Sign out before switching accounts.`,
      );
      defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
        reason: getSanitizedAuthErrorLog(error),
      });
      markOneKeyIdFailureServerLogged(error);
      throw error;
    }
  }

  private async assertNoLocalKeylessWalletForFreshOAuthLogin(): Promise<void> {
    if (await this.backgroundApi.serviceAccount.getKeylessWallet()) {
      // TODO: i18n
      throw new OneKeyLocalError({
        message:
          'Independent OneKey ID login cannot continue because a local Keyless wallet now exists.',
        autoToast: false,
      });
    }
  }

  private async removeExactKeylessOAuthSessionForJournal(
    journal: IKeylessOAuthSessionPersistenceJournal,
  ): Promise<void> {
    await runExclusiveOnAuthSessionSlot(
      EPrimeAuthSessionSource.KeylessOAuth,
      async () => {
        clearSupabaseStorageLocalCache();
        const currentSlot = await readPersistedAccessTokenBySessionSourceStrict(
          EPrimeAuthSessionSource.KeylessOAuth,
        );
        if (currentSlot.status !== 'ok') {
          return;
        }
        const currentIdentity = readKeylessOAuthSessionIdentity(
          currentSlot.accessToken,
        );
        if (
          currentIdentity.status !== 'ok' ||
          currentIdentity.identity.sessionTokenSub !==
            journal.sessionTokenSub ||
          currentIdentity.identity.supabaseSessionId !==
            journal.supabaseSessionId
        ) {
          return;
        }
        await removeAuthSessionStorageBySessionSource(
          EPrimeAuthSessionSource.KeylessOAuth,
        );
        clearSupabaseStorageLocalCache();
      },
    );
  }

  private async recoverKeylessOAuthSessionPersistenceJournalUnderLifecycle(): Promise<{
    recovered: boolean;
    abandoned: boolean;
    identityLifecycleRevision?: number;
  }> {
    const journal =
      await this.backgroundApi.simpleDb.prime.getKeylessOAuthSessionPersistenceJournal();
    if (!journal) {
      return { recovered: false, abandoned: false };
    }

    const slot = await readPersistedAccessTokenBySessionSourceStrict(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    const persistedSessionIdentity =
      slot.status === 'ok'
        ? readKeylessOAuthSessionIdentity(slot.accessToken)
        : undefined;
    if (
      persistedSessionIdentity?.status !== 'ok' ||
      persistedSessionIdentity.identity.sessionTokenSub !==
        journal.sessionTokenSub ||
      persistedSessionIdentity.identity.supabaseSessionId !==
        journal.supabaseSessionId
    ) {
      const removed =
        await this.backgroundApi.simpleDb.prime.removeKeylessOAuthSessionPersistenceJournal(
          { operationId: journal.operationId },
        );
      if (!removed) {
        throw new OneKeyLocalError(
          'Keyless OAuth session persistence journal changed during recovery.',
        );
      }
      return { recovered: false, abandoned: true };
    }

    if (journal.walletId) {
      const wallet = await this.backgroundApi.serviceAccount.getKeylessWallet();
      if (wallet?.id !== journal.walletId) {
        throw new OneKeyLocalError(
          `Keyless OAuth session persistence recovery expected wallet ${
            journal.walletId
          }, received ${wallet?.id ?? 'undefined'}.`,
        );
      }
    }

    const commit =
      await this.backgroundApi.simpleDb.prime.commitKeylessOAuthSessionPersistenceMetadata(
        {
          operationId: journal.operationId,
          persistedSessionIdentity: persistedSessionIdentity.identity,
          allowRevisionRebase: true,
        },
      );
    if (commit.status === 'stateChanged') {
      await this.removeExactKeylessOAuthSessionForJournal(journal);
      const removed =
        await this.backgroundApi.simpleDb.prime.removeKeylessOAuthSessionPersistenceJournal(
          { operationId: journal.operationId },
        );
      if (!removed) {
        throw new OneKeyLocalError(
          'Keyless OAuth session persistence journal changed during conflict recovery.',
        );
      }
      return { recovered: false, abandoned: true };
    }
    if (commit.status !== 'committed') {
      throw new OneKeyLocalError(
        'Keyless OAuth session persistence metadata changed before recovery could commit.',
      );
    }
    const currentUser = await primePersistAtom.get();
    appEventBus.emit(EAppEventBusNames.IdentityLifecycleCommitted, {
      revision: commit.identityLifecycleRevision,
      oneKeyIdState:
        currentUser.isLoggedIn && currentUser.isLoggedInOnServer
          ? 'loggedIn'
          : 'loggedOut',
    });
    return {
      recovered: true,
      abandoned: false,
      identityLifecycleRevision: commit.identityLifecycleRevision,
    };
  }

  async recoverInterruptedKeylessOAuthSessionPersistence(): Promise<{
    recovered: boolean;
    abandoned: boolean;
  }> {
    return identityLifecycleMutex.runExclusiveForRecovery(async () => {
      const journal =
        await this.backgroundApi.simpleDb.prime.getKeylessOAuthSessionPersistenceJournal();
      if (!journal) {
        return { recovered: false, abandoned: false };
      }
      markIdentityRecoveryPending(journal.operationId);
      try {
        const result =
          await this.recoverKeylessOAuthSessionPersistenceJournalUnderLifecycle();
        markIdentityRecoveryReady(journal.operationId);
        return {
          recovered: result.recovered,
          abandoned: result.abandoned,
        };
      } catch (error) {
        markIdentityRecoveryFailed(journal.operationId);
        throw error;
      }
    });
  }

  private async persistKeylessOAuthSessionWithinLifecycle({
    accessToken,
    refreshToken,
    expectedWalletId,
  }: {
    accessToken: string;
    refreshToken: string;
    expectedWalletId?: string;
  }): Promise<{
    identityLifecycleRevision: number;
    sessionCommitId: string;
    sessionTokenSub: string;
    walletId?: string;
  }> {
    await identityLifecycleMutex.waitForUnlock();
    return this.loginMutex.runExclusive(() =>
      this.persistKeylessOAuthSessionUnderLifecycleLock({
        accessToken,
        refreshToken,
        expectedWalletId,
      }),
    );
  }

  private async persistKeylessOAuthSessionUnderLifecycleLock({
    accessToken,
    refreshToken,
    expectedWalletId,
  }: {
    accessToken: string;
    refreshToken: string;
    expectedWalletId?: string;
  }): Promise<{
    identityLifecycleRevision: number;
    sessionCommitId: string;
    sessionTokenSub: string;
    walletId?: string;
  }> {
    const operationId = `keylessSession:${stringUtils.generateUUID()}`;
    beginIdentityLifecycleReservation(operationId);
    try {
      return await this.persistKeylessOAuthSessionWithinReservation({
        accessToken,
        refreshToken,
        expectedWalletId,
        operationId,
      });
    } finally {
      endIdentityLifecycleReservation(operationId);
    }
  }

  private async repairIncompleteLocalOneKeyIdLogout(): Promise<
    'notNeeded' | 'repaired' | 'stateChanged'
  > {
    return identityLifecycleMutex.runExclusive(() =>
      this.repairIncompleteLocalOneKeyIdLogoutUnderLifecycleLock(),
    );
  }

  /**
   * The caller must hold identityLifecycleMutex. Existing lifecycle
   * reservations are reused; standalone repairs reserve their commit so
   * invalid-token cleanup and other observers cannot start a competing flow.
   */
  private async repairIncompleteLocalOneKeyIdLogoutUnderLifecycleLock(): Promise<
    'notNeeded' | 'repaired' | 'stateChanged'
  > {
    const activeOperationId = getActiveIdentityLifecycleOperationId();
    if (activeOperationId) {
      return this.commitIncompleteLocalOneKeyIdLogoutRepair();
    }
    const operationId = `repairIncompleteOneKeyIdLogout:${stringUtils.generateUUID()}`;
    beginIdentityLifecycleReservation(operationId);
    try {
      return await this.commitIncompleteLocalOneKeyIdLogoutRepair();
    } finally {
      endIdentityLifecycleReservation(operationId);
    }
  }

  private async commitIncompleteLocalOneKeyIdLogoutRepair(): Promise<
    'notNeeded' | 'repaired' | 'stateChanged'
  > {
    const [
      currentUser,
      authSessionSource,
      oneKeyIdAuthState,
      authStateGeneration,
      identityLifecycleRevision,
    ] = await Promise.all([
      primePersistAtom.get(),
      this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
      this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
      this.backgroundApi.simpleDb.prime.getAuthStateGeneration(),
      this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
    ]);
    const hasLoggedInFlags = Boolean(
      currentUser.isLoggedIn && currentUser.isLoggedInOnServer,
    );
    const isCurrentLoggedInProjection = Boolean(
      hasLoggedInFlags &&
      currentUser.onekeyUserId &&
      authSessionSource &&
      oneKeyIdAuthState === 'loggedIn',
    );
    const isPreUpgradeLoggedInProjection = Boolean(
      hasLoggedInFlags &&
      currentUser.onekeyUserId &&
      !authSessionSource &&
      oneKeyIdAuthState === undefined &&
      authStateGeneration === 0,
    );
    const isFullyLoggedOut = Boolean(
      !currentUser.isLoggedIn &&
      !currentUser.isLoggedInOnServer &&
      !currentUser.onekeyUserId &&
      !authSessionSource &&
      oneKeyIdAuthState === 'loggedOut',
    );
    if (
      isCurrentLoggedInProjection ||
      isPreUpgradeLoggedInProjection ||
      isFullyLoggedOut
    ) {
      return 'notNeeded';
    }

    let repairType:
      | 'legacyLoggedOutWithoutTombstone'
      | 'invalidLoggedInProjection'
      | 'incompleteLogoutProjection';
    if (
      !currentUser.isLoggedIn &&
      !currentUser.isLoggedInOnServer &&
      !currentUser.onekeyUserId &&
      !authSessionSource &&
      oneKeyIdAuthState === undefined &&
      authStateGeneration === 0
    ) {
      repairType = 'legacyLoggedOutWithoutTombstone';
    } else if (hasLoggedInFlags) {
      repairType = 'invalidLoggedInProjection';
    } else {
      repairType = 'incompleteLogoutProjection';
    }
    defaultLogger.prime.subscription.onekeyIdAuthStateRepair({
      stage: 'candidateDetected',
      status: 'started',
      repairType,
    });

    // Treat every partial projection as an interrupted local logout. The
    // compare-and-set commit rechecks the revision and full projection before
    // writing the logged-out tombstone, so a concurrent login always wins.
    // Session slots stay intact here because an incomplete projection cannot
    // prove their ownership; the normal identity-exit journal clears owned
    // slots, while a later successful login safely replaces its Keyless slot.
    try {
      const result = await this.commitExplicitLocalOneKeyIdLogout({
        expectedIdentityLifecycleRevision: identityLifecycleRevision,
        expectedProjection: {
          authSessionSource,
          oneKeyIdAuthState,
          isLoggedIn: currentUser.isLoggedIn,
          isLoggedInOnServer: currentUser.isLoggedInOnServer,
          onekeyUserId: currentUser.onekeyUserId,
        },
      });
      defaultLogger.prime.subscription.onekeyIdAuthStateRepair({
        stage: 'stateCommit',
        status: result.status === 'committed' ? 'succeeded' : 'stateChanged',
        repairType,
      });
      return result.status === 'committed' ? 'repaired' : 'stateChanged';
    } catch (error) {
      defaultLogger.prime.subscription.onekeyIdAuthStateRepair({
        stage: 'stateCommit',
        status: 'failed',
        repairType,
      });
      throw error;
    }
  }

  private async persistKeylessOAuthSessionWithinReservation({
    accessToken,
    refreshToken,
    expectedWalletId,
    operationId,
  }: {
    accessToken: string;
    refreshToken: string;
    expectedWalletId?: string;
    operationId: string;
  }): Promise<{
    identityLifecycleRevision: number;
    sessionCommitId: string;
    sessionTokenSub: string;
    walletId?: string;
  }> {
    const sessionIdentity = readKeylessOAuthSessionIdentity(accessToken);
    if (sessionIdentity.status !== 'ok') {
      throw new OneKeyLocalError(
        `Failed to persist Keyless OAuth session: token ${sessionIdentity.claim} claim is missing`,
      );
    }
    const { sessionTokenSub, supabaseSessionId } = sessionIdentity.identity;

    const incompleteLogoutRepair =
      await this.repairIncompleteLocalOneKeyIdLogoutUnderLifecycleLock();
    if (incompleteLogoutRepair === 'stateChanged') {
      throw new OneKeyLocalError(
        'Failed to persist Keyless OAuth session: OneKey ID auth state changed during recovery.',
      );
    }

    const [currentOneKeyIdUser, activeOneKeyIdSource, oneKeyIdAuthState] =
      await Promise.all([
        primePersistAtom.get(),
        this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource(),
        this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
      ]);
    if (
      currentOneKeyIdUser.isLoggedIn !== currentOneKeyIdUser.isLoggedInOnServer
    ) {
      throw new OneKeyLocalError(
        'Failed to persist Keyless OAuth session: OneKey ID login projection is inconsistent.',
      );
    }
    const isOneKeyIdLoggedIn = Boolean(
      currentOneKeyIdUser.isLoggedIn && currentOneKeyIdUser.isLoggedInOnServer,
    );
    if (
      isOneKeyIdLoggedIn &&
      (!activeOneKeyIdSource || oneKeyIdAuthState === 'loggedOut')
    ) {
      throw new OneKeyLocalError(
        'Failed to persist Keyless OAuth session: active OneKey ID auth source is unavailable.',
      );
    }
    if (
      !isOneKeyIdLoggedIn &&
      (activeOneKeyIdSource || oneKeyIdAuthState === 'loggedIn')
    ) {
      throw new OneKeyLocalError(
        'Failed to persist Keyless OAuth session: OneKey ID auth state is inconsistent after recovery.',
      );
    }
    if (
      isOneKeyIdLoggedIn &&
      activeOneKeyIdSource === EPrimeAuthSessionSource.KeylessOAuth
    ) {
      const activeSlot = await readPersistedAccessTokenBySessionSourceStrict(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      if (activeSlot.status !== 'ok') {
        throw new OneKeyLocalError(
          `Failed to persist Keyless OAuth session: active OneKey ID session slot is ${activeSlot.status}.`,
        );
      }
      const activeSessionTokenSub =
        (
          stringUtils.decodeJWT(
            activeSlot.accessToken,
          ) as ISupabaseJWTPayload | null
        )?.sub || '';
      if (!activeSessionTokenSub) {
        throw new OneKeyLocalError(
          'Failed to persist Keyless OAuth session: active OneKey ID session subject is unavailable.',
        );
      }
      if (activeSessionTokenSub !== sessionTokenSub) {
        throw new OneKeyErrorOneKeyIdKeylessSessionSlotReplaced();
      }
    }

    const keylessWallet =
      await this.backgroundApi.serviceAccount.getKeylessWallet();
    if (expectedWalletId && keylessWallet?.id !== expectedWalletId) {
      throw new OneKeyLocalError(
        `Keyless wallet changed before OAuth session persistence: expected ${expectedWalletId}, received ${
          keylessWallet?.id ?? 'undefined'
        }.`,
      );
    }
    if (keylessWallet) {
      const { isValid } =
        await this.backgroundApi.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
          {
            token: accessToken,
            skipFixProvider: true,
          },
        );
      if (!isValid) {
        throw new OneKeyLocalError(
          'Keyless OAuth session does not match the local Keyless wallet.',
        );
      }
    }

    const sessionCommitId = stringUtils.generateUUID();
    const now = Date.now();
    const persistencePreparation: IKeylessOAuthSessionPersistenceJournalPreparation =
      {
        operationId,
        status: 'prepared',
        startedAt: now,
        updatedAt: now,
        sessionCommitId,
        sessionTokenSub,
        supabaseSessionId,
        walletId: keylessWallet?.id,
      };

    markIdentityRecoveryPending(operationId);
    let persistenceJournal: IKeylessOAuthSessionPersistenceJournal;
    try {
      persistenceJournal =
        await this.backgroundApi.simpleDb.prime.setKeylessOAuthSessionPersistenceJournal(
          persistencePreparation,
        );
    } catch (error) {
      // A rejected storage write has an ambiguous durable outcome. The
      // SimpleDB cache is not authoritative after that failure, so keep the
      // identity gate closed until startup reloads and recovers persisted
      // state.
      markIdentityRecoveryFailed(operationId);
      throw error;
    }

    let metadataCommitStorageOutcomeUnknown = false;
    try {
      await persistKeylessAuthSession({ accessToken, refreshToken });
      clearSupabaseStorageLocalCache();
      const persistedSlot = await readPersistedAccessTokenBySessionSourceStrict(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      const persistedSessionIdentity =
        persistedSlot.status === 'ok'
          ? readKeylessOAuthSessionIdentity(persistedSlot.accessToken)
          : undefined;
      if (
        persistedSessionIdentity?.status !== 'ok' ||
        persistedSessionIdentity.identity.sessionTokenSub !== sessionTokenSub ||
        persistedSessionIdentity.identity.supabaseSessionId !==
          supabaseSessionId
      ) {
        throw new OneKeyLocalError(
          'Failed to persist Keyless OAuth session: exact session identity is not persisted locally',
        );
      }
      let commit;
      try {
        commit =
          await this.backgroundApi.simpleDb.prime.commitKeylessOAuthSessionPersistenceMetadata(
            {
              operationId: persistenceJournal.operationId,
              persistedSessionIdentity: persistedSessionIdentity.identity,
            },
          );
      } catch (error) {
        metadataCommitStorageOutcomeUnknown = true;
        markIdentityRecoveryFailed(persistenceJournal.operationId);
        throw error;
      }
      if (commit.status !== 'committed') {
        throw new OneKeyLocalError(
          'Keyless OAuth session persistence metadata changed before commit.',
        );
      }
      markIdentityRecoveryReady(persistenceJournal.operationId);
      const projectedUser = await primePersistAtom.get();
      appEventBus.emit(EAppEventBusNames.IdentityLifecycleCommitted, {
        revision: commit.identityLifecycleRevision,
        oneKeyIdState:
          projectedUser.isLoggedIn && projectedUser.isLoggedInOnServer
            ? 'loggedIn'
            : 'loggedOut',
      });
      return {
        identityLifecycleRevision: commit.identityLifecycleRevision,
        sessionCommitId,
        sessionTokenSub,
        walletId: keylessWallet?.id,
      };
    } catch (error) {
      if (metadataCommitStorageOutcomeUnknown) {
        throw error;
      }
      try {
        await this.recoverKeylessOAuthSessionPersistenceJournalUnderLifecycle();
        markIdentityRecoveryReady(persistenceJournal.operationId);
      } catch (recoveryError) {
        markIdentityRecoveryFailed(persistenceJournal.operationId);
        throw recoveryError;
      }
      throw error;
    }
  }

  async persistMigratedKeylessOAuthSessionForWallet({
    accessToken,
    refreshToken,
    expectedWalletId,
  }: {
    accessToken: string;
    refreshToken: string;
    expectedWalletId: string;
  }): Promise<void> {
    await this.persistKeylessOAuthSessionWithinLifecycle({
      accessToken,
      refreshToken,
      expectedWalletId,
    });
  }

  /**
   * Persist and commit a fresh OAuth session only while OneKey ID is still
   * logged out. Keeping the precondition and persistence under loginMutex
   * prevents a concurrent Email or OAuth login from committing between the
   * state check and the shared Keyless session-slot write.
   */
  @backgroundMethod()
  async apiOAuthLoginWithFreshSessionForLoggedOutState({
    accessToken,
    refreshToken,
    identityExitOAuthHandoff,
    provider,
  }: {
    accessToken: string;
    refreshToken: string;
    identityExitOAuthHandoff?: IIdentityExitOAuthHandoff;
    provider?: EOAuthSocialLoginProvider;
  }): Promise<IOneKeyIdOAuthLoginResponse> {
    const callerName =
      'ServicePrime.apiOAuthLoginWithFreshSessionForLoggedOutState';
    return this.loginMutex.runExclusive(async () => {
      if (Boolean(identityExitOAuthHandoff) !== Boolean(provider)) {
        throw new OneKeyLocalError(
          'OAuth provider-switch handoff and provider must be supplied together.',
        );
      }
      if (identityExitOAuthHandoff && provider) {
        const tokenProvider =
          this.backgroundApi.serviceKeylessWallet.buildKeylessProviderFromSocialToken(
            {
              token: accessToken,
              skipFixedProvider: true,
            },
          );
        if (tokenProvider !== provider) {
          throw new OneKeyLocalError(
            `OAuth callback provider mismatch: expected ${provider}, received ${tokenProvider}.`,
          );
        }
        await this.backgroundApi.serviceIdentityExit.consumeOAuthHandoffForLogin(
          {
            handoff: identityExitOAuthHandoff,
            provider,
          },
        );
      }
      if (await this.isLoggedIn()) {
        // TODO: i18n
        throw new OneKeyLocalError({
          message: 'OneKey ID login state changed. Please try again.',
          autoToast: false,
        });
      }

      await this.assertNoLocalKeylessWalletForFreshOAuthLogin();
      await this.persistKeylessOAuthSessionUnderLifecycleLock({
        accessToken,
        refreshToken,
      });
      // setSession may wait on network I/O. Recheck before the OneKey ID
      // POST so a Keyless wallet created during that wait wins the race.
      await this.assertNoLocalKeylessWalletForFreshOAuthLogin();
      const loginResponse = await this.apiOAuthLoginWithPersistedSession({
        accessToken,
        callerName,
      });
      defaultLogger.prime.subscription.onekeyIdLoginSuccess({
        method: provider ?? 'oauth',
      });
      return loginResponse;
    });
  }

  /**
   * Persist the shared Keyless OAuth slot from the BG runtime. All production
   * callers use this entry so session replacement participates in the same
   * lifecycle serialization and revision checks as identity exit.
   */
  @backgroundMethod()
  async persistKeylessOAuthSession({
    accessToken,
    refreshToken,
  }: {
    accessToken: string;
    refreshToken: string;
  }): Promise<{
    identityLifecycleRevision: number;
    rollbackHandle: IKeylessOAuthSessionRollbackHandle;
  }> {
    await identityLifecycleMutex.waitForUnlock();
    return this.loginMutex.runExclusive(async () => {
      const persisted = await this.persistKeylessOAuthSessionUnderLifecycleLock(
        {
          accessToken,
          refreshToken,
        },
      );
      const rollbackHandle =
        stringUtils.generateUUID() as IKeylessOAuthSessionRollbackHandle;
      const rollbackRecord: IKeylessOAuthSessionRollbackRecord = {
        expectedIdentityLifecycleRevision: persisted.identityLifecycleRevision,
        sessionCommitId: persisted.sessionCommitId,
        sessionTokenSub: persisted.sessionTokenSub,
        walletId: persisted.walletId,
        expiresAt: Date.now() + KEYLESS_OAUTH_SESSION_ROLLBACK_TTL_MS,
      };
      keylessOAuthSessionRollbackRegistry.set(rollbackHandle, rollbackRecord);
      const expiryTimer = setTimeout(() => {
        if (
          keylessOAuthSessionRollbackRegistry.get(rollbackHandle) ===
          rollbackRecord
        ) {
          keylessOAuthSessionRollbackRegistry.delete(rollbackHandle);
        }
      }, KEYLESS_OAUTH_SESSION_ROLLBACK_TTL_MS);
      rollbackRecord.expiryTimer = expiryTimer;
      (
        expiryTimer as unknown as {
          unref?: () => void;
        }
      ).unref?.();
      return {
        identityLifecycleRevision: persisted.identityLifecycleRevision,
        rollbackHandle,
      };
    });
  }

  @backgroundMethod()
  async rollbackProvisionalKeylessOAuthSession({
    rollbackHandle,
  }: {
    rollbackHandle: IKeylessOAuthSessionRollbackHandle;
  }): Promise<{ cleared: boolean }> {
    return this.loginMutex.runExclusive(async () => {
      const record = keylessOAuthSessionRollbackRegistry.get(rollbackHandle);
      keylessOAuthSessionRollbackRegistry.delete(rollbackHandle);
      if (!record) {
        return { cleared: false };
      }
      if (record.expiryTimer) {
        clearTimeout(record.expiryTimer);
      }
      if (record.expiresAt <= Date.now()) {
        return { cleared: false };
      }

      const source =
        await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
      if (source === EPrimeAuthSessionSource.KeylessOAuth) {
        return { cleared: false };
      }

      const result = await this.commitIdentityExitLocalState({
        expectedIdentityLifecycleRevision:
          record.expectedIdentityLifecycleRevision,
        keylessSession: {
          sessionCommitId: record.sessionCommitId,
          sessionTokenSub: record.sessionTokenSub,
        },
        keylessWalletSession: record.walletId
          ? {
              walletId: record.walletId,
              sessionCommitId: record.sessionCommitId,
            }
          : undefined,
      });
      return { cleared: result.status === 'committed' };
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
  async getBoundOAuthProvidersForCurrentOneKeyId(): Promise<
    EOAuthSocialLoginProvider[]
  > {
    const profile = await this.apiFetchOneKeyIdProfile();
    return getBoundOAuthProviders(profile.onekeyAccount).map(
      getSocialLoginProviderFromOneKeyIdOAuthProvider,
    );
  }

  @backgroundMethod()
  async isOAuthProviderBoundToCurrentOneKeyId({
    provider,
  }: {
    provider: EOAuthSocialLoginProvider;
  }): Promise<boolean> {
    const boundProviders =
      await this.getBoundOAuthProvidersForCurrentOneKeyId();
    return boundProviders.includes(provider);
  }

  @backgroundMethod()
  async isOAuthIdentityBoundToCurrentOneKeyId({
    oauthAccessToken,
    provider,
  }: {
    oauthAccessToken: string;
    provider: EOAuthSocialLoginProvider;
  }): Promise<boolean> {
    const profile = await this.apiFetchOneKeyIdProfile();
    return this.isOAuthAccessTokenIdentityBoundToAccount({
      account: profile.onekeyAccount,
      oauthAccessToken,
      provider,
    });
  }

  private isOAuthAccessTokenIdentityBoundToAccount({
    account,
    oauthAccessToken,
    provider,
  }: {
    account: IOneKeyIdAccount;
    oauthAccessToken: string;
    provider: EOAuthSocialLoginProvider;
  }): boolean {
    const decodedToken = stringUtils.decodeJWT(
      oauthAccessToken,
    ) as ISupabaseJWTPayload | null;
    const oauthSubject = decodedToken?.user_metadata?.sub || '';
    return isOneKeyIdOAuthIdentityBound({
      account,
      provider: getOneKeyIdOAuthProviderFromSocialLoginProvider(provider),
      subject: oauthSubject,
    });
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

  // Dedicated mutex for the optional OAuth bind reminder gate. Do NOT
  // reuse loginMutex: isLegacyOneKeyIdOAuthBindRequired() ->
  // apiFetchOneKeyIdProfile() waits for loginMutex to unlock and would
  // deadlock if the gate itself held it.
  oneKeyIdOAuthBindPromptCheckMutex = new Semaphore(1);

  private async claimOneKeyIdOAuthBindPromptInternal({
    onekeyUserId,
  }: {
    onekeyUserId: string;
  }): Promise<IOneKeyIdOAuthBindPromptClaimResult> {
    if (!onekeyUserId) {
      return { status: 'skip' };
    }
    return this.oneKeyIdOAuthBindPromptCheckMutex.runExclusive(async () => {
      let promptUpgradeState: {
        hasShown: boolean;
        credentialUpgradeCompleted: boolean;
        identityLifecycleRevision?: number;
      };
      try {
        promptUpgradeState =
          await this.backgroundApi.simpleDb.prime.getOneKeyIdOAuthBindPromptUpgradeState(
            { onekeyUserId },
          );
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
          reason: `ServicePrime.claimOneKeyIdOAuthBindPrompt prompt upgrade state read failed: ${getSanitizedAuthErrorLog(
            error,
          )}`,
        });
        return { status: 'retryable' };
      }

      if (
        promptUpgradeState.hasShown &&
        promptUpgradeState.credentialUpgradeCompleted
      ) {
        return { status: 'skip' };
      }

      // An already-consumed reminder may predate credential unification. It
      // must still get one passive Keyless migration opportunity, but profile
      // freshness is irrelevant because no dialog will be shown. New reminder
      // decisions still validate the live OneKey ID before touching Keyless.
      if (!promptUpgradeState.hasShown) {
        try {
          const { userInfo } = await this.apiFetchPrimeUserInfo();
          if (
            !userInfo.isLoggedIn ||
            !userInfo.isLoggedInOnServer ||
            userInfo.onekeyUserId !== onekeyUserId
          ) {
            return { status: 'skip' };
          }
        } catch (error) {
          defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
            reason: `ServicePrime.claimOneKeyIdOAuthBindPrompt OneKey ID refresh failed: ${getSanitizedAuthErrorLog(
              error,
            )}`,
          });
          return { status: 'retryable' };
        }
      }

      if (!promptUpgradeState.credentialUpgradeCompleted) {
        const expectedIdentityLifecycleRevision =
          promptUpgradeState.identityLifecycleRevision;
        if (expectedIdentityLifecycleRevision === undefined) {
          return { status: 'retryable' };
        }
        try {
          const keylessCredentialReadiness =
            await this.backgroundApi.serviceKeylessWallet.ensureKeylessCredentialReadyForOneKeyIdBind();
          if (keylessCredentialReadiness.status === 'retryableIndeterminate') {
            return { status: 'retryable' };
          }
          if (keylessCredentialReadiness.status !== 'requiresPasscode') {
            const marked =
              await this.backgroundApi.simpleDb.prime.markOneKeyIdKeylessCredentialUpgradeCompleted(
                {
                  onekeyUserId,
                  expectedIdentityLifecycleRevision,
                },
              );
            if (!marked) {
              return { status: 'retryable' };
            }
          }
        } catch (error) {
          defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
            reason: `ServicePrime.claimOneKeyIdOAuthBindPrompt credential upgrade failed: ${getSanitizedAuthErrorLog(
              error,
            )}`,
          });
          return { status: 'retryable' };
        }
      }

      if (promptUpgradeState.hasShown) {
        return { status: 'skip' };
      }

      let bindRequired = false;
      try {
        bindRequired = await this.isLegacyOneKeyIdOAuthBindRequired();
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
          reason: `ServicePrime.claimOneKeyIdOAuthBindPrompt bind requirement check failed: ${getSanitizedAuthErrorLog(
            error,
          )}`,
        });
        return { status: 'retryable' };
      }

      if (!bindRequired) {
        try {
          await this.backgroundApi.simpleDb.prime.markOneKeyIdOAuthBindPromptShown(
            { onekeyUserId },
          );
          return { status: 'skip' };
        } catch (error) {
          defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
            reason: `ServicePrime.claimOneKeyIdOAuthBindPrompt prompt state write failed: ${getSanitizedAuthErrorLog(
              error,
            )}`,
          });
          return { status: 'retryable' };
        }
      }

      const claimId = stringUtils.generateUUID();
      const now = Date.now();
      try {
        const claimed =
          await this.backgroundApi.simpleDb.prime.tryClaimOneKeyIdOAuthBindPrompt(
            {
              onekeyUserId,
              claimId,
              now,
              expiresAt: now + ONEKEY_ID_OAUTH_BIND_PROMPT_CLAIM_TTL_MS,
            },
          );
        return claimed ? { status: 'claimed', claimId } : { status: 'skip' };
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
          reason: `ServicePrime.claimOneKeyIdOAuthBindPrompt prompt claim failed: ${getSanitizedAuthErrorLog(
            error,
          )}`,
        });
        return { status: 'retryable' };
      }
    });
  }

  /**
   * Claim the optional OAuth reminder without consuming it. The UI completes
   * the claim only after Dialog.show succeeds, or releases it when presentation
   * is cancelled. The persisted lease also coordinates isolated extension
   * runtimes and expires after a crashed UI context.
   */
  @backgroundMethod()
  async claimOneKeyIdOAuthBindPrompt({
    onekeyUserId,
  }: {
    onekeyUserId: string;
  }): Promise<IOneKeyIdOAuthBindPromptClaimResult> {
    return this.claimOneKeyIdOAuthBindPromptInternal({
      onekeyUserId,
    });
  }

  @backgroundMethod()
  async completeOneKeyIdOAuthBindPrompt({
    onekeyUserId,
    claimId,
  }: {
    onekeyUserId: string;
    claimId: string;
  }): Promise<boolean> {
    return this.backgroundApi.simpleDb.prime.completeOneKeyIdOAuthBindPromptClaim(
      {
        onekeyUserId,
        claimId,
        shownAt: Date.now(),
      },
    );
  }

  @backgroundMethod()
  async releaseOneKeyIdOAuthBindPrompt({
    onekeyUserId,
    claimId,
  }: {
    onekeyUserId: string;
    claimId: string;
  }): Promise<boolean> {
    return this.backgroundApi.simpleDb.prime.releaseOneKeyIdOAuthBindPromptClaim(
      { onekeyUserId, claimId },
    );
  }

  @backgroundMethod()
  @toastIfError()
  async apiBindLegacyOneKeyIdOAuth({
    oauthAccessToken,
    expectedOnekeyUserId,
  }: {
    oauthAccessToken: string;
    // The onekeyUserId the bind UI displayed when the user consented,
    // captured at button-press time — before the user-paced OAuth
    // round-trip. Re-asserted below against the live login right before the
    // irreversible bind POST.
    expectedOnekeyUserId: string;
  }): Promise<IOneKeyIdOAuthBindResponse> {
    return this.loginMutex.runExclusive(async () => {
      if (!oauthAccessToken) {
        throw new OneKeyLocalError(
          'apiBindLegacyOneKeyIdOAuth ERROR: Invalid oauthAccessToken',
        );
      }

      // Legacy-side identity guard, mirroring the keyless-side slot guard
      // below but for the account that permanently RECEIVES the identity.
      // The bind is irreversible and one-time per identity, so a
      // wrong-target bind can never be undone or repeated — and two
      // documented behaviors can put another account's session in the
      // legacy slot by the time we get here: the ext bind flow hands off to
      // the expand tab (the popup can re-log the slot in as someone else
      // meanwhile), and post-commit legacy cleanup failures are deliberately
      // tolerated as "leftovers are re-cleaned later".
      //
      // The snapshot pins the consented account together with the exact
      // legacy token bytes, the source (must still be LegacyEmailSupabase)
      // and the auth-state generation; requestAuthToken is therefore the
      // legacy realm's token, verified to be the bytes actually persisted in
      // the slot.
      const bindAuthSnapshot = await this.captureOneKeyIdAuthSnapshot({
        expectedOneKeyUserId: expectedOnekeyUserId,
        requireSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
        insideLoginMutex: true,
        createStateChangedError: () =>
          new OneKeyErrorOneKeyIdLegacyBindStateChanged({
            message:
              'apiBindLegacyOneKeyIdOAuth ERROR: OneKey ID login changed since the bind was confirmed',
          }),
      });
      const legacyOneKeyIdAuthToken = bindAuthSnapshot.requestAuthToken;

      const client = await this.getPrimeClient();

      // Pin BOTH requests below to the exact captured legacy token via the
      // explicit request-token header. This is what makes "the verified
      // bytes, never a re-read" true: without an explicit header the
      // getOneKeyIdClient request interceptor injects
      // getActiveAuthToken() — a fresh slot read at request time — so a
      // main-runtime slot swap landing after the probe would send account
      // B's token in the POST header while the body still carried the
      // verified account A token.
      const pinnedLegacyTokenRequestConfig =
        this.getOneKeyIdAuthSnapshotRequestConfig(bindAuthSnapshot);

      // Authoritative receiving-account check on the EXACT token bytes the
      // bind POST below carries. The snapshot above cannot vouch for those
      // bytes on split-runtime targets: the main runtime persists legacy
      // sessions (email OTP verifyOtp) straight into the shared slot without
      // taking this bg loginMutex, and the bg atom/generation only catch up
      // when that login's apiLogin commit acquires it — so the slot can
      // already hold another account's session (which the snapshot then
      // captures and self-consistently validates) while the atom still shows
      // the consented one. Asking the server who owns the captured token
      // closes that gap for any interleaving: a swap before the capture is
      // detected here; a swap after it is harmless because both requests are
      // pinned to the captured bytes.
      //
      // autoHandleError: false follows callApiFetchPrimeUserInfoWithRequestToken
      // — including its second half: the interceptor's `code !== 0` branch is
      // skipped by that flag (axiosInterceptor), so business errors resolve
      // normally and MUST be reclassified here. getPrimeApiResponseData maps
      // 90002/90003 back to OneKeyErrorPrimeLoginInvalidToken (and anything
      // else to OneKeyServerApiError). Without it a rejected legacy token
      // would surface as the state-changed error below — telling the user to
      // retry something that can never succeed, skipping the invalid-token
      // teardown, and (because that class is exempt from keyless cleanup)
      // stranding this flow's provisional keyless session. The bind POST keeps
      // the default handling, unchanged from before this guard.
      const profileRequestConfig: Parameters<typeof client.get>[1] & {
        autoHandleError?: boolean;
      } = {
        autoHandleError: false,
        ...pinnedLegacyTokenRequestConfig,
      };
      const profileResult = await client.get<
        IPrimeApiClientResponse<IOneKeyIdProfileResponse>
      >('/prime/v1/account/profile', profileRequestConfig);
      let tokenOwnerOnekeyUserId: string | undefined;
      try {
        tokenOwnerOnekeyUserId = this.getPrimeApiResponseData({
          response: profileResult,
          fallbackMessage:
            'apiBindLegacyOneKeyIdOAuth ERROR: legacy token owner probe failed',
        })?.onekeyAccount?.onekeyUserId;
      } catch (error) {
        // The same autoHandleError: false that lets us classify the response
        // also bypasses the client's invalid-token interceptor, so a rejected
        // legacy token would abort the bind while the stale source/atom/session
        // stay logged in. Hand the CAPTURED token to the existing coordinator
        // so it reconciles the exact session the probe just proved dead.
        //
        // Safe from inside this loginMutex section: the synchronous part only
        // evaluates guards and STAGES the plan (neither takes loginMutex), and
        // the identity exit itself runs detached, so it queues behind this
        // section instead of deadlocking against it.
        if (error instanceof OneKeyErrorPrimeLoginInvalidToken) {
          const invalidTokenError = error as OneKeyError;
          try {
            await this.handlePrimeLoginInvalidToken({
              requestAuthToken: legacyOneKeyIdAuthToken,
              errorCode: Number(invalidTokenError.code) || undefined,
              errorMessage: invalidTokenError.message,
              requestUrl: '/prime/v1/account/profile',
            });
          } catch (reconciliationError) {
            // Best-effort side effect: the coordinator throws when it cannot
            // resolve the auth source, and letting that escape would replace
            // the real cause (invalid token) with a confusing secondary
            // error. The bind aborts either way; a later request hitting the
            // same dead token reconciles again.
            defaultLogger.prime.subscription.onekeyIdInvalidToken({
              url: '/prime/v1/account/profile',
              errorCode: Number(invalidTokenError.code) || -1,
              errorMessage: `apiBindLegacyOneKeyIdOAuth: legacy token owner probe reconciliation failed: ${getSanitizedAuthErrorLog(
                reconciliationError,
              )}`,
            });
          }
        }
        throw error;
      }
      if (!tokenOwnerOnekeyUserId) {
        throw new OneKeyErrorOneKeyIdLegacyBindStateChanged({
          message:
            'apiBindLegacyOneKeyIdOAuth ERROR: Unable to resolve legacy token owner',
        });
      }
      if (tokenOwnerOnekeyUserId !== expectedOnekeyUserId) {
        throw new OneKeyErrorOneKeyIdLegacyBindStateChanged({
          message:
            'apiBindLegacyOneKeyIdOAuth ERROR: Legacy session account changed since the bind was confirmed',
        });
      }

      // Same fail-fast (occupancy + identity) as apiOAuthLogin — and it
      // matters MORE here: the bind POST below is an irreversible
      // server-side identity bind, so a subsequent KeylessOAuth commit
      // failing on an empty slot — or serving a slot another account
      // overwrote meanwhile — would leave the account bound on the server
      // while the client rolls its login state back or presents the wrong
      // identity.
      //
      // Runs AFTER the probe on purpose: this guard's own contract accepts an
      // uncovered guard->POST window, and the snapshot re-check below only
      // re-validates the LEGACY side (a main-runtime keyless slot write does
      // not move authStateGeneration). Placing it before the probe would
      // stretch that window from one POST to a full GET + POST for no gain.
      // It is all local reads, so the only cost of running it here is one
      // wasted GET when the keyless slot is already unusable.
      const { verifiedTokenSub } =
        await this.assertKeylessSessionPersistedBeforeLogin({
          accessToken: oauthAccessToken,
          callerName: 'ServicePrime.apiBindLegacyOneKeyIdOAuth',
        });

      // Final local re-check across the profile round-trip: the snapshot's
      // source/generation must still hold before the irreversible POST.
      await this.assertOneKeyIdAuthSnapshot({
        snapshot: bindAuthSnapshot,
        createStateChangedError: () =>
          new OneKeyErrorOneKeyIdLegacyBindStateChanged({
            message:
              'apiBindLegacyOneKeyIdOAuth ERROR: OneKey ID login changed during the bind',
          }),
      });

      let result: {
        data: IApiClientResponse<IOneKeyIdOAuthBindResponse>;
      };
      try {
        result = await client.post<
          IApiClientResponse<IOneKeyIdOAuthBindResponse>
        >(
          '/prime/v1/account/identities/oauth/bind',
          {
            token: oauthAccessToken,
            legacyOneKeyIdAuthToken,
          },
          pinnedLegacyTokenRequestConfig,
        );
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
      // atom written as one atomic (local-only, rollback-on-failure) pair —
      // see apiLogin. The bind POST above and the legacy-session cleanup
      // below (Supabase signOut, network-capable) stay outside the lock. A
      // commit failure here rolls back to logged-out even though the bind
      // stays committed server-side — the documented empty-slot precedent;
      // re-login recovers.
      await this.authStateWriteMutex.runExclusive(async () => {
        await this.commitAuthSessionSourceAndPrimeAtom({
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          callerName: 'ServicePrime.apiBindLegacyOneKeyIdOAuth',
          expectedSlotTokenSub: verifiedTokenSub,
          updatePrimeAtom: async () => {
            await this.updatePrimeAtomByOneKeyIdAccount({
              onekeyAccount: data.onekeyAccount,
            });
          },
        });
      });
      // Best-effort hygiene (same commit boundary as apiOAuthLogin): the
      // bind is already committed atomically above, so a failure while
      // clearing the legacy slot must not reject the whole bind — the UI
      // catch would clear the just-persisted keyless OAuth session for a
      // bind that succeeded on the server. Leftovers are re-cleaned by the
      // next login/bind/logout.
      try {
        await this.backgroundApi.simpleDb.prime.clearLegacyAuthSession();
      } catch (cleanupError) {
        defaultLogger.prime.subscription.onekeyIdStateTrace({
          reason: `ServicePrime.apiBindLegacyOneKeyIdOAuth: post-commit legacy session cleanup failed: ${getSanitizedAuthErrorLog(
            cleanupError,
          )}`,
        });
      }
      await this.cleanupLegacyKeylessSessionStorageBestEffort({
        callerName: 'ServicePrime.apiBindLegacyOneKeyIdOAuth',
      });

      // Invalidation site (bind): the account identity / auth session source
      // just changed on the server, so the refresh below (and any
      // focus-triggered refetch) must hit the network instead of returning a
      // pre-bind cached result.
      this.clearPrimeUserInfoCache();
      void this.apiFetchPrimeUserInfo().catch((error) => {
        defaultLogger.prime.subscription.onekeyIdStateTrace({
          reason: `ServicePrime.apiBindLegacyOneKeyIdOAuth: refresh user info failed: ${getSanitizedAuthErrorLog(
            error,
          )}`,
        });
      });

      return data;
    });
  }

  /**
   * Local commit primitive used only by ServiceIdentityExit while holding the
   * identity lifecycle mutex. It compares the exact persisted session
   * identity before deleting one slot; it never sweeps the other realm.
   */
  async commitIdentityExitLocalState({
    expectedIdentityLifecycleRevision,
    oneKeyId,
    keylessSession,
    keylessWalletSession,
  }: {
    expectedIdentityLifecycleRevision: number;
    oneKeyId?: {
      onekeyUserId: string;
      source: EPrimeAuthSessionSource;
      sessionCommitId: string;
      sessionTokenSub?: string;
      allowSourceLessPreUpgrade?: boolean;
    };
    keylessSession?: {
      sessionCommitId?: string;
      sessionTokenSub?: string;
      allowUnknownIdentity?: boolean;
    };
    keylessWalletSession?: {
      walletId: string;
      sessionCommitId?: string;
    };
  }): Promise<{ status: 'committed' | 'stateChanged'; revision?: number }> {
    const sourceToClear =
      oneKeyId?.source ?? EPrimeAuthSessionSource.KeylessOAuth;
    const shouldClearAuthSession = Boolean(oneKeyId || keylessSession);
    return runExclusiveOnAuthSessionSlot(sourceToClear, async () =>
      this.authStateWriteMutex.runExclusive(async () => {
        const revision =
          await this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision();
        const isInitialCommit = revision === expectedIdentityLifecycleRevision;
        const isRecoveringCompletedCommit =
          revision === expectedIdentityLifecycleRevision + 1;
        if (!isInitialCommit && !isRecoveringCompletedCommit) {
          return { status: 'stateChanged' as const };
        }

        const expectedSession =
          sourceToClear === EPrimeAuthSessionSource.KeylessOAuth
            ? (keylessSession ?? oneKeyId)
            : oneKeyId;
        let isSessionCommitCleared = true;
        let isSessionSlotCleared = true;
        if (shouldClearAuthSession) {
          const [currentSessionCommitId, slot] = await Promise.all([
            this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
              sourceToClear,
            ),
            readPersistedAccessTokenBySessionSourceStrict(sourceToClear),
          ]);
          const isExpectedSessionCommit =
            currentSessionCommitId === expectedSession?.sessionCommitId;
          isSessionCommitCleared = currentSessionCommitId === undefined;
          if (!isExpectedSessionCommit && !isSessionCommitCleared) {
            return { status: 'stateChanged' as const };
          }

          let isExpectedSessionSlot =
            Boolean(keylessSession?.allowUnknownIdentity) && isInitialCommit;
          if (!isExpectedSessionSlot && expectedSession?.sessionTokenSub) {
            if (slot.status === 'ok') {
              const currentTokenSub =
                (stringUtils.decodeJWT(slot.accessToken) as ISupabaseJWTPayload)
                  ?.sub || '';
              isExpectedSessionSlot =
                currentTokenSub === expectedSession.sessionTokenSub;
            }
          } else if (!isExpectedSessionSlot) {
            isExpectedSessionSlot = slot.status === 'empty';
          }
          isSessionSlotCleared = slot.status === 'empty';
          if (!isExpectedSessionSlot && !isSessionSlotCleared) {
            return { status: 'stateChanged' as const };
          }
        }

        if (oneKeyId) {
          const [currentSource, currentAuthState, currentUser] =
            await Promise.all([
              this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
              this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
              primePersistAtom.get(),
            ]);
          const isExpectedOneKeyId =
            currentSource === oneKeyId.source &&
            currentUser.onekeyUserId === oneKeyId.onekeyUserId &&
            currentUser.isLoggedIn &&
            currentUser.isLoggedInOnServer;
          const isExpectedSourceLessPreUpgradeOneKeyId =
            oneKeyId.allowSourceLessPreUpgrade &&
            currentSource === undefined &&
            currentAuthState === undefined &&
            currentUser.onekeyUserId === oneKeyId.onekeyUserId &&
            currentUser.isLoggedIn &&
            currentUser.isLoggedInOnServer;
          const isOneKeyIdCleared =
            currentSource === undefined &&
            currentAuthState === 'loggedOut' &&
            !currentUser.isLoggedIn &&
            !currentUser.isLoggedInOnServer;
          const isOneKeyIdMetadataClearedBeforeAtom =
            currentSource === undefined &&
            currentAuthState === 'loggedOut' &&
            currentUser.onekeyUserId === oneKeyId.onekeyUserId &&
            currentUser.isLoggedIn &&
            currentUser.isLoggedInOnServer;
          if (
            !isExpectedOneKeyId &&
            !isExpectedSourceLessPreUpgradeOneKeyId &&
            !isOneKeyIdCleared &&
            !isOneKeyIdMetadataClearedBeforeAtom
          ) {
            return { status: 'stateChanged' as const };
          }
          if (isRecoveringCompletedCommit && !isOneKeyIdCleared) {
            return { status: 'stateChanged' as const };
          }
        }

        if (keylessWalletSession) {
          const currentWalletSessionCommitId =
            await this.backgroundApi.simpleDb.prime.getKeylessSessionCommitId({
              walletId: keylessWalletSession.walletId,
            });
          if (
            currentWalletSessionCommitId !==
              keylessWalletSession.sessionCommitId &&
            currentWalletSessionCommitId !== undefined
          ) {
            return { status: 'stateChanged' as const };
          }
          if (
            isRecoveringCompletedCommit &&
            currentWalletSessionCommitId !== undefined
          ) {
            return { status: 'stateChanged' as const };
          }
        }

        if (
          isRecoveringCompletedCommit &&
          shouldClearAuthSession &&
          (!isSessionCommitCleared || !isSessionSlotCleared)
        ) {
          return { status: 'stateChanged' as const };
        }

        if (shouldClearAuthSession && !isSessionSlotCleared) {
          await removeAuthSessionStorageBySessionSource(sourceToClear);
        }
        if (oneKeyId) {
          await this.backgroundApi.simpleDb.prime.clearAuthTokens();
          await this.backgroundApi.simpleDb.prime.clearAuthSessionCommitIdIfMatches(
            {
              authSessionSource: oneKeyId.source,
              expectedSessionCommitId: oneKeyId.sessionCommitId,
            },
          );
          await this.setPrimePersistAtomNotLoggedIn();
        } else if (keylessSession?.sessionCommitId) {
          await this.backgroundApi.simpleDb.prime.clearAuthSessionCommitIdIfMatches(
            {
              authSessionSource: sourceToClear,
              expectedSessionCommitId: keylessSession.sessionCommitId,
            },
          );
        }

        if (keylessWalletSession) {
          await this.backgroundApi.simpleDb.prime.clearKeylessSessionCommitIdIfMatches(
            {
              walletId: keylessWalletSession.walletId,
              expectedSessionCommitId: keylessWalletSession.sessionCommitId,
            },
          );
        }

        const nextRevision = isInitialCommit
          ? await this.backgroundApi.simpleDb.prime.bumpIdentityLifecycleRevision()
          : revision;
        const currentUser = await primePersistAtom.get();
        appEventBus.emit(EAppEventBusNames.IdentityLifecycleCommitted, {
          revision: nextRevision,
          oneKeyIdState:
            currentUser.isLoggedIn && currentUser.isLoggedInOnServer
              ? 'loggedIn'
              : 'loggedOut',
        });
        if (
          shouldClearAuthSession &&
          sourceToClear === EPrimeAuthSessionSource.KeylessOAuth
        ) {
          appEventBus.emit(
            EAppEventBusNames.KeylessAuthSessionCleared,
            undefined,
          );
        }
        return { status: 'committed' as const, revision: nextRevision };
      }),
    );
  }

  async commitExplicitLocalOneKeyIdLogout({
    expectedIdentityLifecycleRevision,
    expectedProjection,
  }: {
    expectedIdentityLifecycleRevision: number;
    expectedProjection: IExplicitLocalOneKeyIdLogoutProjection;
  }): Promise<{ status: 'committed' | 'stateChanged'; revision?: number }> {
    return this.authStateWriteMutex.runExclusive(async () => {
      const [revision, authSessionSource, oneKeyIdAuthState, user] =
        await Promise.all([
          this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
          this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
          this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
          primePersistAtom.get(),
        ]);
      const currentProjection: IExplicitLocalOneKeyIdLogoutProjection = {
        authSessionSource,
        oneKeyIdAuthState,
        isLoggedIn: user.isLoggedIn,
        isLoggedInOnServer: user.isLoggedInOnServer,
        onekeyUserId: user.onekeyUserId,
      };
      const isLoggedOut =
        !authSessionSource &&
        oneKeyIdAuthState === 'loggedOut' &&
        !user.isLoggedIn &&
        !user.isLoggedInOnServer &&
        !user.onekeyUserId;
      if (revision === expectedIdentityLifecycleRevision + 1) {
        return isLoggedOut
          ? { status: 'committed', revision }
          : { status: 'stateChanged' };
      }
      if (revision !== expectedIdentityLifecycleRevision) {
        return { status: 'stateChanged' };
      }

      const isExpectedProjection =
        currentProjection.authSessionSource ===
          expectedProjection.authSessionSource &&
        currentProjection.oneKeyIdAuthState ===
          expectedProjection.oneKeyIdAuthState &&
        currentProjection.isLoggedIn === expectedProjection.isLoggedIn &&
        currentProjection.isLoggedInOnServer ===
          expectedProjection.isLoggedInOnServer &&
        currentProjection.onekeyUserId === expectedProjection.onekeyUserId;
      const isMetadataClearedBeforeAtom =
        !authSessionSource &&
        oneKeyIdAuthState === 'loggedOut' &&
        user.isLoggedIn === expectedProjection.isLoggedIn &&
        user.isLoggedInOnServer === expectedProjection.isLoggedInOnServer &&
        user.onekeyUserId === expectedProjection.onekeyUserId;
      if (
        !isExpectedProjection &&
        !isMetadataClearedBeforeAtom &&
        !isLoggedOut
      ) {
        return { status: 'stateChanged' };
      }

      if (!isMetadataClearedBeforeAtom && !isLoggedOut) {
        await this.backgroundApi.simpleDb.prime.markOneKeyIdLoggedOutPreservingSessions();
      }
      if (!isLoggedOut) {
        await this.setPrimePersistAtomNotLoggedIn();
      }
      const nextRevision =
        await this.backgroundApi.simpleDb.prime.bumpIdentityLifecycleRevision();
      appEventBus.emit(EAppEventBusNames.IdentityLifecycleCommitted, {
        revision: nextRevision,
        oneKeyIdState: 'loggedOut',
      });
      return { status: 'committed', revision: nextRevision };
    });
  }

  async clearAllIdentityAuthForExplicitOperation({
    callerName: _callerName,
    expectedIdentityLifecycleRevision,
  }: {
    callerName: 'accountDeletion' | 'appReset';
    expectedIdentityLifecycleRevision: number;
  }): Promise<{
    status: 'committed' | 'stateChanged';
    revision?: number;
  }> {
    const revisionBeforeCleanup =
      await this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision();
    if (
      revisionBeforeCleanup !== expectedIdentityLifecycleRevision &&
      revisionBeforeCleanup !== expectedIdentityLifecycleRevision + 1
    ) {
      return { status: 'stateChanged' };
    }
    if (
      revisionBeforeCleanup === expectedIdentityLifecycleRevision + 1 &&
      !(await this.backgroundApi.simpleDb.prime.isAllIdentityAuthMetadataCleared())
    ) {
      return { status: 'stateChanged' };
    }
    await clearAllSupabaseAuthSessions();
    await this.backgroundApi.serviceKeylessWallet.cleanupLocalKeylessOAuthTokens();
    const commit = await this.authStateWriteMutex.runExclusive(async () => {
      const currentRevision =
        await this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision();
      if (currentRevision === expectedIdentityLifecycleRevision + 1) {
        if (
          !(await this.backgroundApi.simpleDb.prime.isAllIdentityAuthMetadataCleared())
        ) {
          return { status: 'stateChanged' as const };
        }
        await this.setPrimePersistAtomNotLoggedIn();
        return {
          status: 'committed' as const,
          revision: currentRevision,
        };
      }
      if (currentRevision !== expectedIdentityLifecycleRevision) {
        return { status: 'stateChanged' as const };
      }
      const nextRevision =
        await this.backgroundApi.simpleDb.prime.clearAllIdentityAuthMetadataAndBumpRevision();
      await this.setPrimePersistAtomNotLoggedIn();
      return { status: 'committed' as const, revision: nextRevision };
    });
    if (commit.status !== 'committed') {
      return commit;
    }
    appEventBus.emit(EAppEventBusNames.KeylessAuthSessionCleared, undefined);
    appEventBus.emit(EAppEventBusNames.IdentityLifecycleCommitted, {
      revision: commit.revision,
      oneKeyIdState: 'loggedOut',
    });
    return commit;
  }

  @backgroundMethod()
  async clearOneKeyIdLocalAuthCache(): Promise<{ revision: number }> {
    return identityLifecycleMutex.runExclusive(async () => {
      const operationId = `clearOneKeyIdCache:${stringUtils.generateUUID()}`;
      beginIdentityLifecycleReservation(operationId);
      try {
        const sessionSnapshots = await Promise.all(
          [
            EPrimeAuthSessionSource.LegacyEmailSupabase,
            EPrimeAuthSessionSource.KeylessOAuth,
          ].map(async (authSessionSource) => ({
            authSessionSource,
            slot: await readPersistedAccessTokenBySessionSourceStrict(
              authSessionSource,
            ),
          })),
        );
        const corruptSessionSource = sessionSnapshots.find(
          ({ slot }) => slot.status === 'corrupt',
        )?.authSessionSource;
        if (corruptSessionSource) {
          throw new OneKeyLocalError(
            `${corruptSessionSource} session slot is corrupt; refusing to clear it before the server session can be revoked.`,
          );
        }
        await Promise.all(
          sessionSnapshots.flatMap(({ authSessionSource, slot }) =>
            slot.status === 'ok'
              ? [
                  this.logoutPrimeServerSessionBestEffort({
                    accessToken: slot.accessToken,
                    callerName: 'ServicePrime.clearOneKeyIdLocalAuthCache',
                  }),
                  revokeAuthSessionTokenOnServerBestEffort({
                    authSessionSource,
                    accessToken: slot.accessToken,
                  }),
                ]
              : [],
          ),
        );
        // Reset the OneKey ID session and the current shared KeylessOAuth
        // session with their correlation metadata. Legacy per-owner Keyless
        // OAuth tokens, wallet rows, and mnemonic credential storage are
        // deliberately outside this OneKey ID recovery boundary.
        await clearAllSupabaseAuthSessions();
        const revision = await this.authStateWriteMutex.runExclusive(
          async () => {
            const nextRevision =
              await this.backgroundApi.simpleDb.prime.clearAllIdentityAuthMetadataAndBumpRevision();
            await this.setPrimePersistAtomNotLoggedIn();
            return nextRevision;
          },
        );
        appEventBus.emit(
          EAppEventBusNames.KeylessAuthSessionCleared,
          undefined,
        );
        appEventBus.emit(EAppEventBusNames.IdentityLifecycleCommitted, {
          revision,
          oneKeyIdState: 'loggedOut',
        });
        return { revision };
      } finally {
        endIdentityLifecycleReservation(operationId);
      }
    });
  }

  async logoutPrimeServerSessionBestEffort({
    accessToken,
    callerName,
  }: {
    accessToken: string;
    callerName: string;
  }): Promise<void> {
    if (!accessToken) {
      return;
    }
    try {
      const client = await this.getClient(EServiceEndpointEnum.Prime);
      await withIdentityNetworkTimeout(
        client.post(
          '/prime/v1/user/logout',
          {},
          { headers: { 'X-Onekey-Request-Token': accessToken } },
        ),
      );
    } catch (error) {
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: `${callerName}: server logout failed: ${getSanitizedAuthErrorLog(
          error,
        )}`,
      });
    }
  }

  /**
   * Recover a valid legacy Supabase session that predates authSessionSource.
   *
   * This narrowly gated migration detects a pre-authSessionSource legacy slot,
   * lets the Supabase SDK restore or refresh it, validates the resulting
   * session against Prime, and only then commits the new source metadata.
   * A persisted `loggedOut` tombstone is authoritative and is never recovered.
   * Transient or indeterminate failures preserve the old projection for a
   * later retry instead of turning an upgrade into a logout.
   */
  private async tryRecoverLegacyOneKeyIdSessionOnUpgrade({
    callerName,
  }: {
    callerName: string;
  }): Promise<ILegacyOneKeyIdUpgradeRecoveryResult> {
    await identityLifecycleMutex.waitForUnlock();
    return this.loginMutex.runExclusive(async () => {
      if (!isIdentityRecoveryReady()) {
        return { status: 'retryableIndeterminate' };
      }

      const operationId = `legacyOneKeyIdUpgradeRecovery:${stringUtils.generateUUID()}`;
      let migrationStage:
        | 'candidateDetected'
        | 'walletSessionValidation'
        | 'profileValidation'
        | 'stateCommit' = 'candidateDetected';
      let isRecoveryCandidate = false;
      beginIdentityLifecycleReservation(operationId);
      try {
        const [currentUser, authSessionSource, oneKeyIdAuthState, generation] =
          await Promise.all([
            primePersistAtom.get(),
            this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
            this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
            this.backgroundApi.simpleDb.prime.getAuthStateGeneration(),
          ]);
        const expectedOneKeyUserId = currentUser.onekeyUserId;
        isRecoveryCandidate = Boolean(
          currentUser.isLoggedIn &&
          currentUser.isLoggedInOnServer &&
          expectedOneKeyUserId &&
          !authSessionSource &&
          oneKeyIdAuthState === undefined &&
          generation === 0,
        );
        if (!isRecoveryCandidate || !expectedOneKeyUserId) {
          return { status: 'notApplicable' };
        }
        migrationStage = 'walletSessionValidation';
        clearSupabaseStorageLocalCache();
        const legacySlot = await readPersistedAccessTokenBySessionSourceStrict(
          EPrimeAuthSessionSource.LegacyEmailSupabase,
        );
        if (legacySlot.status !== 'ok') {
          return { status: 'notApplicable' };
        }
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: 'candidateDetected',
          status: 'succeeded',
          operationId,
        });
        // The persisted access token can be expired while its refresh token
        // is still valid. Resolve the legacy realm through auth-js before
        // validating Prime so getSession() can rotate the session. An empty
        // result is a definitive SDK verdict; retryable refresh/storage
        // failures throw and are preserved by the catch below.
        const refreshedAccessToken = await getAuthTokenBySessionSource(
          EPrimeAuthSessionSource.LegacyEmailSupabase,
        );
        if (!refreshedAccessToken) {
          return { status: 'definitiveInvalid' };
        }
        const expectedSessionTokenSub =
          (
            stringUtils.decodeJWT(
              refreshedAccessToken,
            ) as ISupabaseJWTPayload | null
          )?.sub || '';
        if (!expectedSessionTokenSub) {
          return { status: 'definitiveInvalid' };
        }
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: migrationStage,
          status: 'succeeded',
          operationId,
        });

        migrationStage = 'profileValidation';
        const serverUserInfo =
          await this.callApiFetchPrimeUserInfoWithRequestToken({
            requestAuthToken: refreshedAccessToken,
          });
        const responseOneKeyUserId =
          serverUserInfo.userId ?? serverUserInfo.onekeyAccount?.onekeyUserId;
        if (!responseOneKeyUserId) {
          defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
            stage: migrationStage,
            status: 'blocked',
            operationId,
            reason: 'Legacy session profile has no OneKey ID',
          });
          return { status: 'retryableIndeterminate' };
        }
        if (responseOneKeyUserId !== expectedOneKeyUserId) {
          defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
            stage: migrationStage,
            status: 'blocked',
            operationId,
            reason:
              'Legacy session profile does not match the persisted OneKey ID',
          });
          return { status: 'definitiveInvalid' };
        }
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: migrationStage,
          status: 'succeeded',
          operationId,
        });

        migrationStage = 'stateCommit';
        let recovered = false;
        await this.authStateWriteMutex.runExclusive(async () => {
          const [
            latestUser,
            latestAuthSessionSource,
            latestOneKeyIdAuthState,
            latestGeneration,
            latestLegacySlot,
          ] = await Promise.all([
            primePersistAtom.get(),
            this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
            this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
            this.backgroundApi.simpleDb.prime.getAuthStateGeneration(),
            readPersistedAccessTokenBySessionSourceStrict(
              EPrimeAuthSessionSource.LegacyEmailSupabase,
            ),
          ]);
          const latestSessionTokenSub =
            latestLegacySlot.status === 'ok'
              ? (
                  stringUtils.decodeJWT(
                    latestLegacySlot.accessToken,
                  ) as ISupabaseJWTPayload | null
                )?.sub || ''
              : '';
          if (
            !latestUser.isLoggedIn ||
            !latestUser.isLoggedInOnServer ||
            latestUser.onekeyUserId !== expectedOneKeyUserId ||
            latestAuthSessionSource ||
            latestOneKeyIdAuthState !== undefined ||
            latestGeneration !== 0 ||
            latestSessionTokenSub !== expectedSessionTokenSub
          ) {
            defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
              stage: migrationStage,
              status: 'blocked',
              operationId,
              reason: 'OneKey ID auth state changed before legacy migration',
            });
            return;
          }

          await this.backgroundApi.simpleDb.prime.setAuthSessionSourceWithCommitId(
            {
              authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
              sessionCommitId: stringUtils.generateUUID(),
            },
          );
          appEventBus.emit(EAppEventBusNames.PrimeAuthSessionSourceCommitted, {
            authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
            callerName,
          });
          await this.updatePrimeAtomByServerUserInfo({ serverUserInfo });
          const revision =
            await this.backgroundApi.simpleDb.prime.bumpIdentityLifecycleRevision();
          appEventBus.emit(EAppEventBusNames.IdentityLifecycleCommitted, {
            revision,
            oneKeyIdState: 'loggedIn',
          });
          recovered = true;
        });
        if (!recovered) {
          return { status: 'retryableIndeterminate' };
        }
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: migrationStage,
          status: 'succeeded',
          operationId,
        });
        return { status: 'recovered', serverUserInfo };
      } catch (error) {
        if (!isRecoveryCandidate) {
          throw error;
        }
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: migrationStage,
          status: 'failed',
          operationId,
          reason: getSanitizedAuthErrorLog(error),
        });
        return error instanceof OneKeyErrorPrimeLoginInvalidToken
          ? { status: 'definitiveInvalid' }
          : { status: 'retryableIndeterminate' };
      } finally {
        endIdentityLifecycleReservation(operationId);
      }
    });
  }

  /**
   * Repair the exact pre-authSessionSource upgrade state without weakening
   * the global rule that a source-less Keyless session never implies OneKey ID
   * login. Recovery requires every old-data marker, a local-wallet match, and
   * a server-authenticated profile whose OneKey ID equals the persisted login
   * projection. Definitive conflicts enter durable cleanup; transient or
   * indeterminate failures preserve the old projection and retry.
   */
  private async tryRecoverSourceLessPreUpgradeOneKeyIdSession({
    callerName,
  }: {
    callerName: string;
  }): Promise<ISourceLessOneKeyIdRecoveryResult> {
    await identityLifecycleMutex.waitForUnlock();
    return this.loginMutex.runExclusive(async () => {
      const operationId = `sourceLessOneKeyIdRecovery:${stringUtils.generateUUID()}`;
      let migrationStage:
        | 'candidateDetected'
        | 'walletSessionValidation'
        | 'profileValidation'
        | 'stateCommit' = 'candidateDetected';
      let repair:
        | {
            expectedOneKeyUserId: string;
            expectedSessionTokenSub?: string;
            expectedEmptyKeylessSessionSlot?: boolean;
          }
        | undefined;
      beginIdentityLifecycleReservation(operationId);
      try {
        const [
          currentUser,
          authSessionSource,
          oneKeyIdAuthState,
          authStateGeneration,
          keylessWallet,
        ] = await Promise.all([
          primePersistAtom.get(),
          this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource(),
          this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
          this.backgroundApi.simpleDb.prime.getAuthStateGeneration(),
          this.backgroundApi.serviceAccount.getKeylessWallet(),
        ]);
        const expectedOneKeyUserId = currentUser.onekeyUserId;
        const isSourceLessPreUpgradeState = Boolean(
          currentUser.isLoggedIn &&
          currentUser.isLoggedInOnServer &&
          expectedOneKeyUserId &&
          !authSessionSource &&
          oneKeyIdAuthState === undefined &&
          authStateGeneration === 0 &&
          keylessWallet,
        );
        if (!isSourceLessPreUpgradeState || !expectedOneKeyUserId) {
          return { status: 'definitiveInvalid' };
        }
        repair = { expectedOneKeyUserId };
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: 'candidateDetected',
          status: 'succeeded',
          operationId,
        });

        migrationStage = 'walletSessionValidation';
        const accessToken =
          await this.backgroundApi.simpleDb.prime.getKeylessSupabaseAuthToken();
        if (!accessToken) {
          repair.expectedEmptyKeylessSessionSlot = true;
          defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
            stage: migrationStage,
            status: 'blocked',
            operationId,
            reason: 'Keyless OAuth access token is unavailable',
          });
          return { status: 'definitiveInvalid', repair };
        }
        const tokenSub =
          (stringUtils.decodeJWT(accessToken) as ISupabaseJWTPayload | null)
            ?.sub || '';
        if (!tokenSub) {
          defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
            stage: migrationStage,
            status: 'blocked',
            operationId,
            reason: 'Keyless OAuth token subject is unavailable',
          });
          return { status: 'definitiveInvalid', repair };
        }
        repair.expectedSessionTokenSub = tokenSub;
        const { isValid } =
          await this.backgroundApi.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
            {
              token: accessToken,
              skipFixProvider: true,
            },
          );
        if (!isValid) {
          defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
            stage: migrationStage,
            status: 'blocked',
            operationId,
            reason: 'Keyless OAuth token does not match the local wallet',
          });
          return { status: 'definitiveInvalid', repair };
        }
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: migrationStage,
          status: 'succeeded',
          operationId,
        });

        migrationStage = 'profileValidation';
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: migrationStage,
          status: 'started',
          operationId,
        });
        const client = await this.getPrimeClient();
        const profileRequestConfig: Parameters<typeof client.get>[1] & {
          autoHandleError?: boolean;
        } = {
          autoHandleError: false,
          headers: {
            'X-Onekey-Request-Token': accessToken,
          },
        };
        const profileResult = await client.get<
          IPrimeApiClientResponse<IOneKeyIdProfileResponse>
        >('/prime/v1/account/profile', profileRequestConfig);
        const profileData = this.getPrimeApiResponseData({
          response: profileResult,
          fallbackMessage: `${callerName}: source-less OneKey ID recovery failed`,
        });
        if (!profileData?.onekeyAccount) {
          throw new OneKeyLocalError(
            `${callerName}: source-less OneKey ID recovery returned an empty profile.`,
          );
        }
        if (profileData.onekeyAccount.onekeyUserId !== expectedOneKeyUserId) {
          defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
            stage: migrationStage,
            status: 'blocked',
            operationId,
            reason:
              'Keyless OAuth profile does not match the persisted OneKey ID',
          });
          return { status: 'definitiveInvalid', repair };
        }
        defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
          stage: migrationStage,
          status: 'succeeded',
          operationId,
        });

        migrationStage = 'stateCommit';
        let recovered = false;
        await this.authStateWriteMutex.runExclusive(async () => {
          const [
            latestUser,
            latestAuthSessionSource,
            latestOneKeyIdAuthState,
            latestAuthStateGeneration,
          ] = await Promise.all([
            primePersistAtom.get(),
            this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
            this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
            this.backgroundApi.simpleDb.prime.getAuthStateGeneration(),
          ]);
          if (
            !latestUser.isLoggedIn ||
            !latestUser.isLoggedInOnServer ||
            latestUser.onekeyUserId !== expectedOneKeyUserId ||
            latestAuthSessionSource ||
            latestOneKeyIdAuthState !== undefined ||
            latestAuthStateGeneration !== 0
          ) {
            defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
              stage: migrationStage,
              status: 'blocked',
              operationId,
              reason: 'OneKey ID auth state changed before migration commit',
            });
            return;
          }
          clearSupabaseStorageLocalCache();
          await this.commitAuthSessionSourceAndPrimeAtom({
            authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
            callerName,
            expectedSlotTokenSub: tokenSub,
            updatePrimeAtom: async () => {
              await this.updatePrimeAtomByOneKeyIdAccount({
                onekeyAccount: profileData.onekeyAccount,
              });
            },
          });
          recovered = true;
          defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
            stage: migrationStage,
            status: 'succeeded',
            operationId,
          });
        });
        return recovered
          ? { status: 'recovered' }
          : { status: 'retryableIndeterminate' };
      } catch (error) {
        if (repair) {
          defaultLogger.prime.subscription.onekeyIdAuthStateMigration({
            stage: migrationStage,
            status: 'failed',
            operationId,
            reason: getSanitizedAuthErrorLog(error),
          });
          if (error instanceof OneKeyErrorPrimeLoginInvalidToken) {
            return { status: 'definitiveInvalid', repair };
          }
          return { status: 'retryableIndeterminate' };
        }
        throw error;
      } finally {
        endIdentityLifecycleReservation(operationId);
      }
    });
  }

  /**
   * Guarded "reset to logged-out only if there is really no active token",
   * for UI startup effects that observe a missing-token state. A matching
   * persisted Legacy or pre-upgrade Keyless-backed login is repaired first;
   * every other state is delegated to the durable identity-exit coordinator.
   */
  async clearOneKeyIdAuthStateIfNoActiveToken({
    callerName,
  }: {
    callerName: string;
  }): Promise<{
    cleared: boolean;
    retryScheduled?: boolean;
    recoveredLegacyServerUserInfo?: IPrimeServerUserInfoWithProfile;
  }> {
    const incompleteLogoutRepair =
      await this.repairIncompleteLocalOneKeyIdLogout();
    if (incompleteLogoutRepair === 'repaired') {
      this.resetSourceLessOneKeyIdRecoveryRetry();
      return { cleared: true };
    }

    const [oneKeyIdAuthState, authSessionSource] = await Promise.all([
      this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
      this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
    ]);
    if (oneKeyIdAuthState === 'loggedOut' && !authSessionSource) {
      const tombstoneRepair = await this.authStateWriteMutex.runExclusive(
        async () => {
          const [
            latestOneKeyIdAuthState,
            latestAuthSessionSource,
            currentUser,
          ] = await Promise.all([
            this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
            this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
            primePersistAtom.get(),
          ]);
          if (
            latestOneKeyIdAuthState !== 'loggedOut' ||
            latestAuthSessionSource
          ) {
            return { handled: false, cleared: false };
          }
          const hasStaleLoggedInProjection = Boolean(
            currentUser.isLoggedIn ||
            currentUser.isLoggedInOnServer ||
            currentUser.onekeyUserId,
          );
          if (hasStaleLoggedInProjection) {
            await this.setPrimePersistAtomNotLoggedIn();
          }
          return { handled: true, cleared: hasStaleLoggedInProjection };
        },
      );
      if (tombstoneRepair.handled) {
        this.resetSourceLessOneKeyIdRecoveryRetry();
        return { cleared: tombstoneRepair.cleared };
      }
    }
    const legacyRecovery = await this.tryRecoverLegacyOneKeyIdSessionOnUpgrade({
      callerName,
    });
    if (legacyRecovery.status === 'recovered') {
      this.resetSourceLessOneKeyIdRecoveryRetry();
      return {
        cleared: false,
        recoveredLegacyServerUserInfo: legacyRecovery.serverUserInfo,
      };
    }
    if (legacyRecovery.status === 'retryableIndeterminate') {
      this.scheduleSourceLessOneKeyIdRecoveryRetry({ callerName });
      return { cleared: false, retryScheduled: true };
    }

    const recovery = await this.tryRecoverSourceLessPreUpgradeOneKeyIdSession({
      callerName,
    });
    if (recovery.status === 'recovered') {
      this.resetSourceLessOneKeyIdRecoveryRetry();
      return { cleared: false };
    }
    if (recovery.status === 'retryableIndeterminate') {
      this.scheduleSourceLessOneKeyIdRecoveryRetry({ callerName });
      return { cleared: false, retryScheduled: true };
    }
    this.resetSourceLessOneKeyIdRecoveryRetry();
    return this.backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession(
      {
        callerName,
        ...(recovery.repair
          ? { sourceLessPreUpgradeRepair: recovery.repair }
          : {}),
      },
    );
  }

  @backgroundMethod()
  async apiLogoutPrimeUserDevice({
    instanceId,
    accessToken,
  }: {
    instanceId: string;
    accessToken: string;
  }) {
    const flowId = `remoteDeviceLogoutInitiator:${stringUtils.generateUUID()}`;
    defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
      stage: 'initiatorRequest',
      status: 'started',
      flowId,
    });
    try {
      // eslint-disable-next-line no-param-reassign
      accessToken =
        accessToken ||
        (await this.backgroundApi.simpleDb.prime.getActiveAuthToken());
      const client = await this.getPrimeClient();
      // TODO 404 not found
      const logoutResponse = await client.post<
        IApiClientResponse<unknown>,
        IAxiosResponse<IApiClientResponse<unknown>>
      >(
        `/prime/v1/user/device/${instanceId}`,
        {},
        {
          headers: {
            'X-Onekey-Request-Token': accessToken,
          },
        },
      );
      defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
        stage: 'initiatorRequest',
        status: 'succeeded',
        flowId,
        requestId: logoutResponse.$requestId,
      });
    } catch (error) {
      defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
        stage: 'initiatorRequest',
        status: 'failed',
        flowId,
        reason: getSanitizedAuthErrorLog(error),
      });
      throw error;
    }
    if (instanceId) {
      // Re-login through the endpoint matching the active auth session
      // source: a KeylessOAuth session token belongs to the keyless Supabase
      // realm and must go to /prime/v1/account/oauth/login — posting it to
      // the legacy /prime/v1/user/login could be rejected as an invalid
      // legacy token and cascade into a full logout.
      defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
        stage: 'initiatorRefresh',
        status: 'started',
        flowId,
      });
      try {
        const authSessionSource =
          await this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource();
        if (authSessionSource === EPrimeAuthSessionSource.KeylessOAuth) {
          await this.loginMutex.runExclusive(async () => {
            const [lockedAuthSessionSource, currentUser] = await Promise.all([
              this.backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource(),
              primePersistAtom.get(),
            ]);
            if (
              lockedAuthSessionSource !== EPrimeAuthSessionSource.KeylessOAuth
            ) {
              throw new OneKeyLocalError(
                'ServicePrime.apiLogoutPrimeUserDevice: auth session changed before refresh.',
              );
            }
            await this.apiOAuthLoginWithPersistedSession({
              accessToken,
              callerName: 'ServicePrime.apiLogoutPrimeUserDevice',
              expectedOneKeyUserId: currentUser.onekeyUserId,
            });
          });
        } else {
          await this.apiLogin({ accessToken });
        }
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
          stage: 'initiatorRefresh',
          status: 'failed',
          flowId,
          reason: `session refresh failed: ${getSanitizedAuthErrorLog(error)}`,
        });
        throw error;
      }
      // Refresh from profile + legacy user info for accurate
      // isPrimeDeviceLimitExceeded, as the login endpoint may return stale
      // device limit data after removal.
      try {
        await this.apiFetchPrimeUserInfo();
        defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
          stage: 'initiatorRefresh',
          status: 'succeeded',
          flowId,
        });
      } catch (e) {
        // Log but don't fail — apiLogin already updated the atom with best-effort data
        defaultLogger.prime.subscription.onekeyIdRemoteLogoutFlow({
          stage: 'initiatorRefresh',
          status: 'failed',
          flowId,
          reason: `profile refresh failed: ${getSanitizedAuthErrorLog(e)}`,
        });
        console.error(
          'ServicePrime.apiLogoutPrimeUserDevice refresh failed:',
          getSanitizedAuthErrorLog(e),
        );
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
    return this.callApiFetchPrimeUserInfoWithRequestToken({
      requestAuthToken,
    });
  }

  private async callApiFetchPrimeUserInfoWithRequestToken({
    requestAuthToken,
  }: {
    requestAuthToken: string;
  }): Promise<IPrimeServerUserInfoWithProfile> {
    const client = await this.getPrimeClient();
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = {
      autoHandleError: false,
      headers: {
        'X-Onekey-Request-Token': requestAuthToken,
      },
    };
    type IProfileApiResponse =
      IPrimeApiClientResponse<IOneKeyIdProfileResponse>;
    type IUserInfoApiResponse = IPrimeApiClientResponse<IPrimeServerUserInfo>;
    const profileRequest = client
      .get<IProfileApiResponse>('/prime/v1/account/profile', requestConfig)
      .then((response) =>
        this.getPrimeApiResponseData({
          response,
          fallbackMessage:
            'callApiFetchPrimeUserInfo ERROR: profile empty data',
        }),
      );
    const serverUserInfoRequest = client
      .get<IUserInfoApiResponse>('/prime/v1/user/info', requestConfig)
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

  private buildPrimeSubscriptionInfo(
    serverUserInfo: IPrimeServerUserInfo,
  ): IPrimeSubscriptionInfo | undefined {
    if (!serverUserInfo.isPrime) {
      return undefined;
    }
    return {
      isActive: true,
      expiresAt: serverUserInfo.primeExpiredAt,
      willRenew: serverUserInfo.willRenew,
      subscriptions: serverUserInfo.subscriptions,
    };
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
    // Local-only trace: fires on every user-info refresh, and user ids must
    // never be embedded in server-bound free text.
    defaultLogger.prime.subscription.onekeyIdStateTrace({
      reason: `updatePrimeAtomByServerUserInfo: before update, atom isPrime=${
        beforeValue.primeSubscription?.isActive
      }, server isPrime=${serverUserInfo?.isPrime}, sameUser=${
        beforeValue.onekeyUserId === serverUserId
      }`,
    });

    const primeSubscription = this.buildPrimeSubscriptionInfo(serverUserInfo);

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
        email: userEmail,
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
    defaultLogger.prime.subscription.onekeyIdStateTrace({
      reason: `updatePrimeAtomByServerUserInfo: after update, atom isPrime=${afterValue.primeSubscription?.isActive}`,
    });

    void this.trackOneKeyIdIdentityLinked({ onekeyUserId: serverUserId });
    this.enqueuePrimeProfileAnalyticsReport();

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

    void this.trackOneKeyIdIdentityLinked({
      onekeyUserId: onekeyAccount.onekeyUserId,
    });
    this.enqueuePrimeProfileAnalyticsReport();

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
  async apiFetchPrimeUserInfo({
    forceRefresh = false,
  }: {
    forceRefresh?: boolean;
  } = {}): Promise<{
    userInfo: IPrimeUserInfo;
    serverUserInfo: IPrimeServerUserInfo | undefined;
    primeSubscription: IPrimeSubscriptionInfo | undefined;
  }> {
    if (forceRefresh) {
      this.clearPrimeUserInfoCache();
    }
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
    this.primeUserInfoFetchGeneration += 1;
    const fetchGeneration = this.primeUserInfoFetchGeneration;
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
    const [localUserInfoBeforeFetch, identityLifecycleRevisionBeforeFetch] =
      await Promise.all([
        primePersistAtom.get(),
        this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
      ]);
    const sessionCommitIdBeforeFetch = authSessionSourceBeforeFetch
      ? await this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
          authSessionSourceBeforeFetch,
        )
      : undefined;
    const authToken =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    if (!authToken) {
      // Local-only traces: this branch runs for every logged-out user on
      // every app start — as server events they flooded analytics and, worse,
      // polluted the genuine invalid-token signal with synthetic -1759 noise.
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: simpleDb.prime.getActiveAuthToken() is null',
      });
      const recovery = await this.clearOneKeyIdAuthStateIfNoActiveToken({
        callerName: 'ServicePrime.apiFetchPrimeUserInfo.beforeRequest',
      });
      const localUserInfo = await primePersistAtom.get();

      // App-start fetch runs for every user; this is the guaranteed trigger
      // that gives never-logged-in users the membership profile attributes.
      this.enqueuePrimeProfileAnalyticsReport();

      // Do NOT emit PrimeLoginInvalidToken here: having no token is not an
      // invalid-token event, and a payload-less emit would wipe local
      // keyless sessions (e.g. keyless-only users not logged into OneKey ID).

      return {
        userInfo: localUserInfo,
        serverUserInfo: recovery.recoveredLegacyServerUserInfo,
        primeSubscription: recovery.recoveredLegacyServerUserInfo
          ? localUserInfo.primeSubscription
          : undefined,
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
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: auth token cleared during request, discarding response',
      });
      await this.clearOneKeyIdAuthStateIfNoActiveToken({
        callerName: 'ServicePrime.apiFetchPrimeUserInfo.afterRequest',
      });
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
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: auth session changed during request, discarding response',
      });
      return {
        userInfo: localUserInfoAfterFetch,
        serverUserInfo: undefined,
        primeSubscription: localUserInfoAfterFetch.primeSubscription,
      };
    }

    const responseOneKeyUserId =
      serverUserInfo.userId ??
      (serverUserInfo as Partial<IOneKeyIdProfileResponse>).onekeyAccount
        ?.onekeyUserId;
    const commitResult = await this.loginMutex.runExclusive(async () => {
      const [
        currentLifecycleRevision,
        currentAuthSessionSource,
        currentSessionCommitId,
        currentOneKeyIdAuthState,
        currentUserInfo,
        currentAuthToken,
      ] = await Promise.all([
        this.backgroundApi.simpleDb.prime.getIdentityLifecycleRevision(),
        this.backgroundApi.simpleDb.prime.getAuthSessionSource(),
        authSessionSourceBeforeFetch
          ? this.backgroundApi.simpleDb.prime.getAuthSessionCommitId(
              authSessionSourceBeforeFetch,
            )
          : Promise.resolve(undefined),
        this.backgroundApi.simpleDb.prime.getOneKeyIdAuthState(),
        primePersistAtom.get(),
        this.backgroundApi.simpleDb.prime.getActiveAuthToken(),
      ]);
      const isSameSession = Boolean(
        fetchGeneration === this.primeUserInfoFetchGeneration &&
        currentAuthToken &&
        currentOneKeyIdAuthState !== 'loggedOut' &&
        currentUserInfo.isLoggedIn &&
        currentUserInfo.isLoggedInOnServer &&
        currentLifecycleRevision === identityLifecycleRevisionBeforeFetch &&
        currentAuthSessionSource === authSessionSourceBeforeFetch &&
        currentSessionCommitId === sessionCommitIdBeforeFetch &&
        currentUserInfo.onekeyUserId ===
          localUserInfoBeforeFetch.onekeyUserId &&
        (!responseOneKeyUserId ||
          responseOneKeyUserId === localUserInfoBeforeFetch.onekeyUserId),
      );
      if (!isSameSession) {
        return {
          committed: false as const,
          userInfo: currentUserInfo,
        };
      }

      const { primeSubscription } = await this.updatePrimeAtomByServerUserInfo({
        serverUserInfo,
      });
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
        committed: true as const,
        userInfo: await primePersistAtom.get(),
        primeSubscription,
      };
    });
    if (!commitResult.committed) {
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: identity lifecycle or fetch generation changed before response commit, discarding response',
      });
      return {
        userInfo: commitResult.userInfo,
        serverUserInfo: undefined,
        primeSubscription: commitResult.userInfo.primeSubscription,
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

    return {
      userInfo: commitResult.userInfo,
      serverUserInfo,
      primeSubscription: commitResult.primeSubscription,
    };
  }

  async setPrimePersistAtomNotLoggedIn() {
    // Invalidation site (logged-out transitions, choke point): this method is
    // the shared final step of apiLogout -> clearOneKeyIdAuthState,
    // handlePrimeLoginInvalidToken (invalid-token cleanup), account deletion,
    // and keyless-wallet cleanup. Clearing here guarantees a logged-in result
    // cached moments earlier can never be served after the state is reset.
    this.clearPrimeUserInfoCache();
    const beforeValue = await primePersistAtom.get();
    const alreadyLoggedOut =
      !beforeValue.isLoggedIn && !beforeValue.isLoggedInOnServer;
    // Local-only: this method also runs for already-logged-out users on hot
    // startup paths, so it must not produce server events. Skip the trace
    // when the atom is already the logged-out projection.
    if (!alreadyLoggedOut) {
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: `setPrimePersistAtomNotLoggedIn: before clear, isLoggedIn=${beforeValue.isLoggedIn}, isPrime=${beforeValue.primeSubscription?.isActive}`,
      });
    }

    await primePersistAtom.set(
      (): IPrimePersistAtomData => cloneDeep(primePersistAtomInitialValue),
    );

    // Runs for never-logged-in users too (hot startup paths), which is what
    // gives every user the membership profile attributes; the in-memory
    // snapshot inside keeps repeats free.
    this.enqueuePrimeProfileAnalyticsReport();

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
      // Local-only: transient refresh failures can repeat while offline.
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: `ServicePrime.isLoggedIn: auth refresh failed, keep local login state: ${getSanitizedAuthErrorLog(
          tokenRead.retryableError,
        )}`,
      });
      return Boolean(isLoggedIn && isLoggedInOnServer);
    }
    const authToken = tokenRead.token;
    const result = Boolean(isLoggedIn && isLoggedInOnServer && authToken);

    // Expected logged-out is the common result of this hot gate — do not
    // trace it. Only log inconsistent flag/token combinations: "flags say
    // logged in, no token" and "flags say logged out, token still exists"
    // (e.g. an interrupted clear sequence). Never-logged-in users hit
    // neither, so this cannot flood.
    if (!result && (isLoggedIn || isLoggedInOnServer || authToken)) {
      defaultLogger.prime.subscription.onekeyIdStateTrace({
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
      defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
        reason: `ServicePrime.apiSendEmailVerificationCode failed and returned legacy fallback success: ${getSanitizedAuthErrorLog(
          error,
        )}`,
      });
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
      defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
        reason: `ServicePrime.apiPrimeLogin failed and returned legacy fallback failure: ${getSanitizedAuthErrorLog(
          error,
        )}`,
      });
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
  async apiRedeemPrimeCode({
    code,
    expectedOneKeyUserId,
  }: IPrimeRedemptionParams): Promise<IPrimeRedemptionResult> {
    const redemptionCode = isString(code) ? code.trim() : '';
    if (!redemptionCode) {
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.redemption_invalid_code_error,
        }),
        autoToast: false,
      });
    }
    const createSessionChangedError = () =>
      new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.prime_onekey_id_session_changed__msg,
        }),
        autoToast: false,
      });
    const authSnapshot = await this.captureOneKeyIdAuthSnapshot({
      expectedOneKeyUserId,
      createStateChangedError: createSessionChangedError,
    });
    const client = await this.getPrimeClient();
    const requestConfig =
      this.getOneKeyIdAuthSnapshotRequestConfig(authSnapshot);
    let result: {
      data: IApiClientResponse<IPrimeRedemptionApiResponse>;
    };
    try {
      const profileResult = await client.get<
        IApiClientResponse<IOneKeyIdProfileResponse>
      >('/prime/v1/account/profile', requestConfig);
      if (
        profileResult?.data?.data?.onekeyAccount?.onekeyUserId !==
        expectedOneKeyUserId
      ) {
        throw createSessionChangedError();
      }
      await this.assertOneKeyIdAuthSnapshot({
        snapshot: authSnapshot,
        createStateChangedError: createSessionChangedError,
      });
      result = await client.post<
        IApiClientResponse<IPrimeRedemptionApiResponse>
      >('/prime/v1/redemption/redeem', { code: redemptionCode }, requestConfig);
    } catch (error) {
      // The dialog renders non-auth failures inline. Invalid-session errors
      // keep the existing global toast and OneKey ID logout flow.
      if (
        error &&
        typeof error === 'object' &&
        !(error instanceof OneKeyErrorPrimeLoginInvalidToken)
      ) {
        (error as { autoToast?: boolean }).autoToast = false;
      }
      throw error;
    }
    const redemption = validatePrimeRedemptionResponse(result?.data?.data);
    await this.assertOneKeyIdAuthSnapshot({
      snapshot: authSnapshot,
      createStateChangedError: createSessionChangedError,
    });
    return redemption;
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
  async apiGetInfiniCheckoutUrl({
    plan,
    expectedOneKeyUserId,
  }: {
    plan: IPrimeInfiniSubscriptionPlan;
    expectedOneKeyUserId: string;
  }): Promise<{ checkoutUrl: string }> {
    const authSnapshot =
      await this.captureInfiniPurchaseAuthSnapshot(expectedOneKeyUserId);
    const client = await this.getPrimeClient();
    // The checkout API's wire enum uses 'annual' for the yearly plan, while
    // the app models it as 'yearly' everywhere else (IPrimeInfiniSubscriptionPlan);
    // convert only at this boundary, mirroring normalizeInfiniSubscriptionPlan
    // which maps 'annual' back to 'yearly' on the read path.
    const planParam = getInfiniPlanParam(plan);
    // The authenticated OneKey API owns the checkout destination and may move
    // it without a client release. Keep only generic external-URL validation
    // here; checkout-origin policy and authorization belong on the server.
    const result = await client.post<
      IApiClientResponse<{ checkoutUrl?: unknown }>
    >(
      '/prime/v1/infini/checkout',
      {
        plan: planParam,
      },
      this.getInfiniPurchaseRequestConfig(authSnapshot),
    );
    await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
    return {
      checkoutUrl: validateInfiniCheckoutUrl(result?.data?.data?.checkoutUrl),
    };
  }

  @backgroundMethod()
  async apiGetInfiniPaymentOptions(): Promise<IPrimeInfiniPaymentOption[]> {
    const client = await this.getPrimeClient();
    const result = await client.get<IApiClientResponse<{ chains?: unknown }>>(
      '/prime/v1/infini/payment/options',
    );
    const chains = result?.data?.data?.chains;
    if (!Array.isArray(chains)) {
      return [];
    }
    return chains.flatMap((value): IPrimeInfiniPaymentOption[] => {
      if (!value || typeof value !== 'object') {
        return [];
      }
      const option = value as Record<string, unknown>;
      if (
        !isString(option.chain) ||
        !option.chain.trim() ||
        !isString(option.networkId) ||
        !option.networkId.trim() ||
        !Array.isArray(option.tokens)
      ) {
        return [];
      }
      const tokens = option.tokens.flatMap((tokenValue) => {
        if (!tokenValue || typeof tokenValue !== 'object') {
          return [];
        }
        const token = tokenValue as Record<string, unknown>;
        if (
          !isString(token.symbol) ||
          !token.symbol.trim() ||
          !isString(token.contract) ||
          !token.contract.trim()
        ) {
          return [];
        }
        return [
          {
            symbol: token.symbol.trim().toUpperCase(),
            contract: token.contract.trim(),
          },
        ];
      });
      if (!tokens.length) {
        return [];
      }
      return [
        {
          chain: option.chain.trim().toUpperCase(),
          networkId: option.networkId.trim(),
          tokens,
        },
      ];
    });
  }

  @backgroundMethod()
  async apiCreateInfiniPayment({
    plan,
    chain,
    token,
    expectedOneKeyUserId,
  }: IPrimeInfiniPaymentCreateParams): Promise<IPrimeInfiniPayment> {
    const authSnapshot =
      await this.captureInfiniPurchaseAuthSnapshot(expectedOneKeyUserId);
    const client = await this.getPrimeClient();
    const result = await client.post<
      IApiClientResponse<IPrimeInfiniPaymentApiResponse>
    >(
      '/prime/v1/infini/payment',
      {
        plan: getInfiniPlanParam(plan),
        chain,
        token,
      },
      this.getInfiniPurchaseRequestConfig(authSnapshot),
    );
    let payment = result?.data?.data;
    if (
      payment &&
      isString(payment.paymentId) &&
      payment.paymentId &&
      (!isString(payment.address) || !payment.address)
    ) {
      const paymentId = payment.paymentId;
      const queryResult = await client.get<
        IApiClientResponse<IPrimeInfiniPaymentApiResponse>
      >('/prime/v1/infini/payment', {
        params: {
          paymentId,
        },
        ...this.getInfiniPurchaseRequestConfig(authSnapshot),
      });
      payment = queryResult?.data?.data;
      const validatedPayment = validateInfiniPaymentResponse(
        payment,
        paymentId,
      );
      await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
      return validatedPayment;
    }
    const validatedPayment = validateInfiniPaymentResponse(payment);
    await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
    return validatedPayment;
  }

  @backgroundMethod()
  async apiGetInfiniPayment({
    paymentId,
    expectedOneKeyUserId,
  }: {
    paymentId: string;
    expectedOneKeyUserId: string;
  }): Promise<IPrimeInfiniPayment> {
    const authSnapshot =
      await this.captureInfiniPurchaseAuthSnapshot(expectedOneKeyUserId);
    const client = await this.getPrimeClient();
    const result = await client.get<
      IApiClientResponse<IPrimeInfiniPaymentApiResponse>
    >('/prime/v1/infini/payment', {
      params: {
        paymentId,
      },
      ...this.getInfiniPurchaseRequestConfig(authSnapshot),
    });
    const payment = validateInfiniPaymentResponse(
      result?.data?.data,
      paymentId,
    );
    await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
    return payment;
  }

  @backgroundMethod()
  async apiGetInfiniPaymentPreBroadcastSnapshot({
    paymentId,
    expectedOneKeyUserId,
  }: {
    paymentId: string;
    expectedOneKeyUserId: string;
  }): Promise<IPrimeInfiniPaymentPreBroadcastSnapshot> {
    const authSnapshot =
      await this.captureInfiniPurchaseAuthSnapshot(expectedOneKeyUserId);
    const client = await this.getPrimeClient();
    const [paymentResult, serverUserInfo, infiniResult] = await Promise.all([
      client.get<IApiClientResponse<IPrimeInfiniPaymentApiResponse>>(
        '/prime/v1/infini/payment',
        {
          params: {
            paymentId,
          },
          ...this.getInfiniPurchaseRequestConfig(authSnapshot),
        },
      ),
      this.callApiFetchPrimeUserInfoWithRequestToken({
        requestAuthToken: authSnapshot.requestAuthToken,
      }),
      client.get<IApiClientResponse<IPrimeInfiniSubscription | undefined>>(
        '/prime/v1/infini/subscription',
        this.getInfiniPurchaseRequestConfig(authSnapshot),
      ),
    ]);
    if (serverUserInfo.userId !== expectedOneKeyUserId) {
      throw this.createInfiniPurchaseUserChangedError();
    }
    const payment = validateInfiniPaymentResponse(
      paymentResult?.data?.data,
      paymentId,
    );
    await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
    return {
      payment,
      purchaseStatusSnapshot: {
        onekeyUserId: expectedOneKeyUserId,
        primeSubscription: this.buildPrimeSubscriptionInfo(serverUserInfo),
        infiniSubscription: normalizeInfiniSubscriptionResponse(
          infiniResult?.data?.data,
        ),
      },
    };
  }

  @backgroundMethod()
  async apiGetInfiniPurchaseStatusSnapshot({
    expectedOneKeyUserId,
  }: {
    expectedOneKeyUserId: string;
  }): Promise<IPrimeInfiniPurchaseStatusSnapshot> {
    const authSnapshot =
      await this.captureInfiniPurchaseAuthSnapshot(expectedOneKeyUserId);
    const client = await this.getPrimeClient();
    const [serverUserInfo, infiniResult] = await Promise.all([
      this.callApiFetchPrimeUserInfoWithRequestToken({
        requestAuthToken: authSnapshot.requestAuthToken,
      }),
      client.get<IApiClientResponse<IPrimeInfiniSubscription | undefined>>(
        '/prime/v1/infini/subscription',
        this.getInfiniPurchaseRequestConfig(authSnapshot),
      ),
    ]);
    if (serverUserInfo.userId !== expectedOneKeyUserId) {
      throw this.createInfiniPurchaseUserChangedError();
    }
    const infiniSubscription = normalizeInfiniSubscriptionResponse(
      infiniResult?.data?.data,
    );
    await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
    return {
      onekeyUserId: expectedOneKeyUserId,
      primeSubscription: this.buildPrimeSubscriptionInfo(serverUserInfo),
      infiniSubscription,
    };
  }

  @backgroundMethod()
  async apiGetInfiniSubscription({
    expectedOneKeyUserId,
  }: {
    expectedOneKeyUserId: string;
  }): Promise<IPrimeInfiniSubscription | undefined> {
    const authSnapshot =
      await this.captureInfiniPurchaseAuthSnapshot(expectedOneKeyUserId);
    const client = await this.getPrimeClient();
    // NOTE: response schema pending backend confirmation (see IPrimeInfiniSubscription)
    const result = await client.get<
      IApiClientResponse<IPrimeInfiniSubscription | undefined>
    >(
      '/prime/v1/infini/subscription',
      this.getInfiniPurchaseRequestConfig(authSnapshot),
    );
    const subscription = normalizeInfiniSubscriptionResponse(
      result?.data?.data,
    );
    await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
    return subscription;
  }

  @backgroundMethod()
  @toastIfError()
  async apiCancelInfiniSubscription({
    note,
    expectedOneKeyUserId,
  }: {
    note?: string;
    expectedOneKeyUserId: string;
  }): Promise<void> {
    const createUserChangedError = () =>
      new OneKeyLocalError({
        message: 'Prime subscription user changed',
        autoToast: false,
      });
    const initialUserInfo = await primePersistAtom.get();
    if (
      !expectedOneKeyUserId ||
      !initialUserInfo.isLoggedIn ||
      initialUserInfo.onekeyUserId !== expectedOneKeyUserId
    ) {
      throw createUserChangedError();
    }

    await this.loginMutex.waitForUnlock();
    const requestAuthToken =
      await this.backgroundApi.simpleDb.prime.getActiveAuthToken();
    if (!requestAuthToken) {
      throw createUserChangedError();
    }

    const sessionSnapshot = await this.authStateWriteMutex.runExclusive(
      async () => {
        const currentUserInfo = await primePersistAtom.get();
        const authSessionSource =
          await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
        const authStateGeneration =
          await this.backgroundApi.simpleDb.prime.getAuthStateGeneration();
        if (
          !currentUserInfo.isLoggedIn ||
          currentUserInfo.onekeyUserId !== expectedOneKeyUserId ||
          !authSessionSource
        ) {
          throw createUserChangedError();
        }
        // Bind the SDK token read to the persisted slot while auth commits
        // are excluded, covering an A -> B -> A switch between the reads.
        const persistedSession =
          await readPersistedAccessTokenBySessionSourceStrict(
            authSessionSource,
          );
        if (
          persistedSession.status !== 'ok' ||
          persistedSession.accessToken !== requestAuthToken
        ) {
          throw createUserChangedError();
        }
        return { authSessionSource, authStateGeneration };
      },
    );

    const client = await this.getPrimeClient();
    // note is an optional cancel reason, max 200 chars enforced by the server
    await client.post(
      '/prime/v1/infini/subscription/cancel',
      { note },
      {
        // Pin the request to the session validated above. The interceptor
        // must not substitute a different user's token during an account switch.
        headers: {
          'X-Onekey-Request-Token': requestAuthToken,
        },
      },
    );

    await this.authStateWriteMutex.runExclusive(async () => {
      const currentUserInfo = await primePersistAtom.get();
      const authSessionSource =
        await this.backgroundApi.simpleDb.prime.getAuthSessionSource();
      const authStateGeneration =
        await this.backgroundApi.simpleDb.prime.getAuthStateGeneration();
      if (
        !currentUserInfo.isLoggedIn ||
        currentUserInfo.onekeyUserId !== expectedOneKeyUserId ||
        authSessionSource !== sessionSnapshot.authSessionSource ||
        authStateGeneration !== sessionSnapshot.authStateGeneration
      ) {
        throw createUserChangedError();
      }
    });
  }

  // Intentionally @backgroundMethod() and not @backgroundMethodForDev(): this
  // entry is reachable from a production build, so a dev-only decorator would
  // be a wrong description of it. Its password wrapper also only guards the
  // INTERNAL_ dispatch entry, which the extension main->bg bridge uses but
  // desktop/web single-runtime and native main->bg calls skip. The
  // devOnlyPassword is therefore checked in the method body, which holds on
  // every platform.
  @backgroundMethod()
  @toastIfError()
  async apiResetInfiniSubscription(
    params: IBackgroundMethodWithDevOnlyPassword,
    { expectedOneKeyUserId }: { expectedOneKeyUserId: string },
  ): Promise<void> {
    // Destructively deletes the current user's Infini subscription.
    checkDevOnlyPassword(params, 'apiResetInfiniSubscription');
    // Pin the request to the user who confirmed the dialog: an account switch
    // between confirmation and send would otherwise let the interceptor attach
    // the new user's live token and delete a subscription nobody consented to.
    const authSnapshot =
      await this.captureInfiniPurchaseAuthSnapshot(expectedOneKeyUserId);
    const client = await this.getPrimeClient();
    await client.post(
      '/prime/v1/infini/test/reset',
      undefined,
      this.getInfiniPurchaseRequestConfig(authSnapshot),
    );
    await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
  }

  @backgroundMethod()
  async apiSyncInfiniWebhook({
    expectedOneKeyUserId,
  }: {
    expectedOneKeyUserId: string;
  }): Promise<void> {
    const authSnapshot =
      await this.captureInfiniPurchaseAuthSnapshot(expectedOneKeyUserId);
    const client = await this.getPrimeClient();
    // Ask the server to proactively sync the latest Infini payment state,
    // used as a nudge right after the user returns from the checkout page
    await client.post(
      '/prime/v1/infini/webhook/sync',
      undefined,
      this.getInfiniPurchaseRequestConfig(authSnapshot),
    );
    await this.assertInfiniPurchaseAuthSnapshot(authSnapshot);
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
