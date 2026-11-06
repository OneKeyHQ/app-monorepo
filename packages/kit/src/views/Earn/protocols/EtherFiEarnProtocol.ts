import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IEarnStakeType } from '@onekeyhq/shared/types/staking';

import { EarnProtocol, resolveEthStakeType } from './EarnProtocol';

import type {
  IEarnConfirmationRetryParams,
  IEarnConfirmationRetryPolicy,
  IEarnStakeAssetPolicy,
  IEarnStakeAssetRequestPolicy,
  IEarnStakeRequestSymbolParams,
  IEarnStakeTypeParams,
  IEarnWithdrawUiPolicy,
} from './EarnProtocol';

const stakeAssetPolicy: IEarnStakeAssetPolicy = {
  selection: 'wrapped',
  approval: 'selected-asset',
  assetError: 'always',
  assetResolution: 'initial-token',
};

const stakeAssetRequestPolicy: IEarnStakeAssetRequestPolicy = {
  onFailure: 'fail-closed',
  supplementCanonicalWeth: true,
};

const withdrawUiPolicy: IEarnWithdrawUiPolicy = {
  allowNonQueuedApproval: false,
  requireCurrentQuoteAfterApproval: false,
  enableQuoteRefresh: false,
  confirmPriceImpact: false,
  action: 'withdraw',
  transactionLayout: 'standard',
  receiveAssetSelection: 'enabled',
};

export class EtherFiEarnProtocol extends EarnProtocol {
  override getLegacyApprovalGuardPolicy(): 'etherfi' | 'none' {
    return 'etherfi';
  }
  override getWithdrawApprovalSource(): 'detail' | 'manage-page' {
    return 'detail';
  }
  override resolveFaqSymbol({
    routeSymbol,
  }: {
    routeSymbol: string;
    tokenSymbol: string;
  }): string {
    return routeSymbol;
  }
  override getStakeAssetPolicy(): IEarnStakeAssetPolicy {
    return stakeAssetPolicy;
  }

  override getStakeAssetRequestPolicy(): IEarnStakeAssetRequestPolicy {
    return stakeAssetRequestPolicy;
  }

  override supportsCanonicalWrappedStakeToken(): boolean {
    return true;
  }

  override resolveStakeRequestSymbol({
    protocolSymbol,
    tokenSymbol,
  }: IEarnStakeRequestSymbolParams): string {
    return tokenSymbol || protocolSymbol || '';
  }

  override getWithdrawAmountUnit(): 'shares' | 'asset' {
    return 'shares';
  }

  override getWithdrawUiPolicy(): IEarnWithdrawUiPolicy {
    return withdrawUiPolicy;
  }
  override resolveStakeType({
    tokenSymbol,
    tokenIsNative,
  }: IEarnStakeTypeParams): IEarnStakeType | undefined {
    return resolveEthStakeType(tokenSymbol, tokenIsNative);
  }

  override getConfirmationRetryPolicy(
    params: IEarnConfirmationRetryParams,
  ): IEarnConfirmationRetryPolicy {
    return {
      ...super.getConfirmationRetryPolicy(params),
      allowDeviceRejectionRetry: params.networkId === getNetworkIdsMap().eth,
    };
  }

  override resolvePortfolioRequestIdentity({
    symbol,
    vault,
  }: {
    provider: string;
    symbol: string;
    vault?: string;
  }): { provider: string; symbol: string } {
    return { provider: 'etherfi', symbol: vault ? '' : symbol };
  }

  override resolvePortfolioSymbols({
    requestSymbol,
    responseSymbol,
  }: {
    requestSymbol: string;
    responseSymbol?: string;
  }): { positionSymbol: string; assetSymbol: string } {
    const symbol = responseSymbol || requestSymbol;
    return { positionSymbol: symbol, assetSymbol: symbol };
  }

  override shouldPreserveUnsettledPortfolioValue(value: string): boolean {
    const amount = new BigNumber(value || '0');
    return !amount.isFinite() || amount.lte(0);
  }

  override removeConfirmedMissingPortfolioVault(): boolean {
    return true;
  }

  override resolvePortfolioActionSymbol({
    protocolSymbol,
  }: {
    assetSymbol: string;
    protocolSymbol?: string;
  }): string | undefined {
    return protocolSymbol?.trim() ? protocolSymbol : undefined;
  }

  override getCancelWithdrawalRoute(): 'withdraw-options' | 'direct' {
    return 'withdraw-options';
  }
}
