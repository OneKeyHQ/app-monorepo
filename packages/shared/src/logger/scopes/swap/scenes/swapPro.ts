import type { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ESwapProAnalyticsEnterFrom,
  ESwapProAnalyticsTab,
  ESwapProAnalyticsTokenSelectFrom,
  ESwapProTradeType,
} from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class SwapProScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public enterSwapPro(params: {
    enterFrom: ESwapProAnalyticsEnterFrom;
    tokenSymbol: string;
    network: string;
  }) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapProTradeTypeChange(params: { tradeType: ESwapProTradeType }) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapProTimeRangeChange(params: { timeRange: ESwapProTimeRange }) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapProTabSwitch(params: { tab: ESwapProAnalyticsTab }) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapProCurrentSymbolToggle(params: {
    enabled: boolean;
    tab: ESwapProAnalyticsTab;
  }) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapProTokenSwitch(params: {
    selectFrom: ESwapProAnalyticsTokenSelectFrom;
    tokenSymbol: string;
    network: string;
  }) {
    return params;
  }
}
