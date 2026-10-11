import { cloneDeep } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  OneKeyErrorPrimeLoginExceedDeviceLimit,
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyErrorPrimePaidMembershipRequired,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import type {
  EPrimeFreeTrialPendingActionType,
  IPrimeFreeTrialBroadcastUsage,
  IPrimeFreeTrialError,
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialFeatureQuota,
  IPrimeFreeTrialFinishResponse,
  IPrimeFreeTrialPendingAction,
  IPrimeFreeTrialPublicConfig,
  IPrimeFreeTrialQuota,
  IPrimeFreeTrialQuotaExhaustedData,
  IPrimeFreeTrialStartResponse,
  IPrimeFreeTrialStartResult,
  IPrimeFreeTrialUsageFeatureId,
  IPrimeFreeTrialUsageRecord,
  IPrimeFreeTrialUsageResult,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import {
  PRIME_FREE_TRIAL_LEGACY_NOT_OPEN_SERVER_CODE,
  PRIME_FREE_TRIAL_NOT_OPEN_CODE,
  PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
  PRIME_FREE_TRIAL_RESERVATION_TTL_MS,
  PRIME_FREE_TRIAL_USAGE_REJECTED_CODE,
  isPrimeFreeTrialFeatureId,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import {
  buildPrimeFreeTrialUsageRecordKey,
  isPrimeFreeTrialUsageRecordReportable,
} from '../../dbs/simple/entity/SimpleDbEntityPrimeFreeTrial';
import {
  primeFreeTrialAtom,
  primeFreeTrialAtomInitialValue,
  primePersistAtom,
} from '../../states/jotai/atoms/prime';
import ServiceBase from '../ServiceBase';

const USAGE_ID_REGEXP = /^[A-Za-z0-9_-]{8,64}$/;
const PUBLIC_CONFIG_CACHE_MS = 60 * 1000;
const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;
const START_MAX_ATTEMPTS = 3;
// Per-attempt timeout of start: three attempts at the default 30s request
// timeout would keep the user waiting for over 90s.
const START_REQUEST_TIMEOUT_MS = 10 * 1000;
const REPORT_BACKOFF_BASE_MS = 5 * 1000;
const REPORT_BACKOFF_MAX_MS = 30 * 60 * 1000;

const USER_CHANGED_ERROR_MESSAGE = 'Prime free trial user changed';

function createUserChangedError() {
  return new OneKeyLocalError({
    message: USER_CHANGED_ERROR_MESSAGE,
    autoToast: false,
  });
}

function isUserChangedError(error: unknown) {
  return (
    error instanceof OneKeyLocalError &&
    error.message === USER_CHANGED_ERROR_MESSAGE
  );
}

function getServerErrorCode(error: unknown): number | undefined {
  const code = Number((error as OneKeyError | undefined)?.code);
  return Number.isFinite(code) ? code : undefined;
}

// Business payload of a server error. Both the axios interceptor and the
// manual translate error keep the whole `{ code, message, data }` response in
// `error.data`, so the business data is one level deeper.
function getServerErrorBusinessData<T>(error: unknown): T | undefined {
  const data = (error as OneKeyError<unknown, { data?: unknown }> | undefined)
    ?.data;
  return data?.data as T | undefined;
}

// A request whose effect on the server is unknown: network failure, timeout,
// 5xx. Business codes, auth errors and local state checks are definitive.
function isUncertainRequestError(error: unknown) {
  if (
    error instanceof OneKeyErrorPrimeLoginInvalidToken ||
    error instanceof OneKeyErrorPrimeLoginExceedDeviceLimit ||
    error instanceof OneKeyErrorPrimePaidMembershipRequired ||
    isUserChangedError(error)
  ) {
    return false;
  }
  const httpStatusCode = Number(
    (error as OneKeyError | undefined)?.httpStatusCode,
  );
  if (Number.isFinite(httpStatusCode) && httpStatusCode >= 500) {
    return true;
  }
  const responseCode = (
    error as OneKeyError<unknown, { code?: unknown }> | undefined
  )?.data?.code;
  if (responseCode !== undefined && responseCode !== null) {
    return false;
  }
  if (Number.isFinite(httpStatusCode) && httpStatusCode >= 400) {
    return false;
  }
  return true;
}

function normalizeFeatureQuota(
  item: Partial<IPrimeFreeTrialFeatureQuota> | undefined,
): IPrimeFreeTrialFeatureQuota | undefined {
  if (!item || !isPrimeFreeTrialFeatureId(item.featureId)) {
    return undefined;
  }
  const monthlyQuota = Number(item.monthlyQuota) || 0;
  const used = Number(item.used) || 0;
  const remaining = Number.isFinite(Number(item.remaining))
    ? Math.max(0, Number(item.remaining))
    : Math.max(0, monthlyQuota - used);
  return {
    featureId: item.featureId,
    unit: item.unit === 'token' ? 'token' : 'count',
    monthlyQuota,
    used,
    remaining,
  };
}

function normalizeQuota(
  quota: IPrimeFreeTrialQuota | null | undefined,
): IPrimeFreeTrialQuota | null | undefined {
  if (quota === null || quota === undefined) {
    return quota;
  }
  return {
    period: String(quota.period ?? ''),
    resetAt: Number(quota.resetAt) || 0,
    features: (Array.isArray(quota.features) ? quota.features : [])
      .map((item) => normalizeFeatureQuota(item))
      .filter((item): item is IPrimeFreeTrialFeatureQuota => Boolean(item)),
  };
}

function normalizePublicConfig(
  config: IPrimeFreeTrialPublicConfig | null | undefined,
): IPrimeFreeTrialPublicConfig {
  const features = (
    Array.isArray(config?.features) ? config.features : []
  ).filter((item) => isPrimeFreeTrialFeatureId(item?.featureId));
  return {
    enabled: Boolean(config?.enabled) && features.length > 0,
    features: features.map((item) => ({
      featureId: item.featureId,
      unit: item.unit === 'token' ? 'token' : 'count',
      monthlyQuota: Number(item.monthlyQuota) || 0,
    })),
  };
}

function getReportBackoffMs(attempts: number) {
  return Math.min(
    REPORT_BACKOFF_BASE_MS * 2 ** Math.max(0, attempts),
    REPORT_BACKOFF_MAX_MS,
  );
}

@backgroundClass()
class ServicePrimeFreeTrial extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // Monotonic sequence of quota writers (/user/info, /free-trial/quota,
  // metering responses, 90600 data). A response may only overwrite the
  // snapshot when its sequence is newer than the last applied one.
  private quotaRequestSeq = 0;

  private lastAppliedQuotaRequestSeq = 0;

  private startRequests = new Map<
    string,
    Promise<IPrimeFreeTrialStartResult>
  >();

  private quotaRefreshInflight:
    | Promise<IPrimeFreeTrialQuota | null | undefined>
    | undefined;

  private reportingRecordKeys = new Set<string>();

  private reportRetryTimer: ReturnType<typeof setTimeout> | undefined;

  private lastKnownPrimeState:
    | { onekeyUserId: string; isPrimeSubscriptionActive: boolean }
    | undefined;

  private async isTravelMode() {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.profile.kind === 'travel-mode';
  }

  private trace(params: {
    featureId?: IPrimeFreeTrialFeatureId;
    stage: string;
    reason?: string;
  }) {
    defaultLogger.prime.subscription.primeFreeTrialTrace(params);
  }

  // ---------------------------------------------------------------------------
  // Public config
  // ---------------------------------------------------------------------------

  private fetchPublicConfigWithCache = memoizee(
    async (): Promise<IPrimeFreeTrialPublicConfig> => {
      // Public endpoint: the plain client keeps auth interceptors (and their
      // logout side effects) out of a request that needs no login.
      const client = await this.getClient(EServiceEndpointEnum.Prime);
      const res = await client.get<
        IApiClientResponse<IPrimeFreeTrialPublicConfig>
      >('/prime/v1/free-trial/features');
      return normalizePublicConfig(res.data.data);
    },
    {
      promise: true,
      maxAge: PUBLIC_CONFIG_CACHE_MS,
    },
  );

  // Returns undefined when the config is unknown (request failed or travel
  // mode). Unknown must never be treated as "not open".
  @backgroundMethod()
  async getPublicConfig({
    forceRefresh,
  }: { forceRefresh?: boolean } = {}): Promise<
    IPrimeFreeTrialPublicConfig | undefined
  > {
    if (await this.isTravelMode()) {
      return undefined;
    }
    if (forceRefresh) {
      void this.fetchPublicConfigWithCache.clear();
    }
    await primeFreeTrialAtom.set((v) => ({
      ...v,
      config: { ...v.config, status: 'loading' },
    }));
    try {
      const data = await this.fetchPublicConfigWithCache();
      await primeFreeTrialAtom.set((v) => ({
        ...v,
        config: { status: 'success', data, updatedAt: Date.now() },
      }));
      return data;
    } catch (error) {
      this.trace({
        stage: 'getPublicConfig',
        reason: (error as Error | undefined)?.message,
      });
      await primeFreeTrialAtom.set((v) => ({
        ...v,
        config: { ...v.config, status: 'error' },
      }));
      return undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Quota snapshot
  // ---------------------------------------------------------------------------

  // Background-only: reserve a sequence number when a quota request starts.
  allocateQuotaRequestSeq() {
    this.quotaRequestSeq += 1;
    return this.quotaRequestSeq;
  }

  private async writeQuotaSnapshot({
    requestSeq,
    onekeyUserId,
    data,
  }: {
    requestSeq: number;
    onekeyUserId: string;
    data: IPrimeFreeTrialQuota | null;
  }) {
    if (requestSeq <= this.lastAppliedQuotaRequestSeq) {
      return false;
    }
    const user = await primePersistAtom.get();
    if (!user.isLoggedIn || user.onekeyUserId !== onekeyUserId) {
      return false;
    }
    this.lastAppliedQuotaRequestSeq = requestSeq;
    await primeFreeTrialAtom.set((v) => ({
      ...v,
      quota: {
        status: 'success',
        onekeyUserId,
        data,
        updatedAt: Date.now(),
      },
    }));
    return true;
  }

  private async clearQuotaSnapshot() {
    // Invalidate every in-flight quota request as well.
    this.lastAppliedQuotaRequestSeq = this.allocateQuotaRequestSeq();
    const current = await primeFreeTrialAtom.get();
    if (
      current.quota.status === 'idle' &&
      current.quota.data === undefined &&
      current.quota.onekeyUserId === undefined
    ) {
      return;
    }
    await primeFreeTrialAtom.set((v) => ({
      ...v,
      quota: cloneDeep(primeFreeTrialAtomInitialValue.quota),
    }));
  }

  // Background-only: called inside the same-session commit branch of
  // ServicePrime._fetchPrimeUserInfo. Must only touch atoms.
  async applyQuotaFromPrimeUserInfo({
    freeTrial,
    onekeyUserId,
    requestSeq,
    isPrimeSubscriptionActive,
  }: {
    freeTrial: IPrimeFreeTrialQuota | null | undefined;
    onekeyUserId: string | undefined;
    requestSeq: number;
    isPrimeSubscriptionActive: boolean;
  }) {
    try {
      if (isPrimeSubscriptionActive) {
        await this.clearQuotaSnapshot();
        return;
      }
      // undefined: unknown (old server / request failed), keep the snapshot.
      if (freeTrial === undefined || !onekeyUserId) {
        return;
      }
      const applied = await this.writeQuotaSnapshot({
        requestSeq,
        onekeyUserId,
        data: normalizeQuota(freeTrial) ?? null,
      });
      if (applied && freeTrial === null) {
        // null for a non-Prime user means nothing is open; the public config
        // tells which features are closed. Never awaited: this runs inside
        // the login mutex.
        void this.getPublicConfig();
      }
    } catch (error) {
      this.trace({
        stage: 'applyQuotaFromPrimeUserInfo',
        reason: (error as Error | undefined)?.message,
      });
    }
  }

  // Returns the latest quota, null for Prime users / nothing open, or
  // undefined when it is unknown (logged out, travel mode, request failed).
  // `dedupe` joins a refresh already in flight; metering paths never pass it
  // because an older in-flight request may predate their change.
  @backgroundMethod()
  async refreshQuota({ dedupe }: { dedupe?: boolean } = {}): Promise<
    IPrimeFreeTrialQuota | null | undefined
  > {
    if (dedupe && this.quotaRefreshInflight) {
      return this.quotaRefreshInflight;
    }
    const promise = this.refreshQuotaImpl();
    this.quotaRefreshInflight = promise;
    try {
      return await promise;
    } finally {
      if (this.quotaRefreshInflight === promise) {
        this.quotaRefreshInflight = undefined;
      }
    }
  }

  private async refreshQuotaImpl(): Promise<
    IPrimeFreeTrialQuota | null | undefined
  > {
    if (await this.isTravelMode()) {
      return undefined;
    }
    const user = await primePersistAtom.get();
    if (!user.isLoggedIn || !user.isLoggedInOnServer || !user.onekeyUserId) {
      return undefined;
    }
    if (user.primeSubscription?.isActive) {
      await this.clearQuotaSnapshot();
      return null;
    }
    const onekeyUserId = user.onekeyUserId;
    const requestSeq = this.allocateQuotaRequestSeq();
    await primeFreeTrialAtom.set((v) =>
      v.quota.onekeyUserId === onekeyUserId
        ? { ...v, quota: { ...v.quota, status: 'loading' } }
        : {
            ...v,
            quota: { status: 'loading', onekeyUserId, data: undefined },
          },
    );
    try {
      const { snapshot, requestConfig } =
        await this.backgroundApi.servicePrime.captureOneKeyIdAuthRequestConfig({
          expectedOneKeyUserId: onekeyUserId,
          createStateChangedError: createUserChangedError,
        });
      const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
      const res = await client.get<
        IApiClientResponse<IPrimeFreeTrialQuota | null>
      >('/prime/v1/free-trial/quota', requestConfig);
      const data = normalizeQuota(res.data.data) ?? null;
      await this.backgroundApi.servicePrime.assertOneKeyIdAuthSnapshotUnchanged(
        {
          snapshot,
          createStateChangedError: createUserChangedError,
        },
      );
      const applied = await this.writeQuotaSnapshot({
        requestSeq,
        onekeyUserId,
        data,
      });
      if (!applied) {
        return (await primeFreeTrialAtom.get()).quota.data;
      }
      if (data === null) {
        // Nothing open for this free user: load which features are closed.
        await this.getPublicConfig();
      }
      return data;
    } catch (error) {
      this.trace({
        stage: 'refreshQuota',
        reason: (error as Error | undefined)?.message,
      });
      if (requestSeq > this.lastAppliedQuotaRequestSeq) {
        await primeFreeTrialAtom.set((v) =>
          v.quota.onekeyUserId === onekeyUserId
            ? { ...v, quota: { ...v.quota, status: 'error' } }
            : v,
        );
      }
      return undefined;
    }
  }

  private async updateFeatureQuotaInSnapshot({
    onekeyUserId,
    resetAt,
    featureQuota,
  }: {
    onekeyUserId: string;
    resetAt: number | undefined;
    featureQuota: IPrimeFreeTrialFeatureQuota;
  }) {
    const current = (await primeFreeTrialAtom.get()).quota;
    const currentData = current.data;
    if (
      current.status !== 'success' ||
      current.onekeyUserId !== onekeyUserId ||
      !currentData ||
      (resetAt !== undefined && currentData.resetAt !== resetAt)
    ) {
      return false;
    }
    const requestSeq = this.allocateQuotaRequestSeq();
    const features = currentData.features.some(
      (item) => item.featureId === featureQuota.featureId,
    )
      ? currentData.features.map((item) =>
          item.featureId === featureQuota.featureId ? featureQuota : item,
        )
      : [...currentData.features, featureQuota];
    return this.writeQuotaSnapshot({
      requestSeq,
      onekeyUserId,
      data: { ...currentData, features },
    });
  }

  // 90600 carries the authoritative quota of the exhausted feature.
  @backgroundMethod()
  async applyQuotaExhaustedData(data: IPrimeFreeTrialQuotaExhaustedData) {
    const user = await primePersistAtom.get();
    if (!user.isLoggedIn || !user.onekeyUserId) {
      return;
    }
    const current = (await primeFreeTrialAtom.get()).quota;
    const previous = current.data?.features.find(
      (item) => item.featureId === data.featureId,
    );
    const monthlyQuota = Number(data.monthlyQuota ?? previous?.monthlyQuota);
    const featureQuota: IPrimeFreeTrialFeatureQuota = {
      featureId: data.featureId,
      unit: data.unit ?? previous?.unit ?? 'count',
      monthlyQuota: Number.isFinite(monthlyQuota) ? monthlyQuota : 0,
      used: Number(data.used ?? previous?.used ?? monthlyQuota) || 0,
      remaining: 0,
    };
    const applied = await this.updateFeatureQuotaInSnapshot({
      onekeyUserId: user.onekeyUserId,
      resetAt: data.resetAt,
      featureQuota,
    });
    if (!applied) {
      void this.refreshQuota();
    }
  }

  // Background-only: reacts to a normalized free-trial error from any
  // free-trial aware endpoint.
  async handleFreeTrialErrorFromServer(freeTrialError: IPrimeFreeTrialError) {
    try {
      if (freeTrialError.code === PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE) {
        await this.applyQuotaExhaustedData(freeTrialError.data);
        return;
      }
      // The feature was turned off: drop cached config and quota.
      void this.fetchPublicConfigWithCache.clear();
      void this.refreshQuota();
    } catch (error) {
      this.trace({
        featureId: freeTrialError.data.featureId,
        stage: 'handleFreeTrialErrorFromServer',
        reason: (error as Error | undefined)?.message,
      });
    }
  }

  // Background-only: maps a raw error of a free-trial aware endpoint to the
  // normalized client error. Recognizes 90600, the raw 90005 / 90601 and the
  // OneKeyErrorPrimePaidMembershipRequired that the ServiceBase interceptor
  // rewrites 90005 into (same bg runtime, so instanceof is reliable here).
  normalizeFreeTrialError({
    error,
    featureId,
  }: {
    error: unknown;
    featureId: IPrimeFreeTrialFeatureId;
  }): IPrimeFreeTrialError | undefined {
    if (error instanceof OneKeyErrorPrimePaidMembershipRequired) {
      return {
        code: PRIME_FREE_TRIAL_NOT_OPEN_CODE,
        data: { featureId },
      };
    }
    const code = getServerErrorCode(error);
    if (code === PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE) {
      const businessData =
        getServerErrorBusinessData<IPrimeFreeTrialQuotaExhaustedData>(error);
      return {
        code: PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
        data: {
          ...businessData,
          featureId: isPrimeFreeTrialFeatureId(businessData?.featureId)
            ? businessData.featureId
            : featureId,
          remaining: 0,
        },
      };
    }
    if (
      code === PRIME_FREE_TRIAL_NOT_OPEN_CODE ||
      code === PRIME_FREE_TRIAL_LEGACY_NOT_OPEN_SERVER_CODE
    ) {
      const businessData = getServerErrorBusinessData<{
        reason?: 'trialNotOpen' | 'detailsNotEligible';
      }>(error);
      return {
        code: PRIME_FREE_TRIAL_NOT_OPEN_CODE,
        data: { featureId, reason: businessData?.reason },
      };
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Usage metering (start / finish)
  // ---------------------------------------------------------------------------

  private getUsageCacheKey(featureId: string, usageId: string) {
    return `${featureId}__${usageId}`;
  }

  private async requestStart({
    onekeyUserId,
    featureId,
    usageId,
  }: {
    onekeyUserId: string;
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
  }) {
    const { requestConfig } =
      await this.backgroundApi.servicePrime.captureOneKeyIdAuthRequestConfig({
        expectedOneKeyUserId: onekeyUserId,
        createStateChangedError: createUserChangedError,
      });
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<IPrimeFreeTrialStartResponse>
    >(
      '/prime/v1/free-trial/usage/start',
      { featureId, usageId },
      { ...requestConfig, timeout: START_REQUEST_TIMEOUT_MS },
    );
    return res.data.data;
  }

  // Reserves one use before the business runs. Exhausted / not open are
  // returned, never thrown. Throws when the result stays unknown after
  // retries (the business must not run) or on a definitive error.
  @backgroundMethod()
  async startUsage({
    featureId,
    usageId,
  }: {
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
  }): Promise<IPrimeFreeTrialStartResult> {
    if (!USAGE_ID_REGEXP.test(usageId)) {
      throw new OneKeyLocalError({
        message: 'Invalid free trial usage id',
        autoToast: false,
      });
    }
    const key = this.getUsageCacheKey(featureId, usageId);
    const inflight = this.startRequests.get(key);
    if (inflight) {
      return inflight;
    }
    const promise = this.startUsageImpl({ featureId, usageId }).finally(() => {
      this.startRequests.delete(key);
    });
    this.startRequests.set(key, promise);
    return promise;
  }

  private async startUsageImpl({
    featureId,
    usageId,
  }: {
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
  }): Promise<IPrimeFreeTrialStartResult> {
    if (await this.isTravelMode()) {
      throw new OneKeyLocalError({
        message: 'Prime free trial is unavailable in travel mode',
        autoToast: false,
      });
    }
    const user = await primePersistAtom.get();
    if (!user.isLoggedIn || !user.isLoggedInOnServer || !user.onekeyUserId) {
      return { status: 'loginRequired', featureId };
    }
    if (user.primeSubscription?.isActive) {
      // Prime users never meter, even when a UI projection lagged behind.
      return { status: 'unlimited' };
    }
    const onekeyUserId = user.onekeyUserId;
    const startedAt = Date.now();
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < START_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.requestStart({
          onekeyUserId,
          featureId,
          usageId,
        });
        if (!response || response.unlimited) {
          // The server sees an active subscription the local state has not
          // caught up with yet: run without metering.
          void this.backgroundApi.servicePrime.apiFetchPrimeUserInfo({
            forceRefresh: true,
          });
          return { status: 'unlimited' };
        }
        const quota =
          normalizeFeatureQuota(response.quota) ??
          ({
            featureId,
            unit: 'count',
            monthlyQuota: 0,
            used: 0,
            remaining: 0,
          } as IPrimeFreeTrialFeatureQuota);
        await this.backgroundApi.simpleDb.primeFreeTrial.updateUsageRecord(
          { onekeyUserId, featureId, usageId },
          (record) => ({
            ...(record ?? {
              onekeyUserId,
              featureId,
              usageId,
              startedAt,
              reportAttempts: 0,
            }),
            expiresAt: Number(response.expiresAt) || undefined,
          }),
        );
        void this.applyMeteringQuota({
          onekeyUserId,
          resetAt: Number(response.resetAt) || undefined,
          featureQuota: quota,
        });
        return {
          status: 'granted',
          featureId,
          usageId,
          quota,
          expiresAt: Number(response.expiresAt) || 0,
          resetAt: Number(response.resetAt) || 0,
        };
      } catch (error) {
        const freeTrialError = this.normalizeFreeTrialError({
          error,
          featureId,
        });
        if (freeTrialError?.code === PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE) {
          await this.applyQuotaExhaustedData(freeTrialError.data);
          return { status: 'exhausted', featureId, data: freeTrialError.data };
        }
        if (freeTrialError?.code === PRIME_FREE_TRIAL_NOT_OPEN_CODE) {
          await this.handleFreeTrialErrorFromServer(freeTrialError);
          return { status: 'notOpen', featureId };
        }
        if (!isUncertainRequestError(error)) {
          throw error;
        }
        lastError = error as Error;
        if (attempt < START_MAX_ATTEMPTS - 1) {
          await timerUtils.wait(1000 * (attempt + 1));
        }
      }
    }
    // The reservation may or may not exist, and the caller will not run the
    // business: report cancelled with the same id to release it early.
    this.trace({
      featureId,
      stage: 'startUsage',
      reason: 'start result unknown, releasing with cancelled',
    });
    await this.recordUsageResult({
      onekeyUserId,
      featureId,
      usageId,
      result: 'cancelled',
      startedAt,
    });
    throw (
      lastError ??
      new OneKeyLocalError({
        message: 'Prime free trial start failed',
        autoToast: false,
      })
    );
  }

  // start returns the feature quota; only write it when it belongs to the
  // month of the current snapshot, otherwise re-fetch.
  private async applyMeteringQuota({
    onekeyUserId,
    resetAt,
    featureQuota,
  }: {
    onekeyUserId: string;
    resetAt: number | undefined;
    featureQuota: IPrimeFreeTrialFeatureQuota;
  }) {
    try {
      const applied =
        resetAt !== undefined &&
        (await this.updateFeatureQuotaInSnapshot({
          onekeyUserId,
          resetAt,
          featureQuota,
        }));
      if (!applied) {
        await this.refreshQuota();
      }
    } catch (error) {
      this.trace({
        featureId: featureQuota.featureId,
        stage: 'applyMeteringQuota',
        reason: (error as Error | undefined)?.message,
      });
    }
  }

  private async findUsageRecord({
    featureId,
    usageId,
  }: {
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
  }) {
    const records =
      await this.backgroundApi.simpleDb.primeFreeTrial.getUsageRecords();
    return records.find(
      (record) => record.featureId === featureId && record.usageId === usageId,
    );
  }

  // Success wins: once a usage is success, later failed / cancelled are
  // dropped locally. The first non-success result is kept as well, matching
  // the server rule that the first finish is final. A record the server
  // already accepted is terminal, so repeated marks (one per broadcast) never
  // report or log twice.
  private async recordUsageResult({
    onekeyUserId,
    featureId,
    usageId,
    result,
    startedAt,
  }: {
    onekeyUserId: string;
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
    result: IPrimeFreeTrialUsageResult;
    startedAt?: number;
  }) {
    let changed = false;
    const now = Date.now();
    const record =
      await this.backgroundApi.simpleDb.primeFreeTrial.updateUsageRecord(
        { onekeyUserId, featureId, usageId },
        (current) => {
          const base: IPrimeFreeTrialUsageRecord = current ?? {
            onekeyUserId,
            featureId,
            usageId,
            startedAt: startedAt ?? now,
            reportAttempts: 0,
          };
          if (
            base.reportedAt ||
            base.result === 'success' ||
            (base.result && result !== 'success')
          ) {
            return base;
          }
          changed = true;
          return {
            ...base,
            // Without a server expiry, fall back to local start + the
            // reservation lifetime so a non-success record cannot linger.
            expiresAt:
              base.expiresAt ??
              base.startedAt + PRIME_FREE_TRIAL_RESERVATION_TTL_MS[featureId],
            result,
            resultAt: now,
            nextReportAt: undefined,
          };
        },
      );
    if (!changed) {
      return;
    }
    if (result === 'success') {
      defaultLogger.prime.subscription.primeFreeTrialUsageSuccess({
        featureName: featureId,
        featureId,
        entitlementSource: 'freeTrial',
      });
    }
    if (record) {
      void this.reportUsageRecord(record);
    }
  }

  // Results are attributed to the user that started the usage (its record),
  // never to whoever is logged in now. An unknown usage is dropped: counting
  // it for the current user could charge an account that never started it.
  private async recordResultOfStartedUsage({
    featureId,
    usageId,
    result,
  }: {
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
    result: IPrimeFreeTrialUsageResult;
  }) {
    const existing = await this.findUsageRecord({ featureId, usageId });
    if (!existing) {
      this.trace({
        featureId,
        stage: 'recordUsageResult',
        reason: 'unknown usage, dropped',
      });
      return;
    }
    // Fast path for the common repeat (every later broadcast of a bulk run):
    // no write at all once the result is settled.
    if (
      existing.reportedAt ||
      existing.result === 'success' ||
      (existing.result && result !== 'success')
    ) {
      return;
    }
    await this.recordUsageResult({
      onekeyUserId: existing.onekeyUserId,
      featureId,
      usageId,
      result,
    });
  }

  // Marks the usage as consumed. Only waits for the durable local write; the
  // finish request is sent asynchronously.
  @backgroundMethod()
  async markUsageSuccess({
    featureId,
    usageId,
  }: {
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
  }) {
    await this.recordResultOfStartedUsage({
      featureId,
      usageId,
      result: 'success',
    });
  }

  // Settles a usage that ended without success. Ignored when it already
  // succeeded.
  @backgroundMethod()
  async settleUsage({
    featureId,
    usageId,
    result,
  }: {
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
    result: Exclude<IPrimeFreeTrialUsageResult, 'success'>;
  }) {
    await this.recordResultOfStartedUsage({
      featureId,
      usageId,
      result,
    });
  }

  @backgroundMethod()
  async getUsageResult({
    featureId,
    usageId,
  }: {
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
  }): Promise<IPrimeFreeTrialUsageResult | undefined> {
    // Durable: settled records are kept for a while after the server
    // confirmed them, so this survives a background restart.
    const record = await this.findUsageRecord({ featureId, usageId });
    return record?.result;
  }

  // The server counts live reservations in `used`, so "exhausted" may only
  // mean a reservation is still held: a usage still running, interrupted
  // (e.g. the app was killed), or whose release was not reported yet.
  // Returns the earliest end of such a reservation held by this device for
  // the current user, undefined when none is known.
  @backgroundMethod()
  async getHeldReservationEnd({
    featureId,
  }: {
    featureId: IPrimeFreeTrialUsageFeatureId;
  }): Promise<number | undefined> {
    const user = await primePersistAtom.get();
    if (!user.onekeyUserId) {
      return undefined;
    }
    const now = Date.now();
    const records =
      await this.backgroundApi.simpleDb.primeFreeTrial.getUsageRecords();
    const ends = records
      .filter(
        (record) =>
          record.onekeyUserId === user.onekeyUserId &&
          record.featureId === featureId &&
          record.result !== 'success' &&
          !record.reportedAt,
      )
      .map(
        (record) =>
          record.expiresAt ??
          record.startedAt + PRIME_FREE_TRIAL_RESERVATION_TTL_MS[featureId],
      )
      .filter((end) => end > now);
    return ends.length ? Math.min(...ends) : undefined;
  }

  // Background-only: called by ServiceSend right after a broadcast succeeds.
  // Must never break or alter the send flow.
  async markBroadcastSuccess(usage: IPrimeFreeTrialBroadcastUsage) {
    try {
      await this.markUsageSuccess(usage);
    } catch (error) {
      this.trace({
        featureId: usage.featureId,
        stage: 'markBroadcastSuccess',
        reason: (error as Error | undefined)?.message,
      });
    }
  }

  private async reportUsageRecord(record: IPrimeFreeTrialUsageRecord) {
    const { result } = record;
    if (!result || !isPrimeFreeTrialUsageRecordReportable(record)) {
      return;
    }
    const recordKey = buildPrimeFreeTrialUsageRecordKey(record);
    if (this.reportingRecordKeys.has(recordKey)) {
      return;
    }
    this.reportingRecordKeys.add(recordKey);
    const recordIdentity = {
      onekeyUserId: record.onekeyUserId,
      featureId: record.featureId,
      usageId: record.usageId,
    };
    try {
      if (await this.isTravelMode()) {
        return;
      }
      const user = await primePersistAtom.get();
      // Only ever report as the owner of the usage.
      if (!user.isLoggedIn || user.onekeyUserId !== record.onekeyUserId) {
        return;
      }
      try {
        const { requestConfig } =
          await this.backgroundApi.servicePrime.captureOneKeyIdAuthRequestConfig(
            {
              expectedOneKeyUserId: record.onekeyUserId,
              createStateChangedError: createUserChangedError,
            },
          );
        const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
        await client.post<IApiClientResponse<IPrimeFreeTrialFinishResponse>>(
          '/prime/v1/free-trial/usage/finish',
          {
            featureId: record.featureId,
            usageId: record.usageId,
            result,
          },
          requestConfig,
        );
        await this.markRecordReported(recordIdentity);
        // The finish quota has no period, so it is only a refresh signal.
        void this.refreshQuota();
      } catch (error) {
        const code = getServerErrorCode(error);
        if (code === PRIME_FREE_TRIAL_USAGE_REJECTED_CODE) {
          // Terminal on the server: never retried.
          await this.markRecordReported(recordIdentity);
          return;
        }
        if (
          isUserChangedError(error) ||
          error instanceof OneKeyErrorPrimeLoginInvalidToken
        ) {
          // Keep the record until the owner logs in again (login / network
          // recovery flush it); no timer, so nothing spins meanwhile.
          await this.backgroundApi.simpleDb.primeFreeTrial.updateUsageRecord(
            recordIdentity,
            (current) =>
              current ? { ...current, nextReportAt: undefined } : current,
          );
          return;
        }
        this.trace({
          featureId: record.featureId,
          stage: 'reportUsageRecord',
          reason: `code=${String(code)} ${
            (error as Error | undefined)?.message ?? ''
          }`,
        });
        const now = Date.now();
        await this.backgroundApi.simpleDb.primeFreeTrial.updateUsageRecord(
          recordIdentity,
          (current) =>
            current
              ? {
                  ...current,
                  reportAttempts: current.reportAttempts + 1,
                  nextReportAt:
                    now + getReportBackoffMs(current.reportAttempts),
                }
              : current,
        );
        this.scheduleReportRetry();
      }
    } catch (error) {
      this.trace({
        featureId: record.featureId,
        stage: 'reportUsageRecord',
        reason: (error as Error | undefined)?.message,
      });
    } finally {
      this.reportingRecordKeys.delete(recordKey);
    }
  }

  private async markRecordReported(recordIdentity: {
    onekeyUserId: string;
    featureId: IPrimeFreeTrialUsageFeatureId;
    usageId: string;
  }) {
    const now = Date.now();
    await this.backgroundApi.simpleDb.primeFreeTrial.updateUsageRecord(
      recordIdentity,
      (current) =>
        current
          ? { ...current, reportedAt: now, nextReportAt: undefined }
          : current,
    );
  }

  // Only the logged-in owner's pending retry timers are scheduled: records of
  // other users wait for their owner's login.
  private scheduleReportRetry() {
    void (async () => {
      const user = await primePersistAtom.get();
      const now = Date.now();
      const records =
        await this.backgroundApi.simpleDb.primeFreeTrial.getUsageRecords();
      const nextAt = records
        .filter(
          (record) =>
            isPrimeFreeTrialUsageRecordReportable(record) &&
            record.onekeyUserId === user.onekeyUserId &&
            record.nextReportAt &&
            record.nextReportAt > now,
        )
        .map((record) => record.nextReportAt as number)
        .toSorted((a, b) => a - b)[0];
      if (this.reportRetryTimer) {
        clearTimeout(this.reportRetryTimer);
        this.reportRetryTimer = undefined;
      }
      if (!nextAt || !user.isLoggedIn) {
        return;
      }
      this.reportRetryTimer = setTimeout(
        () => {
          this.reportRetryTimer = undefined;
          void this.flushPendingReports();
        },
        Math.max(1000, nextAt - Date.now()),
      );
    })().catch((error) => {
      this.trace({
        stage: 'scheduleReportRetry',
        reason: (error as Error | undefined)?.message,
      });
    });
  }

  // Re-sends every settled usage of the current user. Called on startup,
  // login and network recovery.
  @backgroundMethod()
  async flushPendingReports({ force }: { force?: boolean } = {}) {
    try {
      if (await this.isTravelMode()) {
        return;
      }
      const user = await primePersistAtom.get();
      if (!user.isLoggedIn || !user.onekeyUserId) {
        return;
      }
      const now = Date.now();
      const records =
        await this.backgroundApi.simpleDb.primeFreeTrial.getUsageRecords();
      const dueRecords = records.filter(
        (record) =>
          isPrimeFreeTrialUsageRecordReportable(record) &&
          record.onekeyUserId === user.onekeyUserId &&
          (force || !record.nextReportAt || record.nextReportAt <= now),
      );
      for (const record of dueRecords) {
        await this.reportUsageRecord(record);
      }
      this.scheduleReportRetry();
    } catch (error) {
      this.trace({
        stage: 'flushPendingReports',
        reason: (error as Error | undefined)?.message,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Auth state
  // ---------------------------------------------------------------------------

  // Called by the UI whenever the OneKey ID user or subscription changes.
  @backgroundMethod()
  async onPrimeUserStateChanged() {
    const user = await primePersistAtom.get();
    const { quota } = await primeFreeTrialAtom.get();
    if (!user.isLoggedIn || !user.isLoggedInOnServer || !user.onekeyUserId) {
      this.lastKnownPrimeState = undefined;
      await this.clearQuotaSnapshot();
      return;
    }
    const isPrimeSubscriptionActive = Boolean(user.primeSubscription?.isActive);
    const previous = this.lastKnownPrimeState;
    this.lastKnownPrimeState = {
      onekeyUserId: user.onekeyUserId,
      isPrimeSubscriptionActive,
    };
    if (quota.onekeyUserId && quota.onekeyUserId !== user.onekeyUserId) {
      await this.clearQuotaSnapshot();
    }
    if (isPrimeSubscriptionActive) {
      await this.clearQuotaSnapshot();
    } else if (
      previous?.onekeyUserId === user.onekeyUserId &&
      previous.isPrimeSubscriptionActive
    ) {
      // The subscription just lapsed: the user is a free user again.
      void this.refreshQuota();
    }
    // Usage reports wait for the owner, even when Prime is active now.
    void this.flushPendingReports({ force: true });
  }

  // Background-only: account deletion removes every record of the user.
  async clearUserData({ onekeyUserId }: { onekeyUserId: string }) {
    try {
      await this.backgroundApi.simpleDb.primeFreeTrial.deleteUsageRecordsOfUser(
        { onekeyUserId },
      );
    } catch (error) {
      this.trace({
        stage: 'clearUserData',
        reason: (error as Error | undefined)?.message,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Extension popup -> expand tab hand-off
  // ---------------------------------------------------------------------------

  @backgroundMethod()
  async savePendingAction(
    action: Omit<IPrimeFreeTrialPendingAction, 'createdAt' | 'expiresAt'>,
  ): Promise<IPrimeFreeTrialPendingAction> {
    const now = Date.now();
    const pendingAction: IPrimeFreeTrialPendingAction = {
      ...action,
      createdAt: now,
      expiresAt: now + PENDING_ACTION_TTL_MS,
    };
    await this.backgroundApi.simpleDb.primeFreeTrial.setPendingAction(
      pendingAction,
    );
    return pendingAction;
  }

  // Reads and removes the slot. Expired actions are dropped.
  @backgroundMethod()
  async consumePendingAction(): Promise<
    IPrimeFreeTrialPendingAction | undefined
  > {
    const pendingAction =
      await this.backgroundApi.simpleDb.primeFreeTrial.getPendingAction();
    if (!pendingAction) {
      return undefined;
    }
    await this.backgroundApi.simpleDb.primeFreeTrial.clearPendingAction(
      (current) => current.createdAt === pendingAction.createdAt,
    );
    if (pendingAction.expiresAt <= Date.now()) {
      return undefined;
    }
    return pendingAction;
  }

  // A cancelled login only discards actions written before it started, so
  // an action saved by the popup meanwhile survives.
  @backgroundMethod()
  async clearPendingActionCreatedBefore({
    timestamp,
    type,
  }: {
    timestamp: number;
    type?: EPrimeFreeTrialPendingActionType;
  }) {
    await this.backgroundApi.simpleDb.primeFreeTrial.clearPendingAction(
      (current) =>
        current.createdAt < timestamp && (!type || current.type === type),
    );
  }
}

export default ServicePrimeFreeTrial;
