import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IHomePageCacheItem {
  accountWorth: {
    worth: Record<string, string>;
    createAtNetworkWorth: string;
    accountId: string;
  };
  tokenList: { tokens: IAccountToken[]; keys: string };
  tokenListMap: Record<string, ITokenFiat>;
  smallBalanceTokens: {
    smallBalanceTokens: IAccountToken[];
    keys: string;
  };
  smallBalanceTokenListMap: Record<string, ITokenFiat>;
  smallBalanceTokensFiatValue: string;
  riskyTokens: { riskyTokens: IAccountToken[]; keys: string };
  riskyTokenListMap: Record<string, ITokenFiat>;
  allTokenList: { tokens: IAccountToken[]; keys: string };
  allTokenListMap: Record<string, ITokenFiat>;
  aggregateTokensMap: Record<string, Record<string, ITokenFiat>>;
  aggregateTokensListMap: Record<string, { tokens: IAccountToken[] }>;
  updatedAt: number;
}

export interface ISimpleDBHomePageData {
  [key: string]: IHomePageCacheItem;
}

export class SimpleDbEntityHomePageData extends SimpleDbEntityBase<ISimpleDBHomePageData> {
  entityName = 'homePageData';

  override enableCache = true;

  @backgroundMethod()
  async getCache({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<IHomePageCacheItem | undefined> {
    const key = `${accountId}_${networkId}`;
    const rawData = await this.getRawData();
    return rawData?.[key];
  }

  @backgroundMethod()
  async setCache({
    accountId,
    networkId,
    data,
  }: {
    accountId: string;
    networkId: string;
    data: IHomePageCacheItem;
  }) {
    const key = `${accountId}_${networkId}`;
    await this.setRawData((rawData) => ({
      ...rawData,
      [key]: data,
    }));
  }
}
