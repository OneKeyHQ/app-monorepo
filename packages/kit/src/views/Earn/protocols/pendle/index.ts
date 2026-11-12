import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { PendleRouterContract } from '@onekeyhq/shared/src/consts/addresses';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import { EarnProtocol } from '../EarnProtocol';

import type {
  IEarnApyHistoryPresentation,
  IEarnStakeAssetPolicy,
  IEarnStakePresentation,
  IEarnWithdrawUiPolicy,
} from '../EarnProtocol';

const apyHistoryPresentation: IEarnApyHistoryPresentation = {
  source: 'underlying',
  chart: 'fixed-income',
  rules: 'maturity-chart',
};

const stakeAssetPolicy: IEarnStakeAssetPolicy = {
  selection: 'market',
  approval: 'protocol',
  assetError: 'none',
  assetResolution: 'first-available',
};

const withdrawUiPolicy: IEarnWithdrawUiPolicy = {
  receiveAssetSelection: 'enabled',
  allowNonQueuedApproval: true,
  requireCurrentQuoteAfterApproval: true,
  enableQuoteRefresh: true,
  confirmPriceImpact: true,
  action: 'swap',
  transactionLayout: 'market',
};

export class PendleEarnProtocol extends EarnProtocol {
  override resolveApproveSpenderAddress(): string {
    return PendleRouterContract;
  }

  override resolveApproveType(
    params: Parameters<EarnProtocol['resolveApproveType']>[0],
  ): EApproveType | undefined {
    return super.resolveApproveType({
      ...params,
      backendApproveType: EApproveType.Legacy,
    });
  }

  override getApyHistoryPresentation(): IEarnApyHistoryPresentation {
    return apyHistoryPresentation;
  }
  override getDetailRedeemPolicy(): 'holding' | 'action' {
    return 'holding';
  }
  override canDepositAtMaturity({ matured }: { matured: boolean }): boolean {
    return !matured;
  }
  override getDefaultEarnCategory(): 'fixedRate' | undefined {
    return 'fixedRate';
  }
  override getManageSlippagePolicy(): 'configurable' | 'none' {
    return 'configurable';
  }
  override getStakeAssetPolicy(): IEarnStakeAssetPolicy {
    return stakeAssetPolicy;
  }
  override requiresCurrentStakeQuote(): boolean {
    return true;
  }

  override getStakePresentation(): IEarnStakePresentation {
    return {
      ...super.getStakePresentation(),
      action: 'swap',
      quoteRefresh: 'periodic',
      priceImpact: 'confirm',
      transactionLayout: 'market',
    };
  }

  override getWithdrawUiPolicy(): IEarnWithdrawUiPolicy {
    return withdrawUiPolicy;
  }

  override shouldUseEthenaCooldown({
    networkId,
    pathCount,
    selectedPathIndex,
  }: {
    networkId: string | undefined;
    pathCount: number;
    selectedPathIndex: number;
  }): boolean {
    return (
      networkId === getNetworkIdsMap().eth &&
      pathCount > 1 &&
      selectedPathIndex === 0
    );
  }

  override getPortfolioPresentation(): {
    rewardsHeading: 'ethena' | 'standard';
    earnings: 'market' | 'standard';
    showPositionValue: boolean;
  } {
    return {
      rewardsHeading: 'ethena',
      earnings: 'market',
      showPositionValue: true,
    };
  }

  override resolveAirdropClaimIdentity({
    assetSymbol,
    assetVault,
  }: {
    assetSymbol: string;
    assetVault?: string;
  }): { symbol: string; vault?: string } {
    return { symbol: assetSymbol, vault: assetVault };
  }

  override hasPositionDetail({
    symbol,
    actionCount,
  }: {
    symbol: string;
    actionCount: number;
  }): boolean {
    return !(symbol === 'USDe' && actionCount === 0);
  }

  override canRedeemPosition(_params: { symbol: string }): boolean {
    return true;
  }

  override shouldSellBeforeMaturity({
    matured,
  }: {
    matured: boolean;
  }): boolean {
    return !matured;
  }
}
