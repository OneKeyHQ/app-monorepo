import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCheckServerStatusResult,
} from './primeCloudSyncTypes';

export type ICloudSyncReconciliationRequest = {
  version: 1;
  // Combined diff, updated, deleted and obsoleted entries, not per array.
  maxItems: number;
  // The complete serialized check-result payload, including this contract.
  maxBytes: number;
};

export type ICloudSyncReconciliationContract =
  ICloudSyncReconciliationRequest & {
    diffBeforeLimit: true;
    includesDeleted: true;
    hasMore: boolean;
  };

export type ICloudSyncReconciliationSummary =
  ICloudSyncCheckServerStatusPostData['localData'];

export type ICloudSyncReconciliationLimits = {
  // Adapter.check calls. Any adapter-owned legacy transport fallback must
  // have a separate finite limit and be included in the owner's counters.
  maxRequests: number;
  maxDurationMs: number;
  requestTimeoutMs: number;
  maxItems: number;
  maxResponseBytes: number;
  maxSummaryBytes: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  continuationDelayMs: number;
  blockedRetryDelayMs: number;
};

export type ICloudSyncReconciliationResult = {
  status:
    | 'complete'
    | 'waiting'
    | 'backend-unverified'
    | 'blocked'
    | 'cancelled';
  reason:
    | 'finished'
    | 'request-budget'
    | 'time-budget'
    | 'backend-unverified'
    | 'response-budget'
    | 'invalid-response'
    | 'summary-budget'
    | 'invalid-summary'
    | 'no-progress'
    | 'repeated-response'
    | 'retry-exhausted'
    | 'cancelled'
    | 'source-changed';
  unfinished: boolean;
  progress: boolean;
  requests: number;
  rounds: number;
  received: number;
  applied: number;
  uploaded: number;
  failures: number;
  lastSummaryBytes: number;
  nextRetryAt?: number;
};

export type ICloudSyncReconciliationAdapter = {
  getFullSummary(options: {
    signal: AbortSignal;
  }): Promise<ICloudSyncReconciliationSummary>;
  // Both signal and timeoutMs must reach the HTTP transport (e.g. Axios).
  check(options: {
    localData: ICloudSyncReconciliationSummary;
    reconciliation: ICloudSyncReconciliationRequest;
    signal: AbortSignal;
    timeoutMs: number;
  }): Promise<ICloudSyncCheckServerStatusResult>;
  // Transactions must check signal/isCurrent before committing. Returning a
  // receipt means actual accepted work, not the size of an attempted batch.
  apply(options: {
    response: ICloudSyncCheckServerStatusResult;
    signal: AbortSignal;
  }): Promise<{ applied: number } | void>;
  uploadObsoleted(options: {
    keys: string[];
    response: ICloudSyncCheckServerStatusResult;
    signal: AbortSignal;
  }): Promise<{ uploaded: number } | void>;
  isCurrent(): boolean;
  // A recognized declaration enables bounded draining; it does not prove
  // that a deployed backend has passed its independent acceptance tests.
  isBoundedCheckVerified(contract: ICloudSyncReconciliationContract): boolean;
  now(): number;
  pause(options: { delayMs: number; signal: AbortSignal }): Promise<void>;
};
