import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { buildLocalAggregateTokenMapKey } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  IAggregateToken,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBAggregateToken {
  aggregateTokenConfigMap?: Record<string, IAggregateToken>;
  aggregateTokenSymbolMap?: Record<string, boolean>;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  aggregateTokenMap?: Record<string, Record<string, ITokenFiat>>;
  aggregateTokenListMap?: Record<
    string,
    Record<
      string,
      {
        tokens: IAccountToken[];
      }
    >
  >;
  allAggregateTokenMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  allAggregateTokens?: IAccountToken[];
  tokenDetails?: Record<
    string, // all networks accountId
    Record<
      string, // aggregate token id
      {
        lastActiveTabName: string;
      }
    >
  >;
}

export class SimpleDbEntityAggregateToken extends SimpleDbEntityBase<ISimpleDBAggregateToken> {
  entityName = 'aggregateToken';

  override enableCache = false;

  @backgroundMethod()
  async getAggregateTokenConfigMap() {
    return (await this.getRawData())?.aggregateTokenConfigMap ?? {};
  }

  @backgroundMethod()
  async getHomeDefaultTokenMap() {
    return (await this.getRawData())?.homeDefaultTokenMap ?? {};
  }

  @backgroundMethod()
  async updateHomeDefaultTokenMap({
    homeDefaultTokenMap,
    merge = false,
  }: {
    homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
    merge?: boolean;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      homeDefaultTokenMap: merge
        ? { ...rawData?.homeDefaultTokenMap, ...homeDefaultTokenMap }
        : homeDefaultTokenMap,
    }));
  }

  @backgroundMethod()
  async getAggregateTokenMap({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const key = buildLocalAggregateTokenMapKey({
      networkId,
      accountId,
    });
    return (await this.getRawData())?.aggregateTokenMap?.[key] ?? {};
  }

  @backgroundMethod()
  async updateAggregateTokenMap({
    accountId,
    networkId,
    aggregateTokenMap,
  }: {
    accountId: string;
    networkId: string;
    aggregateTokenMap: Record<string, ITokenFiat>;
  }) {
    const key = buildLocalAggregateTokenMapKey({
      networkId,
      accountId,
    });
    await this.setRawData((rawData) => {
      return {
        ...rawData,
        aggregateTokenMap: {
          ...(rawData?.aggregateTokenMap ?? {}),
          [key]: aggregateTokenMap,
        },
      };
    });
  }

  @backgroundMethod()
  async getAggregateTokenListMap({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const key = buildLocalAggregateTokenMapKey({
      networkId,
      accountId,
    });
    return (await this.getRawData())?.aggregateTokenListMap?.[key] ?? {};
  }

  @backgroundMethod()
  async getAggregateTokenSymbolMap() {
    return (await this.getRawData())?.aggregateTokenSymbolMap ?? {};
  }

  @backgroundMethod()
  async updateAggregateTokenListMap({
    accountId,
    networkId,
    aggregateTokenListMap,
  }: {
    accountId: string;
    networkId: string;
    aggregateTokenListMap: Record<string, { tokens: IAccountToken[] }>;
  }) {
    const key = buildLocalAggregateTokenMapKey({
      networkId,
      accountId,
    });
    await this.setRawData((rawData) => ({
      ...rawData,
      aggregateTokenListMap: {
        ...(rawData?.aggregateTokenListMap ?? {}),
        [key]: {
          ...(rawData?.aggregateTokenListMap?.[key] ?? {}),
          ...aggregateTokenListMap,
        },
      },
    }));
  }

  @backgroundMethod()
  async updateAggregateTokenConfigMap({
    aggregateTokenConfigMap,
    merge = false,
  }: {
    aggregateTokenConfigMap: Record<string, IAggregateToken>;
    merge?: boolean;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      aggregateTokenConfigMap: merge
        ? { ...rawData?.aggregateTokenConfigMap, ...aggregateTokenConfigMap }
        : aggregateTokenConfigMap,
    }));
  }

  @backgroundMethod()
  async updateAllAggregateInfo({
    aggregateTokenConfigMap,
    aggregateTokenSymbolMap,
    homeDefaultTokenMap,
    allAggregateTokenMap,
    allAggregateTokens,
    merge = false,
  }: {
    allAggregateTokenMap: Record<string, { tokens: IAccountToken[] }>;
    allAggregateTokens: IAccountToken[];
    aggregateTokenConfigMap: Record<string, IAggregateToken>;
    aggregateTokenSymbolMap: Record<string, boolean>;
    homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
    merge?: boolean;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      aggregateTokenSymbolMap: merge
        ? { ...rawData?.aggregateTokenSymbolMap, ...aggregateTokenSymbolMap }
        : aggregateTokenSymbolMap,
      allAggregateTokenMap: merge
        ? { ...rawData?.allAggregateTokenMap, ...allAggregateTokenMap }
        : allAggregateTokenMap,
      allAggregateTokens: merge
        ? { ...rawData?.allAggregateTokens, ...allAggregateTokens }
        : allAggregateTokens,
      aggregateTokenConfigMap: merge
        ? { ...rawData?.aggregateTokenConfigMap, ...aggregateTokenConfigMap }
        : aggregateTokenConfigMap,
      homeDefaultTokenMap: merge
        ? { ...rawData?.homeDefaultTokenMap, ...homeDefaultTokenMap }
        : homeDefaultTokenMap,
    }));
  }

  @backgroundMethod()
  async updateLastActiveTabNameInTokenDetails({
    accountId,
    aggregateTokenId,
    lastActiveTabName,
  }: {
    accountId: string;
    aggregateTokenId: string;
    lastActiveTabName: string;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      tokenDetails: {
        ...rawData?.tokenDetails,
        [accountId]: {
          ...rawData?.tokenDetails?.[accountId],
          [aggregateTokenId]: {
            lastActiveTabName,
          },
        },
      },
    }));
  }

  @backgroundMethod()
  async getLastActiveTabNameInTokenDetails({
    accountId,
    aggregateTokenId,
  }: {
    accountId: string;
    aggregateTokenId: string;
  }) {
    return (await this.getRawData())?.tokenDetails?.[accountId]?.[
      aggregateTokenId
    ]?.lastActiveTabName;
  }

  @backgroundMethod()
  async clearLastActiveTabNameData() {
    await this.setRawData((rawData) => {
      return {
        ...rawData,
        tokenDetails: {},
      };
    });
  }
}
