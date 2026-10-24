import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IBrowserToolbarAction =
  | 'back'
  | 'forward'
  | 'refresh'
  | 'tabs'
  | 'menu'
  | 'address'
  | 'siteInfo'
  | 'expand'
  | 'minimize'
  | 'account'
  | 'createWallet'
  | 'translate'
  | 'share'
  | 'copyUrl'
  | 'openInBrowser'
  | 'siteMode'
  | 'switchNetwork'
  | 'bookmark'
  | 'pin'
  | 'disconnect'
  | 'closeTab';

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

  // Mobile browser chrome usage (bottom bar, its menu, header), to see which
  // controls earn a top-level slot. Menu actions that also have their own
  // event (bookmark, pin, close tab, disconnect) are logged here too, to
  // attribute them to the menu.
  @LogToServer()
  @LogToLocal()
  public browserToolbarAction(params: {
    action: IBrowserToolbarAction;
    entry: 'toolbar' | 'menu' | 'header';
  }) {
    return params;
  }
}
