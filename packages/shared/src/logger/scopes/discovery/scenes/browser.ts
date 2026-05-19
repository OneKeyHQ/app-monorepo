import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

const BROWSER_TABS_LIFECYCLE_LOG_PREFIX = 'browser_tabs_lifecycle';

type IBrowserTabsLifecycleParams = {
  step:
    | 'languageChangeRestart'
    | 'browserProviderRootMounted'
    | 'browserProviderMirrorMounted'
    | 'withBrowserProviderMounted'
    | 'setBrowserDataReady'
    | 'buildWebTabsEntry'
    | 'buildWebTabsBlocked'
    | 'buildWebTabsPersist'
    | 'buildWebTabsPersistError'
    | 'rebuildBrowserDataStart'
    | 'rebuildBrowserDataReadSuccess'
    | 'rebuildBrowserDataReadError'
    | 'rebuildBrowserDataApply'
    | 'rebuildBrowserDataReady'
    | 'mobileTabListEmptyDetected'
    | 'simpleDbBrowserTabsGetRawDataStart'
    | 'simpleDbBrowserTabsGetRawDataSuccess'
    | 'simpleDbBrowserTabsGetRawDataError'
    | 'simpleDbBrowserTabsSetRawDataStart'
    | 'simpleDbBrowserTabsSetRawDataSuccess'
    | 'simpleDbBrowserTabsSetRawDataError'
    | 'simpleDbBrowserTabsClearRawDataStart'
    | 'simpleDbBrowserTabsClearRawDataSuccess'
    | 'simpleDbBrowserTabsClearRawDataError'
    | 'serviceClearBrowserTabsStart'
    | 'serviceClearBrowserTabsSuccess'
    | 'serviceClearBrowserTabsError'
    | 'handleOpenWebSiteEntry'
    | 'handleOpenWebSiteSwitchTab'
    | 'handleOpenWebSiteOpenDappStart'
    | 'handleOpenWebSiteOpenDappResult'
    | 'gotoSiteEntry'
    | 'gotoSiteInvalidUrl'
    | 'gotoSiteResolved'
    | 'gotoSiteWriteTab'
    | 'gotoSiteCrossWebviewLoad';
  source?: string;
  componentName?: string;
  storeName?: string;
  platform?: string;
  browserType?: string;
  restartMode?: string;
  previousLocale?: string;
  nextLocale?: string;
  tabsCount?: number;
  previousTabsCount?: number;
  pinnedTabsCount?: number;
  unpinnedTabsCount?: number;
  activeTabExists?: boolean;
  hasActiveTabId?: boolean;
  hasTabId?: boolean;
  hasUrl?: boolean;
  hasWebSite?: boolean;
  hasDApp?: boolean;
  useCurrentWindow?: boolean;
  needsSwitchTab?: boolean;
  currentTabName?: string;
  targetTabName?: string;
  isReady?: boolean;
  isInitFromStorage?: boolean;
  forceUpdate?: boolean;
  shouldUpdateAtom?: boolean;
  shouldPersist?: boolean;
  hasCache?: boolean;
  isDataNullish?: boolean;
  isBuilderPayload?: boolean;
  updatedAt?: number;
  isNewWindow?: boolean;
  isNewTab?: boolean;
  isInPlace?: boolean;
  isBookmark?: boolean;
  shouldBlockLocalhostUrl?: boolean;
  result?: 'success' | 'failure' | 'skipped' | 'error';
  reason?: string;
  errorName?: string;
};

export class BrowserScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public tabsData(tabs: IWebTab[]) {
    return JSON.stringify(tabs);
  }

  @LogToLocal({ level: 'info' })
  public setTabsDataFunctionName(fnName: string) {
    return fnName;
  }

  @LogToLocal({ level: 'info' })
  public logRejectUrl(url: string) {
    return url;
  }

  @LogToServer()
  @LogToLocal()
  public browserTabsLifecycle(params: IBrowserTabsLifecycleParams) {
    return {
      logPrefix: BROWSER_TABS_LIFECYCLE_LOG_PREFIX,
      ...params,
    };
  }

  @LogToServer()
  @LogToLocal()
  public addBookmark(params: { dappName: string; dappDomain: string }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public removeBookmark(params: { dappName: string; dappDomain: string }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public pinTab(params: {
    dappName: string;
    dappDomain: string;
    pinnedTabsAmount: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public unpinTab(params: {
    dappName: string;
    dappDomain: string;
    pinnedTabsAmount: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public clearTabs(params: { clearTabsAmount: number }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public closeTab(params: { closeMethod: 'Menu' | 'ShortCut' | 'BlockView' }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public exploreTabView(params: {
    tabName: 'market' | 'earn' | 'browser';
    switchType: 'default' | 'tap' | 'swipe';
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public tabDragSorting() {
    return {};
  }
}
