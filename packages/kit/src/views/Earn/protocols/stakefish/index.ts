import { EarnProtocol } from '../EarnProtocol';
import { withdrawProtocolPlans } from '../withdrawProtocol';

import type {
  IEarnStakePresentation,
  IEarnValidatorStake,
  IEarnValidatorStakeParams,
  IEarnWithdrawParams,
  IEarnWithdrawPlan,
} from '../EarnProtocol';

export class StakefishEarnProtocol extends EarnProtocol {
  protected override resolveProviderWithdraw({
    config,
    useEthenaCooldown,
  }: IEarnWithdrawParams): IEarnWithdrawPlan | undefined {
    if (
      !config.unstakeWithSignMessage &&
      !config.withdrawSignOnly &&
      !useEthenaCooldown
    )
      return withdrawProtocolPlans.stakefish;
    return undefined;
  }

  override getStakePresentation(): IEarnStakePresentation {
    return { ...super.getStakePresentation(), summary: 'validator' };
  }

  override requiresValidatorWithdrawSignature({
    symbol,
    withdrawAll,
    hasSignature,
  }: {
    symbol: string;
    withdrawAll: boolean;
    hasSignature: boolean;
  }): boolean {
    return symbol.toUpperCase() === 'ETH' && withdrawAll && !hasSignature;
  }

  override supportsSignedValidatorStake(): boolean {
    return true;
  }

  override resolveValidatorStake({
    symbol,
    selectedValidator,
    isCreateNewValidator,
  }: IEarnValidatorStakeParams): IEarnValidatorStake {
    if (
      symbol.toUpperCase() === 'ETH' &&
      selectedValidator &&
      isCreateNewValidator
    )
      return { mode: 'create' };
    if (selectedValidator !== undefined)
      return { mode: 'existing', identity: selectedValidator };
    return { mode: 'none' };
  }
}
