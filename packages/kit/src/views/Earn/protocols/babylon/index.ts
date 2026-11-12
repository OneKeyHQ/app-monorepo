import { EarnProtocol } from '../EarnProtocol';
import { withdrawProtocolPlans } from '../withdrawProtocol';

import type {
  IEarnStakePresentation,
  IEarnWithdrawParams,
  IEarnWithdrawPlan,
} from '../EarnProtocol';

export class BabylonEarnProtocol extends EarnProtocol {
  override getOrderTrackingPolicy(): 'babylon' | 'standard' {
    return 'babylon';
  }

  override getWithdrawOrderPresentation(): 'early-withdrawal' | 'standard' {
    return 'early-withdrawal';
  }
  protected override resolveProviderWithdraw({
    config,
    useEthenaCooldown,
  }: IEarnWithdrawParams): IEarnWithdrawPlan | undefined {
    if (
      config.withdrawSignOnly &&
      !config.unstakeWithSignMessage &&
      !useEthenaCooldown
    )
      return withdrawProtocolPlans.babylon;
    return undefined;
  }

  override getStakePresentation(): IEarnStakePresentation {
    return { ...super.getStakePresentation(), feeInput: 'utxo' };
  }

  override getWithdrawFeePolicy() {
    return { skipEstimate: false, includeTransactionIdentity: true };
  }
}
