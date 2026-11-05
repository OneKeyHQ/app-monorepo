import type { IEarnWorkflowStepPlan } from '../tasks/earnWorkflowTaskState';

export function getLidoWithdrawSteps(): readonly IEarnWorkflowStepPlan[] {
  return [
    { id: 'permit', kind: 'sign' },
    { id: 'unstake', kind: 'protocol', lateSubmitted: 'unknown' },
  ];
}

export const lidoWithdrawPlan = {
  kind: 'lido',
  getSteps: getLidoWithdrawSteps,
} as const;
