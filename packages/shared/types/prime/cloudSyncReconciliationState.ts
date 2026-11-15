export type ICloudSyncAccountIssue =
  | 'needsUpdate'
  | 'pending'
  | 'conflicts'
  | 'rejected';

export type ICloudSyncAccountIssueUpdate = {
  id: string;
  issue?: ICloudSyncAccountIssue;
};

export type ICloudSyncAccountStatusCounts = {
  needsUpdate: number;
  pending: number;
  conflicts: number;
  rejected: number;
  added: number;
  unchanged: number;
  deleted?: number;
};

// Counts only are projected to UI runtimes. Record IDs remain in background storage.
export type ICloudSyncReconciliationPersistState = {
  version: 1;
  spaceId: string;
  status: 'running' | 'waiting' | 'complete' | 'partial' | 'blocked';
  unfinished: boolean;
  reason?: string;
  nextRetryAt?: number;
  failures: number;
  requests: number;
  rounds: number;
  received: number;
  applied: number;
  uploaded: number;
  updatedAt: number;
};
