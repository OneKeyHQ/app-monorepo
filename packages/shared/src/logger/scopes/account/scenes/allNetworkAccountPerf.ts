import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

type IHomeTokenListRefreshTraceParams = {
  runtime: 'main' | 'bg';
  phase: string;
  networkId?: string;
  isAllNetworks?: boolean;
  allNetworkDataInit?: boolean;
  isMustRun?: boolean;
  hasCache?: boolean;
  cacheCount?: number;
  accountsCount?: number;
  backendIndexedCount?: number;
  backendNotIndexedCount?: number;
  allAccountsCount?: number;
  resultCount?: number;
  tokenCount?: number;
  smallBalanceCount?: number;
  riskyCount?: number;
  aggregateCount?: number;
  initialized?: boolean;
  isRefreshing?: boolean;
  ownerPresent?: boolean;
  indexedAccountPresent?: boolean;
  source?: string;
  reason?: string;
};

export class AllNetworkAccountPerf extends BaseScene {
  @LogToConsole()
  @LogToLocal()
  public getAllNetworkAccountsStart() {
    this.resetTimestamp();
    return ['>>>>>>>>>>>>', true];
  }

  @LogToConsole()
  @LogToLocal()
  public getAllNetworkAccountsEnd() {
    return ['<<<<<<<<<<<<', true];
  }

  @LogToLocal()
  public homeTokenListRefreshTrace(params: IHomeTokenListRefreshTraceParams) {
    return params;
  }
}
