import type { IWebTab } from '@onekeyhq/kit/src/views/Discovery/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

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
  public tabDragSorting() {
    return {};
  }
}
