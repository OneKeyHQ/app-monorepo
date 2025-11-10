import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

export interface IOnChainRewardProps {
  onChain: IInviteSummary['Onchain'];
}

export interface IUseOnChainRewardParams {
  onChain: IInviteSummary['Onchain'];
}

export interface IUseOnChainRewardReturn {
  earnToken:
    | {
        logoURI?: string;
        symbol?: string;
        name?: string;
      }
    | null
    | undefined;
  onChainSummary: string | undefined;
  onChainSummaryFiat: string | undefined;
  showRewards: boolean;
  toEarnRewardPage: () => void;
}
