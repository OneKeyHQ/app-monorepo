import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

type IHomeUiNetworkScope = 'allNetworks' | 'singleNetwork' | 'unknown';

type IHomeUiResourceKind =
  | 'missing'
  | 'idle'
  | 'loading'
  | 'partial'
  | 'ready'
  | 'empty'
  | 'complete'
  | 'error';

export class HomeUiScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public homeHeaderDecision(params: {
    networkScope: IHomeUiNetworkScope;
    balancePresentationKind: 'loading' | 'ready';
    balanceState: 'unknown' | 'zero' | 'positive';
    bannerResourceKind: IHomeUiResourceKind;
    bannerPayloadParsed: boolean;
    bannerCount: number;
    hasTronResource: boolean;
    hasWalletBannerContent: boolean;
    showPositiveBanner: boolean;
    shouldShowBanner: boolean;
    walletActionFamily: 'loading' | 'zero' | 'funded';
    shouldShowWalletActions: boolean;
    isWalletNotBackedUp: boolean;
    nativeMinHeight?: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public homeBalanceDecision(params: {
    networkScope: IHomeUiNetworkScope;
    balancePresentationKind: 'missing' | 'loading' | 'ready';
    balanceState: 'missing' | 'unknown' | 'zero' | 'positive';
    hasSemanticDisplayAmount: boolean;
    showSkeleton: boolean;
    isRefreshing: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public homeBalanceInputs(params: {
    networkScope: IHomeUiNetworkScope;
    requiredContributors: string;
    portfolioResourceKind: IHomeUiResourceKind;
    deFiResourceKind: IHomeUiResourceKind;
    perpsResourceKind: IHomeUiResourceKind;
    bannerAvailable: boolean;
    capabilityReady: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public homeTabDecision(params: {
    networkScope: IHomeUiNetworkScope;
    navigationKind: 'hidden' | 'ready';
    visibleTabs: string;
    selectedTab: string;
    showPortfolio: boolean;
    showPerps: boolean;
    showDeFi: boolean;
    showNFT: boolean;
    showHistory: boolean;
    perpsDestination: 'inline' | 'web' | 'unavailable';
  }) {
    return params;
  }
}
