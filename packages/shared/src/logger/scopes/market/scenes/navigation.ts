import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

// Local-only diagnostics for the Home market "View more" -> Market tab
// navigation chain, from the button press to the Discovery/Market landing.
// Never add @LogToServer() here.

export type IMarketNavigationTrigger =
  | 'immediate'
  | 'alreadyApplied'
  | 'selectionApplied'
  | 'timeout';

export type IMarketCategoryToSelectResult =
  | 'applied'
  | 'waitingForConfig'
  | 'unknownCategory';

interface IMarketNavigationTargetLog {
  tab?: string;
  spotCategory?: string;
  perpsCategory?: string;
}

interface IMarketNavigationSelectionLog {
  tab?: string;
  selectedSpotCategory?: string;
  spotCategoryToSelect?: string;
  selectedPerpsCategory?: string;
  perpsCategoryToSelect?: string;
}

export class MarketNavigationScene extends BaseScene {
  // `selectedMarketCategoryId` is undefined when the Favorites tab is selected.
  @LogToLocal({ level: 'info' })
  public homeViewMore(params: { selectedMarketCategoryId?: string }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public navigateToMarketTab(params: {
    navigationId: number;
    target: IMarketNavigationTargetLog;
    selection: IMarketNavigationSelectionLog;
    waitForSelection: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'warn' })
  public pendingNavigationCancelled(params: {
    navigationId: number;
    reason: 'superseded' | 'unmount';
    elapsedMs: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public performNavigationStart(params: {
    navigationId: number;
    trigger: IMarketNavigationTrigger;
    platform: 'extension' | 'native' | 'web';
    routeName?: string;
    elapsedMs: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public performNavigationDispatched(params: {
    navigationId: number;
    hasRootNavigationRef: boolean;
    routeName?: string;
    elapsedMs: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public performNavigationComplete(params: {
    navigationId: number;
    routeName?: string;
    elapsedMs: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public performNavigationFailed(params: {
    navigationId: number;
    error: string;
    elapsedMs: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public discoveryDefaultTabParam(params: {
    defaultTab?: string;
    previousDefaultTab?: string;
  }) {
    return params;
  }

  // Logs every Discovery header tab switch so other flows racing the Market
  // switch show up next to it.
  @LogToLocal({ level: 'info' })
  public discoveryTabSwitchReceived(params: {
    tab: string;
    switchType?: string;
    displayHomePage: boolean;
    openUrl?: boolean;
    showWebPage?: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public discoveryTabSwitchApplied(params: { tab: string; elapsedMs: number }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public marketHomeApplySpotCategory(params: {
    categoryId: string;
    result: IMarketCategoryToSelectResult;
    categoryCount: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'warn' })
  public marketHomeResetSpotCategory(params: {
    categoryId: string;
    nextCategoryId: string;
    categoryCount: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public marketHomeApplyPerpsCategory(params: {
    categoryId: string;
    result: IMarketCategoryToSelectResult;
    categoryCount: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public marketHomePagerSync(params: {
    selectedTabName: string;
    activeTabName: string;
    result: 'jumped' | 'tabNotFound';
    tabCount: number;
  }) {
    return params;
  }
}
