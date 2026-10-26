import BigNumber from 'bignumber.js';

export type IPerpsRecallProgress = {
  activityId: string;
  activityStatus: 'running' | 'ended';
  status: 'running' | 'achieved';
  volume: string;
  totalReward: string;
  earnedReward: string;
  topTarget: string;
  current: {
    index: number;
    target: string;
    remaining: string;
    reward: string;
  } | null;
  deadline: string;
  payoutStatus: 'pending' | 'paid' | 'skipped';
  paidAmount: string | null;
  paidAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAmount(value: unknown, positive = false): value is string {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) {
    return false;
  }
  const amount = new BigNumber(value);
  return amount.isFinite() && (positive ? amount.gt(0) : amount.gte(0));
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

// This optional promotion must never render broken amounts or an incomplete
// target when an empty/degraded response reaches the client.
export function isPerpsRecallProgress(
  value: unknown,
): value is IPerpsRecallProgress {
  if (!isRecord(value)) return false;
  const current = value.current;
  return (
    typeof value.activityId === 'string' &&
    value.activityId.length > 0 &&
    (value.activityStatus === 'running' || value.activityStatus === 'ended') &&
    (value.status === 'running' || value.status === 'achieved') &&
    isAmount(value.volume) &&
    isAmount(value.totalReward) &&
    isAmount(value.earnedReward) &&
    isAmount(value.topTarget, true) &&
    isDate(value.deadline) &&
    (value.payoutStatus === 'pending' ||
      value.payoutStatus === 'paid' ||
      value.payoutStatus === 'skipped') &&
    (value.paidAmount === null || isAmount(value.paidAmount)) &&
    (value.paidAt === null || isDate(value.paidAt)) &&
    (value.status === 'achieved'
      ? current === null
      : isRecord(current) &&
        typeof current.index === 'number' &&
        Number.isInteger(current.index) &&
        current.index >= 0 &&
        isAmount(current.target, true) &&
        isAmount(current.remaining) &&
        isAmount(current.reward))
  );
}
