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
  aggregateTokenConfigMap: Record<string, IAggregateToken>;
  homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
  aggregateTokenMap: Record<string, Record<string, ITokenFiat>>;
  aggregateTokenListMap: Record<
    string,
    Record<
      string,
      {
        tokens: IAccountToken[];
      }
    >
  >;
  allAggregateTokenMap: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  allAggregateTokens: IAccountToken[];
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
      allAggregateTokenMap: rawData?.allAggregateTokenMap ?? {},
      allAggregateTokens: rawData?.allAggregateTokens ?? [],
      aggregateTokenConfigMap: rawData?.aggregateTokenConfigMap ?? {},
      aggregateTokenMap: rawData?.aggregateTokenMap ?? {},
      aggregateTokenListMap: rawData?.aggregateTokenListMap ?? {},
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
        allAggregateTokenMap: rawData?.allAggregateTokenMap ?? {},
        allAggregateTokens: rawData?.allAggregateTokens ?? [],
        homeDefaultTokenMap: rawData?.homeDefaultTokenMap ?? {},
        aggregateTokenConfigMap: rawData?.aggregateTokenConfigMap ?? {},
        aggregateTokenListMap: rawData?.aggregateTokenListMap ?? {},
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
      aggregateTokenMap: rawData?.aggregateTokenMap ?? {},
      aggregateTokenConfigMap: rawData?.aggregateTokenConfigMap ?? {},
      allAggregateTokenMap: rawData?.allAggregateTokenMap ?? {},
      allAggregateTokens: rawData?.allAggregateTokens ?? [],
      homeDefaultTokenMap: rawData?.homeDefaultTokenMap ?? {},
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
      allAggregateTokenMap: rawData?.allAggregateTokenMap ?? {},
      allAggregateTokens: rawData?.allAggregateTokens ?? [],
      homeDefaultTokenMap: rawData?.homeDefaultTokenMap ?? {},
      aggregateTokenMap: rawData?.aggregateTokenMap ?? {},
      aggregateTokenListMap: rawData?.aggregateTokenListMap ?? {},
      aggregateTokenConfigMap: merge
        ? { ...rawData?.aggregateTokenConfigMap, ...aggregateTokenConfigMap }
        : aggregateTokenConfigMap,
    }));
  }

  @backgroundMethod()
  async updateAllAggregateInfo({
    aggregateTokenConfigMap,
    homeDefaultTokenMap,
    allAggregateTokenMap,
    allAggregateTokens,
    merge = false,
  }: {
    allAggregateTokenMap: Record<string, { tokens: IAccountToken[] }>;
    allAggregateTokens: IAccountToken[];
    aggregateTokenConfigMap: Record<string, IAggregateToken>;
    homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
    merge?: boolean;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      aggregateTokenMap: rawData?.aggregateTokenMap ?? {},
      aggregateTokenListMap: rawData?.aggregateTokenListMap ?? {},
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
}
