import type { IEarnWorkflowStepPlan } from '../../tasks/earnWorkflowTaskState';

export const stakefishWithdrawSteps: readonly IEarnWorkflowStepPlan[] = [
  { id: 'signWithdrawal', kind: 'sign' },
  { id: 'build', kind: 'external' },
  { id: 'withdraw', kind: 'protocol', lateSubmitted: 'unknown' },
];

export const stakefishWithdrawPlan = {
  kind: 'stakefish',
  getSteps: () => stakefishWithdrawSteps,
} as const;
