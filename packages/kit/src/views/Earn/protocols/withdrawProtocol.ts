import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

import { ethenaWithdrawPlan } from './ethena/withdrawPlan';
import { lidoWithdrawPlan } from './lido/withdrawPlan';
import { stakefishWithdrawPlan } from './stakefish/withdrawPlan';

import type { IEarnWorkflowStepPlan } from '../tasks/earnWorkflowTaskState';

export type IEarnWithdrawTransaction = {
  encodedTx: IEncodedTx;
  stakeInfo?: IStakingInfo;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
};

export const withdrawProtocolPlans = {
  lido: lidoWithdrawPlan,
  stakefish: stakefishWithdrawPlan,
  ethena: ethenaWithdrawPlan,
  single: {
    kind: 'single',
    getSteps: (): readonly IEarnWorkflowStepPlan[] => [
      { id: 'withdraw', kind: 'protocol', lateSubmitted: 'confirming' },
    ],
  },
  babylon: { kind: 'babylon' },
  signOnly: { kind: 'signOnly' },
} as const;
