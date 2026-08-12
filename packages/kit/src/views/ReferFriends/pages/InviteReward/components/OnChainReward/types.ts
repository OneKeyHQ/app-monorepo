import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export interface IOnChainRewardProps {
  onChain: IInviteSummary['Onchain'];
}

export interface IUseOnChainRewardParams {
  onChain: IInviteSummary['Onchain'];
}

export interface IRewardTokenMeta {
  logoURI?: string;
  symbol?: string;
  name?: string;
}

export interface IUseOnChainRewardReturn {
  earnToken: IRewardTokenMeta | null | undefined;
  onChainSummary: string | undefined;
  onChainSummaryFiat: string | undefined;
  hasEarnRewards: boolean;
}
