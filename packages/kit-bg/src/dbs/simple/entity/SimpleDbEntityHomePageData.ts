import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// ---- V2: Flat data shapes matching Jotai store structures ----

export interface IHomeHeaderData {
  totalBalance: string;
  tokenWorth: string;
  defiNetWorth: string;
  tokenWorthMap: Record<string, string>;
  createAtNetworkWorth: string;
  accountId: string;
  initialized: boolean;
  isRefreshing: boolean;
}

export interface IHomeTokenListData {
  tokens: IAccountToken[];
  smallBalanceTokens: IAccountToken[];
  riskyTokens: IAccountToken[];
  tokenFiatMap: Record<string, ITokenFiat>;
  smallBalanceFiatValue: string;
  aggregateTokensMap: Record<string, Record<string, ITokenFiat>>;
  aggregateTokensListMap: Record<string, { tokens: IAccountToken[] }>;
  allTokens: IAccountToken[];
  initialized: boolean;
  isRefreshing: boolean;
}

export interface IHomePageCacheItemV2 {
  version: 2;
  header: IHomeHeaderData;
  tokenList: IHomeTokenListData;
  updatedAt: number;
}

export interface ISimpleDBHomePageData {
  [key: string]: IHomePageCacheItemV2;
}

export class SimpleDbEntityHomePageData extends SimpleDbEntityBase<ISimpleDBHomePageData> {
  entityName = 'homePageData';

  override enableCache = true;

  @backgroundMethod()
  async getCacheV2({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<IHomePageCacheItemV2 | undefined> {
    const key = `${accountId}_${networkId}`;
    const rawData = await this.getRawData();
    const item = rawData?.[key];
    if (!item) return undefined;
    // Skip legacy entries that don't have version: 2
    if (!('version' in item) || item.version !== 2) {
      return undefined;
    }
    return item;
  }

  @backgroundMethod()
  async setCacheV2({
    accountId,
    networkId,
    data,
  }: {
    accountId: string;
    networkId: string;
    data: IHomePageCacheItemV2;
  }) {
    const key = `${accountId}_${networkId}`;
    await this.setRawData((rawData) => ({
      ...rawData,
      [key]: data,
    }));
  }
}
