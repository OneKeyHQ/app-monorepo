import { EPrimeFeatures } from '../../src/routes/prime';

// Prime features that may open a monthly free trial in phase one.
export type IPrimeFreeTrialFeatureId =
  | EPrimeFeatures.BulkCopyAddresses
  | EPrimeFeatures.BulkSend
  | EPrimeFeatures.BulkRevoke
  | EPrimeFeatures.AddressRiskCheck
  | EPrimeFeatures.DAppTranslate;

// Features metered by the client through usage start / finish.
export type IPrimeFreeTrialUsageFeatureId =
  | EPrimeFeatures.BulkCopyAddresses
  | EPrimeFeatures.BulkSend
  | EPrimeFeatures.BulkRevoke;

// Features whose successful broadcast is marked inside ServiceSend.
export type IPrimeFreeTrialBroadcastFeatureId =
  | EPrimeFeatures.BulkSend
  | EPrimeFeatures.BulkRevoke;

export const PRIME_FREE_TRIAL_FEATURE_IDS: IPrimeFreeTrialFeatureId[] = [
  EPrimeFeatures.BulkCopyAddresses,
  EPrimeFeatures.BulkSend,
  EPrimeFeatures.BulkRevoke,
  EPrimeFeatures.AddressRiskCheck,
  EPrimeFeatures.DAppTranslate,
];

export function isPrimeFreeTrialFeatureId(
  featureId: unknown,
): featureId is IPrimeFreeTrialFeatureId {
  return PRIME_FREE_TRIAL_FEATURE_IDS.includes(
    featureId as IPrimeFreeTrialFeatureId,
  );
}

const PRIME_FREE_TRIAL_USAGE_FEATURE_IDS =
  new Set<IPrimeFreeTrialUsageFeatureId>([
    EPrimeFeatures.BulkCopyAddresses,
    EPrimeFeatures.BulkSend,
    EPrimeFeatures.BulkRevoke,
  ]);

export function isPrimeFreeTrialUsageFeatureId(
  featureId: unknown,
): featureId is IPrimeFreeTrialUsageFeatureId {
  return PRIME_FREE_TRIAL_USAGE_FEATURE_IDS.has(
    featureId as IPrimeFreeTrialUsageFeatureId,
  );
}

// Server: monthly free quota exhausted.
export const PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE = 90_600;
// Client-normalized "feature is not open for free trial". The server returns
// the legacy 90005 today and will switch to the same 90601 later; the
// background normalizes both to this code before anything reaches the UI.
export const PRIME_FREE_TRIAL_NOT_OPEN_CODE = 90_601;
export const PRIME_FREE_TRIAL_LEGACY_NOT_OPEN_SERVER_CODE = 90_005;
// Server: invalid params, or the usageId can no longer be started.
export const PRIME_FREE_TRIAL_USAGE_REJECTED_CODE = 90_001;
// Server: finish result was not recorded, retry with the same id and result.
export const PRIME_FREE_TRIAL_FINISH_NOT_RECORDED_CODE = 90_000;

// Reservation lifetime of a started usage, used when the server response
// (and therefore `expiresAt`) is unknown.
export const PRIME_FREE_TRIAL_RESERVATION_TTL_MS: Record<
  IPrimeFreeTrialUsageFeatureId,
  number
> = {
  [EPrimeFeatures.BulkCopyAddresses]: 10 * 60 * 1000,
  [EPrimeFeatures.BulkSend]: 30 * 60 * 1000,
  [EPrimeFeatures.BulkRevoke]: 30 * 60 * 1000,
};

export type IPrimeFreeTrialUnit = 'count' | 'token';

export type IPrimeFreeTrialPublicFeature = {
  featureId: IPrimeFreeTrialFeatureId;
  unit: IPrimeFreeTrialUnit;
  monthlyQuota: number;
};

// GET /prime/v1/free-trial/features
export type IPrimeFreeTrialPublicConfig = {
  enabled: boolean;
  features: IPrimeFreeTrialPublicFeature[];
};

export type IPrimeFreeTrialFeatureQuota = IPrimeFreeTrialPublicFeature & {
  used: number;
  remaining: number;
};

// GET /prime/v1/free-trial/quota and `freeTrial` of GET /prime/v1/user/info.
// `null` means a Prime user or no open feature at all.
export type IPrimeFreeTrialQuota = {
  // YYYY-MM (UTC)
  period: string;
  // Start of the next UTC month, in milliseconds
  resetAt: number;
  features: IPrimeFreeTrialFeatureQuota[];
};

export type IPrimeFreeTrialUserInfoField = {
  // undefined: unknown (old server or request failed); null: Prime user or
  // nothing is open.
  freeTrial?: IPrimeFreeTrialQuota | null;
};

export type IPrimeFreeTrialUsageResult = 'success' | 'failed' | 'cancelled';

// POST /prime/v1/free-trial/usage/start
export type IPrimeFreeTrialStartResponse =
  | { unlimited: true }
  | {
      unlimited: false;
      featureId: IPrimeFreeTrialUsageFeatureId;
      usageId: string;
      quota: IPrimeFreeTrialFeatureQuota;
      expiresAt: number;
      resetAt: number;
    };

// POST /prime/v1/free-trial/usage/finish
export type IPrimeFreeTrialFinishResponse =
  | { unlimited: true }
  | {
      unlimited: false;
      featureId: IPrimeFreeTrialUsageFeatureId;
      usageId: string;
      quota?: IPrimeFreeTrialFeatureQuota;
      resetAt: number;
    };

// Business data of 90600
export type IPrimeFreeTrialQuotaExhaustedData = {
  featureId: IPrimeFreeTrialFeatureId;
  unit?: IPrimeFreeTrialUnit;
  monthlyQuota?: number;
  used?: number;
  remaining?: number;
  resetAt?: number;
};

export type IPrimeFreeTrialNotOpenReason =
  | 'trialNotOpen'
  | 'detailsNotEligible';

export type IPrimeFreeTrialNotOpenData = {
  featureId: IPrimeFreeTrialFeatureId;
  reason?: IPrimeFreeTrialNotOpenReason;
};

// Normalized free-trial error passed from the background to the UI, either in
// a return value (translate) or as `{ code, data }` of a thrown error.
export type IPrimeFreeTrialError =
  | {
      code: typeof PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE;
      data: IPrimeFreeTrialQuotaExhaustedData;
    }
  | {
      code: typeof PRIME_FREE_TRIAL_NOT_OPEN_CODE;
      data: IPrimeFreeTrialNotOpenData;
    };

export type IPrimeFreeTrialStartResult =
  | {
      // Subscription is active on the server; run without finish.
      status: 'unlimited';
    }
  | {
      status: 'granted';
      featureId: IPrimeFreeTrialUsageFeatureId;
      usageId: string;
      quota: IPrimeFreeTrialFeatureQuota;
      expiresAt: number;
      resetAt: number;
    }
  | {
      status: 'exhausted';
      featureId: IPrimeFreeTrialUsageFeatureId;
      data: IPrimeFreeTrialQuotaExhaustedData;
    }
  | {
      status: 'notOpen';
      featureId: IPrimeFreeTrialUsageFeatureId;
    }
  | {
      // No OneKey ID login in the background (e.g. the token was cleared
      // after the page was opened); the caller asks the user to log in.
      status: 'loginRequired';
      featureId: IPrimeFreeTrialUsageFeatureId;
    };

// Passed to batchSignAndSendTransaction so the background marks success at the
// broadcast point.
export type IPrimeFreeTrialBroadcastUsage = {
  featureId: IPrimeFreeTrialBroadcastFeatureId;
  usageId: string;
};

// Durable record of a usage whose result still has to be reported, keyed by
// OneKey ID + featureId + usageId. Holds metadata only.
export type IPrimeFreeTrialUsageRecord = {
  onekeyUserId: string;
  featureId: IPrimeFreeTrialUsageFeatureId;
  usageId: string;
  // Local time of the start request
  startedAt: number;
  // Server reservation expiry; undefined when the start result is unknown
  expiresAt?: number;
  result?: IPrimeFreeTrialUsageResult;
  resultAt?: number;
  // Set once the server accepted the result (or rejected the id with 90001).
  // The record is kept for a while so a later mark of the same usage stays a
  // no-op and retry / resubmit decisions survive a background restart.
  reportedAt?: number;
  reportAttempts: number;
  nextReportAt?: number;
};

export type IPrimeFreeTrialLoadStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error';

// Non-persistent display snapshot shared by the background and the UI.
export type IPrimeFreeTrialAtomData = {
  config: {
    status: IPrimeFreeTrialLoadStatus;
    data?: IPrimeFreeTrialPublicConfig;
    updatedAt?: number;
  };
  quota: {
    status: IPrimeFreeTrialLoadStatus;
    onekeyUserId?: string;
    // undefined: not loaded; null: Prime user or nothing is open
    data?: IPrimeFreeTrialQuota | null;
    updatedAt?: number;
  };
};

export enum EPrimeFreeTrialPendingActionType {
  BulkCopyAddresses = 'BulkCopyAddresses',
  AddressRiskCheck = 'AddressRiskCheck',
}

// Extension popup -> expand tab hand-off slot. Context only, no secrets.
export type IPrimeFreeTrialPendingAction = {
  type: EPrimeFreeTrialPendingActionType;
  walletId?: string;
  accountId?: string;
  indexedAccountId?: string;
  networkId?: string;
  createdAt: number;
  expiresAt: number;
};
