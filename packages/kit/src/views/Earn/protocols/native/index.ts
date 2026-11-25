import {
  EClaimType,
  type IEarnClaimType,
  type IEarnStakeType,
} from '@onekeyhq/shared/types/staking';

import { EarnProtocol, resolveEthStakeType } from '../EarnProtocol';

import type {
  IEarnConfirmationRetryParams,
  IEarnConfirmationRetryPolicy,
  IEarnStakeAssetPolicy,
  IEarnStakeRequestSymbolParams,
  IEarnStakeTypeParams,
} from '../EarnProtocol';

const stakeAssetPolicy: IEarnStakeAssetPolicy = {
  selection: 'wrapped',
  approval: 'protocol',
  assetError: 'selected-wrap',
  assetResolution: 'first-available',
};

export class NativeEarnProtocol extends EarnProtocol {
  override getStakeAssetPolicy(): IEarnStakeAssetPolicy {
    return stakeAssetPolicy;
  }

  override supportsCanonicalWrappedStakeToken(): boolean {
    return true;
  }

  override resolveStakeRequestSymbol({
    protocolSymbol,
    tokenSymbol,
    tokenIsNative,
    wrappedTokenSymbol,
  }: IEarnStakeRequestSymbolParams): string {
    const fallbackSymbol =
      protocolSymbol?.toUpperCase() === 'ETH' ? 'WETH' : protocolSymbol || '';
    return tokenIsNative
      ? wrappedTokenSymbol || fallbackSymbol
      : tokenSymbol || fallbackSymbol;
  }
  override resolveDefaultClaimRequestType({
    claimType,
  }: {
    claimType: EClaimType;
  }): IEarnClaimType | undefined {
    return claimType === EClaimType.Claim
      ? 'normal'
      : super.resolveDefaultClaimRequestType({ claimType });
  }

  override resolveStakeType({
    vaultSymbol,
    tokenIsNative,
  }: IEarnStakeTypeParams): IEarnStakeType | undefined {
    return resolveEthStakeType(vaultSymbol, tokenIsNative);
  }

  override usesLegacyWrapProgress(): boolean {
    return false;
  }

  override getConfirmationRetryPolicy(
    params: IEarnConfirmationRetryParams,
  ): IEarnConfirmationRetryPolicy {
    return {
      ...super.getConfirmationRetryPolicy(params),
      allowManualResubmission:
        params.task === 'wrapped' ||
        (params.task === 'direct' &&
          params.allowanceVerificationMode === 'legacy'),
    };
  }
}
