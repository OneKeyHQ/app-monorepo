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
    balanceTextLength: number;
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
    factsAvailable: boolean;
    guardReason:
      | 'ready'
      | 'missingStoreFacts'
      | 'missingOwnerInput'
      | 'ownerMismatch';
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

  @LogToLocal({ level: 'info' })
  public homeStoreCacheDecision(params: {
    operation: 'load' | 'hydrate' | 'persist';
    outcome: 'accepted' | 'empty' | 'failed' | 'rejected';
    recordCount: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public homeRendererDecision(params: {
    renderer: 'native' | 'react';
    reason: 'capabilityUnavailable' | 'platformDefault';
    navigationKind: 'hidden' | 'ready';
    selectedTab: string;
    visibleTabs: string;
    showSearchHeader: boolean;
    showAccountSlot: boolean;
    showActionSlot: boolean;
    showBackupSlot: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public homeNativeContentDecision(params: {
    selectedTab: string;
    showTokenFilter: boolean;
    showPortfolioSettings: boolean;
    showHistoryFilter: boolean;
    showPerpsHeader: boolean;
    showDeFiHeader: boolean;
    showUpgrade: boolean;
    showSupport: boolean;
    portfolioItemCount: number;
    perpsItemCount: number;
    deFiItemCount: number;
    nftState: string;
    nftItemCount: number;
    historyItemCount: number;
    marketItemCount: number;
    earnItemCount: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public homeNativeTransportDecision(params: {
    resultKind: 'applied' | 'duplicate' | 'needSnapshot' | 'invalid';
    revision?: number;
    currentRevision?: number;
    reason?:
      | 'ownerMismatch'
      | 'revisionGap'
      | 'slotRevisionGap'
      | 'invalidInvariant'
      | 'unsupportedSchema'
      | 'unsupportedProtocol';
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public homePortfolioCommitDecision(params: {
    decision: 'accepted' | 'rejected';
    reason:
      | 'accepted'
      | 'missingResults'
      | 'missingOutcomeIdentity'
      | 'resultGenerationMismatch'
      | 'activeGenerationMismatch'
      | 'invalidFilterMode'
      | 'ownerMismatch'
      | 'staleOwnerAfterSnapshot';
    resultCount: number;
    snapshotTokenCount: number;
    outcomePresent: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public homeSourceFailure(params: {
    sourceId: 'history';
    stage: 'cacheRead' | 'firstPage' | 'loadMore';
    errorName: string;
  }) {
    return params;
  }
}
