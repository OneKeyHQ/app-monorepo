import { EarnProtocol } from './EarnProtocol';

export class MorphoEarnProtocol extends EarnProtocol {
  override showsProtectionSection(): boolean {
    return true;
  }
  override usesClaimRewardTokenAddress(): boolean {
    return true;
  }
}
