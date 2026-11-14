import type { IProtocolInfo } from '@onekeyhq/shared/types/staking';

import { EarnProtocol } from '../EarnProtocol';

import type { IEarnDetailsPortfolioPresentation } from '../EarnProtocol';

const detailsPortfolioPresentation: IEarnDetailsPortfolioPresentation = {
  activePositions: 'split-falcon',
  pendingActivationTooltip: 'standard',
  claimableTooltip: 'standard',
  claimableLabel: 'standard',
};

export class FalconEarnProtocol extends EarnProtocol {
  override getDetailsPortfolioPresentation(_params: {
    symbol: string;
  }): IEarnDetailsPortfolioPresentation {
    return detailsPortfolioPresentation;
  }

  override resolveProfitApy({
    aprWithoutFee,
  }: {
    aprWithoutFee?: string;
    dailyNetApy?: string;
  }): string | undefined {
    return aprWithoutFee;
  }

  override getRewardTokenTooltip({
    isEventActive,
  }: {
    isEventActive: boolean;
  }): 'fixed-yield' | 'none' {
    return isEventActive ? 'fixed-yield' : 'none';
  }

  override getApyBreakdown(): 'vault' | 'falcon' | 'none' {
    return super.getApyBreakdown() === 'vault' ? 'vault' : 'falcon';
  }

  override getDetailsPeriodSection(): 'falcon-campaign' | 'none' {
    return 'falcon-campaign';
  }
  override getDetailsRiskSection(): 'usdf' | 'none' {
    return 'usdf';
  }
  override requiresStakeRegistration({
    isRegistered,
  }: {
    isRegistered?: boolean;
  }): boolean {
    return !isRegistered;
  }
  override getDepositEventNotice({
    isEventActive,
    dismissed,
  }: {
    isEventActive: boolean;
    dismissed: boolean | undefined;
  }): 'falcon-apy-change' | 'none' {
    return !isEventActive && !dismissed ? 'falcon-apy-change' : 'none';
  }

  override getBaseRewardEstimate({
    apys,
    isEventActive,
  }: {
    apys: IProtocolInfo['apys'];
    isEventActive: boolean;
  }): { rate: string | number; periodDivisor: number; showAirdrop: boolean } {
    return {
      rate: apys?.weeklyNetApyWithoutFee ?? 0,
      periodDivisor: 365,
      showAirdrop: isEventActive,
    };
  }
}
