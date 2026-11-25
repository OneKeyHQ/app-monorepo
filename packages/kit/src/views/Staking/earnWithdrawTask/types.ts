import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IStakingFlowConfig } from '@onekeyhq/shared/types/earn';

import { getEarnProtocol } from '../../Earn/protocols';

import type {
  IUniversalWithdrawContext,
  IUniversalWithdrawPrepared,
} from '../../Earn/protocols/withdrawProtocolRuntime';
import type {
  IEarnWithdrawApprovalIdentity,
  IEarnWithdrawWorkflowHandoff,
} from '../../Earn/tasks/earnWithdrawApprovalTask';
import type { IEarnWorkflowStepPlan } from '../../Earn/tasks/earnWorkflowTaskState';

export type IUniversalWithdrawWorkflowHandoff = IEarnWithdrawWorkflowHandoff<
  IUniversalWithdrawPrepared,
  IUniversalWithdrawContext
>;

export type IUniversalWithdrawWorkflowIdentity = IEarnWithdrawApprovalIdentity;

export function getUniversalWithdrawProtocolPlan({
  provider,
  config,
  useEthenaCooldown,
  resumeEthenaCooldownUnstake,
}: {
  provider: string;
  config: IStakingFlowConfig;
  useEthenaCooldown?: boolean;
  resumeEthenaCooldownUnstake?: boolean;
}): {
  steps: readonly IEarnWorkflowStepPlan[];
  initialContext: IUniversalWithdrawContext;
} {
  if (config.withdrawSignOnly) {
    throw new OneKeyLocalError('Unsupported withdrawal approval workflow');
  }
  const protocol = getEarnProtocol(provider).resolveWithdraw({
    config,
    useEthenaCooldown,
  });
  if (protocol.kind === 'babylon' || protocol.kind === 'signOnly') {
    throw new OneKeyLocalError('Unsupported withdrawal approval workflow');
  }
  const steps =
    protocol.kind === 'ethena'
      ? protocol.getSteps(resumeEthenaCooldownUnstake ?? false)
      : protocol.getSteps();
  return { steps, initialContext: {} };
}
