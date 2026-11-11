import type { IEarnWorkflowStepPlan } from '../../tasks/earnWorkflowTaskState';

export function getEthenaWithdrawSteps(
  resumeUnstake: boolean,
): readonly IEarnWorkflowStepPlan[] {
  return resumeUnstake
    ? [{ id: 'unstake', kind: 'protocol', lateSubmitted: 'unknown' }]
    : [
        { id: 'swap', kind: 'swap', lateSubmitted: 'unknown' },
        { id: 'settlement', kind: 'wait' },
        { id: 'unstake', kind: 'protocol', lateSubmitted: 'unknown' },
      ];
}

export const ethenaWithdrawPlan = {
  kind: 'ethena',
  getSteps: getEthenaWithdrawSteps,
} as const;
