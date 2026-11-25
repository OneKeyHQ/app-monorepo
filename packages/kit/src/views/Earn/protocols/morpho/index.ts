import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { EApproveType } from '@onekeyhq/shared/types/staking';

import { EarnProtocol } from '../EarnProtocol';

export class MorphoEarnProtocol extends EarnProtocol {
  override resolvePermitSpenderAddress({
    networkId,
  }: {
    networkId: string;
  }): string | undefined {
    return earnUtils.resolveEarnPermitSpenderAddress({
      providerName: this.providerName,
      networkId,
    });
  }

  override resolveAllowanceSpenderAddress({
    networkId,
    approveType,
    approveSpenderAddress,
  }: {
    networkId: string;
    approveType?: EApproveType;
    approveSpenderAddress?: string;
  }): string {
    return earnUtils.resolveEarnAllowanceSpenderAddress({
      providerName: this.providerName,
      networkId,
      approveType,
      approveSpenderAddress,
    });
  }

  override showsProtectionSection(): boolean {
    return true;
  }
  override usesClaimRewardTokenAddress(): boolean {
    return true;
  }
}
