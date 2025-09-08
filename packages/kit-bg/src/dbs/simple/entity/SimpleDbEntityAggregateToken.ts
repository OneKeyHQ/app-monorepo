import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { buildLocalAggregateTokenMapKey } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAggregateToken,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBAggregateToken {
  aggregateTokenConfigMap: Record<string, IAggregateToken>;
  homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
  aggregateTokenMap: Record<string, Record<string, ITokenFiat>>;
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
      aggregateTokenConfigMap: rawData?.aggregateTokenConfigMap ?? {},
      aggregateTokenMap: rawData?.aggregateTokenMap ?? {},
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
        homeDefaultTokenMap: rawData?.homeDefaultTokenMap ?? {},
        aggregateTokenConfigMap: rawData?.aggregateTokenConfigMap ?? {},
        aggregateTokenMap: {
          ...(rawData?.aggregateTokenMap ?? {}),
          [key]: aggregateTokenMap,
        },
      };
    });
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
      homeDefaultTokenMap: rawData?.homeDefaultTokenMap ?? {},
      aggregateTokenMap: rawData?.aggregateTokenMap ?? {},
      aggregateTokenConfigMap: merge
        ? { ...rawData?.aggregateTokenConfigMap, ...aggregateTokenConfigMap }
        : aggregateTokenConfigMap,
    }));
  }
}
