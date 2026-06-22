import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PerpTokenSelectorScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorOpen(params: {
    currentToken: string;
    tradeMode: 'perp' | 'spot';
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorPrimaryTabClick(params: {
    tab: string;
    previousTab: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorCategoryTabClick(params: {
    tab: string;
    previousTab: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorSortClick(params: {
    activeTab: string;
    field: string;
    direction: string;
    previousField: string;
    previousDirection: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorTokenClick(params: {
    activeTab: string;
    token: string;
    tradeMode: 'perp' | 'spot';
    sortField: string;
    sortDirection: string;
  }) {
    return params;
  }

  // NOTE: eventName is methodName, keep stable for analytics
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorSearch(params: {
    query: string;
    resultCount: number;
    activeTab: string;
    sortField: string;
    sortDirection: string;
  }) {
    return params;
  }
}
