import type { IPerpsTradingUiMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PerpTokenSelectorScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorOpen(params: {
    tradingUiMode: IPerpsTradingUiMode;
    currentToken: string;
    tradeMode: 'perp' | 'spot';
    walletType: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorPrimaryTabClick(params: {
    tradingUiMode: IPerpsTradingUiMode;
    tab: string;
    previousTab: string;
    walletType: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorCategoryTabClick(params: {
    tradingUiMode: IPerpsTradingUiMode;
    tab: string;
    previousTab: string;
    walletType: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorSortClick(params: {
    tradingUiMode: IPerpsTradingUiMode;
    activeTab: string;
    field: string;
    direction: string;
    previousField: string;
    previousDirection: string;
    walletType: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorTokenClick(params: {
    tradingUiMode: IPerpsTradingUiMode;
    activeTab: string;
    token: string;
    tradeMode: 'perp' | 'spot';
    sortField: string;
    sortDirection: string;
    walletType: string;
  }) {
    return params;
  }

  // NOTE: eventName is methodName, keep stable for analytics
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTokenSelectorSearch(params: {
    tradingUiMode: IPerpsTradingUiMode;
    query: string;
    resultCount: number;
    activeTab: string;
    sortField: string;
    sortDirection: string;
    walletType: string;
  }) {
    return params;
  }
}
