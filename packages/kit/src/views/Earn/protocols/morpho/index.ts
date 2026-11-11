import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  MorphoBaseBundlerContract,
  MorphoBundlerContract,
  MorphoKatanaBundlerContract,
} from '@onekeyhq/shared/src/consts/addresses';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import { EarnProtocol } from '../EarnProtocol';

export class MorphoEarnProtocol extends EarnProtocol {
  override resolvePermitSpenderAddress({
    networkId,
  }: {
    networkId: string;
  }): string | undefined {
    if (networkId === getNetworkIdsMap().eth) return MorphoBundlerContract;
    if (networkId === getNetworkIdsMap().base) return MorphoBaseBundlerContract;
    if (networkId === getNetworkIdsMap().katana) {
      return MorphoKatanaBundlerContract;
    }
    return undefined;
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
    if (!approveSpenderAddress) return '';
    return approveType === EApproveType.Permit
      ? (this.resolvePermitSpenderAddress({ networkId }) ?? '')
      : approveSpenderAddress;
  }

  override showsProtectionSection(): boolean {
    return true;
  }
  override usesClaimRewardTokenAddress(): boolean {
    return true;
  }
}
